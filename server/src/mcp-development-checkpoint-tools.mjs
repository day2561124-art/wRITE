import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  assertAllowedPathPolicy,
  assertExistingSafePath,
  createDevGitTools,
  decodeText,
  isSecretName,
  isSupportedTextPath,
} from "./mcp-development-readonly-tools.mjs";
import { assertDevelopmentRelativePathPolicy } from "./mcp-development-write-tools.mjs";
import {
  beginDevJournalOperation,
  canonicalJson,
  completeDevJournalOperation,
  computeWorkspaceSnapshot,
  failDevJournalOperation,
  markDevJournalDegraded,
} from "./mcp-development-journal-tools.mjs";
import {
  beginDevCheckpointRecoveryWorkstream,
  createDevCheckpointRecoveryIsolated,
  listDevCheckpointRecoveryWorkspaces,
  resolveDevCheckpointRecoveryExecutionContext,
  resolveDevWorkspaceExecutionContext,
  transitionDevCheckpointRecoveryWorkspace,
} from "./mcp-development-workstream-tools.mjs";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths, projectRoot } from "./project-paths.mjs";

const execFileAsync = promisify(execFile);
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";

export const DEV_CHECKPOINT_SCHEMA_VERSION = 1;
export const DEV_CHECKPOINT_ID_PATTERN_SOURCE = "^dev_checkpoint_[a-f0-9]{32}$";
export const DEV_CHECKPOINT_STATES = Object.freeze(["active", "deleted"]);
export const DEV_CHECKPOINT_STORE_HEALTH = Object.freeze(["healthy", "degraded", "corrupt", "recovering"]);
export const DEV_CHECKPOINT_MAX_ARTIFACTS = 256;
export const DEV_CHECKPOINT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const DEV_CHECKPOINT_MAX_LOGICAL_BYTES = 32 * 1024 * 1024;
export const DEV_CHECKPOINT_MAX_MANIFEST_BYTES = 512 * 1024;
export const DEV_CHECKPOINT_MAX_CHECKPOINTS_PER_WORKSPACE = 50;
export const DEV_CHECKPOINT_MAX_CHECKPOINTS_PER_WORKSTREAM = 100;
export const DEV_CHECKPOINT_MAX_PHYSICAL_BLOB_BYTES = 512 * 1024 * 1024;
export const DEV_CHECKPOINT_MAX_LIST_RESULTS = 100;
export const DEV_CHECKPOINT_MAX_READ_BYTES = 256 * 1024;
export const DEV_CHECKPOINT_MAX_DIRECTORY_SCAN_ENTRIES = 10_000;

export const DEV_CHECKPOINT_STORAGE_ROOT = process.env.WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT === "1"
  ? path.join(os.tmpdir(), `writer-workbench-checkpoint-test-${process.pid}`, "checkpoints")
  : path.join(projectPaths.outputLogs, "development_runtime", "checkpoints");

const checkpointIdPattern = new RegExp(DEV_CHECKPOINT_ID_PATTERN_SOURCE, "u");
const workstreamIdPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const workspaceIdPattern = /^dev_workspace_[a-f0-9]{24}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const checkpointStateSet = new Set(DEV_CHECKPOINT_STATES);
const generatedDirectoryNames = new Set([
  ".cache", ".next", ".nuxt", ".output", ".parcel-cache", ".pytest_cache", ".ruff_cache",
  ".turbo", ".vite", "assets", "build", "cache", "coverage", "dist", "generated", "logs",
  "node_modules", "out", "outputs", "target", "temp", "tmp",
]);
const approvedTopLevelDirectories = new Set([
  ".github", "changelog", "config", "docs", "policies", "prompts", "runbooks", "schemas", "scripts", "server", "tests",
]);

const defaultQuotas = Object.freeze({
  maxArtifacts: DEV_CHECKPOINT_MAX_ARTIFACTS,
  maxFileBytes: DEV_CHECKPOINT_MAX_FILE_BYTES,
  maxLogicalBytes: DEV_CHECKPOINT_MAX_LOGICAL_BYTES,
  maxManifestBytes: DEV_CHECKPOINT_MAX_MANIFEST_BYTES,
  maxCheckpointsPerWorkspace: DEV_CHECKPOINT_MAX_CHECKPOINTS_PER_WORKSPACE,
  maxCheckpointsPerWorkstream: DEV_CHECKPOINT_MAX_CHECKPOINTS_PER_WORKSTREAM,
  maxPhysicalBlobBytes: DEV_CHECKPOINT_MAX_PHYSICAL_BLOB_BYTES,
  maxDirectoryScanEntries: DEV_CHECKPOINT_MAX_DIRECTORY_SCAN_ENTRIES,
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function checkpointError(code, message, details = {}) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertObjectKeys(input, label, allowed) {
  if (!isObject(input)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} does not accept ${unknown.sort().join(", ")}.`);
}

function boundedLabel(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error("label must be a non-blank string when provided.");
  const normalized = value.trim();
  if (Array.from(normalized).length > 160) throw new Error("label exceeds 160 characters.");
  if (/\u0000/u.test(normalized)) throw new Error("label cannot contain NUL.");
  return normalized;
}

function assertCheckpointId(value) {
  if (!checkpointIdPattern.test(value ?? "")) throw new Error("checkpoint_id must be a server-issued checkpoint ID.");
  return value;
}

function assertWorkspaceId(value) {
  if (!workspaceIdPattern.test(value ?? "")) throw new Error("workspace_id must be a server-issued isolated workspace ID.");
  return value;
}

function normalizeRelativePath(value, label = "path") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-blank workspace-relative path.`);
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (path.isAbsolute(normalized) || /^[A-Za-z]:[\\/]/u.test(normalized) || normalized.split("/").includes("..") || /\u0000/u.test(normalized)) {
    throw new Error(`${label} must be a canonical workspace-relative path.`);
  }
  return normalized;
}

function assertCheckpointDevelopmentPath(relativePath, repositoryRoot) {
  const normalized = normalizeRelativePath(relativePath);
  try {
    assertDevelopmentRelativePathPolicy(normalized, "checkpoint artifact path");
    assertAllowedPathPolicy(path.resolve(repositoryRoot, normalized), "checkpoint artifact path", repositoryRoot);
  } catch (error) {
    throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", error.message, { path: normalized });
  }
  return normalized;
}

function registryPayload(registry) {
  return {
    schema_version: registry.schema_version,
    revision: registry.revision,
    updated_at: registry.updated_at,
    checkpoints: registry.checkpoints,
  };
}

function registryChecksum(registry) {
  return sha256Text(canonicalJson(registryPayload(registry)));
}

function emptyRegistry() {
  return {
    schema_version: DEV_CHECKPOINT_SCHEMA_VERSION,
    revision: 0,
    updated_at: null,
    checkpoints: [],
    checksum_sha256: null,
  };
}

function validateRegistryEntry(entry) {
  if (!isObject(entry)) throw new Error("Checkpoint registry entry is invalid.");
  assertCheckpointId(entry.checkpoint_id);
  if (!sha256Pattern.test(entry.checkpoint_content_id ?? "")) throw new Error("Checkpoint registry content identity is invalid.");
  if (!checkpointStateSet.has(entry.state)) throw new Error("Checkpoint registry state is invalid.");
  if (!workstreamIdPattern.test(entry.workstream_id ?? "") || !workspaceIdPattern.test(entry.workspace_id ?? "")) throw new Error("Checkpoint registry source identity is invalid.");
  if (!gitSha1Pattern.test(entry.git_head ?? "") || !sha256Pattern.test(entry.workspace_snapshot_id ?? "")) throw new Error("Checkpoint registry source snapshot identity is invalid.");
  if (typeof entry.created_at !== "string" || !Number.isFinite(Date.parse(entry.created_at))) throw new Error("Checkpoint registry created_at is invalid.");
  if (entry.deleted_at !== null && (typeof entry.deleted_at !== "string" || !Number.isFinite(Date.parse(entry.deleted_at)))) throw new Error("Checkpoint registry deleted_at is invalid.");
  if (entry.label !== null) boundedLabel(entry.label);
  if (!sha256Pattern.test(entry.manifest_identity ?? "")) throw new Error("Checkpoint registry manifest identity is invalid.");
  if (typeof entry.provenance_operation_id !== "string" || !/^dev_operation_[a-f0-9]{32}$/u.test(entry.provenance_operation_id)) throw new Error("Checkpoint registry provenance operation identity is invalid.");
  return entry;
}

function validateRegistry(registry) {
  if (!isObject(registry) || registry.schema_version !== DEV_CHECKPOINT_SCHEMA_VERSION) throw new Error("Checkpoint registry schema is invalid.");
  if (!Number.isSafeInteger(registry.revision) || registry.revision < 0) throw new Error("Checkpoint registry revision is invalid.");
  if (registry.updated_at !== null && (typeof registry.updated_at !== "string" || !Number.isFinite(Date.parse(registry.updated_at)))) throw new Error("Checkpoint registry updated_at is invalid.");
  if (!Array.isArray(registry.checkpoints) || registry.checkpoints.length > 10_000) throw new Error("Checkpoint registry checkpoint collection is invalid.");
  const seen = new Set();
  for (const entry of registry.checkpoints) {
    validateRegistryEntry(entry);
    if (seen.has(entry.checkpoint_id)) throw new Error(`Duplicate checkpoint registry identity: ${entry.checkpoint_id}.`);
    seen.add(entry.checkpoint_id);
  }
  if (registry.revision === 0 && registry.checkpoints.length === 0) {
    if (registry.checksum_sha256 !== null) throw new Error("Empty checkpoint registry checksum must be null.");
    return registry;
  }
  if (!sha256Pattern.test(registry.checksum_sha256 ?? "") || registryChecksum(registry) !== registry.checksum_sha256) {
    throw new Error("Checkpoint registry checksum mismatch.");
  }
  return registry;
}

function encodeRegistry(registry) {
  const next = { ...registry, checksum_sha256: registryChecksum(registry) };
  validateRegistry(next);
  return `${canonicalJson(next)}\n`;
}

function checkpointIdentityPayload(manifest) {
  const { manifest_identity: ignored, ...payload } = manifest;
  return payload;
}

function validateIdentityManifest(manifest) {
  if (!isObject(manifest) || manifest.schema_version !== DEV_CHECKPOINT_SCHEMA_VERSION) throw new Error("Checkpoint identity manifest schema is invalid.");
  assertCheckpointId(manifest.checkpoint_id);
  if (!sha256Pattern.test(manifest.checkpoint_content_id ?? "")) throw new Error("Checkpoint identity manifest content ID is invalid.");
  if (!workstreamIdPattern.test(manifest.workstream_id ?? "") || !workspaceIdPattern.test(manifest.workspace_id ?? "")) throw new Error("Checkpoint identity manifest source identity is invalid.");
  if (!gitSha1Pattern.test(manifest.workstream_base_head ?? "") || !gitSha1Pattern.test(manifest.git_head ?? "")) throw new Error("Checkpoint identity manifest Git identity is invalid.");
  if (!sha256Pattern.test(manifest.workspace_snapshot_id ?? "")) throw new Error("Checkpoint identity manifest snapshot ID is invalid.");
  if (typeof manifest.created_at !== "string" || !Number.isFinite(Date.parse(manifest.created_at))) throw new Error("Checkpoint identity manifest created_at is invalid.");
  if (manifest.label !== null) boundedLabel(manifest.label);
  if (!Number.isSafeInteger(manifest.artifact_count) || manifest.artifact_count < 0) throw new Error("Checkpoint identity artifact count is invalid.");
  if (!Number.isSafeInteger(manifest.logical_bytes) || manifest.logical_bytes < 0) throw new Error("Checkpoint identity logical bytes are invalid.");
  if (!/^dev_operation_[a-f0-9]{32}$/u.test(manifest.provenance_operation_id ?? "")) throw new Error("Checkpoint identity provenance operation is invalid.");
  const computed = sha256Text(canonicalJson(checkpointIdentityPayload(manifest)));
  if (manifest.manifest_identity !== computed) throw new Error("Checkpoint identity manifest hash mismatch.");
  return manifest;
}

function validateContentManifest(manifest, expectedContentId = null) {
  if (!isObject(manifest) || manifest.schema_version !== DEV_CHECKPOINT_SCHEMA_VERSION || manifest.format !== "git-head-overlay-v1") throw new Error("Checkpoint content manifest schema is invalid.");
  if (!gitSha1Pattern.test(manifest.git_head ?? "") || !sha256Pattern.test(manifest.workspace_snapshot_id ?? "")) throw new Error("Checkpoint content manifest source identity is invalid.");
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length > DEV_CHECKPOINT_MAX_ARTIFACTS) throw new Error("Checkpoint content manifest artifact collection is invalid.");
  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    if (!isObject(artifact)) throw new Error("Checkpoint artifact descriptor is invalid.");
    const normalized = normalizeRelativePath(artifact.path, "checkpoint artifact path");
    if (normalized !== artifact.path || seen.has(normalized)) throw new Error("Checkpoint artifact path identity is invalid or duplicated.");
    seen.add(normalized);
    if (!["modified", "added", "deleted", "directory"].includes(artifact.state)) throw new Error("Checkpoint artifact state is invalid.");
    if (!["file", "directory"].includes(artifact.artifact_type)) throw new Error("Checkpoint artifact type is invalid.");
    if (artifact.state === "deleted" || artifact.state === "directory") {
      if (artifact.blob !== null) throw new Error("Deleted/directory checkpoint artifacts cannot reference blobs.");
    } else {
      if (!isObject(artifact.blob) || !sha256Pattern.test(artifact.blob.sha256 ?? "") || !Number.isSafeInteger(artifact.blob.bytes) || artifact.blob.bytes < 0 || artifact.blob.artifact_type !== "utf8_text") {
        throw new Error("Checkpoint blob descriptor is invalid.");
      }
    }
  }
  if (!isObject(manifest.capture_coverage) || manifest.capture_coverage.complete !== true) throw new Error("Checkpoint content manifest coverage is incomplete.");
  const contentId = sha256Text(canonicalJson(manifest));
  if (expectedContentId !== null && contentId !== expectedContentId) throw new Error("Checkpoint content ID mismatch.");
  return { manifest, contentId };
}

