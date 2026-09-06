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
  buildWorldSimulationSubjectiveCognitionProjectionContract,
  projectWorldSimulationSubjectiveCognition,
  worldSimulationSubjectiveCognitionMaxClaims,
  worldSimulationSubjectiveCognitionMaxRelations,
  worldSimulationSubjectiveCognitionProjectionVersion,
} from "../../server/src/world-simulation-subjective-cognition-projection-service.mjs";
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
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const character = "伊萊亞斯・諾爾";
const otherCharacter = "柊木璃央";
const turnA = "world_turn_phase65c_a";
const turnB = "world_turn_phase65c_b";
const turnOther = "world_turn_phase65c_other";
const nextTurn = "world_turn_phase65c_next";

function memoryFixture(characterName, memoryId, turnId, description) {
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
      scene_id: "scene_phase65c",
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
    character_hint_for_fixture_only: characterName,
  };
}

const memoryA = memoryFixture(
  character,
  "memory_phase65c_a",
  turnA,
  "先前看見阿灰在伊萊亞斯抬手後改變方向。",
);
const memoryB = memoryFixture(
  character,
  "memory_phase65c_b",
  turnB,
  "後來看見阿灰在沒有明顯手勢時自行改變方向。",
);
const otherMemory = memoryFixture(
  otherCharacter,
  "memory_phase65c_other",
  turnOther,
  "璃央看見場邊晶面反射出短暫亮光。",
);

const propositionA =
  "阿灰的方向變化可能依賴伊萊亞斯的有意識指令。";
const propositionB =
  "阿灰可能具有不依賴伊萊亞斯明顯有意識指令的自主行動能力。";
const otherProposition =
  "場邊晶面可能在特定角度產生明顯反光。";

const baseWorldState = {
  simulation_time: "2026-09-06T15:00:00+08:00",
  memories: {
    [character]: [memoryA, memoryB],
    [otherCharacter]: [otherMemory],
  },
};

function executeClaimProjection(
  worldState,
  characterName,
  turnId,
  memory,
  proposition,
  proposalRef,
) {
  const projection = buildWorldSimulationSubjectiveClaims({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [
      {
        character: characterName,
        memory_record: memory,
      },
    ],
    claim_proposals: [
      {
        proposal_ref: proposalRef,
        character: characterName,
        proposition,
        evidence: [
          {
            source_memory_ref: memory.memory_id,
            relation: "supports",
          },
        ],
      },
    ],
  });

  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_claim`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });

  return {
    projection,
    execution: executeWorldSimulationChronologicalMutationQueue({
      world_state: worldState,
      preview_world_state: projection.result.preview_world_state,
      queue,
    }),
  };
}

const firstClaimBuild = executeClaimProjection(
  baseWorldState,
  character,
  turnA,
  memoryA,
  propositionA,
  "phase65c-claim-a",
);
const otherClaimBuild = executeClaimProjection(
  firstClaimBuild.execution.next_world_state,
  otherCharacter,
  turnOther,
  otherMemory,
  otherProposition,
  "phase65c-claim-other",
);
const secondClaimBuild = executeClaimProjection(
  otherClaimBuild.execution.next_world_state,
  character,
  turnB,
  memoryB,
  propositionB,
  "phase65c-claim-b",
);

const claimA = firstClaimBuild.projection.result.claim_events_created[0];
const claimB = secondClaimBuild.projection.result.claim_events_created[0];
assert.ok(claimA);
assert.ok(claimB);

const relationProjection =
  buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: secondClaimBuild.execution.next_world_state,
    turn_id: turnB,
    relation_proposals: [
      {
        proposal_ref: "phase65c-challenge-a",
        character,
        source_claim_event_id: claimB.claim_event_id,
        target_claim_event_id: claimA.claim_event_id,
        relation: "challenges",
      },
    ],
  });

const relationQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turnB}:subjective_claim_relation`,
  world_state_hash:
    hashAgentRunValue(secondClaimBuild.execution.next_world_state),
  state_transitions: relationProjection.result.state_transitions,
  elapsed_ms: 0,
});
const relationExecution =
  executeWorldSimulationChronologicalMutationQueue({
    world_state: secondClaimBuild.execution.next_world_state,
    preview_world_state: relationProjection.result.preview_world_state,
    queue: relationQueue,
  });
