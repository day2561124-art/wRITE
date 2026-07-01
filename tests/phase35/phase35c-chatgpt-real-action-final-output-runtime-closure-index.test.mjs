import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputNegativeRuntimeSmoke,
  buildChatgptFinalOutputOperatorRuntimeContract,
  buildChatgptFinalOutputRuntimeClosureIndex,
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
  "buildChatgptFinalOutputRuntimeClosureIndex(tool_response)",
];

function assertNoOutputLayer(index, label) {
  assert.equal(Object.hasOwn(index, "output_text"), false, label + ": runtime closure index must not expose output_text.");
  assert.equal(Object.hasOwn(index, "output_hash"), false, label + ": runtime closure index must not expose output_hash.");
  assert.equal(Object.hasOwn(index, "accepted_chatgpt_output_text"), false, label + ": runtime closure index must not expose accepted text.");
  assert.equal(Object.hasOwn(index, "final_smoke_output_text"), false, label + ": runtime closure index must not expose final smoke output.");
  assert.equal(Object.hasOwn(index, "reference_final_output_text"), false, label + ": runtime closure index must not expose seal reference text.");
  assert.equal(Object.hasOwn(index, "runtime_reference_output_text"), false, label + ": runtime closure index must not expose runtime reference text.");
  assert.equal(Object.hasOwn(index, "negative_runtime_reference_output_text"), false, label + ": runtime closure index must not expose negative runtime reference text.");
  assert.equal(Object.hasOwn(index, "runtime_closure_reference_output_text"), false, label + ": runtime closure index must not expose closure reference text.");
}

