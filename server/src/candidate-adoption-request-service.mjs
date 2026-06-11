import { readFile } from "node:fs/promises";
import {
  createApprovalItem,
  getApprovalItem,
  listApprovalItems,
} from "./approval-queue-service.mjs";
import {
  getWritingCandidateDetail,
  resolveWritingCandidatePaths,
} from "./chat-output-candidate-service.mjs";
import { getProofReportDetail } from "./candidate-proof-report-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";

const riskLevels = new Set(["low", "medium", "high"]);
const riskRanks = { low: 1, medium: 2, high: 3 };
const actionType = "adopt_writing_candidate";

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

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
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
  const riskLevel = optionalText(
    input.risk_level ?? input.riskLevel,
    "risk_level",
    100,
  );
  if (riskLevel && !riskLevels.has(riskLevel)) {
    throw new Error(`Unknown risk_level: ${riskLevel}`);
  }
  return {
    candidateId: requiredText(input.candidate_id ?? input.candidateId, "candidate_id"),
    proofReportId: optionalText(
      input.proof_report_id ?? input.proofReportId,
      "proof_report_id",
      200,
    ),
    reason: optionalText(input.reason, "reason", 5_000),
    requestedBy: optionalText(
      input.requested_by ?? input.requestedBy,
      "requested_by",
      200,
    ) || "local_user",
    riskLevel,
    allowWithoutProof: optionalBoolean(
      input.allow_without_proof ?? input.allowWithoutProof,
      false,
      "allow_without_proof",
    ),
    dryRun: optionalBoolean(input.dry_run ?? input.dryRun, false, "dry_run"),
  };
}

function safety() {
  return {
    direct_adoption_performed: false,
    adopted_chapter_created: false,
    settlement_created: false,
    active_engine_modified: false,
    approval_only: true,
  };
}

function blockedResult(candidateId, reason) {
  return {
    ok: false,
    request_id: null,
    approval_item_id: null,
    approval_item_created: false,
    action_type: actionType,
    status: "blocked",
    risk_level: null,
    candidate_id: candidateId || "",
    proof_report_id: null,
    blocked: true,
    blocked_reason: reason,
    safety: safety(),
  };
}

function derivedRisk(proof, allowWithoutProof) {
  if (!proof) return allowWithoutProof ? "high" : null;
  if (proof.metadata.verdict === "blocked" || proof.metadata.severity === "P0") return "high";
  if (proof.metadata.severity === "P1") return "high";
  if (proof.metadata.severity === "P2" || proof.metadata.verdict === "needs_revision") {
    return "medium";
  }
  return "low";
}

function resolvedRisk(requested, derived) {
  if (!requested) return derived;
  return riskRanks[requested] >= riskRanks[derived] ? requested : derived;
}

async function resolveProof(candidate, input, options) {
  const proofReportId = input.proofReportId || candidate.metadata.latest_proof_report_id || "";
  if (!proofReportId) return null;
  const proof = await getProofReportDetail(proofReportId, options);
  if (proof.metadata.candidate_id !== input.candidateId) {
    throw new Error("proof_report_id does not belong to candidate_id.");
  }
  return proof;
}

function candidateStatus(metadata) {
  return {
    canon_status: metadata.canon_status,
    adopted: metadata.adopted,
    settled: metadata.settled,
    proofed: metadata.proofed === true,
  };
}

function publicResult(item, candidate, proof, warnings = []) {
  return {
    ok: item.status.status !== "blocked",
    request_id: item.approval_item_id,
    approval_item_id: item.approval_item_id,
    approval_item_created: true,
    action_type: item.action_type,
    status: item.status.status,
    risk_level: item.risk_level,
    candidate_id: candidate.metadata.candidate_id,
    proof_report_id: proof?.metadata.proof_report_id ?? null,
    blocked: item.status.status === "blocked",
    blocked_reason: item.blocked_reason,
    warnings,
    candidate_status: candidateStatus(candidate.metadata),
    safety: safety(),
    next_action:
      "User must confirm this adoption request in the approval queue UI before the candidate can be adopted.",
  };
}

