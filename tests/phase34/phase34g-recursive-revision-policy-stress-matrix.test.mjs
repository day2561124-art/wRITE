import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildReaderResponseRevisionGate,
  readerResponseRevisionGateVersion,
} from "../../server/src/reader-response-revision-gate-service.mjs";
import {
  buildRecursiveRevisionPolicy,
  recursiveRevisionPolicyVersion,
} from "../../server/src/recursive-revision-policy-service.mjs";
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

function assertSafety(report) {
  assert.equal(report.read_only, true);
  assert.equal(report.candidate_only, true);
  assert.equal(report.no_auto_persist, true);
  assert.equal(report.no_candidate_save, true);
  assert.equal(report.no_approval, true);
  assert.equal(report.no_adoption, true);
  assert.equal(report.no_canon_update, true);
  assert.equal(report.no_active_engine_update, true);
  assert.equal(report.no_compressed_rules_update, true);
  assert.equal(report.no_mutation_snapshot.active_engine_modified, false);
  assert.equal(report.no_mutation_snapshot.canon_written, false);
  assert.equal(report.no_mutation_snapshot.candidate_saved, false);
}

function longCandidate(label) {
  return [
    `Phase34G ${label} corridor candidate starts with 千夜 and 九逃 at a pressure-bearing door.`,
    "The paragraph intentionally stays long enough to avoid soft acceptance being determined only by candidate length, while the synthetic reader report controls the exact weak axis under test.",
    "The scene is candidate-only and contains no canon mutation, no active engine update, and no compressed rules update.",
  ].join("\n\n");
}

function readerReport(overrides = {}) {
  const summary = {
    emotional_curve_score: 80,
    pacing_pressure_score: 80,
    dialogue_tension_score: 70,
    chapter_turn_satisfaction_score: 80,
    hook_strength_score: 80,
    skim_risk_score: 20,
    continuation_desire_score: 75,
    ...overrides.summary,
  };

  return {
    used: true,
    phase: "29A",
    version: "reader_response_simulator_v1",
    status: "completed",
    overall_reader_response_score: overrides.overall ?? 70,
    reader_response_summary: summary,
    reader_expectation: {
      status: overrides.readerExpectationStatus ?? "clear",
    },
    emotional_curve: {
      status: summary.emotional_curve_score >= 70 ? "strong" : "weak",
      score: summary.emotional_curve_score,
    },
    pacing_pressure: {
      status: summary.pacing_pressure_score >= 70 ? "strong" : "weak",
      score: summary.pacing_pressure_score,
    },
    dialogue_tension: {
      status: summary.dialogue_tension_score >= 60 ? "usable" : "weak",
      score: summary.dialogue_tension_score,
    },
    chapter_turn_satisfaction: {
      status: summary.chapter_turn_satisfaction_score >= 60 ? "visible" : "weak",
      score: summary.chapter_turn_satisfaction_score,
    },
    hook_strength: {
      status: summary.hook_strength_score >= 60 ? "usable" : "weak",
      score: summary.hook_strength_score,
    },
    skim_risk: {
      status: summary.skim_risk_score >= 75 ? "high" : "low",
      score: summary.skim_risk_score,
    },
    continuation_desire: {
      status: summary.continuation_desire_score >= 60 ? "present" : "weak",
      score: summary.continuation_desire_score,
    },
    revision_suggestions: overrides.revisionSuggestions ?? [],
    warnings: [],
    source: {
      candidate_text_digest: hash(overrides.candidateText ?? longCandidate("synthetic")),
    },
    trace_id: "phase34g_synthetic_reader_report",
  };
}

