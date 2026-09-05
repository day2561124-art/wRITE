import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths, projectRoot } from "./project-paths.mjs";
import { createWorkspaceSnapshotAuthorityIpcClient } from "./mcp-workspace-snapshot-authority-ipc.mjs";
import { normalizeExactWorkspaceSnapshot } from "./mcp-workspace-snapshot-authority.mjs";

const execFileAsync = promisify(execFile);
const parentWorkspaceSnapshotAuthorityIpcClient =
  process.env.WRITER_WORKBENCH_PARENT_SNAPSHOT_AUTHORITY === "1"
    && typeof process.send === "function"
    ? createWorkspaceSnapshotAuthorityIpcClient()
    : null;

export const DEV_JOURNAL_SCHEMA_VERSION = 1;
export const DEV_JOURNAL_HEALTH = Object.freeze(["healthy", "recovering", "degraded", "corrupt"]);
export const DEV_JOURNAL_STAGES = Object.freeze([
  "operation_started",
  "operation_completed",
  "operation_failed",
  "operation_recovered",
]);
export const DEV_JOURNAL_LINK_TYPES = Object.freeze([
  "derived_from",
  "used",
  "produced_by",
  "validated_by",
  "committed_by",
  "integrated_by",
  "used_by",
  "produced",
  "retires",
  "related_to",
]);
export const DEV_JOURNAL_MAX_EVENT_BYTES = 128 * 1024;
export const DEV_JOURNAL_MAX_TARGETS = 100;
export const DEV_JOURNAL_MAX_LINKS = 100;
export const DEV_JOURNAL_MAX_QUERY_RESULTS = 100;
export const DEV_JOURNAL_MAX_RECOVERY_SCAN = 10_000;
export const DEV_JOURNAL_ARTIFACT_MAX_BYTES = 16 * 1024 * 1024;
export const DEV_JOURNAL_LOCK_ACQUIRE_TIMEOUT_MS = 10_000;
export const DEV_JOURNAL_LOCK_RETRY_MIN_MS = 25;
export const DEV_JOURNAL_LOCK_RETRY_MAX_MS = 200;
export const DEV_JOURNAL_VERIFY_MAX_CATCHUP_PASSES = 8;
export const DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS = 3;
export const DEV_WORKSPACE_SNAPSHOT_RETRY_DELAY_MS = 25;
export const DEV_WORKSPACE_SNAPSHOT_CAPTURE_CONCURRENCY = 4;
export const DEV_WORKSPACE_SNAPSHOT_MAX_CAPTURE_CONCURRENCY = 16;
export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_WORKSPACES = 32;
export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_ARTIFACTS = 20_000;
export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_RACY_WINDOW_MS = 1_000;
export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_SCHEMA_VERSION = 1;

export const DEV_OPERATION_ID_PATTERN_SOURCE = "^dev_operation_[a-f0-9]{32}$";
export const DEV_JOURNAL_EVENT_ID_PATTERN_SOURCE = "^dev_journal_event_[a-f0-9]{32}$";
const operationIdPattern = new RegExp(DEV_OPERATION_ID_PATTERN_SOURCE, "u");
const eventIdPattern = new RegExp(DEV_JOURNAL_EVENT_ID_PATTERN_SOURCE, "u");
const workspaceIdPattern = /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u;
const workstreamIdPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const checkpointIdPattern = /^dev_checkpoint_[a-f0-9]{32}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const stageSet = new Set(DEV_JOURNAL_STAGES);
const linkTypeSet = new Set(DEV_JOURNAL_LINK_TYPES);
const terminalStageSet = new Set(["operation_completed", "operation_failed", "operation_recovered"]);
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const explicitWorkspaceMutationOperationTypes = new Set(["git_commit", "integration_apply"]);

function eventRepresentsWorkspaceMutation(event) {
  if (explicitWorkspaceMutationOperationTypes.has(event?.operation_type)) return true;
  return Array.isArray(event?.targets) && event.targets.some((target) => (
    target?.before !== null
    && target?.before !== undefined
    && target?.expected !== null
    && target?.expected !== undefined
    && canonicalJson(target.before) !== canonicalJson(target.expected)
  ));
}

async function invalidateParentWorkspaceSnapshotAuthority(event) {
  if (!parentWorkspaceSnapshotAuthorityIpcClient || !eventRepresentsWorkspaceMutation(event)) {
    return { attempted: false, invalidated: false };
  }
  try {
    await parentWorkspaceSnapshotAuthorityIpcClient.invalidate(
      event.workspace_id,
      `journal_mutation_started:${event.operation_type}`,
    );
    return { attempted: true, invalidated: true };
  } catch {
    // B4A never treats an unacknowledged parent authority as reusable without a
    // healthy parent-owned change clock. Keep the mutation path available and
    // let the authority remain fail-closed until B4B watcher certainty exists.
    return { attempted: true, invalidated: false };
  }
}

export const DEV_JOURNAL_STORAGE_ROOT = process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL === "1"
  ? path.join(os.tmpdir(), `writer-workbench-operation-journal-test-${process.pid}`, "operation-journal")
  : path.join(
    projectPaths.outputLogs,
    "development_runtime",
    "operation-journal",
  );

export const DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_ROOT = process.env.WRITER_WORKBENCH_SNAPSHOT_FINGERPRINT_CACHE_ROOT
  ? path.resolve(process.env.WRITER_WORKBENCH_SNAPSHOT_FINGERPRINT_CACHE_ROOT)
  : process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL === "1"
    ? path.join(path.dirname(DEV_JOURNAL_STORAGE_ROOT), "snapshot-fingerprint-cache")
    : path.join(projectPaths.outputLogs, "development_runtime", "snapshot-fingerprint-cache");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON does not allow non-finite numbers.");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("Canonical JSON supports JSON values only.");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function eventHashInput(event) {
  const { event_hash: ignored, ...withoutHash } = event;
  return canonicalJson(withoutHash);
}

function computeEventHash(event) {
  return sha256Text(eventHashInput(event));
}

function generateOperationId() {
  return `dev_operation_${randomUUID().replaceAll("-", "")}`;
}

function generateEventId() {
  return `dev_journal_event_${randomUUID().replaceAll("-", "")}`;
}

