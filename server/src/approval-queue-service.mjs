import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertEngineCandidateId,
  assertSnapshotId,
  getPendingCandidate,
  listPendingCandidates,
  listSnapshots,
  rollbackActiveEngine,
} from "./engine-candidate-service.mjs";
import { activateEngineCandidateAfterApproval } from "./engine-activation-confirm-service.mjs";
import {
  approveCleanupProposal,
  executeCleanupProposal,
  assertCleanupProposalId,
  getCleanupProposal,
} from "./cleanup-proposal-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  agentRunPaths,
  assertAgentRunId,
  getAgentRun,
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import { defaultCleanupRetentionPolicy } from "./cleanup-retention-policy.mjs";
import {
  auditActiveExternalBrainSessions,
  reconciliationRecommendations,
  retireExternalBrainSession,
} from "./external-brain-session-reconciliation-service.mjs";
import { externalBrainSessionRoots } from "./external-brain-session-lineage-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import {
  adoptCandidateDraft,
  assertDraftId,
  getCandidateDraft,
  listProofReports,
} from "./writing-workflow-service.mjs";
import { adoptWritingCandidateAfterApproval } from "./writing-candidate-adoption-service.mjs";
import {
  buildCharacterVoiceAdoptionGate,
} from "./character-voice-adoption-gate-service.mjs";

export const approvalItemIdPattern =
  /^approval_item_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const allowedStatuses = new Set([
  "pending",
  "confirmed",
  "rejected",
  "deferred",
  "blocked",
  "resolved",
  "approved",
  "completed",
  "expired",
  "invalidated",
  "orphaned",
  "archived",
]);

const terminalApprovalStatuses = new Set([
  "confirmed",
  "rejected",
  "resolved",
  "approved",
  "completed",
  "expired",
  "invalidated",
  "orphaned",
  "archived",
]);

const productionFixturePattern = /(?:^|[_\-\s])(ui[_-]?test|e2e|fixture|demo)(?:$|[_\-\s])/iu;
const productionUiFixturePattern = /ui[_\-\s]*workflow|ui(?:[_\-\s]*(?:contract|合約))?[_\-\s]*(?:test|測試)/iu;

const allowedActions = new Set([
  "activate_engine_candidate",
  "rollback_active_engine",
  "adopt_p0_p1_draft",
  "adopt_writing_candidate",
  "neural_trace_missing",
  "approve_cleanup_proposal",
  "execute_cleanup_proposal",
  "restore_from_backup",
  "compressed_rule_update",
  "setting_change_proposal",
  "retire_external_brain_session",
]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createId() {
  const compact = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const timestamp = `${compact.slice(0, 8)}-${compact.slice(8)}`;
  return `approval_item_${timestamp}-${randomBytes(4).toString("hex")}`;
}

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function optionalText(value, maxLength = 5_000) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw errorWithStatus(`Text exceeds ${maxLength} characters.`);
  return text;
}

function rootsFor(options = {}) {
  if (options.fixtureRoot) {
    const fixtureRoot = assertPathInside(
      options.fixtureRoot,
      path.join(projectRoot, "tests", ".tmp"),
      "approval queue fixture root",
    );
    const approvalQueue = path.join(fixtureRoot, "data", "approval_queue");
    return {
      approvalQueue,
      approvalItems: path.join(approvalQueue, "items"),
      approvalLogs: path.join(approvalQueue, "logs"),
      approvalLog: path.join(approvalQueue, "logs", "approval_log.jsonl"),
    };
  }
  const approvalQueue = options.approvalQueue
    ? assertPathInside(options.approvalQueue, projectPaths.approvalQueue, "approval queue test root")
    : projectPaths.approvalQueue;
  return {
    approvalQueue,
    approvalItems: path.join(approvalQueue, "items"),
    approvalLogs: path.join(approvalQueue, "logs"),
    approvalLog: path.join(approvalQueue, "logs", "approval_log.jsonl"),
  };
}

function fixtureTransactionMetadata(options = {}) {
  return options.fixtureRoot
    ? { test_transaction_dir: path.join(options.fixtureRoot, "data", "outputs", "logs", "transactions") }
    : {};
}

function targetOptions(options = {}) {
  return {
    ...(options.writingWorkflow ? { writingWorkflow: options.writingWorkflow } : {}),
    ...(options.writingCandidates ? { writingCandidates: options.writingCandidates } : {}),
    ...(options.proofReports ? { proofReports: options.proofReports } : {}),
    ...(options.adoptedWritings ? { adoptedWritings: options.adoptedWritings } : {}),
    ...(options.approvalQueue ? { approvalQueue: options.approvalQueue } : {}),
    ...(options.outputs ? { outputs: options.outputs } : {}),
    ...(options.activeEnginePath ? { activeEnginePath: options.activeEnginePath } : {}),
    ...(options.pendingEngineCandidates
      ? { pendingEngineCandidates: options.pendingEngineCandidates }
      : {}),
    ...(options.engineSnapshots ? { engineSnapshots: options.engineSnapshots } : {}),
    ...(options.engineArchive ? { engineArchive: options.engineArchive } : {}),
    ...(options.activationLog ? { activationLog: options.activationLog } : {}),
    ...(options.rollbackIndex ? { rollbackIndex: options.rollbackIndex } : {}),
    ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
  };
}

function cleanupTargetOptions(options = {}) {
  return {
    ...(options.cleanupRoot ? { cleanupRoot: options.cleanupRoot } : {}),
    ...(options.engineArchive ? { engineArchive: options.engineArchive } : {}),
    ...(options.rejectedEngineCandidates ? { rejectedEngineCandidates: options.rejectedEngineCandidates } : {}),
    ...(options.pendingEngineCandidates ? { pendingEngineCandidates: options.pendingEngineCandidates } : {}),
    ...(options.engineSnapshots ? { engineSnapshots: options.engineSnapshots } : {}),
    ...(options.rollbackIndex ? { rollbackIndex: options.rollbackIndex } : {}),
    ...(options.candidateDrafts ? { candidateDrafts: options.candidateDrafts } : {}),
    ...(options.proofReports ? { proofReports: options.proofReports } : {}),
    ...(options.adoptedChapters ? { adoptedChapters: options.adoptedChapters } : {}),
    ...(options.contextBundles ? { contextBundles: options.contextBundles } : {}),
    ...(options.settlementContexts ? { settlementContexts: options.settlementContexts } : {}),
    ...(options.settlementReports ? { settlementReports: options.settlementReports } : {}),
    ...(options.approvalItems ? { approvalItems: options.approvalItems } : {}),
    ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
  };
}