function assertStressCase(testCase) {
  const candidateText = testCase.candidateText ?? longCandidate(testCase.name);
  const gate = buildReaderResponseRevisionGate({
    reader_response_simulator: readerReport({
      ...testCase.report,
      candidateText,
    }),
    candidate_text: candidateText,
  });

  assert.equal(gate.used, true);
  assert.equal(gate.phase, "34C");
  assert.equal(gate.version, readerResponseRevisionGateVersion);
  assert.equal(gate.status, "revision_required", testCase.name);
  assert.equal(gate.revision_required, true, testCase.name);
  assert.equal(gate.revision_type, testCase.expectedRevisionType, testCase.name);
  assert.equal(gate.return_stage, testCase.expectedReturnStage, testCase.name);
  assert(
    gate.triggers.some((trigger) => trigger.key === testCase.expectedTrigger),
    `${testCase.name} should trigger ${testCase.expectedTrigger}.`,
  );
  assert(
    gate.rewrite_targets.some((target) => target.includes(testCase.expectedTargetIncludes)),
    `${testCase.name} should expose rewrite target containing: ${testCase.expectedTargetIncludes}`,
  );
  assertSafety(gate);

  const policy = buildRecursiveRevisionPolicy({
    critique: { structural_reasons: [], risk_flags: [] },
    reader_response_revision_gate: gate,
  });

  assert.equal(policy.used, true);
  assert.equal(policy.phase, "34B");
  assert.equal(policy.version, recursiveRevisionPolicyVersion);
  assert.equal(policy.status, "revision_required", testCase.name);
  assert.equal(policy.revision_required, true, testCase.name);
  assert.equal(policy.revision_type, testCase.expectedRevisionType, testCase.name);
  assert.equal(policy.return_stage, testCase.expectedReturnStage, testCase.name);
  assert.equal(policy.reader_response_revision_gate.phase, "34C", testCase.name);
  assert(
    policy.reader_response_revision_gate.triggers.some((trigger) => trigger.key === testCase.expectedTrigger),
    `${testCase.name} policy should preserve ${testCase.expectedTrigger}.`,
  );
  assert(
    policy.rewrite_targets.some((target) => target.includes(testCase.expectedTargetIncludes)),
    `${testCase.name} policy should preserve rewrite target containing: ${testCase.expectedTargetIncludes}`,
  );
  assertSafety(policy);

  return { gate, policy };
}

assert.equal(readerResponseRevisionGateVersion, "reader_response_revision_gate_v1");
assert.equal(recursiveRevisionPolicyVersion, "recursive_revision_policy_v1");

const shortUnclearCandidate = "千夜看著門。九逃說先不要。她們都知道有事，但不知道讀者該等什麼被支付。";

const stressCases = [
  {
    name: "reader expectation unclear",
    candidateText: shortUnclearCandidate,
    report: {
      readerExpectationStatus: "unclear",
    },
    expectedTrigger: "reader_expectation_unclear",
    expectedRevisionType: "conflict_reframe",
    expectedReturnStage: "dramatic_conflict_manager",
    expectedTargetIncludes: "clarify who wants what before the scene turns",
  },
  {
    name: "chapter turn not visible",
    report: {
      summary: { chapter_turn_satisfaction_score: 35 },
    },
    expectedTrigger: "chapter_turn_not_visible",
    expectedRevisionType: "conflict_reframe",
    expectedReturnStage: "dramatic_conflict_manager",
    expectedTargetIncludes: "make the ending situation materially different",
  },
  {
    name: "ending hook weak",
    report: {
      summary: { hook_strength_score: 35 },
    },
    expectedTrigger: "ending_hook_weak",
    expectedRevisionType: "ending_cleanup",
    expectedReturnStage: "raw_generation",
    expectedTargetIncludes: "replace soft closing with a concrete unanswered pressure",
  },
  {
    name: "dialogue tension weak",
    report: {
      summary: { dialogue_tension_score: 30 },
    },
    expectedTrigger: "dialogue_tension_weak",
    expectedRevisionType: "dialogue_rewrite",
    expectedReturnStage: "raw_generation",
    expectedTargetIncludes: "increase dialogue friction",
  },
  {
    name: "emotional curve flat",
    report: {
      summary: { emotional_curve_score: 30 },
    },
    expectedTrigger: "emotional_curve_flat",
    expectedRevisionType: "structural_scene_rewrite",
    expectedReturnStage: "scene_planner",
    expectedTargetIncludes: "add visible emotional pressure",
  },
  {
    name: "skim risk high",
    report: {
      summary: { skim_risk_score: 90 },
    },
    expectedTrigger: "skim_risk_high",
    expectedRevisionType: "structural_scene_rewrite",
    expectedReturnStage: "scene_planner",
    expectedTargetIncludes: "reduce report-like exposition",
  },
  {
    name: "overall reader response weak",
    report: {
      overall: 40,
    },
    expectedTrigger: "overall_reader_response_weak",
    expectedRevisionType: "structural_scene_rewrite",
    expectedReturnStage: "scene_planner",
    expectedTargetIncludes: "repair scene purpose before final wording",
  },
];

