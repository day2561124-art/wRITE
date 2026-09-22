# Verification test classification (VA-2)

VA-2 adds a machine-readable classification contract for every committed `tests/**/*.test.mjs`.
It does not change `tests/run-all.mjs`, CI routing, certification membership, MCP validation, or
integration gates.

## Schema

Each test resolves to:

- `kind`: unit, contract, invariant, subsystem, integration, e2e, infrastructure,
  certification, or reliability.
- `component` and `components`: primary and overlapping subsystem ownership.
- `dependencies`: conservative static evidence such as filesystem, process, network, git,
  environment, clock, or persistent_state.
- `hermetic`, `parallel_safe`, `cacheable`, `external_state`: execution properties used
  by later VA phases.

The implementation is intentionally conservative. A test is not marked hermetic merely because
its filename looks local. Filesystem/process/network/persistent-state evidence prevents promotion.
VA-9 may later promote individual tests after hermetic behavior is demonstrated.

## Why rules instead of a hand-written 600-line manifest

The classifier is code plus a repository-wide contract. The contract recursively enumerates every
committed `.test.mjs`; an unclassifiable or malformed result fails immediately. This keeps the
inventory complete as the repository evolves and gives later routing, sharding and cache work one
stable source of metadata.

The approach follows mature test-suite practice: keep execution level/environment metadata
machine-readable, separate expensive or infrastructure-dependent tests from fast deterministic
checks, and make unhealthy/external-state characteristics explicit rather than hiding them behind
a generic PASS/FAIL result.

## Verification

Run:

```powershell
node tests/test-classification.test.mjs
```

The command prints aggregate kind/flag counts and must report complete one-to-one classification.
VA-2 does not claim that conservative `false` values are permanent; later phases may refine them
only with evidence.

## VA-9: reviewed hermetic Core versus external-state MCP tests (first slice)

The VA-4 `mcp_core` label identifies *functional ownership*, not an
environmental guarantee. Its legacy 24-script partition (Core,
Infrastructure, Reliability), full runner, routing, and all certification
gates remain unchanged. The legacy scripts have conservative
`external_state: true` and `hermetic: false` group metadata because the
legacy execution surface includes real child processes, host files, HTTP,
ports, live service/tunnel interactions, and persistent runtime state.
This is not a claim that each assertion itself performs every operation.

VA-9 adds the standalone, additive entrypoint
`tests/tools/mcp-hermetic-core.test.mjs`, containing only the reviewed
failure-classifier and controlled-retry *policy* unit tests. Their inputs
are local fixtures and pure modules; there are no real ports, spawned
children, external network, public tunnel, or live Journal/transaction
access. The explicit allowlist in `mcp-suite-groups.mjs` must match its
static imports exactly. The test inventory classifies these two files
and their pure entrypoint as `unit`, `hermetic: true` and
`external_state: false`, fails closed if any gains static external
dependency evidence, and conservatively marks the original MCP scripts
`external_state: true`. Any still-ambiguous test remains unpromoted;
filename-based assumptions are insufficient.

Run the independent core, reviewed script inventory, and repository-wide
classification contract:

```powershell
node --test tests/tools/mcp-hermetic-core.test.mjs
node tests/tools/mcp-suite-groups.test.mjs
node tests/test-classification.test.mjs
```

`cacheable` remains **false** for the reviewed MCP hermetic subset until
VA-11 explicitly validates cache inputs. VA-10 may promote only individual
tests that independently satisfy its parallel-safety review; the aggregate
MCP hermetic entrypoint remains serial. This does not assert that `mcp_core`
is wholly hermetic or replace the legacy formal MCP / MCP tunnel gates.

## VA-10: bounded parallel / sharding (first reviewed slice)

Parallel execution is fail-closed and remains opt-in. Hermeticity is a
necessary condition, not automatic permission to run concurrently.
`reviewedParallelSafeTestPaths` is the explicit machine-readable allowlist;
if one of those files gains filesystem, process, network, git, environment,
clock, or persistent-state evidence, repository classification fails before
the test can enter a parallel lane.

The first reviewed cohort is intentionally small:

- the two pure MCP verification-policy unit tests from VA-9;
- `cc1-foundation.test.mjs`;
- `cc5-mandarin-surface-realization.test.mjs`;
- `cc6-listener-reception.test.mjs`;
- `communication-ir.test.mjs`.

Communication native-loop/acoustic tests remain serial because they use
filesystem/time-backed isolated fixture state. Recent Memory Core Phase90-96
tests also remain unpromoted where source-file reads are part of their wiring
evidence. VA-10 does not weaken the VA-9 hermetic boundary to manufacture
parallelism.

`runTestSteps()` keeps its original serial semantics. The additive
`runParallelTestSteps()` accepts only a single reviewed `.test.mjs` path per
step, caps concurrency at four, and waits for every already-started child in
a bounded batch before surfacing a failure. The Communication runner uses a
smaller concurrency of two and keeps all non-reviewed steps in a serial
shard. `tests/run-all.mjs`, external-network tests, shared ports, Journal,
transaction/checkpoint fixtures, and process-lifecycle/reliability tests are
unchanged by this phase.

Research reference: Bazel's Test Encyclopedia defines hermetic tests by
declared inputs and runner-guaranteed environment; Google's Hermetic
Servers guidance recommends injected service connections and local fakes.
Neither source justifies declaring existing process/network tests
hermetic solely because their assertions use fixture data.

## VA-11: fail-closed result cache (first development-only slice)

Result reuse is stricter than both hermetic and parallel-safe classification.
`reviewedCacheableTestPaths` is an explicit allowlist, and the cache runtime
recomputes a complete local ESM dependency closure before every lookup.
A reviewed file therefore cannot be reused merely because its own source
looks pure.

The first cacheable cohort contains only:

- the two pure MCP verification-policy unit tests from VA-9;
- `cc1-foundation.test.mjs`;
- `cc6-listener-reception.test.mjs`.

Two VA-10 parallel-safe tests were deliberately *not* promoted after
transitive review:

- `cc5-mandarin-surface-realization.test.mjs` reaches a clock-dependent
  world-simulation module;
- `communication-ir.test.mjs` reaches filesystem-dependent
  `agent-run-service.mjs`.

The cache key covers the exact test hash, transitive local dependency hash,
source dependency hash, fixture hash, argv hash, Node/V8/module-ABI/platform
runtime contract, and declared environment contract. Non-literal dynamic
imports, undeclared external packages, filesystem/process/network/environment/
clock/random/worker dependencies, oversized closures, or unavailable modules
fail closed to a normal test execution instead of producing a cache hit.

Only successful PASS evidence is persisted. The first implementation uses a
bounded per-worktree local store under `tests/.tmp/verification-result-cache-v1`
and refuses to add entries once the bounded entry limit is reached.

Cache reuse is **development-only** in VA-11. `tests/run-affected.mjs` enables
it only for a focused Communication affected plan using the private
`--development-result-cache` opt-in flag. Direct subsystem execution remains
uncached by default, which means formal exact-candidate integration validation
continues to execute its routed suites for real. Full regression,
certification, MCP reliability, tunnel/public-network checks, shared-port
tests, Journal, transaction, checkpoint, process lifecycle, and other
external-state validation are never cached by this slice.

The regression contract proves that changing a transitive source changes the
cache key, an old PASS no longer hits after that change, and an environment
dependency is rejected as ineligible. A direct Communication run reports
cache disabled; the first focused-cache run produces two misses and the
second identical run produces two hits while non-cacheable parallel tests and
all serial/native-loop tests continue to execute.
