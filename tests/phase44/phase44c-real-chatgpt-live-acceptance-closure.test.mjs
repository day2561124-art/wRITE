import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(root, "config", "phase44c-real-chatgpt-live-acceptance-evidence.json");
const rawEvidence = await readFile(evidencePath, "utf8");
const evidence = JSON.parse(rawEvidence);

const expectedTools = [
  "chatgpt_bridge_begin_external_brain_writing_session",
  "chatgpt_bridge_use_scene_planner",
  "chatgpt_bridge_use_character_simulator",
  "chatgpt_bridge_use_neural_critic",
  "chatgpt_bridge_use_style_drift_detector",
  "chatgpt_bridge_use_over_governance_detector",
  "chatgpt_bridge_use_writing_card_director",
  "chatgpt_bridge_use_final_polisher",
];
const expectedModules = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
  "final_polisher",
];
const expectedTraceIds = [
  "neural_trace_20260711-222945-a642404f",
  "neural_trace_20260711-222951-82a0085d",
  "neural_trace_20260711-222958-afdddb33",
  "neural_trace_20260711-223005-df9eca1c",
  "neural_trace_20260711-223010-e38e1966",
  "neural_trace_20260711-223021-92c77d31",
  "neural_trace_20260711-223138-90b03e31",
];
const expectedOutputHashes = [
  "721c7f5fd8ae43ea614e31b210c31efc613cbf10bbf877f8223ba766628eff4d",
  "aad9688a8fc56857fe6ea02d401ae7c2e90ff462a9757fa748e07458f702abc8",
  "7ee38ad777ce4a765912e62177ebd21b8c365b50b1f3902d2650a90cf427f69c",
  "1775ac6ea69aa718d2d02617455a74bba18b414e22cda411b01bc2cbc0b1472e",
  "a8824e8e2e2b2101de34b59e4578bbebc5a6732bed78bb4e5d1ffb9e0a2e95c7",
  "5365931548b38596e3637339ba58c9f498af0d36d4e5109d4d57229260a0fe0c",
  "a188eeee2ad448a97df07eb781f3d0c9a7d13bd589a5f20016a73f95b56241ff",
];
const runId = "agent_run_20260711-222938-fdcf8650";

assert.equal(rawEvidence, `${JSON.stringify(evidence, null, 2)}\n`, "evidence serialization must remain deterministic");
assert.equal(evidence.schema_version, 1);
assert.equal(evidence.phase, "44C");
assert.equal(evidence.evidence_kind, "real_chatgpt_live_acceptance_closure");
assert.equal(evidence.immutable_evidence_record, true);
assert.equal(evidence.acceptance_subject, "real_current_chatgpt");
assert.equal(evidence.architecture_route, "chatgpt_owned_external_brain");
assert.equal(evidence.acceptance_result, "PASS");

const sources = evidence.evidence_sources;
assert.equal(sources.automated_regression_evidence.role, "contract_regression_only");
assert.equal(sources.automated_regression_evidence.acceptance_actor, false);
assert.equal(sources.automated_regression_evidence.may_substitute_for_live_acceptance, false);
assert.equal(sources.production_http_mcp_regression_evidence.role, "production_transport_regression_only");
assert.equal(sources.production_http_mcp_regression_evidence.acceptance_actor, false);
assert.equal(sources.production_http_mcp_regression_evidence.may_substitute_for_live_acceptance, false);
assert.equal(sources.real_current_chatgpt_live_acceptance_evidence.role, "authoritative_live_acceptance");
assert.equal(sources.real_current_chatgpt_live_acceptance_evidence.acceptance_actor, true);
assert.equal(sources.real_current_chatgpt_live_acceptance_evidence.may_be_recreated_by_deterministic_test, false);

assert.equal(evidence.public_discovery.public_tool_count, 24);
assert.equal(evidence.public_discovery.required_gpt_owned_tool_count, 8);
assert.equal(evidence.public_discovery.visible_gpt_owned_tool_count, 8);
assert.deepEqual(evidence.public_discovery.required_gpt_owned_tools, expectedTools);
assert.equal(new Set(evidence.public_discovery.required_gpt_owned_tools).size, 8);

