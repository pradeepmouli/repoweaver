import { GitHubClient, GitHubFile } from './github-client';
import { MergeStrategyRegistry } from './merge-strategy-registry';
import { FilePatternMergeStrategy, MergeStrategyConfig, TemplateProcessingResult, TemplateRepository } from './types';

export class GitHubTemplateManager {
	private client: GitHubClient;
	private mergeRegistry: MergeStrategyRegistry;

	constructor (client: GitHubClient) {
		this.client = client;
		this.mergeRegistry = new MergeStrategyRegistry();
	}

	async processTemplate(
		template: TemplateRepository,
		targetOwner: string,
		targetRepo: string,
		excludePatterns: string[] = [],
		mergeStrategy: 'overwrite' | 'merge' | 'skip' | MergeStrategyConfig = 'merge',
		mergeStrategies: FilePatternMergeStrategy[] = [],
		plugins: string[] = []
	): Promise<TemplateProcessingResult> {
		const result: TemplateProcessingResult = {
			success: true,
			template,
			filesProcessed: 0,
			errors: [],
		};

		try {
			// Load plugins
			for (const plugin of plugins) {
				await this.mergeRegistry.loadPlugin(plugin);
			}

			// Get template files from GitHub
			const templateFiles = await this.client.getTemplateFiles(template);

			// Filter out excluded files
			const filteredFiles = this.filterFiles(templateFiles, excludePatterns);

			// Process files based on merge strategy
			await this.processFiles(filteredFiles, targetOwner, targetRepo, mergeStrategy, mergeStrategies, result);
		} catch (error) {
			result.success = false;
			result.errors.push(`Template processing failed: ${error}`);
		}

		return result;
	}

	private filterFiles(files: GitHubFile[], excludePatterns: string[]): GitHubFile[] {
		return files.filter((file) => {
			// Skip directories in processing
			if (file.type === 'dir') {
				return false;
			}

			// Apply exclude patterns
			return !this.shouldExclude(file.path, excludePatterns);
		});
	}

