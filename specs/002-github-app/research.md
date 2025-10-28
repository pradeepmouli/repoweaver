# Research: GitHub App for RepoWeaver

**Feature**: GitHub App Integration
**Date**: 2025-10-27
**Purpose**: Resolve technical unknowns and establish best practices for GitHub App implementation

## Research Areas

### 1. GitHub App Authentication & Installation Flow

**Decision**: Use GitHub App Installation Access Tokens with Octokit

**Rationale**:
- GitHub App authentication provides fine-grained repository permissions
- Installation tokens are scoped per installation, improving security
- Octokit's `@octokit/auth-app` handles JWT signing and token refresh automatically
- Installation tokens expire after 1 hour, reducing security risk from token theft

**Alternatives Considered**:
- **OAuth Apps**: Less secure (user-scoped tokens), deprecated for new integrations
- **Personal Access Tokens**: Not suitable for multi-user app, requires manual user management
- **GitHub Actions**: Limited to CI/CD workflows, not suitable for web app

**Implementation Pattern**:
```typescript
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    installationId: installation.id,
  }
});
```

**References**:
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit Authentication Strategies](https://github.com/octokit/auth-app.js)

---

### 2. Webhook Event Processing & Job Queue

**Decision**: Use in-process job queue with SQLite persistence and background worker threads

**Rationale**:
- SQLite provides ACID transactions for reliable job queuing
- No external dependencies (Redis, RabbitMQ) required for MVP
- Node.js worker threads can handle concurrent processing
- Simple to implement, debug, and deploy
- Meets 5 concurrent job requirement (FR-013a)

**Alternatives Considered**:
- **Redis with Bull/BullMQ**: Requires separate Redis instance, increases deployment complexity
- **AWS SQS/Lambda**: Cloud-specific, increases cost and coupling
- **Simple setTimeout**: No persistence, jobs lost on restart

**Implementation Pattern**:
```typescript
// Job queue schema in SQLite
CREATE TABLE background_jobs (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

// Simple worker pool
class JobQueue {
  private workers: Set<Promise<void>> = new Set();
  private readonly maxConcurrent = 5;

  async enqueue(job: Job): Promise<void> {
    await db.insertJob(job);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.workers.size >= this.maxConcurrent) return;

    const job = await db.getNextJob();
    if (!job) return;

    const worker = this.executeJob(job)
      .finally(() => this.workers.delete(worker));

    this.workers.add(worker);
  }
}
```

**References**:
- [SQLite as Application File Format](https://www.sqlite.org/appfileformat.html)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)

---

### 3. Webhook Debouncing Strategy

**Decision**: Implement time-based debouncing with 5-minute window using database timestamps

**Rationale**:
- Prevents PR spam from rapid successive commits (clarification answer 2)
- Simple to implement with SQL queries
- Stateless - works across server restarts
- Deterministic behavior (last webhook in window triggers processing)

**Alternatives Considered**:
- **Event counting**: Trigger after N events - unpredictable timing
- **Fixed schedule**: Process every N minutes - delays urgent updates
- **In-memory debounce**: Lost on restart, not suitable for web servers

**Implementation Pattern**:
```typescript
// On webhook received
async function handleWebhook(event: PushEvent): Promise<void> {
  const lastEvent = await db.getLastWebhookEvent(event.repository.id);
  const now = Date.now();

  // Cancel existing debounce timer if within window
  if (lastEvent && (now - lastEvent.created_at) < 5 * 60 * 1000) {
    await db.cancelDebouncedJob(lastEvent.job_id);
  }

  // Schedule new job 5 minutes from now
  const jobId = await jobQueue.enqueue({
    type: 'apply_templates',
    payload: { repositoryId: event.repository.id },
    scheduledAt: now + (5 * 60 * 1000)
  });

  await db.insertWebhookEvent({ ...event, job_id: jobId });
}
```

**References**:
- [Debouncing vs Throttling](https://css-tricks.com/debouncing-throttling-explained-examples/)
- [GitHub Webhook Best Practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)

---

### 4. Database Schema Design

**Decision**: Normalized schema with separate tables for each entity type

**Rationale**:
- Aligns with Key Entities from spec (Installation, Repository Configuration, Webhook Event, etc.)
- SQLite supports foreign keys and transactions
- Easy to query and maintain
- Supports data retention requirements (30/90 days)

**Schema Overview**:
```sql
-- GitHub App Installations
CREATE TABLE installations (
  id INTEGER PRIMARY KEY,
  github_installation_id INTEGER UNIQUE NOT NULL,
  account_id INTEGER NOT NULL,
  account_type TEXT NOT NULL, -- 'user' or 'organization'
  account_login TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  suspended_at INTEGER
);

-- Repository Configurations
CREATE TABLE repository_configs (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  github_repo_id INTEGER UNIQUE NOT NULL,
  repo_full_name TEXT NOT NULL,
  config_json TEXT NOT NULL, -- JSON stringified weaver config
  auto_update BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);

-- Webhook Events
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  job_id INTEGER,
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  FOREIGN KEY (job_id) REFERENCES background_jobs(id)
);

-- Background Jobs
CREATE TABLE background_jobs (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

-- Pull Request Records
CREATE TABLE pr_records (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_url TEXT NOT NULL,
  templates_applied TEXT NOT NULL, -- JSON array of template URLs
  job_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES background_jobs(id)
);

-- User Sessions (OAuth)
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  github_user_id INTEGER NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

**Data Retention Implementation**:
```typescript
// Cleanup job runs daily
async function cleanupOldRecords(): Promise<void> {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  // Delete successful events older than 30 days
  await db.run(`
    DELETE FROM webhook_events
    WHERE status = 'completed'
    AND created_at < ?
  `, [now - thirtyDays]);

  // Delete failed events older than 90 days
  await db.run(`
    DELETE FROM webhook_events
    WHERE status = 'failed'
    AND created_at < ?
  `, [now - ninetyDays]);

  // Same for background_jobs
  await db.run(`
    DELETE FROM background_jobs
    WHERE status = 'completed'
    AND completed_at < ?
  `, [now - thirtyDays]);

  await db.run(`
    DELETE FROM background_jobs
    WHERE status = 'failed'
    AND completed_at < ?
  `, [now - ninetyDays]);
}
```

**References**:
- [SQLite Foreign Key Support](https://www.sqlite.org/foreignkeys.html)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

---

### 5. GitHub API Rate Limiting & Backoff

**Decision**: Implement exponential backoff with Octokit's built-in retry plugin

**Rationale**:
- Octokit provides `@octokit/plugin-retry` with automatic exponential backoff
- Detects rate limit errors (403) and waits until reset time
- Configurable retry attempts and delays
- Meets FR-013 requirement

**Implementation Pattern**:
```typescript
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';

const MyOctokit = Octokit.plugin(retry);

const octokit = new MyOctokit({
  auth: installationToken,
  retry: {
    enabled: true,
    retries: 3,
    retryAfter: undefined, // Auto-detect from rate limit headers
  }
});

// Monitor rate limits
async function checkRateLimit(octokit: Octokit): Promise<void> {
  const { data } = await octokit.rateLimit.get();
  console.log(`Rate limit: ${data.rate.remaining}/${data.rate.limit}`);

  if (data.rate.remaining < 100) {
    // Log warning, potentially slow down job processing
    logger.warn('Approaching GitHub API rate limit');
  }
}
```

**References**:
- [GitHub REST API Rate Limiting](https://docs.github.com/en/rest/rate-limit)
- [Octokit Retry Plugin](https://github.com/octokit/plugin-retry.js)

---

### 6. OAuth Token Encryption

**Decision**: Use Node.js built-in `crypto` module with AES-256-GCM encryption

**Rationale**:
- AES-256-GCM provides authenticated encryption (prevents tampering)
- No external dependencies required
- Industry standard encryption algorithm
- Key stored in environment variable (never in code/database)

**Implementation Pattern**:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Security Notes**:
- Generate encryption key with: `openssl rand -hex 32`
- Store in `.env` file (never commit)
- Rotate keys periodically (requires re-encryption of existing tokens)

**References**:
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

### 7. Web UI Technology Stack

**Decision**: Vanilla JavaScript with Bootstrap 5 for UI (no frontend framework)

**Rationale**:
- Keeps bundle size minimal for fast load times (SC-004: <2 sec for 100 repos)
- No build step required for frontend
- Bootstrap provides responsive, accessible components out of box
- Maintains consistency with "simple, focused tooling" philosophy
- Easy for contributors to understand without React/Vue knowledge

**Alternatives Considered**:
- **React**: Overkill for simple CRUD UI, adds build complexity
- **Vue**: Similar concerns as React
- **Alpine.js**: Considered but vanilla JS sufficient for this scope

**Implementation Pattern**:
```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
</head>
<body>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>
```

```javascript
// app.js - Simple client-side routing and API calls
class RepoWeaverUI {
  async loadRepositories() {
    const response = await fetch('/api/repositories', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const repos = await response.json();
    this.renderRepositories(repos);
  }

  initDragAndDrop() {
    // SortableJS for template reordering (clarification answer 5)
    Sortable.create(document.getElementById('template-list'), {
      animation: 150,
      onEnd: (evt) => this.saveTemplateOrder()
    });
  }
}
```

**References**:
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)
- [SortableJS for Drag and Drop](https://github.com/SortableJS/Sortable)

---

### 8. Template Processing: GitHub API vs Local Git

**Decision**: Use GitHub Contents API to fetch template files in-memory (no local cloning)

**Rationale**:
- Aligns with Constitution Principle III (GitHub-First Integration)
- Eliminates file system dependencies and cleanup
- Faster than cloning for small templates
- Works with private repositories using installation tokens
- Existing `template-manager.ts` logic can be adapted for in-memory processing

**Implementation Pattern**:
```typescript
async function fetchTemplateFiles(
  octokit: Octokit,
  repo: string,
  ref: string = 'main',
  path: string = ''
): Promise<TemplateFile[]> {
  const { data } = await octokit.repos.getContent({
    owner: repo.split('/')[0],
    repo: repo.split('/')[1],
    path,
    ref
  });

  const files: TemplateFile[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.type === 'file') {
        const content = await fetchFileContent(octokit, item.download_url!);
        files.push({ path: item.path, content });
      } else if (item.type === 'dir') {
        const subFiles = await fetchTemplateFiles(octokit, repo, ref, item.path);
        files.push(...subFiles);
      }
    }
  }

  return files;
}

// Create new github-template-manager.ts that:
// 1. Fetches template files via GitHub API
// 2. Processes them in-memory using existing merge strategies
// 3. Pushes results to new branch via GitHub API
// 4. Creates pull request via GitHub API
```

**Limitations**:
- GitHub API has file size limit (1MB for Contents API)
- For large templates, may need to use Git Data API (blobs/trees)
- Rate limiting applies (mitigated by retry strategy)

**References**:
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
- [GitHub Git Data API](https://docs.github.com/en/rest/git)

---

### 9. Configuration File Updates via GitHub API

**Decision**: Use GitHub's "Create or Update File" API endpoint with `.weaver.json` commits

**Rationale**:
- Web UI changes must persist to `.weaver.json` (clarification answer 1)
- Ensures CLI and GitHub App stay in sync
- Creates audit trail of configuration changes
- Users can review config changes in pull requests

**Implementation Pattern**:
```typescript
async function updateWeaverConfig(
  octokit: Octokit,
  repo: string,
  config: WeaverConfig
): Promise<void> {
  const owner = repo.split('/')[0];
  const repoName = repo.split('/')[1];
  const path = '.weaver.json';

  // Get current file SHA (if exists)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path
    });
    if ('sha' in data) sha = data.sha;
  } catch (error) {
    // File doesn't exist yet
  }

  // Create or update
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path,
    message: 'Update RepoWeaver configuration via web UI',
    content: Buffer.from(JSON.stringify(config, null, 2)).toString('base64'),
    sha, // Required for updates
    branch: 'main' // Or create feature branch first
  });
}
```

**References**:
- [GitHub Create or Update File Contents](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

---

### 10. Error Handling & Logging

**Decision**: Use structured logging with Winston logger

**Rationale**:
- Structured logs enable searching and filtering in production
- Multiple transports (console, file, external service)
- Log levels (error, warn, info, debug) for different environments
- Supports JSON output for log aggregation services

**Implementation Pattern**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Processing webhook', {
  eventType: 'push',
  repository: repo.full_name,
  installationId
});

logger.error('Failed to create PR', {
  error: error.message,
  stack: error.stack,
  repository: repo.full_name
});
```

**References**:
- [Winston Logger](https://github.com/winstonjs/winston)
- [Twelve-Factor App Logs](https://12factor.net/logs)

---

## Summary of Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| Authentication | GitHub App Installation Tokens via Octokit | Fine-grained permissions, automatic refresh |
| Job Queue | SQLite + in-process worker pool | No external dependencies, ACID guarantees |
| Debouncing | 5-minute time window with database timestamps | Simple, stateless, deterministic |
| Database | Normalized SQLite schema with foreign keys | Data integrity, easy queries, transaction support |
| Rate Limiting | Octokit retry plugin with exponential backoff | Automatic handling, respects GitHub limits |
| Encryption | AES-256-GCM with Node.js crypto | Industry standard, authenticated encryption |
| Frontend | Vanilla JS + Bootstrap 5 + SortableJS | Fast load, no build step, accessible |
| Template Fetching | GitHub Contents API (in-memory) | No file system, works with private repos |
| Config Updates | GitHub Create/Update File API | CLI/App sync, audit trail |
| Logging | Winston with structured JSON logs | Searchable, multiple outputs, production-ready |

**All technical unknowns resolved. Ready for Phase 1 (Design & Contracts).**
