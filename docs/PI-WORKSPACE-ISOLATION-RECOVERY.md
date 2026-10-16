# Host-only workspace-isolation terminal adjudication

This patch is prepared in an isolated source tree. It is not deployed. It adds
no public MCP mutation, force option, environment approval flag or replay path.
The existing17-file P0 payload remains byte-for-byte unchanged.

## Authority and evidence are independent gates

`inspectWorkspaceIsolationMutation` is observational. It checks the exact
original STARTED/ambiguous terminal, terminal hash, request fingerprint, request
workstream/revision, both MCP owners and linked Pi owners. Remote or uncertain
owner liveness fails closed. It reads a checksum-verified registry, fixed
server-owned Git branches/worktree mappings, Git admin bidirectional links,
physical directories, branch reflogs/packed refs, lock/residue files, audit
intents, relevant transaction manifests and successful audit acknowledgements.
It pins the reviewed workstream/file-transaction implementations. No caller
path, Git argv, executable, root, outcome or evidence exemption is accepted.

The inventory has explicit file/count/output bounds, rejects symlinks, and uses
fixed read-only Git argv with controlled process environment. `partial` describes
incomplete/coherence-conflicting evidence; it does not assert that every global
residue was caused by this particular operation. All observations are preserved.

`completed` requires a coherent active/locked/clean target workspace at its
captured base, exact registry revision, branch/admin/filesystem correspondence,
a successful same-owner registry transaction and an exact successful audit
response for the original request. The response bytes and normalized transaction/
audit records are archived in the Journal proof and checked again on cold decode.

`no_effect` requires positive invocation-bound proof of either a pre-handler
failure or an exact legacy pre-write revision-CAS rollback. The latter must have
one same-owner registry transaction, the pinned pre-write error, intact rollback,
the exact request's error audit response and its successful audit-commit receipt.
Both archived chains are re-evaluated on cold decode. No rollback string alone
or missing transaction can prove this outcome.

A shared registry row, dead owner, absent trace or empty inventory is insufficient.
For future failures, an internal WeakMap marks
errors only before `auditedToolCall` enters the handler. The existing Journal
boundary durably publishes that fact, bound to operation/key/fingerprint/owner.
The child pair must precede the original terminal. Caller JSON/error text cannot
mint the fact; it cannot be retrospectively supplied for the original54725.

Native Windows investigation additionally supports the narrowly pinned
`audit_intent_lock_exclusion_v1` witness. A committed foreign transaction proves
the project lock was held across original admission. Its completion leaves less
than the fixed 15-second acquisition timeout before the original terminal. The
exact original request/RPC error and reviewed server control flow exclude an
uncaught post-handler audit timeout. Windows System and Time-Service logs must
cover the interval with no clock discontinuity. Missing access, log clearance,
different source hashes, incorrect requests and a sufficient post-handler
timeout interval reject this proof. Every archived record is rechecked on cold
decode. Inspection never manufactures a retrospective pre-handler event.

Positively older reserved roots and older orphan branch reflogs at a different
base are retained as `legacy_residuals`, never deleted. New or unexplained
workspace/branch/admin residue still blocks adjudication.

`partial` and `unknown` never append a terminal resolution and never dispatch.

## Apply contract

`createDevOperationJournalService({isolationRecoveryAuthority})` accepts a
trusted-host callback, not an MCP argument. There is **no default authority**.
The callback must be wired by an explicitly approved, audited host maintenance
procedure. The user's explicit 2026-10-16 instruction authorizes the bounded
native maintenance entry prepared alongside this review. No external approval
service or new approval workflow is required. The entry archives that instruction
as provenance, uses the existing transactional file writer and project lock,
checks exact deployment hashes, original history bytes and cold-reader identity,
then supplies an exclusive native lock lease to the specialized resolver. A
fixture callback or caller-supplied hash is never production authority.

The callback receives the frozen exact proposal and invokes its supplied body
with `assertExclusive()` and an `authorityReceipt`. The stable receipt contains
`approval_sha256`, `audit_reference`, exact decision/operation/terminal identity,
the observation digest and scope `workspace_isolation_terminal_v1`. The approval
and receipt must remain available for independent audit. Tests use explicitly
labelled fixture receipts only. A production operator must not use that mock.

The callback is responsible for maintaining the lease, not merely checking a lock
file once. If a maintenance window cannot be established, apply is unavailable.
No lock deletion or process termination is part of this implementation.

Before each append, under the existing Journal append lock and head CAS, the
resolver rechecks the lease, owner death, absence of competing operations, and
the complete physical observation digest. It appends the normal STARTED/COMPLETED
resolution pair under `resolution:<original-operation>`. The old ambiguous
terminal stays immutable. The persisted proof/receipt, specialized tool name,
fingerprint and result binding are validated in every full/cold Journal decode.

Identical retries reconcile to the same pair. Conflicting decisions fail closed.
A crash after admission resumes only the exact proof. A crash after the event
file but before head publication can promote only that exact validated dedicated
tail, with original producer death, authority and fresh physical evidence. It
does not delete/rewrite a file or recover foreign tails.

Later legitimate workspace changes do not invalidate an already accepted
historical observation; live drift and historical chain validity are separate.

The inspect-only CLI is `node scripts/reconcile-workspace-isolation.mjs --inspect`.
It rejects `--apply`. An approved host integration can call the exported function
with a properly authorized Journal instance. Deployment itself must first use
that host's approved/audited source-maintenance procedure. This patch does not
install itself or bypass degraded-Journal protections using PowerShell.

## Pi continuation

Completed adjudication includes the exact lifecycle binding in the verified
receipt. Existing `reconcileOnly` consumes the receipt and pauses before later
dispatch. An adjudicated no_effect produces `NEW_IDEMPOTENCY_KEY_REQUIRED` with
the causal receipt; `reconcileOnly` persists DECISION_REQUIRED, releases ownership,
clears the old active claim, and retains the immutable original intent/key/pending
step. It neither schedules a retry nor dispatches. Unknown/partial/non-adjudicated
or mismatched evidence leaves the claim unchanged. Any new effect requires a new
explicitly authorized plan with a causal link to the old operation/resolution.

## Review/deployment boundaries

The baseline includes pre-existing uncommitted legal Journal recovery support.
The manifest records exact working-source before/after hashes. Do not stage that
entire dirty main file or silently incorporate prior P1 work. An approved host
source-maintenance review must preserve its existing legal-history decoder.
The existing full registry decoder is exported read-only, rather than rewritten.
The two existing live-source verifiers retain every historical source hash and
add only the exact reviewed decoder-export revision. Deploy the new decoder to
all authoritative readers before any resolution is appended; old cached runtime
code must be quiesced/reloaded through the approved maintenance procedure.
Secure Tunnel processes/workspaces must not be killed or modified to obtain it.

This patch and the existing17-file P0 candidate both change mcp-server.mjs and
pi-mcp-reliable-adapter.mjs. They must be combined by reviewed three-way merge;
blindly running the original installer after host deployment correctly fails its
before-hash guard. Do not weaken the guard. The original workspace/base/intent
remain immutable; later formal preflight uses actual current main HEAD.

No original operation is adjudicated merely because these tests pass. Required
formal deployment authority and sufficient original-effect evidence remain
separate from isolated implementation validation. P0/P1 integration, commit,
push, authoritative remote verification and seal remain outstanding.
