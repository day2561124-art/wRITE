import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptOperatorCompactDiagnosticsFromFinalEmissionOperatorChecklist,
  buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist,
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
  "DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36M",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase36M final emission operator checklist deterministic test.",
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
    version: "phase36m-test-ledger-v1",
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
        evidence_refs: ["phase36m-smoke"],
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
        evidence_refs: ["phase36m-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36m",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36m-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validSeal = valid.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const validFreeze = valid.chatgpt_operator_compact_diagnostics_public_contract_freeze;
  const validLive = valid.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke;
  const validChecklist = valid.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);
  assert.equal(validLive.phase, "36L");
  assert.equal(validChecklist.used, true);
  assert.equal(validChecklist.phase, "36M");
  assert.equal(validChecklist.surface_kind, "chatgpt_bridge_operator_compact_diagnostics_final_emission_operator_checklist");
  assert.equal(validChecklist.contract_valid, true);
  assert.deepEqual(validChecklist.validation_errors, []);
  assert.equal(validChecklist.status, "operator_compact_diagnostics_final_emission_operator_checklist_clear");
  assert.equal(validChecklist.response_kind, "operator_compact_diagnostics_final_emission_operator_checklist_reference");
  assert.deepEqual(validChecklist.final_emission_operator_checklist_dependency_chain, ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M"]);
  assert.equal(validChecklist.final_emission_operator_checklist_dependency_chain_complete, true);
  assert.equal(
    validChecklist.final_emission_operator_checklist_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text",
  );
  assert.equal(validChecklist.final_emission_operator_checklist_must_read_exact_field, true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_text, validLive.live_extracted_operator_message_text);
  assert.equal(validChecklist.final_emission_operator_checklist_message_text, validFreeze.public_contract_sealed_operator_message_text);
  assert.equal(validChecklist.final_emission_operator_checklist_message_text, validSeal.sealed_operator_display_text);
  assert.equal(validChecklist.final_emission_operator_checklist_message_hash, validLive.live_extracted_operator_message_hash);
  assert.equal(validChecklist.final_emission_operator_checklist_message_source, "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text");
  assert.equal(validChecklist.final_emission_operator_checklist_message_matches_final_live_extraction, true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_matches_public_contract_freeze, true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_matches_runtime_final_seal, true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_is_clear_notice, true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_is_blocked_notice, false);
  assert.equal(validChecklist.final_emission_operator_checklist_message_text.includes("READY:"), true);
  assert.equal(validChecklist.final_emission_operator_checklist_message_text.includes(completeText), false);
  assert.equal(acceptChatgptOperatorCompactDiagnosticsFromFinalEmissionOperatorChecklist(valid), validLive.live_extracted_operator_message_text);
  assert.equal(validChecklist.can_emit_operator_message, true);
  assert.equal(validChecklist.can_output_to_chat, false);
  assert.equal(validChecklist.may_output_story_text, false);
  assert.equal(validChecklist.must_not_output_candidate, true);
  assert.equal(validChecklist.final_emission_operator_checklist_is_reference_only, true);
  assert.equal(validChecklist.final_emission_operator_checklist_adds_output_layer, false);
  assert.equal(validChecklist.final_emission_operator_checklist_must_not_replace_final_output, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_public_contract_final_live_extraction, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_result_read, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_final_closure_index_read_for_text, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_live_acceptance_as_final_output, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_handoff_surface_as_output, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_real_entry_surface_as_output, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_hard_seal_surface_as_story_text, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_public_freeze_surface_as_story_text, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_final_live_extraction_surface_as_story_text, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_recomposition, true);
  assert.equal(validChecklist.final_emission_operator_checklist_requires_no_fallback, true);
  assert.equal(validChecklist.must_not_read_result, true);
  assert.equal(validChecklist.must_not_read_chatgpt_final_output_text_for_final_emission_operator_checklist, true);
  assert.equal(validChecklist.must_not_read_final_closure_index_for_final_emission_operator_checklist, true);
  assert.equal(validChecklist.must_not_read_live_acceptance_as_final_output, true);
  assert.equal(validChecklist.must_not_read_handoff_output_fields, true);
  assert.equal(validChecklist.must_not_read_real_entry_output_fields, true);
  assert.equal(validChecklist.must_not_read_hard_seal_output_fields, true);
  assert.equal(validChecklist.must_not_read_public_freeze_output_fields, true);
  assert.equal(validChecklist.must_not_read_final_live_extraction_output_fields, true);
  assert.equal(validChecklist.must_not_read_nested_result_candidate_text, true);
  assert.equal(validChecklist.must_not_read_nested_brain_contract, true);
  assert.equal(validChecklist.must_not_recompose_response, true);
  assert.equal(validChecklist.may_read_tool_response_result, false);
  assert.equal(validChecklist.may_read_chatgpt_final_output_text, false);
  assert.equal(validChecklist.may_update_canon, false);
  assert.equal(validChecklist.may_update_active_engine, false);
  assert.equal(Object.hasOwn(validChecklist, "output_text"), false);
  assert.equal(Object.hasOwn(validChecklist, "operator_display_text"), false);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_freeze") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_emission_operator_checklist"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_emission_operator_checklist") < validKeys.indexOf("result"), true);

  const rebuiltValidChecklist = buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(valid);
  assert.equal(rebuiltValidChecklist.contract_valid, true);
  assert.equal(rebuiltValidChecklist.final_emission_operator_checklist_message_text, validChecklist.final_emission_operator_checklist_message_text);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedSeal = blocked.chatgpt_operator_compact_diagnostics_runtime_final_seal;
  const blockedLive = blocked.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke;
  const blockedChecklist = blocked.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist;

  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blockedSeal.blocked, true);
  assert.equal(blockedLive.blocked, true);
  assert.equal(blockedChecklist.contract_valid, true);
  assert.equal(blockedChecklist.status, "operator_compact_diagnostics_final_emission_operator_checklist_blocked");
  assert.equal(blockedChecklist.blocked, true);
  assert.equal(blockedChecklist.blocked_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_text, blockedLive.live_extracted_operator_message_text);
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_text, blockedSeal.sealed_operator_display_text);
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_hash, blockedSeal.sealed_operator_display_hash);
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_is_blocked_notice, true);
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_is_clear_notice, false);
  assert.equal(blockedChecklist.final_emission_operator_checklist_message_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedChecklist.can_output_to_chat, false);
  assert.equal(blockedChecklist.may_output_story_text, false);
  assert.equal(Object.hasOwn(blockedChecklist, "output_text"), false);
  assert.equal(Object.hasOwn(blockedChecklist, "operator_display_text"), false);

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
  decoy.chatgpt_operator_compact_diagnostics_public_contract_freeze.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_public_contract_freeze.operator_display_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.output_text = decoyText;
  decoy.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.operator_display_text = decoyText;

  const decoyChecklist = buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(decoy);
  assert.equal(decoyChecklist.contract_valid, true);
  assert.equal(decoyChecklist.final_emission_operator_checklist_message_text, blockedLive.live_extracted_operator_message_text);
  assert.equal(decoyChecklist.final_emission_operator_checklist_message_hash, blockedLive.live_extracted_operator_message_hash);
  assert.equal(JSON.stringify(decoyChecklist).includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36M"), false);

  const mismatch = clone(blocked);
  mismatch.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text = decoyText;
  mismatch.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_hash = hash(decoyText);

  const mismatchChecklist = buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(mismatch);
  assert.equal(mismatchChecklist.contract_valid, false);
  assert.equal(mismatchChecklist.validation_errors.includes("live_extracted_operator_message_text_public_contract_freeze_mismatch"), true);
  assert.equal(mismatchChecklist.validation_errors.includes("live_extracted_operator_message_hash_public_contract_freeze_mismatch"), true);
  assert.equal(mismatchChecklist.validation_errors.includes("live_extracted_operator_message_text_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchChecklist.validation_errors.includes("live_extracted_operator_message_hash_runtime_final_seal_mismatch"), true);
  assert.equal(mismatchChecklist.can_output_to_chat, false);
  assert.equal(mismatchChecklist.may_output_story_text, false);
  assert.equal(Object.hasOwn(mismatchChecklist, "output_text"), false);
  assert.equal(Object.hasOwn(mismatchChecklist, "operator_display_text"), false);

  const missingLive = clone(blocked);
  delete missingLive.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke;
  const invalid = buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(missingLive);

  assert.equal(invalid.contract_valid, false);
  assert.equal(invalid.validation_errors.includes("top_level_key_missing:chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke"), true);
  assert.equal(invalid.validation_errors.includes("public_contract_final_live_extraction_used_false_or_missing"), true);
  assert.equal(invalid.status, "operator_compact_diagnostics_final_emission_operator_checklist_invalid");
  assert.equal(invalid.can_output_to_chat, false);
  assert.equal(invalid.may_output_story_text, false);
  assert.equal(Object.hasOwn(invalid, "output_text"), false);
  assert.equal(Object.hasOwn(invalid, "operator_display_text"), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36l = "tests/phase36/phase36l-chatgpt-bridge-public-contract-final-live-extraction-smoke.test.mjs";
  const phase36m = "tests/phase36/phase36m-chatgpt-bridge-final-emission-operator-checklist.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36l), "run-all missing Phase36L predecessor.");
  assert(runAllText.includes(phase36m), "run-all missing Phase36M registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36l) < runAllText.indexOf(phase36m), "Phase36M should run after Phase36L.");
  assert(runAllText.indexOf(phase36m) < runAllText.indexOf(daily), "Phase36M should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36M ChatGPT bridge final emission operator checklist tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
