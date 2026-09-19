import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationFamiliarityRecognitionSourceMonitoringContract,
  projectWorldSimulationFamiliarityRecognitionSourceMonitoring,
  worldSimulationFamiliarityRecognitionSourceMonitoringVersion,
} from "../../server/src/world-simulation-familiarity-recognition-source-monitoring-service.mjs";

function project(overrides = {}) {
  return projectWorldSimulationFamiliarityRecognitionSourceMonitoring({
    query_id: "phase94-query",
    character: "千夜",
    step_index: 0,
    recovered_memories_this_step: [],
    metamemory_retrieval_effort: {
      accessibility_experience: "access_uncertain",
      feeling_of_knowing: "no_positive_feeling_of_knowing_evidence",
      partial_or_related_information_available: false,
    },
    retrieval_task_mode: "unspecified",
    source_query: null,
    ...overrides,
  });
}

const contract =
  buildWorldSimulationFamiliarityRecognitionSourceMonitoringContract();

assert.equal(
  contract.version,
  worldSimulationFamiliarityRecognitionSourceMonitoringVersion,
);
assert.equal(contract.phase, "Phase94");
assert.equal(contract.familiarity_distinct_from_recollection, true);
assert.equal(contract.familiarity_without_recollected_detail_supported, true);
assert.equal(contract.familiarity_requires_recognition_context, true);
assert.equal(contract.feeling_of_knowing_is_not_familiarity, true);
assert.equal(contract.familiarity_is_world_truth, false);
assert.equal(contract.familiarity_implies_person_known, false);
assert.equal(contract.recollection_requires_recovered_character_visible_detail, true);
assert.equal(contract.source_query_supported, true);
assert.deepEqual(contract.source_dimensions, ["kind", "actor", "sense"]);
assert.equal(
  contract.source_attribution_uses_recollected_character_visible_features_only,
  true,
);
assert.equal(contract.source_uncertainty_supported, true);
assert.equal(contract.source_confusion_can_force_uncertainty, true);
assert.equal(contract.hidden_internal_provenance_inspected, false);
assert.equal(contract.unrecovered_memory_content_inspected, false);
assert.equal(contract.non_contacted_candidate_identity_inspected, false);
assert.equal(contract.numeric_source_confidence_modeled, false);
assert.equal(contract.source_attribution_is_world_truth, false);
assert.equal(contract.memory_content_rewritten, false);
assert.equal(contract.continuation_authority_replaced, false);

const input = {
  query_id: "phase94-input",
  character: "千夜",
  step_index: 0,
  recovered_memories_this_step: [],
  metamemory_retrieval_effort: {
    accessibility_experience: "access_uncertain",
    feeling_of_knowing: "no_positive_feeling_of_knowing_evidence",
    partial_or_related_information_available: false,
  },
  source_query: null,
};
const before = hashAgentRunValue(input);
const empty = projectWorldSimulationFamiliarityRecognitionSourceMonitoring(input);
assert.equal(
  hashAgentRunValue(input),
  before,
  "Phase94 must not mutate caller input.",
);
assert.equal(
  empty.character_view.recognition_mode,
  "insufficient_positive_recognition_evidence",
);
assert.equal(
  empty.character_view.familiarity_experience,
  "no_positive_familiarity_evidence",
);
assert.equal(empty.character_view.recollected_detail_available, false);
assert.equal(empty.character_view.familiarity_not_world_truth, true);
assert.equal(empty.character_view.familiarity_does_not_establish_identity, true);
assert.equal(empty.character_view.source_certainty, "not_queried");
assert.equal(empty.character_view.source_attribution, null);
assert.equal(empty.audit.hidden_internal_provenance_checked, false);
assert.equal(empty.audit.numeric_source_confidence_modeled, false);
assert.equal(Object.isFrozen(empty.character_view), true);

const familiarityOnly = project({
  step_index: 1,
  retrieval_task_mode: "recognition",
  metamemory_retrieval_effort: {
    accessibility_experience: "partial_or_related_access",
    feeling_of_knowing: "felt_accessible_despite_incomplete_recall",
    partial_or_related_information_available: true,
  },
  source_query: {
    dimensions: ["kind", "sense"],
  },
});
assert.equal(
  familiarityOnly.character_view.recognition_mode,
  "familiarity_without_recollected_detail",
);
assert.equal(
  familiarityOnly.character_view.familiarity_experience,
  "familiar_without_recollected_detail",
);
assert.equal(familiarityOnly.character_view.recollected_detail_available, false);
assert.equal(familiarityOnly.character_view.source_certainty, "uncertain");
assert.equal(
  familiarityOnly.character_view.source_status,
  "uncertain_familiarity_without_source_recollection",
);
assert.equal(familiarityOnly.character_view.source_attribution, null);
assert.deepEqual(
  familiarityOnly.character_view.source_uncertainty_reasons,
  ["familiarity_does_not_supply_source_detail"],
);

