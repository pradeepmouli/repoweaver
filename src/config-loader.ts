import * as fs from 'fs/promises';
import * as path from 'path';
import { FilePatternMergeStrategy, MergeStrategyConfig, TemplateRepository, WeaverConfig, WeaverIgnoreConfig } from './types';

export class ConfigLoader {
	private basePath: string;

	constructor(basePath: string = process.cwd()) {
		this.basePath = basePath;
	}

	async loadConfiguration(): Promise<WeaverConfig> {
		const config = await this.loadWeaverConfig();
		const ignoreConfig = await this.loadWeaverIgnore();

		// Merge ignore patterns into main config
		if (ignoreConfig.patterns.length > 0) {
			config.excludePatterns = [...(config.excludePatterns || []), ...ignoreConfig.patterns];
		}

		if (ignoreConfig.includePatterns && ignoreConfig.includePatterns.length > 0) {
			config.includePatterns = [...(config.includePatterns || []), ...ignoreConfig.includePatterns];
		}

		return config;
	}

	private async loadWeaverConfig(): Promise<WeaverConfig> {
		// Try to load configuration files in order of preference
		const configFiles = ['weaver.json', '.weaver.json', 'weaver.config.ts', 'weaver.js', '.weaver.js'];

		for (const configFile of configFiles) {
			const configPath = path.join(this.basePath, configFile);

			try {
				const exists = await this.fileExists(configPath);
				if (exists) {
					return await this.loadConfigFile(configPath);
				}
			} catch (error) {
				console.warn(`Failed to load config file ${configFile}:`, error);
			}
		}

		// Return default configuration if no config file found
		return {
			templates: [],
			mergeStrategy: 'merge',
			excludePatterns: [],
			autoUpdate: true,
		};
	}

	private async loadConfigFile(configPath: string): Promise<WeaverConfig> {
		const ext = path.extname(configPath);
		const fileName = path.basename(configPath);

		if (ext === '.json') {
			return await this.loadJsonConfig(configPath);
		} else if (ext === '.js') {
			return await this.loadJsConfig(configPath);
		} else if (ext === '.ts' || fileName === 'weaver.config.ts') {
			return await this.loadTsConfig(configPath);
		} else {
			throw new Error(`Unsupported configuration file type: ${ext}`);
		}
	}

	private async loadJsonConfig(configPath: string): Promise<WeaverConfig> {
		const content = await fs.readFile(configPath, 'utf-8');
		const config = JSON.parse(content);
		return this.normalizeConfig(config);
	}

	private async loadJsConfig(configPath: string): Promise<WeaverConfig> {
		// Clear require cache to allow reloading
		delete require.cache[require.resolve(configPath)];

		const configModule = require(configPath);
		const config = typeof configModule === 'function' ? configModule() : configModule;

		return this.normalizeConfig(config);
	}

	private async loadTsConfig(configPath: string): Promise<WeaverConfig> {
		try {
			// Try to use ts-node if available
			require('ts-node/register');
		} catch (error) {
			// Fallback: check if TypeScript compilation is available
			try {
				const ts = require('typescript');
				const tsContent = await fs.readFile(configPath, 'utf-8');
				
				// Compile TypeScript to JavaScript
				const result = ts.transpile(tsContent, {
					module: ts.ModuleKind.CommonJS,
					target: ts.ScriptTarget.ES2018,
					esModuleInterop: true,
					allowSyntheticDefaultImports: true,
				});

				// Write temporary JS file
				const tempJsPath = configPath.replace(/\.ts$/, '.temp.js');
				await fs.writeFile(tempJsPath, result);

				try {
					// Clear require cache
					delete require.cache[require.resolve(tempJsPath)];
					
					const configModule = require(tempJsPath);
					const config = typeof configModule === 'function' ? configModule() : 
						configModule.default || configModule;

					return this.normalizeConfig(config);
				} finally {
					// Clean up temporary file
					try {
						await fs.unlink(tempJsPath);
					} catch {}
				}
			} catch (tsError) {
				throw new Error(`TypeScript configuration loading failed. Please install ts-node or typescript: ${tsError instanceof Error ? tsError.message : String(tsError)}`);
			}
		}

		// If ts-node is available, use it directly
		delete require.cache[require.resolve(configPath)];
		const configModule = require(configPath);
		const config = typeof configModule === 'function' ? configModule() : 
			configModule.default || configModule;

		return this.normalizeConfig(config);
	}

	private normalizeConfig(config: any): WeaverConfig {
		// Normalize templates to ensure they're in the correct format
		const templates = (config.templates || []).map((template: any) => {
			if (typeof template === 'string') {
				return {
					url: template,
					name: this.extractRepoName(template),
					branch: 'main',
				} as TemplateRepository;
			}
			return template as TemplateRepository;
		});

		// Process variables in configuration
		const processedConfig = this.processVariables(config);

		// Normalize merge strategies
		const mergeStrategies = this.normalizeMergeStrategies(processedConfig.mergeStrategies || []);

		return {
			name: processedConfig.name,
			description: processedConfig.description,
			templates,
			mergeStrategy: processedConfig.mergeStrategy || 'merge',
			mergeStrategies,
			excludePatterns: processedConfig.excludePatterns || [],
			includePatterns: processedConfig.includePatterns || [],
			autoUpdate: processedConfig.autoUpdate !== false,
			createRepository: processedConfig.createRepository || false,
			privateRepository: processedConfig.privateRepository || false,
			initGit: processedConfig.initGit !== false,
			addRemote: processedConfig.addRemote,
			hooks: processedConfig.hooks || {},
			variables: processedConfig.variables || {},
			plugins: processedConfig.plugins || [],
		};
	}

