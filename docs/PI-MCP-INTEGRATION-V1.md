# Pi × MCP 全面整合 v1.0 — 工程合約與階段紀錄

本文件以使用者提供的《Pi × MCP 全面整合工程規格 v1.0》29 節為工程要求。核心約束固定為 **GPT 決定；Pi 調度並記錄；MCP 執行**。本文件不取代原規格，也不將階段成果視為全面整合封板。

## 目前階段

Phase C — Reliability。Workstream：`dev_workstream_20261003-100124_6f779341a426`。
隔離 workspace：`dev_workspace_86a7ddd3980944b0902ac022`。
基底 commit：`213913e20723ad020a118a3229ea50fa512fad1d`。
正式封板以此 workstream 的 exact integration candidate、validation manifest 與 canonical remote 查核為準；focused PASS 不替代正式 gate。

- trusted-host opt-in `createPiReliableExecutionEngine`、`createPiReliableExecutionStore`、`createPiReliableMcpAdapter`。未新增 production tool entry，未改預設 route，沒有 model client / engineering reasoning。
- schema 2 projection 保存 deterministic command、owner、active call、retry policy / retry_at；OperationState 共用原合約。schema 1 可以共存查核，不能轉成 dispatchable operation，也不 migration。
- 每個 step 在 dispatch 前保存唯一 call_id、step/input/key binding 與 checkpoint；完成後保存 immutable bounded receipt，state 只保留 hash/reference。restart 跳過已完成步驟。
- Journal 的 append lock 執行 revision CAS；同 intent_id / 同內容回傳 durable 最新結果，不重跑。不同 Intent 重用相同 mutation key，在 admission publication 前拒絕；不以 namespace 偷換 key。
- owner 以 worker_id、PID、hostname 綁定；仍有 live owner 的重送只回進度。只有已確認退出的 owner 可接手；未知 liveness 停止 dispatch。晚到 response 不能重用舊 claim 或改 terminal state。
- Pi 管理 request / lookup deadline、bounded exponential backoff、reconnect scheduling、safe read retry 與有上限的 reconciliation polling。policy 首次 admission 後不能由 duplicate request 改寫。
- mutation key 放在既有 MCP `params._meta.reconciliation_key`，fingerprint 使用實際 tool name 與綁定後 arguments；重用 MCP 的 durable reconciliation 與 dedupe，而非另建一套 physical mutation journal。
- mutation timeout / restart 後的 in-flight claim 先查原 key。只有 verified `not_admitted` / same-key authority 才可重送；completed 保存 facts，partial / unknown / exhausted / unsafe 狀態回 GPT。terminal no-effect 要求新 key 時，Pi 不自行產生新 key。
- MCP completed / deduplicated facts 未必含原始 response，receipt 明列 `original_response_available:false`。測試缺 PASS evidence 時交回 GPT，不將 intended effect 當作 validation PASS。
- write → test → commit 按 GPT 順序與 permission 執行。phase conflict、validation / test / Git semantic failure 保存 decision_required；不改 patch、suite、expectation 或工程目標。
- filesystem / test / commit 的 mutation 綁 active isolated workspace；main / candidate / workstream scope 需要額外 trusted server authority。Pi 不自行提升 permission。
- execution COMPLETED 只代表既定操作完成，結果固定 `engineering_review_required:true`；工程封板與 completion conditions 的語義判斷仍由 GPT 負責。

### Phase C publication recovery

只在 schema 2 Pi persistence tail 符合以下證據時恢復：append lock、完整 immutable file version / hash-chain、既有 head prefix、合法 revision / Intent history、正確 namespace、零 mutation targets，以及同 host 的 started owner 已退出。

| 未發布 tail | 行為 |
| --- | --- |
| 只有 started | 追加 operation_recovered / no_effect_observed；邏輯 state 未發布，resume 使用原 safe state |
| 完整 started + completed pair | 驗證完整 schema 2 projection / deterministic history，再發布原 pair 的 head |
| recovery event 已寫、head 未發布 | 驗證相同 no-effect proof 後發布；recovery 自身可再次 restart |
| schema 1 / foreign operation / live owner / truncated / hash-valid invented progress | CORRUPT_STATE，拒絕 head publication 與 tool dispatch |
| physical effect 尚無 MCP terminal acknowledgement | 不由 Pi publication recovery 猜測成功或重送；保持 safe failure / decision boundary |

不刪除、不改寫既有事件；不泛化為任意 Journal repair 或所有 OS / device 的斷電保障。原 Phase B API 保持原本 fail-safe 行為。

