# Nexa Pi 任務授權與工程接續

## 啟用任務授權

在 Nexa 主機的維護時段，以已檢閱的發布版本及提升權限的 64 位元 Windows PowerShell 執行 `scripts/register-mcp-powershell-admin-runner.ps1 -ScopedTaskAuthorizations -DispatcherAccount <本機帳號> -ManagedProjectRoot <專案絕對路徑>`。派送帳號須為 Nexa 專用的啟用中本機標準帳號。操作員以自己的管理員身分註冊 `WriterWorkbench-PowerShellScopedAdminRunner`。新版授權庫在 `Program Files\WriterWorkbench-PiMaintenance-v3`。派送帳號可讀取授權及收據、可寫入請求收件匣，並可在 Task Scheduler 讀取和啟動該排程。管理員與 SYSTEM 維護受保護的設定、授權和收據。

以派送帳號啟動 MCP 與 durable worker，將註冊結果的 `task_authorization_root` 設為 `NEXA_PI_TASK_AUTHORIZATION_ROOT`，並設定 `NEXA_PI_REQUIRE_TASK_AUTHORIZATION=1`。發布程式、依賴、Git 設定與 Journal 須放在其他一般登入身分無法變更的位置。派送帳號用 AppContainer 執行工作區程式及測試。啟用強制授權後，開發 MCP 寫入透過 Pi 派送，診斷 fallback 保留唯讀查詢。

專用派送環境須透過 `NEXA_TRPG_ADAPTER_DIST` 設定受保護的 TRPG adapter 發布路徑。MCP 連線仍使用既有 OAuth 驗證，驗證端只需取得相應的即時驗證資料。部署前請確認 adapter 程式與依賴的 ACL，並用已簽發、已撤銷和缺少授權的連線驗證結果。

從舊版升級前，先等待已派送的維護結束，並按維護規程停用舊版 scoped 排程。用同名排程註冊新版，保留舊授權、腳本和收據目錄。操作員在新版重發仍需要的任務授權，並視歷史恢復需求授予派送帳號舊收據目錄的唯讀權限。驗收需分別以派送帳號與一般登入帳號確認收件匣及排程權限。

工作台先用既有 Workstream 和 Workspace 流程建立作用中的獨立工作區。授權操作員在已設定相同授權目錄的提升權限終端執行 `node scripts/manage-pi-task-authorization.mjs issue task.json`。`task.json` 提供 `goal`、`workspace_id`、`capabilities` 陣列，以及 UTC epoch 毫秒的 `expires_at_ms`。主機由工作區登錄資料解析工作流身分。授權記錄的 `task_authorization_id` 會寫入關聯 Pi 執行紀錄。

同一個任務可以允許檔案讀取、列目錄、建立檔案、套用精確修補、Git 狀態與提交、指定測試和檢查點。各步驟仍由原 MCP handler 驗證工作區、路徑、Git HEAD、測試範圍和效果。

## 在隔離環境執行一般 PowerShell

授權操作員可在 `capabilities` 加入 `workspace.powershell_isolated`。使用 `autonomous_engineering` 加上 `task_authorization_id` 時，`command` 會由現有 `powershell_run` 的 Windows AppContainer 路徑執行。Windows x64 主機使用內附 .NET Framework 編譯器和 Windows PowerShell。每次執行使用零網路 capability 的容器身分、專用工作目錄及限制子程序數與記憶體的 Windows Job。

`sandbox_paths` 選擇要複製的工作區 UTF-8 檔案。`sandbox_directories` 可一併選擇至多 8 個工作區來源目錄，合計最多 512 個檔案及 8 MiB。遞迴選取沿用開發搜尋的排除規則，略過憑證、連結和產物目錄。`cwd` 以註冊工作區為基準。`output_paths` 選擇要帶回的 UTF-8 產物。回傳資料包括產物的原始 SHA-256、執行後 SHA-256 和限量內容，供同一授權下的 `filesystem.write` 或 `filesystem.patch` 審核及套用。臨時資料與子程序在完成後清理，逾時和非零結束碼保留在 Journal 收據。

