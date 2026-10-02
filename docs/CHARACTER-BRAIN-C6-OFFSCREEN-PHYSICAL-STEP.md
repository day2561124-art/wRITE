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

E8 bounded direct slice sealed: source/integration `c718b26d8812c0f457c9c0472356b59333100cbc`. The direct Native physical-step may commit an already-expired projectile lifetime at the current exact World timestamp. Admission requires earliest confirmed projectile lifetime at delta 0, one scene, no active fields, obstacles, queued event or pending acoustic ingress. Multiple expired projectiles use existing immutable arbitration; live projectiles do not advance or terminate.

A World-owned WeakMap context carries this bounded mode to the existing continuous-physics proposal producer. The scheduler queries the exact zero-duration window and admits only lifetime events at 0, then uses the existing immutable termination evaluator, timeline, chronological mutation queue/executor and atomic writer. Do not borrow discovery epsilon as elapsed time. Caller flags on general causal input do not create this context; Native accepts no drain flag.

Fresh SimPy Environments/Scheduling review on 2026-10-02 distinguishes reaching time from processing same-time work. Engineering inference: termination can change committed revision/hash/history without changing World time, position, age or penetration energy. Existing repository ordering and lifecycle semantics remain authoritative.

At E8 seal, the offscreen batch's zero-time and exact-horizon stopping policy remained unchanged. Batch hookup, bounds/contact zero-time effects, mixed field/projectile zero-time work and obstacle penetration remain subsequent slices after E8 is sealed. Tests cover direct already-due and flight-then-due Native lineage, exact unchanged clock/kinematics/subjective state, deterministic replay/map order, live-process preservation, stale CAS, post-termination idle bytes, forged flags and unsupported authority. E8 World 331891ms, exact-candidate MCP 584910ms and mcp_tunnel 113304ms PASS_STABLE with no diagnostic retry; canonical remote exact, source/integration worktrees removed and Journal healthy.

## E9 candidate — bounded batch lifetime drain

E9 bounded batch slice sealed: source/integration `61ecacb799747f9ac0b73015d5b337ee4ad174c7`. The batch can attempt a confirmed projectile lifetime at delta 0 through E8's existing Native physical-step. Each actual Native attempt consumes one explicit turn budget; every commit advances revision/history once, even when World time remains exact. A positive flight to its lifetime endpoint and its subsequent zero-time termination are two budgeted commits.

An exact target horizon is a time ceiling, not evidence that all due physical work has completed. At equality, an empty-queue batch may process only the confirmed zero-time projectile lifetime while budget remains. Queued events retain the prior horizon stopping policy; other same-time effects remain pending. With budget 0 there is no Native attempt or durable mutation. A lifetime outside the ceiling remains absent from horizon-bounded discovery, with no attempt or time jump.

Reuse the existing read-only discovery, exact Native CAS, immutable lifecycle and canonical atomic writer. No epsilon, new physics authority, queue bypass, fabricated physiology or Brain call. Native guards still reject active fields, obstacles, pending acoustic ingress or unsupported authority. Initial flight and final lifetime effects retain exact committed hash lineage.

Required E9 oracles: budgets 0/1/2/32; already-due and flight-then-due processes; exact, absent, later and too-early horizons; revision/history/hash identity, unchanged subjective state and kinematics during termination; post-termination byte-identical idle; queued and unsupported same-time preservation. Earlier E6 one-step endpoint oracle now uses budget 1, its zero-budget retry remains pending; E8 direct Native fixture uses budget 0 so E9's separate positive-budget tests own the changed batch behavior. E9 World 350628ms, exact-candidate MCP 673632ms and mcp_tunnel 142512ms PASS_STABLE, no diagnostic retry; canonical remote exact, source and integration worktrees removed healthy, Journal healthy.

## E10 candidate — direct zero-time scene-boundary termination

