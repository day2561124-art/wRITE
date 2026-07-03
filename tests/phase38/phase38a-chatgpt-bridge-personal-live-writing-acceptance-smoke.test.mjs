import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { chatgpt_bridge_run_full_neural_writing_pipeline } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
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

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
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

function personalLiveWritingVisibleOutput(toolResponse) {
  const finalOutput = toolResponse?.chatgpt_final_output;
  const finalResponse = toolResponse?.result?.final_response_for_chat;

  if (
    finalOutput?.response_kind === "final_candidate_text"
    && typeof finalOutput.output_text === "string"
    && finalOutput.output_text.length > 0
    && finalResponse?.response_kind === "final_candidate_text"
    && finalResponse?.can_output_to_chat === true
  ) {
    return {
      kind: "final_candidate_text",
      body: finalOutput.output_text,
      source: "tool_response.chatgpt_final_output.output_text",
    };
  }

  if (
    finalResponse?.response_kind === "pipeline_failure_notice"
    && typeof finalResponse.body === "string"
    && finalResponse.body.length > 0
  ) {
    return {
      kind: "pipeline_failure_notice",
      body: finalResponse.body,
      source: "tool_response.result.final_response_for_chat.body",
    };
  }

  return {
    kind: "pipeline_failure_notice",
    body: "[blocked] Writer Workbench did not produce a final candidate text. Do not output story text.",
    source: "local_personal_live_writing_fallback_notice",
  };
}

function assertNoProtectedFilesChanged(protectedBefore) {
  return Promise.all(
    protectedFiles.map(async (file) => {
      assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
    }),
  );
}

function assertPersonalOutputCommonSafety(visible, label) {
  assert.equal(typeof visible.body, "string", label + ": visible body must be string.");
  assert.equal(visible.body.length > 0, true, label + ": visible body must be non-empty.");
  assert.equal(visible.body.includes("DECOY_PHASE38A_MUST_NOT_BE_VISIBLE"), false, label + ": decoy leaked.");
  assert.equal(visible.body.includes("operator_compact_diagnostics"), false, label + ": operator diagnostics leaked.");
  assert.equal(visible.body.includes("handoff_packet"), false, label + ": handoff packet leaked.");
  assert.equal(visible.body.includes("closure_seal"), false, label + ": closure seal leaked.");
  assert.equal(visible.body.includes("evidence_packet"), false, label + ": evidence packet leaked.");
}

const conflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "在門禁燈轉紅前判斷敵人把退路折到哪裡。",
  opposition: "偽裝成普通門禁的折返陷阱與門內提前預判路線的人。",
  opposition_pressure: "門禁倒數、終端撤離線熄滅、門內敲擊聲暴露敵人已經掌握節奏。",
  stakes: "判斷錯誤會把千夜與九逃送進預設伏擊點。",
  reversal_or_reveal: "門不是單純封閉退路，而是在折疊隊伍會選擇的下一段路。",
  required_choice: "千夜必須停下觀察，而不是立刻硬闖或等待流程確認。",
  cost_or_payment: "拖延讓門內的人先一步知道她們已經察覺陷阱。",
  new_status_quo: "隊伍確認敵人可以預判路線，之後不能再照終端地圖直走。",
  ending_hook: "門內敲擊聲從三下變成倒數。",
};

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。門縫底下有一層很薄的靈力粉塵，像被人用指尖往外掃過。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "終端地圖上的撤離線熄了一格。九逃的表情沉下去，手指已經按在標記鍵上。",
  "門內傳來敲擊聲。三下，停一下，再三下。",
  "千夜抬起眼。",
  "下一次敲擊沒有停。它開始倒數。",
].join("\n\n");

const weakDraft = [
  "千夜和九逃到了門前，開始確認門禁狀態。她們知道情況可能有問題，所以先整理資訊。",
  "兩人討論之後覺得要小心，因為門後可能有敵人。她們決定繼續觀察。",
  "現場暫時安靜下來，之後可能還會有新的發展。",
].join("\n\n");

