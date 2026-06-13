#!/usr/bin/env node
import {
  compileVisualLibraryPendingImportReadinessSummary,
  runVisualLibraryPendingImportReadinessPreview,
} from "../server/src/visual-library-pending-import-readiness-service.mjs";

function parseArgs(argv) {
  const options = {
    sourceDir: null,
    confirmText: null,
    json: false,
    pretty: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir" || argument === "--confirm-text") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--source-dir") options.sourceDir = value;
      else options.confirmText = value;
      index += 1;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--pretty") {
      options.pretty = true;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (options.json && options.pretty) {
    throw new Error("--json and --pretty cannot be used together.");
  }
  return options;
}

function formatSummary(preview) {
  const summary = compileVisualLibraryPendingImportReadinessSummary(preview);
  return [
    "Visual Library Pending Import Candidate / Approval Readiness",
    `Phase: ${summary.phase}`,
    `Mode: ${summary.mode}`,
    `Source directory: ${summary.source_dir}`,
    `Confirmation accepted: ${preview.confirmation_gate.accepted}`,
    `Decision: ${summary.decision}`,
    `Candidates: ${summary.candidate_count}`,
    `Ready for human review: ${summary.ready_candidate_count}`,
    `Blocked: ${summary.blocked_candidate_count}`,
    `Readiness cards: ${summary.readiness_card_count}`,
    `Visual index records: ${summary.visual_index_records}`,
    `Risk level: ${summary.risk_level}`,
    "Can submit to Approval Queue: false",
    "Can confirm import: false",
    "Writes visual index: false",
    "Writes visual assets: false",
    "Creates canon_visual_lock: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-pending-import-readiness-preview.mjs "
      + "[--source-dir <path>] [--confirm-text <text>] [--json|--pretty]",
    );
  } else {
    const preview = await runVisualLibraryPendingImportReadinessPreview({
      sourceDir: options.sourceDir ?? undefined,
      confirmText: options.confirmText ?? undefined,
    });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(preview)}\n`);
    } else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    } else {
      console.log(formatSummary(preview));
    }
  }
} catch (error) {
  console.error(
    `Visual library pending import readiness preview failed: ${error.message}`,
  );
  process.exitCode = 1;
}
