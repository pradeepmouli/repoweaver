import { Database as SQLiteDatabase } from 'sqlite3';
import { promisify } from 'util';

export interface Installation {
	id: number;
	account: string;
	accountType: string;
	suspended: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserSession {
	userId: number;
	login: string;
	accessToken: string;
	installationId?: number;
	createdAt: Date;
}

export interface RepositoryConfig {
	installationId: number;
	repository: string;
	templates: string[];
	mergeStrategy: 'overwrite' | 'merge' | 'skip';
	excludePatterns: string[];
	autoUpdate: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface Job {
	id?: number;
	type: string;
	installationId: number;
	targetRepository: string;
	templateRepository: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	result?: any;
	error?: string;
	createdAt: Date;
	updatedAt?: Date;
}

export interface TemplateConfiguration {
	templateRepository: string;
	targetRepository: string;
	installationId: number;
	autoUpdate: boolean;
}

export interface InstallationConfig {
	installationId: number;
	autoConfigureTemplates: boolean;
	defaultTemplates: string[];
}

export class Database {
	private db: SQLiteDatabase;
	private runAsync: (sql: string, params?: any[]) => Promise<any>;
	private getAsync: (sql: string, params?: any[]) => Promise<any>;
	private allAsync: (sql: string, params?: any[]) => Promise<any[]>;

	constructor(dbPath: string) {
		this.db = new SQLiteDatabase(dbPath);
		this.runAsync = promisify(this.db.run.bind(this.db));
		this.getAsync = promisify(this.db.get.bind(this.db));
		this.allAsync = promisify(this.db.all.bind(this.db));
	}

	async initialize(): Promise<void> {
		await this.createTables();
	}

