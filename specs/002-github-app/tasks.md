# Tasks: GitHub App for RepoWeaver

**Feature Name**: GitHub App Integration
**Feature Directory**: specs/002-github-app
**Spec Reference**: spec.md
**Plan Reference**: plan.md

---

## Phase 1: Setup

- [X] T001 Create feature branch 002-github-app if not exists
- [X] T002 Set up development environment per quickstart.md (ngrok, .env file)
- [X] T003 Install required npm packages: @octokit/rest, @octokit/auth-app, better-sqlite3, express, winston
- [X] T004 Create database migration script in src/database.ts using contracts/database.schema.sql
- [X] T005 Run initial database migration to create schema

## Phase 2: Foundational Tasks

- [X] T006 [P] Implement database layer in src/database.ts with typed methods for all tables
- [X] T007 [P] Implement encryption utilities in src/auth.ts (AES-256-GCM for token encryption)
- [X] T008 [P] Create TypeScript type definitions in src/types.ts for GitHub App entities (Installation, RepositoryConfig, WebhookEvent, BackgroundJob, PullRequestRecord, UserSession)
- [X] T009 [P] Implement Winston logger configuration in src/app.ts with structured JSON logging
- [X] T010 Implement GitHub API client wrapper in src/github-client.ts using Octokit with retry plugin
- [X] T011 Create Express.js server skeleton in src/app.ts with middleware (body-parser, cookie-parser, error handling)

## Phase 3: User Story 1 (P1) - Install and Connect Repository

**Goal**: Enable GitHub App installation and OAuth flow for repository access

**Independent Test**: Install app via OAuth, select repositories, verify installation in GitHub settings, check database has installation record

**Acceptance Criteria**:
- User can click "Install" and be redirected to GitHub OAuth page
- User can select repositories to grant access
- App appears in user's Installed GitHub Apps list
- Uninstalling removes all webhooks and data

### Implementation Tasks

- [X] T012 [P] [US1] Implement OAuth initiation endpoint GET /auth/github in src/auth.ts
- [X] T013 [P] [US1] Implement OAuth callback handler GET /auth/github/callback in src/auth.ts
- [X] T014 [US1] Implement session creation and cookie management in src/auth.ts
- [X] T015 [US1] Implement session validation middleware in src/auth.ts
- [X] T016 [P] [US1] Implement installation webhook handler for installation events in src/webhook-handler.ts
- [X] T017 [US1] Create database methods for installations table CRUD in src/database.ts
- [X] T018 [US1] Implement installation creation logic when webhook received in src/webhook-handler.ts
- [X] T019 [US1] Implement installation deletion/suspension logic in src/webhook-handler.ts
- [X] T020 [P] [US1] Create GET /api/installations endpoint in src/app.ts to list user installations
- [X] T021 [P] [US1] Create GET /api/repositories endpoint in src/app.ts to list accessible repositories
- [X] T022 [P] [US1] Create basic web UI home page in public/index.html with install button
- [X] T023 [US1] Implement logout endpoint POST /auth/logout in src/auth.ts

## Phase 4: User Story 2 (P2) - Configure Templates via Web Interface

**Goal**: Provide web UI for managing template configuration with validation

**Independent Test**: Log in, select repository, add templates via UI, verify .weaver.json updated in GitHub, test drag-and-drop reordering

**Acceptance Criteria**:
- User can view current template configuration or setup wizard
- User can add/edit/remove templates with validation
- User can drag-and-drop to reorder templates
- Changes saved to .weaver.json in repository

### Implementation Tasks

- [X] T024 [P] [US2] Create database methods for repository_configs table CRUD in src/database.ts
- [X] T025 [P] [US2] Implement GET /api/repositories/{repoId}/config endpoint in src/app.ts
- [X] T026 [P] [US2] Implement PUT /api/repositories/{repoId}/config endpoint in src/app.ts
- [X] T027 [US2] Implement configuration update to .weaver.json via GitHub API in src/github-client.ts
- [X] T028 [P] [US2] Implement POST /api/repositories/{repoId}/validate-template endpoint in src/app.ts
- [X] T029 [US2] Implement template URL validation logic in src/github-client.ts (check accessibility)
- [X] T030 [P] [US2] Create repository configuration UI page in public/app.js with form inputs
- [X] T031 [P] [US2] Implement drag-and-drop template reordering in public/app.js using SortableJS
- [X] T032 [US2] Add merge strategy selection UI components in public/app.js
- [X] T033 [US2] Add exclude patterns and advanced options UI in public/app.js
- [X] T034 [US2] Implement client-side validation for template URLs in public/app.js
- [X] T035 [US2] Add loading states and error messages to UI in public/app.js

