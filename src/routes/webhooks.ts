import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { DatabaseManager, RepositoryConfig } from '../database';
import { logger } from '../app-logger';

export function createWebhookRouter(db: DatabaseManager): Router {
	const router = Router();

	const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

	if (!webhookSecret) {
		throw new Error('GITHUB_WEBHOOK_SECRET is required');
	}

	/**
	 * Verify GitHub webhook signature
	 */
	function verifySignature(payload: string, signature: string | undefined): boolean {
		if (!signature || !webhookSecret) {
			return false;
		}

		const hmac = createHmac('sha256', webhookSecret);
		hmac.update(payload);
		const digest = 'sha256=' + hmac.digest('hex');

		return signature === digest;
	}

	/**
	 * POST /webhooks/github
	 * Handle GitHub webhook events
	 */
	router.post('/github', async (req: Request, res: Response) => {
		const signature = req.headers['x-hub-signature-256'] as string;
		const event = req.headers['x-github-event'] as string;
		const deliveryId = req.headers['x-github-delivery'] as string;

		// Verify signature
		const payload = JSON.stringify(req.body);
		if (!verifySignature(payload, signature)) {
			logger.warn('Invalid webhook signature', { deliveryId, event });
			return res.status(401).json({ error: 'Invalid signature' });
		}

		logger.info('Webhook received', {
			event,
			deliveryId,
			action: req.body.action,
		});

		try {
			// Store webhook event
			db.createWebhookEvent({
				event_type: event,
				payload_json: payload,
				status: 'pending',
				job_id: null,
				processed_at: null,
			});

			// Handle different event types
			switch (event) {
				case 'installation':
					await handleInstallation(db, req.body);
					break;

				case 'installation_repositories':
					await handleInstallationRepositories(db, req.body);
					break;

				case 'push':
					await handlePush(db, req.body);
					break;

				default:
					logger.debug('Unhandled webhook event', { event });
			}

			res.status(200).json({ success: true });
		} catch (error) {
			logger.error('Webhook processing error', {
				error: error instanceof Error ? error.message : String(error),
				event,
				deliveryId,
			});
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	return router;
}

/**
 * Handle installation events (created, deleted, suspend, unsuspend)
 */
async function handleInstallation(db: DatabaseManager, payload: any): Promise<void> {
	const action = payload.action;
	const installation = payload.installation;

	logger.info('Installation event', {
		action,
		installationId: installation.id,
		account: installation.account.login,
	});

	switch (action) {
		case 'created':
			// Create installation record
			db.createInstallation({
				github_installation_id: installation.id,
				account_id: installation.account.id,
				account_type: installation.account.type.toLowerCase() as 'user' | 'organization',
				account_login: installation.account.login,
				installed_at: Date.now(),
				suspended_at: null,
			});
			logger.info('Installation created', {
				installationId: installation.id,
				account: installation.account.login,
			});
			break;

		case 'deleted':
			// Delete installation record
			db.deleteInstallation(installation.id);
			logger.info('Installation deleted', {
				installationId: installation.id,
			});
			break;

		case 'suspend':
			// Suspend installation
			db.suspendInstallation(installation.id);
			logger.info('Installation suspended', {
				installationId: installation.id,
			});
			break;

		case 'unsuspend':
			// Unsuspend installation (update suspended_at to null)
			const existingInstallation = db.getInstallationByGithubId(installation.id);
			if (existingInstallation) {
				// Just update suspended_at to null by deleting and recreating
				db.deleteInstallation(installation.id);
				db.createInstallation({
					github_installation_id: installation.id,
					account_id: installation.account.id,
					account_type: installation.account.type.toLowerCase() as 'user' | 'organization',
					account_login: installation.account.login,
					installed_at: existingInstallation.installed_at,
					suspended_at: null,
				});
			}
			logger.info('Installation unsuspended', {
				installationId: installation.id,
			});
			break;
	}
}

/**
 * Handle installation_repositories events (added, removed)
 */
async function handleInstallationRepositories(db: DatabaseManager, payload: any): Promise<void> {
	const action = payload.action;
	const installation = payload.installation;

	logger.info('Installation repositories event', {
		action,
		installationId: installation.id,
		repositoriesAdded: payload.repositories_added?.length || 0,
		repositoriesRemoved: payload.repositories_removed?.length || 0,
	});

	// For now, just log. Repository management will be implemented in Phase 4
}

/**
 * Handle push events with 5-minute debounce
 * Multiple pushes within 5 minutes will be batched into a single job
 */
async function handlePush(db: DatabaseManager, payload: any): Promise<void> {
	const repository = payload.repository;
	const ref = payload.ref;
	const pusher = payload.pusher;

	logger.info('Push event received', {
		repository: repository.full_name,
		ref,
		pusher: pusher.name,
		commits: payload.commits?.length || 0,
	});

	// Only process pushes to default branch
	const defaultBranchRef = `refs/heads/${repository.default_branch}`;
	if (ref !== defaultBranchRef) {
		logger.debug('Ignoring push to non-default branch', {
			ref,
			defaultBranch: repository.default_branch,
		});
		return;
	}

	// Find all repositories that use this repository as a template
	const affectedConfigs = db.listAllRepositoryConfigs().filter((config) => {
		try {
			const configData = JSON.parse(config.config_json);
			const templates = configData.templates || [];

			// Check if this repository is in the templates list
			return templates.some((template: string) => {
				const templateUrl = template.toLowerCase().replace(/\.git$/, '');
				const repoUrl = repository.html_url.toLowerCase().replace(/\.git$/, '');
				return templateUrl === repoUrl || templateUrl.includes(repository.full_name.toLowerCase());
			});
		} catch (error) {
			logger.error('Error parsing config JSON', {
				configId: config.id,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	});

	logger.info('Found repositories affected by push', {
		templateRepo: repository.full_name,
		affectedCount: affectedConfigs.length,
	});

	// For each affected repository, create or update a debounced job
	for (const config of affectedConfigs) {
		// Skip if auto_update is disabled
		if (!config.auto_update) {
			logger.debug('Skipping repository with auto_update disabled', {
				repoFullName: config.repo_full_name,
			});
			continue;
		}

		// Check for existing pending job for this repository within the last 5 minutes
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
		const existingJob = db.getRecentJobForRepository(config.github_repo_id, fiveMinutesAgo);

		if (existingJob) {
			// Update the existing job's scheduled time to 5 minutes from now (debounce)
			const newScheduledAt = Date.now() + 5 * 60 * 1000;
			db.updateBackgroundJob(existingJob.id, {
				scheduled_at: newScheduledAt,
				status: 'pending',
			});

			logger.info('Updated existing job with debounce', {
				jobId: existingJob.id,
				repoFullName: config.repo_full_name,
				scheduledAt: new Date(newScheduledAt).toISOString(),
			});
		} else {
			// Create a new job scheduled for 5 minutes from now
			const scheduledAt = Date.now() + 5 * 60 * 1000;
			const job = db.createBackgroundJob({
				type: 'apply_templates',
				payload_json: JSON.stringify({
					github_repo_id: config.github_repo_id,
					repo_full_name: config.repo_full_name,
					installation_id: config.installation_id,
					trigger: 'push',
					template_repo: repository.full_name,
				}),
				status: 'pending',
				attempts: 0,
				max_attempts: 3,
				scheduled_at: scheduledAt,
				started_at: null,
				completed_at: null,
				error_message: null,
			});

			logger.info('Created new debounced job', {
				jobId: job.id,
				repoFullName: config.repo_full_name,
				scheduledAt: new Date(scheduledAt).toISOString(),
			});
		}
	}
}
