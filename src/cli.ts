#!/usr/bin/env node

import { Command } from 'commander';
import { Bootstrapper } from './bootstrapper';
import { BootstrapOptions, TemplateRepository } from './types';

const program = new Command();

program
  .name('repoweaver')
  .description('Skillfully weave multiple templates together to create and update repositories')
  .version('1.0.0');

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
  .option('--merge-strategy <strategy>', 'Merge strategy: overwrite|merge|skip-existing', 'merge')
  .action(async (name, targetPath, options) => {
    try {
      const templates: TemplateRepository[] = options.template.map((url: string) => ({
        url,
        name: extractRepoName(url),
        branch: options.branch
      }));

      if (templates.length === 0) {
        console.error('Error: At least one template is required');
        process.exit(1);
      }

      const bootstrapOptions: BootstrapOptions = {
        targetPath,
        templates,
        repositoryName: name,
        initGit: options.git,
        addRemote: options.remote,
        excludePatterns: options.exclude,
        mergeStrategy: options.mergeStrategy
      };

      const bootstrapper = new Bootstrapper();
      const result = await bootstrapper.bootstrap(bootstrapOptions);

      if (result.success) {
        console.log(`✅ Successfully bootstrapped repository at: ${result.repositoryPath}`);
        console.log(`📁 Total files processed: ${result.totalFilesProcessed}`);
        
        result.templateResults.forEach(tr => {
          console.log(`  - ${tr.template.name}: ${tr.filesProcessed} files`);
        });
      } else {
        console.error('❌ Bootstrap failed:');
        result.errors.forEach(error => console.error(`  - ${error}`));
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
  .option('--merge-strategy <strategy>', 'Merge strategy: overwrite|merge|skip-existing', 'merge')
  .action(async (targetPath, options) => {
    try {
      const templates: TemplateRepository[] = options.template.map((url: string) => ({
        url,
        name: extractRepoName(url),
        branch: options.branch
      }));

      if (templates.length === 0) {
        console.error('Error: At least one template is required');
        process.exit(1);
      }

      const bootstrapOptions: BootstrapOptions = {
        targetPath,
        templates,
        repositoryName: '',
        excludePatterns: options.exclude,
        mergeStrategy: options.mergeStrategy
      };

      const bootstrapper = new Bootstrapper();
      const result = await bootstrapper.updateRepository(bootstrapOptions);

      if (result.success) {
        console.log(`✅ Successfully updated repository at: ${result.repositoryPath}`);
        console.log(`📁 Total files processed: ${result.totalFilesProcessed}`);
        
        result.templateResults.forEach(tr => {
          console.log(`  - ${tr.template.name}: ${tr.filesProcessed} files`);
        });
      } else {
        console.error('❌ Update failed:');
        result.errors.forEach(error => console.error(`  - ${error}`));
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