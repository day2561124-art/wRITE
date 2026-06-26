import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildReaderResponseSimulatorReport,
  readerResponseSimulatorVersion,
} from "../../server/src/reader-response-simulator-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const servicePath = path.join(root, "server", "src", "reader-response-simulator-service.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be an array.`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} item key must be a string.`);
    assert.equal(map.has(item.key), false, `${label} has duplicate key ${item.key}.`);
    map.set(item.key, item);
  }
  return map;
}

function assertRunAllOrder(runAllText) {
  const phase28r = "tests/phase28/phase28r-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-final-smoke.test.mjs";
  const phase29a = "tests/phase29/phase29a-reader-response-simulator-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase28r), "run-all missing Phase 28R predecessor.");
  assert(runAllText.includes(phase29a), "run-all missing Phase 29A reader response simulator contract.");
  assert(runAllText.indexOf(phase28r) < runAllText.indexOf(phase29a), "Phase 29A should run after Phase 28R.");
  assert(runAllText.indexOf(phase29a) < runAllText.indexOf(daily), "Phase 29A should run before Daily scripts and docs.");
}

function assertStaticServiceTokens(serviceText) {
  for (const token of [
    "reader_expectation",
    "emotional_curve",
    "pacing_pressure",
    "dialogue_tension",
    "chapter_turn_satisfaction",
    "hook_strength",
    "confusion_points",
    "fatigue_points",
    "skim_risk",
    "continuation_desire",
    "reader_questions_to_carry_forward",
    "no_mutation_snapshot",
  ]) {
    assert(serviceText.includes(token), `reader response service missing contract token: ${token}`);
  }
}

const strongText = [
  "千夜在門禁燈第二次閃紅之前把手按上去。九逃叫她等，聲音壓得很低，不是命令，是他已經看見退路會被鎖死。",
  "她沒有回頭，只把終端轉給他看。地圖上的舊路線正在一格一格熄滅，像有人從背後把橋抽走。",
  "『現在不進去，下一道門就會關。』千夜說。『進去的話，我們也回不來。』九逃回她。",
  "選擇在那一秒變成代價。門開了，舊路徑從終端上消失，九逃罵了一聲，還是跟著她跨進去。",
  "他們沒有贏，只是把戰場推到不能回頭的地方。門在身後合上時，裡面有人先一步喊出了千夜的名字。",
].join("\n\n");

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

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");

assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase29A active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase29A compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticServiceTokens(serviceText);
assert.equal(readerResponseSimulatorVersion, "reader_response_simulator_v1");

const report = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase29A reader response simulator contract smoke.",
  candidate_text: strongText,
  dramatic_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
});

assert.equal(report.used, true);
assert.equal(report.phase, "29A");
assert.equal(report.version, readerResponseSimulatorVersion);
assert.equal(report.status, "completed");
assert.equal(report.read_only, true);
assert.equal(report.contract_only, true);
assert.equal(report.preview_only, true);
assert.equal(report.candidate_only, true);
assert.equal(report.no_generation, true);
assert.equal(report.no_auto_persist, true);
assert.equal(report.no_candidate_save, true);
assert.equal(report.no_approval, true);
assert.equal(report.no_canon_update, true);
assert.equal(report.no_active_engine_update, true);
assert.equal(report.no_compressed_rules_update, true);
assert.equal(report.no_runtime_ui, true);
assert.equal(report.no_mcp_tool, true);
assert.match(report.source.candidate_text_digest, /^[a-f0-9]{64}$/u);
assert.match(report.source.conflict_digest, /^[a-f0-9]{64}$/u);
assert.match(report.trace_id, /^reader_response_[a-f0-9]{16}$/u);

assert.equal(report.reader_expectation.status, "clear");
assert(report.reader_expectation.opening_promise.includes("門禁"));
assert(report.reader_expectation.expected_payoff.includes("不能回頭"));
assert.deepEqual(report.reader_questions_to_carry_forward, ["門內的人為什麼知道千夜的名字？"]);

assert(report.emotional_curve.score >= 55, "emotional curve should be at least watch level.");
assert(report.pacing_pressure.score >= 45, "pacing should not be fully blocked for the strong sample.");
assert(report.dialogue_tension.score >= 55, "dialogue tension should be visible.");
assert(report.chapter_turn_satisfaction.score >= 76, "chapter turn should be strong.");
assert(report.hook_strength.score >= 76, "ending hook should be strong.");
assert(report.continuation_desire.score >= 70, "continuation desire should be readable.");
assert(report.overall_reader_response_score >= 65, "overall reader response should be usable.");

const cards = keyed(report.cards, "reader response cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "reader_response_overall",
    "chapter_turn_satisfaction",
    "hook_strength",
    "pacing_pressure",
    "dialogue_tension",
    "skim_risk",
  ],
  "Phase29A card order drifted.",
);
for (const card of cards.values()) {
  assert.equal(typeof card.title, "string");
  assert.equal(typeof card.label, "string");
  assert.equal(typeof card.score, "number");
  assert(["safe", "watch", "blocked"].includes(card.tone), `${card.key} tone must be displayable.`);
}

for (const key of [
  "read_only",
  "contract_only",
  "preview_only",
  "no_generation",
  "no_auto_persist",
  "no_candidate_save",
  "no_approval",
]) {
  assert.equal(report.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
}
for (const key of [
  "can_write_canon",
  "can_update_active_engine",
  "can_update_compressed_rules",
  "can_modify_runtime_ui",
  "can_register_mcp_tool",
]) {
  assert.equal(report.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
}
for (const key of [
  "active_engine_modified",
  "compressed_rules_modified",
  "candidate_saved",
  "canon_written",
  "approval_item_created",
  "runtime_ui_modified",
  "mcp_tool_added",
]) {
  assert.equal(report.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const deterministic = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase29A reader response simulator contract smoke.",
  candidate_text: strongText,
  dramatic_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
});
assert.deepEqual(deterministic, report, "Phase29A report should be deterministic for the same input.");

const weakReport = await buildReaderResponseSimulatorReport({
  candidate_text: "千夜確認資料。九逃確認流程。大家看著狀態，事情好像差不多。",
  dramatic_conflict_plan: { protagonist: "千夜" },
});
assert.equal(weakReport.status, "incomplete");
assert(weakReport.missing_fields.includes("reader_expectation_needs_context"));
assert(weakReport.chapter_turn_satisfaction.score < report.chapter_turn_satisfaction.score);
assert(weakReport.hook_strength.score < report.hook_strength.score);

const emptyReport = await buildReaderResponseSimulatorReport({});
assert.equal(emptyReport.status, "incomplete");
assert(emptyReport.missing_fields.includes("missing_candidate_text"));
assert(emptyReport.warnings.includes("reader_response_input_incomplete"));

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase29A changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase29A changed compressed_rules hash.");

console.log("Phase29A reader response simulator contract tests passed.");
