# Nexa Pi 任務授權與工程接續

## 啟用任務授權

在 Nexa 主機建立專用 NTFS 目錄，透過 Windows ACL 授予工程授權操作員寫入權限，並授予 MCP 服務及 Pi worker 帳號讀取權限。目錄要位於專案、工程工作區及測試可寫範圍之外。若服務與操作員使用同一 Windows 帳號，先分離身分再啟用。將絕對路徑設為 `NEXA_PI_TASK_AUTHORIZATION_ROOT`。正式切換時設定 `NEXA_PI_REQUIRE_TASK_AUTHORIZATION=1`，使 Pi 的一般寫入、驗證、提交及檢查點要求有效授權。MCP 與 durable worker 會使用相同的設定。

工作台先用既有 Workstream 和 Workspace 流程建立作用中的獨立工作區。授權操作員在 Nexa 主機執行 `node scripts/manage-pi-task-authorization.mjs issue task.json`。`task.json` 提供 `goal`、`workspace_id`、`capabilities` 陣列，以及 UTC epoch 毫秒的 `expires_at_ms`。主機由工作區登錄資料解析工作流身分。授權記錄的 `task_authorization_id` 會寫入關聯 Pi 執行紀錄。

同一個任務可以允許檔案讀取、列目錄、建立檔案、套用精確修補、Git 狀態與提交、指定測試和檢查點。各步驟仍由原 MCP handler 驗證工作區、路徑、Git HEAD、測試範圍和效果。PowerShell 的工作目錄只約束起始位置。通用命令需要另行建立可驗證的程序和檔案隔離。

## 預先授權維護 Windows 服務

維護已安裝的專案服務時，授權操作員在 `task.json` 的 `capabilities` 加入 `windows.service.ensure_running`，並在 `windows_services` 列出核准的服務名稱。GPT 交付的步驟以 `service_name` 指定其中一個目標。Pi 透過現有 `powershell_admin_run` 及已註冊的 Task Scheduler runner，確認服務狀態、啟動已停止的服務，並等待服務進入 `Running`。同一份授權可維護多個核准目標，工作區、到期、撤銷和 Journal 規則與一般步驟相同。請使用作業系統已註冊且受管理的開發服務名稱。

## 提交工程工作

把下列物件序列化到 `dev_pi_execute_intent` 的 `intent_json`。填入操作員發行的識別碼、工作區和相同的目標。每一批新的工作有自己的 `intent_id`。重送完全相同的意圖可以查回持久狀態。

```json
{
  "request_kind": "autonomous_engineering",
  "intent_id": "fix-workspace-discovery-001",
  "task_authorization_id": "pi_task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "goal": "修正工作區探索並驗證結果",
  "workspace_id": "dev_workspace_bbbbbbbbbbbbbbbbbbbbbbbb",
  "requested_actions": [
    { "step_id": "verify", "capability": "verification.focused", "input": { "suite": "mcp_core" } }
  ]
}
```

若測試失敗，取得持久收據後可用同一份授權提交修正和重測。最新批次的 `pending_steps`、`last_error` 和各步驟收據提供接續依據。`node scripts/manage-pi-task-authorization.mjs revoke <task-authorization-id>` 會寫入撤銷記錄。Pi 會在新派送前重新檢查其有效性。已獲准派送的操作和事後唯讀對帳維持原本的生命週期。

## 查詢與對帳

新會話可用 `dev_pi_execution_status` 同時提供 `workstream_id` 和 `workspace_id`，查詢最新批次、第一個待辦步驟、最後錯誤與現有檢查點。用 `next_before_sequence` 翻閱舊批次，再以 `operation_id` 或 `intent_id` 查閱確切請求、完成步驟與測試收據。檔案、提交及整合候選的來源資料仍由 `dev_workspace_get_provenance` 查詢。

`dev_workspace_journal_status` 提供未對帳終態的操作與事件識別碼。候選分支套用了本機已使用的歷史收據讀取驗證，範圍涵蓋 Pi worker 更新及兩次 TRPG 啟動事件。這些事件仍使用原始雜湊和歷史順序驗證。

正式 Journal 查核基準為序列 `66036`。序列 `65527` 已有對帳收據。剩餘的一對同次 TRPG 啟動操作是 `dev_operation_7d331e6fcd994db98a23a25f83a16483` 與 `dev_operation_d11a295a8f864caaa4e733ecaf551257`。獨立主機日誌記錄 `SUPERVISOR_START`、`CHILD_START` 和 `READY`。收據保留 PowerShell 結束碼和草稿橋接結果為未知，禁止重播。

候選版已在完整 Journal 複本追加這一對收據，驗證原有事件雜湊、操作狀態與冪等重試。正式 Nexa 的 Journal 讀寫程序都切換到支援該收據的版本後，從正式安裝目錄執行 `node scripts/reconcile-trpg-supervisor-resume.mjs --inspect`。檢查樣本及結果後可用 `--apply` 追加對帳，並覆核 `chain_verified=true`、`health=healthy` 和 `reconciliation_required=false`。

## Git 整合基準

候選建立於已核對的 GitHub `main` `174ca070`。本機 `main` 為 `2955dc44`，本機 `origin/main` 為 `cdf828fb`。相對 GitHub，本機 `main` 有 2 筆 Blender 提交，另缺 34 筆遠端提交。根工作樹當時有 58 筆 Git 狀態項目，涵蓋 Canon 和視覺資料、隧道與啟動器、MCP 和 TRPG 程式、測試，以及其他既有工作樹。工作樹與來源不明的本機修改留在原位置。僅針對正式 Journal 已使用的收據讀取邏輯，從本機草稿移植並驗證歷史相容性。
