# MCP Client Config Templates

## Phase 14C Approval Readiness

The read-only `approval_queue_bridge_readiness_report` tool checks source,
lineage, artifact existence, protected hashes, and denied bridge capabilities
for a pending adoption request. It cannot approve, confirm adoption, activate
an engine, apply compressed rules, restore, or roll back.

## Phase 14B Dry Run

Phase 14B adds a deterministic E2E dry run for the same local MCP server:

```powershell
npm.cmd run bridge:dry-run
```

It exercises the `chatgpt_bridge_*` flow through a pending adoption request and
then stops. Settlement context uses synthetic fixture data only. No adoption
confirmation, pending engine candidate, active-engine update, or
compressed-rule update is performed.

## Phase 14A-Lite ChatGPT Bridge

The local MCP server now exposes `chatgpt_bridge_*` tools for the guarded
Writer Workbench flow. Configure the same local `server/src/mcp-server.mjs`
entrypoint shown below; no external API key or model endpoint is used.

The bridge can read bounded workbench inputs and create low-risk workflow
artifacts. Adoption still requires explicit confirmation in the Writer
Workbench approval queue. The bridge cannot approve, confirm adoption, modify
the active engine or compressed rules, activate, restore, roll back, or execute
cleanup.

本目錄提供本地 MCP client 設定檔範本。

## Files

- `mcp-client.example.json`：可攜模板，將 `<PROJECT_ROOT>` 替換成專案根目錄。
- `mcp-client.windows-local.example.json`：目前工作區的 Windows 路徑範例；中文路徑使用 `\uXXXX` 轉義，讓舊版 Windows PowerShell 也能穩定解析。

## Usage

把範本內容合併到支援 MCP 的 client 設定中：

```json
{
  "mcpServers": {
    "armed-academy-fiction-engine": {
      "command": "node",
      "args": [
        "E:\\武裝學院的二三事\\server\\src\\mcp-server.mjs"
      ],
      "cwd": "E:\\武裝學院的二三事"
    }
  }
}
```

套用後可先在專案根目錄執行：

```powershell
node server/src/mcp-smoke-test.mjs
```

## Safety

- 這些檔案只是範本，不會自動修改任何 client 全域設定。
- MCP server 只暴露白名單工具。
- 高風險工具仍需確認碼，例如 `IMPORT_POLICY`、`COMMIT`、`UPDATE_RULES`、`ACTIVATE`。
