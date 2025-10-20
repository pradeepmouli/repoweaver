# Feature Specification: Primary Source Configuration

**Feature Branch**: `001-primary-source-config`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "add feature to configure primary source for specific files/paths, include canonical list in schema (e.g. tsconfig.json, AGENTS.md, .github/workflows, .gitignore, etc....)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Single Template as Authoritative Source (Priority: P1)

A developer wants to ensure that specific critical files (like tsconfig.json, .gitignore, or CI/CD workflows) always come from one designated template repository and are never overwritten by other templates, even when applying multiple templates.

**Why this priority**: This is the core MVP functionality. Without the ability to designate a primary source for specific files, users cannot prevent conflicts when multiple templates contain the same critical configuration files. This addresses the most common pain point in multi-template scenarios.

**Independent Test**: Can be fully tested by creating a weaver.json configuration that specifies a primary source for tsconfig.json, applying two templates that both contain tsconfig.json, and verifying that only the designated template's version is used.

**Acceptance Scenarios**:

1. **Given** a project with two templates (A and B) that both contain tsconfig.json, **When** user specifies template A as primary source for "tsconfig.json" in configuration, **Then** only template A's tsconfig.json is applied and template B's version is skipped
2. **Given** a primary source configuration for "*.json" patterns, **When** templates are applied, **Then** all JSON files come from the designated primary template
3. **Given** a primary source is specified for a file that only exists in non-primary templates, **When** templates are applied, **Then** system warns that primary source doesn't contain the file but still applies it from available templates

---

### User Story 2 - Use Schema-Defined Canonical List (Priority: P2)

