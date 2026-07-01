import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputNegativeRuntimeSmoke,
  buildChatgptFinalOutputOperatorRuntimeContract,
  buildChatgptFinalOutputRuntimeClosureIndex,
  buildChatgptFinalOutputRuntimeFinalSeal,
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
  "buildChatgptFinalOutputRuntimeFinalSeal(tool_response)",
];

function assertNoOutputLayer(seal, label) {
  assert.equal(Object.hasOwn(seal, "output_text"), false, label + ": runtime final seal must not expose output_text.");
  assert.equal(Object.hasOwn(seal, "output_hash"), false, label + ": runtime final seal must not expose output_hash.");
  assert.equal(Object.hasOwn(seal, "accepted_chatgpt_output_text"), false, label + ": runtime final seal must not expose accepted text.");
  assert.equal(Object.hasOwn(seal, "final_smoke_output_text"), false, label + ": runtime final seal must not expose final smoke output.");
  assert.equal(Object.hasOwn(seal, "reference_final_output_text"), false, label + ": runtime final seal must not expose seal reference text.");
  assert.equal(Object.hasOwn(seal, "runtime_reference_output_text"), false, label + ": runtime final seal must not expose runtime reference text.");
  assert.equal(Object.hasOwn(seal, "negative_runtime_reference_output_text"), false, label + ": runtime final seal must not expose negative runtime reference text.");
  assert.equal(Object.hasOwn(seal, "runtime_closure_reference_output_text"), false, label + ": runtime final seal must not expose closure reference text.");
  assert.equal(Object.hasOwn(seal, "runtime_final_seal_reference_output_text"), false, label + ": runtime final seal must not expose final seal reference text.");
}

