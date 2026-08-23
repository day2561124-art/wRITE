# Phase62G — Unified Global Causal Timeline

Phase62G adds a programmatic, turn-relative causal timeline above the existing spatial, melee-combat, and continuous-physics layers.

The purpose is not to give narrative code more authority. It is to make cross-layer ordering explicit when two different causal systems act in the same turn.

## Authority

- Character Brain chooses intent only.
- Spatial rules validate movement, doors, and object interactions.
- Combat rules calculate melee contact, defense, damage, and injury.
- Continuous physics calculates projectile launch/collision and ability-field physics.
- The global timeline orders cross-layer point events and can preempt a later action when its actor was already incapacitated by a strictly earlier programmatic event.

A character cannot choose `hit`, `miss`, `damage`, `incapacitated`, `collision`, or timeline precedence as an outcome.

## Phase62G v1 ordering

The timeline uses turn-relative milliseconds. It currently unifies these point events:

- melee contact;
- defense start;
- projectile launch;
- projectile collision/resolution;
- ability activation;
- programmatic action preemption caused by earlier incapacitation.

Exact timestamp ties are treated as simultaneous for preemption: an incapacitation at exactly the same timestamp does not erase the other event retroactively. Stable programmatic tie-breaking only makes the record deterministic.

## Fixed-point arbitration

Cross-layer previews are recomputed after a preemption. This prevents a later action that was removed from continuing to create downstream preview effects. The iteration terminates when the suppressed action set stops changing.

Example:

1. projectile contact at 112.5 ms incapacitates a melee attacker;
2. that attack was scheduled to make contact at 300 ms;
3. the attack is preempted;
4. previews are recomputed without that attack;
5. the final causal layers resolve using the same suppressed action set.

The inverse is also enforced: a melee contact at 100 ms can incapacitate a shooter before a projectile launch scheduled for 300 ms, preventing the launch and its ammunition consumption.

## Historical record

Every committed world-simulation turn now stores `causal_timeline` in `world_history.json`, including:

- ordered entries;
- suppressed action ids;
- arbitration iteration count;
- a deterministic timeline hash.

This belongs to historical truth. Galgame playback may select from it later but may not rewrite it.

## Deliberate boundary

Phase62G v1 does **not** claim that every continuous mutation has been converted into one microscopic event queue. The following remain delegated to their existing causal layers:

- nonfatal injury changing an actor's speed midway through a still-running same-turn action;
- scene-topology changes being replayed into every other already-started same-turn trajectory at the exact destruction timestamp;
- ability-field damage being split into arbitrarily small global microticks.

Those cases need later timeline refinement. Phase62G's guarantee is narrower and explicit: cross-layer point-event order is recorded, and strictly earlier programmatic incapacitation preempts later attack/defense/projectile/ability execution.
