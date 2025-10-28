import '@dotenvx/dotenvx/config';
import { json, raw } from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { logger } from './app-logger';
import { DatabaseManager } from './database';

// Import route module factories
import { createApiRouter } from './routes/api';
import { createOAuthRouter } from './routes/oauth';
import { createWebhookRouter } from './routes/webhooks';

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = [
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET',
	'GITHUB_APP_ID',
	'GITHUB_PRIVATE_KEY',
	'GITHUB_WEBHOOK_SECRET',
	'SESSION_ENCRYPTION_KEY'
];

for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		logger.error(`Missing required environment variable: ${envVar}`);
		process.exit(1);
	}
}

// Database setup
const database = new DatabaseManager(process.env.DATABASE_URL || './app.db');

// Middleware
app.use(cors());
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
	try {
		// Check database connectivity
		const dbCheck = database['db'].prepare('SELECT 1 as result').get();

		// Get pending jobs count
		const pendingJobs = database.getPendingJobs(1000).length;

		res.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			database: dbCheck ? 'connected' : 'error',
			workers: {
				active: activeWorkers,
				max: MAX_CONCURRENT_WORKERS,
			},
			jobs: {
				pending: pendingJobs,
			},
		});
	} catch (error) {
		logger.error('Health check failed', { error });
		res.status(503).json({
			status: 'error',
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

// Mount route modules (pass database to factory functions)
try {
	logger.info('Mounting OAuth router...');
	app.use('/auth', createOAuthRouter(database));
	logger.info('OAuth router mounted successfully');

	logger.info('Mounting Webhook router...');
	// Use raw body parser for webhooks (needed for signature verification)
	const webhookRouter = createWebhookRouter(database);
	app.use('/webhooks', raw({ type: 'application/json' }), webhookRouter);
	logger.info('Webhook router mounted successfully');

	logger.info('Mounting API router...');
	// Use JSON parser for API routes
	app.use('/api', json(), createApiRouter(database));
	logger.info('API router mounted successfully');
} catch (error) {
	logger.error('Error mounting routers:', error);
	throw error;
}

// Serve the web interface for all other routes
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================================================
// Background Job Worker Pool
// ============================================================================

const MAX_CONCURRENT_WORKERS = 5;
let activeWorkers = 0;
let workerInterval: NodeJS.Timeout | null = null;

/**
 * Process a single background job
 */
async function processJob(job: any): Promise<void> {
	const jobId = job.id;

	try {
		logger.info('Starting job processing', {
			jobId,
			type: job.type,
		});

		// Mark job as running
		database.updateBackgroundJob(jobId, {
			status: 'running',
			started_at: Date.now(),
		});

		// Parse job payload
		const payload = JSON.parse(job.payload_json);

		// Process based on job type
		let result: any = null;
		switch (job.type) {
			case 'apply_templates':
				result = await processApplyTemplatesJob(payload, false);
				break;

			case 'preview_templates':
				result = await processApplyTemplatesJob(payload, true);
				break;

			default:
				throw new Error(`Unknown job type: ${job.type}`);
		}

		// Mark job as completed
		database.updateBackgroundJob(jobId, {
			status: 'completed',
			completed_at: Date.now(),
		});

		logger.info('Job completed successfully', {
			jobId,
			type: job.type,
			result,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Increment attempts
		const newAttempts = job.attempts + 1;

		if (newAttempts >= job.max_attempts) {
			// Max attempts reached - mark as failed
			database.updateBackgroundJob(jobId, {
				status: 'failed',
				attempts: newAttempts,
				error_message: errorMessage,
				completed_at: Date.now(),
			});

			logger.error('Job failed after max attempts', {
				jobId,
				type: job.type,
				attempts: newAttempts,
				error: errorMessage,
			});
		} else {
			// Retry later
			const retryDelay = Math.pow(2, newAttempts) * 60 * 1000; // Exponential backoff
			database.updateBackgroundJob(jobId, {
				status: 'pending',
				attempts: newAttempts,
				scheduled_at: Date.now() + retryDelay,
				error_message: errorMessage,
			});

			logger.warn('Job failed, will retry', {
				jobId,
				type: job.type,
				attempts: newAttempts,
				retryIn: retryDelay / 1000 + 's',
				error: errorMessage,
			});
		}
	}
}

/**
 * Process an apply_templates job
 */
async function processApplyTemplatesJob(payload: any, isPreview: boolean = false): Promise<any> {
	const { repository, installation_id } = payload;

	logger.info('Processing template application job', {
		owner: repository.owner,
		repo: repository.name,
		repoId: repository.id,
		preview: isPreview,
	});

	// Get repository configuration
	const config = database.getRepositoryConfig(repository.id);
	if (!config) {
		throw new Error('Repository configuration not found');
	}

	// Parse configuration
	const configData = JSON.parse(config.config_json);
	if (!configData.templates || configData.templates.length === 0) {
		logger.info('No templates configured for repository', {
			owner: repository.owner,
			repo: repository.name,
		});
		return { message: 'No templates configured' };
	}

	// Get installation to create GitHub client
	const installation = database.getInstallationByGithubId(installation_id);
	if (!installation) {
		throw new Error('Installation not found');
	}

	// Create GitHub client with installation auth
	const appId = process.env.GITHUB_APP_ID;
	const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
	if (!appId || !privateKeyPath) {
		throw new Error('GitHub App credentials not configured');
	}

	const fs = await import('fs');
	const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

	const { GitHubClient } = await import('./github-client');
	const { GitHubTemplateManager } = await import('./github-template-manager');

	const githubClient = new GitHubClient(appId, privateKey, installation_id);

	const templateManager = new GitHubTemplateManager(githubClient);

	// If preview mode, use preview method
	if (isPreview) {
		const previewResults = [];
		for (const templateUrl of configData.templates) {
			const template = {
				url: typeof templateUrl === 'string' ? templateUrl : templateUrl.url,
				name: typeof templateUrl === 'string' ? templateUrl : (templateUrl.name || templateUrl.url),
				branch: typeof templateUrl === 'string' ? undefined : templateUrl.branch,
				subDirectory: typeof templateUrl === 'string' ? undefined : templateUrl.subDirectory,
			};

			const preview = await templateManager.previewTemplate(
				template,
				repository.owner,
				repository.name,
				configData.exclude_patterns || [],
				configData.merge_strategy || 'merge',
				configData.merge_strategies || [],
				configData.plugins || []
			);

			previewResults.push({
				template: template.name,
				...preview,
			});
		}

		return { preview: true, results: previewResults };
	}

	// Apply templates
	const results = [];
	for (const templateUrl of configData.templates) {
		const template = {
			url: typeof templateUrl === 'string' ? templateUrl : templateUrl.url,
			name: typeof templateUrl === 'string' ? templateUrl : (templateUrl.name || templateUrl.url),
			branch: typeof templateUrl === 'string' ? undefined : templateUrl.branch,
			subDirectory: typeof templateUrl === 'string' ? undefined : templateUrl.subDirectory,
		};

		logger.info('Applying template', {
			templateName: template.name,
			owner: repository.owner,
			repo: repository.name,
		});

		const result = await templateManager.processTemplate(
			template,
			repository.owner,
			repository.name,
			configData.exclude_patterns || [],
			configData.merge_strategy || 'merge',
			configData.merge_strategies || [],
			configData.plugins || []
		);

		results.push(result);

		// Record PR if created
		if (result.pullRequestNumber) {
			database.createPullRequestRecord({
				repo_id: repository.id,
				pr_number: result.pullRequestNumber,
				pr_url: `https://github.com/${repository.owner}/${repository.name}/pull/${result.pullRequestNumber}`,
				templates_applied: template.name,
				job_id: null,
			});

			logger.info('Pull request created', {
				owner: repository.owner,
				repo: repository.name,
				prNumber: result.pullRequestNumber,
				template: template.name,
			});
		}
	}

	await templateManager.cleanup();

	return {
		applied: true,
		results: results.map((r) => ({
			template: r.template.name,
			success: r.success,
			filesProcessed: r.filesProcessed,
			errors: r.errors,
			prNumber: r.pullRequestNumber,
		})),
	};
}

/**
 * Worker loop - processes pending jobs
 */
async function runWorker(): Promise<void> {
	if (activeWorkers >= MAX_CONCURRENT_WORKERS) {
		return; // Max workers already running
	}

	// Get pending jobs that are ready to run
	const pendingJobs = database.getPendingJobs(1);

	if (pendingJobs.length === 0) {
		return; // No jobs to process
	}

	const job = pendingJobs[0];

	// Check if job is scheduled for the future
	if (job.scheduled_at && job.scheduled_at > Date.now()) {
		return; // Job not ready yet
	}

	activeWorkers++;

	// Process job asynchronously
	processJob(job)
		.catch((error) => {
			logger.error('Unexpected error in job processing', {
				jobId: job.id,
				error: error instanceof Error ? error.message : String(error),
			});
		})
		.finally(() => {
			activeWorkers--;
		});
}

/**
 * Start the background job worker pool
 */
function startWorkerPool(): void {
	if (workerInterval) {
		return; // Already running
	}

	logger.info('Starting background job worker pool', {
		maxWorkers: MAX_CONCURRENT_WORKERS,
	});

	// Run worker check every 10 seconds
	workerInterval = setInterval(() => {
		runWorker().catch((error) => {
			logger.error('Worker pool error', {
				error: error instanceof Error ? error.message : String(error),
			});
		});
	}, 10000);
}

/**
 * Stop the background job worker pool
 */
function stopWorkerPool(): void {
	if (workerInterval) {
		clearInterval(workerInterval);
		workerInterval = null;
		logger.info('Stopped background job worker pool');
	}
}

// ============================================================================
// Data Retention Cleanup
// ============================================================================

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Run data retention cleanup
 */
function runCleanup(): void {
	try {
		logger.info('Running data retention cleanup');

		// Cleanup old webhook events (30 days processed, 90 days failed)
		database.cleanupOldWebhookEvents();

		// Cleanup old background jobs (30 days completed, 90 days failed)
		database.cleanupOldBackgroundJobs();

		// Cleanup old sessions (7 days)
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		const stmt = database['db'].prepare('DELETE FROM user_sessions WHERE created_at < ?');
		stmt.run(sevenDaysAgo);

		logger.info('Data retention cleanup completed');
	} catch (error) {
		logger.error('Data retention cleanup failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Start the cleanup scheduler (runs daily)
 */
function startCleanupScheduler(): void {
	if (cleanupInterval) {
		return; // Already running
	}

	logger.info('Starting data retention cleanup scheduler');

	// Run cleanup immediately on startup
	runCleanup();

	// Then run daily (24 hours)
	cleanupInterval = setInterval(() => {
		runCleanup();
	}, 24 * 60 * 60 * 1000);
}

/**
 * Stop the cleanup scheduler
 */
function stopCleanupScheduler(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
		logger.info('Stopped cleanup scheduler');
	}
}

// Initialize database and start server
async function startServer() {
	try {
		await database.initialize();
		logger.info('Database initialized successfully');

		app.listen(port, () => {
			logger.info(`🧵 RepoWeaver GitHub App running on port ${port}`);
			logger.info(`📝 Webhook endpoint: http://localhost:${port}/webhooks/github`);
			logger.info(`🔐 OAuth callback: http://localhost:${port}/auth/github/callback`);
		});

		// Start background job worker pool
		startWorkerPool();

		// Start cleanup scheduler
		startCleanupScheduler();
	} catch (error) {
		logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

// Graceful shutdown
process.on('SIGTERM', async () => {
	logger.info('Received SIGTERM, shutting down gracefully...');
	stopWorkerPool();
	stopCleanupScheduler();
	await database.close();
	process.exit(0);
});

process.on('SIGINT', async () => {
	logger.info('Received SIGINT, shutting down gracefully...');
	stopWorkerPool();
	stopCleanupScheduler();
	await database.close();
	process.exit(0);
});

startServer();