function itemPaths(approvalItemId, roots) {
  assertApprovalItemId(approvalItemId);
  const directory = path.join(roots.approvalItems, approvalItemId);
  return {
    directory,
    item: path.join(directory, "item.json"),
    status: path.join(directory, "status.json"),
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function positiveGeneration(value) {
  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation > 0 ? generation : 1;
}

export function approvalIdentity(input = {}) {
  const actionType = firstText(input.actionType, input.action_type);
  const targetId = firstText(input.targetId, input.target_id);
  const requestKind = firstText(
    input.requestKind,
    input.request_kind,
    input.details?.request_kind,
    actionType,
  );
  const workflowRunId = firstText(
    input.workflowRunId,
    input.workflow_run_id,
    input.runId,
    input.run_id,
    input.lineage?.workflow_run_id,
    input.lineage?.run_id,
    input.details?.workflow_run_id,
    input.details?.lineage?.workflow_run_id,
    actionType === "retire_external_brain_session" ? targetId : "",
  );
  const sourcePhase = firstText(
    input.sourcePhase,
    input.source_phase,
    input.details?.source_phase,
  );
  const sourceRevision = firstText(
    input.sourceRevision,
    input.source_revision,
    input.candidateHash,
    input.candidate_hash,
    input.proofReportHash,
    input.proof_report_hash,
    input.details?.candidate_engine_hash_sha256,
    input.details?.candidate_hash,
    input.details?.source_revision,
    input.details?.raw_hash,
    input.details?.active_engine_hash,
  );
  const lifecycleGeneration = positiveGeneration(
    input.lifecycleGeneration
      ?? input.lifecycle_generation
      ?? input.lineage?.lifecycle_generation
      ?? input.details?.lifecycle_generation,
  );
  const sourceHash = firstText(input.sourceHash, input.source_hash)
    || (actionType === "retire_external_brain_session"
      ? hashAgentRunValue({
        session_id: targetId,
        lifecycle_generation: lifecycleGeneration,
      })
      : hashAgentRunValue({
      request_kind: requestKind,
      target_id: targetId,
      workflow_run_id: workflowRunId,
      source_phase: sourcePhase,
      source_revision: sourceRevision,
      lifecycle_generation: lifecycleGeneration,
      }));
  const components = {
    request_kind: requestKind,
    target_id: targetId,
    workflow_run_id: workflowRunId || null,
    source_phase: sourcePhase || null,
    source_revision: sourceRevision || null,
    source_hash: sourceHash,
    lifecycle_generation: lifecycleGeneration,
  };
  return {
    ...components,
    dedupe_key: hashAgentRunValue(components),
  };
}

function approvalStatus(item) {
  return item?.status?.status ?? item?.status ?? null;
}

function explicitlyAllowsReproposal(item) {
  return item?.reproposal_allowed === true
    || item?.status?.reproposal_allowed === true
    || item?.status?.suppression?.reproposal_allowed === true;
}

function legacyIdentityMatches(item, identity, actionType, targetId) {
  if (item.dedupe_key) return false;
  if (item.action_type !== actionType || item.target_id !== targetId) return false;
  const legacy = approvalIdentity(item);
  if (legacy.lifecycle_generation !== identity.lifecycle_generation) return false;
  const legacyRevision = firstText(
    item.source_revision,
    item.candidate_hash,
    item.proof_report_hash,
    item.details?.candidate_engine_hash_sha256,
    item.details?.candidate_hash,
    item.details?.raw_hash,
  );
  if (legacyRevision && identity.source_revision && legacyRevision !== identity.source_revision) {
    return false;
  }
  if (legacy.workflow_run_id && identity.workflow_run_id
    && legacy.workflow_run_id !== identity.workflow_run_id) {
    return false;
  }
  return Boolean(legacyRevision || actionType === "retire_external_brain_session");
}

function isTestQueue(options = {}) {
  if (options.enforceProductionFixtureIsolation === true
    || options.enforce_production_fixture_isolation === true) return false;
  return Boolean(options.fixtureRoot)
    || Boolean(options.approvalQueue && path.resolve(options.approvalQueue) !== projectPaths.approvalQueue);
}

export function isApprovalTestFixture(input = {}) {
  if (input.testFixture === true || input.test_fixture === true) return true;
  if (input.details?.test_fixture === true || input.metadata?.test_fixture === true) return true;
  const environment = firstText(input.environment, input.details?.environment, input.metadata?.environment);
  const sourceKind = firstText(
    input.sourceKind,
    input.source_kind,
    input.details?.source_kind,
    input.metadata?.source_kind,
  );
  if (["test", "fixture", "e2e", "demo"].includes(environment.toLowerCase())) return true;
  if (["test", "test_fixture", "ui_contract_test", "e2e", "demo"].includes(sourceKind.toLowerCase())) {
    return true;
  }
  const structuredSource = [
    input.sourceChapter,
    input.source_chapter,
    input.source,
    input.createdBy,
    input.created_by,
  ].filter(Boolean).join(" ");
  return productionFixturePattern.test(structuredSource)
    || productionUiFixturePattern.test(structuredSource);
}

export function isActionableApprovalItem(item = {}) {
  const status = approvalStatus(item);
  const targetExists = item.target_exists ?? item.status?.target_exists;
  if (status === "pending") {
    return targetExists !== false && !isApprovalTestFixture(item);
  }
  if (status === "blocked") {
    return targetExists !== false
      && item.resolution_path?.available === true
      && !isApprovalTestFixture(item);
  }
  return false;
}

function baseStatus(status = "pending", reason = null) {
  if (!allowedStatuses.has(status)) throw errorWithStatus("Invalid approval status.");
  return {
    status,
    confirmed_at: null,
    rejected_at: null,
    deferred_at: null,
    resolved_at: null,
    reason,
  };
}

function activationImpact(candidate = null) {
  const willModify = ["data/canon_db/active_engine.md"];
  if (candidate?.metadata?.current_input_refresh) {
    willModify.push(
      "data/outputs/task_prompt.md",
      "data/outputs/generation_context.md",
      "data/outputs/retrieval_context.md",
    );
  }
  if (candidate?.metadata?.settlement_report_metadata_path) {
    willModify.push(candidate.metadata.settlement_report_metadata_path);
  }
  return {
    will_modify: willModify,
    will_create: ["snapshot", "archive", "activation_log"],
    rollback_available: true,
  };
}

function isDirectSettlementCandidate(metadata = {}) {
  return metadata.candidate_kind === "direct_chapter_settlement_promotion"
    || metadata.source === "direct_chapter_settlement_promotion_service"
    || metadata.lineage_mode === "direct_chapter_settlement_summary"
    || metadata.source_lineage?.lineage_mode === "direct_chapter_settlement_summary"
    || metadata.source_lineage?.legacy_adopted_writing_workflow_applicable === false;
}

async function neuralCandidateState(metadata, options = {}) {
  if (isDirectSettlementCandidate(metadata)) {
    return {
      required: false,
      ok: true,
      status: "not_applicable",
      blocked_reason: null,
      workflow_run_id: null,
      trace_source_available: false,
    };
  }
  if (metadata.requires_neural_modules !== true) {
    return {
      required: false,
      ok: true,
      status: "not_required",
      blocked_reason: null,
      workflow_run_id: null,
      trace_source_available: false,
    };
  }
  const workflowRunId = firstText(
    metadata.workflow_run_id,
    metadata.run_id,
    metadata.source_lineage?.workflow_run_id,
  );
  if (!workflowRunId) {
    return {
      required: true,
      ok: false,
      status: "trace_source_unavailable",
      blocked_reason: "trace source unavailable: workflow_run_id is missing",
      workflow_run_id: null,
      trace_source_available: false,
    };
  }
  try {
    assertAgentRunId(workflowRunId);
    const run = await getAgentRun(workflowRunId, options);
    const usage = await summarizeNeuralUsageForRun(run.run_id, options);
    if (usage.missing_required_neural_modules.length) {
      return {
        required: true,
        ok: false,
        status: "missing",
        blocked_reason:
          `neural_trace_missing: ${usage.missing_required_neural_modules.join(", ")}`,
        workflow_run_id: workflowRunId,
        trace_source_available: true,
      };
    }
    return {
      required: true,
      ok: true,
      status: "success",
      blocked_reason: null,
      workflow_run_id: workflowRunId,
      trace_source_available: true,
    };
  } catch (error) {
    return {
      required: true,
      ok: false,
      status: "trace_source_unavailable",
      blocked_reason: `trace source unavailable: ${error.message}`,
      workflow_run_id: workflowRunId,
      trace_source_available: false,
    };
  }
}

export function isSafeApprovalItemId(id) {
  return typeof id === "string" && approvalItemIdPattern.test(id);
}

export function assertApprovalItemId(id) {
  if (!isSafeApprovalItemId(id)) throw errorWithStatus("Invalid approval_item_id.");
  return id;
}

export async function ensureApprovalQueueDirectories(options = {}) {
  const roots = rootsFor(options);
  await Promise.all([
    mkdir(roots.approvalItems, { recursive: true }),
    mkdir(roots.approvalLogs, { recursive: true }),
  ]);
  return roots;
}

export async function appendApprovalLog(event, item, details = {}, options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  const record = {
    event,
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    target_type: item.target_type,
    target_id: item.target_id,
    created_at: new Date().toISOString(),
    approved_by: optionalText(details.approvedBy ?? details.approved_by, 200) || null,
    result: details.result ?? "success",
    error_message: details.errorMessage ?? details.error_message ?? null,
    reason: optionalText(details.reason, 5_000) || null,
  };
  await commitFileTransaction("append-approval-log", [
    { type: "append", filePath: roots.approvalLog, content: `${JSON.stringify(record)}\n` },
  ], {
    approval_item_id: item.approval_item_id,
    event,
    phase: "phase_5a_approval_queue",
    ...fixtureTransactionMetadata(options),
  });
  return record;
}

export async function listApprovalLogs(options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  if (!await exists(roots.approvalLog)) return [];
  return (await readFile(roots.approvalLog, "utf8"))
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

async function createApprovalItemUnlocked(input = {}, options = {}) {
  const roots = await ensureApprovalQueueDirectories(options);
  const actionType = optionalText(input.actionType ?? input.action_type, 100);
  if (!allowedActions.has(actionType)) throw errorWithStatus("Invalid approval action_type.");
  const targetType = optionalText(input.targetType ?? input.target_type, 100);
  const targetId = optionalText(input.targetId ?? input.target_id, 200);
  if (!targetType || !targetId) throw errorWithStatus("target_type and target_id are required.");
  if (!isTestQueue(options) && isApprovalTestFixture(input)) {
    return {
      approval_item_id: null,
      approval_item_created: false,
      persisted: false,
      test_fixture: true,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      status: baseStatus("archived", "test_fixture_excluded_from_production_queue"),
      diagnostic: "test fixture excluded from production approval queue",
    };
  }
  const identity = approvalIdentity({
    ...input,
    action_type: actionType,
    target_id: targetId,
  });
  const matching = (await listApprovalItems(options))
    .filter((item) => {
      const existingIdentity = item.dedupe_key
        ? { dedupe_key: item.dedupe_key }
        : approvalIdentity(item);
      return existingIdentity.dedupe_key === identity.dedupe_key
        || legacyIdentityMatches(item, identity, actionType, targetId);
    })
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
  const existing = matching.find((item) => !explicitlyAllowsReproposal(item));
  if (existing) {
    return {
      ...existing,
      approval_item_created: false,
      deduplicated: true,
      suppressed: terminalApprovalStatuses.has(approvalStatus(existing)),
    };
  }

  const characterVoiceGate = actionType === "adopt_writing_candidate"
    ? input.details?.character_voice_adoption_gate
      ?? buildCharacterVoiceAdoptionGate(
        input.candidate ?? input.candidateMetadata ?? input.candidate_metadata
          ?? input.details?.candidate_metadata,
        input.proof ?? input.proofMetadata ?? input.proof_metadata
          ?? input.details?.proof_metadata,
      )
    : null;
  const approvalItemId = createId();
  const now = new Date().toISOString();
  const item = {
    approval_item_id: approvalItemId,
    created_at: now,
    updated_at: now,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    source_chapter: optionalText(input.sourceChapter ?? input.source_chapter, 500),
    title: optionalText(input.title, 500),
    summary: optionalText(
      characterVoiceGate?.blocking === true
        ? `${input.summary ?? ""}${input.summary ? " " : ""}Character Voice Guard 判定為高風險；採用前必須二次確認。`
        : input.summary,
      5_000,
    ),
    risk_level: characterVoiceGate?.blocking === true
      ? "high"
      : optionalText(input.riskLevel ?? input.risk_level, 50) || "unknown",
    requires_second_confirmation:
      input.requiresSecondConfirmation === true
      || input.requires_second_confirmation === true
      || characterVoiceGate?.requires_second_confirmation === true,
    requires_neural_success:
      input.requiresNeuralSuccess === true || input.requires_neural_success === true,
    neural_status: optionalText(input.neuralStatus ?? input.neural_status, 100) || "not_required",
    blocked_reason: optionalText(input.blockedReason ?? input.blocked_reason, 5_000) || null,
    candidate_id: input.candidateId ?? input.candidate_id ?? null,
    candidate_hash: input.candidateHash ?? input.candidate_hash ?? null,
    candidate_path: input.candidatePath ?? input.candidate_path ?? null,
    candidate_meta_path: input.candidateMetaPath ?? input.candidate_meta_path ?? null,
    proof_report_id: input.proofReportId ?? input.proof_report_id ?? null,
    proof_report_hash: input.proofReportHash ?? input.proof_report_hash ?? null,
    proof_verdict: input.proofVerdict ?? input.proof_verdict ?? null,
    proof_severity: input.proofSeverity ?? input.proof_severity ?? null,
    reason: optionalText(input.reason, 5_000),
    requires_user_confirmation: actionType === "adopt_writing_candidate"
      || actionType === "retire_external_brain_session"
      || input.requiresUserConfirmation === true
      || input.requires_user_confirmation === true,
    can_execute_without_user_confirmation:
      ["adopt_writing_candidate", "retire_external_brain_session"].includes(actionType)
        ? false
        : input.canExecuteWithoutUserConfirmation === true
          || input.can_execute_without_user_confirmation === true,
    created_by: optionalText(input.createdBy ?? input.created_by, 200),
    request_kind: identity.request_kind,
    source: optionalText(input.source, 100) || null,
    source_kind: optionalText(input.sourceKind ?? input.source_kind, 100) || null,
    environment: optionalText(input.environment, 50) || "production",
    test_fixture: input.testFixture === true || input.test_fixture === true,
    source_phase: identity.source_phase,
    source_revision: identity.source_revision,
    source_hash: identity.source_hash,
    workflow_run_id: identity.workflow_run_id,
    lifecycle_generation: identity.lifecycle_generation,
    dedupe_key: identity.dedupe_key,
    dedupe_components: identity,
    reproposal_allowed: input.reproposalAllowed === true || input.reproposal_allowed === true,
    verified_by: optionalText(input.verifiedBy ?? input.verified_by, 200) || null,
    bridge_capabilities: input.bridgeCapabilities ?? input.bridge_capabilities ?? null,
    lineage: {
      ...(input.lineage ?? {}),
      ...(identity.workflow_run_id ? { workflow_run_id: identity.workflow_run_id } : {}),
      lifecycle_generation: identity.lifecycle_generation,
    },
    safety_snapshot: input.safetySnapshot ?? input.safety_snapshot ?? null,
    operator_readiness: input.operatorReadiness ?? input.operator_readiness ?? null,
    safety: input.safety ?? null,
    impact: input.impact ?? { will_modify: [], will_create: [], rollback_available: false },
    links: {
      candidate_id: input.links?.candidate_id ?? null,
      snapshot_id: input.links?.snapshot_id ?? null,
      proof_report_id: input.links?.proof_report_id ?? null,
      adopted_chapter_id: input.links?.adopted_chapter_id ?? null,
      draft_id: input.links?.draft_id ?? null,
      proposal_id: input.links?.proposal_id ?? null,
    },
    details: characterVoiceGate ? {
      ...(input.details ?? {}),
      character_voice_adoption_gate: characterVoiceGate,
      character_voice_guard_display: characterVoiceGate.display,
      character_voice_findings: characterVoiceGate.display.findings,
    } : input.details ?? {},
    resolution_path: input.resolutionPath ?? input.resolution_path ?? (
      actionType === "neural_trace_missing" && identity.workflow_run_id
        ? {
          available: true,
          action: "record_required_neural_success_trace_then_refresh",
        }
        : input.blockedReason || input.blocked_reason || input.status === "blocked"
          ? { available: false, action: null }
          : { available: true, action: "human_decision" }
    ),
    ...(actionType === "retire_external_brain_session" ? {
      session_id: targetId,
      current_classification: input.currentClassification ?? input.current_classification ?? null,
      last_activity_at: input.lastActivityAt ?? input.last_activity_at ?? null,
      activity_age_days: input.activityAgeDays ?? input.activity_age_days ?? null,
      writing_context_bundle_ids: input.writingContextBundleIds ?? input.writing_context_bundle_ids ?? [],
      neural_trace_count: input.neuralTraceCount ?? input.neural_trace_count ?? 0,
      estimated_logical_bytes: input.estimatedLogicalBytes ?? input.estimated_logical_bytes ?? 0,
      estimated_file_count: input.estimatedFileCount ?? input.estimated_file_count ?? 0,
      ownership_proof_complete: input.ownershipProofComplete === true
        || input.ownership_proof_complete === true,
      retirement_recommendation: input.retirementRecommendation
        ?? input.retirement_recommendation
        ?? null,
      retention_after_retirement_days: input.retentionAfterRetirementDays
        ?? input.retention_after_retirement_days
        ?? defaultCleanupRetentionPolicy.abandoned_session_days,
      cleanup_not_executed: true,
    } : {}),
  };
  const status = baseStatus(
    input.status === "blocked" || item.blocked_reason ? "blocked" : "pending",
    item.blocked_reason,
  );
  status.dedupe_key = identity.dedupe_key;
  status.source_hash = identity.source_hash;
  status.lifecycle_generation = identity.lifecycle_generation;
  const paths = itemPaths(approvalItemId, roots);
  await commitFileTransaction("create-approval-item", [
    { filePath: paths.item, content: json(item) },
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.approvalLog,
      content: `${JSON.stringify({
        event: status.status === "blocked" ? "approval_blocked" : "approval_created",
        approval_item_id: approvalItemId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        created_at: now,
        approved_by: null,
        result: "success",
        error_message: null,
      })}\n`,
    },
  ], {
    approval_item_id: approvalItemId,
    phase: "phase_5a_approval_queue",
    ...fixtureTransactionMetadata(options),
  });
  return getApprovalItem(approvalItemId, options);
}

let approvalCreationTail = Promise.resolve();

export async function createApprovalItem(input = {}, options = {}) {
  const previous = approvalCreationTail;
  let release;
  approvalCreationTail = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await createApprovalItemUnlocked(input, options);
  } finally {
    release();
  }
}

export async function listApprovalItems(options = {}) {
  const roots = rootsFor(options);
  let entries;
  try {
    entries = await readdir(roots.approvalItems, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeApprovalItemId(entry.name)) continue;
    try {
      const paths = itemPaths(entry.name, roots);
      const [item, status] = await Promise.all([
        readJson(paths.item),
        readJson(paths.status),
      ]);
      items.push({ ...item, status });
    } catch {
      // Ignore incomplete approval records.
    }
  }
  return items.sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
}

export async function getApprovalItem(approvalItemId, options = {}) {
  assertApprovalItemId(approvalItemId);
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Approval item not found.", 404);
  const [item, status] = await Promise.all([
    readJson(paths.item),
    readJson(paths.status),
  ]);
  return { ...item, status };
}

export async function validateApprovalItemTarget(item, options = {}) {
  try {
    if (item.target_type === "pending_engine_candidate") {
      const candidate = await getPendingCandidate(item.target_id, targetOptions(options));
      const status = candidate.status?.status;
      if (["rejected", "activated"].includes(status)) {
        return { exists: true, actionable: false, reason: `target_status_${status}` };
      }
      return { exists: true, actionable: true, reason: null, target: candidate };
    }
    if (item.target_type === "external_brain_session") {
      const run = await getAgentRun(item.target_id, options);
      const lifecycle = String(run.session_lifecycle_status ?? "ACTIVE").toUpperCase();
      if (["COMPLETED", "ABANDONED", "FAILED", "BLOCKED"].includes(lifecycle)) {
        return { exists: true, actionable: false, reason: `target_lifecycle_${lifecycle.toLowerCase()}` };
      }
      return { exists: true, actionable: true, reason: null, target: run };
    }
    if (item.target_type === "candidate_draft") {
      await getCandidateDraft(item.target_id, targetOptions(options));
      return { exists: true, actionable: true, reason: null };
    }
    if (item.target_type === "writing_candidate") {
      const { getWritingCandidateDetail } = await import("./chat-output-candidate-service.mjs");
      await getWritingCandidateDetail(item.target_id, options);
      return { exists: true, actionable: true, reason: null };
    }
    if (item.target_type === "cleanup_proposal") {
      await getCleanupProposal(item.target_id, cleanupTargetOptions(options));
      return { exists: true, actionable: true, reason: null };
    }
    if (item.target_type === "setting_change_proposal") {
      const { getSettingChangeProposal } = await import("./setting-change-proposal-service.mjs");
      await getSettingChangeProposal(item.target_id, options);
      return { exists: true, actionable: true, reason: null };
    }
    if (item.target_type === "agent_run" || item.target_type === "workflow_run") {
      await getAgentRun(item.target_id, options);
      return { exists: true, actionable: true, reason: null };
    }
    if (item.target_type === "engine_snapshot") {
      const snapshot = (await listSnapshots(targetOptions(options)))
        .find((record) => record.snapshot_id === item.target_id);
      return snapshot
        ? { exists: true, actionable: snapshot.rollback_available === true, reason: snapshot.rollback_available === true ? null : "target_not_actionable" }
        : { exists: false, actionable: false, reason: "target_not_found" };
    }
    return { exists: null, actionable: true, reason: null };
  } catch (error) {
    if (error.statusCode === 404 || /not found|不存在/iu.test(error.message)) {
      return { exists: false, actionable: false, reason: "target_not_found" };
    }
    return { exists: null, actionable: false, reason: `target_validation_failed: ${error.message}` };
  }
}

async function transitionApprovalItemStatus(
  approvalItemId,
  nextStatus,
  reason,
  event,
  options = {},
  extras = {},
) {
  const item = await getApprovalItem(approvalItemId, options);
  const now = new Date().toISOString();
  const status = {
    ...item.status,
    status: nextStatus,
    reason: reason || item.status.reason || null,
    ...extras,
  };
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  await commitFileTransaction(`approval-${nextStatus}`, [
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.approvalLog,
      content: `${JSON.stringify({
        event,
        approval_item_id: approvalItemId,
        action_type: item.action_type,
        target_type: item.target_type,
        target_id: item.target_id,
        created_at: now,
        approved_by: null,
        result: "success",
        error_message: null,
        reason: reason || null,
      })}\n`,
    },
  ], {
    approval_item_id: approvalItemId,
    phase: "approval_queue_lifecycle_reconciliation",
    ...fixtureTransactionMetadata(options),
  });
  return getApprovalItem(approvalItemId, options);
}

