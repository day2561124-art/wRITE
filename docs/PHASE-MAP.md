# Phase Map

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
