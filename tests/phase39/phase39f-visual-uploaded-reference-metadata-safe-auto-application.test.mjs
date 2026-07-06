import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRecommendedVisualOnlyDescription,
  buildVisualUploadedReferenceMetadataSafeAutoPatch,
  parseVisualUploadedReferenceMetadataJsonl,
  runVisualUploadedReferenceMetadataSafeAutoApplication,
  serializeVisualUploadedReferenceMetadataJsonl,
} from "../../server/src/visual-uploaded-reference-metadata-enrichment-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function jsonl(records) {
  return serializeVisualUploadedReferenceMetadataJsonl(records);
}

const appliedAt = "2026-07-06T00:00:00.000Z";
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
  visual_id: "VIS-UPLOAD-PHASE39F-001",
  character: "貓狼",
  category: "character_design",
  title: "貓狼",
  canon_status: "reference",
  trust_level: "T7",
  source: "user_imported",
  status: "imported",
  path: "data/visual_db/assets/characters/phase39f-maolang.png",
  notes: "Uploaded visual reference only; does not establish canon facts.",
  description: "",
  ability_state: "visual_only",
  tags: [],
};

const beforeRepoIndex = await readFile(projectPaths.visualIndex, "utf8");
const beforeActiveEngine = await readFile(projectPaths.activeEngine, "utf8");
const fixtureDir = await mkdtemp(path.join(projectPaths.outputs, "phase39f-"));
const fixtureIndexPath = path.join(fixtureDir, "visual_index.jsonl");

