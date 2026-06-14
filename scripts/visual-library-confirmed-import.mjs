#!/usr/bin/env node
import {
  runVisualLibraryConfirmedImport,
} from "../server/src/visual-library-confirmed-import-service.mjs";

function parseArgs(argv) {
  const options = {
    sourceDir: null,
    confirmText: null,
    preWriteConfirmText: null,
    realImportConfirmText: null,
    execute: false,
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
      "--real-import-confirm-text",
    ].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--source-dir") options.sourceDir = value;
      else if (argument === "--confirm-text") options.confirmText = value;
      else if (argument === "--pre-write-confirm-text") {
        options.preWriteConfirmText = value;
      } else options.realImportConfirmText = value;
      index += 1;
    } else if (argument === "--execute") options.execute = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--pretty") options.pretty = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.json && options.pretty) {
    throw new Error("--json and --pretty cannot be used together.");
  }
  return options;
}

function summary(payload) {
  return [
    "Confirmed Visual Import Core",
    `Phase: ${payload.phase}`,
    `Source directory: ${payload.source_dir}`,
    `Execute requested: ${payload.execute_requested}`,
    `Decision: ${payload.confirmed_import_decision}`,
    `Imported: ${payload.imported_items.length}`,
    `Blocked: ${payload.blocked_items.length}`,
    "Writes Approval Queue: false",
    "Creates approval item: false",
    "Creates canon_visual_lock: false",
    "Updates active_engine: false",
    "Updates Canon DB: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-confirmed-import.mjs "
      + "[--source-dir <path>] [--confirm-text <text>] "
      + "[--pre-write-confirm-text <text>] "
      + "[--real-import-confirm-text <text>] [--execute] [--json|--pretty]",
    );
  } else {
    const result = await runVisualLibraryConfirmedImport(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else console.log(summary(result));
  }
} catch (error) {
  console.error(`Confirmed visual import failed: ${error.message}`);
  process.exitCode = 1;
}
