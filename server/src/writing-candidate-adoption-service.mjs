import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getApprovalItem } from "./approval-queue-service.mjs";
import {
  getWritingCandidateDetail,
  resolveWritingCandidatePaths,
} from "./chat-output-candidate-service.mjs";
import { getProofReportDetail } from "./candidate-proof-report-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";
import {
  assertCharacterVoiceAdoptionAllowed,
} from "./character-voice-adoption-gate-service.mjs";

const adoptedChapterIdPattern = /^adopted_chapter_\d{8}-\d{6}-[a-f0-9]{8}$/u;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createAdoptedChapterId() {
  return `adopted_chapter_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalInteger(value, fallback, label, maximum) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function normalizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  return {
    approvalItemId: requiredText(
      input.approval_item_id ?? input.approvalItemId,
      "approval_item_id",
    ),
    candidateId: requiredText(input.candidate_id ?? input.candidateId, "candidate_id"),
    proofReportId: optionalText(
      input.proof_report_id ?? input.proofReportId,
      "proof_report_id",
      200,
    ),
    confirmedBy: optionalText(
      input.confirmed_by ?? input.confirmedBy,
      "confirmed_by",
      200,
    ) || "local_user",
    reason: optionalText(input.reason, "reason", 5_000),
    dryRun: input.dry_run === true || input.dryRun === true,
  };
}

function rootsFor(options = {}) {
  const adoptedWritings = options.adoptedWritings
    ? assertPathInside(
      options.adoptedWritings,
      projectPaths.outputs,
      "adopted writings test root",
    )
    : projectPaths.adoptedWritings;
  return { adoptedWritings };
}

function adoptedPaths(adoptedChapterId, roots) {
  if (!adoptedChapterIdPattern.test(String(adoptedChapterId ?? ""))) {
    throw new Error("Invalid adopted_chapter_id.");
  }
  const directory = path.join(roots.adoptedWritings, adoptedChapterId);
  return {
    directory,
    chapter: path.join(directory, "chapter.md"),
    adoption: path.join(directory, "adoption.json"),
  };
}

async function resolveProof(approvalItem, input, options) {
  const proofReportId = input.proofReportId
    || approvalItem.proof_report_id
    || approvalItem.links?.proof_report_id
    || "";
  if (!proofReportId) {
    if (approvalItem.details?.allow_without_proof === true && approvalItem.risk_level === "high") {
      return null;
    }
    throw new Error("Approved adoption request has no proof report.");
  }
  const proof = await getProofReportDetail(proofReportId, options);
  if (proof.metadata.candidate_id !== input.candidateId) {
    throw new Error("proof_report_id does not belong to candidate_id.");
  }
  return proof;
}

function assertApproval(approvalItem, input) {
  if (approvalItem.action_type !== "adopt_writing_candidate") {
    throw new Error("Approval item action_type is not adopt_writing_candidate.");
  }
  if (approvalItem.target_type !== "writing_candidate") {
    throw new Error("Approval item target_type is not writing_candidate.");
  }
  if (approvalItem.target_id !== input.candidateId) {
    throw new Error("approval_item_id does not belong to candidate_id.");
  }
  if (!["pending", "deferred"].includes(approvalItem.status.status)) {
    throw new Error(`Approval item cannot execute from status: ${approvalItem.status.status}.`);
  }
  if (approvalItem.blocked_reason || approvalItem.status.status === "blocked") {
    throw new Error(`Blocked approval item cannot be executed: ${approvalItem.blocked_reason}.`);
  }
}

export async function adoptWritingCandidateAfterApproval(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  if (options.approvalConfirmed !== true) {
    throw new Error("Adoption execution requires approval queue confirmation.");
  }
  const approvalItem = options.approvalItem
    ?? await getApprovalItem(input.approvalItemId, options);
  assertApproval(approvalItem, input);
  const candidate = await getWritingCandidateDetail(input.candidateId, options);
  if (candidate.metadata.canon_status !== "candidate_only") {
    throw new Error("Candidate is not candidate_only.");
  }
  if (candidate.metadata.adopted !== false) throw new Error("Candidate is already adopted.");
  if (candidate.metadata.settled !== false) throw new Error("Candidate is already settled.");
  const candidatePaths = resolveWritingCandidatePaths(input.candidateId, options);
  const candidateContent = await readFile(candidatePaths.content, "utf8");
  const contentHash = sha256(candidateContent);
  const normalizedCandidateHash = sha256(candidateContent.trim());
  if (candidate.metadata.candidate_hash !== normalizedCandidateHash) {
    throw new Error("Candidate content hash does not match candidate metadata.");
  }
  if (approvalItem.candidate_hash
    && approvalItem.candidate_hash !== normalizedCandidateHash) {
    throw new Error("Candidate content changed after the adoption request.");
  }
  const proof = await resolveProof(approvalItem, input, options);
  if (proof && approvalItem.proof_report_hash
    && approvalItem.proof_report_hash !== proof.metadata.proof_report_hash) {
    throw new Error("Proof report changed after the adoption request.");
  }
  const characterVoiceGate = assertCharacterVoiceAdoptionAllowed({
    candidate,
    proof,
    approvalItem,
  });

  if (input.dryRun) {
    return {
      dry_run: true,
      adopted: false,
      approval_item_id: input.approvalItemId,
      candidate_id: input.candidateId,
      proof_report_id: proof?.metadata.proof_report_id ?? null,
      candidate_content_hash: contentHash,
      active_engine_modified: false,
      settlement_created: false,
      pending_engine_candidate_created: false,
      character_voice_adoption_gate: characterVoiceGate,
      character_voice_guard_display: characterVoiceGate.display,
      character_voice_guard_blocking: characterVoiceGate.blocking,
    };
  }

  const roots = rootsFor(options);
  await mkdir(roots.adoptedWritings, { recursive: true });
  const adoptedChapterId = createAdoptedChapterId();
  const paths = adoptedPaths(adoptedChapterId, roots);
  const adoptedAt = new Date().toISOString();
  const adoption = {
    adopted_chapter_id: adoptedChapterId,
    record_kind: "adopted_writing_candidate",
    created_at: adoptedAt,
    candidate_id: input.candidateId,
    candidate_hash: candidate.metadata.candidate_hash,
    candidate_content_hash: contentHash,
    proof_report_id: proof?.metadata.proof_report_id ?? null,
    approval_item_id: input.approvalItemId,
    approved_by_user: true,
    confirmed_by: input.confirmedBy,
    reason: input.reason,
    source: "approval_queue_confirmation",
    canon_status: "adopted_chapter",
    candidate_was_candidate_only_before_adoption: true,
    settled: false,
    settlement_created: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    character_voice_adoption_gate: characterVoiceGate,
    character_voice_guard_display: characterVoiceGate.display,
    character_voice_guard_blocking: characterVoiceGate.blocking,
    character_voice_guard_override_confirmed: characterVoiceGate.blocking === true,
    content_path: normalizeProjectPath(paths.chapter),
    adoption_path: normalizeProjectPath(paths.adoption),
  };
  const updatedCandidate = {
    ...candidate.metadata,
    canon_status: "adopted_chapter",
    adopted: true,
    adopted_at: adoptedAt,
    adopted_chapter_id: adoptedChapterId,
    adoption_approval_item_id: input.approvalItemId,
    latest_adoption_request_status: "confirmed",
    settled: false,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    settlement_allowed_without_adoption: false,
  };
  await commitFileTransaction("adopt-writing-candidate-after-approval", [
    { filePath: paths.chapter, content: candidateContent },
    { filePath: paths.adoption, content: `${JSON.stringify(adoption, null, 2)}\n` },
    {
      filePath: candidatePaths.metadata,
      content: `${JSON.stringify(updatedCandidate, null, 2)}\n`,
    },
  ], {
    adopted_chapter_id: adoptedChapterId,
    approval_item_id: input.approvalItemId,
    candidate_id: input.candidateId,
    phase: "phase_8f_writing_candidate_adoption_confirm",
  });
  return {
    adopted: true,
    adopted_chapter_id: adoptedChapterId,
    approval_item_id: input.approvalItemId,
    candidate_id: input.candidateId,
    proof_report_id: proof?.metadata.proof_report_id ?? null,
    adoption,
    candidate_status: {
      canon_status: updatedCandidate.canon_status,
      adopted: updatedCandidate.adopted,
      settled: updatedCandidate.settled,
    },
    settlement_created: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    character_voice_adoption_gate: characterVoiceGate,
    character_voice_guard_display: characterVoiceGate.display,
    character_voice_guard_blocking: characterVoiceGate.blocking,
    next_action: "Build settlement candidate in a separate user-requested phase.",
  };
}

export async function getAdoptedWritingDetail(adoptedChapterId, options = {}) {
  const roots = rootsFor(options);
  const paths = adoptedPaths(adoptedChapterId, roots);
  const [chapterText, adoption] = await Promise.all([
    readFile(paths.chapter, "utf8"),
    readFile(paths.adoption, "utf8").then(JSON.parse),
  ]);
  return {
    chapter_text: chapterText,
    adoption,
    content_path: normalizeProjectPath(paths.chapter),
    adoption_path: normalizeProjectPath(paths.adoption),
  };
}

export async function listAdoptedWritings(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const candidateId = optionalText(
    input.candidate_id ?? input.candidateId,
    "candidate_id",
    200,
  );
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const roots = rootsFor(options);
  await mkdir(roots.adoptedWritings, { recursive: true });
  const entries = await readdir(roots.adoptedWritings, { withFileTypes: true });
  const adopted = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !adoptedChapterIdPattern.test(entry.name)) continue;
    try {
      const detail = await getAdoptedWritingDetail(entry.name, options);
      if (candidateId && detail.adoption.candidate_id !== candidateId) continue;
      adopted.push(detail.adoption);
    } catch {
      // Ignore incomplete adopted writing records.
    }
  }
  return adopted
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}
