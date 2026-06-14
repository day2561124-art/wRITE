#!/usr/bin/env node
import {
  runVisualLibraryUiImportFlowPreview,
} from "../server/src/visual-library-ui-import-flow-service.mjs";

function parseArgs(argv) {
  const options = {
    operation: "preview",
    execute: false,
    json: false,
    pretty: false,
    help: false,
  };
  const valued = new Map([
    ["--source-dir", "sourceDir"],
    ["--operation", "operation"],
    ["--visual-id", "visualId"],
    ["--manifest", "manifestPath"],
    ["--confirm-text", "confirmText"],
    ["--pre-write-confirm-text", "preWriteConfirmText"],
    ["--real-import-confirm-text", "realImportConfirmText"],
    ["--rollback-confirm-text", "rollbackConfirmText"],
    ["--delete-confirm-text", "deleteConfirmText"],
    ["--restore-confirm-text", "restoreConfirmText"],
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

function summary(payload) {
  return [
    "Visual Library UI Import Flow / Review Screen",
    `Phase: ${payload.phase}`,
    `Source: ${payload.source_dir}`,
    `Decision: ${payload.ui_flow_decision}`,
    `Wizard steps: ${payload.wizard_steps.length}`,
    `Review cards: ${payload.review_cards.length}`,
    `Operation cards: ${payload.operation_cards.length}`,
    `Formal gallery empty: ${payload.safety_panel.formal_gallery_empty_baseline}`,
    "Approval Queue actions: false",
    "Approval item actions: false",
    "canon_visual_lock actions: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-ui-import-flow-preview.mjs "
      + "[--source-dir <path>] [--operation preview|import|rollback-import|delete|restore] "
      + "[--visual-id <id>] [--manifest <path>] [confirmation options] "
      + "[--execute] [--json|--pretty]",
    );
  } else {
    const result = await runVisualLibraryUiImportFlowPreview(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else console.log(summary(result));
  }
} catch (error) {
  console.error(`Visual library UI import flow failed: ${error.message}`);
  process.exitCode = 1;
}
