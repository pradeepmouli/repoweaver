import { GitHubClient, GitHubFile } from './github-client';
import { TemplateProcessingResult, TemplateRepository } from './types';

export class GitHubTemplateManager {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  async processTemplate(
    template: TemplateRepository,
    targetOwner: string,
    targetRepo: string,
    excludePatterns: string[] = [],
    mergeStrategy: 'overwrite' | 'merge' | 'skip-existing' = 'merge'
  ): Promise<TemplateProcessingResult> {
    const result: TemplateProcessingResult = {
      success: true,
      template,
      filesProcessed: 0,
      errors: []
    };

    try {
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
    mergeStrategy: 'overwrite' | 'merge' | 'skip-existing',
    result: TemplateProcessingResult
  ): Promise<void> {
    const branch = `boots-strapper-update-${Date.now()}`;
    
    try {
      // Create a new branch for the template updates
      await this.client.createBranch(targetOwner, targetRepo, branch);

      for (const file of files) {
        try {
          const shouldProcess = await this.shouldProcessFile(
            targetOwner,
            targetRepo,
            file.path,
            mergeStrategy
          );

          if (shouldProcess) {
            let content = file.content;

            // If merge strategy is 'merge', we might need to merge with existing content
            if (mergeStrategy === 'merge') {
              content = await this.mergeFileContent(
                targetOwner,
                targetRepo,
                file.path,
                file.content
              );
            }

            await this.client.createOrUpdateFile(
              targetOwner,
              targetRepo,
              file.path,
              content,
              `Update ${file.path} from template ${template.name}`,
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
    mergeStrategy: 'overwrite' | 'merge' | 'skip-existing'
  ): Promise<boolean> {
    if (mergeStrategy === 'overwrite') {
      return true;
    }

    try {
      // Check if file exists
      await this.client.getRepositoryContents(owner, repo, filePath);
      
      // File exists
      if (mergeStrategy === 'skip-existing') {
        return false;
      }
      
      // mergeStrategy === 'merge'
      return true;
    } catch (error) {
      // File doesn't exist, so we can create it
      return true;
    }
  }

  private async mergeFileContent(
    owner: string,
    repo: string,
    filePath: string,
    newContent: string
  ): Promise<string> {
    try {
      const existingFiles = await this.client.getRepositoryContents(owner, repo, filePath);
      const existingFile = existingFiles.find(f => f.path === filePath && f.type === 'file');
      
      if (!existingFile) {
        return newContent;
      }

      // For now, implement a simple merge strategy
      // In a more sophisticated implementation, you might:
      // - Parse JSON/YAML files and merge objects
      // - Use diff libraries for code files
      // - Apply custom merge rules based on file type
      
      return this.simpleMerge(existingFile.content, newContent, filePath);
    } catch (error) {
      // If we can't get existing content, just use new content
      return newContent;
    }
  }

  private simpleMerge(existingContent: string, newContent: string, filePath: string): string {
    // Simple merge logic based on file type
    if (filePath.endsWith('.json')) {
      return this.mergeJsonFiles(existingContent, newContent);
    } else if (filePath.endsWith('.md')) {
      return this.mergeMarkdownFiles(existingContent, newContent);
    } else if (filePath.endsWith('package.json')) {
      return this.mergePackageJson(existingContent, newContent);
    }

    // For other files, append new content with a separator
    return existingContent + '\n\n# --- Template Update ---\n\n' + newContent;
  }

  private mergeJsonFiles(existing: string, newContent: string): string {
    try {
      const existingObj = JSON.parse(existing);
      const newObj = JSON.parse(newContent);
      
      // Deep merge objects
      const merged = this.deepMerge(existingObj, newObj);
      return JSON.stringify(merged, null, 2);
    } catch (error) {
      return newContent;
    }
  }

  private mergeMarkdownFiles(existing: string, newContent: string): string {
    // Simple strategy: append new content to existing
    return existing + '\n\n---\n\n' + newContent;
  }

  private mergePackageJson(existing: string, newContent: string): string {
    try {
      const existingPkg = JSON.parse(existing);
      const newPkg = JSON.parse(newContent);
      
      // Merge dependencies and devDependencies
      const merged = {
        ...existingPkg,
        dependencies: { ...existingPkg.dependencies, ...newPkg.dependencies },
        devDependencies: { ...existingPkg.devDependencies, ...newPkg.devDependencies },
        scripts: { ...existingPkg.scripts, ...newPkg.scripts }
      };
      
      return JSON.stringify(merged, null, 2);
    } catch (error) {
      return newContent;
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