function assertNoFallback(index, label) {
  assert.equal(index.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(index.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(index.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(index.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(index.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(index.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(index.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(index.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(index.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(index.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(index.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(index.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(index.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(index.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
}

function assertOutputSafety(index, label) {
  assert.equal(index.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(index.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(index.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(index.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(index.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");
  assert.equal(index.safety.candidate_only, true, label + ": safety candidate_only mismatch.");
  assert.equal(index.safety.no_candidate_save, true, label + ": safety no_candidate_save mismatch.");
  assert.equal(index.safety.no_approval, true, label + ": safety no_approval mismatch.");
  assert.equal(index.safety.no_adoption, true, label + ": safety no_adoption mismatch.");
  assert.equal(index.safety.no_canon_update, true, label + ": safety no_canon_update mismatch.");
  assert.equal(index.safety.no_active_engine_update, true, label + ": safety no_active_engine_update mismatch.");
  assert.equal(index.safety.can_modify_active_engine, false, label + ": safety can_modify_active_engine mismatch.");
  assert.equal(index.safety.can_update_canon, false, label + ": safety can_update_canon mismatch.");
  assert.equal(index.safety.can_confirm_adoption, false, label + ": safety can_confirm_adoption mismatch.");
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

function assertValidRuntimeClosureIndex() {
  const rootText = "ROOT ONLY：Phase35C runtime closure index 只能證明，不可輸出這段正文。";
  const forbiddenTexts = [
    "FORBIDDEN tool_response.result",
    "FORBIDDEN result.final_candidate_text",
    "FORBIDDEN success_output_for_chat",
    "FORBIDDEN failure_output_for_chat",
    "FORBIDDEN final_response_for_chat",
    "FORBIDDEN final_response_handoff_for_chat",
    "FORBIDDEN extracted_chatgpt_final_output",
    "FORBIDDEN runtime contract serialized text",
    "FORBIDDEN negative runtime smoke serialized text",
    "FORBIDDEN runtime closure index serialized text",
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
    operator_runtime_contract: {
      output_text: forbiddenTexts[7],
      runtime_reference_output_text: forbiddenTexts[7],
    },
    negative_runtime_smoke: {
      output_text: forbiddenTexts[8],
      negative_runtime_reference_output_text: forbiddenTexts[8],
    },
    runtime_closure_index: {
      output_text: forbiddenTexts[9],
      runtime_closure_reference_output_text: forbiddenTexts[9],
    },
  });

  const index = buildChatgptFinalOutputRuntimeClosureIndex(toolResponse);
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const negativeSmoke = buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(index.used, true, "index: used mismatch.");
  assert.equal(index.phase, "35C", "index: phase mismatch.");
  assert.equal(index.surface_kind, "chatgpt_final_output_runtime_closure_index", "index: surface kind mismatch.");
  assert.equal(index.contract_valid, true, "index: contract should be valid.");
  assert.deepEqual(index.validation_errors, [], "index: validation errors should be empty.");
  assert.equal(index.status, "runtime_closure_index_ready", "index: status mismatch.");
  assert.equal(index.response_kind, "runtime_closure_index_reference", "index: response kind mismatch.");
  assert.equal(index.can_emit_response_to_chat, false, "index must not emit to chat.");
  assert.equal(index.can_output_to_chat, false, "index must not output to chat.");
  assert.equal(index.may_output_story_text, false, "index must not output story text.");
  assert.equal(index.phase_range, "35A-35B", "index: phase range mismatch.");
  assert.equal(index.phase_dependency, "35B", "index: phase dependency mismatch.");
  assert.equal(index.closure_scope, "chatgpt_real_action_final_output_runtime", "index: closure scope mismatch.");
  assert.equal(index.runtime_final_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "index: final entrypoint mismatch.");
  assert.equal(index.runtime_canonical_entrypoint, "emitChatgptFinalOutputText(tool_response)", "index: canonical entrypoint mismatch.");
  assert.equal(index.root_consumable_field, "tool_response.chatgpt_final_output.output_text", "index: root field mismatch.");

  assert.deepEqual(
    index.runtime_closure_index_entries.map((entry) => entry.phase),
    ["35A", "35B"],
    "index: entry phase order mismatch.",
  );

  for (const entry of index.runtime_closure_index_entries) {
    assert.equal(typeof entry.name, "string", "index entry name should be string.");
    assert.equal(typeof entry.test_path, "string", "index entry test path should be string.");
    assert.equal(typeof entry.role, "string", "index entry role should be string.");
    assert.equal(typeof entry.reference, "string", "index entry reference should be string.");
  }

  assert.equal(index.runtime_closure_index_is_reference_only, true, "index: reference-only flag mismatch.");
  assert.equal(index.runtime_closure_index_must_not_replace_final_output, true, "index: replace guard mismatch.");
  assert.equal(index.runtime_closure_index_must_not_be_emitted_as_chat_output, true, "index: emit guard mismatch.");
  assert.equal(index.runtime_closure_index_may_not_be_read_for_chat_output, true, "index: read guard mismatch.");
  assert.equal(index.runtime_output_must_still_use_entrypoint, true, "index: output entrypoint guard mismatch.");
  assert.equal(index.runtime_closure_index_adds_output_layer, false, "index: adds output layer mismatch.");
  assert.equal(index.no_new_output_layer, true, "index: no_new_output_layer mismatch.");
  assert.equal(index.runtime_must_emit_exact_return_value, true, "index: exact return guard mismatch.");
  assert.equal(index.runtime_must_not_emit_runtime_contract, true, "index: runtime contract emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_negative_smoke, true, "index: negative smoke emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_runtime_closure_index, true, "index: self emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_final_seal, true, "index: final seal emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_final_smoke, true, "index: final smoke emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_readiness, true, "index: readiness emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_live_acceptance, true, "index: live acceptance emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_final_closure_index, true, "index: phase34 final closure index emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_operator_checklist, true, "index: checklist emit guard mismatch.");
  assert.equal(index.runtime_must_not_emit_result_surface, true, "index: result emit guard mismatch.");
  assert.equal(index.runtime_must_not_read_result, true, "index: result read guard mismatch.");
  assert.equal(index.runtime_must_not_recompose_response, true, "index: recomposition guard mismatch.");
  assert.equal(index.runtime_must_not_rewrite, true, "index: rewrite guard mismatch.");
  assert.equal(index.runtime_must_not_summarize, true, "index: summarize guard mismatch.");
  assert.equal(index.runtime_must_not_add_explanation, true, "index: explanation guard mismatch.");
  assert.equal(index.runtime_closure_reference_output_hash, sha256(rootText), "index: output hash mismatch.");
  assert.equal(index.runtime_closure_reference_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "index: output source mismatch.");
  assert.equal(index.runtime_closure_output_matches_root, true, "index: root match flag mismatch.");
  assert.equal(index.runtime_closure_output_matches_canonical_emit, true, "index: canonical match flag mismatch.");
  assert.equal(index.runtime_closure_output_matches_operator_runtime_contract, true, "index: runtime contract match flag mismatch.");
  assert.equal(index.runtime_closure_output_matches_negative_runtime_smoke, true, "index: negative smoke match flag mismatch.");
  assert.equal(index.runtime_closure_invalid_notice, null, "index: invalid notice should be null.");
  assert.deepEqual(index.forbidden_sources, expectedForbiddenSources, "index: forbidden sources mismatch.");

  assert.equal(finalText, rootText, "index: final entrypoint should return root text.");
  assert.equal(canonicalText, rootText, "index: canonical emit should return root text.");
  assert.equal(runtimeContract.runtime_output_matches_root, true, "index: runtime contract root match mismatch.");
  assert.equal(negativeSmoke.negative_runtime_output_matches_root, true, "index: negative runtime root match mismatch.");

  const serialized = JSON.stringify(index);
  assert.equal(serialized.includes(rootText), false, "runtime closure index must not carry raw root story text.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(serialized.includes(forbidden), false, "runtime closure index must ignore decoy: " + forbidden);
  }

  assertNoOutputLayer(index, "valid runtime closure index");
  assertNoFallback(index, "valid runtime closure index");
  assertOutputSafety(index, "valid runtime closure index");
}

function assertInvalidRuntimeClosureIndexDoesNotEchoStoryText() {
  const invalid = buildChatgptFinalOutputRuntimeClosureIndex({});

  assert.equal(invalid.used, true, "invalid index: used mismatch.");
  assert.equal(invalid.phase, "35C", "invalid index: phase mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid index should be invalid.");
  assert.equal(invalid.status, "runtime_closure_index_invalid", "invalid index status mismatch.");
  assert.equal(invalid.response_kind, "runtime_closure_index_invalid_reference", "invalid index response kind mismatch.");
  assert.equal(invalid.can_emit_response_to_chat, false, "invalid index must not emit to chat.");
  assert.equal(invalid.can_output_to_chat, false, "invalid index must not output to chat.");
  assert.equal(invalid.may_output_story_text, false, "invalid index must not output story text.");
  assert.equal(invalid.runtime_closure_reference_output_hash, null, "invalid index reference hash should be null.");
  assert.equal(invalid.runtime_closure_reference_output_source, null, "invalid index reference source should be null.");
  assert.equal(invalid.validation_errors.includes("operator_runtime_contract_invalid"), true, "invalid index missing runtime contract error.");
  assert.equal(invalid.validation_errors.includes("negative_runtime_smoke_invalid"), true, "invalid index missing negative smoke error.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid index missing root output error.");
  assert.equal(typeof invalid.runtime_closure_invalid_notice, "string", "invalid index should carry reference invalid notice.");
  assert.equal(invalid.runtime_closure_invalid_notice.includes("ChatGPT final output runtime closure index invalid."), true, "invalid index notice mismatch.");
  assert.deepEqual(invalid.forbidden_sources, expectedForbiddenSources, "invalid index forbidden sources mismatch.");

  assertNoOutputLayer(invalid, "invalid runtime closure index");
  assertNoFallback(invalid, "invalid runtime closure index");
  assertOutputSafety(invalid, "invalid runtime closure index");

  const forbiddenStoryText = "這段正文候選不可被 Phase35C runtime closure index echo。";
  const invalidStory = buildChatgptFinalOutputRuntimeClosureIndex({
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
      operator_runtime_contract: {
        runtime_reference_output_text: forbiddenStoryText,
      },
      negative_runtime_smoke: {
        negative_runtime_reference_output_text: forbiddenStoryText,
      },
      runtime_closure_index: {
        runtime_closure_reference_output_text: forbiddenStoryText,
      },
    },
    created: [],
    warnings: [],
    blocked_reason: null,
  });

  assert.equal(invalidStory.contract_valid, false, "invalid story index should be invalid.");
  assert.equal(invalidStory.runtime_closure_reference_output_hash, null, "invalid story index reference hash should be null.");
  assert.equal(JSON.stringify(invalidStory).includes(forbiddenStoryText), false, "invalid runtime closure index must not echo story text.");
  assertNoOutputLayer(invalidStory, "invalid story runtime closure index");
  assertNoFallback(invalidStory, "invalid story runtime closure index");
  assertOutputSafety(invalidStory, "invalid story runtime closure index");
}

assertValidRuntimeClosureIndex();
assertInvalidRuntimeClosureIndexDoesNotEchoStoryText();

console.log("Phase35C ChatGPT real action final output runtime closure index tests passed.");