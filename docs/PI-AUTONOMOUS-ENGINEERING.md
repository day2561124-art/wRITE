# Pi 自主工程模式（候選實作）

Pi 的既有執行驗證、持久化紀錄、重試防重、MCP 驗證與高風險寫入確認維持不變。
這次只新增一個短格式的請求入口，避免每次手動填寫十多個契約欄位。

## 短格式：一般 PowerShell

使用已正式註冊的隔離工作區 ID：

```json
{
  "request_kind": "autonomous_engineering",
  "intent_id": "host-drive-check-unique-001",
  "goal": "Inspect filesystem drives",
  "workspace_id": "dev_workspace_<registered-24hex>",
  "command": "Get-PSDrive -PSProvider FileSystem"
}
```

系統自動填入 schema、constraints、permissions、completion conditions、
mutation plan、verification、decision boundaries 和冪等金鑰，並仍然透過
Pi 正式執行，持久記錄所有操作。

`command` 可使用目前非提升權限 Windows 使用者能存取的絕對路徑；
`cwd` 仍限制在已登記工作區。PowerShell 命令本身不是 OS 沙箱，
請勿把此能力暴露給未經嚴格驗證的遠端呼叫者。這不會自動授予系統管理員權限。
在多專案支援完成前，專用的 `filesystem.*`、`git.*` 工具仍侷限在
Writer Workbench 的已註冊工作區。

## 短格式：一般工程步驟

```json
{
  "request_kind": "autonomous_engineering",
  "intent_id": "project-edit-unique-001",
  "goal": "Inspect and patch one registered-workspace file",
  "workspace_id": "dev_workspace_<registered-24hex>",
  "requested_actions": [
    {"step_id":"read","capability":"filesystem.read","input":{"path":"README.md"}},
    {"step_id":"check","capability":"git.status","input":{}}
  ]
}
```

不允許將 `git.push`、`git.integrate`、管理員 PowerShell 及未知能力偽裝成
一般指令；高風險操作繼續使用原本正式契約。

## 驗證與限制

- 用 `node --test tests/mcp/pi-autonomous-engineering.test.mjs` 驗證短格式轉換。
- 另執行原有 `pi-execution-policy.test.mjs` 避免改壞既有授權流程。
- 如需全機原生檔案工具、跨專案 Git 工作區，仍須另建多根目錄登記及後端授權策略；
  本候選版先透過既有非提升權限的 PowerShell 支援跨磁碟工作。
