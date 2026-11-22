# Nexa Pi 任務授權與工程接續

## 啟用任務授權

在 Nexa 主機的維護時段，透過已檢閱的發布版本，在提升權限的 64 位元 Windows PowerShell 執行 `scripts/register-mcp-powershell-admin-runner.ps1 -ScopedTaskAuthorizations`。它會沿用既有排程名稱，在 `Program Files` 建立受保護的授權庫。Windows ACL 允許管理員與 SYSTEM 寫入授權、撤銷記錄與收據。一般 MCP 和 Pi worker 程序只有供請求標記使用的收件匣可寫，同一個登入帳號可藉由一般與提升權限的 token 分工。

將註冊結果的 `task_authorization_root` 設為 `NEXA_PI_TASK_AUTHORIZATION_ROOT`。正式切換時設定 `NEXA_PI_REQUIRE_TASK_AUTHORIZATION=1`，使 Pi 的一般寫入、驗證、提交及檢查點要求有效授權。從同一啟動環境啟動 MCP 與 durable worker。安裝完成後，先以一般程序確認授權目錄可讀、寫入受阻，再執行服務驗收。

工作台先用既有 Workstream 和 Workspace 流程建立作用中的獨立工作區。授權操作員在已設定相同授權目錄的提升權限終端執行 `node scripts/manage-pi-task-authorization.mjs issue task.json`。`task.json` 提供 `goal`、`workspace_id`、`capabilities` 陣列，以及 UTC epoch 毫秒的 `expires_at_ms`。主機由工作區登錄資料解析工作流身分。授權記錄的 `task_authorization_id` 會寫入關聯 Pi 執行紀錄。

同一個任務可以允許檔案讀取、列目錄、建立檔案、套用精確修補、Git 狀態與提交、指定測試和檢查點。各步驟仍由原 MCP handler 驗證工作區、路徑、Git HEAD、測試範圍和效果。

## 在隔離環境執行一般 PowerShell

授權操作員可在 `capabilities` 加入 `workspace.powershell_isolated`。使用 `autonomous_engineering` 加上 `task_authorization_id` 時，`command` 會由現有 `powershell_run` 的 Windows AppContainer 路徑執行。Windows x64 主機使用內附 .NET Framework 編譯器和 Windows PowerShell。每次執行使用零網路 capability 的容器身分、專用工作目錄及限制子程序數與記憶體的 Windows Job。

`sandbox_paths` 選擇要複製的工作區 UTF-8 檔案。`sandbox_directories` 可一併選擇至多 8 個工作區來源目錄，合計最多 512 個檔案及 8 MiB。遞迴選取沿用開發搜尋的排除規則，略過憑證、連結和產物目錄。`cwd` 以註冊工作區為基準。`output_paths` 選擇要帶回的 UTF-8 產物。回傳資料包括產物的原始 SHA-256、執行後 SHA-256 和限量內容，供同一授權下的 `filesystem.write` 或 `filesystem.patch` 審核及套用。臨時資料與子程序在完成後清理，逾時和非零結束碼保留在 Journal 收據。

環境內可執行 Windows 系統命令和已帶入的腳本。指定 `toolchain: "node"` 時，Nexa 將伺服器使用的 `node.exe` 和同目錄安裝的 npm 複製成唯讀工具鏈，環境預設使用離線 npm。可將工作區的本地套件及 package manifest 列入 `sandbox_paths`，再執行普通安裝與測試命令。套件的安裝檔與輸出留在該次執行的隔離環境。

## 預先授權維護 Windows 服務

維護已安裝的專案服務時，授權操作員在 `task.json` 的 `capabilities` 加入 `windows.service.ensure_running`，並在 `windows_services` 列出核准的服務名稱。GPT 交付的步驟以 `service_name` 指定其中一個目標。Pi 透過現有 `powershell_admin_run` 提交範圍標記。受保護的 Task Scheduler runner 從授權庫獨立核對目標、工作區、工作流、期限及撤銷狀態，再確認服務、啟動已停止的服務並等待 `Running`。同一份授權可維護多個核准目標。

其他管理員維護可使用 `windows.powershell.run_approved`。操作員在提升權限的終端把已審核的 UTF-8 腳本放入註冊根目錄的 `approved-scripts/<script_id>.ps1`，並以 `Get-FileHash -Algorithm SHA256` 取得摘要。在 `task.json` 的 `windows_scripts` 列出 `script_id` 與小寫 `script_sha256`，再用相同欄位交付 Pi 步驟。runner 核對保護目錄、授權範圍和完整腳本位元組，最多執行 45 秒。固定工作目錄與系統 PowerShell 由 runner 選擇。授權和收據包含腳本摘要、派送狀態、結束碼及輸出樣本雜湊。收件匣只接收範圍標記。

提升權限的 runner 將收據寫入受保護目錄，收據識別碼與 Journal 子操作一致。若 MCP 程序中斷，Nexa 會查找同一筆收據，並短暫等候仍可能在執行的 runner。可確認的成功或未派送失敗會結束原操作。收據缺失、範圍不符或服務派送後失敗時，Nexa 保留待對帳狀態，避免重新派送。

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

