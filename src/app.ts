import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { Database } from './database';
import { WebhookHandler } from './webhook-handler';
import { AuthManager, AuthenticatedRequest } from './auth';
import { GitHubClient } from './github-client';
import { GitHubBootstrapper } from './github-bootstrapper';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// Database setup
const database = new Database(process.env.DATABASE_URL || './app.db');

// Authentication setup
const authManager = new AuthManager(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  database
);

// Webhook handler setup
const webhookHandler = new WebhookHandler(
  process.env.GITHUB_WEBHOOK_SECRET!,
  process.env.GITHUB_APP_ID!,
  process.env.GITHUB_PRIVATE_KEY!,
  database
);

// Middleware
app.use(cors());
app.use(json());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes
app.get('/auth/login', (req, res) => {
  const state = req.query.state as string;
  const authUrl = authManager.getAuthorizationUrl(state);
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const user = await authManager.handleCallback(code as string, state as string);
    
    // In a real app, you'd set a session cookie or return a JWT
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatar_url: user.avatarUrl,
        has_installation: !!user.installationId
      }
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/auth/logout', authManager.authenticateMiddleware.bind(authManager), async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    await authManager.logout(req.user.id);
  }
  res.json({ success: true });
});

// API routes (require authentication)
app.use('/api', authManager.authenticateMiddleware.bind(authManager));
app.use('/api', authManager.requireInstallation.bind(authManager));

// Get user info
app.get('/api/user', (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

// Get repositories
app.get('/api/repositories', async (req: AuthenticatedRequest, res) => {
  try {
    const repositories = await authManager.getInstallationRepositories(req.user!.installationId!);
    res.json(repositories);
  } catch (error) {
    console.error('Failed to get repositories:', error);
    res.status(500).json({ error: 'Failed to get repositories' });
  }
});

// Get repository configuration
app.get('/api/repositories/:owner/:repo/config', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    
    const config = await database.getRepositoryConfig(req.user!.installationId!, repository);
    
    if (!config) {
      return res.json({
        repository,
        templates: [],
        mergeStrategy: 'merge',
        excludePatterns: [],
        autoUpdate: true
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Failed to get repository config:', error);
    res.status(500).json({ error: 'Failed to get repository configuration' });
  }
});

// Update repository configuration
app.put('/api/repositories/:owner/:repo/config', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    const { templates, mergeStrategy, excludePatterns, autoUpdate } = req.body;
    
    await database.saveRepositoryConfig({
      installationId: req.user!.installationId!,
      repository,
      templates,
      mergeStrategy,
      excludePatterns,
      autoUpdate,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update repository config:', error);
    res.status(500).json({ error: 'Failed to update repository configuration' });
  }
});

// Bootstrap repository
app.post('/api/repositories/:owner/:repo/bootstrap', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner, repo } = req.params;
    const { templates, mergeStrategy, excludePatterns, createRepository } = req.body;
    
    const client = new GitHubClient(
      process.env.GITHUB_APP_ID!,
      process.env.GITHUB_PRIVATE_KEY!,
      req.user!.installationId!
    );
    
    const bootstrapper = new GitHubBootstrapper(client);
    
    const result = await bootstrapper.bootstrap({
      targetOwner: owner,
      targetRepo: repo,
      templates,
      repositoryName: repo,
      mergeStrategy,
      excludePatterns,
      createRepository
    });
    
    res.json(result);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

// Update repository
app.post('/api/repositories/:owner/:repo/update', async (req: AuthenticatedRequest, res) => {
  try {
    const { owner, repo } = req.params;
    const { templates, mergeStrategy, excludePatterns } = req.body;
    
    const client = new GitHubClient(
      process.env.GITHUB_APP_ID!,
      process.env.GITHUB_PRIVATE_KEY!,
      req.user!.installationId!
    );
    
    const bootstrapper = new GitHubBootstrapper(client);
    
    const result = await bootstrapper.updateRepository({
      targetOwner: owner,
      targetRepo: repo,
      templates,
      repositoryName: repo,
      mergeStrategy,
      excludePatterns
    });
    
    res.json(result);
  } catch (error) {
    console.error('Update failed:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Get jobs
app.get('/api/jobs', async (req: AuthenticatedRequest, res) => {
  try {
    const jobs = await database.getQueuedJobs(50);
    res.json(jobs);
  } catch (error) {
    console.error('Failed to get jobs:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Webhook endpoint
app.post('/webhooks/github', webhookHandler.handleWebhook.bind(webhookHandler));

// Serve the web interface
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await database.initialize();
    console.log('Database initialized successfully');
    
    app.listen(port, () => {
      console.log(`🧵 RepoWeaver GitHub App running on port ${port}`);
      console.log(`📝 Webhook endpoint: http://localhost:${port}/webhooks/github`);
      console.log(`🔐 OAuth callback: http://localhost:${port}/auth/callback`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();