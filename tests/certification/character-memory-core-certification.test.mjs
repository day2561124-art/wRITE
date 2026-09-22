import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  phase90MemoryCoreIntegrationSteps,
  phase91AdaptiveMemoryConsolidationSteps,
  phase92MemoryReconsolidationLifecycleSteps,
  phase93MetamemoryRetrievalEffortSteps,
  phase94FamiliarityRecognitionSourceMonitoringSteps,
  phase95InterferenceBoundedMemoryDistortionSteps,
  phase96MemoryAffectLifecycleClosureSteps,
  characterMemoryCoreCertificationSteps,
  worldSimulationSteps,
  cognitionSteps,
  memoryRetrievalSteps,
} from "../test-suite-groups.mjs";
import { buildWorldSimulationSelectiveMemoryEncodingContract } from "../../server/src/world-simulation-selective-memory-encoding-service.mjs";
import { buildWorldSimulationUnifiedMemoryAccessibilityProjectionContract } from "../../server/src/world-simulation-unified-memory-accessibility-projection-service.mjs";
import { buildWorldSimulationAdaptiveMemoryConsolidationContract } from "../../server/src/world-simulation-adaptive-memory-consolidation-service.mjs";
import { buildWorldSimulationMemoryReconsolidationLifecycleContract } from "../../server/src/world-simulation-memory-reconsolidation-lifecycle-service.mjs";
import { buildWorldSimulationMetamemoryRetrievalEffortContract } from "../../server/src/world-simulation-metamemory-retrieval-effort-service.mjs";
import { buildWorldSimulationFamiliarityRecognitionSourceMonitoringContract } from "../../server/src/world-simulation-familiarity-recognition-source-monitoring-service.mjs";
import { buildWorldSimulationInterferenceBoundedMemoryDistortionContract } from "../../server/src/world-simulation-interference-bounded-memory-distortion-service.mjs";
import { buildWorldSimulationMemoryAffectLifecycleClosureContract } from "../../server/src/world-simulation-memory-affect-lifecycle-closure-service.mjs";

const certificationPath = "tests/certification/character-memory-core-certification.test.mjs";
const matrix = [
  [phase90MemoryCoreIntegrationSteps, ["tests/phase90/phase90a-selective-memory-encoding.test.mjs", "tests/phase90/phase90b-unified-memory-accessibility.test.mjs"]],
  [phase91AdaptiveMemoryConsolidationSteps, ["tests/phase91/phase91-adaptive-memory-consolidation.test.mjs"]],
  [phase92MemoryReconsolidationLifecycleSteps, ["tests/phase92/phase92-memory-reconsolidation-lifecycle.test.mjs"]],
  [phase93MetamemoryRetrievalEffortSteps, ["tests/phase93/phase93-metamemory-retrieval-effort.test.mjs"]],
  [phase94FamiliarityRecognitionSourceMonitoringSteps, ["tests/phase94/phase94-familiarity-recognition-source-monitoring.test.mjs"]],
  [phase95InterferenceBoundedMemoryDistortionSteps, ["tests/phase95/phase95-interference-bounded-memory-distortion.test.mjs"]],
  [phase96MemoryAffectLifecycleClosureSteps, ["tests/phase96/phase96-memory-affect-lifecycle-closure.test.mjs"]],
];
const phasePaths = matrix.flatMap(([steps, expected]) => {
  assert.deepEqual(steps.map(([, paths]) => paths[0]), expected);
  return expected;
});
assert.equal(new Set(phasePaths).size, phasePaths.length);
assert.deepEqual(
  characterMemoryCoreCertificationSteps.map(([, paths]) => paths[0]),
  [certificationPath],
);
for (const [name, steps] of Object.entries({
  world_simulation: worldSimulationSteps,
  cognition: cognitionSteps,
  memory_retrieval: memoryRetrievalSteps,
})) {
  const paths = steps.map(([, args]) => args[0]);
  assert.equal(
    paths.includes(certificationPath),
    false,
    name + " must defer certification to the explicit certification gate",
  );
  assert.equal(paths.filter(path => path === certificationPath).length, 0);
  for (const path of phasePaths) assert.ok(paths.includes(path), name + " missing " + path);
}
const runAll = await readFile("tests/run-all.mjs", "utf8");
for (const path of [...phasePaths, certificationPath]) {
  assert.ok(runAll.includes('"' + path + '"'), "full runner missing " + path);
}
const contracts = [
  buildWorldSimulationSelectiveMemoryEncodingContract(),
  buildWorldSimulationUnifiedMemoryAccessibilityProjectionContract(),
  buildWorldSimulationAdaptiveMemoryConsolidationContract(),
  buildWorldSimulationMemoryReconsolidationLifecycleContract(),
  buildWorldSimulationMetamemoryRetrievalEffortContract(),
  buildWorldSimulationFamiliarityRecognitionSourceMonitoringContract(),
  buildWorldSimulationInterferenceBoundedMemoryDistortionContract(),
  buildWorldSimulationMemoryAffectLifecycleClosureContract(),
];
assert.deepEqual(contracts.map(contract => contract.phase), [
  "Phase90A", "Phase90B", "Phase91", "Phase92", "Phase93", "Phase94", "Phase95", "Phase96",
]);
const checks = [
  ["attention_is_evidence_not_binary_memory_gate", true],
  ["single_memory_strength_modeled", false],
  ["single_memory_strength_created", false],
  ["source_memory_content_mutated", false],
  ["time_alone_can_establish_consolidated", false],
  ["consolidated_means_world_truth", false],
  ["original_memory_trace_preserved", true],
  ["canonical_memory_content_rewrite_allowed", false],
  ["unrecovered_memory_content_inspected", false],
  ["hidden_internal_provenance_inspected", false],
  ["generated_memory_content_allowed", false],
  ["stored_memory_content_rewritten", false],
  ["memory_content_rewritten", false],
  ["world_truth_authority", false],
];
for (const [key, expected] of checks) {
  const owners = contracts.filter(contract => Object.hasOwn(contract, key));
  assert.ok(owners.length, "certification invariant has no owning contract: " + key);
  for (const contract of owners) {
    assert.equal(contract[key], expected, contract.phase + "." + key);
  }
}
const affect = contracts.at(-1);
assert.equal(affect.same_character_current_turn_retrieval_required, true);
assert.equal(affect.actually_recovered_and_runtime_admitted_memory_required, true);
assert.equal(affect.mood_absence_does_not_invent_current_mood, true);
assert.equal(affect.source_uncertainty_cannot_be_cleared_by_affect, true);
assert.equal(affect.mood_congruence_or_incongruence_not_inferred, true);
assert.equal(affect.belief_or_action_authority, false);
console.log("Character Memory Core Phase90-96 certification matrix and boundaries: PASS");
