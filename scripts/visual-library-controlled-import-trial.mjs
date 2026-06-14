#!/usr/bin/env node
import { runVisualLibraryControlledImportTrial, loadVisualLibraryControlledImportTrialConfig } from "../server/src/visual-library-controlled-import-trial-service.mjs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const out = { json: false, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--pretty") out.pretty = true;
    else if (a === "--execute") out.execute = true;
    else if (a === "--source-dir") out.sourceDir = argv[++i];
    else if (a === "--confirm-text") out.confirmText = argv[++i];
    else if (a === "--pre-write-confirm-text") out.preWriteConfirmText = argv[++i];
    else if (a === "--real-import-confirm-text") out.realImportConfirmText = argv[++i];
    else if (a === "--rollback-confirm-text") out.rollbackConfirmText = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log("Usage: node scripts/visual-library-controlled-import-trial.mjs [--pretty|--json] [--execute] [--source-dir <path>] --confirm-text <text> --pre-write-confirm-text <text> --real-import-confirm-text <text> --rollback-confirm-text <text>");
    process.exit(0);
  }
  const { config } = await loadVisualLibraryControlledImportTrialConfig();
  const runOpts = {
    execute: Boolean(opts.execute),
    sourceDir: opts.sourceDir,
    confirmText: opts.confirmText,
    preWriteConfirmText: opts.preWriteConfirmText,
    realImportConfirmText: opts.realImportConfirmText,
    rollbackConfirmText: opts.rollbackConfirmText,
  };
  const payload = await runVisualLibraryControlledImportTrial(runOpts);
  if (opts.pretty) console.log(JSON.stringify(payload, null, 2));
  else console.log(JSON.stringify(payload));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('visual-library-controlled-import-trial.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
