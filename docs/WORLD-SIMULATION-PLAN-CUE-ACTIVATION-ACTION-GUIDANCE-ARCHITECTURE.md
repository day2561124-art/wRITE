# Phase69C Research Baseline — Plan-Cue Activation / Action-Proposal Guidance

Status: Phase69C architecture and acceptance baseline.

Authoritative base HEAD: `1856debc5c41ecbaf128a87932116767d344d4b8`.

## 1. Scope

Phase69C connects committed prior-turn Phase69A/69B implementation-intention state to the existing action-proposal path without turning plans into executable actions.

```text
Phase68D committed goal
!= Phase69A implementation intention
!= Phase69B revised implementation intention
!= Phase69C cue activation / advisory guidance
!= candidate action
!= selected action
!= causal outcome
```

Phase69C answers: when current bounded character-facing context is compatible with an already committed implementation-intention cue, how can that plan become salient to the action proposer while preserving the existing Character Brain decision and causal authority boundaries?

## 2. Research synthesis

Implementation-intention research describes if-then plans as strengthening accessibility of specified cues and facilitating response initiation. The useful engineering consequence is cue-triggered prospective guidance, not autonomous action execution. Work on strategic automaticity also distinguishes rapid cue-response activation from the controlled execution requirements of complex behavior.

BDI / AgentSpeak architectures similarly distinguish applicable plans from the eventual selected intention/action and environment execution. A plan being applicable is advisory deliberation state, not proof that its action is feasible, selected, or successful.

Engineering synthesis:

```text
committed prior-turn plan
+ bounded current character-facing context
-> cue applicability decision
-> bounded advisory response guidance
-> existing world_action_proposer
-> existing Character Brain action choice
-> existing causal adjudication / Phase62K world commit
```

## 3. No new durable store

Phase69C is a read-only prepare-time projection. It adds no event store, history, revision log, or mutation queue entry.

The authoritative durable sources remain:

- Phase69A formation history;
- Phase69B revision history;
- Phase68D source-goal state.

Only plans whose effective Phase69B state is `active` or `challenged` may be considered. Suspended, abandoned, superseded, or source-goal-inactive plans are excluded.

## 4. Resolver boundary

The optional programmatic hook is:

```text
implementationIntentionCueActivationResolver
```

It receives a detached bounded view containing:

- opaque per-view `plan_ref` tokens;
- plan cue descriptor;
- plan response descriptor;
- reconsideration state;
- bounded current Character-facing perception;
- bounded working context / attention;
- bounded subjective cognition/self-model context already approved for the Character Brain.

It does not receive:

- raw World State;
- raw World Event;
- engine IDs/hashes;
- raw memory store or unretrieved memories;
- hidden retrieval graph;
- causal feasibility labels;
- action IDs;
- mutation proposals;
- utility/priority/probability/confidence scores.

The resolver may return only zero or more exact `plan_ref` values that it judges cue-applicable in the supplied bounded context. Unknown/duplicate refs fail closed.

Missing resolver means no Phase69C activation guidance; it does not imply every plan is active.

## 5. Activation projection

Phase69C returns a bounded `ImplementationIntentionActivationProjection` containing only activated plans:

```text
{
  if_cue,
  then_response,
  reconsideration_state,
  cue_applicable: true,
  advisory_only: true,
  selected_action_authority: false
}
```

No engine ID/hash, source goal ID, plan identity, or revision identity is exposed downstream.

Activation ordering is deterministic transport order only and is not ranking, utility, or truth precedence.

## 6. Action-proposer integration

During `prepareWorldSimulationTurn`, Phase69C runs after the bounded cognition packet has been assembled and before `world_action_proposer`.

The action proposer receives:

```text
cognition.implementation_intention_guidance
```

This guidance may inform candidate generation only. The proposer still cannot select the final action. The Character Brain still chooses only among available candidate intents, and the causal engine still exclusively determines outcomes.

Phase69C never manufactures an `action_id`, bypasses `available_actions`, or submits an action.

## 7. Temporal boundary

Only committed prior-turn Phase69A/69B state is eligible.

Phase69C must fail closed if same-turn formation or revision history exists for the character before projection. A plan formed/revised during resolve cannot retroactively influence the action proposal that preceded that resolve.

## 8. Explicit non-goals

Phase69C does not implement:

- action selection or execution;
- causal feasibility checking;
- execution success/failure monitoring;
- plan-tree / HTN decomposition;
- scheduler timestamps;
- numeric activation strength;
- utility or priority ranking;
- reinforcement learning;
- autonomous plan revision;
- raw semantic similarity search over memory;
- a second retrieval engine;
- Character Brain durable writes.

## 9. Acceptance contract

Acceptance requires:

- read-only derived activation; no durable Phase69C state;
- committed prior-turn effective Phase69B plans only;
- active/challenged plans eligible; suspended/abandoned/superseded/inactive excluded;
- detached bounded resolver view;
- opaque plan refs only at resolver boundary;
- unknown/duplicate resolver refs rejected;
- no raw World State/event/memory store;
- no engine IDs/hashes downstream;
- no executable action IDs or mutation authority;
- no feasibility/world-truth oracle;
- no numeric activation/utility/priority/probability/confidence;
- action proposer receives advisory guidance only;
- Character Brain action-selection boundary preserved;
- causal adjudicator and Phase62K authority preserved;
- deterministic replay and input immutability;
- same-turn contamination fails closed.

## 10. Testing policy

Use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. Avoid `affected` when global runner inputs would merely expand to full `all` without additional evidence value.
