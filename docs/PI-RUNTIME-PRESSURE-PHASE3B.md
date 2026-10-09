# Pi Runtime Pressure Phase 3B：原始 Live operation 權威核對

本輪完成 P0-A 的正式狀態回查與必要 P0-B 診斷。**原始 operation 正式狀態為 PREPARING，終態 UNKNOWN，recovery closure BLOCKED。**沒有重送 intent、建立替代 bootstrap 或執行 PowerShell。沒有 runtime 修復、部署、integrate、push 或 cutover；Phase 1–3 候選完整保留。

## 基準、ownership 與安全邊界

隔離工作區 `E:\武裝學院的二三事\.runtime-phase1`，branch `codex/pi-runtime-pressure-phase1`，起始 HEAD `9c4b94bf1528e802fd2207ba24d62fbe893b8868` 且 clean；Phase 1／2 ancestor 與證據已核對。main HEAD `fcfba25de3fc521ea73e326d190ab358ee58d513` 及既有未提交修改保留。Registry 有七個非終止 workstream，Pi Continuation 使用 Journal／resolution，UER 使用 reliable store／suite-groups；未修改其檔案、鎖或 worktree。

Lease：2026-10-08 14:14:40–14:39:40 UTC（台北 22:14:40–22:39:40）。依使用者要求先完成原始狀態核對，安全保存證據後交接。本報告及 JSON 是接續證據，沒有為診斷建立新的 live Checkpoint 或改動 operation。

## P0-A：同一筆 operation 的正式權威狀態

使用現有部署服務 `http://127.0.0.1:8787/mcp`、官方 MCP SDK 與自有唯讀 session，正式呼叫 `dev_pi_execution_status`，參數為原始 operation ID 和 `bootstrap:true`。沒有直接讀 Store 冒充正式 API，也没有繞過 Pi route guard。

| 識別／狀態 | 實際結果 |
| --- | --- |
| Intent | `phase3-live-bootstrap-20261008-2146` |
| Operation | `pi_operation_ab4776c172b84bfa921ee99117a6728d` |
| Intent hash | `730ee2354cb32fbf57caa898d8a89321b6ebebfc11bb30e1d0c32e568c0e2779` |
| 正式狀態／revision | `PREPARING`／4 |
| 最後進展 | `2026-10-08T13:55:25.323Z` |
| 終態／completed_at | UNKNOWN／null |
| Tool calls／results／receipts | 全部為空 |
| Active call／lifecycle binding／Checkpoint | 全部為 null |
| Owner | hostname SDCP，PID 27008，worker `pi_worker_94a8fa3836614899b0d41f958c2ce50d` |
| Route | `pi_default`，revision 1，未變更 |

用既有 `createExecutionIntent`、`hashExecutionInput`、`validateOperationState` 核對完整正式結果與 Phase 3 exact intent，一致且通過 validation。Original intent 只有 `workspace.begin_workstream`、`workspace.create_isolated`，沒有 PowerShell action。正式狀態沒有 capability dispatch 證據；Pi admission／projection 的 Journal 寫入確實已發生，不能把「尚無 capability mutation」寫成「完全沒有 durable mutation」。尚未取得自有 workspace binding。

Host Win32_Process 唯讀核對確認 PID 27008 不存在、自有讀取 child 26940 已退出、HTTP parent 7348 存活作為 positive control。Sandbox 內 Get-Process 對已知 parent 也回報不存在，因此那組 sandbox 結果不作為 owner 判定依據。PID 查詢只是本機存活佐證，不替代 Pi 的 owner fencing／安全恢復驗證；沒有手動 clear owner。沒有可證明有效 executor／租約／持續進展的證據。

Journal 正式健康查詢回傳 `healthy`、`chain_verified=true`、sequence 51362、active=0、dangling=0、reconciliation_required=false。最新 event `dev_journal_event_734f9bdaa15e4aadbb7ee7f4c4ef7d1f`，hash `f1351e82f10154a36a21e377affef3cbcc4868dae18af73186b0401c30650c8e`；與 Pi projection receipt 的 event hash／sequence 一致。其 Journal operation 為 `dev_operation_58072f2a2e56434f86cec2cc335c4ddb`。

