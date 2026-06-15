# Phase 21F Live Bridge Smoke Report

## Status

Result: PASSED

Phase 21F verified that ChatGPT can use the Writer Workbench live bridge through the connected MCP toolchain while preserving candidate-only and human-confirmation safety boundaries.

## Verified At

- Local project: E:\武裝學院的二三事
- Bridge phase reported by tool: phase_14a_lite
- Smoke phase label: Phase 21F live bridge smoke
- Report created manually after live bridge validation

## Protected File Status

- active_engine_modified: false
- compressed_rules_modified: false
- pending_engine_candidate_created: false
- adopted_chapter_created: false
- adoption_confirmed: false

## Protected Hashes

- active_engine sha256: d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb
- compressed_rules sha256: f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db

## Smoke Chain Verified

1. Read Workbench status
2. Read engine component status
3. Read current inputs
4. Build writing context
5. Save candidate dry run without sourceBundleId
6. Locate writing context bundle manually
7. Save candidate dry run with sourceBundleId
8. Save actual candidate-only artifact
9. Build proofing context from candidate
10. Save proof report dry run
11. Save actual proof report
12. Request adoption dry run
13. Create actual approval queue item
14. Read approval readiness report
15. Reject smoke approval item manually

## Main IDs

### Writing Context

- writing_context_id: gptctx_20260615-202342-f24df777
- source_bundle_id: gptctx_20260615-202342-f24df777

### Candidate

- candidate_id: writing_candidate_20260615-202601-425de3dd
- candidate_path: data/outputs/writing_candidates/writing_candidate_20260615-202601-425de3dd/candidate.md
- candidate_meta_path: data/outputs/writing_candidates/writing_candidate_20260615-202601-425de3dd/candidate.json
- candidate_hash: d0d71d2cf793e425c31dfef62a14e7e905a49b00577c21c78c0a86c439e4e65a
- canon_status: candidate_only
- adopted: false
- settled: false

### Proofing Context

- proofing_context_id: proofctx_20260615-202630-721de807

### Proof Report

- proof_report_id: proof_report_20260615-202927-45e6ca57
- proof_report_hash: dbd2481397bc3153ac4f080d958e366fdabb3a733b08e22d637a21cf5e5294a4
- verdict: needs_revision
- severity: P3

### Approval Item

- approval_item_id: approval_item_20260615-203053-f3111a0c
- final_status: rejected
- risk_level: medium
- action_type: adopt_writing_candidate
- target_id: writing_candidate_20260615-202601-425de3dd

## Safety Boundary Results

- ChatGPT could build writing context.
- ChatGPT could save candidate-only artifacts.
- ChatGPT could build proofing context.
- ChatGPT could save proof reports.
- ChatGPT could create approval queue item.
- ChatGPT could read readiness report.
- ChatGPT could not approve.
- ChatGPT could not confirm adoption.
- ChatGPT could not modify active_engine.
- ChatGPT could not modify compressed_rules.
- ChatGPT could not activate engine.
- ChatGPT could not rollback or restore.
- ChatGPT could not execute cleanup.

## Expected Warnings / Findings

### 1. build_writing_context response usability gap

The live bridge successfully created writing context records, but the ChatGPT-facing response did not expose the sourceBundleId directly. The operator had to inspect local files and identify:

- gptctx_20260615-202342-f24df777

Recommended follow-up:

- Add writing_context_id / source_bundle_id / context_bundle_path / context_for_chat_path to the tool response payload.

### 2. Entity registry query did not hit entities

The entity registry bridge parameters were accepted and enabled, but the smoke query returned no entities.

Smoke query:

- 朝日奈千夜 九逃 醫療後座 未成立邊界

Recommended follow-up:

- Inspect entity registry search behavior.
- Verify Chinese names and aliases.
- Verify category filtering.
- Verify index fields used by bridge search.

### 3. missing_required_neural_modules warning

save_candidate reported missing_required_neural_modules during smoke. It did not block candidate-only persistence, but it should be addressed before formal adoption / settlement readiness.

Recommended follow-up:

- Decide whether candidate-only creation may remain non-blocking.
- Ensure adoption readiness surfaces missing neural traces.
- Ensure formal adoption / settlement cannot pass without required neural module evidence where policy requires it.

### 4. Approval rejection was performed by manual JSON edit

The smoke approval item was manually marked rejected in item.json. This cleared the pending state, but may not append an approval_rejected audit event.

Recommended follow-up:

- Add low-risk approval reject/defer bridge tool.
- Ensure audit log records rejection/defer events.

## Phase 21F Conclusion

Phase 21F live bridge smoke passed. The live bridge is usable for candidate-only writing, proofing, approval request creation, and readiness inspection while preserving human-confirmation safety boundaries.

## Recommended Next Phase

Phase 21G: live bridge usability + entity registry hit quality + neural trace readiness.

Recommended Phase 21G tasks:

1. Expose sourceBundleId in build_writing_context response.
2. Fix or improve entity registry query hit quality.
3. Clarify and enforce missing_required_neural_modules handling.
4. Add approval reject/defer low-risk bridge tools.
5. Re-run live bridge smoke after fixes.