const fokOutsideRecognition = project({
  step_index: 1,
  retrieval_task_mode: "cued_recall",
  metamemory_retrieval_effort: {
    accessibility_experience: "partial_or_related_access",
    feeling_of_knowing: "felt_accessible_despite_incomplete_recall",
    partial_or_related_information_available: true,
  },
});
assert.equal(
  fokOutsideRecognition.character_view.recognition_mode,
  "insufficient_positive_recognition_evidence",
);
assert.equal(
  fokOutsideRecognition.character_view.familiarity_experience,
  "partial_access_not_promoted_to_familiarity_outside_recognition_context",
);
assert.equal(
  fokOutsideRecognition.character_view.recollected_detail_available,
  false,
);

const recollected = project({
  step_index: 2,
  recovered_memories_this_step: [
    {
      content: { person: "某個熟悉的人", place: "走廊" },
      content_kind: "whole_memory",
      target_relation: "target_related",
      source: {
        kind: "direct_perception",
        actor: "同學A",
        sense: "visual",
      },
      source_confused: false,
      possibly_incorrect: false,
    },
  ],
  metamemory_retrieval_effort: {
    accessibility_experience: "target_accessed",
    feeling_of_knowing: "not_applicable_target_recovered",
    partial_or_related_information_available: true,
  },
  source_query: {
    dimensions: ["kind", "actor", "sense"],
  },
});
assert.equal(
  recollected.character_view.recognition_mode,
  "recollection_with_recovered_detail",
);
assert.equal(
  recollected.character_view.familiarity_experience,
  "familiarity_not_used_as_substitute_for_recollection",
);
assert.equal(recollected.character_view.recollected_detail_available, true);
assert.equal(recollected.character_view.source_certainty, "available");
assert.equal(
  recollected.character_view.source_status,
  "source_attribution_available_from_recollected_features",
);
assert.deepEqual(recollected.character_view.source_attribution, {
  kind: "direct_perception",
  actor: "同學A",
  sense: "visual",
});
assert.deepEqual(recollected.character_view.source_uncertainty_reasons, []);
assert.equal(recollected.character_view.source_attribution_not_world_truth, true);

const defaultSourceDimensions = project({
  recovered_memories_this_step: [
    {
      content: "記得這段是親眼看到的",
      target_relation: "target_related",
      source: {
        kind: "direct_perception",
        actor: "同學A",
        sense: "visual",
      },
    },
  ],
  source_query: {},
});
assert.deepEqual(
  defaultSourceDimensions.character_view.source_query_dimensions,
  ["kind", "actor", "sense"],
);
assert.equal(defaultSourceDimensions.character_view.source_certainty, "available");

const confused = project({
  recovered_memories_this_step: [
    {
      content: "記得有人跟我說過",
      target_relation: "target_related",
      source: {
        kind: "direct_perception",
        actor: "同學A",
        sense: "auditory",
      },
      source_confused: true,
    },
  ],
  source_query: {
    dimensions: ["actor"],
  },
});
assert.equal(confused.character_view.source_certainty, "uncertain");
assert.equal(
  confused.character_view.source_status,
  "uncertain_source_confusion_present",
);
assert.equal(confused.character_view.source_confusion_observed, true);
assert.ok(
  confused.character_view.source_uncertainty_reasons.includes(
    "recollected_memory_marked_source_confused",
  ),
);

const conflicting = project({
  recovered_memories_this_step: [
    {
      content: "片段一",
      target_relation: "target_related",
      source: { actor: "同學A" },
    },
    {
      content: "片段二",
      target_relation: "target_related",
      source: { actor: "同學B" },
    },
  ],
  source_query: {
    dimension: "actor",
  },
});
assert.equal(conflicting.character_view.source_certainty, "uncertain");
assert.equal(conflicting.character_view.source_attribution.actor, null);
assert.deepEqual(
  conflicting.character_view.source_uncertainty_reasons,
  ["conflicting_recollected_source_actor"],
);

