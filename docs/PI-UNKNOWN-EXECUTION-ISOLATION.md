# UNKNOWN execution revocation

This repair extends the existing reliable Projection and append-only Journal.
It adds no store, executor, recovery framework or Lifecycle state.

`createPiReliableExecutionStore({isolationAuthority}).isolate(request)` is a
host-only entry. Worker commands, ExecutionIntent actions and MCP metadata
cannot grant this authority. The host must separately approve the GPT decision
and prove that executors, queued dispatch and conflicting side effects are
quiescent. Dead PID alone is insufficient. The default store cannot isolate.

The request contains exactly `operation_id`, `context`, `expected_revision`,
`expected_projection_hash`, `expected_owner`, `decision_id` and `reason`.
An independent `isolationAuthority({record,request})` must return exactly true.
Active or unidentifiable owners are refused. Publication retains the existing
revision/prior-hash CAS and atomic Journal publication and recovery contract.
The irreversible record anchors the prior projection, retains UNKNOWN, owner,
active claim, checkpoint, receipts and all historical evidence, and revokes
future owner transitions, reconciliation, retry and dispatch.

Dispatch revalidates the authoritative revision, projection, worker and claim
after scope checks. Managed MCP contexts recheck that authority at invocation,
handler execution and workstream registry transaction. The original mutation
key is also rejected at the MCP boundary. An isolated result stops the existing
submission host. Other intents retain their original workspace, permission,
dependency and idempotency checks; no global UNKNOWN bypass is introduced.

## Activation boundary

The original `pi_operation_ab4776c172b84bfa921ee99117a6728d` has **not** been
isolated by this change. Production remains unchanged. Its expected anchor is
revision 7 / `9a85232d2e6f8b74f0cfc6f87a1001f43644bc628feeefdac9f9344c09b7dbbb`.

Activation requires independent Production authorization, a verified supported
cold Runtime transition, and fresh quiescence/resource evidence at the host.
All Runtime entry points must load the tested validator and dispatch fences
before publishing isolation. Older validators fail closed on the new record;
do not publish it into a running older Runtime. The host authority callback is
the trust boundary, not a caller-supplied claim of safety. Do not install a
callback that accepts arbitrary requests or relies only on PID liveness.

After authorized publication, reread the full validated history and demonstrate
that the marker persists, UNKNOWN evidence remains intact, the original key
is refused and unrelated integration retains its ordinary Gate. Only that
actual authority evidence can support SAFE_ISOLATED.

## Verification scope

The old ready candidate `dev_integration_20261009-031803_23e2fbe65047` remains
bound to `8864232a`. Its complete MCP/tunnel PASS does not cover `fa5293a`,
`7ecef48` or this repair. The successor uses formal existing Preflight and
Validation against its exact Git tree. Focused tests use temporary real
Journals, fresh stores and actual child process exits at both publication
boundaries. Production tests are never substituted for actual activation.