### Phase C 驗證與限制

- 新 regression 在實作前因 missing reliability module 失敗；最終 Phase A–C focused 101/101 PASS，0 FAIL / 0 SKIP。
- 既有 pinned runtime / codemode / read-only entry 16/16 PASS，0 FAIL / 0 SKIP；原 24 MCP scripts 保留，Pi inventory additive 增至 8 scripts。
- fault tests 使用真正 Node process exit，涵蓋 claim / send / MCP terminal-before-Pi-receipt / stored receipt / saved backoff / Pi publication / recovery publication；fresh process 查同一份 Journal 與實際 temporary file，並行重送只 mutation 一次。
- reconciliation provider 使用現有實體 Journal service，跨 process restart；transport timeout / reconnect / late response 用可控 host binding 注入。
- 以上證據不宣稱已完成 live production canary、production tunnel fault injection 或 default cutover；Phase D–F 仍待施工。正式 MCP / tunnel baseline 必須由本 workstream 的 exact candidate 取得。
- code、checkpoint、commit / integration / push 的 provenance 保存在既有 Development Journal；shared-main 37 項既有 overlay 必須逐一 byte-hash 保留。

研究採用 caller-provided idempotency identity、durable result 與同 identity 不同 intent 必須拒絕的原則：[AWS Builders' Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)。
durable operation / retry 的工程参考：[Temporal Nexus operations](https://docs.temporal.io/nexus/operations)。
本階段重用現有 lock、journal、workspace、capability 與 MCP reconciliation，沒有引入 orchestration platform 或第二個 reasoning layer。

## 已封板 Phase B，保留設計紀錄

Phase B 已由 commit `213913e20723ad020a118a3229ea50fa512fad1d` 整合並推送。
Candidate：`dev_integration_20261003-092812_b68353d7322f`。
Manifest：`799ac3eb5a6b1eb2277088e861fec00bc3eddea0328d690669b26bc24deebba7`，
MCP / tunnel PASS_STABLE，diagnostic retry 0。以下保留當時施工紀錄。

Phase B — Journal & State。Workstream：
`dev_workstream_20261003-084957_ea2f0234f257`。
隔離 workspace：`dev_workspace_6706581babde4884ab49af9b`。
基底 commit：`d2dc03d61b038b64babeb2f526478a890b5da4f3`。
正式封板以此 workstream 的 exact integration candidate、validation manifest 與 canonical remote 查核為準。

- 新增 trusted-host `createPiExecutionStateStore`：admit、advance、checkpoint、inspect。
- 新增 opt-in `persistExecutionIntent`，保存 CREATED → ADMITTED → PREPARING，再回傳 structured result。
- 完整 Intent 與 OperationState 寫入現有 Development Journal 的 versioned `execution_projection`，不另建 journal 或以 chat / memory 作唯一狀態。
- 每一 revision 保存 previous_projection_hash、projection_hash、action_type；讀取重建時驗證 Intent hash、identity、context、step/key/verification binding 與合法 transition。
- 相同 intent_id / 相同內容回傳已保存的最新結果；相同 identity / 不同內容拒絕。這是 admission 去重，尚不是 Phase C 的 mutation idempotency。
- Journal 既有 append lock 內執行 revision CAS，started/completed 成對寫入，再以既有 durable head publication 發布。正常落盤不留下長期 active / dangling Development Journal operation。
- checkpoint 保存 operation / intent / workspace / revision / phase / step；可用 trusted verification resolver 連結既有 workspace checkpoint、exact snapshot 與 Git head。未驗證或跨 workspace reference 拒絕，不複製其 payload。
- Result 可從 durable projection 重建 completed、remaining、verification、checkpoint、resume_point、decision_required 與 journal receipt。
- Phase B 不 dispatch tools、不產生程式內容、不改 production default；`execution_enabled` 與 `resume_dispatch_enabled` 固定 false。DECISION_REQUIRED 不自行重新開啟。

### Phase B publication 與復原邊界

舊 Journal schema 1、既有事件 hash、operation lifecycle、flat metadata 與 128 KiB event limit 保留。
新增欄位只出現在 `pi_execution_projection / operation_completed`，payload 上限 768 KiB、專用 event 上限 1 MiB，承接既有 Intent 512 KiB budget。一般事件仍受原上限限制。完整 payload 與 state/result/input hash 同時受既有 Journal hash-chain 保護。

物理 publication 與邏輯 Pi operation 分開：一筆 state persistence 有自己的 dev_operation_id，metadata 綁 logical Pi operation_id。重建不依賴 process memory 或聊天進度。

| 中斷位置 | Phase B 行為 |
| --- | --- |
| event 寫入前 | 舊 head / 舊 state 仍可讀回 |
| started 寫入後、head 發布前 | cardinality / chain 不一致，CORRUPT_STATE，停止執行 |
| completed 寫入後、head 發布前 | 同上；不猜測、不 blind replay |
| head 發布後、response 遺失 | 新程序讀回已發布結果；相同 admission 不重建 operation |

測試使用真正的 child process exit（包括留下 owner 已退出的 append lock），再由 fresh process/service 查核。
上述 partial publication 目前只 fail safe；自動 reconcile / resume / retry 是 Phase C gate，不能宣稱已完成。
沿用既有 exclusive file write、file sync 與 atomic rename；只宣稱已測試的 process restart / interruption 行為，不將它泛稱為所有 OS / device 的斷電保障。[Node.js FileHandle.sync](https://nodejs.org/api/fs.html#filehandlesync)

### Phase B 驗證證據

- implementation 前的新 regression 因尚無 state-store module 而失敗。
- 首輪 17 tests：14 PASS；3 個 integrity failure 已阻止執行，但 admission 原始錯誤未分類。修正為 CORRUPT_STATE，未放寬 expectation。
- 最終新增 26 tests PASS，0 FAIL / 0 SKIP；加上 Phase A 共 47/47 PASS。
- fresh Node restart、duplicate/concurrent admission、跨 process revision CAS、workspace binding、verified/foreign checkpoint、decision escalation、terminal guard、pending completion guard、clock rollback、200 KiB payload、oversize rejection、legacy Journal 共存、hash-valid semantic corruption、四個 publication exit points 均涵蓋。
- pinned optional Pi runtime 安裝後，既有 runtime / codemode / read-only entry 16/16 PASS，0 FAIL / 0 SKIP。
- full MCP inventory 保留原 24 scripts，Pi 6 scripts additive；inventory assertions PASS。
- formal MCP / tunnel 結果須由本 workstream 的 exact-candidate validation 記錄取得；以上 focused PASS 不能替代 formal gate。

## 已封板 Phase A，保留設計紀錄

Phase A — Boundary Foundation，隔離 workspace：
`dev_workspace_5cdbb0f1d7044d71abd73592`。
Workstream：`dev_workstream_20261003-073214_3867df627fa2`。
基底 commit：`21edeb074ae46608d42e04ef154fbc90244cb1c1`。

- 新增 ExecutionIntent、PermissionModel、DecisionBoundary、OperationState 與 lifecycle transition。
- 新增固定 capability registry、MCP schema adapter 與 deterministic execution planner。
- planner 保留 GPT 的 action 順序、依賴、驗證選擇及精確 mutation input。
- Phase A 未註冊任何新 production MCP entry，未改預設 route，未啟用 mutation。
- `shadow` 是此階段的零工具呼叫 planning mode；正式 Phase D 的 legacy path comparison 尚未實作。
- `read_only` 僅能由 trusted host 明確綁定工具及 workspace resolver；只 dispatch workspace-scoped observation。
- retry / reconciliation 分類只是此階段的 policy foundation，沒有執行 retry、reconnect、restore 或 durable resume。
- Phase A 的 OperationState 是 immutable projection；當時尚未持久化。Phase B 已增加上述 Journal persistence 與 restart regression。
- 所有施工檔案修改、依賴安裝與後續 checkpoint / commit 使用既有 Workbench MCP，保留 Development Journal provenance。

## 前置檢查，2026-10-03 Asia/Taipei

使用者在本輪明確確認「現有三項工程都已經完工」。此確認作為工程完工的使用者輸入；registry 舊 metadata 與實際 Git / Journal / runtime 證據仍分別查核。

| 項目 | 查核結果 |
| --- | --- |
| Canonical remote main | `21edeb074ae46608d42e04ef154fbc90244cb1c1` |
| Local main | 與 canonical remote 完全相同，ahead 0 / behind 0 |
| Local origin/main tracking | 過期，不能作為 remote truth；未用 fetch/pull 改寫 |
| Development Journal | healthy，chain verified，active 0，dangling 0，reconciliation false |
| Transaction subsystem | 序列重查 healthy，active 0，blocked 0，recovery-required 0 |
| Initial contention | 並行 read middleware 曾回 CHECKPOINT_STORE_BUSY；後續序列查核恢復 healthy，未移除 lock |
| Existing MCP baseline | PI-1C exact-candidate mcp PASS，534492 ms |
| Existing tunnel baseline | PI-1C exact-candidate mcp_tunnel PASS，102908 ms |
| Baseline manifest | `5c53fa86d70367105d83548eaf03ced3c4765254c872ecd0f9a79d7bc3050199`，PASS_STABLE，diagnostic retry 0 |
| Baseline candidate | `dev_integration_20261003-061249_5f3b8a5e4ab9`，integrated |
| Shared main overlay | 36 modified + 1 untracked，未帶入新隔離 workspace，未修改、清除或納入本工程 commit |
| Registry residual | Retrieval R3 與 CB-C6-E15 尚顯示 active；不以舊 metadata 反駁使用者的完工確認，也不自行移轉其 operation |

上述 baseline PASS 是目前 main 的既有能力證據，不能當作本工程新 candidate 的正式驗證結果。Production cutover 前須重新確認所有 gate，含 residual workstream 安全收尾及 shared-main overlay ownership。不能把此文件或 chat 當作執行 state。

## Architecture invariants

| ID | 不可破壞的約束 | 本階段對應 |
| --- | --- | --- |
| INV-01 | GPT 是唯一主要工程決策層 | planner 沒有 model client / agent session |
| INV-02 | Pi 不做架構、產品、需求、工程語義決策 | 精確執行合約，unknown / semantic failure 升級 GPT |
| INV-03 | MCP 不做高階工程決策 | adapter 映射具體工具 |
| INV-04 | GPT 決定做什麼、寫什麼 | action input SHA-256 與 mutation_plan 一致 |
| INV-05 | Pi 決定可靠執行 mechanics | state / error / reconciliation policy foundation |
| INV-06 | MCP 只執行並回報事實 | adapter 保留 bounded evidence，GPT 解讀 |
| INV-07 | Pi 保存 execution state 與紀錄 | Phase B 以同一 Development Journal 保存完整 versioned projection |
| INV-08 | GPT 判斷工具結果工程意義 | OBSERVED 不等於工程驗收 PASS |
| INV-09 | MCP 盡量 stateless | 未增加 MCP runtime execution state |
| INV-10 | 所有 mutation 可追蹤 | Phase A mutation 關閉；施工修改沿用 Workbench Journal |
| INV-11 | 可重送 mutation 必須 idempotent | 合約強制 stable unique key；durable lookup 尚待 B/C |
| INV-12 | execution failure 不變成 Pi 設計決策 | fixed classification，不換 patch / scope / expectation |

## Execution Intent v1

Canonical permission names 為 `read`、`workspace_create`、`write`、`tests`、`commit`、`integrate`、`push`；全部必填且為 boolean。不能從 intent 傳入 executable、model、endpoint、environment、tool name 或 workspace override。

Context 使用現有 server-issued workstream / workspace identity。Project 固定 `writer_workbench`。Intent 最多 100 actions、100 mutation plans、512 KiB JSON、32 層深度。

`requested_actions` 指定 capability、精確 tool input、`step_id`、先前 action 的 `depends_on`，以及 effect action 的 `idempotency_key`。Pi 不新增 action，不自行挑別種實作，不自行補測試或改 expectation。

每個 effect 必須有唯一 mutation_plan：
`step_id`、`target`、`expected_change`、`input_sha256`。
Hash 對 canonical JSON 的完整 input 計算。Filesystem target 須與 input.path 相同。對 Git / workspace / verification，完整 input hash 綁定 exact identity、revision、commit、paths 或 suite。Tests 也列為 effect，因為可能寫入 fixture 或 runtime。

`verification.focused / affected / full` 列出已 requested 的對應 verification step_id；不得把 read 當 test、略掉 requested gate，或把 full 的 all suite 換成較小 suite。

範例（host-side construction，無工具執行）：

~~~js
import { REQUIRED_DECISION_BOUNDARIES } from "./server/src/pi-execution-contract.mjs";
import { planExecutionIntent } from "./server/src/pi-execution-orchestrator.mjs";

const plan = planExecutionIntent({
  schema_version: 1,
  intent_id: "pi-mcp-example-001",
  goal: "Inspect the approved workspace package",
  context: {
    project_id: "writer_workbench",
    workstream_id: "dev_workstream_20261003-073214_3867df627fa2",
    workspace_id: "dev_workspace_5cdbb0f1d7044d71abd73592"
  },
  constraints: ["Keep production routing unchanged"],
  requested_actions: [
    { step_id: "read-package", capability: "filesystem.read",
      input: { path: "package.json", maxBytes: 4096 }, depends_on: [] }
  ],
  mutation_plan: [],
  verification: { focused: [], affected: [], full: [] },
  completion_conditions: ["GPT reviews the observed package"],
  permissions: { read: true, workspace_create: false, write: false,
    tests: false, commit: false, integrate: false, push: false },
  decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES]
});
~~~

## Capability registry / adapter

| Capability | MCP tool | Permission | Phase A dispatch |
| --- | --- | --- | --- |
| filesystem.read | dev_read_file | read | explicit read_only |
| filesystem.list | dev_list_directory | read | explicit read_only |
| filesystem.write | dev_create_file | write | disabled |
| filesystem.patch | dev_apply_patch | write | disabled |
| workspace.create | dev_workspace_create_isolated | workspace_create | disabled |
| workspace.inspect | dev_workspace_get_workspace | read | explicit read_only |
| verification.focused / affected / full | dev_run_tests | tests | disabled |
| git.status | dev_git_status | read | explicit read_only |
| git.commit | dev_git_commit | commit | disabled |
| git.integrate | dev_workspace_integrate | integrate | disabled |
| git.push | dev_git_push | push | disabled |
| execution.query | dev_workspace_get_operation | read | disabled until journal identity binding |

`filesystem.write` 的 v1 semantics 是 **exclusive create**，不是 overwrite。修改已存在檔案必須使用 `filesystem.patch`，具唯一 oldText 與必填 expectedSha256。
Commit 綁 exact expectedHead；integration 綁 exact candidate / revision；push 綁 exact expectedHead。Adapter 只接 trusted host bindings，intent 不能指定其他 tool schema。

所有 dispatch 先重新 validate intent / permission，再驗證 resolver 返回的 workspace_id 與 workstream_id 完全匹配。既有 Workbench path、symlink、secret、workspace、Git、verification guards 保持最終實體權限檢查。Result 上限 64 KiB，保存 input/result hash；host exception 只輸出固定分類 code，不直接洩露 raw exception。

## OperationState / decision boundary

State 保存原規格第 9 節列出的 identity、phase、step lists、tool calls/results、retry_count、last_error、checkpoint、resume_point、keys、verification 與 timestamps，另有 schema_version 與 intent_hash。

正常 lifecycle 固定：
CREATED → ADMITTED → PREPARING → EXECUTING → VERIFYING → COMMITTING → COMPLETED。

WAITING_RETRY / RECONCILING 只能回到保存的 phase，不能跳到 COMMITTING。DECISION_REQUIRED 不能無 GPT 決策自動繼續；本階段需要後續明確 decision admission。Terminal state 不可重新開啟。Corrupt identity / duplicate steps / non-monotonic timestamps fail closed。Pending steps 或 pending/failed verification 不得 COMPLETED。

Error classification 是執行規則，不是實作方向：

- Read 的已知 transient transport / temporary unavailable / timeout：safe retry policy。
- Mutation 的相同錯誤：只有已確認 not_started 才能 retry；其餘 reconcile first。
- Permission denied：stop；corrupt state：fail safe。
- Test / validation / architecture / requirement / scope / Git semantic conflict，以及 unknown failure：decision_required。
- Reconciliation 必須有經驗證且可歸屬的物理 evidence；completed 回原結果，not_started 才可 same-key retry，partial / unknown 回 GPT。缺少 response 不能證明 not_started。

## 分階段 gate 與後續實作

| Phase | 實作 | 必須先通過的 regression / gate |
| --- | --- | --- |
| A | 合約、state、permission、boundary、registry、adapter | 精確內容、零 planner calls、workspace/permission isolation、狀態與錯誤分類、新舊 MCP regression |
| B | persistent state、journal、checkpoint、structured result | fresh process 可從 durable records 重建，intent identity/hash 固定，journal integrity |
| C | retry/backoff/reconnect、resume、dedupe、idempotency、reconcile | 每個 send/ack/persist crash window、same-key payload conflict、duplicate/late response、partial/unknown escalation |
| D | 真實 legacy execution observation 與 Pi planned comparison | zero Pi mutation、差異 evidence，production default 不變 |
| E | 少量全新 operation canary | 原 operation 不 migration，exact permission/reconciliation/workspace tests，fallback 可用 |
| F | full default cutover | 全部 21 項驗證矩陣與 acceptance criteria PASS、GPT 明確 cutover decision |

B 已擴展現有 Development Journal 的 hash-chain、locking、provenance 與 checkpoint reference。既有 result 仍是 bounded flat metadata；完整 state 放在專用 versioned execution_projection，不另建 append-only journal。

C 的 idempotency 至少綁 caller/intent、workspace、step��capability、精確 input hash；同 key 不同內容拒絕。失敗後的未執行判斷必須由 tool / journal / physical postcondition 證明。使用既有 MCP reconciliation_key 時，遵守其 no-effect 要求 new-key 的既有語義，不私自重開 terminal operation。

Durable state publication、journal admission、tool dispatch、physical effect、receipt persistence、terminal publication 的每個 crash window 都需故障注入。MCP 端 idempotency / receipt 和 Pi 端 dedupe 必須配合；只在 Pi memory 留 key 不能保證 mutation once semantics。

Decision escalation 保存 safe state、evidence 和 resume_point，回 GPT。GPT 決定下一個明確 action 或新 intent；Pi 不改 goal、scope、patch、test expectation，不忽略 failure，不自行 cutover。

## 全面整合验收矩陣

以下都是 **full integration gate**，不能由 Phase A 的 policy tests 代替：

Normal execution、Direct MCP、MCP tunnel、Read、Write、Test execution、Git commit、
Permission guard、Retry、Timeout recovery、Disconnect recovery、Pi restart recovery、
Duplicate request、Idempotency、Reconciliation、Checkpoint resume、Decision escalation、
Journal integrity、Workspace isolation、Shared-main guard、Failure-safe behavior。

Formal seal 另外要求：GPT 唯一工程決策層，Pi 完整 lifecycle/state/retry/resume/reconnect，所有 mutation 可追蹤，chat disconnect 不失 state，legacy operation 無 migration，MCP 保持工具層，production default 正式改為 GPT → Pi → MCP，direct path 只作 emergency/diagnostic fallback。

## 驗證與封板證據位置

Focused：
`node --test tests/mcp/pi-execution-contract.test.mjs tests/mcp/pi-execution-orchestrator.test.mjs`。

既有 Pi compatibility：
`node --test tests/mcp/mcp-pi-agent-execution.test.mjs tests/mcp/mcp-pi-codemode-bridge.test.mjs tests/mcp/mcp-pi-readonly-entry.test.mjs`。
安裝 optional runtime 後執行；SKIP 不能宣稱 PASS。

Inventory：
`node tests/tools/mcp-suite-groups.test.mjs`。
保留原 24-script baseline 及 3 個既有 Pi scripts，新增 2 個 foundation scripts 與 1 個 Phase B state-store script，皆由正式 mcp runner 執行。

本輪 first regression 在 implementation 前因兩個新 module 尚不存在而失敗。實作後 19 focused tests PASS；既有 Pi 16 tests PASS、0 FAIL、0 SKIP。追加真實 adapter read / operation-isolation regression 後，使用 final focused run 與 Workbench Journal operation / snapshot / checkpoint 作最終證據，不能把此筆早期數字當 final gate。

## 研究依據

查閱日：2026-10-03 Asia/Taipei。下列是原始官方資料；工程選擇是本倉庫的設計推論，沒有引入 Temporal service 或新增 reasoning layer。

- [Pi Codemode README](https://github.com/earendil-works/pi/blob/main/packages/codemode/README.md)：sandbox capability 注入與 store persistence 責任。使用現有 pinned 1.0.0 SDK/lockfile，非浮動 main dependency。
- [AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)：stable request identity、same key with different intent、late request 與 side effect。
- [Temporal Tasks](https://docs.temporal.io/tasks)：history-based replay 與 activity 執行邊界。
- [Temporal Nexus operations](https://docs.temporal.io/nexus/operations)：at-least-once execution 需要 handler idempotency；不能將 retry 當作無條件 exactly-once。

原倉庫已研究 source：
`pi-agent-execution-service.mjs`、`pi-codemode-bridge.mjs`、`mcp-pi-agent-tools.mjs`、
`scripts/pi-runtime/codemode-worker.mjs`、`mcp-development-journal-tools.mjs`、
`mcp-operation-reconciliation-context.mjs`、`mcp-development-workstream-tools.mjs`、
`mcp-development-readonly-tools.mjs`、`mcp-development-write-tools.mjs`。