for (const testCase of stressCases) {
  assertStressCase(testCase);
}

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34g-"));

const exhaustedWeakDraft = [
  "千夜與九逃在門前整理資料。她們確認門禁、路線、支援與回報都需要處理，所以目前狀況可以被列為調查事項。",
  "千夜說應該繼續確認，九逃說應該等待支援。兩人把條件說完之後，場面維持在原本狀態，沒有明確代價。",
  "最後她們決定之後再看。這件事可能還會有發展。",
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
  const exhausted = await runFullRecursiveWritingPipeline({
    task_prompt: "Phase34G max-round exhaustion should not fake-accept weak reader response.",
    generation_context: {
      project: "武裝學院的二三事",
      chapter_mode: "candidate only",
      phase34g_stress_matrix: true,
    },
    retrieval_context: {
      scope: "candidate only",
      canon_write_allowed: false,
      active_engine_update_allowed: false,
    },
    dramatic_conflict_plan: conflictPlan,
    reader_response_conflict_plan: conflictPlan,
    save_candidate: false,
    max_revision_rounds: 1,
    enable_character_voice_guard: false,
    include_character_mind_state_ledger: false,
    include_dramatic_conflict_manager: false,
    include_foreshadowing_causal_graph: false,
    include_foreshadowing_payoff_guard: false,
    include_foreshadowing_payoff_repair_planner: false,
    include_foreshadowing_payoff_acceptance_gate: false,
    include_foreshadowing_settlement_diff_preview: false,
    include_reader_response_revision_gate: true,
    include_reader_response_simulator: true,
  }, {
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    proofingContexts: path.join(tempRoot, "proofing"),
    generationAdapter: async () => ({
      text: exhaustedWeakDraft,
      model_name: "deterministic-phase34g-stress-matrix",
      model_version: "initial-weak",
    }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: async () => ({
      text: exhaustedWeakDraft,
      model_name: "deterministic-phase34g-stress-matrix",
      model_version: "still-weak-after-max-round",
    }),
  });

  assert.equal(exhausted.status, "failed");
  assert.equal(exhausted.pipeline_stage, "structural_revision_required");
  assert(
    ["max_revision_rounds_exhausted", "structural_revision_required"].includes(exhausted.stop_reason),
    `Unexpected stop_reason: ${exhausted.stop_reason}`,
  );
  assert.equal(exhausted.recursive_revision.used, true);
  assert.equal(exhausted.recursive_revision.rounds_attempted, 1);
  assert.equal(exhausted.recursive_revision.rounds[0].recursive_revision_policy.retry_allowed, false);
  assert.equal(
    exhausted.recursive_revision.rounds[0].recursive_revision_policy.escalation_reason,
    "max_revision_round_reached",
  );
  assert.equal(exhausted.final_candidate_text, "");
  assert.equal(exhausted.candidate_created, false);
  assert.equal(exhausted.active_engine_update_allowed, false);
  assert.equal(exhausted.canon_update_allowed, false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34f = "tests/phase34/phase34f-full-pipeline-live-writing-smoke.test.mjs";
  const phase34g = "tests/phase34/phase34g-recursive-revision-policy-stress-matrix.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34f), "run-all missing Phase34F predecessor.");
  assert(runAllText.includes(phase34g), "run-all missing Phase34G registration.");
  assert(runAllText.indexOf(phase34f) < runAllText.indexOf(phase34g), "Phase34G should run after Phase34F.");
  assert(runAllText.indexOf(phase34g) < runAllText.indexOf(daily), "Phase34G should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34G recursive revision policy stress matrix tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
