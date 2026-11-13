# Nexa Windows 全機非管理員工程操作（第二階段）

這項改動不啟用永久系統管理員權限，也不取消 Pi、MCP 身分驗證、
操作稽核、PowerShell 輸出／時間限制或危險命令阻擋。

經 Pi 授權的 `host.powershell` 使用一般登入使用者權限，
能在 C、D、E 等本機磁碟的現有資料夾指定絕對 `cwd`，
不再被迫以 Writer Workbench 當作目前工作目錄。
實際檔案存取仍由 Windows 使用者權限控制。

```json
{
  "request_kind": "autonomous_engineering",
  "intent_id": "host-work-unique-001",
  "goal": "Check another local project",
  "workspace_id": "dev_workspace_<registered-24hex>",
  "cwd": "D:\\ExampleProject",
  "command": "git status --short"
}
```

以上的 `workspace_id` 仍是既有正式授權來源，Pi 會自動產生完整
ExecutionIntent、冪等金鑰、權限欄位和持久化執行紀錄。

安全邊界：
- 此絕對 `cwd` 只允許 **非提升權限的 host-maintenance** 作用域。
- `workspace.powershell` 仍限制在已註冊的隔離工作區內。
- `powershell_admin_run` 仍限制工作區，須經獨立高權限授權。
- 不接受 UNC 作為主機絕對 `cwd`；保留已存在目錄及 realpath 驗證。
- 這不改變其他 `filesystem.*`、`git.*` 工具的專案隔離。未來如需完整跨專案原生操作，
  應另設明確可稽核的主機能力，而非直接讓既有單專案工具逃逸其範圍。

驗證：`node --test tests/mcp/pi-host-cwd.test.mjs`，並搭配既有
`pi-execution-policy.test.mjs` 與 PowerShell maintenance 測試。
