# CB-C4-A — Social interpretation and relationship evidence contract

Status: implementation contract candidate, baseline `a385b0862a2386968298b3f19c2296d0670bbfd6`. This document specifies the next causal edge; it does not claim a relationship writer is installed.

## Verified existing surfaces

| Surface | Current evidence | Boundary |
|---|---|---|
| Listener signal and understanding | `character-communication-listener-reception-service.mjs` admits an action-linked, audible, prior committed speech signal; `character-communication-listener-understanding-service.mjs` records the listener's potentially mistaken content and interaction-function interpretation. | Mere audibility is not comprehension. No resolver decision means no interpretation. |
| Perceived speaker | `character-communication-speaker-recognition-service.mjs` binds subjective identity to the same listener. | Perceived identity may be wrong; the engine's source speaker is not character knowledge. |
| Conversational evidence | `character-communication-grounding-evidence-service.mjs` joins same-observer CC-6C and CC-6D receipts, with explicit `grounding_claimed: false`. | It proves neither speaker intent, agreement, belief update nor social appraisal. |
| Future cognition read | `world-simulation-neural-service.mjs` reads `state.relationships ?? state.relationship_cognition ?? {}` into `relationship_cognition`; Phase74A references `cognition.relationship_cognition`. | This is a read path. It does not prove a native durable social writer or which legacy state is authoritative. |

The C-line registry BR-16 classifies the Native durable social writer as absent. CC0–CC7, Memory, Belief, Affect and World chronology remain sealed integration boundaries.

## C4 ownership and ordering

1. **Observed signal:** World owns physical propagation and timestamp. CC-6C/6D own the listener's bounded subjective hearing, understanding and speaker attribution. A non-observer receives no private social evidence.
2. **Social interpretation:** Character Brain may interpret that bounded experience in light of its own belief, relationship history, expectation, context and current affect. An explicit no-interpretation outcome is legal. The source speaker's hidden intent and World truth stay unavailable.
3. **Person-targeted appraisal:** a separate subjective appraisal can attach concern, expectation violation or affiliative meaning to a *perceived* person. It cannot turn "said something pleasant" directly into trust or a numeric reward.
4. **Experience and memory:** admitted appraisal joins the same-character subjective experience and ordinary encoding lifecycle. No C4 shadow Memory store.
5. **Durable relationship evidence:** after a committed experience, a single relationship owner accepts provenance-bound evidence, including uncertainty and contradictory evidence. Projection is reversible/revisable; it is not a World fact about the target.
6. **Readback:** the next eligible turn reads the resulting same-character projection through the existing cognition path and may change communication or action. It must not replay the effect twice.

The first code slice should implement a bounded **listener-specific social interpretation resolver view and admission** from already available CC understanding/recognition, with no relationship mutation. The next slice connects it to subjective appraisal/experience. Only then implement the durable writer and readback. A read-only contract should avoid guessing a relationship score schema before its owner and prior history are inspected.

## Required input and evidence shape for the first slice

| Field | Requirement |
|---|---|
| observer / perceived target | Same-observer receipt, explicit listener-recognized identity; ambiguous or absent recognition produces no target-specific update. |
| source lineage | Opaque existing committed speech candidate and turn reference, checked against CC-6C/6D engine audit; character-facing view excludes engine action, sound and true speaker IDs. |
| interpretation | Listener-authored bounded content/function plus explicit appraisal proposal; no automatic inference from surface text. |
| context | Same character's prior relationship, expectation, belief and affect read views; absence stays unknown, never invented. |
| uncertainty | May mark ambiguous, sarcastic, friendly, unresolved or no appraisal. These are claims of the observer, not validated speaker intent. |
| authority | No direct World, Belief, Memory, goal or relationship mutation in this first slice. |

No arbitrary timer or scalar `trust += n`. A later durable writer must require committed experience identity and idempotency key; source lineage, revision rules and replay behavior are its own gate.

## Gate scenarios

- One audible utterance, three listeners: one interprets kindness, one interprets sarcasm, one hears nothing. Only the first two may form their *own* interpretation; the third remains unchanged.
- The same listener interprets a speech signal but cannot recognize its source: no person-targeted relationship evidence.
- An engine speaker identity, source action ID or hidden intent placed in a character-facing decision fails validation.
- The same committed experience processed twice does not duplicate a relationship consequence; rehydrated history reproduces the same projection.
- At T1, a listener-specific experience causes a durable relationship consequence; at T2, the same character's cognition sees it and can choose differently. A different listener's cognition cannot read it.
- Contradictory later evidence can revise interpretation without erasing the historical experience or claiming objective truth.

## Research basis and local adaptation

- [A Socially-Aware Memory for Companion Agents](https://citeseerx.ist.psu.edu/document?doi=791456b481d82516655b57208f97997db1cf832b&repid=rep1&type=pdf) motivates keeping socially relevant experience tied to a memory lifecycle. This is design inspiration, not evidence the local lifecycle is complete.
- [Computational Modelling of Trust and Social Relationships](https://www.jasss.org/15/1/3.html) models repeated interaction and relationship history; C4 uses this as a reason to test longitudinal readback, without importing its scalar update rule.

C4 proceeds only through the repository's existing isolated-workstream, exact-commit verification, integration, authoritative remote check and cleanup gates.
