# Character Runtime v5 — Selective Working-Memory Output Gating

## Purpose

Character Runtime v5 adds a narrow deterministic readout boundary after the existing Current Mind state has already been formed and placed.

Its core distinction is:

```text
Current Mind state
!= Current Mind readout
!= Character Brain action intent
```

v5 does not create another memory system, another attention resolver, or another retrieval engine. It decides which representations that already exist in Current Mind may influence the Character Brain on the current cognitive cycle.

The design follows the working-memory output-gating distinction used in cognitive-control research: input gating determines what enters working memory, while output gating determines which maintained contents can currently influence behavior. The implementation imports only that structural distinction. It does not import reinforcement learning, biological circuitry, probabilistic control, or learned gating policies.

Relevant conceptual references include Chatham, Frank & Badre (2014), *Corticostriatal Output Gating during Selection from Working Memory*, and Bhandari & Badre (2018), *Learning and Transfer of Working Memory Gating Policies*.

## Architecture

```text
bounded perception / recollection / committed experience / current action
        ↓
Candidate Formation                         [v2/v3]
        ↓
Selective Input Gate                        [v4]
        ↓
Deterministic Attention Resolver            [v2]
        ↓
FULL Current Mind state
focus / active / peripheral / fading / suspended
        ↓
Selective Output Gate                       [v5]
        ↓
Current Mind readout
cognition.working_context
        ↓
final v3 single-semantic ingress
        ↓
Character Brain action intent
```

The full Current Mind state remains the authoritative Runtime state. The readout is a bounded projection of that state for one Character Brain decision cycle.

## Authority

- World / perception systems own bounded perception.
- Phase63C owns whether recollection actually surfaced and what content was recovered.
- Character Runtime v4 owns Current Mind input admission and maintenance.
- Character Runtime v2 owns deterministic Current Mind placement.
- Character Runtime v5 owns deterministic Current Mind readout.
- Character Brain owns candidate action intent only.
- World adjudication owns causal outcome.

GPT / neural adapters do not author output-gate decisions and do not receive private output-gate evidence.

## Output-gate outcomes

### `open`

The representation remains in Current Mind and is also readable by Character Brain on this cycle.

Initial deterministic open support is deliberately narrow:

- the representation is the selected focus;
- it is the current action representation;
- it has current goal / intention support, including valid v4 maintained-goal continuity;
- it carries immediate constraint / urgency support;
- it carries expectation-violation support.

### `closed`

The representation remains in Current Mind but is not included in the Character Brain readout on this cycle.

```text
output closed
!= removed from Current Mind
!= rejected by the v4 input gate
!= decay
!= suspended
!= clear
!= forgotten
!= source-memory mutation
```

A representation may therefore remain active, peripheral, fading, or suspended in the full Runtime state while being behaviorally inert for the current Character Brain decision.

## Salience is not sufficient readout authority

Meaningful perceptual salience may be sufficient for v4 Current Mind admission because salient perceived content can deserve workspace representation. Recollection retrieval or recollection salience alone does not expand v4 admission authority; a recollection still needs the existing v4 support path such as target / goal relevance, urgency, expectation violation, or maintained prior support.

Admission support still does not imply that salience alone must influence the current action decision.

Therefore the initial v5 policy intentionally allows:

```text
meaningful perceptual salience
→ admitted Current Mind representation
→ output closed when no current behavioral support exists
```

For recollections, retrieval occurrence or salience alone may remain rejected by v4 before any v5 output decision is needed. This preserves the existing v4 contract while keeping v5's readout boundary narrow.

This is the main stability / interference boundary introduced by v5.

## Focus remains readable

The existing v2 attention resolver remains authoritative for focus selection. v5 does not re-rank focus candidates.

If a representation is the selected focus, its output gate is open.

```text
focus selection
→ output open
```

This preserves the meaning of Runtime focus without installing a second focus resolver.

## Maintained-goal continuity

v4 permits a prior Current Mind representation to remain `maintain` when the same goal still supports it, even if the item's literal content does not freshly substring-match the goal text.

v5 consumes that already-authoritative v4 maintenance evidence. It does not recompute a second goal model.

Thus:

```text
v4 maintain with goal_or_intention_support
→ v5 output open
```

A decaying item with stale historical goal evidence does not become readable merely because old maintenance metadata exists.

## Recollection boundary

Phase63C retrieval success still does not imply output readout.

```text
Phase63C recovered
→ v4 candidate / admission
→ v2 Current Mind placement
→ v5 output gate
→ possible Character Brain readout
```

