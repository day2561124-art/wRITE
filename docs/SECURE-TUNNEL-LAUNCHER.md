# Writer Workbench Secure Tunnel Launcher

## Operator interface

`launcher.cmd` retains the existing UI, Tailscale Funnel (7), and Cloudflare
Quick Tunnel (8) actions. It adds:

| Choice | Action |
| --- | --- |
| 9 | Start / Restart Writer Workbench Secure Tunnel |
| 10 | Detailed Secure Tunnel status, including a fresh local MCP session probe |
| 11 | Stop only the Writer Workbench Secure Tunnel and disable its recovery |

The main screen displays the separate local Listener, local HTTP identity,
native Runtime liveness/readiness, recent successful control-plane polling, and
recovery configuration. A PID alone never establishes connection success.

Noninteractive entry points:

```powershell
.\launcher.ps1 -StartSecureTunnel
.\launcher.ps1 -RestartSecureTunnel
.\launcher.ps1 -SecureTunnelStatus
.\launcher.ps1 -StopSecureTunnel
```

`StartSecureTunnel` safely reuses a verified existing native Runtime. Choice 9
and `RestartSecureTunnel` explicitly restart the exact verified alias.

## Native lifecycle and recovery

The installed and acceptance-tested CLI is `tunnel-client 0.0.15`, build
`a390c168ff1b2d14e73a95991c186c6aba3ff5a0`. Its own `runtimes connect`,
`runtimes status`, and `runtimes stop` commands manage the detached Runtime.
The Launcher does not implement a replacement daemon or kill a process by PID.

The existing `writer-workbench` Profile supplies the existing Tunnel identity
and loopback HTTP MCP target. Connect always supplies `--tunnel-id`; it never
uses Tunnel create/admin CRUD. A generated `writer-workbench-launcher` Profile
lives in the user's private LocalAppData directory. The original Profile is
preserved. Advanced source Profile settings are rejected for explicit review,
rather than silently dropping authentication or TLS options.

Task Scheduler task `ArmedAcademy.WriterWorkbench.SecureTunnel` runs as the
current interactive Windows user with **Limited** privilege. It is hidden,
ignores overlapping task instances, runs at that user's logon and every minute,
and has a three-minute execution bound. A per-user global mutex fences task
and Launcher mutations. The task contains only script paths and action flags.
It needs no Windows password and does not request elevation.

Reconciliation checks the private `enabled` intent marker. It reuses a live
native Runtime and reconnects a dead one. A live but degraded Runtime is left
running through network outages. The initial health wait allows the native
30-second first long poll to finish. Intentional Stop removes the marker and
disables the task before calling native Stop, preventing resurrection.

Reconciliation also reuses the existing MCP starter through
`start-mcp-tailscale.ps1 -EnsureMcpOnly`. This path starts only an absent local
MCP HTTP Listener, verifies its repository identity, never starts Funnel, and
refuses to restart an existing Listener. Secure Tunnel Stop leaves MCP,
Tailscale, and Cloudflare running. Unregistered foreground tunnel-client
processes fail closed instead of being terminated or duplicated.

Cleanup of the recovery task, without deleting the remote Tunnel or credential:

```powershell
.\scripts\manage-secure-tunnel.ps1 -Action Uninstall
```

## Credentials

Run once in the intended Windows user's PowerShell:

```powershell
.\scripts\set-secure-tunnel-credential.ps1
```

The prompt is hidden. Windows DPAPI CurrentUser encrypts the key at rest in
`%LOCALAPPDATA%\ArmedAcademy\SecureTunnel\runtime-key.dpapi`; the directory and
file ACLs allow only that user and SYSTEM. No raw key goes into repository
files, task arguments, native command arguments, logs, or persistent environment
variables. The manager decrypts only while launching the native CLI, supplies
the official `env:WRITER_WORKBENCH_TUNNEL_API_KEY` reference, restores the parent
environment in `finally`, and clears the unmanaged secret buffer. The native
Runtime inherits the key in process memory, as required for polling.

Native config/state/logs remain owned by tunnel-client in its standard
per-user state directory. Launcher-specific intent/config/generated Profile
remain in the private LocalAppData directory. Do not copy this directory to Git.

