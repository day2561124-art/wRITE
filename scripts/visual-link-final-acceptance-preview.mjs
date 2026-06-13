#!/usr/bin/env node
import { loadVisualLinkFinalAcceptanceConfig, buildVisualLinkFinalAcceptancePreview, compileVisualLinkFinalAcceptanceSummary } from "../server/src/visual-link-final-acceptance-service.mjs";
import fs from "node:fs/promises";

function parseArgs(argv) {
  const out = { json: false, text: null, sourcePath: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--text") out.text = argv[++i];
    else if (a === "--source-path") out.sourcePath = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadVisualLinkFinalAcceptanceConfig();
  let inputTexts = [];
  if (args.text) inputTexts = [args.text];
  else if (args.sourcePath) {
    const raw = await fs.readFile(args.sourcePath, "utf8");
    inputTexts = raw.split(/\r?\n/).filter((l) => l.trim());
  }

  const preview = await buildVisualLinkFinalAcceptancePreview({ config: cfg, inputTexts });
  const summary = compileVisualLinkFinalAcceptanceSummary(preview);

  if (args.json) {
    console.log(JSON.stringify({ preview, summary }, null, 2));
    return;
  }

  // human-readable summary
  console.log(`Phase 17M Visual Link Final Acceptance Preview`);
  console.log(`Engine hash matches expected: ${preview.engine_hash_matches}`);
  console.log(`Acceptance cases: ${preview.acceptance_cases.length}`);
  console.log(`Passed: ${summary.passed_count}  Failed: ${summary.failed_count}`);
  for (const c of preview.acceptance_cases) {
    console.log(`- ${c.case_id}: ${c.final_decision} (${c.passed ? "passed" : "FAILED"})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