A developer wants to use pre-defined best practice primary source configurations for common files (tsconfig.json, AGENTS.md, .github/workflows/*, .gitignore, etc.) without manually specifying each file pattern.

**Why this priority**: This provides user convenience and promotes best practices by codifying common patterns. Users can quickly adopt recommended configurations without learning all the file patterns that typically need primary source designation.

**Independent Test**: Can be tested by referencing a canonical list name (e.g., "typescript-config") in the configuration and verifying that the appropriate files (tsconfig.json, tsconfig.*.json) are automatically designated from the specified template.

**Acceptance Scenarios**:

1. **Given** user specifies `"primarySources": {"canonical": "typescript-config", "template": "base-template"}` in configuration, **When** templates are applied, **Then** all TypeScript configuration files use the designated template
2. **Given** multiple canonical lists are specified (e.g., "typescript-config", "ci-workflows"), **When** templates are applied, **Then** all files from all canonical lists respect their primary sources
3. **Given** user specifies both canonical list and custom file patterns, **When** templates are applied, **Then** both sets of patterns are honored with custom patterns taking precedence

---

### User Story 3 - Override Primary Source per Repository (Priority: P3)

A developer wants to override which template is the primary source for specific files on a per-repository basis, different from the default template order.

**Why this priority**: This provides flexibility for edge cases where a particular repository needs a different configuration than the standard template order would provide. It's lower priority because most users will be satisfied with P1 and P2.

**Independent Test**: Can be tested by having a global template order but specifying a different primary source for specific files in a repository's weaver.json, and verifying the repository-specific configuration takes precedence.

**Acceptance Scenarios**:

1. **Given** templates are ordered [A, B, C] globally, **When** repository specifies template C as primary source for .github/workflows/*, **Then** CI/CD workflows come from template C regardless of global order
2. **Given** a primary source configuration in weaver.json, **When** user provides --primary-source CLI flag during bootstrap, **Then** CLI flag overrides configuration file
3. **Given** primary source is specified for a directory pattern (.github/workflows/*), **When** templates are applied, **Then** all files in that directory come from the specified template

---

### Edge Cases

- What happens when the designated primary source template doesn't contain the specified file but other templates do?
  - System should warn but still apply the file from available templates
- What happens when multiple primary source rules conflict for the same file?
  - Most specific pattern wins (e.g., exact file path beats glob pattern)
- What happens when primary source is specified but the template doesn't exist?
  - System should error early with clear message before processing begins
- What happens when using `.weaverignore` to exclude a file that has a primary source designation?
  - Exclusion patterns take precedence - file is skipped entirely with a warning
- What happens during auto-updates when a primary source template changes?
  - Only changes from the designated primary source trigger updates for those files

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to designate a specific template as the primary source for individual files by exact path (e.g., "tsconfig.json")
- **FR-002**: System MUST allow users to designate a primary source using glob patterns (e.g., ".github/workflows/*", "*.json")
- **FR-003**: System MUST support a canonical list in the JSON schema containing common file patterns that typically need primary source designation (tsconfig.json, AGENTS.md, .github/workflows/*, .gitignore, package.json, .eslintrc.*, .prettierrc.*, README.md)
- **FR-004**: System MUST allow users to reference canonical lists by name in their configuration (e.g., "typescript-config", "ci-workflows", "documentation", "git-config")
- **FR-005**: System MUST skip files from non-primary templates when a primary source is designated for that file pattern
- **FR-006**: System MUST emit a warning when a designated primary source template doesn't contain the specified file
- **FR-007**: System MUST allow primary source configuration in weaver.json, .weaver.json, weaver.config.ts, and weaver.js configuration files
- **FR-008**: System MUST support primary source specification via CLI flags (e.g., --primary-source "tsconfig.json:base-template")
- **FR-009**: System MUST respect precedence: CLI flags > repository config file > default template order
- **FR-010**: System MUST use most specific pattern when multiple primary source rules apply to the same file (exact path > specific glob > general glob)
- **FR-011**: System MUST document primary source decisions in pull request descriptions (which files came from which template)
- **FR-012**: System MUST validate that referenced templates exist in the templates array before processing
- **FR-013**: System MUST support both template name and template index (0-based) when specifying primary sources

### Key Entities

- **PrimarySourceRule**: Represents a single primary source designation with file pattern(s) and designated template reference
- **CanonicalList**: Pre-defined named collection of file patterns for common scenarios (typescript-config, ci-workflows, documentation, git-config, etc.)
- **PrimarySourceConfiguration**: Collection of primary source rules for a repository, including canonical lists and custom patterns
- **TemplateReference**: Identifier for a template (by name, URL, or index in templates array)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can designate a primary source for critical configuration files in under 2 minutes of configuration time
- **SC-002**: System correctly applies primary source rules 100% of the time when templates conflict on specified files
- **SC-003**: Users can bootstrap a multi-template repository with primary sources configured without any manual file resolution in 95% of cases
- **SC-004**: Pull request descriptions clearly show which template provided each file, allowing users to verify primary source rules were applied correctly
- **SC-005**: System processes 1000 files with primary source rules applied in under 10 seconds
- **SC-006**: Configuration validation catches 100% of invalid template references before processing begins

## Configuration Schema Design *(informative - for planning reference)*

This section is informative and describes the intended configuration structure for planning purposes.

**Note**: The schema has been updated in `schemas/weaver.schema.json` to support primary source designation within each `mergeStrategies` rule. See `examples/primary-source-weaver.json` for a complete example.

### Built-in Categories (Schema-Defined)

The following categories are defined in the schema at `#/definitions/canonicalLists`:

```json
{
  "typescript": ["tsconfig.json", "tsconfig.*.json"],
  "ci-workflows": [".github/workflows/*", ".github/actions/*"],
  "documentation": ["README.md"],
  "agent-instructions": ["AGENTS.md",".github/instructions/*",".github/prompts/*"],
  "git": [".gitignore", ".gitattributes", ".git/hooks/*"],
  "code-quality": [".eslintrc.*", ".prettierrc.*", ".editorconfig"],
  "package-management": ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  "vscode-settings": [".vscode/*"]
}
```

### Configuration File Structure

The schema now supports a `mergeStrategies` array, where each rule can specify a `category` or a `patterns` array, a `strategy`, and an optional `primarySource`:

```json
{
  "mergeStrategies": [
    {
      "category": "typescript",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "patterns": [".env.example"],
      "strategy": { "type": "overwrite" },
      "primarySource": "backend-template"
    }
  ]
}
```

**Schema Location**: `schemas/weaver.schema.json`
**Example Configuration**: `examples/primary-source-weaver.json`

### Template Reference Formats

Templates can be referenced in three ways:

1. **By name**: `"base-template"` (matches the `name` property in templates array)
2. **By URL**: `"https://github.com/user/template.git"` (matches the `url` property)
3. **By index**: `0`, `1`, `2` (zero-based index in templates array)

### Priority System

- Any rule can specify a `priority` field (default: 100)
- Higher priority values take precedence when multiple rules match
- More specific patterns should have higher priority values
- Category-based rules use default priority (100)
- Exact file paths should have higher priority than glob patterns

### CLI Usage Examples

```bash
# Specify primary source via CLI
repoweaver bootstrap my-app ./my-app \
  --template base-template \
  --template frontend-template \
  --merge-strategy "category:typescript,primarySource:base-template" \
  --merge-strategy "patterns:.github/workflows/*,primarySource:base-template"

# Using categories
repoweaver bootstrap my-app ./my-app \
  --template base-template \
  --template frontend-template \
  --merge-strategy "category:typescript,primarySource:base-template" \
  --merge-strategy "category:ci-workflows,primarySource:base-template"
```

## Assumptions

1. **Template Naming**: Templates can be referenced by name (from templates array), URL, or zero-based index
2. **Pattern Matching**: Glob patterns follow standard glob syntax used elsewhere in RepoWeaver (consistent with excludePatterns)
3. **Default Behavior**: When no primary source is specified, first template in order wins (existing behavior preserved)
4. **Validation Timing**: Template references are validated before any file processing begins
5. **Auto-Update Behavior**: Auto-updates only trigger for files when their designated primary source template changes
6. **Exclusion Precedence**: `.weaverignore` patterns take precedence over primary source rules

## Dependencies

- Existing merge strategy system (primary source acts as a pre-merge filter)
- Configuration loader system (must support new primarySources field)
- JSON schema validation (must include canonical list definitions)
- Pull request description generation (must document primary source decisions)

## Out of Scope

- Dynamic primary source selection based on file content analysis
- Primary source designation for partial file content (line-level or section-level)
- Automatic conflict resolution between primary sources
- Primary source inheritance or cascading rules
- Template priority ordering beyond primary source designation
