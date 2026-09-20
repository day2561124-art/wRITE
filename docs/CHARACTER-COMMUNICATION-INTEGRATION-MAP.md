# Character Communication / Expression Core — Integration Map

Status: CC-0 repository and integration audit
Authoritative audit baseline: `9b00921ec51e9a7d0602fe0a39ed54ab46ddef08`

## Purpose

This map records the communication-relevant capabilities that already exist in the authoritative repository before further Communication Core architecture is added. It is evidence for reuse/gap decisions; it does not rename pre-existing work into roadmap phases and does not treat similarly named legacy fields as completed CC contracts.

## Hard boundaries

- Character Brain / Cognition remains the authority for character-side goals, subjective state and decisions.
- Character Memory Core remains the sole long-term personal-memory authority. Communication must not create a second memory database.
- World Simulation remains authoritative for physical signals, geometry, visibility, audibility and committed causal outcomes.
- Observable signal, speaker intended meaning and listener inferred meaning must remain distinct.
- No omniscience and no mind-reading.
- Backend/local generation providers are optional realization adapters, never Communication Core truth/decision authorities.
- Existing sealed Memory/Cognition phases are not reopened without authoritative regression evidence.

## Existing native path

Current authoritative native vertical slice:

`character cognition.communication_goal`
→ `planCharacterCommunication`
→ bounded public communication action candidate
→ Character Brain candidate selection
→ causal rule engine
→ committed `communication_event`
→ world history / downstream perception infrastructure

Primary evidence:

- `server/src/character-communication-foundation-service.mjs`
- `server/src/world-simulation-character-brain-input-service.mjs`
- `server/src/world-simulation-subjective-action-deliberation-service.mjs`
- `server/src/world-simulation-neural-service.mjs`
- `server/src/world-simulation-causal-rule-engine.mjs`
- `tests/communication/cc1-foundation.test.mjs`
- `tests/communication/cc1-native-loop.test.mjs`

The vertical slice already supports same-character goal/purpose/addressee, direct/indirect/silence/nonverbal modes, withholding private content, known-vs-uncertain grounding, a bounded public action candidate, and committed world communication events. It explicitly leaves surface realization incomplete and does not implement listener comprehension.

## Communication Integration Map

