#!/usr/bin/env node
import {
  runVisualLibraryBridgeReadinessPreview,
} from "../server/src/visual-library-bridge-readiness-service.mjs";

const forbiddenArguments = new Set([
  "--execute",
  "--confirm-text",
  "--real-import-confirm-text",
  "--delete-confirm-text",
  "--restore-confirm-text",
  "--rollback-confirm-text",
]);

function parseArgs(argv) {
  const options = {
    json: false,
    pretty: false,
    help: false,
    forbiddenExecuteArgument: false,
  };
  const valued = new Map([
    ["--source-dir", "sourceDir"],
    ["--tool-name", "toolName"],
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
    } else if (forbiddenArguments.has(argument)) {
      options.forbiddenExecuteArgument = true;
      if (argument !== "--execute") {
        const value = argv[index + 1];
        if (value && !value.startsWith("--")) index += 1;
      }
    } else if (argument === "--json") options.json = true;
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
    "Visual Library ChatGPT / MCP Bridge Readiness",
    `Phase: ${payload.phase}`,
    `Tool: ${payload.bridge_tool_name}`,
    `Source: ${payload.source_dir}`,
    `Decision: ${payload.bridge_readiness_decision}`,
    `Read-only: ${payload.bridge_read_only}`,
    `Preview-only: ${payload.bridge_preview_only}`,
    `Allows execute: ${payload.bridge_allows_execute}`,
    `Formal gallery empty: ${payload.safety_envelope.formal_gallery_empty_baseline}`,
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-bridge-readiness-preview.mjs "
      + "[--source-dir <path>] [--tool-name <name>] [--json|--pretty]",
    );
  } else {
    const result = await runVisualLibraryBridgeReadinessPreview(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else console.log(summary(result));
  }
} catch (error) {
  console.error(`Visual library bridge readiness failed: ${error.message}`);
  process.exitCode = 1;
}
