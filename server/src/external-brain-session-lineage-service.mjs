import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { defaultCleanupRetentionPolicy } from "./cleanup-retention-policy.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

export const externalBrainSessionClassifications = Object.freeze({
  ACTIVE_SESSION: "ACTIVE_SESSION",
  GOVERNANCE_PINNED_SESSION: "GOVERNANCE_PINNED_SESSION",
  ACCEPTANCE_EVIDENCE_PINNED_SESSION: "ACCEPTANCE_EVIDENCE_PINNED_SESSION",
  COMPLETED_UNADOPTED_SESSION: "COMPLETED_UNADOPTED_SESSION",
  FAILED_OR_BLOCKED_SESSION: "FAILED_OR_BLOCKED_SESSION",
  TEST_SESSION: "TEST_SESSION",
  INCOMPLETE_SESSION: "INCOMPLETE_SESSION",
  UNKNOWN_SESSION: "UNKNOWN_SESSION",
});

export const sessionLineageEdgeKinds = Object.freeze({
  EXPLICIT_ID: "EXPLICIT_ID",
  EXPLICIT_METADATA: "EXPLICIT_METADATA",
  HASH_MATCH: "HASH_MATCH",
  PATH_REFERENCE: "PATH_REFERENCE",
  INFERRED_TIME_CORRELATION: "INFERRED_TIME_CORRELATION",
});

