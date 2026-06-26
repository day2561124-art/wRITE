import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildReaderResponseSimulatorReport } from "../../server/src/reader-response-simulator-service.mjs";
import { buildReaderResponseUiSurface } from "../../server/src/reader-response-ui-surface-service.mjs";
import {
  buildReaderResponseBridgePreview,
  readerResponseBridgePreviewVersion,
} from "../../server/src/reader-response-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const bridgePreviewPath = path.join(root, "server", "src", "reader-response-bridge-preview-service.mjs");
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
  const phase29b = "tests/phase29/phase29b-reader-response-simulator-ui-surface.test.mjs";
  const phase29c = "tests/phase29/phase29c-reader-response-simulator-bridge-preview.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase29b), "run-all missing Phase 29B predecessor.");
  assert(runAllText.includes(phase29c), "run-all missing Phase 29C reader response bridge preview.");
  assert(runAllText.indexOf(phase29b) < runAllText.indexOf(phase29c), "Phase 29C should run after Phase 29B.");
  assert(runAllText.indexOf(phase29c) < runAllText.indexOf(daily), "Phase 29C should run before Daily scripts and docs.");
}

function assertStaticBridgeTokens(serviceText) {
  for (const token of [
    "reader_response_simulator_bridge_preview",
    "chatgpt_bridge",
    "readonly_preview",
    "chatgpt_summary_lines",
    "allowed_bridge_actions",
    "blocked_bridge_capabilities",
    "raw_json_preview",
    "no_mutation_snapshot",
    "can_write_canon",
    "can_update_active_engine",
    "can_register_mcp_tool",
  ]) {
    assert(serviceText.includes(token), `reader response bridge preview missing token: ${token}`);
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
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase29C active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase29C compressed_rules hash baseline drifted before test.");

const [runAllText, bridgePreviewText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(bridgePreviewPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticBridgeTokens(bridgePreviewText);
assert.equal(readerResponseBridgePreviewVersion, "reader_response_bridge_preview_v1");

const report = await buildReaderResponseSimulatorReport({
  task_prompt: "Phase29C reader response bridge preview smoke.",
  candidate_text: strongText,
  dramatic_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
});
const surface = await buildReaderResponseUiSurface({ report, include_raw: false });
const preview = await buildReaderResponseBridgePreview({ surface, include_raw: false });

assert.equal(preview.used, true);
assert.equal(preview.phase, "29C");
assert.equal(preview.version, readerResponseBridgePreviewVersion);
assert.equal(preview.bridge_kind, "reader_response_simulator_bridge_preview");
assert.equal(preview.bridge_channel, "chatgpt_bridge");
assert.equal(preview.bridge_mode, "readonly_preview");
assert.equal(preview.bridge_surface, "reader_response_ui_surface_summary");
assert.equal(preview.source_phase, "29B");
assert.equal(preview.preview_status, "ready");
assert.equal(preview.status_badge.tone, "ready");
assert.match(preview.source_surface_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.surface_markdown, /Reader Response Simulator Bridge Preview/u);
assert.match(preview.surface_markdown, /bridge_channel: chatgpt_bridge/u);
assert.match(preview.surface_markdown, /can_write_canon: false/u);
assert.equal(preview.raw_surface, null);
assert.equal(preview.raw_json_preview.visible_by_default, false);
assert.equal(preview.raw_json_preview.raw_surface_included, false);

assert.equal(preview.bridge_readability.status, "ready");
assert.equal(preview.bridge_readability.overall_reader_response_score, surface.overall_reader_response_score);
assert.equal(preview.overall_reader_response_score, surface.overall_reader_response_score);
assert(preview.chatgpt_summary_lines.some((line) => line.includes("讀者體感")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("章節推進")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("章尾鉤子")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("跳讀風險")));

const overviewCards = keyed(preview.overview_cards, "bridge overview cards");
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
  "Phase29C overview card order drifted.",
);
assert.equal(overviewCards.get("reader_response_overall")?.label, "讀者體感");

const sections = keyed(preview.bridge_sections, "bridge sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "bridge_header",
    "reader_response_cards",
    "reader_questions",
    "risk_points",
    "revision_suggestions",
    "safety_boundary",
    "raw_json_preview",
    "no_mutation_snapshot",
  ],
  "Phase29C bridge sections should stay stable for ChatGPT preview.",
);
assert.equal(sections.get("reader_response_cards")?.items.length, 6);
assert.equal(sections.get("reader_questions")?.items[0]?.label, "門內的人為什麼知道千夜的名字？");
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

const allowed = keyed(preview.allowed_bridge_actions, "allowed bridge actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_reader_response_summary",
    "copy_reader_response_markdown",
    "inspect_reader_response_ui_surface",
    "open_writer_workbench_reader_response_route",
  ],
  "Phase29C allowed bridge actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(preview.blocked_bridge_capabilities, "blocked bridge capabilities");
for (const key of [
  "generate_text",
  "revise_text",
  "save_candidate",
  "approve",
  "confirm_adoption",
  "write_canon",
  "update_active_engine",
  "update_compressed_rules",
  "modify_runtime_ui",
  "register_mcp_tool",
]) {
  assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked.`);
}

for (const key of [
  "read_only",
  "preview_only",
  "candidate_only",
  "no_generation",
  "no_auto_persist",
  "no_candidate_save",
  "no_approval",
  "no_canon_update",
  "no_active_engine_update",
  "no_compressed_rules_update",
]) {
  assert.equal(preview.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
}
for (const key of [
  "can_write_canon",
  "can_update_active_engine",
  "can_update_compressed_rules",
  "can_modify_runtime_ui",
  "can_register_mcp_tool",
  "can_save_candidate",
  "can_approve",
  "can_confirm_adoption",
]) {
  assert.equal(preview.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
}
for (const key of [
  "active_engine_modified",
  "compressed_rules_modified",
  "candidate_saved",
  "canon_written",
  "approval_item_created",
  "runtime_ui_modified",
  "mcp_tool_added",
  "mcp_tool_registered",
]) {
  assert.equal(preview.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawPreview = await buildReaderResponseBridgePreview({ surface, include_raw: true, include_markdown: false });
assert.equal(rawPreview.raw_surface.phase, "29B");
assert.equal(rawPreview.raw_json_preview.raw_surface_included, true);
assert.equal(rawPreview.surface_markdown, "");

const deterministic = await buildReaderResponseBridgePreview({ surface, include_raw: false });
assert.deepEqual(deterministic, preview, "Phase29C bridge preview should be deterministic for the same surface.");

const weakPreview = await buildReaderResponseBridgePreview({
  candidate_text: "千夜確認資料。九逃確認流程。大家看著狀態，事情好像差不多。",
  dramatic_conflict_plan: { protagonist: "千夜" },
});
assert.equal(weakPreview.preview_status, "needs_context");
assert.equal(weakPreview.status_badge.tone, "empty");
assert.equal(weakPreview.safety_boundary.no_active_engine_update, true);
assert.equal(weakPreview.safety_boundary.can_write_canon, false);
assert.equal(weakPreview.no_mutation_snapshot.mcp_tool_added, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase29C changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase29C changed compressed_rules hash.");

console.log("Phase29C reader response simulator bridge preview tests passed.");
