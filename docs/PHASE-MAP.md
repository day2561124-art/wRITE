# Phase Map

## Phase 18B

| Phase | Name | Status |
| --- | --- | --- |
| 18B | Visual Library Rebuild Intake Preview | Read-only intake preview implemented |

- Scans an optional intake directory and proposes image metadata, categories,
  visual ids, target paths, duplicate groups, warnings, and risk.
- Missing intake directories return a successful empty preview.
- Does not write the visual index or assets, modify Canon or `active_engine.md`,
  create `canon_visual_lock`, or write to Approval Queue.
- Phase 18C may add import simulation and an explicit confirmation gate.

## Phase 17D

| Phase | Name | Status |
| --- | --- | --- |
| 17D | Canon Zones Preview | Read-only roundtrip preview implemented |

- Defines exact-heading Canon Zone candidates without splitting Canon data.
- Validates continuous coverage and reversible LF-normalized compilation.
- Adds no MCP tools and never modifies `active_engine.md`.

## Phase 17E

| Phase | Name | Status |
| --- | --- | --- |
| 17E | Entity Registry Preview | Read-only candidate extraction implemented |

- Extracts candidate entities (character, weapon, organization, location) from Canon Zones preview.
- Candidate IDs are stable, recomputable, and not canonical; no writes to Canon DB are performed.
- Preview is conservative and does not perform inference or automatic approvals.

## Phase 17F

| Phase | Name | Status |
| --- | --- | --- |
| 17F | Character & Weapon Intake | Candidate-only intake implemented |

- Receives explicit, marked-up candidate mentions for new characters and weapons.
- Produces intake candidates (`character_intake`, `weapon_intake`, `character_weapon_link_intake`) without writing to Canon DB or `active_engine.md`.
- Conservative extraction only: marker lines, explicit tables, or owner links. No inference from ordinary prose.
- Candidates are merged by `intake_id` with multiple `sources` preserved for review.

## Phase 17G

| Phase | Name | Status |
| --- | --- | --- |
| 17G | Settlement Completion Reminder | Read-only reminder preview implemented |

- Generates completion reminders for newly discovered entities in adopted chapters, settlement reports, or manual input.
- Read-only candidate-only output: does not create formal cards, does not modify `active_engine.md`, and does not write to Canon DB.

## Phase 17H

| Phase | Name | Status |
| --- | --- | --- |
| 17H | Visual Asset Registry Preview | Read-only visual asset registry preview implemented |

- Produces a read-only, candidate-only preview of visual assets extracted from explicit metadata or the visual index.
- Images are only treated as references or candidate references; they are never written into the Canon DB or `active_engine.md`.
- Does not create formal visual cards, patch candidates, or `canon_visual_lock` — all canonical changes require explicit human confirmation and subsequent phases (17I/17J).
- Relies on Phase 17E Entity Registry Preview for conservative entity matching and only creates link candidates when metadata explicitly marks entity ids or entity display names that uniquely match the registry.

## Phase 17I

| Phase | Name | Status |
| --- | --- | --- |
| 17I | Visual Link Approval Readiness Preview | Read-only approval readiness preview implemented |

- Consumes Phase 17H visual asset registry preview and evaluates link candidates for human approval readiness.
- Produces deterministic, read-only readiness items describing whether a visual asset's link candidate is ready for human review, needs more metadata, or is blocked (forbidden status, missing/ambiguous links).
- Does not create approval items, does not write to Approval Queue, does not create canon_visual_lock, and does not modify `active_engine.md` or `visual_index.jsonl`.

## Phase 17J

| Phase | Name | Status |
| --- | --- | --- |
| 17J | Visual Link Approval Queue Candidate Preview | Read-only queue-candidate preview implemented |

- Consumes Phase 17I readiness items and emits read-only queue candidate previews for human review.
- Does not write to Approval Queue, does not create approval items, does not create `canon_visual_lock`, and does not modify `active_engine.md` or `visual_index.jsonl`.
- All write-related flags are false; output is always candidate-only and deterministic.

## Phase 17K

| Phase | Name | Status |
| --- | --- | --- |
| 17K | Visual Link Approval Queue Import Dry Run | Read-only import-readiness preview implemented |

- Consumes Phase 17J queue candidate previews and validates import readiness without writing to Approval Queue or Canon DB.
- Produces deterministic `import_dry_run` items including `would_be_approval_item_preview`, `lineage`, `risk_summary`, and `confirmation_guard`.
- Does not write to Approval Queue, does not create approval items, does not create `canon_visual_lock`, and does not modify `active_engine.md` or `visual_index.jsonl`.

## Phase 17L

| Phase | Name | Status |
| --- | --- | --- |
| 17L | Visual Link Approval Queue Import Guard / UI Readiness Preview | Read-only guard and UI readiness preview implemented |

- Depends on Phase 17H / 17I / 17J / 17K and consumes Phase 17K import dry-run items.
- Produces deterministic guard decisions and UI-ready preview cards for manual review.
- Does not write to Approval Queue, create approval items, create `canon_visual_lock`, modify `active_engine.md` or `visual_index.jsonl`, or create UI/server routes.

## Phase 17M

| Phase | Name | Status |
| --- | --- | --- |
| 17M | Visual Link Final Acceptance Preview | Read-only final acceptance preview implemented |

