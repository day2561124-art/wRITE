# GPT × Pi durable production execution

This change keeps the existing authority split: GPT supplies exact intent and
permissions, Pi persists and schedules, and MCP executes and journals effects.
The existing production route, owner fencing, revision CAS, intent hashes,
idempotency keys and effect reconciliation remain authoritative.

## Submit, worker and status

`dev_pi_execute_intent` durably admits new requests with the
`writer-workbench/pi-durable-worker/v1` production binding and returns the
operation before dispatch. Admission and the enrollment marker share the
existing journal publication and route CAS. Losing the response or wake cannot
lose work. A duplicate returns the same operation and current verified facts.

The HTTP host supervises a separate fixed Node worker process. Its lifetime is
independent of individual MCP/ChatGPT connections. A standalone stdio deployment
can run `node scripts/pi-worker.mjs` as a persistent host process. The supervisor
restarts failed worker processes with capped exponential backoff. After host
restart, the same discovery uses persisted journal records. No second queue,
model client, workflow planner or routing authority is introduced.

The worker scans enrolled operations and uses the existing reliable engine to
claim ownership under revision CAS. Live/uncertain owners remain fenced. A dead
owner is insufficient evidence of no effect: an interrupted mutation is first
reconciled against its exact MCP key/fingerprint. Only a completed receipt or
verified not-admitted evidence permits the existing safe continuation rules.
Unknown effects stop for a GPT decision. Isolated, terminal and decision-required
operations are excluded from discovery. Older production operations require
explicit submission while still pristine CREATED before enrollment; merely
starting a worker does not activate earlier P1 or unrelated operations.

New durable admission is bounded to 128 outstanding enrolled operations under
the existing append lock. Execution is sequential within each worker; multiple
workers are protected by the same owner/revision fence. Draining stops further
claims and lets the current bounded operation finish. Abrupt exit leaves durable
claims and receipts for the next process. Status has a separate observational
MCP lane and never invokes admission, recovery or dispatch.

## Integrity and performance

The default controller derives execution history and production routes from one
fully verified journal snapshot. Explicit custom journals/routes retain their
independent authority. The prior isolated P0 status improvement is retained:
after complete-history validation, the per-operation consistency check receives
only that operation's verified chain.

Semantic validation can extend a previously validated history only after freshly
recomputing the canonical SHA-256 content digest of **every** prefix event,
including its complete projection and envelope. A claimed event hash or unchanged
head does not authorize reuse. The journal still independently checks the full
physical hash chain and immutable-file metadata. Cache state and returned maps
do not alias; changed prefixes, invalid suffixes, duplicate identity and foreign
keys fail closed. The cache has one private snapshot; short histories do not
displace the full production snapshot.

After a successful exact projection append, receipt construction reuses only
that request's verified history plus the returned exact event. A concurrent
duplicate returning different projection bytes forces a fresh history lookup.
The journal append lock, publication protocol and revision checks are unchanged.

The production adapter allows bounded verification runners to finish under the
existing eight-hour outer ceiling. Ordinary production dispatch remains bounded
to thirty minutes, and lookup to five minutes in the existing production host. The CLI submits once and subsequently
polls read-only status; a lost submit response retries only the original intent.

The installed Pi 1.0.4 sidecar cold probe measured 14.57 seconds on this host,
near the previous 15-second ceiling. The readiness probe now has a 60-second
bound; SDK exports and version compatibility are still checked. No dependency
upgrade or readiness cache is introduced.

## Evidence and activation

Focused tests cover durable admission, duplicate identity, bounded admission,
unselected legacy operations, concurrent workers, drain, content corruption,
publication/restart, and actual process death before dispatch, after a physical
effect/MCP receipt, and after the Pi receipt. The existing real SDK wire lifecycle
continues through independent workers and kills the submitting connection before
execution. Existing regression and final integration manifests remain required.

Preparing these source bytes is not acceptance or activation. Formal test
receipts, exact candidate preflight/validation/integration, commit/push, remote
verification and runtime checks determine completion. No historical journal
event, including 54585/54586, is modified by this change.
