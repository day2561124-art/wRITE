# World Simulation Combat Causal Layer — Phase62E

Phase62E extends the Phase62D spatial causal rule engine with deterministic combat contact, defense, damage, and injury resolution.

The authority boundary stays strict:

- ChatGPT acting as a character may choose an attack, dodge, block, parry, or barrier intent from the bounded action candidates.
- The character brain may provide machine-readable intent parameters such as target, aim point, strike height, or defensive timing.
- The character brain may not declare a hit, miss, damage amount, injury, armor result, or barrier result.
- Only the programmatic combat causal layer reads world truth and turns simultaneous intents into combat outcomes.
- Persistence still occurs only through the Phase62C atomic world-state commit after the consistency critic accepts the transitions.

## Timing and motion

Every attack has a windup, active window, and recovery window. The contact sample is taken inside the active window. Existing physical injury can slow later attack timing through `physical_state.combat_multiplier`.

If the target selected a movement action in the same event and the Phase62D spatial rules validated that movement, the combat layer samples the target's interpolated position at attack-contact time. A dodge therefore works because the target is physically somewhere else when the attack trajectory arrives—not because GPT says "the dodge succeeds".

## Contact

The attack trajectory is constructed programmatically from the attacker's turn-start position toward the declared aim point or the target's turn-start position, bounded by the authoritative weapon/world range. Contact requires the target's sampled collision volume to intersect that trajectory.

Being in nominal range is therefore necessary but not sufficient for a hit.

## Defense and mitigation

A block/parry only participates when its defensive time window overlaps contact time. Any required blocking object must exist, be usable, and actually be held by the defender in the turn-start snapshot.

A barrier only participates when the referenced ability exists and is available in the defender's persisted character state. Persistent barrier capacity is consumed only after a resolved contact.

Body armor is read from persisted character/equipment state. Candidate prose cannot invent armor strength. Penetration can reduce flat armor absorption before fractional mitigation is applied.

## Injury persistence

Positive post-mitigation damage can update `physical_state.health_current`, append a causally sourced injury record, and reduce future movement/combat multipliers according to injury severity. If health reaches zero, the programmatic layer can mark the character incapacitated/immobilized.

This makes later turns depend on earlier combat instead of resetting combatants between events.

## Current limits

Phase62E v1 uses a deterministic 2D line-trajectory contact model plus a vertical strike-height band for coarse hit-region resolution. It does not yet model articulated limbs, continuous weapon meshes, projectile ballistics, grappling constraints, or multi-stage ability physics. Those require explicit later causal rules rather than narrative improvisation.
