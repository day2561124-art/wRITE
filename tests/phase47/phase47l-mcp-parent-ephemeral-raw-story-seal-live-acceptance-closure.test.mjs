import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractDirectMcpToolNames } from "../../server/src/mcp-tool-inventory.mjs";
import {
  externalBrainPreGenerationCapabilities,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";

const root = process.cwd();
const evidencePath = path.join(root, "config", "phase47k-real-chatgpt-mcp-parent-ephemeral-raw-story-seal-live-acceptance-evidence.json");
const phase46dEvidencePath = path.join(root, "config", "phase46d-real-chatgpt-immutable-raw-story-handoff-live-acceptance-evidence.json");
const rawEvidence = await readFile(evidencePath, "utf8");
const evidence = JSON.parse(rawEvidence);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(rawEvidence.replaceAll("\r\n", "\n"), `${JSON.stringify(evidence, null, 2)}\n`, "Phase47K evidence must use canonical LF JSON serialization");
assert.equal(evidence.schema_version, 1);
assert.equal(evidence.phase, "47K");
assert.equal(evidence.evidence_kind, "real_chatgpt_mcp_parent_ephemeral_raw_story_seal_live_acceptance_closure");
assert.equal(evidence.immutable_evidence_record, true);
assert.equal(evidence.acceptance_subject, "real_current_chatgpt");
assert.equal(evidence.architecture_route, "chatgpt_owned_external_brain");
assert.equal(evidence.orchestration_owner, "ChatGPT");
assert.equal(evidence.prose_generator, "ChatGPT");
assert.equal(evidence.full_neural_orchestrator_used, false);
assert.equal(evidence.acceptance_result, "PASS");
assert.equal(evidence.final_status, "PASS");

const rejected = evidence.pre_runtime_rejected_request;
assert.equal(rejected.entered_writer_workbench_runtime, false);
assert.equal(rejected.agent_run_created, false);
assert.equal(rejected.external_brain_session_created, false);
assert.equal(rejected.seal_attempt, false);
assert.equal(rejected.raw_story_handoff_attempt, false);
assert.equal(rejected.final_polisher_attempt, false);
assert.equal(rejected.counts_as_primary_seal_retry, false);
assert.equal(rejected.counts_as_primary_final_polisher_retry, false);

assert.equal(evidence.live_session.external_brain_session_id, "agent_run_20260714-185359-0475e4d2");
assert.equal(evidence.live_session.writing_context_bundle_id, "gptctx_20260714-185359-4fbbdd54");

const expectedCapabilities = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];
const expectedCapabilityTraces = [
  "neural_trace_20260714-185409-8c1f0e84",
  "neural_trace_20260714-185420-ab819a9b",
  "neural_trace_20260714-185431-206a99d1",
  "neural_trace_20260714-185442-8c510b3f",
  "neural_trace_20260714-185455-16baaf44",
  "neural_trace_20260714-185505-fcc9fc7a",
];
const capabilities = evidence.individual_pre_generation_capabilities;
assert.equal(capabilities.required_count, 6);
assert.equal(capabilities.successful_count, 6);
assert.equal(capabilities.aggregate_macro_used, false);
assert.deepEqual(capabilities.canonical_ordering, expectedCapabilities);
assert.equal(capabilities.capabilities.length, 6);
assert.deepEqual(capabilities.capabilities.map(({ capability_name }) => capability_name), expectedCapabilities);
assert.deepEqual(capabilities.capabilities.map(({ trace_id }) => trace_id), expectedCapabilityTraces);
assert(capabilities.capabilities.every(({ status }) => status === "success"));
assert(capabilities.capabilities.every(({ individual_live_call }) => individual_live_call === true));

