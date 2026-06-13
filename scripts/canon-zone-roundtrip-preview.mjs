import { buildCanonZonePreview } from "../server/src/canon-zone-preview-service.mjs";

function summary(preview) {
  const lines = [
    "Canon Zone Roundtrip Preview",
    `Source path: ${preview.source_path}`,
    `Source hash (LF): ${preview.source_sha256_lf}`,
    `Expected hash (LF): ${preview.expected_sha256_lf}`,
    `Hash matches: ${preview.hash_matches}`,
    `Roundtrip hash (LF): ${preview.roundtrip_sha256_lf}`,
    `Roundtrip matches source: ${preview.roundtrip_matches_source}`,
    `Zone count: ${preview.zones.length}`,
    "",
    "Zones:",
    ...preview.zones.map((zone) => (
      `- ${zone.id}: lines ${zone.start_line}-${zone.end_line}, `
      + `sha256=${zone.sha256_lf.slice(0, 12)}, chars=${zone.chars}`
    )),
    "",
    `Warnings: ${preview.warnings.length ? preview.warnings.join("; ") : "none"}`,
    `Blocking warnings: ${
      preview.blocking_warnings.length
        ? preview.blocking_warnings.join("; ")
        : "none"
    }`,
  ];
  return lines.join("\n");
}

try {
  const preview = await buildCanonZonePreview();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(summary(preview));
  }
  if (
    !preview.hash_matches
    || !preview.roundtrip_matches_source
    || preview.blocking_warnings.length
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Canon zone roundtrip preview failed: ${error.message}`);
  process.exitCode = 1;
}
