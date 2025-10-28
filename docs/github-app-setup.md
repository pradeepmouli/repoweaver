# GitHub App Setup Guide

This guide walks you through setting up the RepoWeaver GitHub App for automatic template management.

## Prerequisites

- Node.js 20.x or later
- A GitHub account (personal or organization)
- Access to create GitHub Apps

## Step 1: Create a GitHub App

1. Go to your GitHub Settings:
   - **Personal account**: https://github.com/settings/apps
   - **Organization**: https://github.com/organizations/YOUR_ORG/settings/apps

2. Click "New GitHub App"

3. Fill in the basic information:
   - **GitHub App name**: `RepoWeaver` (or your preferred name)
   - **Homepage URL**: `https://your-domain.com` (or `http://localhost:3000` for development)
   - **Webhook URL**: `https://your-domain.com/webhooks/github` (or use ngrok for local development)
   - **Webhook secret**: Generate a secure random string (save this for later)

4. Set the following permissions:

   **Repository permissions:**
   - Contents: Read & Write
   - Metadata: Read-only
   - Pull requests: Read & Write
   - Webhooks: Read-only

   **Organization permissions (optional):**
   - Members: Read-only (if you want to use organization features)

5. Subscribe to events:
   - [x] Push
   - [x] Pull request
   - [x] Repository

6. Set "Where can this GitHub App be installed?":
   - Choose based on your needs (Any account, or Only on this account)

7. Click "Create GitHub App"

8. After creation, note down your **App ID**

9. Generate a private key:
   - Scroll to "Private keys" section
   - Click "Generate a private key"
   - Save the downloaded `.pem` file securely

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=/path/to/your/private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Session Configuration
SESSION_SECRET=generate_a_secure_random_string_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration (optional)
DATABASE_PATH=./data/repoweaver.db
```

### Generate secure secrets:

```bash
# For SESSION_SECRET and WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Initialize Database

```bash
npm run build
node dist/index.js
```

The database will be automatically created and initialized on first run.

## Step 5: Install the App

1. Go to your GitHub App settings page
2. Click "Install App" in the left sidebar
3. Choose the account/organization where you want to install
4. Select repositories:
   - **All repositories**, or
   - **Select repositories** (choose specific repos)
5. Click "Install"

## Step 6: Start Using RepoWeaver

1. Navigate to `http://localhost:3000` (or your domain)
2. Click "Get Started" and authorize with GitHub
3. Select a repository to configure
4. Add template repositories
5. Configure merge strategies and options
6. Save configuration

The app will now automatically:
- Create `.weaver.json` in your repository
- Watch for template changes via webhooks
- Create pull requests when templates are updated

## Development Setup with ngrok

For local development, you'll need to expose your local server to receive webhooks:

1. Install ngrok: https://ngrok.com/download

2. Start ngrok:
   ```bash
   ngrok http 3000
   ```

3. Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok.io`)

4. Update your GitHub App webhook URL to:
   ```
   https://abc123.ngrok.io/webhooks/github
   ```

5. Start your local server:
   ```bash
   npm run dev
   ```

## Production Deployment

### Recommended hosting platforms:

- **Railway**: https://railway.app
- **Render**: https://render.com
- **Fly.io**: https://fly.io
- **Heroku**: https://heroku.com

### Deployment checklist:

- [ ] Set all environment variables in your hosting platform
- [ ] Upload the private key file securely
- [ ] Update webhook URL to production domain
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure logging/monitoring
- [ ] Test webhook delivery

### Example deployment (Railway):

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and create project:
   ```bash
   railway login
   railway init
   ```

3. Set environment variables:
   ```bash
   railway variables set GITHUB_APP_ID=123456
   railway variables set SESSION_SECRET=your_secret_here
   # ... set other variables
   ```

4. Upload private key as a file or encode it:
   ```bash
   # Option 1: Set as base64 encoded string
   cat private-key.pem | base64 | railway variables set GITHUB_PRIVATE_KEY_BASE64
   
   # Then update code to decode it
   ```

5. Deploy:
   ```bash
   railway up
   ```

## Troubleshooting

### Webhooks not being received

1. Check webhook deliveries in GitHub App settings
2. Verify webhook URL is accessible
3. Check webhook secret matches your environment variable
4. Review server logs for errors

### Database locked errors

- Increase `busy_timeout` in database.ts if needed
- Consider using PostgreSQL for high-traffic deployments

### Rate limiting

- The app automatically handles GitHub rate limits with retry logic
- Monitor rate limit status in logs
- Consider requesting a higher rate limit for production apps

### Session issues

- Ensure SESSION_SECRET is set and consistent
- Check that cookies are enabled in browser
- Verify secure cookie settings match your HTTPS setup

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate keys periodically**
4. **Enable HTTPS** in production
5. **Restrict app permissions** to minimum required
6. **Monitor webhook deliveries** for suspicious activity
7. **Keep dependencies updated**: `npm audit fix`

## Support

For issues or questions:
- GitHub Issues: https://github.com/pradeepmouli/repoweaver/issues
- Documentation: https://github.com/pradeepmouli/repoweaver/blob/master/README.md