const cognition = evidence.integrated_authorship_cognition;
assert.equal(cognition.phase47b_synthesis_continuity_confirmed, true);
assert.equal(cognition.director_result_type, "writing_card_director_context");
assert.equal(cognition.integration_mode, "same_author_cognition_synthesis");
assert.deepEqual(cognition.prior_cognition_sources.map(({ module_name }) => module_name), expectedCapabilities.slice(0, 5));
assert(cognition.prior_cognition_sources.every(({ consumption_status }) => consumption_status === "verified_and_consumed"));
assert.equal(cognition.prior_outputs_are_same_author_cognition_passes, true);
assert.equal(cognition.prior_outputs_are_independent_authorities, false);
assert.equal(cognition.prior_outputs_are_simultaneous_prose_directives, false);
assert.equal(cognition.manual_copying_into_director_required, false);
assert.equal(cognition.second_synthesis_report_required, false);
assert.equal(cognition.module_boundaries_dissolve_before_prose_generation, true);
assert.equal(cognition.final_scene_choice_and_prose_authorship_remain_chatgpt_authorship, true);
for (const key of [
  "self_reorganization_required",
  "semantic_deduplication_required",
  "authority_arbitration_required",
  "conflict_arbitration_required",
  "compression_required",
  "scene_constraint_reconstruction_required",
]) assert.equal(cognition.phase46d_baseline_burden[key], true);
assert.equal(cognition.phase47c_live_comparison.self_reorganization_required, "materially_reduced");
assert.equal(cognition.phase47c_live_comparison.semantic_deduplication_required, "not_required");
assert.equal(cognition.phase47c_live_comparison.authority_arbitration_required, "not_required");
assert.equal(cognition.phase47c_live_comparison.conflict_arbitration_required, "not_required");
assert.equal(cognition.phase47c_live_comparison.compression_required, "materially_reduced");
assert.equal(cognition.phase47c_live_comparison.scene_constraint_reconstruction_required, "materially_reduced");
assert.equal(cognition.phase47c_live_comparison.mentally_replay_prior_five_outputs_required, false);
assert.equal(cognition.phase47c_live_comparison.director_closest_category, "A_same_author_finished_thinking_and_holds_integrated_understanding");

const chain = Object.fromEntries(evidence.historical_handoff_remediation_chain.map((item) => [item.phase, item]));
assert.equal(chain["47C"].status, "BLOCKED");
assert.equal(chain["47C"].reason, "direct_exact_sha_long_form_handoff_mismatch");
assert.equal(chain["47C"].final_polisher_executed, false);
assert.equal(chain["47D"].remediation, "exact_raw_story_handoff_mismatch_forensics");
assert.equal(chain["47D"].exact_sha_hard_block_preserved, true);
assert.equal(chain["47D"].normalization_acceptance, false);
assert.equal(chain["47E"].possible_internal_content_mutation, true);
assert.equal(chain["47E"].first_mismatching_chunk_index, 2);
assert.equal(chain["47E"].approximate_mismatch_utf8_byte_window, "2048-3072");
assert.equal(chain["47E"].exact_system_layer_identified, false);
assert.equal(chain["47F"].remediation, "single_ingress_immutable_raw_story_seal");
assert.equal(chain["47G"].status, "BLOCKED");
assert.equal(chain["47H"].remediation, "raw_story_seal_session_authority_reconciliation");
assert.equal(chain["47H"].session_authority_sources.length, 4);
assert.equal(chain["47I"].status, "BLOCKED");
assert.equal(chain["47I"].cross_process_routing_evidence_supported, true);
assert.equal(chain["47I"].root_cause, "seal_payload_lived_in_per_connection_mcp_server_child_local_memory");
assert.equal(chain["47J"].remediation, "mcp_http_parent_ephemeral_raw_story_seal_broker");
assert.deepEqual(chain["47J"].operations, ["STORE", "ACQUIRE", "CONSUME", "ABORT"]);
assert.equal(chain["47J"].disk_persistence, false);
assert.equal(chain["47J"].global_shared_mcp_server_child, false);

