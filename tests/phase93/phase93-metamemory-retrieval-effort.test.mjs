import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationMetamemoryRetrievalEffortContract,
  projectWorldSimulationMetamemoryRetrievalEffort,
  worldSimulationMetamemoryRetrievalEffortVersion,
} from "../../server/src/world-simulation-metamemory-retrieval-effort-service.mjs";

function project(overrides = {}) {
  return projectWorldSimulationMetamemoryRetrievalEffort({
    query_id: "phase93-query",
    character: "千夜",
    step_index: 0,
    cumulative_target_outcome_after_step: "unresolved",
    recovered_memories_this_step: [],
    recovery_occurrences_this_step: [],
    available_reinstatement_cues: [],
    ...overrides,
  });
}

const contract = buildWorldSimulationMetamemoryRetrievalEffortContract();
assert.equal(contract.version, worldSimulationMetamemoryRetrievalEffortVersion);
assert.equal(contract.phase, "Phase93");
assert.equal(contract.cue_familiarity_or_partial_access_may_support_feeling_of_knowing, true);
assert.equal(contract.failed_recall_can_coexist_with_feeling_of_knowing, true);
assert.equal(contract.feeling_of_knowing_is_memory_truth, false);
assert.equal(contract.feeling_of_knowing_is_recall_probability, false);
assert.equal(contract.target_presence_in_hidden_memory_inspected, false);
assert.equal(contract.unrecovered_memory_content_inspected, false);
assert.equal(contract.non_contacted_candidate_identity_inspected, false);
assert.equal(contract.technical_step_budget_used_as_effort_evidence, false);
assert.equal(contract.actual_completed_search_steps_used_as_effort_evidence, true);
assert.equal(contract.continuation_authority_replaced, false);
assert.equal(contract.stop_authority_replaced, false);
assert.equal(contract.cue_selection_authority_replaced, false);
assert.equal(contract.numeric_confidence_or_probability_modeled, false);

const input = {
  query_id: "phase93-input",
  character: "千夜",
  step_index: 0,
  cumulative_target_outcome_after_step: "unresolved",
  recovered_memories_this_step: [],
  recovery_occurrences_this_step: [],
  available_reinstatement_cues: [],
};
const before = hashAgentRunValue(input);
const empty = projectWorldSimulationMetamemoryRetrievalEffort(input);
assert.equal(hashAgentRunValue(input), before, "Phase93 must not mutate caller input.");
assert.equal(empty.character_view.accessibility_experience, "access_uncertain");
assert.equal(empty.character_view.feeling_of_knowing, "no_positive_feeling_of_knowing_evidence");
assert.equal(empty.character_view.retrieval_effort, "initial_attempt");
assert.equal(empty.character_view.partial_or_related_information_available, false);
assert.equal(empty.character_view.target_recovered, false);
assert.equal(empty.character_view.subjective_not_memory_truth, true);
assert.equal(empty.audit.hidden_memory_presence_checked, false);
assert.equal(empty.audit.technical_step_budget_used, false);
assert.equal(empty.audit.continuation_decision_made, false);
assert.equal(Object.isFrozen(empty.character_view), true);

const partial = project({
  step_index: 1,
  recovered_memories_this_step: [{ content: "只想起一小段相關內容" }],
});
assert.equal(partial.character_view.accessibility_experience, "partial_or_related_access");
assert.equal(partial.character_view.feeling_of_knowing, "felt_accessible_despite_incomplete_recall");
assert.equal(partial.character_view.retrieval_effort, "sustained_search");
assert.equal(partial.character_view.partial_or_related_information_available, true);
assert.equal(partial.character_view.target_recovered, false);

const cueOnly = project({
  step_index: 2,
  available_reinstatement_cues: [{ cue_option_id: "cue-1", cue: { kind: "scene", value: "走廊" } }],
});
assert.equal(cueOnly.character_view.feeling_of_knowing, "felt_accessible_despite_incomplete_recall");
assert.equal(cueOnly.character_view.retrieval_effort, "extended_search");
assert.equal(cueOnly.audit.grounded_reinstatement_cue_count_observed, 1);

