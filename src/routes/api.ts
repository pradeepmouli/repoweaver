import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { DatabaseManager, BackgroundJob, PullRequestRecord } from '../database';
import { requireAuth, AuthenticatedRequest, getAccessToken } from '../auth';
import { logger } from '../app-logger';
import { GitHubClient } from '../github-client';
import fs from 'fs';

export function createApiRouter(db: DatabaseManager): Router {
	const router = Router();

	const appId = process.env.GITHUB_APP_ID;
	const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
	const privateKeyDirect = process.env.GITHUB_PRIVATE_KEY;

	if (!appId || (!privateKeyPath && !privateKeyDirect)) {
		throw new Error('GITHUB_APP_ID and either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH are required');
	}

	// Read private key from file or use direct value
	const privateKey = privateKeyPath 
		? fs.readFileSync(privateKeyPath, 'utf-8')
		: privateKeyDirect!;

	/**
	 * GET /api/installations
	 * List user's GitHub App installations
	 */
	router.get('/installations', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.session) {
				return res.status(401).json({ error: 'Not authenticated' });
			}

			// Get user's access token and fetch installations
			const accessToken = getAccessToken(req.session);
			const octokit = new Octokit({ auth: accessToken });

			const response = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
				per_page: 100,
			});

			const installations = response.data.installations.map((install) => ({
				id: install.id,
				account: {
					login: install.account && 'login' in install.account ? install.account.login : install.account?.name,
					type: install.account && 'type' in install.account ? install.account.type : 'Organization',
					avatar_url: install.account?.avatar_url,
				},
				repository_selection: install.repository_selection,
				created_at: install.created_at,
				updated_at: install.updated_at,
			}));

			res.json({ installations });
		} catch (error) {
			logger.error('Failed to fetch installations', {
				error: error instanceof Error ? error.message : String(error),
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to fetch installations' });
		}
	});

	/**
	 * GET /api/repositories
	 * List accessible repositories for the authenticated user
	 */
	router.get('/repositories', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			if (!req.session) {
				return res.status(401).json({ error: 'Not authenticated' });
			}

			const accessToken = getAccessToken(req.session);
			const octokit = new Octokit({ auth: accessToken });

			// Get installations
			const installationsResponse = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
				per_page: 100,
			});

			const repositories = [];

			// For each installation, get accessible repositories
			for (const installation of installationsResponse.data.installations) {
				const reposResponse = await octokit.rest.apps.listInstallationReposForAuthenticatedUser({
					installation_id: installation.id,
					per_page: 100,
				});

				for (const repo of reposResponse.data.repositories) {
					// Check if we have a config for this repository
					const config = db.getRepositoryConfig(repo.id);

					repositories.push({
						id: repo.id,
						name: repo.name,
						full_name: repo.full_name,
						private: repo.private,
						owner: {
							login: repo.owner.login,
							avatar_url: repo.owner.avatar_url,
						},
						default_branch: repo.default_branch,
						installation_id: installation.id,
						has_config: !!config,
						auto_update: config?.auto_update ?? false,
					});
				}
			}

			res.json({ repositories });
		} catch (error) {
			logger.error('Failed to fetch repositories', {
				error: error instanceof Error ? error.message : String(error),
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to fetch repositories' });
		}
	});

	/**
	 * GET /api/repositories/:owner/:repo/config
	 * Get repository configuration
	 */
	router.get('/repositories/:owner/:repo/config', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { owner, repo } = req.params;
			const fullName = `${owner}/${repo}`;

			// Get repository info from GitHub to get repo ID
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });

			const repoResponse = await octokit.rest.repos.get({
				owner,
				repo,
			});

			const githubRepoId = repoResponse.data.id;

			// Get config from database
			const config = db.getRepositoryConfig(githubRepoId);

			if (!config) {
				// Return default config
				return res.json({
					repo_full_name: fullName,
					templates: [],
					merge_strategy: 'merge',
					exclude_patterns: [],
					auto_update: true,
				});
			}

			// Parse config_json
			const configData = JSON.parse(config.config_json);

			res.json({
				repo_full_name: config.repo_full_name,
				templates: configData.templates || [],
				merge_strategy: configData.mergeStrategy || 'merge',
				exclude_patterns: configData.excludePatterns || [],
				auto_update: config.auto_update,
			});
		} catch (error) {
			logger.error('Failed to fetch repository config', {
				error: error instanceof Error ? error.message : String(error),
				owner: req.params.owner,
				repo: req.params.repo,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to fetch repository configuration' });
		}
	});

	/**
	 * PUT /api/repositories/:owner/:repo/config
	 * Update repository configuration
	 */
	router.put('/repositories/:owner/:repo/config', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { owner, repo } = req.params;
			const { templates, merge_strategy, exclude_patterns, auto_update } = req.body;
			const fullName = `${owner}/${repo}`;

			// Validate input
			if (!Array.isArray(templates)) {
				return res.status(400).json({ error: 'Templates must be an array' });
			}

			// Get repository info from GitHub
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });

			const repoResponse = await octokit.rest.repos.get({
				owner,
				repo,
			});

			const githubRepoId = repoResponse.data.id;
			const defaultBranch = repoResponse.data.default_branch;

			// Get installation ID
			const installationsResponse = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
				per_page: 100,
			});

			let installationId: number | undefined;
			for (const installation of installationsResponse.data.installations) {
				const reposResponse = await octokit.rest.apps.listInstallationReposForAuthenticatedUser({
					installation_id: installation.id,
					per_page: 100,
				});

				if (reposResponse.data.repositories.some((r) => r.id === githubRepoId)) {
					installationId = installation.id;
					break;
				}
			}

			if (!installationId) {
				return res.status(404).json({ error: 'Repository not found in any installation' });
			}

			// Create config object
			const configData = {
				templates,
				mergeStrategy: merge_strategy || 'merge',
				excludePatterns: exclude_patterns || [],
			};

			// Check if config exists
			const existingConfig = db.getRepositoryConfig(githubRepoId);

			if (existingConfig) {
				// Update existing config
				db.updateRepositoryConfig(githubRepoId, {
					config_json: JSON.stringify(configData),
					auto_update: auto_update !== false,
				});
			} else {
				// Create new config
				db.createRepositoryConfig({
					installation_id: installationId,
					github_repo_id: githubRepoId,
					repo_full_name: fullName,
					config_json: JSON.stringify(configData),
					auto_update: auto_update !== false,
				});
			}

			logger.info('Repository config updated', {
				owner,
				repo,
				githubRepoId,
				userId: req.user?.id,
			});

			// Update .weaver.json file in the repository
			try {
				const githubClient = new GitHubClient(appId, privateKey, installationId);
				await githubClient.updateWeaverConfig(owner, repo, configData, defaultBranch);
				logger.info('.weaver.json file updated in repository', {
					owner,
					repo,
					branch: defaultBranch,
				});
			} catch (error) {
				// Log error but don't fail the request - database is source of truth
				logger.warn('Failed to update .weaver.json file in repository', {
					error: error instanceof Error ? error.message : String(error),
					owner,
					repo,
				});
			}

			res.json({ success: true });
		} catch (error) {
			logger.error('Failed to update repository config', {
				error: error instanceof Error ? error.message : String(error),
				owner: req.params.owner,
				repo: req.params.repo,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to update repository configuration' });
		}
	});

	/**
	 * POST /api/repositories/:owner/:repo/validate-template
	 * Validate template repository URL
	 */
	router.post('/repositories/:owner/:repo/validate-template', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { template_url } = req.body;

			if (!template_url) {
				return res.status(400).json({ error: 'template_url is required' });
			}

			// Parse GitHub URL
			const urlPattern = /github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/;
			const match = template_url.match(urlPattern);

			if (!match) {
				return res.status(400).json({
					valid: false,
					error: 'Invalid GitHub repository URL format',
				});
			}

			const templateOwner = match[1];
			const templateRepo = match[2];

			// Try to access the repository
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });

			try {
				await octokit.rest.repos.get({
					owner: templateOwner,
					repo: templateRepo,
				});

				res.json({
					valid: true,
					owner: templateOwner,
					repo: templateRepo,
				});
			} catch (error: any) {
				if (error.status === 404) {
					res.json({
						valid: false,
						error: 'Repository not found or not accessible',
					});
				} else {
					throw error;
				}
			}
		} catch (error) {
			logger.error('Failed to validate template', {
				error: error instanceof Error ? error.message : String(error),
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to validate template repository' });
		}
	});

	/**
	 * POST /api/repositories/:owner/:repo/apply-templates
	 * Manually trigger template application (bypass debounce)
	 */
	router.post('/repositories/:owner/:repo/apply-templates', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { owner, repo } = req.params;
			const { preview = false } = req.body;

			logger.info('Manual template application requested', { owner, repo, preview, userId: req.user?.id });

			// Get repository info from GitHub
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });
			const repoResponse = await octokit.rest.repos.get({ owner, repo });
			const githubRepoId = repoResponse.data.id;

			// Get repository configuration
			const config = db.getRepositoryConfig(githubRepoId);
			if (!config) {
				return res.status(404).json({ error: 'Repository configuration not found' });
			}

			// Get installation ID
			const installation = db.getInstallationByGithubId(config.installation_id);
			if (!installation) {
				return res.status(404).json({ error: 'Installation not found' });
			}

			// Create background job with immediate scheduling
			const now = Date.now();
			const job = db.createBackgroundJob({
				type: preview ? 'preview_templates' : 'apply_templates',
				payload_json: JSON.stringify({
					repository: {
						owner,
						name: repo,
						id: config.github_repo_id,
					},
					installation_id: config.installation_id,
				}),
				scheduled_at: now,
				status: 'pending',
				attempts: 0,
				max_attempts: 3,
				started_at: null,
				completed_at: null,
				error_message: null,
			});

			logger.info('Manual template job created', {
				jobId: job.id,
				owner,
				repo,
				preview,
				userId: req.user?.id,
			});

			res.json({
				job_id: job.id,
				status: job.status,
				preview,
			});
		} catch (error) {
			logger.error('Failed to trigger template application', {
				error: error instanceof Error ? error.message : String(error),
				owner: req.params.owner,
				repo: req.params.repo,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to trigger template application' });
		}
	});

	/**
	 * GET /api/jobs/:jobId
	 * Get job status and progress
	 */
	router.get('/jobs/:jobId', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const jobId = parseInt(req.params.jobId, 10);
			if (isNaN(jobId)) {
				return res.status(400).json({ error: 'Invalid job ID' });
			}

			const job = db.getBackgroundJob(jobId);
			if (!job) {
				return res.status(404).json({ error: 'Job not found' });
			}

			// Parse payload to get repository info
			let payload: any = {};
			try {
				payload = JSON.parse(job.payload_json);
			} catch (e) {
				logger.error('Failed to parse job payload', { jobId, error: e });
			}

			res.json({
				id: job.id,
				type: job.type,
				status: job.status,
				repository: payload.repository,
				created_at: job.created_at,
				started_at: job.started_at,
				completed_at: job.completed_at,
				scheduled_at: job.scheduled_at,
				attempts: job.attempts,
				max_attempts: job.max_attempts,
				error_message: job.error_message,
			});
		} catch (error) {
			logger.error('Failed to get job status', {
				error: error instanceof Error ? error.message : String(error),
				jobId: req.params.jobId,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to get job status' });
		}
	});

	/**
	 * GET /api/repositories/:owner/:repo/jobs
	 * List recent jobs for repository
	 */
	router.get('/repositories/:owner/:repo/jobs', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { owner, repo } = req.params;
			const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);

			// Get repository info from GitHub
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });
			const repoResponse = await octokit.rest.repos.get({ owner, repo });
			const githubRepoId = repoResponse.data.id;

			// Get repository config
			const config = db.getRepositoryConfig(githubRepoId);
			if (!config) {
				return res.status(404).json({ error: 'Repository configuration not found' });
			}

			// Get all pending/recent jobs and filter by repository
			const allJobs = db.getPendingJobs(100);
			const repoJobs = allJobs
				.filter((job: BackgroundJob) => {
					try {
						const payload = JSON.parse(job.payload_json);
						return payload.repository?.id === config.github_repo_id;
					} catch (e) {
						return false;
					}
				})
				.slice(0, limit)
				.map((job: BackgroundJob) => {
					let payload: any = {};
					try {
						payload = JSON.parse(job.payload_json);
					} catch (e) {
						// Ignore parse errors
					}

					return {
						id: job.id,
						type: job.type,
						status: job.status,
						created_at: job.created_at,
						started_at: job.started_at,
						completed_at: job.completed_at,
						scheduled_at: job.scheduled_at,
						attempts: job.attempts,
						error_message: job.error_message,
					};
				});

			res.json({ jobs: repoJobs });
		} catch (error) {
			logger.error('Failed to list repository jobs', {
				error: error instanceof Error ? error.message : String(error),
				owner: req.params.owner,
				repo: req.params.repo,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to list repository jobs' });
		}
	});

	/**
	 * GET /api/repositories/:owner/:repo/pull-requests
	 * List recent PRs created by app
	 */
	router.get('/repositories/:owner/:repo/pull-requests', requireAuth(db), async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { owner, repo } = req.params;
			const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);

			// Get repository info from GitHub
			const accessToken = getAccessToken(req.session!);
			const octokit = new Octokit({ auth: accessToken });
			const repoResponse = await octokit.rest.repos.get({ owner, repo });
			const githubRepoId = repoResponse.data.id;

			// Get repository config
			const config = db.getRepositoryConfig(githubRepoId);
			if (!config) {
				return res.status(404).json({ error: 'Repository configuration not found' });
			}

			// Get PR records from database
			const prs = db.listPullRequestsByRepo(config.github_repo_id, limit);

			res.json({
				pull_requests: prs.map((pr: PullRequestRecord) => ({
					id: pr.id,
					pr_number: pr.pr_number,
					pr_url: pr.pr_url,
					templates_applied: pr.templates_applied,
					job_id: pr.job_id,
					created_at: pr.created_at,
				})),
			});
		} catch (error) {
			logger.error('Failed to list pull requests', {
				error: error instanceof Error ? error.message : String(error),
				owner: req.params.owner,
				repo: req.params.repo,
				userId: req.user?.id,
			});
			res.status(500).json({ error: 'Failed to list pull requests' });
		}
	});

	return router;
}
