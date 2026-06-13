import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildCanonZonePreview,
  compileCanonZonesPreview,
  loadCanonZoneConfig,
  validateCanonZoneConfig,
} from "../../server/src/canon-zone-preview-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const expectedActiveEngineHash = (
  "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB"
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Lf(value) {
  const normalized = String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();
}

async function expectReject(action, expectedMessage) {
  await assert.rejects(action, (error) => {
    assert.match(error.message, expectedMessage);
    return true;
  });
}

const activeBefore = await readFile(projectPaths.activeEngine);
const activeRawHashBefore = sha256(activeBefore);
const activeLfHashBefore = sha256Lf(activeBefore.toString("utf8"));
assert.equal(activeLfHashBefore, expectedActiveEngineHash);

const { config } = await loadCanonZoneConfig();
assert.equal(validateCanonZoneConfig(config), config);
assert.equal(config.mode, "read_only_preview");
assert.equal(config.source_component, "canon_data");

const preview = await buildCanonZonePreview();
assert.equal(preview.read_only, true);
assert.equal(preview.mode, "read_only_preview");
assert.equal(preview.source_sha256_lf, expectedActiveEngineHash);
assert.equal(preview.hash_matches, true);
assert.equal(preview.roundtrip_matches_source, true);
assert.equal(preview.roundtrip_sha256_lf, preview.source_sha256_lf);
assert.deepEqual(preview.blocking_warnings, []);
assert(preview.zones.length >= 8, "Expected at least eight Canon zone candidates.");

let previousEnd = 0;
for (const zone of preview.zones) {
  assert(zone.id, "Zone id is missing.");
  assert.match(zone.sha256_lf, /^[A-F0-9]{64}$/u);
  assert(Number.isInteger(zone.start_line) && zone.start_line >= 1);
  assert(Number.isInteger(zone.end_line) && zone.end_line >= zone.start_line);
  assert.equal(zone.start_offset, previousEnd, `Zone gap or overlap before ${zone.id}.`);
  assert(zone.end_offset > zone.start_offset, `Zone ${zone.id} is empty.`);
  previousEnd = zone.end_offset;
}

const roundtrip = compileCanonZonesPreview(preview);
assert.equal(sha256Lf(roundtrip), preview.source_sha256_lf);
assert.equal(roundtrip, activeBefore.toString("utf8").replaceAll("\r\n", "\n").replaceAll("\r", "\n"));

const simpleZone = (overrides = {}) => ({
  id: "fixture",
  label: "Fixture",
  start: "BOF",
  end_before: "EOF",
  component_hint: "fixture",
  update_policy: "preview_only",
  ...overrides,
});
const fixtureConfig = (sourceText, zones) => ({
  schema_version: 1,
  source_component: "canon_data",
  source_path: "data/canon_db/active_engine.md",
  expected_sha256_lf: sha256Lf(sourceText),
  mode: "read_only_preview",
  zones,
});

await expectReject(
  () => buildCanonZonePreview({
    sourceText: "# Present\n",
    config: fixtureConfig("# Present\n", [
      simpleZone({ end_before: "# Missing" }),
      simpleZone({
        id: "tail",
        label: "Tail",
        start: "# Missing",
        end_before: "EOF",
      }),
    ]),
  }),
  /anchor not found/u,
);

const duplicateSource = "# Duplicate\none\n# Duplicate\ntwo\n";
await expectReject(
  () => buildCanonZonePreview({
    sourceText: duplicateSource,
    config: fixtureConfig(duplicateSource, [
      simpleZone({ end_before: "# Duplicate" }),
      simpleZone({
        id: "tail",
        label: "Tail",
        start: "# Duplicate",
        end_before: "EOF",
      }),
    ]),
  }),
  /anchor is not unique/u,
);

await expectReject(
  () => buildCanonZonePreview({
    sourceText: "# Hash fixture\n",
    config: {
      ...fixtureConfig("# Hash fixture\n", [simpleZone()]),
      expected_sha256_lf: "0".repeat(64),
    },
  }),
  /source hash mismatch/u,
);

const activeAfter = await readFile(projectPaths.activeEngine);
assert.equal(sha256(activeAfter), activeRawHashBefore, "Preview modified active_engine.md.");
assert.equal(sha256Lf(activeAfter.toString("utf8")), expectedActiveEngineHash);

console.log("Canon zone preview service test passed.");
