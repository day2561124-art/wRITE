# CB-C6-E4 — Offscreen physical-step implementation note

Status: E4 first direct runtime slice sealed at `4417345242fa4eb4d52fd5745bd24b4f6b2d701a`; full C6-E/F remain open.
E4 formal MCP (604868ms) and mcp_tunnel (122875ms) passed without retry; main integrated, pushed and canonical remote exact; source workspace removed 2026-10-02.
The direct Native World-owned field step reuses the causal engine through a private derived context and commits through the existing atomic writer.

E5 sealed: source `d0ff3f13309dce8f3b0c675c909525954703877e`, integration `cb450b55389f7fb39d167e9b291c2ae6a4b379b2`; formal MCP 649236ms and mcp_tunnel 130071ms PASS_STABLE, remote ancestry verified and source removed. E5 attaches that same step to empty-queue offscreen batches only when discovery confirms a positive whole-millisecond breakpoint within the horizon. Each Native physical admission attempt shares the existing bounded budget. Queued turns retain their original path. Record actual physical commits before post-commit reads, label execution kind, and expose the physical pending reason. Budget exhaustion reports the reached clock and remaining breakpoint; it never jumps to the requested horizon. Unsupported zero-time, projectile, multi-scene, geometry and pending acoustic cases remain uncommitted. E5 regression and exact-candidate formal validation passed.
E6 sealed bounded slice: projectile-only single-scene positive whole-ms flight/contact reuses the existing physics scheduler, immutable flight/impact/termination evaluators and atomic writer. Mixed fields/projectiles and scenes with obstacles remain pending. Discovery adopts the existing per-character collision-radius precedence. Exact lifetime/bounds endpoints may leave zero-time termination pending; no epsilon is added to World elapsed time. E6 source `93ad8d015435a30d90a8b14a8938f880c4914b20`, integration `073f6819288bab4b731482b42a7bb539a25938fc`; World regression 366885ms, exact-candidate MCP 637089ms and mcp_tunnel 129546ms PASS_STABLE. Canonical remote exact and source ancestry verified; source and integration worktrees removed. Journal/transaction/checkpoint healthy.
Sealed E4/E5 scope: one scene containing all active fields, authoritative positive whole-millisecond breakpoint and valid field geometry.
Sealed E6 extends admission to projectile-only flight/contact in one scene without obstacles. Mixed fields/projectiles, multiple active scenes, zero-time or fractional physical effects, and CC-6B signals awaiting their next perception opportunity remain pending. Physical-only progression cannot expire an unheard speech signal. No clock jump is allowed around these cases.
The existing E3 exact-lifetime Native oracle now distinguishes budget-zero read-only discovery from one positive E6 flight commit: the latter reaches the exact clock, increments revision once and preserves real history lineage while retaining the zero-time termination as pending. Due-now and unresolved-process cases keep their original byte-preservation gate.
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

## E7 candidate — shared field/projectile bound

E7 bounded slice sealed: source `1580ae041e14220bcd67bdacf189e856deb4ad22`, integration `722ef2254279f7e2fd2233f4e6922686ce4fcf48`. Admit positive whole-millisecond mixed fields/projectiles only when every active process is in one scene, all field geometry is valid, and that scene has no obstacles. Discovery's earliest confirmed breakpoint bounds both families. Reuse the existing combined continuous-physics owner, cross-layer timeline, chronological proposal queue/executor and atomic writer; do not introduce another ordering truth.

Fresh official SimPy scheduling review on 2026-10-02 confirms deterministic processing of same-time events. Engineering inference: a shared timestamp requires stable complete effect processing, not elapsed-time epsilon. Repository ordering remains authoritative; no SimPy dependency or FIFO policy is imported.

Required E7 oracles: field-first and projectile-first progression, same-time field expiration and projectile contact, each actual damage effect exactly once, deterministic replay and reordered maps, Native budget/horizon and stale CAS durable-byte preservation, exact revision/history/hash chain, unchanged queue/memory/goals and no Brain call. The earlier E3 mixed fixture now distinguishes budget-zero discovery from one legitimate shared 100ms step; E4/E5 obstacle cases retain their unsupported-authority byte gates.

Zero-time draining, fractional boundaries, multiple scenes, obstacles/penetration and pending acoustic ingress remain unsupported. E7 World 363560ms and exact-candidate MCP 642938ms/mcp_tunnel 127900ms PASS_STABLE; diff clean, canonical remote exact and source ancestry verified, source and integration worktrees removed, Journal/transaction/checkpoint healthy. Full C6-E/F remain open.

## E8 candidate — direct same-time projectile lifetime termination

E8 is under development, not sealed. The direct Native physical-step may commit an already-expired projectile lifetime at the current exact World timestamp. Admission requires earliest confirmed projectile lifetime at delta 0, one scene, no active fields, obstacles, queued event or pending acoustic ingress. Multiple expired projectiles use existing immutable arbitration; live projectiles do not advance or terminate.

A World-owned WeakMap context carries this bounded mode to the existing continuous-physics proposal producer. The scheduler queries the exact zero-duration window and admits only lifetime events at 0, then uses the existing immutable termination evaluator, timeline, chronological mutation queue/executor and atomic writer. Do not borrow discovery epsilon as elapsed time. Caller flags on general causal input do not create this context; Native accepts no drain flag.

Fresh SimPy Environments/Scheduling review on 2026-10-02 distinguishes reaching time from processing same-time work. Engineering inference: termination can change committed revision/hash/history without changing World time, position, age or penetration energy. Existing repository ordering and lifecycle semantics remain authoritative.

E8 keeps the offscreen batch's zero-time and exact-horizon stopping policy unchanged. Batch hookup, bounds/contact zero-time effects, mixed field/projectile zero-time work and obstacle penetration remain subsequent slices after E8 is sealed. Tests cover direct already-due and flight-then-due Native lineage, exact unchanged clock/kinematics/subjective state, deterministic replay/map order, live-process preservation, stale CAS, post-termination idle bytes, forged flags and unsupported authority. E8 focused/formal results remain pending until actual execution.
