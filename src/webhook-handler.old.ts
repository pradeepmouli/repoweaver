import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { GitHubClient } from './github-client';
import { GitHubBootstrapper } from './github-bootstrapper';
import { DatabaseManager } from './database';

export interface WebhookEvent {
  action: string;
  installation?: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
  repository?: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  repositories?: Array<{
    name: string;
    full_name: string;
  }>;
  sender?: {
    login: string;
  };
}

export class WebhookHandler {
  private webhookSecret: string;
  private appId: string;
  private privateKey: string;
  private database: DatabaseManager;

  constructor(
    webhookSecret: string,
    appId: string,
    privateKey: string,
    database: DatabaseManager
  ) {
    this.webhookSecret = webhookSecret;
    this.appId = appId;
    this.privateKey = privateKey;
    this.database = database;
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifySignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const event = req.headers['x-github-event'] as string;
      const payload = req.body as WebhookEvent;

      console.log(`Received webhook: ${event} - ${payload.action}`);

      switch (event) {
        case 'installation':
          await this.handleInstallation(payload);
          break;
        case 'installation_repositories':
          await this.handleInstallationRepositories(payload);
          break;
        case 'push':
          await this.handlePush(payload);
          break;
        case 'repository':
          await this.handleRepository(payload);
          break;
        case 'pull_request':
          await this.handlePullRequest(payload);
          break;
        default:
          console.log(`Unhandled event: ${event}`);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private verifySignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return false;
    }

    const hmac = createHmac('sha256', this.webhookSecret);
    hmac.update(JSON.stringify(req.body));
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    return signature === expectedSignature;
  }

  private async handleInstallation(payload: WebhookEvent): Promise<void> {
    if (!payload.installation) return;

    const { installation } = payload;

    switch (payload.action) {
      case 'created':
        await this.database.createInstallation({
          id: installation.id,
          account: installation.account.login,
          accountType: installation.account.type
        });
        console.log(`Installation created for ${installation.account.login}`);
        break;

      case 'deleted':
        await this.database.deleteInstallation(installation.id);
        console.log(`Installation deleted for ${installation.account.login}`);
        break;

      case 'suspend':
        await this.database.suspendInstallation(installation.id);
        console.log(`Installation suspended for ${installation.account.login}`);
        break;

      case 'unsuspend':
        await this.database.unsuspendInstallation(installation.id);
        console.log(`Installation unsuspended for ${installation.account.login}`);
        break;
    }
  }

  private async handleInstallationRepositories(payload: WebhookEvent): Promise<void> {
    if (!payload.installation || !payload.repositories) return;

    const { installation, repositories } = payload;

    switch (payload.action) {
      case 'added':
        for (const repo of repositories) {
          await this.database.addRepositoryToInstallation(
            installation.id,
            repo.name,
            repo.full_name
          );
        }
        console.log(`Added ${repositories.length} repositories to installation ${installation.id}`);
        break;

      case 'removed':
        for (const repo of repositories) {
          await this.database.removeRepositoryFromInstallation(
            installation.id,
            repo.name
          );
        }
        console.log(`Removed ${repositories.length} repositories from installation ${installation.id}`);
        break;
    }
  }

  private async handlePush(payload: WebhookEvent): Promise<void> {
    if (!payload.repository || !payload.installation) return;

    const { repository, installation } = payload;

    // Check if this is a push to a template repository
    const templateConfigs = await this.database.getTemplateConfigurations(repository.full_name);
    
    if (templateConfigs.length > 0) {
      console.log(`Template repository ${repository.full_name} was updated`);
      
      // Queue updates for all repositories using this template
      for (const config of templateConfigs) {
        await this.queueTemplateUpdate(
          installation.id,
          config.targetRepository,
          repository.full_name
        );
      }
    }
  }

  private async handleRepository(payload: WebhookEvent): Promise<void> {
    if (!payload.repository || !payload.installation) return;

    const { repository, installation } = payload;

    switch (payload.action) {
      case 'created':
        // Check if this repository should be auto-configured with templates
        const installationConfig = await this.database.getInstallationConfig(installation.id);
        if (installationConfig?.autoConfigureTemplates) {
          await this.autoConfigureRepository(installation.id, repository);
        }
        break;

      case 'deleted':
        await this.database.deleteRepositoryConfig(repository.full_name);
        break;
    }
  }

  private async handlePullRequest(payload: WebhookEvent): Promise<void> {
    if (!payload.repository || !payload.installation) return;

    // Handle PR events related to template updates
    // This could include auto-merging approved template updates
    console.log(`Pull request ${payload.action} in ${payload.repository.full_name}`);
  }

  private async queueTemplateUpdate(
    installationId: number,
    targetRepository: string,
    templateRepository: string
  ): Promise<void> {
    try {
      const client = new GitHubClient(this.appId, this.privateKey, installationId);
      const bootstrapper = new GitHubBootstrapper(client);

      // Get repository configuration
      const [owner, repo] = targetRepository.split('/');
      const templates = await bootstrapper.getRepositoryTemplates(owner, repo);

      // Find the template that was updated
      const templateConfig = templates.find(t => t.includes(templateRepository));
      if (!templateConfig) {
        console.log(`No template configuration found for ${templateRepository}`);
        return;
      }

      // Queue the update job
      await this.database.queueJob({
        type: 'template_update',
        installationId,
        targetRepository,
        templateRepository,
        status: 'pending',
        createdAt: new Date()
      });

      console.log(`Queued template update for ${targetRepository} from ${templateRepository}`);
    } catch (error) {
      console.error(`Failed to queue template update: ${error}`);
    }
  }

  private async autoConfigureRepository(
    installationId: number,
    repository: { name: string; full_name: string; owner: { login: string } }
  ): Promise<void> {
    try {
      const client = new GitHubClient(this.appId, this.privateKey, installationId);
      const bootstrapper = new GitHubBootstrapper(client);

      // Get default templates for this installation
      const installationConfig = await this.database.getInstallationConfig(installationId);
      const defaultTemplates = installationConfig?.defaultTemplates || [];

      if (defaultTemplates.length > 0) {
        // Save default templates to the new repository
        await bootstrapper.saveRepositoryTemplates(
          repository.owner.login,
          repository.name,
          defaultTemplates
        );

        console.log(`Auto-configured ${repository.full_name} with ${defaultTemplates.length} templates`);
      }
    } catch (error) {
      console.error(`Failed to auto-configure repository: ${error}`);
    }
  }
}