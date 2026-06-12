Phase 8J — Full creative workflow final smoke test

目的：驗證 Phase 8B～8I 的主流程從 GPT writing context 到 active_engine 啟用確認能完整閉合。

要點：
- 覆蓋 GPT writing context → chat output writing candidate → candidate proofing → proof report → adoption request → adoption 確認 → adopted writing → settlement context → settlement report → pending_engine_candidate → review → activation request → activation 確認 → fixture active_engine 更新。
- 測試僅在 fixture workspace 修改 active_engine，正式 active_engine 不變。
- MCP / creative task 不得直接 activate，activation 必須走 approval queue。
- UI 直接 activation 仍被阻擋（409 或既有 blocked response）。
- rollback 仍需 approval。
- 未新增任何 OpenAI 或外部 LLM API。

新增項目：
- tests/creative/full-creative-workflow-final-smoke.test.mjs — 完整總煙霧測試。

測試結果：請執行 `npm.cmd test` 以驗證所有測試通過後，檢查 `data/canon_db/active_engine.md` hash 與下列 hash 是否一致：

D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB

備註：此變更僅新增測試與說明，未自動提交任何檔案。若測試失敗，請停止並回報錯誤與已修改檔案清單。