環境內可執行 Windows 系統命令和已帶入的腳本。指定 `toolchain: "node"` 時，Nexa 將伺服器使用的 `node.exe` 和同目錄安裝的 npm 複製成唯讀工具鏈，環境預設使用離線 npm。可將工作區的本地套件及 package manifest 列入 `sandbox_paths`，再執行普通安裝與測試命令。套件的安裝檔與輸出留在該次執行的隔離環境。

Windows 正式環境已觀察到 Node 預設的測試子程序模式在 AppContainer 內逾時。支援 `--test-isolation` 的 Node 版本可執行 `node --test --test-isolation=none <測試檔>`。較早的 Node 版本可用 `node <測試檔>` 直接執行使用 `node:test` 的檔案。需要隔離各測試檔的專案可分別啟動各檔案。

## 預先授權維護 Windows 服務

維護已安裝的專案服務時，授權操作員在 `task.json` 的 `capabilities` 加入 `windows.service.ensure_running`，並在 `windows_services` 列出核准的服務名稱。GPT 交付的步驟以 `service_name` 指定其中一個目標。Pi 透過現有 `powershell_admin_run` 提交範圍標記。受保護的 Task Scheduler runner 獨立核對授權、撤銷狀態、目標與已落盤的 Journal 子操作，再確認服務、啟動已停止的服務並等待 `Running`。同一份授權可維護多個核准目標。

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

## 主機核准工程入口（候選版）

此入口只省略請求端傳遞授權識別碼的步驟，不新增工程權限。受保護授權目錄中的 `engineering-bindings.json` 由主機管理者維護；派送帳號維持唯讀。每筆記錄包含由主機確認的 OAuth 主體、已登錄工作區、工作流、精確工程目標及已核發授權識別碼。不使用請求的 actor 欄位作為認證主體，不由 MCP 建立或改寫綁定檔。不存在、格式錯誤、範圍不符或多重匹配時拒絕新入口。

使用 `host_approved_engineering` 提交已有核准範圍內的明確 `requested_actions`，其他欄位仍依原工程意圖契約提供。不得帶入 `task_authorization_id` 或使用語意不明確的短式 `command`。只接受經 OAuth 驗證的遠端工程連線，以及健康、作用中且可變更的隔離工作區與作用中的工作流。未設定主機綁定時不會退回較寬鬆的入口；既有請求種類的行為維持不變。

在強制任務授權模式下，普通 `autonomous_engineering` 請求若沒有提供授權識別碼、使用明確 `requested_actions`、所有能力均在有限的一般工程清單中，且至少一項需要授權，入口會自動查找相同的主機核准綁定。仍須由獨立管理者先核發與發布既有授權；缺少、撤銷或不符範圍時拒絕，不降級重試。純讀取、明確授權請求、短式命令、受保護維護及生命週期操作沿用原路徑。本變更不提供跨工作區或跨目標常設授權。

此入口重用原始授權檢查和持久化控制器，原授權到期或撤銷仍會拒絕後續派送。移除綁定只會拒絕新提交，停止已入列工作必須依原撤銷流程處理。候選版不提供跨工作區或跨任務目標的常設權限，也不改變受保護的 Windows 維護、Git 整合、推送或部署的既有權限邊界。

在正式啟用之前，須驗證授權檔 ACL、OAuth 主體來源、核准與拒絕案例、撤銷後的待執行工作、舊版相容性及復原。未配置的正式主機維持既有工程授權模式。

### 主機管理者的綁定維護（候選版）

授權管理者可以使用獨立的管理命令 `node scripts/manage-pi-engineering-bindings.mjs inspect` 查核目前綁定清單的內容摘要及筆數。清單不存在時摘要為 null。由管理者在受保護的主機維護環境準備完整清單，再使用 `publish <manifest.json>` 提交；檔案須包含 `expected_current_sha256`（上一版摘要，初次建立為 null）及 `bindings`（完整綁定陣列）。只接受已有的、有效且與指定工作流和目標相符的授權；重複範圍或同一授權跨主體綁定會拒絕。