function registryEntryFromIdentity(identity) {
  return {
    checkpoint_id: identity.checkpoint_id,
    checkpoint_content_id: identity.checkpoint_content_id,
    state: "active",
    created_at: identity.created_at,
    deleted_at: null,
    label: identity.label,
    workstream_id: identity.workstream_id,
    workspace_id: identity.workspace_id,
    git_head: identity.git_head,
    workspace_snapshot_id: identity.workspace_snapshot_id,
    manifest_identity: identity.manifest_identity,
    provenance_operation_id: identity.provenance_operation_id,
  };
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function removeLockFile(lockPath, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { await rm(lockPath, { force: true }); return true; } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  return false;
}

async function acquireStoreLock(lockPath) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, hostname: os.hostname(), acquired_at: new Date().toISOString() })}\n`, "utf8");
      await handle.sync();
      return handle;
    } catch (error) {
      if (!["EEXIST", "EPERM", "EBUSY"].includes(error?.code)) throw error;
      try {
        const record = JSON.parse(await readFile(lockPath, "utf8"));
        if (record.hostname === os.hostname() && !isProcessRunning(record.pid) && await removeLockFile(lockPath)) continue;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw checkpointError("CHECKPOINT_STORE_BUSY", "Could not acquire checkpoint-store maintenance lock within 2 seconds.");
}

async function releaseStoreLock(handle, lockPath) {
  if (!handle) return;
  await handle.close();
  if (!await removeLockFile(lockPath)) throw new Error("Could not release checkpoint-store maintenance lock.");
}

async function safeDirectory(directoryPath) {
  const info = await lstat(directoryPath);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Unsafe checkpoint-store directory: ${directoryPath}.`);
  return directoryPath;
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
  return safeDirectory(directoryPath);
}

async function durableWriteExclusive(targetPath, bytes) {
  const handle = await open(targetPath, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close().catch(() => {});
  }
}

async function atomicWrite(targetPath, bytes) {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
  await durableWriteExclusive(tempPath, bytes);
  try { await rename(tempPath, targetPath); } finally { await rm(tempPath, { force: true }).catch(() => {}); }
}

function generateCheckpointId() {
  return `dev_checkpoint_${randomUUID().replaceAll("-", "")}`;
}

async function runFixedGit(cwd, args, { maxBuffer = DEV_CHECKPOINT_MAX_FILE_BYTES + 64 * 1024, allowFailure = false } = {}) {
  try {
    const result = await execFileAsync(fixedGitExecutable, ["--no-pager", "-c", "core.fsmonitor=false", ...args], {
      cwd,
      env: controlledProcessEnvironment({ GIT_CONFIG_NOSYSTEM: "1", GIT_PAGER: "cat", PAGER: "cat", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }),
      windowsHide: true,
      shell: false,
      timeout: 30_000,
      maxBuffer,
      encoding: null,
    });
    return { ok: true, stdout: Buffer.from(result.stdout ?? Buffer.alloc(0)) };
  } catch (error) {
    if (allowFailure) return { ok: false, stdout: Buffer.from(error.stdout ?? Buffer.alloc(0)), code: error.code };
    throw error;
  }
}

async function gitObjectExists(cwd, objectSpec) {
  const result = await runFixedGit(cwd, ["cat-file", "-e", objectSpec], { allowFailure: true, maxBuffer: 8 * 1024 });
  return result.ok;
}

async function gitFileAtHead(cwd, head, relativePath) {
  const result = await runFixedGit(cwd, ["show", `${head}:${relativePath}`], { allowFailure: true });
  return result.ok ? result.stdout : null;
}

async function headRelation(repositoryRoot, left, right) {
  if (left === right) return "equal";
  const leftAncestor = await runFixedGit(repositoryRoot, ["merge-base", "--is-ancestor", left, right], { allowFailure: true, maxBuffer: 8 * 1024 });
  if (leftAncestor.ok) return "left_ancestor_of_right";
  const rightAncestor = await runFixedGit(repositoryRoot, ["merge-base", "--is-ancestor", right, left], { allowFailure: true, maxBuffer: 8 * 1024 });
  if (rightAncestor.ok) return "right_ancestor_of_left";
  return "diverged_or_unrelated";
}

async function assertNoGitOperation(context) {
  const markers = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG", "rebase-merge", "rebase-apply"];
  for (const marker of markers) {
    try {
      await lstat(path.join(context.git_dir, marker));
      throw checkpointError("CHECKPOINT_UNSUPPORTED_INDEX_STATE", `Git operation is in progress (${marker}).`);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      if (error?.code === "CHECKPOINT_UNSUPPORTED_INDEX_STATE") throw error;
      throw error;
    }
  }
}