const runIdPattern = /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const bundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const traceIdPattern = /^neural_trace_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const handoffIdPattern = /^raw_story_handoff_\d{8}-\d{6}-[a-f0-9]{12}$/u;
const candidateIdPattern = /^(?:writing_candidate|candidate_draft)_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const proofIdPattern = /^(?:proof_report|proofing_context)_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const approvalIdPattern = /^approval_item_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const settlementIdPattern = /^(?:settlement_context|settlement_report)_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const adoptionIdPattern = /^(?:adopted_chapter|adopted_writing)_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const idPatterns = [
  runIdPattern,
  bundleIdPattern,
  traceIdPattern,
  handoffIdPattern,
  candidateIdPattern,
  proofIdPattern,
  approvalIdPattern,
  settlementIdPattern,
  adoptionIdPattern,
];
const closedStatuses = new Set([
  "archived",
  "closed",
  "executed",
  "rejected",
  "resolved",
]);
const explicitKinds = new Set([
  sessionLineageEdgeKinds.EXPLICIT_ID,
  sessionLineageEdgeKinds.EXPLICIT_METADATA,
  sessionLineageEdgeKinds.HASH_MATCH,
  sessionLineageEdgeKinds.PATH_REFERENCE,
]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function fixtureDataPaths(fixtureRoot) {
  const data = path.join(fixtureRoot, "data");
  return {
    fixtureRoot,
    agentRuns: path.join(data, "agent_runs"),
    neuralTraces: path.join(data, "agent_runs", "neural_traces"),
    neuralOutputs: path.join(data, "agent_runs", "neural_outputs"),
    gptWritingContexts: path.join(data, "outputs", "gpt_writing_contexts"),
    writingCandidates: path.join(data, "outputs", "writing_candidates"),
    outputProofReports: path.join(data, "outputs", "proof_reports"),
    adoptedWritings: path.join(data, "outputs", "adopted_writings"),
    outputSettlementContexts: path.join(data, "outputs", "settlement_contexts"),
    outputSettlementReports: path.join(data, "outputs", "settlement_reports"),
    candidateDrafts: path.join(data, "writing_workflow", "candidate_drafts"),
    workflowProofReports: path.join(data, "writing_workflow", "proof_reports"),
    adoptedChapters: path.join(data, "writing_workflow", "adopted_chapters"),
    settlementContexts: path.join(data, "writing_workflow", "settlements", "contexts"),
    settlementReports: path.join(data, "writing_workflow", "settlements", "reports"),
    approvalItems: path.join(data, "approval_queue", "items"),
    pendingEngineCandidates: path.join(data, "canon_db", "pending_engine_candidates"),
    activationLogs: path.join(data, "canon_db", "activation_logs"),
    rollbackIndex: path.join(data, "canon_db", "rollback", "rollback_index.json"),
    evidenceRoot: path.join(fixtureRoot, "config"),
    auditRoot: path.join(data, "cleanup", "session_lifecycle_audits"),
  };
}

export function externalBrainSessionRoots(options = {}) {
  if (options.fixtureRoot) {
    const fixtureRoot = assertPathInside(
      options.fixtureRoot,
      path.join(projectRoot, "tests", ".tmp"),
      "external brain fixture root",
    );
    return fixtureDataPaths(fixtureRoot);
  }
  return {
    fixtureRoot: null,
    agentRuns: projectPaths.agentRuns,
    neuralTraces: projectPaths.neuralTraces,
    neuralOutputs: projectPaths.neuralModuleOutputs,
    gptWritingContexts: projectPaths.gptWritingContexts,
    writingCandidates: projectPaths.writingCandidates,
    outputProofReports: projectPaths.proofReports,
    adoptedWritings: projectPaths.adoptedWritings,
    outputSettlementContexts: projectPaths.adoptedWritingSettlementContexts,
    outputSettlementReports: projectPaths.adoptedWritingSettlementReports,
    candidateDrafts: projectPaths.candidateDrafts,
    workflowProofReports: projectPaths.workflowProofReports,
    adoptedChapters: projectPaths.adoptedChapters,
    settlementContexts: projectPaths.settlementContexts,
    settlementReports: projectPaths.settlementReports,
    approvalItems: projectPaths.approvalItems,
    pendingEngineCandidates: projectPaths.pendingEngineCandidates,
    activationLogs: projectPaths.activationLogs,
    rollbackIndex: projectPaths.rollbackIndex,
    evidenceRoot: path.join(projectRoot, "config"),
    auditRoot: path.join(projectPaths.cleanupRoot, "session_lifecycle_audits"),
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
    if (error.code === "ENOENT") return fallback;
    return fallback;
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

async function walkFiles(root, predicate = () => true) {
  const files = [];
  for (const entry of await directoryEntries(root)) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      files.push({ path: target, symbolic_link: true });
    } else if (entry.isDirectory()) {
      files.push(...await walkFiles(target, predicate));
    } else if (entry.isFile() && predicate(entry.name, target)) {
      files.push({ path: target, symbolic_link: false });
    }
  }
  return files;
}

function idsFromString(value) {
  const candidates = String(value ?? "").match(
    /(?:agent_run|gptctx|neural_trace|raw_story_handoff|writing_candidate|candidate_draft|proof_report|proofing_context|approval_item|settlement_context|settlement_report|adopted_chapter|adopted_writing)_\d{8}-\d{6}-[a-f0-9]{8,12}/gu,
  ) ?? [];
  return candidates.filter((candidate) => idPatterns.some((pattern) => pattern.test(candidate)));
}

function collectOccurrences(value, keyPath = [], output = []) {
  if (typeof value === "string") {
    const key = String(keyPath.at(-1) ?? "");
    const kind = /path|file|source/iu.test(key) || /[\\/]/u.test(value)
      ? sessionLineageEdgeKinds.PATH_REFERENCE
      : /_id$|^id$/iu.test(key)
        ? sessionLineageEdgeKinds.EXPLICIT_ID
        : sessionLineageEdgeKinds.EXPLICIT_METADATA;
    for (const id of idsFromString(value)) output.push({ id, kind, key_path: keyPath.join(".") });
    if (sha256Pattern.test(value)) output.push({ hash: value, kind: sessionLineageEdgeKinds.HASH_MATCH, key_path: keyPath.join(".") });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectOccurrences(item, [...keyPath, String(index)], output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectOccurrences(item, [...keyPath, key], output);
  }
  return output;
}

function recordStatus(...objects) {
  for (const object of objects) {
    if (!object || typeof object !== "object") continue;
    const value = object.status?.status ?? object.status ?? object.canon_status ?? object.lifecycle_status;
    if (typeof value === "string" && value) return value;
  }
  return "unknown";
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function edgeKey(edge) {
  return [edge.from, edge.to, edge.kind, edge.source_path].join("\0");
}

function addEdge(state, from, to, kind, sourcePath) {
  if (!from || !to || from === to) return;
  const edge = {
    from,
    to,
    kind,
    source_path: normalizeProjectPath(sourcePath),
  };
  const key = edgeKey(edge);
  if (state.edgeKeys.has(key)) return;
  state.edgeKeys.add(key);
  state.edges.push(edge);
  for (const [left, right] of [[from, to], [to, from]]) {
    if (!state.adjacency.has(left)) state.adjacency.set(left, new Set());
    state.adjacency.get(left).add(right);
  }
  if (runIdPattern.test(from) && bundleIdPattern.test(to) && kind !== sessionLineageEdgeKinds.INFERRED_TIME_CORRELATION) {
    if (!state.bundleOwners.has(to)) state.bundleOwners.set(to, new Set());
    state.bundleOwners.get(to).add(from);
  }
  if (runIdPattern.test(to) && bundleIdPattern.test(from) && kind !== sessionLineageEdgeKinds.INFERRED_TIME_CORRELATION) {
    if (!state.bundleOwners.has(from)) state.bundleOwners.set(from, new Set());
    state.bundleOwners.get(from).add(to);
  }
}

function addRecord(state, category, sourcePath, objects, { pin = false, acceptance = false } = {}) {
  const values = objects.filter(Boolean);
  const occurrences = values.flatMap((value) => collectOccurrences(value));
  const idOccurrences = uniqueBy(occurrences.filter((entry) => entry.id), (entry) => `${entry.id}\0${entry.kind}`);
  const ids = [...new Set(idOccurrences.map((entry) => entry.id))];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const leftOccurrence = idOccurrences.find((entry) => entry.id === ids[left]);
      const rightOccurrence = idOccurrences.find((entry) => entry.id === ids[right]);
      const kind = leftOccurrence.kind === sessionLineageEdgeKinds.PATH_REFERENCE
        || rightOccurrence.kind === sessionLineageEdgeKinds.PATH_REFERENCE
        ? sessionLineageEdgeKinds.PATH_REFERENCE
        : leftOccurrence.kind === sessionLineageEdgeKinds.EXPLICIT_ID
          || rightOccurrence.kind === sessionLineageEdgeKinds.EXPLICIT_ID
          ? sessionLineageEdgeKinds.EXPLICIT_ID
          : sessionLineageEdgeKinds.EXPLICIT_METADATA;
      addEdge(state, ids[left], ids[right], kind, sourcePath);
    }
  }
  const record = {
    category,
    source_path: normalizeProjectPath(sourcePath),
    status: recordStatus(...values),
    ids,
    hashes: [...new Set(occurrences.filter((entry) => entry.hash).map((entry) => entry.hash))],
    pin,
    acceptance,
  };
  state.records.push(record);
  return record;
}

async function loadStructuredDirectoryRecords(state, category, root, options = {}) {
  const directories = (await directoryEntries(root)).filter((entry) => entry.isDirectory());
  for (const entry of directories) {
    const directory = path.join(root, entry.name);
    const names = options.names ?? ["metadata.json", "status.json", "item.json"];
    const values = [];
    for (const name of names) {
      const value = await readJson(path.join(directory, name), null);
      if (value) values.push(value);
    }
    if (!values.length) continue;
    const status = recordStatus(...values);
    const pin = typeof options.pin === "function"
      ? options.pin(values, status)
      : options.pin === true;
    addRecord(state, category, directory, values, { pin });
  }
}

async function loadGovernanceRecords(state, roots) {
  const candidatePin = (_values, status) => !closedStatuses.has(status);
  const approvalPin = (_values, status) => !closedStatuses.has(status);
  await loadStructuredDirectoryRecords(state, "candidate", roots.writingCandidates, { pin: candidatePin });
  await loadStructuredDirectoryRecords(state, "candidate", roots.candidateDrafts, { pin: candidatePin });
  await loadStructuredDirectoryRecords(state, "proof", roots.outputProofReports);
  await loadStructuredDirectoryRecords(state, "proof", roots.workflowProofReports);
  await loadStructuredDirectoryRecords(state, "adoption", roots.adoptedWritings, { pin: true });
  await loadStructuredDirectoryRecords(state, "adoption", roots.adoptedChapters, { pin: true });
  await loadStructuredDirectoryRecords(state, "settlement", roots.outputSettlementContexts, { pin: true });
  await loadStructuredDirectoryRecords(state, "settlement", roots.outputSettlementReports, { pin: true });
  await loadStructuredDirectoryRecords(state, "settlement", roots.settlementContexts, { pin: true });
  await loadStructuredDirectoryRecords(state, "settlement", roots.settlementReports, { pin: true });
  await loadStructuredDirectoryRecords(state, "approval", roots.approvalItems, {
    names: ["item.json", "status.json", "request.json"],
    pin: approvalPin,
  });
  await loadStructuredDirectoryRecords(state, "canon", roots.pendingEngineCandidates, { pin: true });
  const rollback = await readJson(roots.rollbackIndex, null);
  if (rollback) addRecord(state, "canon", roots.rollbackIndex, [rollback], { pin: true });
  for (const file of await walkFiles(roots.activationLogs, (name) => name.endsWith(".json") || name.endsWith(".jsonl"))) {
    if (file.symbolic_link) continue;
    try {
      const text = await readFile(file.path, "utf8");
      const values = file.path.endsWith(".jsonl")
        ? text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line))
        : [JSON.parse(text)];
      addRecord(state, "canon", file.path, values, { pin: true });
    } catch {
      // Unreadable governance evidence is ignored as an edge and reported by absence.
    }
  }
}