assert.equal(evidence.live_session.external_brain_session_id, runId);
assert.equal(evidence.live_session.writing_context_bundle_id, "gptctx_20260711-222938-dc20b298");
assert.equal(evidence.live_session.agent_run_status, "success");

const semantic = evidence.semantic_consumption;
assert.equal(semantic.pre_generation_capability_count, 6);
assert.equal(semantic.semantic_outputs_consumed, true);
assert.equal(semantic.capabilities.length, 6);
assert.deepEqual(semantic.capabilities.map(({ capability_name }) => capability_name), expectedModules.slice(0, 6));
assert(semantic.capabilities.every(({ semantic_output_consumed }) => semantic_output_consumed === true));
assert(semantic.capabilities.every(({ semantic_evidence }) => semantic_evidence && Object.keys(semantic_evidence).length > 0));

assert.equal(evidence.live_traces.length, 7);
assert.equal(new Set(evidence.live_traces.map(({ trace_id }) => trace_id)).size, 7);
assert.deepEqual(evidence.live_traces.map(({ trace_id }) => trace_id), expectedTraceIds);
assert.deepEqual(evidence.live_traces.map(({ module_name }) => module_name), expectedModules);
assert.deepEqual(evidence.live_traces.map(({ output_hash }) => output_hash), expectedOutputHashes);
assert(evidence.live_traces.every(({ run_id }) => run_id === runId), "all trace evidence must preserve same-run continuity");
assert(evidence.live_traces.every(({ status }) => status === "success"));
assert(evidence.live_traces.every(({ output_hash }) => /^[a-f0-9]{64}$/u.test(output_hash)));
assert(evidence.live_traces.slice(0, 6).every(({ generation_boundary }) => generation_boundary === "pre_generation"));
assert.equal(evidence.live_traces[6].generation_boundary, "post_generation");

const rawStory = evidence.raw_story_integrity;
assert.equal(rawStory.title, "折痕的方向");
assert.deepEqual(rawStory.required_core_characters, ["九逃"]);
assert.equal(rawStory.raw_story_sha256, "92bf2b460eb6607c77071c6e9501fe41f2103c0487e08e9161aeea9651871111");
assert.notEqual(rawStory.raw_story_sha256, "cbb7426efb800e7be0ee686b9d6aab917efdfff1d9848685e704a8fd35010e96");
assert.equal(rawStory.raw_story_unicode_code_point_count, 785);
assert.equal(rawStory.raw_story_utf8_byte_count, 2147);
assert.equal(rawStory.exact_text_stored, false);
assert.equal(rawStory.chatgpt_independently_computed_hash, true);
assert.equal(rawStory.writer_workbench_returned_hash, true);
assert.equal(rawStory.hashes_exactly_matched, true);

assert.equal(evidence.final_polisher.generation_boundary, "post_generation");
assert.equal(evidence.final_polisher.agent_run_status, "success");
assert.deepEqual(evidence.final_polisher.returned_fields, ["polished_text", "revision_report", "raw_story_sha256"]);
assert.equal(evidence.final_polisher.polished_text_matches_raw_text, true);
assert.equal(evidence.final_polisher.text_change_required_for_success, false);

for (const [guard, value] of Object.entries(evidence.route_guards)) {
  assert.equal(value, false, `${guard} must remain false`);
}
assert.deepEqual(evidence.mutation_guards, {
  candidate_created: false,
  canon_updated: false,
  active_engine_updated: false,
  adopted: false,
  settled: false,
});

const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
const httpRegression = "tests/phase44/phase44c-http-mcp-individual-semantic-handoff-regression.test.mjs";
const closureRegression = "tests/phase44/phase44c-real-chatgpt-live-acceptance-closure.test.mjs";
const mcpContract = "tests/tools/mcp-contract.test.mjs";
assert(runAllText.includes(closureRegression), "run-all missing Phase44C closure regression");
assert(runAllText.indexOf(httpRegression) < runAllText.indexOf(closureRegression));
assert(runAllText.indexOf(closureRegression) < runAllText.indexOf(mcpContract));

console.log("Phase44C real ChatGPT live acceptance closure evidence PASS.");