	private async createTables(): Promise<void> {
		const createInstallationsTable = `
      CREATE TABLE IF NOT EXISTS installations (
        id INTEGER PRIMARY KEY,
        account TEXT NOT NULL,
        account_type TEXT NOT NULL,
        suspended BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

		const createUserSessionsTable = `
      CREATE TABLE IF NOT EXISTS user_sessions (
        user_id INTEGER PRIMARY KEY,
        login TEXT NOT NULL,
        access_token TEXT NOT NULL,
        installation_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id)
      )
    `;

		const createRepositoryConfigsTable = `
      CREATE TABLE IF NOT EXISTS repository_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        installation_id INTEGER NOT NULL,
        repository TEXT NOT NULL,
        templates TEXT NOT NULL,
        merge_strategy TEXT DEFAULT 'merge',
        exclude_patterns TEXT DEFAULT '[]',
        auto_update BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id),
        UNIQUE(installation_id, repository)
      )
    `;

		const createJobsTable = `
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        installation_id INTEGER NOT NULL,
        target_repository TEXT NOT NULL,
        template_repository TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id)
      )
    `;

		const createTemplateConfigsTable = `
      CREATE TABLE IF NOT EXISTS template_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_repository TEXT NOT NULL,
        target_repository TEXT NOT NULL,
        installation_id INTEGER NOT NULL,
        auto_update BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id),
        UNIQUE(template_repository, target_repository, installation_id)
      )
    `;

		const createInstallationConfigsTable = `
      CREATE TABLE IF NOT EXISTS installation_configs (
        installation_id INTEGER PRIMARY KEY,
        auto_configure_templates BOOLEAN DEFAULT FALSE,
        default_templates TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id)
      )
    `;

		await this.runAsync(createInstallationsTable);
		await this.runAsync(createUserSessionsTable);
		await this.runAsync(createRepositoryConfigsTable);
		await this.runAsync(createJobsTable);
		await this.runAsync(createTemplateConfigsTable);
		await this.runAsync(createInstallationConfigsTable);
	}

	async createInstallation(installation: Omit<Installation, 'suspended' | 'createdAt' | 'updatedAt'>): Promise<void> {
		const sql = `
      INSERT INTO installations (id, account, account_type)
      VALUES (?, ?, ?)
    `;
		await this.runAsync(sql, [installation.id, installation.account, installation.accountType]);
	}

	async deleteInstallation(installationId: number): Promise<void> {
		const sql = 'DELETE FROM installations WHERE id = ?';
		await this.runAsync(sql, [installationId]);
	}

	async suspendInstallation(installationId: number): Promise<void> {
		const sql = 'UPDATE installations SET suspended = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
		await this.runAsync(sql, [installationId]);
	}

	async unsuspendInstallation(installationId: number): Promise<void> {
		const sql = 'UPDATE installations SET suspended = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
		await this.runAsync(sql, [installationId]);
	}

	async createUserSession(session: UserSession): Promise<void> {
		const sql = `
      INSERT OR REPLACE INTO user_sessions (user_id, login, access_token, installation_id)
      VALUES (?, ?, ?, ?)
    `;
		await this.runAsync(sql, [session.userId, session.login, session.accessToken, session.installationId]);
	}

	async getUserSessionByToken(accessToken: string): Promise<UserSession | null> {
		const sql = 'SELECT * FROM user_sessions WHERE access_token = ?';
		const row = await this.getAsync(sql, [accessToken]);

		if (!row) return null;

		return {
			userId: row.user_id,
			login: row.login,
			accessToken: row.access_token,
			installationId: row.installation_id,
			createdAt: new Date(row.created_at),
		};
	}

	async deleteUserSession(userId: number): Promise<void> {
		const sql = 'DELETE FROM user_sessions WHERE user_id = ?';
		await this.runAsync(sql, [userId]);
	}

	async addRepositoryToInstallation(installationId: number, repository: string, fullName: string): Promise<void> {
		// For now, we'll just log this. In a full implementation, you might want to track which repositories are available
		console.log(`Repository ${fullName} added to installation ${installationId}`);
	}

	async removeRepositoryFromInstallation(installationId: number, repository: string): Promise<void> {
		// Clean up any configurations for this repository
		await this.deleteRepositoryConfig(`${installationId}/${repository}`);
	}

	async saveRepositoryConfig(config: RepositoryConfig): Promise<void> {
		const sql = `
      INSERT OR REPLACE INTO repository_configs
      (installation_id, repository, templates, merge_strategy, exclude_patterns, auto_update)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
		await this.runAsync(sql, [config.installationId, config.repository, JSON.stringify(config.templates), config.mergeStrategy, JSON.stringify(config.excludePatterns), config.autoUpdate]);
	}

	async getRepositoryConfig(installationId: number, repository: string): Promise<RepositoryConfig | null> {
		const sql = 'SELECT * FROM repository_configs WHERE installation_id = ? AND repository = ?';
		const row = await this.getAsync(sql, [installationId, repository]);

		if (!row) return null;

		return {
			installationId: row.installation_id,
			repository: row.repository,
			templates: JSON.parse(row.templates),
			mergeStrategy: row.merge_strategy,
			excludePatterns: JSON.parse(row.exclude_patterns),
			autoUpdate: row.auto_update === 1,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	}

	async deleteRepositoryConfig(repository: string): Promise<void> {
		const sql = 'DELETE FROM repository_configs WHERE repository = ?';
		await this.runAsync(sql, [repository]);
	}

	async queueJob(job: Job): Promise<void> {
		const sql = `
      INSERT INTO jobs (type, installation_id, target_repository, template_repository, status)
      VALUES (?, ?, ?, ?, ?)
    `;
		await this.runAsync(sql, [job.type, job.installationId, job.targetRepository, job.templateRepository, job.status]);
	}

	async getQueuedJobs(limit = 10): Promise<Job[]> {
		const sql = 'SELECT * FROM jobs WHERE status = "pending" ORDER BY created_at LIMIT ?';
		const rows = await this.allAsync(sql, [limit]);

		return rows.map((row) => ({
			id: row.id,
			type: row.type,
			installationId: row.installation_id,
			targetRepository: row.target_repository,
			templateRepository: row.template_repository,
			status: row.status,
			result: row.result ? JSON.parse(row.result) : undefined,
			error: row.error,
			createdAt: new Date(row.created_at),
			updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
		}));
	}

	async updateJobStatus(jobId: number, status: string, result?: any, error?: string): Promise<void> {
		const sql = `
      UPDATE jobs
      SET status = ?, result = ?, error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
		await this.runAsync(sql, [status, result ? JSON.stringify(result) : null, error, jobId]);
	}

	async getTemplateConfigurations(templateRepository: string): Promise<TemplateConfiguration[]> {
		const sql = 'SELECT * FROM template_configurations WHERE template_repository = ?';
		const rows = await this.allAsync(sql, [templateRepository]);

		return rows.map((row) => ({
			templateRepository: row.template_repository,
			targetRepository: row.target_repository,
			installationId: row.installation_id,
			autoUpdate: row.auto_update === 1,
		}));
	}

	async getInstallationConfig(installationId: number): Promise<InstallationConfig | null> {
		const sql = 'SELECT * FROM installation_configs WHERE installation_id = ?';
		const row = await this.getAsync(sql, [installationId]);

		if (!row) return null;

		return {
			installationId: row.installation_id,
			autoConfigureTemplates: row.auto_configure_templates === 1,
			defaultTemplates: JSON.parse(row.default_templates),
		};
	}

	async saveInstallationConfig(config: InstallationConfig): Promise<void> {
		const sql = `
      INSERT OR REPLACE INTO installation_configs
      (installation_id, auto_configure_templates, default_templates)
      VALUES (?, ?, ?)
    `;
		await this.runAsync(sql, [config.installationId, config.autoConfigureTemplates, JSON.stringify(config.defaultTemplates)]);
	}

	async close(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}
}