| Area | Existing repository capability | Decision | Roadmap implication |
| --- | --- | --- | --- |
| Character Brain / cognition | Native character-facing cognition, subjective deliberation, goal/action machinery; `communication_goal` can reach the Character Brain packet. | **Direct reuse** | CC-3 must extend native cognition rather than create a second brain. |
| Character Memory Core | Sealed retrieval/accessibility/lifecycle architecture and subjective memory formation. | **Do not touch; interface only** | CC-2/12 may consume bounded memory evidence/projections but must not create another long-term store. |
| Communication planning vertical slice | `character-communication-foundation-service.mjs` provides bounded goal/addressee/purpose, direct/indirect/silence/nonverbal, withholding and accessible-cognition grounding. | **Direct reuse + extend** | Strong partial coverage of CC-1/2/3 contracts, but not a complete Unified Communication IR. |
| Native action integration | Communication can become a normal candidate action and reach committed causal history. | **Direct reuse** | Preserve normal Character Brain selection and World causal commit authority. |
| World communication event | Causal engine emits bounded `communication_event` with channel, addressee, expression mode, semantic content and epistemic status. | **Extend** | CC-1 needs richer IR/event linkage without exposing private intent as observable signal. |
| World perception | Programmatic visibility/occlusion and audibility propagation already constrain what observers can physically receive. | **Direct reuse + adapter** | CC-2/6/8/9 should project communication signals into existing perception rather than invent perception truth. |
| Auditory world signals | `world-simulation-audibility-query-service.mjs` owns physical propagation/hearing boundaries; Character Brain does not decide audibility. | **Direct reuse** | Speech/voice signals must flow through this authority before listener interpretation. |
| Visual world signals | Existing visibility/occlusion/illumination infrastructure is already part of the neural/perception boundary. | **Direct reuse** | Gaze/face/gesture/body signals should use existing physical observability rather than direct semantic delivery. |
| Single-turn expression simulator | `character-turn-simulation-service.mjs` derives one-turn `speech_act`, likely visible action and speech ceiling from felt/body/immediate-goal/withheld/knowledge evidence. | **Adapter / semantic source; do not duplicate** | Useful CC-3 expression/disclosure semantics, but it is a writing-facing single-turn capability and is not the native World Communication IR. |
| Writing generation providers | Backend/local generation-provider services exist for writing pipelines. | **Optional adapter only** | May later realize language, but cannot become required Communication Core or runtime naturalness judge. |
| Chinese surface realization | No native Character Communication Chinese realization contract was found in the communication vertical slice; existing writing generation is not equivalent. | **Needs implementation after foundation contracts** | CC-5 remains a real gap. |
| Unified Communication IR | Existing communication objects are narrow and split across foundation/action/event/single-turn structures. Missing common representation for audience sets, modality-carried meaning, reference/focus, stance, information structure, display/modulation, interaction/repair lineage. | **Needs extension** | CC-1 is only partially covered. First architecture gap is a unifying contract/adapters, not rebuilding speech from zero. |
| Epistemic provenance | Existing slice preserves known/uncertain and blocks inaccessible basis; broader source lineage (perception/memory/testimony/inference/assumption/convention/fiction/deception) is not represented by one communication provenance contract. | **Needs extension** | CC-2 partial, not sealed. |
| Discourse/reference state | No native `discourse_state` / active referent / interaction-thread runtime found in Communication Core. | **Needs implementation** | CC-4 real gap; must remain short-term working state, not Memory. |
| Listener comprehension | No native listener-side subjective interpretation pipeline found. | **Needs implementation** | CC-6 real gap. Observable signal must not directly write belief. |
| Grounding / repair | No native communication grounding/repair state machine found. | **Needs implementation** | CC-6/7 real gap. |
| Incremental turn-taking | Existing world loop is incremental/event-driven, but no Communication-specific floor/backchannel/overlap/partial-utterance contract was found. | **Needs extension** | CC-7 must reuse world timing rather than impose fixed psychological thresholds. |
| Multimodal meaning allocation | Current slice has speech vs nonverbal channel and one signal intent, not shared semantic allocation across speech/prosody/gaze/face/gesture/body. | **Needs extension** | CC-8 real gap; do not implement as sentence + decorative animation. |
| Multiparty audience design | Current slice has one addressee and world observers, but no subjective primary/side/overhearer/eavesdropper/track model. | **Needs implementation** | CC-9 real gap. |
| Higher-order modes | No separate Communication engines should be introduced for narrative/humor/deception/teaching/negotiation. Existing cognition/memory foundations may supply evidence. | **Defer until CC-1–9 contracts** | CC-10 remains downstream. |
| Communication development | No dedicated long-term language/pragmatic development model identified in native Communication Core. | **Defer / needs later implementation** | CC-11 downstream; must use evidence, not a global skill score. |
| Partner conventions/history | Memory can preserve experience, but no bounded Communication projection for partner routines/inside jokes/shared precedents was identified. | **Needs later adapter** | CC-12 must read Memory rather than store a parallel history. |
| Scaling/fidelity | World runtime already contains event-driven and bounded character-facing infrastructure. | **Direct reuse + later certification** | CC-13 should extend/degrade Communication workload without a second world loop. |
| Formal development/integration | Workstream/workspace/Journal/integration/remote exact-verification machinery exists and is healthy at audit start. | **Direct reuse** | Every later CC phase uses the normal controlled lifecycle. |

## Duplicate-semantics risk discovered by CC-0

Two existing expression-related representations must not evolve independently:

1. Native world communication foundation/action/event fields (`speech_act`, semantic content, epistemic status, expression mode).
2. Writing-facing single-turn simulator fields (`speech_act`, `speech_ceiling`, `next_turn_reaction`, withheld-content and knowledge boundaries).

They are not interchangeable today. The first is causal/native but narrow; the second contains useful expression constraints but is writing-facing and single-turn. CC-1 should therefore introduce a bounded shared Communication IR plus adapters, preserving each subsystem's authority instead of replacing either subsystem wholesale.

## CC-0 acceptance result

- Authoritative repository baseline identified: PASS.
- Active workstream/workspace state checked before audit: PASS (none active before this CC-0 workstream).
- Development Journal/registry health checked in the controlled development environment: PASS at audit start.
- Memory Core left sealed and untouched: PASS.
- Existing unrelated modified files on shared main are not copied into this isolated workspace and remain untouched: PASS.
- Character Brain → Communication → World causal path identified: PASS.
- World → physical Perception authorities for visibility/audibility identified: PASS.
- Listener subjective interpretation is confirmed as a gap, so the full Character Brain → Communication → World → Perception → Listener interpretation chain is not yet closed: expected downstream gap, not a CC-0 failure.

## First true architecture gap after audit

The repository does **not** need a new speech system from zero. The earliest dependency gap is the CC-1 Unified Communication IR contract and adapters that reconcile existing native communication/action/event semantics with reusable single-turn expression constraints while preserving provenance and private/public boundaries.

Before CC-1 implementation, validate the contract against established dialogue/NLG separation principles: multidimensional communicative functions should not collapse into one speech-act label; communicative planning should remain distinct from surface realization; and listener grounding must remain an interaction process rather than being assumed from signal emission.
