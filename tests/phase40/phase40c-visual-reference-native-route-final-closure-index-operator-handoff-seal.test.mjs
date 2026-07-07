import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectPaths } from "../../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const phase40Index = [
  {
    phase: "40A",
    phase_id: "Phase40A",
    test_path: "tests/phase40/phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke.test.mjs",
    depends_on_phase: "39S",
    surface_kind: "visual_reference_sealed_chain_native_writing_route_acceptance_smoke",
    route_acceptance_ready: true,
    post_output_guard_ready: false,
    no_mutation_guarantee: true,
    must_not_generate_story_text: true,
    must_not_save_candidate: true,
    must_not_update_canon: true,
    must_not_update_active_engine: true,
    must_not_create_approval_request: true,
    must_not_create_pending_engine_candidate: true,
    must_not_enter_adoption_or_settlement: true,
    safety_flags: {
      candidate_created: false,
      canon_updated: false,
      active_engine_updated: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adopted: false,
      settled: false,
      writes_files: false,
    },
  },
  {
    phase: "40B",
    phase_id: "Phase40B",
    test_path: "tests/phase40/phase40b-visual-reference-native-route-consumer-guard-post-output-acceptance-seal.test.mjs",
    depends_on_phase: "40A",
    surface_kind: "visual_reference_native_route_consumer_guard_post_output_acceptance_seal",
    route_acceptance_ready: true,
    post_output_guard_ready: true,
    valid_story_like_output_acceptance_required: true,
    visual_misuse_output_block_required: true,
    disabled_contract_accept_without_mutation_required: true,
    no_mutation_guarantee: true,
    must_not_generate_story_text: true,
    must_not_save_candidate: true,
    must_not_update_canon: true,
    must_not_update_active_engine: true,
    must_not_create_approval_request: true,
    must_not_create_pending_engine_candidate: true,
    must_not_enter_adoption_or_settlement: true,
    safety_flags: {
      candidate_created: false,
      canon_updated: false,
      active_engine_updated: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adopted: false,
      settled: false,
      writes_files: false,
    },
  },
];

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function snapshot(paths) {
  const values = new Map();
  for (const filePath of paths) {
    try {
      values.set(filePath, await readFile(filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      values.set(filePath, null);
    }
  }
  return values;
}

async function assertSnapshotUnchanged(before) {
  for (const [filePath, prior] of before) {
    try {
      const current = await readFile(filePath);
      assert.notEqual(prior, null, "File was created by Phase40C closure seal: " + filePath);
      assert(current.equals(prior), "File changed after Phase40C closure seal: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by Phase40C closure seal: " + filePath);
    }
  }
}

function assertNoMutation(entry) {
  assert.equal(entry.no_mutation_guarantee, true);
  assert.equal(entry.must_not_generate_story_text, true);
  assert.equal(entry.must_not_save_candidate, true);
  assert.equal(entry.must_not_update_canon, true);
  assert.equal(entry.must_not_update_active_engine, true);
  assert.equal(entry.must_not_create_approval_request, true);
  assert.equal(entry.must_not_create_pending_engine_candidate, true);
  assert.equal(entry.must_not_enter_adoption_or_settlement, true);
  assert.equal(entry.safety_flags.candidate_created, false);
  assert.equal(entry.safety_flags.canon_updated, false);
  assert.equal(entry.safety_flags.active_engine_updated, false);
  assert.equal(entry.safety_flags.approval_request_created, false);
  assert.equal(entry.safety_flags.pending_engine_candidate_created, false);
  assert.equal(entry.safety_flags.adopted, false);
  assert.equal(entry.safety_flags.settled, false);
  assert.equal(entry.safety_flags.writes_files, false);
}

function buildSeal() {
  const phases = phase40Index.map((entry) => entry.phase);
  const phaseOrderReady = JSON.stringify(phases) === JSON.stringify(["40A", "40B"]);
  const indexSafetyReady = phase40Index.every((entry) => (
    entry.no_mutation_guarantee === true
    && entry.must_not_save_candidate === true
    && entry.must_not_update_canon === true
    && entry.must_not_update_active_engine === true
    && entry.must_not_enter_adoption_or_settlement === true
    && entry.safety_flags.candidate_created === false
    && entry.safety_flags.canon_updated === false
    && entry.safety_flags.active_engine_updated === false
    && entry.safety_flags.adopted === false
    && entry.safety_flags.settled === false
    && entry.safety_flags.writes_files === false
  ));
  const routeAcceptanceReady = phase40Index.some((entry) => (
    entry.phase === "40A"
    && entry.depends_on_phase === "39S"
    && entry.route_acceptance_ready === true
  ));
  const postOutputGuardReady = phase40Index.some((entry) => (
    entry.phase === "40B"
    && entry.depends_on_phase === "40A"
    && entry.route_acceptance_ready === true
    && entry.post_output_guard_ready === true
    && entry.valid_story_like_output_acceptance_required === true
    && entry.visual_misuse_output_block_required === true
    && entry.disabled_contract_accept_without_mutation_required === true
  ));
  const ready = phaseOrderReady && indexSafetyReady && routeAcceptanceReady && postOutputGuardReady;

  return {
    used: true,
    phase: "40C",
    surface_kind: "visual_reference_native_route_final_closure_index_operator_handoff_seal",
    closure_index_kind: "visual_reference_native_route_closure_index",
    operator_handoff_seal_kind: "visual_reference_native_route_operator_handoff_seal",
    required_phase_range: "Phase40A-Phase40B",
    depends_on_phase: "40B",
    final_closure_index_ready: ready,
    operator_handoff_seal_ready: ready,
    phase_order_ready: phaseOrderReady,
    index_safety_ready: indexSafetyReady,
    native_route_acceptance_ready: routeAcceptanceReady,
    post_output_consumer_guard_ready: postOutputGuardReady,
    phase_count: phase40Index.length,
    phases_indexed: phases,
    index: phase40Index,
    read_only: true,
    no_mutation_guarantee: ready,
    must_not_generate_story_text: true,
    must_not_save_candidate: true,
    must_not_update_canon: true,
    must_not_update_active_engine: true,
    must_not_create_approval_request: true,
    must_not_create_pending_engine_candidate: true,
    must_not_enter_adoption_or_settlement: true,
    must_not_write_files: true,
    seal_flags: {
      visual_reference_native_route_sealed: ready,
      route_acceptance_sealed: routeAcceptanceReady,
      post_output_guard_sealed: postOutputGuardReady,
      no_canon_active_engine_mutation_sealed: indexSafetyReady,
      no_candidate_save_sealed: indexSafetyReady,
      no_adoption_settlement_sealed: indexSafetyReady,
    },
    operator_handoff: {
      status: ready ? "sealed" : "not_ready",
      safe_to_treat_visual_reference_native_route_as_closed: ready,
      must_not_use_visual_reference_as_canon_source: true,
      must_not_use_visual_reference_as_ability_source: true,
      must_not_use_visual_reference_as_relationship_source: true,
      must_not_use_visual_reference_as_timeline_source: true,
      must_not_use_visual_reference_as_candidate_source: true,
      must_not_use_visual_reference_as_settlement_source: true,
    },
    safety_flags: {
      visual_reference_native_route_final_closure_index_operator_handoff_seal_ready: ready,
      candidate_created: false,
      canon_updated: false,
      active_engine_updated: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adopted: false,
      settled: false,
      writes_files: false,
    },
  };
}

const activeBefore = await readFile(projectPaths.activeEngine);
const pendingBefore = await names(path.join(projectPaths.canonDb, "pending_engine_candidates"));
const approvalBefore = await names(path.join(projectPaths.approvalQueue, "items"));
const cleanupBefore = await names(path.join(projectPaths.cleanupRoot, "proposals"));
const watched = await snapshot([
  projectPaths.activeEngine,
  path.join(projectPaths.outputs, "generation_context.md"),
  path.join(projectPaths.outputs, "retrieval_context.md"),
  path.join(projectPaths.outputs, "task_prompt.md"),
]);

const seal = buildSeal();

assert.equal(seal.used, true);
assert.equal(seal.phase, "40C");
assert.equal(seal.surface_kind, "visual_reference_native_route_final_closure_index_operator_handoff_seal");
assert.equal(seal.closure_index_kind, "visual_reference_native_route_closure_index");
assert.equal(seal.operator_handoff_seal_kind, "visual_reference_native_route_operator_handoff_seal");
assert.equal(seal.required_phase_range, "Phase40A-Phase40B");
assert.equal(seal.depends_on_phase, "40B");
assert.equal(seal.final_closure_index_ready, true);
assert.equal(seal.operator_handoff_seal_ready, true);
assert.equal(seal.phase_order_ready, true);
assert.equal(seal.index_safety_ready, true);
assert.equal(seal.native_route_acceptance_ready, true);
assert.equal(seal.post_output_consumer_guard_ready, true);
assert.equal(seal.phase_count, 2);
assert.deepEqual(seal.phases_indexed, ["40A", "40B"]);

for (const entry of seal.index) {
  assertNoMutation(entry);
  const info = await stat(path.join(rootDir, entry.test_path));
  assert.equal(info.isFile(), true, entry.test_path + " must exist.");
}

assert.equal(seal.read_only, true);
assert.equal(seal.no_mutation_guarantee, true);
assert.equal(seal.must_not_generate_story_text, true);
assert.equal(seal.must_not_save_candidate, true);
assert.equal(seal.must_not_update_canon, true);
assert.equal(seal.must_not_update_active_engine, true);
assert.equal(seal.must_not_create_approval_request, true);
assert.equal(seal.must_not_create_pending_engine_candidate, true);
assert.equal(seal.must_not_enter_adoption_or_settlement, true);
assert.equal(seal.must_not_write_files, true);

assert.equal(seal.seal_flags.visual_reference_native_route_sealed, true);
assert.equal(seal.seal_flags.route_acceptance_sealed, true);
assert.equal(seal.seal_flags.post_output_guard_sealed, true);
assert.equal(seal.seal_flags.no_canon_active_engine_mutation_sealed, true);
assert.equal(seal.seal_flags.no_candidate_save_sealed, true);
assert.equal(seal.seal_flags.no_adoption_settlement_sealed, true);

assert.equal(seal.operator_handoff.status, "sealed");
assert.equal(seal.operator_handoff.safe_to_treat_visual_reference_native_route_as_closed, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_canon_source, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_ability_source, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_relationship_source, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_timeline_source, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_candidate_source, true);
assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_settlement_source, true);

assert.equal(seal.safety_flags.visual_reference_native_route_final_closure_index_operator_handoff_seal_ready, true);
assert.equal(seal.safety_flags.candidate_created, false);
assert.equal(seal.safety_flags.canon_updated, false);
assert.equal(seal.safety_flags.active_engine_updated, false);
assert.equal(seal.safety_flags.approval_request_created, false);
assert.equal(seal.safety_flags.pending_engine_candidate_created, false);
assert.equal(seal.safety_flags.adopted, false);
assert.equal(seal.safety_flags.settled, false);
assert.equal(seal.safety_flags.writes_files, false);

const phase40aSource = await readFile(path.join(rootDir, phase40Index[0].test_path), "utf8");
const phase40bSource = await readFile(path.join(rootDir, phase40Index[1].test_path), "utf8");

assert.match(phase40aSource, /visual_reference_sealed_chain_native_writing_route_acceptance_smoke/u);
assert.match(phase40aSource, /Phase40A visual reference sealed chain native writing route acceptance smoke tests passed/u);
assert.match(phase40aSource, /candidate_created, false/u);
assert.match(phase40aSource, /canon_updated, false/u);
assert.match(phase40aSource, /active_engine_updated, false/u);
assert.match(phase40aSource, /adopted, false/u);
assert.match(phase40aSource, /settled, false/u);

assert.match(phase40bSource, /visual_reference_native_route_consumer_guard_post_output_acceptance_seal/u);
assert.match(phase40bSource, /valid-post-output-acceptance-seal/u);
assert.match(phase40bSource, /blocked-post-output-acceptance-seal/u);
assert.match(phase40bSource, /disabled-contract-post-output-acceptance-seal/u);
assert.match(phase40bSource, /accepted, true/u);
assert.match(phase40bSource, /blocked, true/u);
assert.match(phase40bSource, /candidate_created, false/u);
assert.match(phase40bSource, /canon_updated, false/u);
assert.match(phase40bSource, /active_engine_updated, false/u);
assert.match(phase40bSource, /adopted, false/u);
assert.match(phase40bSource, /settled, false/u);

const runAllSource = await readFile(path.join(rootDir, "tests/run-all.mjs"), "utf8");
const requiredRunAllLines = [
  "tests/phase39/phase39s-visual-reference-consumer-guard-final-closure-index-operator-handoff-seal.test.mjs",
  "tests/phase40/phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke.test.mjs",
  "tests/phase40/phase40b-visual-reference-native-route-consumer-guard-post-output-acceptance-seal.test.mjs",
  "tests/phase40/phase40c-visual-reference-native-route-final-closure-index-operator-handoff-seal.test.mjs",
  "tests/mcp/mcp-readonly-tools.test.mjs",
];

for (const line of requiredRunAllLines) {
  assert(runAllSource.includes(line), "run-all missing required registration: " + line);
}

const phase39sIndex = runAllSource.indexOf(requiredRunAllLines[0]);
const phase40aIndex = runAllSource.indexOf(requiredRunAllLines[1]);
const phase40bIndex = runAllSource.indexOf(requiredRunAllLines[2]);
const phase40cIndex = runAllSource.indexOf(requiredRunAllLines[3]);

assert(phase39sIndex < phase40aIndex, "Phase39S must run before Phase40A.");
assert(phase40aIndex < phase40bIndex, "Phase40A must run before Phase40B.");
assert(phase40bIndex < phase40cIndex, "Phase40B must run before Phase40C.");

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Phase40C changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Phase40C changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Phase40C changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Phase40C changed cleanup proposals.",
);

console.log("Phase40C visual reference native route final closure index/operator handoff seal tests passed.");
