import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildEntityRegistryPreview,
  loadEntityRegistryConfig,
  validateEntityRegistryConfig,
} from "../../server/src/entity-registry-preview-service.mjs";
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

const activeBefore = await readFile(projectPaths.activeEngine);
const activeRawHashBefore = sha256(activeBefore);
const activeLfHashBefore = sha256Lf(activeBefore.toString("utf8"));
assert.equal(activeLfHashBefore, expectedActiveEngineHash);

const { config } = await loadEntityRegistryConfig();
assert.equal(validateEntityRegistryConfig(config), config);
assert.equal(config.mode, "read_only_preview");

const preview = await buildEntityRegistryPreview();
assert.equal(preview.read_only, true);
assert.equal(preview.mode, "read_only_preview");
assert.equal(preview.source_sha256_lf, expectedActiveEngineHash);
assert.equal(preview.hash_matches, true);
assert.equal(preview.canon_zones_source.roundtrip_matches_source, true);
assert.deepEqual(preview.blocking_warnings, []);
assert.equal(preview.canon_write_allowed, false);
assert.equal(preview.approval_required_for_canon_change, true);
assert(Array.isArray(preview.entities));
assert.equal(preview.entity_count, preview.entities.length);

// No entities should come from excluded zones
const excludedZoneIds = ["canon_progress_zone", "longline_boundary_zone", "governance_rules_zone"];
for (const e of preview.entities) {
  assert(!excludedZoneIds.includes(e.source_zone_id), `Entity should not be extracted from excluded zone: ${e.source_zone_id}`);
}

// Ensure certain headings are NOT extracted
const forbiddenHeadings = [
  "5.16.2 能力本質",
  "5.16.3 啟動條件與限制",
  "5.16.4 主要招式",
  "5.17.5 一句話定義",
  "第三層｜新版正文正史進度與現行承接資料",
  "第十九章｜第一聲鈴｜正式結算",
  "第四層｜專案長線骨架外置與防誤承接邊界",
  "R4｜專案骨架外置與正式資料同步",
];
for (const f of forbiddenHeadings) {
  const found = preview.entities.find((z) => z.display_name === f || z.evidence_text === f);
  assert(!found, `Forbidden heading was extracted as entity: ${f}`);
}

// Ensure at least one character candidate if present in source
const namesToCheck = ["朝日奈千夜", "九逃", "夜星"];
const sourceText = activeBefore.toString("utf8");
for (const name of namesToCheck) {
  if (sourceText.includes(name)) {
    const found = preview.entities.find((e) => e.display_name === name);
    assert(found, `Expected to find entity for ${name} present in source.`);
  }
}

// Ensure explicit weapons still extracted when present
const weaponsToCheck = ["未竟折門", "晴彩祕綾", "夢綴星紡"];
for (const w of weaponsToCheck) {
  if (sourceText.includes(w) || sourceText.includes(`《${w}》`)) {
    const found = preview.entities.find((e) => e.kind === "weapon" && (e.display_name === w || e.display_name === `《${w}》` || (e.aliases || []).some(a => a.includes(w))));
    assert(found, `Expected to find weapon entity for ${w} present in source.`);
  }
}

// Each entity required fields and statuses
for (const e of preview.entities) {
  assert(e.entity_id);
  assert(e.kind);
  assert(e.display_name);
  assert(e.status);
  assert(e.source_zone_id);
  assert(Number.isInteger(e.source_line_start));
  assert(Number.isInteger(e.source_line_end));
  assert(e.evidence_hash);
  assert(e.extraction_rule);
  assert.equal(e.canon_write_allowed, false);
  assert.equal(e.approval_required_for_canon_change, true);
  // status must not be official/approved/canon/canon_lock
  assert(!/approved|canon_lock|official|canon/u.test(e.status));
}

// stable IDs across two runs
const preview2 = await buildEntityRegistryPreview();
assert.equal(JSON.stringify(preview.entities.map((e) => e.entity_id)), JSON.stringify(preview2.entities.map((e) => e.entity_id)));

const activeAfter = await readFile(projectPaths.activeEngine);
assert.equal(sha256(activeAfter), activeRawHashBefore, "Preview modified active_engine.md.");
assert.equal(sha256Lf(activeAfter.toString("utf8")), expectedActiveEngineHash);

console.log("Entity registry preview service test passed.");