const stillWeakRevision = [
  "千夜與九逃再次確認門禁狀態，知道門後可能有敵人，也知道撤離路線有風險。",
  "兩人討論支援與路線，最後仍然決定先保持警戒。",
  "現場氣氛變得緊張，事件還沒有結束。",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase38A personal live writing acceptance smoke.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase38a_personal_live_writing_acceptance: true,
    character_names: ["朝日奈千夜", "九逃"],
    dramatic_conflict_plan: conflictPlan,
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
    active_engine_update_allowed: false,
  },
  character_names: ["朝日奈千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: [
    "門內的人為什麼能用敲擊聲對應終端倒數？",
    "九逃標記過的熄滅路線之後能不能變成反追蹤線？",
  ],
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫，幽默只能加味。",
      "角色對話不能公告式交接。",
      "結尾必須留下事件鉤子，不靠漂亮句子收尾。",
    ],
  },
  save_candidate: false,
  build_proofing_context: false,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: true,
  include_dramatic_conflict_manager: true,
  include_foreshadowing_causal_graph: true,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
  include_reader_response_revision_gate: true,
  include_reader_response_simulator: true,
  include_aesthetic_memory_context: true,
};

function buildOptions(label, tempRoot, extra = {}) {
  return {
    gptWritingContexts: path.join(tempRoot, label, "contexts"),
    writingCandidates: path.join(tempRoot, label, "candidates"),
    proofingContexts: path.join(tempRoot, label, "proofing"),
    characterMindStateLedger: {
      version: "phase38a-personal-live-writing-ledger-v1",
      updated_at: "2026-07-03T00:00:00.000Z",
      characters: [
        {
          character_name: "朝日奈千夜",
          current_emotion: "警戒但冷靜",
          body_state: "蹲下觀察門縫靈力粉塵",
          unspoken_pressure: "不想讓隊伍被門禁陷阱牽著走",
          recent_event_traces: ["門禁燈第三次閃紅", "撤離線熄滅一格"],
          relationship_attitudes: {
            "九逃": "相信對方會嘴上質疑但行動上立刻跟上",
          },
          visible_reactions_allowed: ["停步", "蹲下", "抬眼", "壓低聲音說明判斷"],
          hidden_reactions_reserved: ["意識到敵人可能正在用倒數逼她選路"],
          continuity_constraints: ["不得把門禁陷阱寫成行政流程確認"],
          evidence_refs: ["phase38a-personal-live-writing"],
        },
        {
          character_name: "九逃",
          current_emotion: "焦躁且戒備",
          body_state: "盯著終端撤離線，手指按在標記鍵上",
          unspoken_pressure: "擔心千夜停得太晚但仍選擇配合",
          recent_event_traces: ["撤離線熄滅一格", "門內敲擊聲開始對應倒數"],
          relationship_attitudes: {
            "朝日奈千夜": "嘴上質疑但行動上配合她的判斷",
          },
          visible_reactions_allowed: ["壓低聲音吐槽", "標記路線", "表情沉下去"],
          hidden_reactions_reserved: ["意識到對方可能預判了他們的退路"],
          continuity_constraints: ["吐槽不能蓋過危機判斷"],
          evidence_refs: ["phase38a-personal-live-writing"],
        },
      ],
    },
    readerResponseRevisionGate: {
      dramatic_conflict_plan: conflictPlan,
      reader_questions_to_carry_forward: [
        "門內的人為什麼能用敲擊聲對應終端倒數？",
        "九逃標記過的熄滅路線之後能不能變成反追蹤線？",
      ],
    },
    env: {},
    ...extra,
  };
}

function structuralPolisherAdapter(label) {
  return async ({ raw_draft_text }) => ({
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: true,
    suggested_return_stage: "raw_generation",
    revision_report: {
      structural_gate: {
        reasons: ["missing_scene_function", "missing_ending_event_hook"],
        suggested_return_stage: "raw_generation",
      },
      risk_flags: ["scene_lacks_concrete_objects", "pretty_but_empty_ending"],
    },
    warnings: [label + "_structural_revision_required"],
  });
}

