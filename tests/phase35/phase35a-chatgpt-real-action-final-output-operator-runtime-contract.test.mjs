import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputFinalClosureSeal,
  buildChatgptFinalOutputOperatorRuntimeContract,
  emitChatgptFinalOutputText,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

const expectedForbiddenSources = [
  "tool_response.result",
  "tool_response.result.final_candidate_text",
  "tool_response.result.success_output_for_chat",
  "tool_response.result.failure_output_for_chat",
  "tool_response.result.final_response_for_chat",
  "tool_response.result.final_response_handoff_for_chat",
  "tool_response.result.extracted_chatgpt_final_output",
  "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
  "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
  "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
  "buildChatgptFinalOutputRealActionSurfaceReadiness(tool_response)",
  "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)",
  "buildChatgptFinalOutputFinalClosureSeal(tool_response)",
  "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)",
];

function assertNoOutputLayer(contract, label) {
  assert.equal(Object.hasOwn(contract, "output_text"), false, label + ": runtime contract must not expose output_text.");
  assert.equal(Object.hasOwn(contract, "output_hash"), false, label + ": runtime contract must not expose output_hash.");
  assert.equal(Object.hasOwn(contract, "accepted_chatgpt_output_text"), false, label + ": runtime contract must not expose accepted text.");
  assert.equal(Object.hasOwn(contract, "final_smoke_output_text"), false, label + ": runtime contract must not expose final smoke output.");
  assert.equal(Object.hasOwn(contract, "reference_final_output_text"), false, label + ": runtime contract must not expose seal reference text.");
}

