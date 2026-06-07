import { readFile, stat } from "node:fs/promises";
import {
  sourcePathFor,
  sourceTrustCatalog,
  sourceTrustFor,
  validateSourceTrustMetadata,
} from "../source-trust.mjs";

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/source-trust-checker.mjs [--json]",
    "",
    "Validates all registered retrieval sources and reports placeholder downgrades.",
  ].join("\n");
}

function parseArgs(argv) {
  if (argv.length === 0) return { json: false, help: false };
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    return { json: false, help: true };
  }
  if (argv.length === 1 && argv[0] === "--json") {
    return { json: true, help: false };
  }
  throw new Error(`Unknown argument: ${argv[0]}`);
}

async function inspectSource(entry) {
  const filePath = sourcePathFor(entry);
  try {
    const [text, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    const versionMatch = text.slice(0, 1600).match(/v\d+(?:\.\d+)+/iu);
    const metadata = sourceTrustFor(entry.source_id, text, {
      sourceVersion: versionMatch?.[0] ?? "active",
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      exists: true,
    });
    const errors = validateSourceTrustMetadata(metadata);
    const warnings = [];
    if (metadata.source_trust_level === "T8" && metadata.forbidden_reason) {
      warnings.push(metadata.forbidden_reason);
    }
    return { source_id: entry.source_id, metadata, errors, warnings };
  } catch (error) {
    const metadata = sourceTrustFor(entry.source_id, "", {
      sourceVersion: "missing",
      exists: false,
    });
    return {
      source_id: entry.source_id,
      metadata,
      errors: [`${entry.source_path}: ${error.message}`],
      warnings: [],
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const results = await Promise.all(sourceTrustCatalog.map(inspectSource));
  const errors = results.flatMap((result) =>
    result.errors.map((message) => ({ source_id: result.source_id, message })));
  const warnings = results.flatMap((result) =>
    result.warnings.map((message) => ({ source_id: result.source_id, message })));
  const report = {
    checked_sources: results.length,
    errors,
    warnings,
    sources: results.map((result) => result.metadata),
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const result of results) {
      const status = result.errors.length > 0
        ? "ERROR"
        : result.warnings.length > 0
          ? "WARN"
          : "OK";
      console.log(
        `${status} ${result.source_id}: ${result.metadata.source_trust_level} `
          + `${result.metadata.canon_status}`,
      );
    }
    console.log(
      `Source trust validation: ${results.length} sources, `
        + `${errors.length} errors, ${warnings.length} warnings.`,
    );
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
