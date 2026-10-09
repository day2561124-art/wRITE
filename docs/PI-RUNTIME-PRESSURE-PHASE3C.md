# Pi Runtime Pressure Phase 3C：核心修復候選與 regression 收尾

本輪完成 Status snapshot 與 long-tool timer 的最小修復、focused／affected regression 和隔離候選提交。原始 Live operation 仍為 **EXECUTING／UNKNOWN**，未安全结算，**Integration Gate 不具備**。沒有 integrate、push、cutover 或 SEALED 宣告。

## 基準及範圍

沿用 worktree `E:\武裝學院的二三事\.runtime-phase1`、branch `codex/pi-runtime-pressure-phase1`；起始 HEAD `a88f09d7344f0b624b2cc39fef1a070f3d271a3c`，當時 clean。Phase 1–3B 修改完整保留。核對七個非終止 workstream；避開 Pi Continuation 的 Journal／resolution 與 UER 的 reliable store 修改範圍，沒有修改 main、其他 worktree 或共享 Journal 檔案。

原實作 lease 為 2026-10-08 14:42:28–15:07:28 UTC。使用者於台北 2026-10-09 再次授權接續，只要求收尾既有測試、diff-check、candidate commit；此收尾回合自 16:28:32 UTC 開始，不重跑已通過工作，不再次 resume 或 resubmit live intent，不新增工程階段。

## Status snapshot 修復

同一正式 operation-status handler 原本呼叫 `controller.status()` 再 `inspect()`，重複讀取 execution history **5 次**、route history **3 次**。每次 underlying Journal read 都執行既有 verify；controller／store 亦重複驗證相同 Pi projections。這是可重現的額外成本，修復範圍僅在 status 路徑。

修復後 `inspectStatus()` 在**單次只讀查詢內**使用一份已完整驗證的 execution snapshot 和一份 validated route history；保留原有 store context validation、完整 history validation、production enrollment／admission-route proof、receipt／output 內容。沒有跨請求 cache、跳過未驗證歷史或更動 append-only／hash-chain；mutation prepare、admission、owner fencing 和 append-lock CAS 仍讀新狀態。普通 route-only 查詢維持既有流程，非法 operation context 在 expensive lookup 前拒絕。

交錯各八次、同一自有 real-Journal fixture、核對完整結果一致：

| 指標 | 原候選 | Status 修復候選 |
| --- | --- | --- |
| 呼叫／成功 | 8／8 | 8／8 |
| P50 | 92.815 ms | 24.148 ms |
| P95／Max | 102.667 ms | 26.728 ms |
| Execution history reads／request | 5 | 1 |
| Route history reads／request | 3 | 1 |

這是 **隔離 controller fixture**，不是 Live HTTP 或 ChatGPT E2E。Live 既有服務重現 status 為 **129965.480 ms**；逾時後只讀回查為 **139591.971 ms**。候選尚未部署，不能宣告 production 延遲已改善，也不能用隔離毫秒數推算 128.7 秒全部內部耗時。

Live Journal reader 的分段診斷未取得可用 before／after：原候選 reader 遇到 `CORRUPT_STATE`，修復 reader 遇到 `JOURNAL_LOCK_CONTENDED`。候選 Journal reader 與部署服務存在來源差異，且有共享 contention；**不能因此宣告正式 Journal corrupt**。未強制解鎖、修復共享 Journal 或追加大型 Journal benchmark。HTTP gateway、外部 queue、全部 129.965 秒的分段歸因仍未確認；保留 Phase 3B 的觀測邊界。

## Long-tool timeout 修復

原始 same-intent recovery 由部署 adapter 回報 `MCP child call timed out after 300000ms`，呼叫實測 **300023.315 ms**。隨後 host 程序核對確認原 executor PID 6176 已不存在，以存活 HTTP parent 7348 作 positive control。

已證實 source 缺陷：`timeoutForRequest` 為既有 long-tool 選定 **28800000 ms**（8 小時），但 `registerListener` 的範圍驗證最多只接受 **1800000 ms**（30 分鐘），超過上限便錯誤回落普通工具 timeout；部署值為 300000 ms。這與本次 typed timeout 一致。新增測試直接觀察實際註冊的 timer，修復前確實失敗，修復後通過；另核對普通 `dev_pi_execution_status` timer 仍使用原本普通 timeout。

只將 listener 驗證上限改為既有 `MAX_LONG_TOOL_CALL_TIMEOUT_MS`。沒有提高 timeout 設定值、擴充 long-tool allowlist 或放寬 PowerShell 過濾；capability 的內部 deadline、普通工具 timeout、安全唯讀 retry 與 mutation no-replay 都保留。這修復設定值被錯誤丟棄的 bug，不是以延長 status timeout 掩蓋延遲。未改動部署程式，未再次驗收 live long-tool recovery。