E10 bounded direct slice sealed: source `205ea26f2794d95298bb0b2fc199752be7cc4ad3`, integration `7b12ea6eb95c96094c7377bc6764cb59a080e651`. Admit a confirmed projectile bounds event at delta 0 in the direct Native entry, alongside E8 lifetime termination, only without active fields, obstacles, queued events or pending acoustic ingress and within one scene. The offscreen batch remains E9 lifetime-only.

The existing immutable bounds query must recognize exact outward-facing scene edges in a zero-duration window: position equals a finite scene edge and velocity points outside it. Inward or stationary edge positions retain advance_end, and the positive-window query is unchanged. No read-only discovery epsilon is converted into physical elapsed time.

A private World context admits only zero-time lifetime/bounds candidates through the existing deterministic subject ordering, immutable event arbitration and lifecycle termination. Existing left_scene_bounds resolution and proposal/timeline/queue/executor/atomic writer remain authoritative; contact, penetration, active-field and unsupported authority remain pending.

Required E10 oracles: all four outward edges versus inward/stationary queries, immutable replay, same-time bounds plus lifetime with reordered maps and a preserved future projectile, flight-to-edge then exact termination, direct Native revision/history/hash chain and unchanged clock/age/position/energy, forged flag rejection, stale CAS and byte-identical idle. E6 direct bounds endpoint expectation now requires its supported zero-time termination. E9 positive-budget bounds remains pending. Native bounds fixtures additionally require byte-identical state/history preservation for active fields, obstacles, queued events, pending acoustic ingress, multiple scenes and unresolved velocity authority. E10 World regression passed in 369293ms on exact five-file snapshot f07abbe89edfeb46edc62ebf288acb4906f189e3870cbe627188876329586b55; original operation dev_operation_ee638ca3e8584ebc90cbcc72adc1cb42 was recovered after HTTP504 without replay. Exact-candidate MCP 648679ms and mcp_tunnel 128646ms PASS_STABLE, without retry. Integrated and pushed; canonical remote exact and source ancestry verified. Source and integration worktrees removed. Journal, transaction and checkpoint healthy after transient lock contention.

## E11 candidate — bounded batch scene-boundary drain

E11 bounded batch slice sealed: source `0230a04106163e209cb5755f35b33510b6de1d2a`, integration `41bcf8da395f38a9b93f7e1230cae5194d9f8703`. Extend only the E9 empty-queue batch gate to the E10 sealed Native zero-time lifetime/bounds termination. At exact target equality, only a confirmed supported current termination may consume remaining budget; queued events keep the existing horizon rule. Each Native attempt costs one turn, and positive flight plus zero-time termination costs two commits. No epsilon, new World owner, Brain call, fabricated subjective state or clock jump.

Official SimPy Environments and Time/Scheduling reviewed again on 2026-10-02: clock equality and processing same-time work differ. Engineering inference only; repository arbitration remains authoritative, no dependency or FIFO policy imported.

Regression extends the existing budget 0/1/2/32, due/flight, exact/later/absent/too-early horizon matrix to bounds and checks actual revision/history/hash lineage, unchanged zero-time kinematics, exactly one termination, resumption and byte-identical idle. E10 direct Native zero-budget discovery remains read-only. Unsupported fields/obstacles/queued/acoustic/multi-scene/unresolved fixtures also require zero committed batch work and byte-identical state/history.

First E11 World run failed at the new bounded-flight resumption oracle (57266ms); diagnostic run (76654ms) identified existing horizon-window arithmetic returning delta 499.99999999999983ms for the 500ms bounds fixture. Integer-only admission correctly keeps this pending; E11 does not round it or alter the sealed query. Revised oracles cover due-now exact/later/absent horizons, untargeted flight budgets 0/1/2/32, the 499ms ceiling, and byte-identical fractional bounded discovery followed by two exact untargeted commits. Positive bounded discovery precision remains a separate gap after E11 seal. Corrected World passed in 355047ms on exact snapshot 6ba7df799fb4145020c24bdb683203501f31e35b6de9c7866c434bf5008c6302; original operation dev_operation_52fe2ed14f384c7fafd29f2f6750b8b5 was recovered after HTTP504 without replay. Final diff-check passed on that same snapshot. Exact-candidate MCP 789801ms and mcp_tunnel 150993ms PASS_STABLE, no diagnostic retries; formal diff-check passed and the integration worktree was clean. Integrated, pushed, canonical remote exact and source ancestry verified. Source and integration worktrees removed. Journal/transaction/checkpoint healthy; unrelated main changes preserved. E10 tests are not claimed as E11 evidence.

