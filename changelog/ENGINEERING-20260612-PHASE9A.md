Phase 9A — Minimal Writer Workbench UI

目的
- 建立 Minimal Writer Workbench（中文顯示「寫作工作台」）前端面板與後端 glue endpoints，以安全方式向使用者暴露 Phase 8B~8I 的主要創作工作流程。

改動要點
- 新增 UI 面板：在前端加入 `Writer Workbench` 頁籤與最小互動元件，路徑：`server/ui/index.html`、`server/ui/app.js`。
- 新增後端聚合與 glue endpoints：`GET /api/writer-workbench/state` 以及若干 `POST /api/writer-workbench/*` 以包裝現有 service（建立 context、保存 candidate、建立 proofing context、保存 proof、請求採用、建立 settlement context、保存 settlement report、建立 pending candidate review、請求啟用）— 所有寫入操作仍經由既有安全流程與 approval queue。
- UI 可操作 Phase 8B～8I 主流程，但採用與啟用仍需透過確認佇列（Approval Queue）人工確認。
- UI 不會在本地直接生成正式正文（no local canonical generation）。
- UI 不會直接啟用 `active_engine`（direct activation blocked）；啟用必須經由 `pending_engine_candidate` 流程與 approval queue 確認。
- UI 不會新增或整合 OpenAI 或任何外部 LLM API。

安全與邊界
- Adoption / Activation 流程仍需透過 Approval Queue 的人工確認。
- 任何 direct activation 嘗試在 UI 層被封鎖（需要第二階段確認與 approval item）。
- 不會變更或覆寫現有正式 `active_engine.md`，所有測試以驗證正式 `active_engine` hash 不變為準。

測試結果
- 新增 UI contract test 以檢驗 index 與 `/api/writer-workbench/state` 回應欄位。
- active_engine hash 欄位：TO_FILL
 - active_engine hash 欄位：D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB

備註
- 未新增 OpenAI / 外部 LLM API；僅使用既有本地 services 與 agent wrappers。
- 本次變更僅新增 minimal UI 與安全 glue；未自動 commit 或 tag。