const rawStory = evidence.raw_story;
assert.equal(rawStory.title, "早了十二分鐘");
assert.equal(rawStory.current_chatgpt_generated_raw_prose, true);
assert.equal(rawStory.neural_module_generated_prose, false);
assert.equal(rawStory.writer_workbench_generated_prose, false);
assert.equal(rawStory.backend_provider_used, false);
assert.equal(rawStory.local_provider_used, false);
assert.equal(rawStory.deterministic_prose_adapter_used, false);
assert.equal(rawStory.mock_or_synthetic_prose_used, false);
assert.equal(rawStory.exact_story_text_stored_in_evidence, false);
assert.equal(rawStory.length_metrics_available, false);
assert.equal(Object.hasOwn(rawStory, "character_length"), false);
assert.equal(Object.hasOwn(rawStory, "utf8_byte_length"), false);

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
}
const evidenceKeys = collectKeys(evidence);
for (const forbidden of ["raw_story_text", "story_body", "complete_prose", "prose_prefix", "prose_suffix", "acquire_status", "consume_status"]) {
  assert.equal(evidenceKeys.includes(forbidden), false, `forbidden evidence field: ${forbidden}`);
}

const expectedStorySha = "8a2f7cc21c327fd7a4be7db1f7b87db79adcc14ec32a65b0e13d9167342dfbf0";
const expectedBrokerId = "broker_runtime_20260714185102-08e8ea91e7567549fabc4008";
const seal = evidence.single_ingress_seal;
assert.equal(seal.success, true);
assert.equal(seal.primary_seal_retry_count, 0);
assert.equal(seal.raw_story_handoff_id, "raw_story_handoff_20260714-185703-80b8a6a4b8e3");
assert.equal(seal.handoff_route, "single_ingress_immutable_seal");
assert.equal(seal.seal_child_runtime_process_instance_id, "runtime_process_20260714185703-0bf822fb710f0ce1f92554e8");
assert.equal(seal.seal_broker_runtime_process_instance_id, expectedBrokerId);
assert.equal(seal.broker_storage_scope, "mcp_http_parent_process_ephemeral_memory");
assert.equal(seal.broker_persistence, "none");
assert.equal(seal.persists_across_process_restart, false);
assert.equal(seal.raw_story_sha256, expectedStorySha);
assert.equal(seal.seal_ingress_raw_story_sha256, expectedStorySha);
assert.equal(seal.parent_broker_received_raw_story_sha256, expectedStorySha);
assert.equal(seal.seal_ingress_raw_story_sha256, seal.parent_broker_received_raw_story_sha256);
assert.equal(seal.internal_payload_continuity_exact_match, true);
assert.equal(seal.seal_response_echoed_raw_prose, false);
assert.equal(seal.caller_predeclared_sha_semantics, false);
assert.equal(Object.hasOwn(seal, "declared_raw_story_sha256"), false);
assert.equal(seal.lifecycle_status, "sealed");

const finalPolisher = evidence.final_polisher_sealed_route;
assert.deepEqual(finalPolisher.public_submitted_fields, ["external_brain_session_id", "writing_context_bundle_id", "raw_story_handoff_id"]);
assert.equal(finalPolisher.raw_story_text_resubmitted, false);
assert.equal(finalPolisher.raw_story_sha256_resubmitted, false);
assert.equal(finalPolisher.raw_story_integrity_manifest_resubmitted, false);
assert.equal(finalPolisher.primary_final_polisher_retry_count, 0);
assert.equal(finalPolisher.success, true);
assert.equal(finalPolisher.integrity_route, "single_ingress_immutable_seal");
assert.equal(finalPolisher.integrity_status, "matched");
assert.equal(finalPolisher.guard_used, true);
assert.equal(finalPolisher.exact_match, true);
assert.equal(finalPolisher.final_polisher_executed, true);
assert.equal(finalPolisher.final_polisher_child_runtime_process_instance_id, "runtime_process_20260714185727-b7a38c639f9d0e10887344ac");
assert.equal(finalPolisher.final_polisher_broker_runtime_process_instance_id, expectedBrokerId);
assert.notEqual(finalPolisher.final_polisher_child_runtime_process_instance_id, seal.seal_child_runtime_process_instance_id);
assert.equal(finalPolisher.final_polisher_broker_runtime_process_instance_id, seal.seal_broker_runtime_process_instance_id);
assert.equal(finalPolisher.seal_child_and_final_polisher_child_different, true);
assert.equal(finalPolisher.seal_and_final_polisher_broker_same, true);
assert.equal(finalPolisher.final_polisher_resolved_raw_story_sha256, expectedStorySha);
assert.equal(seal.seal_ingress_raw_story_sha256, seal.parent_broker_received_raw_story_sha256);
assert.equal(seal.parent_broker_received_raw_story_sha256, finalPolisher.final_polisher_resolved_raw_story_sha256);
assert.equal(finalPolisher.triple_hash_exact_match, true);
assert.equal(finalPolisher.trace.trace_id, "neural_trace_20260714-185727-98542830");
assert.equal(finalPolisher.trace.module_name, "final_polisher");
assert.equal(finalPolisher.trace.status, "success");
assert.equal(finalPolisher.trace.output_hash, "76585d44560135e734156d361fa121639fbec55c08a5f2832b25b20868419c22");

