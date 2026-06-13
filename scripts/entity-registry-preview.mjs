#!/usr/bin/env node
import { buildEntityRegistryPreview, loadEntityRegistryConfig } from "../server/src/entity-registry-preview-service.mjs";
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const asJson = args.includes("--json");

try {
  const { config } = await loadEntityRegistryConfig();
  const preview = await buildEntityRegistryPreview();
  if (asJson) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(`Source: ${preview.source_path}`);
    console.log(`Source hash: ${preview.source_sha256_lf}`);
    console.log(`Expected hash: ${preview.expected_sha256_lf}`);
    console.log(`Hash matches: ${preview.hash_matches}`);
    console.log(`Canon zones roundtrip matches source: ${preview.canon_zones_source.roundtrip_matches_source}`);
    console.log(`Total entities: ${preview.entity_count}`);
    console.log(`Counts by kind: ${JSON.stringify(preview.entity_counts_by_kind)}`);
    for (const e of (preview.entities || [])) {
      console.log(`${e.kind} ${e.entity_id} ${e.display_name} ${e.status} ${e.source_zone_id} [${e.source_line_start}-${e.source_line_end}]`);
    }
    if ((preview.warnings || []).length) console.log("Warnings:", preview.warnings.join(", "));
    if ((preview.blocking_warnings || []).length) console.log("Blocking:", preview.blocking_warnings.join(", "));
  }
  process.exit(0);
} catch (err) {
  console.error("Entity registry preview failed:", err.message);
  process.exit(1);
}