const partialTarget = project({
  step_index: 2,
  cumulative_target_outcome_after_step: "partially_satisfied",
  recovered_memories_this_step: [{ content: "只想起目標的一部分" }],
});
assert.equal(partialTarget.character_view.accessibility_experience, "partial_or_related_access");
assert.equal(partialTarget.character_view.feeling_of_knowing, "felt_accessible_despite_incomplete_recall");
assert.equal(partialTarget.character_view.target_recovered, false);

const recovered = project({
  step_index: 3,
  cumulative_target_outcome_after_step: "satisfied",
  recovered_memories_this_step: [{ content: "目標記憶" }],
});
assert.equal(recovered.character_view.accessibility_experience, "target_accessed");
assert.equal(recovered.character_view.feeling_of_knowing, "not_applicable_target_recovered");
assert.equal(recovered.character_view.target_recovered, true);
assert.equal(recovered.character_view.retrieval_effort, "extended_search");

assert.deepEqual(project(JSON.parse(JSON.stringify({
  step_index: 1,
  recovery_occurrences_this_step: [{ recovery_occurrence_id: "occ-1" }],
}))), project({
  step_index: 1,
  recovery_occurrences_this_step: [{ recovery_occurrence_id: "occ-1" }],
}), "Phase93 projection must be deterministic.");

assert.throws(() => projectWorldSimulationMetamemoryRetrievalEffort({}), (error) =>
  error?.code === "WORLD_SIMULATION_METAMEMORY_RETRIEVAL_EFFORT_INPUT_INVALID");
assert.throws(() => project({ step_index: -1 }), (error) =>
  error?.code === "WORLD_SIMULATION_METAMEMORY_RETRIEVAL_EFFORT_INPUT_INVALID");

for (const forbidden of [
  "memory_id",
  "candidate_id",
  "technical_step_budget",
  "recall_probability",
  "confidence",
]) {
  assert.equal(
    JSON.stringify(partial.character_view).includes(forbidden),
    false,
    `${forbidden} must not leak into the Phase93 character view.`,
  );
}

const retrievalSource = await readFile(
  "server/src/world-simulation-memory-retrieval-multistep-service.mjs",
  "utf8",
);
const projectionIndex = retrievalSource.indexOf("const metamemoryRetrievalEffort =");
const continuationIndex = retrievalSource.indexOf("const continuationResolution =", projectionIndex);
assert.ok(projectionIndex >= 0, "Phase93 projection must be installed in the native retrieval loop.");
assert.ok(continuationIndex > projectionIndex, "Metamemory monitoring must occur before continuation control.");
assert.match(retrievalSource, /metamemory:\s*\r?\n\s*cloneJson\(\s*\r?\n\s*metamemoryRetrievalEffort\.character_view/);
assert.match(retrievalSource, /metamemory_retrieval_effort_projection_hash:/);
assert.match(retrievalSource, /phase93_technical_step_budget_used_as_effort_signal:\s*\r?\n\s*false/);
assert.match(retrievalSource, /phase93_continuation_decision_authority:\s*\r?\n\s*false/);

const persistenceSource = await readFile(
  "server/src/world-simulation-memory-retrieval-persistence-service.mjs",
  "utf8",
);
assert.match(persistenceSource, /metamemory_retrieval_effort:/);
assert.match(persistenceSource, /metamemory_retrieval_effort_projection_hash:/);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationMemoryRetrievalPersistence/);
assert.match(loopSource, /subjective_memory_retrieval_persistence/);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(stateSource, /subjective_memory_retrieval_persistence/);
assert.match(stateSource, /subjective_memory_retrieval_mutation_queue/);
assert.match(stateSource, /subjective_memory_retrieval_mutation_execution/);

console.log("Phase93 metamemory + retrieval effort: PASS");