async function loadAcceptanceEvidence(state, roots) {
  const files = await walkFiles(roots.evidenceRoot, (name) => (
    /^phase(?:44|45|46|47).*evidence.*\.json$/iu.test(name)
  ));
  for (const file of files) {
    if (file.symbolic_link) continue;
    const evidence = await readJson(file.path, null);
    if (!evidence) continue;
    const record = addRecord(state, "acceptance_evidence", file.path, [evidence], {
      acceptance: true,
    });
    for (const hash of record.hashes) {
      for (const trace of state.tracesByHash.get(hash) ?? []) {
        if (!record.ids.includes(trace.trace_id)) record.ids.push(trace.trace_id);
        addEdge(state, trace.run_id, trace.trace_id, sessionLineageEdgeKinds.HASH_MATCH, file.path);
      }
    }
  }
}

function connectedIds(state, rootId) {
  const visited = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    for (const next of state.adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

function idStamp(id) {
  return String(id).match(/_(\d{8}-\d{6})-/u)?.[1] ?? "";
}

function ageDays(value, now) {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (now.getTime() - parsed) / 86_400_000);
}

async function inventoryPath(target) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) throw new Error(`Symbolic links cannot be session cleanup paths: ${normalizeProjectPath(target)}`);
  if (info.isFile()) return { files: 1, bytes: info.size };
  if (!info.isDirectory()) throw new Error(`Unsupported session cleanup path: ${normalizeProjectPath(target)}`);
  let files = 0;
  let bytes = 0;
  for (const entry of await directoryEntries(target)) {
    const child = await inventoryPath(path.join(target, entry.name));
    files += child.files;
    bytes += child.bytes;
  }
  return { files, bytes };
}

