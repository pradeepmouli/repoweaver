# Implementation Plan: GitHub App for RepoWeaver

**Branch**: `002-github-app` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-github-app/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a GitHub App that enables RepoWeaver template weaving capabilities through GitHub's native integration, providing OAuth-based installation, web UI for template configuration, automatic webhook-triggered updates, and pull request creation for all template applications. The app extends the existing CLI tool by adding GitHub-first operations using Octokit API instead of local git cloning, while reusing the core template processing and merge strategy logic.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled  
**Primary Dependencies**: Express.js 4.x, Octokit (@octokit/rest ^20.x, @octokit/auth-app ^6.x), better-sqlite3 ^9.x, Commander.js ^11.x (existing CLI)  
**Storage**: SQLite for development/production (better-sqlite3), with schema for installations, repository_configs, webhook_events, background_jobs, user_sessions, pr_records  
**Testing**: Manual integration testing (constitutional requirement), TypeScript strict mode for compile-time validation  
**Target Platform**: Node.js 20.x LTS server (Linux/macOS), web browsers (Chrome, Firefox, Safari, Edge - last 2 versions for UI)
**Project Type**: Web application with backend API and frontend UI (extends existing single project structure)  
**Performance Goals**: <3 min installation flow (SC-001), <5 sec config save (SC-002), <2 min webhook-to-PR (SC-003), <2 sec UI load for 100 repos (SC-004)  
**Constraints**: 95% webhook success rate (SC-005), max 5 concurrent jobs (FR-013a), 5-min debounce window (FR-009a), 30/90 day data retention (FR-012a), GitHub API rate limit 5000 req/hr  
**Scale/Scope**: Support 100+ repositories per installation, unlimited installations, 5 concurrent template processing jobs, handle 10-100 webhook events per hour

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Research)

- ✅ **Principle I (Multi-Template Weaving)**: Feature preserves existing multi-template support; web UI adds configuration layer without changing core weaving logic
- ✅ **Principle II (Intelligent Merge Strategies)**: Reuses existing merge strategy registry; no changes to merge logic required
- ✅ **Principle III (GitHub-First Integration)**: PRIMARY FOCUS - implements GitHub App with OAuth, webhooks, and API-based operations as required
- ✅ **Principle IV (Pull Request Workflow)**: FR-018 mandates PR creation (non-negotiable requirement met)
- ✅ **Principle V (Type Safety & Code Quality)**: TypeScript 5.x strict mode, all new code follows existing ESLint rules, type-safe database interfaces
- ✅ **Principle VI (Extensibility Through Plugins)**: Feature does not modify plugin system; maintains compatibility
- ✅ **Principle VII (Configuration Flexibility)**: Web UI writes to `.weaver.json` (clarification answer 1), maintaining CLI compatibility and file-based config support

**Initial Gate Status**: ✅ PASS

### Post-Design Check (After Phase 1)

- ✅ **Principle I**: `github-template-manager.ts` processes templates in order specified by user (drag-and-drop UI), deterministic behavior maintained
- ✅ **Principle II**: All existing merge strategies in `merge-strategy-registry.ts` reused without modification, new code only adapts for in-memory processing
- ✅ **Principle III**: Architecture fully GitHub API-based:
  - Authentication via GitHub App Installation Tokens (Octokit)
  - Template fetching via GitHub Contents API (no local git cloning)
  - Configuration updates via GitHub Create/Update File API
  - PR creation via GitHub API
  - Webhook integration for push events
- ✅ **Principle IV**: Database schema enforces PR tracking (`pr_records` table), all template applications create PRs per FR-018, no direct commit capability
- ✅ **Principle V**: 
  - All new modules use TypeScript with explicit interfaces
  - Database operations use typed methods (no `any` types)
  - API contracts defined in OpenAPI spec for type generation
  - Encryption functions use proper TypeScript types
- ✅ **Principle VI**: Plugin system untouched; new GitHub-specific code in separate modules (`github-*.ts`), CLI and GitHub App can coexist
- ✅ **Principle VII**: 
  - Web UI updates create commits to `.weaver.json` (maintains file-based config)
  - Existing config-loader.ts reused for parsing
  - Variable substitution and TypeScript configs still supported
  - CLI remains fully functional alongside GitHub App

**Final Gate Status**: ✅ PASS - All principles upheld in design. No constitutional violations.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

## Project Structure

### Documentation (this feature)

```text
specs/002-github-app/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (technology decisions, patterns)
├── data-model.md        # Phase 1 output (database schema, entities)
├── quickstart.md        # Phase 1 output (setup guide for developers)
├── contracts/           # Phase 1 output (API contracts, webhook schemas)
│   ├── api.openapi.yaml       # REST API specification
│   ├── webhooks.schema.json   # GitHub webhook event schemas
│   └── database.schema.sql    # SQLite database schema
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app.ts                      # Express.js GitHub App server (NEW)
├── auth.ts                     # OAuth flow and session management (NEW)
├── database.ts                 # SQLite operations and migrations (NEW)
├── webhook-handler.ts          # GitHub webhook event processing (NEW)
├── github-client.ts            # Octokit wrapper for GitHub API (NEW)
├── github-bootstrapper.ts      # GitHub API-based template orchestration (NEW)
├── github-template-manager.ts  # In-memory template processing for GitHub (NEW)
├── bootstrapper.ts             # Existing CLI bootstrapper (legacy)
├── template-manager.ts         # Existing local file template manager
├── merge-strategy-registry.ts  # Existing merge strategies (REUSED)
├── config-loader.ts            # Existing config parsing (REUSED)
├── types.ts                    # Existing + new types for GitHub App
├── cli.ts                      # Existing CLI entry point (unchanged)
└── index.ts                    # Main export file

public/
├── index.html                  # Web UI home/dashboard (NEW)
├── app.js                      # Frontend JavaScript for UI (NEW)
├── styles.css                  # UI styling (NEW)
└── assets/                     # Static assets (NEW)

schemas/
├── weaver.schema.json          # Existing config schema (may extend)
└── github-app.schema.json      # GitHub App specific config schema (NEW)

docs/
├── merge-strategies.md         # Existing documentation
└── github-app-setup.md         # GitHub App setup guide (NEW)

examples/
├── weaver.json                 # Existing examples
└── github-app-config.json      # Example GitHub App config (NEW)
```

**Structure Decision**: Web application structure extending existing single-project layout. New GitHub App components live in `src/` alongside existing CLI code, with web UI served from `public/` directory. This maintains backward compatibility while adding GitHub-first capabilities. Existing merge strategy and config loading logic is reused without modification (Principle VI compliance).

## Complexity Tracking

**No constitutional violations detected** - this section intentionally left empty per template guidance.

