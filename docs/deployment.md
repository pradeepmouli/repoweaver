# Deployment Guide

This guide covers deploying RepoWeaver GitHub App to production.

## Prerequisites

Before deploying, ensure you have:

- [x] Created a GitHub App (see [github-app-setup.md](github-app-setup.md))
- [x] Generated a private key (.pem file)
- [x] Noted your App ID and webhook secret
- [x] Generated a secure session secret

## Quick Deploy Options

### Option 1: Railway (Recommended - Easiest)

**Why Railway?** Zero-config deployment, automatic HTTPS, built-in database backups, generous free tier.

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and initialize**:
   ```bash
   railway login
   railway init
   ```

3. **Set environment variables**:
   ```bash
   railway variables set GITHUB_APP_ID=YOUR_APP_ID
   railway variables set GITHUB_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
   railway variables set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   railway variables set NODE_ENV=production
   ```

4. **Upload private key** (choose one method):

   **Method A - As base64 string**:
   ```bash
   railway variables set GITHUB_PRIVATE_KEY=$(cat path/to/private-key.pem | base64)
   ```

   Then update `src/app.ts` to decode it:
   ```typescript
   // In app.ts, modify private key loading:
   const privateKey = process.env.GITHUB_PRIVATE_KEY
     ? Buffer.from(process.env.GITHUB_PRIVATE_KEY, 'base64').toString('utf-8')
     : fs.readFileSync(privateKeyPath, 'utf-8');
   ```

   **Method B - Upload as file** (use Railway dashboard):
   - Go to your project settings
   - Navigate to "Variables"
   - Upload the .pem file
   - Set `GITHUB_PRIVATE_KEY_PATH=/app/private-key.pem`

5. **Deploy**:
   ```bash
   railway up
   ```

6. **Get your deployment URL**:
   ```bash
   railway domain
   ```
   Output: `your-app.railway.app`

7. **Update GitHub App webhook URL**:
   - Go to your GitHub App settings
   - Update webhook URL to: `https://your-app.railway.app/webhooks/github`

8. **Done!** Visit `https://your-app.railway.app` to use your app.

**Railway Features**:
- ✅ Automatic HTTPS
- ✅ Automatic deployments on git push
- ✅ Database persistence
- ✅ Free tier: 500 hours/month
- ✅ Built-in metrics and logs

---

### Option 2: Render

**Why Render?** Great free tier, easy PostgreSQL integration, automatic SSL.

1. **Create a new Web Service** at [render.com](https://render.com)

2. **Connect your GitHub repository**

3. **Configure the service**:
   - **Name**: `repoweaver`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for production)

4. **Add environment variables** in Render dashboard:
   ```
   GITHUB_APP_ID=123456
   GITHUB_WEBHOOK_SECRET=your_secret
   SESSION_SECRET=your_session_secret
   NODE_ENV=production
   GITHUB_PRIVATE_KEY=<paste full PEM content here>
   ```

5. **Configure persistent storage**:
   - Add a disk mount at `/app/data`
   - Set `DATABASE_PATH=/app/data/repoweaver.db`

6. **Deploy** - Render will auto-deploy when you push to main branch

7. **Update webhook URL** to your Render URL: `https://repoweaver.onrender.com/webhooks/github`

**Render Features**:
- ✅ Free tier with 750 hours/month
- ✅ Auto-deploy from GitHub
- ✅ Easy PostgreSQL integration
- ✅ Custom domains

---

### Option 3: Fly.io

**Why Fly.io?** Global edge deployment, excellent performance, Docker-based.

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Create Dockerfile** in project root:
   ```dockerfile
   FROM node:20-alpine

   WORKDIR /app

   # Copy package files
   COPY package*.json ./

   # Install dependencies
   RUN npm ci --only=production

   # Copy source
   COPY . .

   # Build TypeScript
   RUN npm run build

   # Expose port
   EXPOSE 3000

   # Start app
   CMD ["npm", "start"]
   ```

4. **Create fly.toml**:
   ```toml
   app = "repoweaver"
   primary_region = "sjc"

   [build]
     dockerfile = "Dockerfile"

   [env]
     NODE_ENV = "production"
     PORT = "3000"

   [[services]]
     http_checks = []
     internal_port = 3000
     processes = ["app"]
     protocol = "tcp"

     [[services.ports]]
       force_https = true
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443

   [[services.tcp_checks]]
     grace_period = "10s"
     interval = "15s"
     restart_limit = 0
     timeout = "2s"

   [mounts]
     source = "data"
     destination = "/app/data"
   ```

