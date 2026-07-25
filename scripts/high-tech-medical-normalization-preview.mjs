import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  generateEngineDiff,
  importSettlementResult,
} from "../server/src/engine-candidate-service.mjs";
import {
  buildMedicalContinuityEngineCandidate,
} from "../server/src/medical-continuity-service.mjs";
import {
  buildPendingEngineCandidateReview,
} from "../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../server/src/project-paths.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function argsOf(argv) {
  const result = {
    createCandidate: false,
    review: false,
    expectedBaseHash: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--create-candidate") result.createCandidate = true;
    else if (value === "--review") result.review = true;
    else if (value === "--expected-base-hash") result.expectedBaseHash = argv[++index] ?? "";
    else if (value === "--help") {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (result.review && !result.createCandidate) {
    throw new Error("--review requires --create-candidate.");
  }
  return result;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/high-tech-medical-normalization-preview.mjs",
    "  node scripts/high-tech-medical-normalization-preview.mjs --create-candidate --review [--expected-base-hash <sha256>]",
    "",
    "Default mode is read-only and prints the proposed diff summary.",
    "Create mode writes only a pending engine candidate and optional review bundle.",
    "It never approves, activates, adopts, settles, or modifies active_engine.md.",
  ].join("\n");
}

async function main() {
  const input = argsOf(process.argv.slice(2));
  if (input.help) {
    console.log(usage());
    return;
  }
  const activeBefore = await readFile(projectPaths.activeEngine, "utf8");
  const beforeHash = sha256(activeBefore);
  if (
    input.expectedBaseHash
    && input.expectedBaseHash.toLocaleLowerCase("en-US") !== beforeHash
  ) {
    throw new Error(
      `active_engine base hash mismatch: expected ${input.expectedBaseHash}, current ${beforeHash}.`,
    );
  }
  const built = await buildMedicalContinuityEngineCandidate({
    activeEngineText: activeBefore,
  });
  if (built.base_active_engine_hash !== beforeHash) {
    throw new Error("Medical candidate builder base hash mismatch.");
  }
  const diff = generateEngineDiff(activeBefore, built.candidate_text);
  if (!input.createCandidate) {
    console.log(JSON.stringify({
      mode: "dry_run",
      base_active_engine_hash: beforeHash,
      candidate_engine_hash_sha256: built.candidate_engine_hash_sha256,
      diff_summary: diff.summary,
      character_status_count: built.snapshot.character_statuses.length,
      warnings: built.snapshot.warnings,
      active_engine_modified: false,
      candidate_created: false,
      review_created: false,
      activation_performed: false,
    }, null, 2));
    return;
  }
  const activeBeforeImport = await readFile(projectPaths.activeEngine, "utf8");
  if (sha256(activeBeforeImport) !== beforeHash) {
    throw new Error("active_engine base hash changed before candidate import.");
  }
  const rawText = [
    "## 新版完整創作引擎候選",
    "",
    "```md",
    built.candidate_text,
    "```",
    "",
  ].join("\n");
  const candidate = await importSettlementResult({
    rawText,
    sourceChapter: "第二十五章後設定正規化",
    sourceKind: "medical_continuity_normalization",
    note: "高科技醫療、傷勢恢復與角色狀態正規化；candidate-only，禁止自動啟用。",
  });
  if (candidate.status.status !== "candidate") {
    throw new Error(
      `Medical pending candidate is not reviewable: ${candidate.status.blocked_reason ?? candidate.status.status}`,
    );
  }
  let review = null;
  if (input.review) {
    review = await buildPendingEngineCandidateReview({
      pending_engine_candidate_id: candidate.metadata.candidate_id,
      review_mode: "diff_only",
      include_active_engine: false,
      include_candidate_engine: false,
      include_diff: true,
      include_settlement_report: false,
      include_source_adopted_writing: false,
    });
  }
  const activeAfter = await readFile(projectPaths.activeEngine, "utf8");
  const afterHash = sha256(activeAfter);
  if (afterHash !== beforeHash) {
    throw new Error("Safety violation: active_engine.md changed during medical candidate preview.");
  }
  console.log(JSON.stringify({
    mode: "pending_candidate",
    base_active_engine_hash: beforeHash,
    current_active_engine_hash: afterHash,
    candidate_engine_hash_sha256: candidate.metadata.candidate_engine_hash_sha256,
    pending_engine_candidate_id: candidate.metadata.candidate_id,
    candidate_status: candidate.status.status,
    diff_summary: candidate.diff.summary,
    review_id: review?.review?.review_id ?? null,
    review_path: review?.review_path ?? null,
    diff_path: review?.diff_path ?? null,
    active_engine_modified: false,
    approval_requested: false,
    activation_performed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