function assertNoFallback(seal, label) {
  assert.equal(seal.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(seal.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(seal.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(seal.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(seal.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(seal.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(seal.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(seal.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(seal.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(seal.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(seal.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(seal.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(seal.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(seal.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
}

function assertOutputSafety(seal, label) {
  assert.equal(seal.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(seal.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(seal.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(seal.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(seal.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");
  assert.equal(seal.safety.candidate_only, true, label + ": safety candidate_only mismatch.");
  assert.equal(seal.safety.no_candidate_save, true, label + ": safety no_candidate_save mismatch.");
  assert.equal(seal.safety.no_approval, true, label + ": safety no_approval mismatch.");
  assert.equal(seal.safety.no_adoption, true, label + ": safety no_adoption mismatch.");
  assert.equal(seal.safety.no_canon_update, true, label + ": safety no_canon_update mismatch.");
  assert.equal(seal.safety.no_active_engine_update, true, label + ": safety no_active_engine_update mismatch.");
  assert.equal(seal.safety.can_modify_active_engine, false, label + ": safety can_modify_active_engine mismatch.");
  assert.equal(seal.safety.can_update_canon, false, label + ": safety can_update_canon mismatch.");
  assert.equal(seal.safety.can_confirm_adoption, false, label + ": safety can_confirm_adoption mismatch.");
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

function assertValidRuntimeFinalSeal() {
  const rootText = "ROOT ONLY：Phase35D runtime final seal 只能封印，不可輸出這段正文。";
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
    "FORBIDDEN runtime final seal serialized text",
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
    runtime_final_seal: {
      output_text: forbiddenTexts[10],
      runtime_final_seal_reference_output_text: forbiddenTexts[10],
    },
  });

  const seal = buildChatgptFinalOutputRuntimeFinalSeal(toolResponse);
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const negativeSmoke = buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse);
  const runtimeClosureIndex = buildChatgptFinalOutputRuntimeClosureIndex(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(seal.used, true, "seal: used mismatch.");
  assert.equal(seal.phase, "35D", "seal: phase mismatch.");
  assert.equal(seal.surface_kind, "chatgpt_final_output_runtime_final_seal", "seal: surface kind mismatch.");
  assert.equal(seal.contract_valid, true, "seal: contract should be valid.");
  assert.deepEqual(seal.validation_errors, [], "seal: validation errors should be empty.");
  assert.equal(seal.status, "runtime_final_seal_closed", "seal: status mismatch.");
  assert.equal(seal.response_kind, "runtime_final_seal_reference", "seal: response kind mismatch.");
  assert.equal(seal.can_emit_response_to_chat, false, "seal must not emit to chat.");
  assert.equal(seal.can_output_to_chat, false, "seal must not output to chat.");
  assert.equal(seal.may_output_story_text, false, "seal must not output story text.");
  assert.equal(seal.phase_range, "35A-35C", "seal: phase range mismatch.");
  assert.equal(seal.phase_dependency, "35C", "seal: phase dependency mismatch.");
  assert.equal(seal.seal_scope, "chatgpt_real_action_final_output_runtime", "seal: scope mismatch.");
  assert.equal(seal.runtime_final_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "seal: final entrypoint mismatch.");
  assert.equal(seal.runtime_canonical_entrypoint, "emitChatgptFinalOutputText(tool_response)", "seal: canonical entrypoint mismatch.");
  assert.equal(seal.root_consumable_field, "tool_response.chatgpt_final_output.output_text", "seal: root field mismatch.");

  assert.deepEqual(
    seal.runtime_final_seal_entries.map((entry) => entry.phase),
    ["35A", "35B", "35C"],
    "seal: entry phase order mismatch.",
  );

  for (const entry of seal.runtime_final_seal_entries) {
    assert.equal(typeof entry.name, "string", "seal entry name should be string.");
    assert.equal(typeof entry.test_path, "string", "seal entry test path should be string.");
    assert.equal(typeof entry.role, "string", "seal entry role should be string.");
    assert.equal(typeof entry.reference, "string", "seal entry reference should be string.");
  }

  assert.equal(seal.runtime_final_seal_is_reference_only, true, "seal: reference-only flag mismatch.");
  assert.equal(seal.runtime_final_seal_must_not_replace_final_output, true, "seal: replace guard mismatch.");
  assert.equal(seal.runtime_final_seal_must_not_be_emitted_as_chat_output, true, "seal: emit guard mismatch.");
  assert.equal(seal.runtime_final_seal_may_not_be_read_for_chat_output, true, "seal: read guard mismatch.");
  assert.equal(seal.runtime_output_must_still_use_entrypoint, true, "seal: output entrypoint guard mismatch.");
  assert.equal(seal.runtime_final_seal_adds_output_layer, false, "seal: adds output layer mismatch.");
  assert.equal(seal.no_new_output_layer, true, "seal: no_new_output_layer mismatch.");
  assert.equal(seal.runtime_must_emit_exact_return_value, true, "seal: exact return guard mismatch.");
  assert.equal(seal.runtime_must_not_emit_runtime_contract, true, "seal: runtime contract emit guard mismatch.");
  assert.equal(seal.runtime_must_not_emit_negative_smoke, true, "seal: negative smoke emit guard mismatch.");
  assert.equal(seal.runtime_must_not_emit_runtime_closure_index, true, "seal: closure index emit guard mismatch.");
  assert.equal(seal.runtime_must_not_emit_runtime_final_seal, true, "seal: self emit guard mismatch.");
  assert.equal(seal.runtime_must_not_emit_result_surface, true, "seal: result emit guard mismatch.");
  assert.equal(seal.runtime_must_not_read_result, true, "seal: result read guard mismatch.");
  assert.equal(seal.runtime_must_not_recompose_response, true, "seal: recomposition guard mismatch.");
  assert.equal(seal.runtime_must_not_rewrite, true, "seal: rewrite guard mismatch.");
  assert.equal(seal.runtime_must_not_summarize, true, "seal: summarize guard mismatch.");
  assert.equal(seal.runtime_must_not_add_explanation, true, "seal: explanation guard mismatch.");
  assert.equal(seal.runtime_final_seal_reference_output_hash, sha256(rootText), "seal: output hash mismatch.");
  assert.equal(seal.runtime_final_seal_reference_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "seal: output source mismatch.");
  assert.equal(seal.runtime_final_seal_output_matches_root, true, "seal: root match flag mismatch.");
  assert.equal(seal.runtime_final_seal_output_matches_canonical_emit, true, "seal: canonical match flag mismatch.");
  assert.equal(seal.runtime_final_seal_output_matches_operator_runtime_contract, true, "seal: runtime contract match flag mismatch.");
  assert.equal(seal.runtime_final_seal_output_matches_negative_runtime_smoke, true, "seal: negative smoke match flag mismatch.");
  assert.equal(seal.runtime_final_seal_output_matches_runtime_closure_index, true, "seal: closure index match flag mismatch.");
  assert.equal(seal.runtime_final_seal_invalid_notice, null, "seal: invalid notice should be null.");
  assert.deepEqual(seal.forbidden_sources, expectedForbiddenSources, "seal: forbidden sources mismatch.");

  assert.equal(finalText, rootText, "seal: final entrypoint should return root text.");
  assert.equal(canonicalText, rootText, "seal: canonical emit should return root text.");
  assert.equal(runtimeContract.runtime_output_matches_root, true, "seal: runtime contract root match mismatch.");
  assert.equal(negativeSmoke.negative_runtime_output_matches_root, true, "seal: negative runtime root match mismatch.");
  assert.equal(runtimeClosureIndex.runtime_closure_output_matches_root, true, "seal: runtime closure index root match mismatch.");

  const serialized = JSON.stringify(seal);
  assert.equal(serialized.includes(rootText), false, "runtime final seal must not carry raw root story text.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(serialized.includes(forbidden), false, "runtime final seal must ignore decoy: " + forbidden);
  }

  assertNoOutputLayer(seal, "valid runtime final seal");
  assertNoFallback(seal, "valid runtime final seal");
  assertOutputSafety(seal, "valid runtime final seal");
}

function assertInvalidRuntimeFinalSealDoesNotEchoStoryText() {
  const invalid = buildChatgptFinalOutputRuntimeFinalSeal({});

  assert.equal(invalid.used, true, "invalid seal: used mismatch.");
  assert.equal(invalid.phase, "35D", "invalid seal: phase mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid seal should be invalid.");
  assert.equal(invalid.status, "runtime_final_seal_invalid", "invalid seal status mismatch.");
  assert.equal(invalid.response_kind, "runtime_final_seal_invalid_reference", "invalid seal response kind mismatch.");
  assert.equal(invalid.can_emit_response_to_chat, false, "invalid seal must not emit to chat.");
  assert.equal(invalid.can_output_to_chat, false, "invalid seal must not output to chat.");
  assert.equal(invalid.may_output_story_text, false, "invalid seal must not output story text.");
  assert.equal(invalid.runtime_final_seal_reference_output_hash, null, "invalid seal reference hash should be null.");
  assert.equal(invalid.runtime_final_seal_reference_output_source, null, "invalid seal reference source should be null.");
  assert.equal(invalid.validation_errors.includes("operator_runtime_contract_invalid"), true, "invalid seal missing runtime contract error.");
  assert.equal(invalid.validation_errors.includes("negative_runtime_smoke_invalid"), true, "invalid seal missing negative smoke error.");
  assert.equal(invalid.validation_errors.includes("runtime_closure_index_invalid"), true, "invalid seal missing closure index error.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid seal missing root output error.");
  assert.equal(typeof invalid.runtime_final_seal_invalid_notice, "string", "invalid seal should carry reference invalid notice.");
  assert.equal(invalid.runtime_final_seal_invalid_notice.includes("ChatGPT final output runtime final seal invalid."), true, "invalid seal notice mismatch.");
  assert.deepEqual(invalid.forbidden_sources, expectedForbiddenSources, "invalid seal forbidden sources mismatch.");

  assertNoOutputLayer(invalid, "invalid runtime final seal");
  assertNoFallback(invalid, "invalid runtime final seal");
  assertOutputSafety(invalid, "invalid runtime final seal");

  const forbiddenStoryText = "這段正文候選不可被 Phase35D runtime final seal echo。";
  const invalidStory = buildChatgptFinalOutputRuntimeFinalSeal({
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
      runtime_final_seal: {
        runtime_final_seal_reference_output_text: forbiddenStoryText,
      },
    },
    created: [],
    warnings: [],
    blocked_reason: null,
  });

  assert.equal(invalidStory.contract_valid, false, "invalid story seal should be invalid.");
  assert.equal(invalidStory.runtime_final_seal_reference_output_hash, null, "invalid story seal reference hash should be null.");
  assert.equal(JSON.stringify(invalidStory).includes(forbiddenStoryText), false, "invalid runtime final seal must not echo story text.");
  assertNoOutputLayer(invalidStory, "invalid story runtime final seal");
  assertNoFallback(invalidStory, "invalid story runtime final seal");
  assertOutputSafety(invalidStory, "invalid story runtime final seal");
}

assertValidRuntimeFinalSeal();
assertInvalidRuntimeFinalSealDoesNotEchoStoryText();

console.log("Phase35D ChatGPT real action final output runtime final seal tests passed.");