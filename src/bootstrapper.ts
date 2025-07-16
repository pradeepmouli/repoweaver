import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import { TemplateManager } from './template-manager';
import { BootstrapOptions, BootstrapResult, TemplateProcessingResult } from './types';

export class Bootstrapper {
  private templateManager: TemplateManager;
  private git: SimpleGit;

  constructor() {
    this.templateManager = new TemplateManager();
    this.git = simpleGit();
  }

  async bootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      success: true,
      repositoryPath: path.resolve(options.targetPath),
      templateResults: [],
      totalFilesProcessed: 0,
      errors: []
    };

    try {
      // Process each template
      for (const template of options.templates) {
        const templateResult = await this.templateManager.processTemplate(
          template,
          result.repositoryPath,
          options.excludePatterns
        );
        
        result.templateResults.push(templateResult);
        result.totalFilesProcessed += templateResult.filesProcessed;
        
        if (!templateResult.success) {
          result.success = false;
          result.errors.push(...templateResult.errors);
        }
      }

      // Initialize git repository if requested
      if (options.initGit) {
        await this.initializeGitRepository(result.repositoryPath, options.addRemote);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Bootstrap failed: ${error}`);
    } finally {
      await this.templateManager.cleanup();
    }

    return result;
  }

  async updateRepository(options: BootstrapOptions): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      success: true,
      repositoryPath: path.resolve(options.targetPath),
      templateResults: [],
      totalFilesProcessed: 0,
      errors: []
    };

    try {
      // Check if target is a git repository
      const isGitRepo = await this.isGitRepository(result.repositoryPath);
      if (!isGitRepo) {
        throw new Error('Target directory is not a git repository. Use bootstrap for new repositories.');
      }

      // Process templates with merge strategy
      for (const template of options.templates) {
        const templateResult = await this.processTemplateUpdate(
          template,
          result.repositoryPath,
          options.mergeStrategy || 'merge',
          options.excludePatterns
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
    } finally {
      await this.templateManager.cleanup();
    }

    return result;
  }

  private async processTemplateUpdate(
    template: any,
    targetPath: string,
    mergeStrategy: string,
    excludePatterns?: string[]
  ): Promise<TemplateProcessingResult> {
    // For now, delegate to the template manager
    // In the future, this could implement more sophisticated merge strategies
    return this.templateManager.processTemplate(template, targetPath, excludePatterns);
  }

  private async initializeGitRepository(repositoryPath: string, remoteUrl?: string): Promise<void> {
    const git = simpleGit(repositoryPath);
    
    try {
      await git.init();
      
      if (remoteUrl) {
        await git.addRemote('origin', remoteUrl);
      }
      
      // Add all files and make initial commit
      await git.add('.');
      await git.commit('Initial commit from RepoWeaver');
      
    } catch (error) {
      throw new Error(`Git initialization failed: ${error}`);
    }
  }

  private async isGitRepository(repositoryPath: string): Promise<boolean> {
    try {
      const git = simpleGit(repositoryPath);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }
}