const protectedBefore = new Map();
for (const file of protectedFiles) {
  protectedBefore.set(file, sha256(await readFile(file, "utf8")));
}

const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase38a-"));

try {
  const success = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("success", tempRoot, {
      generationAdapter: async () => ({
        text: completeText,
        model_name: "deterministic-phase38a-personal-live-writing",
        model_version: "success",
      }),
      finalPolisherAdapter: async ({ raw_draft_text }) => ({
        status: "completed",
        polished_text: raw_draft_text,
        needs_structural_revision: false,
        suggested_return_stage: null,
        revision_report: {
          structural_gate: {
            reasons: [],
            suggested_return_stage: null,
          },
          risk_flags: [],
        },
        warnings: [],
      }),
    }),
  );

  assert.equal(success.ok, true);
  assert.equal(success.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(success.result.final_response_for_chat.response_kind, "final_candidate_text");
  assert.equal(success.result.final_response_for_chat.body, completeText);
  assert.equal(success.result.final_response_for_chat.must_output_body_exactly, true);
  assert.equal(success.result.final_response_for_chat.may_include_extra_explanation, false);
  assert.equal(success.result.final_response_for_chat.may_rewrite, false);
  assert.equal(success.result.final_response_for_chat.may_summarize, false);
  assert.equal(success.result.final_response_for_chat.can_output_to_chat, true);
  assert.equal(success.result.final_response_for_chat.may_output_story_text, true);

  assert.equal(success.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(success.chatgpt_final_output.output_text, completeText);
  assert.equal(success.chatgpt_final_output.output_hash, sha256(completeText));
  assert.equal(success.result.final_candidate_text, completeText);
  assert.equal(success.result.final_candidate_hash, sha256(completeText));
  assert.equal(success.result.candidate_created, false);
  assert.equal(success.result.candidate_id, null);
  assert.equal(success.result.canon_status, "candidate_only");
  assert.equal(success.result.adopted, false);
  assert.equal(success.result.settled, false);
  assert.equal(success.result.safety.active_engine_update_allowed, false);
  assert.equal(success.result.safety.canon_update_allowed, false);

  const successVisible = personalLiveWritingVisibleOutput(success);
  assert.equal(successVisible.kind, "final_candidate_text");
  assert.equal(successVisible.source, "tool_response.chatgpt_final_output.output_text");
  assert.equal(successVisible.body, completeText);
  assertPersonalOutputCommonSafety(successVisible, "success visible output");

  const decoySuccess = clone(success);
  const decoyToken = "DECOY_PHASE38A_MUST_NOT_BE_VISIBLE";

  const decoyPaths = [
    ["result", "final_candidate_text"],
    ["result", "pipeline_result", "final_candidate_text"],
    ["result", "success_output_for_chat", "final_candidate_text_to_output"],
    ["result", "final_response_for_chat", "body"],
    ["result", "full_pipeline_acceptance_evidence_packet_bridge_surface", "output_text"],
    ["result", "failure_output_for_chat", "failure_summary_for_chat"],
    ["chatgpt_operator_compact_diagnostics", "output_text"],
    ["chatgpt_operator_compact_diagnostics", "operator_display_text"],
    ["chatgpt_operator_compact_diagnostics_consumer", "output_text"],
    ["chatgpt_operator_compact_diagnostics_final_closure_index", "closure_index_text"],
    ["chatgpt_operator_compact_diagnostics_final_emission_operator_checklist", "final_emission_operator_checklist_message_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_emission_consumer_seal", "real_chatgpt_final_response_emission_message_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_closure_index", "closure_index_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet", "handoff_packet_text"],
    ["chatgpt_operator_compact_diagnostics_real_chatgpt_final_response_consumer_handoff_packet_closure_seal", "closure_seal_text"],
  ];

  for (const decoyPath of decoyPaths) {
    setPath(decoySuccess, decoyPath, decoyToken + "::" + decoyPath.join("."));
  }

  const decoySuccessVisible = personalLiveWritingVisibleOutput(decoySuccess);
  assert.equal(decoySuccessVisible.kind, "final_candidate_text");
  assert.equal(decoySuccessVisible.source, "tool_response.chatgpt_final_output.output_text");
  assert.equal(decoySuccessVisible.body, completeText);
  assertPersonalOutputCommonSafety(decoySuccessVisible, "decoy success visible output");

  const failure = await chatgpt_bridge_run_full_neural_writing_pipeline(
    {
      ...baseInput,
      max_revision_rounds: 1,
      generation_context: {
        ...baseInput.generation_context,
        phase38a_personal_live_writing_failure_path: true,
      },
    },
    buildOptions("failure", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase38a-personal-live-writing",
        model_version: "failure-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("phase38a_failure"),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase38a-personal-live-writing",
        model_version: "failure-still-weak",
      }),
    }),
  );

  assert.equal(failure.ok, true);
  assert.equal(failure.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(failure.result.status, "failed");
  assert.equal(failure.result.pipeline_stage, "structural_revision_required");
  assert.equal(failure.result.stop_reason, "max_revision_rounds_exhausted");
  assert.equal(failure.result.final_candidate_text, "");
  assert.equal(failure.result.final_candidate_hash, "");
  assert.equal(failure.result.can_output_to_chat, false);
  assert.equal(failure.result.candidate_created, false);
  assert.equal(failure.result.candidate_id, null);
  assert.equal(failure.result.canon_status, "candidate_only");
  assert.equal(failure.result.adopted, false);
  assert.equal(failure.result.settled, false);
  assert.equal(failure.result.safety.active_engine_update_allowed, false);
  assert.equal(failure.result.safety.canon_update_allowed, false);

  assert.equal(failure.result.failure_output_for_chat.used, true);
  assert.equal(failure.result.failure_output_for_chat.must_not_output_candidate, true);
  assert.equal(failure.result.failure_output_for_chat.can_output_to_chat, false);
  assert.equal(failure.result.final_response_for_chat.response_kind, "pipeline_failure_notice");
  assert.equal(failure.result.final_response_for_chat.can_output_to_chat, false);
  assert.equal(failure.result.final_response_for_chat.may_output_story_text, false);
  assert.equal(failure.result.final_response_for_chat.must_output_body_exactly, true);
  assert.equal(failure.result.final_response_for_chat.may_include_extra_explanation, false);
  assert.equal(failure.result.final_response_for_chat.may_rewrite, false);
  assert.equal(failure.result.final_response_for_chat.may_summarize, false);
  assert.equal(failure.result.final_response_for_chat.body.includes("must not output story text"), true);
  assert.equal(failure.result.final_response_for_chat.body.includes(weakDraft), false);
  assert.equal(failure.result.final_response_for_chat.body.includes(stillWeakRevision), false);

  const failureVisible = personalLiveWritingVisibleOutput(failure);
  assert.equal(failureVisible.kind, "pipeline_failure_notice");
  assert.equal(failureVisible.source, "tool_response.result.final_response_for_chat.body");
  assert.equal(failureVisible.body, failure.result.final_response_for_chat.body);
  assertPersonalOutputCommonSafety(failureVisible, "failure visible output");
  assert.equal(failureVisible.body.includes(weakDraft), false);
  assert.equal(failureVisible.body.includes(stillWeakRevision), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase37h = "tests/phase37/phase37h-chatgpt-bridge-final-response-consumer-handoff-packet-closure-seal.test.mjs";
  const phase38a = "tests/phase38/phase38a-chatgpt-bridge-personal-live-writing-acceptance-smoke.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase37h), "run-all missing Phase37H predecessor.");
  assert(runAllText.includes(phase38a), "run-all missing Phase38A registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase37h) < runAllText.indexOf(phase38a), "Phase38A should run after Phase37H.");
  assert(runAllText.indexOf(phase38a) < runAllText.indexOf(daily), "Phase38A should run before Daily scripts.");

  await assertNoProtectedFilesChanged(protectedBefore);

  console.log("Phase38A personal live writing acceptance smoke passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}