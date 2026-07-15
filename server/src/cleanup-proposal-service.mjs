import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { defaultCleanupRetentionPolicy } from "./cleanup-retention-policy.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  externalBrainSessionRoots,
  scanExternalBrainSessions,
  validateExternalBrainSessionCleanupPaths,
} from "./external-brain-session-lineage-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

export const cleanupProposalIdPattern =
  /^cleanup_proposal_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const cleanupTrashIdPattern =
  /^cleanup_trash_\d{8}-\d{6}-[a-f0-9]{8}$/u;

export { defaultCleanupRetentionPolicy };

const proposalStatuses = new Set([
  "draft",
  "approved",
  "rejected",
  "deferred",
  "executed",
  "blocked",
]);
const protectedExactPaths = new Set([
  normalizeProjectPath(projectPaths.activeEngine),
  normalizeProjectPath(projectPaths.activationLogs),
  normalizeProjectPath(projectPaths.approvalLogs),
  normalizeProjectPath(projectPaths.neuralTraces),
  normalizeProjectPath(projectPaths.cleanupLogs),
]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fixtureTransactionMetadata(options = {}) {
  return options.fixtureRoot
    ? { test_transaction_dir: path.join(options.fixtureRoot, "data", "outputs", "logs", "transactions") }
    : {};
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
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

function cleanupRoots(options = {}) {
  if (options.fixtureRoot) {
    const fixtureRoot = assertPathInside(
      options.fixtureRoot,
      path.join(projectRoot, "tests", ".tmp"),
      "cleanup fixture root",
    );
    const cleanupRoot = path.join(fixtureRoot, "data", "cleanup");
    return {
      cleanupRoot,
      cleanupProposals: path.join(cleanupRoot, "proposals"),
      cleanupLogs: path.join(cleanupRoot, "logs"),
      cleanupLog: path.join(cleanupRoot, "logs", "cleanup_log.jsonl"),
      cleanupTrash: path.join(cleanupRoot, "trash"),
      cleanupStaging: path.join(cleanupRoot, "staging"),
      cleanupTombstones: path.join(cleanupRoot, "tombstones"),
    };
  }
  const cleanupRoot = options.cleanupRoot
    ? assertPathInside(options.cleanupRoot, projectPaths.cleanupRoot, "cleanup test root")
    : projectPaths.cleanupRoot;
  return {
    cleanupRoot,
    cleanupProposals: path.join(cleanupRoot, "proposals"),
    cleanupLogs: path.join(cleanupRoot, "logs"),
    cleanupLog: path.join(cleanupRoot, "logs", "cleanup_log.jsonl"),
    cleanupTrash: path.join(cleanupRoot, "trash"),
    cleanupStaging: path.join(cleanupRoot, "staging"),
    cleanupTombstones: path.join(cleanupRoot, "tombstones"),
  };
}

function sourceRoots(options = {}) {
  if (options.fixtureRoot) {
    const roots = externalBrainSessionRoots({ fixtureRoot: options.fixtureRoot });
    const canonRoot = path.join(roots.fixtureRoot, "data", "canon_db");
    const workflowRoot = path.join(roots.fixtureRoot, "data", "writing_workflow");
    return {
      engineArchive: path.join(canonRoot, "archive"),
      rejectedEngineCandidates: path.join(canonRoot, "rejected_engine_candidates"),
      pendingEngineCandidates: roots.pendingEngineCandidates,
      engineSnapshots: path.join(canonRoot, "engine_snapshots"),
      rollbackIndex: roots.rollbackIndex,
      candidateDrafts: roots.candidateDrafts,
      proofReports: roots.workflowProofReports,
      adoptedChapters: roots.adoptedChapters,
      contextBundles: path.join(workflowRoot, "context_bundles"),
      settlementContexts: roots.settlementContexts,
      settlementReports: roots.settlementReports,
      approvalItems: roots.approvalItems,
    };
  }
  const canonRoot = (value, fallback, label) => (
    value ? assertPathInside(value, projectPaths.canonDb, label) : fallback
  );
  const workflowRoot = (value, fallback, label) => (
    value ? assertPathInside(value, projectPaths.writingWorkflow, label) : fallback
  );
  const approvalRoot = options.approvalItems
    ? assertPathInside(options.approvalItems, projectPaths.approvalQueue, "approval items root")
    : projectPaths.approvalItems;
  return {
    engineArchive: canonRoot(options.engineArchive, projectPaths.engineArchive, "archive root"),
    rejectedEngineCandidates: canonRoot(
      options.rejectedEngineCandidates,
      projectPaths.rejectedEngineCandidates,
      "rejected candidates root",
    ),
    pendingEngineCandidates: canonRoot(
      options.pendingEngineCandidates,
      projectPaths.pendingEngineCandidates,
      "pending candidates root",
    ),
    engineSnapshots: canonRoot(
      options.engineSnapshots,
      projectPaths.engineSnapshots,
      "snapshot root",
    ),
    rollbackIndex: options.rollbackIndex
      ? assertPathInside(options.rollbackIndex, projectPaths.canonDb, "rollback index")
      : projectPaths.rollbackIndex,
    candidateDrafts: workflowRoot(
      options.candidateDrafts,
      projectPaths.candidateDrafts,
      "candidate drafts root",
    ),
    proofReports: workflowRoot(
      options.proofReports,
      projectPaths.workflowProofReports,
      "proof reports root",
    ),
    adoptedChapters: workflowRoot(
      options.adoptedChapters,
      projectPaths.adoptedChapters,
      "adopted chapters root",
    ),
    contextBundles: workflowRoot(
      options.contextBundles,
      projectPaths.contextBundles,
      "context bundles root",
    ),
    settlementContexts: workflowRoot(
      options.settlementContexts,
      projectPaths.settlementContexts,
      "settlement contexts root",
    ),
    settlementReports: workflowRoot(
      options.settlementReports,
      projectPaths.settlementReports,
      "settlement reports root",
    ),
    approvalItems: approvalRoot,
  };
}

function proposalPaths(cleanupProposalId, roots) {
  assertCleanupProposalId(cleanupProposalId);
  const directory = path.join(roots.cleanupProposals, cleanupProposalId);
  return {
    directory,
    proposal: path.join(directory, "proposal.json"),
    status: path.join(directory, "status.json"),
    scanReport: path.join(directory, "scan_report.json"),
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

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (fallback !== null && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function directoryEntries(root) {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function directoryFiles(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw errorWithStatus(`Symbolic links cannot be cleaned: ${normalizeProjectPath(target)}`, 409);
    }
    if (entry.isDirectory()) files.push(...await directoryFiles(target, base));
    else if (entry.isFile()) files.push({
      path: target,
      relative: path.relative(base, target).replaceAll(path.sep, "/"),
    });
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

async function directoryHash(root) {
  const hash = createHash("sha256");
  for (const file of await directoryFiles(root)) {
    hash.update(file.relative);
    hash.update("\0");
    hash.update(await readFile(file.path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function ageDays(value, now) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (now.getTime() - time) / 86_400_000);
}

function itemDate(metadata, status, stats) {
  return metadata.created_at
    ?? metadata.archived_at
    ?? metadata.imported_at
    ?? metadata.saved_at
    ?? status.updated_at
    ?? status.rejected_at
    ?? stats.birthtime.toISOString();
}

function statusRecord(status, reason, riskLevel = "low", retention = "normal") {
  return { status, reason, risk_level: riskLevel, retention };
}

function protectedSourcePath(sourcePath) {
  const normalized = normalizeProjectPath(sourcePath);
  return [...protectedExactPaths].some(
    (protectedPath) => normalized === protectedPath || normalized.startsWith(`${protectedPath}/`),
  );
}

async function referenceState(roots) {
  const rollbackIndex = await readJson(roots.rollbackIndex, { activations: [] });
  const snapshotIds = new Set(
    (rollbackIndex.activations ?? []).map((entry) => entry.snapshot_id).filter(Boolean),
  );
  const draftIds = new Set();
  const proofIds = new Set();
  const contextBundleIds = new Set();
  const settlementContextIds = new Set();
  const settlementReportIds = new Set();
  const pendingCandidateIds = new Set();

  for (const directory of await directoryEntries(roots.adoptedChapters)) {
    const metadata = await readJson(path.join(directory, "metadata.json"), {});
    const status = await readJson(path.join(directory, "status.json"), {});
    if (metadata.draft_id) draftIds.add(metadata.draft_id);
    if (metadata.proof_id) proofIds.add(metadata.proof_id);
    if (metadata.proof_report_id) proofIds.add(metadata.proof_report_id);
    if (metadata.context_bundle_id) contextBundleIds.add(metadata.context_bundle_id);
    if (status.settlement_context_id) settlementContextIds.add(status.settlement_context_id);
    if (status.settlement_report_id) settlementReportIds.add(status.settlement_report_id);
    if (status.pending_candidate_id) pendingCandidateIds.add(status.pending_candidate_id);
  }
  for (const directory of await directoryEntries(roots.settlementReports)) {
    const metadata = await readJson(path.join(directory, "metadata.json"), {});
    const status = await readJson(path.join(directory, "status.json"), {});
    if (metadata.settlement_context_id) settlementContextIds.add(metadata.settlement_context_id);
    if (status.pending_candidate_id) pendingCandidateIds.add(status.pending_candidate_id);
  }
  for (const directory of await directoryEntries(roots.approvalItems)) {
    const item = await readJson(path.join(directory, "item.json"), {});
    const status = await readJson(path.join(directory, "status.json"), {});
    if (!["rejected", "resolved"].includes(status.status) && item.target_id) {
      if (item.target_type === "pending_engine_candidate") pendingCandidateIds.add(item.target_id);
      if (item.target_type === "candidate_draft") draftIds.add(item.target_id);
      if (item.target_type === "engine_snapshot") snapshotIds.add(item.target_id);
    }
  }
  return {
    snapshotIds,
    draftIds,
    proofIds,
    contextBundleIds,
    settlementContextIds,
    settlementReportIds,
    pendingCandidateIds,
  };
}

async function buildItem(itemType, sourcePath, classification, referencedBy = []) {
  if (protectedSourcePath(sourcePath)) {
    throw errorWithStatus(`Protected path cannot be proposed: ${normalizeProjectPath(sourcePath)}`);
  }
  const stats = await stat(sourcePath);
  return {
    item_id: path.basename(sourcePath),
    item_type: itemType,
    source_path: normalizeProjectPath(sourcePath),
    status: classification.status,
    reason: classification.reason,
    risk_level: classification.risk_level,
    retention: classification.retention,
    hash: await directoryHash(sourcePath),
    created_at: stats.birthtime.toISOString(),
    modified_at: stats.mtime.toISOString(),
    referenced_by: referencedBy,
  };
}

async function classifyDirectory(itemType, sourcePath, context) {
  const metadata = await readJson(path.join(sourcePath, "metadata.json"), {});
  const status = await readJson(path.join(sourcePath, "status.json"), {});
  const stats = await stat(sourcePath);
  const currentStatus = status.status ?? metadata.status ?? metadata.canon_status ?? "";
  const riskLevel = metadata.risk_level ?? status.risk_level ?? "low";
  const retention = metadata.retention
    ?? (metadata.pinned === true ? "pinned" : "normal");
  const createdAt = itemDate(metadata, status, stats);
  const age = ageDays(createdAt, context.now);
  const id = path.basename(sourcePath);
  const references = [];

  if (itemType === "archive") {
    if (retention === "high_risk" || riskLevel === "high" || riskLevel === "critical") {
      return [statusRecord("blocked_from_cleanup", "High-risk archives are protected.", riskLevel, "high_risk"), references];
    }
    if (retention === "pinned" || metadata.pinned === true) {
      return [statusRecord("must_keep", "Pinned archives are protected.", riskLevel, "pinned"), references];
    }
    if (context.latestArchives.has(id)) {
      return [statusRecord("must_keep", "Archive is within the latest retention window.", riskLevel, retention), references];
    }
    return [statusRecord("eligible_for_cleanup", "Superseded archive exceeds latest retention window.", riskLevel, retention), references];
  }
  if (itemType === "snapshot") {
    if (context.references.snapshotIds.has(id)) {
      references.push("rollback_index_or_approval");
      return [statusRecord("must_keep", "Snapshot is required for rollback.", riskLevel, "rollback_required"), references];
    }
    if (context.latestSnapshots.has(id)) {
      return [statusRecord("must_keep", "Snapshot is within the latest retention window.", riskLevel, retention), references];
    }
    if (metadata.rollback_available === true) {
      return [statusRecord("needs_review", "Old snapshot still advertises rollback availability.", "medium", "rollback_required"), references];
    }
    return [statusRecord("eligible_for_cleanup", "Old snapshot is not rollback-available.", riskLevel, retention), references];
  }
  if (itemType === "pending_candidate" || itemType === "rejected_candidate") {
    if (context.references.pendingCandidateIds.has(id)) {
      references.push("active_workflow_or_approval");
      return [statusRecord("must_keep", "Candidate is referenced by an active workflow.", riskLevel, retention), references];
    }
    if (riskLevel === "high" || riskLevel === "critical") {
      return [statusRecord("needs_review", "Candidate has high-risk history.", riskLevel, retention), references];
    }
    const threshold = currentStatus === "failed"
      ? context.policy.failed_candidate_days
      : currentStatus === "blocked"
        ? context.policy.blocked_candidate_days
        : context.policy.rejected_candidate_days;
    if (["rejected", "failed", "blocked"].includes(currentStatus) && age >= threshold) {
      return [statusRecord("eligible_for_cleanup", `${currentStatus} candidate exceeds ${threshold}-day retention.`, riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Candidate is current or within retention.", riskLevel, retention), references];
  }
  if (itemType === "candidate_draft") {
    if (context.references.draftIds.has(id) || currentStatus === "accepted_pending_settlement") {
      references.push("adopted_chapter_or_approval");
      return [statusRecord("must_keep", "Draft is referenced by an adopted chapter or approval.", riskLevel, retention), references];
    }
    if (["rejected", "archived", "blocked"].includes(currentStatus)
      && age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Inactive draft exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Draft is current or within retention.", riskLevel, retention), references];
  }
  if (itemType === "proof_report") {
    if (context.references.proofIds.has(id)) {
      references.push("adopted_chapter");
      return [statusRecord("needs_review", "Proof report is linked to an adopted chapter.", "medium", retention), references];
    }
    if (age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Unreferenced proof report exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Proof report is within retention.", riskLevel, retention), references];
  }
  if (itemType === "context_bundle") {
    if (context.references.contextBundleIds.has(id)) {
      references.push("adopted_chapter");
      return [statusRecord("must_keep", "Context bundle is referenced by an adopted chapter.", riskLevel, retention), references];
    }
    if (age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Unreferenced context bundle exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Context bundle is within retention.", riskLevel, retention), references];
  }
  if (itemType === "settlement_context") {
    if (context.references.settlementContextIds.has(id)) {
      references.push("settlement_report_or_adopted_chapter");
      return [statusRecord("must_keep", "Settlement context is referenced.", riskLevel, retention), references];
    }
    if (age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Unreferenced settlement context exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Settlement context is within retention.", riskLevel, retention), references];
  }
  if (itemType === "settlement_report") {
    if (context.references.settlementReportIds.has(id) || status.pending_candidate_id) {
      references.push("pending_candidate_or_adopted_chapter");
      return [statusRecord("needs_review", "Settlement report is linked to a pending candidate.", "medium", retention), references];
    }
    if (age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Unreferenced settlement report exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Settlement report is within retention.", riskLevel, retention), references];
  }
  if (itemType === "approval_item") {
    if (currentStatus === "deferred" && age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Deferred approval exceeds retention.", riskLevel, retention), references];
    }
    if (["rejected", "resolved"].includes(currentStatus)
      && age >= context.policy.rejected_candidate_days) {
      return [statusRecord("eligible_for_cleanup", "Closed approval exceeds retention.", riskLevel, retention), references];
    }
    return [statusRecord("must_keep", "Approval item is active or within retention.", riskLevel, retention), references];
  }
  return [statusRecord("blocked_from_cleanup", "Unknown cleanup item type.", "critical", retention), references];
}

function normalizePolicy(input = {}) {
  const policy = { ...defaultCleanupRetentionPolicy };
  for (const [key, fallback] of Object.entries(policy)) {
    const value = input[key] ?? fallback;
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      throw errorWithStatus(`${key} must be an integer from 0 to 10000.`);
    }
    policy[key] = value;
  }
  return policy;
}

function statusForProposal(status = "draft", reason = null) {
  if (!proposalStatuses.has(status)) throw errorWithStatus("Invalid cleanup proposal status.");
  return {
    status,
    approved_at: null,
    rejected_at: null,
    deferred_at: null,
    executed_at: null,
    reason,
    can_execute: status === "approved",
  };
}

export function isSafeCleanupProposalId(id) {
  return typeof id === "string" && cleanupProposalIdPattern.test(id);
}

export function isSafeCleanupTrashId(id) {
  return typeof id === "string" && cleanupTrashIdPattern.test(id);
}

export function assertCleanupProposalId(id) {
  if (!isSafeCleanupProposalId(id)) throw errorWithStatus("Invalid cleanup_proposal_id.");
  return id;
}

export function assertCleanupTrashId(id) {
  if (!isSafeCleanupTrashId(id)) throw errorWithStatus("Invalid cleanup_trash_id.");
  return id;
}

export async function ensureCleanupDirectories(options = {}) {
  const roots = cleanupRoots(options);
  await Promise.all([
    mkdir(roots.cleanupProposals, { recursive: true }),
    mkdir(roots.cleanupLogs, { recursive: true }),
    mkdir(roots.cleanupTrash, { recursive: true }),
    mkdir(roots.cleanupStaging, { recursive: true }),
    mkdir(roots.cleanupTombstones, { recursive: true }),
  ]);
  return roots;
}

export async function appendCleanupLog(event, details = {}, options = {}) {
  const roots = await ensureCleanupDirectories(options);
  const record = {
    event,
    cleanup_proposal_id: details.cleanupProposalId ?? details.cleanup_proposal_id ?? null,
    cleanup_trash_id: details.cleanupTrashId ?? details.cleanup_trash_id ?? null,
    created_at: new Date().toISOString(),
    actor: optionalText(details.actor ?? details.approvedBy ?? "local_user", 200) || "local_user",
    result: details.result ?? "success",
    error_message: details.errorMessage ?? details.error_message ?? null,
  };
  await commitFileTransaction("append-cleanup-log", [
    { type: "append", filePath: roots.cleanupLog, content: `${JSON.stringify(record)}\n` },
  ], { phase: "phase_5b_cleanup", event, ...fixtureTransactionMetadata(options) });
  return record;
}

export async function listCleanupLogs(options = {}) {
  const roots = await ensureCleanupDirectories(options);
  if (!await exists(roots.cleanupLog)) return [];
  return (await readFile(roots.cleanupLog, "utf8"))
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function scanCleanupCandidates(input = {}, options = {}) {
  await ensureCleanupDirectories(options);
  const roots = sourceRoots(options);
  const policy = normalizePolicy(input.retentionPolicy ?? input.retention_policy);
  const now = options.now instanceof Date ? options.now : new Date();
  const references = await referenceState(roots);
  const archiveDirectories = await directoryEntries(roots.engineArchive);
  const snapshotDirectories = await directoryEntries(roots.engineSnapshots);
  const latest = (directories, count) => new Set(
    directories
      .sort((left, right) => path.basename(right).localeCompare(path.basename(left)))
      .slice(0, count)
      .map((entry) => path.basename(entry)),
  );
  const context = {
    now,
    policy,
    references,
    latestArchives: latest(archiveDirectories, policy.keep_latest_archives),
    latestSnapshots: latest(snapshotDirectories, policy.keep_latest_snapshots),
  };
  const specs = [
    ["archive", roots.engineArchive],
    ["rejected_candidate", roots.rejectedEngineCandidates],
    ["pending_candidate", roots.pendingEngineCandidates],
    ["snapshot", roots.engineSnapshots],
    ["candidate_draft", roots.candidateDrafts],
    ["proof_report", roots.proofReports],
    ["context_bundle", roots.contextBundles],
    ["settlement_context", roots.settlementContexts],
    ["settlement_report", roots.settlementReports],
    ["approval_item", roots.approvalItems],
  ];
  const items = [];
  for (const [itemType, root] of specs) {
    const directories = itemType === "archive"
      ? archiveDirectories
      : itemType === "snapshot"
        ? snapshotDirectories
        : await directoryEntries(root);
    for (const directory of directories) {
      try {
        const [classification, referencedBy] =
          await classifyDirectory(itemType, directory, context);
        items.push(await buildItem(itemType, directory, classification, referencedBy));
      } catch (error) {
        const stats = await stat(directory);
        items.push({
          item_id: path.basename(directory),
          item_type: itemType,
          source_path: normalizeProjectPath(directory),
          status: "blocked_from_cleanup",
          reason: error.message,
          risk_level: "critical",
          retention: "pinned",
          hash: "",
          created_at: stats.birthtime.toISOString(),
          modified_at: stats.mtime.toISOString(),
          referenced_by: [],
        });
      }
    }
  }
  const isolatedLegacySourceKeys = [
    "engineArchive",
    "rejectedEngineCandidates",
    "pendingEngineCandidates",
    "engineSnapshots",
    "rollbackIndex",
    "candidateDrafts",
    "proofReports",
    "adoptedChapters",
    "contextBundles",
    "settlementContexts",
    "settlementReports",
    "approvalItems",
  ];
  const hasLegacyIsolatedSources = isolatedLegacySourceKeys.some((key) => options[key]);
  const includeExternalBrainSessions = input.includeExternalBrainSessions
    ?? input.include_external_brain_sessions
    ?? (options.fixtureRoot ? true : !hasLegacyIsolatedSources);
  if (includeExternalBrainSessions) {
    const externalOptions = {
      ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
      ...(options.now instanceof Date ? { now: options.now } : {}),
      ...(options.externalBrainSessionOptions ?? {}),
    };
    const externalScan = await scanExternalBrainSessions({ retentionPolicy: policy }, externalOptions);
    items.push(...externalScan.sessions);
  }
  const groups = {
    eligible_items: items.filter((item) => item.status === "eligible_for_cleanup"),
    must_keep_items: items.filter((item) => item.status === "must_keep"),
    needs_review_items: items.filter((item) => item.status === "needs_review"),
    blocked_items: items.filter((item) => item.status === "blocked_from_cleanup"),
  };
  const report = {
    scanned_at: now.toISOString(),
    retention_policy: policy,
    ...groups,
    risk_summary: {
      high_risk_count: items.filter((item) => ["high", "critical"].includes(item.risk_level)).length,
      pinned_count: items.filter((item) => item.retention === "pinned").length,
      rollback_required_count:
        items.filter((item) => item.retention === "rollback_required").length,
      eligible_count: groups.eligible_items.length,
    },
  };
  await appendCleanupLog("cleanup_scan", { actor: input.actor }, options);
  return report;
}

export async function createCleanupProposal(input = {}, options = {}) {
  const roots = await ensureCleanupDirectories(options);
  const scan = await scanCleanupCandidates(input, options);
  const cleanupProposalId = createId("cleanup_proposal");
  const now = new Date().toISOString();
  const proposal = {
    cleanup_proposal_id: cleanupProposalId,
    created_at: now,
    created_by: optionalText(input.createdBy ?? input.created_by ?? "local_ui", 200) || "local_ui",
    title: optionalText(input.title, 500) || "Archive cleanup proposal",
    summary: optionalText(input.summary, 5_000)
      || "Review eligible rejected, failed, superseded, and expired workflow items.",
    retention_policy: scan.retention_policy,
    eligible_items: scan.eligible_items,
    must_keep_items: scan.must_keep_items,
    needs_review_items: scan.needs_review_items,
    blocked_items: scan.blocked_items,
    risk_summary: scan.risk_summary,
  };
  const status = statusForProposal("draft");
  const paths = proposalPaths(cleanupProposalId, roots);
  const log = {
    event: "cleanup_proposal_created",
    cleanup_proposal_id: cleanupProposalId,
    cleanup_trash_id: null,
    created_at: now,
    actor: proposal.created_by,
    result: "success",
    error_message: null,
  };
  await commitFileTransaction("create-cleanup-proposal", [
    { filePath: paths.proposal, content: json(proposal) },
    { filePath: paths.status, content: json(status) },
    { filePath: paths.scanReport, content: json(scan) },
    { type: "append", filePath: roots.cleanupLog, content: `${JSON.stringify(log)}\n` },
  ], { cleanup_proposal_id: cleanupProposalId, phase: "phase_5b_cleanup", ...fixtureTransactionMetadata(options) });
  return getCleanupProposal(cleanupProposalId, options);
}

export async function listCleanupProposals(options = {}) {
  const roots = await ensureCleanupDirectories(options);
  const proposals = [];
  for (const directory of await directoryEntries(roots.cleanupProposals)) {
    const id = path.basename(directory);
    if (!isSafeCleanupProposalId(id)) continue;
    try {
      proposals.push(await getCleanupProposal(id, options));
    } catch {
      // Ignore incomplete proposals.
    }
  }
  return proposals.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getCleanupProposal(cleanupProposalId, options = {}) {
  assertCleanupProposalId(cleanupProposalId);
  const roots = cleanupRoots(options);
  const paths = proposalPaths(cleanupProposalId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Cleanup proposal not found.", 404);
  const [proposal, status, scanReport] = await Promise.all([
    readJson(paths.proposal),
    readJson(paths.status),
    readJson(paths.scanReport),
  ]);
  return { ...proposal, status, scan_report: scanReport };
}

function allowedRootForItem(itemType, roots, options = {}) {
  if (itemType === "external_brain_session") {
    return externalBrainSessionRoots(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}).agentRuns;
  }
  const rootsByType = {
    archive: roots.engineArchive,
    rejected_candidate: roots.rejectedEngineCandidates,
    pending_candidate: roots.pendingEngineCandidates,
    snapshot: roots.engineSnapshots,
    candidate_draft: roots.candidateDrafts,
    proof_report: roots.proofReports,
    context_bundle: roots.contextBundles,
    settlement_context: roots.settlementContexts,
    settlement_report: roots.settlementReports,
    approval_item: roots.approvalItems,
  };
  const allowedRoot = rootsByType[itemType];
  if (!allowedRoot) throw errorWithStatus(`Unsupported cleanup item type: ${itemType}`, 409);
  return allowedRoot;
}

async function verifyEligibleItems(proposal, options = {}) {
  if (!proposal.eligible_items.length) {
    throw errorWithStatus("Cleanup proposal has no eligible items.", 409);
  }
  const roots = sourceRoots(options);
  const currentScan = await scanCleanupCandidates({
    retentionPolicy: proposal.retention_policy,
    actor: "cleanup_verifier",
  }, options);
  const currentEligible = new Map(
    currentScan.eligible_items.map((item) => [item.source_path, item]),
  );
  for (const item of proposal.eligible_items) {
    if (item.status !== "eligible_for_cleanup") {
      throw errorWithStatus(`Non-eligible item found in execution list: ${item.item_id}`, 409);
    }
    const sourcePath = assertPathInside(
      item.source_path,
      allowedRootForItem(item.item_type, roots, options),
      "cleanup source",
    );
    if (protectedSourcePath(sourcePath)) {
      throw errorWithStatus(`Protected item cannot be cleaned: ${item.source_path}`, 409);
    }
    if (!await exists(sourcePath)) {
      throw errorWithStatus(`Cleanup source no longer exists: ${item.source_path}`, 409);
    }
    const currentItem = currentEligible.get(item.source_path);
    if (!currentItem) {
      throw errorWithStatus(`Cleanup source is no longer eligible: ${item.source_path}`, 409);
    }
    if (item.item_type === "external_brain_session") {
      const currentPaths = JSON.stringify([...(currentItem.cleanup_paths ?? [])].sort());
      const proposalPaths = JSON.stringify([...(item.cleanup_paths ?? [])].sort());
      if (currentItem.hash !== item.hash || currentPaths !== proposalPaths) {
        throw errorWithStatus(`External brain session lineage changed after scan: ${item.session_id}`, 409);
      }
      await validateExternalBrainSessionCleanupPaths(item.cleanup_paths, options.fixtureRoot
        ? { fixtureRoot: options.fixtureRoot }
        : {});
      continue;
    }
    if (currentItem.hash !== item.hash || await directoryHash(sourcePath) !== item.hash) {
      throw errorWithStatus(`Cleanup source changed after scan: ${item.source_path}`, 409);
    }
  }
}

async function updateProposalDecision(cleanupProposalId, decision, reason, options = {}) {
  const proposal = await getCleanupProposal(cleanupProposalId, options);
  if (["executed", "approved"].includes(proposal.status.status)) {
    throw errorWithStatus(`Cleanup proposal is already ${proposal.status.status}.`, 409);
  }
  const now = new Date().toISOString();
  const status = {
    ...proposal.status,
    status: decision,
    rejected_at: decision === "rejected" ? now : proposal.status.rejected_at,
    deferred_at: decision === "deferred" ? now : proposal.status.deferred_at,
    reason: optionalText(reason) || null,
    can_execute: false,
  };
  const roots = cleanupRoots(options);
  const paths = proposalPaths(cleanupProposalId, roots);
  const event = decision === "rejected"
    ? "cleanup_proposal_rejected"
    : "cleanup_proposal_deferred";
  await commitFileTransaction(`cleanup-proposal-${decision}`, [
    { filePath: paths.status, content: json(status) },
    {
      type: "append",
      filePath: roots.cleanupLog,
      content: `${JSON.stringify({
        event,
        cleanup_proposal_id: cleanupProposalId,
        cleanup_trash_id: null,
        created_at: now,
        actor: "local_user",
        result: "success",
        error_message: null,
      })}\n`,
    },
  ], { cleanup_proposal_id: cleanupProposalId, phase: "phase_5b_cleanup", ...fixtureTransactionMetadata(options) });
  return getCleanupProposal(cleanupProposalId, options);
}

export async function approveCleanupProposal(
  cleanupProposalId,
  { confirm = false, approvedBy = "local_user" } = {},
  options = {},
) {
  assertCleanupProposalId(cleanupProposalId);
  const proposal = await getCleanupProposal(cleanupProposalId, options);
  try {
    if (confirm !== true) throw errorWithStatus("Cleanup approval requires confirmation.", 409);
    if (proposal.status.status === "blocked") {
      throw errorWithStatus("Blocked cleanup proposal cannot be approved.", 409);
    }
    if (!["draft", "deferred"].includes(proposal.status.status)) {
      throw errorWithStatus(`Cleanup proposal cannot be approved: ${proposal.status.status}`, 409);
    }
    await verifyEligibleItems(proposal, options);
    const now = new Date().toISOString();
    const status = {
      ...proposal.status,
      status: "approved",
      approved_at: now,
      reason: null,
      can_execute: true,
    };
    const roots = cleanupRoots(options);
    const paths = proposalPaths(cleanupProposalId, roots);
    await commitFileTransaction("approve-cleanup-proposal", [
      { filePath: paths.status, content: json(status) },
      {
        type: "append",
        filePath: roots.cleanupLog,
        content: `${JSON.stringify({
          event: "cleanup_proposal_approved",
          cleanup_proposal_id: cleanupProposalId,
          cleanup_trash_id: null,
          created_at: now,
          actor: optionalText(approvedBy, 200) || "local_user",
          result: "success",
          error_message: null,
        })}\n`,
      },
    ], { cleanup_proposal_id: cleanupProposalId, phase: "phase_5b_cleanup", ...fixtureTransactionMetadata(options) });
    return getCleanupProposal(cleanupProposalId, options);
  } catch (error) {
    await appendCleanupLog("cleanup_failed", {
      cleanupProposalId,
      approvedBy,
      result: "failed",
      errorMessage: error.message,
    }, options);
    throw error;
  }
}

export async function rejectCleanupProposal(
  cleanupProposalId,
  { reason = "" } = {},
  options = {},
) {
  assertCleanupProposalId(cleanupProposalId);
  return updateProposalDecision(cleanupProposalId, "rejected", reason, options);
}

export async function deferCleanupProposal(
  cleanupProposalId,
  { reason = "" } = {},
  options = {},
) {
  assertCleanupProposalId(cleanupProposalId);
  return updateProposalDecision(cleanupProposalId, "deferred", reason, options);
}

export async function executeCleanupProposal(
  cleanupProposalId,
  { confirm = false, approvedBy = "local_user" } = {},
  options = {},
) {
  assertCleanupProposalId(cleanupProposalId);
  const proposal = await getCleanupProposal(cleanupProposalId, options);
  const stagedSessionMoves = [];
  let transactionCommitted = false;
  try {
    if (confirm !== true) throw errorWithStatus("Cleanup execution requires confirmation.", 409);
    if (proposal.status.status !== "approved" || proposal.status.can_execute !== true) {
      throw errorWithStatus("Only approved cleanup proposals can execute.", 409);
    }
    await verifyEligibleItems(proposal, options);
    const roots = cleanupRoots(options);
    const paths = proposalPaths(cleanupProposalId, roots);
    const now = new Date();
    const operations = [];
    const moved = [];
    const logRecords = [];
    for (const item of proposal.eligible_items) {
      const cleanupTrashId = createId("cleanup_trash");
      const sourcePath = assertPathInside(
        item.source_path,
        allowedRootForItem(item.item_type, sourceRoots(options), options),
        "cleanup source",
      );
      const trashDirectory = path.join(roots.cleanupTrash, cleanupTrashId);
      const movedAt = now.toISOString();
      const permanentDeleteAt = new Date(
        now.getTime() + proposal.retention_policy.trash_retention_days * 86_400_000,
      ).toISOString();
      if (item.item_type === "external_brain_session") {
        const validated = await validateExternalBrainSessionCleanupPaths(
          item.cleanup_paths,
          options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {},
        );
        for (const cleanupPath of validated) {
          const destination = path.join(
            trashDirectory,
            "content",
            ...cleanupPath.project_path.split("/"),
          );
          await mkdir(path.dirname(destination), { recursive: true });
          await rename(cleanupPath.path, destination);
          stagedSessionMoves.push({
            original: cleanupPath.path,
            destination,
            trashDirectory,
          });
        }
        const deletedFileCount = validated.reduce((sum, entry) => sum + entry.files, 0);
        const deletedLogicalBytes = validated.reduce((sum, entry) => sum + entry.bytes, 0);
        const metadata = {
          cleanup_trash_id: cleanupTrashId,
          original_path: item.source_path,
          source_proposal_id: cleanupProposalId,
          item_type: item.item_type,
          item_id: item.item_id,
          session_id: item.session_id,
          hash: item.hash,
          moved_at: movedAt,
          restore_available: true,
          permanent_delete_allowed_after: permanentDeleteAt,
        };
        const trashPath = normalizeProjectPath(trashDirectory);
        const tombstone = {
          cleanup_trash_id: cleanupTrashId,
          source_proposal_id: cleanupProposalId,
          session_id: item.session_id,
          classification_at_cleanup: item.classification,
          lineage_ids: {
            agent_run_ids: item.agent_run_ids,
            writing_context_bundle_ids: item.writing_context_bundle_ids,
            neural_trace_ids: item.neural_trace_ids,
            raw_story_handoff_ids: item.raw_story_handoff_ids,
          },
          deleted_paths: validated.map((entry) => entry.project_path),
          deleted_file_count: deletedFileCount,
          deleted_logical_bytes: deletedLogicalBytes,
          reference_scan_summary: {
            explicit_reference_count: item.explicit_reference_count,
            inferred_reference_count: item.inferred_reference_count,
            referenced_by: item.referenced_by,
          },
          executed_at: movedAt,
          approved_by: optionalText(approvedBy, 200) || "local_user",
          trash_path: trashPath,
          restore_available: true,
          permanent_delete_allowed_after: permanentDeleteAt,
        };
        operations.push(
          { filePath: path.join(trashDirectory, "trash_metadata.json"), content: json(metadata) },
          {
            filePath: path.join(roots.cleanupTombstones, `${cleanupTrashId}.json`),
            content: json(tombstone),
          },
        );
        logRecords.push({
          event: "external_brain_session_moved_to_trash",
          cleanup_proposal_id: cleanupProposalId,
          cleanup_trash_id: cleanupTrashId,
          created_at: movedAt,
          actor: optionalText(approvedBy, 200) || "local_user",
          result: "success",
          error_message: null,
        });
        moved.push({
          ...metadata,
          trash_path: trashPath,
          deleted_paths: tombstone.deleted_paths,
          deleted_file_count: deletedFileCount,
          deleted_logical_bytes: deletedLogicalBytes,
        });
        continue;
      }
      const files = await directoryFiles(sourcePath);
      for (const file of files) {
        operations.push({
          filePath: path.join(trashDirectory, "content", ...file.relative.split("/")),
          content: await readFile(file.path),
        });
      }
      const metadata = {
        cleanup_trash_id: cleanupTrashId,
        original_path: item.source_path,
        source_proposal_id: cleanupProposalId,
        item_type: item.item_type,
        item_id: item.item_id,
        hash: item.hash,
        moved_at: movedAt,
        restore_available: true,
        permanent_delete_allowed_after: permanentDeleteAt,
      };
      const trashPath = normalizeProjectPath(trashDirectory);
      const tombstone = {
        cleanup_trash_id: cleanupTrashId,
        original_path: item.source_path,
        trash_path: trashPath,
        moved_at: movedAt,
        source_proposal_id: cleanupProposalId,
        hash: item.hash,
        restore_available: true,
        permanent_delete_allowed_after: permanentDeleteAt,
      };
      operations.push(
        { filePath: path.join(trashDirectory, "trash_metadata.json"), content: json(metadata) },
        {
          filePath: path.join(roots.cleanupTombstones, `${cleanupTrashId}.json`),
          content: json(tombstone),
        },
        ...files.map((file) => ({ type: "delete", filePath: file.path })),
      );
      logRecords.push({
        event: "cleanup_item_moved_to_trash",
        cleanup_proposal_id: cleanupProposalId,
        cleanup_trash_id: cleanupTrashId,
        created_at: movedAt,
        actor: optionalText(approvedBy, 200) || "local_user",
        result: "success",
        error_message: null,
      });
      moved.push({ ...metadata, trash_path: trashPath });
    }
    const executedAt = now.toISOString();
    const status = {
      ...proposal.status,
      status: "executed",
      executed_at: executedAt,
      reason: null,
      can_execute: false,
    };
    logRecords.push({
      event: "cleanup_proposal_executed",
      cleanup_proposal_id: cleanupProposalId,
      cleanup_trash_id: null,
      created_at: executedAt,
      actor: optionalText(approvedBy, 200) || "local_user",
      result: "success",
      error_message: null,
    });
    operations.push(
      { filePath: paths.status, content: json(status) },
      {
        type: "append",
        filePath: roots.cleanupLog,
        content: `${logRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
      },
    );
    const transaction = await commitFileTransaction(
      "execute-cleanup-proposal",
      operations,
      {
        cleanup_proposal_id: cleanupProposalId,
        phase: "phase_5b_cleanup",
        test_fail_after_commits: options.testFailAfterCommits,
        ...fixtureTransactionMetadata(options),
      },
    );
    transactionCommitted = true;
    for (const item of proposal.eligible_items) {
      if (item.item_type === "external_brain_session") continue;
      await rm(assertPathInside(
        item.source_path,
        allowedRootForItem(item.item_type, sourceRoots(options), options),
        "cleanup source",
      ), {
        recursive: true,
        force: true,
      });
    }
    return {
      cleanup_proposal: await getCleanupProposal(cleanupProposalId, options),
      moved_items: moved,
      transaction_id: transaction.transaction_id,
    };
  } catch (error) {
    if (!transactionCommitted) {
      for (const move of [...stagedSessionMoves].reverse()) {
        try {
          if (await exists(move.destination) && !await exists(move.original)) {
            await mkdir(path.dirname(move.original), { recursive: true });
            await rename(move.destination, move.original);
          }
        } catch {
          // Preserve the original execution failure; live data restoration is best effort.
        }
      }
      for (const trashDirectory of new Set(stagedSessionMoves.map((move) => move.trashDirectory))) {
        try {
          await rm(trashDirectory, { recursive: true, force: true });
        } catch {
          // Preserve the original execution failure.
        }
      }
    }
    await appendCleanupLog("cleanup_failed", {
      cleanupProposalId,
      approvedBy,
      result: "failed",
      errorMessage: error.message,
    }, options);
    throw error;
  }
}