	private processVariables(config: any): any {
		const variables = config.variables || {};
		const processedConfig = JSON.parse(JSON.stringify(config));

		// Add environment variables
		const envVars = {
			NODE_ENV: process.env.NODE_ENV || 'development',
			USER: process.env.USER || 'unknown',
			HOME: process.env.HOME || '',
			PWD: process.cwd(),
			...variables,
		};

		// Replace variable placeholders in strings
		const replaceVariables = (obj: any): any => {
			if (typeof obj === 'string') {
				return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
					return envVars[varName] || match;
				});
			} else if (Array.isArray(obj)) {
				return obj.map(replaceVariables);
			} else if (typeof obj === 'object' && obj !== null) {
				const result: any = {};
				for (const [key, value] of Object.entries(obj)) {
					result[key] = replaceVariables(value);
				}
				return result;
			}
			return obj;
		};

		return replaceVariables(processedConfig);
	}

	private normalizeMergeStrategies(strategies: any[]): FilePatternMergeStrategy[] {
		return strategies.map((strategy, index) => {
			// Normalize patterns
			const patterns = Array.isArray(strategy.patterns) ? strategy.patterns : [strategy.patterns];

			// Normalize strategy config
			let strategyConfig: MergeStrategyConfig;
			if (typeof strategy.strategy === 'string') {
				strategyConfig = { type: strategy.strategy as any };
			} else {
				strategyConfig = strategy.strategy;
			}

			return {
				patterns,
				strategy: strategyConfig,
				priority: strategy.priority || index,
			};
		});
	}

	private async loadWeaverIgnore(): Promise<WeaverIgnoreConfig> {
		const ignoreFiles = ['.weaverignore', '.weaverignore.txt'];

		for (const ignoreFile of ignoreFiles) {
			const ignorePath = path.join(this.basePath, ignoreFile);

			try {
				const exists = await this.fileExists(ignorePath);
				if (exists) {
					return await this.loadIgnoreFile(ignorePath);
				}
			} catch (error) {
				console.warn(`Failed to load ignore file ${ignoreFile}:`, error);
			}
		}

		return { patterns: [] };
	}

	private async loadIgnoreFile(ignorePath: string): Promise<WeaverIgnoreConfig> {
		const content = await fs.readFile(ignorePath, 'utf-8');
		const lines = content.split('\n');

		const patterns: string[] = [];
		const includePatterns: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			// Handle include patterns (lines starting with !)
			if (trimmed.startsWith('!')) {
				includePatterns.push(trimmed.substring(1));
			} else {
				patterns.push(trimmed);
			}
		}

		return {
			patterns,
			includePatterns: includePatterns.length > 0 ? includePatterns : undefined,
		};
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	private extractRepoName(url: string): string {
		const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
		return match ? match[1] : 'unknown';
	}

	async createSampleConfig(outputPath?: string): Promise<void> {
		const sampleConfig: WeaverConfig = {
			name: 'my-awesome-project',
			description: 'A project created with RepoWeaver',
			templates: [
				'https://github.com/user/frontend-template.git',
				{
					url: 'https://github.com/user/backend-template.git',
					name: 'backend',
					branch: 'main',
					subDirectory: 'api',
				},
			],
			mergeStrategy: 'merge',
			mergeStrategies: [
				{
					patterns: ['*.json'],
					strategy: { type: 'custom', implementation: './custom-json-merger.js' },
					priority: 100,
				},
				{
					patterns: ['package.json'],
					strategy: { type: 'plugin', implementation: 'npm-merger:package' },
					priority: 200,
				},
				{
					patterns: ['*.md', '*.txt'],
					strategy: { type: 'merge', options: { separator: '\n\n---\n\n' } },
					priority: 50,
				},
				{
					patterns: ['src/**/*.js', 'src/**/*.ts'],
					strategy: { type: 'skip' },
					priority: 75,
				},
			],
			excludePatterns: ['*.log', 'node_modules/**', '.env*', 'dist/**', 'build/**'],
			includePatterns: ['!.env.example'],
			autoUpdate: true,
			createRepository: false,
			privateRepository: false,
			initGit: true,
			hooks: {
				preBootstrap: ['echo "Starting bootstrap..."'],
				postBootstrap: ['npm install', 'npm run build'],
			},
			variables: {
				PROJECT_NAME: 'my-project',
				AUTHOR_NAME: 'John Doe',
				AUTHOR_EMAIL: 'john@example.com',
			},
			plugins: ['npm-merger', 'yaml-merger'],
		};

		const configPath = outputPath || path.join(this.basePath, 'weaver.json');
		await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2));
		console.log(`Sample configuration created at: ${configPath}`);
	}

	async createSampleIgnore(outputPath?: string): Promise<void> {
		const sampleIgnore = `# RepoWeaver ignore file
# Patterns to exclude from template processing

# Dependencies
node_modules/
vendor/
.pnp/
.pnp.js

# Build outputs
dist/
build/
out/
.next/
.nuxt/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
.tmp/
.temp/

# Cache directories
.cache/
.parcel-cache/
.eslintcache

# Coverage reports
coverage/
*.lcov
.nyc_output/

# Include exceptions (use ! prefix)
!.env.example
!.gitignore
!README.md
`;

		const ignorePath = outputPath || path.join(this.basePath, '.weaverignore');
		await fs.writeFile(ignorePath, sampleIgnore);
		console.log(`Sample ignore file created at: ${ignorePath}`);
	}
}
