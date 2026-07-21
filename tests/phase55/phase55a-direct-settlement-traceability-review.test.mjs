import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createDirectSettlementPromotionCandidate,
  repairDirectSettlementPromotionCandidateTraceability,
} from "../../server/src/direct-chapter-settlement-promotion-service.mjs";
import {
  getPendingCandidate,
} from "../../server/src/engine-candidate-service.mjs";
import {
  buildPendingEngineCandidateReview,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });
await mkdir(projectPaths.engineCandidateReviews, { recursive: true });

const outputFixture = await mkdtemp(path.join(projectPaths.outputs, "phase55a-"));
const canonFixture = await mkdtemp(path.join(projectPaths.canonDb, "phase55a-"));
const reviewFixture = await mkdtemp(path.join(projectPaths.engineCandidateReviews, "phase55a-"));
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(canonFixture, "pending_engine_candidates");
const settlementReports = path.join(outputFixture, "settlement_reports");
const metadataPath = path.join(
  settlementReports,
  "settlement_report_20260720-134733-64509a02",
  "settlement_report.json",
);
const options = {
  outputs: outputFixture,
  settlementReports,
  activeEnginePath,
  pendingEngineCandidates,
  engineCandidateReviews: reviewFixture,
};

const activeEngineText = [
  "AI 專用單檔創作引擎 v5.0.12｜第十九章〈第一聲鈴〉正式承接",
  "",
  "正史止於第十九章〈第一聲鈴〉完成結算。",
  "新版第一章至第十九章均已正式採用並完成結算。",
  "",
  "## 硬設定",
  "異能武裝是靈魂延伸。",
].join("\n");
const settlementSummary = [
  "# 第二十章〈不能沾水〉結算",
  "",
  "九逃完成清創、縫合與包紮。",
  "千夜翌日上午七點二十分複查。",
  "兩人尚未和解。",
].join("\n");

try {
  await mkdir(path.dirname(metadataPath), { recursive: true });
  await writeFile(activeEnginePath, activeEngineText, "utf8");
  await writeFile(metadataPath, `${JSON.stringify({
    report_id: "settlement_report_20260720-134733-64509a02",
    canon_status: "settlement_report_only",
  }, null, 2)}\n`, "utf8");

  const created = await createDirectSettlementPromotionCandidate({
    settlementReportId: "settlement_report_20260720-134733-64509a02",
    settlementSummary,
    explicitChapter: "第二十章",
    explicitHeading: "不能沾水",
    metadata: {
      created_at: "2026-07-20T13:47:33.905Z",
      metadata_path: metadataPath,
    },
  }, options);
  const candidateId = created.pending_engine_candidate_id;
  const candidatePath = path.join(pendingEngineCandidates, candidateId, "candidate_engine.md");
  const candidateMetadataPath = path.join(pendingEngineCandidates, candidateId, "metadata.json");
  let candidateText = await readFile(candidatePath, "utf8");
  let metadata = JSON.parse(await readFile(candidateMetadataPath, "utf8"));

  assert.match(candidateText.split(/\r?\n/u)[0], /v5\.0\.13｜第二十章〈不能沾水〉正式承接/u);
  assert.equal(metadata.candidate_engine_hash_sha256, sha256(candidateText.trimEnd()));
  assert.equal(metadata.candidate_hash, sha256(candidateText.trimEnd()));
  assert.equal(metadata.lineage_mode, "direct_chapter_settlement_summary");
  assert.equal(metadata.lineage_complete, true);
  assert.equal(metadata.source_lineage.legacy_adopted_writing_workflow_applicable, false);
  assert.deepEqual(metadata.activation_write_manifest.will_modify, [
    "data/canon_db/active_engine.md",
    "data/outputs/task_prompt.md",
    "data/outputs/generation_context.md",
    "data/outputs/retrieval_context.md",
    metadataPath,
  ]);

  const review = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidateId,
    reviewMode: "summary_only",
  }, options);
  assert.equal(review.review.candidate_engine_hash_sha256, sha256(candidateText.trimEnd()));
  assert.equal(review.review.metadata_candidate_hash, sha256(candidateText.trimEnd()));
  assert.equal(review.review.candidate_hash_match, true);
  assert.equal(review.review.lineage.lineage_complete, true);
  assert.equal(review.review.activation_write_manifest.rollback_available, true);
  assert.equal(review.review.chapter, "第二十章");
  assert.equal(review.review.heading, "不能沾水");

  // Simulate the already-created Phase52 candidate whose header still pointed to chapter 19.
  const legacyText = candidateText.replace(
    /第二十章〈不能沾水〉正式承接/u,
    "第十九章〈第一聲鈴〉正式承接",
  );
  metadata = {
    ...metadata,
    candidate_hash: sha256(legacyText.trimEnd()),
    candidate_engine_hash_sha256: undefined,
    candidate_title: undefined,
    target_engine_version: undefined,
    source_lineage: undefined,
    lineage_mode: undefined,
    lineage_complete: undefined,
    activation_write_manifest: undefined,
  };
  for (const key of Object.keys(metadata)) {
    if (metadata[key] === undefined) delete metadata[key];
  }
  await writeFile(candidatePath, legacyText, "utf8");
  await writeFile(candidateMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  const repaired = await repairDirectSettlementPromotionCandidateTraceability(
    candidateId,
    options,
  );
  assert.equal(repaired.pending_engine_candidate_id, candidateId);
  assert.equal(repaired.lineage_complete, true);
  assert.equal(repaired.active_engine_modified, false);

  candidateText = await readFile(candidatePath, "utf8");
  metadata = JSON.parse(await readFile(candidateMetadataPath, "utf8"));
  assert.match(candidateText.split(/\r?\n/u)[0], /v5\.0\.13｜第二十章〈不能沾水〉正式承接/u);
  assert.equal(metadata.candidate_hash, sha256(candidateText.trimEnd()));
  assert.equal(metadata.candidate_engine_hash_sha256, sha256(candidateText.trimEnd()));
  assert.equal(metadata.lineage_complete, true);
  assert.equal(metadata.activation_write_manifest.will_modify.length, 5);
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);

  const candidate = await getPendingCandidate(candidateId, options);
  assert.equal(candidate.status.status, "candidate");
  const repairedReview = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidateId,
    reviewMode: "full",
    includeDiff: true,
  }, options);
  assert.equal(repairedReview.review.candidate_hash_match, true);
  assert.equal(repairedReview.review.base_hash_mismatch, false);
  assert.equal(repairedReview.review.candidate_title.includes("第二十章〈不能沾水〉正式承接"), true);

  console.log("Phase55A direct settlement traceability review test passed.");
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
    rm(reviewFixture, { recursive: true, force: true }),
  ]);
}