const committedClaimState = relationExecution.next_world_state;

const contract = buildWorldSimulationSubjectiveCognitionProjectionContract();
assert.equal(contract.version, worldSimulationSubjectiveCognitionProjectionVersion);
assert.equal(contract.phase, "Phase65C");
assert.equal(contract.character_brain_exposure_installed, true);
assert.equal(contract.action_proposer_exposure_installed, true);
assert.equal(contract.same_turn_claim_feedback_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.semantic_conflict_resolution_modeled, false);
assert.equal(contract.belief_revision_applied, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.candidate_supersession_remains_candidate_only, true);
assert.equal(contract.unresolved_competing_claims_preserved, true);
assert.equal(contract.claim_history_mutation_allowed, false);
assert.equal(contract.relation_history_mutation_allowed, false);
assert.equal(contract.claim_evidence_exposed, false);
assert.equal(contract.claim_event_identity_exposed, false);
assert.equal(contract.relation_event_identity_exposed, false);
assert.equal(contract.max_claims, worldSimulationSubjectiveCognitionMaxClaims);
assert.equal(contract.max_relations, worldSimulationSubjectiveCognitionMaxRelations);

const stateSnapshot = structuredClone(committedClaimState);
const projection = projectWorldSimulationSubjectiveCognition({
  world_state: committedClaimState,
  character,
  current_turn_id: nextTurn,
});
assert.deepEqual(
  committedClaimState,
  stateSnapshot,
  "Phase65C read projection must not mutate authoritative world state",
);
assert.equal(projection.version, worldSimulationSubjectiveCognitionProjectionVersion);
assert.equal(projection.character, character);
assert.equal(projection.character_view.claims.length, 2);
assert.deepEqual(
  projection.character_view.claims.map((claim) => claim.proposition),
  [propositionA, propositionB],
);
assert.equal(projection.character_view.relations.length, 1);
assert.deepEqual(
  projection.character_view.relations[0],
  {
    relation: "challenges",
    source_proposition: propositionB,
    target_proposition: propositionA,
    candidate_relation_only: true,
    truth_resolution_applied: false,
  },
);
assert.equal(
  projection.character_view.unresolved_competing_claims_present,
  true,
);
assert.equal(projection.boundaries.same_character_only, true);
assert.equal(projection.boundaries.same_turn_claim_feedback_allowed, false);
assert.equal(
  projection.boundaries.world_truth_authority_exposed_to_character_brain,
  false,
);
assert.equal(
  projection.boundaries.claim_evidence_exposed_to_character_brain,
  false,
);

const serializedProjection = JSON.stringify(projection.character_view);
for (const forbidden of [
  "claim_event_id",
  "claim_event_hash",
  "relation_event_id",
  "relation_event_hash",
  "source_memory_ref",
  "source_memory_hash",
  "internal_provenance",
  "confidence",
  "probability",
  "world_truth_verified",
  turnA,
  turnB,
]) {
  assert.equal(
    serializedProjection.includes(forbidden),
    false,
    `Phase65C character view must not expose ${forbidden}`,
  );
}
assert.equal(serializedProjection.includes(otherProposition), false);

const sameTurnProjection = projectWorldSimulationSubjectiveCognition({
  world_state: committedClaimState,
  character,
  current_turn_id: turnB,
});
assert.deepEqual(
  sameTurnProjection.character_view.claims.map((claim) => claim.proposition),
  [propositionA],
  "same-turn claim must be structurally excluded from cognition",
);
assert.equal(sameTurnProjection.character_view.relations.length, 0);

