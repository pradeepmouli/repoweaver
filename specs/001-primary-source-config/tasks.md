# Tasks: Primary Source Configuration (mergeStrategies)

**Feature Name**: Primary Source Configuration (mergeStrategies)
**Feature Directory**: specs/001-primary-source-config
**Spec Reference**: spec.md
**Plan Reference**: plan.md

---

## Phase 1: Setup

- [x] T001 Create feature directory structure per plan.md
- [x] T002 Initialize tasks.md in specs/001-primary-source-config/tasks.md

## Phase 2: Foundational Tasks

- [x] T003 Refactor TypeScript types for mergeStrategies in src/types.ts
- [x] T004 Update schema to support category and primarySource in schemas/weaver.schema.json
- [x] T005 Update example config for primary source in examples/primary-source-weaver.json

## Phase 3: User Story 1 (P1) - Configure Single Template as Authoritative Source

- [x] T006 [P] [US1] Implement primary source resolution logic in src/template-manager.ts
- [x] T007 [US1] Add validation for template references in src/config-loader.ts
- [x] T008 [US1] Add warning logic for missing files in primary source in src/template-manager.ts
- [x] T009 [US1] Update CLI to support primary source config in src/cli.ts
- [x] T010 [US1] Add test for single template authoritative source in test/template-manager.test.ts

## Phase 4: User Story 2 (P2) - Use Schema-Defined Canonical List

- [x] T011 [P] [US2] Implement category-based primary source logic in src/template-manager.ts
- [x] T012 [US2] Add test for canonical list category in test/template-manager.test.ts
- [x] T013 [US2] Update documentation for canonical categories in docs/merge-strategies.md

## Phase 5: User Story 3 (P3) - Override Primary Source per Repository

- [x] T014 [P] [US3] Implement per-repository primary source override in src/template-manager.ts
- [x] T015 [US3] Add CLI flag for primary source override in src/cli.ts
- [x] T016 [US3] Add test for repository-specific override in test/template-manager.test.ts

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T017 Update PR description generation to include primary source decisions in src/github-bootstrapper.ts
- [x] T018 Update schema-updates.md and docs/merge-strategies.md for final documentation
- [x] T019 Validate all template references and error handling in src/config-loader.ts

---

## Dependencies

- Foundational tasks (T003-T005) must be completed before user story phases
- User Story 1 (T006-T010) is MVP and must be completed before User Story 2 and 3
- User Story 2 (T011-T013) and User Story 3 (T014-T016) can be developed in parallel after MVP
- Polish phase (T017-T019) depends on completion of all user story phases

## Parallel Execution Examples

- T006, T011, T014 ([P] tasks) can be implemented in parallel after foundational tasks
- Tests (T010, T012, T016) can be written in parallel with implementation

## Implementation Strategy

- MVP: Complete User Story 1 (T006-T010)
- Incremental delivery: Add User Story 2 and 3, then polish

## Format Validation

- All tasks follow strict checklist format: `- [ ] Txxx [P] [USx] Description with file path`
- Each user story phase is independently testable
- Tests included for each user story

---

**Total Tasks**: 19
**Tasks per User Story**: US1: 5, US2: 3, US3: 3
**Parallel Opportunities**: 3 ([P] tasks)
**Independent Test Criteria**: Each user story has dedicated test tasks
**Suggested MVP Scope**: Complete User Story 1 (T006-T010)
