import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptOperatorCompactDiagnosticsFromPublicContractFreeze,
  buildChatgptOperatorCompactDiagnosticsPublicContractFreeze,
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

const decoyText = [
  completeText,
  "DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36K",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase36K public contract freeze deterministic test.",
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
    version: "phase36k-test-ledger-v1",
    updated_at: "2026-07-02T00:00:00.000Z",
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
        evidence_refs: ["phase36k-smoke"],
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
        evidence_refs: ["phase36k-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36k",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36k-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validSeal = valid.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const validHandoff = valid.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist;
  const validEntry = valid.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke;
  const validHardSeal = valid.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal;
  const validFreeze = valid.chatgpt_operator_compact_diagnostics_public_contract_freeze;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);
  assert.equal(validSeal.phase, "36G");
  assert.equal(validHandoff.phase, "36H");
  assert.equal(validEntry.phase, "36I");
  assert.equal(validHardSeal.phase, "36J");
  assert.equal(validFreeze.used, true);
  assert.equal(validFreeze.phase, "36K");
  assert.equal(validFreeze.surface_kind, "chatgpt_bridge_operator_compact_diagnostics_public_contract_freeze");
  assert.equal(validFreeze.contract_valid, true);
  assert.deepEqual(validFreeze.validation_errors, []);
  assert.equal(validFreeze.status, "operator_compact_diagnostics_public_contract_freeze_clear");
  assert.equal(validFreeze.response_kind, "operator_compact_diagnostics_public_contract_freeze_reference");
  assert.deepEqual(validFreeze.public_contract_dependency_chain, ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K"]);
  assert.equal(validFreeze.public_contract_dependency_chain_complete, true);
  assert.deepEqual(validFreeze.public_contract_top_level_required_keys, [
    "chatgpt_final_output",
    "chatgpt_operator_compact_diagnostics",
    "chatgpt_operator_compact_diagnostics_consumer",
    "chatgpt_operator_compact_diagnostics_final_closure_index",
    "chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "chatgpt_operator_compact_diagnostics_runtime_final_seal",
    "chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
    "chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal",
  ]);
  assert.equal(validFreeze.public_contract_top_level_order_valid, true);
  assert.equal(
    validFreeze.public_contract_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text",
  );
  assert.equal(validFreeze.public_contract_must_read_exact_field, true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_text, validHardSeal.sealed_final_operator_emission_text);
  assert.equal(validFreeze.public_contract_sealed_operator_message_text, validEntry.accepted_operator_message_text);
  assert.equal(validFreeze.public_contract_sealed_operator_message_text, validSeal.sealed_operator_display_text);
  assert.equal(validFreeze.public_contract_sealed_operator_message_hash, validHardSeal.sealed_final_operator_emission_hash);
  assert.equal(validFreeze.public_contract_sealed_operator_message_hash, validSeal.sealed_operator_display_hash);
  assert.equal(validFreeze.public_contract_sealed_operator_message_source, "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text");
  assert.equal(validFreeze.public_contract_sealed_operator_message_matches_final_operator_emission_hard_seal, true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_matches_runtime_final_seal, true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_matches_real_chatgpt_entry, true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_is_clear_notice, true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_is_blocked_notice, false);
  assert.equal(validFreeze.public_contract_sealed_operator_message_text.includes("READY:"), true);
  assert.equal(validFreeze.public_contract_sealed_operator_message_text.includes(completeText), false);
  assert.equal(acceptChatgptOperatorCompactDiagnosticsFromPublicContractFreeze(valid), validSeal.sealed_operator_display_text);
  assert.equal(validFreeze.can_emit_operator_message, true);
  assert.equal(validFreeze.can_output_to_chat, false);
  assert.equal(validFreeze.may_output_story_text, false);
  assert.equal(validFreeze.must_not_output_candidate, true);
  assert.equal(validFreeze.public_contract_freeze_is_reference_only, true);
  assert.equal(validFreeze.public_contract_freeze_adds_output_layer, false);
  assert.equal(validFreeze.public_contract_freeze_must_not_replace_final_output, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_result_read, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_final_closure_index_read_for_text, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_live_acceptance_as_final_output, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_handoff_surface_as_output, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_real_entry_surface_as_output, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_hard_seal_surface_as_story_text, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_recomposition, true);
  assert.equal(validFreeze.public_contract_freeze_requires_no_fallback, true);
  assert.equal(validFreeze.must_not_read_result, true);
  assert.equal(validFreeze.must_not_read_chatgpt_final_output_text_for_public_contract, true);
  assert.equal(validFreeze.must_not_read_final_closure_index_for_public_contract, true);
  assert.equal(validFreeze.must_not_read_live_acceptance_as_final_output, true);
  assert.equal(validFreeze.must_not_read_handoff_output_fields, true);
  assert.equal(validFreeze.must_not_read_real_entry_output_fields, true);
  assert.equal(validFreeze.must_not_read_hard_seal_output_fields, true);
  assert.equal(validFreeze.must_not_read_nested_result_candidate_text, true);
  assert.equal(validFreeze.must_not_read_nested_brain_contract, true);
  assert.equal(validFreeze.must_not_recompose_response, true);
  assert.equal(validFreeze.may_read_tool_response_result, false);
  assert.equal(validFreeze.may_read_chatgpt_final_output_text, false);
  assert.equal(validFreeze.may_update_canon, false);
  assert.equal(validFreeze.may_update_active_engine, false);
  assert.equal(Object.hasOwn(validFreeze, "output_text"), false);
  assert.equal(Object.hasOwn(validFreeze, "operator_display_text"), false);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_runtime_final_seal") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_freeze"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_freeze") < validKeys.indexOf("result"), true);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedSeal = blocked.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const blockedHardSeal = blocked.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal;
  const blockedFreeze = blocked.chatgpt_operator_compact_diagnostics_public_contract_freeze;

  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blockedSeal.blocked, true);
  assert.equal(blockedHardSeal.blocked, true);
  assert.equal(blockedFreeze.contract_valid, true);
  assert.equal(blockedFreeze.status, "operator_compact_diagnostics_public_contract_freeze_blocked");
  assert.equal(blockedFreeze.blocked, true);
  assert.equal(blockedFreeze.blocked_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_text, blockedHardSeal.sealed_final_operator_emission_text);
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_text, blockedSeal.sealed_operator_display_text);
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_hash, blockedSeal.sealed_operator_display_hash);
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_is_blocked_notice, true);
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_is_clear_notice, false);
  assert.equal(blockedFreeze.public_contract_sealed_operator_message_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedFreeze.can_output_to_chat, false);
  assert.equal(blockedFreeze.may_output_story_text, false);
  assert.equal(Object.hasOwn(blockedFreeze, "output_text"), false);
  assert.equal(Object.hasOwn(blockedFreeze, "operator_display_text"), false);

  const decoy = clone(blocked);
  decoy.chatgpt_final_output.output_text = decoyText;
  decoy.result.final_candidate_text = decoyText;
  decoy.result.success_output_for_chat = { output_text: decoyText, output_hash: hash(decoyText) };
  decoy.result.failure_output_for_chat = { output_text: decoyText, output_hash: hash(decoyText) };
  decoy.result.extracted_chatgpt_final_output.output_text = decoyText;
  decoy.result.extracted_chatgpt_final_output.output_hash = hash(decoyText);
  decoy.result.neural_writing_brain_required_modules_contract = { decoy_text: decoyText };
  decoy.chatgpt_operator_compact_diagnostics_final_closure_index.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.operator_display_text = decoyText;

  const decoyFreeze = buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(decoy);
  assert.equal(decoyFreeze.contract_valid, true);
  assert.equal(decoyFreeze.public_contract_sealed_operator_message_text, blockedSeal.sealed_operator_display_text);
  assert.equal(decoyFreeze.public_contract_sealed_operator_message_hash, blockedSeal.sealed_operator_display_hash);
  assert.equal(JSON.stringify(decoyFreeze).includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36K"), false);

  const mismatch = clone(blocked);
  mismatch.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text = decoyText;
  mismatch.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_hash = hash(decoyText);

  const mismatchFreeze = buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(mismatch);
  assert.equal(mismatchFreeze.contract_valid, false);
  assert.equal(mismatchFreeze.validation_errors.includes("sealed_final_operator_emission_text_real_entry_mismatch"), true);
  assert.equal(mismatchFreeze.validation_errors.includes("sealed_final_operator_emission_text_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchFreeze.validation_errors.includes("sealed_final_operator_emission_hash_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchFreeze.can_output_to_chat, false);
  assert.equal(mismatchFreeze.may_output_story_text, false);
  assert.equal(Object.hasOwn(mismatchFreeze, "output_text"), false);
  assert.equal(Object.hasOwn(mismatchFreeze, "operator_display_text"), false);

  const missingHardSeal = clone(blocked);
  delete missingHardSeal.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal;
  const invalid = buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(missingHardSeal);

  assert.equal(invalid.contract_valid, false);
  assert.equal(invalid.validation_errors.includes("top_level_key_missing:chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal"), true);
  assert.equal(invalid.validation_errors.includes("final_operator_emission_hard_seal_used_false_or_missing"), true);
  assert.equal(invalid.status, "operator_compact_diagnostics_public_contract_freeze_invalid");
  assert.equal(invalid.can_output_to_chat, false);
  assert.equal(invalid.may_output_story_text, false);
  assert.equal(Object.hasOwn(invalid, "output_text"), false);
  assert.equal(Object.hasOwn(invalid, "operator_display_text"), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36j = "tests/phase36/phase36j-chatgpt-bridge-operator-compact-diagnostics-final-operator-emission-hard-seal.test.mjs";
  const phase36k = "tests/phase36/phase36k-chatgpt-bridge-final-response-public-contract-freeze.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36j), "run-all missing Phase36J predecessor.");
  assert(runAllText.includes(phase36k), "run-all missing Phase36K registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36j) < runAllText.indexOf(phase36k), "Phase36K should run after Phase36J.");
  assert(runAllText.indexOf(phase36k) < runAllText.indexOf(daily), "Phase36K should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36K ChatGPT bridge final response public contract freeze tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
