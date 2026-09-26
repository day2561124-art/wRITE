# Character Brain C5 — Bounded Subjective Affordance Contract

Status: C5-A implementation contract candidate. Baseline: `f081e661db787005b589127238e7f71e5a4e568a`. This file specifies future gates; it does not assert C5 runtime behavior is installed.

## Ownership and existing surfaces

The C-line blueprint's BR-13 requires a character to propose a bounded action missing from an externally supplied menu when the character has a known method or capability and a perceived opportunity. Character Brain owns the proposal and choice. World / eventual Body owns actual preconditions, execution, outcomes and resource use.

| Existing surface at the baseline | Proven property | Remaining C5 gap |
|---|---|---|
| `world-simulation-neural-service.mjs` `buildWorldActionCandidates` | Normalizes at most 24 `available_actions` entries, reserving one slot for an existing communication candidate when present. | The generic path does not derive a new noncommunication candidate from a character's perceived situation and known means. |
| `world-simulation-character-facing-capability-runtime-service.mjs` | A neural extension considers/orders/deprioritizes refs from the trusted candidate set; it cannot enlarge that set. | Do not let model ranking manufacture action authority. |
| `world-simulation-character-brain-input-service.mjs` | Character Brain receives `candidate_action_intents`, observer-bounded perception and cognition before its decision; deliberation and consequence views consume the supplied candidates. | Admit a new grounded candidate before those views are built, without exposing engine evidence as knowledge. |
| Phase69/71/73 and Phase72 | Existing plans, subjective means reconsideration and engine-authoritative feasibility have separate authorities. | A newly proposed intention must not be called feasible merely because a character believes in it, nor turn an engine verdict into a belief. |
| `world-simulation-prepared-turn-ephemeral-broker.mjs` | The action round snapshots `candidate_action_intents` into an exact `candidate_action_ids` set and rejects any submitted `action_id` outside that current character packet. | C5 must enlarge the trusted packet before the broker snapshot; it must not bypass selected-action membership validation. |
| `world-simulation-causal-rule-engine.mjs` | Selected intents are still adjudicated against programmatic movement, object, communication, combat and physics rules; selection itself is not a success claim. | A newly admitted attempt receives no feasibility or outcome authority merely by entering the candidate set. |
| Native `world-simulation-loop-service.mjs` | Current turn carries Character Brain choice into the ordinary World resolution lifecycle. | Verify an out-of-menu grounded proposal can enter ordinary choice and the same existing causal adjudication path; proposal alone grants no effect. |

These are targeted source observations, not a claim that the entire Native call and selection path has already been audited. Before C5-C writes, trace the exact Native producer, decision packet, selected-action membership check and World adjudicator against this baseline.

## Research basis

- Gibson's theory describes affordances as relations between surroundings and an organism's possible action, motivating a candidate tied to both perceived context and the actor's capabilities: J. J. Gibson, *The Theory of Affordances* (1977/1979), https://monoskop.org/images/c/c6/Gibson_James_J_1977_1979_The_Theory_of_Affordances.pdf.
- Fox and Long distinguish planning actions, conditions, resources and plan validation. C5 must keep candidate generation apart from World applicability and resource checks: *PDDL2.1* (2003), https://www.cs.cmu.edu/afs/cs/project/jair/pub/volume20/fox03a-html/JAIRpddl.html.
- Rao's AgentSpeak(L) formalizes practical BDI agency. C5 uses the character's represented knowledge/intentions for candidate formation while leaving actual execution to World: *AgentSpeak(L)* (1996), https://apice.unibo.it/bin/view/Publication/RaoAgentspeak96.

These sources inform the authority split; they do not prove any particular repository implementation.

## C5 candidate rule

A novel candidate is an **attemptable intent** with bounded, same-character provenance. It must reference (1) a current or committed observer-available context fact identifying its target or place, and (2) a represented method/capability available to that character. The candidate contains an ordinary action shape, character ID, target or place ref, method ref, source evidence refs, and a deterministic identity. It is advisory until Character Brain selects it and World checks the attempt.

The producer must fail closed for a missing or stale observation, another observer's evidence, a merely imagined or unknown target, an invented skill/item/body effector, a method outside the character's represented means, or a request to treat engine-private Phase72 checks as subjective facts. Natural-language similarity is insufficient as an authority proof. A belief can motivate an attempt without certifying its physical success; a false but legitimately held belief is not silently corrected from hidden World state.

Candidate budget and ordering must be deterministic. Preserve existing menu candidates and the existing communication candidate, deduplicate identical attempts, and make truncation observable. Do not allow incoming neural text, narrative priority, camera framing or speaker intent to add candidates. A rejected or unselected candidate causes no World mutation or durable learning event.

## Incremental implementation and oracles

| Gate | Smallest change | Passing oracle |
|---|---|---|
| C5-A | This contract plus review of the exact baseline surfaces. | Source map names candidate generation, Character Brain ingress, submission and World ownership without claiming an unbuilt writer. |
| C5-B | Read-only, bounded, same-character evidence catalog from ordinary perception and represented means; explicitly model missing provenance. | Two observers see different opportunities; hidden object, unperceived location and cross-character capability are absent. Replay produces the same catalog and does not mutate state. |
| C5-C | Character-owned proposal admitted into the trusted candidate universe before deliberation, under B's exact refs. | A grounded non-menu candidate appears; fictitious item/skill/location/body ability and stale refs fail closed; existing menu and communication candidates remain. |
| C5-D | Native selection and submission boundary for the grounded candidate, with normal causal adjudication. | Brain may select or reject it; selection never asserts success, and an objective blocker yields an unsuccessful attempt with bounded feedback. Duplicate/replay and tampered proposal refs fail closed. |
| C5-E | Paired longitudinal Native regression and targeted integration. | A later legitimate observation or learned method changes the actor's candidate set; an unobserved change does not. World truth and character belief may diverge. |

Do not open BODY-0/1 implementation inside C5. Until Body establishes effector authority, claims about unimplemented motor capabilities and bodily actions must be rejected. Do not introduce a second Goal, Memory or World truth store, a numeric feasibility score, or direct plan mutation.

## Review before C5-B

1. Trace Native `available_actions` source, candidate universe assembly, Character Brain packet and exact selected-action validation.
2. Identify canonical existing representation of perceived targets, represented methods and capabilities; if one is unavailable, add only a bounded typed bridge with explicit provenance rather than infer it from a free-text goal.
3. Add focused positive/negative tests before enabling a new path, then run affected checks and the repository's exact-commit integration gate.
