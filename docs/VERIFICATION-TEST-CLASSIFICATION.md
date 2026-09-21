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