function dedupeCleanupPaths(paths) {
  const sorted = [...new Set(paths.map((entry) => path.resolve(entry)))]
    .sort((left, right) => left.length - right.length || left.localeCompare(right));
  return sorted.filter((entry, index) => !sorted.slice(0, index).some((parent) => isInside(parent, entry)));
}

function allowedCleanupRoot(target, roots) {
  const allowed = [
    roots.agentRuns,
    roots.gptWritingContexts,
    roots.neuralTraces,
    roots.neuralOutputs,
  ];
  return allowed.find((root) => isInside(path.resolve(root), path.resolve(target))) ?? null;
}

export async function validateExternalBrainSessionCleanupPaths(cleanupPaths, options = {}) {
  const roots = externalBrainSessionRoots(options);
  const validated = [];
  for (const value of cleanupPaths ?? []) {
    const target = path.resolve(projectRoot, value);
    const allowedRoot = allowedCleanupRoot(target, roots);
    if (!allowedRoot) throw new Error(`External brain cleanup path is outside generated runtime roots: ${value}`);
    assertPathInside(target, allowedRoot, "external brain cleanup path");
    if (!await exists(target)) throw new Error(`External brain cleanup path no longer exists: ${value}`);
    const inventory = await inventoryPath(target);
    validated.push({
      path: target,
      project_path: normalizeProjectPath(target),
      ...inventory,
    });
  }
  return validated;
}