同一份管理者核准的清單可以包含多個各自已獨立核發的工作流與目標。各筆授權仍有獨立期限、能力及撤銷紀錄；撤銷其中一筆不影響其他有效授權。讀取端與發布端均檢查全清單重複範圍及跨主體的授權衝突，損壞或有歧義的清單不能只挑出一筆相符記錄繼續執行。這是批次綁定維護，不等於對未核准的新工作流授予常設權限。

發布使用排他鎖與同目錄暫存檔，先驗證所有記錄，再以原子檔案操作更新。若摘要已改變、現有清單損壞、工作區失效、授權撤銷或其他發布正在進行，不覆寫原清單。操作員應保存上一版清單於受保護的維護環境。若中斷留下發布鎖，不自動移除；須先由操作員確認原程序已結束及清單狀態。清單更新不等於授權核發或撤銷。派送帳號維持唯讀，CLI 不提供透過 MCP 呼叫的入口。

## 查詢與對帳

新會話可用 `dev_pi_execution_status` 同時提供 `workstream_id` 和 `workspace_id`，查詢最新批次、第一個待辦步驟、最後錯誤與現有檢查點。檢查點暫時無法查詢時，歷史結果仍包含 `checkpoint_status` 與可用的任務紀錄。用 `next_before_sequence` 翻閱舊批次，再以 `operation_id` 或 `intent_id` 查閱確切請求、完成步驟與測試收據。檔案、提交及整合候選的來源資料仍由 `dev_workspace_get_provenance` 查詢。

`dev_workspace_journal_status` 的 `writes_available` 顯示共用日誌可否驗證並接受新資料。`isolated_operations` 列出待處理事件、對應資源及恢復狀態。遇到 `JOURNAL_SCOPE_ISOLATED` 時，依回傳的操作識別碼和範圍查閱既有證據。可驗證與可寫入的 Journal 即使有局部事件，仍會受理互不重疊的工作。

Nexa 在背景觀測同一主機上已確認退出的操作所有者。每筆觀測嘗試與結果寫入原 Journal，重開後仍沿用三次上限與退避時間。可核對的結果會追加恢復收據，解除相應隔離。終態不明、來源主機不明或仍有子操作需要專屬證據時，該操作會保留待查核狀態。若 Pi 在取得執行所有權前反覆失敗，`dev_pi_execution_status` 的 `worker_deferral` 會指出已記錄的錯誤、重試次數及下一次可執行時間。任務達到重試上限時，其他任務仍可進入派送。

單一 HTTP MCP 工具逾時時，轉接層會用 MCP `ping` 確認該子程序是否仍可回應。若原子程序仍可用，同一會話的獨立請求繼續處理。已派送的寫入應依既有操作收據查核結果。

TRPG Gateway 憑證遭拒時，Nexa 會暫停該連線的 TRPG 工具並重新查核 Gateway 能力。憑證恢復後可在原 TRPG 會話重新列出工具。工程用途與 TRPG 用途仍分別通過既有 MCP 認證。Checkpoint 元件等候儲存鎖時，獨立的工程檔案寫入可繼續派送。

`dev_workspace_journal_status` 提供未對帳終態的操作與事件識別碼。候選分支套用了本機已使用的歷史收據讀取驗證，範圍涵蓋 Pi worker 更新及兩次 TRPG 啟動事件。這些事件仍使用原始雜湊和歷史順序驗證。

正式 Journal 查核基準為序列 `66036`。序列 `65527` 已有對帳收據。剩餘的一對同次 TRPG 啟動操作是 `dev_operation_7d331e6fcd994db98a23a25f83a16483` 與 `dev_operation_d11a295a8f864caaa4e733ecaf551257`。獨立主機日誌記錄 `SUPERVISOR_START`、`CHILD_START` 和 `READY`。收據保留 PowerShell 結束碼和草稿橋接結果為未知，禁止重播。

