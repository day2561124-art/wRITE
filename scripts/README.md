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
| `manage-mcp-service.ps1` | 產生並管理 WinSW Windows Service 設定，讓 SCM 負責 MCP + named tunnel 的 process survival |

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

## MCP resource bounds / diagnostics

R4 對 MCP HTTP parent 與 stdio child framing 加入硬上限。HTTP POST body 預設最多 4 MiB，可用 `MCP_HTTP_MAX_POST_BODY_BYTES` 調整；超限會回 `413 Payload Too Large`，不會繼續累積 request body。Child stdout framing 預設單一 frame 最多 16 MiB、header 最多 16 KiB，可分別用 `MCP_HTTP_CHILD_MAX_FRAME_BYTES` 與 `MCP_HTTP_CHILD_MAX_HEADER_BYTES` 調整；overflow 會 fail closed 為 `CHILD_PROTOCOL_OVERFLOW`，原 in-flight request 不會被 replay，後續仍由既有 bounded child recovery 負責。

資源邊界事件會寫入 `MCP_DIAGNOSTICS_DIRECTORY`（預設 `data/outputs/logs/mcp-incidents`）。Diagnostics 只保存 bounded runtime / heap / resource summary 與經過 redaction 的 Node report subset，不保存完整 environment 或 network endpoint；檔案數可用 `MCP_DIAGNOSTICS_MAX_FILES` 設定。

`start-mcp-tunnel.ps1` 也會限制自己管理的 MCP/cloudflared logs。可用 `-MaxManagedLogFiles`、`-MaxManagedLogAgeDays`、`-MaxManagedLogTotalMegabytes`、`-MaxLauncherLogMegabytes`、`-MaxLauncherLogArchives` 調整；目前 state 指向的 active cloudflared logs 與正在使用的最新 MCP log pair 會被保護，其他 outputs、Journal、checkpoint 與 incident store 不在這個 retention scope。

## MCP Windows Service / SCM

長時間執行建議讓 Windows Service Control Manager 負責整體 process survival，而不是讓互動式 PowerShell launcher ���己無限重啟。R3 使用 WinSW 作為 service wrapper；WinSW executable 請自行下載並放在 repository 外，專案不會 vendor 或自動下載 service binary。

Service 模式只接受固定 hostname 的 named tunnel，而且只接受 **token file**。token file 必須存在於 repository 外；`TUNNEL_TOKEN` / `WRITER_MCP_TUNNEL_TOKEN` raw token 會被 service manager 與 `-ServiceHost` fail closed 拒絕。

先產生可審查的 WinSW XML：

```powershell
.\scripts\manage-mcp-service.ps1 -Action Render `
  -Hostname 'mcp.example.com' `
  -TokenFile 'C:\secure\writer-mcp-tunnel-token.txt'
```

確認 XML 後，再提供另外下載的 WinSW executable 安裝：

```powershell
.\scripts\manage-mcp-service.ps1 -Action Install `
  -WinSWPath 'C:\tools\WinSW\winsw.exe' `
  -Hostname 'mcp.example.com' `
  -TokenFile 'C:\secure\writer-mcp-tunnel-token.txt'
```

之後可使用 `Start`、`Stop`、`Restart`、`Status`、`Refresh`、`Uninstall`。WinSW recovery 是 bounded：第一次失敗 15 秒後 restart、第二次 60 秒後 restart、之後 `none`；連續健康 15 分鐘後 failure count reset。`-ServiceHost` 只監看 MCP HTTP parent 與 managed cloudflared process 是否真的死亡；短暫 remote transport / DNS / Internet outage 不會被當成 service crash。

`clean-runtime-backups.ps1` 預設是 dry-run。只有明確加入 `-ConfirmClean` 才會刪除
`project_backups/`、`exports/` 與 `restore_previews/` 中的 runtime 項目。

腳本不會清理 Canon、outputs 或 visual assets。
