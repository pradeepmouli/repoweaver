# Feature Specification: GitHub App for RepoWeaver

**Feature Branch**: `002-github-app`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "please create a GitHub app for repoweaver"

## Clarifications

### Session 2025-10-27

- Q: When a user configures multiple templates in the web UI, how should the configuration relationship with existing file-based config (`.weaver.json`) work? → A: Web UI configuration takes precedence and creates/updates the `.weaver.json` file; manual file edits are preserved until next UI change
- Q: When multiple template updates arrive within a short time window (as mentioned in edge cases), what specific batching strategy should be used? → A: Debounce updates with a 5-minute window; create a single PR with all accumulated changes
- Q: For data retention, how long should webhook events and background job records be kept in the database before cleanup? → A: Keep successful events for 30 days, failed events for 90 days for debugging
- Q: What is the maximum number of concurrent template processing jobs the system should support to balance responsiveness with resource consumption? → A: Maximum 5 concurrent jobs; additional jobs queue
- Q: When a user applies multiple templates to a repository through the web UI, what order should they be applied in? → A: User-specified order with drag-and-drop reordering in UI

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and Connect Repository (Priority: P1)

A developer wants to install the RepoWeaver GitHub App on their organization or personal account and connect it to repositories where they want to apply template weaving capabilities. This provides the foundation for all other GitHub App features.

**Why this priority**: This is the essential MVP functionality - without the ability to install and connect the app to repositories, no other features can function. It establishes the OAuth flow, permissions, and basic repository access that all subsequent features depend on.

**Independent Test**: Can be fully tested by installing the app through GitHub's OAuth flow, selecting repositories to grant access to, and verifying that the app appears in the repository's Integrations settings with appropriate permissions.

**Acceptance Scenarios**:

1. **Given** a user visits the GitHub App installation page, **When** they click "Install", **Then** they are redirected to GitHub OAuth authorization page with required permissions listed
2. **Given** a user authorizes the app, **When** they select repositories to grant access, **Then** the app is installed and appears in their account's Installed GitHub Apps list
3. **Given** the app is installed, **When** a user views a connected repository's settings, **Then** RepoWeaver appears in the Integrations section with active status
4. **Given** a user wants to revoke access, **When** they uninstall the app from GitHub settings, **Then** all webhooks are removed and the app no longer has access to repositories

---

### User Story 2 - Configure Templates via Web Interface (Priority: P2)

A developer wants to configure which templates to apply to their repository using a web-based interface instead of manually editing configuration files, making template management more accessible and user-friendly.

**Why this priority**: While configuration files work for technical users, a web UI significantly improves user experience and reduces errors. This is the primary value-add of having a GitHub App versus just the CLI tool - it makes template management accessible to non-technical team members and provides immediate feedback.

**Independent Test**: Can be tested by logging into the RepoWeaver web interface, selecting a repository, adding template URLs through form inputs, configuring merge strategies via dropdowns/checkboxes, and verifying that changes are saved and reflected in subsequent template applications.

**Acceptance Scenarios**:

1. **Given** a user logs into the RepoWeaver web interface, **When** they select a repository, **Then** they see the current template configuration or a setup wizard if none exists
2. **Given** a user is configuring templates, **When** they add template repository URLs and select merge strategies, **Then** the configuration is validated and saved to the repository's settings
3. **Given** a user has configured templates, **When** they view the configuration page, **Then** they see a list of active templates in user-specified order with drag-and-drop reordering, edit, and remove options
4. **Given** a user wants to use advanced features, **When** they expand advanced options, **Then** they can configure file exclusion patterns, primary sources, and merge strategy rules

---

### User Story 3 - Automatic Updates via Webhooks (Priority: P3)

A developer wants their repository to automatically receive updates when the template repositories change, without manual intervention, ensuring their project stays current with template improvements and security updates.

**Why this priority**: This is a key automation feature that provides ongoing value after initial setup, but the app can function without it. Users can still manually trigger updates, making this an enhancement rather than core functionality.

**Independent Test**: Can be tested by pushing a change to a template repository, verifying that the webhook triggers, and confirming that RepoWeaver creates a pull request in the dependent repository with the template changes.

**Acceptance Scenarios**:

