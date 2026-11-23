# Character Brain C6-F — Foreground Reentry Candidate Evidence and Open Gates

Status: **bounded GitHub acceptance evidence only; C6-F NOT SEALED.**
Evidence date: 2026-11-23.
Candidate remote baseline: `main` merge `d56a1be6567cbf8dd0b7b058c8946a1e9ade6399` (PR #51).

This record is intentionally independent of any consumer game, NPC save or application narrative.
The generic Character Brain owns causal mechanisms and abstract test fixtures; the consuming
application owns its character data, memories, scenario state and game-specific logs.

## Accepted bounded evidence on GitHub

All five exact-head PR runs below completed **SUCCESS** for affected-project validation
and Windows/Ubuntu smoke; the PRs were merged separately. PR CI is not a substitute
for the additional formal/local journal or post-merge main full-regression gate.

| Slice | PR and CI | Actual behavior covered | Important limitation |
| --- | --- | --- | --- |
| Queued foreground/offscreen reentry | [#47](https://github.com/day2561124-art/wRITE/pull/47), [#1388](https://github.com/day2561124-art/wRITE/actions/runs/45117663383) | Two independently persisted sessions, same three canonical events, real wake transition, equal Body/goal/memory projections, stable admitted concern/plan and byte-identical read-only reentry | The bounded offscreen queued path calls the ordinary full-fidelity World turn; it does not prove reduced-fidelity autonomous thinking |
| First mixed physical breakpoint | [#48](https://github.com/day2561124-art/wRITE/pull/48), [#1390](https://github.com/day2561124-art/wRITE/actions/runs/45121059944) | Foreground real wait vs World-owned offscreen physical step, field-first/projectile-first/tie, equal damage, field/projectile state and persisted history lineage | Only same first authoritative boundary in one scene |
| Speech and audible social evidence | [#49](https://github.com/day2561124-art/wRITE/pull/49), [#1395](https://github.com/day2561124-art/wRITE/actions/runs/45126296173) | A speaks; B hears one bounded acoustic signal and remembers the sound with direct perceptual provenance; speaker remembers actual speaking; the signal expires; no semantic understanding is invented and later reentry performs no extra write | Speech turns are full-fidelity canonical queued turns, not physical-only reduction; comprehension/relationships depend on their existing decision owners |
| Two consecutive physical breakpoints | [#50](https://github.com/day2561124-art/wRITE/pull/50), [#1399](https://github.com/day2561124-art/wRITE/actions/runs/45131384395) | Paired real sessions at 50ms field expiry, 100ms projectile contact; after each commit compare Body, damage, field/projectile state, revisions and history chain; no duplicate replay | Two steps, one supported scene; does not imply arbitrary long-running mixed-world simulation |
| Simultaneous cross-scene, acoustic and unknown-process holds | [#51](https://github.com/day2561124-art/wRITE/pull/51), [#1401](https://github.com/day2561124-art/wRITE/actions/runs/45137196774) | Independent scenes and pending acoustic source cannot be silently advanced; unresolved projectile velocity blocks first-step admission; budgets 0/1/32, exact 50ms horizon, durable-byte preservation and read-only reentry | **Fail-closed proof, not a cross-scene simulator** |

Important test correction: the first acoustic PR #49 run #1393 **failed** because its
test wrongly demanded zero new memories. Real, provenance-bound action and hearing
memories are appropriate. The revised exact head in CI #1395 passed with positive
assertions about those memories. Do not suppress genuine perception/experience in
the name of preventing fabricated offscreen autobiography.

## Proven mechanism boundary

- Offscreen queued-event batches invoke the canonical `runWorldSimulationTurn`
  for the queue head. They are not a separate source of truth or a promise to run
  characters' cognitive decisions at reduced fidelity.
- Empty-queue physical progression uses the existing World-owned breakpoint,
  causal adjudicator, chronological mutation and atomic state/history writer.
  The budget is explicit; a reached horizon does not imply all same-timestamp
  work has been consumed.
- Foreground promotion/readback **reads committed facts and eligible projections**.
  It cannot invent thoughts, conversations, bodily healing, autobiographical
  experiences or relationship truth for an unmodeled interval.
- A real observed speech sound can form a direct-perception memory. Source
  identity, audience reachability and processing order remain distinct from
  understanding speaker semantic content or believing it as objective truth.
- An unresolved physical process, unsupported multi-scene advancement or pending
  listener ingress must hold the line without manufacturing elapsed World time.

## Open causal engineering gaps (not accepted)

1. No general authorized *positive* multi-scene slow-process step has been
   demonstrated. Existing C6-F cross-scene cases prove the stop condition only.
2. No complete bounded coupling of advancing physical processes, communication
   acoustics, multiple independently timed events and foreground promotion
   across different scenes has been accepted.
3. Cross-day/long-horizon state continuity and different observer experiences
   affecting later relationships, goals, beliefs and actions remain subject to
   separate C8 longitudinal certification.
4. A real fidelity policy/transition and any offscreen independent cognition
   must remain governed by their original World and Brain authorities; queued
   full-fidelity replay is not evidence that such reduced cognition exists.
5. Formal C6-E14 seal still lacks accessible Nexa Journal, transaction and
   checkpoint evidence and workstream closure; E15 historical metadata noted in
   `docs/PI-MCP-INTEGRATION-V1.md` is **not** proof of its current active state.
6. Post-merge `main` full regression has not been independently observed through
   the currently available GitHub workflow connector (which reports only PR
   workflow runs in `fetch_commit_workflow_runs`).

## Local workstation synchronization gate

The user's Windows workstation and Nexa service were offline during these GitHub
changes; the local Character Brain working copy had **not** been synchronized.
A GitHub merge does not install the code or validate the production workstation.

When the host is next available:

1. Read local repository HEAD/branch, working-tree status and unpushed commits;
   preserve and back up uncommitted user work before any synchronization. Never
   force-overwrite a divergent local copy.
2. Confirm the intended canonical remote, fetch the GitHub `main`, reconcile
   any local changes and record the exact synchronized source commit.
3. Inspect actual Nexa Journal/transaction/checkpoint/workstream state; recover
   unknown operations from authoritative receipts without unauthorized replay.
4. Run the relevant full and cross-platform/local acceptance gates on the
   reconciled exact candidate. Then consider separate E14/E15/C6-F phase sealing.
5. Verify actual deployed/runtime version separately from source synchronization.

This document **does not seal C6-F or authorize C7 as accepted**. It records
what GitHub tests established and which causal/authority proofs remain missing.