## Phase 5: User Story 3 (P3) - Automatic Updates via Webhooks

**Goal**: Process push webhooks from template repositories and trigger PR creation

**Independent Test**: Push to template repo, verify webhook received, wait 5 min debounce, verify PR created in dependent repo

**Acceptance Criteria**:
- Push to template triggers webhook receipt
- Multiple pushes within 5 minutes batched into single PR
- PRs created in all dependent repositories
- Auto-update can be disabled per repository

### Implementation Tasks

- [X] T036 [P] [US3] Create database methods for webhook_events table CRUD in src/database.ts
- [X] T037 [P] [US3] Create database methods for background_jobs table CRUD in src/database.ts
- [X] T038 [P] [US3] Implement webhook signature validation in src/webhook-handler.ts
- [X] T039 [US3] Implement POST /webhooks/github endpoint in src/app.ts
- [X] T040 [US3] Implement push event handler in src/webhook-handler.ts
- [X] T041 [US3] Implement 5-minute debounce logic for push events in src/webhook-handler.ts
- [X] T042 [US3] Implement job queue enqueue logic in src/database.ts
- [X] T043 [P] [US3] Create background job worker pool in src/app.ts (max 5 concurrent workers)
- [X] T044 [US3] Implement job dequeue and processing loop in src/app.ts
- [X] T045 [US3] Create GitHub template manager in src/github-template-manager.ts for in-memory processing
- [X] T046 [US3] Implement template fetching via GitHub Contents API in src/github-template-manager.ts
- [X] T047 [US3] Adapt existing merge strategy logic for in-memory files in src/github-template-manager.ts
- [X] T048 [US3] Create GitHub bootstrapper in src/github-bootstrapper.ts for orchestration
- [X] T049 [US3] Implement branch creation via GitHub API in src/github-bootstrapper.ts
- [X] T050 [US3] Implement file commit via GitHub API in src/github-bootstrapper.ts
- [X] T051 [US3] Implement PR creation via GitHub API in src/github-bootstrapper.ts
- [X] T052 [US3] Create database methods for pr_records table CRUD in src/database.ts
- [X] T053 [US3] Implement PR record creation when PR opened in src/github-bootstrapper.ts
- [X] T054 [US3] Implement webhook registration for template repositories in src/github-client.ts
- [X] T055 [US3] Add auto-update toggle in repository config UI in public/app.js

## Phase 6: User Story 4 (P4) - Manual Template Application via UI

**Goal**: Allow manual triggering of template application with progress tracking

**Independent Test**: Click "Apply Templates", verify job queued, monitor progress, verify PR created

**Acceptance Criteria**:
- User can click "Apply Templates Now" button
- Progress displayed during processing
- PR link shown when complete
- Preview mode shows changes before applying
- Error messages shown on failure

### Implementation Tasks

- [x] T056 [P] [US4] Implement POST /api/repositories/{repoId}/apply-templates endpoint in src/app.ts
- [x] T057 [US4] Implement manual job enqueueing (bypass debounce) in src/database.ts
- [x] T058 [P] [US4] Implement GET /api/jobs/{jobId} status endpoint in src/app.ts
- [x] T059 [P] [US4] Implement GET /api/repositories/{repoId}/jobs endpoint in src/app.ts
- [x] T060 [US4] Implement preview mode (dry-run) in src/github-template-manager.ts
- [x] T061 [US4] Return file change summary for preview in src/github-template-manager.ts
- [x] T062 [P] [US4] Create "Apply Templates" button in repository UI in public/app.js
- [x] T063 [P] [US4] Implement progress polling using GET /api/jobs/{jobId} in public/app.js
- [x] T064 [US4] Add progress indicator UI component in public/app.js
- [x] T065 [US4] Implement preview dialog with file change summary in public/app.js
- [x] T066 [US4] Add error display and troubleshooting guidance in public/app.js
- [x] T067 [P] [US4] Implement GET /api/repositories/{repoId}/pull-requests endpoint in src/app.ts
- [x] T068 [US4] Display recent PRs in repository UI in public/app.js

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T069 Implement data retention cleanup job in src/app.ts (30/90 day policy)
- [x] T070 Schedule cleanup job to run daily in src/app.ts
- [x] T071 Implement rate limit monitoring and logging in src/github-client.ts
- [x] T072 Add comprehensive error logging for all API endpoints in src/app.ts
- [x] T073 Implement graceful shutdown handling for background workers in src/app.ts
- [x] T074 Add database connection pooling and busy timeout handling in src/database.ts
- [x] T075 Create GitHub App setup documentation in docs/github-app-setup.md
- [x] T076 Update main README.md with GitHub App installation instructions
- [x] T077 Add example configuration files in examples/github-app-config.json
- [x] T078 Implement health check endpoint GET /health in src/app.ts
- [x] T079 Add CSS styling to web UI in public/styles.css using Bootstrap 5
- [x] T080 Run type check npm run typecheck and fix all errors
- [x] T081 Run lint npm run lint and fix all issues
- [x] T082 Verify all user stories independently testable per acceptance criteria