function assertNoFallback(contract, label) {
  assert.equal(contract.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(contract.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(contract.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(contract.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(contract.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(contract.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(contract.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(contract.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(contract.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(contract.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(contract.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(contract.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(contract.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(contract.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
}

function assertOutputSafety(contract, label) {
  assert.equal(contract.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(contract.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(contract.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(contract.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(contract.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");
  assert.equal(contract.safety.candidate_only, true, label + ": safety candidate_only mismatch.");
  assert.equal(contract.safety.no_candidate_save, true, label + ": safety no_candidate_save mismatch.");
  assert.equal(contract.safety.no_approval, true, label + ": safety no_approval mismatch.");
  assert.equal(contract.safety.no_adoption, true, label + ": safety no_adoption mismatch.");
  assert.equal(contract.safety.no_canon_update, true, label + ": safety no_canon_update mismatch.");
  assert.equal(contract.safety.no_active_engine_update, true, label + ": safety no_active_engine_update mismatch.");
  assert.equal(contract.safety.can_modify_active_engine, false, label + ": safety can_modify_active_engine mismatch.");
  assert.equal(contract.safety.can_update_canon, false, label + ": safety can_update_canon mismatch.");
  assert.equal(contract.safety.can_confirm_adoption, false, label + ": safety can_confirm_adoption mismatch.");
}

function validToolResponse(rootText, result = {}) {
  return {
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
    blocked: false,
    chatgpt_final_output: {
      used: true,
      phase: "34R",
      surface_kind: "chatgpt_bridge_final_output_tool_surface_contract",
      contract_valid: true,
      validation_errors: [],
      status: "ready_to_emit_chatgpt_final_output",
      response_kind: "final_candidate_text",
      can_emit_response_to_chat: true,
      can_output_to_chat: true,
      may_output_story_text: true,
      output_text: rootText,
      output_hash: sha256(rootText),
      output_source: "result.extracted_chatgpt_final_output.output_text",
      final_output_source: "result.extracted_chatgpt_final_output.output_text",
      source: "result.extracted_chatgpt_final_output.output_text",
      source_surface: "result.extracted_chatgpt_final_output",
      source_response_kind: "final_candidate_text",
      source_status: "ready_to_emit_final_candidate_text",
      source_output_hash: sha256(rootText),
      source_output_source: "final_response_handoff_for_chat.body",
      must_emit_exactly: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_fallback_to_final_candidate_text: false,
      may_fallback_to_success_output: false,
      may_fallback_to_failure_output: false,
      may_fallback_to_final_response: false,
      may_fallback_to_final_response_handoff: false,
      may_fallback_to_extracted_chatgpt_final_output: false,
      may_fallback_to_extracted_output_recomposition: false,
      may_construct_response: false,
      safety: {
        candidate_only: true,
        no_candidate_save: true,
        no_approval: true,
        no_adoption: true,
        no_canon_update: true,
        no_active_engine_update: true,
        can_modify_active_engine: false,
        can_update_canon: false,
        can_confirm_adoption: false,
      },
    },
    result,
    created: [],
    warnings: [],
    blocked_reason: null,
  };
}

function assertValidRuntimeContractIgnoresAllDecoys() {
  const rootText = "ROOT ONLY：Phase35A runtime 真正可輸出值只來自 real action entrypoint。";
  const forbiddenTexts = [
    "FORBIDDEN tool_response.result",
    "FORBIDDEN result.final_candidate_text",
    "FORBIDDEN success_output_for_chat",
    "FORBIDDEN failure_output_for_chat",
    "FORBIDDEN final_response_for_chat",
    "FORBIDDEN final_response_handoff_for_chat",
    "FORBIDDEN extracted_chatgpt_final_output",
    "FORBIDDEN final closure index serialized text",
    "FORBIDDEN operator checklist serialized text",
    "FORBIDDEN live acceptance serialized text",
    "FORBIDDEN readiness serialized text",
    "FORBIDDEN final smoke serialized text",
    "FORBIDDEN final seal serialized text",
    "FORBIDDEN runtime contract serialized text",
  ];

  const toolResponse = validToolResponse(rootText, {
    decoy_result_surface: forbiddenTexts[0],
    final_candidate_text: forbiddenTexts[1],
    success_output_for_chat: {
      final_candidate_text_to_output: forbiddenTexts[2],
    },
    failure_output_for_chat: {
      failure_summary_for_chat: forbiddenTexts[3],
      recommended_operator_action: forbiddenTexts[3],
    },
    final_response_for_chat: {
      body: forbiddenTexts[4],
    },
    final_response_handoff_for_chat: {
      body: forbiddenTexts[5],
    },
    extracted_chatgpt_final_output: {
      used: true,
      output_text: forbiddenTexts[6],
      output_hash: sha256(forbiddenTexts[6]),
    },
    final_closure_index: forbiddenTexts[7],
    operator_handoff_checklist: forbiddenTexts[8],
    live_acceptance_smoke: forbiddenTexts[9],
    real_action_readiness: forbiddenTexts[10],
    real_action_final_smoke: forbiddenTexts[11],
    final_closure_seal: forbiddenTexts[12],
    operator_runtime_contract: forbiddenTexts[13],
  });

  const contract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const seal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(contract.used, true, "runtime: used mismatch.");
  assert.equal(contract.phase, "35A", "runtime: phase mismatch.");
  assert.equal(contract.surface_kind, "chatgpt_final_output_operator_runtime_contract", "runtime: surface kind mismatch.");
  assert.equal(contract.contract_valid, true, "runtime: contract should be valid.");
  assert.deepEqual(contract.validation_errors, [], "runtime: validation errors should be empty.");
  assert.equal(contract.status, "operator_runtime_contract_ready", "runtime: status mismatch.");
  assert.equal(contract.response_kind, "operator_runtime_contract_reference", "runtime: response kind mismatch.");
  assert.equal(contract.can_emit_response_to_chat, false, "runtime contract must not emit to chat.");
  assert.equal(contract.can_output_to_chat, false, "runtime contract must not output to chat.");
  assert.equal(contract.may_output_story_text, false, "runtime contract must not output story text.");
  assert.equal(contract.phase_dependency, "34Z", "runtime: phase dependency mismatch.");
  assert.equal(contract.phase_range, "34J-35A", "runtime: phase range mismatch.");
  assert.equal(contract.final_closure_seal, "buildChatgptFinalOutputFinalClosureSeal(tool_response)", "runtime: final seal reference mismatch.");
  assert.equal(contract.runtime_required_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "runtime: required entrypoint mismatch.");
  assert.equal(contract.runtime_required_expression, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "runtime: required expression mismatch.");
  assert.equal(contract.runtime_must_call, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "runtime: must_call mismatch.");
  assert.equal(contract.runtime_must_emit_exact_return_value, true, "runtime: exact return flag mismatch.");
  assert.equal(contract.runtime_must_not_emit_runtime_contract, true, "runtime: runtime contract emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_final_seal, true, "runtime: final seal emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_final_smoke, true, "runtime: final smoke emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_readiness, true, "runtime: readiness emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_live_acceptance, true, "runtime: live acceptance emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_final_closure_index, true, "runtime: final closure index emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_operator_checklist, true, "runtime: checklist emit guard mismatch.");
  assert.equal(contract.runtime_must_not_emit_result_surface, true, "runtime: result emit guard mismatch.");
  assert.equal(contract.runtime_must_not_read_result, true, "runtime: result read guard mismatch.");
  assert.equal(contract.runtime_must_not_read_final_seal_for_chat_output, true, "runtime: final seal read guard mismatch.");
  assert.equal(contract.runtime_must_not_read_final_smoke_for_chat_output, true, "runtime: final smoke read guard mismatch.");
  assert.equal(contract.runtime_must_not_recompose_response, true, "runtime: recomposition guard mismatch.");
  assert.equal(contract.runtime_must_not_rewrite, true, "runtime: rewrite guard mismatch.");
  assert.equal(contract.runtime_must_not_summarize, true, "runtime: summarize guard mismatch.");
  assert.equal(contract.runtime_must_not_add_explanation, true, "runtime: add explanation guard mismatch.");
  assert.equal(contract.runtime_required_root_field, "tool_response.chatgpt_final_output.output_text", "runtime: root field mismatch.");
  assert.equal(contract.runtime_reference_output_hash, sha256(rootText), "runtime: output hash mismatch.");
  assert.equal(contract.runtime_reference_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "runtime: output source mismatch.");
  assert.equal(contract.runtime_output_matches_root, true, "runtime: root match flag mismatch.");
  assert.equal(contract.runtime_output_matches_canonical_emit, true, "runtime: canonical match flag mismatch.");
  assert.equal(contract.runtime_output_matches_final_seal_reference, true, "runtime: final seal match flag mismatch.");
  assert.equal(contract.runtime_contract_is_reference_only, true, "runtime: reference-only flag mismatch.");
  assert.equal(contract.runtime_contract_must_not_replace_final_output, true, "runtime: replace guard mismatch.");
  assert.equal(contract.runtime_contract_must_not_be_emitted_as_chat_output, true, "runtime: emit guard mismatch.");
  assert.equal(contract.runtime_contract_adds_output_layer, false, "runtime: adds output layer mismatch.");
  assert.equal(contract.no_new_output_layer, true, "runtime: no_new_output_layer mismatch.");
  assert.equal(contract.runtime_contract_invalid_notice, null, "runtime: invalid notice should be null.");
  assert.deepEqual(contract.forbidden_sources, expectedForbiddenSources, "runtime: forbidden sources mismatch.");

  assert.equal(finalText, rootText, "runtime: final entrypoint should return root text.");
  assert.equal(canonicalText, rootText, "runtime: canonical emit should return root text.");
  assert.equal(seal.reference_final_output_text, rootText, "runtime: seal reference should match root text.");

  const serialized = JSON.stringify(contract);
  assert.equal(serialized.includes(rootText), false, "runtime contract must not carry raw root story text.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(serialized.includes(forbidden), false, "runtime contract must ignore decoy: " + forbidden);
  }

  assertNoOutputLayer(contract, "valid runtime contract");
  assertNoFallback(contract, "valid runtime contract");
  assertOutputSafety(contract, "valid runtime contract");
}

function assertInvalidRuntimeContractDoesNotEmitStoryOrNoticeAsOutput() {
  const invalid = buildChatgptFinalOutputOperatorRuntimeContract({});

  assert.equal(invalid.used, true, "invalid runtime: used mismatch.");
  assert.equal(invalid.phase, "35A", "invalid runtime: phase mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid runtime should be invalid.");
  assert.equal(invalid.status, "operator_runtime_contract_invalid", "invalid runtime status mismatch.");
  assert.equal(invalid.response_kind, "operator_runtime_contract_invalid_reference", "invalid runtime response kind mismatch.");
  assert.equal(invalid.can_emit_response_to_chat, false, "invalid runtime must not emit to chat.");
  assert.equal(invalid.can_output_to_chat, false, "invalid runtime must not output to chat.");
  assert.equal(invalid.may_output_story_text, false, "invalid runtime must not output story text.");
  assert.equal(invalid.runtime_reference_output_hash, null, "invalid runtime reference hash should be null.");
  assert.equal(invalid.runtime_reference_output_source, null, "invalid runtime reference source should be null.");
  assert.equal(invalid.validation_errors.includes("final_closure_seal_contract_invalid"), true, "invalid runtime missing final seal contract error.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid runtime missing root output error.");
  assert.equal(typeof invalid.runtime_contract_invalid_notice, "string", "invalid runtime should carry reference invalid notice.");
  assert.equal(invalid.runtime_contract_invalid_notice.includes("ChatGPT final output operator runtime contract invalid."), true, "invalid runtime notice mismatch.");
  assert.deepEqual(invalid.forbidden_sources, expectedForbiddenSources, "invalid runtime forbidden sources mismatch.");

  assertNoOutputLayer(invalid, "invalid runtime contract");
  assertNoFallback(invalid, "invalid runtime contract");
  assertOutputSafety(invalid, "invalid runtime contract");

  const forbiddenStoryText = "這段正文候選不可被 Phase35A runtime contract echo。";
  const invalidStory = buildChatgptFinalOutputOperatorRuntimeContract({
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
    blocked: false,
    chatgpt_final_output: {
      used: true,
      contract_valid: false,
      response_kind: "final_candidate_text",
      status: "invalid_root_story_surface",
      output_text: forbiddenStoryText,
      output_hash: "bad-hash",
      output_source: "result.extracted_chatgpt_final_output.output_text",
      must_emit_exactly: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      safety: {},
    },
    result: {
      final_candidate_text: forbiddenStoryText,
      success_output_for_chat: {
        final_candidate_text_to_output: forbiddenStoryText,
      },
    },
    created: [],
    warnings: [],
    blocked_reason: null,
  });

  assert.equal(invalidStory.contract_valid, false, "invalid story runtime should be invalid.");
  assert.equal(invalidStory.runtime_reference_output_hash, null, "invalid story runtime reference hash should be null.");
  assert.equal(JSON.stringify(invalidStory).includes(forbiddenStoryText), false, "invalid runtime must not echo story text.");
  assertNoOutputLayer(invalidStory, "invalid story runtime contract");
  assertNoFallback(invalidStory, "invalid story runtime contract");
  assertOutputSafety(invalidStory, "invalid story runtime contract");
}

assertValidRuntimeContractIgnoresAllDecoys();
assertInvalidRuntimeContractDoesNotEmitStoryOrNoticeAsOutput();

console.log("Phase35A ChatGPT real action final output operator runtime contract tests passed.");