import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionContract,
  worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion,
} from "../../server/src/world-simulation-retrieval-conditioned-memory-interpretation-reentry-adoption-service.mjs";
import { fixture } from "../phase85/phase85-memory-interpretation-fixture.mjs";

const character = "Alice";
const sourceMemoryId = "Aliceold";
const recoveredDescription = "Alice saw the door open.";

const initial = fixture(character);
Object.assign(initial, {
  simulation_time: "2026-09-14T01:00:00+08:00",
  world_rules: { default_vision_range_m: 30 },
  event_queue: [{
    event_id: "phase87b-native-retrieval",
    type: "reconsider_locked_door",
    scene_id: "scene87b",
    participants: [character],
  }],
  scenes: {
    scene87b: {
      scene_id: "scene87b",
      dimensions: { width_m: 10, depth_m: 10 },
      entity_positions: {
        Alice: { x: 0, y: 0 },
        Door: { x: 3, y: 0 },
      },
      visibility_profiles: {
        Alice: {
          facing_degrees: 0,
          horizontal_fov_degrees: 120,
          eye_height_m: 1.6,
          illumination_thresholds_lux: {
            silhouette_min_lux: 1,
            dim_min_lux: 5,
            clear_min_lux: 20,
          },
        },
      },
      perception_labels_by: {
        Alice: { Door: "Alice sees the same door again." },
      },
      obstacles: [],
      lighting: { ambient_lux: 30 },
      sound_events: [],
      auditory_labels_by: {},
    },
  },
  characters: {
    Alice: { current_action: "observe", known: [] },
  },
  objects: { Door: {} },
  available_actions: {
    Alice: [{ action_id: "wait", intent: "Observe before acting" }],
  },
});