- Final acceptance stage to run a consolidated read-only preview across Phase 17H..17L.
- Strictly a dry-run: does not write Approval Queue, does not create approval items, does not create `canon_visual_lock`, and does not modify `active_engine.md` or `visual_index.jsonl`.
- Produces acceptance summaries, safety and lineage summaries, and a CLI preview. Intended for final verification before any human approval writes.

## Phase 14C

| Phase | Name | Status |
| --- | --- | --- |
| 14C | Operator Approval Queue Bridge Readiness | Bridge requests are traceable and read-only validated |

- Bridge adoption requests include source, artifact lineage, protected hashes,
  denied capabilities, and human-review requirements.
- A read-only readiness report blocks missing artifacts, hash mismatches, or
  requests that are no longer pending.
- The report cannot approve, confirm adoption, activate, restore, or roll back.
- `active_engine.md` and `compressed_rules.md` remain protected.

## Phase 14B

| Phase | Name | Status |
| --- | --- | --- |
| 14B | ChatGPT Bridge End-to-End Dry Run | Deterministic guarded workflow verified |

- Exercises the Phase 14A bridge from workbench status through a pending
  adoption request using deterministic candidate and proof fixtures.
- Stops at the approval queue and never confirms adoption.
- Covers settlement context only through an isolated synthetic adopted-writing
  fixture that is removed after the run.
- Does not create a pending engine candidate or modify `active_engine.md` or
  `compressed_rules.md`.

## Phase 14A-Lite

| Phase | Name | Status |
| --- | --- | --- |
| 14A-Lite | ChatGPT MCP Bridge MVP | Implemented with guarded workflow facade |

- Exposes nine `chatgpt_bridge_*` tools over the existing writing workflow.
- Reads bounded current inputs and excludes active-engine text by default.
- Saves only candidate, proof, approval-request, context, and settlement-report
  artifacts through existing services.
- Cannot generate locally, call an external LLM, confirm adoption, approve,
  create a pending engine candidate, activate, restore, roll back, or clean up.
- Does not modify `active_engine.md` or `compressed_rules.md`.

## Phase 13D-Lite

| Phase | Name | Status |
| --- | --- | --- |
| 13D-Lite | Visual Gallery Thumbnail + Metadata Recovery | Safe thumbnails and metadata mapping |

- Serves thumbnails through a read-only asset API restricted to visual assets.
- Visual cards never use local project paths directly as image URLs.
- Reindex preserves existing metadata and labels filename/unknown records as fallback.
- Original metadata was not present in tracked history; manual recovery uses a JSON
  mapping script that updates only `visual_index.jsonl`.
- PNG assets remain ignored and are not versioned.

## Phase 13C-Lite

| Phase | Name | Status |
| --- | --- | --- |
| 13C-Lite | Operator UX Polish | Human-readable UI and read-only diagnostics |

- Adds localized workflow states, today's next step, progress guidance, text badges,
  empty states, and layered risk explanations.
- Adds read-only visual asset diagnostics and clearer optional neural trace status.
- Groups Approval Queue items by main-flow priority, optional work, and history.
- Does not add apply, approval confirm, restore execution, or rollback execution.
- Does not modify `active_engine` or `compressed_rules`.
- Visual asset reindex was completed in Phase 13B; this phase only improves display.

## Phase 13A-Lite

| Phase | Name | Status |
| --- | --- | --- |
| 13A-Lite | Feedback Learning UI Status Panel | Read-only UI/API status |

- Shows feedback items, digests, rule candidates, compressed rule proposals,
  applications, and pending `compressed_rule_update` approvals.
- The UI and API are read-only.
- The panel cannot apply `compressed_rules` or modify `active_engine`.
- Compressed rule updates still require the existing Approval Queue.
- Rollback/restore execution, MCP wrappers, and creative task integration are deferred.

| Phase | 名稱 | 狀態 |
| --- | --- | --- |
| 8A | Creative Task Orchestrator | 已完成 |
| 8B | GPT Writing Context Bundle | 已完成 |
| 8C | Chat Output Candidate Intake | 已完成 |
| 8D | Writing Candidate Proofing | 已完成 |
| 8E | Writing Candidate Adoption Request | 已完成 |
| 8F | Writing Candidate Adoption Confirm E2E | 已完成 |
| 8G | Adopted Writing Settlement Candidate | 已完成 |
| 8H | Pending Engine Candidate Review | 已完成 |
| 8I | Engine Activation Confirm E2E | 已完成 |
| 8J | Full Creative Workflow Final Smoke | 已完成 |
| 9A | Minimal Writer Workbench UI | 已完成 |
| 9B | Writer Workbench Status UI | 已完成 |
| 10A | Feedback Learning Loop | 已完成核心 service |
| 10B | Compressed Rule Update Confirm | 尚未實作 |
| 11A | Backup Export Workflow | 已完成 |
| 11B | Restore Execution | 尚未實作 |
| 12A | Docs & Daily Scripts | 本階段 |

## 邊界

- Phase 8I 的 engine activation 必須由 approval confirmation 執行。
- Phase 11A 提供 backup、verify、export、restore preview 與 restore request。
- Phase 11A 的 restore request 是 approval-only，不執行 restore。
- Phase 10A 建立 feedback、digest、rule candidate、proposal、approval request 與
  context bundle，但不套用 rule。
- Phase 10B 尚未實作 compressed rule approval confirmation 與原子寫入。
- Phase 11B 目前不存在，不得宣稱可執行 restore。
