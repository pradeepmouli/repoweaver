#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { Bootstrapper } from './bootstrapper';
import { ConfigLoader } from './config-loader';
import { BootstrapOptions, TemplateRepository, WeaverConfig } from './types';

const program = new Command();

program.name('repoweaver').description('Skillfully weave multiple templates together to create and update repositories').version('1.0.0');

// Add init command to create sample configuration files
program
	.command('init')
	.description('Initialize a RepoWeaver project with sample configuration files')
	.option('--config-only', 'Only create configuration file')
	.option('--ignore-only', 'Only create ignore file')
	.action(async (options) => {
		try {
			const configLoader = new ConfigLoader();

			if (options.ignoreOnly) {
				await configLoader.createSampleIgnore();
			} else if (options.configOnly) {
				await configLoader.createSampleConfig();
			} else {
				await configLoader.createSampleConfig();
				await configLoader.createSampleIgnore();
			}

			console.log('✅ RepoWeaver project initialized!');
			console.log('📝 Edit weaver.json to configure your templates');
			console.log('🚫 Edit .weaverignore to exclude files from processing');
		} catch (error) {
			console.error('❌ Initialization failed:', error);
			process.exit(1);
		}
	});

program
	.command('bootstrap')
	.description('Create a new repository from template(s)')
	.argument('<name>', 'Repository name')
	.argument('<path>', 'Target path for the new repository')
	.option('-t, --template <url>', 'Template repository URL(s)', collect, [])
	.option('-b, --branch <branch>', 'Template branch (default: main)')
	.option('-s, --subdir <path>', 'Use subdirectory from template')
	.option('--git', 'Initialize git repository', false)
	.option('--remote <url>', 'Add git remote origin')
	.option('--exclude <pattern>', 'Exclude patterns', collect, [])
	.option('--merge-strategy <strategy>', 'Merge strategy: overwrite|merge|skip', 'merge')
	.action(async (name, targetPath, options) => {
		try {
			// Load configuration from files if they exist
			const configLoader = new ConfigLoader();
			const config = await configLoader.loadConfiguration();

			// Command line options override configuration file
			const templates: TemplateRepository[] =
				options.template.length > 0
					? options.template.map((url: string) => ({
							url,
							name: extractRepoName(url),
							branch: options.branch,
					  }))
					: config.templates;

			if (templates.length === 0) {
				console.error('Error: At least one template is required');
				console.error('Either provide --template options or create a weaver.json configuration file');
				process.exit(1);
			}

			// Merge configuration with command line options
			const bootstrapOptions: BootstrapOptions = {
				targetPath,
				templates,
				repositoryName: name || config.name || path.basename(targetPath),
				initGit: options.git !== undefined ? options.git : config.initGit,
				addRemote: options.remote || config.addRemote,
				excludePatterns: options.exclude.length > 0 ? options.exclude : config.excludePatterns,
				mergeStrategy: options.mergeStrategy || config.mergeStrategy,
			};

			const bootstrapper = new Bootstrapper();
			const result = await bootstrapper.bootstrap(bootstrapOptions);

			if (result.success) {
				console.log(`✅ Successfully bootstrapped repository at: ${result.repositoryPath}`);
				console.log(`📁 Total files processed: ${result.totalFilesProcessed}`);

				result.templateResults.forEach((tr) => {
					console.log(`  - ${tr.template.name}: ${tr.filesProcessed} files`);
				});
			} else {
				console.error('❌ Bootstrap failed:');
				result.errors.forEach((error) => console.error(`  - ${error}`));
				process.exit(1);
			}
		} catch (error) {
			console.error(`❌ Bootstrap failed: ${error}`);
			process.exit(1);
		}
	});

program
	.command('update')
	.description('Update an existing repository with template(s)')
	.argument('<path>', 'Path to the existing repository')
	.option('-t, --template <url>', 'Template repository URL(s)', collect, [])
	.option('-b, --branch <branch>', 'Template branch (default: main)')
	.option('-s, --subdir <path>', 'Use subdirectory from template')
	.option('--exclude <pattern>', 'Exclude patterns', collect, [])
	.option('--merge-strategy <strategy>', 'Merge strategy: overwrite|merge|skip', 'merge')
	.action(async (targetPath, options) => {
		try {
			// Load configuration from files if they exist
			const configLoader = new ConfigLoader(targetPath);
			const config = await configLoader.loadConfiguration();

			// Command line options override configuration file
			const templates: TemplateRepository[] =
				options.template.length > 0
					? options.template.map((url: string) => ({
							url,
							name: extractRepoName(url),
							branch: options.branch,
					  }))
					: config.templates;

			if (templates.length === 0) {
				console.error('Error: At least one template is required');
				console.error('Either provide --template options or create a weaver.json configuration file');
				process.exit(1);
			}

			// Merge configuration with command line options
			const bootstrapOptions: BootstrapOptions = {
				targetPath,
				templates,
				repositoryName: config.name || path.basename(targetPath),
				excludePatterns: options.exclude.length > 0 ? options.exclude : config.excludePatterns,
				mergeStrategy: options.mergeStrategy || config.mergeStrategy,
			};

			const bootstrapper = new Bootstrapper();
			const result = await bootstrapper.updateRepository(bootstrapOptions);

			if (result.success) {
				console.log(`✅ Successfully updated repository at: ${result.repositoryPath}`);
				console.log(`📁 Total files processed: ${result.totalFilesProcessed}`);

				result.templateResults.forEach((tr) => {
					console.log(`  - ${tr.template.name}: ${tr.filesProcessed} files`);
				});
			} else {
				console.error('❌ Update failed:');
				result.errors.forEach((error) => console.error(`  - ${error}`));
				process.exit(1);
			}
		} catch (error) {
			console.error(`❌ Update failed: ${error}`);
			process.exit(1);
		}
	});

function collect(value: string, previous: string[]): string[] {
	return previous.concat([value]);
}

function extractRepoName(url: string): string {
	const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
	return match ? match[1] : 'unknown';
}

if (require.main === module) {
	program.parse();
}
