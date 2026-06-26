import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildReaderResponseSimulatorReport } from "../../server/src/reader-response-simulator-service.mjs";
import {
  buildReaderResponseUiSurface,
  readerResponseUiSurfaceVersion,
} from "../../server/src/reader-response-ui-surface-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const uiSurfacePath = path.join(root, "server", "src", "reader-response-ui-surface-service.mjs");
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
  const phase29a = "tests/phase29/phase29a-reader-response-simulator-contract.test.mjs";
  const phase29b = "tests/phase29/phase29b-reader-response-simulator-ui-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase29a), "run-all missing Phase 29A predecessor.");
  assert(runAllText.includes(phase29b), "run-all missing Phase 29B reader response UI surface.");
  assert(runAllText.indexOf(phase29a) < runAllText.indexOf(phase29b), "Phase 29B should run after Phase 29A.");
  assert(runAllText.indexOf(phase29b) < runAllText.indexOf(daily), "Phase 29B should run before Daily scripts and docs.");
}

function assertStaticSurfaceTokens(serviceText) {
  for (const token of [
    "reader_response_simulator_ui_surface",
    "overview_cards",
    "一眼看懂",
    "讀者體感",
    "章節推進",
    "章尾鉤子",
    "跳讀風險",
    "safety_badges",
    "can_write_canon",
    "can_update_active_engine",
    "raw_report",
  ]) {
    assert(serviceText.includes(token), `reader response UI surface missing token: ${token}`);
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
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase29B active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase29B compressed_rules hash baseline drifted before test.");

const [runAllText, uiSurfaceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(uiSurfacePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticSurfaceTokens(uiSurfaceText);
assert.equal(readerResponseUiSurfaceVersion, "reader_response_ui_surface_v1");

const report = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase29B reader response UI surface smoke.",
  candidate_text: strongText,
  dramatic_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
});

const surface = await buildReaderResponseUiSurface({ report, include_raw: false });

assert.equal(surface.used, true);
assert.equal(surface.phase, "29B");
assert.equal(surface.version, readerResponseUiSurfaceVersion);
assert.equal(surface.ui_kind, "reader_response_simulator_ui_surface");
assert.equal(surface.source_phase, "29A");
assert.equal(surface.status, "ready");
assert.equal(surface.status_badge.tone, "ready");
assert.match(surface.headline, /讀者體感/u);
assert.match(surface.summary, /整體讀者體感/u);
assert.match(surface.summary, /章尾鉤子/u);
assert.equal(surface.overall_reader_response_score, report.overall_reader_response_score);
assert.equal(surface.raw_report, null);
assert.match(surface.surface_markdown, /Reader Response Simulator UI Surface/u);
assert.match(surface.surface_markdown, /read_only: true/u);
assert.match(surface.surface_markdown, /can_write_canon: false/u);

const overviewCards = keyed(surface.overview_cards, "overview cards");
assert.deepEqual(
  [...overviewCards.keys()],
  [
    "reader_response_overall",
    "chapter_turn_satisfaction",
    "hook_strength",
    "pacing_pressure",
    "dialogue_tension",
    "skim_risk",
  ],
  "Phase29B overview card order drifted.",
);
assert.equal(overviewCards.get("reader_response_overall")?.label, "讀者體感");
assert.equal(overviewCards.get("chapter_turn_satisfaction")?.label, "章節推進");
assert.equal(overviewCards.get("hook_strength")?.label, "章尾鉤子");
assert.equal(overviewCards.get("skim_risk")?.label, "跳讀風險");
for (const card of overviewCards.values()) {
  assert.match(card.value, /^\d+%$/u, `${card.key} should be displayed as a percentage.`);
  assert(["ready", "watch", "blocked", "neutral"].includes(card.tone), `${card.key} has non-displayable tone.`);
}

const sections = keyed(surface.sections, "surface sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "at_a_glance",
    "reader_questions",
    "risk_points",
    "revision_suggestions",
    "safety_boundary",
  ],
  "Phase29B sections should stay human-readable and stable.",
);
assert.equal(sections.get("at_a_glance")?.title, "一眼看懂");
assert.equal(sections.get("reader_questions")?.items[0]?.label, "門內的人為什麼知道千夜的名字？");
assert.equal(sections.get("safety_boundary")?.items.some((item) => item.key === "can_write_canon"), true);
assert.equal(surface.next_operator_action.key, "manual_reader_review");
assert.equal(surface.next_operator_action.ui_target, "reader-response");

const safetyBadges = keyed(surface.safety_badges, "safety badges");
assert.equal(safetyBadges.get("read_only")?.value, true);
assert.equal(safetyBadges.get("preview_only")?.value, true);
assert.equal(safetyBadges.get("can_write_canon")?.value, false);
assert.equal(safetyBadges.get("can_update_active_engine")?.value, false);
assert.equal(safetyBadges.get("can_update_compressed_rules")?.value, false);
assert.equal(safetyBadges.get("runtime_ui_modified")?.value, false);
assert.equal(safetyBadges.get("mcp_tool_added")?.value, false);

assert.equal(surface.safety.read_only, true);
assert.equal(surface.safety.preview_only, true);
assert.equal(surface.safety.candidate_only, true);
assert.equal(surface.safety.no_auto_persist, true);
assert.equal(surface.safety.no_generation, true);
assert.equal(surface.safety.no_candidate_save, true);
assert.equal(surface.safety.no_approval, true);
assert.equal(surface.safety.no_canon_update, true);
assert.equal(surface.safety.no_active_engine_update, true);
assert.equal(surface.safety.no_compressed_rules_update, true);
assert.equal(surface.safety.can_write_canon, false);
assert.equal(surface.safety.can_update_active_engine, false);
assert.equal(surface.safety.can_update_compressed_rules, false);
assert.equal(surface.safety.can_modify_runtime_ui, false);
assert.equal(surface.safety.can_register_mcp_tool, false);
assert.equal(surface.safety.active_engine_modified, false);
assert.equal(surface.safety.compressed_rules_modified, false);
assert.equal(surface.safety.candidate_saved, false);
assert.equal(surface.safety.canon_written, false);
assert.equal(surface.safety.runtime_ui_modified, false);
assert.equal(surface.safety.mcp_tool_added, false);

const rawSurface = await buildReaderResponseUiSurface({ report, include_raw: true, include_markdown: false });
assert.equal(rawSurface.raw_report.trace_id, report.trace_id);
assert.equal(rawSurface.surface_markdown, "");

const weakSurface = await buildReaderResponseUiSurface({
  candidate_text: "千夜確認資料。九逃確認流程。大家看著狀態，事情好像差不多。",
  dramatic_conflict_plan: { protagonist: "千夜" },
});
assert.equal(weakSurface.status, "needs_context");
assert.equal(weakSurface.status_badge.tone, "empty");
assert.equal(weakSurface.next_operator_action.key, "revise_candidate_text");
assert.equal(weakSurface.safety.no_active_engine_update, true);
assert.equal(weakSurface.safety.can_write_canon, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase29B changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase29B changed compressed_rules hash.");

console.log("Phase29B reader response simulator UI surface tests passed.");
