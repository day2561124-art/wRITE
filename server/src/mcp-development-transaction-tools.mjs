import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  captureDevTransactionRecoveryCheckpoint,
  dev_workspace_checkpoint_status,
  loadDevCheckpointInternal,
  listDevTransactionRecoveryCheckpointsByOwner,
  readDevCheckpointBlobInternal,
  retireDevTransactionRecoveryCheckpoint,
  retireDevTransactionRecoveryCheckpointsByOwner,
  verifyDevWorkspaceAgainstCheckpointInternal,
} from "./mcp-development-checkpoint-tools.mjs";
import {
  beginDevJournalOperation,
  canonicalJson,
  completeDevJournalOperation,
  computeWorkspaceSnapshot,
  dev_workspace_journal_status,
  failDevJournalOperation,
  markDevJournalDegraded,
} from "./mcp-development-journal-tools.mjs";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths } from "./project-paths.mjs";
import { resolveDevWorkspaceExecutionContext } from "./mcp-development-workstream-tools.mjs";

const execFileAsync = promisify(execFile);
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";

export const DEV_TRANSACTION_SCHEMA_VERSION = 1;
export const DEV_TRANSACTION_ID_PATTERN_SOURCE = "^dev_transaction_[a-f0-9]{32}$";
export const DEV_TRANSACTION_STATES = Object.freeze([
  "created",
  "preparing",
  "prepared",
  "applying",
  "verifying",
  "committed",
  "cleaning",
  "completed",
  "rolling_back",
  "rolled_back",
  "recovering",
  "recovery_required",
  "degraded",
  "corrupt",
  "abandoned",
]);
export const DEV_TRANSACTION_HEALTH = Object.freeze(["healthy", "recovering", "degraded", "corrupt"]);
export const DEV_TRANSACTION_MAX_LIST_RESULTS = 100;
export const DEV_TRANSACTION_MAX_TRANSITIONS = 1000;
export const DEV_TRANSACTION_MAX_FILE_BYTES = 16 * 1024 * 1024;
export const DEV_TRANSACTION_STORAGE_ROOT = process.env.WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION === "1"
  ? path.join(os.tmpdir(), `writer-workbench-transaction-test-${process.pid}`, "transactions")
  : path.join(projectPaths.outputLogs, "development_runtime", "transactions");

const transactionIdPattern = new RegExp(DEV_TRANSACTION_ID_PATTERN_SOURCE, "u");
const workspaceIdPattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamIdPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const checkpointIdPattern = /^dev_checkpoint_[a-f0-9]{32}$/u;
const operationIdPattern = /^dev_operation_[a-f0-9]{32}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const stateSet = new Set(DEV_TRANSACTION_STATES);
const healthSet = new Set(DEV_TRANSACTION_HEALTH);
const terminalStateSet = new Set(["completed", "rolled_back", "abandoned"]);
const barrierStateSet = new Set([
  "preparing", "prepared", "applying", "verifying", "committed", "cleaning",
  "rolling_back", "recovering", "recovery_required", "degraded", "corrupt",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function transactionError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details !== null) error.details = details;
  return error;
}

function assertTransactionId(value) {
  if (typeof value !== "string" || !transactionIdPattern.test(value)) throw transactionError("TRANSACTION_INVALID_ID", "transaction_id must be a server-issued transaction ID.");
  return value;
}

function assertWorkspaceId(value) {
  if (typeof value !== "string" || !workspaceIdPattern.test(value)) throw transactionError("TRANSACTION_INVALID_WORKSPACE", "workspace_id must be a server-issued isolated workspace ID.");
  return value;
}

function assertCheckpointId(value) {
  if (typeof value !== "string" || !checkpointIdPattern.test(value)) throw transactionError("TRANSACTION_INVALID_CHECKPOINT", "checkpoint_id must be a server-issued checkpoint ID.");
  return value;
}

function normalizeRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) throw transactionError("TRANSACTION_PLAN_INVALID", "Transaction artifact path must be a non-blank relative path.");
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..") || normalized.includes("\u0000")) {
    throw transactionError("TRANSACTION_PLAN_INVALID", `Unsafe transaction path: ${value}.`);
  }
  const lower = normalized.toLowerCase();
  if (lower === ".git" || lower.startsWith(".git/") || lower.startsWith("data/outputs/logs/development_runtime/")) {
    throw transactionError("TRANSACTION_PROTECTED_PATH", `Transaction path is protected: ${normalized}.`);
  }
  const secretSegments = normalized.split("/").map((item) => item.toLowerCase());
  if (secretSegments.some((item) => item === ".env" || item.endsWith(".pem") || item.endsWith(".key") || item.includes("credential") || item.includes("secret"))) {
    throw transactionError("TRANSACTION_PROTECTED_PATH", `Transaction path is secret-like and cannot be restored: ${normalized}.`);
  }
  return normalized;
}

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function assertSafeRootDirectory(directoryPath, { allowMissing = false } = {}) {
  try {
    const info = await lstat(directoryPath);
    if (info.isSymbolicLink() || !info.isDirectory()) throw transactionError("TRANSACTION_STORE_CORRUPT", `Unsafe transaction storage directory: ${directoryPath}.`);
    return true;
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return false;
    throw error;
  }
}

async function createSafeDirectory(directoryPath) {
  if (await assertSafeRootDirectory(directoryPath, { allowMissing: true })) return;
  try { await mkdir(directoryPath, { recursive: false }); } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  await assertSafeRootDirectory(directoryPath);
}

async function ensureStorageRoot(storageRoot) {
  const runtimeRoot = path.dirname(storageRoot);
  const logsRoot = path.dirname(runtimeRoot);
  if (!await assertSafeRootDirectory(logsRoot, { allowMissing: true })) await mkdir(logsRoot, { recursive: true });
  if (!await assertSafeRootDirectory(runtimeRoot, { allowMissing: true })) await createSafeDirectory(runtimeRoot);
  await createSafeDirectory(storageRoot);
  const recordsRoot = path.join(storageRoot, "records");
  const barriersRoot = path.join(storageRoot, "barriers");
  await createSafeDirectory(recordsRoot);
  await createSafeDirectory(barriersRoot);
  const realStore = await realpath(storageRoot);
  for (const directory of [recordsRoot, barriersRoot]) {
    const resolved = await realpath(directory);
    if (!isInside(realStore, resolved)) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction storage resolved outside the server-owned root.");
  }
  return { recordsRoot, barriersRoot };
}

async function writeExclusiveDurable(targetPath, data) {
  const handle = await open(targetPath, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close().catch(() => {});
  }
}

