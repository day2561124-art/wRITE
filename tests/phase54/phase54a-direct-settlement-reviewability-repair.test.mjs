import assert from "node:assert/strict";
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
  repairDirectSettlementPromotionCandidateReviewability,
} from "../../server/src/direct-chapter-settlement-promotion-service.mjs";
import {
  getPendingCandidate,
} from "../../server/src/engine-candidate-service.mjs";
import {
  buildPendingEngineCandidateReview,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });
await mkdir(projectPaths.engineCandidateReviews, { recursive: true });

const outputFixture = await mkdtemp(path.join(projectPaths.outputs, "phase54a-"));
const canonFixture = await mkdtemp(path.join(projectPaths.canonDb, "phase54a-"));
const reviewFixture = await mkdtemp(path.join(projectPaths.engineCandidateReviews, "phase54a-"));
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(canonFixture, "pending_engine_candidates");
const settlementReports = path.join(outputFixture, "settlement_reports");

const options = {
  outputs: outputFixture,
  settlementReports,
  activeEnginePath,
  pendingEngineCandidates,
  engineCandidateReviews: reviewFixture,
};

const activeEngineText = [
  "# AI 專用單檔創作引擎 v5.0.12｜第十九章〈第一聲鈴〉正式承接",
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
  "舊 candidate 欄位 rejected，不應被當成正式內容。",
  "未確認事項仍未成立，退稿內容不得混入。",
  "兩人的關係沒有完成突破。",
].join("\n");

try {
  await mkdir(settlementReports, { recursive: true });
  await writeFile(activeEnginePath, activeEngineText, "utf8");

  const created = await createDirectSettlementPromotionCandidate({
    settlementReportId: "settlement_report_20260720-134733-64509a02",
    settlementSummary,
    explicitChapter: "第二十章",
    explicitHeading: "不能沾水",
    metadata: {
      created_at: "2026-07-20T13:47:33.905Z",
      metadata_path: "data/outputs/settlement_reports/settlement_report_20260720-134733-64509a02/settlement_report.json",
    },
  }, options);

  const candidateId = created.pending_engine_candidate_id;
  let candidate = await getPendingCandidate(candidateId, options);
  assert.equal(candidate.status.status, "candidate");
  assert.notEqual(candidate.risk_report.risk_level, "critical");
  assert.deepEqual(candidate.risk_report.blocked_terms, []);
  const candidatePath = path.join(pendingEngineCandidates, candidateId, "candidate_engine.md");
  const candidateText = await readFile(candidatePath, "utf8");
  assert.doesNotMatch(candidateText, /\brejected\b|\bcandidate\b|未確認|未採用|退稿/iu);

  const firstReview = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidateId,
    reviewMode: "summary_only",
  }, options);
  assert.match(firstReview.review.review_id, /^engine_review_/u);

  const riskPath = path.join(pendingEngineCandidates, candidateId, "risk_report.json");
  const statusPath = path.join(pendingEngineCandidates, candidateId, "status.json");
  const legacyRisk = {
    ...candidate.risk_report,
    risk_level: "critical",
    requires_second_confirmation: false,
    warnings: ["candidateText 含有未確認或候選污染詞"],
    blocked_terms: ["未採用"],
  };
  const legacyStatus = {
    ...candidate.status,
    status: "blocked",
    blocked_reason: "candidateText 含有未確認或候選污染詞",
    eligible_for_phase_3_activation: false,
  };
  await writeFile(riskPath, `${JSON.stringify(legacyRisk, null, 2)}\n`, "utf8");
  await writeFile(statusPath, `${JSON.stringify(legacyStatus, null, 2)}\n`, "utf8");

  const repaired = await repairDirectSettlementPromotionCandidateReviewability(
    candidateId,
    options,
  );
  assert.equal(repaired.repaired, true);
  assert.equal(repaired.candidate_status, "candidate");
  assert.equal(repaired.risk_level, "high");
  assert.deepEqual(repaired.suppressed_blocked_terms, ["未採用"]);
  assert.equal(repaired.active_engine_modified, false);
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);

  candidate = await getPendingCandidate(candidateId, options);
  assert.equal(candidate.status.status, "candidate");
  assert.equal(candidate.status.blocked_reason, null);
  assert.equal(candidate.risk_report.risk_level, "high");
  assert.deepEqual(candidate.risk_report.blocked_terms, []);
  assert.deepEqual(candidate.risk_report.suppressed_blocked_terms, ["未採用"]);

  const secondReview = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidateId,
    reviewMode: "full",
    includeDiff: true,
  }, options);
  assert.match(secondReview.review.review_id, /^engine_review_/u);
  assert.equal(secondReview.review.pending_engine_candidate_id, candidateId);
  assert.equal(secondReview.review.engine_candidate_status, "candidate");
  assert.equal(secondReview.review.risk_level, "high");

  console.log("Phase54A direct settlement reviewability repair test passed.");
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
    rm(reviewFixture, { recursive: true, force: true }),
  ]);
}
