<!--
SYNC IMPACT REPORT
==================
Version Change: TEMPLATE → 1.0.0
Modified Principles: All principles newly defined from template placeholders
Added Sections:
  - Core Principles (I-VII defined)
  - Architecture & Technology Stack
  - Quality & Development Workflow
  - Governance
Templates Status:
  ✅ plan-template.md - Reviewed, compatible with constitution structure
  ✅ spec-template.md - Reviewed, compatible with user story approach
  ✅ tasks-template.md - Reviewed, compatible with phased implementation
  ⚠️  No command templates found in .specify/templates/commands/ - may need creation
Follow-up TODOs:
  - Create .specify/templates/commands/ directory if command workflows are needed
  - Consider adding integration test examples aligned with Principle IV
-->

# RepoWeaver Constitution

## Core Principles

### I. Multi-Template Weaving

RepoWeaver MUST support combining multiple template repositories into a single cohesive project. This is the
foundational capability that defines the project's purpose.

- Templates MUST be independently processable and composable
- Each template MUST be applicable without breaking previously applied templates
- Template application order MUST be deterministic and configurable
- Template sources MUST support GitHub repositories with branch and subdirectory specifications

**Rationale**: The "weaving" metaphor embodies intelligent composition of multiple sources into unified output,
distinguishing this tool from simple template cloning systems.

### II. Intelligent Merge Strategies

File conflicts during template weaving MUST be resolved through intelligent, file-type-aware merge strategies.

- Built-in strategies MUST include: `overwrite`, `skip`, `merge`, `json`, `package-json`, `markdown`, `yaml`,
  `config`, and `code`
- Merge strategies MUST be assignable per file pattern using glob syntax
- Priority system MUST resolve strategy conflicts (higher priority wins)
- Custom merge strategies MUST be implementable via plugins or local implementations
- All merge operations MUST preserve semantic correctness of merged files

**Rationale**: Generic copy-paste destroys value in configuration files. Type-aware merging (e.g., deep object merge
for JSON, dependency consolidation for package.json) ensures templates compose correctly.

### III. GitHub-First Integration

RepoWeaver MUST operate as a first-class GitHub App with native webhook integration and OAuth authentication.

- GitHub App MUST respond to template repository push events for auto-updates
- All repository modifications MUST use GitHub API (no local git cloning for GitHub App operations)
- Authentication MUST support GitHub App installation tokens and OAuth user tokens
- CLI tool MAY use local git operations for backward compatibility

**Rationale**: Native GitHub integration enables automatic template propagation, fine-grained permissions, and
seamless user experience within the GitHub ecosystem.

### IV. Pull Request Workflow (NON-NEGOTIABLE)

All template updates and repository bootstrapping MUST create pull requests rather than direct commits.

- Template application MUST create a new branch with changes
- Pull request MUST include summary of files changed and templates applied
- Users MUST have opportunity to review before merging
- Auto-merge MUST NOT be default behavior
- Multiple templates MAY create individual PRs or summary PR (configurable)

**Rationale**: Direct commits bypass code review and can introduce breaking changes. PRs provide transparency,
enable discussion, and allow rollback. This is non-negotiable for production safety.

### V. Type Safety & Code Quality

TypeScript MUST be used throughout with strict type checking enabled.

- All public APIs MUST have explicit TypeScript interfaces
- `any` type usage MUST be justified in code comments or avoided
- ESLint MUST enforce code style and catch common errors
- Type checking MUST pass before merge (`npm run typecheck`)
- No TypeScript compilation errors MUST exist in main branch

**Rationale**: Type safety prevents runtime errors, improves IDE experience, and serves as living documentation.
Strict typing is essential for maintainability as the codebase scales.

### VI. Extensibility Through Plugins

The merge strategy system and template processing pipeline MUST support extensibility via plugins.

- Plugins MUST be loadable from npm packages or local files
- Plugin API MUST provide hooks for: custom merge strategies, pre/post processing, file transformations
- Plugins MUST NOT require core code modifications
- Plugin errors MUST NOT crash the application (graceful degradation)

**Rationale**: Users have domain-specific needs that core cannot anticipate. Plugin architecture enables
community contributions and custom enterprise workflows without forking.

### VII. Configuration Flexibility

Multiple configuration formats MUST be supported with clear precedence rules.

- Supported formats: `weaver.json`, `.weaver.json`, `weaver.config.ts`, `weaver.js`, `.weaver.js`
- TypeScript/JavaScript configs MUST support dynamic values and environment variables
- Command-line options MUST override configuration files
- Variable substitution syntax `${VAR_NAME}` MUST be supported
- `.weaverignore` and `.weaverignore.txt` MUST be respected

