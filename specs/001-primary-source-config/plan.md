# Implementation Plan: Primary Source Configuration (mergeStrategies)

**Branch**: `001-primary-source-config` | **Date**: 2025-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-primary-source-config/spec.md`

## Summary

Refactor primary source designation so it is part of each merge strategy rule. Users can specify a `primarySource` for any file pattern or built-in category (e.g., 'typescript', 'ci-workflows'). This enables fine-grained control and simplifies configuration.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode
**Primary Dependencies**: Node.js 20.x, Express.js, Octokit
**Storage**: SQLite (development)
**Testing**: Jest, npx ajv-cli for schema validation
**Target Platform**: GitHub App, CLI, Mobile (React Native)
**Project Type**: Multi-template repository weaver
**Performance Goals**: <10s for 1000 files
**Constraints**: Must validate template references before processing
**Scale/Scope**: 3+ templates, 8+ built-in categories, custom patterns

## Constitution Check

- All changes must follow project governance principles
- No implementation details in spec
- All requirements are testable and measurable

## Project Structure


### Documentation (this feature)

```text
specs/001-primary-source-config/
├── plan.md              # This file
├── spec.md              # Feature specification
├── schema-updates.md    # Schema change log
├── checklists/          # Requirement checklists
└── tasks.md             # Implementation tasks
```

src/

### Source Code (repository root)

```text
src/
├── types.ts             # Type definitions
├── template-manager.ts  # Merge strategy logic
├── cli.ts               # CLI entry point
├── ...
examples/
└── primary-source-weaver.json
schemas/
└── weaver.schema.json
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | N/A        | N/A                                 |

## Next Steps

1. Update TypeScript types in `src/types.ts` to match new mergeStrategies structure
2. Implement primary source resolution logic in merge strategy processing
3. Add CLI flag support (`--merge-strategy`)
4. Update PR description generation to show primary source decisions
5. Add validation for template references before processing
