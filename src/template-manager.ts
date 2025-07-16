import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { TemplateProcessingResult, TemplateRepository } from './types';

export class TemplateManager {
	private git: SimpleGit;
	private tempDir: string;

	constructor() {
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
