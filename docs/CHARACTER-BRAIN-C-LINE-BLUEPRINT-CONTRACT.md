# Character Brain C line: blueprint contract and executable gap matrix

Status: CB-C0 contract candidate (baseline `f7f048676a596f4d6f6fc4adf20aab75a10eab79`)

## 1. Sources, interpretation and status vocabulary

- To-Be: `武裝學院_Character_Brain_主藍圖_v1_依V16精煉.md` (Library `libfile_da33f6d47c208191badc73aaaffeedab`, §0–8; read 2026-09-25).
- As-Is: `武裝學院_Character_Brain_A線現況總盤點_最終統合版_2026-09-25.md` (Library `libfile_60c3349dd0788191b16fb859180eb23c`, baseline equals this document's commit; §1–48; read 2026-09-25).
- Construction order: `Character Brain — C 線 Blueprint Gap Closure`, Master Engineering Roadmap v1, 2026-09-25, §4–22.
- Repository evidence: exact baseline above, with targeted checks of `server/src` made during this reconciliation. A service or schema proves only its own existence. An A-line Native Loop finding establishes adoption as of the exact baseline, not a future implementation. Tests listed below are **future phase oracles**, unless explicitly called existing evidence. No new runtime behavior is claimed in CB-C0.

Status meanings: `exists` = the specified baseline causal edge is present; `partial` = some edges exist but the named end-to-end requirement does not; `mismatch` = two currently authoritative representations conflict; `absent` = required producer/writer/turn does not exist; `not_checked` = insufficient evidence to decide. Body-dependent rows can be `partial` or `absent` while awaiting the Body contract. M0 rows are all classified here; later implementation must recheck code and tests before a gate is marked PASS.

## 2. Requirement registry and gap matrix

`Evidence` references the A-line baseline and concrete current repo surfaces. `Oracle` names a **new test to write or run**, never a passing result. A sealed dependency is an integration boundary, not permission to redesign it.

| ID / blueprint | Priority / owner | Existing implementation and baseline evidence | Status / missing causal edge | Dependency / proposed boundary / oracle | Sealed dependency |
|---|---|---|---|---|---|
| BR-01 §1, §3 World truth versus knowledge | M0 / World owns truth; Brain owns belief | A §1, §4, §11, §40: observer-scoped perception → subjective claims; consistency gate → World commit. `server/src/world-simulation-character-brain-input-service.mjs` | exists; preserve source and arrival boundaries | C1–C8: hidden distant event never appears in character knowledge before a legitimate observation (T01); an observed lie can remain a fallible belief (T02) | Memory, Belief, Consistency |
| BR-02 §1, §3 time and provenance | M0 / World event time; sensory arrival; Brain processing | A §3 per-character sequence and committed Current Mind/Experience replay; A §4 observer evidence | partial; a uniform source/event/arrival/processing envelope is not established across all future modalities | BODY-0 before new body signal, C2 for internal opportunities; no objective event ref in character-facing content; delayed signal cannot be used early | Runtime identity, committed replay |
| BR-03 §2, §4.1 visual/auditory reachability | M0 / World physical reachability and perception frontend | A §4.1–4.2: LOS, FOV, illumination, audibility, comprehension separation | exists for current vision/hearing; additional modalities in BR-04 | BODY-1: position/occlusion changes observable evidence, no hidden exact geometry in Brain (T01, T03) | observer perception |
| BR-04 §2, §4.1 interoception, touch, olfaction, taste, active sampling | M0 where modality enabled / Body and modality frontend | A §4.3 partial other-senses visible constraint; §37 physical state is World causal state, not an interoceptive frontend | partial; sampling action → actual changed receptor evidence is absent for the listed modalities | BODY-0 → BODY-1: eye/head orient, approach, touch and sniff yield distinct later evidence; no modality is fabricated when no Body contract (T03–T04) | World truth boundary |
| BR-05 §1–2 Body authority and objective history | M0 / Body owns objective body state; World owns physical consequences | A §37: `health_current`, injuries, movement/combat multipliers, incapacitation and movement feedback are World causal state | partial; no independent Body history, brain/body commands, proprioception or interoception | BODY-0: injury ≠ pain, motor intention ≠ completed motion; brain receives only reachable body signals | World causal result, commit gate |
| BR-06 §2, §4.2 attention and Current Mind | M0 / Character Runtime | A §5: focus, active/peripheral/fading/suspended context, gates, simulation-time decay; §3 commit/replay | partial; `experiential_knowledge` default wrapper forwarding and optional neural salience consumption remain disconnected (A §5.9) | C1-C/D: input → wrapper → Current Mind → downstream consumption, with negative case for suggestion authority. Do not infer human WM capacity from engineering bounds | Current Mind, Memory encoding |
| BR-07 §2, §4.2 memory retrieval, source, uncertainty | M0 / Memory Core | A §6–10: encoding, accessibility, Phase63C retrieval, source monitoring, interference and reconsolidation; §46 Native read/writes | exists in Native semantics; Formal parity is BR-19 | C7: failure, source ambiguity and delayed recovery preserved; never equate spontaneous retrieval mode to spontaneous turn creation | sealed Memory Core |
| BR-08 §2, §4.2 subjective belief and self | M0 / Belief and Self projections | A §11–13: durable claims/beliefs, autobiographical semantics, structured self | exists; legacy state fields are compatibility input, not equal authorities | C1-E protects Phase74 grounding; T02 contradictory testimony changes only observer-specific belief on legitimate evidence | sealed Belief and Self |
| BR-09 §2, §4.2 affect and mood | M0 / Affect history | A §14 and §24: appraisal, coping, persistent mood; `state.emotion` differs from durable affect | partial cross-surface grounding, not absence of affect | C1-E only missing causal edges; competing `emotion` state and affect projection must have declared lineage; T09 observers differ | sealed Affect/Mood |
| BR-10 §2, §4.2 motivation → goal formation | M0 / Character Goal lifecycle | A §15.1 and §46: Phase68D service with propose/commit/suspend/abandon, Native production call absent. `server/src/world-simulation-motivation-goal-integration-service.mjs` exports `buildWorldSimulationMotivationalGoalEvents` | partial; motivation evidence never becomes newly committed Native goal by the canonical call | C1-A → C3: new subjective evidence → motivation → committed goal, no World/Body truth shortcut; preserve Goal service authority | sealed Goal downstream lifecycle |
| BR-11 §2, §4.2 plan and interruption/reentry | M0 / Character Goal and Plan | A §15.2–15.8: Phase69A service not called from Native production, while cue activation, viability, replanning exist. `server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs` exports `buildWorldSimulationGoalImplementationIntentionEvents` | partial; newly formed goal → plan/cue is missing in Native | C1-B → C3: cue-bound IF/THEN plan survives interruption, resumes when valid, changes means without deleting goal (T06) | sealed Phase69/70/71 |
| BR-12 §0, §2 autonomy without outside event | M0 / World scheduling grants opportunity; Brain owns cognition | A §43: `prepareWorldSimulationTurn()` requires current event; empty queue rejects. Phase63C spontaneous is a retrieval mode **inside** a turn | absent; legitimate internal concern → cognition opportunity | C2 after C1: concern with lineage wakes bounded turn; empty/no concern remains idle; scheduler never authors thoughts, beliefs or actions | Runtime identity, event commit |
| BR-13 §2, §4.3 action intention / candidate scope | M0 / Brain candidate authority, World/Body feasibility | A §17 and §45: generic catalog depends on `available_actions`; neural extension only considers/orders refs. `server/src/world-simulation-neural-service.mjs` reads `input.available_actions` | partial; grounded new subjective affordance candidate cannot join generic universe | C5 after C3: known capability/method + observed context yields bounded candidate absent from menu; unknown item/location/skill/body capability fails closed | Phase72/74, World execution |
| BR-14 §3 action execution and feedback | M0 / Brain chooses; World/Body executes and adjudicates | A §17–18, §36–37, §40: deliberation/commitment and bounded post-outcome experience | exists for current World actions; body effectors and physical modalities in BR-05/17 | BODY-0/1: attempted act and observed outcome can diverge, then subjective learning changes later choice | sealed Phase74/75, consistency gate |
| BR-15 §2, §4.3 communication meaning and listener understanding | M0 / CC owns speaker plan, World signal, listener Brain interpretation | A §26–34: speech, acoustic bridge, listener understanding, grounding, repair, CC7 timing and floor | exists for implemented speech path; embodied modalities deferred to BR-17 | CC8 only after BODY-0 and BODY-1; listener receives actual signal and may misunderstand (T07–T08) | sealed CC0–CC7 |
| BR-16 §2, §4.3 social learning | M0 / listener Brain owns subjective interpretation; relationship projection owns durable consequence | A §25, §35: relationship is readable in cognition/strategy, no World Simulation durable writer. Writing-pipeline `character-mind-state-ledger-service.mjs` `relationship_attitude_delta` is unrelated | absent Native writer; perceived social act → subjective interpretation/appraisal → durable relationship evidence → future behavior | C4 after C3: one act, three observers (friendly, sarcastic, unnoticed); only experienced evidence alters each relationship; T1 update changes T2 choice (T09) | CC listener/Memory/Affect |
| BR-17 §2, §4.3 expression through physical effectors | M0 / Body effectors and World acoustics | A §27 has speech-stream and acoustic bridge; §37 lacks full Body | partial; voice/respiration, gaze, face, gesture, posture and resource conflict need actual Body | BODY-0 → BODY-1 → CC8; low breath/overlap produces physical signal and listener difference (T07) | CC0–CC7 |
| BR-18 §2, §4.4 sleep and offscreen continuity | M0 reduced fidelity / World time, Body slow state, Brain goal/memory | A §43 event-driven cognition; A §3 replay; World event scheduling exists | partial; sleep/arousal and long-offscreen autonomous continuity have no end-to-end lifecycle | C2/C3/C4/C5 → BODY-0/1 → C6: sleep ≠ pause; history/goal/body states persist under reduced fidelity, reentry respects source history (T10,T13) | Runtime, Memory, World chronology |
| BR-19 §6, §8 Formal/Native semantics | M0 parity / Formal transport owns isolation; Brain semantics shared | A §41, §46: Formal Phase63C resolver round missing; optional Native communication/cognition stages wider | partial; Formal authoring/read surface cannot reproduce all Native semantic decisions | C7 after C6: compare equivalent bounded scenes for authority, belief, retrieval and action, not identical internal implementation | Formal transport, sealed memory/CC |
| BR-20 §5 World Agent and character resolution | M0 interface / World owns entity birth/event truth; Brain owns subjective entry | Blueprint §5 explicitly says World Agent architecture is outside B-line completeness; A §1 World/Brain boundary | not_checked for separate World Agent, **boundary specified**: no direct omniscient belief injection | Independent World engineering: event/character creation must pass World rule and later observer exposure (T14); C-line must only consume bounded signal | World rules, identity |
| BR-21 §6 fidelity and background agents | M0 consequence preservation / World scheduler plus Body/Brain | A §3 committed replay; §43 event-driven schedule. No verified foreground/reduced comparison at baseline | partial; no verified transition preserving body/goal/social/memory history | C6 then C8: paired full/reduced runs share causal outcomes at required resolution; no invented autobiographical memory on promotion (T13) | Chronology, Body, Memory |

M1/M2 boundary (not blocking M0): Blueprint §2, §4.4, §9 retains low-resolution respiratory/pain/temperature/hunger/thirst where relevant; deeper endocrine, glia, vascular, myelin, GH/IGF, reproductive and receptor/connectome detail remain conditional or research-held. BODY-0 must declare interfaces for configured physiology without manufacturing physiological truth from age, gender or dialogue. Test T11/T12 only when actual Body configuration makes those quantities relevant.

## 3. Interface ownership and dependency graph

| Handoff | Producer authority | Receiver restriction | First closure |
|---|---|---|---|
| World event → perception | World geometry/time/physical result | Only observer-reachable, timestamped signal; no hidden entity ID as knowledge | preserve now; BODY-1 extends modalities |
| Body state → neural evidence | Body objective history | Interoception/proprioception is bounded signal, not omniscient medical record | BODY-0 |
| Perception/experience → Brain | observer frontend / committed experience | can miss, doubt or misattribute; no automatic encoding | existing sealed Memory, C1 wiring |
| Internal concern → cognition turn | scheduler determines opportunity from committed/pending evidence | Brain determines content and choices; scheduler never writes belief/action | C2 |
| Motivation → Goal → Plan | Brain's existing Phase68D/69A services | Native call must retain lineage and commit lifecycle; no shadow Goal DB | C1 then C3 |
| Brain intent → World/Body action | Brain candidate/choice; World/Body feasibility/execution | subjective feasibility ≠ objective possibility ≠ success | C5 then BODY-0/1 |
| Social signal → relationship | listener interpretation/Memory/Affect; relationship projection owns durability | speaker intent or raw event cannot directly add trust | C4 |
| Communication → body/world signal | CC meaning and modality plan; Body effector; World propagation | text/animation tag is not actual sound/movement | CC8 after BODY-0/1 |
| Committed history → replay/transport | World committed chronology | rehydrate exact projection, no retroactive free cognition | existing; C7 parity |

Execution dependencies (a prerequisite arrow does **not** grant an earlier phase permission to implement later ownership):

```text
CB-C0 → CB-C1 → CB-C2 → CB-C3 → CB-C4 → CB-C5
                                      ↓
                     BODY-0 → BODY-1 → CC-8
                                          ↓
                                  CB-C6 → CB-C7 → CB-C8
```

## 4. Executable backlog and phase test contracts

| Phase | Smallest reviewable change | Gate evidence required before next phase |
|---|---|---|
| C1-A/B | Inspect Phase68D/69A inputs, projection and commit order; connect existing services to canonical Native production without duplicate events | Newly produced goal and plan visible at later committed turn; same-scene replay idempotent |
| C1-C/D | Forward `experiential_knowledge` through default wrapper; consume optional neural salience as bounded suggestion in Current Mind | Default-path representation present; malicious annotation cannot change observation/authority |
| C1-E | Trace Phase74 grounding to durable Mood/Self/Belief/Needs; fix only demonstrated missing consumption | Existing state and durable projection never compete for one truth; affected cognition tests |
| C2 | Evidence-indexed internal opportunity producer with bounded scheduling and simulation-time identity | Unresolved concern permits one cognition turn with empty external queue; no concern remains idle; no busy loop/replay duplication |
| C3 | Carry motivation, committed goal, implementation intention and prospective cue through interruption and reentry | New subjective evidence → goal → plan → future cue → action opportunity; interruption retains goal |
| C4 | Listener-specific social interpretation and experience-backed durable relationship writer | Same signal yields divergent observer projections and only observed evidence changes future relation/behavior |
| C5 | Bounded subjective affordance candidates from existing perceived context and capabilities | Candidate absent from menu can be proposed; fictitious item/skill/location/body capability rejected; World decides feasibility |
| BODY-0 | Objective Body state/history and brain/body command/evidence contracts | Injury/pain and intention/movement are distinguishable; no physiological truth forged in cognition |
| BODY-1 | Active sample, modality, motor and feedback adapters | Head/approach/touch/move perturb next sensory sample at legal time; signal provenance retained |
| CC8 | Modality plan → real effectors/signals → listener evidence | Gaze/voice/body resource/timing conflicts create observable differences; retained CC0–7 speech semantics |
| C6 | Sleep/arousal and offscreen reduced fidelity integrated with world time | Replay and foreground reentry preserve causal body, goal, social and memory history |
| C7 | Formal semantic decisions missing from Native/Formal parity | Native/Formal paired tests preserve epistemic and character choice authority |
| C8 | Two characters, day 1/offscreen/day 2 certification | Different experiences alter day 2 relationship, belief, goal and action; committed replay exact |

Verification routing: use focused affected tests and diff check for each change, then the repository's exact-commit integration gate and its risk-based escalations. Preserve all sealed subsystem and reliability evidence. A no-code CB-C0 contract is checked by source cross-reference, completeness and `git diff --check`; integration still follows the repository gate.

## 5. CB-C0 review and exit checklist

- [x] Every M0 responsibility in Blueprint §2, §3 and §4 has an explicit registry row and status (BR-01–21); §5 World Agent is separately `not_checked` without asserting implementation.
- [x] Every inter-system handoff has one owner and receiver restriction; compatibility `state.emotion`, `state.values`, `known`, `current_action` cannot replace the A-line durable sources.
- [x] Body-dependent requirements BR-02, BR-04, BR-05, BR-14, BR-17, BR-18 and BR-21 are marked; BODY-0/1 precede CC8.
- [x] Sealed Memory, Belief, Self, Affect, Goal downstream, Runtime, Phase74/75 and CC0–7 are identified as reuse boundaries.
- [x] No Personality Engine, new Memory/Goal/Relationship truth store, scheduler belief generator or invented body data is authorized by this contract.
- [x] Each incomplete causal edge has a first owning phase, a prerequisite and a behavioral oracle; source documents' suggested T01–T14 remain candidate tests until executed.

CB-C0 is a mapping and contract gate. C1 starts only after this exact document is committed, integrated, verified on authoritative remote, and the workspace/Journal/transaction/checkpoint statuses are healthy. Any observed divergence from this baseline must update the relevant registry row with code and test evidence; a source title or service export alone never closes a Native edge.
