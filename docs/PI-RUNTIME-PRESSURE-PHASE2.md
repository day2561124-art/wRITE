# Pi Runtime Pressure Phase 2：分段歸因與隔離調度候選

本輪完成可重現的 MCP stdio 分段量測、固定 capability metadata 的最小佇列修正，以及真正的 ExecutionIntent → Pi production controller → MCP → 非管理員 PowerShell → durable evidence 驗證。**線上 ChatGPT／HTTP E2E 尚未驗收；沒有 production integrate、push 或 cutover。**

## 接續與隔離

- Base commit：`8e9b561b86e009e8df86734d980aa586538d8f2e`，起始 Git 狀態乾淨，Phase 1 文件／證據已核對。
- Worktree：`E:\武裝學院的二三事\.runtime-phase1`；branch：`codex/pi-runtime-pressure-phase1`。
- Lease：2026-10-08 21:14:46–21:39:46 Asia/Taipei。採用本次使用者指定的 v1.2 要求；沒有找到額外可讀的同名規則文件。
- main HEAD 仍為 `fcfba25de3fc521ea73e326d190ab358ee58d513`，原有未提交修改未帶入。registry 中七個非終止 workstream，沒有本 Git worktree 被接手的證據。
- 避開 Pi Continuation 的 Journal／journal-resolution 檔案與 UER 的 reliable store／suite-groups。Phase 1 原始碼與證據均未改寫。
- 每次 E2E 建立自己的 temp Git repository、Journal、route、workstream 和 locked isolated workspace。可信 fixture 初始化 gate 只適用於該 temp repository，沒有 production 路由變更。
- Node 24.18.0；installed `@earendil-works/pi-coding-agent` package version 已讀取確認 1.0.4，沒有重建或升級套件。

## 觀測邊界與既有機制

既有 `createRuntimeReadiness` 使用 performance hooks，保證每 process 共用一次有序 recovery barrier；HTTP stdio adapter 已提供 runtime readiness IPC、`createMcpRuntimeDiagnostics`、bounded readonly retry budget 與 recovery 記錄。PowerShell 原有 duration、exit code、timeout、output hash 與 Journal operation。沒有用放寬 timeout 或停用驗證換取效能。

本輪使用 Node `registerHooks`、`performance.now()`、`AsyncLocalStorage` 和 `diagnostics_channel`，在**嚴格限定的自有 temp fixture**包住既有函式。preload 拒絕非 `os.tmpdir()/pi-phase2-*/repo`、非 realpath 一致路徑；production server 不載入 tracing，不新增 MCP shell／filesystem／network 能力。trace 只存 stage、request ID、duration、parent 等計時欄位，不存命令參數。

| 階段 | 本輪直接觀測 | 限制 |
| --- | --- | --- |
| ChatGPT／connector ingress | 無 | 不能從 SDK 總時間倒推 |
| HTTP／adapter transport、queue、retry | 原始碼與既有 diagnostics 檢查 | 無線上 correlation；本 fixture 使用 SDK stdio |
| MCP stdio queue | JSON-RPC parsed enqueue → dispatch 的 monotonic span | 不含 connector 與 child spawn 前等待 |
| readiness | 共用 barrier 的 await span | cold readiness 在第一個 schema request；warm request 幾乎零 |
| Pi admission、prepare、state transitions、dispatch | 實際 controller／engine spans | 不將所有巢狀 inclusive 時間相加 |
| checkpoint lock | acquireStoreLock／withLock spans | 本 E2E 未注入 checkpoint lock holder；鎖競爭由 Phase 1 focused regression 覆蓋 |
| Journal | verify、snapshot、projection read／append、route read spans | 非 production 全庫量測；不修改 Journal |
| PowerShell | 真正 child process span、原有 execution receipt | 沒有直接 PowerShell 呼叫冒充 PASS |
| response | serialize/write aggregate spans；SDK observed completion | response span 尚未逐 request 綁定；外部回程不可觀測 |

## Root cause analysis

