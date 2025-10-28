# Data Model: GitHub App for RepoWeaver

**Feature**: GitHub App Integration  
**Date**: 2025-10-27  
**Purpose**: Define database schema and entity relationships for GitHub App persistence

## Entity Relationship Diagram

```text
┌─────────────────────┐
│   installations     │
│─────────────────────│
│ id (PK)             │
│ github_install_id ◄─┼─────┐
│ account_id          │     │
│ account_type        │     │
│ account_login       │     │
│ installed_at        │     │
│ suspended_at        │     │
└─────────────────────┘     │
         △                  │
         │                  │
         │                  │
         │ 1:N              │
         │                  │
┌────────┴────────────┐     │
│ repository_configs  │     │
│─────────────────────│     │
│ id (PK)             │     │
│ installation_id (FK)│─────┘
│ github_repo_id      │
│ repo_full_name      │
│ config_json         │◄───── Stores WeaverConfig as JSON
│ auto_update         │
│ created_at          │
│ updated_at          │
└─────────────────────┘
         △
         │
         │ 1:N
         │
┌────────┴────────────┐
│    pr_records       │
│─────────────────────│
│ id (PK)             │
│ repo_id (FK)        │
│ pr_number           │
│ pr_url              │
│ templates_applied   │◄───── JSON array of template URLs
│ job_id (FK)         │─────┐
│ created_at          │     │
└─────────────────────┘     │
                            │
┌─────────────────────┐     │
│  background_jobs    │     │
│─────────────────────│     │
│ id (PK)             │◄────┘
│ type                │
│ payload_json        │
│ status              │
│ attempts            │
│ max_attempts        │
│ scheduled_at        │
│ started_at          │
│ completed_at        │
│ error_message       │
│ created_at          │
└─────────────────────┘
         △
         │
         │ 1:1
         │
┌────────┴────────────┐
│  webhook_events     │
│─────────────────────│
│ id (PK)             │
│ event_type          │
│ payload_json        │
│ status              │
│ job_id (FK)         │─────┘
│ created_at          │
│ processed_at        │
└─────────────────────┘

┌─────────────────────┐
│   user_sessions     │
│─────────────────────│
│ id (PK)             │
│ session_token       │◄───── UUID, unique index
│ github_user_id      │
│ access_token        │◄───── Encrypted GitHub OAuth token
│ expires_at          │
│ created_at          │
└─────────────────────┘
```

## Entity Definitions

### 1. Installation

**Purpose**: Tracks GitHub App installations on user accounts or organizations

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| github_installation_id | INTEGER | UNIQUE, NOT NULL | GitHub's installation ID |
| account_id | INTEGER | NOT NULL | GitHub account ID (user or org) |
| account_type | TEXT | NOT NULL | 'user' or 'organization' |
| account_login | TEXT | NOT NULL | GitHub username or org name |
| installed_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| suspended_at | INTEGER | NULL | Unix timestamp when suspended/uninstalled |

**Indexes**:

- UNIQUE INDEX on `github_installation_id`
- INDEX on `account_id` for lookups

**Validation Rules**:

- `account_type` must be 'user' or 'organization'
- `installed_at` must be <= current time
- `suspended_at` must be NULL or >= `installed_at`

**State Transitions**:

```text
[New Installation] → installed_at set → Active
Active → suspended_at set → Suspended
Suspended → suspended_at cleared → Active (reinstalled)
```

---

### 2. RepositoryConfig

**Purpose**: Stores template configuration for each connected repository

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| installation_id | INTEGER | NOT NULL, FK | Links to installations.id |
| github_repo_id | INTEGER | UNIQUE, NOT NULL | GitHub's repository ID |
| repo_full_name | TEXT | NOT NULL | owner/repo format |
| config_json | TEXT | NOT NULL | JSON stringified WeaverConfig |
| auto_update | BOOLEAN | DEFAULT 1 | Enable auto-updates from templates |
| created_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| updated_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**:

- UNIQUE INDEX on `github_repo_id`
- INDEX on `installation_id` for lookups
- INDEX on `updated_at` for sorting

**Foreign Keys**:

- `installation_id` REFERENCES `installations(id)` ON DELETE CASCADE

**Validation Rules**:

- `config_json` must be valid JSON parseable as WeaverConfig
- `repo_full_name` must match pattern `^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$`
- `auto_update` must be 0 (false) or 1 (true)
- `updated_at` must be >= `created_at`

