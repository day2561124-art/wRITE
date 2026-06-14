#!/usr/bin/env node
import {
  runVisualLibraryPersistentBaselineActivation,
} from "../server/src/visual-library-persistent-baseline-activation-service.mjs";

function parseArgs(argv) {
  const options = { pretty: false, json: false, help: false, execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const valueFields = {
      "--confirm-text": "confirmText",
      "--pre-write-confirm-text": "preWriteConfirmText",
      "--real-import-confirm-text": "realImportConfirmText",
      // primary canonical flag name used by docs/commands
      "--persistent-baseline-confirm-text": "transitionConfirmText",
      // backwards-compatible alias
      "--transition-confirm-text": "transitionConfirmText",
    };
    if (valueFields[argument]) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[valueFields[argument]] = value;
      index += 1;
    } else if (argument === "--execute") options.execute = true;
    else if (argument === "--pretty") options.pretty = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.pretty && options.json) {
    throw new Error("--pretty and --json cannot be used together.");
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-persistent-baseline-activation.mjs "
      + "[--pretty|--json] [--execute] "
      + "[--confirm-text <text>] [--pre-write-confirm-text <text>] "
      + "[--real-import-confirm-text <text>] "
      + "[--persistent-baseline-confirm-text <text>] (alias: --transition-confirm-text)",
    );
  } else {
    // Mark this invocation as coming from the CLI so the service can enforce
    // requiring the explicit --execute flag for non-destructive runs.
    const payload = await runVisualLibraryPersistentBaselineActivation({
      ...options,
      cli: true,
    });
    process.stdout.write(
      `${JSON.stringify(payload, null, options.pretty ? 2 : 0)}\n`,
    );
  }
} catch (error) {
  console.error(`Persistent baseline activation failed: ${error.message}`);
  process.exitCode = 1;
}
