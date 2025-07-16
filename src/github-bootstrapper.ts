import { GitHubClient, GitHubRepository } from './github-client';
import { GitHubTemplateManager } from './github-template-manager';
import { BootstrapOptions, BootstrapResult } from './types';

export interface GitHubBootstrapOptions extends Omit<BootstrapOptions, 'targetPath' | 'initGit' | 'addRemote'> {
  targetOwner: string;
  targetRepo: string;
  createRepository?: boolean;
  repositoryDescription?: string;
  privateRepository?: boolean;
}

export class GitHubBootstrapper {
  private client: GitHubClient;
  private templateManager: GitHubTemplateManager;

  constructor(client: GitHubClient) {
    this.client = client;
    this.templateManager = new GitHubTemplateManager(client);
  }

  async bootstrap(options: GitHubBootstrapOptions): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      success: true,
      repositoryPath: `${options.targetOwner}/${options.targetRepo}`,
      templateResults: [],
      totalFilesProcessed: 0,
      errors: []
    };

    try {
      // Create repository if requested
      if (options.createRepository) {
        await this.createRepository(options);
      }

      // Process each template
      for (const template of options.templates) {
        const templateResult = await this.templateManager.processTemplate(
          template,
          options.targetOwner,
          options.targetRepo,
          options.excludePatterns,
          options.mergeStrategy
        );
        
        result.templateResults.push(templateResult);
        result.totalFilesProcessed += templateResult.filesProcessed;
        
        if (!templateResult.success) {
          result.success = false;
          result.errors.push(...templateResult.errors);
        }
      }

      // If all templates were processed successfully, create a summary PR
      if (result.success && result.templateResults.length > 1) {
        await this.createSummaryPullRequest(options, result);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Bootstrap failed: ${error}`);
    }

    return result;
  }

  async updateRepository(options: GitHubBootstrapOptions): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      success: true,
      repositoryPath: `${options.targetOwner}/${options.targetRepo}`,
      templateResults: [],
      totalFilesProcessed: 0,
      errors: []
    };

    try {
      // Verify repository exists
      await this.client.getRepository(options.targetOwner, options.targetRepo);

      // Process templates with merge strategy
      for (const template of options.templates) {
        const templateResult = await this.templateManager.processTemplate(
          template,
          options.targetOwner,
          options.targetRepo,
          options.excludePatterns,
          options.mergeStrategy || 'merge'
        );
        
        result.templateResults.push(templateResult);
        result.totalFilesProcessed += templateResult.filesProcessed;
        
        if (!templateResult.success) {
          result.success = false;
          result.errors.push(...templateResult.errors);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Update failed: ${error}`);
    }

    return result;
  }

  private async createRepository(options: GitHubBootstrapOptions): Promise<GitHubRepository> {
    try {
      return await this.client.createRepository(
        options.targetRepo,
        options.repositoryDescription,
        options.privateRepository
      );
    } catch (error) {
      throw new Error(`Failed to create repository: ${error}`);
    }
  }

  private async createSummaryPullRequest(
    options: GitHubBootstrapOptions,
    result: BootstrapResult
  ): Promise<void> {
    try {
      const branch = `boots-strapper-multi-template-${Date.now()}`;
      await this.client.createBranch(options.targetOwner, options.targetRepo, branch);

      // Create a summary file
      const summaryContent = this.generateSummaryContent(options, result);
      await this.client.createOrUpdateFile(
        options.targetOwner,
        options.targetRepo,
        'BOOTSTRAP_SUMMARY.md',
        summaryContent,
        'Add bootstrap summary',
        branch
      );

      // Create pull request
      await this.client.createPullRequest(
        options.targetOwner,
        options.targetRepo,
        `Bootstrap repository with ${options.templates.length} templates`,
        this.generateMultiTemplatePRBody(options, result),
        branch,
        'main'
      );

    } catch (error) {
      result.errors.push(`Failed to create summary PR: ${error}`);
    }
  }

  private generateSummaryContent(options: GitHubBootstrapOptions, result: BootstrapResult): string {
    const timestamp = new Date().toISOString();
    
    return `
# Bootstrap Summary

**Repository:** ${options.targetOwner}/${options.targetRepo}  
**Generated:** ${timestamp}  
**Total Files Processed:** ${result.totalFilesProcessed}

## Templates Applied

${options.templates.map(template => `
### ${template.name}

- **URL:** ${template.url}
- **Branch:** ${template.branch || 'main'}
${template.subDirectory ? `- **Subdirectory:** ${template.subDirectory}` : ''}
- **Files Processed:** ${result.templateResults.find(r => r.template.name === template.name)?.filesProcessed || 0}
`).join('\n')}

## Configuration

- **Merge Strategy:** ${options.mergeStrategy || 'merge'}
- **Exclude Patterns:** ${options.excludePatterns?.join(', ') || 'None'}

---

*Generated by [RepoWeaver](https://github.com/apps/repoweaver)*
    `.trim();
  }

  private generateMultiTemplatePRBody(options: GitHubBootstrapOptions, result: BootstrapResult): string {
    return `
## Multi-Template Bootstrap

This pull request bootstraps the repository with **${options.templates.length} templates**.

**Summary:**
- Total files processed: **${result.totalFilesProcessed}**
- Templates applied: **${options.templates.length}**
- Merge strategy: **${options.mergeStrategy || 'merge'}**

**Templates:**
${options.templates.map((template, index) => {
  const templateResult = result.templateResults[index];
  return `${index + 1}. **${template.name}** - ${templateResult.filesProcessed} files`;
}).join('\n')}

**Pull Requests Created:**
${result.templateResults
  .filter(r => r.pullRequestNumber)
  .map(r => `- ${r.template.name}: #${r.pullRequestNumber}`)
  .join('\n')}

See \`BOOTSTRAP_SUMMARY.md\` for detailed information.

---

*This PR was automatically generated by [RepoWeaver](https://github.com/apps/repoweaver)*
    `.trim();
  }

  async getRepositoryTemplates(owner: string, repo: string): Promise<string[]> {
    try {
      // Look for a .repoweaver.json configuration file
      const configFiles = await this.client.getRepositoryContents(owner, repo, '.repoweaver.json');
      const configFile = configFiles.find(f => f.name === '.repoweaver.json');
      
      if (configFile) {
        const config = JSON.parse(configFile.content);
        return config.templates || [];
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  async saveRepositoryTemplates(owner: string, repo: string, templates: string[]): Promise<void> {
    const config = {
      templates,
      lastUpdated: new Date().toISOString()
    };

    await this.client.createOrUpdateFile(
      owner,
      repo,
      '.repoweaver.json',
      JSON.stringify(config, null, 2),
      'Update RepoWeaver configuration'
    );
  }
}