const lifecycle = evidence.handoff_lifecycle;
assert.equal(lifecycle.seal_lifecycle_observed, "sealed");
assert.equal(lifecycle.successful_handoff_resolved_and_final_polisher_executed, true);
assert.equal(lifecycle.payload_reference_active_after_success, false);
assert.equal(lifecycle.payload_release_semantics, "process_local_reference_released_not_secure_memory_erase");
assert.equal(lifecycle.secure_memory_erase_claimed, false);
assert.equal(lifecycle.os_level_physical_memory_overwrite_claimed, false);
assert.equal(lifecycle.persistent_consumed_receipt_claimed, false);
assert.equal(lifecycle.second_consumer_live_probe_performed, false);

const editorial = evidence.editorial_semantic_review;
assert.equal(editorial.release_recommendation, "release_as_is");
assert.equal(editorial.release_recommendation_mechanically_accepted, false);
assert.equal(editorial.editorial_decision, "release_original_unchanged");
assert.equal(editorial.whole_draft_semantic_review_completed, true);
assert.equal(editorial.material_revision_threshold_met, false);
assert.deepEqual(editorial.material_evidence_categories, []);
assert.equal(editorial.revision_scope, "none");
assert.deepEqual(editorial.operations_used, []);
assert.equal(editorial.beautification_used, false);
assert.equal(editorial.adjective_augmentation_used, false);
assert.equal(editorial.sensory_detail_injection_used, false);
assert.equal(editorial.metaphor_generation_used, false);
assert.equal(editorial.subtractive_deletion_used, false);
assert.equal(editorial.whole_draft_rewrite_used, false);
assert.equal(editorial.primary_raw_story_evidence_overwritten, false);
assert.deepEqual(editorial.non_material_observations, ["functional_overcompression_risk", "high_clue_conversion_rate"]);

const observations = evidence.human_prose_observations;
assert.equal(observations.evidence_scope, "this_live_raw_story_and_acceptance_run_only");
assert.equal(observations.universal_future_prose_quality_claimed, false);
assert.equal(observations.traditional_chinese_naturalness, "natural_taiwan_traditional_chinese");
assert.equal(observations.translationese, "no_material_evidence");
assert.equal(observations.supporting_actor_independence, "preserved");
assert.equal(observations.ordinary_texture_fully_recovered_by_plot, false);
assert.equal(observations.cognition_governance_proof_leakage, "not_observed");

const conclusions = evidence.architectural_conclusions;
assert.equal(conclusions.phase47b_integrated_authorship_cognition_live_validated, true);
assert.equal(conclusions.different_per_connection_children_shared_same_parent_broker, true);
assert.equal(conclusions.seal_child_and_final_polisher_child_different, true);
assert.equal(conclusions.seal_and_final_polisher_broker_same, true);
assert.equal(conclusions.single_ingress_exact_payload_continuity_live_validated, true);
assert.equal(conclusions.triple_hash_exact_match, true);
assert.equal(conclusions.raw_story_text_resubmitted_to_final_polisher, false);
assert.equal(conclusions.final_polisher_consumed_resolved_sealed_payload, true);
assert.equal(conclusions.final_polisher_success_trace_created, true);
assert.equal(conclusions.second_materialization_requirement_removed_from_validated_primary_sealed_flow, true);
assert.equal(conclusions.second_materialization_sha_mismatch_class_removed_from_validated_primary_sealed_flow, true);
assert.equal(conclusions.all_possible_sha_mismatch_is_impossible_claimed, false);
assert.equal(conclusions.all_transport_mutation_is_eliminated_globally_claimed, false);
assert.equal(conclusions.direct_exact_sha_route_remains_available, true);
assert.equal(conclusions.phase47d_direct_forensics_preserved, true);

