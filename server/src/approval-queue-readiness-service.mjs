import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getApprovalItem } from "./approval-queue-service.mjs";
import { getWritingCandidateDetail } from "./chat-output-candidate-service.mjs";
import { getProofReportDetail } from "./candidate-proof-report-service.mjs";
import { getCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { getGptWritingContextBundle } from "./gpt-writing-context-service.mjs";
import { projectPaths } from "./project-paths.mjs";
import { listAdoptedWritings } from "./writing-candidate-adoption-service.mjs";
import {
  buildCharacterVoiceAdoptionGate,
} from "./character-voice-adoption-gate-service.mjs";

const maximumPreviewChars = 20_000;
const defaultPreviewChars = 4_000;
const deniedCapabilities = [
  "can_approve",
  "can_confirm_adoption",
  "can_modify_active_engine",
  "can_modify_compressed_rules",
  "can_activate_engine",
  "can_restore",
  "can_rollback",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function preview(value, maximum) {
  const text = String(value ?? "");
  return text.length > maximum
    ? `${text.slice(0, maximum)}\n\n[preview truncated]`
    : text;
}

function normalizeOptions(options = {}) {
  const includeLineagePreview =
    options.includeLineagePreview === true || options.include_lineage_preview === true;
  const rawMaximum = options.maxPreviewChars ?? options.max_preview_chars;
  const maxPreviewChars = rawMaximum === undefined || rawMaximum === null
    ? defaultPreviewChars
    : rawMaximum;
  if (
    !Number.isInteger(maxPreviewChars)
    || maxPreviewChars < 1
    || maxPreviewChars > maximumPreviewChars
  ) {
    throw new Error(`max_preview_chars must be an integer between 1 and ${maximumPreviewChars}.`);
  }
  return { includeLineagePreview, maxPreviewChars };
}

async function currentProtectedHashes() {
  const [activeEngine, compressedRules] = await Promise.all([
    readFile(projectPaths.activeEngine),
    readFile(projectPaths.compressedRules),
  ]);
  return {
    active_engine: sha256(activeEngine),
    compressed_rules: sha256(compressedRules),
  };
}

async function artifact(check, loader) {
  if (!check.id) return check;
  try {
    const detail = await loader();
    return { ...check, exists: true, detail };
  } catch {
    return { ...check, exists: false, detail: null };
  }
}

export async function validateApprovalQueueBridgeRequest(request, options = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("request must be an object.");
  }
  const previewOptions = normalizeOptions(options);
  const lineage = request.lineage ?? request.details?.lineage ?? {};
  const candidateId = lineage.candidate_id ?? request.candidate_id ?? request.target_id ?? null;
  const proofReportId =
    lineage.proof_report_id ?? request.proof_report_id ?? request.links?.proof_report_id ?? null;
  const proofingContextId = lineage.proofing_context_id ?? null;
  const writingContextId =
    lineage.writing_context_id ?? lineage.source_bundle_id ?? null;

  const [candidate, proofReport, proofingContext, writingContext, hashes, adopted] =
    await Promise.all([
      artifact(
        { id: candidateId, exists: false },
        () => getWritingCandidateDetail(candidateId, {
          ...options,
          includeContent: previewOptions.includeLineagePreview,
          maxContentChars: previewOptions.maxPreviewChars,
        }),
      ),
      artifact(
        { id: proofReportId, exists: false },
        () => getProofReportDetail(proofReportId, options),
      ),
      artifact(
        { id: proofingContextId, exists: false },
        () => getCandidateProofingContext(proofingContextId, options),
      ),
      artifact(
        { id: writingContextId, exists: false },
        () => getGptWritingContextBundle(writingContextId, options),
      ),
      currentProtectedHashes(),
      candidateId ? listAdoptedWritings({ candidateId, limit: 100 }, options) : [],
    ]);

  const snapshot = request.safety_snapshot ?? request.details?.safety_snapshot ?? {};
  const capabilities =
    request.bridge_capabilities ?? request.details?.bridge_capabilities ?? {};
  const status = request.status?.status ?? request.status ?? "unknown";
  const activeEngineModified =
    !snapshot.active_engine_hash_at_request
    || snapshot.active_engine_hash_at_request !== hashes.active_engine;
  const compressedRulesModified =
    !snapshot.compressed_rules_hash_at_request
    || snapshot.compressed_rules_hash_at_request !== hashes.compressed_rules;
  const adoptedChapterCreated = adopted.length > 0
    || snapshot.adopted_chapter_created === true;
  const pendingEngineCandidateCreated =
    snapshot.pending_engine_candidate_created === true
    || adopted.some((record) => record.pending_engine_candidate_created === true);
  const approvalConfirmed =
    Boolean(request.status?.confirmed_at) || snapshot.approval_confirmed === true;
  const adoptionConfirmed = adoptedChapterCreated || snapshot.adoption_confirmed === true;
  const characterVoiceGate = request.details?.character_voice_adoption_gate
    ?? buildCharacterVoiceAdoptionGate(candidate.detail, proofReport.detail);

  const blockingReasons = [];
  if (status !== "pending") blockingReasons.push("request_not_pending");
  if (request.request_kind !== "candidate_adoption") blockingReasons.push("invalid_request_kind");
  if (request.source !== "chatgpt_bridge") blockingReasons.push("invalid_request_source");
  if (!candidateId) blockingReasons.push("missing_candidate_id");
  else if (!candidate.exists) blockingReasons.push("candidate_not_found");
  if (!proofReportId) blockingReasons.push("missing_proof_report_id");
  else if (!proofReport.exists) blockingReasons.push("proof_report_not_found");
  if (!proofingContextId) blockingReasons.push("missing_proofing_context_id");
  else if (!proofingContext.exists) blockingReasons.push("proofing_context_not_found");
  if (!writingContextId) blockingReasons.push("missing_writing_context_id");
  else if (!writingContext.exists) blockingReasons.push("writing_context_not_found");
  if (candidate.detail?.metadata?.candidate_hash !== snapshot.candidate_hash_at_request) {
    blockingReasons.push("candidate_hash_mismatch");
  }
  // Neural pipeline / trace checks
  const missingModules = candidate.detail?.metadata?.missing_required_neural_modules ?? [];
  if (Array.isArray(missingModules) && missingModules.length) {
    blockingReasons.push(`missing_required_neural_modules:${missingModules.join(",")}`);
  }
  if (candidate.detail?.metadata?.neural_trace_complete === false) {
    blockingReasons.push("neural_trace_incomplete");
  }
  // Proof report verdict / severity checks
  const proofVerdict = proofReport.detail?.metadata?.verdict ?? null;
  const proofSeverity = proofReport.detail?.metadata?.severity ?? null;
  if (proofVerdict && proofVerdict !== "pass") {
    blockingReasons.push(`proof_verdict_not_pass:${proofVerdict}`);
  }
  if (["P0", "P1", "P2"].includes(proofSeverity)) {
    blockingReasons.push(`proof_severity_blocking:${proofSeverity}`);
  }
  if (proofReport.detail?.metadata?.proof_report_hash !== snapshot.proof_report_hash_at_request) {
    blockingReasons.push("proof_report_hash_mismatch");
  }
  // Candidate guard report (e.g., wrong-cast, forbidden characters)
  const guardReport = candidate.detail?.metadata?.guard_report ?? [];
  if (Array.isArray(guardReport) && guardReport.some((g) => typeof g.code === "string" && g.code.startsWith("P0"))) {
    blockingReasons.push("guard_blocked_P0");
  }
  if (activeEngineModified) blockingReasons.push("active_engine_hash_mismatch");
  if (compressedRulesModified) blockingReasons.push("compressed_rules_hash_mismatch");
  if (pendingEngineCandidateCreated) blockingReasons.push("pending_engine_candidate_created");
  if (adoptedChapterCreated) blockingReasons.push("adopted_chapter_created");
  if (approvalConfirmed) blockingReasons.push("approval_already_confirmed");
  if (adoptionConfirmed) blockingReasons.push("adoption_already_confirmed");
  for (const capability of deniedCapabilities) {
    if (capabilities[capability] !== false) {
      blockingReasons.push(`bridge_capability_not_denied:${capability}`);
    }
  }

  const report = {
    ok: blockingReasons.length === 0,
    request_id: request.approval_item_id ?? null,
    request_kind: request.request_kind ?? null,
    source: request.source ?? null,
    source_phase: request.source_phase ?? null,
    verified_by: request.verified_by ?? null,
    status,
    risk_level: request.risk_level ?? null,
    character_voice_adoption_gate: characterVoiceGate,
    character_voice_guard_status: characterVoiceGate.status,
    character_voice_guard_blocking: characterVoiceGate.blocking,
    character_voice_guard_findings_count: characterVoiceGate.findings_count,
    character_voice_required_confirmation_text:
      characterVoiceGate.requires_exact_confirmation_text
        ? characterVoiceGate.exact_confirmation_text
        : null,
    decision: blockingReasons.length === 0 ? "ready_for_human_review" : "blocked",
    blocking_reasons: blockingReasons,
    lineage: {
      candidate: {
        id: candidate.id,
        exists: candidate.exists,
        title: candidate.detail?.metadata?.title ?? null,
        created_at: candidate.detail?.metadata?.created_at ?? null,
        hash: candidate.detail?.metadata?.candidate_hash ?? null,
      },
      proof_report: {
        id: proofReport.id,
        exists: proofReport.exists,
        verdict: proofReport.detail?.metadata?.verdict ?? null,
        severity: proofReport.detail?.metadata?.severity ?? null,
        hash: proofReport.detail?.metadata?.proof_report_hash ?? null,
      },
      proofing_context: {
        id: proofingContext.id,
        exists: proofingContext.exists,
      },
      writing_context: {
        id: writingContext.id,
        exists: writingContext.exists,
      },
    },
    safety: {
      active_engine_hash_at_request: snapshot.active_engine_hash_at_request ?? null,
      active_engine_hash_current: hashes.active_engine,
      compressed_rules_hash_at_request: snapshot.compressed_rules_hash_at_request ?? null,
      compressed_rules_hash_current: hashes.compressed_rules,
      active_engine_modified: activeEngineModified,
      compressed_rules_modified: compressedRulesModified,
      pending_engine_candidate_created: pendingEngineCandidateCreated,
      adopted_chapter_created: adoptedChapterCreated,
      approval_confirmed: approvalConfirmed,
      adoption_confirmed: adoptionConfirmed,
      bridge_can_approve: capabilities.can_approve !== false,
      bridge_can_confirm_adoption: capabilities.can_confirm_adoption !== false,
      bridge_can_activate_engine: capabilities.can_activate_engine !== false,
      bridge_can_modify_active_engine: capabilities.can_modify_active_engine !== false,
      bridge_can_modify_compressed_rules: capabilities.can_modify_compressed_rules !== false,
    },
    operator_requirements: request.operator_readiness ?? null,
    operator_next_action: blockingReasons.length === 0
      ? characterVoiceGate.blocking
        ? "Character Voice Guard 高風險：需進 Approval Queue 二次確認，或先修稿後重新驗稿。"
        : "Review candidate and proof report manually before confirming in the existing approval flow."
      : "Do not confirm this request until blocking issues are resolved.",
  };

  if (previewOptions.includeLineagePreview) {
    report.lineage_preview = {
      candidate: preview(candidate.detail?.content, previewOptions.maxPreviewChars),
      proof_report: preview(
        proofReport.detail?.proof_report_text,
        previewOptions.maxPreviewChars,
      ),
      proofing_context: preview(
        proofingContext.detail?.proofing_for_chat,
        previewOptions.maxPreviewChars,
      ),
      writing_context: preview(
        writingContext.detail?.context_for_chat,
        previewOptions.maxPreviewChars,
      ),
    };
  }
  return report;
}

export async function buildApprovalQueueReadinessReport(requestId, options = {}) {
  const request = await getApprovalItem(requestId, options);
  return validateApprovalQueueBridgeRequest(request, options);
}
