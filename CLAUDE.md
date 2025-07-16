# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RepoWeaver is a GitHub App that skillfully weaves multiple templates together to create and update repositories with intelligent merge strategies and automatic updates. It consists of three main components:

1. **GitHub App** (`src/`): Core TypeScript GitHub App with web interface
2. **CLI Tool** (`src/cli.ts`): Legacy CLI application (still supported)
3. **Mobile App** (`mobile/`): React Native/Expo companion app

## Development Commands

### GitHub App Commands

```bash
# Build the project
npm run build

# Run GitHub App in development mode
npm run dev

# Start the GitHub App (after building)
npm start

# Type checking
npm run typecheck

# Lint code
npm run lint
```

### CLI Tool Commands

```bash
# Build CLI tool
npm run cli:build

# Run CLI in development mode
npm run cli:dev
```

### Mobile App Commands

```bash
# Install mobile dependencies
npm run mobile:install

# Start Expo development server
npm run mobile:start

# Run on iOS simulator
npm run mobile:ios

# Run on Android emulator
npm run mobile:android

# Run on web
npm run mobile:web

# Build mobile app
npm run mobile:build
```

## Architecture Overview

### Core Components

**GitHub App Server** (`src/app.ts`):

- Express.js server handling webhooks and API requests
- OAuth authentication flow
- REST API endpoints for repository management
- Serves web interface from `public/` directory

**GitHub API Client** (`src/github-client.ts`):

- Wrapper around GitHub's REST API using Octokit
- Handles repository operations, file management, and PR creation
- Supports GitHub App authentication

**GitHub Bootstrapper** (`src/github-bootstrapper.ts`):

- Main orchestration class adapted for GitHub API
- Creates pull requests for template updates
- Handles multi-template repository bootstrapping

**GitHub Template Manager** (`src/github-template-manager.ts`):

- Processes templates using GitHub API instead of local cloning
- Implements intelligent merge strategies for different file types
- Creates branches and pull requests for updates

**Database Layer** (`src/database.ts`):

- SQLite database for storing app state
- Manages installations, user sessions, and repository configurations
- Job queue for background processing

**Webhook Handler** (`src/webhook-handler.ts`):

- Processes GitHub webhook events
- Handles installation lifecycle and template updates
- Queues background jobs for repository updates

**Authentication** (`src/auth.ts`):

- OAuth flow for GitHub authentication
- Middleware for API request authentication
- Session management

**CLI Entry Point** (`src/cli.ts`):

- Legacy CLI tool (still supported)
- Uses Commander.js for CLI argument parsing
- Supports `bootstrap` and `update` commands

**Type Definitions** (`src/types.ts`):

- Defines interfaces for TemplateRepository, BootstrapOptions, and result types
- Supports merge strategies: overwrite, merge, skip

### Mobile App Architecture

**State Management**: Uses Redux Toolkit with slices for:

- `projectsSlice.ts`: Project management state
- `templatesSlice.ts`: Template repository state
- `progressSlice.ts`: Progress tracking state

**Navigation**: React Navigation with stack and tab navigation (`AppNavigator.tsx`)

**Core Services**:

- `BootstrapperService.ts`: Interfaces with CLI functionality
- `useBootstrapper.ts`: React hook for bootstrapper operations

**Key Screens**:

- `HomeScreen.tsx`: Main dashboard
- `TemplatesScreen.tsx`: Template repository management
- `CreateProjectScreen.tsx`: New project creation
- `ProjectProgressScreen.tsx`: Progress tracking
- `SettingsScreen.tsx`: Configuration

## Key Features

- **GitHub App Integration**: Native GitHub integration with fine-grained permissions
- **Auto Updates**: Automatically responds to template repository changes via webhooks
- **Multi-template support**: Can apply multiple templates to a single project
- **Smart Merge Strategies**: Intelligent merging for JSON, Markdown, and package.json files
- **Pull Request Workflow**: All updates create pull requests for review
- **Template subdirectories**: Extract specific subdirectories from template repos
- **Exclude patterns**: Supports glob patterns for excluding files during template processing
- **Web Interface**: Easy-to-use web interface for configuration and management
- **Database Persistence**: Stores configurations and tracks installations
- **Background Jobs**: Queues template updates for processing
- **Cross-platform**: GitHub App works everywhere, mobile app supports iOS/Android/Web
- **Template Weaving**: Intelligently combines multiple templates into cohesive repositories

## File Processing Flow

### GitHub App Flow

1. Templates are fetched from GitHub API using repository contents endpoint
2. Files are processed in-memory without local cloning
3. `.git` directories are automatically excluded
4. Files are processed based on merge strategy with intelligent merging
5. Changes are committed to new branch and pull request is created
6. Multiple templates create individual PRs or summary PR

### CLI Flow (Legacy)

1. Templates are cloned to temporary directory (`.boots-strapper-temp`)
2. Files are copied recursively with exclude pattern filtering
3. `.git` directories are automatically excluded
4. Files are processed based on merge strategy
5. Temporary directories are cleaned up after processing

## Configuration Files

RepoWeaver supports multiple configuration approaches:

### **Configuration Files** (in order of precedence):

1. `weaver.json` - JSON configuration file
2. `.weaver.json` - Hidden JSON configuration file
3. `weaver.js` - JavaScript configuration file (dynamic)
4. `.weaver.js` - Hidden JavaScript configuration file

### **Ignore Files**:

1. `.weaverignore` - File patterns to exclude from template processing
2. `.weaverignore.txt` - Alternative ignore file format

### **Key Configuration Options**:

- **templates**: Array of template repositories (string URLs or objects)
- **mergeStrategy**: How to handle existing files (`merge`, `overwrite`, `skip`)
- **excludePatterns**: Glob patterns to exclude from processing
- **includePatterns**: Exceptions to exclude patterns (use `!` prefix)
- **autoUpdate**: Whether to automatically update from template changes
- **hooks**: Pre/post processing commands
- **variables**: Environment variable substitution with `${VAR_NAME}` syntax

### **Command Priority**:

Command line options always override configuration file settings

## Development Notes

- **GitHub App** is built with TypeScript, Express.js, and uses Octokit for GitHub API operations
- **Configuration Loading** uses `ConfigLoader` class to parse JSON and JavaScript config files
- **Database** uses SQLite for development with support for other databases in production
- **Authentication** uses GitHub OAuth flow with GitHub App authentication for API operations
- **CLI** is built with TypeScript and uses `simple-git` for git operations (legacy)
- **Mobile app** is built with React Native/Expo and uses React Navigation
- **Web interface** uses Bootstrap 5 with vanilla JavaScript
- All projects use ESLint for code quality and TypeScript for type safety
- The GitHub App can be run directly with `ts-node` for development
- Mobile app supports hot reload through Expo's development server
- Environment variables are required for GitHub App configuration
- Configuration files support variable substitution and dynamic JavaScript configs
