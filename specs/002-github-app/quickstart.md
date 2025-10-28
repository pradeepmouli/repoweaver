# Quickstart: GitHub App Development

**Feature**: GitHub App for RepoWeaver
**Audience**: Developers implementing the GitHub App integration
**Time to Complete**: 15-30 minutes for local setup

## Prerequisites

- Node.js 20.x LTS installed
- GitHub account for testing
- Git CLI installed
- Code editor (VS Code recommended)

## Setup Steps

### 1. Register GitHub App (Test Environment)

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App
2. Fill in the form:
   - **GitHub App name**: `RepoWeaver Dev - {your-username}`
   - **Homepage URL**: `http://localhost:3000`
   - **Webhook URL**: `https://{your-ngrok-url}/webhooks/github` (see step 2)
   - **Webhook secret**: Generate with `openssl rand -hex 32`
   - **Permissions**:
     - Repository contents: Read & write
     - Pull requests: Read & write
     - Webhooks: Read & write
     - Metadata: Read-only
   - **Subscribe to events**: Push, Installation, Installation repositories
   - **Where can this GitHub App be installed?**: Only on this account

3. After creation, note down:
   - App ID
   - Client ID
   - Generate and download private key (`.pem` file)
   - Client secret

### 2. Set Up Local Development Environment

```bash
# Clone repository
git clone https://github.com/pradeepmouli/repoweaver.git
cd repoweaver

# Checkout feature branch
git checkout 002-github-app

# Install dependencies
npm install

# Install ngrok for webhook testing
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3000
# Note the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### 3. Configure Environment Variables

Create `.env` file in repository root:

```env
# GitHub App Credentials
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_PRIVATE_KEY_PATH=./repoweaver-dev.private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Session & Encryption
SESSION_SECRET=generate_with_openssl_rand_hex_32
ENCRYPTION_KEY=generate_with_openssl_rand_hex_32

# Database
DATABASE_PATH=./data/repoweaver.db

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Public URL (for OAuth redirect)
PUBLIC_URL=https://abc123.ngrok.io
```

**Generate secrets**:

```bash
# Session secret
openssl rand -hex 32

# Encryption key
openssl rand -hex 32
```

### 4. Initialize Database

```bash
# Create data directory
mkdir -p data

# Run database migration
npm run db:migrate

# This will create SQLite database with schema from contracts/database.schema.sql
```

### 5. Start Development Server

```bash
# Run in development mode with auto-reload
npm run dev

# Server starts at http://localhost:3000
# Webhooks received at https://abc123.ngrok.io/webhooks/github
```

### 6. Install App on Test Repository

1. Go to `http://localhost:3000` in browser
2. Click "Install GitHub App"
3. Authorize the app
4. Select a test repository
5. Confirm installation

### 7. Test Basic Flow

1. **View repositories**: Navigate to `http://localhost:3000/repositories`
2. **Configure templates**: Click on a repository, add template URL
3. **Apply templates**: Click "Apply Templates Now"
4. **Check job status**: Monitor background job processing
5. **Verify PR created**: Check GitHub for pull request

### 8. Test Webhook Flow

1. Push a change to your template repository
2. Check server logs for webhook receipt:
   ```
   [info] Webhook received: push event from org/template-repo
   [info] Job queued: apply_templates for repo_id=123
   ```
3. Wait 5 minutes (debounce window)
4. Verify PR created in dependent repository

## Development Workflow

### File Structure

```text
src/
├── app.ts                 # Main Express server ← START HERE
├── auth.ts                # OAuth flow implementation
├── database.ts            # SQLite operations
├── webhook-handler.ts     # GitHub webhook processing
├── github-client.ts       # Octokit wrapper
├── github-bootstrapper.ts # Template orchestration
└── github-template-manager.ts  # In-memory template processing
```

### Key Endpoints

| Endpoint | Purpose | Test with |
|----------|---------|-----------|
| `GET /` | Home page | Browser: `http://localhost:3000` |
| `GET /auth/github` | Start OAuth | Browser: `http://localhost:3000/auth/github` |
| `GET /api/repositories` | List repos | `curl -H "Cookie: session=..." http://localhost:3000/api/repositories` |
| `POST /webhooks/github` | Webhook receiver | Trigger push event in GitHub |

### Testing Tools

**Manual Testing**:

```bash
# Test webhook signature validation
curl -X POST http://localhost:3000/webhooks/github \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "Content-Type: application/json" \
  -d '{"zen":"..."}'

# Test session authentication
curl http://localhost:3000/api/repositories \
  -H "Cookie: session=your_session_token"
```

**Database Inspection**:

```bash
# Open SQLite database
sqlite3 data/repoweaver.db

# Useful queries
SELECT * FROM installations;
SELECT * FROM repository_configs;
SELECT * FROM background_jobs WHERE status = 'pending';
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;
```

**Log Monitoring**:

```bash
# Watch logs in real-time
tail -f combined.log

# Filter errors only
tail -f error.log
```

## Common Issues & Solutions

### Issue: Webhook signature validation fails

**Symptom**: 401 Unauthorized on webhook endpoint

**Solution**: Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings

```typescript
// Debug signature calculation
const signature = crypto
  .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
  .update(JSON.stringify(req.body))
  .digest('hex');
console.log('Expected:', `sha256=${signature}`);
console.log('Received:', req.headers['x-hub-signature-256']);
```

### Issue: OAuth callback fails

**Symptom**: Redirect to callback URL returns error

**Solution**: Ensure `PUBLIC_URL` matches ngrok URL and is set in GitHub App settings

### Issue: Database locked errors

**Symptom**: `SQLITE_BUSY: database is locked`

**Solution**: SQLite doesn't handle high concurrency well. Ensure:

1. Only one writer at a time (use job queue)
2. Set `PRAGMA busy_timeout = 5000` in database.ts
3. Close database connections properly

### Issue: Rate limit exceeded

**Symptom**: GitHub API returns 403 with rate limit message

**Solution**:

```bash
# Check rate limit status
curl https://api.github.com/rate_limit \
  -H "Authorization: token $GITHUB_TOKEN"

# Wait until reset time or reduce API calls
```

## Next Steps

1. **Implement User Stories**: Follow tasks.md for phased implementation
2. **Write Tests**: Add integration tests for key flows
3. **UI Development**: Build web interface in `public/`
4. **Documentation**: Update README.md with setup instructions
5. **Deployment**: Configure production environment (separate guide)

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit.js](https://github.com/octokit/octokit.js)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [ngrok Documentation](https://ngrok.com/docs)

## Getting Help

- Check `specs/002-github-app/research.md` for technical decisions
- Review `specs/002-github-app/data-model.md` for database schema
- Consult `specs/002-github-app/contracts/` for API and webhook schemas
- See `AGENTS.md` for coding agent guidance

**Estimated setup time**: 15-30 minutes
**Ready to code**: After step 7 completes successfully