export async function invalidateApprovalItem(
  approvalItemId,
  { reason = "target_not_found", orphaned = false } = {},
  options = {},
) {
  const current = await getApprovalItem(approvalItemId, options);
  if (["invalidated", "orphaned"].includes(approvalStatus(current))) return current;
  const now = new Date().toISOString();
  return transitionApprovalItemStatus(
    approvalItemId,
    orphaned ? "orphaned" : "invalidated",
    reason,
    orphaned ? "approval_orphaned" : "approval_invalidated",
    options,
    {
      invalidated_at: now,
      invalidation_reason: reason,
      target_exists: reason === "target_not_found" ? false : current.status.target_exists,
      suppression: {
        dedupe_key: current.dedupe_key ?? approvalIdentity(current).dedupe_key,
        source_hash: current.source_hash ?? approvalIdentity(current).source_hash,
        suppress_reproposal: true,
        reason,
        recorded_at: now,
      },
    },
  );
}

export async function archiveApprovalItem(
  approvalItemId,
  { reason = "archived_by_cleanup", duplicateOf = null } = {},
  options = {},
) {
  const current = await getApprovalItem(approvalItemId, options);
  if (approvalStatus(current) === "archived") return current;
  const now = new Date().toISOString();
  return transitionApprovalItemStatus(
    approvalItemId,
    "archived",
    reason,
    "approval_archived",
    options,
    {
      archived_at: now,
      archive_reason: reason,
      duplicate_of: duplicateOf,
      prior_status: current.status.status,
      suppression: current.status.suppression ?? {
        dedupe_key: current.dedupe_key ?? approvalIdentity(current).dedupe_key,
        source_hash: current.source_hash ?? approvalIdentity(current).source_hash,
        suppress_reproposal: true,
        reason,
        recorded_at: now,
      },
    },
  );
}

