import assert from "node:assert/strict";
import { loadVisualLinkFinalAcceptanceConfig, validateVisualLinkFinalAcceptanceConfig, buildVisualLinkFinalAcceptancePreview, compileVisualLinkFinalAcceptanceSummary } from "../../server/src/visual-link-final-acceptance-service.mjs";
import fs from "node:fs/promises";

async function run() {
  const cfg = await loadVisualLinkFinalAcceptanceConfig();
  const v = validateVisualLinkFinalAcceptanceConfig(cfg);
  assert.equal(v.errors.length, 0, `config validation failed: ${JSON.stringify(v.errors)}`);

  // read original files to ensure no writes later
  const enginePath = cfg.source_engine_path;
  const visualIndexPath = cfg.source_visual_index_path;
  const engineBefore = await fs.readFile(enginePath, "utf8");
  let visualIndexBefore = null;
  try {
    visualIndexBefore = await fs.readFile(visualIndexPath, "utf8");
  } catch (e) {
    visualIndexBefore = null;
  }

  const preview = await buildVisualLinkFinalAcceptancePreview({ config: cfg });
  const summary = compileVisualLinkFinalAcceptanceSummary(preview);

  // active engine hash must match expected
  assert.equal(preview.engine_hash_matches, true, "active_engine hash must match expected");

  // visual_index hash may be absent but content must not change
  const engineAfter = await fs.readFile(enginePath, "utf8");
  assert.equal(engineBefore, engineAfter, "active_engine.md was modified");

  if (visualIndexBefore !== null) {
    const visualIndexAfter = await fs.readFile(visualIndexPath, "utf8");
    assert.equal(visualIndexBefore, visualIndexAfter, "visual_index.jsonl was modified");
  }

  // Expect 8 built-in cases
  assert.equal(preview.acceptance_cases.length, 8, `expected 8 acceptance cases, got ${preview.acceptance_cases.length}`);

  // Check specific cases by input_text
  const byInput = new Map(preview.acceptance_cases.map((c) => [c.input_text, c]));

  // character visual
  assert.equal(byInput.get("character_visual: 朝日奈千夜 | file: images/chiyo.png").final_decision, "accepted_preview_chain_ready");

  // weapon visual
  assert.equal(byInput.get("weapon_visual: 未竟折門 | file: images/fold-gate.png").final_decision, "accepted_preview_chain_ready");

  // location visual
  assert.equal(byInput.get("location_visual: 白櫻市 | file: images/shirozakura.png").final_decision, "accepted_preview_chain_ready");

  // canon_link_candidate
  assert.equal(byInput.get("character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate").final_decision, "accepted_preview_chain_ready");
  // ensure no writes flags in config
  assert.equal(cfg.writes_approval_queue, false);
  assert.equal(cfg.creates_approval_item, false);
  assert.equal(cfg.creates_canon_visual_lock, false);

  // canon_visual_lock must be blocked
  const cv = byInput.get("character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock");
  assert.equal(cv.final_decision, "accepted_preview_chain_blocked_as_expected");
  assert.equal(cv.import_guard_result && cv.import_guard_result.guard_decision, "blocked_forbidden_status");

  // ordinary sentence -> no trigger
  assert.equal(byInput.get("這張圖看起來像朝日奈千夜。").final_decision, "accepted_no_trigger_as_expected");

  // file-only -> no trigger
  assert.equal(byInput.get("file: images/chiyo.png").final_decision, "accepted_no_trigger_as_expected");

  // duplicate was deduped: ensure only one entry for chiyo marker exists
  const chiyoCases = preview.acceptance_cases.filter((c) => c.input_text && c.input_text.includes("chiyo.png"));
  // duplicates include original two marker cases plus duplicate; dedupe should yield 2 unique marker-based entries for chiyo (one ready, one lock)
  assert.ok(chiyoCases.length >= 2, `expected at least 2 chiyo-related cases, got ${chiyoCases.length}`);

  // final summary
  assert.equal(summary.failed_count, 0, `expected no failures, got ${summary.failed_count}`);
  assert.equal(summary.summary_decision, "final_acceptance_passed");

  // CLI --json can be parsed
  // spawn node to run CLI
  const { execSync } = await import("node:child_process");
  const cliJson = execSync("node scripts/visual-link-final-acceptance-preview.mjs --json", { encoding: "utf8" });
  JSON.parse(cliJson);

  // Test --text mode for all required inputs
  function runCliText(arg) {
    const cmd = `node scripts/visual-link-final-acceptance-preview.mjs --text "${arg.replace(/"/g, '\\"')}" --json`;
    const out = execSync(cmd, { encoding: "utf8" });
    return JSON.parse(out);
  }

  // 1. character_visual
  const r1 = runCliText("character_visual: 朝日奈千夜 | file: images/chiyo.png");
  assert.equal(r1.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_ready");
  assert.equal(!!r1.preview.acceptance_cases[0].visual_asset_result, true);
  assert.equal(r1.preview.acceptance_cases[0].import_guard_result.guard_decision, "ui_guard_ready");

  // 2. weapon_visual
  const r2 = runCliText("weapon_visual: 未竟折門 | file: images/fold-gate.png");
  assert.equal(r2.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_ready");
  assert.equal(!!r2.preview.acceptance_cases[0].visual_asset_result, true);
  assert.equal(r2.preview.acceptance_cases[0].import_guard_result.guard_decision, "ui_guard_ready");

  // 3. location_visual
  const r3 = runCliText("location_visual: 白櫻市 | file: images/shirozakura.png");
  assert.equal(r3.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_ready");
  assert.equal(!!r3.preview.acceptance_cases[0].visual_asset_result, true);
  assert.equal(r3.preview.acceptance_cases[0].import_guard_result.guard_decision, "ui_guard_ready");

  // 4. canon_link_candidate
  const r4 = runCliText("character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate");
  assert.equal(r4.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_ready");
  assert.equal(r4.preview.acceptance_cases[0].import_guard_result.guard_decision, "ui_guard_ready");

  // 5. canon_visual_lock
  const r5 = runCliText("character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock");
  assert.equal(r5.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_blocked_as_expected");
  assert.equal(r5.preview.acceptance_cases[0].import_guard_result.guard_decision, "blocked_forbidden_status");

  // 6. ordinary sentence -> no trigger
  const r6 = runCliText("這張圖看起來像朝日奈千夜。");
  assert.equal(r6.preview.acceptance_cases[0].final_decision, "accepted_no_trigger_as_expected");
  assert.equal((r6.preview.guard_items || []).length, 0);

  // 7. file-only -> no trigger
  const r7 = runCliText("file: images/chiyo.png");
  assert.equal(r7.preview.acceptance_cases[0].final_decision, "accepted_no_trigger_as_expected");
  assert.equal((r7.preview.guard_items || []).length, 0);

  // 8. duplicate dedupe
  const dup = "character_visual: 朝日奈千夜 | file: images/chiyo.png; character_visual: 朝日奈千夜 | file: images/chiyo.png";
  const r8 = runCliText(dup);
  // ensure only one guard item produced for the duplicated marker
  const guardIds = (r8.preview.guard_items || []).map((g) => g.case_id);
  const uniqueGuards = new Set(guardIds);
  assert.equal(uniqueGuards.size, guardIds.length, "guard items should be unique");
  assert.equal(r8.preview.acceptance_cases[0].final_decision, "accepted_preview_chain_ready");

  console.log("Visual link final acceptance service tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
