import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationMutationExecutorVersion,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisions,
  buildWorldSimulationSubjectiveBeliefRevisionContract,
} from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationEffectiveSubjectiveBeliefProjectionContract,
  projectWorldSimulationEffectiveSubjectiveBeliefs,
} from "../../server/src/world-simulation-effective-subjective-belief-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefCharacterProjectionContract,
  projectWorldSimulationSubjectiveBeliefsForCharacter,
} from "../../server/src/world-simulation-subjective-belief-character-projection-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const observer = "phase66d-native-observer";
const target = "phase66d-native-target";
const sceneId = "phase66d-native-scene";
const eventA = "phase66d-native-event-a";
const eventB = "phase66d-native-event-b";
const eventC = "phase66d-native-event-c";
const propositionA =
  "眼前生物的方向變化可能依賴可見的外部指令。";
const propositionB =
  "眼前生物可能在沒有可見外部指令時自行改變移動方向。";

// Phase66D is a closure phase. It must not redefine Phase66A/B/C semantics;
// it seals their native chronology and integration boundaries together.
const revisionContract = buildWorldSimulationSubjectiveBeliefRevisionContract();
const effectiveContract =
  buildWorldSimulationEffectiveSubjectiveBeliefProjectionContract();
const characterContract =
  buildWorldSimulationSubjectiveBeliefCharacterProjectionContract();

assert.equal(revisionContract.phase, "Phase66A");
assert.equal(revisionContract.append_only_history_required, true);
assert.equal(
  revisionContract.authoritative_mutation_owner,
  worldSimulationMutationExecutorVersion,
);
assert.equal(revisionContract.same_turn_character_brain_feedback_allowed, false);
assert.equal(revisionContract.world_truth_authority_claimed, false);
assert.equal(revisionContract.confidence_probability_modeled, false);
assert.equal(revisionContract.last_write_wins_allowed, false);
assert.equal(
  revisionContract.deterministic_history_order_is_epistemic_precedence,
  false,
);

assert.equal(effectiveContract.phase, "Phase66B");
assert.equal(effectiveContract.event_store_remains_authoritative, true);
assert.equal(effectiveContract.projection_is_read_model, true);
assert.equal(effectiveContract.projection_is_rebuildable_from_event_history, true);
assert.equal(effectiveContract.projection_persistence_installed, false);
assert.equal(effectiveContract.projection_snapshot_is_authority, false);
assert.equal(effectiveContract.world_state_mutation_allowed, false);
assert.equal(effectiveContract.last_write_wins_allowed, false);
assert.equal(
  effectiveContract.deterministic_history_order_is_epistemic_precedence,
  false,
);
assert.equal(effectiveContract.world_truth_authority_claimed, false);
assert.equal(effectiveContract.confidence_probability_modeled, false);

assert.equal(characterContract.phase, "Phase66C");
assert.equal(characterContract.active_beliefs_exposed, true);
assert.equal(characterContract.superseded_beliefs_exposed, false);
assert.equal(characterContract.same_turn_revision_feedback_allowed, false);
assert.equal(characterContract.character_brain_may_mutate_belief_history, false);
assert.equal(characterContract.action_proposer_may_mutate_belief_history, false);
assert.equal(characterContract.world_truth_authority_exposed, false);
assert.equal(characterContract.confidence_probability_exposed, false);
assert.equal(characterContract.deterministic_sort_is_epistemic_precedence, false);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase66d-native-chronology-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