export async function backfillApprovalIdentity(approvalItemId, options = {}) {
  const current = await getApprovalItem(approvalItemId, options);
  const identity = approvalIdentity(current);
  const now = new Date().toISOString();
  const item = {
    ...current,
    status: undefined,
    updated_at: now,
    request_kind: current.request_kind ?? identity.request_kind,
    source_phase: current.source_phase ?? identity.source_phase,
    source_revision: current.source_revision ?? identity.source_revision,
    source_hash: identity.source_hash,
    workflow_run_id: current.workflow_run_id ?? identity.workflow_run_id,
    lifecycle_generation: identity.lifecycle_generation,
    dedupe_key: identity.dedupe_key,
    dedupe_components: identity,
  };
  const status = {
    ...current.status,
    dedupe_key: identity.dedupe_key,
    source_hash: identity.source_hash,
    lifecycle_generation: identity.lifecycle_generation,
    ...(approvalStatus(current) === "rejected" && !current.status.suppression ? {
      decision: current.status.decision ?? {
        decision: current.action_type === "retire_external_brain_session" ? "keep" : "rejected",
        decided_at: current.status.rejected_at ?? now,
        reason: current.status.reason ?? null,
        dedupe_key: identity.dedupe_key,
        source_hash: identity.source_hash,
        lifecycle_generation: identity.lifecycle_generation,
      },
      suppression: {
        dedupe_key: identity.dedupe_key,
        source_hash: identity.source_hash,
        lifecycle_generation: identity.lifecycle_generation,
        suppress_reproposal: true,
        reproposal_allowed: current.reproposal_allowed === true,
        reason: "backfilled_from_explicit_rejected_status",
        recorded_at: now,
      },
    } : {}),
  };
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  await commitFileTransaction("backfill-approval-identity", [
    { filePath: paths.item, content: json(item) },
    { filePath: paths.status, content: json(status) },
  ], {
    approval_item_id: approvalItemId,
    phase: "approval_queue_dedupe_migration",
    ...fixtureTransactionMetadata(options),
  });
  return getApprovalItem(approvalItemId, options);
}

