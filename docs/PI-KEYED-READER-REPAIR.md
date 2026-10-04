# Pi Journal keyed-reader prerequisite repair

本候選獨立於 Pi Continuation Trigger。Production source change 僅一行：keyed scan 的 preliminary physical bound 從 normal 128 KiB 對齊既有 typed execution event 1 MiB；原 `parseEvent` 繼續依 event type 保留各自 128 KiB / 1 MiB 限制。

真實問題：Pi 合法保存一筆大型 typed ExecutionIntent 後，所有後續 keyed scan 都被 normal-event physical bound 拒絕。既有 parser / verifier / publisher 本來允許 typed event 1 MiB，故這是 reader 不一致，不是 migration。

驗證使用 genuine Pi reliable projection 與既有 Journal：合法大型 typed event 後的 keyed admission、duplicate、conflicting fingerprint；normal >128 KiB、typed >1 MiB 均保持拒絕。另以未修正 baseline 執行同 regression，必須觀察到原缺陷。

修正不包含 Trigger、Browser、Local Model、workflow mutation 或 production control mode；不刪改任何已保存 Journal event。正式 deployment 需使用既有 integration seal / active-operation 拒絕機制，保留其他 workstream dirty state；不得強制終止正在執行的 MCP / GPT 工作。

2026-10-04（Asia/Taipei）結果：未修正 baseline 為 2 PASS / 2 FAIL，兩個 FAIL 均為真實 `Unsafe journal event file` reader defect；一行修正後為 4/4 PASS、0 skip。原始完整 MCP contract suite 在 source freeze 後 PASS，未新增 Trigger 到該候選。

完整 suite 前兩次執行分別在既有 profile readiness 前後結果不一致，以及 PowerShell 5 秒範例 timeout 失敗。各自獨立診斷重跑 PASS；未改測試或 timeout。之後整批完整 suite PASS。環境負載是可能因素，未證實為根因；首次 failures 不從紀錄移除。

Source provenance 使用前置 Phase F 的 GPT explicit diagnostic fallback 與既有純 filesystem / Git tools；source producer、before/after digest 均在原 Development Journal。Production deployment 不包含半成品 Trigger，且需要另外通過 exact-candidate integration validation。候選測試通過不代表目前已載入 runtime 修正。