1. **Given** a repository has templates configured with auto-update enabled, **When** a template repository receives a push, **Then** RepoWeaver receives a webhook notification
2. **Given** RepoWeaver receives a template update webhook, **When** it processes the update, **Then** it creates a pull request in the dependent repository with the template changes
3. **Given** multiple repositories use the same template, **When** the template is updated, **Then** pull requests are created in all dependent repositories (respecting rate limits)
4. **Given** a user wants to pause auto-updates, **When** they disable auto-update in settings, **Then** no pull requests are created for template changes until re-enabled

---

### User Story 4 - Manual Template Application via UI (Priority: P4)

A developer wants to manually trigger template application or updates through the web interface when they want control over timing (e.g., before a release or after testing in a staging environment).

**Why this priority**: This provides user control and is useful for coordinating updates with development cycles, but auto-updates (P3) can handle most scenarios. This is a convenience feature for users who want more control.

**Independent Test**: Can be tested by clicking a "Apply Templates" or "Update from Templates" button in the web interface and verifying that a pull request is created with the expected template changes.

**Acceptance Scenarios**:

1. **Given** a user is viewing their repository in the RepoWeaver UI, **When** they click "Apply Templates Now", **Then** template processing begins and shows progress
2. **Given** template application is in progress, **When** processing completes, **Then** a pull request is created and the user is notified with a link
3. **Given** a user wants to preview changes, **When** they select "Preview Changes" before applying, **Then** they see a summary of files that will be added, modified, or skipped
4. **Given** template application fails, **When** an error occurs, **Then** the user sees a clear error message with troubleshooting guidance

---

### Edge Cases

- What happens when the user doesn't grant all required permissions during installation?
  - App should clearly communicate which permissions are missing and why they're needed, with option to reconfigure
- What happens when a webhook delivery fails (network issues, app downtime)?
  - System should retry webhook deliveries with exponential backoff and log failures for debugging
- What happens when rate limits are hit (many repositories updating simultaneously)?
  - System should queue updates and process them sequentially with a maximum of 5 concurrent jobs, showing queue status in the UI
- What happens when a template repository is deleted or made private?
  - System should detect this, mark the template as unavailable in configuration, and notify repository admins
- What happens when a user's GitHub App installation is suspended or revoked?
  - System should gracefully handle authentication failures and remove webhooks
- What happens when multiple template updates arrive within minutes?
  - System should debounce updates with a 5-minute window and create a single PR with all accumulated changes to avoid PR spam
- What happens when the app creates a PR but the repository doesn't allow PR creation?
  - System should log the attempt and notify the user that direct push or PR permissions are needed

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a GitHub App installation flow following GitHub's OAuth authorization process
- **FR-002**: System MUST request and store only necessary GitHub permissions: repository contents (read/write), pull requests (read/write), webhooks (read/write), and repository metadata (read)
- **FR-003**: System MUST allow users to select which repositories to grant access to during installation (all repositories or selected repositories)
- **FR-004**: System MUST provide a web-based interface for authenticated users to view and manage their connected repositories
- **FR-005**: System MUST allow users to configure template repositories for each connected repository through the web UI
- **FR-005a**: System MUST write web UI configuration changes to the repository's `.weaver.json` file, making the configuration portable and compatible with CLI tool
- **FR-005b**: System MUST allow users to specify and reorder template application order through drag-and-drop interface, preserving order in configuration
- **FR-006**: System MUST validate template repository URLs and verify accessibility before saving configuration
- **FR-007**: System MUST store repository configurations securely with encryption for sensitive data (access tokens)
- **FR-008**: System MUST register webhooks for push events on template repositories when auto-update is enabled
- **FR-009**: System MUST process webhook events and create pull requests in dependent repositories when templates change
- **FR-009a**: System MUST debounce template update webhooks with a 5-minute window to batch rapid successive changes into a single pull request
- **FR-010**: System MUST include detailed pull request descriptions showing which files came from which templates and what changed
- **FR-011**: System MUST allow users to manually trigger template application through the web interface
- **FR-012**: System MUST handle webhook retries and failures gracefully with appropriate logging
- **FR-012a**: System MUST retain successful webhook events and background jobs for 30 days and failed ones for 90 days before cleanup
- **FR-013**: System MUST respect GitHub API rate limits and implement backoff strategies
- **FR-013a**: System MUST limit concurrent template processing jobs to a maximum of 5, queuing additional jobs for sequential processing
- **FR-014**: System MUST support uninstallation and clean up all webhooks and stored data when the app is removed
- **FR-015**: System MUST display installation and configuration status clearly in the web UI
- **FR-016**: System MUST handle both organization and personal account installations
- **FR-017**: System MUST work with both public and private repositories (within permission scope)
- **FR-018**: System MUST create pull requests instead of direct commits to allow review before merging
- **FR-019**: System MUST support the same merge strategies available in the CLI (overwrite, merge, skip, file-pattern-based)
- **FR-020**: System MUST allow users to configure file exclusion patterns through the web UI