const isolatedOtherProjection = projectWorldSimulationSubjectiveCognition({
  world_state: committedClaimState,
  character: otherCharacter,
  current_turn_id: nextTurn,
});
assert.deepEqual(
  isolatedOtherProjection.character_view.claims.map((claim) => claim.proposition),
  [otherProposition],
);
assert.equal(isolatedOtherProjection.character_view.relations.length, 0);
assert.equal(
  JSON.stringify(isolatedOtherProjection.character_view).includes(propositionA),
  false,
);

const tampered = structuredClone(committedClaimState);
tampered.subjective_claim_events[claimA.claim_event_id].proposition =
  "遭竄改的主觀說法";
assert.throws(
  () => projectWorldSimulationSubjectiveCognition({
    world_state: tampered,
    character,
    current_turn_id: nextTurn,
  }),
  (error) =>
    error?.code === "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HASH_MISMATCH",
);

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
    subjective_cognition: projection.character_view,
  },
  candidate_action_intents: [],
  boundaries: {
    recollection_reinstatement_v3_installed: true,
    selective_working_memory_output_gating_v5_installed: true,
    subjective_cognition_read_projection_installed: true,
  },
});
assert.deepEqual(
  brainInput.cognition.subjective_cognition,
  projection.character_view,
  "final Character Brain ingress must preserve the bounded Phase65C projection",
);

const loopSource = await readFile(
  new URL(
    "../../server/src/world-simulation-loop-service.mjs",
    import.meta.url,
  ),
  "utf8",
);
for (const anchor of [
  "projectWorldSimulationSubjectiveCognition",
  "const subjectiveCognitionProjection =",
  "subjective_cognition:",
  "subjective_cognition_read_projection_installed",
  "same_character_committed_prior_turn_claim_history_only",
]) {
  assert.ok(loopSource.includes(anchor), `native loop must contain ${anchor}`);
}
const cognitionProjectionIndex =
  loopSource.indexOf("const subjectiveCognitionProjection =");
const actionProposerIndex =
  loopSource.indexOf("const actionCandidates = await capability(", cognitionProjectionIndex);
assert.ok(cognitionProjectionIndex >= 0);
assert.ok(
  actionProposerIndex > cognitionProjectionIndex,
  "Phase65C projection must be injected before action proposal",
);

const nativeFixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase65c-subjective-cognition-${process.pid}-${Date.now()}`,
);
const nativeOptions = {
  fixtureRoot: nativeFixtureRoot,
};
const nativeObserver = "phase65c-native-observer";
const nativeTarget = "phase65c-native-target";
const nativeSceneId = "phase65c-native-scene";
const nativeFirstEventId = "phase65c-native-event-1";
const nativeSecondEventId = "phase65c-native-event-2";
const nativeThirdEventId = "phase65c-native-event-3";
const nativePriorClaimText =
  "眼前生物的移動可能依賴觀察者可見的外部指令。";
const nativeCurrentClaimText =
  "眼前生物可能在沒有可見外部指令時自行改變移動方向。";

const nativeWorldState = {
  simulation_time: "2026-09-06T15:30:00+08:00",
  world_rules: {
    default_vision_range_m: 30,
  },
  event_queue: [
    {
      event_id: nativeFirstEventId,
      type: "observe_possible_control",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
    {
      event_id: nativeSecondEventId,
      type: "observe_possible_autonomy",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
    {
      event_id: nativeThirdEventId,
      type: "consider_prior_observations",
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
    causal_resolution_id: `phase65c-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [
      {
        actor: nativeObserver,
        action_id: "continue-observing",
        result: "continued_observing",
        causal_evidence:
          "Phase65C fixture changes only event queue consumption",
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
      simulation_label: "Phase65C native subjective cognition fixture",
      seed: "phase65c-native-subjective-cognition",
      rules: {
        event_driven: true,
        persistent_causality: true,
      },
      initial_world_state: nativeWorldState,
    },
    nativeOptions,
  );

  let claimResolverCallCount = 0;
  let relationResolverCallCount = 0;
  const brainSubjectiveViews = [];

  const subjectiveClaimResolver = async (input) => {
    claimResolverCallCount += 1;
    if (claimResolverCallCount > 2) return [];
    const evidence = input.character_evidence[0].memories[0];
    return [
      {
        proposal_ref:
          claimResolverCallCount === 1
            ? "native-phase65c-prior-claim"
            : "native-phase65c-current-claim",
        character: nativeObserver,
        proposition:
          claimResolverCallCount === 1
            ? nativePriorClaimText
            : nativeCurrentClaimText,
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
    relationResolverCallCount += 1;
    if (relationResolverCallCount !== 2) return [];
    const bucket = input.character_claims[0];
    assert.equal(bucket.current_turn_claims.length, 1);
    assert.equal(bucket.prior_claims.length, 1);
    return [
      {
        proposal_ref: "native-phase65c-challenge",
        character: nativeObserver,
        source_claim_event_id: bucket.current_turn_claims[0].claim_event_id,
        target_claim_event_id: bucket.prior_claims[0].claim_event_id,
        relation: "challenges",
      },
    ];
  };

  const characterBrain = async (packet) => {
    const view = structuredClone(
      packet.cognition?.subjective_cognition
      ?? null,
    );
    brainSubjectiveViews.push(view);
    return {
      action_id: "continue-observing",
    };
  };

  const commonOptions = {
    ...nativeOptions,
    subjectiveClaimResolver,
    subjectiveClaimRelationResolver,
    characterBrain,
    causalAdjudicator: nativeNoOpAdjudicator,
  };

  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeFirstEventId,
    },
    commonOptions,
  );
  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.equal(
    firstTurn.subjective_cognition_read_projection
      .same_turn_claim_feedback_allowed,
    false,
  );
  assert.deepEqual(brainSubjectiveViews[0].claims, []);

  const secondTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeSecondEventId,
    },
    commonOptions,
  );
  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.deepEqual(
    brainSubjectiveViews[1].claims.map((claim) => claim.proposition),
    [nativePriorClaimText],
    "second turn may read only the first turn's already committed claim",
  );
  assert.equal(
    JSON.stringify(brainSubjectiveViews[1]).includes(nativeCurrentClaimText),
    false,
    "same-turn newly formed claim must not feed back into the second turn",
  );

  const thirdTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeThirdEventId,
    },
    commonOptions,
  );
  assert.equal(thirdTurn.ok, true);
  assert.equal(thirdTurn.committed, true);
  assert.deepEqual(
    brainSubjectiveViews[2].claims.map((claim) => claim.proposition),
    [nativePriorClaimText, nativeCurrentClaimText],
  );
  assert.equal(brainSubjectiveViews[2].relations.length, 1);
  assert.deepEqual(
    brainSubjectiveViews[2].relations[0],
    {
      relation: "challenges",
      source_proposition: nativeCurrentClaimText,
      target_proposition: nativePriorClaimText,
      candidate_relation_only: true,
      truth_resolution_applied: false,
    },
  );
  assert.equal(
    brainSubjectiveViews[2].unresolved_competing_claims_present,
    true,
  );

  const nativeSerialized = JSON.stringify(brainSubjectiveViews[2]);
  for (const forbidden of [
    "claim_event_id",
    "claim_event_hash",
    "relation_event_id",
    "relation_event_hash",
    "source_memory_ref",
    "confidence",
    "probability",
    "world_truth_verified",
  ]) {
    assert.equal(nativeSerialized.includes(forbidden), false);
  }

  assert.equal(claimResolverCallCount, 3);
  assert.equal(relationResolverCallCount, 3);

  const finalState = await getWorldSimulationState(
    nativeSession.world_simulation_session_id,
    nativeOptions,
  );
  assert.equal(
    Object.keys(finalState.state.subjective_claim_events).length,
    2,
  );
  assert.equal(
    Object.keys(finalState.state.subjective_claim_relation_events).length,
    1,
  );
} finally {
  await rm(nativeFixtureRoot, { recursive: true, force: true });
}

console.log("Phase65C subjective cognition read projection tests passed.");