候選版已在完整 Journal 複本追加這一對收據，驗證原有事件雜湊、操作狀態與冪等重試。正式 Nexa 的 Journal 讀寫程序都切換到支援該收據的版本後，從正式安裝目錄執行 `node scripts/reconcile-trpg-supervisor-resume.mjs --inspect`。檢查樣本及結果後可用 `--apply` 追加對帳，並覆核 `chain_verified=true`、`health=healthy` 和 `reconciliation_required=false`。

切換前，保存既有排程定義、MCP 與 worker 啟動設定及安裝版本。在維護時段停止新派送，等已在執行的操作結束，再切換 runner 和 Journal 讀寫程序。如果尚未追加新版事件，復原可使用先前的排程、環境與安裝版本。追加新版事件後，復原須使用已驗證能讀取目前 Journal 的版本，並保留所有對帳收據。

若發布程式和正式 Git 工作區位於不同位置，在啟動 Listener、管理授權和檢查 Journal 時，將 `NEXA_MANAGED_PROJECT_ROOT` 設為正式 Git 工作區的絕對路徑。Listener 和 Pi worker 載入發布目錄中的程式，設定、工作流、檢查點與 Journal 仍從正式工作區取得。從部署主機的啟動環境設定此值。

## Git 整合基準

候選建立於已核對的 GitHub `main` `174ca070`。本機 `main` 為 `2955dc44`，本機 `origin/main` 為 `cdf828fb`。相對 GitHub，本機 `main` 有 2 筆 Blender 提交，另缺 34 筆遠端提交。根工作樹當時有 58 筆 Git 狀態項目，涵蓋 Canon 和視覺資料、隧道與啟動器、MCP 和 TRPG 程式、測試，以及其他既有工作樹。工作樹與來源不明的本機修改留在原位置。僅針對正式 Journal 已使用的收據讀取邏輯，從本機草稿移植並驗證歷史相容性。

候選分支後續合入 GitHub `main` `4167fe84`，並依正式 Nexa 既有的開發者工具契約，移植已提交的 Blender 工具與測試。保留原本的場景識別與操作驗證。Blender 連線及編輯器腳本在個別工具呼叫時載入，供應端失效時由該工具回報。

## 管理者一次核准多個精確工作流

`scripts/manage-pi-operator-batch-approval.mjs` 是獨立操作員管理工具，不能由 MCP 呼叫或由 Nexa 自行核准。只能在已經獨立審核、受保護的正式安裝版本上，依原授權管理程序，由具有原 grants 目錄寫入權限的操作員使用。不得提升執行一般使用者可寫入的候選檔案。

計畫格式包含 `schema_version: 1`、已獨立查證的 OAuth `principal`、`expected_current_sha256`（現有綁定清單摘要，首次建立為 null）、`expires_at_ms`（最長三十天），以及最多 64 筆 `scopes`。每筆有明確的 `workspace_id`、`workstream_id`、`goal`、`capabilities`。不得使用萬用範圍、shell、提權維護、工作流生命週期、整合或推送能力。新工作流仍需獨立核准。最多保留 128 筆綁定。

先由操作員以 `preview <plan.json>` 檢查計畫的精確範圍、到期時間、既有清單摘要和工作區狀態。預覽不寫入任何授權。獨立審核後，以 `apply <plan.json> <reviewed-plan-sha256>` 核對完整計畫摘要及最新清單，再一次建立精確範圍的既有格式授權，並以原發布器 CAS 追加綁定。既有有效授權不得被自動替換或擴大。核准摘要不是認證憑證，實際發行權限仍由獨立主機 ACL 控制。

若批次失敗，嘗試撤銷本批已建立的授權，保留其他記錄，回報需要核對的狀態。此程序不是跨多檔案的原子交易：程序中斷或發布後清理失敗可能留下未綁定授權或已撤銷的綁定，操作員應核對受保護的授權與綁定資料，不得直接重試或刪除其他人的資料。正常的到期、撤銷、嚴格 Intent 及 durable dispatch 檢查不變。這使已明確核准的多個工作流只需一次人工批次操作，不等於對未知的未來工作流自動核發常設權限。

