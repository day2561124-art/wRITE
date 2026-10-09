# Pi Runtime 降壓 Phase 1：隔離候選與接續紀錄

本輪完成 Checkpoint Store 的可重現瓶頸修復；這是供 GPT 驗收的工程候選，尚未整合、push、production cutover 或宣告整體封板。線上工具的端到端長延遲尚未確認完整根因。

## 隔離與工程證據

- 日期：2026-10-08，Asia/Taipei；execution lease 起點 20:38:51，截止 21:03:51。
- Base HEAD：`fcfba25de3fc521ea73e326d190ab358ee58d513`。
- 專用分支：`codex/pi-runtime-pressure-phase1`。
- Worktree：`E:\武裝學院的二三事\.runtime-phase1`，由固定 base HEAD 建立，未帶入 main 既存 dirty overlay。
- 使用者授權獨立 worktree 與候選 commit；本輪沒有建立或冒用 MCP 註冊的 workspace/workstream/operation ID。Git worktree 與 commit 是本輪保存邊界。
- 起始 main ahead origin/main 8 commits，有既存 config/data/launcher/Journal 等修改，全部保留。main 新出現的 `.runtime-phase1/` untracked 目錄是本輪隔離 worktree。
- MCP 查詢確認 7 個非終止 workstream。Pi Continuation 持有 Journal、journal-resolution 與部分 maintenance tests；UER audit 持有 reliable store、reliable tests、suite-groups。本輪避開這些檔案與分支。
- 線上 `dev_workspace_list_operations(outcome=dangling, limit=20)` 回傳 total=0。這是查詢當時的觀察，不是其他工程停止工作的證明。
- 測試使用專用暫存 repository/store；沒有解除其他工程鎖、刪除 production checkpoint/journal/operation、終止其他工程程序或重置 Git。
- Node 24.18.0；既有 Pi 1.0.4 套件透過本 worktree 的 dependency bridge 使用，沒有安裝或升級 Pi。

## Root cause analysis

### 已確認並修復

`mcp-development-checkpoint-tools.mjs` 的 status 原路徑依序執行 registry reconciliation、全體 identity/content 驗證、blob store 掃描，再重新載入 active identities/contents。這些 I/O 位於同一 maintenance 排他鎖內。相同 immutable content 在不同 checkpoint 中也反覆讀取。

200 身分、1 個 deduplicated content、8 個 64 KiB blob 的隔離 fixture 重現：正常 status P50 約 1.12 秒；8 路並行 status 僅 6/24 成功，其餘是 `CHECKPOINT_STORE_BUSY`。單純讀取互相等待，加上重複全庫掃描，增加 critical section 與鎖競爭。

maintenance lock 取得過程在 `open(wx)` 成功後，若 metadata write/sync 失敗，原程式沒有關閉 handle 或移除自己剛建立的鎖。本輪新增 exception cleanup，故障注入驗證 `ENOSPC` 會如實回報且自己的 handle/lock 得到釋放。

status 原本將 maintenance lock busy 統一分類為 corrupt。本輪改為 degraded 並提供 `last_health_error_code=CHECKPOINT_STORE_BUSY`；未知統計仍是 null，沒有錯誤成功回報。

### 已確認的架構事實，尚未完成端到端歸因

- MCP `dispatch` 在 operation 前等待同一 ordered recovery barrier；`createRuntimeReadiness` 保證每 process 僅執行一次，失敗不會被 retry 繞過。本輪未發現逐次重新初始化的證據。
- MCP stdio `enqueueMessage` 使用全域 Promise 佇列，獨立讀取也依序執行。佇列、backpressure 與 recovery 次序維持原狀。
- Journal `verify()` 會擷取、確認 durable snapshot，重新檢查已驗證 prefix 的檔案版本；Pi production status 另讀取 execution history 與 route。這是可能的重複掃描成本，但尚未量測各階段占比，且 Journal 正由另一工程修改。
- 線上 Journal 事件目錄觀察到 51,354 個事件；workstream list 單次 63,659 ms，Pi execution status 單次 79,257 ms，後續 dangling list 單次 41,775 ms。這些包含 connector、佇列、recovery 與磁碟成本，不能解讀成 Pi sidecar 或 checkpoint 的單一根因，也不能用單次觀察計算 P50/P95。
- `PI_EXECUTION_INTENT_REQUIRED` 是現行正式工程路由拒絕。`INVALID_EXECUTION_CONTEXT`、`INVALID_CONTRACT_FIELDS` 沒有被改寫成可通行條件。