export async function reconcileApprovalQueueTargets(options = {}) {
  const changes = [];
  for (const item of await listApprovalItems(options)) {
    if (terminalApprovalStatuses.has(approvalStatus(item))) continue;
    if (isApprovalTestFixture(item) && !isTestQueue(options)) {
      changes.push(await archiveApprovalItem(item.approval_item_id, {
        reason: "test_fixture_excluded_from_production_queue",
      }, options));
      continue;
    }
    const target = await validateApprovalItemTarget(item, options);
    if (target.exists === false) {
      changes.push(await invalidateApprovalItem(item.approval_item_id, {
        reason: "target_not_found",
        orphaned: true,
      }, options));
    } else if (target.exists === true && target.actionable === false) {
      changes.push(await invalidateApprovalItem(item.approval_item_id, {
        reason: target.reason ?? "target_not_actionable",
      }, options));
    }
  }
  return changes;
}

export async function listActionableApprovalItems(options = {}) {
  if (options.reconcile !== false) await reconcileApprovalQueueTargets(options);
  return (await listApprovalItems(options)).filter(isActionableApprovalItem);
}

export async function refreshApprovalItem(approvalItemId, options = {}) {
  const current = await getApprovalItem(approvalItemId, options);
  if (current.action_type === "activate_engine_candidate"
    || current.action_type === "neural_trace_missing") {
    let candidate;
    try {
      candidate = await getPendingCandidate(current.target_id, targetOptions(options));
    } catch (error) {
      if (error.statusCode === 404 || /not found|不存在/iu.test(error.message)) {
        return invalidateApprovalItem(approvalItemId, {
          reason: "target_not_found",
          orphaned: true,
        }, options);
      }
      throw error;
    }
    const neural = await neuralCandidateState(candidate.metadata, options);
    const blockedReason = candidate.status.status !== "candidate"
      ? candidate.status.blocked_reason || `candidate status: ${candidate.status.status}`
      : neural.ok ? null : neural.blocked_reason;
    const next = {
      ...current,
      updated_at: new Date().toISOString(),
      risk_level: candidate.risk_report.risk_level,
      requires_second_confirmation:
        candidate.risk_report.requires_second_confirmation === true,
      neural_status: neural.status,
      blocked_reason: blockedReason,
      details: {
        ...current.details,
        candidate_status: candidate.status.status,
        diff: candidate.diff,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        candidate_hash: candidate.metadata.candidate_hash,
      },
    };
    const status = blockedReason
      ? { ...current.status, status: "blocked", reason: blockedReason }
      : current.status.status === "blocked"
        ? baseStatus("pending")
        : current.status;
    const roots = rootsFor(options);
    const paths = itemPaths(approvalItemId, roots);
    await commitFileTransaction("refresh-approval-item", [
      { filePath: paths.item, content: json({ ...next, status: undefined }) },
      { filePath: paths.status, content: json(status) },
    ], {
      approval_item_id: approvalItemId,
      phase: "phase_5a_approval_queue",
      ...fixtureTransactionMetadata(options),
    });
  }
  return getApprovalItem(approvalItemId, options);
}