try {
  const patchInfo = buildVisualUploadedReferenceMetadataSafeAutoPatch(
    uploadedRecord,
    { appliedAt },
  );
  assert.equal(
    patchInfo.decision,
    "visual_uploaded_reference_metadata_safe_auto_application_ready",
  );
  assert.equal(patchInfo.application_allowed, true);
  assert.deepEqual(patchInfo.changed_fields, [
    "description",
    "tags",
    "metadata_source",
    "metadata_enriched_at",
    "visual_usage_scope",
  ]);
  assert.equal(
    patchInfo.patch.description,
    buildRecommendedVisualOnlyDescription(uploadedRecord),
  );
  assert.deepEqual(patchInfo.patch.tags, [
    "貓狼",
    "character-design",
    "user-uploaded-reference",
    "visual-only",
    "reference-only",
  ]);

  await writeFile(fixtureIndexPath, jsonl([baselineRecord, uploadedRecord]), "utf8");
  const application = await runVisualUploadedReferenceMetadataSafeAutoApplication({
    visualIndexPath: fixtureIndexPath,
    write: true,
    appliedAt,
    includeOutputText: true,
  });
  assert.equal(
    application.decision,
    "visual_uploaded_reference_metadata_safe_auto_application_applied",
  );
  assert.equal(application.phase, "39F");
  assert.equal(application.write_requested, true);
  assert.equal(application.dry_run, false);
  assert.equal(application.side_effect_summary.writes_visual_index, true);
  assert.equal(application.side_effect_summary.writes_visual_assets, false);
  assert.equal(application.side_effect_summary.updates_active_engine, false);
  assert.equal(application.side_effect_summary.updates_canon_db, false);
  assert.equal(application.summary.total_record_count, 2);
  assert.equal(application.summary.ignored_non_user_uploaded_count, 1);
  assert.equal(application.summary.user_uploaded_reference_count, 1);
  assert.equal(application.summary.application_allowed_count, 1);
  assert.equal(application.summary.ready_count, 1);
  assert.equal(application.summary.applied_count, 1);
  assert.equal(application.summary.blocked_count, 0);
  assert.deepEqual(application.allowed_auto_application_fields, [
    "description",
    "tags",
    "metadata_source",
    "metadata_enriched_at",
    "visual_usage_scope",
  ]);
  assert.ok(application.forbidden_auto_application_fields.includes("canon_status"));
  assert.ok(application.forbidden_auto_application_fields.includes("ability_state"));
  assert.ok(application.forbidden_auto_application_fields.includes("timeline"));

  const appliedRecords = parseVisualUploadedReferenceMetadataJsonl(
    await readFile(fixtureIndexPath, "utf8"),
  );
  assert.deepEqual(appliedRecords[0], baselineRecord);
  const appliedUploaded = appliedRecords[1];
  assert.equal(appliedUploaded.visual_id, uploadedRecord.visual_id);
  assert.equal(appliedUploaded.character, uploadedRecord.character);
  assert.equal(appliedUploaded.title, uploadedRecord.title);
  assert.equal(appliedUploaded.path, uploadedRecord.path);
  assert.equal(appliedUploaded.source, "user_imported");
  assert.equal(appliedUploaded.canon_status, "reference");
  assert.equal(appliedUploaded.ability_state, "visual_only");
  assert.equal(appliedUploaded.description, buildRecommendedVisualOnlyDescription(uploadedRecord));
  assert.deepEqual(appliedUploaded.tags, [
    "貓狼",
    "character-design",
    "user-uploaded-reference",
    "visual-only",
    "reference-only",
  ]);
  assert.equal(
    appliedUploaded.metadata_source,
    "manual_mapping",
  );
  assert.equal(appliedUploaded.metadata_enriched_at, appliedAt);
  assert.equal(appliedUploaded.visual_usage_scope, "visual_only_reference");
  assert.equal(Object.hasOwn(appliedUploaded, "ability"), false);
  assert.equal(Object.hasOwn(appliedUploaded, "relationships"), false);
  assert.equal(Object.hasOwn(appliedUploaded, "timeline"), false);

  const secondApplication = await runVisualUploadedReferenceMetadataSafeAutoApplication({
    visualIndexPath: fixtureIndexPath,
    write: true,
    appliedAt,
  });
  assert.equal(
    secondApplication.decision,
    "visual_uploaded_reference_metadata_safe_auto_application_noop",
  );
  assert.equal(secondApplication.summary.no_op_count, 1);
  assert.equal(secondApplication.side_effect_summary.writes_visual_index, false);

  const blocked = await runVisualUploadedReferenceMetadataSafeAutoApplication({
    visualIndexText: jsonl([{ ...uploadedRecord, canon_status: "canon" }]),
    write: true,
    appliedAt,
  });
  assert.equal(
    blocked.decision,
    "blocked_visual_uploaded_reference_metadata_safe_auto_application",
  );
  assert.equal(blocked.summary.blocked_count, 1);
  assert.equal(blocked.side_effect_summary.writes_visual_index, false);
  assert.equal(
    blocked.items[0].decision,
    "blocked_visual_uploaded_reference_metadata_not_reference_only",
  );

  const repoDryRun = await runVisualUploadedReferenceMetadataSafeAutoApplication({
    write: false,
    appliedAt,
  });
  assert.equal(
    repoDryRun.decision,
    "visual_uploaded_reference_metadata_safe_auto_application_noop",
  );
  assert.equal(repoDryRun.summary.total_record_count, 10);
  assert.equal(repoDryRun.summary.ignored_non_user_uploaded_count, 3);
  assert.equal(repoDryRun.summary.user_uploaded_reference_count, 7);
  assert.equal(repoDryRun.summary.application_allowed_count, 7);
  assert.equal(repoDryRun.summary.ready_count, 0);
  assert.equal(repoDryRun.summary.applied_count, 0);
  assert.equal(repoDryRun.summary.no_op_count, 7);
  assert.equal(repoDryRun.summary.blocked_count, 0);
  assert.equal(repoDryRun.side_effect_summary.writes_visual_index, false);
  assert.equal(repoDryRun.side_effect_summary.writes_visual_assets, false);
  assert.equal(repoDryRun.side_effect_summary.updates_active_engine, false);
  assert.equal(repoDryRun.side_effect_summary.updates_canon_db, false);
  assert.deepEqual(await readFile(projectPaths.visualIndex, "utf8"), beforeRepoIndex);
  assert.deepEqual(await readFile(projectPaths.activeEngine, "utf8"), beforeActiveEngine);

  console.log("Phase39F visual uploaded reference metadata safe auto application tests passed.");
} finally {
  await rm(fixtureDir, { recursive: true, force: true });
  assert.deepEqual(await readFile(projectPaths.visualIndex, "utf8"), beforeRepoIndex);
  assert.deepEqual(await readFile(projectPaths.activeEngine, "utf8"), beforeActiveEngine);
}
