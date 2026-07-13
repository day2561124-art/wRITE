import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(
  root,
  "config",
  "phase46d-real-chatgpt-immutable-raw-story-handoff-live-acceptance-evidence.json",
);
const rawEvidence = await readFile(evidencePath, "utf8");
const evidence = JSON.parse(rawEvidence);

function normalizeLineEndings(text) {
  return text.replace(/\r\n?/gu, "\n");
}

assert.equal(
  normalizeLineEndings(rawEvidence),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "Phase46D closure evidence serialization must remain canonical",
);

const expectedCapabilities = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];
const expectedActiveEngineHash =
  "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash =
  "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

assert.equal(evidence.schema_version, 1);
assert.equal(evidence.phase, "46D");
assert.equal(
  evidence.evidence_kind,
  "real_chatgpt_immutable_raw_story_handoff_live_acceptance_closure",
);
assert.equal(evidence.immutable_evidence_record, true);
assert.equal(evidence.acceptance_subject, "real_current_chatgpt");
assert.equal(evidence.architecture_route, "chatgpt_owned_external_brain");
assert.equal(evidence.orchestration_owner, "ChatGPT");
assert.equal(evidence.prose_generator, "ChatGPT");
assert.equal(evidence.full_neural_orchestrator_used, false);

assert.equal(evidence.historical_evidence_chain.phase46b_status, "BLOCKED");
assert.equal(evidence.historical_evidence_chain.first_phase46d_attempt_status, "BLOCKED");
assert.equal(evidence.historical_evidence_chain.phase46e_primary_root_cause, "Category D");
assert.equal(evidence.historical_evidence_chain.phase46d_rerun_status, "PASS");

assert.equal(
  evidence.live_session.external_brain_session_id,
  "agent_run_20260713-194314-755c7022",
);
assert.equal(
  evidence.live_session.writing_context_bundle_id,
  "gptctx_20260713-194314-7fdd1302",
);
assert.equal(evidence.live_session.agent_run_status, "success");

const capabilities = evidence.individual_pre_generation_capabilities;
assert.equal(capabilities.required_count, 6);
assert.equal(capabilities.successful_count, 6);
assert.equal(capabilities.aggregate_macro_used, false);
assert.deepEqual(
  capabilities.capabilities.map(({ capability_name }) => capability_name),
  expectedCapabilities,
);
assert(capabilities.capabilities.every(({ status }) => status === "success"));
assert(capabilities.capabilities.every(({ individual_live_call }) => individual_live_call === true));
assert(capabilities.capabilities.every(({ semantic_output_reviewed }) => semantic_output_reviewed === true));
assert(capabilities.capabilities.every(({ trace_id }) => /^neural_trace_\d{8}-\d{6}-[a-f0-9]{8}$/u.test(trace_id)));

const integration = evidence.cognition_integration;
assert.equal(integration.required, true);
assert.equal(integration.performed_by, "current_chatgpt");
for (const field of [
  "self_reorganization_required",
  "semantic_deduplication_required",
  "authority_arbitration_required",
  "conflict_arbitration_required",
  "compression_required",
  "scene_constraint_reconstruction_required",
]) {
  assert.equal(integration[field], true, `${field} must remain true`);
}

const rawStory = evidence.raw_story;
assert.equal(rawStory.title, "第二十章　兩隻手都不方便");
assert.equal(rawStory.character_length, 5498);
assert.equal(rawStory.utf8_byte_length, 14902);
assert.equal(rawStory.current_chatgpt_generated_raw_prose, true);
assert.equal(rawStory.neural_module_generated_prose, false);
assert.equal(rawStory.writer_workbench_generated_prose, false);
assert.equal(rawStory.backend_provider_used, false);
assert.equal(rawStory.local_provider_used, false);
assert.equal(rawStory.deterministic_prose_adapter_used, false);
assert.equal(rawStory.mock_or_synthetic_prose_used, false);
assert.equal(rawStory.exact_story_text_stored, false);
assert.equal("story_body" in rawStory, false);

