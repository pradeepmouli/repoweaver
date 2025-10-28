import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { TemplateRepository } from './types';

// Create Octokit with retry and throttling plugins
const MyOctokit = Octokit.plugin(retry, throttling);

export interface GitHubFile {
	name: string;
	path: string;
	content: string;
	type: 'file' | 'dir';
}

export interface GitHubRepository {
	id?: number;
	owner: string;
	name: string;
	fullName: string;
	defaultBranch: string;
	isTemplate: boolean;
}

export class GitHubClient {
	private octokit: InstanceType<typeof MyOctokit>;
	private installationId: number;

	constructor(appId: string, privateKey: string, installationId: number) {
		this.installationId = installationId;
		this.octokit = new MyOctokit({
			authStrategy: createAppAuth,
			auth: {
				appId,
				privateKey,
				installationId,
			},
			throttle: {
				onRateLimit: (retryAfter, options, octokit, retryCount) => {
					octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
					if (retryCount < 3) {
						octokit.log.info(`Retrying after ${retryAfter} seconds!`);
						return true;
					}
					return false;
				},
				onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
					octokit.log.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`);
					if (retryCount < 2) {
						octokit.log.info(`Retrying after ${retryAfter} seconds!`);
						return true;
					}
					return false;
				},
			},
			retry: {
				doNotRetry: ['429'], // Let throttling plugin handle rate limits
			},
		});
	}

	async createRepository(name: string, description?: string, isPrivate = false): Promise<GitHubRepository> {
		const response = await this.octokit.rest.repos.createForAuthenticatedUser({
			name,
			description,
			private: isPrivate,
			auto_init: true,
		});

		return {
			id: response.data.id,
			owner: response.data.owner.login,
			name: response.data.name,
			fullName: response.data.full_name,
			defaultBranch: response.data.default_branch,
			isTemplate: response.data.is_template || false,
		};
	}

	async getRepository(owner: string, name: string): Promise<GitHubRepository> {
		const response = await this.octokit.rest.repos.get({
			owner,
			repo: name,
		});

		return {
			id: response.data.id,
			owner: response.data.owner.login,
			name: response.data.name,
			fullName: response.data.full_name,
			defaultBranch: response.data.default_branch,
			isTemplate: response.data.is_template || false,
		};
	}

	async getRepositoryContents(owner: string, repo: string, path = '', ref?: string): Promise<GitHubFile[]> {
		const response = await this.octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref,
		});

		const items = Array.isArray(response.data) ? response.data : [response.data];
		const files: GitHubFile[] = [];

		for (const item of items) {
			if (item.type === 'file' && item.content) {
				files.push({
					name: item.name,
					path: item.path,
					content: Buffer.from(item.content, 'base64').toString('utf-8'),
					type: 'file',
				});
			} else if (item.type === 'dir') {
				files.push({
					name: item.name,
					path: item.path,
					content: '',
					type: 'dir',
				});

				// Recursively get directory contents
				const dirContents = await this.getRepositoryContents(owner, repo, item.path, ref);
				files.push(...dirContents);
			}
		}

		return files;
	}

	async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch?: string): Promise<void> {
		// Check if file exists
		let sha: string | undefined;
		try {
			const existing = await this.octokit.rest.repos.getContent({
				owner,
				repo,
				path,
				ref: branch,
			});

			if (!Array.isArray(existing.data) && existing.data.type === 'file') {
				sha = existing.data.sha;
			}
		} catch (error) {
			// File doesn't exist, which is fine
		}

		await this.octokit.rest.repos.createOrUpdateFileContents({
			owner,
			repo,
			path,
			message,
			content: Buffer.from(content, 'utf-8').toString('base64'),
			sha,
			branch,
		});
	}

	async createBranch(owner: string, repo: string, branchName: string, fromBranch?: string): Promise<void> {
		// Get the SHA of the base branch
		const baseRef = fromBranch || 'main';
		const baseBranchResponse = await this.octokit.rest.git.getRef({
			owner,
			repo,
			ref: `heads/${baseRef}`,
		});

		// Create new branch
		await this.octokit.rest.git.createRef({
			owner,
			repo,
			ref: `refs/heads/${branchName}`,
			sha: baseBranchResponse.data.object.sha,
		});
	}

	async createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string): Promise<number> {
		const response = await this.octokit.rest.pulls.create({
			owner,
			repo,
			title,
			body,
			head,
			base,
		});

		return response.data.number;
	}

	async parseRepositoryUrl(url: string): Promise<{ owner: string; repo: string; branch?: string }> {
		// Parse GitHub repository URL
		const match = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/tree\/([^\/]+))?/);
		if (!match) {
			throw new Error(`Invalid GitHub repository URL: ${url}`);
		}

		return {
			owner: match[1],
			repo: match[2],
			branch: match[3],
		};
	}

	async getTemplateFiles(template: TemplateRepository): Promise<GitHubFile[]> {
		const { owner, repo, branch } = await this.parseRepositoryUrl(template.url);
		const ref = template.branch || branch || 'main';

		let files = await this.getRepositoryContents(owner, repo, '', ref);

		// Filter out .git directory
		files = files.filter((file) => !file.path.startsWith('.git'));

		// If subDirectory is specified, filter to only include files from that directory
		if (template.subDirectory) {
			files = files.filter((file) => file.path.startsWith(template.subDirectory!));
			// Remove the subdirectory prefix from paths
			files = files.map((file) => ({
				...file,
				path: file.path.replace(new RegExp(`^${template.subDirectory}/`), ''),
			}));
		}

		return files;
	}

	/**
	 * Update .weaver.json configuration file in a repository
	 */
	async updateWeaverConfig(owner: string, repo: string, config: any, branch?: string): Promise<void> {
		const configContent = JSON.stringify(config, null, 2);
		await this.createOrUpdateFile(owner, repo, '.weaver.json', configContent, 'Update RepoWeaver configuration', branch);
	}

	/**
	 * Check and log GitHub API rate limit status
	 */
	async checkRateLimit(): Promise<void> {
		try {
			const { data } = await this.octokit.rest.rateLimit.get();
			
			const core = data.resources.core;
			const remaining = core.remaining;
			const limit = core.limit;
			const resetDate = new Date(core.reset * 1000);
			const percentUsed = ((limit - remaining) / limit) * 100;

			// Log if approaching limit (>80% used)
			if (percentUsed > 80) {
				this.octokit.log.warn('GitHub API rate limit warning', {
					remaining,
					limit,
					percentUsed: percentUsed.toFixed(1),
					resetAt: resetDate.toISOString(),
				});
			} else {
				this.octokit.log.info('GitHub API rate limit status', {
					remaining,
					limit,
					percentUsed: percentUsed.toFixed(1),
					resetAt: resetDate.toISOString(),
				});
			}
		} catch (error) {
			this.octokit.log.error('Failed to check rate limit', { error });
		}
	}

	/*async addRepositoryToInstallation(repositoryName: string): Promise<void> {
		await this.octokit.rest.apps.addRepoToInstallationForAuthenticatedUser({
			installation_id: this.installationId,
			repository_id: r.data.id,
		});
	}

	async removeRepositoryFromInstallation(repositoryName: string): Promise<void> {
		const { owner, repo } = await this.getRepository(this.parseRepositoryUrl(url).owner, repositoryName);
		await this.octokit.rest.apps.removeRepoFromInstallation({
			installation_id: this.installationId,
			repository_names: [repositoryName],
		});
	}*/
}
