import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  agentRunPaths,
  getAgentRun,
} from "./agent-run-service.mjs";
import { defaultCleanupRetentionPolicy } from "./cleanup-retention-policy.mjs";
import {
  collectDeterministicTransactionLineage,
  externalBrainSessionClassifications as C,
  externalBrainSessionRoots,
  scanExternalBrainSessions,
} from "./external-brain-session-lineage-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { normalizeProjectPath } from "./project-paths.mjs";

export const activeSessionLivenessDiagnostics = Object.freeze({
  RECENT_ACTIVE_ACTIVITY: "RECENT_ACTIVE_ACTIVITY",
  FINAL_POLISHER_COMPLETED_BUT_RUN_STILL_RUNNING: "FINAL_POLISHER_COMPLETED_BUT_RUN_STILL_RUNNING",
  STALE_RUNNING_WITH_COMPLETE_LINEAGE: "STALE_RUNNING_WITH_COMPLETE_LINEAGE",
  STALE_RUNNING_INCOMPLETE_LINEAGE: "STALE_RUNNING_INCOMPLETE_LINEAGE",
  GOVERNANCE_PINNED_RUNNING: "GOVERNANCE_PINNED_RUNNING",
  ACCEPTANCE_PINNED_RUNNING: "ACCEPTANCE_PINNED_RUNNING",
  UNKNOWN_RUNNING: "UNKNOWN_RUNNING",
});

export const reconciliationRecommendations = Object.freeze({
  DETERMINISTIC_BACKFILL: "DETERMINISTIC_BACKFILL",
  DETERMINISTIC_COMPLETION_RECONCILIATION: "DETERMINISTIC_COMPLETION_RECONCILIATION",
  RETIRE_RECOMMENDED: "RETIRE_RECOMMENDED",
  KEEP_ACTIVE: "KEEP_ACTIVE",
  PINNED: "PINNED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
});