## 最小修復

- identity 驗證以最多 8 個檔案一批讀取，按原身分順序 reconcile；缺失 manifest 檢查改用 Set。
- 同一 maintenance lock 內重用最多 64 個已驗證 identity，content promise cache 最多 64 筆；超出上限仍重新讀取驗證，沒有跨 request 或跨 lock 的 durable-state 快取。
- 同一 stats pass 驗證全部 active/deleted manifests，直接累計 active root descriptors，避免第二次全體 manifest 載入。
- blob 驗證最多 8 路並行，保留 digest、size、type 與所有既有檢查；不保留不必要的已驗證 blob buffers。
- checkpoint create 重用同一 stats pass 的 blob records，取消額外 blob directory scan。
- 並行驗證失敗時停止啟動新讀取，等全部已啟動讀取結束後才回報及釋放鎖。
- identity manifest 新增 filename/ID 一致性檢查，避免身分映射錯置。
- mutation、atomic publish、restore、transaction、journal hash chain、正式 ExecutionIntent、retry/reconciliation 與現有 timeout 保留。

純讀取 checkpoint 查詢仍可能執行 orphan identity reconciliation，且 CAS blob GC 必須與讀取/驗證協調，因此本輪不直接移除 maintenance 排他鎖。P1 保留既有明確 capability/read-only sandbox 路徑，沒有新增 shell、filesystem、network capability 或全域路由例外。

## 延遲證據

完整呼叫次數、成功率、P50/P95/max 見 [原始量測](PI-RUNTIME-PRESSURE-PHASE1.evidence.json)。每個版本 152 次計時呼叫：單次 list/get/status 各 20 次，8 路並行各 24 次，外部 lock 固定持有 150 ms 後 list 20 次；初始化與 fixture 準備不列入 warm latency。

| 情境 | 每版本呼叫數 | 成功率 前→後 | P50 ms 前→後 | P95 ms 前→後 | Max ms 前→後 |
|---|---:|---|---|---|---|
| list_normal | 20 | 100%→100% | 248.6→75.6 | 334.3→92.0 | 378.0→98.8 |
| get_normal | 20 | 100%→100% | 242.5→101.0 | 347.0→106.9 | 382.5→108.4 |
| status_normal | 20 | 100%→100% | 1120.3→141.1 | 1332.5→190.9 | 1393.9→244.8 |
| list_concurrent_8 | 24 | 100%→100% | 1249.7→551.6 | 2200.3→994.3 | 2396.7→1036.4 |
| get_concurrent_8 | 24 | 100%→100% | 1114.5→510.9 | 2163.1→991.2 | 2230.8→1001.8 |
| status_concurrent_8 | 24 | 25%→100% | 2165.5→740.1 | 2556.0→1400.3 | 2792.1→1423.5 |
| list_external_lock_150ms | 20 | 100%→100% | 423.9→263.7 | 482.9→286.0 | 555.9→287.1 |

這是 Windows 本機、synthetic deduplicated store 的單輪微基準；不代表 production 改善比例。P95/max 包括失敗呼叫，成功率另外列出。正常與鎖競爭分開統計，沒有操作 production 鎖。最終版本數據包含 cache 上限與 lock fault cleanup。最終量測與 fixture-only storage regression 在同一 host 重疊執行，host 負載沒有嚴格控制；不將該數據視為 production SLA。

## 驗證與自我審核

| 驗證組合 | 結果 |
|---|---|
| 最終 Checkpoint + Transaction + 新增 pressure focused tests | 11/11 TAP units 通過，含 9 項新 focused cases；兩個 legacy scripts 內部有多項 assertions |
| Pi production、ExecutionIntent contract、readonly entry、readiness、physical publication/crash recovery | 74/74 TAP units 通過 |
| Journal（修正 dependency-root 測試環境後） | 1/1 legacy script 通過，hash-chain、snapshot、reconciliation assertions 通過 |
| Pi 1.0.4 真實 Codemode sidecar | 7/7 通過，0 skip |
| Capability introspection、schema pins、physical bootstrap | 40/40 通過 |