function classificationFor({ run, governance, evidence, explicitBundles, inferredBundles }) {
  if (!run || run.unreadable === true) return externalBrainSessionClassifications.UNKNOWN_SESSION;
  if (governance.length) return externalBrainSessionClassifications.GOVERNANCE_PINNED_SESSION;
  if (evidence.length) return externalBrainSessionClassifications.ACCEPTANCE_EVIDENCE_PINNED_SESSION;
  if (run.status === "running") return externalBrainSessionClassifications.ACTIVE_SESSION;
  if (run.task_type === "test" || /test/iu.test(String(run.created_by ?? ""))) {
    return externalBrainSessionClassifications.TEST_SESSION;
  }
  if (run.status === "failed" || run.blocked === true) {
    return externalBrainSessionClassifications.FAILED_OR_BLOCKED_SESSION;
  }
  if (!["success", "warning"].includes(run.status)) {
    return externalBrainSessionClassifications.UNKNOWN_SESSION;
  }
  if (!explicitBundles.length || inferredBundles.length) {
    return externalBrainSessionClassifications.INCOMPLETE_SESSION;
  }
  return externalBrainSessionClassifications.COMPLETED_UNADOPTED_SESSION;
}

function retentionFor(classification, age, policy, ownershipProofComplete) {
  const C = externalBrainSessionClassifications;
  if ([C.ACTIVE_SESSION, C.GOVERNANCE_PINNED_SESSION, C.ACCEPTANCE_EVIDENCE_PINNED_SESSION].includes(classification)) {
    return { status: "must_keep", reason: "Active authority or explicit reference pins the complete cognition lineage." };
  }
  if (classification === C.UNKNOWN_SESSION) {
    return { status: "blocked_from_cleanup", reason: "Unknown sessions never qualify for automatic cleanup." };
  }
  if (classification === C.INCOMPLETE_SESSION) {
    return { status: "needs_review", reason: "Incomplete or inferred-only lineage requires manual review." };
  }
  if (classification === C.FAILED_OR_BLOCKED_SESSION) {
    if (age === null || age < policy.failed_or_blocked_session_days) {
      return { status: "must_keep", reason: `Failed or blocked session is within ${policy.failed_or_blocked_session_days}-day retention.` };
    }
    return { status: "needs_review", reason: "Failed or blocked session exceeded retention but still requires review." };
  }
  const threshold = classification === C.TEST_SESSION
    ? policy.test_session_days
    : policy.completed_unadopted_session_days;
  if (age === null || age < threshold) {
    return { status: "must_keep", reason: `Session is within ${threshold}-day retention.` };
  }
  if (!ownershipProofComplete) {
    return { status: "needs_review", reason: "Cleanup ownership proof is incomplete." };
  }
  return { status: "eligible_for_cleanup", reason: `Unreferenced session exceeds ${threshold}-day retention with complete ownership proof.` };
}

function summaryReference(record) {
  return {
    category: record.category,
    source_path: record.source_path,
    status: record.status,
    ids: record.ids,
  };
}