const runIdPattern = /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const bundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const terminalLifecycleStatuses = new Set(["COMPLETED", "ABANDONED", "FAILED", "BLOCKED"]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireText(value, label, maxLength = 2_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return value.trim();
}

function fixtureTransactionMetadata(options = {}) {
  return options.fixtureRoot
    ? { test_transaction_dir: path.join(options.fixtureRoot, "data", "outputs", "logs", "transactions") }
    : {};
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function diagnosticFileMtime(filePath) {
  try {
    return (await stat(filePath)).mtime.toISOString();
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function directoryEntries(root) {
  try {
    return await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function tracesForSession(session, roots) {
  const traces = [];
  for (const traceId of session.neural_trace_ids) {
    try {
      traces.push(await readJson(path.join(roots.neuralTraces, `${traceId}.json`)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return traces;
}

function latestTimestamp(values) {
  const timestamps = values.map((value) => Date.parse(value ?? "")).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function activityAgeDays(timestamp, now) {
  const parsed = Date.parse(timestamp ?? "");
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : null;
}

function exactSuccessfulFinalTrace(traces, runId, bundleIds) {
  const candidates = traces.filter((trace) => (
    trace.run_id === runId
    && trace.module_name === "final_polisher"
    && trace.status === "success"
  ));
  if (candidates.length !== 1 || bundleIds.length !== 1) return null;
  return candidates[0].writing_context_bundle_id === bundleIds[0]
    ? candidates[0]
    : null;
}

function compactReferenceSources(session) {
  return session.referenced_by.map((record) => ({
    category: record.category,
    source_path: record.source_path,
    status: record.status,
    ids: record.ids,
  }));
}

export async function auditActiveExternalBrainSessions(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const roots = externalBrainSessionRoots(options);
  const scan = await scanExternalBrainSessions(input, options);
  const transactionLineage = await collectDeterministicTransactionLineage(options);
  const records = [];
  for (const session of scan.sessions) {
    const run = await getAgentRun(session.session_id, options);
    if (run.status !== "running" && run.session_lifecycle_status !== "ACTIVE") continue;
    if (terminalLifecycleStatuses.has(String(run.session_lifecycle_status ?? "").toUpperCase())) continue;
    const runFileMtimeAt = await diagnosticFileMtime(agentRunPaths(session.session_id, options).run);
    const traces = await tracesForSession(session, roots);
    const latestTransaction = transactionLineage.latest_activity_by_run[session.session_id] ?? null;
    const latestActivityAt = latestTimestamp([
      session.last_activity_at,
      latestTransaction?.completed_at,
    ]);
    const activityAge = activityAgeDays(latestActivityAt, now);
    const finalSuccess = traces.filter((trace) => trace.module_name === "final_polisher" && trace.status === "success");
    const finalFailed = traces.filter((trace) => trace.module_name === "final_polisher" && trace.status === "failed");
    const exactFinal = exactSuccessfulFinalTrace(traces, session.session_id, session.writing_context_bundle_ids);
    let diagnostic;
    let recommendation;
    if (session.governance_references?.length || session.classification === C.GOVERNANCE_PINNED_SESSION) {
      diagnostic = activeSessionLivenessDiagnostics.GOVERNANCE_PINNED_RUNNING;
      recommendation = reconciliationRecommendations.PINNED;
    } else if (session.acceptance_evidence_references.length || session.classification === C.ACCEPTANCE_EVIDENCE_PINNED_SESSION) {
      diagnostic = activeSessionLivenessDiagnostics.ACCEPTANCE_PINNED_RUNNING;
      recommendation = reconciliationRecommendations.PINNED;
    } else if (finalSuccess.length) {
      diagnostic = activeSessionLivenessDiagnostics.FINAL_POLISHER_COMPLETED_BUT_RUN_STILL_RUNNING;
      recommendation = exactFinal
        ? reconciliationRecommendations.DETERMINISTIC_COMPLETION_RECONCILIATION
        : reconciliationRecommendations.REVIEW_REQUIRED;
    } else if (session.classification === C.STALE_ACTIVE_SESSION) {
      diagnostic = session.ownership_proof_complete
        ? activeSessionLivenessDiagnostics.STALE_RUNNING_WITH_COMPLETE_LINEAGE
        : activeSessionLivenessDiagnostics.STALE_RUNNING_INCOMPLETE_LINEAGE;
      recommendation = session.ownership_proof_complete
        ? reconciliationRecommendations.RETIRE_RECOMMENDED
        : reconciliationRecommendations.REVIEW_REQUIRED;
    } else if (session.classification === C.ACTIVE_SESSION) {
      diagnostic = activeSessionLivenessDiagnostics.RECENT_ACTIVE_ACTIVITY;
      recommendation = reconciliationRecommendations.KEEP_ACTIVE;
    } else {
      diagnostic = activeSessionLivenessDiagnostics.UNKNOWN_RUNNING;
      recommendation = reconciliationRecommendations.REVIEW_REQUIRED;
    }
    records.push({
      session_id: session.session_id,
      run_created_at: run.created_at ?? null,
      run_updated_at: run.updated_at ?? null,
      run_file_mtime_at_diagnostic_only: runFileMtimeAt,
      run_status: run.status,
      run_mode: run.mode,
      session_lifecycle_status: run.session_lifecycle_status ?? "ACTIVE",
      lifecycle_generation: Number.isSafeInteger(run.lifecycle_generation)
        && run.lifecycle_generation > 0
        ? run.lifecycle_generation
        : 1,
      writing_context_bundle_ids: session.writing_context_bundle_ids,
      neural_trace_count: session.neural_trace_ids.length,
      estimated_logical_bytes: session.estimated_logical_bytes,
      estimated_file_count: session.estimated_file_count,
      inferred_writing_context_bundle_ids: session.inferred_writing_context_bundle_ids,
      latest_trace_called_at: session.latest_trace_called_at,
      latest_neural_output_timestamp: session.latest_neural_output_timestamp,
      latest_transaction_timestamp: latestTransaction?.completed_at ?? null,
      latest_transaction_id: latestTransaction?.transaction_id ?? null,
      latest_activity_at: latestActivityAt,
      activity_age_days: activityAge,
      final_polisher_success_trace_ids: finalSuccess.map((trace) => trace.trace_id),
      final_polisher_failed_trace_ids: finalFailed.map((trace) => trace.trace_id),
      raw_story_handoff_ids: session.raw_story_handoff_ids,
      governance_reference_count: session.governance_references?.length ?? 0,
      acceptance_evidence_reference_count: session.acceptance_evidence_references.length,
      ownership_proof_complete: session.ownership_proof_complete,
      reference_sources: compactReferenceSources(session),
      diagnostic,
      recommendation,
      deterministic_completion_trace_id: exactFinal?.trace_id ?? null,
    });
  }
  const diagnosticCounts = Object.fromEntries(Object.values(activeSessionLivenessDiagnostics).map((diagnostic) => [
    diagnostic,
    records.filter((record) => record.diagnostic === diagnostic).length,
  ]));
  const recommendationCounts = Object.fromEntries(Object.values(reconciliationRecommendations).map((recommendation) => [
    recommendation,
    records.filter((record) => record.recommendation === recommendation).length,
  ]));
  return {
    schema_version: "external-brain-active-session-liveness-audit-v1",
    generated_at: now.toISOString(),
    dry_run: true,
    production_cleanup_executed: false,
    stale_active_session_days: scan.retention_policy.stale_active_session_days,
    running_session_count: records.length,
    diagnostic_counts: diagnosticCounts,
    recommendation_counts: recommendationCounts,
    oldest_activity_age_days: records.reduce((max, record) => Math.max(max, record.activity_age_days ?? 0), 0),
    sessions: records.sort((left, right) => (right.activity_age_days ?? -1) - (left.activity_age_days ?? -1)),
  };
}

function evidenceForRecoveredBundle(session, recoveredBundleId) {
  return session.edges.filter((edge) => (
    ((edge.from === session.session_id && edge.to === recoveredBundleId)
      || (edge.to === session.session_id && edge.from === recoveredBundleId))
    && edge.kind !== "INFERRED_TIME_CORRELATION"
  )).map((edge) => ({
    evidence_kind: edge.kind,
    source_path: edge.source_path,
    from: edge.from,
    to: edge.to,
  }));
}

export async function buildExternalBrainSessionReconciliationPlan(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const beforeScan = await scanExternalBrainSessions(input, options);
  const recoveredScan = await scanExternalBrainSessions({
    ...input,
    include_transaction_lineage: true,
  }, options);
  const recoveredById = new Map(recoveredScan.sessions.map((session) => [session.session_id, session]));
  const transactionLineage = await collectDeterministicTransactionLineage(options);
  const transactionPairsByRun = new Map();
  const transactionEvidenceHashes = new Map();
  for (const pair of transactionLineage.deterministic_pairs) {
    if (!transactionPairsByRun.has(pair.run_id)) transactionPairsByRun.set(pair.run_id, []);
    transactionPairsByRun.get(pair.run_id).push(pair);
    transactionEvidenceHashes.set(pair.source_path, pair.source_sha256);
  }
  const lineageItems = [];
  for (const before of beforeScan.sessions.filter((session) => session.classification === C.INCOMPLETE_SESSION)) {
    const after = recoveredById.get(before.session_id);
    const recoveredBundleIds = after.writing_context_bundle_ids.filter((id) => !before.writing_context_bundle_ids.includes(id));
    const evidence = recoveredBundleIds
      .flatMap((bundleId) => evidenceForRecoveredBundle(after, bundleId))
      .map((entry) => ({
        ...entry,
        source_sha256: transactionEvidenceHashes.get(entry.source_path) ?? null,
      }));
    const uniqueBundles = [...new Set(recoveredBundleIds)];
    const conflicts = [...new Set((transactionPairsByRun.get(before.session_id) ?? [])
      .map((pair) => pair.writing_context_bundle_id))].length > 1;
    lineageItems.push({
      action: uniqueBundles.length === 1 && !conflicts
        ? reconciliationRecommendations.DETERMINISTIC_BACKFILL
        : reconciliationRecommendations.REVIEW_REQUIRED,
      session_id: before.session_id,
      current_explicit_bundle_ids: before.writing_context_bundle_ids,
      inferred_bundle_ids: before.inferred_writing_context_bundle_ids,
      recovered_bundle_ids: uniqueBundles,
      deterministic_evidence_sources: evidence,
      remaining_ambiguity: conflicts
        ? "multiple_deterministic_bundle_candidates"
        : uniqueBundles.length === 0
          ? "no_deterministic_bundle_evidence"
          : null,
      before_classification: before.classification,
      after_classification: after.classification,
    });
  }
  const liveness = await auditActiveExternalBrainSessions(input, options);
  const lifecycleItems = liveness.sessions.map((record) => ({
    action: record.recommendation,
    session_id: record.session_id,
    diagnostic: record.diagnostic,
    latest_activity_at: record.latest_activity_at,
    activity_age_days: record.activity_age_days,
    deterministic_completion_trace_id: record.deterministic_completion_trace_id,
    writing_context_bundle_ids: record.writing_context_bundle_ids,
  }));
  const items = [...lineageItems, ...lifecycleItems];
  return {
    schema_version: "external-brain-session-reconciliation-plan-v1",
    generated_at: now.toISOString(),
    dry_run: true,
    production_cleanup_executed: false,
    automatic_retirement_executed: false,
    before_classification_counts: Object.fromEntries(Object.values(C).map((classification) => [
      classification,
      beforeScan.sessions.filter((session) => session.classification === classification).length,
    ])),
    deterministic_backfill_count: items.filter((item) => item.action === reconciliationRecommendations.DETERMINISTIC_BACKFILL).length,
    deterministic_completion_reconciliation_count: items.filter((item) => item.action === reconciliationRecommendations.DETERMINISTIC_COMPLETION_RECONCILIATION).length,
    retire_recommended_count: items.filter((item) => item.action === reconciliationRecommendations.RETIRE_RECOMMENDED).length,
    review_required_count: items.filter((item) => item.action === reconciliationRecommendations.REVIEW_REQUIRED).length,
    items,
  };
}

async function writeRunAndAudit({ runId, nextRun, audit, auditPath, action, options }) {
  const paths = agentRunPaths(runId, options);
  const nextContent = json(nextRun);
  const afterSha = sha256(nextContent);
  audit.after_run_metadata_sha256 = afterSha;
  await commitFileTransaction(action, [
    { type: "write", filePath: paths.run, content: nextContent },
    { type: "write", filePath: auditPath, content: json(audit) },
  ], {
    phase: "external_brain_session_lifecycle_phase_3b",
    run_id: runId,
    action,
    ...fixtureTransactionMetadata(options),
  });
  return { run: nextRun, audit };
}

export async function retireExternalBrainSession(runId, input = {}, options = {}) {
  if (!runIdPattern.test(String(runId ?? ""))) throw new Error("run_id is invalid.");
  const actor = requireText(input.retired_by, "retired_by", 200);
  const reason = requireText(input.retirement_reason, "retirement_reason", 2_000);
  const now = options.now instanceof Date ? options.now : new Date();
  const scan = await scanExternalBrainSessions({}, options);
  const session = scan.sessions.find((entry) => entry.session_id === runId);
  if (!session) throw new Error(`External brain session not found: ${runId}`);
  if (session.referenced_by.length || [C.GOVERNANCE_PINNED_SESSION, C.ACCEPTANCE_EVIDENCE_PINNED_SESSION].includes(session.classification)) {
    throw new Error("External brain session retirement is blocked by a live governance or acceptance-evidence reference.");
  }
  if (![C.ACTIVE_SESSION, C.STALE_ACTIVE_SESSION].includes(session.classification)) {
    throw new Error("Only active or stale-active sessions can be explicitly retired.");
  }
  const runPath = agentRunPaths(runId, options).run;
  const beforeContent = await readFile(runPath);
  const run = JSON.parse(beforeContent.toString("utf8"));
  if (terminalLifecycleStatuses.has(String(run.session_lifecycle_status ?? "").toUpperCase())) {
    throw new Error("External brain session already has a terminal lifecycle status.");
  }
  const retiredAt = now.toISOString();
  const nextRun = {
    ...run,
    session_lifecycle_status: "ABANDONED",
    retired_at: retiredAt,
    retired_by: actor,
    retirement_reason: reason,
    last_activity_at: retiredAt,
    last_activity_source: "explicit_retirement",
    updated_at: retiredAt,
  };
  const roots = externalBrainSessionRoots(options);
  const auditDirectory = path.join(roots.auditRoot, "retirements");
  await mkdir(auditDirectory, { recursive: true });
  const auditPath = path.join(auditDirectory, `${runId}.json`);
  return writeRunAndAudit({
    runId,
    nextRun,
    audit: {
      schema_version: "external-brain-session-retirement-audit-v1",
      session_id: runId,
      classification_before_retirement: session.classification,
      retired_at: retiredAt,
      retired_by: actor,
      retirement_reason: reason,
      reference_scan_summary: {
        referenced_by: session.referenced_by,
        explicit_reference_count: session.explicit_reference_count,
        inferred_reference_count: session.inferred_reference_count,
      },
      before_run_metadata_sha256: sha256(beforeContent),
      production_cleanup_executed: false,
    },
    auditPath,
    action: "external-brain-session-retirement",
    options,
  });
}

export async function executeExternalBrainSessionReconciliation(plan, input = {}, options = {}) {
  if (!plan || plan.schema_version !== "external-brain-session-reconciliation-plan-v1") {
    throw new Error("A valid Phase 3B reconciliation plan is required.");
  }
  if (input.confirm !== true) throw new Error("Reconciliation execution requires confirmation.");
  const actor = requireText(input.actor, "actor", 200);
  const allowedActions = new Set([
    reconciliationRecommendations.DETERMINISTIC_BACKFILL,
    reconciliationRecommendations.DETERMINISTIC_COMPLETION_RECONCILIATION,
  ]);
  const requested = plan.items.filter((item) => allowedActions.has(item.action));
  const results = [];
  for (const item of requested) {
    const runPath = agentRunPaths(item.session_id, options).run;
    const beforeContent = await readFile(runPath);
    const run = JSON.parse(beforeContent.toString("utf8"));
    if (run.mode !== "chatgpt_owned_external_brain") {
      throw new Error(`Refusing reconciliation for non-external-brain run: ${item.session_id}`);
    }
    const roots = externalBrainSessionRoots(options);
    const auditDirectory = path.join(roots.auditRoot, "reconciliations");
    await mkdir(auditDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
    const auditPath = path.join(auditDirectory, `${item.session_id}-${stamp}.json`);
    if (item.action === reconciliationRecommendations.DETERMINISTIC_BACKFILL) {
      if (item.recovered_bundle_ids.length !== 1 || !bundleIdPattern.test(item.recovered_bundle_ids[0])) {
        throw new Error(`Deterministic backfill lost uniqueness for ${item.session_id}.`);
      }
      const liveScan = await scanExternalBrainSessions({ include_transaction_lineage: true }, options);
      const live = liveScan.sessions.find((session) => session.session_id === item.session_id);
      if (!live || live.writing_context_bundle_ids.length !== 1
        || live.writing_context_bundle_ids[0] !== item.recovered_bundle_ids[0]) {
        throw new Error(`Deterministic backfill evidence changed for ${item.session_id}.`);
      }
      const nextRun = {
        ...run,
        external_brain_session_id: run.run_id,
        writing_context_bundle_id: item.recovered_bundle_ids[0],
        session_lifecycle_status: run.session_lifecycle_status
          ?? (["success", "warning"].includes(run.status) ? "COMPLETED" : run.status === "failed" ? "FAILED" : "ACTIVE"),
        last_activity_at: run.last_activity_at ?? live.last_activity_at ?? run.updated_at ?? run.created_at,
      };
      results.push(await writeRunAndAudit({
        runId: item.session_id,
        nextRun,
        audit: {
          schema_version: "external-brain-session-lineage-backfill-audit-v1",
          session_id: item.session_id,
          recovered_bundle_id: item.recovered_bundle_ids[0],
          evidence_kind: item.deterministic_evidence_sources.map((entry) => entry.evidence_kind),
          evidence_source_paths: item.deterministic_evidence_sources.map((entry) => entry.source_path),
          evidence_ids: [item.session_id, item.recovered_bundle_ids[0]],
          evidence_sha256: item.deterministic_evidence_sources
            .map((entry) => entry.source_sha256)
            .filter(Boolean),
          before_run_metadata_sha256: sha256(beforeContent),
          reconciled_at: new Date().toISOString(),
          actor,
          production_cleanup_executed: false,
        },
        auditPath,
        action: "external-brain-session-lineage-backfill",
        options,
      }));
      continue;
    }
    const scan = await scanExternalBrainSessions({}, options);
    const session = scan.sessions.find((entry) => entry.session_id === item.session_id);
    const traces = await tracesForSession(session, roots);
    const trace = exactSuccessfulFinalTrace(traces, item.session_id, session.writing_context_bundle_ids);
    if (!trace || trace.trace_id !== item.deterministic_completion_trace_id) {
      throw new Error(`Deterministic completion evidence changed for ${item.session_id}.`);
    }
    const nextRun = {
      ...run,
      status: "success",
      output_hash: trace.output_hash,
      warning: false,
      blocked: false,
      blocked_reason: null,
      session_lifecycle_status: "COMPLETED",
      session_completed_at: trace.called_at,
      last_activity_at: trace.called_at,
      last_activity_source: `final_polisher:${trace.trace_id}`,
      updated_at: trace.called_at,
    };
    results.push(await writeRunAndAudit({
      runId: item.session_id,
      nextRun,
      audit: {
        schema_version: "external-brain-session-completion-reconciliation-audit-v1",
        session_id: item.session_id,
        final_polisher_trace_id: trace.trace_id,
        writing_context_bundle_id: session.writing_context_bundle_ids[0],
        output_hash: trace.output_hash,
        before_run_metadata_sha256: sha256(beforeContent),
        reconciled_at: new Date().toISOString(),
        actor,
        production_cleanup_executed: false,
      },
      auditPath,
      action: "external-brain-session-completion-reconciliation",
      options,
    }));
  }
  return {
    executed_count: results.length,
    automatic_retirement_count: 0,
    production_cleanup_count: 0,
    results,
  };
}

export async function writeExternalBrainSessionPhase3bAudits(input = {}, options = {}) {
  const roots = externalBrainSessionRoots(options);
  await mkdir(roots.auditRoot, { recursive: true });
  const liveness = await auditActiveExternalBrainSessions(input, options);
  const plan = await buildExternalBrainSessionReconciliationPlan(input, options);
  const livenessPath = path.join(roots.auditRoot, "active-session-liveness-audit.json");
  const planPath = path.join(roots.auditRoot, "external-brain-session-reconciliation-plan.json");
  await Promise.all([
    writeFile(livenessPath, json(liveness), "utf8"),
    writeFile(planPath, json(plan), "utf8"),
  ]);
  return {
    liveness,
    plan,
    liveness_path: normalizeProjectPath(livenessPath),
    plan_path: normalizeProjectPath(planPath),
  };
}
