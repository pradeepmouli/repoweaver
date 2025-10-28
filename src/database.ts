import BetterSQLite3 from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions matching the database schema
export interface Installation {
	id: number;
	github_installation_id: number;
	account_id: number;
	account_type: 'user' | 'organization';
	account_login: string;
	installed_at: number;
	suspended_at: number | null;
}

export interface RepositoryConfig {
	id: number;
	installation_id: number;
	github_repo_id: number;
	repo_full_name: string;
	config_json: string;
	auto_update: boolean;
	created_at: number;
	updated_at: number;
}

export interface BackgroundJob {
	id: number;
	type: string;
	payload_json: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	attempts: number;
	max_attempts: number;
	scheduled_at: number | null;
	started_at: number | null;
	completed_at: number | null;
	error_message: string | null;
	created_at: number;
}

export interface WebhookEvent {
	id: number;
	event_type: string;
	payload_json: string;
	status: 'pending' | 'processed' | 'failed';
	job_id: number | null;
	created_at: number;
	processed_at: number | null;
}

export interface PullRequestRecord {
	id: number;
	repo_id: number;
	pr_number: number;
	pr_url: string;
	templates_applied: string;
	job_id: number | null;
	created_at: number;
}

export interface UserSession {
	id: number;
	session_token: string;
	github_user_id: number;
	access_token: string;
	expires_at: number;
	created_at: number;
}

export class DatabaseManager {
	private db: BetterSQLite3.Database;

	constructor(dbPath: string) {
		// Ensure the directory exists
		const dir = path.dirname(dbPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		this.db = new BetterSQLite3(dbPath);
		this.db.pragma('foreign_keys = ON');
		
		// Set busy timeout for handling concurrent access (5 seconds)
		this.db.pragma('busy_timeout = 5000');
		
		// Enable WAL mode for better concurrent read/write performance
		this.db.pragma('journal_mode = WAL');
	}

	/**
	 * Initialize database schema from SQL file
	 */
	async initialize(): Promise<void> {
		// Check if schema_version table exists
		const tableExists = this.db.prepare(`
			SELECT name FROM sqlite_master 
			WHERE type='table' AND name='schema_version'
		`).get();

		if (tableExists) {
			// Database already initialized, check version
			const currentVersion = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number } | undefined;
			const version = currentVersion?.version || 0;
			
			if (version >= 1) {
				// Already at current version
				return;
			}
		}

		// Read and execute schema
		const schemaPath = path.join(__dirname, '../specs/002-github-app/contracts/database.schema.sql');
		const schema = fs.readFileSync(schemaPath, 'utf-8');

		// Execute the entire schema as one transaction
		this.db.exec(schema);
	}

	/**
	 * Run database migration (for production use)
	 */
	async migrate(): Promise<void> {
		// Check current schema version
		const currentVersion = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number } | undefined;

		const version = currentVersion?.version || 0;