Checkpoint 正式查詢 `healthy`，registry revision 289，283 checkpoints（277 active、6 deleted）。原始 Pi operation 沒有 checkpoint。**Journal active=0 描述 Journal 子操作，不能推論邏輯 Pi operation 已終止。**Store healthy 不等於 stalled owner 已恢復。

## P0-B：504 歸因與可觀測邊界

本輪 connected connector 對同一 operation 的正式查詢仍收到 transport error：`unexpected server response: HTTP 504: error code: 504`。未取得 response headers、原始 HTTP correlation ID 或 gateway 設定，沒有將工具外部等待時間當成內部 stage；504 發出層、期限及實際超限階段保持 UNKNOWN。

本機 HTTP parent `/health`、`/live` 為 200；服務 identity 為 PID 7348、instance `21994c28-0879-4ce7-b270-35dda0addc99`、啟動時間 `2026-10-08T08:37:59.183Z`、報告 revision `23a1422db197bf73ad1e53fa37703da3962e2ee5b003e99b5bee34f4a1195896`、profile `chatgpt_developer`。這是部署服務回報的 identity，不等同目前 main dirty source。Phase 3 tracing 候選未部署，無法把隔離 tracing spans 套用到原始請求。

自有 session 的 `/ready` 與狀態回查採 `performance.now()`：

| 量測 | Calls／成功 | P50／P95／Max ms |
| --- | --- | --- |
| 原始 Pi status，冷 session | 1／1 | 128700.879／128700.879／128700.879 |
| Journal status，同一已 ready session | 1／1 | 3589.629／3589.629／3589.629 |
| Checkpoint status，同一已 ready session | 1／1 | 5320.423／5320.423／5320.423 |

這些是各一筆觀測的描述統計，不是可靠的 population P95，也不是修復前後 benchmark；沒有 runtime 修復。單一冷 Pi status 與另外兩種暖查詢不可當成同一工具的 before／after。正常／競爭／並行分布未測，不向其他活躍工程增加壓力。

SDK connect 約 705.445 ms。從 **connect start** 的 monotonic poll origin 計算，最後 not-ready 30808.610 ms、首次 ready 36266.216 ms；這個 bracket 包含 poll／HTTP 回覆時間，不是精確 bootstrap duration。Readiness metadata 的 UTC start／complete 為 14:21:27.124Z／14:22:01.087Z，僅作 log correlation，不與 monotonic stages 混算。

首次 ready 至 126532.604 ms 的同一 status pending sample，跨度 **90266.388 ms**；以 sample elapsed 小於 status 的 measured duration 作保守篩選，排除後續 Journal／Checkpoint 查詢。故可證明 readiness 後仍有約 90.3 秒等待，不能把 128.7 秒全部歸因初始化。當時 pending_calls=1，child 沒有 last_exit，call_timeout_ms=300000；本次本機查詢不是 adapter 300 秒 timeout。沒有提高部署 timeout；SDK 使用既有普通 call timeout。

已審查 status controller 的多次 history read／validation 和 route lookup；這是結構性重複工作的線索，**沒有獨立量到其每段成本，不能宣告 Journal 為 90 秒根因**。Queue、Pi lookup／validation、Checkpoint lock、Journal lock／persistence、serialization 和 response return 均沒有本次 deployed spans，保持 UNKNOWN。此 status 不含 PowerShell execution。

HTTP server／adapter 原始碼沒有明示 504 emitter，因此 upstream gateway／connector 是候選解釋，尚未得到可確認 emitter 的 authoritative logs。不能將本機成功與 connector 504 拼成同一 HTTP request 的完整 trace。

另確認 lifecycle code：`transport.onclose`／`onsessionclosed` → `closeBridgeSession` → stdio session `close()` → terminate owned child。這證明 **session 結束會關閉承載 worker 的 child**。尚缺原始 session ID／close log，不能證明是原始 504 觸發關閉，也不能說 HTTP caller timeout 必然等同 session close。Idle-session 機制保留 active-call 防護。本輪未修改生命週期架構或 production routing。