**已確認並修復：固定 metadata 查詢被不相關 mutation 的全域序列佇列阻塞。**原 `enqueueMessage` 將所有 request 串在 `pending`；受控競爭中，安全的兩秒 sleep PowerShell intent 加上正常 durable processing，讓三次 schema 查詢等待約 12.22 秒。修正只讓 exact `dev_capability_get_schema` 使用另一條序列佇列，並要求 registry 的 `risk=read` 與 `readOnlyHint=true`。兩條 lane 共用 256-request 上限及同一 stdout frame write chain。其餘讀取、status、filesystem、任意 PowerShell 和全部 mutation 仍走原隊列。`dispatch` 的 readiness、tool profile 與既有 guard 均保留。

**已量測但未修復：Pi durable processing 明顯大於命令本體。**候選第一個正常呼叫總計 3,559 ms，其中 queue 0.111 ms、prepare 58.85 ms、admission 149.83 ms、九次 state command inclusive 1,615.05 ms、Pi dispatch inclusive 1,678.39 ms；實際 PowerShell 僅 336.11 ms。同一呼叫包含 52 次 Journal verify、104 次 snapshot capture、21 次 projection read、10 次 projection append。verify inclusive 800.96 ms，其中 snapshot 426.84 ms，兩者巢狀；不能相加。這證實反覆 durable 工作的存在，**沒有證明每次驗證均可刪除**，也沒有把它外推為線上 79 秒根因。相關 Journal／store 正由其他工程持有，留待有 ownership 的下一輪。

候選第四個並行 intent 總計 22,641 ms：直接量到 queue wait 16,516.85 ms、server dispatch 6,122.34 ms，PowerShell 354.58 ms。mutation 序列化仍存在；本輪沒有放寬它的 transaction／crash recovery 保證。

線上唯讀 filesystem metadata probe：51,354 event files，共 171,619,827 bytes；readdir 49.09 ms，五次 bounded eight-way lstat 為 956.36／875.62／885.38／1,322.80／1,302.53 ms。前後 head 與檔名集合相同。**它不讀事件內容、不驗證 hash、不取得鎖，絕不是 Journal verify 或線上 admission 的耗時。**

## Benchmark

兩次新建相同 fixture；每次 8 個 sequential normal intent、4 個 concurrent intent，再以一個兩秒 sleep intent 與三個 schema requests 形成受控 queue competition。P50／P95 使用 nearest rank。樣本量小，trace 有同步落盤成本。baseline 前半段曾與其他自有 focused tests 同時執行，且 durable history 隨呼叫增長；**不得將普通 PowerShell 的前後差異歸功於 metadata 修正**。主要 causal evidence 是 schema request 的直接 queue span 與在 holder 完成前回覆的順序。

| 指標 | baseline P50 / P95 / max ms | candidate P50 / P95 / max ms | 成功 |
| --- | --- | --- | --- |
| sequential PowerShell E2E | 5,846 / 7,880 / 7,880 | 4,858 / 5,939 / 5,939 | 各 8/8 |
| 4-way PowerShell E2E | 18,122 / 38,012 / 38,012 | 10,749 / 22,641 / 22,641 | 各 4/4 |
| schema under queue competition | 12,221 / 12,223 / 12,223 | 4.63 / 6.40 / 6.40 | 各 3/3 |

第一個 schema request 含 cold readiness，baseline 89.50 ms、candidate 62.86 ms；單次不提供有效 P95 推論。Phase 1 status 1,120→141 ms P50、1,332→191 ms P95、8-way 6/24→24/24 原數據保留，與此 E2E 完全不同。

## 正式 PowerShell 與安全結果

