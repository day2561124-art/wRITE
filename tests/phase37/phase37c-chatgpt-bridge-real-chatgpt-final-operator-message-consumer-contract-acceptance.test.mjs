import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptOperatorCompactDiagnosticsFromRealChatgptFinalOperatorMessageConsumerContractAcceptance,
  buildChatgptOperatorCompactDiagnosticsRealChatgptFinalOperatorMessageConsumerContractAcceptance,
  chatgpt_bridge_run_full_neural_writing_pipeline,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();

const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "門內傳來敲擊聲。三下，停一下，再三下。",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase37C real ChatGPT final operator message consumer contract acceptance deterministic test.",
  generation_context: {
    scene: "red door access light",
    chapter_turn: "door route is folded toward old training ground",
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
  },
  character_names: ["千夜", "九逃"],
  reader_response_conflict_plan: {
    protagonist: "千夜",
    protagonist_want: "判斷門禁陷阱真正的路線",
    opposition: "被偽裝成普通門禁的折返陷阱",
    opposition_pressure: "門禁燈倒數、退路被折向舊訓練場",
    stakes: "走錯會把主角群送進預設伏擊點",
    reversal_or_reveal: "門不是封閉退路，而是在折疊退路方向",
    required_choice: "千夜必須停下來觀察而不是立刻硬闖",
    cost_or_payment: "拖延讓門內的人先一步知道他們的位置",
    new_status_quo: "隊伍被迫承認敵人能預判他們的路線",
    ending_hook: "門內敲擊聲變成倒數",
  },
  reader_questions_to_carry_forward: ["門內的人為什麼知道倒數節奏？"],
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫。",
      "結尾必須留下事件鉤子，不靠漂亮句子收尾。",
    ],
  },
};

