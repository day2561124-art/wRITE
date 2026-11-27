# R16 independent execution: provider decision and pilot

Status: experimental read-only probe; no provider chosen for production, no
account or resource created, no paid workload approved, no live capability
enabled. Baseline #151 merged bf62642a00dbca4da9528b1e3b31984aebb1deba,
identical tested tree (22 evidence/recovery tests on each platform, full CI).

## Decision boundary

The current GitHub collector intentionally requires exact provider identity,
reviewed workflow and separate raw process outcome. GitHub's job/step
conclusions do not supply the latter. Do not add a fabricated exit code, put
keys in candidate-controlled workflows, relax host grants, or run candidate
tests unconfined on the protected workstation.

Azure Batch is a feasibility candidate, not a required new dependency.
The Get Task API documents executionInfo.exitCode, result, failureInfo,
timestamps, retry/requeue counts, task ETag and command line. It supports
task-scoped non-admin identity. AWS Batch Fargate also exposes container exit
codes and Windows/Linux containers, but Windows container compatibility is
not equivalent to a full Windows VM (especially Session 0 and native
AppContainer tests). Neither provider has been enrolled or tested live.

References:
- https://learn.microsoft.com/en-us/rest/api/batchservice/tasks/get-task?view=rest-batchservice-2025-06-01
- https://learn.microsoft.com/en-us/azure/batch/batch-user-accounts
- https://docs.aws.amazon.com/batch/latest/APIReference/API_ContainerDetail.html
- https://docs.aws.amazon.com/batch/latest/userguide/create-compute-environment.html

## Pilot implemented

Read-only GET client binds a host-selected public Azure Batch endpoint and
credential, refuses redirects, bounds responses, reads only exact job/task
identifiers. Observation uses a host-owned immutable submission record,
checks expected task creation, pool, fixed command, non-admin task identity,
finite deadline and no configured retry, requires completed state and actual
provider exit code, rejects observed retry/requeue or stale time, re-reads with
the exact ETag. Actual nonzero codes are preserved. The probe never claims
suite pass, validation certification or execution authority. No GitHub job
IDs are fabricated; this is a distinct provider contract. Unit fixtures
exercise actual REST-shaped data and transport but do not contact Azure.

A provider outcome by itself is insufficient. Node recovery can restart a
task outside retry counters; strict single-attempt evidence needs additional
control-plane history. Task command text and a ledger definition digest do
not prove what binary or image executed. No task-submission path is included.

## Required pilot before any production design commitment

1. Independently approved disposable Windows and Linux compute resources,
   pinned image and launcher hashes, isolated network, task-scoped identity
   and no signing/control-plane credentials in the candidate guest. No
   admin candidate process on the supervisor host.
2. Trusted submission ledger binds exact candidate Git object/tree and
   immutable suite manifest, job/task generation, command, image, pool and
   node identity. Source transfer must verify the exact object and avoid
   giving the guest reusable repository credentials. Verify provider audit
   history and reject retries/restarts, replacement or ambiguous attempts.
3. Execute the actual unchanged focused, full, affected and postseal gates
   in the corresponding isolated environments, compare with existing CI.
   Separately prove Windows-specific tests needing native OS facilities; if
   they require elevation, do not weaken guest/control-plane separation.
4. Demonstrate real success, failure, timeout, cancellation, cleanup and
   lost-observer cases; establish whether provider evidence can certify each
   mandatory suite. Only then implement a separately reviewed evidence
   schema and adoption route. Do not relabel Batch results as GitHub jobs.
5. If no approved compatible provider is available, retain the existing
   unavailable capability and explicitly report the missing operator-owned
   execution boundary. No further receipt wrappers can substitute for it.

Existing protected host remains unchanged. Local dirty main migration and
release acceptance are separate from this experiment.
