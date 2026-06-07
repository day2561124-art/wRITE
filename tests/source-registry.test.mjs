import { stat } from "node:fs/promises";
import {
  registeredSources,
  sourceFilePath,
  sourceSpecsFor,
} from "../server/src/source-registry.mjs";
import { sourceTrustCatalog } from "../server/src/source-trust.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(registeredSources.length === 15, `Expected 15 registered sources, got ${registeredSources.length}.`);
  const ids = new Set(registeredSources.map((entry) => entry.source_id));
  const paths = new Set(registeredSources.map((entry) => entry.source_path));
  assert(ids.size === registeredSources.length, "Registered source IDs must be unique.");
  assert(paths.size === registeredSources.length, "Registered source paths must be unique.");
  assert(sourceTrustCatalog.length === registeredSources.length, "Trust catalog drifted from source registry.");
  assert(sourceSpecsFor("ui").length === 5, "UI source selection must expose five formal source cards.");
  for (const entry of registeredSources) {
    const stats = await stat(sourceFilePath(entry));
    assert(stats.isFile(), `Registered source is not a file: ${entry.source_path}`);
    assert(typeof entry.authority_rank === "number", `${entry.source_id} is missing authority_rank.`);
    assert(["markdown", "jsonl", "json"].includes(entry.data_type), `${entry.source_id} has invalid data_type.`);
  }
  console.log("Source registry contract test passed.");
}

main().catch((error) => {
  console.error(`Source registry contract test failed: ${error.message}`);
  process.exitCode = 1;
});