const options = {
  characterMindStateLedger: {
    version: "phase37c-test-ledger-v1",
    updated_at: "2026-07-03T00:00:00.000Z",
    characters: [
      {
        character_name: "千夜",
        current_emotion: "警戒但冷靜",
        body_state: "蹲下觀察門縫靈力粉塵",
        unspoken_pressure: "不想讓隊伍被門禁陷阱牽著走",
        recent_event_traces: ["門禁燈第三次閃紅"],
        relationship_attitudes: { "九逃": "信任對方會立刻跟上自己的判斷" },
        visible_reactions_allowed: ["停步", "蹲下", "壓低聲音說明觀察結果"],
        hidden_reactions_reserved: ["對門內倒數聲感到不安"],
        continuity_constraints: ["不得把門禁陷阱當作普通行政流程處理"],
        evidence_refs: ["phase37c-smoke"],
      },
      {
        character_name: "九逃",
        current_emotion: "焦躁且戒備",
        body_state: "壓低聲音、注意退路",
        unspoken_pressure: "擔心千夜判斷太晚但仍選擇配合",
        recent_event_traces: ["退路被折向舊訓練場"],
        relationship_attitudes: { "千夜": "嘴上質疑但行動上配合" },
        visible_reactions_allowed: ["壓低聲音吐槽", "觀察終端地圖"],
        hidden_reactions_reserved: ["意識到敵人可能預判路線"],
        continuity_constraints: ["吐槽不能蓋過危機判斷"],
        evidence_refs: ["phase37c-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase37c",
  }),
  finalPolisherAdapter: async ({ raw_draft_text }) => ({
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: false,
    suggested_return_stage: null,
    revision_report: {
      structural_gate: { accepted: true, reasons: [] },
      risk_flags: [],
    },
    warnings: [],
  }),
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));

const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase37c-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const valid37B =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal;
  const valid37C =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);

  assert.equal(valid37B.phase, "37B");
  assert.equal(valid37B.contract_valid, true);

  assert.equal(valid37C.used, true);
  assert.equal(valid37C.phase, "37C");
  assert.equal(
    valid37C.surface_kind,
    "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance",
  );
  assert.equal(valid37C.contract_valid, true);
  assert.deepEqual(valid37C.validation_errors, []);
  assert.equal(
    valid37C.status,
    "operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance_clear",
  );
  assert.equal(
    valid37C.response_kind,
    "operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance_reference",
  );
  assert.deepEqual(
    valid37C.real_chatgpt_final_operator_message_consumer_dependency_chain,
    ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M", "37A", "37B", "37C"],
  );
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_dependency_chain_complete, true);
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_text",
  );
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_must_read_exact_field, true);
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_text,
    valid37B.real_chatgpt_live_mcp_operator_extraction_message_text,
  );
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_hash,
    valid37B.real_chatgpt_live_mcp_operator_extraction_message_hash,
  );
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_hash,
    hash(valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_text),
  );
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_source,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_text",
  );
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_matches_phase37b_operator_extraction_consumer_hard_seal,
    true,
  );
  assert.equal(
    valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_hash_matches_phase37b_operator_extraction_consumer_hard_seal,
    true,
  );
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_is_clear_notice, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_is_blocked_notice, false);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_text.includes("READY:"), true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_accepted_message_text.includes(completeText), false);

  assert.equal(
    acceptChatgptOperatorCompactDiagnosticsFromRealChatgptFinalOperatorMessageConsumerContractAcceptance(valid),
    valid37B.real_chatgpt_live_mcp_operator_extraction_message_text,
  );

  assert.equal(valid37C.can_emit_operator_message, true);
  assert.equal(valid37C.can_output_to_chat, false);
  assert.equal(valid37C.may_output_story_text, false);
  assert.equal(valid37C.must_not_output_candidate, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_is_reference_only, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_adds_output_layer, false);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_must_not_replace_final_output, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_phase37b_operator_extraction_consumer_hard_seal, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_result_read, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_phase36l_direct_read, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_phase36m_direct_read, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_phase37a_direct_read, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_recomposition, true);
  assert.equal(valid37C.real_chatgpt_final_operator_message_consumer_contract_acceptance_requires_no_fallback, true);
  assert.equal(valid37C.must_not_read_result, true);
  assert.equal(valid37C.must_not_read_chatgpt_final_output_text_for_real_chatgpt_final_operator_message_consumer, true);
  assert.equal(valid37C.must_not_read_phase36l_final_live_extraction_message_text, true);
  assert.equal(valid37C.must_not_read_phase36m_final_emission_operator_checklist_message_text, true);
  assert.equal(valid37C.must_not_read_phase37a_live_mcp_final_emission_contract_message_text, true);
  assert.equal(valid37C.must_not_read_phase37b_output_text_decoy, true);
  assert.equal(valid37C.must_not_read_nested_result_candidate_text, true);
  assert.equal(valid37C.must_not_read_nested_brain_contract, true);
  assert.equal(valid37C.must_not_recompose_response, true);
  assert.equal(valid37C.may_read_tool_response_result, false);
  assert.equal(valid37C.may_read_chatgpt_final_output_text, false);
  assert.equal(valid37C.may_read_phase36l_final_live_extraction_message_text, false);
  assert.equal(valid37C.may_read_phase36m_final_emission_operator_checklist_message_text, false);
  assert.equal(valid37C.may_read_phase37a_live_mcp_final_emission_contract_message_text, false);
  assert.equal(valid37C.may_update_canon, false);
  assert.equal(valid37C.may_update_active_engine, false);
  assert.equal(Object.hasOwn(valid37C, "output_text"), false);
  assert.equal(Object.hasOwn(valid37C, "operator_display_text"), false);

  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal")
      < validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance"),
    true,
  );
  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance")
      < validKeys.indexOf("result"),
    true,
  );

  const lowerDecoy = clone(valid);
  lowerDecoy.result.final_candidate_text =
    completeText + "\n\nDECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.result.extracted_chatgpt_final_output.output_text =
    "DECOY_RESULT_EXTRACTED_CHATGPT_FINAL_OUTPUT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_final_output.output_text =
    "DECOY_CHATGPT_FINAL_OUTPUT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_final_output.output_hash = hash(lowerDecoy.chatgpt_final_output.output_text);
  lowerDecoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text =
    "DECOY_36L_LIVE_EXTRACTED_OPERATOR_MESSAGE_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_hash =
    hash(lowerDecoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text);
  lowerDecoy.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text =
    "DECOY_36M_FINAL_EMISSION_OPERATOR_CHECKLIST_MESSAGE_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_hash =
    hash(lowerDecoy.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text);
  lowerDecoy.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_text =
    "DECOY_37A_LIVE_MCP_FINAL_EMISSION_CONTRACT_MESSAGE_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_hash =
    hash(lowerDecoy.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_text);
  lowerDecoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.output_text =
    "DECOY_36L_OUTPUT_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.output_text =
    "DECOY_36M_OUTPUT_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.output_text =
    "DECOY_37A_OUTPUT_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.output_text =
    "DECOY_37B_OUTPUT_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";
  lowerDecoy.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.operator_display_text =
    "DECOY_37B_OPERATOR_DISPLAY_TEXT_MUST_NOT_BE_READ_BY_PHASE37C";

  const rebuiltFromLowerDecoys =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalOperatorMessageConsumerContractAcceptance(lowerDecoy);
  assert.equal(rebuiltFromLowerDecoys.contract_valid, true);
  assert.equal(
    rebuiltFromLowerDecoys.real_chatgpt_final_operator_message_consumer_accepted_message_text,
    valid37B.real_chatgpt_live_mcp_operator_extraction_message_text,
  );
  assert.equal(
    rebuiltFromLowerDecoys.real_chatgpt_final_operator_message_consumer_accepted_message_source,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_text",
  );
  assert.equal(
    rebuiltFromLowerDecoys.real_chatgpt_final_operator_message_consumer_accepted_message_text.includes("DECOY_"),
    false,
  );

  const phase37BReplacement = clone(valid);
  const replacement37BText = "READY: PHASE37C_CONSUMER_MUST_FOLLOW_PHASE37B_FIELD_ONLY";
  phase37BReplacement.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_text =
    replacement37BText;
  phase37BReplacement.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_hash =
    hash(replacement37BText);
  const rebuiltFrom37BReplacement =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalOperatorMessageConsumerContractAcceptance(phase37BReplacement);
  assert.equal(rebuiltFrom37BReplacement.contract_valid, true);
  assert.equal(
    rebuiltFrom37BReplacement.real_chatgpt_final_operator_message_consumer_accepted_message_text,
    replacement37BText,
  );
  assert.equal(
    acceptChatgptOperatorCompactDiagnosticsFromRealChatgptFinalOperatorMessageConsumerContractAcceptance(phase37BReplacement),
    replacement37BText,
  );

  const corrupt37BHash = clone(valid);
  corrupt37BHash.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.real_chatgpt_live_mcp_operator_extraction_message_hash =
    "sha256-not-a-real-hash";
  const invalidCorrupt37BHash =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalOperatorMessageConsumerContractAcceptance(corrupt37BHash);
  assert.equal(invalidCorrupt37BHash.contract_valid, false);
  assert.equal(
    invalidCorrupt37BHash.validation_errors.includes("phase37b_operator_extraction_message_hash_mismatch"),
    true,
  );

  const missing37B = clone(valid);
  delete missing37B.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal;
  const invalidMissing37B =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalOperatorMessageConsumerContractAcceptance(missing37B);
  assert.equal(invalidMissing37B.contract_valid, false);
  assert.equal(
    invalidMissing37B.validation_errors.includes(
      "top_level_key_missing:chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal",
    ),
    true,
  );
  assert.equal(
    invalidMissing37B.validation_errors.includes("top_level_phase37b_operator_extraction_consumer_hard_seal_missing"),
    true,
  );

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file), "protected file changed: " + file);
  }

  console.log("Phase37C real ChatGPT final operator message consumer contract acceptance test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
