# Character Brain C6 — Sleep, Arousal and Offscreen Continuity Contract

Status: CB-C6-A implementation contract candidate. Baseline: `45b25304c8930bbbca83144ba5059d36074351f9`. This document specifies future runtime gates. It installs no sleep transition, physiological process, fidelity scheduler or wake behavior.

## Scope and prerequisite evidence

The C-line blueprint BR-18 and BR-21 require sleep and offscreen continuity under World time, followed by foreground reentry preserving Body, goal, social and memory history. This contract prepares that work without reopening sealed Memory, C2–C5, BODY-0/1 or CC0–7.

CC8Y has an exact integration PASS_STABLE at this baseline. The supported CC8 path includes gaze/head orientation, body orientation, vocal effort, physical contention, bounded observer ingress and subjective social consequences. Existing `tests/communication/cc8-multimodal-social-lifecycle.test.mjs` compares visible/turned-away scenes and later observer-specific relationship/action consequences. This is an inspected oracle, not a newly executed result. Face, gesture, posture, pause and prosody still lack sufficient physical authority. Neither this contract nor the CC8Y seal declares those modalities or the whole CC8 phase complete.

Before C6 runtime writes, record the CC8 handoff against the blueprint's supported effector/signal/listener gate and retain every unresolved modality explicitly. Do not manufacture a physical effector, broaden a completed phase or silently mark an unsupported modality complete to advance the roadmap.

## Existing authority and remaining edges

All paths in this table are relative to the repository root.

| Baseline surface | Inspected behavior | C6 boundary or gap |
|---|---|---|
| `server/src/world-simulation-body-authority-service.mjs` | Objective state derives from committed World; its reader guards expected revision and state hash. Injury evidence is not subjective pain. | Read sleep/arousal only from the same objective authority. Missing sleep evidence remains unknown. |
| `server/src/world-simulation-body-recovery-authority-service.mjs` | Elapsed time alone cannot assert repair, regenerate HP or remove injuries; rest/sleep physiology is deferred. | Sleep or offscreen advancement must not invent recovery. Configured causal slow processes require separate authority. |
| `server/src/world-simulation-autonomous-cognition-scheduler-service.mjs` | Evidence-driven opportunities, stable identity, explicit due-time cues and consumed-opportunity suppression. | No sleep/arousal lifecycle or fidelity transition is implemented here. Reuse opportunity identity; do not turn heartbeat time into thought content. |
| `server/src/world-simulation-loop-service.mjs` | `scheduleWorldSimulationAutonomousCognitionOpportunities` reads committed state; `dispatchWorldSimulationAutonomousCognitionOpportunities` invokes bounded runtime turns without World mutation or durable cognitive writes. | A dispatched opportunity is not a committed sleep/wake transition or an offscreen World step. |
| `tests/cb-c2/cb-c2-autonomous-cognition-scheduler.test.mjs` | Existing oracles cover empty-queue dispatch, no-concern idle, due/not-yet-due cues, stable identity and consumed suppression. | Preserve these contracts while adding explicit state-based admission and deferred-evidence tests. |
| `server/src/world-simulation-actor-state-scheduler.mjs` | Piecewise movement reacts to injuries/incapacitation; trajectories have causal breakpoints. | This is not an all-process sleep or offscreen solver. A reduced step cannot leap over a relevant causal breakpoint. |
| `server/src/world-simulation-loop-service.mjs`, `server/src/world-simulation-state-service.mjs`, `server/src/world-simulation-chronological-mutation-queue-service.mjs` | Ordinary Native writes use chronological mutation queues and `commitWorldSimulationTurn` with expected revision/hash, transitions, outcomes and timeline. | Reuse this commit/history authority. Do not add an independent sleep, goal, relationship or memory truth store. |

Large files require bounded range reads or PowerShell source inspection: `dev_search_files` skipped the 691552-byte loop service in this audit. An absent search match does not prove an absent production call.

## Research and engineering interpretation

- W3C, SCXML §§3.5 and 3.13: event/condition guards select transitions before their executable effects. https://www.w3.org/TR/scxml/
- SimPy, Process Interaction: event waiting, reactivation and interruption distinguish a waiting process from stopping the simulation. https://simpy.readthedocs.io/en/stable/topical_guides/process_interaction.html
- SimPy, Time and Scheduling: sequential deterministic event processing uses simulation time and stable event order. https://simpy.readthedocs.io/en/stable/topical_guides/time_and_scheduling.html
- Borbély (2022), *The two-process model of sleep regulation: Beginnings and outlook*: sleep-dependent homeostatic and circadian influences are distinct conceptual processes. https://pmc.ncbi.nlm.nih.gov/articles/PMC9540767/

Sources were read on 2026-09-30. Engineering inference: preserve event/guard/effect separation, causal breakpoints and deterministic order in the existing JavaScript World owner. No SimPy dependency or SCXML interpreter is required. The sleep model motivates a provenance boundary, not universal sleep coefficients, durations, stages or thresholds for this world's population.

## Four independent dimensions