5. **Launch app**:
   ```bash
   fly launch
   ```

6. **Set secrets**:
   ```bash
   fly secrets set GITHUB_APP_ID=123456
   fly secrets set GITHUB_WEBHOOK_SECRET=your_secret
   fly secrets set SESSION_SECRET=your_session_secret
   fly secrets set GITHUB_PRIVATE_KEY="$(cat private-key.pem)"
   ```

7. **Create volume for database**:
   ```bash
   fly volumes create data --size 1
   ```

8. **Deploy**:
   ```bash
   fly deploy
   ```

9. **Get your URL**:
   ```bash
   fly info
   ```

**Fly.io Features**:
- ✅ Global CDN
- ✅ Free tier: 3 shared-cpu VMs
- ✅ Persistent volumes
- ✅ Easy scaling

---

### Option 4: Self-Hosted (VPS/Docker)

**Why self-host?** Full control, use existing infrastructure.

#### Using Docker Compose

1. **Create docker-compose.yml**:
   ```yaml
   version: '3.8'

   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - GITHUB_APP_ID=${GITHUB_APP_ID}
         - GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
         - SESSION_SECRET=${SESSION_SECRET}
         - DATABASE_PATH=/app/data/repoweaver.db
       volumes:
         - ./data:/app/data
         - ./private-key.pem:/app/private-key.pem:ro
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
         interval: 30s
         timeout: 10s
         retries: 3
   ```

2. **Create .env file**:
   ```bash
   GITHUB_APP_ID=123456
   GITHUB_WEBHOOK_SECRET=your_secret
   SESSION_SECRET=your_session_secret
   GITHUB_PRIVATE_KEY_PATH=/app/private-key.pem
   ```

3. **Build and run**:
   ```bash
   docker-compose up -d
   ```

4. **Set up reverse proxy** (nginx/Caddy for HTTPS)

#### Using systemd (Linux server)

1. **Clone and build**:
   ```bash
   git clone https://github.com/your-org/repoweaver.git
   cd repoweaver
   npm install
   npm run build
   ```