function assertBoundedString(value, label, max, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-blank string.`);
  const normalized = value.trim();
  if (Array.from(normalized).length > max) throw new Error(`${label} exceeds the ${max}-character limit.`);
  if (/\u0000/u.test(normalized)) throw new Error(`${label} cannot contain NUL.`);
  return normalized;
}

function normalizeActor(actor, toolName) {
  const source = isObject(actor) ? actor : {};
  return {
    runtime: "writer_workbench",
    profile: source.profile === "chatgpt_developer" ? "chatgpt_developer" : "chatgpt_developer",
    tool_name: assertBoundedString(toolName ?? source.tool_name, "tool_name", 160),
  };
}

function normalizeLinks(links = []) {
  if (!Array.isArray(links)) throw new Error("links must be an array.");
  if (links.length > DEV_JOURNAL_MAX_LINKS) throw new Error(`links exceeds ${DEV_JOURNAL_MAX_LINKS} items.`);
  return links.map((link, index) => {
    if (!isObject(link)) throw new Error(`links[${index}] must be an object.`);
    if (!linkTypeSet.has(link.relation)) throw new Error(`links[${index}].relation must be a bounded journal relation.`);
    const normalized = { relation: link.relation };
    if (link.operation_id !== undefined && link.operation_id !== null) {
      if (!operationIdPattern.test(link.operation_id)) throw new Error(`links[${index}].operation_id is invalid.`);
      normalized.operation_id = link.operation_id;
    }
    if (link.journal_event_id !== undefined && link.journal_event_id !== null) {
      if (!eventIdPattern.test(link.journal_event_id)) throw new Error(`links[${index}].journal_event_id is invalid.`);
      normalized.journal_event_id = link.journal_event_id;
    }
    if (link.commit !== undefined && link.commit !== null) {
      const commit = String(link.commit).toLowerCase();
      if (!gitSha1Pattern.test(commit)) throw new Error(`links[${index}].commit is invalid.`);
      normalized.commit = commit;
    }
    if (link.integration_candidate_id !== undefined && link.integration_candidate_id !== null) {
      normalized.integration_candidate_id = assertBoundedString(link.integration_candidate_id, `links[${index}].integration_candidate_id`, 128);
    }
    if (link.checkpoint_id !== undefined && link.checkpoint_id !== null) {
      if (!checkpointIdPattern.test(link.checkpoint_id)) throw new Error(`links[${index}].checkpoint_id is invalid.`);
      normalized.checkpoint_id = link.checkpoint_id;
    }
    if (link.workstream_id !== undefined && link.workstream_id !== null) {
      if (!workstreamIdPattern.test(link.workstream_id)) throw new Error(`links[${index}].workstream_id is invalid.`);
      normalized.workstream_id = link.workstream_id;
    }
    if (link.workspace_id !== undefined && link.workspace_id !== null) {
      if (!workspaceIdPattern.test(link.workspace_id)) throw new Error(`links[${index}].workspace_id is invalid.`);
      normalized.workspace_id = link.workspace_id;
    }
    if (link.workspace_snapshot_id !== undefined && link.workspace_snapshot_id !== null) {
      const snapshotId = String(link.workspace_snapshot_id).toLowerCase();
      if (!sha256Pattern.test(snapshotId)) throw new Error(`links[${index}].workspace_snapshot_id is invalid.`);
      normalized.workspace_snapshot_id = snapshotId;
    }
    if (Object.keys(normalized).length === 1) throw new Error(`links[${index}] must reference a bounded provenance identity.`);
    return normalized;
  });
}

function normalizeArtifactState(state) {
  if (!isObject(state)) throw new Error("artifact state must be an object.");
  const exists = state.exists === true;
  const artifactType = exists ? state.artifact_type : null;
  if (exists && !["file", "directory"].includes(artifactType)) throw new Error("artifact_type must be file or directory when exists=true.");
  const normalized = {
    exists,
    artifact_type: artifactType,
    sha256: null,
    bytes: null,
  };
  if (artifactType === "file") {
    if (state.sha256 !== null && state.sha256 !== undefined) {
      const digest = String(state.sha256).toLowerCase();
      if (!sha256Pattern.test(digest)) throw new Error("artifact sha256 is invalid.");
      normalized.sha256 = digest;
    }
    if (Number.isSafeInteger(state.bytes) && state.bytes >= 0) normalized.bytes = state.bytes;
  }
  return normalized;
}

function normalizeTargets(targets = []) {
  if (!Array.isArray(targets)) throw new Error("targets must be an array.");
  if (targets.length > DEV_JOURNAL_MAX_TARGETS) throw new Error(`targets exceeds ${DEV_JOURNAL_MAX_TARGETS} items.`);
  return targets.map((target, index) => {
    if (!isObject(target)) throw new Error(`targets[${index}] must be an object.`);
    const pathValue = assertBoundedString(target.path, `targets[${index}].path`, 4096);
    if (path.isAbsolute(pathValue) || pathValue.split(/[\\/]+/u).includes("..")) {
      throw new Error(`targets[${index}].path must be workspace-relative.`);
    }
    return {
      path: pathValue.replaceAll("\\", "/").replace(/^\.\//u, ""),
      role: assertBoundedString(target.role ?? "target", `targets[${index}].role`, 64),
      before: target.before ? normalizeArtifactState(target.before) : null,
      expected: target.expected ? normalizeArtifactState(target.expected) : null,
      after: target.after ? normalizeArtifactState(target.after) : null,
    };
  });
}

function boundedResultMetadata(value) {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new Error("result metadata must be an object.");
  const output = {};
  for (const [key, raw] of Object.entries(value).slice(0, 64)) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/u.test(key)) continue;
    if (raw === null || typeof raw === "boolean") output[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === "string" && Array.from(raw).length <= 2048 && !/(password|secret|token|credential|stdout|content|patch)/iu.test(key)) output[key] = raw;
    else if (Array.isArray(raw) && raw.length <= 100 && raw.every((item) => typeof item === "string" && Array.from(item).length <= 4096)) output[key] = raw;
  }
  return output;
}

function normalizeBaseEvent(input, { sequence, previousEventHash, eventId, timestamp }) {
  const operationId = input.operation_id;
  if (!operationIdPattern.test(operationId)) throw new Error("operation_id is invalid.");
  if (!stageSet.has(input.stage)) throw new Error("stage is invalid.");
  const workspaceId = input.workspace_id ?? "dev_workspace_shared_repository_v1";
  if (!workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id is invalid.");
  const workstreamId = input.workstream_id ?? null;
  if (workstreamId !== null && !workstreamIdPattern.test(workstreamId)) throw new Error("workstream_id is invalid.");
  const event = {
    schema_version: DEV_JOURNAL_SCHEMA_VERSION,
    sequence,
    journal_event_id: eventId,
    operation_id: operationId,
    stage: input.stage,
    operation_type: assertBoundedString(input.operation_type, "operation_type", 160),
    tool_name: assertBoundedString(input.tool_name, "tool_name", 160),
    timestamp,
    workstream_id: workstreamId,
    workspace_id: workspaceId,
    actor: normalizeActor(input.actor, input.tool_name),
    diagnostic: { owner_pid: process.pid, hostname: os.hostname() },
    parent_operation_id: input.parent_operation_id ?? null,
    reconciles_event_id: input.reconciles_event_id ?? null,
    targets: normalizeTargets(input.targets ?? []),
    links: normalizeLinks(input.links ?? []),
    result: boundedResultMetadata(input.result ?? {}),
    previous_event_hash: previousEventHash,
    event_hash: null,
  };
  if (event.parent_operation_id !== null && !operationIdPattern.test(event.parent_operation_id)) throw new Error("parent_operation_id is invalid.");
  if (event.reconciles_event_id !== null && !eventIdPattern.test(event.reconciles_event_id)) throw new Error("reconciles_event_id is invalid.");
  event.event_hash = computeEventHash(event);
  return event;
}

function eventFilename(sequence, eventId) {
  return `${String(sequence).padStart(12, "0")}-${eventId}.json`;
}

async function assertSafeDirectory(directoryPath, { allowMissing = false } = {}) {
  try {
    const info = await lstat(directoryPath);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Journal storage path is not a safe real directory.");
    return true;
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return false;
    throw error;
  }
}

async function createSafeDirectoryIfMissing(directoryPath) {
  if (await assertSafeDirectory(directoryPath, { allowMissing: true })) return;
  try {
    await mkdir(directoryPath, { recursive: false });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  await assertSafeDirectory(directoryPath);
}

async function ensureStorageRoot(storageRoot) {
  const parent = path.dirname(storageRoot);
  if (!await assertSafeDirectory(parent, { allowMissing: true })) {
    const grandparent = path.dirname(parent);
    await assertSafeDirectory(grandparent);
    await createSafeDirectoryIfMissing(parent);
  }
  await createSafeDirectoryIfMissing(storageRoot);
  const eventsPath = path.join(storageRoot, "events");
  await createSafeDirectoryIfMissing(eventsPath);
  const realParent = await realpath(parent);
  const realRoot = await realpath(storageRoot);
  const realEvents = await realpath(eventsPath);
  if (!isInside(realParent, realRoot) || !isInside(realRoot, realEvents)) throw new Error("Journal storage resolved outside the server-owned runtime root.");
  return { eventsPath };
}

function emptyHead() {
  return {
    schema_version: DEV_JOURNAL_SCHEMA_VERSION,
    latest_sequence: 0,
    latest_event_id: null,
    latest_event_hash: null,
  };
}

function validateHead(head) {
  if (!isObject(head) || head.schema_version !== DEV_JOURNAL_SCHEMA_VERSION) throw new Error("Journal head schema is invalid.");
  if (!Number.isSafeInteger(head.latest_sequence) || head.latest_sequence < 0) throw new Error("Journal head sequence is invalid.");
  if (head.latest_sequence === 0) {
    if (head.latest_event_id !== null || head.latest_event_hash !== null) throw new Error("Empty journal head is inconsistent.");
  } else {
    if (!eventIdPattern.test(head.latest_event_id) || !sha256Pattern.test(head.latest_event_hash)) throw new Error("Journal head identity/hash is invalid.");
  }
  return head;
}

async function readHead(headPath) {
  try {
    const info = await lstat(headPath);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 64 * 1024) throw new Error("Journal head path is unsafe.");
    return validateHead(JSON.parse(await readFile(headPath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return emptyHead();
    throw error;
  }
}

async function writeExclusiveDurableFile(targetPath, encoded) {
  const handle = await open(targetPath, "wx");
  try {
    await handle.writeFile(encoded, "utf8");
    await handle.sync();
  } finally {
    await handle.close().catch(() => {});
  }
}

async function atomicWriteJson(targetPath, value) {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
  const encoded = `${canonicalJson(value)}\n`;
  await writeExclusiveDurableFile(tempPath, encoded);
  try {
    await rename(tempPath, targetPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function removeJournalLockFile(lockPath, { attempts = 80 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(lockPath, { force: true });
      return true;
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  return false;
}

function journalLockContentionError(timeoutMs) {
  const error = new Error(`Could not acquire the journal append lock within ${timeoutMs} ms because another live development operation retained it.`);
  error.code = "JOURNAL_LOCK_CONTENDED";
  return error;
}

function journalSnapshotUnstableError() {
  const error = new Error(`Journal verification could not catch up to a stable append-only snapshot within ${DEV_JOURNAL_VERIFY_MAX_CATCHUP_PASSES} passes.`);
  error.code = "JOURNAL_SNAPSHOT_UNSTABLE";
  return error;
}

function isTransientJournalVerificationError(error) {
  return ["JOURNAL_LOCK_CONTENDED", "JOURNAL_SNAPSHOT_UNSTABLE", "JOURNAL_LOCK_RELEASE_FAILED"].includes(error?.code);
}

async function acquireJournalLock(lockPath, { timeoutMs = DEV_JOURNAL_LOCK_ACQUIRE_TIMEOUT_MS } = {}) {
  const startedAt = Date.now();
  let attempt = 0;
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, hostname: os.hostname(), acquired_at: new Date().toISOString() })}\n`, "utf8");
      return handle;
    } catch (error) {
      if (!["EEXIST", "EPERM", "EBUSY"].includes(error?.code)) throw error;
      try {
        const record = JSON.parse(await readFile(lockPath, "utf8"));
        if (record.hostname === os.hostname() && !isProcessRunning(record.pid)) {
          if (await removeJournalLockFile(lockPath)) continue;
        }
      } catch {
        // Missing, unreadable, or transiently inaccessible lock fails closed until the bounded retry completes.
      }
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = timeoutMs - elapsedMs;
      if (remainingMs <= 0) throw journalLockContentionError(timeoutMs);
      const retryMs = Math.min(
        DEV_JOURNAL_LOCK_RETRY_MAX_MS,
        DEV_JOURNAL_LOCK_RETRY_MIN_MS * (2 ** Math.min(attempt, 3)),
        remainingMs,
      );
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }
}

async function releaseJournalLock(handle, lockPath) {
  if (!handle) return;
  await handle.close();
  if (!await removeJournalLockFile(lockPath)) {
    const error = new Error("Could not release the journal append lock within 2 seconds.");
    error.code = "JOURNAL_LOCK_RELEASE_FAILED";
    throw error;
  }
}

function parseEvent(raw) {
  const event = JSON.parse(raw);
  if (!isObject(event) || event.schema_version !== DEV_JOURNAL_SCHEMA_VERSION) throw new Error("Journal event schema is invalid.");
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("Journal event sequence is invalid.");
  if (!eventIdPattern.test(event.journal_event_id) || !operationIdPattern.test(event.operation_id)) throw new Error("Journal event identity is invalid.");
  if (!stageSet.has(event.stage)) throw new Error("Journal event stage is invalid.");
  if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp))) throw new Error("Journal event timestamp is invalid.");
  if (event.previous_event_hash !== null && !sha256Pattern.test(event.previous_event_hash)) throw new Error("Journal previous_event_hash is invalid.");
  if (!sha256Pattern.test(event.event_hash) || computeEventHash(event) !== event.event_hash) throw new Error("Journal event hash mismatch.");
  normalizeTargets(event.targets ?? []);
  normalizeLinks(event.links ?? []);
  return event;
}

async function listEventFiles(eventsPath) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(eventsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{12}-dev_journal_event_[a-f0-9]{32}\.json$/u.test(entry.name)) {
      throw new Error(`Unexpected journal event directory entry: ${entry.name}.`);
    }
  }
  return entries.map((entry) => entry.name).sort();
}

