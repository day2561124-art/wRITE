# World Simulation Causal Rule Engine — Phase62D

Phase62D gives the Phase62C event loop a built-in programmatic causal adjudicator.

The authority boundary is unchanged:

- ChatGPT character brain chooses an action intent from bounded candidate intents.
- Neural modules may perceive, retrieve memory, derive cognition, propose candidates, or diagnose consistency.
- Only the programmatic causal rule engine may turn selected intents into world-state effects.
- Persistence still occurs only through the Phase62C atomic world-state commit.

## Deterministic causal inputs

The rule engine reads only persisted world state, the queue-head event, and machine-readable fields already attached to the selected candidate action. Prose intent is logged but is not treated as a physics rule.

Phase62D v1 supports:

- bounded 2D scene coordinates;
- character movement speed and computed minimum travel duration;
- movement multipliers from physical/injury/fatigue state;
- route gates backed by persistent door state;
- rectangular obstacle path intersection;
- end-position collision checks;
- deterministic door open/close interactions;
- exclusive object holding, pickup/drop/transfer, reach checks, and simultaneous pickup contention;
- weapon-holder/usability checks for attack attempts;
- attack-range validation without pretending that range validity alone proves a hit;
- simulation-time advance by the longest resolved action duration in the turn;
- queue-head consumption and explicit follow-up event scheduling.

## Simultaneity rule

All same-turn action preconditions are evaluated from the state at the beginning of the turn. An action cannot retroactively make another simultaneous action legal. For example, opening a closed door during a turn does not allow another actor's same-turn movement through that door. A later event/turn can use the newly open door.

## Combat boundary

Phase62D does not equate `in range` with `hit`. The rule engine may establish whether an attack window is spatially valid and whether a required weapon is held and usable. Collision/contact, defensive motion, damage, injury, and combat timing need additional explicit causal rules before they may mutate world state.

## State and history

Every accepted effect is emitted as a state transition with a recorded cause. Every action result contains causal evidence. The consistency critic still runs before commit, and stale revision/hash checks still protect persistence.