export async function scanApprovalQueue(options = {}) {
  await ensureApprovalQueueDirectories(options);
  await reconcileApprovalQueueTargets(options);
  const scanned = [];
  const diagnostics = [];
  let suppressedCount = 0;
  for (const summary of await listPendingCandidates(targetOptions(options))) {
    const candidate = await getPendingCandidate(summary.candidate_id, targetOptions(options));
    if (["rejected", "activated"].includes(candidate.status.status)) continue;
    const neural = await neuralCandidateState(candidate.metadata, options);
    const candidateBlocked = candidate.status.status !== "candidate"
      || candidate.risk_report.risk_level === "critical";
    if (!neural.ok) {
      if (!neural.trace_source_available || !neural.workflow_run_id) {
        diagnostics.push({
          kind: "neural_trace_source_unavailable",
          severity: "warning",
          target_type: "pending_engine_candidate",
          target_id: summary.candidate_id,
          workflow_run_id: neural.workflow_run_id,
          neural_status: neural.status,
          message: neural.blocked_reason,
          approval_item_created: false,
        });
        continue;
      }
      const item = await createApprovalItem({
        actionType: "neural_trace_missing",
        requestKind: "neural_trace_missing",
        targetType: "pending_engine_candidate",
        targetId: summary.candidate_id,
        workflowRunId: neural.workflow_run_id,
        sourceHash: candidate.metadata.candidate_hash || candidate.metadata.raw_hash,
        sourceRevision: candidate.metadata.candidate_hash || candidate.metadata.raw_hash,
        sourcePhase: candidate.metadata.source_phase ?? "engine_candidate_neural_evidence_scan",
        sourceKind: candidate.metadata.source_kind ?? null,
        environment: candidate.metadata.environment ?? "production",
        testFixture: isApprovalTestFixture(candidate.metadata),
        sourceChapter: candidate.metadata.source_chapter,
        title: "缺少必要 Neural Success Trace",
        summary: "此候選不可強制確認，只能延後或拒絕。",
        riskLevel: candidate.risk_report.risk_level,
        requiresNeuralSuccess: true,
        neuralStatus: neural.status,
        blockedReason: neural.blocked_reason,
        status: "blocked",
        resolutionPath: {
          available: true,
          action: "record_required_neural_success_trace_then_refresh",
        },
        impact: activationImpact(candidate),
        links: { candidate_id: summary.candidate_id },
        lineage: { workflow_run_id: neural.workflow_run_id },
        details: {
          diff: candidate.diff,
          candidate_status: candidate.status.status,
          candidate_hash: candidate.metadata.candidate_hash,
          raw_hash: candidate.metadata.raw_hash,
        },
      }, options);
      if (item.suppressed) suppressedCount += 1;
      scanned.push(item);
      continue;
    }
    const item = await createApprovalItem({
      actionType: "activate_engine_candidate",
      requestKind: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: summary.candidate_id,
      workflowRunId: firstText(
        candidate.metadata.workflow_run_id,
        candidate.metadata.run_id,
        candidate.metadata.source_lineage?.workflow_run_id,
      ),
      sourceHash: candidate.metadata.candidate_hash || candidate.metadata.raw_hash,
      sourceRevision: candidate.metadata.candidate_hash || candidate.metadata.raw_hash,
      sourcePhase: candidate.metadata.source_phase ?? "pending_engine_candidate_scan",
      sourceKind: candidate.metadata.source_kind ?? candidate.metadata.candidate_kind ?? null,
      environment: candidate.metadata.environment ?? "production",
      testFixture: isApprovalTestFixture(candidate.metadata),
      sourceChapter: candidate.metadata.source_chapter,
      title: "啟用新版完整創作引擎",
      summary: "Pending candidate 等待 Phase 3 人工確認。",
      riskLevel: candidate.risk_report.risk_level,
      requiresSecondConfirmation:
        candidate.risk_report.requires_second_confirmation === true,
      requiresNeuralSuccess: candidate.metadata.requires_neural_modules === true,
      neuralStatus: neural.status,
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      blockedReason: candidateBlocked
        ? candidate.status.blocked_reason
          || `${candidate.status.status} / ${candidate.risk_report.risk_level}`
        : null,
      status: candidateBlocked ? "blocked" : "pending",
      resolutionPath: candidateBlocked
        ? { available: true, action: "repair_or_reparse_candidate" }
        : { available: true, action: "human_decision" },
      impact: activationImpact(candidate),
      links: { candidate_id: summary.candidate_id },
      lineage: candidate.metadata.source_lineage ?? null,
      details: {
        candidate_status: candidate.status.status,
        diff: candidate.diff,
        active_engine_hash_at_import: candidate.metadata.active_engine_hash_at_import,
        candidate_hash: candidate.metadata.candidate_hash,
        raw_hash: candidate.metadata.raw_hash,
        neural_status: neural.status,
      },
    }, options);
    if (item.suppressed) suppressedCount += 1;
    scanned.push(item);
  }

  for (const proof of await listProofReports(targetOptions(options))) {
    if ((proof.issue_summary?.p0_count ?? 0) === 0
      && (proof.issue_summary?.p1_count ?? 0) === 0) continue;
    const draft = await getCandidateDraft(proof.draft_id, targetOptions(options));
    if (draft.status.can_adopt !== true || draft.status.status === "accepted_pending_settlement") {
      continue;
    }
    const item = await createApprovalItem({
      actionType: "adopt_p0_p1_draft",
      requestKind: "adopt_p0_p1_draft",
      targetType: "candidate_draft",
      targetId: proof.draft_id,
      sourceHash: proof.proof_hash ?? proof.content_hash ?? proof.proof_id,
      sourceRevision: proof.proof_hash ?? proof.content_hash ?? proof.proof_id,
      sourcePhase: "writing_workflow_proof_scan",
      sourceChapter: draft.metadata.source_chapter,
      title: "確認採用含 P0 / P1 的正文",
      summary: "驗稿含重大警告，採用前必須再次人工確認。",
      riskLevel: "high",
      requiresSecondConfirmation: true,
      neuralStatus: "not_required",
      impact: {
        will_modify: [],
        will_create: ["adopted_chapter"],
        rollback_available: false,
      },
      links: {
        proof_report_id: proof.proof_id,
        draft_id: proof.draft_id,
      },
      details: { issue_summary: proof.issue_summary },
    }, options);
    if (item.suppressed) suppressedCount += 1;
    scanned.push(item);
  }

  const retirement = await scanExternalBrainRetirementApprovals(options);
  scanned.push(...retirement.items);
  diagnostics.push(...(retirement.diagnostics ?? []));
  suppressedCount += retirement.suppressed_count ?? 0;
  return {
    scanned_count: scanned.length,
    suppressed_count: suppressedCount,
    diagnostics,
    items: await listApprovalItems(options),
    pending_items: await listActionableApprovalItems({ ...options, reconcile: false }),
  };
}

export async function scanExternalBrainRetirementApprovals(options = {}) {
  await ensureApprovalQueueDirectories(options);
  const liveness = await auditActiveExternalBrainSessions({}, options);
  const items = [];
  const diagnostics = [];
  let suppressedCount = 0;
  for (const session of liveness.sessions) {
    if (session.recommendation !== reconciliationRecommendations.RETIRE_RECOMMENDED) continue;
    if (!session.session_id || session.ownership_proof_complete !== true
      || (!(session.writing_context_bundle_ids ?? []).length && !session.neural_trace_count)) {
      diagnostics.push({
        kind: "session_retirement_traceability_unavailable",
        severity: "maintenance",
        session_id: session.session_id ?? null,
        message: "Retirement recommendation lacks workflow/source lineage and was not promoted to approval.",
        approval_item_created: false,
      });
      continue;
    }
    const item = await createExternalBrainSessionRetirementApprovalItem(session, options);
    if (item.suppressed) suppressedCount += 1;
    items.push(item);
  }
  return {
    live_retire_recommended_count: items.length,
    suppressed_count: suppressedCount,
    diagnostics,
    items,
  };
}