export async function requestWritingCandidateAdoption(rawInput, options = {}) {
  let input;
  try {
    input = normalizeInput(rawInput);
    const candidate = await getWritingCandidateDetail(input.candidateId, options);
    if (candidate.metadata.canon_status !== "candidate_only") {
      return blockedResult(input.candidateId, "Candidate is not candidate_only.");
    }
    if (candidate.metadata.adopted !== false) {
      return blockedResult(input.candidateId, "Candidate is already adopted.");
    }
    if (candidate.metadata.settled !== false) {
      return blockedResult(input.candidateId, "Candidate is already settled.");
    }

    const proof = await resolveProof(candidate, input, options);
    if ((!proof || candidate.metadata.proofed !== true) && !input.allowWithoutProof) {
      return blockedResult(input.candidateId, "Candidate has no proof report.");
    }
    const derived = derivedRisk(proof, input.allowWithoutProof);
    const riskLevel = resolvedRisk(input.riskLevel, derived);
    const blockedReason = proof
      && (proof.metadata.severity === "P0" || proof.metadata.verdict === "blocked")
      ? `Proof report blocks adoption: ${proof.metadata.severity} / ${proof.metadata.verdict}.`
      : null;
    const warnings = [];
    if (!proof) {
      warnings.push("Adoption request created without a proof report; risk raised to high.");
    }
    if (input.dryRun) {
      return {
        ok: blockedReason === null,
        dry_run: true,
        request_id: null,
        approval_item_id: null,
        approval_item_created: false,
        action_type: actionType,
        status: blockedReason ? "blocked" : "dry_run",
        risk_level: riskLevel,
        candidate_id: input.candidateId,
        proof_report_id: proof?.metadata.proof_report_id ?? null,
        blocked: blockedReason !== null,
        blocked_reason: blockedReason,
        warnings,
        candidate_status: candidateStatus(candidate.metadata),
        safety: safety(),
      };
    }

    const item = await createApprovalItem({
      actionType,
      targetType: "writing_candidate",
      targetId: input.candidateId,
      title: "Writing candidate adoption request",
      summary: input.reason || "Review this writing candidate for adoption.",
      riskLevel,
      requiresSecondConfirmation: riskLevel === "high",
      neuralStatus: "not_required",
      blockedReason,
      status: blockedReason ? "blocked" : "pending",
      impact: {
        will_modify: [],
        will_create: [],
        rollback_available: false,
      },
      links: {
        candidate_id: input.candidateId,
        proof_report_id: proof?.metadata.proof_report_id ?? null,
      },
      details: {
        requested_by: input.requestedBy,
        allow_without_proof: input.allowWithoutProof,
        proof_summary: proof?.metadata.summary ?? null,
      },
      candidateId: input.candidateId,
      candidateHash: candidate.metadata.candidate_hash,
      candidatePath: candidate.metadata.content_path,
      candidateMetaPath: candidate.metadata.metadata_path,
      proofReportId: proof?.metadata.proof_report_id ?? null,
      proofReportHash: proof?.metadata.proof_report_hash ?? null,
      proofVerdict: proof?.metadata.verdict ?? null,
      proofSeverity: proof?.metadata.severity ?? null,
      reason: input.reason,
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      createdBy: "candidate_adoption_request_service",
      safety: safety(),
    }, options);
    const paths = resolveWritingCandidatePaths(input.candidateId, options);
    const currentMetadata = JSON.parse(await readFile(paths.metadata, "utf8"));
    const requestIds = Array.isArray(currentMetadata.adoption_request_ids)
      ? currentMetadata.adoption_request_ids.filter((value) => typeof value === "string")
      : [];
    const updatedCandidate = {
      ...currentMetadata,
      adoption_requested: true,
      latest_adoption_request_id: item.approval_item_id,
      adoption_request_ids: requestIds.includes(item.approval_item_id)
        ? requestIds
        : [...requestIds, item.approval_item_id],
      latest_adoption_request_status: item.status.status,
      canon_status: "candidate_only",
      adopted: false,
      settled: false,
      active_engine_update_allowed: false,
      canon_update_allowed: false,
      adoption_allowed_without_approval: false,
      settlement_allowed_without_adoption: false,
    };
    await commitFileTransaction("record-writing-candidate-adoption-request", [
      { filePath: paths.metadata, content: `${JSON.stringify(updatedCandidate, null, 2)}\n` },
    ], {
      approval_item_id: item.approval_item_id,
      candidate_id: input.candidateId,
      phase: "phase_8e_writing_candidate_adoption_request",
    });
    return publicResult(item, { metadata: updatedCandidate }, proof, warnings);
  } catch (error) {
    return blockedResult(input?.candidateId ?? "", error.message);
  }
}

export async function getWritingCandidateAdoptionRequest(requestId, options = {}) {
  const item = await getApprovalItem(requestId, options);
  if (item.action_type !== actionType || item.target_type !== "writing_candidate") {
    throw new Error("Approval item is not a writing candidate adoption request.");
  }
  return item;
}

export async function listWritingCandidateAdoptionRequests(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const candidateId = optionalText(
    input.candidate_id ?? input.candidateId,
    "candidate_id",
    200,
  );
  const status = optionalText(input.status, "status", 100);
  const riskLevel = optionalText(
    input.risk_level ?? input.riskLevel,
    "risk_level",
    100,
  );
  if (riskLevel && !riskLevels.has(riskLevel)) {
    throw new Error(`Unknown risk_level: ${riskLevel}`);
  }
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  return (await listApprovalItems(options))
    .filter((item) => item.action_type === actionType)
    .filter((item) => item.target_type === "writing_candidate")
    .filter((item) => !candidateId || item.target_id === candidateId)
    .filter((item) => !status || item.status.status === status)
    .filter((item) => !riskLevel || item.risk_level === riskLevel)
    .slice(0, limit);
}
