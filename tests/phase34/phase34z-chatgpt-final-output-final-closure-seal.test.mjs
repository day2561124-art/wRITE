import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputFinalClosureSeal,
  buildChatgptFinalOutputRealActionFinalSmoke,
  emitChatgptFinalOutputText,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

const expectedPhases = [
  "34J", "34K", "34L", "34M", "34N", "34O", "34P", "34Q", "34R",
  "34S", "34T", "34U", "34V", "34W", "34X", "34Y",
];

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
];

function assertNoOutputLayer(seal, label) {
  assert.equal(Object.hasOwn(seal, "output_text"), false, label + ": seal must not expose output_text.");
  assert.equal(Object.hasOwn(seal, "output_hash"), false, label + ": seal must not expose output_hash.");
  assert.equal(Object.hasOwn(seal, "final_smoke_output_text"), false, label + ": seal must not expose final_smoke_output_text.");
  assert.equal(Object.hasOwn(seal, "accepted_chatgpt_output_text"), false, label + ": seal must not expose accepted_chatgpt_output_text.");
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

function assertValidSealIgnoresAllDecoys() {
  const rootText = "ROOT ONLY：Phase34Z final closure seal 只能參照這一段，但不能自己 emit。";
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
  });

  const seal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalSmoke = buildChatgptFinalOutputRealActionFinalSmoke(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(seal.used, true, "seal: used mismatch.");
  assert.equal(seal.phase, "34Z", "seal: phase mismatch.");
  assert.equal(seal.surface_kind, "chatgpt_final_output_final_closure_seal", "seal: surface kind mismatch.");
  assert.equal(seal.contract_valid, true, "seal: contract should be valid.");
  assert.deepEqual(seal.validation_errors, [], "seal: validation errors should be empty.");
  assert.equal(seal.status, "final_output_final_closure_sealed", "seal: status mismatch.");
  assert.equal(seal.response_kind, "final_closure_seal_reference", "seal: response kind mismatch.");
  assert.equal(seal.can_emit_response_to_chat, false, "seal must not emit response to chat.");
  assert.equal(seal.can_output_to_chat, false, "seal must not output to chat.");
  assert.equal(seal.may_output_story_text, false, "seal must not output story text.");
  assert.equal(seal.phase_range, "34J-34Y", "seal: phase range mismatch.");
  assert.deepEqual(seal.covered_phases, expectedPhases, "seal: covered phases mismatch.");
  assert.equal(seal.final_smoke_endpoint_phase, "34Y", "seal: final endpoint phase mismatch.");
  assert.equal(seal.final_smoke_endpoint, "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)", "seal: final smoke endpoint mismatch.");
  assert.equal(seal.real_action_final_smoke, "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)", "seal: real action final smoke mismatch.");
  assert.equal(seal.final_unique_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "seal: unique entrypoint mismatch.");
  assert.equal(seal.final_action_output_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "seal: action entrypoint mismatch.");
  assert.equal(seal.canonical_final_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", "seal: canonical entrypoint mismatch.");
  assert.equal(seal.root_consumable_field, "tool_response.chatgpt_final_output.output_text", "seal: root consumable field mismatch.");
  assert.equal(seal.reference_final_output_text, rootText, "seal: reference text must equal root text.");
  assert.equal(seal.reference_final_output_text, finalText, "seal: reference text must equal final entrypoint.");
  assert.equal(seal.reference_final_output_text, canonicalText, "seal: reference text must equal canonical emit.");
  assert.equal(seal.reference_final_output_text, finalSmoke.final_smoke_output_text, "seal: reference text must equal final smoke output.");
  assert.equal(seal.reference_final_output_hash, sha256(rootText), "seal: reference hash mismatch.");
  assert.equal(seal.reference_final_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", "seal: reference source mismatch.");
  assert.equal(seal.reference_final_output_matches_root, true, "seal: root match flag mismatch.");
  assert.equal(seal.reference_final_output_matches_canonical_emit, true, "seal: canonical match flag mismatch.");
  assert.equal(seal.reference_final_output_matches_final_smoke, true, "seal: final smoke match flag mismatch.");
  assert.equal(seal.final_seal_is_reference_only, true, "seal: reference-only flag mismatch.");
  assert.equal(seal.final_seal_must_not_replace_final_output, true, "seal: replace guard mismatch.");
  assert.equal(seal.final_seal_must_not_be_emitted_as_chat_output, true, "seal: emit guard mismatch.");
  assert.equal(seal.final_seal_may_not_be_read_for_chat_output, true, "seal: read guard mismatch.");
  assert.equal(seal.final_output_must_still_use_entrypoint, true, "seal: final output entrypoint guard mismatch.");
  assert.equal(seal.final_seal_adds_output_layer, false, "seal: must not add output layer.");
  assert.equal(seal.no_new_output_layer, true, "seal: no_new_output_layer mismatch.");
  assert.equal(seal.seal_contract_invalid_notice, null, "seal: invalid notice should be null.");
  assert.deepEqual(seal.forbidden_sources, expectedForbiddenSources, "seal: forbidden sources mismatch.");
  assert.deepEqual(seal.final_closure_seal_entries.map((entry) => entry.phase), expectedPhases, "seal: entry phases mismatch.");

  for (const entry of seal.final_closure_seal_entries) {
    assert.equal(typeof entry.name, "string", "seal entry name should be string.");
    assert.equal(typeof entry.test_path, "string", "seal entry test path should be string.");
    assert.equal(typeof entry.role, "string", "seal entry role should be string.");
  }

  for (const forbidden of forbiddenTexts) {
    assert.equal(seal.reference_final_output_text.includes(forbidden), false, "seal reference must ignore decoy: " + forbidden);
  }

  assertNoOutputLayer(seal, "valid seal");
  assertNoFallback(seal, "valid seal");
  assertOutputSafety(seal, "valid seal");
}

function assertInvalidSealDoesNotEmitStoryOrNoticeAsOutput() {
  const invalid = buildChatgptFinalOutputFinalClosureSeal({});

  assert.equal(invalid.used, true, "invalid seal: used mismatch.");
  assert.equal(invalid.phase, "34Z", "invalid seal: phase mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid seal should be invalid.");
  assert.equal(invalid.status, "final_output_final_closure_seal_invalid", "invalid seal status mismatch.");
  assert.equal(invalid.response_kind, "final_closure_seal_invalid_reference", "invalid seal response kind mismatch.");
  assert.equal(invalid.can_emit_response_to_chat, false, "invalid seal must not emit to chat.");
  assert.equal(invalid.can_output_to_chat, false, "invalid seal must not output to chat.");
  assert.equal(invalid.may_output_story_text, false, "invalid seal must not output story text.");
  assert.equal(invalid.reference_final_output_text, null, "invalid seal reference text should be null.");
  assert.equal(invalid.reference_final_output_hash, null, "invalid seal reference hash should be null.");
  assert.equal(invalid.reference_final_output_source, null, "invalid seal reference source should be null.");
  assert.equal(invalid.validation_errors.includes("real_action_final_smoke_contract_invalid"), true, "invalid seal missing final smoke contract error.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid seal missing root output error.");
  assert.equal(typeof invalid.seal_contract_invalid_notice, "string", "invalid seal should carry reference invalid notice.");
  assert.equal(invalid.seal_contract_invalid_notice.includes("ChatGPT final output final closure seal invalid."), true, "invalid seal notice mismatch.");
  assert.deepEqual(invalid.forbidden_sources, expectedForbiddenSources, "invalid seal forbidden sources mismatch.");

  assertNoOutputLayer(invalid, "invalid seal");
  assertNoFallback(invalid, "invalid seal");
  assertOutputSafety(invalid, "invalid seal");

  const forbiddenStoryText = "這段正文候選不可被 Phase34Z final seal echo。";
  const invalidStory = buildChatgptFinalOutputFinalClosureSeal({
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

  assert.equal(invalidStory.contract_valid, false, "invalid story seal should be invalid.");
  assert.equal(invalidStory.reference_final_output_text, null, "invalid story seal reference must be null.");
  assert.equal(invalidStory.seal_contract_invalid_notice.includes(forbiddenStoryText), false, "invalid seal notice must not echo story text.");
  assertNoOutputLayer(invalidStory, "invalid story seal");
  assertNoFallback(invalidStory, "invalid story seal");
  assertOutputSafety(invalidStory, "invalid story seal");
}

assertValidSealIgnoresAllDecoys();
assertInvalidSealDoesNotEmitStoryOrNoticeAsOutput();

console.log("Phase34Z ChatGPT final output final closure seal tests passed.");