## 原始 operation 的結果與隔離措施

原 intent `phase3-live-bootstrap-20261008-2146`，operation `pi_operation_ab4776c172b84bfa921ee99117a6728d`，intent hash `730ee2354cb32fbf57caa898d8a89321b6ebebfc11bb30e1d0c32e568c0e2779`。

在使用者收尾限制之前，正式 status 查回 PREPARING revision 4；官方 contract／state／exact intent 核對通過，Journal chain healthy，host positive-control owner probe 通過。兩個原始 idempotency key 經正式 MCP lookup 都為 `not_admitted`、要求 `reinitiate_requires_same_key=true`。這些 durable 證據才是一次正式 Pi recovery 的依據，沒有僅憑 executor 不存在推定未執行。Pi 自行讀取 history、owner fencing、revision CAS；沒有建立替代 intent 或直接呼叫 PowerShell。

正式 recovery 一次之後留下新 owner、EXECUTING、`begin` durable claim；adapter 300 秒 timeout 後，**未再次提交或 resume**。其後正式只讀 status 查回 **EXECUTING revision 7**，active claim 為 `begin`，無 completed receipt／lifecycle binding／工具結果。未知 outcome 仍需 reconciliation，不能推定 capability 成功或沒有副作用。原始 intent 是 workspace bootstrap，本身沒有 PowerShell action。

正式 post-timeout Journal／Checkpoint 查詢已返回 healthy，Journal chain verified；健康狀態不等於 logical Pi operation 已終止。正式完整 responses、原始 contract、idempotency lookup、有限原始事件與 host probe 保存於 JSON，filesystem observation 明確標示不替代 terminal authority。

恢復 timeout 後沒有 DELETE 執行 session、強制終止其他程序或清除 owner/state。自有 session `ed450214-ef29-476f-97ff-881d2b622600` 保留作後續 lifecycle review；不是再執行 mutation 的許可。此收尾回合只讀取已完成的診斷結果，不啟動新的 live 操作。最新使用者限制為 **禁止 resubmit、再次 resume、替代 intent；只允许唯讀核對**。

## 驗證及交付

最終 focused／affected regression：**65 tests、65 passed、0 failed、0 skipped**，約 79.277 秒。涵蓋新增 snapshot 單次 reuse、下一查詢 freshness、parallel scope isolation、context mismatch／corruption fail-closed；既有 immutable contract／mutation protection／duplicate intent、worker recovery、實際 timer、普通 timer、transport retry/no-replay、tracing privacy；Phase 1 checkpoint 鎖競爭／recovery，Phase 2 真正 Pi → PowerShell fixture，Phase 3 HTTP Pi → PowerShell／completed-response-loss／dedup fixture。

新增 timer 測試的修復前 assertion failure 及最終完整測試輸出保存於 JSON。Fixture PowerShell 正常路徑、stdout／stderr／exit、guard／duplicate 和 timeout ambiguity 沒有退化；**local live、HTTP live、ChatGPT production PowerShell E2E 未通過／未執行**，不以 fixture PASS 冒充 Live PASS。沒有執行 `dev_run_tests(all)`。

修改檔案：

- `server/src/pi-production-execution-controller.mjs`、`server/src/mcp-server.mjs`：單一只讀 status snapshot／相同結果與 context protection。
- `server/src/mcp-http-stdio-adapter.mjs`：listener timer 上限與既有 long-tool 設定一致。
- `tests/mcp/pi-production-status-snapshot.test.mjs`、`tests/mcp/mcp-http-reliability.test.mjs`：status freshness／安全與實際 timer regression。
- `scripts/pi-runtime-phase3c-status-benchmark.mjs`：隔離交錯比較，完整結果一致。
- `scripts/pi-runtime-phase3c-status-probe.mjs`、`scripts/pi-runtime-phase3c-reconcile-live.mjs`：保留先前已執行診斷／一次原始 recovery 的可核對程式；後者本輪收尾**沒有重新執行，依最新限制不得再次執行**。
- `scripts/pi-runtime-phase3c-summarize.mjs`、本報告／JSON：持久化測試、健康、未知 outcome 與 commit 接續證據。

Git diff-check／staged diff-check 通過後建立隔離候選 commit，SHA 由該 commit 及交付回覆提供；不將自身 SHA 寫入自身內容。後續只允许唯讀核對原 operation／receipts；任何進一步 recovery、production 整合均等待新工程授權。**完成此候選提交即停止；Integration Gate=false。**