- 本地 SDK → 實際 MCP server 的 `dev_pi_execute_intent`，schema version/hash pinned；正式 bootstrap 建立並註冊 isolated context，host maintenance resolve 到 fixture canonical workspace。
- 正常命令 `Write-Output 'PI_PHASE2_OK'`：exit 0、stdout 精確匹配、`elevated=false`、Pi `COMPLETED`；每個 intent、Pi operation、PowerShell child operation ID／command SHA 與 duration 均保存在 evidence。
- 各 benchmark 實際 15 次 PowerShell child admission：8 normal、4 concurrent、1 queue holder、1 exit 7、1 timeout。duplicate、direct denied、permission denied、timeout retry 都沒有額外 child dispatch。
- duplicate 返回相同 durable Pi operation；直接 powershell mutation 仍 `PI_EXECUTION_INTENT_REQUIRED`；intent `permissions.write=false` 仍 `PERMISSION_DENIED`。
- `exit 7`：receipt exit 7、`ok=false`、Pi `DECISION_REQUIRED`，Journal 當時仍 healthy。這不是成功。
- timeout 1000 ms：receipt `timed_out=true`、`ok=false`；父 MCP mutation `ambiguous_effect`，Pi 後續 durable write 回報 `JOURNAL_DEGRADED`。先讀 durable state 再測相同 intent，仍拒絕，沒有重送 command。
- 最終 chain verified=true、376 events、無 dangling／active Journal operations；health degraded 的明確原因是 `ambiguous_terminal_operation_requires_reconciliation`。**沒有宣告 timeout operation 成功或 reconciliation 已恢復。**
- 現有 affected tests 驗證 worker after_claim／after_dispatch／after_receipt exit recovery、publication recovery、disconnect reconnect exact Intent、route CAS、context fencing。它們不代替線上 PowerShell timeout 的完整恢復驗收。
- installed Pi 1.0.4 是 dependency evidence；正式 ExecutionIntent controller 不需要 model request。此測試沒有呼叫 Pi agent sidecar 執行任意命令，因此不能當作 sidecar/model dispatch 或已部署 production 的驗收證明。

## 變更與 regression

- `server/src/mcp-server.mjs`：唯一 runtime 修正，bounded fixed metadata lane。
- `scripts/pi-runtime-phase2-trace.mjs`：fixture-only segmented tracing。
- `scripts/pi-runtime-phase2-e2e.mjs`：actual SDK/MCP／Pi／PowerShell、idempotency、mutation guard、timeout fail-closed 檢查。
- `scripts/pi-runtime-phase2-live-readonly.mjs`：無 mutation 的 live metadata observation。
- `scripts/pi-runtime-phase2-summarize.mjs`：trace correlation／分段與 percentile evidence、raw SHA256。
- `tests/mcp/pi-runtime-phase2.test.mjs`：真正 PowerShell holder 期間 metadata 提前完成、禁止 duplicate／uncertain replay 的 regression。
- 本報告、structured evidence 與 gzip 原始 trace。

第一組 focused tests 71 passed / 0 failed，涵蓋 execution contract、production execution、PowerShell maintenance、journal-resolution 與 Phase 1 pressure 九項測試。第二組 final affected tests 39 passed / 0 failed，涵蓋新 E2E、production execution、readiness、profiles、HTTP resource bounds、checkpoint runtime、transaction runtime。測試的臨時資料與程序均屬本輪，不終止其他工程。未執行 `dev_run_tests(all)`。

完成順序斷言的最終單獨 E2E 重跑亦 1 passed / 0 failed（43.42 秒）。Git diff-check 已通過；candidate commit 在本文件旁的 Git history 與交付回覆提供，不把尚未建立的 SHA 寫成證據。

## 風險與 next_action

本輪是可 review 的隔離候選，Phase 2 整體未封板。保留 final source 的 security predicates；benchmark candidate 在加入兩個 registry safety predicates前已量測，最終 focused E2E 使用完整 predicates 通過，未把後者當作新的效能樣本。

下一輪先取得**自有已註冊 live workspace**，用既有 HTTP diagnostics／readiness IPC 對同一 request／intent 做 connector→adapter→server correlation，補 queue／cold readiness／admission／回程權威證據；避免借用活躍工程 context。與 Journal owner 協調大 history 的 repeated verification 量測，再決定安全縮減。對 timeout 另建可 attribution 的 reconciliation fixture，驗證 append-only resolution、resume、無 replay；不能刪 state 或解除鎖。之後補 production-equivalent 正常／鎖競爭 benchmark，交 GPT 最終驗收。本機初次 failure diagnosis fixture `C:\Users\day25\AppData\Local\Temp\pi-phase2-q3k8Vy` 因 `--keep` 保留，僅是本輪離線 debug state；正式 benchmark 的證據已保存於 Git，fixture 安全清理。

重現：`node scripts/pi-runtime-phase2-e2e.mjs <output.json>`；focused：`node --test tests/mcp/pi-runtime-phase2.test.mjs`。raw gzip 解壓後可重新執行 summarize，JSON evidence 內含原始 bytes SHA256 與所有 request 的分段統計。
