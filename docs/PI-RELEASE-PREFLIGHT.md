# Pi Sidecar 正式發布前驗收

本檢查用於候選發布目錄，不在正式主機的運作中程式目錄直接安裝依賴。GitHub CI 的通過結果只證明該次 GitHub runner 的 npm 安裝可用，不能證明受保護的 Nexa Windows 發布目錄已包含同樣檔案。

## 執行與安全界線

維護操作員先備份正式啟動器、發布版本、相關排程定義與既有持久化資料的來源資訊，在隔離的候選發布目錄完成安裝。以擁有該候選目錄維護權限的帳號執行：

~~~powershell
npm.cmd ci --prefix scripts/pi-runtime --ignore-scripts --no-audit --no-fund
node scripts/pi-runtime/release-preflight.mjs
~~~

從候選發布目錄執行命令。此腳本使用自身所在的 scripts/pi-runtime 目錄作為唯一根目錄，**不接受從 ChatGPT 或 MCP 傳入的任意路徑**；不安裝套件、不修改任何資料、不重新啟動正式服務。只回傳機器可讀的有限 JSON 與 0／1 結束碼。原始 stderr、完整路徑、環境變數和檔案內容都不會輸出。

驗證範圍：

- Node 執行版至少 22.19.0。
- package.json 指定精確版本、package-lock.json 根依賴與套件版本一致。
- Sidecar 依賴安裝於候選發布目錄內，不透過指向其他工作樹的外部連結借用。
- runner.mjs 確實啟動且其 Pi SDK 工廠均可用。
- 偵測套件缺失、manifest/lock 不一致、套件版本錯誤或 runner 失敗時拒絕發布。

## 常見錯誤與處理

- PI_RELEASE_DEPENDENCY_UNAVAILABLE：候選發布目錄缺少已安裝的 Pi 套件。先查候選的 npm ci 是否實際完成，避免把只含原始碼的發布包切換到正式環境。
- PI_RELEASE_LOCK_MISMATCH / PI_RELEASE_INSTALLED_VERSION_MISMATCH：依照固定 lockfile 重建候選，不在正式執行目錄內直接修改依賴。
- PI_RELEASE_DEPENDENCY_OUTSIDE_RELEASE：依賴指向發布目錄外。應重新安裝至候選目錄，避免依賴有未審查來源的 junction。
- PI_RELEASE_RUNNER_FAILED：子程序確實啟動但失敗。僅保留有限退出碼與允許的錯誤分類（例如 ERR_MODULE_NOT_FOUND）。
- PI_RELEASE_RUNNER_UNREADY：runner 的 Pi SDK 工廠不齊或宣告版本和鎖定版不符。
- PI_RELEASE_NODE_INCOMPATIBLE：需於候選發布環境提供符合要求的 Node。

所有檢查通過後，仍需依照 Nexa 原有任務授權與維護程序執行受控切換；不能由 CI 自動重新配置正式 Windows 服務或工作樹。切換後再次執行正式 MCP 的 dev_pi_runtime_status，確認 ready=true，並核對 Journal hash chain、Pi route 和既有工作流。失敗時保留原發布版本，不覆寫本機 main、不強制 pull/reset，也不重播結果未知的操作。

正式本機 Git 工作樹與發布目錄是兩個不同的資料面。即使 GitHub main 已更新，也不代表運行中的受保護發布版隨之更新。