async function atomicWriteJson(targetPath, value) {
  const temp = `${targetPath}.${process.pid}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
  await writeExclusiveDurable(temp, Buffer.from(`${canonicalJson(value)}\n`, "utf8"));
  try { await rename(temp, targetPath); } finally { await rm(temp, { force: true }).catch(() => {}); }
}

async function readJsonFile(filePath, maxBytes = 4 * 1024 * 1024) {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile() || info.size > maxBytes) throw transactionError("TRANSACTION_STORE_CORRUPT", `Unsafe transaction metadata file: ${path.basename(filePath)}.`);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function acquireFileLock(lockPath, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, hostname: os.hostname(), label, acquired_at: new Date().toISOString() })}\n`, "utf8");
      return handle;
    } catch (error) {
      if (!["EEXIST", "EPERM", "EBUSY"].includes(error?.code)) throw error;
      try {
        const record = JSON.parse(await readFile(lockPath, "utf8"));
        if (record.hostname === os.hostname() && !isProcessRunning(record.pid)) {
          await rm(lockPath, { force: true });
          continue;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw transactionError("TRANSACTION_LOCK_BUSY", `Could not acquire ${label} within the bounded retry window.`);
}

async function releaseFileLock(handle, lockPath) {
  if (!handle) return;
  await handle.close();
  await rm(lockPath, { force: true });
}

async function runGit(repositoryRoot, args, { allowFailure = false, maxBuffer = 16 * 1024 * 1024 } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(fixedGitExecutable, ["--no-pager", "-c", "core.fsmonitor=false", ...args], {
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
      maxBuffer,
      encoding: args.includes("show") ? "buffer" : "utf8",
      shell: false,
    });
    return { exit_code: 0, stdout, stderr };
  } catch (error) {
    if (allowFailure) return { exit_code: Number.isInteger(error?.code) ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    throw error;
  }
}

async function readGitHead(root) {
  const result = await runGit(root, ["rev-parse", "--verify", "HEAD"]);
  const head = String(result.stdout).trim().toLowerCase();
  if (!gitSha1Pattern.test(head)) throw transactionError("TRANSACTION_GIT_STATE_INVALID", "Workspace HEAD is invalid.");
  return head;
}

async function gitOperationState(context) {
  const active = [];
  for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
    const result = await runGit(context.root, ["rev-parse", "--git-path", name]);
    const rawPath = String(result.stdout).trim();
    const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(context.root, rawPath);
    try { await access(resolved); active.push(name); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  return active;
}

function parsePorcelainStatus(raw) {
  const staged = [];
  const conflicted = [];
  for (const line of String(raw).split(/\r?\n/u).filter(Boolean)) {
    if (line.startsWith("?? ")) continue;
    const indexCode = line[0];
    const worktreeCode = line[1];
    const filePath = line.slice(3);
    if (indexCode !== " " && indexCode !== "?") staged.push(filePath);
    if (indexCode === "U" || worktreeCode === "U" || (indexCode === "A" && worktreeCode === "A")) conflicted.push(filePath);
  }
  return { staged, conflicted };
}

async function assertGitPreconditions(context, expectedHead) {
  const head = await readGitHead(context.root);
  if (head !== expectedHead) throw transactionError("CHECKPOINT_HEAD_MISMATCH", `Checkpoint HEAD ${expectedHead} does not match current workspace HEAD ${head}.`, { expected: expectedHead, actual: head });
  const status = parsePorcelainStatus((await runGit(context.root, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout);
  if (status.staged.length > 0) throw transactionError("TRANSACTION_INDEX_NOT_CLEAN", "In-place checkpoint restore refuses staged index state.");
  if (status.conflicted.length > 0) throw transactionError("TRANSACTION_CONFLICTED", "In-place checkpoint restore refuses conflicted index state.");
  const operations = await gitOperationState(context);
  if (operations.length > 0) throw transactionError("TRANSACTION_GIT_OPERATION_ACTIVE", `In-place checkpoint restore refuses active Git operation state: ${operations.join(", ")}.`);
  return { head, status, operations };
}

function validateTransactionRecord(record) {
  if (!isObject(record) || record.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction record schema is invalid.");
  assertTransactionId(record.transaction_id);
  assertWorkspaceId(record.workspace_id);
  if (!workstreamIdPattern.test(record.workstream_id ?? "")) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction workstream identity is invalid.");
  assertCheckpointId(record.checkpoint_id);
  if (record.recovery_checkpoint_id !== null && !checkpointIdPattern.test(record.recovery_checkpoint_id ?? "")) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction recovery checkpoint identity is invalid.");
  if (!gitSha1Pattern.test(record.git_head ?? "")) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction Git HEAD is invalid.");
  for (const field of ["source_snapshot_id", "target_snapshot_id"]) {
    if (!sha256Pattern.test(record[field] ?? "")) throw transactionError("TRANSACTION_STORE_CORRUPT", `Transaction ${field} is invalid.`);
  }
  if (record.transaction_plan_hash !== null && !sha256Pattern.test(record.transaction_plan_hash ?? "")) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction transaction_plan_hash is invalid.");
  if (!stateSet.has(record.state)) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction state is invalid.");
  if (!healthSet.has(record.health)) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction health is invalid.");
  for (const field of ["created_at", "updated_at"]) {
    if (typeof record[field] !== "string" || !Number.isFinite(Date.parse(record[field]))) throw transactionError("TRANSACTION_STORE_CORRUPT", `Transaction ${field} is invalid.`);
  }
  for (const field of ["prepared_at", "committed_at", "completed_at"]) {
    if (record[field] !== null && (typeof record[field] !== "string" || !Number.isFinite(Date.parse(record[field])))) throw transactionError("TRANSACTION_STORE_CORRUPT", `Transaction ${field} is invalid.`);
  }
  if (record.failure !== null) {
    if (!isObject(record.failure)) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction failure metadata is invalid.");
    if (typeof record.failure.code !== "string" || record.failure.code.length < 1 || record.failure.code.length > 160) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction failure code is invalid.");
    if (typeof record.failure.message !== "string" || record.failure.message.length > 1024) throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction failure message is invalid.");
  }
  if (!isObject(record.recovery) || typeof record.recovery.required !== "boolean") throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction recovery metadata is invalid.");
  if (!Array.isArray(record.provenance_operation_ids) || record.provenance_operation_ids.length > 64 || record.provenance_operation_ids.some((item) => !operationIdPattern.test(item))) {
    throw transactionError("TRANSACTION_STORE_CORRUPT", "Transaction provenance operation identities are invalid.");
  }
  return record;
}

function publicRecord(record, markers = {}) {
  return {
    schema_version: record.schema_version,
    transaction_id: record.transaction_id,
    workspace_id: record.workspace_id,
    workstream_id: record.workstream_id,
    checkpoint_id: record.checkpoint_id,
    git_head: record.git_head,
    source_snapshot_id: record.source_snapshot_id,
    target_snapshot_id: record.target_snapshot_id,
    recovery_checkpoint_id: record.recovery_checkpoint_id,
    transaction_plan_hash: record.transaction_plan_hash,
    state: record.state,
    health: record.health,
    created_at: record.created_at,
    prepared_at: record.prepared_at,
    committed_at: record.committed_at,
    completed_at: record.completed_at,
    failure: record.failure,
    recovery: record.recovery,
    provenance_operation_ids: record.provenance_operation_ids ?? [],
    prepared_marker: markers.prepared === true,
    commit_marker: markers.commit === true,
  };
}

function recordDirectory(recordsRoot, transactionId) {
  return path.join(recordsRoot, assertTransactionId(transactionId));
}

function barrierPath(barriersRoot, workspaceId) {
  return path.join(barriersRoot, `${assertWorkspaceId(workspaceId)}.json`);
}

async function readOptionalJson(filePath) {
  try { return await readJsonFile(filePath); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function existsRegularFile(filePath) {
  try {
    const info = await lstat(filePath);
    return info.isFile() && !info.isSymbolicLink();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function stateEquals(left, right) {
  if (!left || !right) return false;
  return left.exists === right.exists
    && left.artifact_type === right.artifact_type
    && left.sha256 === right.sha256
    && left.bytes === right.bytes;
}

async function observeArtifact(root, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const target = path.resolve(root, normalized);
  const resolvedRoot = path.resolve(root);
  if (!isInside(resolvedRoot, target)) throw transactionError("TRANSACTION_PLAN_INVALID", "Artifact path escapes the workspace root.");
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Symbolic-link state appeared at transaction path ${normalized}.`);
    if (info.isDirectory()) return { exists: true, artifact_type: "directory", sha256: null, bytes: null };
    if (!info.isFile()) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Unsupported artifact type appeared at transaction path ${normalized}.`);
    if (info.size > DEV_TRANSACTION_MAX_FILE_BYTES) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Oversized external artifact appeared at transaction path ${normalized}.`);
    const content = await readFile(target);
    if (content.includes(0)) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Binary external artifact appeared at transaction path ${normalized}.`);
    new TextDecoder("utf-8", { fatal: true }).decode(content);
    return { exists: true, artifact_type: "file", sha256: sha256Buffer(content), bytes: content.length };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, artifact_type: null, sha256: null, bytes: null };
    throw error;
  }
}

function checkpointArtifactState(artifact, checkpointId) {
  if (!artifact) return null;
  if (artifact.state === "deleted") return { exists: false, artifact_type: null, sha256: null, bytes: null, source: null };
  if (artifact.state === "directory") return { exists: true, artifact_type: "directory", sha256: null, bytes: null, source: null };
  if (artifact.artifact_type !== "file" || !sha256Pattern.test(artifact.blob?.sha256 ?? "") || !Number.isSafeInteger(artifact.blob?.bytes)) {
    throw transactionError("TRANSACTION_PLAN_INVALID", `Checkpoint artifact descriptor is invalid for ${artifact.path}.`);
  }
  return {
    exists: true,
    artifact_type: "file",
    sha256: artifact.blob.sha256,
    bytes: artifact.blob.bytes,
    source: { kind: "checkpoint_blob", checkpoint_id: checkpointId, descriptor: structuredClone(artifact.blob) },
  };
}

function plainState(state) {
  return {
    exists: state.exists,
    artifact_type: state.artifact_type,
    sha256: state.sha256,
    bytes: state.bytes,
  };
}

async function gitBaselineState(context, gitHead, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const show = await runGit(context.root, ["show", `${gitHead}:${normalized}`], { allowFailure: true, maxBuffer: DEV_TRANSACTION_MAX_FILE_BYTES + 1024 });
  if (show.exit_code !== 0) return { exists: false, artifact_type: null, sha256: null, bytes: null, source: null };
  const content = Buffer.isBuffer(show.stdout) ? show.stdout : Buffer.from(show.stdout);
  if (content.length > DEV_TRANSACTION_MAX_FILE_BYTES || content.includes(0)) throw transactionError("TRANSACTION_UNSUPPORTED_ARTIFACT", `Git baseline artifact is not supported by controlled restore: ${normalized}.`);
  try { new TextDecoder("utf-8", { fatal: true }).decode(content); } catch { throw transactionError("TRANSACTION_UNSUPPORTED_ARTIFACT", `Git baseline artifact is not UTF-8 text: ${normalized}.`); }
  return {
    exists: true,
    artifact_type: "file",
    sha256: sha256Buffer(content),
    bytes: content.length,
    source: { kind: "git_head", git_head: gitHead, path: normalized },
  };
}

async function gitBaselinePaths(context, gitHead) {
  const result = await runGit(context.root, ["ls-tree", "-r", "--name-only", gitHead]);
  return String(result.stdout).split(/\r?\n/u).filter(Boolean).map(normalizeRelativePath);
}

function directoryExpected(content, baselinePaths, directory) {
  const prefix = `${directory}/`;
  if (content.artifacts.some((artifact) => artifact.state === "directory" && artifact.path === directory)) return true;
  const byPath = new Map(content.artifacts.map((artifact) => [artifact.path, artifact]));
  for (const artifact of content.artifacts) {
    if (artifact.path.startsWith(prefix) && artifact.state !== "deleted") return true;
  }
  for (const baselinePath of baselinePaths) {
    if (!baselinePath.startsWith(prefix)) continue;
    if (byPath.get(baselinePath)?.state !== "deleted") return true;
  }
  return false;
}

async function buildPlan({ transactionId, context, targetCheckpoint, recoveryCheckpoint, sourceSnapshotId }) {
  if (
    recoveryCheckpoint.identity.internal_purpose !== "transaction_recovery"
    || recoveryCheckpoint.identity.internal_owner_transaction_id !== transactionId
  ) {
    throw transactionError(
      "TRANSACTION_RECOVERY_CHECKPOINT_MISMATCH",
      "Recovery checkpoint is not owned by the transaction building this immutable plan.",
    );
  }
  if (targetCheckpoint.identity.git_head !== recoveryCheckpoint.identity.git_head || targetCheckpoint.identity.git_head !== context.current_head) {
    throw transactionError("CHECKPOINT_HEAD_MISMATCH", "Target, recovery checkpoint, and current workspace HEAD must match exactly.");
  }
  const gitHead = context.current_head;
  const sourceByPath = new Map(recoveryCheckpoint.content.artifacts.map((artifact) => [normalizeRelativePath(artifact.path), artifact]));
  const targetByPath = new Map(targetCheckpoint.content.artifacts.map((artifact) => [normalizeRelativePath(artifact.path), artifact]));
  const filePaths = [...new Set([...sourceByPath.keys(), ...targetByPath.keys()])].sort((a, b) => a.localeCompare(b));
  const baselineCache = new Map();
  const baseline = async (relativePath) => {
    if (!baselineCache.has(relativePath)) baselineCache.set(relativePath, await gitBaselineState(context, gitHead, relativePath));
    return structuredClone(baselineCache.get(relativePath));
  };
  const transitions = [];
  for (const relativePath of filePaths) {
    const sourceArtifact = sourceByPath.get(relativePath) ?? null;
    const targetArtifact = targetByPath.get(relativePath) ?? null;
    if (sourceArtifact?.state === "directory" || targetArtifact?.state === "directory") continue;
    const before = checkpointArtifactState(sourceArtifact, recoveryCheckpoint.identity.checkpoint_id) ?? await baseline(relativePath);
    const target = checkpointArtifactState(targetArtifact, targetCheckpoint.identity.checkpoint_id) ?? await baseline(relativePath);
    if (!stateEquals(plainState(before), plainState(target))) transitions.push({ path: relativePath, kind: "artifact", before, target, move_group: null, move_role: null });
  }

  const parentDirectories = new Set();
  for (const relativePath of filePaths) {
    let parent = path.posix.dirname(relativePath);
    while (parent && parent !== ".") {
      parentDirectories.add(normalizeRelativePath(parent));
      parent = path.posix.dirname(parent);
    }
  }
  for (const artifact of [...sourceByPath.values(), ...targetByPath.values()]) if (artifact.state === "directory") parentDirectories.add(normalizeRelativePath(artifact.path));
  const baselinePaths = await gitBaselinePaths(context, gitHead);
  for (const directory of [...parentDirectories].sort((a, b) => a.localeCompare(b))) {
    const beforeExists = directoryExpected(recoveryCheckpoint.content, baselinePaths, directory);
    const targetExists = directoryExpected(targetCheckpoint.content, baselinePaths, directory);
    if (beforeExists !== targetExists) transitions.push({
      path: directory,
      kind: "directory",
      before: beforeExists ? { exists: true, artifact_type: "directory", sha256: null, bytes: null, source: null } : { exists: false, artifact_type: null, sha256: null, bytes: null, source: null },
      target: targetExists ? { exists: true, artifact_type: "directory", sha256: null, bytes: null, source: null } : { exists: false, artifact_type: null, sha256: null, bytes: null, source: null },
      move_group: null,
      move_role: null,
    });
  }

  if (transitions.length > DEV_TRANSACTION_MAX_TRANSITIONS) throw transactionError("TRANSACTION_PLAN_TOO_LARGE", `Transaction exceeds ${DEV_TRANSACTION_MAX_TRANSITIONS} artifact transitions.`);
  const caseAliases = new Map();
  const baselineCaseAliases = new Map();
  for (const baselinePath of baselinePaths) {
    const canonicalBaseline = normalizeRelativePath(baselinePath);
    const lowerBaseline = canonicalBaseline.toLocaleLowerCase("en-US");
    const existingBaseline = baselineCaseAliases.get(lowerBaseline);
    if (existingBaseline && existingBaseline !== canonicalBaseline) {
      throw transactionError("TRANSACTION_PATH_COLLISION", `Git HEAD contains case-insensitive path aliases: ${existingBaseline} / ${canonicalBaseline}.`);
    }
    baselineCaseAliases.set(lowerBaseline, canonicalBaseline);
  }
  for (const transition of transitions) {
    const canonical = normalizeRelativePath(transition.path);
    transition.path = canonical;
    const lower = canonical.toLocaleLowerCase("en-US");
    const existing = caseAliases.get(lower);
    if (existing && existing !== canonical) throw transactionError("TRANSACTION_PATH_COLLISION", `Case-insensitive path collision: ${existing} / ${canonical}.`);
    const baselineAlias = baselineCaseAliases.get(lower);
    if (baselineAlias && baselineAlias !== canonical) {
      throw transactionError("TRANSACTION_PATH_COLLISION", `Transaction path collides with Git HEAD on a case-insensitive filesystem: ${baselineAlias} / ${canonical}.`);
    }
    caseAliases.set(lower, canonical);
  }

  const deletesBySha = new Map();
  const createsBySha = new Map();
  for (const transition of transitions.filter((item) => item.kind === "artifact")) {
    if (transition.before.exists && transition.before.artifact_type === "file" && !transition.target.exists) {
      const list = deletesBySha.get(transition.before.sha256) ?? [];
      list.push(transition);
      deletesBySha.set(transition.before.sha256, list);
    }
    if (!transition.before.exists && transition.target.exists && transition.target.artifact_type === "file") {
      const list = createsBySha.get(transition.target.sha256) ?? [];
      list.push(transition);
      createsBySha.set(transition.target.sha256, list);
    }
  }
  for (const [digest, deletes] of deletesBySha.entries()) {
    const creates = createsBySha.get(digest) ?? [];
    while (deletes.length > 0 && creates.length > 0) {
      const source = deletes.shift();
      const destination = creates.shift();
      const group = sha256Text(`${source.path}\n${destination.path}\n${digest}`).slice(0, 24);
      source.move_group = group; source.move_role = "source";
      destination.move_group = group; destination.move_role = "destination";
    }
  }

  const createsDirectories = transitions.filter((item) => item.kind === "directory" && !item.before.exists && item.target.exists)
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path));
  const materializations = transitions.filter((item) => item.kind === "artifact" && item.target.exists)
    .sort((a, b) => (a.move_role === "destination" ? -1 : 0) - (b.move_role === "destination" ? -1 : 0) || a.path.localeCompare(b.path));
  const deletes = transitions.filter((item) => item.kind === "artifact" && !item.target.exists)
    .sort((a, b) => (a.move_role === "source" ? 1 : 0) - (b.move_role === "source" ? 1 : 0) || a.path.localeCompare(b.path));
  const removesDirectories = transitions.filter((item) => item.kind === "directory" && item.before.exists && !item.target.exists)
    .sort((a, b) => b.path.split("/").length - a.path.split("/").length || a.path.localeCompare(b.path));
  const executionOrder = [...createsDirectories, ...materializations, ...deletes, ...removesDirectories].map((item) => item.path);
  if (new Set(executionOrder).size !== transitions.length) throw transactionError("TRANSACTION_PLAN_COLLISION", "Transaction plan controls one canonical path more than once.");
  const planCore = {
    schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
    transaction_id: transactionId,
    workspace_id: context.workspace_id,
    workstream_id: context.workstream_id,
    checkpoint_id: targetCheckpoint.identity.checkpoint_id,
    recovery_checkpoint_id: recoveryCheckpoint.identity.checkpoint_id,
    git_head: gitHead,
    source_snapshot_id: sourceSnapshotId,
    target_snapshot_id: targetCheckpoint.identity.workspace_snapshot_id,
    transitions,
    execution_order: executionOrder,
  };
  return { ...planCore, transaction_plan_hash: sha256Text(canonicalJson(planCore)) };
}

function validatePlan(plan, transaction) {
  if (!isObject(plan) || plan.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION) throw transactionError("TRANSACTION_PLAN_CORRUPT", "Transaction plan schema is invalid.");
  if (plan.transaction_id !== transaction.transaction_id || plan.workspace_id !== transaction.workspace_id || plan.checkpoint_id !== transaction.checkpoint_id || plan.recovery_checkpoint_id !== transaction.recovery_checkpoint_id || plan.git_head !== transaction.git_head) {
    throw transactionError("TRANSACTION_PLAN_CORRUPT", "Transaction plan identity does not match transaction record.");
  }
  const { transaction_plan_hash: storedHash, ...core } = plan;
  const actualHash = sha256Text(canonicalJson(core));
  if (!sha256Pattern.test(storedHash ?? "") || actualHash !== storedHash || transaction.transaction_plan_hash !== storedHash) throw transactionError("TRANSACTION_PLAN_HASH_MISMATCH", "Transaction immutable plan hash mismatch.");
  if (!Array.isArray(plan.transitions) || !Array.isArray(plan.execution_order) || plan.transitions.length > DEV_TRANSACTION_MAX_TRANSITIONS || plan.execution_order.length !== plan.transitions.length) throw transactionError("TRANSACTION_PLAN_CORRUPT", "Transaction plan transition cardinality is invalid.");
  const paths = new Set(plan.transitions.map((item) => normalizeRelativePath(item.path)));
  if (paths.size !== plan.transitions.length || new Set(plan.execution_order).size !== plan.execution_order.length || plan.execution_order.some((item) => !paths.has(item))) throw transactionError("TRANSACTION_PLAN_COLLISION", "Transaction plan path ordering is invalid.");
  return plan;
}

async function sourceContent(state, checkpointApi, context) {
  if (!state.exists || state.artifact_type !== "file") throw transactionError("TRANSACTION_PLAN_INVALID", "Requested content for a non-file transaction state.");
  let content;
  if (state.source?.kind === "checkpoint_blob") {
    content = await checkpointApi.readBlob(state.source.descriptor);
  } else if (state.source?.kind === "git_head") {
    const result = await runGit(context.root, ["show", `${state.source.git_head}:${state.source.path}`], { maxBuffer: DEV_TRANSACTION_MAX_FILE_BYTES + 1024 });
    content = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout);
  } else {
    throw transactionError("TRANSACTION_PLAN_CORRUPT", "Transaction file state has no server-owned content source.");
  }
  if (content.length !== state.bytes || sha256Buffer(content) !== state.sha256) throw transactionError("TRANSACTION_CONTENT_INTEGRITY", "Transaction content source failed size/SHA verification.");
  if (content.length > DEV_TRANSACTION_MAX_FILE_BYTES || content.includes(0)) throw transactionError("TRANSACTION_UNSUPPORTED_ARTIFACT", "Transaction content is unsupported or oversized.");
  try { new TextDecoder("utf-8", { fatal: true }).decode(content); } catch { throw transactionError("TRANSACTION_UNSUPPORTED_ARTIFACT", "Transaction content is not UTF-8 text."); }
  return content;
}

async function ensureParentDirectorySafe(root, relativePath) {
  const parent = path.dirname(path.resolve(root, relativePath));
  const resolvedRoot = await realpath(root);
  let current = parent;
  const missing = [];
  while (current !== path.dirname(current)) {
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Unsafe parent path for ${relativePath}.`);
      const real = await realpath(current);
      if (!isInside(resolvedRoot, real)) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Parent path escapes workspace for ${relativePath}.`);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing.push(current);
      current = path.dirname(current);
    }
  }
  for (const directory of missing.reverse()) await mkdir(directory, { recursive: false });
}

function transactionPublishTempPath(root, relativePath, transactionId) {
  const target = path.resolve(root, normalizeRelativePath(relativePath));
  return `${target}.writer-workbench-${assertTransactionId(transactionId).slice(-12)}.tmp`;
}

async function publishFile(root, relativePath, content, transactionId) {
  await ensureParentDirectorySafe(root, relativePath);
  const target = path.resolve(root, relativePath);
  const temp = transactionPublishTempPath(root, relativePath, transactionId);
  let handle;
  try {
    handle = await open(temp, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw transactionError(
        "AMBIGUOUS_EXTERNAL_MUTATION",
        `Reserved transaction publish temp unexpectedly exists during apply: ${relativePath}.`,
        { path: normalizeRelativePath(relativePath) },
      );
    }
    throw error;
  }
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close().catch(() => {}); }
  try { await rename(temp, target); } finally { await rm(temp, { force: true }).catch(() => {}); }
}