assert.equal(evidence.ownership_boundaries.raw_prose_author, "ChatGPT");
assert.equal(evidence.ownership_boundaries.final_prose_generator, "ChatGPT");
assert.equal(evidence.ownership_boundaries.final_prose_emitter, "ChatGPT");
assert.equal(evidence.ownership_boundaries.writer_workbench_generated_raw_prose, false);
assert.equal(evidence.ownership_boundaries.parent_broker_generated_prose, false);
assert.deepEqual(evidence.mutation_guards, {
  candidate_created: false,
  canon_updated: false,
  active_engine_updated: false,
  adopted: false,
  settled: false,
});

const neuralModuleSource = await readFile(path.join(root, "server", "src", "neural-module-service.mjs"), "utf8");
const moduleSpecsSource = neuralModuleSource.slice(neuralModuleSource.indexOf("const moduleSpecs = {"), neuralModuleSource.indexOf("\n};", neuralModuleSource.indexOf("const moduleSpecs = {")));
const neuralModuleNames = [...moduleSpecsSource.matchAll(/^  ([a-z_]+): \{$/gmu)].map((match) => match[1]);
assert.deepEqual(neuralModuleNames, [...expectedCapabilities, "final_polisher"]);
assert.equal(neuralModuleNames.length, 7);
assert.deepEqual(externalBrainPreGenerationCapabilities, expectedCapabilities.map((name) => `run_${name}`));

const mcpSource = await readFile(path.join(root, "server", "src", "mcp-server.mjs"), "utf8");
const fullToolNames = extractDirectMcpToolNames(mcpSource);
assert.equal(fullToolNames.length, 80);
const publicStart = mcpSource.indexOf("const chatgptPublicToolNames = new Set([");
const publicEnd = mcpSource.indexOf("\n]);", publicStart);
const publicToolNames = [...mcpSource.slice(publicStart, publicEnd).matchAll(/^  "([^"]+)",$/gmu)].map((match) => match[1]);
assert.equal(publicToolNames.length, 29);
assert.equal(evidence.mcp_inventory.public_tool_count, 25);
assert.equal(evidence.mcp_inventory.full_tool_count, 80);

const expectedHashes = evidence.protected_hashes;
assert.equal(sha256(await readFile(path.join(root, "data", "canon_db", "active_engine.md"))), expectedHashes.active_engine_sha256);
assert.equal(sha256(await readFile(path.join(root, "data", "error_report_db", "compressed_rules.md"))), expectedHashes.compressed_rules_sha256);
assert.equal(sha256(await readFile(phase46dEvidencePath)), expectedHashes.phase46d_evidence_sha256);
assert.equal(expectedHashes.active_engine_sha256, "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb");
assert.equal(expectedHashes.compressed_rules_sha256, "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db");
assert.equal(expectedHashes.phase46d_evidence_sha256, "37f72907fb568ad59ef17033ffd0e69c1c08a22a043b35046ee68b830cf002c6");

const runAllSource = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
const phase47jPath = "tests/phase47/phase47j-mcp-parent-ephemeral-raw-story-seal-broker.test.mjs";
const phase47lPath = "tests/phase47/phase47l-mcp-parent-ephemeral-raw-story-seal-live-acceptance-closure.test.mjs";
const mcpContractPath = "tests/tools/mcp-contract.test.mjs";
assert(runAllSource.includes(phase47jPath));
assert(runAllSource.includes(phase47lPath));
assert(runAllSource.indexOf(phase47jPath) < runAllSource.indexOf(phase47lPath));
assert(runAllSource.indexOf(phase47lPath) < runAllSource.indexOf(mcpContractPath));

console.log("Phase47L MCP parent ephemeral raw-story seal live acceptance closure PASS.");
