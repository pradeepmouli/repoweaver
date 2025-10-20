# RepoWeaver

A GitHub App that skillfully weaves multiple templates together to create and update repositories with intelligent merge strategies and automatic updates.

## Features

- 🚀 **GitHub App Integration**: Native GitHub integration with OAuth authentication
- 🔄 **Auto Updates**: Automatically update repositories when templates change
- 🎯 **Multi-Template Support**: Apply multiple templates to a single repository
- 🌿 **Template Branch Support**: Use specific branches or subdirectories from templates
- 🔧 **Advanced Merge Strategies**: File pattern-based strategies, custom implementations, and plugin system
- 🚫 **File Exclusion**: Flexible patterns to exclude files during template processing
- 📦 **Pull Request Workflow**: All updates create pull requests for review
- 🔐 **Secure**: Uses GitHub App authentication with fine-grained permissions
- 🌐 **Web Interface**: Easy-to-use web interface for configuration and management

## Installation & Setup

### As a GitHub App

1. **Install the GitHub App** (coming soon - will be available in GitHub Marketplace)
2. **Configure permissions** for your repositories
3. **Access the web interface** at your app installation URL

### Self-Hosted Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-org/repoweaver.git
   cd repoweaver
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your GitHub App credentials
   ```

4. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

### CLI Usage (Legacy)

The original CLI tool is still available:

```bash
# Install globally
npm install -g repoweaver

# Or run directly with npx
npx repoweaver --help
```

## Usage

### Configuration Files

RepoWeaver supports configuration files to make template management easier:

#### `weaver.json` (or `.weaver.json`)

```json
{
	"name": "my-awesome-project",
	"description": "A project created with RepoWeaver",
	"templates": [
		"https://github.com/user/frontend-template.git",
		{
			"url": "https://github.com/user/backend-template.git",
			"name": "backend",
			"branch": "main",
			"subDirectory": "api"
		}
	],
	"mergeStrategy": "merge",
	"mergeStrategies": [
		{
			"patterns": ["package.json"],
			"strategy": { "type": "package-json" },
			"priority": 100
		},
		{
			"patterns": ["*.json"],
			"strategy": { "type": "json" },
			"priority": 90
		},
		{
			"patterns": ["*.md"],
			"strategy": { "type": "markdown" },
			"priority": 80
		},
		{
			"patterns": ["src/**/*.js", "src/**/*.ts"],
			"strategy": { "type": "overwrite" },
			"priority": 70
		}
	],
	"excludePatterns": ["*.log", "node_modules/**", ".env*"],
	"includePatterns": ["!.env.example"],
	"autoUpdate": true,
	"hooks": {
		"postBootstrap": ["npm install", "npm run build"]
	},
	"variables": {
		"PROJECT_NAME": "my-project",
		"AUTHOR_NAME": "John Doe"
	},
	"plugins": ["npm-merger"]
}
```

#### Categories and primary sources

- You can target built-in file groups using `category` instead of explicit `patterns` in `mergeStrategies`.
- Each rule can optionally set a `primarySource` to designate which template is authoritative for those files.

Example:

```json
{
	"mergeStrategies": [
		{ "category": "testing", "strategy": { "type": "skip" }, "priority": 210 },
		{ "category": "building", "strategy": { "type": "merge" }, "primarySource": "shared-config-template", "priority": 205 }
	]
}
```

Canonical lists for categories live in `schemas/category.schema.json`. Update that file to add or refine default patterns per category.

#### `.weaverignore`

```
# Dependencies
node_modules/
vendor/

# Build outputs
dist/
build/

# Environment files
.env
.env.local

# Include exceptions
!.env.example
!README.md
```

#### `.weaver.js` (Dynamic Configuration)

```javascript
module.exports = {
	name: process.env.PROJECT_NAME || 'my-project',
	templates: ['https://github.com/user/base-template.git', ...(process.env.NODE_ENV === 'production' ? ['https://github.com/user/prod-template.git'] : ['https://github.com/user/dev-template.git'])],
	mergeStrategy: 'merge',
	variables: {
		NODE_ENV: process.env.NODE_ENV,
		VERSION: require('./package.json').version,
	},
};
```

### Web Interface

1. **Login** with your GitHub account
2. **Select a repository** from your installation
3. **Configure templates** by adding GitHub repository URLs or upload a `weaver.json` file
4. **Choose merge strategy**: `merge`, `overwrite`, or `skip`
5. **Set exclude patterns** to skip certain files (or use `.weaverignore`)
6. **Bootstrap or update** your repository

### API Endpoints

The GitHub App provides REST API endpoints:

- `GET /api/repositories` - List accessible repositories
- `GET /api/repositories/:owner/:repo/config` - Get repository configuration
- `PUT /api/repositories/:owner/:repo/config` - Update repository configuration
- `POST /api/repositories/:owner/:repo/bootstrap` - Bootstrap repository
- `POST /api/repositories/:owner/:repo/update` - Update repository

### Webhook Integration

The app automatically responds to:

- **Repository pushes**: Updates dependent repositories when templates change
- **Installation events**: Manages app installation lifecycle
- **Pull request events**: Handles template update reviews

### CLI Usage

#### Initialize a new project

```bash
# Create sample configuration files
repoweaver init

