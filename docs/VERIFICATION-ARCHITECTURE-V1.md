# Verification Architecture v1 — Final Certification Seal

## Status

This document is the VA-15 seal record for Verification Architecture v1.

The architecture is considered sealed only when the **exact commit containing this
document** has all of the following evidence:

1. full repository regression (`all`) PASS;
2. MCP reliability certification (`mcp_reliability`) PASS;
3. exact-candidate integration validation PASS;
4. controlled integration into `main`;
5. authoritative canonical remote exact-head match;
6. Development Journal / workspace registry / storage health with no
   reconciliation requirement or unregistered Writer Workbench worktree.

A document commit by itself is not certification evidence.

## Architecture closed by v1

Verification Architecture v1 now provides a bounded path from change to evidence:

- exact change detection and conservative affected-test selection;
- test classification and explicit execution-safety metadata;
- dependency / risk routing with fail-closed fallback for unknown change;
- suite-level exact-snapshot verification manifests;
- typed failure classification without rewriting the original gate result;
- at most one controlled same-snapshot diagnostic retry where permitted;
- reviewed parallel execution for explicitly safe tests;
- development-only, fail-closed result reuse for explicitly reviewed cacheable tests;
- PR / main / scheduled / manual CI layering;
- scheduled focused-vs-full selector-miss evidence;
- read-only telemetry aggregation for duration, routing fallback, failure classes,
  selector-miss candidates and explicit development result-cache counters;
- bounded CI artifact retention for scheduled selector evidence.

## Safety invariants

Verification Architecture v1 does **not** weaken the existing repository safety
systems.

- Unknown or unreviewed changes escalate rather than silently downscope.
- Formal integration does not enable the development result cache.
- A diagnostic retry never converts an original failed gate into PASS.
- Selector-miss candidates remain candidates until causal review.
- Missing telemetry is represented as unavailable/null, not fabricated zero.
- Full regression, certification and reliability tests remain available.
- Development Journal, checkpoint, transaction, workspace registry and
  authoritative-remote checks remain independent safety authorities.
- No local `origin/main` tracking ref is accepted as authoritative remote truth.
- Unrelated user working-tree changes are outside the certification workstream and
  must not be reset, staged or rewritten.

## VA-15 certification protocol

The final certification is intentionally broader than normal feature development:

```text
exact VA-15 seal commit
  -> full regression (all)
  -> MCP reliability (mcp_reliability)
  -> exact-candidate integration validation
  -> controlled integration
  -> push canonical origin/main
  -> authoritative remote exact-head verification
  -> Journal / registry / storage / workspace cleanup verification
```

All three verification layers must refer to the same VA-15 commit or to a
server-owned immutable snapshot whose HEAD is that commit.

## Post-seal change policy

After this seal, VA-0 through VA-15 are not to be reopened merely to add more
verification features. A new verification phase should require one of:

- authoritative regression evidence;
- a demonstrated false-negative / unsafe downscope;
- a demonstrated material performance problem not addressable by configuration;
- a newly required release, platform or reliability contract.

Routine project feature work should use Verification Architecture v1 rather than
continuing to redesign it.
