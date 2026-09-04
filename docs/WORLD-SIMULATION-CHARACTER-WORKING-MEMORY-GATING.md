# Character Runtime v4 — Selective Working-Memory Input Gating & Maintenance

## Purpose

Character Runtime v4 adds one narrow control boundary in front of the existing deterministic Current Mind attention resolver:

```text
Candidate existence
!= Current Mind admission
!= attention priority
!= source-memory mutation
```

v4 does not replace the v2 attention resolver and does not redesign Phase63 retrieval. It decides which Current Mind candidates are eligible to compete, which prior representations remain maintained, which new candidates are rejected, and which explicitly superseded Runtime-owned representations are cleared.

## Architecture

```text
bounded perception
Phase63C recovered recollection
committed Character Experience
current action
prior committed Current Mind
        ↓
Candidate Formation              [v2/v3]
        ↓
Attention Evidence / Bids        [v2]
        ↓
Selective Input Gate             [v4]
        ↓
Existing deterministic resolver  [v2]
        ↓
focus / active / peripheral
fading / suspended
        ↓
cognition.working_context
```

Authority remains:

- World / Perception systems own bounded perception.
- Phase63C owns whether recollection actually surfaced.
- Character Runtime owns Current Mind admission, maintenance, placement, and clear of Runtime-owned representations.
- Character Brain owns candidate action intent only.
- Character Brain / GPT does not author admission decisions.

## Gate outcomes

### `admit`

A fresh candidate has enough current support to enter Current Mind competition.

Strong admission evidence includes:

- immediate constraint / urgency;
- expectation violation;
- current goal / intention relevance;
- meaningful perceptual salience;
- the current action representation.

Admission is eligibility, not guaranteed focus.

### `maintain`

A candidate already present in prior committed Current Mind remains supported even if it was not newly observed this cycle.

Initial maintenance support is intentionally conservative:

- current focus continuity; or
- current goal / intention relevance.

This creates admission hysteresis: entering Current Mind requires stronger current evidence than keeping a still-supported prior representation.

### `reject`

A fresh candidate exists but lacks enough support for Current Mind admission.

For perception:

```text
reject
!= not perceived
```

The bounded perception remains available on the perception channel. Rejection only prevents a second Current Mind copy from entering `cognition.working_context`.

### `clear`

An explicitly superseded Runtime-owned representation is removed from Current Mind.

v4 initially permits clear only for a narrow deterministic case: a prior `current_action` representation replaced by a different current action.

```text
clear Current Mind representation
!= forget source memory
!= mutate Phase63 memory
!= reconsolidation
```

### `decay`

A prior Current Mind item has no active maintenance support but remains inside the existing bounded deterministic decay window. It may continue through fading or suspended lifecycle handling but cannot compete as a newly admitted / actively maintained candidate.

`decay` preserves v2 lifecycle semantics and is not a new source-memory operation.

## Closed-by-default input gate

The v4 gate is closed by default for fresh candidates. Free peripheral budget is not itself sufficient admission evidence.

Therefore a low-salience irrelevant perception may remain in bounded perception while being absent from Current Mind.

This prevents Current Mind from becoming a second copy of all perceived content.

## Recollection boundary

Phase63C retrieval success means only that a recollection actually surfaced.

```text
Phase63C recovered
→ recollection candidate exists
→ v4 admission decision
→ existing attention competition
→ placement
```

Retrieval success does not imply:

- automatic admission;
- automatic active context;
- automatic focus;
- increased confidence;
- source-memory strengthening.

A rejected recollection cannot bypass v4 through raw `recovered_memories`; v3 single-semantic-exposure remains authoritative.

## Attention resolver reuse

v4 does not replace:

- perceptual salience evidence;
- goal / intention relevance evidence;
- expectation-violation evidence;
- urgency evidence;
- focus continuity;
- focus retention bonus;
- switching interruption cost;
- deterministic tie-break order;
- suspended / fading handling;
- simulation-time + committed-sequence decay.

Only `admit` and `maintain` candidates are eligible for focus competition. `decay` candidates may remain in decay lifecycle. `reject` and `clear` are excluded from Current Mind placement.

## Persistence and replay

The committed Current Mind transition persists engine-side admission decisions:

```text
candidate_id
source_kind
prior_presence
fresh
gate_outcome
reason_codes
```

These are provenance / reducer evidence and are not character-facing cognition.

Historical replay consumes the persisted historical Current Mind projection and `reducer_state_after` directly. Replay MUST NOT rerun the current admission algorithm.

A future v5+ gate policy cannot rewrite what a historical character had admitted, maintained, rejected, cleared, or decaying in the committed past.

## Character-facing boundary

Character Brain continues to receive the same canonical surface:

```text
cognition.working_context
```

Character Brain MUST NOT receive:

- candidate IDs;
- gate outcomes;
- admission reason codes;
- priority scores;
- source refs;
- reducer audit metadata.

v4 does not install output gating. There is no second semantic filter after `working_context` in this phase.

## Memory encoding boundary

Attention / admission provides evidence to programmatic encoding policy but does not command memory formation.

A perception rejected from Current Mind may still be eligible for independent Phase63 memory-encoding policy because:

```text
working-memory admission
!= memory encoding
```

Encoding evidence may identify the Current Mind processing level as `not_admitted`, but focus remains neither necessary nor sufficient for encoding.

## Initial deterministic policy

Precedence:

1. Explicitly superseded prior current action → `clear`.
2. Prior candidate with focus continuity or goal/intention support → `maintain`.
3. Fresh candidate with urgency, expectation violation, goal/intention support, meaningful perceptual salience, or current-action authority → `admit`.
4. Prior unsupported candidate still inside lifecycle window → `decay`.
5. Otherwise fresh unsupported candidate → `reject`.

The policy uses no neural scoring, random tie-break, wall clock, reinforcement learning, or LLM importance rating.

## Acceptance matrix

Required v4 assertions:

1. Low-salience irrelevant perception may be `reject` while remaining bounded perception.
2. Goal-relevant fresh perception is `admit`.
3. Urgent fresh perception is `admit` and may interrupt only through the existing resolver.
4. Prior goal-relevant content may be `maintain` without new perception refresh.
5. Free peripheral capacity does not automatically admit weak distractors.
6. Weak unrelated recovered memory is not guaranteed admission.
7. Relevant recovered memory may be admitted but is not guaranteed focus.
8. Superseded prior current action may be `clear`.
9. `clear` never mutates source memory.
10. Unsupported prior content uses bounded `decay`, not fresh admission.
11. Same input + same prior committed Current Mind yields identical admission decisions.
12. Failed / blocked / stale / rolled-back turns do not commit speculative v4 transitions.
13. Historical replay does not rerun the current admission algorithm.
14. Character Brain receives no private gating metadata.
15. v3 single-semantic recollection exposure remains intact.

## Explicitly out of scope

- output gating;
- Persistent Mind DB;
- source-memory deletion;
- forgetting policy;
- reconsolidation;
- retrieval-induced forgetting;
- belief dynamics;
- personality;
- emotion learning;
- needs dynamics;
- habits;
- skills;
- relationship learning;
- reflection;
- autonomous scheduler;
- local LLM;
- dialogue generation;
- learned / RL gate policy;
- LLM-authored importance scores;
- probabilistic admission.

## Invariants

```text
Perceived
!= admitted

Recovered
!= admitted

Admitted
!= focus

Maintained
!= refreshed

Clear Current Mind
!= forget memory

Historical committed gate decision
!= today's gate recomputation
```
