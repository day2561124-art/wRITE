# CB-C6-E14 — bounded zero-time contact gate review

Status: gate review candidate, **not sealed**. Baseline: `main` `87305347fe2a4c39ce855f773e8673d4956066b5` (after PR #43). This record does not grant permission to start C6-E15/F before integration and journal gates.

## Verified code locations (static review)

- `server/src/world-simulation-offscreen-event-batch-service.mjs`: E14 v7 admits only discovery-confirmed `projectile_lifetime`, `projectile_bounds` or `projectile_character` at delta 0; each Native attempt consumes the explicit 0–32 turn budget.
- `server/src/world-simulation-offscreen-physical-step-service.mjs`: existing World-owned physical evaluation and authoritative CAS, not a new physical writer.
- `tests/cb-c6/cb-c6-sleep-arousal-transition-authority.test.mjs`: E14 fixtures cover exact/later/absent horizon, budgets 0/1/2/32, contact damage and history lineage, same-timestamp bounds/lifetime/contact sequencing, reordered maps, stale CAS and unsupported fields/obstacles/acoustic/multi-scene/queued cases.
- This branch extends the existing E14 suite to assert claimed horizon equality, no automatic replay, reconciled state and priority of a queued event at the same timestamp.

## Required gate evidence

1. Execute the E14-focused Native suite on the exact PR head, with no selected failures.
2. Complete required affected integration and Windows/Ubuntu smoke checks on that same head.
3. Confirm precise merge commit and authoritative remote ancestry.
4. Check Journal/transaction/checkpoint health and close the isolated workstream before marking E14 SEALED.

## Boundaries

A completed or blocked zero-time physical step is **not** a thought, perception, subjective memory, sleep pressure or automatically healed body state. It cannot turn a character-private interpretation into World truth. The batch cannot invent time offsets to force causality.

The following remain out of E14 scope: safe cross-scene/multi-process advancement where any authority is unresolved; obstacle/penetration and fractional progression not supported by current physics; E15 workstream reconciliation; C6-F foreground/reduced-fidelity paired reentry. No claim of full C6 or cross-day certification is made.
