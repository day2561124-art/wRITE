#!/usr/bin/env node
import {
  runVisualLibraryPersistentBaselineTransitionPreview,
} from "../server/src/visual-library-persistent-baseline-transition-service.mjs";

const dangerousArguments = new Set([
  "--execute",
  "--confirm-text",
  "--write",
  "--import",
  "--rollback",
  "--delete",
  "--restore",
  "--update-acceptance",
]);

function parseArgs(argv) {
  const options = {
    pretty: false,
    json: false,
    help: false,
    forbiddenArgument: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (dangerousArguments.has(argument)) {
      options.forbiddenArgument ??= argument;
      if (argument === "--confirm-text") {
        const value = argv[index + 1];
        if (value && !value.startsWith("--")) index += 1;
      }
    } else if (argument === "--pretty") {
      options.pretty = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (options.pretty && options.json) {
    throw new Error("--pretty and --json cannot be used together.");
  }
  return options;
}

function printHelp() {
  console.log(
    "Usage: node scripts/visual-library-persistent-baseline-transition-preview.mjs [--pretty|--json|--help]",
  );
  console.log(
    "Phase 19H-A is preview-only and rejects execute, import, rollback, and acceptance update arguments.",
  );
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const payload = await runVisualLibraryPersistentBaselineTransitionPreview({
      forbiddenArgument: options.forbiddenArgument,
    });
    process.stdout.write(
      `${JSON.stringify(payload, null, options.pretty ? 2 : 0)}\n`,
    );
  }
} catch (error) {
  console.error(
    `Visual library persistent baseline transition preview failed: ${error.message}`,
  );
  process.exitCode = 1;
}