export async function createExternalBrainSessionRetirementApprovalItem(session, options = {}) {
  assertAgentRunId(session?.session_id);
  if (session.recommendation !== reconciliationRecommendations.RETIRE_RECOMMENDED) {
    throw errorWithStatus("Session does not have a live RETIRE_RECOMMENDED recommendation.", 409);
  }
  if (session.ownership_proof_complete !== true
    || (!(session.writing_context_bundle_ids ?? []).length && !session.neural_trace_count)) {
    throw errorWithStatus(
      "Session retirement lacks sufficient workflow/source traceability; emit a maintenance diagnostic instead.",
      409,
    );
  }
  const run = await getAgentRun(session.session_id, options);
  const lifecycleGeneration = positiveGeneration(
    session.lifecycle_generation ?? run.lifecycle_generation,
  );
  const sessionRoots = externalBrainSessionRoots(options);
  const reason = "Session exceeded the stale activity threshold, has complete cognition lineage, and has no live governance or acceptance-evidence pin.";
  return createApprovalItem({
    actionType: "retire_external_brain_session",
    requestKind: "retire_external_brain_session",
    targetType: "external_brain_session",
    targetId: session.session_id,
    workflowRunId: session.session_id,
    sourceHash: hashAgentRunValue({
      session_id: session.session_id,
      lifecycle_generation: lifecycleGeneration,
    }),
    sourcePhase: "external_brain_session_lifecycle_phase_3c",
    sourceKind: "external_brain_session_liveness_scan",
    lifecycleGeneration,
    title: "退役已停止的 GPT 外置大腦 Session",
    summary: "此 Session 已超過 stale activity threshold，完整 cognition lineage 可辨識，且目前沒有治理或 acceptance evidence pin。核准後只標記 ABANDONED，不刪除資料；30 天後才可能進入獨立 cleanup proposal。",
    riskLevel: "medium",
    requiresSecondConfirmation: false,
    requiresUserConfirmation: true,
    canExecuteWithoutUserConfirmation: false,
    reason,
    currentClassification: session.current_classification ?? session.classification ?? "STALE_ACTIVE_SESSION",
    lastActivityAt: session.latest_activity_at ?? session.last_activity_at,
    activityAgeDays: session.activity_age_days,
    writingContextBundleIds: session.writing_context_bundle_ids,
    neuralTraceCount: session.neural_trace_count,
    estimatedLogicalBytes: session.estimated_logical_bytes,
    estimatedFileCount: session.estimated_file_count,
    ownershipProofComplete: session.ownership_proof_complete,
    retirementRecommendation: session.recommendation,
    retentionAfterRetirementDays: defaultCleanupRetentionPolicy.abandoned_session_days,
    impact: {
      will_modify: [normalizeProjectPath(agentRunPaths(session.session_id, options).run)],
      will_create: [normalizeProjectPath(path.join(
        sessionRoots.auditRoot,
        "retirements",
        `${session.session_id}.json`,
      ))],
      will_delete: [],
      active_engine_modified: false,
      canon_modified: false,
      cleanup_executed: false,
      rollback_available: false,
    },
    details: {
      recommendation_reason: reason,
      control_plane_approval_reference: true,
      substantive_governance_pin: false,
      workflow_run_id: session.session_id,
      lifecycle_generation: lifecycleGeneration,
      source_trace_ids: session.final_polisher_success_trace_ids
        ?? session.final_polisher_failed_trace_ids
        ?? [],
    },
    lineage: {
      workflow_run_id: session.session_id,
      agent_run_id: session.session_id,
      writing_context_bundle_ids: session.writing_context_bundle_ids,
      lifecycle_generation: lifecycleGeneration,
    },
    createdBy: "external_brain_session_liveness_scan",
    sourcePhase: "external_brain_session_lifecycle_phase_3c",
  }, options);
}

export async function createRollbackApprovalItem(snapshotId, options = {}) {
  assertSnapshotId(snapshotId);
  const snapshot = (await listSnapshots(targetOptions(options)))
    .find((item) => item.snapshot_id === snapshotId);
  if (!snapshot) throw errorWithStatus("Snapshot not found.", 404);
  if (snapshot.rollback_available !== true) {
    throw errorWithStatus("Snapshot is not available for rollback.", 409);
  }
  return createApprovalItem({
    actionType: "rollback_active_engine",
    targetType: "engine_snapshot",
    targetId: snapshotId,
    sourceChapter: snapshot.source_chapter,
    title: "回滾 Active Engine",
    summary: "Phase 3 將先建立 safety snapshot，再回滾至指定版本。",
    riskLevel: "P0",
    requiresSecondConfirmation: true,
    neuralStatus: "not_required",
    impact: {
      will_modify: ["data/canon_db/active_engine.md"],
      will_create: ["safety_snapshot", "activation_log"],
      rollback_available: true,
    },
    links: { snapshot_id: snapshotId },
    details: { active_engine_hash: snapshot.active_engine_hash },
  }, options);
}

async function updateDecision(approvalItemId, decision, reason, options = {}) {
  const item = await getApprovalItem(approvalItemId, options);
  if (["resolved", "confirmed"].includes(item.status.status)) {
    throw errorWithStatus(`Approval item is already ${item.status.status}.`, 409);
  }
  const now = new Date().toISOString();
  const identity = item.dedupe_key
    ? {
      dedupe_key: item.dedupe_key,
      source_hash: item.source_hash,
      lifecycle_generation: item.lifecycle_generation,
    }
    : approvalIdentity(item);
  const status = {
    ...item.status,
    status: decision,
    reason: optionalText(reason, 5_000) || null,
    rejected_at: decision === "rejected" ? now : item.status.rejected_at,
    deferred_at: decision === "deferred" ? now : item.status.deferred_at,
    ...(decision === "rejected" ? {
      decision: {
        decision: item.action_type === "retire_external_brain_session" ? "keep" : "rejected",
        decided_at: now,
        reason: optionalText(reason, 5_000) || null,
        dedupe_key: identity.dedupe_key,
        source_hash: identity.source_hash,
        lifecycle_generation: identity.lifecycle_generation,
      },
      suppression: {
        dedupe_key: identity.dedupe_key,
        source_hash: identity.source_hash,
        lifecycle_generation: identity.lifecycle_generation,
        suppress_reproposal: true,
        reproposal_allowed: item.reproposal_allowed === true,
        reason: "explicit_user_rejection",
        recorded_at: now,
      },
    } : {}),
  };
  const roots = rootsFor(options);
  const paths = itemPaths(approvalItemId, roots);
  const event = decision === "rejected" ? "approval_rejected" : "approval_deferred";
  await commitFileTransaction(`approval-${decision}`, [
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.approvalLog,
      content: `${JSON.stringify({
        event,
        approval_item_id: approvalItemId,
        action_type: item.action_type,
        target_type: item.target_type,
        target_id: item.target_id,
        created_at: now,
        approved_by: null,
        result: "success",
        error_message: null,
        reason: status.reason,
      })}\n`,
    },
  ], {
    approval_item_id: approvalItemId,
    phase: "phase_5a_approval_queue",
    ...fixtureTransactionMetadata(options),
  });
  return getApprovalItem(approvalItemId, options);
}

export async function rejectApprovalItem(approvalItemId, { reason = "" } = {}, options = {}) {
  assertApprovalItemId(approvalItemId);
  return updateDecision(approvalItemId, "rejected", reason, options);
}

export async function deferApprovalItem(approvalItemId, { reason = "" } = {}, options = {}) {
  assertApprovalItemId(approvalItemId);
  return updateDecision(approvalItemId, "deferred", reason, options);
}

