import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  projectWorldSimulationRetrievalPracticeActivation,
} from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";
import {
  projectWorldSimulationBaseLevelActivation,
} from "../../server/src/world-simulation-base-level-activation-projection-service.mjs";
import {
  projectWorldSimulationRetrievalInducedForgettingAccessibility,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";
import {
  projectWorldSimulationRetrievalInducedForgettingReexposureRecovery,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-reexposure-recovery-projection-service.mjs";
import {
  buildWorldSimulationRetrievalContextRevivalCandidateEvidence,
} from "../../server/src/world-simulation-retrieval-context-revival-candidate-evidence-service.mjs";
import {
  projectWorldSimulationRetrievalContextRevivalAccessibility,
} from "../../server/src/world-simulation-retrieval-context-revival-accessibility-projection-service.mjs";
import {
  buildWorldSimulationUnifiedMemoryAccessibilityProjectionContract,
  projectWorldSimulationUnifiedMemoryAccessibility,
  worldSimulationUnifiedMemoryAccessibilityProjectionVersion,
} from "../../server/src/world-simulation-unified-memory-accessibility-projection-service.mjs";

const character = "千夜";
const currentTurnId = "phase90b-current-turn";
const asOf = "2026-09-14T14:00:00+08:00";

function clone(value) {
  return structuredClone(value);
}

function fixture() {
  const memories = [
    {
      memory_id: "phase90b-memory-old-library",
      encoded_at: "2026-09-12T10:00:00+08:00",
      retrieval_cues: { scene_id: "library", sense: "visual" },
      source: { sense: "visual" },
      content: { detail: "old library memory" },
    },
    {
      memory_id: "phase90b-memory-new-library",
      encoded_at: "2026-09-14T12:00:00+08:00",
      retrieval_cues: { scene_id: "library", sense: "visual" },
      source: { sense: "visual" },
      content: { detail: "new library memory" },
    },
    {
      memory_id: "phase90b-memory-courtyard",
      encoded_at: "2026-09-14T11:00:00+08:00",
      retrieval_cues: { scene_id: "courtyard", sense: "visual" },
      source: { sense: "visual" },
      content: { detail: "courtyard memory" },
    },
  ];
  const worldState = {
    simulation_time: asOf,
    memory_plasticity_events: {},
    memory_plasticity_history: [],
    retrieval_events: {},
    retrieval_induced_forgetting_events: {},
    retrieval_induced_forgetting_history: [],
  };
  const retrievalPractice = projectWorldSimulationRetrievalPracticeActivation({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: memories,
  });
  const baseLevel = projectWorldSimulationBaseLevelActivation({
    memory_records: memories,
    retrieval_practice_projection: retrievalPractice,
  });
  const cueProbeInput = {
    world_state: worldState,
    character,
    memory_records: baseLevel.projected_memory_records,
    simulation_time: asOf,
    scene_id: "library",
    perception: {
      character,
      scene_id: "library",
      observed: [],
      audible: [],
      other_senses: [],
    },
    context_cues: {},
    retrieval_context: {},
  };
  const activeCues = [
    { kind: "spatial_context", value: "library", source: "current_environment" },
  ];
  const rif = projectWorldSimulationRetrievalInducedForgettingAccessibility({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: baseLevel.projected_memory_records,
    current_active_cues: activeCues,
    retrieval_practice_activation_projection: retrievalPractice,
  });
  const reexposure = projectWorldSimulationRetrievalInducedForgettingReexposureRecovery({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: baseLevel.projected_memory_records,
    phase83b_projection: rif,
  });
  const revivalEvidence = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: baseLevel.projected_memory_records,
  });
  const revival = projectWorldSimulationRetrievalContextRevivalAccessibility({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: asOf,
    memory_records: baseLevel.projected_memory_records,
    phase83b_projection: rif,
    phase83c_projection: reexposure,
    phase84a_evidence: revivalEvidence,
  });
  const accessibilityInput = {
    ...cueProbeInput,
    memory_records: revival.projected_memory_records,
  };
  return {
    memories,
    worldState,
    retrievalPractice,
    baseLevel,
    rif,
    reexposure,
    revivalEvidence,
    revival,
    accessibilityInput,
  };
}

function project(source, overrides = {}) {
  return projectWorldSimulationUnifiedMemoryAccessibility({
    character,
    current_turn_id: currentTurnId,
    accessibility_input: source.accessibilityInput,
    retrieval_practice_activation_projection: source.retrievalPractice,
    base_level_activation_projection: source.baseLevel,
    retrieval_induced_forgetting_accessibility_projection: source.rif,
    retrieval_induced_forgetting_reexposure_recovery_projection: source.reexposure,
    retrieval_context_revival_accessibility_projection: source.revival,
    ...overrides,
  });
}

