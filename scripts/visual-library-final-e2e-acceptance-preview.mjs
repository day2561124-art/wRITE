#!/usr/bin/env node
import {
  runVisualLibraryFinalE2eAcceptancePreview,
} from "../server/src/visual-library-final-e2e-acceptance-service.mjs";

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
    includeSandbox: false,
    forbiddenExecuteArgument: false,
    json: false,
    pretty: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--source-dir requires a value.");
      }
      options.sourceDir = value;
      index += 1;
    } else if (argument === "--include-sandbox") options.includeSandbox = true;
    else if (forbiddenArguments.has(argument)) {
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
    "Visual Library Final End-to-End Safety Acceptance",
    `Phase: ${payload.phase}`,
    `Source: ${payload.source_dir}`,
    `Sandbox included: ${payload.include_sandbox}`,
    `Acceptance rows: ${payload.acceptance_matrix.length}`,
    `Decision: ${payload.final_acceptance_decision}`,
    `Formal gallery empty: ${payload.formal_baseline_acceptance.formal_gallery_empty_baseline}`,
    `Formal side effects: ${payload.safety_summary.formal_write_side_effect_detected}`,
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-final-e2e-acceptance-preview.mjs "
      + "[--source-dir <path>] [--include-sandbox] [--json|--pretty]",
    );
  } else {
    const result = await runVisualLibraryFinalE2eAcceptancePreview(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (options.pretty) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else console.log(summary(result));
  }
} catch (error) {
  console.error(`Visual library final E2E acceptance failed: ${error.message}`);
  process.exitCode = 1;
}