| Dimension | Authority | Required distinction |
|---|---|---|
| Sleep/wake condition | Objective Body state within committed World | A future explicit sleep record is not inferred from dialogue, an idle runtime, scene time or camera absence. |
| Consciousness and physical capability | Existing objective physical state plus future configured Body adjudication | Sleep is not implemented by toggling `physical_state.unconscious` or `incapacitated`. Those flags retain their existing meanings and cannot be cleared by a wake request. |
| Execution pause | Host/session control | Pausing execution neither proves sleep nor supplies elapsed simulation time. Resume cannot silently catch up from wall-clock duration. |
| Fidelity/foreground status | World scheduling policy | Reduced fidelity can apply to an awake actor; foreground promotion does not itself wake anyone, create a memory or resolve a goal. |

A missing canonical sleep/arousal record must be distinguishable from explicit awake evidence. Compatibility policy for existing characters must be declared and tested before production adoption; do not retrospectively label all legacy characters asleep or awake. Detailed physiology, dream generation and nonconscious consolidation are outside the first slice and retain their existing owners.

## Proposed state, transition and ingress rules

C6-B must define one versioned, engine-private objective record and reader backed by committed World. Its minimum information is a known/unknown condition, last committed transition identity/time and causal source lineage. Exact field names and any extra physiological quantities are selected only after tracing the existing World mutation allowlist. This contract does not grant a new field write.

C6-C must add bounded sleep/wake proposals and actual programmatic adjudication. A character's wish to sleep is an intention, not completed sleep. A wake request or an audible sound is not sufficient proof of awakening: a configured Body rule must accept reachable evidence and resolve the actual transition. With no required rule/configuration, report unavailable/unresolved rather than invent a threshold. Initial objective records are World initialization inputs with provenance, never Brain-authored truth.

Each accepted transition must bind the character, prior committed condition, source event/evidence, event time, adjudication and exact state revision/hash. Reject stale prior state, cross-character evidence, missing source authority, invalid/nonfinite time, backward time and duplicate/conflicting identity before mutation. Same-time effects follow a documented stable causal order. Injury/incapacitation effects keep their own authority; wake never erases them. Rejected requests produce no state, memory or capability change.

C6-D must explicitly decide which *conscious* C2 opportunities and action/sensory paths are admitted by the committed condition. Do not equate this with switching off all neural activity. Preserve pending concerns, goals, plans and due cues during gating. A suppressed opportunity must not be reported consumed merely because it was seen by the scheduler. On a later legitimate admitted state, unchanged evidence retains stable identity; already consumed evidence remains suppressed. No hidden objective condition, event IDs or physiology diagnosis enters a character-facing packet as knowledge. Admitted bodily/sensory evidence retains observer reachability and source/arrival/processing order.

## Reduced fidelity and reentry

C6-E must use World simulation time and a bounded, deterministic scheduling budget. Advance only to the next relevant event, slow-process breakpoint or requested horizon. Existing injury/movement and signal arrival events cannot be omitted merely because an actor is offscreen. A process without authoritative state/configuration remains unresolved; time passage cannot synthesize nutrition, healing, sleep pressure, relationships or autobiographical experiences.

A fidelity change alters execution resolution, not the ownership or meaning of committed facts. Preserve Body transitions/history, active/suspended goals and plans, social evidence, memories and consumed/pending opportunity identities. A reduced step must return the actual reached horizon and pending work if a budget prevents full advancement. It must not claim that the requested horizon was reached or silently drop events.

C6-F foreground reentry reads the exact committed chronology and current projections. It must not fill the omitted interval with fictional thoughts, observations, social encounters or personal memories. A new reachable signal may lead to ordinary interpretation and encoding; promotion alone may not. Equivalent full/reduced runs compare specified causal outcomes and authority at the same simulation horizon, rather than demanding identical internal turn counts or claiming unmodeled physiology agrees.

## Incremental gates and required oracles

| Gate | Smallest implementation | Required evidence |
|---|---|---|
| C6-A | This source-grounded implementation contract. | Exact source map, research boundaries, CC8 handoff/deferred modalities and future oracles; no runtime completion claim. |
| C6-B | Committed objective sleep/arousal record projection and provenance reader. | Known vs unknown, cross-character/stale state rejection, read-only input/state, no objective leakage into Brain. |
| C6-C | Legal event-backed transition in ordinary World adjudication and commit/history. | Intention can fail; accepted sleep/wake replays exactly; stale/duplicate/backward/conflicting transitions cannot mutate; incapacitation remains independent. |
| C6-D | Native admission and deferred-opportunity bridge. | Gated actor retains concern/goal/plan/due evidence; legal reentry admits it once; consumed replay stays suppressed; other actors remain independent. |
| C6-E | Bounded offscreen World progression. | Relevant event/breakpoint survives reduction; partial budget reports true horizon; no automatic recovery, fabricated cognition or skipped causal history. |
| C6-F | Paired foreground/reduced run and Native reentry. | Same required causal outcomes at same horizon; Body, goal, social and memory projections preserve lineage; promotion creates no autobiography. |

Before C6-B: seal this exact contract through formal integration, push, authoritative remote verification and cleanup; record the CC8 handoff; inspect actual transition allowlists and choose the minimum objective schema. Do not redo sealed phases or start the deferred multiplayer Brain Service. Runtime steps require meaningful positive/negative behavioral tests, affected checks and the repository's exact-commit integration gate. Later C7 parity and C8 longitudinal certification remain separate gates.