---

## Dependencies

### User Story Completion Order

```text
Phase 1 (Setup) → Phase 2 (Foundational)
                        ↓
                  User Story 1 (P1) ← MUST complete first (MVP)
                        ↓
                  ┌─────┴─────┐
                  ↓           ↓
          User Story 2 (P2)  User Story 4 (P4) ← Can be parallel after US1
                  ↓
          User Story 3 (P3) ← Depends on US2 for config
                  ↓
            Final Phase (Polish)
```

**Blocking Dependencies**:
- Phase 2 must complete before any user story
- User Story 1 (P1) must complete before US2, US3, US4
- User Story 3 (P3) should come after US2 (needs config functionality)
- User Stories 2 and 4 can be developed in parallel after US1

### Parallel Execution Examples

**Within User Story 1**:
- T012 (OAuth initiation) || T016 (webhook handler) || T020 (installations API) || T022 (web UI)
- T013 (OAuth callback) || T017 (database methods)

**Within User Story 2**:
- T024 (database) || T025 (GET config) || T026 (PUT config) || T028 (validate) || T030 (UI page) || T031 (drag-drop)

**Within User Story 3**:
- T036 (webhook db) || T037 (jobs db) || T038 (signature validation) || T043 (worker pool)
- T045, T046, T047 (template manager) can be developed independently
- T048, T049, T050, T051 (bootstrapper) can be developed independently

**Within User Story 4**:
- T056 (apply API) || T058 (job status) || T059 (jobs list) || T062 (button UI) || T063 (polling) || T067 (PRs API)

## Implementation Strategy

### MVP (Minimum Viable Product)

**Scope**: User Story 1 (P1) - Install and Connect Repository

**Tasks**: T001-T023 (23 tasks)

**Outcome**: Users can install the GitHub App, authenticate via OAuth, and see their connected repositories. This establishes the foundation for all other features.

**Why MVP**: Without installation and authentication, no other features can function. This provides immediate value by enabling GitHub App installation and lays groundwork for configuration and automation.

### Incremental Delivery

1. **Phase 1**: MVP (US1) - Get app installed and working
2. **Phase 2**: Add configuration UI (US2) - Enable template management
3. **Phase 3**: Add automation (US3) - Webhook-driven updates
4. **Phase 4**: Add manual control (US4) - User-triggered updates
5. **Phase 5**: Polish and production-ready (Final Phase)

---

## Format Validation

✅ All tasks follow strict checklist format: `- [ ] Txxx [P] [USx] Description with file path`

✅ Task IDs: T001-T082 (82 tasks total)

✅ Story labels: [US1], [US2], [US3], [US4] applied to user story phases

✅ [P] markers: 39 parallelizable tasks identified

✅ File paths: All tasks include specific file paths in description

✅ Independent test criteria: Each user story phase includes test description

---

**Total Tasks**: 82

**Tasks per User Story**:
- Setup: 5 tasks
- Foundational: 6 tasks
- User Story 1 (P1): 12 tasks
- User Story 2 (P2): 12 tasks
- User Story 3 (P3): 20 tasks
- User Story 4 (P4): 13 tasks
- Polish: 14 tasks

**Parallel Opportunities**: 39 tasks marked with [P] can be executed concurrently

**Independent Test Criteria**: All 4 user stories have explicit test descriptions and acceptance criteria

**Suggested MVP Scope**: Complete User Story 1 (T001-T023) for functional GitHub App installation