const contract = buildWorldSimulationUnifiedMemoryAccessibilityProjectionContract();
assert.equal(contract.phase, "Phase90B");
assert.equal(contract.single_memory_strength_created, false);
assert.equal(contract.new_scalar_accessibility_score_created, false);
assert.equal(contract.phase63b_diagnostic_score_preserved_as_diagnostic_only, true);
assert.equal(contract.candidate_membership_owner, "Phase63B");
assert.equal(contract.actual_retrieval_process_owner, "Phase63C");
assert.equal(contract.source_memory_content_mutated, false);
assert.equal(contract.persistent_memory_order_mutated, false);
assert.deepEqual(contract.composition_order, [
  "retrieval_practice",
  "base_level_time_and_use_history",
  "bounded_rif_suppression",
  "exact_reexposure_recovery",
  "explicit_context_revival_recovery",
  "phase63b_current_query_cue_accessibility",
]);

const source = fixture();
const originalMemories = clone(source.memories);
const unified = project(source);
assert.equal(unified.version, worldSimulationUnifiedMemoryAccessibilityProjectionVersion);
assert.equal(unified.audit.source_lineage_verified, true);
assert.equal(unified.audit.final_ephemeral_order_matches_phase84b, true);
assert.equal(unified.audit.single_memory_strength_created, false);
assert.equal(unified.audit.new_scalar_accessibility_score_created, false);
assert.equal(unified.audit.current_accessibility_claimed_as_successful_retrieval, false);
assert.equal(unified.audit.world_truth_authority_claimed, false);
assert.deepEqual(
  unified.final_ephemeral_memory_ids,
  source.revival.projected_memory_ids,
  "Phase90B must preserve the Phase84B final ephemeral order before Phase63B candidate filtering",
);
assert.deepEqual(
  unified.projected_memory_records,
  source.revival.projected_memory_records,
  "Phase90B must not rewrite memory content while unifying accessibility",
);
assert.deepEqual(source.memories, originalMemories, "Phase90B must not mutate the source memories");
assert.equal(unified.accessibility_evidence.length, source.memories.length);
assert.ok(
  unified.accessibility_evidence.every((entry) => entry.base_level_evidence !== null),
  "all timed fixture memories should retain base-level provenance",
);
assert.ok(
  unified.accessibility_evidence.every((entry) => entry.source_signals.includes("base_level_time_and_use_history")),
  "Phase90B should expose base-level provenance as a source signal rather than one combined strength",
);
assert.equal(
  unified.memory_accessibility_query.result.accessibility_boundary.current_accessibility_is_not_successful_retrieval,
  true,
);
assert.equal(
  unified.memory_accessibility_query.result.accessibility_boundary.scalar_accessibility_score_is_literal_human_psychometric_measurement,
  false,
);

const tamperedRevival = clone(source.revival);
tamperedRevival.source_phase83c_projection_id = "tampered-phase83c-projection";
assert.throws(
  () => project(source, {
    retrieval_context_revival_accessibility_projection: tamperedRevival,
  }),
  (error) => error?.code === "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_LINEAGE_MISMATCH",
);

const reorderedInput = clone(source.accessibilityInput);
reorderedInput.memory_records.reverse();
assert.throws(
  () => project(source, { accessibility_input: reorderedInput }),
  (error) => error?.code === "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_LINEAGE_MISMATCH",
  "a caller may not bypass Phase84B by supplying a different final memory order",
);

const wrongTurnRetrievalPractice = clone(source.retrievalPractice);
wrongTurnRetrievalPractice.current_turn_id = "different-turn";
assert.throws(
  () => project(source, {
    retrieval_practice_activation_projection: wrongTurnRetrievalPractice,
  }),
  (error) => error?.code === "WORLD_SIMULATION_UNIFIED_MEMORY_ACCESSIBILITY_CONTEXT_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const phase84bIndex = loopSource.indexOf("projectWorldSimulationRetrievalContextRevivalAccessibility({");
const phase90bIndex = loopSource.indexOf("projectWorldSimulationUnifiedMemoryAccessibility({");
const cueDiagnosticIndex = loopSource.indexOf(
  "projectWorldSimulationCueDiagnosticEvidence({",
  phase90bIndex,
);
assert.ok(phase84bIndex >= 0 && phase90bIndex > phase84bIndex);
assert.ok(cueDiagnosticIndex > phase90bIndex, "Phase90B must own the final Phase63B query before cue diagnostics");
assert.match(
  loopSource,
  /const memoryAccessibilityQuery =\s*unifiedMemoryAccessibilityProjection\s*\.memory_accessibility_query;/,
);
assert.match(loopSource, /unified_memory_accessibility_projection:/);
assert.match(loopSource, /worldSimulationUnifiedMemoryAccessibilityProjectionVersion/);

console.log("Phase90B unified memory accessibility projection: PASS");