## E12 candidate — window-independent bounds discovery

E12 bounded precision slice sealed: source `c740f9f42840f04d76d6a218da0bd014ceb48154`, integration `4714ca24ee5174615ca2011b70c6931ac1a55648`. The E11 failure is authoritative evidence of a bounded-discovery precision gap: scaling a segment fraction by its query window turned an exact 500ms bounds crossing into 499.99999999999983ms. Replace only that scene-bounds time arithmetic with direct signed distance / velocity, converted from seconds to milliseconds. Preserve the positive-window inclusive endpoint guard and E10 exact outward zero-window gate. Existing obstacle/character/lifetime arbitration, Native integer-only admission, evaluator and atomic writer remain authoritative.

Research reviewed 2026-10-02: PBRT 4e section 6.1.2 Ray-Bounds Intersections, https://www.pbr-book.org/4ed/Shapes/Basic_Shape_Interface . PBRT derives slab plane intersections directly from origin and direction. Engineering inference: direct position/velocity time avoids query-window scaling; do not import PBRT gamma expansion, a tolerance, rounding or a new physics owner.

Required regression: four edges and diagonal ties, 499/500/500.000001/750/5000ms windows at a nonzero query start, deterministic immutable replay, bounded 500ms flight budgets 0/1/2/32 and later horizon, exact two-commit flight/termination history, preserved actual 1/3-second fractional discovery and byte-identical pending state/history under bounded and unbounded calls. Existing unsupported-authority guards remain covered. E12 World passed in 396927ms on exact three-file snapshot `2b0b706fa1c11a359261af1df38f6272ff57583bbeb8081921ee612558170fd7`; original operation `dev_operation_d51e5af690314805a2648aa9c4b5e8b9` was recovered after HTTP504 without replay. Diff-check passed on the same snapshot. Only this evidence note changed afterward; production and regression bytes remain tested. Exact-candidate MCP 698440ms and mcp_tunnel 140180ms PASS_STABLE, with no retry. Formal diff-check passed and candidate worktree was clean. Integrated, pushed, canonical remote exact and source ancestry verified. Source and integration worktrees removed. Journal/transaction/checkpoint healthy; main unrelated changes retained.

## E13 candidate — direct current-time projectile character contact

E13 bounded direct slice sealed: source `4b618b91848cb0d1067033fb4b9e7d7b42e83c0f`, integration `a26d719fde5e726413b51d53a422c41311bb2c82`. Before E13, read-only discovery's short positive query already found projectile_character at delta 0 for touching/overlapping character geometry, but the Native physical-step excludes that current effect and the exact zero-duration immutable query skips the contact. Add a bounded direct slice in one scene, without active fields, obstacles, queued events or pending acoustic ingress. The batch's E11 admission remains lifetime/bounds-only.

Research reviewed 2026-10-02: SimPy Time and Scheduling, https://simpy.readthedocs.io/en/stable/topical_guides/time_and_scheduling.html . Same-time work requires deterministic processing; engineering inference only. Repository immutable event arbitration, stable projectile ordering and existing combat-impact/termination/effect projection remain authoritative. No SimPy dependency or FIFO policy is imported.

The immutable zero-window query observes exact current profile geometry using the existing combined collision radius. A World-owned private context admits current character contacts to the existing scheduler alongside due lifetime/bounds effects; the existing contact evaluator owns damage, injury, termination and chronological proposals. No flight, penetration, time epsilon, Brain invocation or new writer. Forged general input flags and Native drain arguments cannot acquire the context.