若 GPT 已確定修復方案，可在 `verification.focused`、`verification.affected` 或 `workspace.powershell_isolated` 步驟加上 `"on_failure": ["repair", "retest"]`。隨後緊接列出的修復步驟，最後以新的步驟識別碼和相同的能力及參數重驗。修復可使用授權範圍內的讀取、寫入、修補與隔離 PowerShell。後續提交等步驟可依賴原始步驟。Pi 會在第一次執行通過時略過修復。收到可核對的失敗收據時，Pi 記錄失敗並執行修復及重驗。隔離 PowerShell 的收據必須證明程序已清理，且未直接寫入工作區。逾時或效果無法確認時，Pi 保留接續點。

最新批次的 `recovery`、`pending_steps`、`last_error` 和各步驟收據提供接續依據。遇到需要新決策的結果，可用同一份授權提交後續工作。`node scripts/manage-pi-task-authorization.mjs revoke <task-authorization-id>` 會寫入撤銷記錄。Pi 會在新派送前重新檢查其有效性。已獲准派送的操作和事後唯讀對帳維持原本的生命週期。

## 查詢與對帳

新會話可用 `dev_pi_execution_status` 同時提供 `workstream_id` 和 `workspace_id`，查詢最新批次、第一個待辦步驟、最後錯誤與現有檢查點。用 `next_before_sequence` 翻閱舊批次，再以 `operation_id` 或 `intent_id` 查閱確切請求、完成步驟與測試收據。檔案、提交及整合候選的來源資料仍由 `dev_workspace_get_provenance` 查詢。

`dev_workspace_journal_status` 的 `writes_available` 顯示共用日誌可否驗證並接受新資料。`isolated_operations` 列出待處理事件、對應資源及恢復狀態。遇到 `JOURNAL_SCOPE_ISOLATED` 時，依回傳的操作識別碼和範圍查閱既有證據。可驗證與可寫入的 Journal 即使有局部事件，仍會受理互不重疊的工作。

Nexa 在背景觀測同一主機上已確認退出的操作所有者。每筆觀測嘗試與結果寫入原 Journal，重開後仍沿用三次上限與退避時間。可核對的結果會追加恢復收據，解除相應隔離。終態不明、來源主機不明或仍有子操作需要專屬證據時，該操作會保留待查核狀態。若 Pi 在取得執行所有權前反覆失敗，`dev_pi_execution_status` 的 `worker_deferral` 會指出已記錄的錯誤、重試次數及下一次可執行時間。任務達到重試上限時，其他任務仍可進入派送。

單一 HTTP MCP 工具逾時時，轉接層會用 MCP `ping` 確認該子程序是否仍可回應。若原子程序仍可用，同一會話的獨立請求繼續處理。已派送的寫入應依既有操作收據查核結果。

TRPG Gateway 憑證遭拒時，Nexa 會暫停該連線的 TRPG 工具並重新查核 Gateway 能力。憑證恢復後可在原 TRPG 會話重新列出工具。工程用途與 TRPG 用途仍分別通過既有 MCP 認證。Checkpoint 元件等候儲存鎖時，獨立的工程檔案寫入可繼續派送。

`dev_workspace_journal_status` 提供未對帳終態的操作與事件識別碼。候選分支套用了本機已使用的歷史收據讀取驗證，範圍涵蓋 Pi worker 更新及兩次 TRPG 啟動事件。這些事件仍使用原始雜湊和歷史順序驗證。

正式 Journal 查核基準為序列 `66036`。序列 `65527` 已有對帳收據。剩餘的一對同次 TRPG 啟動操作是 `dev_operation_7d331e6fcd994db98a23a25f83a16483` 與 `dev_operation_d11a295a8f864caaa4e733ecaf551257`。獨立主機日誌記錄 `SUPERVISOR_START`、`CHILD_START` 和 `READY`。收據保留 PowerShell 結束碼和草稿橋接結果為未知，禁止重播。

候選版已在完整 Journal 複本追加這一對收據，驗證原有事件雜湊、操作狀態與冪等重試。正式 Nexa 的 Journal 讀寫程序都切換到支援該收據的版本後，從正式安裝目錄執行 `node scripts/reconcile-trpg-supervisor-resume.mjs --inspect`。檢查樣本及結果後可用 `--apply` 追加對帳，並覆核 `chain_verified=true`、`health=healthy` 和 `reconciliation_required=false`。

切換前，保存既有排程定義、MCP 與 worker 啟動設定及安裝版本。在維護時段停止新派送，等已在執行的操作結束，再切換 runner 和 Journal 讀寫程序。如果尚未追加新版事件，復原可使用先前的排程、環境與安裝版本。追加新版事件後，復原須使用已驗證能讀取目前 Journal 的版本，並保留所有對帳收據。

## Git 整合基準

候選建立於已核對的 GitHub `main` `174ca070`。本機 `main` 為 `2955dc44`，本機 `origin/main` 為 `cdf828fb`。相對 GitHub，本機 `main` 有 2 筆 Blender 提交，另缺 34 筆遠端提交。根工作樹當時有 58 筆 Git 狀態項目，涵蓋 Canon 和視覺資料、隧道與啟動器、MCP 和 TRPG 程式、測試，以及其他既有工作樹。工作樹與來源不明的本機修改留在原位置。僅針對正式 Journal 已使用的收據讀取邏輯，從本機草稿移植並驗證歷史相容性。

候選分支後續合入 GitHub `main` `4167fe84`，並依正式 Nexa 既有的開發者工具契約，移植已提交的 Blender 工具與測試。保留原本的場景識別與操作驗證。Blender 連線及編輯器腳本在個別工具呼叫時載入，供應端失效時由該工具回報。
