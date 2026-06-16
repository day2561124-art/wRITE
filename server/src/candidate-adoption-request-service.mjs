import { createHash } from "node:crypto";
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
import { projectPaths } from "./project-paths.mjs";

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
    requestSource: optionalText(
      input.request_source ?? input.requestSource,
      "request_source",
      100,
    ),
    sourcePhase: optionalText(
      input.source_phase ?? input.sourcePhase,
      "source_phase",
      100,
    ),
    verifiedBy: optionalText(
      input.verified_by ?? input.verifiedBy,
      "verified_by",
      200,
    ),
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
    blocked_reasons: Array.isArray(reason) ? reason : (reason ? [reason] : []),
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

async function fileHash(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function bridgeRequestMetadata(input, candidate, proof) {
  if (input.requestSource !== "chatgpt_bridge") return {};
  const lineage = {
    writing_context_id: candidate.metadata.source_bundle_id || null,
    source_bundle_id: candidate.metadata.source_bundle_id || null,
    candidate_id: candidate.metadata.candidate_id,
    proofing_context_id: proof?.metadata.proofing_context_id || null,
    proof_report_id: proof?.metadata.proof_report_id || null,
  };
  return {
    requestKind: "candidate_adoption",
    source: "chatgpt_bridge",
    sourcePhase: input.sourcePhase || "phase_14a_lite",
    verifiedBy: input.verifiedBy || "phase_14b_e2e_dry_run",
    bridgeCapabilities: {
      can_approve: false,
      can_confirm_adoption: false,
      can_modify_active_engine: false,
      can_modify_compressed_rules: false,
      can_activate_engine: false,
      can_restore: false,
      can_rollback: false,
    },
    lineage,
    safetySnapshot: {
      active_engine_hash_at_request: await fileHash(projectPaths.activeEngine),
      compressed_rules_hash_at_request: await fileHash(projectPaths.compressedRules),
      candidate_hash_at_request: candidate.metadata.candidate_hash,
      proof_report_hash_at_request: proof?.metadata.proof_report_hash ?? null,
      protected_files_modified_at_request: false,
      pending_engine_candidate_created: false,
      adopted_chapter_created: false,
      approval_confirmed: false,
      adoption_confirmed: false,
    },
    operatorReadiness: {
      requires_manual_review: true,
      requires_candidate_review: true,
      requires_proof_report_review: true,
      requires_hash_check: true,
      requires_clean_git_check: true,
      next_action:
        "Review this request in approval queue. Do not confirm unless candidate and proof report are both acceptable.",
    },
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
    source: item.source,
    request_kind: item.request_kind,
    lineage: item.lineage,
    safety_snapshot: item.safety_snapshot,
    operator_readiness: item.operator_readiness,
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
    const warnings = [];
    if (!proof) {
      warnings.push("Adoption request created without a proof report; risk raised to high.");
    }

    // Build blocking reasons based on candidate pipeline and proof report
    const blockingReasons = [];
    // Candidate pipeline issues
    const missingModules = Array.isArray(candidate.metadata.missing_required_neural_modules)
      ? candidate.metadata.missing_required_neural_modules
      : [];
    if (missingModules.length) {
      blockingReasons.push(`missing_required_neural_modules:${missingModules.join(",")}`);
    }
    if (candidate.metadata.neural_trace_complete === false) {
      blockingReasons.push("neural_trace_incomplete");
    }
    // Proof report issues
    if (proof) {
      if (proof.metadata.verdict !== "pass") {
        blockingReasons.push(`proof_verdict_not_pass:${proof.metadata.verdict}`);
      }
      if (["P0", "P1", "P2"].includes(proof.metadata.severity)) {
        blockingReasons.push(`proof_severity_blocking:${proof.metadata.severity}`);
      }
    }

    // If dry run and the only blocking reasons are neural-module/trace related,
    // return ok:true but indicate blocked:true per gating policy.
    if (input.dryRun) {
      const onlyNeural = blockingReasons.length > 0
        && blockingReasons.every((r) => r.startsWith("missing_required_neural_modules") || r === "neural_trace_incomplete");
      return {
        ok: onlyNeural ? true : blockingReasons.length === 0,
        dry_run: true,
        request_id: null,
        approval_item_id: null,
        approval_item_created: false,
        action_type: actionType,
        status: blockingReasons.length === 0 ? "dry_run" : "blocked",
        risk_level: riskLevel,
        candidate_id: input.candidateId,
        proof_report_id: proof?.metadata.proof_report_id ?? null,
        blocked: blockingReasons.length > 0,
        blocked_reason: blockingReasons.length ? blockingReasons.join("; ") : null,
        blocked_reasons: blockingReasons,
        warnings,
        candidate_status: candidateStatus(candidate.metadata),
        safety: safety(),
      };
    }

    // For non-dry runs, any blocking reason must prevent creation of approval item
    if (blockingReasons.length) {
      return blockedResult(input.candidateId, blockingReasons);
    }

    const requestMetadata = await bridgeRequestMetadata(input, candidate, proof);
    const approvalBlockedReason = null;
    const item = await createApprovalItem({
      actionType,
      targetType: "writing_candidate",
      targetId: input.candidateId,
      title: "Writing candidate adoption request",
      summary: input.reason || "Review this writing candidate for adoption.",
      riskLevel,
      requiresSecondConfirmation: riskLevel === "high",
      neuralStatus: "not_required",
      blockedReason: approvalBlockedReason,
      status: approvalBlockedReason ? "blocked" : "pending",
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
      ...requestMetadata,
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