const integrity = evidence.raw_story_integrity;
assert.match(integrity.declared_raw_story_sha256, /^[a-f0-9]{64}$/u);
assert.equal(integrity.declared_raw_story_sha256, integrity.received_raw_story_sha256);
assert.equal(integrity.status, "matched");
assert.equal(integrity.exact_match, true);
assert.equal(integrity.guard_used, true);
assert.equal(integrity.blocked_stage, null);
assert.equal(integrity.first_primary_long_form_handoff, true);
assert.equal(integrity.primary_mismatch, false);
assert.equal(integrity.primary_retry_count, 0);

const finalPolisher = evidence.final_polisher;
assert.equal(finalPolisher.executed, true);
assert.equal(finalPolisher.trace_status, "success");
assert.equal(finalPolisher.trace_id, "neural_trace_20260713-194936-b2ba5c2b");
assert.equal(
  finalPolisher.trace_output_hash,
  "5cad410b35b70bcd37cc725fdf0affec0016976cca3df5647ace7797e318b5ff",
);
assert.equal(finalPolisher.agent_run_status, "success");

const editorial = evidence.editorial_semantic_review;
assert.equal(editorial.completed, true);
assert.equal(editorial.release_recommendation, "release_as_is");
assert.equal(editorial.release_recommendation_mechanically_accepted, false);
assert.equal(editorial.editorial_decision, "minimal_subtractive_revision_required");
assert.deepEqual(editorial.material_evidence_categories, [
  "callback_saturation",
  "echo_only_callback",
  "local_pattern_saturation",
]);
assert.deepEqual(editorial.operations_used, ["deletion", "compression"]);
assert.equal(editorial.whole_draft_rewrite_used, false);
assert.equal(editorial.primary_immutable_raw_story_evidence_overwritten, false);

const mismatch = evidence.independent_mismatch_guard_probe;
assert.equal(mismatch.performed_after_primary_success, true);
assert.equal(mismatch.separate_from_primary_acceptance, true);
assert.equal(mismatch.status, "mismatch");
assert.equal(mismatch.exact_match, false);
assert.equal(mismatch.blocked_stage, "raw_story_handoff_integrity");
assert.equal(mismatch.final_polisher_executed, false);
assert.equal(mismatch.trace_status, "not_executed");

assert.deepEqual(evidence.mutation_guards, {
  candidate_created: false,
  canon_updated: false,
  active_engine_updated: false,
  adopted: false,
  settled: false,
});
assert.deepEqual(evidence.final_workbench_status.created, []);
assert.equal(evidence.final_workbench_status.approval_items, 0);
assert.equal(evidence.final_workbench_status.adopted_writings, 0);
assert.equal(evidence.final_workbench_status.settlement_contexts, 0);
assert.equal(evidence.final_workbench_status.settlement_reports, 0);
assert.equal(evidence.final_workbench_status.active_engine_modified, false);
assert.equal(evidence.final_workbench_status.compressed_rules_modified, false);
assert.equal(evidence.protected_hashes.active_engine_sha256, expectedActiveEngineHash);
assert.equal(evidence.protected_hashes.compressed_rules_sha256, expectedCompressedRulesHash);
assert.equal(evidence.acceptance_result, "PASS");
assert.equal(evidence.final_status, "PASS");

const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
const phase46c = "tests/phase46/phase46c-chatgpt-owned-immutable-raw-story-handoff-integrity-guard.test.mjs";
const phase46f = "tests/phase46/phase46f-immutable-raw-story-handoff-live-acceptance-closure.test.mjs";
const mcpContract = "tests/tools/mcp-contract.test.mjs";
assert(runAllText.includes(phase46f), "run-all missing Phase46F closure regression");
assert(runAllText.indexOf(phase46c) < runAllText.indexOf(phase46f));
assert(runAllText.indexOf(phase46f) < runAllText.indexOf(mcpContract));

console.log("Phase46F immutable raw-story handoff live acceptance closure evidence PASS.");
