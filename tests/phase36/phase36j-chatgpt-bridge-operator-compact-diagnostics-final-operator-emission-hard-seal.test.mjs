import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptOperatorCompactDiagnosticsFromFinalOperatorEmissionHardSeal,
  buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
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
  "DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36J",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase36J final operator emission hard seal deterministic test.",
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
    version: "phase36j-test-ledger-v1",
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
        evidence_refs: ["phase36j-smoke"],
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
        evidence_refs: ["phase36j-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36j",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36j-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validSeal = valid.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const validHandoff = valid.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist;
  const validEntry = valid.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke;
  const validHardSeal = valid.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);
  assert.equal(validSeal.phase, "36G");
  assert.equal(validHandoff.phase, "36H");
  assert.equal(validEntry.phase, "36I");
  assert.equal(validHardSeal.used, true);
  assert.equal(validHardSeal.phase, "36J");
  assert.equal(validHardSeal.surface_kind, "chatgpt_bridge_operator_compact_diagnostics_final_operator_emission_hard_seal");
  assert.equal(validHardSeal.contract_valid, true);
  assert.deepEqual(validHardSeal.validation_errors, []);
  assert.equal(validHardSeal.status, "operator_compact_diagnostics_final_operator_emission_hard_seal_clear");
  assert.equal(validHardSeal.response_kind, "operator_compact_diagnostics_final_operator_emission_hard_seal_reference");
  assert.deepEqual(validHardSeal.final_operator_emission_dependency_chain, ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J"]);
  assert.equal(validHardSeal.final_operator_emission_dependency_chain_complete, true);
  assert.equal(
    validHardSeal.final_operator_emission_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text",
  );
  assert.equal(validHardSeal.final_operator_emission_must_read_exact_field, true);
  assert.equal(validHardSeal.sealed_final_operator_emission_text, validEntry.accepted_operator_message_text);
  assert.equal(validHardSeal.sealed_final_operator_emission_text, validSeal.sealed_operator_display_text);
  assert.equal(validHardSeal.sealed_final_operator_emission_hash, validEntry.accepted_operator_message_hash);
  assert.equal(validHardSeal.sealed_final_operator_emission_hash, validSeal.sealed_operator_display_hash);
  assert.equal(validHardSeal.sealed_final_operator_emission_source, "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text");
  assert.equal(validHardSeal.sealed_final_operator_emission_matches_real_chatgpt_entry, true);
  assert.equal(validHardSeal.sealed_final_operator_emission_matches_runtime_final_seal, true);
  assert.equal(validHardSeal.sealed_final_operator_emission_matches_handoff_required_field, true);
  assert.equal(validHardSeal.sealed_final_operator_emission_is_clear_notice, true);
  assert.equal(validHardSeal.sealed_final_operator_emission_is_blocked_notice, false);
  assert.equal(validHardSeal.sealed_final_operator_emission_text.includes("READY:"), true);
  assert.equal(validHardSeal.sealed_final_operator_emission_text.includes(completeText), false);
  assert.equal(acceptChatgptOperatorCompactDiagnosticsFromFinalOperatorEmissionHardSeal(valid), validSeal.sealed_operator_display_text);
  assert.equal(validHardSeal.can_emit_operator_message, true);
  assert.equal(validHardSeal.can_output_to_chat, false);
  assert.equal(validHardSeal.may_output_story_text, false);
  assert.equal(validHardSeal.must_not_output_candidate, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_is_reference_only, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_adds_output_layer, false);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_must_not_replace_final_output, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_must_not_be_emitted_as_story_text, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_must_not_be_used_as_candidate_text, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_result_read, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_final_closure_index_read_for_text, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_live_acceptance_as_final_output, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_handoff_surface_as_output, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_recomposition, true);
  assert.equal(validHardSeal.final_operator_emission_hard_seal_requires_no_fallback, true);
  assert.equal(validHardSeal.must_not_read_result, true);
  assert.equal(validHardSeal.must_not_read_chatgpt_final_output_text_for_operator_emission, true);
  assert.equal(validHardSeal.must_not_read_final_closure_index_for_operator_emission, true);
  assert.equal(validHardSeal.must_not_read_live_acceptance_as_final_output, true);
  assert.equal(validHardSeal.must_not_read_handoff_output_fields, true);
  assert.equal(validHardSeal.must_not_read_nested_result_candidate_text, true);
  assert.equal(validHardSeal.must_not_read_nested_brain_contract, true);
  assert.equal(validHardSeal.must_not_recompose_response, true);
  assert.equal(validHardSeal.may_read_tool_response_result, false);
  assert.equal(validHardSeal.may_read_chatgpt_final_output_text, false);
  assert.equal(validHardSeal.may_update_canon, false);
  assert.equal(validHardSeal.may_update_active_engine, false);
  assert.equal(Object.hasOwn(validHardSeal, "output_text"), false);
  assert.equal(Object.hasOwn(validHardSeal, "operator_display_text"), false);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal") < validKeys.indexOf("result"), true);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedSeal = blocked.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const blockedEntry = blocked.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke;
  const blockedHardSeal = blocked.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal;

  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blockedSeal.blocked, true);
  assert.equal(blockedEntry.blocked, true);
  assert.equal(blockedSeal.sealed_operator_display_text.includes("BLOCKED:"), true);
  assert.equal(blockedHardSeal.contract_valid, true);
  assert.equal(blockedHardSeal.status, "operator_compact_diagnostics_final_operator_emission_hard_seal_blocked");
  assert.equal(blockedHardSeal.blocked, true);
  assert.equal(blockedHardSeal.blocked_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedHardSeal.sealed_final_operator_emission_text, blockedEntry.accepted_operator_message_text);
  assert.equal(blockedHardSeal.sealed_final_operator_emission_text, blockedSeal.sealed_operator_display_text);
  assert.equal(blockedHardSeal.sealed_final_operator_emission_hash, blockedSeal.sealed_operator_display_hash);
  assert.equal(blockedHardSeal.sealed_final_operator_emission_is_blocked_notice, true);
  assert.equal(blockedHardSeal.sealed_final_operator_emission_is_clear_notice, false);
  assert.equal(blockedHardSeal.sealed_final_operator_emission_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedHardSeal.can_output_to_chat, false);
  assert.equal(blockedHardSeal.may_output_story_text, false);
  assert.equal(Object.hasOwn(blockedHardSeal, "output_text"), false);
  assert.equal(Object.hasOwn(blockedHardSeal, "operator_display_text"), false);

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

  const decoyHardSeal = buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal(decoy);
  assert.equal(decoyHardSeal.contract_valid, true);
  assert.equal(decoyHardSeal.sealed_final_operator_emission_text, blockedSeal.sealed_operator_display_text);
  assert.equal(decoyHardSeal.sealed_final_operator_emission_hash, blockedSeal.sealed_operator_display_hash);
  assert.equal(JSON.stringify(decoyHardSeal).includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36J"), false);

  const mismatch = clone(blocked);
  mismatch.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text = decoyText;
  mismatch.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_hash = hash(decoyText);

  const mismatchHardSeal = buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal(mismatch);
  assert.equal(mismatchHardSeal.contract_valid, false);
  assert.equal(mismatchHardSeal.validation_errors.includes("accepted_operator_message_text_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchHardSeal.validation_errors.includes("accepted_operator_message_hash_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchHardSeal.can_output_to_chat, false);
  assert.equal(mismatchHardSeal.may_output_story_text, false);
  assert.equal(Object.hasOwn(mismatchHardSeal, "output_text"), false);
  assert.equal(Object.hasOwn(mismatchHardSeal, "operator_display_text"), false);

  const invalid = buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal({
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
    chatgpt_final_output: blocked.chatgpt_final_output,
    chatgpt_operator_compact_diagnostics_runtime_final_seal: blockedSeal,
    chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
      blocked.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist,
    result: blocked.result,
  });

  assert.equal(invalid.contract_valid, false);
  assert.equal(invalid.validation_errors.includes("top_level_real_chatgpt_writing_entry_smoke_missing"), true);
  assert.equal(invalid.validation_errors.includes("real_chatgpt_entry_smoke_used_false_or_missing"), true);
  assert.equal(invalid.status, "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid");
  assert.equal(invalid.can_output_to_chat, false);
  assert.equal(invalid.may_output_story_text, false);
  assert.equal(Object.hasOwn(invalid, "output_text"), false);
  assert.equal(Object.hasOwn(invalid, "operator_display_text"), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36i = "tests/phase36/phase36i-chatgpt-bridge-operator-compact-diagnostics-real-chatgpt-writing-entry-smoke.test.mjs";
  const phase36j = "tests/phase36/phase36j-chatgpt-bridge-operator-compact-diagnostics-final-operator-emission-hard-seal.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36i), "run-all missing Phase36I predecessor.");
  assert(runAllText.includes(phase36j), "run-all missing Phase36J registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36i) < runAllText.indexOf(phase36j), "Phase36J should run after Phase36I.");
  assert(runAllText.indexOf(phase36j) < runAllText.indexOf(daily), "Phase36J should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36J ChatGPT bridge operator compact diagnostics final operator emission hard seal tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
