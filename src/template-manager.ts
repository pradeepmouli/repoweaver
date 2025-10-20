import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { FilePatternMergeStrategy, TemplateProcessingResult, TemplateRepository, WeaverConfig } from './types';
/**
 * Pure function to resolve which template's file to use based on mergeStrategies and primarySource.
 * Used for testing and core merge logic.
 * @param filePath - The file being processed (e.g. 'tsconfig.json')
 * @param config - The loaded WeaverConfig
 * @param filesFromTemplates - Map of template name to { [filePath]: content }
 * @returns { content, source, warning? }
 */
export function applyMergeStrategies(
	filePath: string,
	config: WeaverConfig,
	filesFromTemplates: Record<string, Record<string, string>>
): { content: string | undefined; source: string | undefined; warning?: string; } {
	if (!config.mergeStrategies) return { content: undefined, source: undefined };
	// Find the first matching merge strategy for this file
	const match = config.mergeStrategies.find((rule: FilePatternMergeStrategy) => {
		if (rule.patterns && rule.patterns.some((pattern) => matchPattern(filePath, pattern))) {
			return true;
		}
		// TODO: Add category support in later tasks
		return false;
	});
	if (!match) return { content: undefined, source: undefined };
	// If primarySource is set, prefer that template
	if (match.primarySource) {
		const primaryFiles = filesFromTemplates[match.primarySource];
		if (primaryFiles && primaryFiles[filePath] !== undefined) {
			return { content: primaryFiles[filePath], source: match.primarySource };
		}
		// Fallback: use any available template, but warn
		for (const [template, files] of Object.entries(filesFromTemplates)) {
			if (files[filePath] !== undefined) {
				return {
					content: files[filePath],
					source: template,
					warning: `Warning: primary source '${match.primarySource}' does not provide '${filePath}', using '${template}' instead.`
				};
			}
		}
		return { content: undefined, source: undefined, warning: `Warning: primary source '${match.primarySource}' does not provide '${filePath}', and no other template provides it.` };
	}
	// No primarySource: use first available template in config.templates order
	for (const template of config.templates) {
		const name = typeof template === 'string' ? template : template.name;
		const files = filesFromTemplates[name];
		if (files && files[filePath] !== undefined) {
			return { content: files[filePath], source: name };
		}
	}
	return { content: undefined, source: undefined };
}

function matchPattern(filePath: string, pattern: string): boolean {
	// Simple glob: '*' matches any chars except '/', '**' matches any chars
	const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
	return regex.test(filePath);
}

export class TemplateManager {
	private git: SimpleGit;
	private tempDir: string;

	constructor () {
		this.git = simpleGit();
		this.tempDir = path.join(process.cwd(), '.repoweaver-temp');
	}

	async fetchTemplate(template: TemplateRepository): Promise<string> {
		const templateDir = path.join(this.tempDir, this.sanitizeName(template.name));

		await this.ensureDirectoryExists(this.tempDir);
		await this.cleanDirectory(templateDir);

		try {
			await this.git.clone(template.url, templateDir, {
				'--branch': template.branch || 'main',
				'--depth': '1',
			});

			if (template.subDirectory) {
				const subPath = path.join(templateDir, template.subDirectory);
				const exists = await this.pathExists(subPath);
				if (!exists) {
					throw new Error(`Subdirectory '${template.subDirectory}' not found in template`);
				}
				return subPath;
			}

			return templateDir;
		} catch (error) {
			throw new Error(`Failed to fetch template ${template.name}: ${error}`);
		}
	}

	async copyTemplateFiles(sourcePath: string, targetPath: string, excludePatterns: string[] = []): Promise<TemplateProcessingResult> {
		const result: TemplateProcessingResult = {
			success: true,
			template: { url: '', name: path.basename(sourcePath) },
			filesProcessed: 0,
			errors: [],
		};

		try {
			await this.ensureDirectoryExists(targetPath);
			result.filesProcessed = await this.copyRecursive(sourcePath, targetPath, excludePatterns);
		} catch (error) {
			result.success = false;
			result.errors.push(`Copy failed: ${error}`);
		}

		return result;
	}

	async processTemplate(template: TemplateRepository, targetPath: string, excludePatterns: string[] = []): Promise<TemplateProcessingResult> {
		const result: TemplateProcessingResult = {
			success: true,
			template,
			filesProcessed: 0,
			errors: [],
		};

		try {
			const templatePath = await this.fetchTemplate(template);
			const copyResult = await this.copyTemplateFiles(templatePath, targetPath, ['.git/**', '.git', ...excludePatterns]);

			result.filesProcessed = copyResult.filesProcessed;
			result.errors = copyResult.errors;
			result.success = copyResult.success;
		} catch (error) {
			result.success = false;
			result.errors.push(`Template processing failed: ${error}`);
		}

		return result;
	}

	async cleanup(): Promise<void> {
		try {
			await this.cleanDirectory(this.tempDir);
		} catch (error) {
			console.warn(`Failed to cleanup temp directory: ${error}`);
		}
	}

	private async copyRecursive(source: string, target: string, excludePatterns: string[]): Promise<number> {
		let filesProcessed = 0;
		const items = await fs.readdir(source);

		for (const item of items) {
			const sourcePath = path.join(source, item);
			const targetPath = path.join(target, item);

			if (this.shouldExclude(sourcePath, excludePatterns)) {
				continue;
			}

			const stat = await fs.stat(sourcePath);

			if (stat.isDirectory()) {
				await this.ensureDirectoryExists(targetPath);
				filesProcessed += await this.copyRecursive(sourcePath, targetPath, excludePatterns);
			} else {
				await fs.copyFile(sourcePath, targetPath);
				filesProcessed++;
			}
		}

		return filesProcessed;
	}

	private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
		return excludePatterns.some((pattern) => {
			const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
			return regex.test(filePath);
		});
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		try {
			await fs.mkdir(dirPath, { recursive: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
				throw error;
			}
		}
	}

	private async cleanDirectory(dirPath: string): Promise<void> {
		try {
			await fs.rm(dirPath, { recursive: true, force: true });
		} catch (error) {
			// Directory might not exist, which is fine
		}
	}

	private async pathExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	private sanitizeName(name: string): string {
		return name.replace(/[^a-zA-Z0-9-_]/g, '_');
	}
}