不同測試檔案去重後共 133 個 TAP units 通過；沒有以第一次含 setup failure 或 sidecar skips 的 run 宣告通過。原始紀錄保存在本 worktree 的 `tests/.tmp/pi-pressure-evidence/`：`final-storage-regression.log`、`journal-regression.log`、`pi-sidecar-regression.log`、`focused-and-boundary.log`。

- 檢查範圍涵蓋：正常 read、未授權 mutation 拒絕、合法 intent、checkpoint create/read/recovery、Journal hash chain、duplicate intent、並行 mutation、crash/retry/publication recovery 與 fault/busy 回報。
- 新測試覆蓋精確 I/O 次數、distinct/deleted content、cache overflow、wrong filename、等待所有失敗讀取排空、live owner busy、lock sync failure、orphan reconciliation 與並行 delete。
- 新測試已加入 `tests/run-all.mjs` 的獨立入口；避開另一工程持有的 `mcp-suite-groups.mjs`。本輪只執行 focused/affected，未執行 all。
- 第一次 Journal regression 因隔離 worktree 沒有自己的 node_modules，在 test runner setup assertion 失敗；指定 main 的唯讀 dependency root 後同一測試通過，沒有放寬測試或修改 Journal。
- 最初 6 個 optional sidecar tests skipped；使用既有 Pi 1.0.4 dependency bridge 後全部實際執行通過。Windows 未允許的 file-symlink case 在既有 Journal script 中跳過，不能宣稱已驗證該平台分支。
- `git diff --check` 與 staged diff check 在 commit 前確認；committed diff check 在 commit 後確認。

## 修改檔案

1. `server/src/mcp-development-checkpoint-tools.mjs`：驗證成本、鎖失敗 cleanup、busy 診斷。
2. `tests/mcp/pi-runtime-pressure.test.mjs`：focused regression。
3. `scripts/pi-runtime-pressure-benchmark.mjs`：可重現隔離基準。
4. `tests/run-all.mjs`：新增 focused test 的正式入口。
5. `docs/PI-RUNTIME-PRESSURE-PHASE1.evidence.json`：前後原始數據。
6. `docs/PI-RUNTIME-PRESSURE-PHASE1.md`：RCA、驗證與接續紀錄。

## 重現

在本次 worktree 用既有安裝的 Node 與依賴執行：

```powershell
$env:WRITER_WORKBENCH_DEPENDENCY_ROOT='E:\武裝學院的二三事'
$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1'
node --test tests/mcp/pi-runtime-pressure.test.mjs
node scripts/pi-runtime-pressure-benchmark.mjs
```

baseline：從 base HEAD 的 checkpoint module 取出副本到同一 `server/src` 目錄（保持原相對 imports），以 `node scripts/pi-runtime-pressure-benchmark.mjs <baseline-module> <output-json>` 執行。benchmark 只接收 host CLI 路徑，不註冊為 MCP capability。每次建立專用 tempfile root，cleanup 驗證 resolved parent 與 fixture prefix 後才刪除自己的 fixture。

## 未完成事項與 next_action

1. GPT 驗收本候選與差異；本輪沒有申請或執行 integrate/push/cutover。
2. 下一輪先核對此分支 HEAD、main HEAD、其他 workstream/operation 與 scopes，再決定能否繼續。
3. 對 MCP request 增加受控分階段量測：connector/child 啟動、queue wait、readiness、Journal snapshot/prefix verification、route check、workspace resolution、實際 capability。先取得冷/暖、正常/競爭的可重現基準。
4. 與 Journal owner 的活躍工程範圍協調後，才評估重複 durable verification 的最小修復；不在本輪越過該 scope。
5. 針對較多 distinct contents、較大 blobs、不同 store 規模做驗收基準，並審核 8 路 I/O 與記憶體上限的實際 production 適用性。
6. 正式里程碑封板前依 GPT 決定執行受影響完整驗證與必要 all，然後走既有 integration 驗證流程。

本輪保存邊界是獨立分支 commit、原始量測、測試紀錄與本接續文件；不把 Git commit 冒稱成 Pi 原生 checkpoint。
