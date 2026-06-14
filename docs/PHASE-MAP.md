# Phase Map

## Phase 19E

| Phase | Name | Status |
| --- | --- | --- |
| 19E | Visual Library Final End-to-End Safety Acceptance | Full-chain acceptance implemented |

- Accepts the Phase 18B through Phase 19D visual-library chain through one
  consolidated formal-baseline, preview, sandbox, UI, and bridge report.
- Confirmed import, rollback-import, delete, and restore acceptance runs only
  against temporary sandbox paths that are removed after the report.
- The bridge remains read-only and preview-only, no MCP tool or route is added,
  and the MCP tool count remains 59.
- The formal visual library remains empty and Canon DB, `active_engine.md`,
  Approval Queue, approval items, and `canon_visual_lock` remain unchanged.

## Phase 19F

| Phase | Name | Status |
| --- | --- | --- |
| 19F | Visual Library MCP Read-only Tool Registration | Read-only MCP tool registered |

- Registers a single read-only, preview-only MCP tool `chatgpt_bridge_visual_library_ui_import_flow_preview` for UI import flow previews.
- The tool is read-only and preview-only and does not accept `execute` or confirmation arguments; it must not write or modify `active_engine.md`, the visual index, assets, Approval Queue, approval items, or `canon_visual_lock`.
- MCP tool count increases by one due to this registration (59 → 60).
- The formal visual library baseline remains empty and unchanged.

## Phase 19C

| Phase | Name | Status |
| --- | --- | --- |
| 19C | Visual Library UI Import Flow / Review Screen | Server-side review model implemented |

- Integrates Phase 18B through Phase 19B summaries into wizard steps, review
  cards, operation cards, a safety panel, and guarded action availability.
- UI behavior is preview-only by default; write operations require explicit
  execute intent, exact confirmations, ready preflight state, and manifests.
- Sandbox execution delegates to the Phase 19A/19B cores without adding a
  public route, client component, or MCP tool.
- Does not modify Canon, `active_engine.md`, writing/proofing policy, Approval
  Queue, approval items, or `canon_visual_lock`.
- Development verification leaves the formal visual library empty.

## Phase 19B

| Phase | Name | Status |
| --- | --- | --- |
| 19B | Visual Import Rollback / Delete / Restore Safety | Controlled safety core implemented |

- Supports manifest-bounded confirmed-import rollback, controlled delete to
  trash, and manifest-driven restore.
- Requires `--execute` plus operation-specific exact confirmation.
- Uses atomic visual index updates, operation manifests, post-operation
  validation, and reverse rollback for partial failures.
- Does not modify Canon, `active_engine.md`, writing/proofing policy, Approval
  Queue, approval items, or `canon_visual_lock`.
- Development verification uses sandbox paths and leaves the formal visual
  library at its empty baseline.

## Phase 19A

| Phase | Name | Status |
| --- | --- | --- |
| 19A | Confirmed Visual Import Core | Controlled confirmed import implemented |

- Requires three exact confirmation texts plus an explicit `--execute` flag.
- Reruns the Phase 18G guard and rechecks protected hashes, index state, source
  hashes, target safety, and target occupancy immediately before writing.
- Writes only visual assets and the visual index using temporary files, atomic
  rename, post-write validation, and a rollback manifest.
- Does not modify Canon, `active_engine.md`, writing/proofing policy, Approval
  Queue, approval items, or `canon_visual_lock`.
- Development verification uses sandbox paths and leaves the formal visual
  library at its empty baseline.

## Phase 18G

| Phase | Name | Status |
| --- | --- | --- |
| 18G | Visual Library Controlled Import Guard / Pre-Write Final Gate | Read-only pre-write guard implemented |

- Rechecks Phase 18F accepted candidates, source hashes, target safety and
  occupancy, the empty visual index baseline, lineage, category, duplicates,
  and no-write safety behind two exact confirmation gates.
- `ready_for_phase_19a_confirmed_import` means only that Phase 19A prerequisites
  passed; all write, copy, approval, lock, and real-import actions remain
  disabled.
