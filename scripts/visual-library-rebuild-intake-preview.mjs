#!/usr/bin/env node
import {
  compileVisualLibraryRebuildIntakeSummary,
  scanVisualLibraryIntakePreview,
} from "../server/src/visual-library-rebuild-intake-service.mjs";

function parseArgs(argv) {
  const options = {
    sourceDir: null,
    json: false,
    pretty: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--source-dir requires a path.");
      }
      options.sourceDir = value;
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
  const summary = compileVisualLibraryRebuildIntakeSummary(preview);
  return [
    "Visual Library Rebuild Intake Preview",
    `Phase: ${summary.phase}`,
    `Mode: ${summary.mode}`,
    `Source directory: ${summary.source_dir}`,
    `Scanned files: ${summary.scanned_file_count}`,
    `Accepted candidates: ${summary.accepted_candidate_count}`,
    `Rejected files: ${summary.rejected_file_count}`,
    `Duplicate groups: ${summary.duplicate_group_count}`,
    `Warnings: ${summary.warning_count}`,
    `Risk level: ${summary.risk_level}`,
    "Writes visual index: false",
    "Writes visual assets: false",
    "Updates active engine: false",
    "Updates Canon DB: false",
    "Creates canon_visual_lock: false",
  ].join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/visual-library-rebuild-intake-preview.mjs "
      + "[--source-dir <path>] [--json|--pretty]",
    );
  } else {
    const preview = await scanVisualLibraryIntakePreview({
      sourceDir: options.sourceDir ?? undefined,
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
  console.error(`Visual library rebuild intake preview failed: ${error.message}`);
  process.exitCode = 1;
}
