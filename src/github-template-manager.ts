import { GitHubClient, GitHubFile } from './github-client';
import { TemplateProcessingResult, TemplateRepository, MergeStrategyConfig, FilePatternMergeStrategy } from './types';
import { MergeStrategyRegistry } from './merge-strategy-registry';

export class GitHubTemplateManager {
  private client: GitHubClient;
  private mergeRegistry: MergeStrategyRegistry;

  constructor(client: GitHubClient) {
    this.client = client;
    this.mergeRegistry = new MergeStrategyRegistry();
  }

  async processTemplate(
    template: TemplateRepository,
    targetOwner: string,
    targetRepo: string,
    excludePatterns: string[] = [],
    mergeStrategy: 'overwrite' | 'merge' | 'skip-existing' | MergeStrategyConfig = 'merge',
    mergeStrategies: FilePatternMergeStrategy[] = [],
    plugins: string[] = []
  ): Promise<TemplateProcessingResult> {
    const result: TemplateProcessingResult = {
      success: true,
      template,
      filesProcessed: 0,
      errors: []
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
      await this.processFiles(
        filteredFiles,
        targetOwner,
        targetRepo,
        mergeStrategy,
        mergeStrategies,
        result
      );

    } catch (error) {
      result.success = false;
      result.errors.push(`Template processing failed: ${error}`);
    }

    return result;
  }

  private filterFiles(files: GitHubFile[], excludePatterns: string[]): GitHubFile[] {
    return files.filter(file => {
      // Skip directories in processing
      if (file.type === 'dir') {
        return false;
      }

      // Apply exclude patterns
      return !this.shouldExclude(file.path, excludePatterns);
    });
  }

  private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  private async processFiles(
    files: GitHubFile[],
    targetOwner: string,
    targetRepo: string,
    mergeStrategy: 'overwrite' | 'merge' | 'skip-existing' | MergeStrategyConfig,
    mergeStrategies: FilePatternMergeStrategy[],
    result: TemplateProcessingResult
  ): Promise<void> {
    const branch = `boots-strapper-update-${Date.now()}`;
    
    try {
      // Create a new branch for the template updates
      await this.client.createBranch(targetOwner, targetRepo, branch);

      for (const file of files) {
        try {
          // Determine merge strategy for this file
          const defaultMergeStrategy = typeof mergeStrategy === 'string' 
            ? { type: mergeStrategy as 'overwrite' | 'merge' | 'skip-existing' }
            : mergeStrategy;
          
          const fileStrategy = await this.mergeRegistry.resolveStrategyForFile(
            file.path,
            mergeStrategies,
            defaultMergeStrategy
          );

          const shouldProcess = await this.shouldProcessFile(
            targetOwner,
            targetRepo,
            file.path,
            fileStrategy.name
          );

          if (shouldProcess) {
            let content = file.content;

            // Get existing content if file exists
            let existingContent = '';
            try {
              const existingFiles = await this.client.getRepositoryContents(targetOwner, targetRepo, file.path);
              const existingFile = existingFiles.find(f => f.path === file.path && f.type === 'file');
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
                newContent: file.content
              });

              if (mergeResult.success) {
                content = mergeResult.content;
                
                // Track warnings and conflicts
                if (mergeResult.warnings) {
                  result.errors.push(...mergeResult.warnings.map(w => `Warning: ${w}`));
                }
                if (mergeResult.conflicts) {
                  result.errors.push(...mergeResult.conflicts.map(c => `Conflict: ${c}`));
                }
              } else {
                result.errors.push(`Merge failed for ${file.path}, using new content`);
              }
            }

            await this.client.createOrUpdateFile(
              targetOwner,
              targetRepo,
              file.path,
              content,
              `Update ${file.path} from template ${result.template.name} using ${fileStrategy.name} strategy`,
              branch
            );

            result.filesProcessed++;
          }
        } catch (error) {
          result.errors.push(`Failed to process file ${file.path}: ${error}`);
        }
      }

      // Create a pull request with the changes
      if (result.filesProcessed > 0) {
        const prNumber = await this.client.createPullRequest(
          targetOwner,
          targetRepo,
          `Update repository from template: ${template.name}`,
          this.generatePullRequestBody(template, result),
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

  private async shouldProcessFile(
    owner: string,
    repo: string,
    filePath: string,
    strategyName: string
  ): Promise<boolean> {
    if (strategyName === 'overwrite') {
      return true;
    }

    try {
      // Check if file exists
      await this.client.getRepositoryContents(owner, repo, filePath);
      
      // File exists
      if (strategyName === 'skip-existing') {
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

  private generatePullRequestBody(template: TemplateRepository, result: TemplateProcessingResult): string {
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

---

*This PR was automatically generated by [RepoWeaver](https://github.com/apps/repoweaver)*
    `.trim();
  }
}