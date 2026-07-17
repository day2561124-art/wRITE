import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildReaderResponseRevisionGate,
  readerResponseRevisionGateVersion,
} from "../../server/src/reader-response-revision-gate-service.mjs";
import { buildReaderResponseSimulatorReport } from "../../server/src/reader-response-simulator-service.mjs";
import { buildRecursiveRevisionPolicy } from "../../server/src/recursive-revision-policy-service.mjs";
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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function assertGateSafety(gate) {
  assert.equal(gate.read_only, true);
  assert.equal(gate.integration_only, true);
  assert.equal(gate.candidate_only, true);
  assert.equal(gate.no_generation, true);
  assert.equal(gate.no_auto_persist, true);
  assert.equal(gate.no_candidate_save, true);
  assert.equal(gate.no_approval, true);
  assert.equal(gate.no_adoption, true);
  assert.equal(gate.no_canon_update, true);
  assert.equal(gate.no_active_engine_update, true);
  assert.equal(gate.no_compressed_rules_update, true);
  assert.equal(gate.safety_boundary.can_write_canon, false);
  assert.equal(gate.safety_boundary.can_update_active_engine, false);
  assert.equal(gate.safety_boundary.can_register_mcp_tool, false);
  assert.equal(gate.no_mutation_snapshot.active_engine_modified, false);
  assert.equal(gate.no_mutation_snapshot.canon_written, false);
  assert.equal(gate.no_mutation_snapshot.candidate_saved, false);
}

const conflictPlan = {
  protagonist: "千夜",
  protagonist_want: "在門禁鎖死前進入下一條路線",
  opposition: "九逃與即將封閉的門禁系統",
  opposition_pressure: "九逃想阻止她，門禁系統會關閉退路",
  stakes: "等待會失去前進路線，進入會失去退路",
  reversal_or_reveal: "開門不是安全，而是刪除舊退路",
  required_choice: "千夜必須在等待支援與強行進入之間選擇",
  cost_or_payment: "舊路徑從終端上消失",
  new_status_quo: "隊伍被迫進入不能回頭的新戰場",
  ending_hook: "門內有人先一步喊出千夜的名字",
};

const weakText = [
  "千夜確認資料。九逃確認流程。終端顯示目前狀態，門禁系統依照規則進行更新，所有資訊都被整理成可以判讀的項目。",
  "大家看著狀態，依序理解目前的狀況，相關條件也都逐項成立。於是她們知道接下來應該處理門禁、路線、支援與回報。",
  "事情好像差不多，畫面安靜下來。",
].join("\n\n");

const strongText = [
  "千夜在門禁燈第二次閃紅之前把手按上去。九逃叫她等，聲音壓得很低，不是命令，是他已經看見退路會被鎖死。",
  "她沒有回頭，只把終端轉給他看。地圖上的舊路線正在一格一格熄滅，像有人從背後把橋抽走。",
  "『現在不進去，下一道門就會關。』千夜說。『進去的話，我們也回不來。』九逃回她。",
  "選擇在那一秒變成代價。門開了，舊路徑從終端上消失，九逃罵了一聲，還是跟著她跨進去。",
  "他們沒有贏，只是把戰場推到不能回頭的地方。門在身後合上時，裡面有人先一步喊出了千夜的名字。",
].join("\n\n");

assert.equal(readerResponseRevisionGateVersion, "reader_response_revision_gate_v1");

const weakReport = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase34C reader response revision gate smoke.",
  candidate_text: weakText,
  dramatic_conflict_plan: conflictPlan,
});

const weakGate = buildReaderResponseRevisionGate({
  reader_response_simulator: weakReport,
  candidate_text: weakText,
});

