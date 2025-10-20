import * as fs from 'fs/promises';
import * as path from 'path';
import { FilePatternMergeStrategy, MergeContext, MergePlugin, MergeResult, MergeStrategy, MergeStrategyConfig } from './types';

export class MergeStrategyRegistry {
	private strategies: Map<string, MergeStrategy> = new Map();
	private plugins: Map<string, MergePlugin> = new Map();
	private customStrategies: Map<string, MergeStrategy> = new Map();

	constructor () {
		this.loadBuiltinStrategies();
	}

	private loadBuiltinStrategies(): void {
		// Load built-in merge strategies
		const builtinStrategies = [new OverwriteMergeStrategy(), new SkipExistingMergeStrategy(), new SimpleMergeStrategy(), new JsonMergeStrategy(), new PackageJsonMergeStrategy(), new MarkdownMergeStrategy(), new YamlMergeStrategy(), new ConfigMergeStrategy(), new CodeMergeStrategy()];

		builtinStrategies.forEach((strategy) => {
			this.strategies.set(strategy.name, strategy);
		});
	}

	async loadPlugin(pluginName: string): Promise<void> {
		try {
			// Try to load from node_modules first
			const pluginPath = require.resolve(`repoweaver-plugin-${pluginName}`);
			const pluginModule = await import(pluginPath);

			const plugin: MergePlugin = pluginModule.default || pluginModule;

			if (plugin.initialize) {
				await plugin.initialize();
			}

			// Register plugin strategies
			plugin.strategies.forEach((strategy) => {
				this.strategies.set(`${pluginName}:${strategy.name}`, strategy);
			});

			this.plugins.set(pluginName, plugin);
			console.log(`✅ Loaded plugin: ${pluginName} (${plugin.version})`);
		} catch (error) {
			console.error(`❌ Failed to load plugin ${pluginName}:`, error);
			throw new Error(`Plugin ${pluginName} could not be loaded`);
		}
	}

	async loadCustomStrategy(implementation: string, name?: string): Promise<void> {
		try {
			const strategyPath = path.resolve(implementation);

			// Check if file exists
			await fs.access(strategyPath);

			// Clear require cache to allow reloading
			delete require.cache[require.resolve(strategyPath)];

			const strategyModule = require(strategyPath);
			const strategy: MergeStrategy = strategyModule.default || strategyModule;

			const strategyName = name || strategy.name || path.basename(implementation, path.extname(implementation));

			this.customStrategies.set(strategyName, strategy);
			this.strategies.set(strategyName, strategy);

			console.log(`✅ Loaded custom strategy: ${strategyName} from ${implementation}`);
		} catch (error) {
			console.error(`❌ Failed to load custom strategy ${implementation}:`, error);
			throw new Error(`Custom strategy ${implementation} could not be loaded`);
		}
	}

	getStrategy(name: string): MergeStrategy | undefined {
		return this.strategies.get(name);
	}

	listStrategies(): string[] {
		return Array.from(this.strategies.keys());
	}

	async resolveStrategyForFile(filePath: string, strategies: FilePatternMergeStrategy[], defaultStrategy?: MergeStrategyConfig): Promise<MergeStrategy> {
		// Sort strategies by priority (higher priority first)
		const sortedStrategies = [...strategies].sort((a, b) => (b.priority || 0) - (a.priority || 0));

		// Find the first matching strategy
		for (const strategyConfig of sortedStrategies) {
			// Match explicit patterns
			if (this.matchesPatterns(filePath, strategyConfig.patterns)) {
				return await this.resolveStrategy(strategyConfig.strategy);
			}
			// Match category-derived patterns
			if (strategyConfig.category) {
				const catPatterns = this.getCategoryPatterns(strategyConfig.category);
				if (this.matchesPatterns(filePath, catPatterns)) {
					return await this.resolveStrategy(strategyConfig.strategy);
				}
			}
		}

		// Fall back to default strategy
		if (defaultStrategy) {
			return await this.resolveStrategy(defaultStrategy);
		}

		// Ultimate fallback
		return this.getStrategy('merge') || new SimpleMergeStrategy();
	}

	async resolveStrategy(config: MergeStrategyConfig): Promise<MergeStrategy> {
		switch (config.type) {
			case 'overwrite':
				return this.getStrategy('overwrite') || new OverwriteMergeStrategy();

			case 'merge':
				return this.getStrategy('merge') || new SimpleMergeStrategy();

			case 'skip':
				return this.getStrategy('skip') || new SkipExistingMergeStrategy();

			case 'custom':
				if (!config.implementation) {
					throw new Error('Custom strategy requires implementation path');
				}
				await this.loadCustomStrategy(config.implementation);
				return this.getStrategy(path.basename(config.implementation, path.extname(config.implementation)))!;

			case 'plugin':
				if (!config.implementation) {
					throw new Error('Plugin strategy requires plugin name');
				}
				const [pluginName, strategyName] = config.implementation.split(':');
				if (!this.plugins.has(pluginName)) {
					await this.loadPlugin(pluginName);
				}
				return this.getStrategy(config.implementation)!;

			default:
				throw new Error(`Unknown strategy type: ${config.type}`);
		}
	}

	// Cache for compiled regex patterns
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

	async cleanup(): Promise<void> {
		// Cleanup plugins
		for (const plugin of this.plugins.values()) {
			if (plugin.cleanup) {
				await plugin.cleanup();
			}
		}

		this.plugins.clear();
		this.customStrategies.clear();
	}
}

// Built-in merge strategies
class OverwriteMergeStrategy implements MergeStrategy {
	name = 'overwrite';
	description = 'Overwrite existing content with new content';

	async merge(context: MergeContext): Promise<MergeResult> {
		return {
			success: true,
			content: context.newContent,
		};
	}
}