async function applyState(root, transition, desired, checkpointApi, context, transactionId) {
  const targetPath = path.resolve(root, transition.path);
  if (desired.exists && desired.artifact_type === "directory") {
    try {
      const info = await lstat(targetPath);
      if (!info.isDirectory() || info.isSymbolicLink()) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Directory transition collided at ${transition.path}.`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await ensureParentDirectorySafe(root, transition.path);
      await mkdir(targetPath, { recursive: false });
    }
    return;
  }
  if (desired.exists && desired.artifact_type === "file") {
    const content = await sourceContent(desired, checkpointApi, context);
    await publishFile(root, transition.path, content, transactionId);
    return;
  }
  if (!desired.exists) {
    try {
      const info = await lstat(targetPath);
      if (info.isDirectory()) {
        const entries = await readdir(targetPath);
        if (entries.length > 0) throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Transaction refuses to remove non-empty directory ${transition.path}.`);
        await rmdir(targetPath);
      } else if (info.isFile() && !info.isSymbolicLink()) {
        await rm(targetPath, { force: false });
      } else {
        throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Unsupported artifact appeared at ${transition.path}.`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function journalDefaults() {
  return {
    status: dev_workspace_journal_status,
    begin: beginDevJournalOperation,
    complete: completeDevJournalOperation,
    fail: failDevJournalOperation,
    markDegraded: markDevJournalDegraded,
  };
}

function checkpointDefaults() {
  return {
    status: dev_workspace_checkpoint_status,
    captureRecovery: captureDevTransactionRecoveryCheckpoint,
    load: loadDevCheckpointInternal,
    readBlob: readDevCheckpointBlobInternal,
    verifyWorkspace: verifyDevWorkspaceAgainstCheckpointInternal,
    retireRecovery: retireDevTransactionRecoveryCheckpoint,
    listRecoveryByOwner: listDevTransactionRecoveryCheckpointsByOwner,
    retireRecoveryByOwner: retireDevTransactionRecoveryCheckpointsByOwner,
  };
}

export function createDevTransactionService({
  storageRoot = DEV_TRANSACTION_STORAGE_ROOT,
  workspaceContextResolver = resolveDevWorkspaceExecutionContext,
  checkpoint = checkpointDefaults(),
  journal = journalDefaults(),
  clock = () => new Date(),
  idGenerator = () => `dev_transaction_${randomUUID().replaceAll("-", "")}`,
  hooks = {},
} = {}) {
  const lockPath = path.join(storageRoot, "transaction.lock");
  let runtimeHealth = "healthy";
  let lastHealthError = null;

  async function roots() { return ensureStorageRoot(storageRoot); }

  async function withStoreLock(fn) {
    await roots();
    const lock = await acquireFileLock(lockPath, "workspace_transaction_store");
    try { return await fn(await roots()); } finally { await releaseFileLock(lock, lockPath); }
  }

  async function readRecord(transactionId) {
    const { recordsRoot } = await roots();
    const directory = recordDirectory(recordsRoot, transactionId);
    const record = validateTransactionRecord(await readJsonFile(path.join(directory, "transaction.json")));
    return { record, directory };
  }

  async function writeRecord(record) {
    validateTransactionRecord(record);
    const { recordsRoot } = await roots();
    await atomicWriteJson(path.join(recordDirectory(recordsRoot, record.transaction_id), "transaction.json"), record);
  }

  async function markers(transactionId) {
    const { directory } = await readRecord(transactionId);
    return {
      prepared: await existsRegularFile(path.join(directory, "prepared.marker")),
      commit: await existsRegularFile(path.join(directory, "commit.marker")),
    };
  }

  async function loadPlan(record) {
    const { recordsRoot } = await roots();
    const plan = await readJsonFile(path.join(recordDirectory(recordsRoot, record.transaction_id), "plan.json"), 16 * 1024 * 1024);
    return validatePlan(plan, record);
  }

  async function createBarrierRecord(record, barriersRoot) {
    const barrier = {
      schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
      workspace_id: record.workspace_id,
      transaction_id: record.transaction_id,
      state: record.state,
      transaction_plan_hash: record.transaction_plan_hash,
      updated_at: clock().toISOString(),
    };
    await atomicWriteJson(barrierPath(barriersRoot, record.workspace_id), barrier);
  }

  async function updateBarrier(record) {
    const { barriersRoot } = await roots();
    if (barrierStateSet.has(record.state)) await createBarrierRecord(record, barriersRoot);
  }

  async function releaseBarrier(record) {
    const { barriersRoot } = await roots();
    const target = barrierPath(barriersRoot, record.workspace_id);
    const barrier = await readOptionalJson(target);
    if (barrier && barrier.transaction_id !== record.transaction_id) throw transactionError("TRANSACTION_BARRIER_CORRUPT", "Workspace transaction barrier ownership mismatch.");
    await rm(target, { force: true });
  }

  async function transition(record, state, patch = {}) {
    if (!stateSet.has(state)) throw transactionError("TRANSACTION_STATE_INVALID", `Unknown transaction state: ${state}.`);
    Object.assign(record, patch, { state, updated_at: clock().toISOString() });
    await writeRecord(record);
    if (barrierStateSet.has(state)) await updateBarrier(record);
    return record;
  }

  async function beginEvidence(record, operationType, result = {}) {
    const operation = await journal.begin({
      operation_type: operationType,
      tool_name: "dev_workspace_restore_checkpoint_in_place",
      workstream_id: record.workstream_id,
      workspace_id: record.workspace_id,
      links: [
        { relation: "used", checkpoint_id: record.checkpoint_id },
        ...(record.recovery_checkpoint_id ? [{ relation: "related_to", checkpoint_id: record.recovery_checkpoint_id }] : []),
        ...(record.source_snapshot_id ? [{ relation: "used", workspace_snapshot_id: record.source_snapshot_id }] : []),
        ...(record.target_snapshot_id ? [{ relation: "used", workspace_snapshot_id: record.target_snapshot_id }] : []),
      ],
      result: { transaction_id: record.transaction_id, transaction_plan_hash: record.transaction_plan_hash, ...result },
    });
    record.provenance_operation_ids = [...new Set([...(record.provenance_operation_ids ?? []), operation.operation_id])];
    await writeRecord(record);
    return operation;
  }

  async function completeEvidence(record, operation, result = {}) {
    await journal.complete(operation.operation_id, {
      links: [
        { relation: "used", checkpoint_id: record.checkpoint_id },
        ...(record.recovery_checkpoint_id ? [{ relation: "related_to", checkpoint_id: record.recovery_checkpoint_id }] : []),
        ...(record.source_snapshot_id ? [{ relation: "used", workspace_snapshot_id: record.source_snapshot_id }] : []),
        ...(record.target_snapshot_id ? [{ relation: "produced", workspace_snapshot_id: record.target_snapshot_id }] : []),
      ],
      result: { transaction_id: record.transaction_id, transaction_plan_hash: record.transaction_plan_hash, state: record.state, ...result },
    });
  }

  async function failEvidence(record, operation, error, result = {}) {
    try {
      await journal.fail(operation.operation_id, {
        result: { transaction_id: record.transaction_id, transaction_plan_hash: record.transaction_plan_hash, state: record.state, reason: String(error?.message ?? error).slice(0, 1024), ...result },
      });
    } catch (journalError) {
      await journal.markDegraded(`transaction terminal provenance append failed: ${journalError.message}`);
      throw journalError;
    }
  }

  async function assertSubsystemPreconditions() {
    const [checkpointStatus, journalStatus] = await Promise.all([checkpoint.status(), journal.status()]);
    if (checkpointStatus.health !== "healthy") throw transactionError("CHECKPOINT_STORE_NOT_HEALTHY", `Checkpoint store health is ${checkpointStatus.health}.`);
    if (journalStatus.health !== "healthy") throw transactionError("JOURNAL_NOT_HEALTHY", `Operation journal health is ${journalStatus.health}.`);
  }

  function transitionUsesPublishTemp(transition) {
    return [transition.before, transition.target].some((state) => state?.exists === true && state.artifact_type === "file");
  }

  async function assertReservedPublishTempsAbsent(record, plan, context = null) {
    const resolved = context ?? await workspaceContextResolver(
      { workspace_id: record.workspace_id },
      { mutation: true, transactionId: record.transaction_id },
    );
    for (const transition of plan.transitions) {
      if (!transitionUsesPublishTemp(transition)) continue;
      const temp = transactionPublishTempPath(resolved.root, transition.path, record.transaction_id);
      try {
        await lstat(temp);
        throw transactionError(
          "TRANSACTION_TEMP_PATH_COLLISION",
          `Reserved transaction publish temp already exists before PREPARED: ${transition.path}.`,
          { path: transition.path },
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  async function cleanupKnownPublishTemps(record, plan, context = null) {
    const resolved = context ?? await workspaceContextResolver(
      { workspace_id: record.workspace_id },
      { mutation: true, transactionId: record.transaction_id },
    );
    let cleaned = 0;
    for (const transition of plan.transitions) {
      if (!transitionUsesPublishTemp(transition)) continue;
      const temp = transactionPublishTempPath(resolved.root, transition.path, record.transaction_id);
      try {
        const info = await lstat(temp);
        if (info.isSymbolicLink() || !info.isFile()) {
          throw transactionError(
            "AMBIGUOUS_EXTERNAL_MUTATION",
            `Reserved transaction publish temp changed type and will not be removed: ${transition.path}.`,
            { path: transition.path },
          );
        }
        await rm(temp, { force: false });
        cleaned += 1;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return cleaned;
  }

  async function stageAfterImages(record, plan) {
    const { recordsRoot } = await roots();
    const afterImages = path.join(recordDirectory(recordsRoot, record.transaction_id), "after-images");
    await createSafeDirectory(afterImages);
    const context = await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: true, transactionId: record.transaction_id });
    for (const transition of plan.transitions) {
      if (!transition.target.exists || transition.target.artifact_type !== "file") continue;
      const content = await sourceContent(transition.target, checkpoint, context);
      const target = path.join(afterImages, transition.target.sha256);
      if (!await existsRegularFile(target)) await writeExclusiveDurable(target, content);
      const staged = await readFile(target);
      if (staged.length !== transition.target.bytes || sha256Buffer(staged) !== transition.target.sha256) throw transactionError("TRANSACTION_AFTER_IMAGE_INVALID", `Staged after-image failed verification for ${transition.path}.`);
    }
  }

  async function readPreparedMarker(record) {
    const { recordsRoot } = await roots();
    const markerPath = path.join(recordDirectory(recordsRoot, record.transaction_id), "prepared.marker");
    const marker = await readJsonFile(markerPath);
    if (
      marker.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION
      || marker.transaction_id !== record.transaction_id
      || marker.transaction_plan_hash !== record.transaction_plan_hash
      || marker.recovery_checkpoint_id !== record.recovery_checkpoint_id
      || marker.source_snapshot_id !== record.source_snapshot_id
      || marker.target_snapshot_id !== record.target_snapshot_id
      || marker.git_head !== record.git_head
      || typeof marker.prepared_at !== "string"
      || !Number.isFinite(Date.parse(marker.prepared_at))
    ) {
      throw transactionError("TRANSACTION_PREPARED_MARKER_CORRUPT", "Prepared marker does not match immutable transaction plan.");
    }
    return marker;
  }

  async function readCommitMarker(record) {
    const { recordsRoot } = await roots();
    const markerPath = path.join(recordDirectory(recordsRoot, record.transaction_id), "commit.marker");
    const marker = await readJsonFile(markerPath);
    if (
      marker.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION
      || marker.transaction_id !== record.transaction_id
      || marker.transaction_plan_hash !== record.transaction_plan_hash
      || marker.target_snapshot_id !== record.target_snapshot_id
      || marker.git_head !== record.git_head
      || typeof marker.committed_at !== "string"
      || !Number.isFinite(Date.parse(marker.committed_at))
    ) {
      throw transactionError("TRANSACTION_COMMIT_MARKER_CORRUPT", "Commit marker does not match immutable transaction plan.");
    }
    return marker;
  }

  async function writePreparedMarker(record) {
    const { recordsRoot } = await roots();
    const marker = {
      schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
      transaction_id: record.transaction_id,
      transaction_plan_hash: record.transaction_plan_hash,
      recovery_checkpoint_id: record.recovery_checkpoint_id,
      source_snapshot_id: record.source_snapshot_id,
      target_snapshot_id: record.target_snapshot_id,
      git_head: record.git_head,
      prepared_at: clock().toISOString(),
    };
    await writeExclusiveDurable(path.join(recordDirectory(recordsRoot, record.transaction_id), "prepared.marker"), Buffer.from(`${canonicalJson(marker)}\n`, "utf8"));
    return marker;
  }

  async function writeCommitMarker(record) {
    const { recordsRoot } = await roots();
    const marker = {
      schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
      transaction_id: record.transaction_id,
      transaction_plan_hash: record.transaction_plan_hash,
      target_snapshot_id: record.target_snapshot_id,
      git_head: record.git_head,
      committed_at: clock().toISOString(),
    };
    await writeExclusiveDurable(path.join(recordDirectory(recordsRoot, record.transaction_id), "commit.marker"), Buffer.from(`${canonicalJson(marker)}\n`, "utf8"));
    return marker;
  }

  async function verifyCheckpointExact(record, checkpointId) {
    const context = await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: true, transactionId: record.transaction_id });
    const result = await checkpoint.verifyWorkspace(context, checkpointId);
    return { context, ...result };
  }

  async function reconcilePlan(record, plan, direction) {
    const desiredKey = direction === "source" ? "before" : "target";
    const allowedOtherKey = direction === "source" ? "target" : "before";
    const order = direction === "source" ? [...plan.execution_order].reverse() : [...plan.execution_order];
    const byPath = new Map(plan.transitions.map((item) => [item.path, item]));
    const context = await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: true, transactionId: record.transaction_id });
    for (const relativePath of order) {
      const transition = byPath.get(relativePath);
      const desired = transition[desiredKey];
      const other = transition[allowedOtherKey];
      const actual = await observeArtifact(context.root, transition.path);
      if (stateEquals(actual, plainState(desired))) continue;
      if (!stateEquals(actual, plainState(other))) {
        throw transactionError("AMBIGUOUS_EXTERNAL_MUTATION", `Actual state at ${transition.path} is neither transaction BEFORE nor TARGET. External/manual mutation will not be overwritten.`, { path: transition.path, actual, before: plainState(transition.before), target: plainState(transition.target) });
      }
      await applyState(context.root, transition, desired, checkpoint, context, record.transaction_id);
      const verified = await observeArtifact(context.root, transition.path);
      if (!stateEquals(verified, plainState(desired))) throw transactionError("TRANSACTION_ARTIFACT_VERIFY_FAILED", `Artifact transition verification failed for ${transition.path}.`);
      if (direction === "target") await hooks.afterTransition?.({ record: structuredClone(record), transition: structuredClone(transition) });
      else await hooks.duringRollback?.({ record: structuredClone(record), transition: structuredClone(transition) });
    }
  }

  async function markRecoveryRequired(record, error) {
    runtimeHealth = "degraded";
    lastHealthError = `${error.code ?? "TRANSACTION_RECOVERY_FAILED"}: ${error.message}`;
    await transition(record, "recovery_required", {
      health: "degraded",
      failure: { code: error.code ?? "TRANSACTION_RECOVERY_FAILED", message: String(error.message).slice(0, 1024), details: error.details ?? null },
      recovery: { required: true, last_attempt_at: clock().toISOString() },
    });
  }

  async function rollback(record, { recoveryOperation = false } = {}) {
    const operation = await beginEvidence(record, recoveryOperation ? "transaction_recovery" : "transaction_rollback", { direction: "source" });
    try {
      await transition(record, recoveryOperation ? "recovering" : "rolling_back", { health: "recovering", recovery: { required: false, direction: "source", last_attempt_at: clock().toISOString() } });
      await readPreparedMarker(record);
      if (!record.recovery_checkpoint_id) throw transactionError("TRANSACTION_RECOVERY_CHECKPOINT_MISSING", "Rollback requires the durable transaction recovery checkpoint.");
      const recoveryAuthority = await checkpoint.load(record.recovery_checkpoint_id, { verifyBlobs: true });
      if (
        recoveryAuthority.identity.internal_purpose !== "transaction_recovery"
        || recoveryAuthority.identity.internal_owner_transaction_id !== record.transaction_id
        || recoveryAuthority.identity.workspace_id !== record.workspace_id
        || recoveryAuthority.identity.git_head !== record.git_head
        || recoveryAuthority.identity.workspace_snapshot_id !== record.source_snapshot_id
      ) {
        throw transactionError("TRANSACTION_RECOVERY_CHECKPOINT_MISMATCH", "Rollback recovery checkpoint is not the exact server-owned transaction source authority.");
      }
      const plan = await loadPlan(record);
      await cleanupKnownPublishTemps(record, plan);
      await reconcilePlan(record, plan, "source");
      const head = await readGitHead((await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: true, transactionId: record.transaction_id })).root);
      if (head !== record.git_head) throw transactionError("TRANSACTION_HEAD_CHANGED", `Workspace HEAD changed during transaction; source snapshot cannot be declared exact without Git history rewind.`, { expected: record.git_head, actual: head });
      const exact = await verifyCheckpointExact(record, record.recovery_checkpoint_id);
      if (!exact.matches || exact.snapshot.workspace_snapshot_id !== record.source_snapshot_id) throw transactionError("TRANSACTION_SOURCE_VERIFY_FAILED", "Rollback did not reproduce the exact source checkpoint snapshot.");
      await transition(record, "rolled_back", { health: "healthy", completed_at: clock().toISOString(), recovery: { required: false, direction: "source", verified_at: clock().toISOString() } });
      await completeEvidence(record, operation, { final_snapshot_id: exact.snapshot.workspace_snapshot_id, rolled_back: true });
      await releaseBarrier(record);
      try { await checkpoint.retireRecovery(record.recovery_checkpoint_id); } catch {}
      return record;
    } catch (error) {
      await markRecoveryRequired(record, error);
      await failEvidence(record, operation, error, { recovery_required: true });
      throw error;
    }
  }

  async function finishCommitted(record, { recoveryOperation = false } = {}) {
    const operation = await beginEvidence(record, recoveryOperation ? "transaction_recovery" : "transaction_cleanup", { direction: "target" });
    try {
      await transition(record, recoveryOperation ? "recovering" : "cleaning", { health: "recovering", recovery: { required: false, direction: "target", last_attempt_at: clock().toISOString() } });
      await readPreparedMarker(record);
      await readCommitMarker(record);
      const plan = await loadPlan(record);
      await cleanupKnownPublishTemps(record, plan);
      await reconcilePlan(record, plan, "target");
      await assertGitPreconditions(await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: true, transactionId: record.transaction_id }), record.git_head);
      const exact = await verifyCheckpointExact(record, record.checkpoint_id);
      if (!exact.matches || exact.snapshot.workspace_snapshot_id !== record.target_snapshot_id) throw transactionError("TRANSACTION_TARGET_VERIFY_FAILED", "Committed transaction could not reproduce the exact target checkpoint snapshot.");
      await transition(record, "completed", { health: "healthy", completed_at: clock().toISOString(), recovery: { required: false, direction: "target", verified_at: clock().toISOString() } });
      await completeEvidence(record, operation, { final_snapshot_id: exact.snapshot.workspace_snapshot_id, completed: true });
      await releaseBarrier(record);
      try { await checkpoint.retireRecovery(record.recovery_checkpoint_id); } catch {}
      return record;
    } catch (error) {
      await markRecoveryRequired(record, error);
      await failEvidence(record, operation, error, { recovery_required: true });
      throw error;
    }
  }

  async function abandonPrePrepared(record, { emitEvidence = true, failure = null } = {}) {
    const operation = emitEvidence
      ? await beginEvidence(record, "transaction_recovery", { direction: "none", reason: "pre_prepared_abort" })
      : null;
    try {
      const context = await workspaceContextResolver(
        { workspace_id: record.workspace_id },
        { mutation: true, transactionId: record.transaction_id },
      );
      const source = await computeWorkspaceSnapshot(context);
      if (source.head !== record.git_head || source.workspace_snapshot_id !== record.source_snapshot_id) {
        throw transactionError(
          "TRANSACTION_PRE_PREPARED_SOURCE_CHANGED",
          "Workspace changed while a pre-PREPARED transaction barrier was held; automatic abandon is refused.",
          {
            expected_head: record.git_head,
            actual_head: source.head,
            expected_source_snapshot_id: record.source_snapshot_id,
            actual_source_snapshot_id: source.workspace_snapshot_id,
          },
        );
      }
      const ownedRecovery = await checkpoint.listRecoveryByOwner(record.transaction_id);
      for (const entry of ownedRecovery) {
        if (entry.state !== "active") continue;
        const loaded = await checkpoint.load(entry.checkpoint_id, { verifyBlobs: true });
        if (
          loaded.identity.workspace_id !== record.workspace_id
          || loaded.identity.git_head !== record.git_head
          || loaded.identity.workspace_snapshot_id !== record.source_snapshot_id
          || loaded.identity.internal_owner_transaction_id !== record.transaction_id
        ) {
          throw transactionError(
            "TRANSACTION_RECOVERY_CHECKPOINT_MISMATCH",
            "Transaction-owned pre-PREPARED recovery checkpoint does not match the exact source snapshot.",
          );
        }
      }
      await transition(record, "abandoned", {
        health: "healthy",
        completed_at: clock().toISOString(),
        failure: failure ?? record.failure,
        recovery: { required: false, reason: "pre_prepared_abort", verified_at: clock().toISOString() },
      });
      if (operation) {
        await completeEvidence(record, operation, {
          abandoned: true,
          final_snapshot_id: source.workspace_snapshot_id,
          owned_recovery_checkpoint_count: ownedRecovery.filter((entry) => entry.state === "active").length,
        });
      }
      await releaseBarrier(record);
      await checkpoint.retireRecoveryByOwner(record.transaction_id);
      const { recordsRoot } = await roots();
      await rm(path.join(recordDirectory(recordsRoot, record.transaction_id), "after-images"), { recursive: true, force: true });
      return record;
    } catch (error) {
      await markRecoveryRequired(record, error);
      if (operation) await failEvidence(record, operation, error, { recovery_required: true });
      throw error;
    }
  }

  async function recoverOne(record, { emitEvidence = true } = {}) {
    const markerState = await markers(record.transaction_id);
    if (!markerState.prepared) return abandonPrePrepared(record, { emitEvidence });
    await readPreparedMarker(record);
    if (markerState.commit) {
      await readCommitMarker(record);
      return finishCommitted(record, { recoveryOperation: emitEvidence });
    }
    return rollback(record, { recoveryOperation: emitEvidence });
  }

  async function restore(input = {}) {
    const allowed = new Set(["workspace_id", "checkpoint_id", "expected_current_snapshot_id"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw transactionError("TRANSACTION_SCHEMA_REJECTED", "dev_workspace_restore_checkpoint_in_place received unsupported fields.");
    const workspaceId = assertWorkspaceId(input.workspace_id);
    const checkpointId = assertCheckpointId(input.checkpoint_id);
    if (input.expected_current_snapshot_id !== undefined && !sha256Pattern.test(String(input.expected_current_snapshot_id).toLowerCase())) throw transactionError("TRANSACTION_INVALID_SNAPSHOT_CAS", "expected_current_snapshot_id must be an exact SHA-256 snapshot identity.");
    await assertSubsystemPreconditions();
    const targetCheckpoint = await checkpoint.load(checkpointId, { verifyBlobs: true });
    if (targetCheckpoint.entry.internal_purpose) throw transactionError("CHECKPOINT_INTERNAL", "Internal transaction recovery checkpoints cannot be restore targets.");
    let context = await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: true });
    if (context.workspace_type !== "isolated_worktree" || context.lifecycle_state !== "active" || context.healthy !== true || context.mutation_allowed !== true) throw transactionError("TRANSACTION_WORKSPACE_NOT_MUTABLE", "In-place restore requires one healthy active isolated workspace with mutation allowed.");
    if (targetCheckpoint.identity.workspace_id !== workspaceId) throw transactionError("CHECKPOINT_WORKSPACE_MISMATCH", "In-place restore checkpoint must belong to the same workspace. Use Phase 3B recovery fork for a different workspace.");
    if (targetCheckpoint.identity.git_head !== context.current_head) throw transactionError("CHECKPOINT_HEAD_MISMATCH", `Checkpoint HEAD ${targetCheckpoint.identity.git_head} does not match current workspace HEAD ${context.current_head}. Use Phase 3B recovery fork instead.`);
    await assertGitPreconditions(context, targetCheckpoint.identity.git_head);
    const initialSnapshot = await computeWorkspaceSnapshot(context);
    if (input.expected_current_snapshot_id && initialSnapshot.workspace_snapshot_id !== String(input.expected_current_snapshot_id).toLowerCase()) throw transactionError("TRANSACTION_SOURCE_SNAPSHOT_STALE", "Current workspace snapshot does not match expected_current_snapshot_id.");

    const transactionId = idGenerator();
    assertTransactionId(transactionId);
    let record;
    const createOperation = await journal.begin({
      operation_type: "checkpoint_restore_transaction_create",
      tool_name: "dev_workspace_restore_checkpoint_in_place",
      workstream_id: context.workstream_id,
      workspace_id: context.workspace_id,
      links: [{ relation: "used", checkpoint_id: checkpointId }, { relation: "used", workspace_snapshot_id: initialSnapshot.workspace_snapshot_id }],
      result: { transaction_id: transactionId, checkpoint_id: checkpointId, source_snapshot_id: initialSnapshot.workspace_snapshot_id, target_snapshot_id: targetCheckpoint.identity.workspace_snapshot_id, git_head: context.current_head },
    });
    try {
      record = await withStoreLock(async ({ recordsRoot, barriersRoot }) => {
        const existingBarrier = await readOptionalJson(barrierPath(barriersRoot, workspaceId));
        if (existingBarrier) throw transactionError("WORKSPACE_TRANSACTION_IN_PROGRESS", `Workspace ${workspaceId} already has active transaction ${existingBarrier.transaction_id}.`);
        const directory = recordDirectory(recordsRoot, transactionId);
        await mkdir(directory, { recursive: false });
        const now = clock().toISOString();
        const created = {
          schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
          transaction_id: transactionId,
          workspace_id: workspaceId,
          workstream_id: context.workstream_id,
          checkpoint_id: checkpointId,
          git_head: context.current_head,
          source_snapshot_id: initialSnapshot.workspace_snapshot_id,
          target_snapshot_id: targetCheckpoint.identity.workspace_snapshot_id,
          recovery_checkpoint_id: null,
          transaction_plan_hash: null,
          state: "preparing",
          health: "healthy",
          created_at: now,
          updated_at: now,
          prepared_at: null,
          committed_at: null,
          completed_at: null,
          failure: null,
          recovery: { required: false },
          provenance_operation_ids: [createOperation.operation_id],
        };
        await atomicWriteJson(path.join(directory, "transaction.json"), created);
        await createBarrierRecord(created, barriersRoot);
        return created;
      });
      await journal.complete(createOperation.operation_id, { result: { transaction_id: transactionId, checkpoint_id: checkpointId, state: "preparing", barrier_acquired: true } });
    } catch (error) {
      try { await journal.fail(createOperation.operation_id, { result: { transaction_id: transactionId, checkpoint_id: checkpointId, reason: String(error.message).slice(0, 1024) } }); } catch {}
      throw error;
    }

    let prepared = false;
    try {
      context = await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: true, transactionId });
      const targetAfterBarrier = await checkpoint.load(checkpointId, { verifyBlobs: true });
      if (
        targetAfterBarrier.identity.workspace_snapshot_id !== targetCheckpoint.identity.workspace_snapshot_id
        || targetAfterBarrier.identity.git_head !== targetCheckpoint.identity.git_head
        || targetAfterBarrier.identity.workspace_id !== targetCheckpoint.identity.workspace_id
      ) {
        throw transactionError("TRANSACTION_TARGET_CHANGED", "Target checkpoint identity changed after transaction barrier acquisition.");
      }
      const prepareOperation = await beginEvidence(record, "transaction_prepare", { source_snapshot_id: initialSnapshot.workspace_snapshot_id, target_snapshot_id: targetCheckpoint.identity.workspace_snapshot_id });
      try {
        const sourceAgain = await computeWorkspaceSnapshot(context);
        if (sourceAgain.workspace_snapshot_id !== initialSnapshot.workspace_snapshot_id || sourceAgain.head !== record.git_head) throw transactionError("TRANSACTION_SOURCE_CHANGED", "Workspace changed after transaction barrier acquisition and before preparation.");
        const recovery = await checkpoint.captureRecovery({ context, transactionId, parentOperationId: prepareOperation.operation_id });
        record.recovery_checkpoint_id = recovery.checkpoint_id;
        record.source_snapshot_id = recovery.workspace_snapshot_id;
        await writeRecord(record);
        if (recovery.workspace_snapshot_id !== sourceAgain.workspace_snapshot_id || recovery.git_head !== record.git_head) throw transactionError("TRANSACTION_RECOVERY_CHECKPOINT_MISMATCH", "Internal recovery checkpoint does not match exact transaction source snapshot.");
        await assertGitPreconditions(context, record.git_head);
        const recoveryLoaded = await checkpoint.load(record.recovery_checkpoint_id, { verifyBlobs: true });
        const plan = await buildPlan({ transactionId, context, targetCheckpoint, recoveryCheckpoint: recoveryLoaded, sourceSnapshotId: record.source_snapshot_id });
        await assertReservedPublishTempsAbsent(record, plan, context);
        record.transaction_plan_hash = plan.transaction_plan_hash;
        await writeRecord(record);
        await updateBarrier(record);
        const { recordsRoot } = await roots();
        await writeExclusiveDurable(path.join(recordDirectory(recordsRoot, transactionId), "plan.json"), Buffer.from(`${canonicalJson(plan)}\n`, "utf8"));
        await stageAfterImages(record, plan);
        await assertGitPreconditions(context, record.git_head);
        const sourceExact = await checkpoint.verifyWorkspace(context, record.recovery_checkpoint_id);
        if (!sourceExact.matches || sourceExact.snapshot.workspace_snapshot_id !== record.source_snapshot_id) throw transactionError("TRANSACTION_SOURCE_CHANGED", "Workspace source changed before PREPARED marker publication.");
        const marker = await writePreparedMarker(record);
        prepared = true;
        await transition(record, "prepared", { prepared_at: marker.prepared_at });
        await completeEvidence(record, prepareOperation, { prepared: true, recovery_checkpoint_id: record.recovery_checkpoint_id, source_snapshot_id: record.source_snapshot_id, target_snapshot_id: record.target_snapshot_id });
        await hooks.afterPrepared?.({ record: structuredClone(record), plan: structuredClone(plan) });
      } catch (error) {
        await failEvidence(record, prepareOperation, error, { prepared });
        throw error;
      }

      const applyOperation = await beginEvidence(record, "transaction_apply", { direction: "target" });
      try {
        await transition(record, "applying");
        const plan = await loadPlan(record);
        await reconcilePlan(record, plan, "target");
        await transition(record, "verifying");
        await assertGitPreconditions(await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: true, transactionId }), record.git_head);
        const exact = await verifyCheckpointExact(record, record.checkpoint_id);
        if (!exact.matches || exact.snapshot.workspace_snapshot_id !== record.target_snapshot_id) throw transactionError("TRANSACTION_TARGET_VERIFY_FAILED", "Applied transaction does not match exact target checkpoint snapshot.");
        await completeEvidence(record, applyOperation, { target_applied: true, final_snapshot_id: exact.snapshot.workspace_snapshot_id });
        await hooks.beforeCommitMarker?.({ record: structuredClone(record), plan: structuredClone(plan) });
      } catch (error) {
        await failEvidence(record, applyOperation, error, { target_applied: false });
        throw error;
      }

      const commitOperation = await beginEvidence(record, "transaction_commit", { target_snapshot_id: record.target_snapshot_id });
      try {
        await assertGitPreconditions(await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: true, transactionId }), record.git_head);
        const exactBeforeMarker = await verifyCheckpointExact(record, record.checkpoint_id);
        if (!exactBeforeMarker.matches || exactBeforeMarker.snapshot.workspace_snapshot_id !== record.target_snapshot_id) throw transactionError("TRANSACTION_TARGET_VERIFY_FAILED", "Target snapshot changed before durable commit point.");
        const marker = await writeCommitMarker(record);
        await transition(record, "committed", { committed_at: marker.committed_at });
        await completeEvidence(record, commitOperation, { committed: true, commit_marker: true, final_snapshot_id: exactBeforeMarker.snapshot.workspace_snapshot_id });
        await hooks.afterCommitMarker?.({ record: structuredClone(record) });
      } catch (error) {
        await failEvidence(record, commitOperation, error, { committed: false });
        throw error;
      }
      await finishCommitted(record);
      return publicRecord(record, await markers(record.transaction_id));
    } catch (error) {
      if (error?.code === "SIMULATED_TRANSACTION_CRASH") throw error;
      const markerState = await markers(record.transaction_id).catch(() => ({ prepared: false, commit: false }));
      if (!markerState.prepared) {
        try {
          await abandonPrePrepared(record, {
            emitEvidence: true,
            failure: {
              code: error.code ?? "TRANSACTION_PREPARE_FAILED",
              message: String(error.message).slice(0, 1024),
            },
          });
        } catch {}
        throw error;
      }
      if (markerState.commit) {
        try { await finishCommitted(record, { recoveryOperation: true }); } catch {}
        throw error;
      }
      try { await rollback(record, { recoveryOperation: true }); } catch {}
      throw error;
    }
  }

  async function get(input = {}) {
    const allowed = new Set(["transaction_id"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw transactionError("TRANSACTION_SCHEMA_REJECTED", "dev_workspace_get_transaction accepts transaction_id only.");
    const { record } = await readRecord(assertTransactionId(input.transaction_id));
    return publicRecord(record, await markers(record.transaction_id));
  }

  async function list(input = {}) {
    const allowed = new Set(["workspace_id", "checkpoint_id", "state", "limit"]);
    if (!isObject(input) || Object.keys(input).some((key) => !allowed.has(key))) throw transactionError("TRANSACTION_SCHEMA_REJECTED", "dev_workspace_list_transactions received unsupported filters.");
    if (input.workspace_id !== undefined) assertWorkspaceId(input.workspace_id);
    if (input.checkpoint_id !== undefined) assertCheckpointId(input.checkpoint_id);
    if (input.state !== undefined && !stateSet.has(input.state)) throw transactionError("TRANSACTION_STATE_INVALID", "state filter is invalid.");
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_TRANSACTION_MAX_LIST_RESULTS) throw transactionError("TRANSACTION_LIST_LIMIT", `limit must be 1-${DEV_TRANSACTION_MAX_LIST_RESULTS}.`);
    const { recordsRoot } = await roots();
    const entries = await readdir(recordsRoot, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !transactionIdPattern.test(entry.name)) { runtimeHealth = "corrupt"; lastHealthError = `Unexpected transaction record entry: ${entry.name}.`; continue; }
      try {
        const { record } = await readRecord(entry.name);
        if (input.workspace_id && record.workspace_id !== input.workspace_id) continue;
        if (input.checkpoint_id && record.checkpoint_id !== input.checkpoint_id) continue;
        if (input.state && record.state !== input.state) continue;
        records.push(publicRecord(record, await markers(record.transaction_id)));
      } catch (error) {
        runtimeHealth = "corrupt"; lastHealthError = error.message;
      }
    }
    records.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { total: records.length, returned: Math.min(records.length, limit), truncated: records.length > limit, transactions: records.slice(0, limit) };
  }

  async function inspectRecordHealth(record) {
    const issues = [];
    const addIssue = (severity, code, message) => issues.push({ severity, code, message: String(message).slice(0, 512) });
    let markerState = { prepared: false, commit: false };
    try {
      markerState = await markers(record.transaction_id);
    } catch (error) {
      addIssue("corrupt", error.code ?? "TRANSACTION_MARKER_INSPECTION_FAILED", error.message);
      return { issues, reclaimable_prepared_false_staging: false };
    }

    const preparedRequired = markerState.prepared
      || record.prepared_at !== null
      || record.transaction_plan_hash !== null
      || new Set(["prepared", "applying", "verifying", "committed", "cleaning", "rolling_back", "rolled_back", "recovering", "completed"]).has(record.state);
    const commitRequired = markerState.commit || new Set(["committed", "cleaning", "completed"]).has(record.state);
    if (record.transaction_plan_hash !== null || preparedRequired) {
      if (!record.transaction_plan_hash) addIssue("corrupt", "TRANSACTION_PLAN_MISSING", "Prepared-or-later transaction is missing transaction_plan_hash.");
      else {
        try { await loadPlan(record); } catch (error) { addIssue("corrupt", error.code ?? "TRANSACTION_PLAN_CORRUPT", error.message); }
      }
    }
    if (preparedRequired && !markerState.prepared) addIssue("corrupt", "TRANSACTION_PREPARED_MARKER_MISSING", "Prepared-or-later transaction is missing prepared.marker.");
    if (markerState.prepared) {
      try { await readPreparedMarker(record); } catch (error) { addIssue("corrupt", error.code ?? "TRANSACTION_PREPARED_MARKER_CORRUPT", error.message); }
    }
    if (commitRequired && !markerState.commit) addIssue("corrupt", "TRANSACTION_COMMIT_MARKER_MISSING", "Committed-or-later transaction is missing commit.marker.");
    if (markerState.commit) {
      try { await readCommitMarker(record); } catch (error) { addIssue("corrupt", error.code ?? "TRANSACTION_COMMIT_MARKER_CORRUPT", error.message); }
    }

    const { recordsRoot, barriersRoot } = await roots();
    let reclaimablePreparedFalseStaging = false;
    const afterImages = path.join(recordDirectory(recordsRoot, record.transaction_id), "after-images");
    try {
      const info = await lstat(afterImages);
      if (info.isSymbolicLink() || !info.isDirectory()) addIssue("corrupt", "TRANSACTION_STAGING_CORRUPT", "Transaction after-image staging path is not a safe directory.");
      else if (!markerState.prepared && new Set(["created", "preparing", "abandoned"]).has(record.state)) reclaimablePreparedFalseStaging = true;
    } catch (error) {
      if (error?.code !== "ENOENT") addIssue("corrupt", "TRANSACTION_STAGING_INSPECTION_FAILED", error.message);
    }

    let barrier = null;
    try { barrier = await readOptionalJson(barrierPath(barriersRoot, record.workspace_id)); } catch (error) { addIssue("corrupt", "TRANSACTION_BARRIER_CORRUPT", error.message); }
    if (barrierStateSet.has(record.state)) {
      if (!barrier) addIssue("degraded", "TRANSACTION_BARRIER_MISSING", `Active transaction ${record.transaction_id} has no persistent workspace barrier.`);
      else if (
        !isObject(barrier)
        || barrier.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION
        || barrier.workspace_id !== record.workspace_id
        || barrier.transaction_id !== record.transaction_id
        || barrier.transaction_plan_hash !== record.transaction_plan_hash
      ) addIssue("corrupt", "TRANSACTION_BARRIER_CORRUPT", `Workspace barrier does not match transaction ${record.transaction_id}.`);
      else if (barrier.state !== record.state) addIssue("degraded", "TRANSACTION_BARRIER_STATE_DRIFT", `Workspace barrier state ${barrier.state} differs from transaction state ${record.state}; recovery must reconcile it.`);
    } else if (barrier?.transaction_id === record.transaction_id) {
      addIssue("degraded", "TRANSACTION_STALE_TERMINAL_BARRIER", `Terminal transaction ${record.transaction_id} still owns a workspace barrier.`);
    }

    if (!terminalStateSet.has(record.state)) {
      try {
        await workspaceContextResolver({ workspace_id: record.workspace_id }, { mutation: false, transactionId: record.transaction_id });
      } catch (error) {
        addIssue("degraded", "TRANSACTION_WORKSPACE_UNAVAILABLE", error.message);
      }
      try {
        await checkpoint.load(record.checkpoint_id, { verifyBlobs: true });
      } catch (error) {
        addIssue("degraded", "TRANSACTION_TARGET_CHECKPOINT_UNAVAILABLE", error.message);
      }
      if (record.recovery_checkpoint_id) {
        try {
          const recoveryCheckpoint = await checkpoint.load(record.recovery_checkpoint_id, { verifyBlobs: true });
          if (
            recoveryCheckpoint.identity.internal_purpose !== "transaction_recovery"
            || recoveryCheckpoint.identity.internal_owner_transaction_id !== record.transaction_id
          ) addIssue("corrupt", "TRANSACTION_RECOVERY_CHECKPOINT_OWNER_MISMATCH", "Recovery checkpoint ownership does not match transaction identity.");
        } catch (error) { addIssue("degraded", "TRANSACTION_RECOVERY_CHECKPOINT_UNAVAILABLE", error.message); }
      } else if (preparedRequired) {
        addIssue("degraded", "TRANSACTION_RECOVERY_CHECKPOINT_MISSING", "Prepared-or-later transaction has no recovery checkpoint identity.");
      }
    }

    try {
      const ownedRecovery = await checkpoint.listRecoveryByOwner(record.transaction_id);
      const activeOwnedRecovery = ownedRecovery.filter((entry) => entry.state === "active");
      if (terminalStateSet.has(record.state) && activeOwnedRecovery.length > 0) {
        addIssue("degraded", "TRANSACTION_RECOVERY_CHECKPOINT_CLEANUP_PENDING", `Terminal transaction still owns ${activeOwnedRecovery.length} active internal recovery checkpoint(s).`);
      }
    } catch (error) {
      addIssue("degraded", "TRANSACTION_RECOVERY_CHECKPOINT_OWNER_SCAN_FAILED", error.message);
    }

    return { issues, reclaimable_prepared_false_staging: reclaimablePreparedFalseStaging };
  }

  async function status() {
    let listed;
    try { listed = await list({ limit: DEV_TRANSACTION_MAX_LIST_RESULTS }); }
    catch (error) {
      runtimeHealth = "corrupt";
      lastHealthError = String(error.message).slice(0, 1024);
      return {
        schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
        health: "corrupt",
        active_transaction_count: null,
        active_transactions: [],
        blocked_workspace_count: null,
        blocked_workspaces: [],
        recovery_required_count: null,
        recovery_required_transactions: [],
        checkpoint_store_health: null,
        integrity_issue_count: 1,
        integrity_issues: [{ severity: "corrupt", code: error.code ?? "TRANSACTION_STORE_CORRUPT", message: String(error.message).slice(0, 512) }],
        orphan_prepared_false_staging_count: null,
        last_health_error: lastHealthError,
        storage: "server_owned_transaction_records_and_workspace_barriers",
      };
    }

    const inspections = [];
    for (const transaction of listed.transactions) {
      try {
        const { record } = await readRecord(transaction.transaction_id);
        inspections.push({ transaction_id: record.transaction_id, ...(await inspectRecordHealth(record)) });
      } catch (error) {
        inspections.push({ transaction_id: transaction.transaction_id, issues: [{ severity: "corrupt", code: error.code ?? "TRANSACTION_STORE_CORRUPT", message: String(error.message).slice(0, 512) }], reclaimable_prepared_false_staging: false });
      }
    }
    const checkpointStatus = await checkpoint.status().catch((error) => ({ health: "corrupt", last_health_error: String(error.message).slice(0, 512) }));
    const integrityIssues = inspections.flatMap((inspection) => inspection.issues.map((issue) => ({ transaction_id: inspection.transaction_id, ...issue })));
    if (checkpointStatus.health !== "healthy") integrityIssues.push({ transaction_id: null, severity: "degraded", code: "CHECKPOINT_STORE_NOT_HEALTHY", message: `Checkpoint store health is ${checkpointStatus.health}.` });

    // Validate the persistent barrier mapping in the reverse direction as well:
    // an orphan/malformed barrier must keep the workspace fail-closed and make
    // subsystem corruption visible instead of being silently omitted because no
    // readable transaction record pointed back to it.
    const persistentBarrierWorkspaces = new Set();
    try {
      const { barriersRoot } = await roots();
      const barrierEntries = await readdir(barriersRoot, { withFileTypes: true });
      for (const entry of barrierEntries) {
        const workspaceId = entry.name.endsWith(".json") ? entry.name.slice(0, -5) : null;
        if (workspaceIdPattern.test(workspaceId ?? "")) persistentBarrierWorkspaces.add(workspaceId);
        if (!entry.isFile() || entry.isSymbolicLink?.() || !workspaceIdPattern.test(workspaceId ?? "")) {
          integrityIssues.push({ transaction_id: null, severity: "corrupt", code: "TRANSACTION_BARRIER_STORE_CORRUPT", message: `Unexpected persistent barrier entry: ${entry.name}.` });
          continue;
        }
        let barrier;
        try { barrier = await readJsonFile(path.join(barriersRoot, entry.name)); }
        catch (error) {
          integrityIssues.push({ transaction_id: null, severity: "corrupt", code: "TRANSACTION_BARRIER_CORRUPT", message: String(error.message).slice(0, 512) });
          continue;
        }
        if (
          !isObject(barrier)
          || barrier.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION
          || barrier.workspace_id !== workspaceId
          || !transactionIdPattern.test(barrier.transaction_id ?? "")
          || !stateSet.has(barrier.state)
        ) {
          integrityIssues.push({ transaction_id: barrier?.transaction_id ?? null, severity: "corrupt", code: "TRANSACTION_BARRIER_CORRUPT", message: `Persistent barrier ${entry.name} has invalid identity/state metadata.` });
          continue;
        }
        try {
          const { record } = await readRecord(barrier.transaction_id);
          if (
            record.workspace_id !== workspaceId
            || !barrierStateSet.has(record.state)
            || barrier.state !== record.state
            || barrier.transaction_plan_hash !== record.transaction_plan_hash
          ) {
            integrityIssues.push({ transaction_id: record.transaction_id, severity: "corrupt", code: "TRANSACTION_BARRIER_MAPPING_MISMATCH", message: `Persistent barrier ${entry.name} does not match its authoritative transaction record.` });
          }
        } catch (error) {
          integrityIssues.push({ transaction_id: barrier.transaction_id, severity: "corrupt", code: "TRANSACTION_ORPHAN_BARRIER", message: `Persistent barrier ${entry.name} has no readable authoritative transaction record: ${String(error.message).slice(0, 384)}` });
        }
      }
    } catch (error) {
      integrityIssues.push({ transaction_id: null, severity: "corrupt", code: "TRANSACTION_BARRIER_STORE_CORRUPT", message: String(error.message).slice(0, 512) });
    }

    const active = listed.transactions.filter((item) => barrierStateSet.has(item.state));
    const blockedWorkspaces = new Set([...active.map((item) => item.workspace_id), ...persistentBarrierWorkspaces]);
    const recoveryRequired = listed.transactions.filter((item) => item.state === "recovery_required");
    const recovering = listed.transactions.filter((item) => ["recovering", "rolling_back", "cleaning"].includes(item.state));
    const hasCorrupt = integrityIssues.some((issue) => issue.severity === "corrupt") || runtimeHealth === "corrupt";
    const hasDegraded = integrityIssues.some((issue) => issue.severity === "degraded") || recoveryRequired.length > 0 || runtimeHealth === "degraded";
    const health = hasCorrupt ? "corrupt" : hasDegraded ? "degraded" : recovering.length > 0 ? "recovering" : "healthy";
    if (health === "corrupt") runtimeHealth = "corrupt";
    else if (health === "degraded") runtimeHealth = "degraded";
    if (integrityIssues.length > 0) lastHealthError = `${integrityIssues[0].code}: ${integrityIssues[0].message}`.slice(0, 1024);
    return {
      schema_version: DEV_TRANSACTION_SCHEMA_VERSION,
      health,
      active_transaction_count: active.length,
      active_transactions: active.map((item) => item.transaction_id),
      blocked_workspace_count: blockedWorkspaces.size,
      blocked_workspaces: [...blockedWorkspaces],
      recovery_required_count: recoveryRequired.length,
      recovery_required_transactions: recoveryRequired.map((item) => item.transaction_id),
      checkpoint_store_health: checkpointStatus.health,
      integrity_issue_count: integrityIssues.length,
      integrity_issues: integrityIssues.slice(0, DEV_TRANSACTION_MAX_LIST_RESULTS),
      orphan_prepared_false_staging_count: inspections.filter((inspection) => inspection.reclaimable_prepared_false_staging).length,
      last_health_error: lastHealthError,
      storage: "server_owned_transaction_records_and_workspace_barriers",
    };
  }

  async function initialize() {
    await roots();
    runtimeHealth = "recovering";
    lastHealthError = null;
    const { recordsRoot } = await roots();
    const entries = await readdir(recordsRoot, { withFileTypes: true });
    let recovered = 0;
    let abandoned = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !transactionIdPattern.test(entry.name)) {
        runtimeHealth = "corrupt";
        lastHealthError = `Unexpected transaction store entry: ${entry.name}.`;
        continue;
      }
      let record;
      try { ({ record } = await readRecord(entry.name)); } catch (error) { runtimeHealth = "corrupt"; lastHealthError = error.message; continue; }
      if (terminalStateSet.has(record.state)) {
        await releaseBarrier(record).catch(() => {});
        continue;
      }
      try {
        const before = record.state;
        await recoverOne(record, { emitEvidence: true });
        if (before === "preparing" || before === "created") abandoned += 1;
        else recovered += 1;
      } catch (error) {
        runtimeHealth = error.code === "AMBIGUOUS_EXTERNAL_MUTATION" ? "degraded" : "degraded";
        lastHealthError = `${record.transaction_id}: ${error.message}`;
      }
    }
    const current = await status();
    if (current.health === "healthy") runtimeHealth = "healthy";
    return { ...current, recovered_transactions: recovered, abandoned_prepared_false_transactions: abandoned };
  }

  async function assertWorkspaceAvailable(workspaceId, { transactionId = null } = {}) {
    if (!workspaceIdPattern.test(workspaceId ?? "")) return;
    const { barriersRoot } = await roots();
    const barrier = await readOptionalJson(barrierPath(barriersRoot, workspaceId));
    if (!barrier) return;
    if (!isObject(barrier) || barrier.schema_version !== DEV_TRANSACTION_SCHEMA_VERSION || barrier.workspace_id !== workspaceId || !transactionIdPattern.test(barrier.transaction_id ?? "") || !stateSet.has(barrier.state)) {
      throw transactionError("TRANSACTION_BARRIER_CORRUPT", `Workspace ${workspaceId} transaction barrier is corrupt.`);
    }
    if (transactionId && barrier.transaction_id === transactionId) return;
    throw transactionError("WORKSPACE_TRANSACTION_IN_PROGRESS", `Workspace ${workspaceId} is blocked by active transaction ${barrier.transaction_id} (${barrier.state}).`, { transaction_id: barrier.transaction_id, state: barrier.state });
  }

  async function inspectOperationEffect(started) {
    const transactionId = started?.result?.transaction_id;
    if (!transactionIdPattern.test(transactionId ?? "")) return { outcome: "ambiguous_effect", reconciliation_required: true };
    try {
      const { record } = await readRecord(transactionId);
      if (!terminalStateSet.has(record.state)) await recoverOne(record, { emitEvidence: false });
      const refreshed = (await readRecord(transactionId)).record;
      if (refreshed.state === "completed") return { outcome: "intended_effect_observed", reconciliation_required: false };
      if (refreshed.state === "rolled_back" || refreshed.state === "abandoned") return { outcome: "no_effect_observed", reconciliation_required: false };
      return { outcome: "ambiguous_effect", reconciliation_required: true };
    } catch (error) {
      if (error?.code === "ENOENT") return { outcome: "no_effect_observed", reconciliation_required: false };
      return { outcome: "ambiguous_effect", reconciliation_required: true };
    }
  }

  return { restore, get, list, status, initialize, inspectOperationEffect, assertWorkspaceAvailable, storageRoot };
}

const defaultTransactionService = createDevTransactionService();

export const assertDevWorkspaceTransactionAvailable = (workspaceId, options) => defaultTransactionService.assertWorkspaceAvailable(workspaceId, options);

export const dev_workspace_restore_checkpoint_in_place = (input) => defaultTransactionService.restore(input);
export const dev_workspace_get_transaction = (input) => defaultTransactionService.get(input);
export const dev_workspace_list_transactions = (input) => defaultTransactionService.list(input);
export const dev_workspace_transaction_status = () => defaultTransactionService.status();
export const initializeDevTransactionRuntime = () => defaultTransactionService.initialize();
export const inspectDevTransactionOperationEffect = (started) => defaultTransactionService.inspectOperationEffect(started);