async function buildSession(state, runRecord, roots, policy, now) {
  const runId = runRecord.run_id;
  const connected = connectedIds(state, runId);
  const directEdges = state.edges.filter((edge) => edge.from === runId || edge.to === runId);
  const explicitBundles = [...connected].filter((id) => bundleIdPattern.test(id) && (
    state.edges.some((edge) => (
      ((edge.from === runId && edge.to === id) || (edge.to === runId && edge.from === id))
      && explicitKinds.has(edge.kind)
    ))
  ));
  const inferredBundles = state.edges
    .filter((edge) => edge.kind === sessionLineageEdgeKinds.INFERRED_TIME_CORRELATION && (edge.from === runId || edge.to === runId))
    .map((edge) => edge.from === runId ? edge.to : edge.from)
    .filter((id) => bundleIdPattern.test(id));
  const traceIds = [...connected].filter((id) => traceIdPattern.test(id));
  const traces = traceIds.map((id) => state.traces.get(id)).filter(Boolean);
  const records = state.records.filter((record) => record.ids.some((id) => connected.has(id)));
  const governance = records.filter((record) => record.pin && record.category !== "acceptance_evidence");
  const evidence = records.filter((record) => record.acceptance);
  const classification = classificationFor({
    run: runRecord,
    governance,
    evidence,
    explicitBundles,
    inferredBundles,
  });
  const runDirectory = path.join(roots.agentRuns, runId);
  const cleanupPaths = [runDirectory];
  for (const bundleId of explicitBundles) {
    if ((state.bundleOwners.get(bundleId)?.size ?? 0) === 1) {
      const bundleDirectory = path.join(roots.gptWritingContexts, bundleId);
      if (await exists(bundleDirectory)) cleanupPaths.push(bundleDirectory);
    }
  }
  for (const trace of traces) {
    if (trace.path && await exists(trace.path)) cleanupPaths.push(trace.path);
  }
  for (const output of state.outputs.filter((entry) => entry.run_id === runId)) {
    if (await exists(output.path)) cleanupPaths.push(output.path);
  }
  const dedupedCleanupPaths = dedupeCleanupPaths(cleanupPaths);
  let estimatedFileCount = 0;
  let estimatedLogicalBytes = 0;
  let ownershipProofComplete = await exists(runDirectory);
  for (const bundleId of explicitBundles) {
    if ((state.bundleOwners.get(bundleId)?.size ?? 0) !== 1) ownershipProofComplete = false;
  }
  if (runRecord.mode === "chatgpt_owned_external_brain" && !explicitBundles.length) ownershipProofComplete = false;
  if (inferredBundles.length) ownershipProofComplete = false;
  try {
    const inventory = await validateExternalBrainSessionCleanupPaths(
      dedupedCleanupPaths.map(normalizeProjectPath),
      roots.fixtureRoot ? { fixtureRoot: roots.fixtureRoot } : {},
    );
    for (const item of inventory) {
      estimatedFileCount += item.files;
      estimatedLogicalBytes += item.bytes;
    }
  } catch {
    ownershipProofComplete = false;
  }
  const completedAt = ["success", "warning", "failed"].includes(runRecord.status)
    ? runRecord.updated_at ?? runRecord.created_at ?? null
    : null;
  const age = ageDays(completedAt ?? runRecord.updated_at ?? runRecord.created_at, now);
  const retention = retentionFor(classification, age, policy, ownershipProofComplete);
  const sessionEdges = state.edges.filter((edge) => connected.has(edge.from) && connected.has(edge.to));
  const edgeSummary = Object.fromEntries(Object.values(sessionLineageEdgeKinds).map((kind) => [
    kind,
    sessionEdges.filter((edge) => edge.kind === kind).length,
  ]));
  const references = (category) => records.filter((record) => record.category === category).map(summaryReference);
  const referencedBy = uniqueBy(
    records.filter((record) => record.pin || record.acceptance).map(summaryReference),
    (record) => `${record.category}\0${record.source_path}`,
  );
  const fingerprint = createHash("sha256").update(JSON.stringify({
    session_id: runId,
    classification,
    retention: retention.status,
    cleanup_paths: dedupedCleanupPaths.map(normalizeProjectPath).sort(),
    trace_ids: traceIds.sort(),
    bundle_ids: explicitBundles.sort(),
    references: referencedBy,
    estimated_file_count: estimatedFileCount,
    estimated_logical_bytes: estimatedLogicalBytes,
  })).digest("hex");
  return {
    item_id: runId,
    item_type: "external_brain_session",
    source_path: normalizeProjectPath(runDirectory),
    session_id: runId,
    authority_root: {
      type: "agent_run",
      id: runId,
      path: normalizeProjectPath(runDirectory),
    },
    classification,
    status: retention.status,
    reason: retention.reason,
    retention: retention.status === "eligible_for_cleanup" ? "expired" : "session_reference_first",
    risk_level: [
      externalBrainSessionClassifications.UNKNOWN_SESSION,
      externalBrainSessionClassifications.GOVERNANCE_PINNED_SESSION,
      externalBrainSessionClassifications.ACCEPTANCE_EVIDENCE_PINNED_SESSION,
    ].includes(classification) ? "high" : classification === externalBrainSessionClassifications.COMPLETED_UNADOPTED_SESSION || classification === externalBrainSessionClassifications.TEST_SESSION ? "low" : "medium",
    created_at: runRecord.created_at ?? null,
    updated_at: runRecord.updated_at ?? null,
    completed_at: completedAt,
    age_days: age,
    agent_run_ids: [runId],
    writing_context_bundle_ids: explicitBundles.sort(),
    inferred_writing_context_bundle_ids: inferredBundles.sort(),
    neural_trace_ids: traceIds.sort(),
    neural_output_references: state.outputs.filter((entry) => entry.run_id === runId).map((entry) => normalizeProjectPath(entry.path)).sort(),
    raw_story_handoff_ids: [...connected].filter((id) => handoffIdPattern.test(id)).sort(),
    final_polisher_trace_ids: traces.filter((trace) => trace.module_name === "final_polisher").map((trace) => trace.trace_id).sort(),
    candidate_references: references("candidate"),
    proof_references: references("proof"),
    approval_references: references("approval"),
    settlement_references: references("settlement"),
    adoption_references: references("adoption"),
    acceptance_evidence_references: references("acceptance_evidence"),
    edges: sessionEdges,
    edge_summary: edgeSummary,
    explicit_reference_count: sessionEdges.filter((edge) => explicitKinds.has(edge.kind)).length,
    inferred_reference_count: sessionEdges.filter((edge) => edge.kind === sessionLineageEdgeKinds.INFERRED_TIME_CORRELATION).length,
    estimated_logical_bytes: estimatedLogicalBytes,
    estimated_file_count: estimatedFileCount,
    cleanup_paths: dedupedCleanupPaths.map(normalizeProjectPath).sort(),
    referenced_by: referencedBy,
    ownership_proof_complete: ownershipProofComplete,
    hash: fingerprint,
  };
}

