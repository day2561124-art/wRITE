# Pi Execution Policy Simplification v1 — candidate

本輪只提供候選，未 integrate、push、production cutover 或 reload。

## 隔離與 scope

- Base: `fcfba25de3fc521ea73e326d190ab358ee58d513`。
- Branch: `codex/pi-execution-policy-simplification-v1`。
- Candidate worktree: `E:/武裝學院的二三事/.pi-policy-v1`；從 committed HEAD 建立，沒有複製 main dirty files。
- 施工前以正式 `dev_workspace_list_workstreams(lifecycle=active)` 查得 7 個 active/nonterminal workstreams。
- Continuation 的 Journal、continuation runtime、inventory reconciliation 檔案未修改。
- Unified Engineering Rules 的 reliable store、reliable tests、suite-groups 檔案未修改。
- Contract convergence 的 `docs/PI-MCP-INTEGRATION-V1.md` 未修改。
- Pi runtime deployment 的 package/lock，以及 fiction NLU/retrieval scopes 未修改。
- 另讀取 `.runtime-phase1` 的實際候選 diff，確認 Runtime Phase 3／3B 與本輪共用 `mcp-server.mjs`、`pi-production-execution-controller.mjs`。本輪只改 ingress／direct route guard；Phase 3 的 HTTP tracing、queue、journal spans、engine 和 PowerShell service 保持獨立。Controller 的同一 import 插入點有文字合併風險，後續驗收整合時須保留兩邊 imports。
- 本輪未更改 production workstream registry、route record 或服務；Git worktree 是本機候選，未冒充 server-issued workspace。

## 現有機制與最小變更

`guardPiDirectExecution` 原本要求 workspace-aware reads 也帶完整 ExecutionIntent 或 diagnostic fallback。原有 read handlers 已限制相對路徑、realpath／symlink、敏感檔案、UTF-8／binary、搜尋數量與輸出；Git 使用固定 argv；Pi Codemode 只公開兩種受限讀取工具。

新 policy 模組只列出檔案 read/range/list/search/info、Git status/diff/diff-check 和既有 Codemode 入口。必須帶明確 server-issued `workspace_id`，並經原有 resolver 驗證，才可直接使用原 handler。Tool risk 必須為 read，名稱必須在固定集合；`readOnlyHint`、caller metadata 或聲稱只讀的 shell 均不能取得豁免。Capability/schema、runtime/operation status 已是正式 read handlers，本輪沿用原路徑。Route integrity 檢查仍先執行。

一般工程仍使用 `dev_pi_execute_intent` 的既有 `intent_json` ingress。新增可辨識的 `request_kind=authorized_engineering` 請求，由可信任 server adapter 補入 context、mutation input hash、target、穩定 idempotency key、verification step mapping 和必要 decision boundaries，再交給未改動的 `createExecutionIntent` 與 production controller。

GPT 仍須指定精確 actions/input、workspace、goal、constraints、completion conditions 和明確 permissions。Adapter 不選擇工具、不修改 command/content/path、不推導授權、不改寫已指定 keys/schema pins。未提供的 permission 為 false。一般 capability 僅限 read/list/write/patch、Git status/commit、focused/affected verification、既有非提權 `host.powershell`。其他 capability 仍須完整契約；integrate、push、提權、刪除、cutover 沒有新增捷徑。Full ExecutionIntent 的歷史、持久化、正式 confirmation、retry、reconciliation 和 host-maintenance scope 均沿用原流程。

## 一般工程請求範例

將下列 JSON 字串放進 `dev_pi_execute_intent.intent_json`。Workspace ID 必須來自正式註冊的 isolated workspace。

```json
{
  "schema_version": 1,
  "request_kind": "authorized_engineering",
  "intent_id": "gpt-authorized-example-001",
  "goal": "Run the explicitly authorized focused suite",
  "workspace_id": "dev_workspace_aaaaaaaaaaaaaaaaaaaaaaaa",
  "constraints": ["No integrate, push or cutover"],
  "requested_actions": [
    {"step_id": "verify", "capability": "verification.focused", "input": {"suite": "mcp_core"}}
  ],
  "permissions": {"read": true, "tests": true},
  "completion_conditions": ["GPT reviews the returned test evidence"]
}
```

原有 CLI `scripts/pi-execution.mjs` 仍接收完整 ExecutionIntent；本輪的簡化轉接位於 server ingress。需要 bootstrap、其他 lifecycle 或高風險動作時，使用原有完整契約。

## 驗證

新測試經既有 `pi-production-execution.test.mjs` entrypoint 載入，避免改動其他 active workstreams 的 runner／suite ownership。

Focused command（Windows PowerShell；在候選 worktree 執行）：

```powershell
$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL = '1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT = '1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION = '1'
$env:WRITER_WORKBENCH_DEPENDENCY_ROOT = 'E:\武裝學院的二三事'
node --test --test-concurrency=1 --test-reporter=tap tests/mcp/pi-execution-contract.test.mjs tests/mcp/pi-production-execution.test.mjs tests/mcp/pi-lifecycle-admission.test.mjs tests/mcp/pi-introspection-runtime.test.mjs tests/mcp/mcp-pi-readonly-entry.test.mjs tests/mcp/mcp-development-workstream-tools.test.mjs tests/mcp/mcp-development-write-tools.test.mjs tests/mcp/mcp-powershell-maintenance-tools.test.mjs tests/mcp/mcp-pi-codemode-bridge.test.mjs
```

Pi sidecar 使用候選內被 Git 忽略的 `scripts/pi-runtime/node_modules` junction，重用已安裝 dependencies；没有重新安裝或修改主倉依賴。

重點證據：合法讀取／搜尋／Git status、能力／狀態查詢在實際測試 MCP 成功；Journal 只有 fixture 初始 route 記錄，沒有新增 Pi execution projection 或 fallback transaction。真實非提權 PowerShell 輸出成功、正式 Pi 完成且持久化，同 intent 重送只 dispatch 一次。未授權 mutation／任意 shell／未知 read 工具／高風險 compact requests 被拒絕。路徑跳脫、敏感檔案、符號連結、輸出限制、真實註冊 worktree 與不同 workspace 隔離均驗證。

原始 TAP 保留在候選 `outputs/pi-policy-v1/`（ignored），摘要與 SHA-256 記於同目錄文件的 `.evidence.json`。首輪並行外部狀態測試曾互相干擾 audit records；串行後 audit failures 消失。Workspace runner 的依賴缺失以既有 dependency-root 設定解決，未改動產品或原有測試防護。

最終證據涵蓋 119 個不同 focused checks：78 個既有 regressions 通過；修正新 registry fixture 的非標準 worktree 目錄名稱後，重跑 Pi production entrypoint 的 41 個 checks 全數通過，沒有 skip。這個 41-check entrypoint 包含本輪 8 個 policy tests。另以獨立串行 MCP smoke 驗證工具 schema、profile、confirmation 與 audit，195 個 audit records 全部符合，audit log byte-for-byte 還原。`git diff --check` 通過。

停止條件僅限本輪必要功能、重大安全防護與 focused regression。大型 Journal 優化、HTTP 504 根因與額外效能工程均未納入。
