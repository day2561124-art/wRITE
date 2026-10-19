# MCP session memory profile

`config/mcp-session-memory-profile.json` is the shared versioned source for the
15-minute idle timeout and four safe idle sessions. The total session limit
remains 32 unless independently configured through its existing environment variable.

## Supported startup paths

The HTTP Listener loads the profile from its own deployment directory before it
creates the worker or opens a port. This covers the Windows Launcher's Tailscale
and Cloudflare choices, `start-mcp-tailscale.ps1` (including `-EnsureMcpOnly`),
`start-mcp-tunnel.ps1` (including `-ServiceHost`), and direct HTTP Node startup.
No per-launch environment commands are needed. The profile path is independent
of the caller's current directory and supports Unicode and spaces. The default
HTTP configuration path also resolves from the deployment directory.

Precedence is **validated explicit environment > validated versioned profile**.
Both profile values are always checked first. Missing, malformed, incomplete,
unknown-key or out-of-range profiles fail startup; valid inherited overrides do
not conceal a broken profile. Empty or invalid explicit overrides also fail.
The profile accepts exactly two string integer values, with the same bounds as
the Listener's existing settings. It does not change the total session cap.
Overrides are deliberate deployment choices, not persistent edits to the JSON.

The Listener process receives the effective settings before spawning children.
Its existing startup log records the actual timeout, idle cap, total cap and
reaper interval. MCP identity includes the loader and versioned profile, so
changes require an approved activation rather than silently reusing an old process.
Loading a profile does not reconfigure an already running Listener.

## WinSW configuration

`scripts/manage-mcp-service.ps1 -Action Render` (also Install/Refresh) calls
`scripts/read-mcp-session-profile.mjs`, which uses the same loader and reads the
versioned values independently of the rendering shell's incidental overrides.
The reviewed XML contains both environment values; service identity, executable,
arguments, working directory, credentials, recovery actions and security remain
unchanged. Rendering failure leaves an existing XML intact. This does not install,
register or start a service. Follow the existing reviewed service procedure;
never register a second service to test a configuration.

After changing the profile, review and Refresh the generated service XML during
approved maintenance so its explicit values agree with the new profile. An old
XML with no memory environment entries still obtains the profile at HTTP startup.
Existing explicit XML/environment overrides retain their documented precedence.
If WinSW is absent, report XML generation and child-environment tests separately
from actual SCM cold-start verification; do not claim a service was started.

## Lifecycle and validation

Active HTTP requests and pending stdio calls protect a Session. SSE alone does
not pin an idle Session. The durable Pi worker belongs to the HTTP parent and
continues accepted operations after producer Session reclamation. A reconnecting
client creates a new Session. Idle close uses its held child handle and does not
traverse recyclable Windows PID trees. Worker heap reclamation is outside this profile.

`tests/mcp/mcp-launcher-session-profile.test.mjs` checks validation, precedence,
Unicode/space paths, real WinSW rendering, Node inheritance, cold start and restart.
It joins the existing `tests/mcp/mcp-http-session-lifecycle.test.mjs` formal route.
Existing memory regressions exercise the actual 15-minute configuration plus an
accelerated TTL through the same validated override path, idle-cap reclamation,
pending calls, SSE, reconnect and actual durable background completion. They do
not sleep 15 minutes or substitute a mocked worker.

## Activation and rollback

Use the existing audited host-maintenance procedure after verifying Journal,
owner/call state, locks, exact process births and rollback conditions. Do not use
the launcher's forceful takeover options as a maintenance substitute. Preserve
Secure Tunnel configuration and disabled login-recovery tasks. Never kill an
unknown process or replay an uncertain operation.

Configuration rollback uses explicitly reviewed `7200000` / `16` environment
values at the next approved start (and reviewed WinSW XML where installed),
with total cap unchanged. Source rollback uses a new reviewed revert candidate,
tests, Pi Integration and Push; never reset/force-push or rewrite Journal history.
Preserve original profile, XML, startup logs and maintenance receipts for both.