function normalizePolicy(input = {}) {
  const policy = { ...defaultCleanupRetentionPolicy };
  for (const key of Object.keys(policy)) {
    const value = input[key] ?? policy[key];
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      throw new Error(`${key} must be an integer from 0 to 10000.`);
    }
    policy[key] = value;
  }
  return policy;
}

export async function enumerateExternalBrainCognitiveSessions(input = {}, options = {}) {
  const roots = externalBrainSessionRoots(options);
  const policy = normalizePolicy(input.retentionPolicy ?? input.retention_policy ?? {});
  const now = options.now instanceof Date ? options.now : new Date();
  const state = {
    adjacency: new Map(),
    bundleOwners: new Map(),
    edgeKeys: new Set(),
    edges: [],
    outputs: [],
    records: [],
    traces: new Map(),
    tracesByHash: new Map(),
  };
  const runs = [];
  for (const entry of await directoryEntries(roots.agentRuns)) {
    if (!entry.isDirectory() || !runIdPattern.test(entry.name)) continue;
    const runPath = path.join(roots.agentRuns, entry.name, "run.json");
    const run = await readJson(runPath, null);
    if (!run) {
      runs.push({ run_id: entry.name, unreadable: true, mode: "chatgpt_owned_external_brain" });
      continue;
    }
    if (run.mode !== "chatgpt_owned_external_brain" && run.external_brain_session_id !== run.run_id) continue;
    runs.push(run);
    addRecord(state, "agent_run", runPath, [run]);
  }
  for (const file of await walkFiles(roots.neuralTraces, (name) => traceIdPattern.test(name.replace(/\.json$/u, "")))) {
    if (file.symbolic_link) continue;
    const trace = await readJson(file.path, null);
    if (!trace || !runIdPattern.test(trace.run_id) || !traceIdPattern.test(trace.trace_id)) continue;
    trace.path = file.path;
    state.traces.set(trace.trace_id, trace);
    if (trace.output_hash) {
      if (!state.tracesByHash.has(trace.output_hash)) state.tracesByHash.set(trace.output_hash, []);
      state.tracesByHash.get(trace.output_hash).push(trace);
    }
    addRecord(state, "neural_trace", file.path, [trace]);
  }
  for (const file of await walkFiles(roots.neuralOutputs, (name) => name.endsWith(".json"))) {
    if (file.symbolic_link) continue;
    const output = await readJson(file.path, null);
    if (!output) continue;
    const runId = output.run_id ?? idsFromString(file.path).find((id) => runIdPattern.test(id));
    if (!runIdPattern.test(runId ?? "")) continue;
    state.outputs.push({ path: file.path, run_id: runId, output });
    addRecord(state, "neural_output", file.path, [output]);
  }
  await loadGovernanceRecords(state, roots);
  await loadAcceptanceEvidence(state, roots);

  const bundleEntries = (await directoryEntries(roots.gptWritingContexts))
    .filter((entry) => entry.isDirectory() && bundleIdPattern.test(entry.name));
  const explicitBundleIds = new Set(state.bundleOwners.keys());
  for (const run of runs) {
    if (explicitBundleIds.size && [...explicitBundleIds].some((bundleId) => (
      (state.bundleOwners.get(bundleId) ?? new Set()).has(run.run_id)
    ))) continue;
    const matches = bundleEntries.filter((entry) => idStamp(entry.name) === idStamp(run.run_id));
    if (matches.length === 1) {
      addEdge(
        state,
        run.run_id,
        matches[0].name,
        sessionLineageEdgeKinds.INFERRED_TIME_CORRELATION,
        path.join(roots.gptWritingContexts, matches[0].name),
      );
    }
  }
  const sessions = [];
  for (const run of runs) sessions.push(await buildSession(state, run, roots, policy, now));
  return sessions.sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
}

