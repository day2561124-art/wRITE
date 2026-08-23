# World Simulation Timeline Refinement — Phase62H

Phase62H refines the Phase62G global causal clock without transferring outcome authority to the character brain.

## Scope

- A nonfatal injury that happens strictly before a later combat/projectile/ability execution point can slow that later execution according to the persistent `combat_multiplier` produced by the injury layer.
- The refinement is recomputed to a fixed point because changing a later execution time can change downstream contacts.
- Projectile collisions inside one physics window are scheduled globally by collision timestamp instead of by object insertion order.
- A cover object destroyed at an earlier timestamp becomes non-colliding for projectiles that reach that location later in the same turn.
- Exact-timestamp projectile collision candidates are retained as simultaneous candidates; one same-time mutation does not retroactively erase another collision that was already due at that timestamp.
- Refined execution times and rate adjustments are persisted inside the frozen causal timeline history.

## Authority boundary

The character brain still submits intent only. It cannot decide injury multipliers, revised execution timestamps, cover destruction, projectile collision order, penetration, or whether a later trajectory sees an already-destroyed obstacle.

## Known boundary

Phase62H v1 does not yet stop an actor halfway along an already-started movement path when an injury occurs mid-motion, and it does not explode continuous ability-field damage into global microticks. Those require a later continuous actor-state scheduler rather than a narrative shortcut.
