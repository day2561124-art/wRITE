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
import { promisify } from "node:util";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths, projectRoot } from "./project-paths.mjs";

const execFileAsync = promisify(execFile);

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

export const DEV_JOURNAL_STORAGE_ROOT = process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL === "1"
  ? path.join(os.tmpdir(), `writer-workbench-operation-journal-test-${process.pid}`, "operation-journal")
  : path.join(
    projectPaths.outputLogs,
    "development_runtime",
    "operation-journal",
  );

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

async function acquireJournalLock(lockPath) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("Could not acquire the journal append lock within 2 seconds.");
}

async function releaseJournalLock(handle, lockPath) {
  if (!handle) return;
  await handle.close();
  if (!await removeJournalLockFile(lockPath)) {
    throw new Error("Could not release the journal append lock within 2 seconds.");
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
} = {}) {
  const headPath = path.join(storageRoot, "head.json");
  const lockPath = path.join(storageRoot, "append.lock");
  let runtimeHealth = "healthy";
  let reconciliationRequired = false;
  let lastHealthError = null;
  let explicitDegraded = false;

  async function verifyUnlocked() {
    try {
      const { eventsPath } = await ensureStorageRoot(storageRoot);
      const head = await readHead(headPath);
      const files = await listEventFiles(eventsPath);
      if (files.length > DEV_JOURNAL_MAX_RECOVERY_SCAN) throw new Error(`Journal scan exceeds ${DEV_JOURNAL_MAX_RECOVERY_SCAN} events.`);
      let previousHash = null;
      let previousSequence = 0;
      const events = [];
      const seenSequence = new Set();
      for (const fileName of files) {
        const filePath = path.join(eventsPath, fileName);
        const info = await lstat(filePath);
        if (info.isSymbolicLink() || !info.isFile() || info.size > DEV_JOURNAL_MAX_EVENT_BYTES) throw new Error(`Unsafe journal event file: ${fileName}.`);
        const event = parseEvent(await readFile(filePath, "utf8"));
        if (seenSequence.has(event.sequence)) throw new Error(`Duplicate journal sequence ${event.sequence}.`);
        seenSequence.add(event.sequence);
        if (event.sequence !== previousSequence + 1) throw new Error(`Journal sequence gap or reorder at ${event.sequence}.`);
        if (event.previous_event_hash !== previousHash) throw new Error(`Journal previous hash mismatch at ${event.sequence}.`);
        if (!fileName.startsWith(`${String(event.sequence).padStart(12, "0")}-${event.journal_event_id}`)) throw new Error(`Journal filename/event identity mismatch at ${event.sequence}.`);
        previousSequence = event.sequence;
        previousHash = event.event_hash;
        events.push(event);
      }
      if (head.latest_sequence !== previousSequence || head.latest_event_hash !== previousHash || head.latest_event_id !== (events.at(-1)?.journal_event_id ?? null)) {
        throw new Error("Journal head does not match the verified event tail.");
      }
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
    } catch (error) {
      runtimeHealth = "corrupt";
      reconciliationRequired = true;
      lastHealthError = error.message;
      throw error;
    }
  }

  async function verify() {
    await ensureStorageRoot(storageRoot);
    const lockHandle = await acquireJournalLock(lockPath);
    try {
      return await verifyUnlocked();
    } finally {
      await releaseJournalLock(lockHandle, lockPath);
    }
  }

  async function append(input) {
    if (runtimeHealth === "corrupt") throw new Error(`JOURNAL_CORRUPT: ${lastHealthError ?? "journal integrity failure"}`);
    const { eventsPath } = await ensureStorageRoot(storageRoot);
    const lockHandle = await acquireJournalLock(lockPath);
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
    const currentStatus = await status();
    if (currentStatus.health !== "healthy") {
      const error = new Error(`JOURNAL_${currentStatus.health.toUpperCase()}: development mutation is blocked until journal reconciliation succeeds.`);
      error.code = `JOURNAL_${currentStatus.health.toUpperCase()}`;
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
    } catch {
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
    storageRoot,
  };
}

const defaultJournal = createDevOperationJournalService();

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

export async function captureDevArtifactState(repositoryRoot, relativePath) {
  const root = await realpath(repositoryRoot);
  const target = path.resolve(repositoryRoot, relativePath);
  if (!isInside(path.resolve(repositoryRoot), target)) throw new Error("Artifact path escapes the workspace root.");
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, artifact_type: null, sha256: null, bytes: null };
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error("Artifact provenance refuses symbolic links or junctions.");
  const realTarget = await realpath(target);
  if (!isInside(root, realTarget)) throw new Error("Artifact provenance resolved outside the workspace root.");
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

export async function computeWorkspaceSnapshot(context) {
  if (!context?.root || !workspaceIdPattern.test(context.workspace_id)) throw new Error("A resolved workspace execution context is required for snapshot identity.");
  let head;
  let rawStatus;
  try {
    head = (await runSnapshotGit(context.root, ["rev-parse", "--verify", "HEAD"])).trim().toLowerCase();
    rawStatus = await runSnapshotGit(context.root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  } catch (error) {
    const fixtureHead = String(context.current_head ?? "").toLowerCase();
    if (/^0{40}$/u.test(fixtureHead)) {
      const payload = { head: fixtureHead, manifest: [] };
      return {
        workspace_snapshot_id: sha256Text(canonicalJson(payload)),
        head: fixtureHead,
        changed_artifact_count: 0,
        manifest: [],
        synthetic_test_fixture: true,
      };
    }
    throw error;
  }
  if (!gitSha1Pattern.test(head)) throw new Error("Workspace snapshot could not read a valid HEAD.");
  const manifest = [];
  for (const line of rawStatus.split(/\r?\n/u).filter(Boolean)) {
    const xy = line.slice(0, 2);
    const artifactPath = parsePorcelainPath(line);
    let state = "modified";
    if (xy === "??") state = "untracked";
    else if (xy.includes("D")) state = "deleted";
    else if (xy.includes("A")) state = "added";
    const artifact = state === "deleted"
      ? { exists: false, artifact_type: null, sha256: null, bytes: null }
      : await captureDevArtifactState(context.root, artifactPath);
    manifest.push({ path: artifactPath, state, sha256: artifact.sha256, bytes: artifact.bytes, artifact_type: artifact.artifact_type });
  }
  manifest.sort((a, b) => a.path.localeCompare(b.path) || a.state.localeCompare(b.state));
  const payload = { head, manifest };
  return {
    workspace_snapshot_id: sha256Text(canonicalJson(payload)),
    head,
    changed_artifact_count: manifest.length,
    manifest,
  };
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
