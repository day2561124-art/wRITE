#!/usr/bin/env node
import {
  runVisualLibraryControlledImportGuardPreview,
} from "../server/src/visual-library-controlled-import-guard-service.mjs";

function parseArgs(argv) {
  const options = {
    sourceDir: null,
    confirmText: null,
    preWriteConfirmText: null,
    json: false,
    pretty: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if ([
      "--source-dir",
      "--confirm-text",
      "--pre-write-confirm-text",
    ].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--source-dir") options.sourceDir = value;
      else if (argument === "--confirm-text") options.confirmText = value;
      else options.preWriteConfirmText = value;
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
  const summary = preview.controlled_import_guard_summary;
  return [
    "Visual Library Controlled Import Guard / Pre-Write Final Gate",
    `Phase: ${preview.phase}`,
    `Mode: ${preview.mode}`,
    `Source directory: ${preview.source_dir}`,
    `Simulation confirmation accepted: ${preview.simulation_confirmation_gate.accepted}`,
    `Pre-write confirmation accepted: ${preview.pre_write_confirmation_gate.accepted}`,
    `Items: ${summary.item_count}`,
    `Ready for Phase 19A: ${summary.ready_count}`,
    `Blocked: ${summary.blocked_count}`,
    `Decision: ${preview.controlled_import_guard_decision}`,
    "Can write visual index: false",
    "Can copy visual asset: false",
    "Can write Approval Queue: false",
    "Can create approval item: false",
    "Can create canon_visual_lock: false",
    "Can confirm real import: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-controlled-import-guard-preview.mjs "
      + "[--source-dir <path>] [--confirm-text <text>] "
      + "[--pre-write-confirm-text <text>] [--json|--pretty]",
    );
  } else {
    const preview = await runVisualLibraryControlledImportGuardPreview({
      sourceDir: options.sourceDir ?? undefined,
      confirmText: options.confirmText ?? undefined,
      preWriteConfirmText: options.preWriteConfirmText ?? undefined,
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
  console.error(`Visual library controlled import guard failed: ${error.message}`);
  process.exitCode = 1;
}