## Recovery／E2E 分級及驗證

| 驗證項目 | 本輪結論 |
| --- | --- |
| 原始正式 local HTTP status retrieval | verified，完整原始 intent／state／lineage 已保存 |
| 原始 terminal recovery closure | BLOCKED，非終態與 absent owner；沒有 replay／resume |
| 原始 HTTP 504 attribution | partial，精確 gateway／correlation／timeout 原因 UNKNOWN |
| Fixture contract／crash／transport timeout／dedup regression | 50 passed，0 failed；不替代原始 live recovery |
| 新的 controlled fault injection | not tested |
| Local live Pi → PowerShell E2E | not tested，原始 reconciliation 尚未完成 |
| ChatGPT 真實產品 E2E | blocked，沒有 PASS |
| Journal hash integrity／Checkpoint health | verified，正式 API 結果 |
| 完整大型 Journal scaling／並行成本 baseline | not tested |

Focused／affected：`node --test tests/mcp/pi-execution-contract.test.mjs tests/mcp/pi-production-execution.test.mjs tests/mcp/mcp-http-reliability.test.mjs tests/mcp/mcp-request-tracing.test.mjs`，50 tests、50 pass、0 fail、0 skipped，約 19.99 秒。包括 uncertain mutation 不盲目 replay、exact intent reconnect、worker 在不同 durable 邊界退出後恢復一次、context／mutation guard、transport crash／hang／overflow、安全唯讀 retry、tracing privacy。完整 TAP 與 SHA-256 保存於 JSON。沒有执行 `dev_run_tests(all)`，沒有重做既有修正。Phase 1／2 全組不另重跑；runtime 完全未修改，這組只核對本輪受調查 contract／recovery／HTTP 安全邊界。

## 檔案、審核與下一輪

- `scripts/pi-runtime-phase3b-live-status.mjs`：固定同一 operation 的正式唯讀 SDK 查詢、自己 session 的 readiness poll、monotonic latency 與健康證據；只關閉其自有讀取 session。原始 capture 的 close flag 表示當時 cleanup 路徑已走完，另由 host probe 證明 child 已退出；後續脚本已將 cleanup failure 明確記錄，避免錯誤成功回報。
- `scripts/pi-runtime-phase3b-summarize.mjs`：離線驗證官方 intent／state、hash／lineage／host positive control，保存完整正式 responses、單點統計、測試結果與 UNKNOWN 邊界；沒有 capability 執行。
- 本報告及 `docs/PI-RUNTIME-PRESSURE-PHASE3B.evidence.json`：保存原始識別資訊、精確 contract、量測及 blocker。資料是已授權 bootstrap 的 durable evidence，不是 command trace；没有 PowerShell command、secret 或使用者內容進入新的 tracing。

Git diff-check 已通過；candidate SHA 由包含本報告的 commit 及交付回覆提供，避免在 commit 內容內嵌自身 SHA。未改動 tracked runtime 或其他工程檔案，僅新增以上四檔。

**next_action：**下一輪先透過正式 status 回查 **同一** `pi_operation_ab4776c172b84bfa921ee99117a6728d`，由 Pi 核對完整原始 history／receipts 與 owner liveness／fencing，再用原始 `phase3-live-bootstrap-20261008-2146` exact contract 和 idempotency keys 決定安全 resume。保留自有 session 至 durable 結果明確，避免 caller deadline 後無證據地 close 承載 operation 的 session。不可新建替代 intent 或手動 reset owner。同步取得原始 gateway correlation、timeout config／headers 和 session-close logs，才能判定 504 emitter／lifetime 原因；只有原始 reconciliation 到安全終態並取得自有 binding，才開始新的 Live Pi PowerShell E2E。

重現只讀回查：`node scripts/pi-runtime-phase3b-live-status.mjs`；離線 audit：`node scripts/pi-runtime-phase3b-summarize.mjs`（使用同輪自有 capture／host probe／TAP）。前者只發三個正式 status calls，可能需約數分鐘，必須在新 lease 有足夠餘裕時執行。完整本輪 evidence 已提交在 JSON，不依賴 temp 檔才能閱讀結論。