export function createDevOperationJournalService({
  storageRoot = DEV_JOURNAL_STORAGE_ROOT,
  clock = () => new Date(),
  operationIdGenerator = generateOperationId,
  eventIdGenerator = generateEventId,
  eventReader = readFile,
  lockAcquireTimeoutMs = DEV_JOURNAL_LOCK_ACQUIRE_TIMEOUT_MS,
} = {}) {
  if (!Number.isSafeInteger(lockAcquireTimeoutMs) || lockAcquireTimeoutMs < 1) {
    throw new Error("lockAcquireTimeoutMs must be a positive safe integer.");
  }
  const headPath = path.join(storageRoot, "head.json");
  const lockPath = path.join(storageRoot, "append.lock");
  let runtimeHealth = "healthy";
  let reconciliationRequired = false;
  let lastHealthError = null;
  let explicitDegraded = false;
  const workspaceMutationState = new Map();

  function mutationStateFor(workspaceId) {
    let state = workspaceMutationState.get(workspaceId);
    if (!state) {
      state = { generation: 0, active_operation_ids: new Set() };
      workspaceMutationState.set(workspaceId, state);
    }
    return state;
  }

  function getMutationToken(workspaceId) {
    if (!workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id is invalid.");
    const state = workspaceMutationState.get(workspaceId);
    return {
      generation: state?.generation ?? 0,
      active_mutation_count: state?.active_operation_ids.size ?? 0,
    };
  }

  function noteMutationStarted(event) {
    if (!eventRepresentsWorkspaceMutation(event)) return;
    const state = mutationStateFor(event.workspace_id);
    state.generation += 1;
    state.active_operation_ids.add(event.operation_id);
  }

  function noteMutationTerminal(event) {
    const state = workspaceMutationState.get(event.workspace_id);
    if (!state?.active_operation_ids.has(event.operation_id)) return;
    state.active_operation_ids.delete(event.operation_id);
    state.generation += 1;
  }

  function snapshotsEqual(left, right) {
    if (left.head.latest_sequence !== right.head.latest_sequence
      || left.head.latest_event_id !== right.head.latest_event_id
      || left.head.latest_event_hash !== right.head.latest_event_hash
      || left.files.length !== right.files.length) return false;
    return left.files.every((fileName, index) => fileName === right.files[index]);
  }

  async function captureSnapshot(eventsPath) {
    const lockHandle = await acquireJournalLock(lockPath, { timeoutMs: lockAcquireTimeoutMs });
    try {
      const head = await readHead(headPath);
      const files = await listEventFiles(eventsPath);
      if (files.length > DEV_JOURNAL_MAX_RECOVERY_SCAN) throw new Error(`Journal scan exceeds ${DEV_JOURNAL_MAX_RECOVERY_SCAN} events.`);
      if (files.length !== head.latest_sequence) {
        throw new Error("Journal event-file snapshot cardinality does not match the captured head sequence.");
      }
      if (head.latest_sequence > 0) {
        const tailPrefix = `${String(head.latest_sequence).padStart(12, "0")}-${head.latest_event_id}`;
        if (!files.at(-1)?.startsWith(tailPrefix)) throw new Error("Journal captured head does not identify the event-file snapshot tail.");
      }
      return { head, files };
    } finally {
      await releaseJournalLock(lockHandle, lockPath);
    }
  }

  async function verifySnapshotExtension({ eventsPath, base, snapshot }) {
    if (snapshot.files.length < base.files.length) throw new Error("Journal event-file snapshot moved backwards during verification.");
    for (let index = 0; index < base.files.length; index += 1) {
      if (snapshot.files[index] !== base.files[index]) throw new Error("Journal event-file snapshot changed a previously captured immutable prefix.");
    }
    let previousHash = base.head.latest_event_hash;
    let previousSequence = base.head.latest_sequence;
    const events = [...base.events];
    const seenSequence = new Set(events.map((event) => event.sequence));
    for (const fileName of snapshot.files.slice(base.files.length)) {
      const filePath = path.join(eventsPath, fileName);
      const beforeInfo = await lstat(filePath);
      if (beforeInfo.isSymbolicLink() || !beforeInfo.isFile() || beforeInfo.size > DEV_JOURNAL_MAX_EVENT_BYTES) throw new Error(`Unsafe journal event file: ${fileName}.`);
      const event = parseEvent(await eventReader(filePath, "utf8"));
      const afterInfo = await lstat(filePath);
      if (!afterInfo.isFile()
        || afterInfo.isSymbolicLink()
        || beforeInfo.size !== afterInfo.size
        || beforeInfo.mtimeMs !== afterInfo.mtimeMs
        || beforeInfo.ctimeMs !== afterInfo.ctimeMs) {
        throw new Error(`Journal event file changed while its immutable snapshot was being verified: ${fileName}.`);
      }
      if (seenSequence.has(event.sequence)) throw new Error(`Duplicate journal sequence ${event.sequence}.`);
      seenSequence.add(event.sequence);
      if (event.sequence !== previousSequence + 1) throw new Error(`Journal sequence gap or reorder at ${event.sequence}.`);
      if (event.previous_event_hash !== previousHash) throw new Error(`Journal previous hash mismatch at ${event.sequence}.`);
      if (!fileName.startsWith(`${String(event.sequence).padStart(12, "0")}-${event.journal_event_id}`)) throw new Error(`Journal filename/event identity mismatch at ${event.sequence}.`);
      previousSequence = event.sequence;
      previousHash = event.event_hash;
      events.push(event);
    }
    if (snapshot.head.latest_sequence !== previousSequence
      || snapshot.head.latest_event_hash !== previousHash
      || snapshot.head.latest_event_id !== (events.at(-1)?.journal_event_id ?? null)) {
      throw new Error("Journal head does not match the verified event tail.");
    }
    return { head: snapshot.head, files: snapshot.files, events };
  }

  function classifyVerifiedSnapshot({ head, events }) {
    const byOperation = new Map();
    for (const event of events) {
      const list = byOperation.get(event.operation_id) ?? [];
      list.push(event);
      byOperation.set(event.operation_id, list);
    }
    const dangling = [];
    const active = [];
    for (const [operationId, operationEvents] of byOperation.entries()) {
      const starts = operationEvents.filter((event) => event.stage === "operation_started");
      const terminals = operationEvents.filter((event) => terminalStageSet.has(event.stage));
      if (starts.length !== 1) throw new Error(`Operation ${operationId} has invalid STARTED cardinality.`);
      if (terminals.length > 1) throw new Error(`Operation ${operationId} has multiple terminal events.`);
      if (terminals.length === 0) {
        const diagnostic = starts[0].diagnostic;
        const ownerActive = diagnostic?.hostname === os.hostname() && isProcessRunning(diagnostic?.owner_pid);
        if (ownerActive) active.push(operationId);
        else dangling.push(operationId);
      }
    }
    const ambiguousTerminal = events.some((event) => (
      terminalStageSet.has(event.stage)
      && (event.result?.outcome === "ambiguous_effect" || event.result?.reconciliation_required === true)
    ));
    const chainDegraded = dangling.length > 0 || ambiguousTerminal;
    runtimeHealth = explicitDegraded || chainDegraded ? "degraded" : "healthy";
    reconciliationRequired = explicitDegraded || chainDegraded;
    if (!explicitDegraded) {
      lastHealthError = dangling.length > 0
        ? "dangling_operations_require_reconciliation"
        : (ambiguousTerminal ? "ambiguous_terminal_operation_requires_reconciliation" : null);
    }
    return {
      head,
      events,
      dangling_operations: dangling,
      active_operations: active,
      ambiguous_terminal: ambiguousTerminal,
    };
  }

  async function verify() {
    const { eventsPath } = await ensureStorageRoot(storageRoot);
    try {
      let verified = { head: emptyHead(), files: [], events: [] };
      let snapshot = await captureSnapshot(eventsPath);
      for (let pass = 0; pass < DEV_JOURNAL_VERIFY_MAX_CATCHUP_PASSES; pass += 1) {
        verified = await verifySnapshotExtension({ eventsPath, base: verified, snapshot });
        const confirmation = await captureSnapshot(eventsPath);
        if (snapshotsEqual(snapshot, confirmation)) return classifyVerifiedSnapshot(verified);
        snapshot = confirmation;
      }
      throw journalSnapshotUnstableError();
    } catch (error) {
      if (isTransientJournalVerificationError(error)) throw error;
      runtimeHealth = "corrupt";
      reconciliationRequired = true;
      lastHealthError = error.message;
      throw error;
    }
  }

  async function append(input) {
    if (runtimeHealth === "corrupt") throw new Error(`JOURNAL_CORRUPT: ${lastHealthError ?? "journal integrity failure"}`);
    const { eventsPath } = await ensureStorageRoot(storageRoot);
    const lockHandle = await acquireJournalLock(lockPath, { timeoutMs: lockAcquireTimeoutMs });
    try {
      const head = await readHead(headPath);
      const sequence = head.latest_sequence + 1;
      const eventId = eventIdGenerator();
      if (!eventIdPattern.test(eventId)) throw new Error("Journal event ID generator returned an invalid ID.");
      const timestamp = clock().toISOString();
      const event = normalizeBaseEvent(input, {
        sequence,
        previousEventHash: head.latest_event_hash,
        eventId,
        timestamp,
      });
      const encoded = `${canonicalJson(event)}\n`;
      if (Buffer.byteLength(encoded, "utf8") > DEV_JOURNAL_MAX_EVENT_BYTES) throw new Error(`Journal event exceeds ${DEV_JOURNAL_MAX_EVENT_BYTES} bytes.`);
      const eventPath = path.join(eventsPath, eventFilename(sequence, eventId));
      await writeExclusiveDurableFile(eventPath, encoded);
      await atomicWriteJson(headPath, {
        schema_version: DEV_JOURNAL_SCHEMA_VERSION,
        latest_sequence: sequence,
        latest_event_id: eventId,
        latest_event_hash: event.event_hash,
      });
      return event;
    } finally {
      await releaseJournalLock(lockHandle, lockPath);
    }
  }

  function artifactStatesEqual(left, right) {
    if (!left || !right) return false;
    return left.exists === right.exists
      && left.artifact_type === right.artifact_type
      && left.sha256 === right.sha256
      && left.bytes === right.bytes;
  }

  async function reconcileDangling({ contextResolver } = {}) {
    const verification = await verify();
    if (verification.dangling_operations.length === 0) return verification;
    runtimeHealth = "recovering";
    reconciliationRequired = true;
    const resolveContext = contextResolver ?? (async (workspaceId) => {
      const { resolveDevWorkspaceExecutionContext } = await import("./mcp-development-workstream-tools.mjs");
      return resolveDevWorkspaceExecutionContext({ workspace_id: workspaceId }, { mutation: false });
    });

    for (const operationId of verification.dangling_operations) {
      const started = verification.events.find((event) => event.operation_id === operationId && event.stage === "operation_started");
      if (!started) continue;
      const transactionOperation = started.operation_type === "checkpoint_restore_transaction_create"
        || started.operation_type.startsWith("transaction_");
      let context = null;
      if (!started.operation_type.startsWith("checkpoint_") && !transactionOperation) {
        try {
          context = await resolveContext(started.workspace_id);
        } catch (error) {
          runtimeHealth = "degraded";
          reconciliationRequired = true;
          lastHealthError = `Could not resolve dangling operation workspace ${started.workspace_id}: ${error.message}`;
          return verify();
        }
      }

      let outcome = "no_effect_observed";
      let ambiguous = false;
      let observedTargets = [];
      if (transactionOperation) {
        try {
          const { inspectDevTransactionOperationEffect } = await import("./mcp-development-transaction-tools.mjs");
          const inspection = await inspectDevTransactionOperationEffect(started);
          outcome = inspection.outcome;
          ambiguous = inspection.reconciliation_required === true || outcome === "ambiguous_effect";
        } catch {
          outcome = "ambiguous_effect";
          ambiguous = true;
        }
      } else if (started.operation_type.startsWith("checkpoint_")) {
        try {
          const { inspectDevCheckpointOperationEffect } = await import("./mcp-development-checkpoint-tools.mjs");
          const inspection = await inspectDevCheckpointOperationEffect(started);
          outcome = inspection.outcome;
          ambiguous = inspection.reconciliation_required === true || outcome === "ambiguous_effect";
        } catch {
          outcome = "ambiguous_effect";
          ambiguous = true;
        }
      } else if (started.operation_type === "integration_apply") {
        const targetHead = started.result?.target_head ?? null;
        const integrationCommit = started.result?.integration_commit ?? null;
        const actualMainHead = (await runSnapshotGit(projectRoot, ["rev-parse", "--verify", "HEAD"])).trim().toLowerCase();
        if (targetHead && actualMainHead === targetHead) outcome = "no_effect_observed";
        else if (integrationCommit && actualMainHead === integrationCommit) outcome = "intended_effect_observed";
        else {
          outcome = "ambiguous_effect";
          ambiguous = true;
        }
      } else if (started.operation_type === "git_commit") {
        const beforeHead = started.result?.before_head ?? null;
        if (beforeHead && context.current_head === beforeHead) {
          outcome = "no_effect_observed";
        } else {
          outcome = "ambiguous_effect";
          ambiguous = true;
        }
      } else if (started.targets.length === 0) {
        outcome = "no_effect_observed";
      } else {
        let allBefore = true;
        let allExpected = true;
        for (const target of started.targets) {
          const observed = await captureDevArtifactState(context.root, target.path);
          observedTargets.push({ ...target, after: observed });
          allBefore = allBefore && artifactStatesEqual(observed, target.before);
          allExpected = allExpected && artifactStatesEqual(observed, target.expected);
        }
        if (allBefore) outcome = "no_effect_observed";
        else if (allExpected) outcome = "intended_effect_observed";
        else {
          outcome = "ambiguous_effect";
          ambiguous = true;
        }
      }

      await terminal(operationId, "operation_recovered", {
        reconciles_event_id: started.journal_event_id,
        targets: observedTargets.length > 0 ? observedTargets : started.targets,
        links: started.links,
        result: {
          outcome,
          reconciliation_required: ambiguous,
          recovered_from_started_event_id: started.journal_event_id,
        },
      });
      if (ambiguous) {
        runtimeHealth = "degraded";
        reconciliationRequired = true;
        lastHealthError = `Ambiguous durable effect for operation ${operationId}.`;
        return verify();
      }
    }
    return verify();
  }

  async function assertMutationAllowed() {
    await reconcileDangling();
    if (runtimeHealth !== "healthy") {
      const error = new Error(`JOURNAL_${runtimeHealth.toUpperCase()}: development mutation is blocked until journal reconciliation succeeds.`);
      error.code = `JOURNAL_${runtimeHealth.toUpperCase()}`;
      throw error;
    }
  }

  async function begin(input = {}) {
    await assertMutationAllowed();
    const operationId = operationIdGenerator();
    if (!operationIdPattern.test(operationId)) throw new Error("Operation ID generator returned an invalid ID.");
    const event = await append({
      ...input,
      operation_id: operationId,
      stage: "operation_started",
    });
    noteMutationStarted(event);
    await invalidateParentWorkspaceSnapshotAuthority(event);
    return { operation_id: operationId, started_event_id: event.journal_event_id, started_sequence: event.sequence };
  }

  async function terminal(operationId, stage, input = {}) {
    if (!operationIdPattern.test(operationId)) throw new Error("operation_id is invalid.");
    const verification = await verify();
    const operationEvents = verification.events.filter((event) => event.operation_id === operationId);
    const started = operationEvents.find((event) => event.stage === "operation_started");
    if (!started) throw new Error(`Unknown operation: ${operationId}.`);
    if (operationEvents.some((event) => terminalStageSet.has(event.stage))) throw new Error(`Operation already has a terminal event: ${operationId}.`);
    const event = await append({
      operation_id: operationId,
      stage,
      operation_type: started.operation_type,
      tool_name: started.tool_name,
      workstream_id: started.workstream_id,
      workspace_id: started.workspace_id,
      actor: started.actor,
      parent_operation_id: started.parent_operation_id,
      reconciles_event_id: input.reconciles_event_id ?? null,
      targets: input.targets ?? started.targets,
      links: input.links ?? started.links,
      result: input.result ?? {},
    });
    noteMutationTerminal(event);
    if (!explicitDegraded) {
      runtimeHealth = "healthy";
      reconciliationRequired = false;
      lastHealthError = null;
    }
    return event;
  }

  async function complete(operationId, input = {}) {
    return terminal(operationId, "operation_completed", input);
  }

  async function fail(operationId, input = {}) {
    return terminal(operationId, "operation_failed", input);
  }

  async function recover(operationId, input = {}) {
    return terminal(operationId, "operation_recovered", input);
  }

  async function markDegraded(reason = "terminal_journal_append_failed") {
    explicitDegraded = true;
    runtimeHealth = "degraded";
    reconciliationRequired = true;
    lastHealthError = String(reason).slice(0, 1024);
  }

  async function status() {
    try {
      const verification = await verify();
      return {
        schema_version: DEV_JOURNAL_SCHEMA_VERSION,
        health: runtimeHealth,
        chain_verified: runtimeHealth !== "corrupt",
        latest_sequence: verification.head.latest_sequence,
        latest_event_id: verification.head.latest_event_id,
        latest_event_hash: verification.head.latest_event_hash,
        dangling_operation_count: verification.dangling_operations.length,
        dangling_operations: verification.dangling_operations.slice(0, DEV_JOURNAL_MAX_QUERY_RESULTS),
        active_operation_count: verification.active_operations.length,
        active_operations: verification.active_operations.slice(0, DEV_JOURNAL_MAX_QUERY_RESULTS),
        reconciliation_required: reconciliationRequired,
        last_health_error: lastHealthError,
        storage: "server_owned_per_event_files",
      };
    } catch (error) {
      if (isTransientJournalVerificationError(error) && runtimeHealth !== "corrupt") {
        return {
          schema_version: DEV_JOURNAL_SCHEMA_VERSION,
          health: runtimeHealth === "degraded" ? "degraded" : "recovering",
          chain_verified: false,
          latest_sequence: null,
          latest_event_id: null,
          latest_event_hash: null,
          dangling_operation_count: null,
          dangling_operations: [],
          active_operation_count: null,
          active_operations: [],
          reconciliation_required: reconciliationRequired,
          last_health_error: `${error.code}: ${error.message}`,
          storage: "server_owned_per_event_files",
        };
      }
      return {
        schema_version: DEV_JOURNAL_SCHEMA_VERSION,
        health: "corrupt",
        chain_verified: false,
        latest_sequence: null,
        latest_event_id: null,
        latest_event_hash: null,
        dangling_operation_count: null,
        dangling_operations: [],
        active_operation_count: null,
        active_operations: [],
        reconciliation_required: true,
        last_health_error: lastHealthError,
        storage: "server_owned_per_event_files",
      };
    }
  }

  async function getOperation(input = {}) {
    const allowed = new Set(["operation_id"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw new Error("dev_workspace_get_operation accepts operation_id only.");
    if (!operationIdPattern.test(input.operation_id)) throw new Error("operation_id must be a server-issued operation ID.");
    const verification = await verify();
    const events = verification.events.filter((event) => event.operation_id === input.operation_id);
    if (events.length === 0) throw new Error(`Unknown operation: ${input.operation_id}.`);
    return {
      operation_id: input.operation_id,
      operation_type: events[0].operation_type,
      tool_name: events[0].tool_name,
      workstream_id: events[0].workstream_id,
      workspace_id: events[0].workspace_id,
      terminal: events.some((event) => terminalStageSet.has(event.stage)),
      outcome: events.find((event) => terminalStageSet.has(event.stage))?.stage ?? "dangling",
      events,
    };
  }

  async function listOperations(input = {}) {
    const allowed = new Set(["workstream_id", "workspace_id", "operation_type", "outcome", "limit", "after_sequence"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw new Error("dev_workspace_list_operations received unsupported filters.");
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_JOURNAL_MAX_QUERY_RESULTS) throw new Error(`limit must be 1-${DEV_JOURNAL_MAX_QUERY_RESULTS}.`);
    if (input.workstream_id !== undefined && !workstreamIdPattern.test(input.workstream_id)) throw new Error("workstream_id is invalid.");
    if (input.workspace_id !== undefined && !workspaceIdPattern.test(input.workspace_id)) throw new Error("workspace_id is invalid.");
    if (input.operation_type !== undefined) assertBoundedString(input.operation_type, "operation_type", 160);
    if (input.outcome !== undefined && !new Set(["completed", "failed", "recovered", "dangling"]).has(input.outcome)) throw new Error("outcome is invalid.");
    const afterSequence = input.after_sequence ?? 0;
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error("after_sequence must be a non-negative safe integer.");
    const verification = await verify();
    const grouped = new Map();
    for (const event of verification.events) {
      const events = grouped.get(event.operation_id) ?? [];
      events.push(event);
      grouped.set(event.operation_id, events);
    }
    let operations = [...grouped.entries()].map(([operationId, events]) => {
      const startedEvent = events.find((event) => event.stage === "operation_started");
      if (!startedEvent) throw new Error(`Operation ${operationId} has no STARTED event.`);
      const terminalEvent = events.find((event) => terminalStageSet.has(event.stage));
      const outcome = terminalEvent ? terminalEvent.stage.replace("operation_", "") : "dangling";
      return {
        operation_id: operationId,
        operation_type: startedEvent.operation_type,
        tool_name: startedEvent.tool_name,
        workstream_id: startedEvent.workstream_id,
        workspace_id: startedEvent.workspace_id,
        started_sequence: startedEvent.sequence,
        terminal_sequence: terminalEvent?.sequence ?? null,
        outcome,
      };
    }).filter((item) => item.started_sequence > afterSequence);
    if (input.workstream_id !== undefined) operations = operations.filter((item) => item.workstream_id === input.workstream_id);
    if (input.workspace_id !== undefined) operations = operations.filter((item) => item.workspace_id === input.workspace_id);
    if (input.operation_type !== undefined) operations = operations.filter((item) => item.operation_type === input.operation_type);
    if (input.outcome !== undefined) operations = operations.filter((item) => item.outcome === input.outcome);
    operations.sort((a, b) => a.started_sequence - b.started_sequence);
    const total = operations.length;
    const page = operations.slice(0, limit);
    return {
      total,
      returned: page.length,
      truncated: total > limit,
      next_after_sequence: total > limit ? page.at(-1)?.started_sequence ?? null : null,
      operations: page,
    };
  }

  async function getProvenance(input = {}) {
    const allowed = new Set(["workspace_id", "workstream_id", "path", "commit", "integration_candidate_id", "checkpoint_id", "limit"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw new Error("dev_workspace_get_provenance received unsupported filters.");
    const selectors = [
      input.path !== undefined,
      input.commit !== undefined,
      input.integration_candidate_id !== undefined,
      input.checkpoint_id !== undefined,
      input.workstream_id !== undefined,
    ].filter(Boolean).length;
    if (selectors !== 1) throw new Error("Exactly one provenance selector is required: path, commit, integration_candidate_id, checkpoint_id, or workstream_id.");
    if (input.workspace_id !== undefined && !workspaceIdPattern.test(input.workspace_id)) throw new Error("workspace_id is invalid.");
    if (input.workstream_id !== undefined && !workstreamIdPattern.test(input.workstream_id)) throw new Error("workstream_id is invalid.");
    if (input.path !== undefined && input.workspace_id === undefined) throw new Error("workspace_id is required when querying provenance by path.");
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_JOURNAL_MAX_QUERY_RESULTS) throw new Error(`limit must be 1-${DEV_JOURNAL_MAX_QUERY_RESULTS}.`);
    const verification = await verify();
    let matching = verification.events;
    if (input.workspace_id !== undefined) matching = matching.filter((event) => event.workspace_id === input.workspace_id);
    if (input.path !== undefined) {
      const normalizedPath = assertBoundedString(input.path, "path", 4096).replaceAll("\\", "/").replace(/^\.\//u, "");
      if (path.isAbsolute(normalizedPath) || normalizedPath.split("/").includes("..")) throw new Error("path must be workspace-relative.");
      matching = matching.filter((event) => event.targets.some((target) => target.path === normalizedPath));
    } else if (input.commit !== undefined) {
      const commit = String(input.commit).toLowerCase();
      if (!gitSha1Pattern.test(commit)) throw new Error("commit must be an exact Git SHA-1.");
      matching = matching.filter((event) => (
        event.result?.commit === commit
        || event.result?.after_head === commit
        || event.result?.integration_commit === commit
        || event.links.some((link) => link.commit === commit)
      ));
    } else if (input.integration_candidate_id !== undefined) {
      const candidateId = assertBoundedString(input.integration_candidate_id, "integration_candidate_id", 128);
      matching = matching.filter((event) => event.result?.integration_candidate_id === candidateId || event.links.some((link) => link.integration_candidate_id === candidateId));
    } else if (input.checkpoint_id !== undefined) {
      if (!checkpointIdPattern.test(input.checkpoint_id)) throw new Error("checkpoint_id must be a server-issued checkpoint ID.");
      matching = matching.filter((event) => (
        event.result?.checkpoint_id === input.checkpoint_id
        || event.result?.recovery_source_checkpoint_id === input.checkpoint_id
        || event.links.some((link) => link.checkpoint_id === input.checkpoint_id)
      ));
    } else {
      matching = matching.filter((event) => (
        event.workstream_id === input.workstream_id
        || event.links.some((link) => link.workstream_id === input.workstream_id)
      ));
    }

    const eventsByOperation = new Map();
    const operationsByCommit = new Map();
    const operationsByCandidate = new Map();
    const reverseOperationLinks = new Map();
    const addIndex = (map, key, operationId) => {
      if (!key) return;
      const set = map.get(key) ?? new Set();
      set.add(operationId);
      map.set(key, set);
    };
    for (const event of verification.events) {
      const operationEvents = eventsByOperation.get(event.operation_id) ?? [];
      operationEvents.push(event);
      eventsByOperation.set(event.operation_id, operationEvents);
      for (const commit of [event.result?.commit, event.result?.after_head, event.result?.integration_commit]) {
        if (typeof commit === "string" && gitSha1Pattern.test(commit)) addIndex(operationsByCommit, commit, event.operation_id);
      }
      if (typeof event.result?.integration_candidate_id === "string") addIndex(operationsByCandidate, event.result.integration_candidate_id, event.operation_id);
      for (const link of event.links) {
        if (link.commit) addIndex(operationsByCommit, link.commit, event.operation_id);
        if (link.integration_candidate_id) addIndex(operationsByCandidate, link.integration_candidate_id, event.operation_id);
        if (link.operation_id) addIndex(reverseOperationLinks, link.operation_id, event.operation_id);
      }
    }

    const seedOperationIds = [...new Set(matching.map((event) => event.operation_id))];
    const visited = new Set();
    const queue = [...seedOperationIds];
    while (queue.length > 0 && visited.size < DEV_JOURNAL_MAX_QUERY_RESULTS) {
      const operationId = queue.shift();
      if (!operationId || visited.has(operationId)) continue;
      visited.add(operationId);
      const operationEvents = eventsByOperation.get(operationId) ?? [];
      const neighbors = new Set(reverseOperationLinks.get(operationId) ?? []);
      for (const event of operationEvents) {
        for (const link of event.links) {
          if (link.operation_id) neighbors.add(link.operation_id);
          if (link.commit) for (const linkedOperation of operationsByCommit.get(link.commit) ?? []) neighbors.add(linkedOperation);
          if (link.integration_candidate_id) for (const linkedOperation of operationsByCandidate.get(link.integration_candidate_id) ?? []) neighbors.add(linkedOperation);
        }
        for (const commit of [event.result?.commit, event.result?.after_head, event.result?.integration_commit]) {
          if (typeof commit === "string" && gitSha1Pattern.test(commit)) {
            for (const linkedOperation of operationsByCommit.get(commit) ?? []) neighbors.add(linkedOperation);
          }
        }
        if (typeof event.result?.integration_candidate_id === "string") {
          for (const linkedOperation of operationsByCandidate.get(event.result.integration_candidate_id) ?? []) neighbors.add(linkedOperation);
        }
      }
      for (const neighbor of neighbors) if (!visited.has(neighbor)) queue.push(neighbor);
    }

    const expanded = verification.events
      .filter((event) => visited.has(event.operation_id))
      .sort((a, b) => a.sequence - b.sequence);
    return {
      matched_operation_count: seedOperationIds.length,
      causal_operation_count: visited.size,
      operation_ids: [...visited],
      returned_event_count: Math.min(expanded.length, limit),
      truncated: expanded.length > limit || queue.length > 0,
      events: expanded.slice(0, limit),
    };
  }

  return {
    verify,
    reconcileDangling,
    status,
    assertMutationAllowed,
    begin,
    complete,
    fail,
    recover,
    markDegraded,
    getOperation,
    listOperations,
    getProvenance,
    getMutationToken,
    storageRoot,
  };
}

const defaultJournal = createDevOperationJournalService();
const snapshotFingerprintCacheByWorkspace = new Map();
const snapshotFingerprintStateSet = new Set(["modified", "added", "untracked"]);

function snapshotArtifactVersionToken(info) {
  if (!info || typeof info !== "object") return null;
  const keys = ["dev", "ino", "mode", "nlink", "size", "mtimeNs", "ctimeNs", "birthtimeNs"];
  if (keys.some((key) => typeof info[key] !== "bigint")) return null;
  return keys.map((key) => `${key}:${info[key].toString()}`).join("|");
}

function snapshotFingerprintCacheFilePath(workspaceId) {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id is invalid.");
  return path.join(DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_ROOT, `${workspaceId}.json`);
}

function normalizeSnapshotFingerprintCacheEntry(value) {
  if (!isObject(value)) return null;
  const artifactPath = typeof value.path === "string" ? value.path : "";
  if (!artifactPath || artifactPath.length > 4096 || artifactPath.includes("\u0000")) return null;
  if (!snapshotFingerprintStateSet.has(value.state)) return null;
  if (typeof value.version_token !== "string" || !value.version_token || value.version_token.length > 512) return null;
  if (!isObject(value.artifact) || value.artifact.exists !== true || value.artifact.artifact_type !== "file") return null;
  if (!sha256Pattern.test(String(value.artifact.sha256 ?? ""))) return null;
  if (!Number.isSafeInteger(value.artifact.bytes) || value.artifact.bytes < 0 || value.artifact.bytes > DEV_JOURNAL_ARTIFACT_MAX_BYTES) return null;
  if (!Number.isSafeInteger(value.stable_since_ms) || value.stable_since_ms < 0) return null;
  return {
    path: artifactPath,
    state: value.state,
    version_token: value.version_token,
    artifact: {
      exists: true,
      artifact_type: "file",
      sha256: value.artifact.sha256,
      bytes: value.artifact.bytes,
    },
    stable_since_ms: value.stable_since_ms,
  };
}

function normalizeSnapshotFingerprintCachePayload(value, workspaceId, head) {
  if (!isObject(value)
    || value.schema_version !== DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_SCHEMA_VERSION
    || value.workspace_id !== workspaceId
    || value.head !== head
    || !Number.isSafeInteger(value.published_at_ms)
    || value.published_at_ms < 0
    || !Array.isArray(value.entries)
    || value.entries.length > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_ARTIFACTS) return null;
  const entries = new Map();
  for (const rawEntry of value.entries) {
    const entry = normalizeSnapshotFingerprintCacheEntry(rawEntry);
    if (!entry || entries.has(entry.path)) return null;
    entries.set(entry.path, entry);
  }
  return { head, entries, published_at_ms: value.published_at_ms };
}

async function readPersistentSnapshotFingerprintCache(workspaceId, head) {
  const cachePath = snapshotFingerprintCacheFilePath(workspaceId);
  try {
    const info = await lstat(cachePath);
    if (info.isSymbolicLink() || !info.isFile() || info.size > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_BYTES) return null;
    const parsed = JSON.parse(await readFile(cachePath, "utf8"));
    return normalizeSnapshotFingerprintCachePayload(parsed, workspaceId, head);
  } catch {
    return null;
  }
}

async function getSnapshotFingerprintCache(workspaceId, head, generation, { allowMemory = true } = {}) {
  if (allowMemory) {
    const cached = snapshotFingerprintCacheByWorkspace.get(workspaceId);
    if (cached && cached.head === head) {
      if (cached.generation !== generation) {
        snapshotFingerprintCacheByWorkspace.delete(workspaceId);
        return null;
      }
      snapshotFingerprintCacheByWorkspace.delete(workspaceId);
      snapshotFingerprintCacheByWorkspace.set(workspaceId, cached);
      return { ...cached, source: "memory" };
    }
  }
  const persistent = await readPersistentSnapshotFingerprintCache(workspaceId, head);
  if (!persistent) return null;
  const cached = { ...persistent, generation };
  snapshotFingerprintCacheByWorkspace.delete(workspaceId);
  snapshotFingerprintCacheByWorkspace.set(workspaceId, cached);
  while (snapshotFingerprintCacheByWorkspace.size > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_WORKSPACES) {
    const oldestWorkspaceId = snapshotFingerprintCacheByWorkspace.keys().next().value;
    snapshotFingerprintCacheByWorkspace.delete(oldestWorkspaceId);
  }
  return { ...cached, source: "persistent" };
}

async function writePersistentSnapshotFingerprintCache(workspaceId, head, entries) {
  const cachePath = snapshotFingerprintCacheFilePath(workspaceId);
  const payload = {
    schema_version: DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_SCHEMA_VERSION,
    workspace_id: workspaceId,
    head,
    published_at_ms: Date.now(),
    entries: [...entries.entries()].map(([artifactPath, entry]) => ({
      path: artifactPath,
      state: entry.state,
      version_token: entry.version_token,
      artifact: entry.artifact,
      stable_since_ms: entry.stable_since_ms,
    })),
  };
  const encoded = `${canonicalJson(payload)}\n`;
  if (Buffer.byteLength(encoded, "utf8") > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_BYTES) return false;
  try {
    await mkdir(DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_ROOT, { recursive: true });
    await atomicWriteJson(cachePath, payload);
    return true;
  } catch {
    return false;
  }
}

async function publishSnapshotFingerprintCache(workspaceId, head, generation, entries) {
  if (!(entries instanceof Map) || entries.size > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_ARTIFACTS) {
    snapshotFingerprintCacheByWorkspace.delete(workspaceId);
    return { memory: false, persistent: false };
  }
  const cached = { head, generation, entries, published_at_ms: Date.now() };
  snapshotFingerprintCacheByWorkspace.delete(workspaceId);
  snapshotFingerprintCacheByWorkspace.set(workspaceId, cached);
  while (snapshotFingerprintCacheByWorkspace.size > DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_CACHE_MAX_WORKSPACES) {
    const oldestWorkspaceId = snapshotFingerprintCacheByWorkspace.keys().next().value;
    snapshotFingerprintCacheByWorkspace.delete(oldestWorkspaceId);
  }
  const persistent = await writePersistentSnapshotFingerprintCache(workspaceId, head, entries);
  return { memory: true, persistent };
}

function workspaceSnapshotUnstableError(reason, pathValue = null) {
  const suffix = pathValue ? ` (${pathValue})` : "";
  const error = new Error(`Workspace snapshot artifact changed during capture: ${reason}${suffix}.`);
  error.code = "WORKSPACE_SNAPSHOT_ARTIFACT_CHANGED";
  error.consistency_reason = reason;
  error.artifact_path = pathValue;
  return error;
}

export async function initializeDevJournalRuntime() {
  try {
    await defaultJournal.reconcileDangling();
  } catch {
    // Keep the read-only MCP surface available for diagnosis. status() preserves
    // corrupt/degraded health and all mutation gates remain fail-closed.
  }
  return defaultJournal.status();
}

export const dev_workspace_journal_status = () => defaultJournal.status();
export const dev_workspace_get_operation = (input) => defaultJournal.getOperation(input);
export const dev_workspace_list_operations = (input) => defaultJournal.listOperations(input);
export const dev_workspace_get_provenance = (input) => defaultJournal.getProvenance(input);
export const beginDevJournalOperation = (input) => defaultJournal.begin(input);
export const completeDevJournalOperation = (operationId, input) => defaultJournal.complete(operationId, input);
export const failDevJournalOperation = (operationId, input) => defaultJournal.fail(operationId, input);
export const recoverDevJournalOperation = (operationId, input) => defaultJournal.recover(operationId, input);
export const assertDevJournalMutationAllowed = () => defaultJournal.assertMutationAllowed();
export const markDevJournalDegraded = (reason) => defaultJournal.markDegraded(reason);

async function captureDevArtifactStateWithinRoot(repositoryRoot, realRepositoryRoot, relativePath) {
  const target = path.resolve(repositoryRoot, relativePath);
  if (!isInside(repositoryRoot, target)) throw new Error("Artifact path escapes the workspace root.");
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, artifact_type: null, sha256: null, bytes: null };
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error("Artifact provenance refuses symbolic links or junctions.");
  const realTarget = await realpath(target);
  if (!isInside(realRepositoryRoot, realTarget)) throw new Error("Artifact provenance resolved outside the workspace root.");
  if (info.isDirectory()) return { exists: true, artifact_type: "directory", sha256: null, bytes: null };
  if (!info.isFile()) throw new Error("Artifact provenance supports regular files and directories only.");
  if (info.size > DEV_JOURNAL_ARTIFACT_MAX_BYTES) return { exists: true, artifact_type: "file", sha256: null, bytes: info.size };
  const content = await readFile(target);
  return {
    exists: true,
    artifact_type: "file",
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: content.length,
  };
}

async function captureSnapshotArtifactStateWithinRoot(
  repositoryRoot,
  realRepositoryRoot,
  relativePath,
  cachedEntry = null,
  racyWindowMs = DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_RACY_WINDOW_MS,
) {
  const target = path.resolve(repositoryRoot, relativePath);
  if (!isInside(repositoryRoot, target)) throw new Error("Artifact path escapes the workspace root.");

  let info;
  try {
    info = await lstat(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") throw workspaceSnapshotUnstableError("artifact_missing_during_capture", relativePath);
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error("Artifact provenance refuses symbolic links or junctions.");
  if (info.isDirectory()) {
    const realTarget = await realpath(target);
    if (!isInside(realRepositoryRoot, realTarget)) throw new Error("Artifact provenance resolved outside the workspace root.");
    return {
      artifact: { exists: true, artifact_type: "directory", sha256: null, bytes: null },
      version_token: null,
      stable_since_ms: null,
      cache_reused: false,
      cache_racy_miss: false,
      exact_hashed: false,
    };
  }
  if (!info.isFile()) throw new Error("Artifact provenance supports regular files and directories only.");

  const bytes = Number(info.size);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Artifact size exceeds the supported numeric range.");
  if (info.size > BigInt(DEV_JOURNAL_ARTIFACT_MAX_BYTES)) {
    const realTarget = await realpath(target);
    if (!isInside(realRepositoryRoot, realTarget)) throw new Error("Artifact provenance resolved outside the workspace root.");
    return {
      artifact: { exists: true, artifact_type: "file", sha256: null, bytes },
      version_token: snapshotArtifactVersionToken(info),
      stable_since_ms: null,
      cache_reused: false,
      cache_racy_miss: false,
      exact_hashed: false,
    };
  }

  const versionToken = snapshotArtifactVersionToken(info);
  const cacheTokenMatched = Boolean(
    versionToken !== null
    && cachedEntry?.state
    && cachedEntry.version_token === versionToken
    && cachedEntry.artifact?.artifact_type === "file"
    && sha256Pattern.test(String(cachedEntry.artifact.sha256 ?? ""))
    && cachedEntry.artifact.bytes === bytes
    && Number.isSafeInteger(cachedEntry.stable_since_ms)
    && cachedEntry.stable_since_ms >= 0
  );
  const cacheStable = cacheTokenMatched
    && Date.now() - cachedEntry.stable_since_ms >= racyWindowMs;
  if (cacheStable) {
    return {
      artifact: { ...cachedEntry.artifact },
      version_token: versionToken,
      stable_since_ms: cachedEntry.stable_since_ms,
      cache_reused: true,
      cache_racy_miss: false,
      exact_hashed: false,
    };
  }

  const realTarget = await realpath(target);
  if (!isInside(realRepositoryRoot, realTarget)) throw new Error("Artifact provenance resolved outside the workspace root.");
  const content = await readFile(target);
  let postInfo;
  try {
    postInfo = await lstat(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") throw workspaceSnapshotUnstableError("artifact_missing_after_hash", relativePath);
    throw error;
  }
  const postVersionToken = snapshotArtifactVersionToken(postInfo);
  if (
    postInfo.isSymbolicLink()
    || !postInfo.isFile()
    || versionToken === null
    || postVersionToken === null
    || postVersionToken !== versionToken
    || content.length !== bytes
  ) {
    throw workspaceSnapshotUnstableError("artifact_version_changed_during_hash", relativePath);
  }

  return {
    artifact: {
      exists: true,
      artifact_type: "file",
      sha256: createHash("sha256").update(content).digest("hex"),
      bytes: content.length,
    },
    version_token: versionToken,
    stable_since_ms: Date.now(),
    cache_reused: false,
    cache_racy_miss: cacheTokenMatched && !cacheStable,
    exact_hashed: true,
  };
}

async function recheckSnapshotArtifactVersionWithinRoot(repositoryRoot, realRepositoryRoot, entry) {
  if (!entry?.version_token) return true;
  const target = path.resolve(repositoryRoot, entry.path);
  if (!isInside(repositoryRoot, target)) return false;
  let info;
  try {
    info = await lstat(target, { bigint: true });
  } catch {
    return false;
  }
  if (info.isSymbolicLink() || !info.isFile()) return false;
  let realTarget;
  try {
    realTarget = await realpath(target);
  } catch {
    return false;
  }
  if (!isInside(realRepositoryRoot, realTarget)) return false;
  return snapshotArtifactVersionToken(info) === entry.version_token;
}

export async function captureDevArtifactState(repositoryRoot, relativePath) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const realRepositoryRoot = await realpath(resolvedRepositoryRoot);
  return captureDevArtifactStateWithinRoot(resolvedRepositoryRoot, realRepositoryRoot, relativePath);
}

async function runSnapshotGit(repositoryRoot, args) {
  const { stdout } = await execFileAsync(fixedGitExecutable, ["--no-pager", "-c", "core.fsmonitor=false", ...args], {
    cwd: repositoryRoot,
    env: controlledProcessEnvironment({
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_PAGER: "cat",
      PAGER: "cat",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
    }),
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    shell: false,
  });
  return String(stdout);
}

function parsePorcelainPath(line) {
  const raw = line.slice(3);
  const arrowIndex = raw.lastIndexOf(" -> ");
  return (arrowIndex === -1 ? raw : raw.slice(arrowIndex + 4)).replaceAll("\\", "/");
}

function elapsedSnapshotMs(startedAt) {
  return Math.max(0, performance.now() - startedAt);
}

async function mapSnapshotArtifactsBounded(items, concurrency, mapper) {
  if (!Array.isArray(items)) throw new Error("Snapshot capture items must be an array.");
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > DEV_WORKSPACE_SNAPSHOT_MAX_CAPTURE_CONCURRENCY) {
    throw new Error(`Snapshot capture concurrency must be between 1 and ${DEV_WORKSPACE_SNAPSHOT_MAX_CAPTURE_CONCURRENCY}.`);
  }
  if (items.length === 0) return { results: [], peak_concurrency: 0 };

  const results = new Array(items.length);
  const workerCount = Math.min(concurrency, items.length);
  let nextIndex = 0;
  let active = 0;
  let peakConcurrency = 0;
  let stopped = false;

  async function worker() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      active += 1;
      peakConcurrency = Math.max(peakConcurrency, active);
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        stopped = true;
        throw error;
      } finally {
        active -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { results, peak_concurrency: peakConcurrency };
}

async function computeWorkspaceSnapshotAttempt(context, {
  captureConcurrency,
  attempt,
  generation,
  racyWindowMs,
  allowMemoryFingerprintCache,
  afterArtifactCaptured,
}) {
  const attemptStartedAt = performance.now();
  let gitHeadMs = 0;
  let gitStatusMs = 0;
  let head;
  let rawStatus;
  try {
    const headStartedAt = performance.now();
    head = (await runSnapshotGit(context.root, ["rev-parse", "--verify", "HEAD"])).trim().toLowerCase();
    gitHeadMs = elapsedSnapshotMs(headStartedAt);
    const statusStartedAt = performance.now();
    rawStatus = await runSnapshotGit(context.root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    gitStatusMs = elapsedSnapshotMs(statusStartedAt);
  } catch (error) {
    const fixtureHead = String(context.current_head ?? "").toLowerCase();
    if (/^0{40}$/u.test(fixtureHead)) {
      const payload = { head: fixtureHead, manifest: [] };
      return {
        raw_status: "",
        snapshot: {
          workspace_snapshot_id: sha256Text(canonicalJson(payload)),
          head: fixtureHead,
          changed_artifact_count: 0,
          manifest: [],
          synthetic_test_fixture: true,
          diagnostics: {
            total_ms: elapsedSnapshotMs(attemptStartedAt),
            git_head_ms: gitHeadMs,
            git_status_ms: gitStatusMs,
            root_resolve_ms: 0,
            artifact_capture_ms: 0,
            capture_concurrency_limit: captureConcurrency,
            capture_peak_concurrency: 0,
            capture_task_count: 0,
            fingerprint_cache_eligible: false,
            fingerprint_cache_source: "none",
            fingerprint_cache_persistent_loaded: false,
            fingerprint_cache_source_entry_count: 0,
            fingerprint_cache_hit_count: 0,
            fingerprint_cache_miss_count: 0,
            fingerprint_cache_racy_miss_count: 0,
            fingerprint_cache_reused_bytes: 0,
            fingerprint_versioned_artifact_count: 0,
            fingerprint_version_recheck_ms: 0,
            fingerprint_version_recheck_count: 0,
            fingerprint_cache_published: false,
            fingerprint_cache_persistent_published: false,
            manifest_finalize_ms: 0,
            status_bytes: 0,
            hashed_artifact_count: 0,
            hashed_bytes: 0,
            unhashed_file_count: 0,
            directory_count: 0,
            modified_count: 0,
            added_count: 0,
            deleted_count: 0,
            untracked_count: 0,
          },
        },
      };
    }
    throw error;
  }
  if (!gitSha1Pattern.test(head)) throw new Error("Workspace snapshot could not read a valid HEAD.");

  const statusLines = rawStatus.split(/\r?\n/u).filter(Boolean);
  const resolvedRepositoryRoot = path.resolve(context.root);
  let realRepositoryRoot = resolvedRepositoryRoot;
  let rootResolveMs = 0;
  if (statusLines.length > 0) {
    const rootResolveStartedAt = performance.now();
    realRepositoryRoot = await realpath(resolvedRepositoryRoot);
    rootResolveMs = elapsedSnapshotMs(rootResolveStartedAt);
  }
  const entries = statusLines.map((line, statusIndex) => {
    const xy = line.slice(0, 2);
    const artifactPath = parsePorcelainPath(line);
    let state = "modified";
    if (xy === "??") state = "untracked";
    else if (xy.includes("D")) state = "deleted";
    else if (xy.includes("A")) state = "added";
    return { statusIndex, path: artifactPath, state };
  });

  let modifiedCount = 0;
  let addedCount = 0;
  let deletedCount = 0;
  let untrackedCount = 0;
  for (const entry of entries) {
    if (entry.state === "modified") modifiedCount += 1;
    else if (entry.state === "added") addedCount += 1;
    else if (entry.state === "deleted") deletedCount += 1;
    else if (entry.state === "untracked") untrackedCount += 1;
  }

  const captureEntries = entries.filter((entry) => entry.state !== "deleted");
  const fingerprintCache = await getSnapshotFingerprintCache(
    context.workspace_id,
    head,
    generation,
    { allowMemory: allowMemoryFingerprintCache },
  );
  const fingerprintEntries = new Map();
  const artifactVersionChecks = [];
  let fingerprintCacheHitCount = 0;
  let fingerprintCacheMissCount = 0;
  let fingerprintCacheRacyMissCount = 0;
  let fingerprintCacheReusedBytes = 0;
  const artifactsByStatusIndex = new Array(entries.length);
  const artifactCaptureStartedAt = performance.now();
  const capture = await mapSnapshotArtifactsBounded(
    captureEntries,
    captureConcurrency,
    async (entry) => {
      const cachedEntry = fingerprintCache?.entries.get(entry.path);
      const captured = await captureSnapshotArtifactStateWithinRoot(
        resolvedRepositoryRoot,
        realRepositoryRoot,
        entry.path,
        cachedEntry?.state === entry.state ? cachedEntry : null,
        racyWindowMs,
      );
      const artifact = captured.artifact;
      if (captured.cache_reused) {
        fingerprintCacheHitCount += 1;
        fingerprintCacheReusedBytes += artifact.bytes ?? 0;
      } else if (captured.exact_hashed) {
        fingerprintCacheMissCount += 1;
      }
      if (captured.cache_racy_miss) fingerprintCacheRacyMissCount += 1;
      if (captured.version_token !== null && artifact.sha256 !== null) {
        fingerprintEntries.set(entry.path, {
          state: entry.state,
          version_token: captured.version_token,
          artifact: { ...artifact },
          stable_since_ms: captured.stable_since_ms,
        });
        artifactVersionChecks.push({ path: entry.path, version_token: captured.version_token });
      }
      if (afterArtifactCaptured) {
        await afterArtifactCaptured({
          attempt,
          path: entry.path,
          state: entry.state,
          artifact,
          cache_reused: captured.cache_reused,
        });
      }
      return { statusIndex: entry.statusIndex, artifact };
    },
  );
  for (const captured of capture.results) {
    artifactsByStatusIndex[captured.statusIndex] = captured.artifact;
  }
  const artifactCaptureMs = elapsedSnapshotMs(artifactCaptureStartedAt);

  const manifest = [];
  let hashedArtifactCount = 0;
  let hashedBytes = 0;
  let unhashedFileCount = 0;
  let directoryCount = 0;
  for (const entry of entries) {
    const artifact = entry.state === "deleted"
      ? { exists: false, artifact_type: null, sha256: null, bytes: null }
      : artifactsByStatusIndex[entry.statusIndex];
    if (!artifact) throw new Error(`Workspace snapshot capture did not resolve ${entry.path}.`);
    if (artifact.sha256 !== null) {
      hashedArtifactCount += 1;
      hashedBytes += artifact.bytes ?? 0;
    } else if (artifact.artifact_type === "file") {
      unhashedFileCount += 1;
    } else if (artifact.artifact_type === "directory") {
      directoryCount += 1;
    }
    manifest.push({ path: entry.path, state: entry.state, sha256: artifact.sha256, bytes: artifact.bytes, artifact_type: artifact.artifact_type });
  }

  const manifestFinalizeStartedAt = performance.now();
  manifest.sort((a, b) => a.path.localeCompare(b.path) || a.state.localeCompare(b.state));
  const payload = { head, manifest };
  const workspaceSnapshotId = sha256Text(canonicalJson(payload));
  const manifestFinalizeMs = elapsedSnapshotMs(manifestFinalizeStartedAt);
  return {
    raw_status: rawStatus,
    fingerprint_entries: fingerprintEntries,
    artifact_version_checks: artifactVersionChecks,
    resolved_repository_root: resolvedRepositoryRoot,
    real_repository_root: realRepositoryRoot,
    snapshot: {
      workspace_snapshot_id: workspaceSnapshotId,
      head,
      changed_artifact_count: manifest.length,
      manifest,
      diagnostics: {
        total_ms: elapsedSnapshotMs(attemptStartedAt),
        git_head_ms: gitHeadMs,
        git_status_ms: gitStatusMs,
        root_resolve_ms: rootResolveMs,
        artifact_capture_ms: artifactCaptureMs,
        capture_concurrency_limit: captureConcurrency,
        capture_peak_concurrency: capture.peak_concurrency,
        capture_task_count: captureEntries.length,
        fingerprint_cache_eligible: fingerprintCache !== null,
        fingerprint_cache_source: fingerprintCache?.source ?? "none",
        fingerprint_cache_persistent_loaded: fingerprintCache?.source === "persistent",
        fingerprint_cache_source_entry_count: fingerprintCache?.entries.size ?? 0,
        fingerprint_cache_hit_count: fingerprintCacheHitCount,
        fingerprint_cache_miss_count: fingerprintCacheMissCount,
        fingerprint_cache_racy_miss_count: fingerprintCacheRacyMissCount,
        fingerprint_cache_reused_bytes: fingerprintCacheReusedBytes,
        fingerprint_versioned_artifact_count: artifactVersionChecks.length,
        manifest_finalize_ms: manifestFinalizeMs,
        status_bytes: Buffer.byteLength(rawStatus, "utf8"),
        hashed_artifact_count: hashedArtifactCount,
        hashed_bytes: hashedBytes,
        unhashed_file_count: unhashedFileCount,
        directory_count: directoryCount,
        modified_count: modifiedCount,
        added_count: addedCount,
        deleted_count: deletedCount,
        untracked_count: untrackedCount,
      },
    },
  };
}

function addSnapshotAttemptTimings(total, diagnostics) {
  total.git_head_ms += diagnostics.git_head_ms ?? 0;
  total.git_status_ms += diagnostics.git_status_ms ?? 0;
  total.root_resolve_ms += diagnostics.root_resolve_ms ?? 0;
  total.artifact_capture_ms += diagnostics.artifact_capture_ms ?? 0;
  total.manifest_finalize_ms += diagnostics.manifest_finalize_ms ?? 0;
}

async function delaySnapshotRetry(attempt) {
  const delayMs = DEV_WORKSPACE_SNAPSHOT_RETRY_DELAY_MS * attempt;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function snapshotAuthorityClientFor(options) {
  if (options.workspaceSnapshotAuthorityClient !== undefined) {
    const candidate = options.workspaceSnapshotAuthorityClient;
    if (candidate === null) return null;
    if (!candidate || typeof candidate.tryReuse !== "function" || typeof candidate.publishExact !== "function") {
      throw new Error("workspaceSnapshotAuthorityClient must expose tryReuse and publishExact.");
    }
    return candidate;
  }
  return parentWorkspaceSnapshotAuthorityIpcClient;
}

function emptySnapshotAuthorityTelemetry(available) {
  return {
    authority_available: available,
    authority_query_attempted: false,
    authority_reused: false,
    authority_source: "none",
    authority_miss_reason: available ? "not_queried" : "parent_authority_unavailable",
    authority_watch_state: "unknown",
    authority_epoch: null,
    authority_workspace_epoch: null,
    authority_query_ms: 0,
    authority_sync_attempted: false,
    authority_sync_started: false,
    authority_sync_completed: false,
    authority_sync_reason: available ? "not_attempted" : "parent_authority_unavailable",
    authority_sync_change_epoch: null,
    authority_published: false,
    authority_publish_ms: 0,
  };
}

async function tryReuseWorkspaceSnapshotFromAuthority(context, options, captureConcurrency) {
  const client = snapshotAuthorityClientFor(options);
  const telemetry = emptySnapshotAuthorityTelemetry(client !== null);
  if (!client) return { snapshot: null, telemetry };
  if (options.allowParentSnapshotAuthority === false) {
    telemetry.authority_miss_reason = "authority_disabled";
    return { snapshot: null, telemetry };
  }
  if (options.afterArtifactCapture || options.afterArtifactCaptured) {
    telemetry.authority_miss_reason = "deterministic_capture_hook_present";
    return { snapshot: null, telemetry };
  }

  const generationStart = defaultJournal.getMutationToken(context.workspace_id);
  if (generationStart.active_mutation_count > 0) {
    telemetry.authority_miss_reason = "active_local_mutation";
    return { snapshot: null, telemetry };
  }

  telemetry.authority_query_attempted = true;
  const queryStartedAt = performance.now();
  let response;
  try {
    response = await client.tryReuse(context.workspace_id);
  } catch {
    telemetry.authority_query_ms = elapsedSnapshotMs(queryStartedAt);
    telemetry.authority_miss_reason = "parent_authority_unavailable";
    return { snapshot: null, telemetry };
  }
  telemetry.authority_query_ms = elapsedSnapshotMs(queryStartedAt);
  telemetry.authority_watch_state = typeof response?.watch_state === "string"
    ? response.watch_state
    : "unknown";
  telemetry.authority_epoch = Number.isSafeInteger(response?.authority_epoch)
    ? response.authority_epoch
    : null;
  telemetry.authority_workspace_epoch = Number.isSafeInteger(response?.workspace_epoch)
    ? response.workspace_epoch
    : null;

  const generationEnd = defaultJournal.getMutationToken(context.workspace_id);
  if (generationEnd.active_mutation_count > 0 || generationEnd.generation !== generationStart.generation) {
    telemetry.authority_miss_reason = "local_mutation_generation_changed";
    return { snapshot: null, telemetry };
  }
  if (response?.hit !== true || !response.snapshot) {
    telemetry.authority_miss_reason = typeof response?.reason === "string"
      ? response.reason.slice(0, 160)
      : "authority_miss";
    return { snapshot: null, telemetry };
  }

  let normalized;
  try {
    normalized = normalizeExactWorkspaceSnapshot(response.snapshot);
  } catch {
    telemetry.authority_miss_reason = "authority_snapshot_invalid";
    return { snapshot: null, telemetry };
  }
  const structure = normalized.structural_diagnostics;
  telemetry.authority_reused = true;
  telemetry.authority_source = "mcp_http_parent";
  telemetry.authority_miss_reason = null;
  return {
    snapshot: {
      workspace_snapshot_id: normalized.workspace_snapshot_id,
      head: normalized.head,
      changed_artifact_count: normalized.changed_artifact_count,
      manifest: normalized.manifest,
      diagnostics: {
        total_ms: telemetry.authority_query_ms,
        git_head_ms: 0,
        git_status_ms: 0,
        root_resolve_ms: 0,
        artifact_capture_ms: 0,
        capture_concurrency_limit: captureConcurrency,
        capture_peak_concurrency: 0,
        capture_task_count: 0,
        fingerprint_cache_eligible: false,
        fingerprint_cache_source: "none",
        fingerprint_cache_persistent_loaded: false,
        fingerprint_cache_source_entry_count: 0,
        fingerprint_cache_hit_count: 0,
        fingerprint_cache_miss_count: 0,
        fingerprint_cache_racy_miss_count: 0,
        fingerprint_cache_reused_bytes: 0,
        fingerprint_versioned_artifact_count: 0,
        fingerprint_version_recheck_ms: 0,
        fingerprint_version_recheck_count: 0,
        fingerprint_cache_published: false,
        fingerprint_cache_persistent_published: false,
        manifest_finalize_ms: 0,
        consistency_attempt_count: 0,
        consistency_retry_count: 0,
        consistency_recheck_ms: 0,
        mutation_generation_start: generationStart.generation,
        mutation_generation_end: generationEnd.generation,
        status_bytes: 0,
        ...structure,
        ...telemetry,
      },
    },
    telemetry,
  };
}

async function beginWorkspaceSnapshotAuthoritySynchronization(context, options, telemetry) {
  const client = snapshotAuthorityClientFor(options);
  if (!client || options.allowParentSnapshotAuthority === false || typeof client.beginSynchronization !== "function") {
    telemetry.authority_sync_reason = client ? "change_clock_sync_unavailable" : "parent_authority_unavailable";
    return { token: null, telemetry };
  }
  if (options.afterArtifactCapture || options.afterArtifactCaptured) {
    telemetry.authority_sync_reason = "deterministic_capture_hook_present";
    return { token: null, telemetry };
  }
  telemetry.authority_sync_attempted = true;
  let response;
  try {
    response = await client.beginSynchronization(context.workspace_id);
  } catch {
    telemetry.authority_sync_reason = "parent_authority_unavailable";
    return { token: null, telemetry };
  }
  telemetry.authority_watch_state = typeof response?.watch_state === "string"
    ? response.watch_state
    : telemetry.authority_watch_state;
  telemetry.authority_epoch = Number.isSafeInteger(response?.authority_epoch)
    ? response.authority_epoch
    : telemetry.authority_epoch;
  telemetry.authority_workspace_epoch = Number.isSafeInteger(response?.workspace_epoch)
    ? response.workspace_epoch
    : telemetry.authority_workspace_epoch;
  telemetry.authority_sync_started = response?.started === true && response?.token !== null;
  telemetry.authority_sync_reason = telemetry.authority_sync_started
    ? null
    : typeof response?.reason === "string"
      ? response.reason.slice(0, 160)
      : "change_clock_sync_not_started";
  telemetry.authority_sync_change_epoch = Number.isSafeInteger(response?.token?.change_epoch)
    ? response.token.change_epoch
    : null;
  return {
    token: telemetry.authority_sync_started ? structuredClone(response.token) : null,
    telemetry,
  };
}

async function publishWorkspaceSnapshotToAuthority(context, snapshot, options, telemetry, synchronizationToken = null) {
  const client = snapshotAuthorityClientFor(options);
  if (!client || options.allowParentSnapshotAuthority === false || snapshot.synthetic_test_fixture === true) {
    return telemetry;
  }
  const publishStartedAt = performance.now();
  try {
    const result = await client.publishExact(context.workspace_id, {
      workspace_snapshot_id: snapshot.workspace_snapshot_id,
      head: snapshot.head,
      changed_artifact_count: snapshot.changed_artifact_count,
      manifest: snapshot.manifest,
    }, synchronizationToken);
    telemetry.authority_published = result?.stored === true;
    telemetry.authority_watch_state = typeof result?.watch_state === "string"
      ? result.watch_state
      : telemetry.authority_watch_state;
    telemetry.authority_epoch = Number.isSafeInteger(result?.authority_epoch)
      ? result.authority_epoch
      : telemetry.authority_epoch;
    telemetry.authority_workspace_epoch = Number.isSafeInteger(result?.workspace_epoch)
      ? result.workspace_epoch
      : telemetry.authority_workspace_epoch;
    telemetry.authority_sync_completed = result?.synchronization_completed === true;
    if (telemetry.authority_sync_started) {
      telemetry.authority_sync_reason = telemetry.authority_sync_completed
        ? null
        : typeof result?.synchronization_reason === "string"
          ? result.synchronization_reason.slice(0, 160)
          : "change_clock_sync_not_completed";
    }
  } catch {
    telemetry.authority_published = false;
  }
  telemetry.authority_publish_ms = elapsedSnapshotMs(publishStartedAt);
  return telemetry;
}

export async function computeWorkspaceSnapshot(context, options = {}) {
  if (!context?.root || !workspaceIdPattern.test(context.workspace_id)) throw new Error("A resolved workspace execution context is required for snapshot identity.");
  if (!isObject(options)) throw new Error("Workspace snapshot options must be an object.");
  if (options.afterArtifactCapture !== undefined && typeof options.afterArtifactCapture !== "function") {
    throw new Error("afterArtifactCapture must be a function when provided.");
  }
  if (options.afterArtifactCaptured !== undefined && typeof options.afterArtifactCaptured !== "function") {
    throw new Error("afterArtifactCaptured must be a function when provided.");
  }
  const captureConcurrency = options.captureConcurrency ?? DEV_WORKSPACE_SNAPSHOT_CAPTURE_CONCURRENCY;
  if (
    !Number.isSafeInteger(captureConcurrency)
    || captureConcurrency < 1
    || captureConcurrency > DEV_WORKSPACE_SNAPSHOT_MAX_CAPTURE_CONCURRENCY
  ) {
    throw new Error(`captureConcurrency must be between 1 and ${DEV_WORKSPACE_SNAPSHOT_MAX_CAPTURE_CONCURRENCY}.`);
  }
  const fingerprintRacyWindowMs = options.fingerprintRacyWindowMs ?? DEV_WORKSPACE_SNAPSHOT_FINGERPRINT_RACY_WINDOW_MS;
  if (!Number.isSafeInteger(fingerprintRacyWindowMs) || fingerprintRacyWindowMs < 0 || fingerprintRacyWindowMs > 60_000) {
    throw new Error("fingerprintRacyWindowMs must be an integer between 0 and 60000.");
  }
  if (options.allowMemoryFingerprintCache !== undefined && typeof options.allowMemoryFingerprintCache !== "boolean") {
    throw new Error("allowMemoryFingerprintCache must be a boolean when provided.");
  }
  if (options.allowParentSnapshotAuthority !== undefined && typeof options.allowParentSnapshotAuthority !== "boolean") {
    throw new Error("allowParentSnapshotAuthority must be a boolean when provided.");
  }
  const allowMemoryFingerprintCache = options.allowMemoryFingerprintCache !== false;

  const snapshotStartedAt = performance.now();
  const authorityAttempt = await tryReuseWorkspaceSnapshotFromAuthority(
    context,
    options,
    captureConcurrency,
  );
  if (authorityAttempt.snapshot) {
    return {
      ...authorityAttempt.snapshot,
      diagnostics: {
        ...authorityAttempt.snapshot.diagnostics,
        total_ms: elapsedSnapshotMs(snapshotStartedAt),
      },
    };
  }
  const authorityTelemetry = authorityAttempt.telemetry;
  const authoritySynchronization = await beginWorkspaceSnapshotAuthoritySynchronization(
    context,
    options,
    authorityTelemetry,
  );
  const authoritySynchronizationToken = authoritySynchronization.token;

  const timingTotals = {
    git_head_ms: 0,
    git_status_ms: 0,
    root_resolve_ms: 0,
    artifact_capture_ms: 0,
    manifest_finalize_ms: 0,
    consistency_recheck_ms: 0,
    fingerprint_version_recheck_ms: 0,
    fingerprint_version_recheck_count: 0,
  };
  let lastConsistencyReason = "unknown";

  for (let attempt = 1; attempt <= DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS; attempt += 1) {
    const generationStart = defaultJournal.getMutationToken(context.workspace_id);
    if (generationStart.active_mutation_count > 0) {
      lastConsistencyReason = "active_mutation_at_start";
      if (attempt < DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS) {
        await delaySnapshotRetry(attempt);
        continue;
      }
      break;
    }

    let attempted;
    try {
      attempted = await computeWorkspaceSnapshotAttempt(context, {
        captureConcurrency,
        attempt,
        generation: generationStart.generation,
        racyWindowMs: fingerprintRacyWindowMs,
        allowMemoryFingerprintCache,
        afterArtifactCaptured: options.afterArtifactCaptured,
      });
    } catch (error) {
      if (error?.code !== "WORKSPACE_SNAPSHOT_ARTIFACT_CHANGED") throw error;
      lastConsistencyReason = error.consistency_reason ?? "artifact_changed_during_capture";
      if (attempt < DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS) {
        await delaySnapshotRetry(attempt);
        continue;
      }
      break;
    }
    addSnapshotAttemptTimings(timingTotals, attempted.snapshot.diagnostics);
    if (attempted.snapshot.synthetic_test_fixture === true) {
      return {
        ...attempted.snapshot,
        diagnostics: {
          ...attempted.snapshot.diagnostics,
          total_ms: elapsedSnapshotMs(snapshotStartedAt),
          consistency_attempt_count: attempt,
          consistency_retry_count: attempt - 1,
          consistency_recheck_ms: timingTotals.consistency_recheck_ms,
          mutation_generation_start: generationStart.generation,
          mutation_generation_end: generationStart.generation,
          ...authorityTelemetry,
        },
      };
    }

    if (options.afterArtifactCapture) {
      await options.afterArtifactCapture({
        attempt,
        head: attempted.snapshot.head,
        manifest: attempted.snapshot.manifest,
      });
    }

    const consistencyRecheckStartedAt = performance.now();
    const recheckHead = (await runSnapshotGit(context.root, ["rev-parse", "--verify", "HEAD"])).trim().toLowerCase();
    const recheckStatus = await runSnapshotGit(context.root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    timingTotals.consistency_recheck_ms += elapsedSnapshotMs(consistencyRecheckStartedAt);

    let artifactVersionsStable = true;
    if (recheckHead === attempted.snapshot.head && recheckStatus === attempted.raw_status) {
      const versionRecheckStartedAt = performance.now();
      const versionRecheck = await mapSnapshotArtifactsBounded(
        attempted.artifact_version_checks,
        captureConcurrency,
        (entry) => recheckSnapshotArtifactVersionWithinRoot(
          attempted.resolved_repository_root,
          attempted.real_repository_root,
          entry,
        ),
      );
      timingTotals.fingerprint_version_recheck_ms += elapsedSnapshotMs(versionRecheckStartedAt);
      timingTotals.fingerprint_version_recheck_count += attempted.artifact_version_checks.length;
      artifactVersionsStable = versionRecheck.results.every(Boolean);
    }

    const generationEnd = defaultJournal.getMutationToken(context.workspace_id);
    let consistencyReason = null;
    if (generationEnd.active_mutation_count > 0) consistencyReason = "active_mutation_at_end";
    else if (generationEnd.generation !== generationStart.generation) consistencyReason = "mutation_generation_changed";
    else if (recheckHead !== attempted.snapshot.head) consistencyReason = "head_changed";
    else if (recheckStatus !== attempted.raw_status) consistencyReason = "status_changed";
    else if (!artifactVersionsStable) consistencyReason = "artifact_version_changed";

    if (consistencyReason === null) {
      const fingerprintCachePublish = await publishSnapshotFingerprintCache(
        context.workspace_id,
        attempted.snapshot.head,
        generationEnd.generation,
        attempted.fingerprint_entries,
      );
      const exactSnapshot = {
        ...attempted.snapshot,
        diagnostics: {
          ...attempted.snapshot.diagnostics,
          git_head_ms: timingTotals.git_head_ms,
          git_status_ms: timingTotals.git_status_ms,
          root_resolve_ms: timingTotals.root_resolve_ms,
          artifact_capture_ms: timingTotals.artifact_capture_ms,
          manifest_finalize_ms: timingTotals.manifest_finalize_ms,
          consistency_attempt_count: attempt,
          consistency_retry_count: attempt - 1,
          consistency_recheck_ms: timingTotals.consistency_recheck_ms,
          mutation_generation_start: generationStart.generation,
          mutation_generation_end: generationEnd.generation,
          fingerprint_version_recheck_ms: timingTotals.fingerprint_version_recheck_ms,
          fingerprint_version_recheck_count: timingTotals.fingerprint_version_recheck_count,
          fingerprint_cache_published: fingerprintCachePublish.memory || fingerprintCachePublish.persistent,
          fingerprint_cache_persistent_published: fingerprintCachePublish.persistent,
          ...authorityTelemetry,
        },
      };
      const publishedAuthorityTelemetry = await publishWorkspaceSnapshotToAuthority(
        context,
        exactSnapshot,
        options,
        authorityTelemetry,
        authoritySynchronizationToken,
      );
      return {
        ...exactSnapshot,
        diagnostics: {
          ...exactSnapshot.diagnostics,
          ...publishedAuthorityTelemetry,
          total_ms: elapsedSnapshotMs(snapshotStartedAt),
        },
      };
    }

    lastConsistencyReason = consistencyReason;
    if (attempt < DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS) {
      await delaySnapshotRetry(attempt);
    }
  }

  const error = new Error(`Workspace snapshot remained unstable after ${DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS} attempts (${lastConsistencyReason}).`);
  error.code = "WORKSPACE_SNAPSHOT_UNSTABLE";
  error.consistency_reason = lastConsistencyReason;
  error.consistency_attempt_count = DEV_WORKSPACE_SNAPSHOT_MAX_CONSISTENCY_ATTEMPTS;
  throw error;
}

export async function findLatestMatchingProducer({ workspaceId, artifactPath, sha256 }) {
  if (!workspaceIdPattern.test(workspaceId) || typeof artifactPath !== "string" || !sha256Pattern.test(String(sha256).toLowerCase())) return null;
  const verification = await defaultJournal.verify();
  const normalizedPath = artifactPath.replaceAll("\\", "/");
  const targetSha = String(sha256).toLowerCase();
  const candidates = verification.events
    .filter((event) => event.workspace_id === workspaceId)
    .filter((event) => ["operation_completed", "operation_recovered"].includes(event.stage))
    .filter((event) => event.targets.some((target) => target.path === normalizedPath && target.after?.exists === true && target.after?.sha256 === targetSha))
    .sort((a, b) => b.sequence - a.sequence);
  return candidates[0]?.operation_id ?? null;
}