	private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
		return excludePatterns.some((pattern) => {
			const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
			return regex.test(filePath);
		});
	}

	private async processFiles(files: GitHubFile[], targetOwner: string, targetRepo: string, mergeStrategy: 'overwrite' | 'merge' | 'skip' | MergeStrategyConfig, mergeStrategies: FilePatternMergeStrategy[], result: TemplateProcessingResult): Promise<void> {
		const branch = `boots-strapper-update-${Date.now()}`;

		try {
			// Create a new branch for the template updates
			await this.client.createBranch(targetOwner, targetRepo, branch);

			for (const file of files) {
				try {
					// Determine merge strategy for this file
					const defaultMergeStrategy = typeof mergeStrategy === 'string' ? { type: mergeStrategy as 'overwrite' | 'merge' | 'skip' } : mergeStrategy;

					const fileStrategy = await this.mergeRegistry.resolveStrategyForFile(file.path, mergeStrategies, defaultMergeStrategy);

					const shouldProcess = await this.shouldProcessFile(targetOwner, targetRepo, file.path, fileStrategy.name);

					if (shouldProcess) {
						let content = file.content;

						// Get existing content if file exists
						let existingContent = '';
						try {
							const existingFiles = await this.client.getRepositoryContents(targetOwner, targetRepo, file.path);
							const existingFile = existingFiles.find((f) => f.path === file.path && f.type === 'file');
							existingContent = existingFile?.content || '';
						} catch (error) {
							// File doesn't exist, which is fine
						}

						// Apply merge strategy
						if (existingContent) {
							const mergeResult = await fileStrategy.merge({
								filePath: file.path,
								templateName: result.template.name,
								existingContent,
								newContent: file.content,
							});

							if (mergeResult.success) {
								content = mergeResult.content;

								// Track warnings and conflicts
								if (mergeResult.warnings) {
									result.errors.push(...mergeResult.warnings.map((w) => `Warning: ${w}`));
								}
								if (mergeResult.conflicts) {
									result.errors.push(...mergeResult.conflicts.map((c) => `Conflict: ${c}`));
								}
							} else {
								result.errors.push(`Merge failed for ${file.path}, using new content`);
							}
						}

						await this.client.createOrUpdateFile(targetOwner, targetRepo, file.path, content, `Update ${file.path} from template ${result.template.name} using ${fileStrategy.name} strategy`, branch);

						result.filesProcessed++;
					}
				} catch (error) {
					result.errors.push(`Failed to process file ${file.path}: ${error}`);
				}
			}

			// Create a pull request with the changes
			if (result.filesProcessed > 0) {
				const primarySourceSummary = this.buildPrimarySourceSummary(files, mergeStrategies, result.template.name);
				const prNumber = await this.client.createPullRequest(
					targetOwner,
					targetRepo,
					`Update repository from template: ${result.template.name}`,
					this.generatePullRequestBody(result.template, result, primarySourceSummary),
					branch,
					'main'
				);

				result.pullRequestNumber = prNumber;
			}
		} catch (error) {
			result.success = false;
			result.errors.push(`Branch creation or PR failed: ${error}`);
		}
	}

	private async shouldProcessFile(owner: string, repo: string, filePath: string, strategyName: string): Promise<boolean> {
		if (strategyName === 'overwrite') {
			return true;
		}

		try {
			// Check if file exists
			await this.client.getRepositoryContents(owner, repo, filePath);

			// File exists
			if (strategyName === 'skip') {
				return false;
			}

			// All other strategies process existing files
			return true;
		} catch (error) {
			// File doesn't exist, so we can create it
			return true;
		}
	}

	async cleanup(): Promise<void> {
		await this.mergeRegistry.cleanup();
	}

	private generatePullRequestBody(template: TemplateRepository, result: TemplateProcessingResult, primarySourceSummary?: string): string {
		return `
## Template Update

This pull request updates the repository with changes from the template: **${template.name}**

**Template Details:**
- Repository: ${template.url}
- Branch: ${template.branch || 'main'}
${template.subDirectory ? `- Subdirectory: ${template.subDirectory}` : ''}

**Changes:**
- ${result.filesProcessed} files processed
${result.errors.length > 0 ? `- ${result.errors.length} errors encountered` : ''}

**Files Modified:**
<!-- This will be populated with the actual file list -->

${primarySourceSummary ? `
**Primary Source Rules (for this template):**

${primarySourceSummary}
` : ''}

---

*This PR was automatically generated by [RepoWeaver](https://github.com/apps/repoweaver)*
    `.trim();
	}

	private buildPrimarySourceSummary(files: GitHubFile[], mergeStrategies: FilePatternMergeStrategy[], templateName: string): string {
		const primaryRules = mergeStrategies.filter((r) => r.primarySource === templateName);
		const otherRules = mergeStrategies.filter((r) => r.primarySource && r.primarySource !== templateName);

		const matchCountForRule = (rule: FilePatternMergeStrategy): number => {
			return files.reduce((count, f) => (this.ruleMatchesFile(f.path, rule) ? count + 1 : count), 0);
		};

		const lines: string[] = [];
		if (primaryRules.length > 0) {
			lines.push('- This template is the primary source for:');
			for (const rule of primaryRules) {
				const cnt = matchCountForRule(rule);
				if (cnt > 0) {
					lines.push(`  - ${this.describeRule(rule)} → ${cnt} file(s)`);
				}
			}
		}

		const otherMatched: string[] = [];
		for (const rule of otherRules) {
			const cnt = matchCountForRule(rule);
			if (cnt > 0) {
				otherMatched.push(`  - ${this.describeRule(rule)} (primary: ${rule.primarySource}) → ${cnt} file(s)`);
			}
		}
		if (otherMatched.length > 0) {
			lines.push('- Files matched rules where another template is primary:');
			lines.push(...otherMatched);
		}

		return lines.join('\n');
	}

	private describeRule(rule: FilePatternMergeStrategy): string {
		if (rule.category) return `category: ${rule.category}`;
		if (rule.patterns && rule.patterns.length > 0) return `patterns: ${rule.patterns.join(', ')}`;
		return 'unscoped rule';
	}

	private ruleMatchesFile(filePath: string, rule: FilePatternMergeStrategy): boolean {
		if (rule.patterns && this.matchesPatterns(filePath, rule.patterns)) return true;
		if (rule.category) {
			const catPatterns = this.getCategoryPatterns(rule.category);
			return this.matchesPatterns(filePath, catPatterns);
		}
		return false;
	}

	// Simple helpers mirroring MergeStrategyRegistry behavior
	private patternRegexCache: Map<string, RegExp> = new Map();
	private matchesPatterns(filePath: string, patterns?: string[]): boolean {
		if (!patterns || patterns.length === 0) return false;
		return patterns.some((pattern) => {
			let regex = this.patternRegexCache.get(pattern);
			if (!regex) {
				regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
				this.patternRegexCache.set(pattern, regex);
			}
			return regex.test(filePath);
		});
	}

	private getCategoryPatterns(category: NonNullable<FilePatternMergeStrategy['category']>): string[] {
		switch (category) {
			case 'typescript':
				return ['tsconfig.json', 'tsconfig.*.json'];
			case 'ci-workflows':
				return ['.github/workflows/**'];
			case 'documentation':
				return ['README.md', 'docs/**', '*.md'];
			case 'agent-instructions':
				return ['AGENTS.md'];
			case 'git':
				return ['.gitignore', '.gitattributes', '.gitmodules'];
			case 'code-quality':
				return ['.eslintrc*', 'eslint.config.*', '.prettierrc*', '.editorconfig'];
			case 'package-management':
				return ['package.json', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', '.npmrc'];
			case 'vscode-settings':
				return ['.vscode/**'];
			case 'testing':
				return ['jest.config.*', 'vitest.config.*', '*.test.*', '*.spec.*', 'tests/**', '.github/workflows/test*'];
			case 'building':
				return ['webpack.*', 'rollup.config.*', 'vite.config.*', 'tsup.config.*', 'esbuild.*', 'babel.config.*', '.github/workflows/build*', 'dist/**', 'build/**'];
			default:
				return [];
		}
	}

	/**
	 * Preview mode - analyze template changes without actually applying them
	 * Returns a summary of file changes that would be made
	 */
	async previewTemplate(
		template: TemplateRepository,
		targetOwner: string,
		targetRepo: string,
		excludePatterns: string[] = [],
		mergeStrategy: 'overwrite' | 'merge' | 'skip' | MergeStrategyConfig = 'merge',
		mergeStrategies: FilePatternMergeStrategy[] = [],
		plugins: string[] = []
	): Promise<{
		success: boolean;
		filesAdded: string[];
		filesModified: string[];
		filesSkipped: string[];
		filesWithConflicts: string[];
		errors: string[];
		changes: Array<{ path: string; action: 'add' | 'modify' | 'skip'; size: number; hasConflicts: boolean }>;
	}> {
		const filesAdded: string[] = [];
		const filesModified: string[] = [];
		const filesSkipped: string[] = [];
		const filesWithConflicts: string[] = [];
		const errors: string[] = [];
		const changes: Array<{ path: string; action: 'add' | 'modify' | 'skip'; size: number; hasConflicts: boolean }> = [];

		try {
			// Load plugins
			for (const plugin of plugins) {
				await this.mergeRegistry.loadPlugin(plugin);
			}

			// Get template files from GitHub
			const templateFiles = await this.client.getTemplateFiles(template);

			// Filter out excluded files
			const filteredFiles = this.filterFiles(templateFiles, excludePatterns);

			for (const file of filteredFiles) {
				try {
					// Determine merge strategy for this file
					const defaultMergeStrategy = typeof mergeStrategy === 'string' ? { type: mergeStrategy as 'overwrite' | 'merge' | 'skip' } : mergeStrategy;
					const fileStrategy = await this.mergeRegistry.resolveStrategyForFile(file.path, mergeStrategies, defaultMergeStrategy);

					// Check if file exists in target
					let existingContent = '';
					let fileExists = false;
					try {
						const existingFiles = await this.client.getRepositoryContents(targetOwner, targetRepo, file.path);
						const existingFile = existingFiles.find((f) => f.path === file.path && f.type === 'file');
						if (existingFile) {
							existingContent = existingFile.content || '';
							fileExists = true;
						}
					} catch (error) {
						// File doesn't exist
					}

					let action: 'add' | 'modify' | 'skip' = 'add';
					let hasConflicts = false;

					if (fileExists) {
						if (fileStrategy.name === 'skip') {
							action = 'skip';
							filesSkipped.push(file.path);
						} else {
							action = 'modify';
							// Try merge to detect conflicts
							if (existingContent) {
								const mergeResult = await fileStrategy.merge({
									filePath: file.path,
									templateName: template.name,
									existingContent,
									newContent: file.content,
								});

								if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
									hasConflicts = true;
									filesWithConflicts.push(file.path);
								}
							}
							filesModified.push(file.path);
						}
					} else {
						filesAdded.push(file.path);
					}

					changes.push({
						path: file.path,
						action,
						size: file.content.length,
						hasConflicts,
					});
				} catch (error) {
					errors.push(`Failed to preview file ${file.path}: ${error}`);
				}
			}

			return {
				success: errors.length === 0,
				filesAdded,
				filesModified,
				filesSkipped,
				filesWithConflicts,
				errors,
				changes,
			};
		} catch (error) {
			errors.push(`Preview failed: ${error}`);
			return {
				success: false,
				filesAdded,
				filesModified,
				filesSkipped,
				filesWithConflicts,
				errors,
				changes,
			};
		}
	}
}