assert.equal(weakGate.used, true);
assert.equal(weakGate.phase, "34C");
assert.equal(weakGate.version, readerResponseRevisionGateVersion);
assert.equal(weakGate.status, "revision_required");
assert.equal(weakGate.revision_required, true);
assert(["dialogue_rewrite", "structural_scene_rewrite", "ending_cleanup", "conflict_reframe"].includes(weakGate.revision_type));
assert.equal(typeof weakGate.return_stage, "string");
assert(weakGate.rewrite_targets.length > 0);
assert(weakGate.stop_conditions.includes("reader_response_revision_gate_status_no_revision_needed"));
assertGateSafety(weakGate);

const policy = buildRecursiveRevisionPolicy({
  critique: {
    structural_reasons: [],
    risk_flags: [],
  },
  reader_response_revision_gate: weakGate,
});

assert.equal(policy.phase, "34B");
assert.equal(policy.revision_required, true);
assert.equal(policy.revision_type, weakGate.revision_type);
assert.equal(policy.return_stage, weakGate.return_stage);
assert(policy.rewrite_targets.some((target) => weakGate.rewrite_targets.includes(target)));
assert.equal(policy.reader_response_revision_gate.phase, "34C");

const strongReport = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase34C reader response revision gate smoke.",
  candidate_text: strongText,
  dramatic_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
});

const strongGate = buildReaderResponseRevisionGate({
  reader_response_simulator: strongReport,
  candidate_text: strongText,
});

assert.equal(strongGate.status, "no_revision_needed");
assert.equal(strongGate.revision_required, false);
assert.equal(strongGate.revision_type, "none");
assertGateSafety(strongGate);

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34c-"));

const baseInput = {
  task_prompt: "Phase34C reader response revision gate pipeline smoke.",
  generation_context: {
    scene: "night corridor",
    chapter_turn: "terminal warning forces a visible decision",
  },
  retrieval_context: {
    scope: "candidate only",
  },
  dramatic_conflict_plan: conflictPlan,
  save_candidate: false,
  max_revision_rounds: 2,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
  include_reader_response_revision_gate: true,
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

try {
  let capturedRevisionPayload = null;
  const result = await runFullRecursiveWritingPipeline(baseInput, {
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    generationAdapter: async () => ({ text: weakText }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: async (payload) => {
      capturedRevisionPayload = payload;
      return { text: strongText };
    },
  });

  assert(capturedRevisionPayload, "revision adapter should be called by reader response gate.");
  assert(capturedRevisionPayload.reader_response_revision_gate, "revision payload should include reader_response_revision_gate.");
  assert.equal(capturedRevisionPayload.reader_response_revision_gate.phase, "34C");
  assert.equal(capturedRevisionPayload.reader_response_revision_gate.revision_required, true);
  assert(capturedRevisionPayload.reader_response_simulator, "revision payload should include reader_response_simulator.");
  assert.equal(capturedRevisionPayload.recursive_revision_policy.reader_response_revision_gate.phase, "34C");
  assert.equal(
    capturedRevisionPayload.revision_plan.reader_response_revision_gate.phase,
    "34C",
  );

  assert.equal(result.status, "completed");
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision");
  assert.equal(result.recursive_revision.used, true);
  assert.equal(result.recursive_revision.rounds_attempted, 1);
  assert.equal(result.recursive_revision.rounds[0].reader_response_revision_gate.phase, "34C");
  assert.equal(result.reader_response_revision_gate.revision_required, false);
  assert.equal(result.candidate_created, false);
  assert.equal(result.active_engine_update_allowed, false);
  assert.equal(result.canon_update_allowed, false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34b = "tests/phase34/phase34b-recursive-revision-policy-hardening.test.mjs";
  const phase34c = "tests/phase34/phase34c-reader-response-revision-gate.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34b), "run-all missing Phase34B predecessor.");
  assert(runAllText.includes(phase34c), "run-all missing Phase34C registration.");
  assert(runAllText.indexOf(phase34b) < runAllText.indexOf(phase34c), "Phase34C should run after Phase34B.");
  assert(runAllText.indexOf(phase34c) < runAllText.indexOf(daily), "Phase34C should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34C reader response revision gate tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