const missing = project({
  recovered_memories_this_step: [
    {
      content: "只記得內容，不記得誰說的",
      target_relation: "target_related",
      source: {
        kind: "direct_perception",
        sense: "auditory",
      },
    },
  ],
  source_query: {
    dimension: "actor",
  },
});
assert.equal(missing.character_view.source_certainty, "uncertain");
assert.deepEqual(
  missing.character_view.source_uncertainty_reasons,
  ["missing_recollected_source_actor"],
);

const targetPreferred = project({
  recovered_memories_this_step: [
    {
      content: "目標片段",
      target_relation: "target_related",
      source: { actor: "目標來源" },
    },
    {
      content: "非目標片段",
      target_relation: "non_target",
      source: { actor: "其他來源" },
    },
  ],
  source_query: {
    dimension: "actor",
  },
});
assert.equal(targetPreferred.character_view.source_certainty, "available");
assert.equal(
  targetPreferred.character_view.source_attribution.actor,
  "目標來源",
  "Target-related recollection should anchor source monitoring when available.",
);

assert.deepEqual(
  project(JSON.parse(JSON.stringify({
    step_index: 1,
    recovered_memories_this_step: [{
      content: "同一內容",
      target_relation: "target_related",
      source: { kind: "direct_perception", sense: "visual" },
    }],
    source_query: { dimensions: ["kind", "sense"] },
  }))),
  project({
    step_index: 1,
    recovered_memories_this_step: [{
      content: "同一內容",
      target_relation: "target_related",
      source: { kind: "direct_perception", sense: "visual" },
    }],
    source_query: { dimensions: ["kind", "sense"] },
  }),
  "Phase94 projection must be deterministic.",
);

assert.throws(
  () => projectWorldSimulationFamiliarityRecognitionSourceMonitoring({}),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_MONITORING_INPUT_INVALID",
);
assert.throws(
  () => project({ step_index: -1 }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_MONITORING_INPUT_INVALID",
);
assert.throws(
  () => project({ source_query: { dimension: "internal_provenance" } }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_FAMILIARITY_RECOGNITION_SOURCE_QUERY_INVALID",
);

for (const forbidden of [
  "memory_id",
  "internal_provenance",
  "event_id",
  "scene_id",
  "confidence",
  "probability",
]) {
  assert.equal(
    JSON.stringify(recollected.character_view).includes(forbidden),
    false,
    `${forbidden} must not leak into the Phase94 character view.`,
  );
}

const retrievalSource = await readFile(
  "server/src/world-simulation-memory-retrieval-multistep-service.mjs",
  "utf8",
);
const phase93Index = retrievalSource.indexOf(
  "const metamemoryRetrievalEffort =",
);
const phase94Index = retrievalSource.indexOf(
  "const familiarityRecognitionSourceMonitoring =",
);
const continuationIndex = retrievalSource.indexOf(
  "const continuationResolution =",
  phase94Index,
);
assert.ok(phase93Index >= 0, "Phase93 monitoring must remain installed.");
assert.ok(
  phase94Index > phase93Index,
  "Phase94 recognition/source monitoring must consume bounded Phase93 evidence after Phase93 monitoring.",
);
assert.ok(
  continuationIndex > phase94Index,
  "Phase94 recognition/source monitoring must occur before existing continuation control.",
);
assert.match(
  retrievalSource,
  /recognition:\s*\r?\n\s*cloneJson\(\s*\r?\n\s*familiarityRecognitionSourceMonitoring\.character_view/,
);
assert.match(
  retrievalSource,
  /familiarity_recognition_source_monitoring_projection_hash:/,
);
assert.match(
  retrievalSource,
  /phase94_hidden_internal_provenance_inspected:\s*\r?\n\s*false/,
);
assert.match(
  retrievalSource,
  /phase94_numeric_source_confidence_modeled:\s*\r?\n\s*false/,
);
assert.match(
  retrievalSource,
  /phase94_source_attribution_world_truth:\s*\r?\n\s*false/,
);

const persistenceSource = await readFile(
  "server/src/world-simulation-memory-retrieval-persistence-service.mjs",
  "utf8",
);
assert.match(
  persistenceSource,
  /familiarity_recognition_source_monitoring:/,
);
assert.match(
  persistenceSource,
  /familiarity_recognition_source_monitoring_projection_hash:/,
);

console.log("Phase94 familiarity / recognition / source monitoring: PASS");