### Key Entities

- **GitHubApp Installation**: Represents an installation of the RepoWeaver GitHub App on a user account or organization, storing installation ID, account type, and installed repositories
- **Repository Configuration**: Stores template configuration for each connected repository, including template URLs, merge strategies, exclusion patterns, and auto-update settings
- **Webhook Event**: Records incoming webhook events from GitHub for audit and retry purposes, including event type, payload, processing status, and timestamps; retained for 30 days (successful) or 90 days (failed)
- **Pull Request Record**: Tracks pull requests created by the app, linking them to template updates and configurations for history and debugging
- **User Session**: Manages authenticated user sessions with GitHub OAuth tokens and permissions
- **Background Job**: Represents asynchronous tasks like template processing and PR creation, with status tracking and error handling; retained for 30 days (successful) or 90 days (failed); maximum 5 jobs execute concurrently with additional jobs queued

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can install the GitHub App and connect a repository in under 3 minutes
- **SC-002**: Configuration changes through the web UI are saved and applied within 5 seconds
- **SC-003**: Template updates trigger pull request creation within 2 minutes of webhook delivery (excluding queue time)
- **SC-004**: The web interface loads repository lists and configurations in under 2 seconds for users with up to 100 repositories
- **SC-005**: System successfully processes 95% of webhook events without manual intervention
- **SC-006**: Pull request descriptions include complete template attribution allowing users to verify changes in under 1 minute
- **SC-007**: Users can complete template configuration without reading documentation in 80% of cases (through intuitive UI)
- **SC-008**: System handles GitHub API rate limits without data loss or failed operations

## Assumptions

1. **GitHub Account Requirement**: Users must have GitHub accounts with appropriate permissions (admin or write) on repositories they want to connect
2. **Public GitHub**: The app targets GitHub.com, not GitHub Enterprise Server (that could be future enhancement)
3. **Hosting**: The GitHub App backend will be hosted as a web service with persistent storage (deployment details are implementation)
4. **Security**: OAuth tokens and sensitive data will be stored encrypted at rest
5. **Rate Limits**: Standard GitHub API rate limits apply (5000 requests/hour for authenticated apps)
6. **Pull Request Workflow**: All template applications create pull requests for review, not direct commits
7. **Repository Access**: Users grant read/write access to repository contents, enabling the app to create branches and PRs
8. **Webhook Delivery**: GitHub webhooks are generally reliable but may occasionally fail, requiring retry logic
9. **Browser Support**: Web interface supports modern browsers (Chrome, Firefox, Safari, Edge - last 2 versions)
10. **Internet Connectivity**: The app requires internet access to communicate with GitHub's APIs

## Dependencies

- GitHub OAuth App registration and credentials (client ID, client secret, webhook secret)
- GitHub REST API and GraphQL API for repository operations
- Webhook delivery infrastructure from GitHub
- Web server infrastructure for hosting the app interface and API
- Database for storing configurations, sessions, and job queue
- Existing CLI template processing logic (can be reused for backend processing)

## Out of Scope

- GitHub Enterprise Server support (focus on GitHub.com only)
- Integration with other Git hosting platforms (GitLab, Bitbucket)
- Custom merge strategy plugins through the UI (users can still use config files)
- Repository analytics or usage dashboards (future enhancement)
- Team permissions and role-based access control within the app (relies on GitHub's existing permissions)
- Mobile app version of the web interface
- Bulk operations across multiple repositories simultaneously
- Template marketplace or discovery features
- Scheduled template updates at specific times (only push-triggered or manual)
