import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimConflictRevisions,
} from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  resolveWorldSimulationSubjectiveBeliefs,
} from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisions,
} from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefCharacterProjectionContract,
  projectWorldSimulationSubjectiveBeliefsForCharacter,
  worldSimulationSubjectiveBeliefCharacterMaxBeliefs,
  worldSimulationSubjectiveBeliefCharacterProjectionVersion,
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

const character = "伊萊亞斯・諾爾";
const otherCharacter = "柊木璃央";
const turnA = "world_turn_phase66c_a";
const turnB = "world_turn_phase66c_b";
const turnC = "world_turn_phase66c_c";
const propositionA =
  "阿灰的方向變化可能依賴伊萊亞斯的有意識指令。";
const propositionB =
  "阿灰可能在沒有明顯指令時自行調整移動方向。";

function memoryFixture(memoryId, turnId, description) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: {
      kind: "visual_observation",
      description,
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    internal_provenance: {
      event_id: `event_${memoryId}`,
      scene_id: "scene_phase66c",
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

function executeProjection(worldState, turnId, suffix, projection) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${suffix}`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: projection.result.preview_world_state,
    queue,
  });
  return {
    projection,
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

function executeClaim(worldState, turnId, memory, proposition, proposalRef) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim",
    buildWorldSimulationSubjectiveClaims({
      world_state: worldState,
      turn_id: turnId,
      source_memory_records: [
        {
          character,
          memory_record: memory,
        },
      ],
      claim_proposals: [
        {
          proposal_ref: proposalRef,
          character,
          proposition,
          evidence: [
            {
              source_memory_ref: memory.memory_id,
              relation: "supports",
            },
          ],
        },
      ],
    }),
  );
}

function executeRelation(
  worldState,
  turnId,
  sourceClaimEventId,
  targetClaimEventId,
  proposalRef,
) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim_relation",
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldState,
      turn_id: turnId,
      relation_proposals: [
        {
          proposal_ref: proposalRef,
          character,
          source_claim_event_id: sourceClaimEventId,
          target_claim_event_id: targetClaimEventId,
          relation: "supersedes",
        },
      ],
    }),
  );
}

function executeRevision(worldState, turnId) {
  const resolution = resolveWorldSimulationSubjectiveBeliefs({
    world_state: worldState,
    turn_id: turnId,
  });
  const revision = buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: worldState,
    turn_id: turnId,
    resolution: resolution.result,
  });
  return {
    resolution,
    ...executeProjection(
      worldState,
      turnId,
      "subjective_belief_revision",
      revision,
    ),
  };
}

const memoryA = memoryFixture(
  "memory_phase66c_a",
  turnA,
  "先前看見阿灰在伊萊亞斯抬手後改變方向。",
);
const memoryB = memoryFixture(
  "memory_phase66c_b",
  turnB,
  "後來看見阿灰在沒有明顯手勢時自行改變方向。",
);
const baseWorldState = {
  simulation_time: "2026-09-07T07:00:00+08:00",
  memories: {
    [character]: [memoryA, memoryB],
  },
};

const contract = buildWorldSimulationSubjectiveBeliefCharacterProjectionContract();
assert.equal(contract.version, worldSimulationSubjectiveBeliefCharacterProjectionVersion);
assert.equal(contract.phase, "Phase66C");
assert.equal(contract.status, "bounded_subjective_belief_character_exposure_installed");
assert.equal(contract.consumer_specific_read_dto, true);
assert.equal(contract.character_brain_exposure_installed, true);
assert.equal(contract.action_proposer_exposure_installed, true);
assert.equal(contract.nested_under_subjective_cognition, true);
assert.equal(contract.active_beliefs_exposed, true);
assert.equal(contract.superseded_beliefs_exposed, false);
assert.equal(contract.claim_identity_exposed, false);
assert.equal(contract.revision_identity_exposed, false);
assert.equal(contract.raw_evidence_exposed, false);
assert.equal(contract.world_truth_authority_exposed, false);
assert.equal(contract.confidence_probability_exposed, false);
assert.equal(contract.exact_text_deduplication_applied, true);
assert.equal(contract.semantic_equivalence_inference_applied, false);
assert.equal(contract.duplicate_active_claim_count_used_as_credibility, false);
assert.equal(contract.deterministic_sort_is_epistemic_precedence, false);
assert.equal(contract.max_beliefs, worldSimulationSubjectiveBeliefCharacterMaxBeliefs);
assert.equal(contract.same_turn_revision_feedback_allowed, false);
assert.equal(contract.same_turn_revision_contamination_policy, "fail_closed");
assert.equal(contract.as_of_revision_reconstruction_installed, false);
assert.equal(contract.projection_persistence_installed, false);
assert.equal(contract.world_state_mutation_allowed, false);

// Empty history remains an empty bounded view.
const empty = projectWorldSimulationSubjectiveBeliefsForCharacter({
  world_state: baseWorldState,
  character,
  current_turn_id: turnA,
});
assert.deepEqual(empty.character_view.beliefs, []);
assert.equal(empty.character_view.beliefs_truncated, false);

// Turn A: an evidence-backed unopposed claim is adopted and persisted by 66A.
const claimABuild = executeClaim(
  baseWorldState,
  turnA,
  memoryA,
  propositionA,
  "phase66c-claim-a",
);
const claimA = claimABuild.projection.result.claim_events_created[0];
assert.ok(claimA);
const revisionA = executeRevision(claimABuild.world_state, turnA);
assert.deepEqual(
  revisionA.resolution.result.decisions.map((decision) => decision.action),
  ["adopt"],
);

const priorTurnView = projectWorldSimulationSubjectiveBeliefsForCharacter({
  world_state: revisionA.world_state,
  character,
  current_turn_id: turnB,
});
assert.deepEqual(priorTurnView.character_view.beliefs, [
  {
    proposition: propositionA,
    commitment: "active",
    subjective_not_world_truth: true,
  },
]);
assert.equal(priorTurnView.audit.source_active_belief_count, 1);
assert.equal(priorTurnView.audit.projected_belief_count, 1);
assert.equal(priorTurnView.audit.world_state_mutated, false);

// Engine identities/provenance never enter the character-facing DTO.
const serializedPriorView = JSON.stringify(priorTurnView.character_view);
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
    serializedPriorView.includes(forbidden),
    false,
    `Phase66C character view must not expose ${forbidden}`,
  );
}

// The final Character Brain ingress projector preserves the bounded DTO.
const combinedSubjectiveCognition = {
  source: "committed_prior_turn_subjective_claim_history",
  claims: [],
  relations: [],
  unresolved_competing_claims_present: false,
  claims_truncated: false,
  relations_truncated: false,
  belief_source: priorTurnView.character_view.source,
  beliefs: priorTurnView.character_view.beliefs,
  beliefs_truncated: priorTurnView.character_view.beliefs_truncated,
};
const brainInput = buildWorldSimulationCharacterBrainInput({
  character,
  perception: {},
  retrieval_experience: {
    process_occurred: false,
    initiation_mode: null,
    target_outcome: null,
    recovered_any_content: false,
  },
  cognition: {
    working_context: {
      focus: null,
      active_context: [],
      peripheral_context: [],
      fading_context: [],
      suspended_context: [],
    },
    subjective_cognition: combinedSubjectiveCognition,
  },
  candidate_action_intents: [],
  boundaries: {
    recollection_reinstatement_v3_installed: true,
    selective_working_memory_output_gating_v5_installed: true,
    subjective_belief_character_projection_installed: true,
  },
});
assert.deepEqual(
  brainInput.cognition.subjective_cognition,
  combinedSubjectiveCognition,
);

// Exact duplicate propositions are collapsed at the character-facing boundary,
// so repeated claims cannot become an implicit credibility signal.
const duplicateClaimBuild = executeClaim(
  revisionA.world_state,
  turnB,
  memoryB,
  propositionA,
  "phase66c-duplicate-exact-claim",
);
const duplicateRevision = executeRevision(duplicateClaimBuild.world_state, turnB);
assert.deepEqual(
  duplicateRevision.resolution.result.decisions.map((decision) => decision.action),
  ["adopt"],
);
const deduped = projectWorldSimulationSubjectiveBeliefsForCharacter({
  world_state: duplicateRevision.world_state,
  character,
  current_turn_id: turnC,
});
assert.equal(deduped.audit.source_active_belief_count, 2);
assert.equal(deduped.audit.distinct_exact_proposition_count, 1);
assert.deepEqual(
  deduped.character_view.beliefs.map((belief) => belief.proposition),
  [propositionA],
);
assert.equal(deduped.audit.duplicate_active_claim_count_used_as_credibility, false);

// Same-turn revision contamination fails closed instead of pretending that a
// post-revision snapshot can be losslessly rewound for Character Brain.
assert.throws(
  () => projectWorldSimulationSubjectiveBeliefsForCharacter({
    world_state: duplicateRevision.world_state,
    character,
    current_turn_id: turnB,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_CHARACTER_PROJECTION_SAME_TURN_REVISION_PRESENT",
);

// A canonical supersession changes the engine read model, but Phase66C exposes
// only the surviving active belief and never forwards the superseded belief.
const claimBBuild = executeClaim(
  revisionA.world_state,
  turnB,
  memoryB,
  propositionB,
  "phase66c-claim-b",
);
const claimB = claimBBuild.projection.result.claim_events_created[0];
assert.ok(claimB);
const relationBuild = executeRelation(
  claimBBuild.world_state,
  turnB,
  claimB.claim_event_id,
  claimA.claim_event_id,
  "phase66c-supersede-a-with-b",
);
const supersessionRevision = executeRevision(relationBuild.world_state, turnB);
assert.deepEqual(
  supersessionRevision.resolution.result.decisions.map((decision) => decision.action),
  ["adopt", "supersede"],
);
const afterSupersession = projectWorldSimulationSubjectiveBeliefsForCharacter({
  world_state: supersessionRevision.world_state,
  character,
  current_turn_id: turnC,
});
assert.deepEqual(
  afterSupersession.character_view.beliefs.map((belief) => belief.proposition),
  [propositionB],
);
assert.equal(
  JSON.stringify(afterSupersession.character_view).includes(propositionA),
  false,
);
assert.equal(afterSupersession.audit.superseded_beliefs_exposed, false);

// Character isolation: another character cannot inherit this belief stream.
const otherView = projectWorldSimulationSubjectiveBeliefsForCharacter({
  world_state: supersessionRevision.world_state,
  character: otherCharacter,
  current_turn_id: turnC,
});
assert.deepEqual(otherView.character_view.beliefs, []);

// Native loop source ordering: Phase66C is built during prepare and merged into
// cognition before Action Proposer and Character Brain ingress.
const loopSource = await readFile(
  new URL(
    "../../server/src/world-simulation-loop-service.mjs",
    import.meta.url,
  ),
  "utf8",
);
for (const anchor of [
  "buildWorldSimulationSubjectiveBeliefCharacterProjectionContract",
  "projectWorldSimulationSubjectiveBeliefsForCharacter",
  "const subjectiveBeliefCharacterProjection =",
  "subjective_belief_character_projections:",
  "subjective_belief_character_projection_installed",
  "beliefs:",
]) {
  assert.ok(loopSource.includes(anchor), `native loop must contain ${anchor}`);
}
const characterProjectionIndex = loopSource.indexOf(
  "const subjectiveBeliefCharacterProjection =",
);
const actionProposerIndex = loopSource.indexOf(
  "const actionCandidates = await capability(",
  characterProjectionIndex,
);
assert.ok(characterProjectionIndex >= 0);
assert.ok(actionProposerIndex > characterProjectionIndex);
assert.ok(
  loopSource.slice(characterProjectionIndex, actionProposerIndex).includes(
    "subjectiveBeliefCharacterProjection.character_view.beliefs",
  ),
  "Phase66C beliefs must be merged into character cognition before Action Proposer",
);

// Native two-turn acceptance: the first turn forms/persists the belief after
// Character Brain has acted; only the second turn may observe it.
const nativeFixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase66c-belief-character-${process.pid}-${Date.now()}`,
);
const nativeOptions = { fixtureRoot: nativeFixtureRoot };
const nativeObserver = "phase66c-native-observer";
const nativeTarget = "phase66c-native-target";
const nativeSceneId = "phase66c-native-scene";
const nativeEventA = "phase66c-native-event-a";
const nativeEventB = "phase66c-native-event-b";
const nativeBeliefText =
  "眼前生物可能在沒有可見外部指令時自行改變移動方向。";

const nativeWorldState = {
  simulation_time: "2026-09-07T07:30:00+08:00",
  world_rules: {
    default_vision_range_m: 30,
  },
  event_queue: [
    {
      event_id: nativeEventA,
      type: "observe_possible_autonomy",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
    {
      event_id: nativeEventB,
      type: "reconsider_prior_observation",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
  ],
  scenes: {
    [nativeSceneId]: {
      scene_id: nativeSceneId,
      dimensions: {
        width_m: 10,
        depth_m: 10,
      },
      entity_positions: {
        [nativeObserver]: { x: 0, y: 0 },
        [nativeTarget]: { x: 3, y: 0 },
      },
      visibility_profiles: {
        [nativeObserver]: {
          facing_degrees: 0,
          horizontal_fov_degrees: 120,
          eye_height_m: 1.6,
          illumination_thresholds_lux: {
            silhouette_min_lux: 1,
            dim_min_lux: 5,
            clear_min_lux: 20,
          },
        },
        [nativeTarget]: {
          height_m: 1.0,
        },
      },
      perception_labels_by: {
        [nativeObserver]: {
          [nativeTarget]:
            "眼前生物在沒有新的可見手勢時改變了移動方向。",
        },
      },
      lighting: {
        ambient_lux: 30,
      },
      audibility_profiles: {
        [nativeObserver]: {
          minimum_audible_db: 30,
          localization_min_margin_db: 6,
          localization_sectors: 4,
        },
      },
      sound_events: [],
      auditory_labels_by: {
        [nativeObserver]: {},
      },
      obstacles: [],
    },
  },
  characters: {
    [nativeObserver]: {
      current_action: "持續觀察",
      known: [],
    },
    [nativeTarget]: {},
  },
  memories: {
    [nativeObserver]: [],
  },
  objects: {},
  available_actions: {
    [nativeObserver]: [
      {
        action_id: "continue-observing",
        intent: "維持位置並繼續觀察",
      },
    ],
  },
};

function nativeNoOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase66c-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [
      {
        actor: nativeObserver,
        action_id: "continue-observing",
        result: "continued_observing",
        causal_evidence: "Phase66C fixture changes only event queue consumption",
      },
    ],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

await rm(nativeFixtureRoot, { recursive: true, force: true });

try {
  const nativeSession = await beginWorldSimulationSession(
    {
      simulation_label: "Phase66C bounded subjective belief exposure fixture",
      seed: "phase66c-bounded-belief-exposure",
      rules: {
        event_driven: true,
        persistent_causality: true,
      },
      initial_world_state: nativeWorldState,
    },
    nativeOptions,
  );

  let claimResolverCallCount = 0;
  const brainSubjectiveViews = [];
  const subjectiveClaimResolver = async (input) => {
    claimResolverCallCount += 1;
    if (claimResolverCallCount !== 1) return [];
    const evidence = input.character_evidence[0].memories[0];
    return [
      {
        proposal_ref: "native-phase66c-belief",
        character: nativeObserver,
        proposition: nativeBeliefText,
        evidence: [
          {
            source_memory_ref: evidence.source_memory_ref,
            relation: "supports",
          },
        ],
      },
    ];
  };

  const characterBrain = async (packet) => {
    brainSubjectiveViews.push(
      structuredClone(packet.cognition?.subjective_cognition ?? null),
    );
    return {
      action_id: "continue-observing",
    };
  };

  const commonOptions = {
    ...nativeOptions,
    subjectiveClaimResolver,
    characterBrain,
    causalAdjudicator: nativeNoOpAdjudicator,
  };

  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeEventA,
    },
    commonOptions,
  );
  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.deepEqual(brainSubjectiveViews[0].beliefs, []);
  assert.equal(firstTurn.subjective_belief_revision.created_revision_event_count, 1);
  assert.equal(
    firstTurn.subjective_belief_character_projection
      .same_turn_revision_feedback_allowed,
    false,
  );

  const secondTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeEventB,
    },
    commonOptions,
  );
  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.deepEqual(brainSubjectiveViews[1].beliefs, [
    {
      proposition: nativeBeliefText,
      commitment: "active",
      subjective_not_world_truth: true,
    },
  ]);
  assert.equal(
    brainSubjectiveViews[1].belief_source,
    "committed_prior_turn_effective_subjective_belief_projection",
  );
  assert.equal(
    secondTurn.subjective_belief_character_projection.character_projection_count,
    1,
  );

  const nativeSerialized = JSON.stringify(brainSubjectiveViews[1]);
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
  ]) {
    assert.equal(nativeSerialized.includes(forbidden), false);
  }
  assert.equal(claimResolverCallCount, 2);
} finally {
  await rm(nativeFixtureRoot, { recursive: true, force: true });
}

console.log("Phase66C bounded subjective belief character exposure tests passed.");