const initialWorldState = {
  simulation_time: "2026-09-07T14:15:00+08:00",
  world_rules: {
    default_vision_range_m: 30,
  },
  event_queue: [
    {
      event_id: eventA,
      type: "observe_directed_motion",
      scene_id: sceneId,
      participants: [observer],
    },
    {
      event_id: eventB,
      type: "observe_autonomous_motion",
      scene_id: sceneId,
      participants: [observer],
    },
    {
      event_id: eventC,
      type: "deliberate_after_revision_commit",
      scene_id: sceneId,
      participants: [observer],
    },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: {
        width_m: 10,
        depth_m: 10,
      },
      entity_positions: {
        [observer]: { x: 0, y: 0 },
        [target]: { x: 3, y: 0 },
      },
      visibility_profiles: {
        [observer]: {
          facing_degrees: 0,
          horizontal_fov_degrees: 120,
          eye_height_m: 1.6,
          illumination_thresholds_lux: {
            silhouette_min_lux: 1,
            dim_min_lux: 5,
            clear_min_lux: 20,
          },
        },
        [target]: {
          height_m: 1.0,
        },
      },
      perception_labels_by: {
        [observer]: {
          [target]: "眼前生物改變了移動方向。",
        },
      },
      lighting: {
        ambient_lux: 30,
      },
      audibility_profiles: {
        [observer]: {
          minimum_audible_db: 30,
          localization_min_margin_db: 6,
          localization_sectors: 4,
        },
      },
      sound_events: [],
      auditory_labels_by: {
        [observer]: {},
      },
      obstacles: [],
    },
  },
  characters: {
    [observer]: {
      current_action: "持續觀察",
      known: [],
    },
    [target]: {},
  },
  memories: {
    [observer]: [],
  },
  objects: {},
  available_actions: {
    [observer]: [
      {
        action_id: "continue-observing",
        intent: "維持位置並繼續觀察",
      },
    ],
  },
};

function noOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase66d-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [
      {
        actor: observer,
        action_id: "continue-observing",
        result: "continued_observing",
        causal_evidence: "Phase66D fixture changes only event queue consumption",
      },
    ],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