# Or create just the config file
repoweaver init --config-only

# Or create just the ignore file
repoweaver init --ignore-only
```

#### Bootstrap a new repository

```bash
# Using configuration file
repoweaver bootstrap my-project ./my-project

# Using command line options (overrides config file)
repoweaver bootstrap my-project ./my-project \
  --template https://github.com/user/template1.git \
  --template https://github.com/user/template2.git \
  --git \
  --remote https://github.com/myuser/my-project.git
```

#### Update an existing repository

```bash
# Using configuration file
repoweaver update ./my-project

# Using command line options (overrides config file)
repoweaver update ./my-project \
  --template https://github.com/user/updated-template.git \
  --merge-strategy merge
```

## CLI Options

### Bootstrap Command

- `<name>` - Repository name
- `<path>` - Target path for the new repository
- `-t, --template <url>` - Template repository URL (can be used multiple times)
- `-b, --branch <branch>` - Template branch (default: main)
- `-s, --subdir <path>` - Use subdirectory from template
- `--git` - Initialize git repository
- `--remote <url>` - Add git remote origin
- `--exclude <pattern>` - Exclude patterns (can be used multiple times)
- `--merge-strategy <strategy>` - Merge strategy: overwrite|merge|skip (default: merge)

### Update Command

- `<path>` - Path to the existing repository
- `-t, --template <url>` - Template repository URL (can be used multiple times)
- `-b, --branch <branch>` - Template branch (default: main)
- `-s, --subdir <path>` - Use subdirectory from template
- `--exclude <pattern>` - Exclude patterns (can be used multiple times)
- `--merge-strategy <strategy>` - Merge strategy: overwrite|merge|skip (default: merge)

## Examples

### Simple bootstrap

```bash
repoweaver bootstrap my-app ./my-app \
  --template https://github.com/facebook/create-react-app.git \
  --git
```

### Multi-template setup

```bash
repoweaver bootstrap full-stack-app ./my-app \
  --template https://github.com/user/frontend-template.git \
  --template https://github.com/user/backend-template.git \
  --exclude "*.log" \
  --exclude "node_modules/**" \
  --git \
  --remote https://github.com/myuser/full-stack-app.git
```

### Using template subdirectories

```bash
repoweaver bootstrap docs-site ./docs \
  --template https://github.com/user/monorepo-template.git \
  --subdir docs \
  --branch develop
```

## Programmatic Usage

```typescript
import { Bootstrapper, BootstrapOptions } from 'repoweaver';

const bootstrapper = new Bootstrapper();

const options: BootstrapOptions = {
	targetPath: './my-project',
	templates: [
		{
			url: 'https://github.com/user/template.git',
			name: 'main-template',
			branch: 'main',
		},
	],
	repositoryName: 'my-project',
	initGit: true,
	addRemote: 'https://github.com/myuser/my-project.git',
};

const result = await bootstrapper.bootstrap(options);

if (result.success) {
	console.log(`✅ Repository created at: ${result.repositoryPath}`);
} else {
	console.error('❌ Bootstrap failed:', result.errors);
}
```

## Development

### GitHub App Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (GitHub App)
npm run dev

# Run CLI in development mode
npm run cli:dev

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Database
DATABASE_URL=sqlite:./app.db

# Server Configuration
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
```

### Database

The app uses SQLite for development and can be configured to use other databases in production. The database schema includes:

- **installations**: GitHub App installations
- **user_sessions**: User authentication sessions
- **repository_configs**: Repository template configurations
- **jobs**: Background job queue
- **template_configurations**: Template to repository mappings

### Mobile App Development

The React Native companion app is located in the `mobile/` directory:

```bash
# Install mobile dependencies
npm run mobile:install

# Start Expo development server
npm run mobile:start

# Run on iOS
npm run mobile:ios

# Run on Android
npm run mobile:android
```

## License

MIT