A recollection may therefore be:

- recovered but v4 rejected;
- recovered and admitted but v5 output closed;
- recovered, admitted, and output open.

`target_relation = target_related`, explicit goal relevance, or other valid Current Mind goal/intention evidence may support output-open readout. Retrieval occurrence or salience alone does not.

v3 Single Semantic Exposure remains authoritative. An output-closed recollection must not bypass v5 through raw `recovered_memories`, `retrieved_memories`, or duplicated `cognition.attention` content.

`retrieval_experience` remains separately character-facing because it is process state rather than duplicated recovered semantic content.

## Current Mind state is not mutated by readout

The output gate is projection-only.

It MUST NOT:

- move a representation between focus / active / peripheral / fading / suspended;
- change v4 admission outcome;
- trigger clear;
- accelerate or delay decay;
- refresh last-seen state;
- rewrite temporary expectation;
- mutate source memory;
- change confidence or perceptual certainty;
- create a new memory;
- alter Character Experience.

The committed Current Mind transition therefore continues to persist the full reducer state independently from the current readout projection.

## Persistence and historical replay

The committed Current Mind transition persists engine-private output-gate evidence:

```text
candidate_id
source_kind
slot
gate_outcome
reason_codes
```

The transition also persists the full `reducer_state_after` / `character_view_after`.

Historical replay MUST NOT ask the latest v5+ output-gate algorithm what a past Character Brain should have been able to read. Historical semantics are carried by the persisted historical transition and output-gate decisions.

A future gate version cannot rewrite past readout semantics.

## Character-facing boundary

The canonical Character Brain Current Mind surface remains:

```text
cognition.working_context
```

For v5 this surface is the **readout projection**, not the full Current Mind state.

Character Brain MUST NOT receive:

- output-gate decisions;
- gate outcomes;
- output reason codes;
- candidate IDs;
- source refs;
- attention scores;
- admission scores;
- reducer audit metadata.

`cognition.attention` is compatibility information only and MUST NOT expose a Current Mind representation that is absent from the authoritative v5 `working_context` readout.

## Initial deterministic policy

For each representation already present in full Current Mind:

1. selected focus → `open`;
2. current-action representation → `open`;
3. immediate constraint / urgency support → `open`;
4. expectation violation → `open`;
5. current goal / intention support, including authoritative v4 maintained-goal continuity → `open`;
6. otherwise → `closed`.

The policy uses no:

- neural score;
- LLM importance rating;
- random selection;
- wall-clock timing;
- reinforcement learning;
- learned gating policy;
- fixed claim about human working-memory capacity.

## Acceptance matrix

Required v5 assertions:

1. A salience-only item may remain in full Current Mind while output-closed.
2. Output-closed state remains present in `reducer_state_after` and `character_view_after`.
3. Output-closed state is absent from `cognition.working_context`.
4. Focus is output-open.
5. Current action is output-open.
6. Goal / intention supported content is output-open.
7. v4 maintained-goal continuity remains output-open.
8. Urgent / immediate-constraint content is output-open.
9. Expectation-violating content is output-open.
10. Retrieval success or salience alone does not force recollection readout.
11. Phase63C target-related / goal-supported recollection may be output-open.
12. `cognition.attention` cannot bypass an output-closed `working_context` item.
13. v3 recollection Single Semantic Exposure remains exactly once.
14. Private gate decisions / IDs / reason codes never reach Character Brain.
15. Same full state + same evidence yields identical output decisions.
16. Historical projection persists output decisions without current-algorithm recomputation.
17. Output gate does not alter full Current Mind placement or source memory.
18. Blocked / stale / failed world turns do not commit speculative v5 transitions.

## Explicitly out of scope

- v4 input-gate redesign;
- v2 attention-resolver redesign;
- second memory store;
- memory retrieval redesign;
- memory deletion / forgetting policy;
- reconsolidation;
- retrieval-induced forgetting;
- learned / RL output gates;
- probabilistic output gating;
- Personality;
- Belief dynamics;
- Needs dynamics;
- Emotion learning;
- Self Model;
- Habit;
- Skill learning;
- Relationship learning;
- Reflection persistence;
- autonomous scheduler;
- local LLM;
- dialogue generation.

## Invariants

```text
In Current Mind
!= readable this cycle

Output closed
!= removed

Output closed
!= forgotten

Output closed
!= decay

Output gate
!= attention resolver

Output gate
!= memory retrieval

Full Current Mind state
remains authoritative Runtime state.

cognition.working_context
is the current behavior-facing readout.
```
