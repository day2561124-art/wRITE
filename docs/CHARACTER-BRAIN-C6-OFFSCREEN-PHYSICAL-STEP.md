# CB-C6-E4 — Offscreen physical-step implementation note

Status: E4 first direct runtime slice sealed at `4417345242fa4eb4d52fd5745bd24b4f6b2d701a`; full C6-E/F remain open.
E4 formal MCP (604868ms) and mcp_tunnel (122875ms) passed without retry; main integrated, pushed and canonical remote exact; source workspace removed 2026-10-02.
The direct Native World-owned field step reuses the causal engine through a private derived context and commits through the existing atomic writer.

E5 candidate: attach that same step to empty-queue offscreen batches only when discovery confirms a positive whole-millisecond breakpoint within the horizon. Each Native physical admission attempt shares the existing bounded budget. Queued turns retain their original path. Record actual physical commits before post-commit reads, label execution kind, and expose the physical pending reason. Budget exhaustion reports the reached clock and remaining breakpoint; it never jumps to the requested horizon. Unsupported zero-time, projectile, multi-scene, geometry and pending acoustic cases remain uncommitted. E5 regression and exact-snapshot validation are pending; E5 is not sealed.
Supported: one scene containing all active fields, authoritative positive whole-millisecond breakpoint and valid field geometry.
Explicitly pending: active projectile progression, multiple active scenes, zero-time or fractional physical effects, and CC-6B signals awaiting their next perception opportunity. Physical-only progression cannot expire an unheard speech signal. No clock jump is allowed around these cases.
New regression covers deterministic immutable replay, field expiration and damage, Native exact commits, stale CAS and byte-preserving blocked/idle behavior. Results must be recorded after actual execution.
Exact base: `7a06097cca8bb091d8c6e050eac10df2463044d9`.
E3 discovery is sealed. Full C6-E progression and C6-F reentry remain open.

## Research interpretation

Reviewed 2026-10-02 (Asia/Taipei):
- SimPy stable Environments: https://simpy.readthedocs.io/en/stable/topical_guides/environments.html
- SimPy stable Time and Scheduling: https://simpy.readthedocs.io/en/stable/topical_guides/time_and_scheduling.html
- This repository's C6 sleep/offscreen contract and Phase62F/K/Q authority documents.

SimPy distinguishes reaching a simulation timestamp from processing events at that timestamp, and uses stable ordering for same-time events. Engineering inference: keep actual World time, pending work and completed causal effects separate. Adopt the separation of concerns, not SimPy's exclusive numeric horizon policy or a new dependency. Our existing E2/E3 boundary and the World chronology remain authoritative.

## Inspected source map

| Owner | Inspected behavior | E4 consequence |
|---|---|---|
| offscreen-breakpoint service | Immutable field/projectile discovery; unresolved processes withhold earliest confirmation | Derive a step from the current exact committed snapshot; caller cannot supply a breakpoint as truth |
| offscreen-event-batch service | Canonical queued turns, budget, target ceiling, exact post-commit lineage; idle discovery does not commit | Preserve queued-turn behavior; add physical progression only through a verified World-owned path |
| loop service: currentEvent/participantsForEvent | Empty queue is rejected; participants are required | An empty event queue cannot enter ordinary preparation unchanged |
| loop service: prepareWorldSimulationTurn/runWorldSimulationTurn | Named participants drive perception/cognitive preparation; run requires a Brain function | Do not introduce a dummy Brain or fictional action to obtain elapsed time |
| loop service: resolveWorldSimulationTurn | Canonical adjudicator resolves from cloned committed state; horizon guard precedes post-causal ingress/commit | Reuse the authority boundary; an elapsed-time claim is not itself a commit |
| causal-rule engine, clock/queue/executor tail | Advances clock by resolved elapsedMs; consumes queue head; builds chronological queue and executes against snapshot/preview | Generic adjudication is not yet proven to support empty-queue physical progression; inspect elapsed and queue semantics first |
| state service: commitWorldSimulationTurn | Owns payload before await; revision/hash CAS; duplicate turn rejection; atomic state/history; stores timeline and mutation queue/execution | Reuse this writer after complete executor evidence; persistence alone does not establish causal validity |
| immutable ability-field lifecycle / continuous physics | Field duration/ticks and projectile/contact outcomes have existing programmatic owners | Preserve damage, injury, physical contention and causal timestamps; discovery must not replace these owners |

Source ranges were inspected at this exact base. A failed or truncated text search is not evidence of absent behavior.

## Minimum runtime gate

The proposed first slice is a World-owned empty-queue physical step, not full reduced fidelity. Before implementation:
1. Trace how the causal engine derives elapsedMs with no selected action and how the continuous scheduler handles a requested bound.
2. Resolve how an engine-owned physical step enters chronological mutation authority without pretending a queue-head event was consumed.
3. Determine scene scope: discovery is global across committed processes. Advancing one scene cannot silently move the global clock past unresolved work in another.
4. Preserve exact zero-time expiration/contact. Do not add a 1ms physical step to make a nonzero timestamp; discovery's query-window epsilon is read-only and must never become elapsed time.
5. Reject unresolved authority, stale snapshot, caller adjudicator overrides and unsupported actor-motion evidence before mutation.
6. Derive deterministic step identity from session/revision/hash/boundary and record original commit before any post-commit read. No automatic mutation replay after a transport failure.

Add any newly required production path to declared scope before editing. Do not implement physiology, healing, sleep pressure, fabricated cognition, goal/social/memory changes or multiplayer Brain Service as elapsed-time effects.

## Required behavioral oracles

| Case | Required outcome |
|---|---|
| Positive field/projectile step | Existing evaluator effects, exact bounded World time and complete queue/timeline/history lineage |
| Budget 0 / unresolved process / stale CAS | No commit; state/history bytes unchanged; truthful pending work |
| Exact requested horizon | Time equality and remaining same-time work reported independently |
| Already-due process | Same-time effect, stable ordering, no fabricated delay |
| Same-time processes / reordered maps | Stable equivalent authoritative result |
| Multiple scenes / actor trajectories | No omitted contact, injury, movement or signal arrival; unsupported authority stays unresolved |
| Post-commit read or transport failure | Original committed turn retained; inspect exact history instead of repeating |
| Foreground versus physical-step fixture | Required causal outcome at same horizon agrees; no Brain call or new autobiography from promotion alone |

Do not claim these oracles have passed until runtime exists and the actual tests run. Continue from elapsed-time and empty-queue semantics; no need to redo E3 or the research above.
