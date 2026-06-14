#!/usr/bin/env node
import {
  runVisualLibraryPersistentImportOperatorChecklist,
} from "../server/src/visual-library-persistent-import-operator-checklist-service.mjs";

const dangerousArguments = new Set([
  "--execute",
  "--confirm-text",
  "--write",
  "--import",
  "--rollback",
  "--delete",
  "--restore",
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
    "Usage: node scripts/visual-library-persistent-import-operator-checklist-preview.mjs [--pretty|--json|--help]",
  );
  console.log("This command is preview-only and rejects all write arguments.");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const payload = await runVisualLibraryPersistentImportOperatorChecklist({
      forbiddenArgument: options.forbiddenArgument,
    });
    const spacing = options.pretty ? 2 : 0;
    process.stdout.write(`${JSON.stringify(payload, null, spacing)}\n`);
  }
} catch (error) {
  console.error(
    `Visual library persistent import operator checklist failed: ${error.message}`,
  );
  process.exitCode = 1;
}
