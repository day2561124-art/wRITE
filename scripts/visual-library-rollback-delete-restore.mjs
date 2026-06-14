#!/usr/bin/env node
import {
  runVisualLibraryRollbackDeleteRestoreOperation,
} from "../server/src/visual-library-rollback-delete-restore-service.mjs";

function parseArgs(argv) {
  const options = {
    operation: null,
    visualId: null,
    manifestPath: null,
    visualIndexPath: null,
    assetsRoot: null,
    trashRoot: null,
    restoreRoot: null,
    confirmText: null,
    execute: false,
    json: false,
    pretty: false,
    help: false,
  };
  const valued = new Map([
    ["--operation", "operation"],
    ["--visual-id", "visualId"],
    ["--manifest", "manifestPath"],
    ["--visual-index-path", "visualIndexPath"],
    ["--assets-root", "assetsRoot"],
    ["--trash-root", "trashRoot"],
    ["--restore-root", "restoreRoot"],
    ["--confirm-text", "confirmText"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valued.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[valued.get(argument)] = value;
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

function formatSummary(payload) {
  return [
    "Visual Import Rollback / Delete / Restore Safety",
    `Phase: ${payload.phase}`,
    `Operation: ${payload.operation ?? "none"}`,
    `Execute requested: ${payload.execute_requested}`,
    `Decision: ${payload.operation_decision}`,
    `Affected visuals: ${payload.affected_visual_ids.length}`,
    `Affected assets: ${payload.affected_assets.length}`,
    "Writes Approval Queue: false",
    "Creates approval item: false",
    "Creates canon_visual_lock: false",
    "Updates active_engine: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-rollback-delete-restore.mjs "
      + "[--operation rollback-import|delete|restore] [--visual-id <id>] "
      + "[--manifest <path>] [--visual-index-path <path>] "
      + "[--assets-root <path>] [--trash-root <path>] "
      + "[--restore-root <path>] [--confirm-text <text>] "
      + "[--execute] [--json|--pretty]",
    );
  } else {
    const result = await runVisualLibraryRollbackDeleteRestoreOperation(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else console.log(formatSummary(result));
  }
} catch (error) {
  console.error(`Visual rollback/delete/restore failed: ${error.message}`);
  process.exitCode = 1;
}
