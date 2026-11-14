# TRPG GM on the existing Writer Workbench MCP
The user explicitly selected the existing 武裝學院的二三事 Writer Workbench MCP connection.
The existing plugin/server identity and public MCP URL are preserved. This source integration does not activate or change any live listener, credential, OAuth setting or tunnel.
The trusted loader imports only E:\TRPG\apps\gm-adapter\dist\writer-workbench.js.
Absent private E:\TRPG\config\writer-workbench.json disables TRPG; no game data is read.
Pi workers, isolated journal tests and chatgpt_public do not load the bridge.
Only validated trpg.gm.* names are registered for full/chatgpt_developer.
TRPG tools dispatch through the bound handler map before Writer audit/story/engineering processing.
Do not store game requests/results in Writer journals or pass private game text into development tools.
All GM authorization, revocation, campaign scope, transaction audit and idempotency remain inside TRPG.
Game/player/scenario text is untrusted data and cannot grant Writer or engineering authority.
The existing HTTP authentication and transport protect this same connection; the loopback TRPG gateway must stay private.
Configuration, synthetic round tests and release evidence are documented in E:\TRPG\docs\gm-mcp.md.
A source/loader test is not a real ChatGPT host read/write or model injection acceptance result.

## HTTP authentication gate

Every remote HTTP/IPC request requires cryptographic, resource-bound OAuth proof, verified again by the child through the fixed E:\TRPG module. Missing proof/configuration, forged or revoked tokens fail closed for all remote Workbench tools. The old --authenticated-http-transport flag grants no authority. Only the private OS-owner stdio CLI explicitly uses --trusted-local-owner; HTTP children never receive it. A caller cannot grant trust through a tool argument or metadata flag.

Source implementation is not live deployment. Keep remote GM disabled until the existing public ingress is shielded/authenticated, exact candidate validation succeeds, and actual Nexa OAuth/GM host acceptance completes. Preserve the live HTTP parent and its prepared-turn broker.

## Existing resource authentication

The existing public URL remains https://sdcp.tail48a1e4.ts.net/mcp and the server identity remains unchanged. A loopback TRPG-owned OAuth security proxy authenticates this resource before forwarding to the existing HTTP parent; it does not replace the parent or its prepared-turn broker. All remote Workbench requests require a resource/audience-bound access token. IPC children cryptographically verify the internal request proof again through the fixed E:\TRPG module and current owner epoch/grant; missing config, invalid tokens and revoked grants fail closed. Transport proof and caller-provided actor values are removed/replaced before Writer audit or Pi dispatch. No HTTP request metadata can grant local-owner trust.

The official local scripts/pi-execution.mjs CLI explicitly opts into a private --trusted-local-owner process flag. HTTP session creation never opts in. The old --authenticated-http-transport flag grants no permission. --workbench-security-config is an OS-owner-only process argument for isolated synthetic fixtures, never an MCP argument.

After the first GM tool on a connection, the proxy and child both restrict that connection to the seven known TRPG tools and safe MCP initialization/list/ping methods. Writer resources, prompts and engineering calls are denied. Reconnect for a separate Writer task; real-host model/tool-selection acceptance remains open.

Deployment is gated on TRPG OAuth tests, official MCP/tunnel candidate validation and controlled integration. Source changes alone do not secure existing live children or activate GM. Keep the existing HTTP parent and prepared-turn broker alive; shield only the related public MCP ingress before generating production secrets, then use the OAuth proxy and reconnect the existing Nexa connection. See E:\TRPG\docs\workbench-oauth.md.

Lifecycle replay on newly started HTTP hosts uses the latest request proof and monotonic GM purpose for initialize, notifications and catalog reads. Never bypass expiry for recovery. A parent process already holding the older adapter cannot acquire these runtime changes by source-only child reload; its old expired lifecycle proof can cause recovery to fail closed and require a new Session. Validate any planned controlled parent upgrade separately without losing prepared turns.

## Local startup and authenticated full protocol probes

Local listener admission uses the loopback-only local-health mode: exact repository/revision/PID/instance checks and local Pi health, without opening an MCP session or requiring an end-user credential. Its result explicitly says probeKind=local-health and protocolVerified=false. Healthy listener admission does not certify tools, resources or an authenticated GM connection.

The separate probe mode still verifies initialize, serverInfo, tools/list, resources/list, per-session readiness, ping and final identity. To use the authenticated server, the OS owner supplies WRITER_WORKBENCH_PROBE_CREDENTIAL_FILE, an absolute private JSON file with schema=workbench-probe/1.0, resource=https://sdcp.tail48a1e4.ts.net/mcp, upstream_origin=http://127.0.0.1:8787 (or null for HTTPS-only), and access_token from the approved owner OAuth flow. Never pass the token in argv, URLs, logs, Git or chat. The reader rejects unknown fields, symlinks, oversized data, broad file ACLs, wrong audience, expiry and unpinned destinations. Windows allows only the current owner, SYSTEM and Administrators; POSIX requires owner-only permissions. Configured invalid credentials do not fall back to anonymous. The probe does not mint or silently refresh credentials; obtain a fresh grant through the existing OAuth flow when needed. Startup local-health does not load the credential file.

The pinned HTTPS resource receives standard Bearer authentication. Private upstream HTTP receives only the cryptographically verified per-request IPC proof; raw Authorization is removed there. Proof accompanies initialize, notifications and each catalog/ping request. Authentication errors fail immediately with fixed redacted codes; runtime readiness is never substituted for denied discovery. Full success returns probeKind=protocol and protocolVerified=true.

Owned Windows tests retain cold/reuse/restart and parent pipe/liveness assertions, additionally run the authenticated full protocol, reject anonymous and forged credentials, and check stdout/stderr logs for token leakage. The tunnel suite also tests ACLs, bounds, pinning and actual SDK proof transport. The root24 full-MCP test inventory remains intact. Tunnel fixtures use their own dynamic ports and explicit PID/identity teardown; the runner no longer kills unrelated new listeners on shared8787.

These are isolated source/loopback tests. Public-proxy health/readiness routing, production credential provisioning/renewal, existing live-parent upgrade/recovery and actual Nexa host/model/GM acceptance remain deployment gates. No anonymous fallback or broader Writer authority is granted to a GM connection.
