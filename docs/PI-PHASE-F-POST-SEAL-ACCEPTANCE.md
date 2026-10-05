# Phase F Post-Seal lifecycle and introspection

This change closes PF-G1–PF-G8 on the existing sealed GPT → Pi → MCP route.
GPT supplies the scope, exact mutation bytes, tests, permissions and publication
decision. Pi dispatches those actions and persists execution facts. MCP performs
the bounded filesystem, workspace, test and Git operations. No second reasoning
agent, workflow engine, scheduler, gateway or routing layer is introduced.

## Production contracts

An explicit bootstrap intent starts in the shared observation context with no
workstream ID. It admits one ordered begin/create-isolated pair. The registry
persists the inception key/fingerprint and the resulting workstream/workspace
relationship. Downstream actions bind to receipts from that same durable Pi
operation, rather than caller-supplied future IDs. Workspace base HEAD and
revision are checked. Legacy operations are not migrated.

Recovery uses the existing workstream, checkpoint and operation APIs. Paused
workstreams can resume with exact CAS. Blocked workstreams require a durable
resolution in the same workspace; a failed test requires a later passing result
for the same suite. Missing, stale, foreign, partial or corrupt evidence does not
authorize dispatch. Ordinary updates cannot reopen a terminal workstream.

Bootstrap recovery inspects actual registry and Git worktree state after lost
responses or process death. A completed effect is returned without replay.
Partial/unknown effects stop for GPT. Checkpoint inspection preserves the
original workstream, workspace, base and physical checkpoint identity.

Read-only `dev_capability_get_schema` and capability discovery return bounded,
server-owned version/schema/hash and exposure metadata. They accept capability
names, rather than source paths or modules. Explicit version/hash expectations
are checked before dispatch and drift requires a GPT decision. Previously sealed
intents without expectations retain their compatible admission semantics.

JSON Schema syntax uses the installed Ajv 2020 validator, with coercion, defaults
and removal of extra properties disabled. Existing ordered serialization and
`hashExecutionInput` provide deterministic SHA-256 hashes. No RFC8785 compliance
claim or second validator/serializer is added. Permissions, identity, public
metadata policy and lifecycle semantics remain project-owned checks.

## Regression commands

Use the existing controlled `dev_run_tests` suite `mcp_pi_postseal` for the bounded
lifecycle, introspection, Journal, physical-worktree and cold-process regressions.
The original full `mcp` gate additionally includes the actual MCP wire lifecycle
acceptance. The focused suite excludes the wire scenario, because the wire
scenario itself invokes the focused suite through MCP.

The wire scenario uses the installed official MCP SDK and an owned Git fixture:
begin → isolated workspace → read → write → checkpoint → abrupt child exit →
fresh MCP process → same durable operation/identity → test → commit → paused →
active → end → duplicate terminal projection. It asserts zero repeated effect
admissions, healthy Journal, no dangling operations and unchanged fixture main.
The separate cold-process scenarios interrupt after begin effect, worktree
effect and checkpoint receipt. A physically partial worktree scenario must
remain ambiguous and authorize no replay.

Existing stable MCP/tunnel integration selection, timeout and validation gates
remain intact. Third-party protocol diagnostics do not replace lifecycle tests.
Exact candidate validation receipts and runtime publication/soak receipts are
recorded in the server-owned Journal and the publication evidence artifacts.

## Minimal tooling decisions

Official Conformance 0.1.16 was tried only through an ignored npm-exec dev cache.
The initialize, ping and tools/list scenarios reported success, but two Windows
Node 24.18 shutdowns aborted with `UV_HANDLE_CLOSING`; the diagnostic runner
correctly returned FAIL. Its automatic CI gate is deferred. No runtime upgrade,
exit masking or framework-specific `test_*` product tools were added.
Inspector was skipped because inventory/exposure already existed. Ajv, Node
crypto, Node test/mock and the official SDK are reused without new dependencies.
Canonicalize was skipped because deterministic ordering was already established.
Future workflow engines, gateways and schedulers remain outside this workstream.

## Append-only Journal repair

Original failed/recovered terminal events are immutable. A GPT-authorized
resolution binds the terminal hash, request fingerprint and exact evidence.
No-child proof permits a no-effect resolution. Completed file-create proof also
requires the unique child terminal, original workspace/path and current physical
SHA-256. Stored resolutions dedupe before transient PID liveness checks, so PID
reuse cannot create a second resolution event or authorize a replay.

The independent reader prerequisite was validated and published before this
Post-Seal change. Its one-shot maintenance publication reused the original
parent integration control and guards; no public repair endpoint was added.
A tiny parent-owned Journal repair ingress can be evaluated separately in the
future to avoid cached-reader bootstrap deadlocks. It is not implemented here.

The 37 user-attested shared-main engineering/runtime overlays are preserved and
excluded from publication. `pi_default` remains enabled throughout construction.
Continuation Trigger and the other independent workstreams remain separate.
