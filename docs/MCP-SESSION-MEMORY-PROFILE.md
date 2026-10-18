# MCP Session memory profile

This opt-in JSON profile uses the HTTP host's existing environment configuration. It sets the idle timeout to 900,000 ms (15 minutes) and the idle-session cap to four. The total-session limit is unchanged (default 32). It does not change server defaults, the Journal, or the Pi execution engine. The profile is configuration data, so loading it does not require changing PowerShell execution policy.

At an approved host start or service maintenance window, load the profile in the same PowerShell process that runs the existing launcher:

```powershell
$sessionProfile = Get-Content -LiteralPath .\config\mcp-session-memory-profile.json -Raw | ConvertFrom-Json
$env:MCP_HTTP_SESSION_IDLE_TIMEOUT_MS = [string]$sessionProfile.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS
$env:MCP_HTTP_MAX_IDLE_SESSION_COUNT = [string]$sessionProfile.MCP_HTTP_MAX_IDLE_SESSION_COUNT
# Run the existing approved MCP launcher in this process.
```

Loading these values in a separate PowerShell process does not configure the launcher. For WinSW, put the same two environment values in the reviewed service configuration during its normal maintenance procedure; the existing service renderer does not import this JSON profile. Loading the profile cannot change an already running Listener. Review service configuration and use the existing audited activation procedure before changing production. To restore previous behavior, restore the prior environment values at the next approved start.

An HTTP POST begins activity before the body is read, and finishing a request refreshes its idle timestamp. A session is reclaimable only when its active request count and adapter pending-call count are both zero. Pending logical calls include adapter retries and recovery work. The cap removes the oldest safe idle sessions; when all sessions are busy, total-cap admission rejects the new session instead of terminating an existing call. The default timeout reaper runs every 60 seconds, so expiry is acted on at the next sweep after 15 minutes of inactivity.

SSE GET, keepalive traffic, and SSE reconnects do not refresh the idle timestamp or pin a session. After eviction, the old session ID returns 404; clients must initialize a new session. Its MCP child performs the normal cold startup, including complete Journal validation. A response lost during a mutation must be reconciled by its original key before any retry; eviction does not grant replay permission.

The durable Pi worker is owned by the HTTP parent, separately from session children. An admitted operation is persisted in the Journal and continues after its submitting session expires. This profile does not stop, restart, or alter the worker, and does not reclaim the HTTP parent. Long-running synchronous MCP calls remain protected by pending-call accounting; this profile does not change call deadlines.

The regression fixtures exercise the actual HTTP/stdio adapter, accelerated idle timeout, cap pressure, pending calls, SSE eviction/reconnect, cold initialization and durable Pi completion after submitter eviction. Fixture-only gates pause an actual read or worker dispatch; they do not manufacture execution results. Fixture cleanup closes only held child-process handles, avoiding Windows PID-tree collisions. Memory observations compare eight initialized idle sessions under the previous and proposed caps, measuring parent/session/worker process working sets and private committed bytes. These are fixture measurements, not production RAM measurements; summed working sets may include shared pages.

Run the existing `tests/mcp/mcp-http-session-lifecycle.test.mjs` entry point to include the profile regressions in the established MCP infrastructure and full MCP routes. The profile can be validated independently with `node --test tests/mcp/mcp-session-memory-profile.test.mjs`.
