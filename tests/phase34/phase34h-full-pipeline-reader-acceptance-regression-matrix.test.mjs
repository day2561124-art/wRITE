import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

function assertCandidateSafety(result, label) {
  assert.equal(result.candidate_created, false, `${label}: candidate should not be saved.`);
  assert.equal(result.active_engine_update_allowed, false, `${label}: active engine update must stay blocked.`);
  assert.equal(result.canon_update_allowed, false, `${label}: canon update must stay blocked.`);
  assert.equal(result.reader_response_simulator.no_auto_persist, true, `${label}: simulator must not persist.`);
  assert.equal(result.reader_response_revision_gate.no_auto_persist, true, `${label}: gate must not persist.`);
  assert.equal(result.reader_response_revision_gate.no_canon_update, true, `${label}: gate must not update canon.`);
  assert.equal(result.reader_response_revision_gate.no_active_engine_update, true, `${label}: gate must not update active engine.`);
}

const strongText = [
  "千夜在門禁燈第二次閃紅之前把手按上去。九逃叫她等，聲音壓得很低，不是命令，是他已經看見退路會被鎖死。",
  "她沒有回頭，只把終端轉給他看。地圖上的舊路線正在一格一格熄滅，像有人從背後把橋抽走。",
  "「現在不進去，下一道門就會關。」千夜說。「進去的話，我們也回不來。」九逃回她。",
  "選擇在那一秒變成代價。門開了，舊路徑從終端上消失，九逃罵了一聲，還是跟著她跨進去。",
  "他們沒有贏，只是把戰場推到不能回頭的地方。門在身後合上時，裡面有人先一步喊出了千夜的名字。",
].join("\n\n");

const weakTurnText = [
  "千夜確認資料，九逃確認流程，終端顯示目前狀態，門禁系統依照規則進行更新。",
  "兩人把條件說完後，場面維持原狀。沒有新的退路消失，也沒有任何選擇被迫落下。",
  "最後，她們決定之後再看。大家安靜地記錄目前狀態。",
].join("\n\n");

const weakHookText = [
  "千夜在倒數結束前按住門禁。九逃伸手阻止她，終端上的舊路線開始熄滅。",
  "「現在不進去會失去線索。」千夜說。「進去就沒有退路。」九逃回她。",
  "選擇變成代價，門打開後，撤離路線從地圖上消失。",
  "最後，大家安靜地記錄目前狀態。",
].join("\n\n");

const conflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "在門禁鎖死前確認門內是否有人偽造她的名字。",
  opposition: "九逃的阻止與即將封閉的門禁系統。",
  opposition_pressure: "九逃知道開門會刪除退路，門禁倒數會讓線索消失。",
  stakes: "等待會失去追蹤線，進入會失去撤離路線。",
  reversal_or_reveal: "開門不是安全通行，而是讓舊撤離路線從終端地圖上消失。",
  required_choice: "千夜必須在等待支援與抓住門內線索之間選擇。",
  cost_or_payment: "撤離路線熄滅。",
  new_status_quo: "千夜與九逃被迫進入不能回頭的地下區域。",
  ending_hook: "門內的人先喊出朝日奈千夜的名字。",
};

const weakTurnConflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "確認門禁資料是否異常。",
  opposition: "需要等待支援的流程壓力。",
  stakes: "拖延會讓調查節奏變慢。",
  ending_hook: "後續調查可能繼續。",
};

const noHookConflictPlan = {
  ...conflictPlan,
  ending_hook: "",
};

const deterministicFinalPolisherAdapter = async ({ raw_draft_text }) => ({
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
});