export async function scanExternalBrainSessions(input = {}, options = {}) {
  const sessions = await enumerateExternalBrainCognitiveSessions(input, options);
  return {
    scanned_at: (options.now instanceof Date ? options.now : new Date()).toISOString(),
    retention_policy: normalizePolicy(input.retentionPolicy ?? input.retention_policy ?? {}),
    sessions,
    eligible_items: sessions.filter((session) => session.status === "eligible_for_cleanup"),
    must_keep_items: sessions.filter((session) => session.status === "must_keep"),
    needs_review_items: sessions.filter((session) => session.status === "needs_review"),
    blocked_items: sessions.filter((session) => session.status === "blocked_from_cleanup"),
  };
}

export async function writeExternalBrainSessionLifecycleAudit(input = {}, options = {}) {
  const scan = await scanExternalBrainSessions(input, options);
  const roots = externalBrainSessionRoots(options);
  const counts = Object.fromEntries(Object.values(externalBrainSessionClassifications).map((classification) => [
    classification,
    scan.sessions.filter((session) => session.classification === classification).length,
  ]));
  const candidates = scan.eligible_items
    .sort((left, right) => right.estimated_logical_bytes - left.estimated_logical_bytes);
  const pinned = scan.sessions
    .filter((session) => [
      externalBrainSessionClassifications.GOVERNANCE_PINNED_SESSION,
      externalBrainSessionClassifications.ACCEPTANCE_EVIDENCE_PINNED_SESSION,
      externalBrainSessionClassifications.ACTIVE_SESSION,
    ].includes(session.classification))
    .sort((left, right) => right.estimated_logical_bytes - left.estimated_logical_bytes);
  const compact = (session) => ({
    session_id: session.session_id,
    classification: session.classification,
    status: session.status,
    created_at: session.created_at,
    completed_at: session.completed_at,
    age_days: session.age_days,
    writing_context_bundle_ids: session.writing_context_bundle_ids,
    neural_trace_count: session.neural_trace_ids.length,
    estimated_logical_bytes: session.estimated_logical_bytes,
    estimated_file_count: session.estimated_file_count,
    referenced_by: session.referenced_by,
  });
  const report = {
    schema_version: "external-brain-session-lifecycle-audit-v1",
    generated_at: new Date().toISOString(),
    dry_run: true,
    production_cleanup_executed: false,
    external_brain_session_count: scan.sessions.length,
    classification_counts: counts,
    potential_cleanup_sessions: candidates.length,
    estimated_reclaim_bytes: candidates.reduce((sum, session) => sum + session.estimated_logical_bytes, 0),
    estimated_reclaim_files: candidates.reduce((sum, session) => sum + session.estimated_file_count, 0),
    largest_20_cleanup_candidates: candidates.slice(0, 20).map(compact),
    largest_20_pinned_sessions: pinned.slice(0, 20).map(compact),
    retention_policy: scan.retention_policy,
  };
  await mkdir(roots.auditRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
  const outputPath = path.join(roots.auditRoot, `external-brain-session-lifecycle-audit-${stamp}.json`);
  await writeFile(outputPath, json(report), "utf8");
  return { report, output_path: normalizeProjectPath(outputPath) };
}