class SkipExistingMergeStrategy implements MergeStrategy {
	name = 'skip';
	description = 'Skip files that already exist';

	async merge(context: MergeContext): Promise<MergeResult> {
		return {
			success: true,
			content: context.existingContent,
		};
	}
}

class SimpleMergeStrategy implements MergeStrategy {
	name = 'merge';
	description = 'Simple merge by appending new content to existing content';

	async merge(context: MergeContext): Promise<MergeResult> {
		if (!context.existingContent.trim()) {
			return {
				success: true,
				content: context.newContent,
			};
		}

		const separator = context.options?.separator || '\n\n# --- Template Update ---\n\n';
		const content = context.existingContent + separator + context.newContent;

		return {
			success: true,
			content,
			warnings: ['Content was appended with separator'],
		};
	}
}

class JsonMergeStrategy implements MergeStrategy {
	name = 'json';
	description = 'Deep merge JSON objects';

	async merge(context: MergeContext): Promise<MergeResult> {
		try {
			const existingObj = JSON.parse(context.existingContent);
			const newObj = JSON.parse(context.newContent);

			const merged = this.deepMerge(existingObj, newObj);

			return {
				success: true,
				content: JSON.stringify(merged, null, 2),
				metadata: { mergedKeys: Object.keys(merged) },
			};
		} catch (error) {
			return {
				success: false,
				content: context.existingContent,
				warnings: [`JSON merge failed: ${error}. Using existing content.`],
			};
		}
	}

	private deepMerge(target: any, source: any): any {
		const result = { ...target };

		for (const key in source) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(target[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}

		return result;
	}
}

class PackageJsonMergeStrategy implements MergeStrategy {
	name = 'package-json';
	description = 'Merge package.json files with special handling for dependencies';

	async merge(context: MergeContext): Promise<MergeResult> {
		try {
			const existingPkg = JSON.parse(context.existingContent);
			const newPkg = JSON.parse(context.newContent);

			const merged = {
				...existingPkg,
				...newPkg,
				dependencies: { ...existingPkg.dependencies, ...newPkg.dependencies },
				devDependencies: { ...existingPkg.devDependencies, ...newPkg.devDependencies },
				peerDependencies: { ...existingPkg.peerDependencies, ...newPkg.peerDependencies },
				scripts: { ...existingPkg.scripts, ...newPkg.scripts },
			};

			return {
				success: true,
				content: JSON.stringify(merged, null, 2),
				metadata: {
					dependenciesAdded: Object.keys(newPkg.dependencies || {}),
					scriptsAdded: Object.keys(newPkg.scripts || {}),
				},
			};
		} catch (error) {
			return {
				success: false,
				content: context.existingContent,
				warnings: [`package.json merge failed: ${error}`],
			};
		}
	}
}

class MarkdownMergeStrategy implements MergeStrategy {
	name = 'markdown';
	description = 'Merge Markdown files by appending sections';

	async merge(context: MergeContext): Promise<MergeResult> {
		const separator = context.options?.separator || '\n\n---\n\n';
		const content = context.existingContent + separator + context.newContent;

		return {
			success: true,
			content,
			warnings: ['Markdown content was appended with separator'],
		};
	}
}

class YamlMergeStrategy implements MergeStrategy {
	name = 'yaml';
	description = 'Merge YAML files (requires js-yaml)';

	async merge(context: MergeContext): Promise<MergeResult> {
		try {
			// Try to use js-yaml if available
			const yaml = require('js-yaml');

			const existingObj = yaml.load(context.existingContent);
			const newObj = yaml.load(context.newContent);

			const merged = this.deepMerge(existingObj, newObj);

			return {
				success: true,
				content: yaml.dump(merged, { indent: 2 }),
			};
		} catch (error) {
			// Fallback to simple merge if js-yaml is not available
			const separator = context.options?.separator || '\n\n# --- Template Update ---\n\n';
			return {
				success: true,
				content: context.existingContent + separator + context.newContent,
				warnings: ['YAML merge failed, used simple merge instead'],
			};
		}
	}

	private deepMerge(target: any, source: any): any {
		const result = { ...target };

		for (const key in source) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(target[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}

		return result;
	}
}

class ConfigMergeStrategy implements MergeStrategy {
	name = 'config';
	description = 'Merge configuration files (JSON, YAML, TOML)';

	async merge(context: MergeContext): Promise<MergeResult> {
		const ext = path.extname(context.filePath).toLowerCase();

		switch (ext) {
			case '.json':
				return new JsonMergeStrategy().merge(context);
			case '.yaml':
			case '.yml':
				return new YamlMergeStrategy().merge(context);
			case '.toml':
				return this.mergeToml(context);
			default:
				return new SimpleMergeStrategy().merge(context);
		}
	}

	private async mergeToml(context: MergeContext): Promise<MergeResult> {
		// Simple TOML merge - could be enhanced with a proper TOML parser
		const separator = context.options?.separator || '\n\n# --- Template Update ---\n\n';
		return {
			success: true,
			content: context.existingContent + separator + context.newContent,
			warnings: ['TOML merge used simple strategy'],
		};
	}
}

class CodeMergeStrategy implements MergeStrategy {
	name = 'code';
	description = 'Merge code files with conflict markers';

	async merge(context: MergeContext): Promise<MergeResult> {
		const conflicts = [];

		if (context.existingContent.trim() && context.newContent.trim()) {
			conflicts.push(`Potential conflict in ${context.filePath}`);
		}

		const content = `${context.existingContent}\n\n<<<<<<< existing\n${context.existingContent}\n=======\n${context.newContent}\n>>>>>>> ${context.templateName}\n`;

		return {
			success: true,
			content,
			conflicts,
			warnings: ['Code merge created conflict markers'],
		};
	}
}