async function runMatrixCase(tempRoot, testCase) {
  let revisionCalls = 0;
  const result = await runFullRecursiveWritingPipeline({
    task_prompt: `Phase34H reader acceptance regression: ${testCase.name}`,
    generation_context: {
      project: "武裝學院的二三事",
      chapter_mode: "candidate only",
      phase34h_reader_acceptance_regression: true,
    },
    retrieval_context: {
      scope: "candidate only",
      canon_write_allowed: false,
      active_engine_update_allowed: false,
    },
    dramatic_conflict_plan: testCase.conflictPlan,
    save_candidate: false,
    max_revision_rounds: testCase.maxRevisionRounds ?? 2,
    enable_character_voice_guard: false,
    include_character_mind_state_ledger: false,
    include_dramatic_conflict_manager: testCase.includeDramaticConflictManager ?? false,
    include_foreshadowing_causal_graph: false,
    include_foreshadowing_payoff_guard: false,
    include_foreshadowing_payoff_repair_planner: false,
    include_foreshadowing_payoff_acceptance_gate: false,
    include_foreshadowing_settlement_diff_preview: false,
    include_reader_response_revision_gate: true,
    include_reader_response_simulator: true,
  }, {
    gptWritingContexts: path.join(tempRoot, "contexts", testCase.slug),
    writingCandidates: path.join(tempRoot, "candidates", testCase.slug),
    proofingContexts: path.join(tempRoot, "proofing", testCase.slug),
    generationAdapter: async () => ({
      text: testCase.initialText,
      model_name: "deterministic-phase34h-regression-matrix",
      model_version: "initial",
    }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: testCase.revisedText
      ? async () => {
          revisionCalls += 1;
          return {
            text: testCase.revisedText,
            model_name: "deterministic-phase34h-regression-matrix",
            model_version: "revised",
          };
        }
      : undefined,
  });
  return { result, revisionCalls };
}

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34h-"));

try {
  const accepted = await runMatrixCase(tempRoot, {
    name: "explicit conflict plan remains accepted when dramatic conflict manager is disabled",
    slug: "accepted-explicit-conflict-plan",
    initialText: strongText,
    conflictPlan,
  });
  assert.equal(accepted.result.status, "completed");
  assert.equal(accepted.result.pipeline_stage, "final_candidate_ready");
  assert.equal(accepted.result.final_candidate_text, strongText);
  assert.equal(accepted.result.recursive_revision.used, false);
  assert.equal(accepted.result.reader_response_revision_gate.status, "no_revision_needed");
  assert.equal(accepted.result.reader_response_revision_gate.revision_required, false);
  assert.equal(accepted.revisionCalls, 0);
  assert(accepted.result.reader_response_simulator.chapter_turn_satisfaction.score >= 60);
  assert(accepted.result.reader_response_simulator.hook_strength.score >= 60);
  assertCandidateSafety(accepted.result, "accepted explicit conflict plan");

  const weakTurn = await runMatrixCase(tempRoot, {
    name: "weak chapter turn cannot be soft accepted",
    slug: "weak-chapter-turn",
    initialText: weakTurnText,
    revisedText: weakTurnText,
    conflictPlan: weakTurnConflictPlan,
    maxRevisionRounds: 1,
  });
  assert.equal(weakTurn.result.status, "failed");
  assert.equal(weakTurn.result.pipeline_stage, "structural_revision_required");
  assert.equal(weakTurn.result.reader_response_revision_gate.revision_required, true);
  assert(
    weakTurn.result.reader_response_revision_gate.triggers.some((trigger) => trigger.key === "chapter_turn_not_visible"),
    "weak chapter turn should trigger chapter_turn_not_visible.",
  );
  assert.equal(weakTurn.result.final_candidate_text, "");
  assert.equal(weakTurn.revisionCalls, 1);
  assertCandidateSafety(weakTurn.result, "weak chapter turn");

  const weakHook = await runMatrixCase(tempRoot, {
    name: "weak ending hook cannot be soft accepted",
    slug: "weak-ending-hook",
    initialText: weakHookText,
    revisedText: weakHookText,
    conflictPlan: noHookConflictPlan,
    maxRevisionRounds: 1,
  });
  assert.equal(weakHook.result.status, "failed");
  assert.equal(weakHook.result.pipeline_stage, "structural_revision_required");
  assert.equal(weakHook.result.reader_response_revision_gate.revision_required, true);
  assert(
    weakHook.result.reader_response_revision_gate.triggers.some((trigger) => trigger.key === "ending_hook_weak"),
    "weak ending hook should trigger ending_hook_weak.",
  );
  assert.equal(weakHook.result.final_candidate_text, "");
  assert.equal(weakHook.revisionCalls, 1);
  assertCandidateSafety(weakHook.result, "weak ending hook");

  const acceptedAfterRevision = await runMatrixCase(tempRoot, {
    name: "reader gate accepts after one concrete revision",
    slug: "accepted-after-revision",
    initialText: weakTurnText,
    revisedText: strongText,
    conflictPlan,
    maxRevisionRounds: 2,
  });
  assert.equal(acceptedAfterRevision.result.status, "completed");
  assert.equal(acceptedAfterRevision.result.pipeline_stage, "final_candidate_ready_after_revision");
  assert.equal(acceptedAfterRevision.result.final_candidate_text, strongText);
  assert.equal(acceptedAfterRevision.result.final_candidate_source, "backend_recursive_revision");
  assert.equal(acceptedAfterRevision.result.recursive_revision.used, true);
  assert.equal(acceptedAfterRevision.result.recursive_revision.rounds_attempted, 1);
  assert.equal(acceptedAfterRevision.result.recursive_revision.rounds[0].reader_response_revision_gate.revision_required, true);
  assert.equal(acceptedAfterRevision.result.reader_response_revision_gate.status, "no_revision_needed");
  assert.equal(acceptedAfterRevision.result.reader_response_revision_gate.revision_required, false);
  assert.equal(acceptedAfterRevision.revisionCalls, 1);
  assertCandidateSafety(acceptedAfterRevision.result, "accepted after revision");

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34g = "tests/phase34/phase34g-recursive-revision-policy-stress-matrix.test.mjs";
  const phase34h = "tests/phase34/phase34h-full-pipeline-reader-acceptance-regression-matrix.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34g), "run-all missing Phase34G predecessor.");
  assert(runAllText.includes(phase34h), "run-all missing Phase34H registration.");
  assert(runAllText.indexOf(phase34g) < runAllText.indexOf(phase34h), "Phase34H should run after Phase34G.");
  assert(runAllText.indexOf(phase34h) < runAllText.indexOf(daily), "Phase34H should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34H full pipeline reader acceptance regression matrix tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