		// For now, we just have version 1
		if (version < 1) {
			await this.initialize();
		}
	}

	// ============================================================================
	// Installation Methods
	// ============================================================================

	createInstallation(installation: Omit<Installation, 'id'>): Installation {
		const stmt = this.db.prepare(`
      INSERT INTO installations (github_installation_id, account_id, account_type, account_login, installed_at)
      VALUES (?, ?, ?, ?, ?)
    `);

		const result = stmt.run(installation.github_installation_id, installation.account_id, installation.account_type, installation.account_login, installation.installed_at);

		return {
			id: result.lastInsertRowid as number,
			...installation,
		};
	}

	getInstallationByGithubId(githubInstallationId: number): Installation | undefined {
		const stmt = this.db.prepare('SELECT * FROM installations WHERE github_installation_id = ?');
		return stmt.get(githubInstallationId) as Installation | undefined;
	}

	getInstallation(id: number): Installation | undefined {
		const stmt = this.db.prepare('SELECT * FROM installations WHERE id = ?');
		return stmt.get(id) as Installation | undefined;
	}

	suspendInstallation(githubInstallationId: number): void {
		const stmt = this.db.prepare('UPDATE installations SET suspended_at = ? WHERE github_installation_id = ?');
		const now = Date.now();
		stmt.run(now, githubInstallationId);
	}

	deleteInstallation(githubInstallationId: number): void {
		const stmt = this.db.prepare('DELETE FROM installations WHERE github_installation_id = ?');
		stmt.run(githubInstallationId);
	}

	listInstallations(): Installation[] {
		const stmt = this.db.prepare('SELECT * FROM active_installations');
		return stmt.all() as Installation[];
	}

	// ============================================================================
	// Repository Config Methods
	// ============================================================================

	createRepositoryConfig(config: Omit<RepositoryConfig, 'id' | 'created_at' | 'updated_at'>): RepositoryConfig {
		const now = Date.now();
		const stmt = this.db.prepare(`
      INSERT INTO repository_configs (installation_id, github_repo_id, repo_full_name, config_json, auto_update, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

		const result = stmt.run(config.installation_id, config.github_repo_id, config.repo_full_name, config.config_json, config.auto_update ? 1 : 0, now, now);

		return {
			id: result.lastInsertRowid as number,
			...config,
			created_at: now,
			updated_at: now,
		};
	}

	getRepositoryConfig(githubRepoId: number): RepositoryConfig | undefined {
		const stmt = this.db.prepare('SELECT * FROM repository_configs WHERE github_repo_id = ?');
		return stmt.get(githubRepoId) as RepositoryConfig | undefined;
	}

	getRepositoryConfigById(id: number): RepositoryConfig | undefined {
		const stmt = this.db.prepare('SELECT * FROM repository_configs WHERE id = ?');
		return stmt.get(id) as RepositoryConfig | undefined;
	}

	updateRepositoryConfig(githubRepoId: number, updates: Partial<Omit<RepositoryConfig, 'id' | 'created_at' | 'updated_at'>>): void {
		const fields: string[] = [];
		const values: any[] = [];

		if (updates.config_json !== undefined) {
			fields.push('config_json = ?');
			values.push(updates.config_json);
		}
		if (updates.auto_update !== undefined) {
			fields.push('auto_update = ?');
			values.push(updates.auto_update ? 1 : 0);
		}

		if (fields.length === 0) return;

		fields.push('updated_at = ?');
		values.push(Date.now());
		values.push(githubRepoId);

		const stmt = this.db.prepare(`UPDATE repository_configs SET ${fields.join(', ')} WHERE github_repo_id = ?`);
		stmt.run(...values);
	}

	deleteRepositoryConfig(githubRepoId: number): void {
		const stmt = this.db.prepare('DELETE FROM repository_configs WHERE github_repo_id = ?');
		stmt.run(githubRepoId);
	}

	listRepositoryConfigsByInstallation(installationId: number): RepositoryConfig[] {
		const stmt = this.db.prepare('SELECT * FROM repository_configs WHERE installation_id = ?');
		return stmt.all(installationId) as RepositoryConfig[];
	}

	listAllRepositoryConfigs(): RepositoryConfig[] {
		const stmt = this.db.prepare('SELECT * FROM repository_configs');
		return stmt.all() as RepositoryConfig[];
	}

	// ============================================================================
	// Background Job Methods
	// ============================================================================

	createBackgroundJob(job: Omit<BackgroundJob, 'id' | 'created_at'>): BackgroundJob {
		const now = Date.now();
		const stmt = this.db.prepare(`
      INSERT INTO background_jobs (type, payload_json, status, attempts, max_attempts, scheduled_at, started_at, completed_at, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

		const result = stmt.run(job.type, job.payload_json, job.status, job.attempts, job.max_attempts, job.scheduled_at, job.started_at, job.completed_at, job.error_message, now);

		return {
			id: result.lastInsertRowid as number,
			...job,
			created_at: now,
		};
	}

	getBackgroundJob(id: number): BackgroundJob | undefined {
		const stmt = this.db.prepare('SELECT * FROM background_jobs WHERE id = ?');
		return stmt.get(id) as BackgroundJob | undefined;
	}

	updateBackgroundJob(id: number, updates: Partial<Omit<BackgroundJob, 'id' | 'created_at'>>): void {
		const fields: string[] = [];
		const values: any[] = [];

		if (updates.status !== undefined) {
			fields.push('status = ?');
			values.push(updates.status);
		}
		if (updates.attempts !== undefined) {
			fields.push('attempts = ?');
			values.push(updates.attempts);
		}
		if (updates.started_at !== undefined) {
			fields.push('started_at = ?');
			values.push(updates.started_at);
		}
		if (updates.completed_at !== undefined) {
			fields.push('completed_at = ?');
			values.push(updates.completed_at);
		}
		if (updates.error_message !== undefined) {
			fields.push('error_message = ?');
			values.push(updates.error_message);
		}

		if (fields.length === 0) return;

		values.push(id);

		const stmt = this.db.prepare(`UPDATE background_jobs SET ${fields.join(', ')} WHERE id = ?`);
		stmt.run(...values);
	}

	getPendingJobs(limit: number = 10): BackgroundJob[] {
		const stmt = this.db.prepare('SELECT * FROM pending_jobs LIMIT ?');
		return stmt.all(limit) as BackgroundJob[];
	}

	getRunningJobsCount(): number {
		const stmt = this.db.prepare("SELECT COUNT(*) as count FROM background_jobs WHERE status = 'running'");
		const result = stmt.get() as { count: number };
		return result.count;
	}

	getRecentJobForRepository(githubRepoId: number, sinceTimestamp: number): BackgroundJob | undefined {
		const stmt = this.db.prepare(`
			SELECT * FROM background_jobs 
			WHERE status = 'pending' 
			AND payload_json LIKE ?
			AND created_at >= ?
			ORDER BY created_at DESC 
			LIMIT 1
		`);
		return stmt.get(`%"github_repo_id":${githubRepoId}%`, sinceTimestamp) as BackgroundJob | undefined;
	}

	// ============================================================================
	// Webhook Event Methods
	// ============================================================================

	createWebhookEvent(event: Omit<WebhookEvent, 'id' | 'created_at'>): WebhookEvent {
		const now = Date.now();
		const stmt = this.db.prepare(`
      INSERT INTO webhook_events (event_type, payload_json, status, job_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

		const result = stmt.run(event.event_type, event.payload_json, event.status, event.job_id, now);

		return {
			id: result.lastInsertRowid as number,
			...event,
			created_at: now,
		};
	}

	updateWebhookEvent(id: number, updates: Partial<Omit<WebhookEvent, 'id' | 'created_at'>>): void {
		const fields: string[] = [];
		const values: any[] = [];

		if (updates.status !== undefined) {
			fields.push('status = ?');
			values.push(updates.status);
		}
		if (updates.job_id !== undefined) {
			fields.push('job_id = ?');
			values.push(updates.job_id);
		}
		if (updates.processed_at !== undefined) {
			fields.push('processed_at = ?');
			values.push(updates.processed_at);
		}

		if (fields.length === 0) return;

		values.push(id);

		const stmt = this.db.prepare(`UPDATE webhook_events SET ${fields.join(', ')} WHERE id = ?`);
		stmt.run(...values);
	}

	// ============================================================================
	// Pull Request Record Methods
	// ============================================================================

	createPullRequestRecord(pr: Omit<PullRequestRecord, 'id' | 'created_at'>): PullRequestRecord {
		const now = Date.now();
		const stmt = this.db.prepare(`
      INSERT INTO pr_records (repo_id, pr_number, pr_url, templates_applied, job_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

		const result = stmt.run(pr.repo_id, pr.pr_number, pr.pr_url, pr.templates_applied, pr.job_id, now);

		return {
			id: result.lastInsertRowid as number,
			...pr,
			created_at: now,
		};
	}

	listPullRequestsByRepo(repoId: number, limit: number = 10): PullRequestRecord[] {
		const stmt = this.db.prepare('SELECT * FROM pr_records WHERE repo_id = ? ORDER BY created_at DESC LIMIT ?');
		return stmt.all(repoId, limit) as PullRequestRecord[];
	}

	// ============================================================================
	// User Session Methods
	// ============================================================================

	createUserSession(session: Omit<UserSession, 'id' | 'created_at'>): UserSession {
		const now = Date.now();
		const stmt = this.db.prepare(`
      INSERT INTO user_sessions (session_token, github_user_id, access_token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

		const result = stmt.run(session.session_token, session.github_user_id, session.access_token, session.expires_at, now);

		return {
			id: result.lastInsertRowid as number,
			...session,
			created_at: now,
		};
	}

	getUserSessionByToken(sessionToken: string): UserSession | undefined {
		const stmt = this.db.prepare('SELECT * FROM user_sessions WHERE session_token = ?');
		return stmt.get(sessionToken) as UserSession | undefined;
	}

	deleteUserSession(sessionToken: string): void {
		const stmt = this.db.prepare('DELETE FROM user_sessions WHERE session_token = ?');
		stmt.run(sessionToken);
	}

	deleteExpiredSessions(): void {
		const now = Date.now();
		const stmt = this.db.prepare('DELETE FROM user_sessions WHERE expires_at < ?');
		stmt.run(now);
	}

	// ============================================================================
	// Cleanup Methods
	// ============================================================================

	cleanupOldWebhookEvents(): void {
		const now = Date.now();
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
		const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

		const stmt = this.db.prepare(`
      DELETE FROM webhook_events 
      WHERE (status = 'processed' AND created_at < ?)
         OR (status = 'failed' AND created_at < ?)
    `);

		stmt.run(thirtyDaysAgo, ninetyDaysAgo);
	}

	cleanupOldBackgroundJobs(): void {
		const now = Date.now();
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
		const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

		const stmt = this.db.prepare(`
      DELETE FROM background_jobs
      WHERE (status = 'completed' AND completed_at < ?)
         OR (status = 'failed' AND completed_at < ?)
    `);

		stmt.run(thirtyDaysAgo, ninetyDaysAgo);
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	close(): void {
		this.db.close();
	}
}