**Config JSON Structure** (WeaverConfig):

```typescript
interface WeaverConfig {
  templates: Array<string | TemplateRepository>;
  mergeStrategy?: 'merge' | 'overwrite' | 'skip';
  excludePatterns?: string[];
  includePatterns?: string[];
  primarySource?: string;
  mergeStrategies?: Record<string, MergeStrategyConfig>;
}

interface TemplateRepository {
  url: string;
  branch?: string;
  subdirectory?: string;
  excludePatterns?: string[];
}
```

---

### 3. WebhookEvent

**Purpose**: Audit trail and retry support for GitHub webhook deliveries

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| event_type | TEXT | NOT NULL | GitHub event type (e.g., 'push') |
| payload_json | TEXT | NOT NULL | Full GitHub webhook payload |
| status | TEXT | DEFAULT 'pending' | 'pending', 'processed', 'failed' |
| job_id | INTEGER | NULL, FK | Links to background_jobs.id |
| created_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| processed_at | INTEGER | NULL | Unix timestamp when processed |

**Indexes**:

- INDEX on `event_type` for filtering
- INDEX on `created_at` for retention cleanup
- INDEX on `status` for pending event queries

**Foreign Keys**:

- `job_id` REFERENCES `background_jobs(id)` ON DELETE SET NULL

**Validation Rules**:

- `status` must be 'pending', 'processed', or 'failed'
- `processed_at` must be NULL or >= `created_at`
- `event_type` must match GitHub webhook event names

**Data Retention**:

- Successful events (`status = 'processed'`): Deleted after 30 days
- Failed events (`status = 'failed'`): Deleted after 90 days
- See research.md for cleanup implementation

---

### 4. BackgroundJob

**Purpose**: Job queue for asynchronous template processing and PR creation

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| type | TEXT | NOT NULL | Job type ('apply_templates', 'cleanup', etc.) |
| payload_json | TEXT | NOT NULL | Job-specific parameters as JSON |
| status | TEXT | DEFAULT 'pending' | 'pending', 'running', 'completed', 'failed' |
| attempts | INTEGER | DEFAULT 0 | Number of execution attempts |
| max_attempts | INTEGER | DEFAULT 3 | Maximum retry attempts |
| scheduled_at | INTEGER | NULL | Unix timestamp for delayed execution |
| started_at | INTEGER | NULL | Unix timestamp when job started |
| completed_at | INTEGER | NULL | Unix timestamp when job finished |
| error_message | TEXT | NULL | Error details if failed |
| created_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**:

- INDEX on `status` for job queue queries
- INDEX on `scheduled_at` for delayed job processing
- INDEX on `created_at` for retention cleanup
- COMPOSITE INDEX on `(status, scheduled_at)` for efficient queue operations

**Validation Rules**:

- `status` must be 'pending', 'running', 'completed', or 'failed'
- `attempts` must be >= 0 and <= `max_attempts`
- `scheduled_at` must be NULL or >= `created_at`
- `started_at` must be NULL or >= `created_at`
- `completed_at` must be NULL or >= `started_at`

**State Transitions**:

```text
[New Job] → status='pending' → Queued
Queued → status='running', started_at set → Processing
Processing → status='completed', completed_at set → Done
Processing → status='failed', completed_at set, attempts++ → Failed
Failed (attempts < max_attempts) → status='pending' → Retry
```

**Payload Examples**:

```json
{
  "type": "apply_templates",
  "payload_json": "{\"repositoryId\": 12345, \"triggeredBy\": \"webhook\"}"
}

{
  "type": "cleanup",
  "payload_json": "{\"olderThan\": 1698364800000}"
}
```

**Concurrency Control**:

- Maximum 5 jobs with `status='running'` (enforced in application code)
- Jobs with `scheduled_at > NOW()` are not eligible for processing
- Worker pool checks for pending jobs every 5 seconds

**Data Retention**:

- Successful jobs (`status = 'completed'`): Deleted after 30 days from `completed_at`
- Failed jobs (`status = 'failed'`): Deleted after 90 days from `completed_at`

---

### 5. PullRequestRecord

**Purpose**: Track PRs created by the app for history and debugging

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| repo_id | INTEGER | NOT NULL, FK | Links to repository_configs.id |
| pr_number | INTEGER | NOT NULL | GitHub PR number |
| pr_url | TEXT | NOT NULL | Full GitHub PR URL |
| templates_applied | TEXT | NOT NULL | JSON array of template URLs |
| job_id | INTEGER | NULL, FK | Links to background_jobs.id |
| created_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**:

- INDEX on `repo_id` for repository history
- INDEX on `created_at` for recent PR queries
- COMPOSITE INDEX on `(repo_id, pr_number)` for uniqueness

**Foreign Keys**:

- `repo_id` REFERENCES `repository_configs(id)` ON DELETE CASCADE
- `job_id` REFERENCES `background_jobs(id)` ON DELETE SET NULL

**Validation Rules**:

- `pr_number` must be > 0
- `pr_url` must match GitHub URL pattern
- `templates_applied` must be valid JSON array of strings

**Templates Applied Structure**:

```json
[
  "https://github.com/org/template1",
  "https://github.com/org/template2#branch-name",
  "https://github.com/org/template3#main:subdirectory"
]
```

---

### 6. UserSession

**Purpose**: Manage OAuth user sessions for web UI authentication

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Internal ID |
| session_token | TEXT | UNIQUE, NOT NULL | UUID v4 session identifier |
| github_user_id | INTEGER | NOT NULL | GitHub user ID |
| access_token | TEXT | NOT NULL | Encrypted GitHub OAuth token |
| expires_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |
| created_at | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**:

- UNIQUE INDEX on `session_token` for fast lookups
- INDEX on `expires_at` for cleanup queries
- INDEX on `github_user_id` for user session queries

**Validation Rules**:

- `session_token` must be valid UUID v4
- `access_token` must be encrypted (format: `iv:authTag:ciphertext`)
- `expires_at` must be > `created_at`

**Security Notes**:

- `access_token` encrypted using AES-256-GCM (see research.md)
- Sessions expire after 7 days (configurable)
- Cleanup job removes expired sessions daily

**Session Lifecycle**:

```text
[OAuth Success] → session created, expires_at = now + 7 days
[Each Request] → validate session_token, check expires_at
[Expired] → delete session, redirect to login
[Logout] → delete session
```

---

## Database Schema SQL

**File**: `specs/002-github-app/contracts/database.schema.sql`

(See contracts/ directory for complete SQL schema)

---

## Relationships Summary

| From | To | Type | Description |
|------|----|----|-------------|
| repository_configs | installations | N:1 | Each config belongs to one installation |
| pr_records | repository_configs | N:1 | PRs belong to one repository |
| pr_records | background_jobs | N:1 | PR created by one job |
| webhook_events | background_jobs | N:1 | Webhook creates one job |

**Cascade Delete Rules**:

- When installation deleted → all repository_configs deleted
- When repository_config deleted → all pr_records deleted
- When background_job deleted → webhook_events.job_id set to NULL, pr_records.job_id set to NULL

---

## Migration Strategy

**Phase 1**: Create tables in order (respecting foreign key dependencies)

1. installations
2. repository_configs
3. background_jobs
4. webhook_events
5. pr_records
6. user_sessions

**Phase 2**: Add indexes for performance

**Phase 3**: Insert seed data (if needed for development)

**Rollback**: Drop tables in reverse order

**Version Control**: Track schema version in `schema_version` table:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

---

## Performance Considerations

**Expected Load**:

- 100-1000 installations
- 10-100 repositories per installation
- 10-100 webhook events per hour
- 5 concurrent background jobs (max)

**Optimization**:

- Indexes on foreign keys and commonly queried columns
- Composite indexes for complex queries
- Regular VACUUM and ANALYZE on SQLite database
- Delete old records via cleanup job (30/90 day retention)

**Query Examples**:

```sql
-- Get pending jobs ready to process
SELECT * FROM background_jobs 
WHERE status = 'pending' 
  AND (scheduled_at IS NULL OR scheduled_at <= ?)
ORDER BY created_at ASC
LIMIT 5;

-- Get repository configuration
SELECT rc.*, i.github_installation_id
FROM repository_configs rc
JOIN installations i ON rc.installation_id = i.id
WHERE rc.github_repo_id = ?;

-- Cleanup expired sessions
DELETE FROM user_sessions 
WHERE expires_at < ?;
```

---

## Summary

Database schema designed for:

✅ Data integrity (foreign keys, constraints)  
✅ Performance (indexes on query columns)  
✅ Audit trail (timestamps, event logs)  
✅ Security (encrypted tokens)  
✅ Scalability (efficient queries, retention policies)  
✅ Compliance with constitutional principles (type safety, no violations)