The local integration uses outbound Secure MCP Tunnel, as described in the
[official OpenAI documentation](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).
CLI lifecycle details were checked against the installed binary's `--help` and
`help plugin` output, including its Windows detached-process behavior.

## Health interpretation

| Layer | Evidence required |
| --- | --- |
| Local Listener | Successful loopback TCP connection |
| Local MCP health | `/health` returns the expected Workbench service identity |
| Local MCP readiness | Fresh initialize, tools/list, resources/readiness and ping via existing `probe-mcp.mjs` |
| Native Runtime | Native observed `/healthz` and `/readyz` both successful |
| Control plane | Detailed health has a recent successful poll and zero consecutive failures |
| Remote MCP | An actual successful request through the OpenAI connector |
| ChatGPT UI | A successful request in ChatGPT; transport readiness does not prove this |

The existing MCP HTTP server has `/health` and session-scoped `/ready`, **not**
`/healthz` or `/readyz`. The display marks the latter unsupported and never
substitutes a PASS. Runtime health uses the Runtime's actual `/healthz` and
`/readyz`. Remote reachability and ChatGPT calls remain UNVERIFIED in a local
status read; a local probe cannot certify them.

## Engineering boundary

This is an independent Launcher engineering change, not a Pi lifecycle change.
The applicable existing independent workflow is `docs/DAILY-WORKFLOW.md` and
`scripts/pre-commit-check.ps1`: complete tests, explicit staged paths, forbidden
path checks, staged diff review, commit, integration, push and remote verification.
The user's explicit authorization supplies commit/push authority.

`JOURNAL_DEGRADED` originates in
`server/src/mcp-development-journal-tools.mjs:assertMutationAllowed` and the
controlled mutation handler in `server/src/mcp-server.mjs`. It governs those
controlled development calls, including Pi dispatch. The independent pre-commit
script and Git/CI workflow do not consult the live Pi Journal. No guard, hook,
route, confirmation, or policy was disabled or edited for this work.

At research time the shared Journal chain verified, but a separate Pi
workstream's isolated-workspace creation ended with an ambiguous terminal:
`dev_operation_a12dfc0e1a97496aa3b9f41451202510`, workstream
`dev_workstream_20261015-102435_8d5d489be767`, terminal sequence 54725.
This is recorded independently and is not repaired by the Launcher change.
The research-created controlled workspace
`dev_workspace_df8f1a8693d04dd58ec60226` remains an untouched registered artifact;
independent development uses `codex/secure-tunnel-launcher` instead.

The candidate carries forward the existing local Launcher Tailscale routes and
their existing starter dependency, with only the bounded Listener-only extension
described above. Unrelated dirty Canon/config/Pi changes are excluded.

## Verification and remaining manual checks

Focused checks are part of the existing `tests/mcp-tunnel-launcher.test.mjs`
entry, and therefore the existing tunnel and full suites. They exercise actual
PowerShell orchestration with isolated OS boundaries, real DPAPI roundtrip,
key-free CLI arguments, identity rejection, health interpretation, duplicate
Start, explicit Restart, Stop ordering, recovery and least-privilege task setup.

Explicit live acceptance (changes the owned Writer Workbench Runtime):

```powershell
$env:RUN_WRITER_SECURE_TUNNEL_LIVE = '1'
node tests/secure-tunnel-live.test.mjs
```

Evidence is retained locally under `outputs/secure-tunnel-*`. The live test
starts a new Runtime through the Launcher, confirms Launcher completion, closes
only its originating PowerShell, verifies the same Runtime remains healthy,
reopens/adopts it, stops/restarts it, terminates the exact owned Runtime to test
scheduled crash recovery, and compares existing transport state. A separate
temporary task/free port checks fresh MCP Listener survival. Test tasks and
fixture processes are removed afterward.

Actual Windows sign-out/sign-in and a ChatGPT UI call remain manual acceptance
items unless separate live evidence is recorded. Neither is claimed merely
because task configuration or native readiness passes. See the companion
acceptance evidence for the exact completed checks and formal seal status.