export async function confirmApprovalItem(
  approvalItemId,
  {
    confirm = false,
    secondConfirm = false,
    approvalText = "",
    approvedBy = "local_user",
  } = {},
  options = {},
) {
  assertApprovalItemId(approvalItemId);
  const item = await getApprovalItem(approvalItemId, options);
  try {
    if (confirm !== true) throw errorWithStatus("User confirmation is required.", 409);
    if (item.status.status === "blocked" || item.blocked_reason) {
      throw errorWithStatus(`Blocked approval item cannot be confirmed: ${item.blocked_reason}`, 409);
    }
    if (item.action_type === "neural_trace_missing") {
      throw errorWithStatus("neural_trace_missing cannot be force-confirmed.", 409);
    }
    if (!["pending", "deferred"].includes(item.status.status)) {
      throw errorWithStatus(`Approval item cannot be confirmed: ${item.status.status}`, 409);
    }
    const characterVoiceGate = item.details?.character_voice_adoption_gate;
    if (
      item.action_type === "adopt_writing_candidate"
      && characterVoiceGate?.blocking === true
      && secondConfirm !== true
    ) {
      throw errorWithStatus(
        "Character Voice Guard high-risk adoption requires second confirmation.",
        409,
      );
    }
    if (
      item.action_type === "adopt_writing_candidate"
      && characterVoiceGate?.blocking === true
      && approvalText !== characterVoiceGate.exact_confirmation_text
    ) {
      throw errorWithStatus(
        "Character Voice Guard high-risk adoption requires exact confirmation text.",
        409,
      );
    }
    if (item.requires_second_confirmation === true && secondConfirm !== true) {
      throw errorWithStatus("This approval requires second confirmation.", 409);
    }
    if (
      item.action_type === "activate_engine_candidate"
      && item.requires_second_confirmation === true
      && approvalText !== "確認啟用"
    ) {
      throw errorWithStatus("High-risk approval requires checkbox and exact confirmation text.", 409);
    }
    if (
      item.action_type === "setting_change_proposal"
      && item.requires_second_confirmation === true
      && approvalText !== "確認設定修改"
    ) {
      throw errorWithStatus(
        "P0 setting proposal approval requires exact confirmation text.",
        409,
      );
    }
    let result;
    if (item.action_type === "activate_engine_candidate") {
      assertEngineCandidateId(item.target_id);
      result = await activateEngineCandidateAfterApproval({
        approvalItemId,
        pendingEngineCandidateId: item.target_id,
        confirmedBy: approvedBy,
        secondConfirm,
      }, {
        ...targetOptions(options),
        approvalConfirmed: true,
        approvalItem: item,
      });
    } else if (item.action_type === "rollback_active_engine") {
      assertSnapshotId(item.target_id);
      result = await rollbackActiveEngine(item.target_id, {
        confirm: true,
        approvedBy,
      }, targetOptions(options));
    } else if (item.action_type === "adopt_p0_p1_draft") {
      assertDraftId(item.target_id);
      if (secondConfirm !== true) {
        throw errorWithStatus("P0/P1 adoption requires second confirmation.", 409);
      }
      result = await adoptCandidateDraft(item.target_id, {
        confirm: true,
        adoptedBy: approvedBy,
        note: "Approved through Phase 5A approval queue.",
      }, targetOptions(options));
    } else if (item.action_type === "adopt_writing_candidate") {
      result = await adoptWritingCandidateAfterApproval({
        approvalItemId,
        candidateId: item.target_id,
        proofReportId: item.proof_report_id || item.links?.proof_report_id,
        confirmedBy: approvedBy,
        reason: item.reason,
      }, {
        ...targetOptions(options),
        approvalConfirmed: true,
        approvalItem: item,
      });
    } else if (item.action_type === "approve_cleanup_proposal") {
      assertCleanupProposalId(item.target_id);
      result = await approveCleanupProposal(item.target_id, {
        confirm: true,
        approvedBy,
      }, cleanupTargetOptions(options));
    } else if (item.action_type === "execute_cleanup_proposal") {
      assertCleanupProposalId(item.target_id);
      result = await executeCleanupProposal(item.target_id, {
        confirm: true,
        approvedBy,
      }, cleanupTargetOptions(options));
    } else if (item.action_type === "retire_external_brain_session") {
      if (item.target_type !== "external_brain_session") {
        throw errorWithStatus("Retirement approval target_type is invalid.", 409);
      }
      assertAgentRunId(item.target_id);
      result = await retireExternalBrainSession(item.target_id, {
        retired_by: optionalText(approvedBy, 200) || "local_user",
        retirement_reason: item.reason || item.details?.recommendation_reason,
      }, {
        ...targetOptions(options),
        ...(options.now instanceof Date ? { now: options.now } : {}),
      });
    } else if (item.action_type === "compressed_rule_update") {
      // Approval confirmed for compressed rule update — do not auto-apply here.
      // Execution is handled by a dedicated service to ensure safety and explicit application.
      result = null;
    } else if (item.action_type === "setting_change_proposal") {
      result = {
        proposal_id: item.details?.proposal_id ?? item.links?.proposal_id ?? null,
        proposal_approved: true,
        applied_to_canon: false,
        active_engine_modified: false,
        canon_db_modified: false,
        compressed_rules_modified: false,
      };
    } else {
      throw errorWithStatus(`Unsupported confirm action: ${item.action_type}`, 409);
    }
    const now = new Date().toISOString();
    const roots = rootsFor(options);
    const paths = itemPaths(approvalItemId, roots);
    const status = {
      ...item.status,
      status: "resolved",
      confirmed_at: now,
      resolved_at: now,
      reason: null,
      execution_result: result?.activation_log_id ? {
        activation_log_id: result.activation_log_id,
        pending_engine_candidate_id: result.pending_engine_candidate_id,
        snapshot_id: result.snapshot_id,
        previous_active_engine_hash: result.previous_active_engine_hash,
        new_active_engine_hash: result.new_active_engine_hash,
        rollback_requires_approval: result.rollback_requires_approval,
      } : result?.adopted_chapter_id ? {
        adopted_chapter_id: result.adopted_chapter_id,
        candidate_id: result.candidate_id,
        proof_report_id: result.proof_report_id,
      } : result?.run?.session_lifecycle_status === "ABANDONED" ? {
        session_id: result.run.run_id,
        session_lifecycle_status: result.run.session_lifecycle_status,
        retired_at: result.run.retired_at,
        retired_by: result.run.retired_by,
        retirement_reason: result.run.retirement_reason,
        production_cleanup_executed: false,
      } : null,
    };
    const logs = ["approval_confirmed", "approval_resolved"].map((event) => ({
      event,
      approval_item_id: approvalItemId,
      action_type: item.action_type,
      target_type: item.target_type,
      target_id: item.target_id,
      created_at: now,
      approved_by: optionalText(approvedBy, 200) || "local_user",
      result: "success",
      error_message: null,
    }));
    await commitFileTransaction("resolve-approval-item", [
      { filePath: paths.status, content: json(status) },
      {
        type: "append",
        filePath: roots.approvalLog,
        content: logs.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      },
    ], {
      approval_item_id: approvalItemId,
      phase: "phase_5a_approval_queue",
      ...fixtureTransactionMetadata(options),
    });
    return {
      approval_item: await getApprovalItem(approvalItemId, options),
      result,
    };
  } catch (error) {
    await appendApprovalLog("approval_failed", item, {
      approvedBy,
      result: "failed",
      errorMessage: error.message,
    }, options);
    throw error;
  }
}