**Rationale**: Different projects have different needs. JSON for simplicity, TypeScript for type safety and
dynamic logic, CLI overrides for CI/CD integration.

## Architecture & Technology Stack

### Technology Requirements

- **Language**: TypeScript 5.x with strict mode enabled
- **Runtime**: Node.js LTS (currently 20.x)
- **Primary Framework**: Express.js for GitHub App web server
- **GitHub Integration**: Octokit (@octokit/rest, @octokit/auth-app)
- **CLI Framework**: Commander.js for argument parsing
- **Database**: SQLite for development, configurable for production (sqlite3 package)
- **Git Operations**: simple-git for CLI legacy operations (GitHub App uses API)
- **Mobile App**: React Native with Expo (separate mobile/ directory)

### Component Architecture

1. **GitHub App Server** (`src/app.ts`): Express server handling webhooks, OAuth, and web UI
2. **GitHub API Client** (`src/github-client.ts`): Octokit wrapper for repository operations
3. **GitHub Bootstrapper** (`src/github-bootstrapper.ts`): Orchestration for GitHub API-based template application
4. **Template Manager** (`src/github-template-manager.ts`): In-memory template processing and merge strategy execution
5. **Database Layer** (`src/database.ts`): SQLite persistence for installations, configs, jobs
6. **Webhook Handler** (`src/webhook-handler.ts`): GitHub event processing and job queuing
7. **CLI Entry Point** (`src/cli.ts`): Legacy CLI tool using local git operations
8. **Merge Strategy Registry** (`src/merge-strategy-registry.ts`): Strategy lookup and execution

### File Organization

- `src/` - Core TypeScript source code
- `public/` - Web interface static files (HTML, CSS, JS)
- `mobile/` - React Native Expo app with Redux Toolkit state management
- `docs/` - User-facing documentation (merge-strategies.md, etc.)
- `examples/` - Sample configuration files
- `schemas/` - JSON schema for configuration validation
- `.specify/` - Development workflow templates and constitution (this file)

## Quality & Development Workflow

### Code Quality Gates

All pull requests MUST pass these gates before merge:

1. **Type Check**: `npm run typecheck` must pass with zero errors
2. **Lint**: `npm run lint` must pass (ESLint with TypeScript rules)
3. **Build**: `npm run build` must complete successfully
4. **Mobile Build**: `npm run mobile:build` must succeed if mobile code changed

### Development Workflow

1. **Branch Strategy**: Feature branches from `main`, named descriptively (e.g., `feature/json-merge-strategy`)
2. **Commit Messages**: Follow conventional commits format (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
3. **Documentation**: Update relevant docs (README.md, docs/*.md) for user-facing changes
4. **Agent Guidance**: Maintain AGENTS.md with AI agent development guidance
5. **Configuration Changes**: Update schemas/weaver.schema.json when adding config options

### Testing Philosophy

While comprehensive automated tests are encouraged, the constitution prioritizes:

- **Manual Integration Testing**: Critical paths must be manually verified before release
- **Type Safety as Tests**: TypeScript strict mode catches many errors at compile time
- **Real-world Usage**: Examples should be executable and tested against real repositories
- **Future Test Framework**: Automated testing framework may be added (not currently enforced)

### Version Control

- **Git Required**: All development must use git version control
- **Commit Hygiene**: Commits should be atomic and well-described
- **No Secrets**: Never commit credentials, API keys, or .env files (use .env.example)
- **Ignore Patterns**: Standard .gitignore for node_modules, dist/, .env files

## Governance

### Amendment Process

This constitution may be amended through the following process:

1. **Proposal**: Create GitHub issue describing proposed amendment with rationale
2. **Discussion**: Allow minimum 48 hours for community/team feedback
3. **Implementation**: Update constitution.md with version bump
4. **Sync**: Update dependent templates in .specify/templates/ to reflect changes
5. **Merge**: Pull request must be approved by project maintainer

### Version Semantics

Constitution follows semantic versioning:

- **MAJOR**: Backward-incompatible governance changes or principle removals/redefinitions
- **MINOR**: New principle added or section materially expanded
- **PATCH**: Clarifications, wording improvements, typo fixes

### Compliance Verification

- All pull requests SHOULD reference relevant constitutional principles in description
- Code reviews SHOULD explicitly verify compliance with applicable principles
- Violations MUST be justified in PR description or constitution amendment proposed
- Maintainers MAY grant temporary exceptions with documented rationale and timeline for resolution

### Runtime Development Guidance

For AI agent development workflows, consult `AGENTS.md` which provides operational guidance without superseding
constitutional principles. When conflicts arise, constitution takes precedence.

**Version**: 1.0.0 | **Ratified**: 2025-10-20 | **Last Amended**: 2025-10-20
