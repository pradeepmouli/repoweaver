# Schema Updates for Primary Source Configuration

**Date**: 2025-10-20
**Feature**: 001-primary-source-config
**Updated Files**:

- `schemas/weaver.schema.json` - Added primarySources configuration
- `examples/primary-source-weaver.json` - Created example configuration

## Changes Made

### 1. Refactored Primary Source Configuration

Primary source designation is now part of each `mergeStrategies` rule. You can specify a `primarySource` property for any file pattern rule, and use either a `patterns` array or a built-in `category` (e.g., 'typescript', 'ci-workflows').

Example mergeStrategies configuration:

```json
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
  },
  {
    "category": "ci-workflows",
    "strategy": { "type": "merge" },
    "primarySource": "base-template"
  }
]
```

### 2. Built-in Categories Defined

The following built-in categories are available for file pattern matching:

| Category         | File Patterns                                      | Description                       |
|------------------|---------------------------------------------------|-----------------------------------|
| `typescript`     | `tsconfig.json`, `tsconfig.*.json`                | TypeScript configuration files    |
| `ci-workflows`   | `.github/workflows/*`, `.github/actions/*`        | CI/CD workflow and action files   |
| `documentation`  | `README.md`                                       | Documentation files               |
| `agent-instructions` | `AGENTS.md`, `.github/instructions/*`, `.github/prompts/*` | AI agent instruction files |
| `git`            | `.gitignore`, `.gitattributes`, `.git/hooks/*`    | Git configuration files           |
| `code-quality`   | `.eslintrc.*`, `.prettierrc.*`, `.editorconfig`   | Code quality tool configs         |
| `package-management` | `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | Package management files |
| `vscode-settings`| `.vscode/*`                                       | VS Code workspace settings        |

### 3. New Schema Definitions

**`filePatternMergeStrategy`**: Now supports:

- `patterns`: Array of glob patterns (optional)
- `category`: Name of built-in file pattern group (optional)
- `strategy`: Merge strategy config (required)
- `primarySource`: Template reference (optional)
- `priority`: Integer (optional, default: 100)

**`templateReference`**: Reference by name, URL, or index

### 4. Example Configuration

See `examples/primary-source-weaver.json` for a configuration using categories and primarySource:

```json
{
  "name": "my-fullstack-app",
  "templates": [
    { "url": "https://github.com/my-org/base-template.git", "name": "base-template", "branch": "main" },
    { "url": "https://github.com/my-org/frontend-template.git", "name": "frontend-template", "branch": "main" },
    { "url": "https://github.com/my-org/backend-template.git", "name": "backend-template", "branch": "main" }
  ],
  "mergeStrategies": [
    {
      "category": "typescript",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "category": "ci-workflows",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "category": "documentation",
      "strategy": { "type": "merge" },
      "primarySource": "frontend-template"
    },
    {
      "category": "agent-instructions",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "category": "git",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "category": "code-quality",
      "strategy": { "type": "merge" },
      "primarySource": "base-template"
    },
    {
      "patterns": ["src/**/*.test.ts", "tests/**/*.ts"],
      "strategy": { "type": "merge" },
      "primarySource": "base-template",
      "priority": 150
    },
    {
      "patterns": [".env.example"],
      "strategy": { "type": "overwrite" },
      "primarySource": "backend-template",
      "priority": 100
    },
    {
      "patterns": ["docs/**/*.md"],
      "strategy": { "type": "merge" },
      "primarySource": "frontend-template",
      "priority": 120
    }
  ],
  "mergeStrategy": "merge",
  "excludePatterns": ["node_modules/**", "dist/**", ".git/**"],
  "autoUpdate": true
}
```

## Schema Structure

```json
{
  "properties": {
    "mergeStrategies": {
      "type": "array",
      "items": { "$ref": "#/definitions/filePatternMergeStrategy" }
    }
  },
  "definitions": {
    "filePatternMergeStrategy": {
      "type": "object",
      "properties": {
        "patterns": { "type": "array", "items": { "type": "string" } },
        "category": { "type": "string", "enum": ["typescript", "ci-workflows", "documentation", "agent-instructions", "git", "code-quality", "package-management", "vscode-settings"] },
        "strategy": { "$ref": "#/definitions/mergeStrategyConfig" },
        "primarySource": { "$ref": "#/definitions/templateReference" },
        "priority": { "type": "integer", "default": 100 }
      },
      "oneOf": [ { "required": ["patterns"] }, { "required": ["category"] } ]
    },
    "templateReference": { ... }
  }
}
```

## Validation Status

- ✅ Schema JSON syntax valid
- ✅ Example configuration JSON syntax valid
- ✅ Schema structure conforms to JSON Schema draft-07
- ✅ All built-in categories from spec included
- ✅ Naming is simple and clear (e.g., 'category')

## Next Steps

1. Update TypeScript types in `src/types.ts` to match new mergeStrategies structure
2. Implement primary source resolution logic in merge strategy processing
3. Add CLI flag support (`--primary-source`)
4. Update PR description generation to show primary source decisions
5. Add validation for template references before processing
