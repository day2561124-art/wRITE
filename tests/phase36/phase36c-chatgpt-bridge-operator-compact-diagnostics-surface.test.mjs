import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptOperatorCompactDiagnosticsSurface,
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

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。細小的靈力粉塵沿著門縫往內流，像有人在另一側緩慢吸氣。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "終端地圖跳出新的灰色線段，退路沒有消失，卻被折成另一個方向。九逃的表情沉下去，因為那條線正通往舊訓練場。",
  "門內傳來敲擊聲。三下，停一下，再三下。",
  "那不是求救，是有人在替他們倒數。",
].join("\n\n");

const conflictPlan = {
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
};

const baseInput = {
  task_prompt: "Phase36C compact operator diagnostics deterministic smoke.",
  generation_context: {
    scene: "red door access light",
    chapter_turn: "door route is folded toward old training ground",
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
  },
  character_names: ["千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
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
    version: "phase36c-test-ledger-v1",
    updated_at: "2026-07-02T00:00:00.000Z",
    characters: [
      {
        character_name: "千夜",
        current_emotion: "警戒但冷靜",
        body_state: "蹲下觀察門縫靈力粉塵",
        unspoken_pressure: "不想讓隊伍被門禁陷阱牽著走",
        recent_event_traces: ["門禁燈第三次閃紅"],
        relationship_attitudes: {
          "九逃": "信任對方會立刻跟上自己的判斷",
        },
        visible_reactions_allowed: ["停步", "蹲下", "壓低聲音說明觀察結果"],
        hidden_reactions_reserved: ["對門內倒數聲感到不安"],
        continuity_constraints: ["不得把門禁陷阱當作普通行政流程處理"],
        evidence_refs: ["phase36c-smoke"],
      },
      {
        character_name: "九逃",
        current_emotion: "焦躁且戒備",
        body_state: "壓低聲音、注意退路",
        unspoken_pressure: "擔心千夜判斷太晚但仍選擇配合",
        recent_event_traces: ["退路被折向舊訓練場"],
        relationship_attitudes: {
          "千夜": "嘴上質疑但行動上配合",
        },
        visible_reactions_allowed: ["壓低聲音吐槽", "觀察終端地圖"],
        hidden_reactions_reserved: ["意識到敵人可能預判路線"],
        continuity_constraints: ["吐槽不能蓋過危機判斷"],
        evidence_refs: ["phase36c-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36c",
  }),
  finalPolisherAdapter: async ({ raw_draft_text }) => ({
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: false,
    suggested_return_stage: null,
    revision_report: {
      structural_gate: {
        accepted: true,
        reasons: [],
      },
      risk_flags: [],
    },
    warnings: [],
  }),
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));

const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36c-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validCompact = valid.chatgpt_operator_compact_diagnostics;

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);
  assert.equal(validCompact.used, true);
  assert.equal(validCompact.phase, "36C");
  assert.equal(validCompact.surface_kind, "chatgpt_bridge_operator_compact_diagnostics_surface");
  assert.equal(validCompact.contract_valid, true);
  assert.equal(validCompact.compact_surface_valid, true);
  assert.equal(validCompact.source_contract_valid, true);
  assert.equal(validCompact.blocked, false);
  assert.equal(validCompact.can_output_to_chat, true);
  assert.equal(validCompact.may_output_story_text, true);
  assert.deepEqual(validCompact.missing_modules, []);
  assert.deepEqual(validCompact.blocked_checks, []);
  assert.equal(validCompact.compact_diagnostics_text.includes("READY:"), true);
  assert.equal(validCompact.final_output_must_still_use_root_chatgpt_final_output, true);
  assert.equal(validCompact.compact_surface_must_not_replace_final_output, true);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedCompact = blocked.chatgpt_operator_compact_diagnostics;

  assert.equal(blocked.ok, true);
  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blocked.chatgpt_final_output.may_output_story_text, false);
  assert.equal(blocked.chatgpt_final_output.output_text.includes(completeText), false);

  assert.equal(blockedCompact.used, true);
  assert.equal(blockedCompact.phase, "36C");
  assert.equal(blockedCompact.contract_valid, true);
  assert.equal(blockedCompact.compact_surface_valid, true);
  assert.equal(blockedCompact.source_contract_valid, false);
  assert.equal(blockedCompact.blocked, true);
  assert.equal(blockedCompact.blocked_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedCompact.can_output_to_chat, false);
  assert.equal(blockedCompact.may_output_story_text, false);
  assert.equal(blockedCompact.must_not_output_candidate, true);
  assert.equal(blockedCompact.missing_modules.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedCompact.blocked_checks.includes("foreshadowing_causality_graph:not_used"), true);
  assert.equal(blockedCompact.operator_next_steps.includes("Do not output final_candidate_text."), true);
  assert.equal(blockedCompact.compact_diagnostics_text.includes("BLOCKED:"), true);
  assert.equal(blockedCompact.compact_diagnostics_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedCompact.compact_diagnostics_text.includes("Do not output final_candidate_text."), true);
  assert.equal(blockedCompact.compact_diagnostics_text.includes(completeText), false);
  assert.equal(blockedCompact.compact_surface_must_not_be_emitted_as_story_text, true);
  assert.equal(blockedCompact.final_output_must_still_use_root_chatgpt_final_output, true);

  const rebuilt = buildChatgptOperatorCompactDiagnosticsSurface(
    blocked.result,
    blocked.chatgpt_final_output,
  );
  assert.deepEqual(rebuilt.missing_modules, blockedCompact.missing_modules);
  assert.deepEqual(rebuilt.blocked_checks, blockedCompact.blocked_checks);
  assert.equal(rebuilt.compact_diagnostics_hash, blockedCompact.compact_diagnostics_hash);

  assert.equal(
    blocked.chatgpt_final_output.output_text,
    blocked.result.extracted_chatgpt_final_output.output_text,
    "Phase36C must not replace the root final output text.",
  );

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36b = "tests/phase36/phase36b-neural-writing-brain-required-modules-readable-diagnostics.test.mjs";
  const phase36c = "tests/phase36/phase36c-chatgpt-bridge-operator-compact-diagnostics-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36b), "run-all missing Phase36B predecessor.");
  assert(runAllText.includes(phase36c), "run-all missing Phase36C registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36b) < runAllText.indexOf(phase36c), "Phase36C should run after Phase36B.");
  assert(runAllText.indexOf(phase36c) < runAllText.indexOf(daily), "Phase36C should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36C ChatGPT bridge operator compact diagnostics surface tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