function assertBoundedBeliefView(view) {
  const serialized = JSON.stringify(view);
  for (const forbidden of [
    "claim_event_id",
    "claim_event_hash",
    "belief_revision_event_id",
    "belief_revision_event_hash",
    "source_resolution_decision",
    "source_memory_ref",
    "confidence",
    "probability",
    "world_truth_verified",
    "projection_hash",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `Phase66D bounded character view must not expose ${forbidden}`,
    );
  }
}

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession(
    {
      simulation_label: "Phase66D native belief chronology closure fixture",
      seed: "phase66d-native-belief-chronology-closure",
      rules: {
        event_driven: true,
        persistent_causality: true,
      },
      initial_world_state: initialWorldState,
    },
    options,
  );

  let claimResolverCallCount = 0;
  const brainSubjectiveViews = [];

  const subjectiveClaimResolver = async (input) => {
    claimResolverCallCount += 1;
    if (claimResolverCallCount > 2) return [];

    const evidence = input.character_evidence[0]?.memories[0];
    assert.ok(evidence?.source_memory_ref);
    const proposition = claimResolverCallCount === 1
      ? propositionA
      : propositionB;

    return [
      {
        proposal_ref: `phase66d-native-claim-${claimResolverCallCount}`,
        character: observer,
        proposition,
        evidence: [
          {
            source_memory_ref: evidence.source_memory_ref,
            relation: "supports",
          },
        ],
      },
    ];
  };

  const subjectiveClaimRelationResolver = async (input) => {
    const bucket = input.character_claims.find(
      (entry) => entry.character === observer,
    );
    if (!bucket || bucket.current_turn_claims.length !== 1) return [];

    const source = bucket.current_turn_claims[0];
    if (source.proposition !== propositionB) return [];
    const targetClaim = bucket.prior_claims.find(
      (claim) => claim.proposition === propositionA,
    );
    assert.ok(targetClaim, "Turn 2 must expose the prior canonical claim to the relation resolver");

    return [
      {
        proposal_ref: "phase66d-native-supersede-a-with-b",
        character: observer,
        source_claim_event_id: source.claim_event_id,
        target_claim_event_id: targetClaim.claim_event_id,
        relation: "supersedes",
      },
    ];
  };

  const characterBrain = async (packet) => {
    const subjective = structuredClone(
      packet.cognition?.subjective_cognition ?? null,
    );
    brainSubjectiveViews.push(subjective);
    assertBoundedBeliefView(subjective);
    return {
      action_id: "continue-observing",
    };
  };

  const commonOptions = {
    ...options,
    subjectiveClaimResolver,
    subjectiveClaimRelationResolver,
    characterBrain,
    causalAdjudicator: noOpAdjudicator,
  };

  // Turn 1: Character Brain cannot see the belief that will be created later
  // in this same turn. Phase65D -> 66A persists the adoption after Brain use.
  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventA,
    },
    commonOptions,
  );
  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.deepEqual(brainSubjectiveViews[0].beliefs, []);
  assert.equal(firstTurn.subjective_belief_resolution.decision_count, 1);
  assert.equal(firstTurn.subjective_belief_revision.created_revision_event_count, 1);
  assert.equal(
    firstTurn.subjective_belief_revision.authoritative_executor,
    worldSimulationMutationExecutorVersion,
  );
  assert.equal(
    firstTurn.subjective_belief_character_projection.same_turn_revision_feedback_allowed,
    false,
  );

  const afterFirst = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  const firstHistory = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(firstHistory.turns.length, 1);
  assert.equal(
    firstHistory.turns[0].subjective_belief_revision_mutation_execution
      .sole_final_world_state_writer,
    true,
  );

  const firstRevisionRef = structuredClone(
    afterFirst.state.subjective_belief_revision_history[0],
  );
  const firstRevisionEvent = structuredClone(
    afterFirst.state.subjective_belief_revision_events[
      firstRevisionRef.belief_revision_event_id
    ],
  );
  const firstClaim = Object.values(afterFirst.state.subjective_claim_events)
    .find((claim) => claim.proposition === propositionA);
  assert.ok(firstClaim);
  const firstClaimSnapshot = structuredClone(firstClaim);

  const effectiveAfterFirst = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: afterFirst.state,
    character: observer,
  });
  assert.deepEqual(
    effectiveAfterFirst.projection.active_beliefs.map((belief) => belief.proposition),
    [propositionA],
  );
  assert.deepEqual(effectiveAfterFirst.projection.superseded_beliefs, []);

  // Turn 2 prepare sees only prior-turn A. Later in the turn, B is created and
  // explicitly supersedes A. Neither B nor its revision may feed back to Brain.
  const secondTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventB,
    },
    commonOptions,
  );
  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.deepEqual(brainSubjectiveViews[1].beliefs, [
    {
      proposition: propositionA,
      commitment: "active",
      subjective_not_world_truth: true,
    },
  ]);
  assert.equal(secondTurn.subjective_belief_resolution.decision_count, 2);
  assert.equal(secondTurn.subjective_belief_revision.created_revision_event_count, 2);
  assert.equal(
    secondTurn.subjective_belief_revision.authoritative_executor,
    worldSimulationMutationExecutorVersion,
  );

  const afterSecond = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  const secondHistory = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(secondHistory.turns.length, 2);
  assert.equal(
    secondHistory.turns[1].subjective_belief_revision_mutation_execution
      .sole_final_world_state_writer,
    true,
  );

  // Old evidence/history is immutable even after effective belief switches.
  assert.deepEqual(
    afterSecond.state.subjective_belief_revision_history[0],
    firstRevisionRef,
  );
  assert.deepEqual(
    afterSecond.state.subjective_belief_revision_events[
      firstRevisionRef.belief_revision_event_id
    ],
    firstRevisionEvent,
  );
  assert.deepEqual(
    Object.values(afterSecond.state.subjective_claim_events)
      .find((claim) => claim.proposition === propositionA),
    firstClaimSnapshot,
  );

  const stateHashBeforeProjection = hashAgentRunValue(afterSecond.state);
  const effectiveAfterSecond = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: afterSecond.state,
    character: observer,
  });
  const effectiveReplay = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: afterSecond.state,
    character: observer,
  });
  assert.deepEqual(effectiveReplay, effectiveAfterSecond);
  assert.equal(hashAgentRunValue(afterSecond.state), stateHashBeforeProjection);
  assert.deepEqual(
    effectiveAfterSecond.projection.active_beliefs.map((belief) => belief.proposition),
    [propositionB],
  );
  assert.deepEqual(
    effectiveAfterSecond.projection.superseded_beliefs.map((belief) => belief.proposition),
    [propositionA],
  );
  assert.equal(
    effectiveAfterSecond.audit.deterministic_history_order_used_as_epistemic_precedence,
    false,
  );
  assert.equal(effectiveAfterSecond.audit.last_write_wins_applied, false);
  assert.equal(effectiveAfterSecond.audit.world_truth_fields_consumed, false);
  assert.equal(effectiveAfterSecond.audit.confidence_probability_modeled, false);
  assert.equal(effectiveAfterSecond.audit.persistent_projection_written, false);
  assert.equal(Object.hasOwn(afterSecond.state, "effective_subjective_beliefs"), false);
  assert.equal(
    Object.hasOwn(afterSecond.state, "effective_subjective_belief_projection"),
    false,
  );

  // Re-applying the exact already-committed Turn 2 resolution is append-idempotent.
  const replayedRevision = buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: afterSecond.state,
    turn_id: secondTurn.turn_id,
    resolution: secondHistory.turns[1].subjective_belief_resolution.result,
  });
  assert.equal(replayedRevision.result.revision_events_created.length, 0);
  assert.equal(replayedRevision.result.history_references_appended.length, 0);
  assert.equal(replayedRevision.result.state_transitions.length, 0);
  assert.equal(replayedRevision.result.already_persisted_revision_event_ids.length, 2);
  assert.deepEqual(replayedRevision.result.preview_world_state, afterSecond.state);

  // The derived bounded projection for the next turn contains only B and is
  // pure/replayable; superseded A is not part of practical cognition.
  const nextTurnView = projectWorldSimulationSubjectiveBeliefsForCharacter({
    world_state: afterSecond.state,
    character: observer,
    current_turn_id: "phase66d-next-turn-projection",
  });
  assert.deepEqual(nextTurnView.character_view.beliefs, [
    {
      proposition: propositionB,
      commitment: "active",
      subjective_not_world_truth: true,
    },
  ]);
  assert.equal(nextTurnView.audit.superseded_beliefs_exposed, false);
  assert.equal(nextTurnView.audit.world_state_mutated, false);
  assertBoundedBeliefView(nextTurnView.character_view);

  // Turn 3 finally exposes the Turn 2 committed effective belief. A no longer
  // appears in Character Brain practical cognition, while immutable history remains.
  const thirdTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventC,
    },
    commonOptions,
  );
  assert.equal(thirdTurn.ok, true);
  assert.equal(thirdTurn.committed, true);
  assert.deepEqual(brainSubjectiveViews[2].beliefs, [
    {
      proposition: propositionB,
      commitment: "active",
      subjective_not_world_truth: true,
    },
  ]);
  assert.equal(
    JSON.stringify(brainSubjectiveViews[2].beliefs).includes(propositionA),
    false,
    "superseded belief must leave the practical belief surface even though immutable Phase65C claim history remains visible in its own bounded claims channel",
  );
  assert.equal(claimResolverCallCount, 3);

  const afterThird = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  assert.deepEqual(
    afterThird.state.subjective_belief_revision_history[0],
    firstRevisionRef,
  );
  assert.deepEqual(
    afterThird.state.subjective_belief_revision_events[
      firstRevisionRef.belief_revision_event_id
    ],
    firstRevisionEvent,
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Phase66D native belief chronology closure tests passed.");
