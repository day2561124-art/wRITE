# Pi Runtime Pressure Phase 3：HTTP correlation 與安全接續

本輪提交低成本 request tracing 與正式 HTTP fixture 的 completed-response-loss recovery 驗證。**候選尚未部署；local MCP live PowerShell 被 504 阻塞，ChatGPT／HTTP production E2E 未通過。**本輪未 integrate、push、cutover，未修改 production routing。

## 接續、ownership 與 lease

Base：Phase 2 `bf946c6f7c1e0033fef1525b924973d35cbf7daa`，其 parent candidate Phase 1 `8e9b561b86e009e8df86734d980aa586538d8f2e` 已確認。worktree `E:\武裝學院的二三事\.runtime-phase1`、branch `codex/pi-runtime-pressure-phase1`，起始無未提交修改，Phase 1／2 文件及測試證據已核對。main 仍為 `fcfba25de3fc521ea73e326d190ab358ee58d513`，既有 dirty overlay 保留。

工作區沒有其他工程接手的證據；本輪 registry 唯讀核對七個非終止 workstream。Pi Continuation 持有 Journal／journal-resolution，UER 持有 reliable store／suite-groups；未修改這些檔案、其他 worktree 或鎖。Phase 1 的 locking/cache/cleanup 行為與 Phase 2 metadata lane 原理保留，只增加 tracing 與必要 fixture 相容接點。

Execution lease：2026-10-08 13:46:19–14:11:19 UTC（台北 21:46:19–22:11:19）。v1.2 依本次明示工程要求執行；未找到額外同名規則文件。本輪以 correlation 為主，保存未完成 live operation，不啟動 Journal full-history benchmarking。

## 實作與隱私

沿用 `diagnostics_channel`、`performance.now()`、AsyncLocalStorage，以及現有 child IPC、HTTP readiness endpoint `/ready`。HTTP parent 為每個 POST 產生 UUIDv4 correlation ID，透過非能力參數 `_meta.writer_workbench_trace_id` 傳到 adapter／child；不改 ExecutionIntent JSON、command、fingerprint 或權限。adapter 回覆附同一 metadata ID；HTTP 同時提供 `X-Mcp-Correlation-Id`。

trace 僅允許四個欄位：correlation_id、固定 stage、monotonic duration_ms、函式返回是否正常的 ok。未知 stage／非法 ID／非有限 duration 拒絕；其餘欄位全部剝除。**ok 表示該函式正常返回，不表示 mutation 或 PowerShell 成功。**命令、輸出、secret、request 原始 ID、路徑和 error text 都不進入 trace。

每個 ring 256 records，child 既有 IPC 每 batch 至多 64 records、pending 至多 256，只有一個 IPC send in flight；非同步 setImmediate 發送，不寫 trace 檔、不使用同步 logging。queue、readiness、Pi admission／transition／dispatch／reconciliation、projection read／append、checkpoint lock acquire、PowerShell process 與 response serialize/write 均有固定 spans。未載入 IPC subscriber 的 stdio context 不收集 spans。既有 routing、profiles、mutation protection、PowerShell `low-risk-write` 分類、Journal 和 checkpoint atomicity 不變。

ring 淘汰是明確觀測限制：本次 integration test 選擇仍完整保留的同一 correlation ID 驗證所有層，沒有將不同 request 的資料拼成一筆。IPC 收集有可能因 backpressure 淘汰；不將缺失 span 推定為零耗時。跨 process 只比較本 process 的 duration，不相減時間戳。

## 各層 latency 與歸因

正式隔離 HTTP fixture 實際經過 SDK HTTP → HTTP parent → stdio adapter → MCP server → Pi production controller → capability → PowerShell → Journal receipt。相同 ID 已驗證包含：HTTP body read／response finish、transport round trip、MCP queue wait、readiness、Pi admission／state transition／capability dispatch、PowerShell process、MCP serialize/write。

`transport.round_trip` 包含等待 child 的總時間，不能視為 transport 自身耗時；`mcp.queue_wait` 則直接量到 parsed enqueue → dispatch。`powershell.process` 直接量到 child process execution。projection read／append 包含內部驗證及可能鎖等待，**沒有**把它拆成已量到的 Journal lock wait；Journal owner 檔案未動。checkpoint acquire span 與操作執行分開，Phase 1 regression 仍通過。

JSON evidence 列出每種 retained span 的 count／P50／P95／max，以及整體 SDK 呼叫統計。這是 bounded retained population，並非每筆 request 的完整分區；inclusive stages 有巢狀，不能相加。冷 readiness 的早期 records 可能已淘汰；沒有猜測缺失時間。本輪只增加可觀測性，沒有基於此樣本宣告 production latency 已改善，也沒有把 Phase 2 status／fixture 指標混入此 benchmark。

ChatGPT 客戶端、外部平台、代理佇列及 TCP 回程未直接觀測；HTTP response finish 只表示 server 完成回覆，不代表 caller 收到。線上 route query 的 61,906 ms 是外部 wall-clock 觀察，非 monotonic benchmark、非任一內部 stage 耗時。

## 驗證分級

| 等級 | 狀態 | 可核對結果 |
| --- | --- | --- |
| isolated fixture | verified | 真正 HTTP／Pi／PowerShell 與 cross-layer correlation、privacy、dedup 通過 |
| local MCP live PowerShell | blocked | live bootstrap 已 admission，但 API 504，未取得合法 isolated binding，因此未發 PowerShell intent |
| ChatGPT／HTTP production path | partial | connected route 查詢成功且仍 pi_default；正式 bootstrap 和 durable status API 都 504；無 E2E PASS |

