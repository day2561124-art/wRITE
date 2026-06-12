# Phase 10A: Feedback Learning Loop

## Purpose

- Save structured feedback from user, proofing, settlement, rejection, candidate, UI, or
  manual sources.
- Build deterministic feedback digests and repeated-pattern summaries.
- Convert reviewed digests into rule candidates and compressed-rule update proposals.
- Create approval-only compressed rule update requests.
- Build feedback context bundles for external GPT writing or proofing workflows.

## Safety

- Feedback artifacts write only under `data/feedback_loop/`.
- Proposals record the current `compressed_rules.md` SHA256 but do not modify the file.
- Rule update requests create approval items only.
- Approval confirmation/application is deferred to Phase 10B.
- Active engine, compressed rules, writing card, and proofing card are not modified.
- No OpenAI API or external LLM API was added.

## Implementation

- Added feedback-loop paths to `project-paths.mjs`.
- Added `feedback-learning-service.mjs`.
- Added the `compressed_rule_update` approval action type without an execution handler.
- Added feedback item, digest, rule candidate, proposal, request, and context bundle artifacts.
- Extended the Phase 12A pre-commit guard to reject staged `data/feedback_loop/`.

## Deferred

- MCP wrapper and registry integration.
- Creative task orchestrator integration.
- Writer Workbench feedback panel and UI API.
- Compressed rule update confirmation, atomic write, backup, and rollback metadata.

## Tests

- Added `tests/feedback/feedback-learning-service.test.mjs`.
- Registered the service test in `tests/run-all.mjs`.
- Tests use an isolated fixture root and remove all runtime artifacts.

## Verification

- `npm.cmd test`: all tests passed
- Final `$LASTEXITCODE`: `0`
- Active engine SHA256:
  `D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB`
- Compressed rules SHA256:
  `04D090072759CE46C4E9D4020BD78AD00A6F8215FE9DB8AF66DE0F3C6183AFEA`
- Git status, staged area, feedback runtime, and protected-path diff checks passed.
