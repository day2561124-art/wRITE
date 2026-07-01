import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputFinalClosureSeal,
  buildChatgptFinalOutputNegativeRuntimeSmoke,
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
  "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
];

function assertNoOutputLayer(smoke, label) {
  assert.equal(Object.hasOwn(smoke, "output_text"), false, label + ": negative runtime smoke must not expose output_text.");
  assert.equal(Object.hasOwn(smoke, "output_hash"), false, label + ": negative runtime smoke must not expose output_hash.");
  assert.equal(Object.hasOwn(smoke, "accepted_chatgpt_output_text"), false, label + ": negative runtime smoke must not expose accepted text.");
  assert.equal(Object.hasOwn(smoke, "final_smoke_output_text"), false, label + ": negative runtime smoke must not expose final smoke output.");
  assert.equal(Object.hasOwn(smoke, "reference_final_output_text"), false, label + ": negative runtime smoke must not expose seal reference text.");
  assert.equal(Object.hasOwn(smoke, "runtime_reference_output_text"), false, label + ": negative runtime smoke must not expose runtime reference text.");
}

function assertNoFallback(smoke, label) {
  assert.equal(smoke.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(smoke.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(smoke.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(smoke.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(smoke.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(smoke.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(smoke.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(smoke.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(smoke.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(smoke.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(smoke.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
}

function assertOutputSafety(smoke, label) {
  assert.equal(smoke.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(smoke.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(smoke.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(smoke.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(smoke.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");
  assert.equal(smoke.safety.candidate_only, true, label + ": safety candidate_only mismatch.");
  assert.equal(smoke.safety.no_candidate_save, true, label + ": safety no_candidate_save mismatch.");
  assert.equal(smoke.safety.no_approval, true, label + ": safety no_approval mismatch.");
  assert.equal(smoke.safety.no_adoption, true, label + ": safety no_adoption mismatch.");
  assert.equal(smoke.safety.no_canon_update, true, label + ": safety no_canon_update mismatch.");
  assert.equal(smoke.safety.no_active_engine_update, true, label + ": safety no_active_engine_update mismatch.");
  assert.equal(smoke.safety.can_modify_active_engine, false, label + ": safety can_modify_active_engine mismatch.");
  assert.equal(smoke.safety.can_update_canon, false, label + ": safety can_update_canon mismatch.");
  assert.equal(smoke.safety.can_confirm_adoption, false, label + ": safety can_confirm_adoption mismatch.");
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

function assertValidNegativeRuntimeSmokeIgnoresAllDecoys() {
  const rootText = "ROOT ONLY：Phase35B negative runtime smoke 真正可輸出值仍只來自 real action entrypoint。";
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
    "FORBIDDEN negative runtime smoke serialized text",
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
    final_closure_index: {
      output_text: forbiddenTexts[7],
      reference_final_output_text: forbiddenTexts[7],
    },
    operator_handoff_checklist: {
      output_text: forbiddenTexts[8],
      reference_final_output_text: forbiddenTexts[8],
    },
    live_acceptance_smoke: {
      accepted_chatgpt_output_text: forbiddenTexts[9],
      output_text: forbiddenTexts[9],
    },
    real_action_readiness: {
      accepted_chatgpt_output_text: forbiddenTexts[10],
      output_text: forbiddenTexts[10],
    },
    real_action_final_smoke: {
      final_smoke_output_text: forbiddenTexts[11],
      output_text: forbiddenTexts[11],
    },
    final_closure_seal: {
      reference_final_output_text: forbiddenTexts[12],
      output_text: forbiddenTexts[12],
    },
    operator_runtime_contract: {
      runtime_reference_output_text: forbiddenTexts[13],
      output_text: forbiddenTexts[13],
    },
    negative_runtime_smoke: {
      output_text: forbiddenTexts[14],
    },
  });

  const smoke = buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse);
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const seal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(smoke.used, true, "negative runtime: used mismatch.");
  assert.equal(smoke.phase, "35B", "negative runtime: phase mismatch.");
  assert.equal(smoke.surface_kind, "chatgpt_final_output_negative_runtime_smoke", "negative runtime: surface kind mismatch.");
  assert.equal(smoke.contract_valid, true, "negative runtime: contract should be valid.");
  assert.deepEqual(smoke.validation_errors, [], "negative runtime: validation errors should be empty.");
  assert.equal(smoke.status, "negative_runtime_smoke_passed", "negative runtime: status mismatch.");
  assert.equal(smoke.response_kind, "negative_runtime_smoke_reference", "negative runtime: response kind mismatch.");
  assert.equal(smoke.can_emit_response_to_chat, false, "negative runtime must not emit to chat.");
  assert.equal(smoke.can_output_to_chat, false, "negative runtime must not output to chat.");
  assert.equal(smoke.may_output_story_text, false, "negative runtime must not output story text.");
  assert.equal(smoke.phase_dependency, "35A", "negative runtime: phase dependency mismatch.");
  assert.equal(smoke.phase_range, "34J-35B", "negative runtime: phase range mismatch.");
  assert.equal(smoke.operator_runtime_contract, "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)", "negative runtime: operator contract reference mismatch.");
  assert.equal(smoke.final_closure_seal, "buildChatgptFinalOutputFinalClosureSeal(tool_response)", "negative runtime: final seal reference mismatch.");
  assert.equal(smoke.negative_runtime_required_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "negative runtime: required entrypoint mismatch.");
  assert.equal(smoke.negative_runtime_canonical_entrypoint, "emitChatgptFinalOutputText(tool_response)", "negative runtime: canonical entrypoint mismatch.");
  assert.equal(smoke.negative_runtime_required_root_field, "tool_response.chatgpt_final_output.output_text", "negative runtime: root field mismatch.");
  assert.equal(smoke.negative_runtime_must_call, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "negative runtime: must call mismatch.");
  assert.equal(smoke.negative_runtime_must_emit_exact_return_value, true, "negative runtime: exact return flag mismatch.");
  assert.equal(smoke.negative_runtime_decoy_isolation_required, true, "negative runtime: decoy isolation flag mismatch.");
  assert.equal(smoke.negative_runtime_smoke_passed, true, "negative runtime: smoke passed flag mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_negative_smoke, true, "negative runtime: self emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_runtime_contract, true, "negative runtime: runtime emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_final_seal, true, "negative runtime: final seal emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_final_smoke, true, "negative runtime: final smoke emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_readiness, true, "negative runtime: readiness emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_live_acceptance, true, "negative runtime: live acceptance emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_final_closure_index, true, "negative runtime: final closure index emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_operator_checklist, true, "negative runtime: operator checklist emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_emit_result_surface, true, "negative runtime: result emit guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_read_result, true, "negative runtime: result read guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_recompose_response, true, "negative runtime: recomposition guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_rewrite, true, "negative runtime: rewrite guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_summarize, true, "negative runtime: summarize guard mismatch.");
  assert.equal(smoke.negative_runtime_must_not_add_explanation, true, "negative runtime: add explanation guard mismatch.");
  assert.equal(smoke.negative_runtime_reference_output_hash, sha256(rootText), "negative runtime: output hash mismatch.");
  assert.equal(smoke.negative_runtime_reference_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "negative runtime: output source mismatch.");
  assert.equal(smoke.negative_runtime_output_matches_root, true, "negative runtime: root match flag mismatch.");
  assert.equal(smoke.negative_runtime_output_matches_canonical_emit, true, "negative runtime: canonical match flag mismatch.");
  assert.equal(smoke.negative_runtime_output_matches_final_seal_reference, true, "negative runtime: final seal match flag mismatch.");
  assert.equal(smoke.negative_runtime_output_matches_operator_runtime_contract, true, "negative runtime: operator runtime match flag mismatch.");
  assert.equal(smoke.negative_runtime_smoke_is_reference_only, true, "negative runtime: reference-only flag mismatch.");
  assert.equal(smoke.negative_runtime_smoke_must_not_replace_final_output, true, "negative runtime: replace guard mismatch.");
  assert.equal(smoke.negative_runtime_smoke_must_not_be_emitted_as_chat_output, true, "negative runtime: emit guard mismatch.");
  assert.equal(smoke.negative_runtime_smoke_adds_output_layer, false, "negative runtime: output layer mismatch.");
  assert.equal(smoke.no_new_output_layer, true, "negative runtime: no_new_output_layer mismatch.");
  assert.equal(smoke.negative_runtime_invalid_notice, null, "negative runtime: invalid notice should be null.");
  assert.deepEqual(smoke.forbidden_sources, expectedForbiddenSources, "negative runtime: forbidden sources mismatch.");

  assert.equal(finalText, rootText, "negative runtime: final entrypoint should return root text.");
  assert.equal(canonicalText, rootText, "negative runtime: canonical emit should return root text.");
  assert.equal(seal.reference_final_output_text, rootText, "negative runtime: seal reference should match root text.");
  assert.equal(runtimeContract.runtime_output_matches_root, true, "negative runtime: runtime contract root match mismatch.");

  const serialized = JSON.stringify(smoke);
  assert.equal(serialized.includes(rootText), false, "negative runtime smoke must not carry raw root story text.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(serialized.includes(forbidden), false, "negative runtime smoke must ignore decoy: " + forbidden);
  }

  assertNoOutputLayer(smoke, "valid negative runtime smoke");
  assertNoFallback(smoke, "valid negative runtime smoke");
  assertOutputSafety(smoke, "valid negative runtime smoke");
}

function assertInvalidNegativeRuntimeSmokeDoesNotEchoStoryText() {
  const invalid = buildChatgptFinalOutputNegativeRuntimeSmoke({});

  assert.equal(invalid.used, true, "invalid negative runtime: used mismatch.");
  assert.equal(invalid.phase, "35B", "invalid negative runtime: phase mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid negative runtime should be invalid.");
  assert.equal(invalid.status, "negative_runtime_smoke_failed", "invalid negative runtime status mismatch.");
  assert.equal(invalid.response_kind, "negative_runtime_smoke_invalid_reference", "invalid negative runtime response kind mismatch.");
  assert.equal(invalid.can_emit_response_to_chat, false, "invalid negative runtime must not emit to chat.");
  assert.equal(invalid.can_output_to_chat, false, "invalid negative runtime must not output to chat.");
  assert.equal(invalid.may_output_story_text, false, "invalid negative runtime must not output story text.");
  assert.equal(invalid.negative_runtime_reference_output_hash, null, "invalid negative runtime reference hash should be null.");
  assert.equal(invalid.negative_runtime_reference_output_source, null, "invalid negative runtime reference source should be null.");
  assert.equal(invalid.validation_errors.includes("operator_runtime_contract_invalid"), true, "invalid negative runtime missing operator runtime contract error.");
  assert.equal(invalid.validation_errors.includes("final_closure_seal_contract_invalid"), true, "invalid negative runtime missing final seal contract error.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid negative runtime missing root output error.");
  assert.equal(typeof invalid.negative_runtime_invalid_notice, "string", "invalid negative runtime should carry reference invalid notice.");
  assert.equal(invalid.negative_runtime_invalid_notice.includes("ChatGPT final output negative runtime smoke failed."), true, "invalid negative runtime notice mismatch.");
  assert.deepEqual(invalid.forbidden_sources, expectedForbiddenSources, "invalid negative runtime forbidden sources mismatch.");

  assertNoOutputLayer(invalid, "invalid negative runtime smoke");
  assertNoFallback(invalid, "invalid negative runtime smoke");
  assertOutputSafety(invalid, "invalid negative runtime smoke");

  const forbiddenStoryText = "這段正文候選不可被 Phase35B negative runtime smoke echo。";
  const invalidStory = buildChatgptFinalOutputNegativeRuntimeSmoke({
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
      final_closure_seal: {
        reference_final_output_text: forbiddenStoryText,
      },
      operator_runtime_contract: {
        runtime_reference_output_text: forbiddenStoryText,
      },
      negative_runtime_smoke: {
        output_text: forbiddenStoryText,
      },
    },
    created: [],
    warnings: [],
    blocked_reason: null,
  });

  assert.equal(invalidStory.contract_valid, false, "invalid story negative runtime should be invalid.");
  assert.equal(invalidStory.negative_runtime_reference_output_hash, null, "invalid story negative runtime reference hash should be null.");
  assert.equal(JSON.stringify(invalidStory).includes(forbiddenStoryText), false, "invalid negative runtime must not echo story text.");
  assertNoOutputLayer(invalidStory, "invalid story negative runtime smoke");
  assertNoFallback(invalidStory, "invalid story negative runtime smoke");
  assertOutputSafety(invalidStory, "invalid story negative runtime smoke");
}

assertValidNegativeRuntimeSmokeIgnoresAllDecoys();
assertInvalidNegativeRuntimeSmokeDoesNotEchoStoryText();

console.log("Phase35B ChatGPT real action final output negative runtime smoke tests passed.");