最終 HTTP fixture：正常三次、並行四次、queue holder 一次、completed-response-loss 命令一次、exit 7 一次、timeout 一次，共 **11 次實際 PowerShell child admission**。duplicate、直接 powershell guard 拒絕、write permission 拒絕、completed operation duplicate，以及 unresolved timeout retry 都沒有額外 command。正常結果 stdout、exit 0、elevated=false 已核對；回覆遺失命令另驗證 stderr=`PI_PHASE3_STDERR`，stdout=`PI_PHASE2_OK`。

回覆遺失注入在 SDK client fetch：真正 HTTP body 完成後，故意不交給 caller 並拋 `PHASE3_RESPONSE_LOST`。先使用相同 intent/context 查 operation，得到 `COMPLETED`；再相同 intent 返回相同 Pi／child operation，沒有重複執行。这是 client-injected completed response loss，**不是**真實外部網路 outage。physical transport crash/hang/disconnect 的 safe retry／no-mutation-replay 另由 affected regression 驗證，不用它宣告線上恢復通過。

## Timeout 與 live 504 的安全邊界

Fixture process timeout 仍由 `timed_out=true`／`ok=false` 明確表示；父 mutation 進入 ambiguous_effect，後续 durable write 拒絕 `JOURNAL_DEGRADED`，相同 intent retry 不再執行。hash chain verified，無 dangling／active Journal operations，degraded 原因明確為 ambiguous terminal requires reconciliation。**append-only resolution／resume 後恢復尚未測試**，不能將未知 outcome 推定為失敗或成功。

Live 原始精確 intent 保存在 evidence：`phase3-live-bootstrap-20261008-2146`。504 後沒有重送；先查 durable status，仍 504。只讀自己已知少量事件，觀察到 `pi_operation_ab4776c172b84bfa921ee99117a6728d` revision 4，狀態 PREPARING，owner PID 27008、active_call=null、lifecycle_binding=null。local PID probe 當時已不存在。這是 **partial filesystem observation**，沒有全鏈驗證、沒有把歷史 PID probe 當作 authoritative owner recovery。未強制解鎖、移除 owner、解除 worktree lock、手動改 state 或啟動 mutation retry。

## 修改檔案與原因

- `server/src/mcp-request-tracing.mjs`：固定 schema、bounded memory／async IPC tracing。
- `server/src/mcp-http-server.mjs`：HTTP correlation、body／finish timings，既有 `/ready` 提供 bounded snapshots。
- `server/src/mcp-http-stdio-adapter.mjs`：correlation forwarding、IPC validation、round trip、bounded status snapshots。
- `server/src/mcp-server.mjs`：queue、readiness、capability 和正常／error response spans；既有雙 lane 保留。
- `server/src/pi-production-execution-controller.mjs`、`pi-reliable-execution-engine.mjs`：admission、projection、transition、dispatch／reconciliation spans，未改調度或 persistence 邏輯。
- `server/src/mcp-development-checkpoint-tools.mjs`、`mcp-powershell-maintenance-tools.mjs`：只包住 lock acquire 與 process execution 的計時。
- `scripts/pi-runtime-phase2-e2e.mjs`：共用既有 fixture builder，增加可信 transport factory／before-fault test hook；默认 Phase 2 檢查保留。
- `scripts/pi-runtime-phase2-trace.mjs`：適應新增 tracing wrapper，避免舊 focused test 的 hook 因字面入口改變而失效。
- `scripts/pi-runtime-phase3-http-e2e.mjs`、`pi-runtime-phase3-live-observe.mjs`、`pi-runtime-phase3-summarize.mjs`：HTTP fixture、自己的 bounded live observation、結果彙整。
- `tests/mcp/mcp-request-tracing.test.mjs`、`pi-runtime-phase3-http.test.mjs`：privacy／bounded IPC／scope isolation／正式 HTTP recovery tests。
- 本報告與 structured evidence：安全 checkpoint／交接邊界。

## Tests、自我審核與接續

第一組 focused 61 passed / 0 failed，包含 Phase 1 九項 pressure regression、Phase 2 真正 PowerShell queue regression、production route/context/recovery、execution contract、PowerShell maintenance、readiness 和新增四項 trace tests。HTTP affected 5 passed / 0 failed，包含 connector negatives、origin security、resource bounds、session lifecycle、transport crash/hang/overflow/retry。最終 HTTP／privacy／reliability 組驗證 stderr、正常及錯誤回傳、lost completed response／dedup，結果於 evidence 記錄。未執行 all suite。

自有 HTTP parent/child 已 drain 並退出，SDK session 結束，自己的 temp fixture／worktree 安全清理；沒有終止其他工程程序。live bootstrap 未完成，故沒有以候選 commit 當作工程封板。Git diff-check／candidate SHA 於 Git history 與交付回覆提供。

next_action：先恢復 authoritative API status，讀上述**同一** intent／operation 的完整 history 與 owner 狀態，由 Pi 決定 safe resume；不要另建 bootstrap、不要強制 clear owner。取得自有合法 binding 才做 live PowerShell、stdout／stderr／exit／duplicate／operation lookup。接著在另一個可 attribution fixture 驗證 timeout append-only resolution、resume、无 replay。Journal full-history status／verify／append／lookup／contention baseline 本輪 **not tested**，下一輪協調 active owner 並避免共享 mutation，不能把 Phase 2 lstat 掃描視為 hash verification。

重現：`node --test tests/mcp/mcp-request-tracing.test.mjs tests/mcp/pi-runtime-phase3-http.test.mjs`；使用 `PI_PHASE3_EVIDENCE_PATH` 指定自有輸出檔。25 分鐘邊界前保留證據與 exact intent，停止新增長操作。