const originalSourceMemory = structuredClone(
  initial.memories[character].find((memory) => memory.memory_id === sourceMemoryId),
);
const originalInterpretationHistory = structuredClone(
  initial.memory_reconsolidation_interpretation_update_history,
);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase87b-${process.pid}-${Date.now()}`,
);

const resolverInputs = [];
const brainInputs = [];
const memoryRetrievalResolver = async (input) => {
  resolverInputs.push(structuredClone(input));
  return {
    process_occurred: true,
    initiation: {
      mode: "deliberate",
      trigger_origin: "self_generated",
    },
    retrieval_task: { mode: "cued_recall" },
    target: {
      kind: "memory_content",
      memory_id: sourceMemoryId,
      requested_selectors: [{ kind: "json_pointer", path: "/description" }],
    },
    contacted_candidate_refs: [sourceMemoryId],
    recovered_selections: [{
      source_memory_ref: sourceMemoryId,
      selector: { kind: "json_pointer", path: "/description" },
      content_kind: "detail",
      target_relation: "target_related",
    }],
  };
};

const causalAdjudicator = async (input) => {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: "phase87b-noop-resolution",
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [{
      actor: character,
      action_id: "wait",
      result: "observed",
      causal_evidence: "Phase87B fixture intentionally performs no hard-state change.",
    }],
    knowledge_transitions: [],
    scheduled_events: [],
  };
};

const common = {
  fixtureRoot,
  memoryRetrievalResolver,
  causalAdjudicator,
};

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "Phase87B retrieval-conditioned interpretation native adoption",
    seed: "phase87b",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, { fixtureRoot });
  const sessionId = session.world_simulation_session_id;

  const prepared = await prepareWorldSimulationTurn({
    world_simulation_session_id: sessionId,
    event_id: "phase87b-native-retrieval",
  }, common);

  assert.equal(prepared.memory_retrieval_processes.length, 1);
  assert.equal(
    prepared.retrieval_conditioned_memory_interpretation_adoptions.length,
    1,
    "Successful Phase63C retrieval must create one engine-side Phase87B adoption record.",
  );
  const adoption = prepared.retrieval_conditioned_memory_interpretation_adoptions[0];
  assert.equal(
    adoption.version,
    worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion,
  );
  assert.equal(adoption.source_projection_version.includes("phase87a"), true);
  assert.equal(adoption.character_view.interpretation_count, 1);
  assert.deepEqual(adoption.character_view.interpretations, [{
    prior_interpretation: "Alice believed the door was usually open.",
    later_interpretation: "Alice now suspects access is restricted 0",
    relation: "challenges",
    retrieval_conditioned: true,
    subjective_not_world_truth: true,
    original_memory_preserved: true,
    belief_adoption_implied: false,
  }]);

  const packet = prepared.decision_packets[0];
  const packetView = packet.cognition.retrieval_conditioned_memory_interpretation;
  assert.deepEqual(
    packetView,
    adoption.character_view,
    "Decision packet cognition must preserve the exact sanitized Runtime-owned Phase87B view used before Action Proposer.",
  );
  assert.equal(
    packet.boundaries.retrieval_conditioned_memory_interpretation_native_adoption_installed,
    true,
  );
  assert.equal(
    packet.boundaries.retrieval_conditioned_memory_interpretation_engine_lineage_exposed,
    false,
  );
  assert.equal(
    packet.boundaries.retrieval_conditioned_memory_interpretation_same_turn_phase85e_feedback_allowed,
    false,
  );

  const finalIngress = buildWorldSimulationCharacterBrainInput(packet);
  assert.deepEqual(
    finalIngress.cognition.retrieval_conditioned_memory_interpretation,
    packetView,
    "Direct and formal Character Brain ingress share the same single-source packet cognition projector.",
  );
  const characterFacingSerialized = JSON.stringify(
    finalIngress.cognition.retrieval_conditioned_memory_interpretation,
  );
  for (const forbidden of [
    sourceMemoryId,
    "memory_id",
    "source_memory_ref",
    "retrieval_event_id",
    "retrieval_event_hash",
    "memory_recovery_id",
    "claim_event_id",
    "relation_event_id",
    "projection_hash",
    "world_state_hash",
    "state_revision",
  ]) {
    assert.equal(
      characterFacingSerialized.includes(forbidden),
      false,
      `Character Brain must not receive Phase87B private lineage: ${forbidden}`,
    );
  }

  const beforeTamperedResolveState = await getWorldSimulationState(sessionId, { fixtureRoot });
  const tamperedPrepared = structuredClone(prepared);
  tamperedPrepared.retrieval_conditioned_memory_interpretation_adoptions[0]
    .source_retrieval_event_hash = "0".repeat(64);
  await assert.rejects(
    () => resolveWorldSimulationTurn(
      tamperedPrepared,
      { Alice: "wait" },
      common,
    ),
    (error) => error?.code
      === "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_PERSISTENCE_MISMATCH",
    "Resolve must fail closed when prepare-time preview RetrievalEvent hash differs from canonical Phase63C persistence.",
  );
  assert.deepEqual(
    await getWorldSimulationState(sessionId, { fixtureRoot }),
    beforeTamperedResolveState,
    "Failed Phase87B lineage validation must not commit world state.",
  );

  const turn = await runWorldSimulationTurn({
    world_simulation_session_id: sessionId,
    event_id: "phase87b-native-retrieval",
  }, {
    ...common,
    characterBrain: async (brainInput) => {
      brainInputs.push(structuredClone(brainInput));
      assert.deepEqual(
        brainInput.cognition.retrieval_conditioned_memory_interpretation,
        packetView,
      );
      assert.equal(
        JSON.stringify(brainInput.cognition.retrieval_conditioned_memory_interpretation)
          .includes(sourceMemoryId),
        false,
      );
      return { action_id: "wait" };
    },
  });

  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);
  assert.equal(resolverInputs.length >= 2, true);
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.prepared_adoption_count,
    1,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.adopted_interpretation_count,
    1,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.persistence_lineage_verified,
    true,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.engine_lineage_forwarded_to_character_brain,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.memory_rewrite_performed,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.retrieval_strength_mutated,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.storage_strength_mutated,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.belief_revision_performed,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.action_selected,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.world_truth_authority_exposed,
    false,
  );
  assert.equal(
    turn.retrieval_conditioned_memory_interpretation_adoption.same_turn_phase85e_interpretation_feedback_allowed,
    false,
  );

  const finalState = await getWorldSimulationState(sessionId, { fixtureRoot });
  const finalSourceMemory = finalState.state.memories[character]
    .find((memory) => memory.memory_id === sourceMemoryId);
  assert.deepEqual(
    finalSourceMemory.content,
    originalSourceMemory.content,
    "Phase87B must not rewrite the source memory content.",
  );
  assert.deepEqual(
    finalState.state.memory_reconsolidation_interpretation_update_history,
    originalInterpretationHistory,
    "Phase87B must not append or rewrite interpretation history merely because it re-entered cognition.",
  );

  const history = await getWorldSimulationHistory(sessionId, { fixtureRoot });
  const committedSummary = history.turns.at(-1)
    .retrieval_conditioned_memory_interpretation_adoption;
  assert.deepEqual(committedSummary, turn.retrieval_conditioned_memory_interpretation_adoption);
  const committedSummarySerialized = JSON.stringify(committedSummary);
  for (const forbidden of [
    sourceMemoryId,
    "source_retrieval_event_id",
    "source_retrieval_event_hash",
    "source_projection_hash",
  ]) {
    assert.equal(
      committedSummarySerialized.includes(forbidden),
      false,
      `Committed Phase87B summary must stay bounded and omit private lineage: ${forbidden}`,
    );
  }

  const contract = buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionContract();
  assert.equal(contract.phase, "Phase87B");
  assert.equal(contract.source_projection_owner, "Phase87A");
  assert.equal(contract.deterministic_phase63c_persistence_preview_required, true);
  assert.equal(contract.resolve_time_persistence_lineage_revalidation_required, true);
  assert.equal(contract.character_view_sanitized, true);
  assert.equal(contract.retrieval_event_identity_exposed, false);
  assert.equal(contract.action_selection_authority, false);
  assert.equal(contract.belief_revision_authority, false);
  assert.equal(contract.memory_rewrite_authority, false);
  assert.equal(contract.retrieval_strength_authority, false);
  assert.equal(contract.storage_strength_authority, false);
  assert.equal(contract.world_truth_authority, false);
  assert.equal(contract.same_turn_phase85e_interpretation_feedback_allowed, false);
  assert.equal(
    brainInputs[0].cognition.working_context.active_context
      .some((item) => JSON.stringify(item).includes(recoveredDescription))
      || JSON.stringify(brainInputs[0].cognition.working_context.focus).includes(recoveredDescription),
    true,
    "The ordinary Phase63C recovered memory still enters Current Mind independently of Phase87B interpretation adoption.",
  );
} finally {
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Phase87B retrieval-conditioned memory interpretation native adoption: PASS");