- Does not write Approval Queue, the visual index, or visual assets, create
  approval items or `canon_visual_lock`, or modify Canon and
  `active_engine.md`.
- Phase 19A may begin designing the confirmed import core with atomic writes,
  snapshots, rechecks, and rollback support.

## Phase 18F

| Phase | Name | Status |
| --- | --- | --- |
| 18F | Visual Library Approval Guard UI Readiness / Final Acceptance Preview | Read-only final acceptance implemented |

- Connects the Phase 18B through Phase 18E preview pipeline and produces final
  acceptance summaries and UI readiness card previews.
- `approval_queue_import_dry_run_ready` remains dry-run ready only; every write,
  approval creation, confirmation, asset copy, and lock capability is disabled.
- Does not write Approval Queue, the visual index, or visual assets, create
  `canon_visual_lock`, or modify Canon and `active_engine.md`.
- Phase 18G adds the controlled pre-write final gate while retaining all
  no-write protections.

## Phase 18E

| Phase | Name | Status |
| --- | --- | --- |
| 18E | Visual Library Approval Queue Import Dry-Run / Guard Preview | Read-only dry-run implemented |

- Converts Phase 18D readiness candidates into Approval Queue payload previews
  and guard cards.
- `approval_queue_import_dry_run_ready` is dry-run ready only and never permits
  queue writes, approval item creation, import confirmation, or asset copying.
- Does not write the visual index or assets, create `canon_visual_lock`, or
  modify Canon and `active_engine.md`.
- Phase 18F may add guard UI readiness or final acceptance preview.

## Phase 18D

| Phase | Name | Status |
| --- | --- | --- |
| 18D | Visual Library Pending Import Candidate / Approval Readiness | Read-only readiness preview implemented |

- Converts Phase 18C simulation operations into pending candidate previews and
  approval readiness cards.
- `ready_for_human_visual_import_review` means human-review ready only; cards
  cannot submit to Approval Queue or confirm an import.
- Does not write the visual index or assets, create approval items or
  `canon_visual_lock`, or modify Canon and `active_engine.md`.
- Phase 18E may add Approval Queue import dry-run or guard preview.

## Phase 18C

| Phase | Name | Status |
| --- | --- | --- |
| 18C | Visual Library Import Simulation / Confirm Gate | Read-only simulation implemented |

- Consumes Phase 18B intake candidates and builds simulated import operations,
  proposed visual index records, duplicate handling, warnings, and risk.
- Exact confirmation unlocks eligible simulation decisions only; no import is
  executed and no files or index records are written.
- Unknown categories, duplicate secondary candidates, missing source files, and
  unsafe target paths remain blocked.
- Phase 18D may add pending import candidate or Approval Queue readiness preview.

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

## Phase 19G

| Phase | Name | Status |
| --- | --- | --- |
| 19G | Visual Library Controlled Import Trial | Trial implemented (writes + rollback)

- Implements a guarded, confirm-driven trial that writes to the formal visual library paths and immediately rolls back to restore the empty baseline. Uses the Phase 19A confirmed import core and Phase 19B rollback core.
- Guarantees no lasting changes to `active_engine.md`, Canon DB, compressed rules, Approval Queue, approval items, or `canon_visual_lock`.
- Trial runs require `--execute` plus exact confirmation texts; results are recorded under `data/outputs/runs/visual_library_phase19g` (not tracked).

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
## Phase 19D

| Phase | Name | Status |
| --- | --- | --- |
| 19D | ChatGPT / MCP Bridge Readiness for Visual Library | Read-only bridge payload preview implemented |

- Reuses the Phase 19C UI review model and exposes visual-library baseline,
  pipeline, blocker, warning, human-check, action-availability, and safety data.
- Provides a read-only, preview-only MCP tool manifest preview without
  registering a new MCP tool or changing the MCP tool count.
- Does not accept execute, import, rollback, delete, or restore capability.
- Does not modify the visual index, visual assets, active engine, Canon DB,
  Approval Queue, approval items, or `canon_visual_lock`.
