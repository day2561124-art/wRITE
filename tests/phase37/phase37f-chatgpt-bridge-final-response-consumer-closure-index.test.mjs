import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerClosureIndex,
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

function setPath(target, segments, value) {
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    if (cursor[segment] == null || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
}

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "門內傳來敲擊聲。三下，停一下，再三下。",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase37F final response consumer closure index deterministic test.",
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
    version: "phase37f-test-ledger-v1",
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
        evidence_refs: ["phase37f-closure-index"],
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
        evidence_refs: ["phase37f-closure-index"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase37f",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase37f-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const valid37D =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal;
  const valid37F =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);

  assert.equal(valid37D.phase, "37D");
  assert.equal(valid37D.contract_valid, true);

  assert.equal(valid37F.used, true);
  assert.equal(valid37F.phase, "37F");
  assert.equal(
    valid37F.surface_kind,
    "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index",
  );
  assert.equal(valid37F.contract_valid, true);
  assert.deepEqual(valid37F.validation_errors, []);
  assert.equal(
    valid37F.status,
    "operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index_clear",
  );
  assert.equal(
    valid37F.response_kind,
    "operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index_reference",
  );
  assert.deepEqual(
    valid37F.real_chatgpt_final_response_consumer_closure_dependency_chain,
    ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M", "37A", "37B", "37C", "37D", "37E", "37F"],
  );
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_dependency_chain_complete, true);
  assert.equal(
    valid37F.real_chatgpt_final_response_consumer_closure_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.real_chatgpt_final_response_emission_message_hash",
  );
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_must_read_exact_field, true);
  assert.equal(
    valid37F.real_chatgpt_final_response_consumer_closure_hash_reference,
    valid37D.real_chatgpt_final_response_emission_message_hash,
  );
  assert.equal(
    valid37F.real_chatgpt_final_response_consumer_closure_source_reference,
    valid37D.real_chatgpt_final_response_emission_message_source,
  );
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_phase37d_reference_only, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_phase37d_message_is_clear_notice, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_phase37d_message_is_blocked_notice, false);

  assert.equal(valid37F.can_emit_operator_message, false);
  assert.equal(valid37F.can_output_to_chat, false);
  assert.equal(valid37F.may_output_story_text, false);
  assert.equal(valid37F.must_not_output_candidate, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_is_reference_only, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_adds_output_layer, false);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_must_not_replace_final_output, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_phase37d_final_response_emission_consumer_seal, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_result_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_lower_diagnostic_text_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_operator_checklist_text_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_closure_index_text_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_evidence_packet_text_read, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_recomposition, true);
  assert.equal(valid37F.real_chatgpt_final_response_consumer_closure_index_requires_no_fallback, true);

  assert.equal(valid37F.must_not_read_result, true);
  assert.equal(valid37F.must_not_read_chatgpt_final_output_text_for_real_chatgpt_final_response_consumer_closure, true);
  assert.equal(valid37F.must_not_read_lower_diagnostic_text_for_real_chatgpt_final_response_consumer_closure, true);
  assert.equal(valid37F.must_not_read_phase37d_message_text_as_output, true);
  assert.equal(valid37F.must_not_read_nested_result_candidate_text, true);
  assert.equal(valid37F.must_not_read_nested_brain_contract, true);
  assert.equal(valid37F.must_not_read_operator_checklist_text, true);
  assert.equal(valid37F.must_not_read_closure_index_text, true);
  assert.equal(valid37F.must_not_read_evidence_packet_text, true);
  assert.equal(valid37F.must_not_recompose_response, true);

  assert.equal(valid37F.no_new_output_layer, true);
  assert.equal(valid37F.no_extra_text, true);
  assert.equal(valid37F.no_fallback, true);
  assert.equal(valid37F.may_rewrite, false);
  assert.equal(valid37F.may_summarize, false);
  assert.equal(valid37F.may_include_extra_explanation, false);
  assert.equal(valid37F.may_construct_response, false);
  assert.equal(valid37F.may_read_tool_response_result, false);
  assert.equal(valid37F.may_read_chatgpt_final_output_text, false);
  assert.equal(valid37F.may_read_lower_diagnostic_text, false);
  assert.equal(valid37F.may_read_phase37d_message_text_as_output, false);
  assert.equal(valid37F.may_update_canon, false);
  assert.equal(valid37F.may_update_active_engine, false);

  assert.equal(Object.hasOwn(valid37F, "output_text"), false);
  assert.equal(Object.hasOwn(valid37F, "operator_display_text"), false);
  assert.equal(Object.hasOwn(valid37F, "real_chatgpt_final_response_emission_message_text"), false);
  assert.equal(Object.hasOwn(valid37F, "real_chatgpt_final_response_consumer_closure_message_text"), false);

  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal")
      < validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index"),
    true,
  );
  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index")
      < validKeys.indexOf("result"),
    true,
  );

  for (const forbidden of [
    "tool_response.result.*",
    "tool_response.result.final_candidate_text",
    "tool_response.result.extracted_chatgpt_final_output.output_text",
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance.real_chatgpt_final_operator_message_consumer_accepted_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.real_chatgpt_final_response_emission_message_text",
    "operator checklist text",
    "closure index text",
    "evidence packet text",
    "diagnostics/debug surface text",
    "recomposed/summarized/generated response text",
  ]) {
    assert.equal(
      valid37F.forbidden_sources.includes(forbidden),
      true,
      "missing forbidden source: " + forbidden,
    );
  }

  const decoyFlood = clone(valid);
  const decoyToken = "DECOY_PHASE37F_CLOSURE_INDEX_MUST_NOT_BE_READ";

  const decoyPaths = [
    ["result", "final_candidate_text"],
    ["result", "candidate_text"],
    ["result", "output_text"],
    ["result", "diagnostics_text"],
    ["result", "debug_surface_text"],
    ["result", "operator_checklist_text"],
    ["result", "closure_index_text"],
    ["result", "evidence_packet_text"],
    ["result", "extracted_chatgpt_final_output", "output_text"],
    ["result", "success_output_for_chat", "body"],
    ["result", "failure_output_for_chat", "body"],
    ["result", "final_response_for_chat", "body"],
    ["result", "final_response_handoff_for_chat", "body"],
    ["result", "final_polisher_result", "polished_text"],
    ["result", "full_pipeline_acceptance_evidence_packet_bridge_surface", "output_text"],
    ["result", "neural_writing_brain_required_modules_contract", "output_text"],

    ["chatgpt_final_output", "output_text"],

    ["chatgpt_operator_compact_diagnostics", "output_text"],
    ["chatgpt_operator_compact_diagnostics", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics", "diagnostics_text"],
    ["chatgpt_operator_compact_diagnostics", "debug_surface_text"],

    ["chatgpt_operator_compact_diagnostics_consumer", "output_text"],
    ["chatgpt_operator_compact_diagnostics_consumer", "operator_display_text"],

    ["chatgpt_operator_compact_diagnostics_final_closure_index", "output_text"],
    ["chatgpt_operator_compact_diagnostics_final_closure_index", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_final_closure_index", "closure_index_text"],

    ["chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke", "output_text"],
    ["chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke", "accepted_operator_display_text"],

    ["chatgpt_operator_compact_diagnostics_runtime_final_seal", "output_text"],
    ["chatgpt_operator_compact_diagnostics_runtime_final_seal", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_runtime_final_seal", "sealed_operator_display_text"],

    ["chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist", "output_text"],
    ["chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist", "operator_display_text"],

    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "output_text"],
    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "final_emission_operator_checklist_message_text"],

    ["chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke", "output_text"],
    ["chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke", "live_mcp_final_emission_contract_message_text"],

    ["chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal", "output_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal", "real_chatgpt_live_mcp_operator_extraction_message_text"],

    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance", "output_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_operator_message_consumer_contract_acceptance", "operator_display_text"],

  ];

  for (const decoyPath of decoyPaths) {
    setPath(decoyFlood, decoyPath, decoyToken + "::" + decoyPath.join("."));
  }
  decoyFlood.chatgpt_final_output.output_hash = hash(decoyFlood.chatgpt_final_output.output_text);

  const rebuiltFromDecoyFlood =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerClosureIndex(decoyFlood);

  assert.equal(rebuiltFromDecoyFlood.contract_valid, true);
  assert.deepEqual(rebuiltFromDecoyFlood.validation_errors, []);
  assert.equal(
    rebuiltFromDecoyFlood.real_chatgpt_final_response_consumer_closure_hash_reference,
    valid37D.real_chatgpt_final_response_emission_message_hash,
  );
  assert.equal(
    rebuiltFromDecoyFlood.real_chatgpt_final_response_consumer_closure_source_reference,
    valid37D.real_chatgpt_final_response_emission_message_source,
  );
  assert.equal(JSON.stringify(rebuiltFromDecoyFlood).includes(decoyToken), false);
  assert.equal(JSON.stringify(rebuiltFromDecoyFlood).includes(completeText), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "output_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "operator_display_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "real_chatgpt_final_response_consumer_closure_message_text"), false);
  const contaminated37DDisplayFields = clone(valid);
  contaminated37DDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.output_text =
    decoyToken + "::phase37d.output_text";
  contaminated37DDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.operator_display_text =
    decoyToken + "::phase37d.operator_display_text";
  const invalidContaminated37DDisplayFields =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerClosureIndex(contaminated37DDisplayFields);
  assert.equal(invalidContaminated37DDisplayFields.contract_valid, false);
  assert.equal(
    invalidContaminated37DDisplayFields.validation_errors.includes("phase37d_final_response_emission_exposes_output_text"),
    true,
  );
  assert.equal(
    invalidContaminated37DDisplayFields.validation_errors.includes("phase37d_final_response_emission_exposes_operator_display_text"),
    true,
  );
  assert.equal(
    invalidContaminated37DDisplayFields.real_chatgpt_final_response_consumer_closure_hash_reference,
    null,
  );
  assert.equal(
    invalidContaminated37DDisplayFields.real_chatgpt_final_response_consumer_closure_source_reference,
    null,
  );
  assert.equal(JSON.stringify(invalidContaminated37DDisplayFields).includes(decoyToken), false);

  const corrupt37DHash = clone(valid);
  corrupt37DHash.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.real_chatgpt_final_response_emission_message_hash =
    "sha256-not-a-real-hash";
  const invalidCorrupt37DHash =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerClosureIndex(corrupt37DHash);
  assert.equal(invalidCorrupt37DHash.contract_valid, false);
  assert.equal(
    invalidCorrupt37DHash.validation_errors.includes("phase37d_final_response_emission_message_hash_mismatch"),
    true,
  );

  const missing37D = clone(valid);
  delete missing37D.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal;
  const invalidMissing37D =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerClosureIndex(missing37D);
  assert.equal(invalidMissing37D.contract_valid, false);
  assert.equal(
    invalidMissing37D.validation_errors.includes(
      "top_level_key_missing:chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal",
    ),
    true,
  );
  assert.equal(
    invalidMissing37D.validation_errors.includes("top_level_phase37d_final_response_emission_consumer_seal_missing"),
    true,
  );

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file), "protected file changed: " + file);
  }

  console.log("Phase37F final response consumer closure index test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}