2. **Create systemd service** `/etc/systemd/system/repoweaver.service`:
   ```ini
   [Unit]
   Description=RepoWeaver GitHub App
   After=network.target

   [Service]
   Type=simple
   User=node
   WorkingDirectory=/opt/repoweaver
   Environment="NODE_ENV=production"
   Environment="GITHUB_APP_ID=123456"
   Environment="GITHUB_PRIVATE_KEY_PATH=/opt/repoweaver/private-key.pem"
   Environment="GITHUB_WEBHOOK_SECRET=your_secret"
   Environment="SESSION_SECRET=your_session_secret"
   ExecStart=/usr/bin/node /opt/repoweaver/dist/index.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start**:
   ```bash
   sudo systemctl enable repoweaver
   sudo systemctl start repoweaver
   sudo systemctl status repoweaver
   ```

4. **Set up nginx reverse proxy**:
   ```nginx
   server {
       listen 80;
       server_name repoweaver.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Get SSL certificate**:
   ```bash
   sudo certbot --nginx -d repoweaver.yourdomain.com
   ```

---

## Post-Deployment Checklist

After deploying to any platform:

- [ ] **Test health endpoint**: Visit `https://your-domain.com/health`
- [ ] **Update GitHub App settings**:
  - [ ] Webhook URL: `https://your-domain.com/webhooks/github`
  - [ ] Homepage URL: `https://your-domain.com`
  - [ ] Callback URL: `https://your-domain.com/auth/github/callback`
- [ ] **Test OAuth flow**: Click "Get Started" on your app
- [ ] **Test webhook delivery**: Push to a template repo, check webhook deliveries
- [ ] **Set up monitoring**: Use platform metrics or external tools
- [ ] **Configure backups**: Set up database backup schedule
- [ ] **Set up alerts**: Monitor errors and health check failures

## Database Considerations

### SQLite (Default)

**Good for**:
- ✅ Small to medium deployments (< 100 repositories)
- ✅ Simple setup, no external dependencies
- ✅ File-based, easy backups

**Limitations**:
- ⚠️ Single writer at a time (though WAL mode helps)
- ⚠️ Not ideal for high-concurrency scenarios

**Backup strategy**:
```bash
# Simple backup script
sqlite3 /app/data/repoweaver.db ".backup '/app/backups/repoweaver-$(date +%Y%m%d).db'"
```

### PostgreSQL (For Scale)

If you need better concurrency or are deploying on Render/Heroku:

1. **Add PostgreSQL dependency**:
   ```bash
   npm install pg
   ```

2. **Update database.ts** to use PostgreSQL instead of SQLite

3. **Set DATABASE_URL** environment variable

4. **Migration**: Export SQLite → Import to PostgreSQL

---

## Monitoring & Logs

### Railway
```bash
railway logs
```

### Render
- View logs in dashboard
- Set up log drains to external services

### Fly.io
```bash
fly logs
```

### Self-hosted
```bash
# journalctl for systemd
sudo journalctl -u repoweaver -f

# Docker logs
docker-compose logs -f app
```

---

## Scaling Considerations

### Horizontal Scaling

If you need multiple instances:

1. **Use external database** (PostgreSQL/MySQL)
2. **Share session storage** (Redis)
3. **Coordinate background jobs** (use distributed queue like BullMQ)

### Vertical Scaling

For single instance:
- Increase `MAX_CONCURRENT_WORKERS` in app.ts
- Allocate more RAM/CPU to your instance
- Optimize database with indexes

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GITHUB_APP_ID` | Yes | Your GitHub App ID | `123456` |
| `GITHUB_PRIVATE_KEY_PATH` | Yes* | Path to private key | `/app/private-key.pem` |
| `GITHUB_PRIVATE_KEY` | Yes* | Base64 encoded key (alternative) | `LS0tLS...` |
| `GITHUB_WEBHOOK_SECRET` | Yes | Webhook signature secret | `abc123...` |
| `SESSION_SECRET` | Yes | Session encryption key | `def456...` |
| `NODE_ENV` | Yes | Environment | `production` |
| `PORT` | No | Server port | `3000` (default) |
| `DATABASE_PATH` | No | SQLite database path | `./data/repoweaver.db` |

*Either `GITHUB_PRIVATE_KEY_PATH` or `GITHUB_PRIVATE_KEY` is required, not both.

---

## Troubleshooting

### Webhooks not working
1. Check webhook deliveries in GitHub App settings
2. Verify webhook URL is publicly accessible
3. Check webhook secret matches
4. Review server logs for errors

### Database locked errors
- Increase `busy_timeout` in database.ts
- Consider switching to PostgreSQL
- Reduce concurrent operations

### Out of memory
- Reduce `MAX_CONCURRENT_WORKERS`
- Increase instance RAM
- Enable swap on VPS

### SSL/HTTPS issues
- Ensure platform provides automatic HTTPS
- For self-hosted, use Certbot/Let's Encrypt
- Check certificate expiration

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate keys regularly** - GitHub App private keys, webhook secrets
3. **Enable 2FA** on your GitHub account
4. **Monitor webhook deliveries** for unusual activity
5. **Keep dependencies updated**:
   ```bash
   npm audit
   npm update
   ```
6. **Use HTTPS only** in production
7. **Set secure cookie flags** (already configured)
8. **Implement rate limiting** if needed
9. **Review GitHub App permissions** periodically
10. **Set up error alerts** for monitoring

---

## Cost Estimates

| Platform | Free Tier | Paid (Small) | Features |
|----------|-----------|--------------|----------|
| Railway | 500 hrs/mo | $5/mo | Auto HTTPS, backups |
| Render | 750 hrs/mo | $7/mo | Free SSL, auto-deploy |
| Fly.io | 3 VMs free | $3-5/mo | Global edge, volumes |
| Heroku | Deprecated | $7/mo | Legacy option |
| Self-hosted | Variable | $5-10/mo | Full control |

**Recommendation**: Start with Railway free tier, upgrade as needed.

---

## Support & Updates

- **Documentation**: Check [README.md](../README.md)
- **Setup Guide**: See [github-app-setup.md](github-app-setup.md)
- **Issues**: Open on GitHub repository
- **Updates**: `git pull && npm install && npm run build && restart`

Happy deploying! 🚀