## 獨立核准的有限常設工程政策

本節的正式政策與先前 review-only 模組不同。操作員以受保護的既有 grants 目錄為信任根，使用獨立工具 `scripts/manage-pi-standing-policy.mjs` 預覽、核發、列出及撤銷政策。正式服務只取得讀取及驗證能力，不具備核發權限。不提供 MCP 發行工具或由執行者自行核准的路徑。安裝前仍須獨立驗證正式程式來源、授權目錄 ACL、執行帳戶及 OAuth 主體；不得從一般使用者可寫入的候選目錄提升執行。

政策計畫有精確欄位 `schema_version: 1`、`project_id: writer_workbench`、獨立確認的 `principal`、`scopes`（最多 64 筆已登錄的 `workspace_id` 與 `workstream_id` 配對）、`capabilities`、`expires_at_ms`（明確指定 `null` 表示永久有效直到撤銷；指定整數時間戳則維持核發後最長 30 天）。不得省略期限欄位，既有有限期政策不會自動變成永久政策。永久政策也必須經獨立操作員核准，且每次派送仍需重新驗證身份、記錄摘要、撤銷狀態、工作區健康與能力範圍。管理者應理解：此核准涵蓋所列工作區與工作流內不同的工程目標，不限單一 goal；因此必須審核所有配對、能力和期限。未列出的工作區不會自動取得權限。

能力限定一般隔離工作區讀寫、補丁、checkpoint、指定測試及 Git status/commit。不包括短式命令、任何 shell、提權維護、工作流生命週期、完整回歸、整合、推送，亦不支援條件式 failure-recovery 分支。這些原有路徑、明確任務授權、OS 保護和額外工具確認仍維持原狀。

操作員在正式受保護的版本執行 `preview <plan.json>`，核對完整計畫及摘要後，才可用 `issue <plan.json> <reviewed-plan-sha256>` 獨立核發。記錄使用新的政策識別碼、固定摘要、排他發布及不可覆寫記錄。相同主體與工作區/工作流配對的有效政策不可重疊；不同政策的能力不可合併。用 `list` 核對操作員記錄，使用 `revoke <policy-id>` 寫入不可覆寫的撤銷記錄。到期、撤銷與政策檔案內容變更均會拒絕新請求和未完成的後續 dispatch；已完成效果不會被倒轉。若發布回應不明，先查核獨立記錄，不能假設未發行。受保護目錄最多 128 筆政策記錄，包含歷史到期或已撤銷政策；目前不自動清理，不刪除撤銷證據。

工程執行入口使用 `request_kind: standing_engineering`，與一般 compact request 相同提供 intent_id、goal、workspace_id 及明確 requested_actions，不需提供政策識別碼或 task_authorization_id。服務端從可信 OAuth 驗證結果和權威工作區資料選擇唯一有效政策，產生 `standing_authorization`（政策 ID、不可變記錄摘要、驗證主體）並納入嚴格 Intent 和持久 Journal。MCP 客戶端不得自行提供此欄位，未經驗證的直接控制器 admission/execute 不能建立新常設任務。重新啟動的 worker 只能續接已有持久 admission，並在每次 dispatch 和 managed-call gate 重新驗證原政策、完整能力集合、有效期、撤銷以及工作區狀態；找不到記錄、身份不符或內容改變均拒絕，不會降級嘗試其他授權。

永久政策使用 `expires_at_ms: null` 的記錄格式。舊版讀取器（包括 R9）無法驗證此格式，且即使已有撤銷記錄，仍可能在列舉時拒絕整批政策。正式核發永久政策之後，只能切換至支援此格式且經驗證的版本；撤銷政策本身不代表可以回退至舊版。不得刪除歷史核准或撤銷記錄來規避相容性檢查。

正式核發與部署不是 GitHub CI 的一部分。CI 使用獨立暫存 fixture 測試多目標、多工作流與持久控制器，不能據此宣稱正式主機 ACL 或真實遠端 OAuth／worker 已完成實機驗收。
