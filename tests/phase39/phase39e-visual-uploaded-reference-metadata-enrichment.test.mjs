import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  analyzeVisualUploadedReferenceMetadata,
  buildRecommendedVisualOnlyDescription,
  buildRecommendedVisualOnlyTags,
  runVisualUploadedReferenceMetadataEnrichmentPreview,
} from "../../server/src/visual-uploaded-reference-metadata-enrichment-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

async function snapshot(root) {
  const entries = [];
  async function walk(current) {
    let children;
    try {
      children = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push(`d:${relative}`);
        await walk(absolute);
      } else {
        entries.push(`f:${relative}:${(await readFile(absolute)).toString("base64")}`);
      }
    }
  }
  await walk(root);
  return entries;
}

function jsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

const baselineRecord = {
  visual_id: "VIS-19HB-BASELINE-001",
  character: "既有基準圖",
  category: "character_sheet",
  title: "既有基準圖",
  canon_status: "reference",
  source: "visual_library_persistent_baseline_activation",
  status: "imported",
  path: "data/visual_db/assets/character_sheets/baseline.png",
  notes: "manual visual reference",
  description: "既有非使用者上傳基準圖。",
  ability_state: "visual_only",
  tags: ["baseline"],
};

const uploadedRecord = {
  visual_id: "VIS-UPLOAD-PHASE39E-001",
  character: "貓狼",
  category: "character_design",
  title: "貓狼",
  canon_status: "reference",
  trust_level: "T7",
  source: "user_imported",
  status: "imported",
  path: "data/visual_db/assets/characters/phase39e-maolang.png",
  notes: "Uploaded visual reference only; does not establish canon facts.",
  description: "",
  ability_state: "visual_only",
  tags: [],
};

const before = {
  index: await readFile(projectPaths.visualIndex),
  assets: await snapshot(projectPaths.visualAssets),
  activeEngine: await readFile(projectPaths.activeEngine),
};

try {
  const tags = buildRecommendedVisualOnlyTags(uploadedRecord);
  assert.deepEqual(tags, [
    "貓狼",
    "character-design",
    "user-uploaded-reference",
    "visual-only",
    "reference-only",
  ]);
  assert.match(
    buildRecommendedVisualOnlyDescription(uploadedRecord),
    /不建立能力、身分、關係、階級或時間線正史/u,
  );

  const item = analyzeVisualUploadedReferenceMetadata(uploadedRecord);
  assert.equal(
    item.decision,
    "visual_uploaded_reference_metadata_enrichment_preview_accepted",
  );
  assert.equal(item.description_present, false);
  assert.equal(item.tags_present, false);
  assert.deepEqual(item.missing_fields, ["description", "tags"]);
  assert.equal(item.metadata_update_preview_only, true);
  assert.equal(item.writes_visual_index, false);
  assert.equal(item.writes_visual_assets, false);
  assert.equal(item.updates_active_engine, false);
  assert.equal(item.updates_canon_db, false);

  const fixturePreview = await runVisualUploadedReferenceMetadataEnrichmentPreview({
    visualIndexText: jsonl([baselineRecord, uploadedRecord]),
  });
  assert.equal(
    fixturePreview.decision,
    "visual_uploaded_reference_metadata_enrichment_preview_accepted",
  );
  assert.equal(fixturePreview.phase, "39E");
  assert.equal(fixturePreview.preview_only, true);
  assert.equal(fixturePreview.summary.total_record_count, 2);
  assert.equal(fixturePreview.summary.ignored_non_user_uploaded_count, 1);
  assert.equal(fixturePreview.summary.user_uploaded_reference_count, 1);
  assert.equal(fixturePreview.summary.accepted_count, 1);
  assert.equal(fixturePreview.summary.blocked_count, 0);
  assert.equal(fixturePreview.summary.missing_description_count, 1);
  assert.equal(fixturePreview.summary.missing_tags_count, 1);
  assert.equal(fixturePreview.no_write_summary.contract_passed, true);
  assert.equal(fixturePreview.no_write_summary.writes_visual_index, false);
  assert.equal(fixturePreview.no_write_summary.writes_visual_assets, false);
  assert.equal(fixturePreview.no_write_summary.updates_active_engine, false);
  assert.equal(fixturePreview.no_write_summary.updates_canon_db, false);

  const blockedCanon = await runVisualUploadedReferenceMetadataEnrichmentPreview({
    visualIndexText: jsonl([{ ...uploadedRecord, canon_status: "canon" }]),
  });
  assert.equal(
    blockedCanon.decision,
    "blocked_visual_uploaded_reference_metadata_enrichment_preview",
  );
  assert.equal(
    blockedCanon.items[0].decision,
    "blocked_visual_uploaded_reference_metadata_not_reference_only",
  );

  const blockedIdentity = analyzeVisualUploadedReferenceMetadata({
    ...uploadedRecord,
    visual_id: "",
  });
  assert.equal(
    blockedIdentity.decision,
    "blocked_visual_uploaded_reference_metadata_missing_required_identity",
  );

  await assert.rejects(
    () => runVisualUploadedReferenceMetadataEnrichmentPreview({
      visualIndexText: "{not-json}\n",
    }),
    /Invalid visual index JSONL at line 1/u,
  );

  const repoPreview = await runVisualUploadedReferenceMetadataEnrichmentPreview();
  assert.equal(
    repoPreview.decision,
    "visual_uploaded_reference_metadata_enrichment_preview_accepted",
  );
  assert.equal(repoPreview.summary.total_record_count, 10);
  assert.equal(repoPreview.summary.ignored_non_user_uploaded_count, 3);
  assert.equal(repoPreview.summary.user_uploaded_reference_count, 7);
  assert.equal(repoPreview.summary.accepted_count, 7);
  assert.equal(repoPreview.summary.blocked_count, 0);
  assert.equal(repoPreview.summary.missing_description_count, 7);
  assert.equal(repoPreview.summary.missing_tags_count, 7);
  assert.equal(repoPreview.items.every((entry) => entry.source === "user_imported"), true);
  assert.equal(repoPreview.items.every((entry) => entry.canon_status === "reference"), true);
  assert.equal(repoPreview.items.every((entry) => entry.ability_state === "visual_only"), true);
  assert.ok(repoPreview.items.some((entry) => entry.visual_id
    === "VIS-UPLOAD-20260705122222-FC25174A"));

  assert.deepEqual(await readFile(projectPaths.visualIndex), before.index);
  assert.deepEqual(await snapshot(projectPaths.visualAssets), before.assets);
  assert.deepEqual(await readFile(projectPaths.activeEngine), before.activeEngine);
  console.log("Phase39E visual uploaded reference metadata enrichment tests passed.");
} finally {
  assert.deepEqual(await readFile(projectPaths.visualIndex), before.index);
  assert.deepEqual(await snapshot(projectPaths.visualAssets), before.assets);
  assert.deepEqual(await readFile(projectPaths.activeEngine), before.activeEngine);
}
