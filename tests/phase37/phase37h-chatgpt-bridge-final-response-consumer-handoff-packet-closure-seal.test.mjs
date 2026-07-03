import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerHandoffPacketClosureSeal,
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
  task_prompt: "Phase37H final response consumer handoff packet closure seal deterministic test.",
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
    version: "phase37h-test-ledger-v1",
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
        evidence_refs: ["phase37h-closure-seal"],
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
        evidence_refs: ["phase37h-closure-seal"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase37h",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase37h-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const valid37D =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal;
  const valid37F =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index;
  const valid37G =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet;
  const valid37H =
    valid.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);

  assert.equal(valid37D.phase, "37D");
  assert.equal(valid37D.contract_valid, true);
  assert.equal(valid37F.phase, "37F");
  assert.equal(valid37F.contract_valid, true);
  assert.equal(valid37G.phase, "37G");
  assert.equal(valid37G.contract_valid, true);

  assert.equal(valid37H.used, true);
  assert.equal(valid37H.phase, "37H");
  assert.equal(
    valid37H.surface_kind,
    "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal",
  );
  assert.equal(valid37H.contract_valid, true);
  assert.deepEqual(valid37H.validation_errors, []);
  assert.equal(
    valid37H.status,
    "operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal_clear",
  );
  assert.equal(
    valid37H.response_kind,
    "operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal_reference",
  );

  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_dependency_phase, "37G");
  assert.equal(
    valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_dependency_kind,
    "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet",
  );
  assert.equal(
    valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_required_read_field,
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.real_chatgpt_final_response_consumer_handoff_hash_reference",
  );
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_must_read_exact_field, true);

  assert.equal(
    valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_hash_reference,
    valid37G.real_chatgpt_final_response_consumer_handoff_hash_reference,
  );
  assert.equal(
    valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_source_reference,
    valid37G.real_chatgpt_final_response_consumer_handoff_source_reference,
  );
  assert.equal(
    valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_status_reference,
    valid37G.status,
  );
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_blocked_reference, false);

  assert.equal(valid37H.can_emit_operator_message, false);
  assert.equal(valid37H.can_output_to_chat, false);
  assert.equal(valid37H.may_output_story_text, false);
  assert.equal(valid37H.must_not_output_candidate, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_is_reference_only, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_adds_output_layer, false);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_must_not_replace_final_output, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_phase37g_handoff_packet, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_result_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_chatgpt_final_output_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_lower_diagnostic_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_operator_checklist_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_closure_index_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_handoff_packet_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_evidence_packet_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_phase37d_message_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_phase37f_closure_index_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_phase37g_handoff_packet_text_read, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_recomposition, true);
  assert.equal(valid37H.real_chatgpt_final_response_consumer_handoff_packet_closure_seal_requires_no_fallback, true);

  assert.equal(valid37H.no_new_output_layer, true);
  assert.equal(valid37H.no_extra_text, true);
  assert.equal(valid37H.no_fallback, true);
  assert.equal(valid37H.may_rewrite, false);
  assert.equal(valid37H.may_summarize, false);
  assert.equal(valid37H.may_include_extra_explanation, false);
  assert.equal(valid37H.may_construct_response, false);
  assert.equal(valid37H.may_read_tool_response_result, false);
  assert.equal(valid37H.may_read_chatgpt_final_output_text, false);
  assert.equal(valid37H.may_read_lower_diagnostic_text, false);
  assert.equal(valid37H.may_read_phase37d_message_text_as_output, false);
  assert.equal(valid37H.may_read_phase37f_closure_index_text_as_output, false);
  assert.equal(valid37H.may_read_phase37g_handoff_packet_text_as_output, false);
  assert.equal(valid37H.may_update_canon, false);
  assert.equal(valid37H.may_update_active_engine, false);

  assert.equal(Object.hasOwn(valid37H, "output_text"), false);
  assert.equal(Object.hasOwn(valid37H, "operator_display_text"), false);
  assert.equal(Object.hasOwn(valid37H, "message_text"), false);
  assert.equal(Object.hasOwn(valid37H, "handoff_packet_text"), false);
  assert.equal(Object.hasOwn(valid37H, "closure_seal_text"), false);
  assert.equal(Object.hasOwn(valid37H, "real_chatgpt_final_response_consumer_handoff_message_text"), false);

  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet")
      < validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal"),
    true,
  );
  assert.equal(
    validKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal")
      < validKeys.indexOf("result"),
    true,
  );

  for (const allowed of [
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.contract_valid",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.status",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.real_chatgpt_final_response_consumer_handoff_hash_reference",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.real_chatgpt_final_response_consumer_handoff_source_reference",
  ]) {
    assert.equal(
      valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_allowed_read_fields.includes(allowed),
      true,
      "missing allowed read field: " + allowed,
    );
  }

  for (const forbidden of [
    "tool_response.result.*",
    "tool_response.result.final_candidate_text",
    "tool_response.result.extracted_chatgpt_final_output.output_text",
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal.real_chatgpt_final_response_emission_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index.message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.handoff_packet_text",
    "operator checklist text",
    "closure index text",
    "handoff packet text",
    "evidence packet text",
    "diagnostics/debug surface text",
    "recomposed/summarized/generated response text",
  ]) {
    assert.equal(
      valid37H.real_chatgpt_final_response_consumer_handoff_closure_seal_forbidden_read_fields.includes(forbidden),
      true,
      "missing forbidden read field: " + forbidden,
    );
  }

  const decoyFlood = clone(valid);
  const decoyToken = "DECOY_PHASE37H_CLOSURE_SEAL_MUST_NOT_BE_READ";

  const decoyPaths = [
    ["result", "final_candidate_text"],
    ["result", "candidate_text"],
    ["result", "output_text"],
    ["result", "diagnostics_text"],
    ["result", "debug_surface_text"],
    ["result", "operator_checklist_text"],
    ["result", "closure_index_text"],
    ["result", "handoff_packet_text"],
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

    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "output_text"],
    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "final_emission_operator_checklist_message_text"],

    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal", "output_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal", "real_chatgpt_final_response_emission_message_text"],

    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index", "output_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index", "message_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index", "closure_index_text"],


  ];

  for (const decoyPath of decoyPaths) {
    setPath(decoyFlood, decoyPath, decoyToken + "::" + decoyPath.join("."));
  }
  decoyFlood.chatgpt_final_output.output_hash = hash(decoyFlood.chatgpt_final_output.output_text);

  const rebuiltFromDecoyFlood =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerHandoffPacketClosureSeal(decoyFlood);

  assert.equal(rebuiltFromDecoyFlood.contract_valid, true);
  assert.deepEqual(rebuiltFromDecoyFlood.validation_errors, []);
  assert.equal(
    rebuiltFromDecoyFlood.real_chatgpt_final_response_consumer_handoff_closure_seal_hash_reference,
    valid37G.real_chatgpt_final_response_consumer_handoff_hash_reference,
  );
  assert.equal(
    rebuiltFromDecoyFlood.real_chatgpt_final_response_consumer_handoff_closure_seal_source_reference,
    valid37G.real_chatgpt_final_response_consumer_handoff_source_reference,
  );
  assert.equal(JSON.stringify(rebuiltFromDecoyFlood).includes(decoyToken), false);
  assert.equal(JSON.stringify(rebuiltFromDecoyFlood).includes(completeText), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "output_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "operator_display_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "message_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "handoff_packet_text"), false);
  assert.equal(Object.hasOwn(rebuiltFromDecoyFlood, "closure_seal_text"), false);

  const contaminated37GDisplayFields = clone(valid);
  contaminated37GDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.output_text =
    decoyToken + "::phase37g.output_text";
  contaminated37GDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.operator_display_text =
    decoyToken + "::phase37g.operator_display_text";
  contaminated37GDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.message_text =
    decoyToken + "::phase37g.message_text";
  contaminated37GDisplayFields.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet.handoff_packet_text =
    decoyToken + "::phase37g.handoff_packet_text";
  const invalidContaminated37GDisplayFields =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerHandoffPacketClosureSeal(contaminated37GDisplayFields);
  assert.equal(invalidContaminated37GDisplayFields.contract_valid, false);
  assert.equal(
    invalidContaminated37GDisplayFields.validation_errors.includes("phase37g_final_response_consumer_handoff_exposes_output_text"),
    true,
  );
  assert.equal(
    invalidContaminated37GDisplayFields.validation_errors.includes("phase37g_final_response_consumer_handoff_exposes_operator_display_text"),
    true,
  );
  assert.equal(
    invalidContaminated37GDisplayFields.validation_errors.includes("phase37g_final_response_consumer_handoff_exposes_message_text"),
    true,
  );
  assert.equal(
    invalidContaminated37GDisplayFields.validation_errors.includes("phase37g_final_response_consumer_handoff_exposes_handoff_packet_text"),
    true,
  );
  assert.equal(
    invalidContaminated37GDisplayFields.real_chatgpt_final_response_consumer_handoff_closure_seal_hash_reference,
    null,
  );
  assert.equal(
    invalidContaminated37GDisplayFields.real_chatgpt_final_response_consumer_handoff_closure_seal_source_reference,
    null,
  );
  assert.equal(JSON.stringify(invalidContaminated37GDisplayFields).includes(decoyToken), false);

  const missing37G = clone(valid);
  delete missing37G.chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet;
  const invalidMissing37G =
    buildChatgptOperatorCompactDiagnosticsRealChatgptFinalResponseConsumerHandoffPacketClosureSeal(missing37G);
  assert.equal(invalidMissing37G.contract_valid, false);
  assert.equal(
    invalidMissing37G.validation_errors.includes(
      "top_level_key_missing:chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet",
    ),
    true,
  );
  assert.equal(
    invalidMissing37G.validation_errors.includes("top_level_phase37g_final_response_consumer_handoff_packet_missing"),
    true,
  );

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file), "protected file changed: " + file);
  }

  console.log("Phase37H final response consumer handoff packet closure seal test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}