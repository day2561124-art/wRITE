# Daily PowerShell Scripts

所有腳本都以 repository root 為工作目錄，不會自動 stage、commit、tag、approve、
activate 或 restore。

| Script | 用途 |
| --- | --- |
| `safe-status.ps1` | 顯示完整/僅 tracked 狀態、diff stat 與 active engine hash |
| `daily-health-check.ps1` | 顯示近期版本資訊、執行完整測試與 hash 檢查 |
| `pre-commit-check.ps1` | 執行完整測試並拒絕 forbidden staged paths |
| `clean-runtime-backups.ps1` | 預覽或明確確認後清理三個 backup runtime 目錄 |
| `show-active-engine-hash.ps1` | 比對 active engine SHA256 基線 |
| `start-mcp-tunnel.ps1` | 啟動/檢查 MCP HTTP server 與 Cloudflare tunnel；正式環境優先使用固定 hostname 的 remotely-managed tunnel |

## MCP Cloudflare tunnel

`start-mcp-tunnel.ps1` 支援 `quick` 與 `named` 兩種模式。Quick Tunnel 僅保留為開發 fallback；長時間 ChatGPT MCP 連線應使用 Cloudflare remotely-managed tunnel，並先在 Cloudflare 將固定 hostname 的 published application 指向本機 MCP origin（預設 `http://127.0.0.1:8787`）。

Named tunnel 設定使用環境變數：

```powershell
$env:WRITER_MCP_TUNNEL_MODE = 'named'
$env:WRITER_MCP_TUNNEL_HOSTNAME = 'mcp.example.com'
$env:TUNNEL_TOKEN_FILE = 'C:\secure\writer-mcp-tunnel-token.txt'
.\scripts\start-mcp-tunnel.ps1
```

也可使用 `TUNNEL_TOKEN`，但不要把 token 放進命令列、repository、launcher state 或 log。`TUNNEL_TOKEN_FILE` 需要 cloudflared 2025.4.0 或更新版本。`auto` 模式只有在 hostname 與唯一 credential source 都完整時才會選 named tunnel；只設定一部分會 fail closed。完全沒有 named 設定時才會退回 temporary Quick Tunnel。

`-Status` 會分別顯示 local MCP、runtime readiness、Cloudflare process 與 remote transport，避免把 origin failure 與 tunnel failure 混為同一種錯誤。

`clean-runtime-backups.ps1` 預設是 dry-run。只有明確加入 `-ConfirmClean` 才會刪除
`project_backups/`、`exports/` 與 `restore_previews/` 中的 runtime 項目。

腳本不會清理 Canon、outputs 或 visual assets。