Required regression: touching/overlap/non-contact zero-window geometry at nonzero query time, immutable replay, multiple same-time projectile map order and live-projectile preservation, one actual damage effect per contact, exact unchanged clock/position/age, existing contact-driven energy consumption, history/revision/hash chain, stale CAS and byte-identical idle, unchanged batch gate, and fields/obstacles/queue/acoustic/multi-scene/unresolved durable-byte guards. E13 World passed in 405230ms on exact five-file snapshot `a79a5f915af91be91855d5ce04ef26b5f71f912d71a002217d2ae5bb6a92e2e8`; original operation `dev_operation_ad2e6b6a85e24d20b43dc87f3f499500` was recovered after HTTP504 without replay. Diff-check passed on the same snapshot. Before that run, self-review corrected energy consumption to the existing contact termination semantics and moved two zero-time assertions from the absent action-outcome time field to the canonical projectile-resolution timeline. Only this evidence note changed afterward; production and regression bytes remain tested. Exact-candidate MCP 656505ms and mcp_tunnel 130204ms PASS_STABLE, with no diagnostic retry. Formal diff-check passed and the candidate worktree was clean. Integrated, pushed, canonical remote exact and source ancestry verified. Source and integration worktrees removed. Journal/transaction/checkpoint healthy; main unrelated changes preserved.

Further research found active fields with nonpositive remaining_ms are unresolved in existing discovery, and normal positive expiration already closes the field. Do not broaden field authority solely to handle malformed initial data.

## E14 candidate — bounded batch current-time projectile character contact

E14 is under development, not sealed. Extend the shared batch eligibility predicate to confirmed zero-delta projectile_character alongside lifetime/bounds, both at exact horizon equality and ordinary empty-queue admission. Batch version advances to cb-c6e14-offscreen-event-batch-v7. Every actual Native attempt consumes one existing explicit turn budget, including a blocked Native attempt; queued events retain their horizon policy. Reuse sealed E13's immutable contact, damage/injury, termination, chronological proposals and atomic writer. No new World authority, elapsed-time epsilon, Brain invocation or physical evaluator.

Research reread 2026-10-02: official SimPy Environments and Time/Scheduling, https://simpy.readthedocs.io/en/stable/topical_guides/environments.html and https://simpy.readthedocs.io/en/stable/topical_guides/time_and_scheduling.html . Engineering inference: clock equality and effect completion differ; deterministic processing and bounded step control remain separate concerns. Keep repository ordering and inclusive horizon policy; do not import SimPy FIFO, exclusive numeric horizon semantics or a dependency.

Required regression: budgets 0/1/2/32, touching/overlap, exact/later/absent and too-early horizons, actual damage once and canonical contact timeline at 0, unchanged clock/position/age, existing energy consumption, revision/history/hash identity and committed turn identities, stale CAS and byte-identical idle, multiple contacts with reordered maps and live preservation, mixed due bounds/lifetime/contact budgets and resumption, and unsupported fields/obstacles/queue/acoustic/multi-scene/unresolved durable-byte guards. Existing discovery sorts bounds before character at the same timestamp: a first lifetime/bounds termination commit leaves contact for a second budgeted commit. The earlier E13 Native fixture now reserves its preliminary batch check for budget-zero read-only discovery; E14 owns positive-budget batch behavior. World verification passed once in 350,064 ms (original operation `dev_operation_1d586a4e69af4acda5f8fec31981a319`, snapshot `1bcaeb4c8cb9ecc766e5767ec812cd8755ae143c369ab7ba73eb4d09115c907a`, verification manifest `14c0018de4df011832b09d894af27bdfa7157f1ba3c1baa960170a8f1e32714f`; zero snapshot retries). This evidence note was updated after that runtime verification; production and regression code were unchanged. Formal integration verification, integration, push, and seal remain pending.