async function collectEmptyDevelopmentDirectories(repositoryRoot, quotas) {
  const empty = [];
  let visited = 0;
  async function visit(directoryPath, relativePath) {
    visited += 1;
    if (visited > quotas.maxDirectoryScanEntries) throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", "Approved directory scan exceeded the bounded checkpoint limit.");
    const info = await lstat(directoryPath);
    if (info.isSymbolicLink() || !info.isDirectory()) return;
    const entries = await readdir(directoryPath, { withFileTypes: true });
    if (entries.length === 0 && relativePath) {
      assertCheckpointDevelopmentPath(relativePath, repositoryRoot);
      empty.push(relativePath.replaceAll("\\", "/"));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const lower = entry.name.toLowerCase();
      if (generatedDirectoryNames.has(lower) || isSecretName(entry.name) || lower === ".git") continue;
      const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      await visit(path.join(directoryPath, entry.name), childRelative);
    }
  }
  for (const topLevel of approvedTopLevelDirectories) {
    const target = path.join(repositoryRoot, topLevel);
    try { await visit(target, topLevel); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const included = [];
  for (const relativePath of empty.sort((a, b) => a.localeCompare(b))) {
    const ignored = await runFixedGit(repositoryRoot, ["check-ignore", "--quiet", "--", relativePath], {
      allowFailure: true,
      maxBuffer: 8 * 1024,
    });
    if (ignored.ok) continue;
    if (ignored.code !== 1 && ignored.code !== "1") {
      throw checkpointError("CHECKPOINT_SOURCE_UNAVAILABLE", `Could not determine ignored-state for empty development directory: ${relativePath}.`);
    }
    included.push(relativePath);
  }
  return included;
}

async function captureOverlay(context, snapshot, quotas) {
  const artifacts = [];
  const buffers = new Map();
  let logicalBytes = 0;
  const coverage = { modified: 0, added: 0, deleted: 0, directories: 0, complete: true, ignored_included: false };
  for (const item of snapshot.manifest) {
    const relativePath = assertCheckpointDevelopmentPath(item.path, context.root);
    if (item.state === "deleted") {
      artifacts.push({ path: relativePath, state: "deleted", artifact_type: "file", blob: null });
      coverage.deleted += 1;
      continue;
    }
    const absolutePath = path.resolve(context.root, relativePath);
    let info;
    try { info = await assertExistingSafePath(absolutePath, "checkpoint artifact", context.root); } catch (error) {
      throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", error.message, { path: relativePath });
    }
    if (!info.isFile() || !isSupportedTextPath(absolutePath)) throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", "Changed artifact is not a supported UTF-8 development file.", { path: relativePath });
    if (info.size > quotas.maxFileBytes) throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", `Changed artifact exceeds ${quotas.maxFileBytes} bytes.`, { path: relativePath });
    const content = await readFile(absolutePath);
    try { decodeText(content, "checkpoint artifact"); } catch (error) { throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", error.message, { path: relativePath }); }
    const digest = sha256Buffer(content);
    if (item.sha256 !== digest || item.bytes !== content.length) throw checkpointError("CHECKPOINT_SOURCE_CHANGED", "Artifact changed during checkpoint capture.", { path: relativePath });
    logicalBytes += content.length;
    if (logicalBytes > quotas.maxLogicalBytes) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", "Checkpoint logical byte quota exceeded.");
    const state = item.state === "untracked" || item.state === "added" ? "added" : "modified";
    artifacts.push({ path: relativePath, state, artifact_type: "file", blob: { sha256: digest, bytes: content.length, artifact_type: "utf8_text" } });
    buffers.set(digest, content);
    coverage[state] += 1;
  }
  const emptyDirectories = await collectEmptyDevelopmentDirectories(context.root, quotas);
  for (const relativePath of emptyDirectories) {
    if (artifacts.some((artifact) => artifact.path === relativePath)) continue;
    artifacts.push({ path: relativePath, state: "directory", artifact_type: "directory", blob: null });
    coverage.directories += 1;
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path) || a.state.localeCompare(b.state));
  if (artifacts.length > quotas.maxArtifacts) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", `Checkpoint exceeds ${quotas.maxArtifacts} artifacts.`);
  return { artifacts, buffers, logicalBytes, coverage, emptyDirectories };
}

function changedArtifactMap(artifacts) {
  return new Map(artifacts.map((artifact) => [artifact.path, artifact]));
}

function publicArtifact(artifact) {
  return {
    path: artifact.path,
    state: artifact.state,
    artifact_type: artifact.artifact_type,
    sha256: artifact.blob?.sha256 ?? null,
    bytes: artifact.blob?.bytes ?? null,
  };
}

export function createDevCheckpointService({
  storageRoot = DEV_CHECKPOINT_STORAGE_ROOT,
  repositoryRoot = projectRoot,
  workspaceContextResolver = resolveDevWorkspaceExecutionContext,
  recoveryContextResolver = resolveDevCheckpointRecoveryExecutionContext,
  beginRecoveryWorkstream = beginDevCheckpointRecoveryWorkstream,
  createRecoveryIsolated = createDevCheckpointRecoveryIsolated,
  transitionRecoveryWorkspace = transitionDevCheckpointRecoveryWorkspace,
  listRecoveryWorkspaces = listDevCheckpointRecoveryWorkspaces,
  clock = () => new Date(),
  idGenerator = generateCheckpointId,
  quotas = defaultQuotas,
  hooks = {},
  journal = null,
} = {}) {
  const effectiveQuotas = { ...defaultQuotas, ...quotas };
  const paths = {
    registry: path.join(storageRoot, "registry.json"),
    lock: path.join(storageRoot, "maintenance.lock"),
    blobs: path.join(storageRoot, "blobs", "sha256"),
    content: path.join(storageRoot, "manifests", "content"),
    identities: path.join(storageRoot, "manifests", "checkpoints"),
  };
  const journalApi = journal ?? {
    begin: beginDevJournalOperation,
    complete: completeDevJournalOperation,
    fail: failDevJournalOperation,
    markDegraded: markDevJournalDegraded,
  };

  async function ensureStore() {
    await ensureDirectory(storageRoot);
    await ensureDirectory(path.join(storageRoot, "blobs"));
    await ensureDirectory(paths.blobs);
    await ensureDirectory(path.join(storageRoot, "manifests"));
    await ensureDirectory(paths.content);
    await ensureDirectory(paths.identities);
    return realpath(storageRoot);
  }

  async function withLock(operation) {
    await ensureStore();
    const handle = await acquireStoreLock(paths.lock);
    try { return await operation(); } finally { await releaseStoreLock(handle, paths.lock); }
  }

  async function readRegistryUnlocked() {
    try {
      const info = await lstat(paths.registry);
      if (info.isSymbolicLink() || !info.isFile() || info.size > 4 * 1024 * 1024) throw new Error("Checkpoint registry path is unsafe.");
      return validateRegistry(JSON.parse(await readFile(paths.registry, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") return emptyRegistry();
      throw checkpointError("CHECKPOINT_STORE_CORRUPT", error.message);
    }
  }

  async function writeRegistryUnlocked(registry) {
    registry.revision += 1;
    registry.updated_at = clock().toISOString();
    await atomicWrite(paths.registry, Buffer.from(encodeRegistry(registry), "utf8"));
  }

  function identityPath(checkpointId) { return path.join(paths.identities, `${checkpointId}.json`); }
  function contentPath(contentId) { return path.join(paths.content, `${contentId}.json`); }
  function blobPath(digest) { return path.join(paths.blobs, digest.slice(0, 2), digest); }

  async function readIdentity(checkpointId) {
    assertCheckpointId(checkpointId);
    const target = identityPath(checkpointId);
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile() || info.size > effectiveQuotas.maxManifestBytes) throw new Error("Checkpoint identity manifest path is unsafe.");
      return validateIdentityManifest(JSON.parse(await readFile(target, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") throw checkpointError("CHECKPOINT_NOT_FOUND", `Unknown checkpoint: ${checkpointId}.`);
      if (error?.code?.startsWith?.("CHECKPOINT_")) throw error;
      throw checkpointError("CHECKPOINT_STORE_CORRUPT", error.message, { checkpoint_id: checkpointId });
    }
  }

  async function readContent(contentId) {
    if (!sha256Pattern.test(contentId ?? "")) throw new Error("checkpoint_content_id is invalid.");
    const target = contentPath(contentId);
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile() || info.size > effectiveQuotas.maxManifestBytes) throw new Error("Checkpoint content manifest path is unsafe.");
      return validateContentManifest(JSON.parse(await readFile(target, "utf8")), contentId).manifest;
    } catch (error) {
      if (error?.code === "ENOENT") throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint content manifest is missing: ${contentId}.`);
      if (error?.code?.startsWith?.("CHECKPOINT_")) throw error;
      throw checkpointError("CHECKPOINT_STORE_CORRUPT", error.message);
    }
  }

  async function listIdentityIdsUnlocked() {
    const entries = await readdir(paths.identities, { withFileTypes: true });
    const ids = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() || !/^dev_checkpoint_[a-f0-9]{32}\.json$/u.test(entry.name)) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Unexpected checkpoint identity store entry: ${entry.name}.`);
      ids.push(entry.name.slice(0, -5));
    }
    return ids.sort();
  }

  async function reconcileRegistryUnlocked() {
    const registry = await readRegistryUnlocked();
    const identities = await listIdentityIdsUnlocked();
    const byId = new Map(registry.checkpoints.map((entry) => [entry.checkpoint_id, entry]));
    let changed = false;
    for (const checkpointId of identities) {
      const identity = await readIdentity(checkpointId);
      const existing = byId.get(checkpointId);
      if (!existing) {
        const entry = registryEntryFromIdentity(identity);
        registry.checkpoints.push(entry);
        byId.set(checkpointId, entry);
        changed = true;
      } else if (existing.checkpoint_content_id !== identity.checkpoint_content_id || existing.manifest_identity !== identity.manifest_identity || existing.workstream_id !== identity.workstream_id || existing.workspace_id !== identity.workspace_id) {
        throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint registry/manifest identity mismatch: ${checkpointId}.`);
      }
    }
    for (const entry of registry.checkpoints) {
      if (!identities.includes(entry.checkpoint_id)) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint registry references missing immutable identity manifest: ${entry.checkpoint_id}.`);
    }
    if (changed) await writeRegistryUnlocked(registry);
    return registry;
  }

  async function verifyBlob(descriptor) {
    const target = blobPath(descriptor.sha256);
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile() || info.size !== descriptor.bytes) throw new Error("Checkpoint blob size/type mismatch.");
      const content = await readFile(target);
      if (content.length !== descriptor.bytes || sha256Buffer(content) !== descriptor.sha256) throw new Error("Checkpoint blob digest mismatch.");
      return content;
    } catch (error) {
      throw checkpointError("CHECKPOINT_STORE_CORRUPT", `${descriptor.sha256}: ${error.message}`);
    }
  }

  async function publishBlobUnlocked(descriptor, content) {
    const directory = path.dirname(blobPath(descriptor.sha256));
    await ensureDirectory(directory);
    const target = blobPath(descriptor.sha256);
    try {
      await durableWriteExclusive(target, content);
      return { stored: true, bytes: content.length };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await verifyBlob(descriptor);
      return { stored: false, bytes: 0 };
    }
  }

  async function listBlobRecordsUnlocked({ verifyDigests = false } = {}) {
    const records = [];
    const prefixes = await readdir(paths.blobs, { withFileTypes: true });
    for (const prefix of prefixes) {
      if (!prefix.isDirectory() || prefix.isSymbolicLink() || !/^[a-f0-9]{2}$/u.test(prefix.name)) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Unexpected checkpoint blob prefix: ${prefix.name}.`);
      const entries = await readdir(path.join(paths.blobs, prefix.name), { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.isSymbolicLink() || !sha256Pattern.test(entry.name) || entry.name.slice(0, 2) !== prefix.name) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Unexpected checkpoint blob entry: ${prefix.name}/${entry.name}.`);
        const blobFilePath = path.join(paths.blobs, prefix.name, entry.name);
        const info = await stat(blobFilePath);
        if (verifyDigests) {
          const content = await readFile(blobFilePath);
          if (content.length !== info.size || sha256Buffer(content) !== entry.name) {
            throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint blob filename/digest mismatch: ${entry.name}.`);
          }
        }
        records.push({ sha256: entry.name, bytes: info.size, path: blobFilePath });
      }
    }
    return records;
  }

  async function validateCheckpointManifestsUnlocked(registry) {
    for (const entry of registry.checkpoints) {
      const identity = await readIdentity(entry.checkpoint_id);
      const content = await readContent(identity.checkpoint_content_id);
      if (
        identity.checkpoint_content_id !== entry.checkpoint_content_id
        || identity.manifest_identity !== entry.manifest_identity
        || identity.git_head !== content.git_head
        || identity.workspace_snapshot_id !== content.workspace_snapshot_id
      ) {
        throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint registry/identity/content mismatch: ${entry.checkpoint_id}.`);
      }
    }
  }

  async function activeRootSetUnlocked(registry, { verify = true } = {}) {
    const referenced = new Map();
    let logicalBytes = 0;
    for (const entry of registry.checkpoints.filter((candidate) => candidate.state === "active")) {
      const identity = await readIdentity(entry.checkpoint_id);
      const content = await readContent(identity.checkpoint_content_id);
      if (identity.git_head !== content.git_head || identity.workspace_snapshot_id !== content.workspace_snapshot_id) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint identity/content mismatch: ${entry.checkpoint_id}.`);
      for (const artifact of content.artifacts) {
        if (!artifact.blob) continue;
        logicalBytes += artifact.blob.bytes;
        const prior = referenced.get(artifact.blob.sha256);
        if (prior && prior.bytes !== artifact.blob.bytes) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Checkpoint blob descriptor collision: ${artifact.blob.sha256}.`);
        referenced.set(artifact.blob.sha256, artifact.blob);
      }
    }
    if (verify) for (const descriptor of referenced.values()) await verifyBlob(descriptor);
    return { referenced, logicalBytes };
  }

  async function storeStatisticsUnlocked(registry, { verify = true } = {}) {
    await validateCheckpointManifestsUnlocked(registry);
    const blobs = await listBlobRecordsUnlocked({ verifyDigests: verify });
    const roots = await activeRootSetUnlocked(registry, { verify });
    const physicalBytes = blobs.reduce((sum, item) => sum + item.bytes, 0);
    const referencedPhysicalBytes = blobs.filter((item) => roots.referenced.has(item.sha256)).reduce((sum, item) => sum + item.bytes, 0);
    const reclaimable = blobs.filter((item) => !roots.referenced.has(item.sha256));
    return {
      checkpoint_count: registry.checkpoints.length,
      active_count: registry.checkpoints.filter((entry) => entry.state === "active").length,
      deleted_count: registry.checkpoints.filter((entry) => entry.state === "deleted").length,
      physical_blob_bytes: physicalBytes,
      logical_checkpoint_bytes: roots.logicalBytes,
      deduplicated_bytes_saved: Math.max(0, roots.logicalBytes - referencedPhysicalBytes),
      reclaimable_bytes: reclaimable.reduce((sum, item) => sum + item.bytes, 0),
      reclaimable_blob_count: reclaimable.length,
      reclaimable,
    };
  }

  async function loadCheckpoint(checkpointId, { requireActive = false, verifyBlobs = false } = {}) {
    return withLock(async () => {
      const registry = await reconcileRegistryUnlocked();
      const entry = registry.checkpoints.find((candidate) => candidate.checkpoint_id === assertCheckpointId(checkpointId));
      if (!entry) throw checkpointError("CHECKPOINT_NOT_FOUND", `Unknown checkpoint: ${checkpointId}.`);
      if (requireActive && entry.state !== "active") throw checkpointError("CHECKPOINT_DELETED", "Deleted checkpoint is not an active recovery/read root.");
      const identity = await readIdentity(checkpointId);
      const content = await readContent(identity.checkpoint_content_id);
      if (identity.git_head !== content.git_head || identity.workspace_snapshot_id !== content.workspace_snapshot_id) throw checkpointError("CHECKPOINT_STORE_CORRUPT", "Checkpoint identity/content snapshot mismatch.");
      if (verifyBlobs) for (const artifact of content.artifacts) if (artifact.blob) await verifyBlob(artifact.blob);
      return { entry: structuredClone(entry), identity, content };
    });
  }

  async function create(input = {}) {
    assertObjectKeys(input, "dev_workspace_create_checkpoint input", new Set(["workspace_id", "label"]));
    const workspaceId = assertWorkspaceId(input.workspace_id);
    const label = boundedLabel(input.label);
    const context = await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: true });
    if (context.workspace_type !== "isolated_worktree" || context.lifecycle_state !== "active" || !context.healthy) throw checkpointError("CHECKPOINT_INVALID_WORKSPACE", "Checkpoint source must be a healthy active isolated workspace.");
    const gitTools = createDevGitTools({ repositoryRoot: context.root });
    const gitStatus = await gitTools.status({ includeUntracked: true });
    if (!gitStatus.execution_ok || gitStatus.exit_code !== 0) throw checkpointError("CHECKPOINT_SOURCE_UNAVAILABLE", "Could not read source workspace Git status.");
    if (gitStatus.staged.length > 0 || gitStatus.conflicted.length > 0) throw checkpointError("CHECKPOINT_UNSUPPORTED_INDEX_STATE", "Checkpoint v1 refuses staged or conflicted index state.", { staged_count: gitStatus.staged.length, conflicted_count: gitStatus.conflicted.length });
    await assertNoGitOperation(context);
    let initialSnapshot;
    try {
      initialSnapshot = await computeWorkspaceSnapshot(context);
    } catch (error) {
      if (/symbolic link|junction|outside the workspace root/iu.test(String(error?.message ?? error))) {
        throw checkpointError("CHECKPOINT_INCOMPLETE_SOURCE", String(error.message ?? error));
      }
      throw error;
    }
    if (initialSnapshot.head !== context.current_head) throw checkpointError("CHECKPOINT_SOURCE_CHANGED", "Workspace HEAD changed before checkpoint capture began.");
    if (hooks.afterInitialSnapshot) await hooks.afterInitialSnapshot({ context, snapshot: initialSnapshot });
    const capture = await captureOverlay(context, initialSnapshot, effectiveQuotas);
    if (hooks.afterCapture) await hooks.afterCapture({ context, snapshot: initialSnapshot, capture });
    const checkpointId = idGenerator();
    assertCheckpointId(checkpointId);
    const journalOperation = await journalApi.begin({
      operation_type: "checkpoint_create",
      tool_name: "dev_workspace_create_checkpoint",
      workstream_id: context.workstream_id,
      workspace_id: context.workspace_id,
      links: [{ relation: "used_by", workspace_snapshot_id: initialSnapshot.workspace_snapshot_id }],
      result: {
        checkpoint_id: checkpointId,
        git_head: initialSnapshot.head,
        workspace_snapshot_id: initialSnapshot.workspace_snapshot_id,
      },
    });
    let identityPublished = false;
    let storedBytes = 0;
    let reusedBytes = 0;
    try {
      const result = await withLock(async () => {
        const registry = await reconcileRegistryUnlocked();
        const activeWorkspaceCount = registry.checkpoints.filter((entry) => entry.state === "active" && entry.workspace_id === context.workspace_id).length;
        const activeWorkstreamCount = registry.checkpoints.filter((entry) => entry.state === "active" && entry.workstream_id === context.workstream_id).length;
        if (activeWorkspaceCount >= effectiveQuotas.maxCheckpointsPerWorkspace || activeWorkstreamCount >= effectiveQuotas.maxCheckpointsPerWorkstream) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", "Checkpoint count quota exceeded; explicit deletion is required before creating more checkpoints.");
        const statistics = await storeStatisticsUnlocked(registry, { verify: true });
        const uniqueDescriptors = new Map(capture.artifacts.filter((artifact) => artifact.blob).map((artifact) => [artifact.blob.sha256, artifact.blob]));
        const blobRecords = await listBlobRecordsUnlocked();
        const existing = new Set(blobRecords.map((item) => item.sha256));
        const missingBytes = [...uniqueDescriptors.values()].filter((descriptor) => !existing.has(descriptor.sha256)).reduce((sum, descriptor) => sum + descriptor.bytes, 0);
        if (statistics.physical_blob_bytes + missingBytes > effectiveQuotas.maxPhysicalBlobBytes) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", "Checkpoint physical blob-store quota exceeded; no automatic retention deletion is permitted.");
        for (const descriptor of uniqueDescriptors.values()) {
          const published = await publishBlobUnlocked(descriptor, capture.buffers.get(descriptor.sha256));
          if (published.stored) storedBytes += descriptor.bytes;
          else reusedBytes += descriptor.bytes;
          if (hooks.afterEachBlobPublish) await hooks.afterEachBlobPublish({ checkpointId, descriptor: structuredClone(descriptor), stored: published.stored });
        }
        if (hooks.afterBlobPublish) await hooks.afterBlobPublish({ checkpointId });
        const finalSnapshot = await computeWorkspaceSnapshot(context);
        const finalDirectories = await collectEmptyDevelopmentDirectories(context.root, effectiveQuotas);
        if (finalSnapshot.workspace_snapshot_id !== initialSnapshot.workspace_snapshot_id || canonicalJson(finalDirectories) !== canonicalJson(capture.emptyDirectories)) throw checkpointError("CHECKPOINT_SOURCE_CHANGED", "Workspace changed while checkpoint content was being captured.");
        const contentManifest = {
          schema_version: DEV_CHECKPOINT_SCHEMA_VERSION,
          format: "git-head-overlay-v1",
          git_head: initialSnapshot.head,
          workspace_snapshot_id: initialSnapshot.workspace_snapshot_id,
          artifacts: capture.artifacts,
          capture_coverage: capture.coverage,
        };
        const encodedContent = Buffer.from(`${canonicalJson(contentManifest)}\n`, "utf8");
        if (encodedContent.length > effectiveQuotas.maxManifestBytes) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", "Checkpoint content manifest exceeds the bounded manifest size.");
        const checkpointContentId = sha256Text(canonicalJson(contentManifest));
        try { await durableWriteExclusive(contentPath(checkpointContentId), encodedContent); } catch (error) {
          if (error?.code !== "EEXIST") throw error;
          await readContent(checkpointContentId);
        }
        const createdAt = clock().toISOString();
        const identityBase = {
          schema_version: DEV_CHECKPOINT_SCHEMA_VERSION,
          checkpoint_id: checkpointId,
          checkpoint_content_id: checkpointContentId,
          workstream_id: context.workstream_id,
          workspace_id: context.workspace_id,
          workstream_base_head: context.base_head,
          git_head: initialSnapshot.head,
          workspace_snapshot_id: initialSnapshot.workspace_snapshot_id,
          created_at: createdAt,
          label,
          state: "active",
          artifact_count: capture.artifacts.length,
          logical_bytes: capture.logicalBytes,
          provenance_operation_id: journalOperation.operation_id,
        };
        const identity = { ...identityBase, manifest_identity: sha256Text(canonicalJson(identityBase)) };
        const encodedIdentity = Buffer.from(`${canonicalJson(identity)}\n`, "utf8");
        if (encodedIdentity.length > effectiveQuotas.maxManifestBytes) throw checkpointError("CHECKPOINT_QUOTA_EXCEEDED", "Checkpoint identity manifest exceeds the bounded manifest size.");
        await durableWriteExclusive(identityPath(checkpointId), encodedIdentity);
        identityPublished = true;
        if (hooks.afterIdentityPublishBeforeRegistry) await hooks.afterIdentityPublishBeforeRegistry({ checkpointId, identity });
        registry.checkpoints.push(registryEntryFromIdentity(identity));
        await writeRegistryUnlocked(registry);
        return { identity, contentManifest };
      });
      try {
        await journalApi.complete(journalOperation.operation_id, {
          links: [
            { relation: "used_by", workspace_snapshot_id: initialSnapshot.workspace_snapshot_id },
            { relation: "produced", checkpoint_id: checkpointId },
          ],
          result: {
            checkpoint_id: checkpointId,
            checkpoint_content_id: result.identity.checkpoint_content_id,
            artifact_count: result.identity.artifact_count,
            logical_bytes: result.identity.logical_bytes,
            stored_bytes: storedBytes,
            deduped_bytes: reusedBytes,
            manifest_identity: result.identity.manifest_identity,
          },
        });
      } catch (error) {
        await journalApi.markDegraded(`checkpoint create terminal append failed: ${error.message}`);
        throw checkpointError("JOURNAL_TERMINAL_APPEND_FAILED", `Checkpoint is durable but provenance completion failed: ${error.message}`);
      }
      return {
        checkpoint_id: checkpointId,
        checkpoint_content_id: result.identity.checkpoint_content_id,
        schema_version: DEV_CHECKPOINT_SCHEMA_VERSION,
        workstream_id: context.workstream_id,
        workspace_id: context.workspace_id,
        workstream_base_head: context.base_head,
        git_head: result.identity.git_head,
        workspace_snapshot_id: result.identity.workspace_snapshot_id,
        created_at: result.identity.created_at,
        label,
        state: "active",
        artifact_count: result.identity.artifact_count,
        logical_bytes: result.identity.logical_bytes,
        stored_bytes: storedBytes,
        deduped_bytes: reusedBytes,
        manifest_identity: result.identity.manifest_identity,
        provenance_operation_id: journalOperation.operation_id,
        capture_coverage: structuredClone(result.contentManifest.capture_coverage),
      };
    } catch (error) {
      try {
        if (identityPublished) {
          await journalApi.complete(journalOperation.operation_id, {
            links: [{ relation: "produced", checkpoint_id: checkpointId }],
            result: { checkpoint_id: checkpointId, checkpoint_visible: true, registry_reconciliation_required: true, reason: String(error.message).slice(0, 512) },
          });
        } else {
          await journalApi.fail(journalOperation.operation_id, { result: { checkpoint_id: checkpointId, checkpoint_visible: false, reason: String(error.message).slice(0, 512) } });
        }
      } catch (journalError) {
        await journalApi.markDegraded(`checkpoint create failure terminal append failed: ${journalError.message}`);
      }
      throw error;
    }
  }

  async function get(input = {}) {
    assertObjectKeys(input, "dev_workspace_get_checkpoint input", new Set(["checkpoint_id"]));
    const loaded = await loadCheckpoint(assertCheckpointId(input.checkpoint_id), { requireActive: false, verifyBlobs: false });
    let health = "healthy";
    if (loaded.entry.state === "active") {
      try { for (const artifact of loaded.content.artifacts) if (artifact.blob) await verifyBlob(artifact.blob); } catch { health = "corrupt"; }
    } else health = "degraded";
    return {
      ...structuredClone(loaded.entry),
      schema_version: DEV_CHECKPOINT_SCHEMA_VERSION,
      workstream_base_head: loaded.identity.workstream_base_head,
      artifact_count: loaded.identity.artifact_count,
      logical_bytes: loaded.identity.logical_bytes,
      capture_coverage: structuredClone(loaded.content.capture_coverage),
      artifacts: loaded.content.artifacts.map(publicArtifact),
      health,
    };
  }

  async function list(input = {}) {
    assertObjectKeys(input, "dev_workspace_list_checkpoints input", new Set(["workstream_id", "workspace_id", "state", "limit", "after"]));
    if (input.workstream_id !== undefined && !workstreamIdPattern.test(input.workstream_id)) throw new Error("workstream_id is invalid.");
    if (input.workspace_id !== undefined) assertWorkspaceId(input.workspace_id);
    if (input.state !== undefined && !checkpointStateSet.has(input.state)) throw new Error("state is invalid.");
    const limit = input.limit ?? DEV_CHECKPOINT_MAX_LIST_RESULTS;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_CHECKPOINT_MAX_LIST_RESULTS) throw new Error(`limit must be 1-${DEV_CHECKPOINT_MAX_LIST_RESULTS}.`);
    const after = input.after ?? null;
    if (after !== null) assertCheckpointId(after);
    return withLock(async () => {
      const registry = await reconcileRegistryUnlocked();
      let entries = [...registry.checkpoints].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.checkpoint_id.localeCompare(b.checkpoint_id));
      if (input.workstream_id) entries = entries.filter((entry) => entry.workstream_id === input.workstream_id);
      if (input.workspace_id) entries = entries.filter((entry) => entry.workspace_id === input.workspace_id);
      if (input.state) entries = entries.filter((entry) => entry.state === input.state);
      if (after) {
        const index = entries.findIndex((entry) => entry.checkpoint_id === after);
        if (index === -1) throw new Error("after must reference a checkpoint in the filtered result set.");
        entries = entries.slice(index + 1);
      }
      const total = entries.length;
      const page = entries.slice(0, limit);
      return { total, returned: page.length, truncated: total > limit, next_after: total > limit ? page.at(-1)?.checkpoint_id ?? null : null, checkpoints: structuredClone(page) };
    });
  }

  async function snapshotArtifactsForCompare(workspaceId) {
    const context = await workspaceContextResolver({ workspace_id: assertWorkspaceId(workspaceId) }, { mutation: false });
    const snapshot = await computeWorkspaceSnapshot(context);
    const capture = await captureOverlay(context, snapshot, effectiveQuotas);
    return { context, snapshot, artifacts: capture.artifacts };
  }

  async function compare(input = {}) {
    assertObjectKeys(input, "dev_workspace_compare_checkpoint input", new Set(["checkpoint_id", "workspace_id", "other_checkpoint_id"]));
    const checkpointId = assertCheckpointId(input.checkpoint_id);
    const selectorCount = [input.workspace_id !== undefined, input.other_checkpoint_id !== undefined].filter(Boolean).length;
    if (selectorCount !== 1) throw new Error("Exactly one comparison target is required: workspace_id or other_checkpoint_id.");
    const left = await loadCheckpoint(checkpointId, { requireActive: true, verifyBlobs: false });
    let rightHead;
    let rightSnapshotId;
    let rightContentId = null;
    let rightArtifacts;
    let target;
    if (input.other_checkpoint_id !== undefined) {
      const right = await loadCheckpoint(assertCheckpointId(input.other_checkpoint_id), { requireActive: true, verifyBlobs: false });
      rightHead = right.identity.git_head;
      rightSnapshotId = right.identity.workspace_snapshot_id;
      rightContentId = right.identity.checkpoint_content_id;
      rightArtifacts = right.content.artifacts;
      target = { type: "checkpoint", checkpoint_id: right.identity.checkpoint_id };
      if (left.identity.checkpoint_content_id === rightContentId) {
        return { checkpoint_id: checkpointId, target, head_relation: await headRelation(repositoryRoot, left.identity.git_head, rightHead), left_snapshot_id: left.identity.workspace_snapshot_id, right_snapshot_id: rightSnapshotId, left_content_id: left.identity.checkpoint_content_id, right_content_id: rightContentId, identical: true, added_paths: [], modified_paths: [], deleted_paths: [], changes: [], summary: { added: 0, modified: 0, deleted: 0 } };
      }
    } else {
      const right = await snapshotArtifactsForCompare(input.workspace_id);
      rightHead = right.snapshot.head;
      rightSnapshotId = right.snapshot.workspace_snapshot_id;
      rightArtifacts = right.artifacts;
      target = { type: "workspace", workspace_id: input.workspace_id };
      if (
        left.identity.workspace_snapshot_id === rightSnapshotId
        && canonicalJson(left.content.artifacts) === canonicalJson(rightArtifacts)
      ) {
        return { checkpoint_id: checkpointId, target, head_relation: await headRelation(repositoryRoot, left.identity.git_head, rightHead), left_snapshot_id: left.identity.workspace_snapshot_id, right_snapshot_id: rightSnapshotId, left_content_id: left.identity.checkpoint_content_id, right_content_id: null, identical: true, added_paths: [], modified_paths: [], deleted_paths: [], changes: [], summary: { added: 0, modified: 0, deleted: 0 } };
      }
    }
    const leftMap = changedArtifactMap(left.content.artifacts);
    const rightMap = changedArtifactMap(rightArtifacts);
    const allPaths = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
    const changes = [];
    for (const artifactPath of allPaths) {
      const oldValue = leftMap.get(artifactPath) ?? null;
      const newValue = rightMap.get(artifactPath) ?? null;
      if (canonicalJson(oldValue) === canonicalJson(newValue)) continue;
      const change = oldValue === null ? "added" : newValue === null ? "deleted" : "modified";
      changes.push({ path: artifactPath, change, old_sha256: oldValue?.blob?.sha256 ?? null, old_bytes: oldValue?.blob?.bytes ?? null, new_sha256: newValue?.blob?.sha256 ?? null, new_bytes: newValue?.blob?.bytes ?? null });
    }
    return {
      checkpoint_id: checkpointId,
      target,
      head_relation: await headRelation(repositoryRoot, left.identity.git_head, rightHead),
      left_snapshot_id: left.identity.workspace_snapshot_id,
      right_snapshot_id: rightSnapshotId,
      left_content_id: left.identity.checkpoint_content_id,
      right_content_id: rightContentId,
      identical: false,
      added_paths: changes.filter((item) => item.change === "added").map((item) => item.path),
      modified_paths: changes.filter((item) => item.change === "modified").map((item) => item.path),
      deleted_paths: changes.filter((item) => item.change === "deleted").map((item) => item.path),
      changes: changes.slice(0, DEV_CHECKPOINT_MAX_ARTIFACTS),
      summary: { added: changes.filter((item) => item.change === "added").length, modified: changes.filter((item) => item.change === "modified").length, deleted: changes.filter((item) => item.change === "deleted").length },
    };
  }

  async function readCheckpointFile(input = {}) {
    assertObjectKeys(input, "dev_workspace_read_checkpoint_file input", new Set(["checkpoint_id", "path"]));
    const relativePath = normalizeRelativePath(input.path);
    const loaded = await loadCheckpoint(assertCheckpointId(input.checkpoint_id), { requireActive: true, verifyBlobs: false });
    assertCheckpointDevelopmentPath(relativePath, repositoryRoot);
    const artifact = loaded.content.artifacts.find((candidate) => candidate.path === relativePath);
    if (!artifact) throw checkpointError("CHECKPOINT_PATH_ABSENT", "Path is not part of the checkpoint overlay.");
    if (artifact.state === "deleted") throw checkpointError("CHECKPOINT_PATH_DELETED", "Path is deleted in this checkpoint.");
    if (artifact.artifact_type === "directory") throw checkpointError("CHECKPOINT_PATH_DIRECTORY", "Path is a directory in this checkpoint.");
    if (artifact.blob.bytes > DEV_CHECKPOINT_MAX_READ_BYTES) throw checkpointError("CHECKPOINT_READ_TOO_LARGE", `Checkpoint file exceeds ${DEV_CHECKPOINT_MAX_READ_BYTES} bytes.`);
    const content = await verifyBlob(artifact.blob);
    const text = decodeText(content, "checkpoint file");
    return { checkpoint_id: loaded.identity.checkpoint_id, checkpoint_content_id: loaded.identity.checkpoint_content_id, path: relativePath, sha256: artifact.blob.sha256, bytes: artifact.blob.bytes, content: text };
  }

  async function ensureParentDirectories(root, relativePath) {
    const parentRelative = path.posix.dirname(relativePath);
    if (parentRelative === ".") return;
    const segments = parentRelative.split("/");
    let current = root;
    for (const segment of segments) {
      current = path.join(current, segment);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink() || !info.isDirectory()) throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Recovery parent path is unsafe: ${relativePath}.`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        await mkdir(current, { recursive: false });
      }
    }
  }

  async function materializeArtifact(context, checkpoint, artifact) {
    const relativePath = assertCheckpointDevelopmentPath(artifact.path, context.root);
    const target = path.resolve(context.root, relativePath);
    if (artifact.state === "directory") {
      await ensureParentDirectories(context.root, relativePath);
      try {
        const info = await lstat(target);
        if (info.isSymbolicLink() || !info.isDirectory()) throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Recovery directory target is unsafe: ${relativePath}.`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        await mkdir(target, { recursive: false });
      }
      return;
    }
    if (artifact.state === "deleted") {
      try {
        const info = await lstat(target);
        if (info.isSymbolicLink() || !info.isFile()) throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Recovery delete target is unsafe: ${relativePath}.`);
        await unlink(target);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      return;
    }
    const desired = await verifyBlob(artifact.blob);
    await ensureParentDirectories(context.root, relativePath);
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile()) throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Recovery file target is unsafe: ${relativePath}.`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      if (artifact.state === "modified") throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Tracked recovery target unexpectedly disappeared: ${relativePath}.`);
    }
    const handle = await open(target, "w");
    try { await handle.writeFile(desired); await handle.sync(); } finally { await handle.close(); }
    const observed = await readFile(target);
    if (sha256Buffer(observed) !== artifact.blob.sha256 || observed.length !== artifact.blob.bytes) throw checkpointError("CHECKPOINT_RECOVERY_MATERIALIZATION_FAILED", `Recovery file verification failed: ${relativePath}.`);
  }

  async function materializeRecovery(checkpoint, recoveryWorkspaceId) {
    let context = await recoveryContextResolver({ workspace_id: recoveryWorkspaceId });
    if (context.current_head !== checkpoint.identity.git_head) throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", "Recovery workspace HEAD does not match checkpoint git_head.");
    for (const artifact of checkpoint.content.artifacts) await materializeArtifact(context, checkpoint, artifact);
    await transitionRecoveryWorkspace({ workspace_id: recoveryWorkspaceId, state: "verifying", last_error: null });
    context = await recoveryContextResolver({ workspace_id: recoveryWorkspaceId });
    const snapshot = await computeWorkspaceSnapshot(context);
    const expectedDirectories = checkpoint.content.artifacts
      .filter((artifact) => artifact.state === "directory")
      .map((artifact) => artifact.path)
      .sort((a, b) => a.localeCompare(b));
    const actualDirectories = await collectEmptyDevelopmentDirectories(context.root, effectiveQuotas);
    if (
      snapshot.workspace_snapshot_id !== checkpoint.identity.workspace_snapshot_id
      || canonicalJson(actualDirectories) !== canonicalJson(expectedDirectories)
    ) {
      await transitionRecoveryWorkspace({ workspace_id: recoveryWorkspaceId, state: "verification_failed", last_error: "Recovered workspace snapshot or empty-directory set does not match checkpoint." });
      throw checkpointError("CHECKPOINT_RECOVERY_VERIFICATION_FAILED", "Recovered workspace state does not exactly match checkpoint snapshot and directory coverage.", { expected: checkpoint.identity.workspace_snapshot_id, actual: snapshot.workspace_snapshot_id });
    }
    await transitionRecoveryWorkspace({ workspace_id: recoveryWorkspaceId, state: "active", last_error: null });
    return { snapshot, context };
  }

  async function recover(input = {}) {
    assertObjectKeys(input, "dev_workspace_recover_checkpoint input", new Set(["checkpoint_id", "label"]));
    const checkpoint = await loadCheckpoint(assertCheckpointId(input.checkpoint_id), { requireActive: true, verifyBlobs: true });
    if (!await gitObjectExists(repositoryRoot, `${checkpoint.identity.git_head}^{commit}`)) throw checkpointError("CHECKPOINT_RECOVERY_BASE_MISSING", "Checkpoint git_head is not available in the local project object database.");
    const journalOperation = await journalApi.begin({
      operation_type: "checkpoint_recovery",
      tool_name: "dev_workspace_recover_checkpoint",
      workstream_id: checkpoint.identity.workstream_id,
      workspace_id: checkpoint.identity.workspace_id,
      links: [
        { relation: "used", checkpoint_id: checkpoint.identity.checkpoint_id },
        { relation: "derived_from", workstream_id: checkpoint.identity.workstream_id },
      ],
      result: {
        checkpoint_id: checkpoint.identity.checkpoint_id,
        git_head: checkpoint.identity.git_head,
        workspace_snapshot_id: checkpoint.identity.workspace_snapshot_id,
      },
    });
    let recoveryWorkstream = null;
    let recoveryWorkspace = null;
    try {
      recoveryWorkstream = await beginRecoveryWorkstream({
        checkpoint_id: checkpoint.identity.checkpoint_id,
        source_workstream_id: checkpoint.identity.workstream_id,
        base_head: checkpoint.identity.git_head,
        label: boundedLabel(input.label) ?? `Recovery from ${checkpoint.identity.checkpoint_id}`,
        recovery_operation_id: journalOperation.operation_id,
      });
      recoveryWorkspace = await createRecoveryIsolated({
        workstream_id: recoveryWorkstream.workstream_id,
        expected_workstream_revision: recoveryWorkstream.revision,
      });
      const restored = await materializeRecovery(checkpoint, recoveryWorkspace.workspace_id);
      await journalApi.complete(journalOperation.operation_id, {
        links: [
          { relation: "used", checkpoint_id: checkpoint.identity.checkpoint_id },
          { relation: "derived_from", workstream_id: checkpoint.identity.workstream_id },
          { relation: "produced", workstream_id: recoveryWorkstream.workstream_id },
          { relation: "produced", workspace_id: recoveryWorkspace.workspace_id },
        ],
        result: {
          checkpoint_id: checkpoint.identity.checkpoint_id,
          recovery_workstream_id: recoveryWorkstream.workstream_id,
          recovery_workspace_id: recoveryWorkspace.workspace_id,
          workspace_snapshot_id: restored.snapshot.workspace_snapshot_id,
          recovered: true,
        },
      });
      return {
        checkpoint_id: checkpoint.identity.checkpoint_id,
        recovery_workstream_id: recoveryWorkstream.workstream_id,
        recovery_workspace_id: recoveryWorkspace.workspace_id,
        git_head: checkpoint.identity.git_head,
        workspace_snapshot_id: restored.snapshot.workspace_snapshot_id,
        workspace_state: "active",
        original_workstream_id: checkpoint.identity.workstream_id,
        original_workspace_id: checkpoint.identity.workspace_id,
        operation_id: journalOperation.operation_id,
      };
    } catch (error) {
      try {
        if (recoveryWorkspace) {
          if (error?.code === "CHECKPOINT_RECOVERY_VERIFICATION_FAILED") {
            // materializeRecovery already persisted verification_failed.
          } else if (error?.code === "CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED" || error?.code === "CHECKPOINT_STORE_CORRUPT") {
            await transitionRecoveryWorkspace({ workspace_id: recoveryWorkspace.workspace_id, state: "reconciliation_required", last_error: String(error.message).slice(0, 1024) }).catch(() => {});
          } else {
            await transitionRecoveryWorkspace({ workspace_id: recoveryWorkspace.workspace_id, state: "materialization_failed", last_error: String(error.message).slice(0, 1024) }).catch(() => {});
          }
        }
        await journalApi.fail(journalOperation.operation_id, {
          links: [{ relation: "used", checkpoint_id: checkpoint.identity.checkpoint_id }],
          result: {
            checkpoint_id: checkpoint.identity.checkpoint_id,
            recovery_workstream_id: recoveryWorkstream?.workstream_id ?? null,
            recovery_workspace_id: recoveryWorkspace?.workspace_id ?? null,
            reason: String(error.message).slice(0, 512),
          },
        });
      } catch (journalError) { await journalApi.markDegraded(`checkpoint recovery failure terminal append failed: ${journalError.message}`); }
      throw error;
    }
  }

  async function deleteCheckpoint(input = {}) {
    assertObjectKeys(input, "dev_workspace_delete_checkpoint input", new Set(["checkpoint_id"]));
    const checkpointId = assertCheckpointId(input.checkpoint_id);
    const loaded = await loadCheckpoint(checkpointId, { requireActive: true, verifyBlobs: false });
    const operation = await journalApi.begin({ operation_type: "checkpoint_delete", tool_name: "dev_workspace_delete_checkpoint", workstream_id: loaded.identity.workstream_id, workspace_id: loaded.identity.workspace_id, links: [{ relation: "retires", checkpoint_id: checkpointId }], result: { checkpoint_id: checkpointId } });
    try {
      const result = await withLock(async () => {
        const registry = await reconcileRegistryUnlocked();
        const entry = registry.checkpoints.find((candidate) => candidate.checkpoint_id === checkpointId);
        if (!entry || entry.state !== "active") throw checkpointError("CHECKPOINT_DELETED", "Checkpoint is already deleted or unavailable.");
        entry.state = "deleted";
        entry.deleted_at = clock().toISOString();
        await writeRegistryUnlocked(registry);
        return structuredClone(entry);
      });
      await journalApi.complete(operation.operation_id, { links: [{ relation: "retires", checkpoint_id: checkpointId }], result: { checkpoint_id: checkpointId, deleted: true } });
      return { ...result, operation_id: operation.operation_id, physical_objects_deleted: false };
    } catch (error) {
      try { await journalApi.fail(operation.operation_id, { result: { checkpoint_id: checkpointId, reason: String(error.message).slice(0, 512) } }); } catch (journalError) { await journalApi.markDegraded(`checkpoint delete terminal append failed: ${journalError.message}`); }
      throw error;
    }
  }

  async function status() {
    try {
      return await withLock(async () => {
        const registry = await reconcileRegistryUnlocked();
        const statistics = await storeStatisticsUnlocked(registry, { verify: true });
        const { reclaimable, ...publicStats } = statistics;
        return { schema_version: DEV_CHECKPOINT_SCHEMA_VERSION, health: "healthy", registry_revision: registry.revision, storage: "server_owned_content_addressed_checkpoint_store", ...publicStats };
      });
    } catch (error) {
      return { schema_version: DEV_CHECKPOINT_SCHEMA_VERSION, health: "corrupt", registry_revision: null, storage: "server_owned_content_addressed_checkpoint_store", checkpoint_count: null, active_count: null, deleted_count: null, physical_blob_bytes: null, logical_checkpoint_bytes: null, deduplicated_bytes_saved: null, reclaimable_bytes: null, reclaimable_blob_count: null, last_health_error: String(error.message).slice(0, 1024) };
    }
  }

  async function gc(input = {}) {
    assertObjectKeys(input, "dev_workspace_checkpoint_gc input", new Set(["dryRun"]));
    const dryRun = input.dryRun ?? false;
    if (typeof dryRun !== "boolean") throw new Error("dryRun must be boolean.");
    const operation = await journalApi.begin({ operation_type: "checkpoint_gc", tool_name: "dev_workspace_checkpoint_gc", workspace_id: "dev_workspace_shared_repository_v1", result: { dry_run: dryRun } });
    try {
      const result = await withLock(async () => {
        const registry = await reconcileRegistryUnlocked();
        const statistics = await storeStatisticsUnlocked(registry, { verify: true });
        let reclaimedBytes = 0;
        let reclaimedCount = 0;
        if (!dryRun) {
          for (const blob of statistics.reclaimable) {
            const content = await readFile(blob.path);
            if (content.length !== blob.bytes || sha256Buffer(content) !== blob.sha256) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Reclaimable blob failed validation: ${blob.sha256}.`);
            await rm(blob.path);
            reclaimedBytes += blob.bytes;
            reclaimedCount += 1;
          }
        }
        return { dry_run: dryRun, reclaimable_blob_count: statistics.reclaimable_blob_count, reclaimable_bytes: statistics.reclaimable_bytes, reclaimed_blob_count: reclaimedCount, reclaimed_bytes: reclaimedBytes };
      });
      await journalApi.complete(operation.operation_id, { result });
      return { ...result, operation_id: operation.operation_id };
    } catch (error) {
      try { await journalApi.fail(operation.operation_id, { result: { dry_run: dryRun, reason: String(error.message).slice(0, 512) } }); } catch (journalError) { await journalApi.markDegraded(`checkpoint GC terminal append failed: ${journalError.message}`); }
      throw error;
    }
  }

  async function verifyActiveRecovery(checkpoint, workspaceId) {
    const context = await workspaceContextResolver({ workspace_id: workspaceId }, { mutation: false });
    const snapshot = await computeWorkspaceSnapshot(context);
    const expectedDirectories = checkpoint.content.artifacts
      .filter((artifact) => artifact.state === "directory")
      .map((artifact) => artifact.path)
      .sort((a, b) => a.localeCompare(b));
    const actualDirectories = await collectEmptyDevelopmentDirectories(context.root, effectiveQuotas);
    return snapshot.workspace_snapshot_id === checkpoint.identity.workspace_snapshot_id
      && canonicalJson(actualDirectories) === canonicalJson(expectedDirectories);
  }

  async function reconcileRecoveryEffect(record) {
    const checkpoint = await loadCheckpoint(record.checkpoint_id, { requireActive: true, verifyBlobs: true });
    let current = { ...record };
    if (!current.workspace_id) {
      const created = await createRecoveryIsolated({
        workstream_id: current.workstream_id,
        expected_workstream_revision: current.workstream_revision,
      });
      current = {
        ...current,
        workspace_id: created.workspace_id,
        workspace_state: created.state,
        workstream_revision: created.workstream_revision,
      };
    }
    if (current.workspace_state === "active") {
      if (!await verifyActiveRecovery(checkpoint, current.workspace_id)) {
        throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", "Active recovery workspace no longer matches its checkpoint.");
      }
      return { checkpoint, record: current, workspace_snapshot_id: checkpoint.identity.workspace_snapshot_id };
    }
    if (!["materializing", "verifying"].includes(current.workspace_state)) {
      throw checkpointError("CHECKPOINT_RECOVERY_RECONCILIATION_REQUIRED", `Recovery workspace is not safely resumable from state ${current.workspace_state}.`);
    }
    const restored = await materializeRecovery(checkpoint, current.workspace_id);
    return { checkpoint, record: { ...current, workspace_state: "active" }, workspace_snapshot_id: restored.snapshot.workspace_snapshot_id };
  }

  async function resumeRecovery(record) {
    const operation = await journalApi.begin({
      operation_type: "checkpoint_recovery_reconcile",
      tool_name: "initialize_dev_checkpoint_runtime",
      workstream_id: record.workstream_id,
      workspace_id: record.workspace_id ?? "dev_workspace_shared_repository_v1",
      links: [{ relation: "used", checkpoint_id: record.checkpoint_id }, { relation: "derived_from", workstream_id: record.derived_from_workstream_id }],
      result: { checkpoint_id: record.checkpoint_id, recovery_workstream_id: record.workstream_id, recovery_workspace_id: record.workspace_id },
    });
    try {
      const restored = await reconcileRecoveryEffect(record);
      await journalApi.complete(operation.operation_id, {
        links: [
          { relation: "used", checkpoint_id: record.checkpoint_id },
          { relation: "produced", workstream_id: record.workstream_id },
          { relation: "produced", workspace_id: restored.record.workspace_id },
        ],
        result: {
          checkpoint_id: record.checkpoint_id,
          recovery_workstream_id: record.workstream_id,
          recovery_workspace_id: restored.record.workspace_id,
          workspace_snapshot_id: restored.workspace_snapshot_id,
          reconciled: true,
        },
      });
      return true;
    } catch (error) {
      if (record.workspace_id) {
        await transitionRecoveryWorkspace({ workspace_id: record.workspace_id, state: "reconciliation_required", last_error: String(error.message).slice(0, 1024) }).catch(() => {});
      }
      try { await journalApi.fail(operation.operation_id, { result: { checkpoint_id: record.checkpoint_id, reason: String(error.message).slice(0, 512) } }); } catch (journalError) { await journalApi.markDegraded(`checkpoint recovery reconciliation terminal append failed: ${journalError.message}`); }
      return false;
    }
  }

  async function initialize() {
    await withLock(async () => { await reconcileRegistryUnlocked(); });
    const recoveries = await listRecoveryWorkspaces();
    let resumed = 0;
    let reconciliationRequired = 0;
    for (const record of recoveries) {
      if (!["creating", "materializing", "verifying"].includes(record.workspace_state)) continue;
      if (await resumeRecovery(record)) resumed += 1;
      else reconciliationRequired += 1;
    }
    return { initialized: true, resumed_recoveries: resumed, reconciliation_required: reconciliationRequired };
  }

  async function reconcileDanglingGc(started) {
    if (started.result?.dry_run === true) return { outcome: "no_effect_observed", reconciliation_required: false };
    try {
      await withLock(async () => {
        const registry = await reconcileRegistryUnlocked();
        const statistics = await storeStatisticsUnlocked(registry, { verify: true });
        for (const blob of statistics.reclaimable) {
          const content = await readFile(blob.path);
          if (content.length !== blob.bytes || sha256Buffer(content) !== blob.sha256) throw checkpointError("CHECKPOINT_STORE_CORRUPT", `Reclaimable blob failed validation: ${blob.sha256}.`);
          await rm(blob.path);
        }
      });
      return { outcome: "intended_effect_observed", reconciliation_required: false };
    } catch {
      return { outcome: "ambiguous_effect", reconciliation_required: true };
    }
  }

  async function reconcileDanglingRecovery(started) {
    const checkpointId = started.result?.checkpoint_id;
    if (!checkpointIdPattern.test(checkpointId ?? "")) return { outcome: "ambiguous_effect", reconciliation_required: true };
    try {
      const recoveries = await listRecoveryWorkspaces();
      let candidates;
      if (started.operation_type === "checkpoint_recovery") {
        candidates = recoveries.filter((record) => record.recovery_operation_id === started.operation_id);
      } else {
        const recoveryWorkstreamId = started.result?.recovery_workstream_id;
        candidates = recoveries.filter((record) => record.workstream_id === recoveryWorkstreamId && record.checkpoint_id === checkpointId);
      }
      if (candidates.length === 0) return { outcome: "no_effect_observed", reconciliation_required: false };
      if (candidates.length !== 1) return { outcome: "ambiguous_effect", reconciliation_required: true };
      await reconcileRecoveryEffect(candidates[0]);
      return { outcome: "intended_effect_observed", reconciliation_required: false };
    } catch {
      return { outcome: "ambiguous_effect", reconciliation_required: true };
    }
  }

  async function inspectOperationEffect(started) {
    if (!isObject(started)) return { outcome: "ambiguous_effect", reconciliation_required: true };
    if (started.operation_type === "checkpoint_create") {
      const checkpointId = started.result?.checkpoint_id;
      if (!checkpointIdPattern.test(checkpointId ?? "")) return { outcome: "ambiguous_effect", reconciliation_required: true };
      try { await readIdentity(checkpointId); return { outcome: "intended_effect_observed", reconciliation_required: false }; } catch (error) {
        if (error?.code === "CHECKPOINT_NOT_FOUND") return { outcome: "no_effect_observed", reconciliation_required: false };
        return { outcome: "ambiguous_effect", reconciliation_required: true };
      }
    }
    if (started.operation_type === "checkpoint_delete") {
      const checkpointId = started.result?.checkpoint_id;
      try {
        return await withLock(async () => {
          const registry = await reconcileRegistryUnlocked();
          const entry = registry.checkpoints.find((candidate) => candidate.checkpoint_id === checkpointId);
          if (!entry) return { outcome: "ambiguous_effect", reconciliation_required: true };
          return { outcome: entry.state === "deleted" ? "intended_effect_observed" : "no_effect_observed", reconciliation_required: false };
        });
      } catch { return { outcome: "ambiguous_effect", reconciliation_required: true }; }
    }
    if (started.operation_type === "checkpoint_gc") return reconcileDanglingGc(started);
    if (started.operation_type === "checkpoint_recovery" || started.operation_type === "checkpoint_recovery_reconcile") {
      return reconcileDanglingRecovery(started);
    }
    return { outcome: "no_effect_observed", reconciliation_required: false };
  }

  return {
    create,
    get,
    list,
    compare,
    readCheckpointFile,
    recover,
    deleteCheckpoint,
    gc,
    status,
    initialize,
    inspectOperationEffect,
    storageRoot,
  };
}

const defaultCheckpointService = createDevCheckpointService();

export const dev_workspace_create_checkpoint = (input) => defaultCheckpointService.create(input);
export const dev_workspace_get_checkpoint = (input) => defaultCheckpointService.get(input);
export const dev_workspace_list_checkpoints = (input) => defaultCheckpointService.list(input);
export const dev_workspace_compare_checkpoint = (input) => defaultCheckpointService.compare(input);
export const dev_workspace_read_checkpoint_file = (input) => defaultCheckpointService.readCheckpointFile(input);
export const dev_workspace_recover_checkpoint = (input) => defaultCheckpointService.recover(input);
export const dev_workspace_delete_checkpoint = (input) => defaultCheckpointService.deleteCheckpoint(input);
export const dev_workspace_checkpoint_gc = (input) => defaultCheckpointService.gc(input);
export const dev_workspace_checkpoint_status = () => defaultCheckpointService.status();
export const initializeDevCheckpointRuntime = () => defaultCheckpointService.initialize();
export const inspectDevCheckpointOperationEffect = (started) => defaultCheckpointService.inspectOperationEffect(started);
