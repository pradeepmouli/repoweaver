-- RepoWeaver GitHub App Database Schema
-- SQLite 3.x
-- Version: 1.0.0
-- Created: 2025-10-27

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- Insert initial version
INSERT INTO schema_version (version, applied_at) VALUES (1, strftime('%s', 'now') * 1000);

-- ============================================================================
-- Installations Table
-- ============================================================================
CREATE TABLE installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_installation_id INTEGER UNIQUE NOT NULL,
  account_id INTEGER NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('user', 'organization')),
  account_login TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  suspended_at INTEGER,
  CHECK (suspended_at IS NULL OR suspended_at >= installed_at)
);

CREATE UNIQUE INDEX idx_installations_github_id ON installations(github_installation_id);
CREATE INDEX idx_installations_account ON installations(account_id);

-- ============================================================================
-- Repository Configurations Table
-- ============================================================================
CREATE TABLE repository_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER NOT NULL,
  github_repo_id INTEGER UNIQUE NOT NULL,
  repo_full_name TEXT NOT NULL,
  config_json TEXT NOT NULL, -- WeaverConfig as JSON
  auto_update BOOLEAN NOT NULL DEFAULT 1 CHECK (auto_update IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (updated_at >= created_at),
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_repo_configs_github_id ON repository_configs(github_repo_id);
CREATE INDEX idx_repo_configs_installation ON repository_configs(installation_id);
CREATE INDEX idx_repo_configs_updated ON repository_configs(updated_at);

-- ============================================================================
-- Background Jobs Table
-- ============================================================================
CREATE TABLE background_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  CHECK (attempts >= 0 AND attempts <= max_attempts),
  CHECK (scheduled_at IS NULL OR scheduled_at >= created_at),
  CHECK (started_at IS NULL OR started_at >= created_at),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX idx_jobs_status ON background_jobs(status);
CREATE INDEX idx_jobs_scheduled ON background_jobs(scheduled_at);
CREATE INDEX idx_jobs_created ON background_jobs(created_at);
CREATE INDEX idx_jobs_queue ON background_jobs(status, scheduled_at) WHERE status = 'pending';

-- ============================================================================
-- Webhook Events Table
-- ============================================================================
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  job_id INTEGER,
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  CHECK (processed_at IS NULL OR processed_at >= created_at),
  FOREIGN KEY (job_id) REFERENCES background_jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_webhooks_type ON webhook_events(event_type);
CREATE INDEX idx_webhooks_status ON webhook_events(status);
CREATE INDEX idx_webhooks_created ON webhook_events(created_at);

-- ============================================================================
-- Pull Request Records Table
-- ============================================================================
CREATE TABLE pr_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  pr_number INTEGER NOT NULL CHECK (pr_number > 0),
  pr_url TEXT NOT NULL,
  templates_applied TEXT NOT NULL, -- JSON array of template URLs
  job_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repository_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES background_jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_pr_records_repo ON pr_records(repo_id);
CREATE INDEX idx_pr_records_created ON pr_records(created_at);
CREATE INDEX idx_pr_records_lookup ON pr_records(repo_id, pr_number);

-- ============================================================================
-- User Sessions Table
-- ============================================================================
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  github_user_id INTEGER NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_sessions_user ON user_sessions(github_user_id);

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Active installations (not suspended)
CREATE VIEW active_installations AS
SELECT * FROM installations 
WHERE suspended_at IS NULL;

-- Pending jobs ready to process
CREATE VIEW pending_jobs AS
SELECT * FROM background_jobs
WHERE status = 'pending'
  AND (scheduled_at IS NULL OR scheduled_at <= strftime('%s', 'now') * 1000)
ORDER BY created_at ASC;

-- Repository configs with installation info
CREATE VIEW repo_configs_with_installation AS
SELECT 
  rc.*,
  i.github_installation_id,
  i.account_login,
  i.account_type
FROM repository_configs rc
JOIN installations i ON rc.installation_id = i.id
WHERE i.suspended_at IS NULL;

-- ============================================================================
-- Triggers for automatic timestamp updates
-- ============================================================================

CREATE TRIGGER update_repo_config_timestamp
AFTER UPDATE ON repository_configs
FOR EACH ROW
BEGIN
  UPDATE repository_configs 
  SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- ============================================================================
-- Sample Queries (for reference)
-- ============================================================================

-- Get repository configuration with installation token
-- SELECT rc.*, i.github_installation_id
-- FROM repository_configs rc
-- JOIN installations i ON rc.installation_id = i.id
-- WHERE rc.github_repo_id = ?;

-- Get next pending job
-- SELECT * FROM pending_jobs LIMIT 1;

-- Count running jobs (for concurrency control)
-- SELECT COUNT(*) FROM background_jobs WHERE status = 'running';

-- Cleanup expired sessions
-- DELETE FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;

-- Cleanup old webhook events (30 days for successful, 90 for failed)
-- DELETE FROM webhook_events 
-- WHERE (status = 'processed' AND created_at < strftime('%s', 'now', '-30 days') * 1000)
--    OR (status = 'failed' AND created_at < strftime('%s', 'now', '-90 days') * 1000);

-- Cleanup old background jobs (30 days for completed, 90 for failed)
-- DELETE FROM background_jobs
-- WHERE (status = 'completed' AND completed_at < strftime('%s', 'now', '-30 days') * 1000)
--    OR (status = 'failed' AND completed_at < strftime('%s', 'now', '-90 days') * 1000);
