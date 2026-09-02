import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { commitFileTransaction } from "./file-transactions.mjs";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths, projectRoot, resolveProjectPath } from "./project-paths.mjs";

const execFileAsync = promisify(execFile);

export const DEV_WORKSTREAM_SCHEMA_VERSION = 1;
export const DEV_WORKSTREAM_PURPOSES = Object.freeze(["primary", "experiment", "candidate"]);
export const DEV_WORKSTREAM_STATES = Object.freeze([
  "active",
  "paused",
  "blocked",
  "completed",
  "abandoned",
]);
export const DEV_WORKSTREAM_MUTABLE_STATES = Object.freeze(["active", "paused", "blocked"]);
export const DEV_WORKSTREAM_TERMINAL_STATES = Object.freeze(["completed", "abandoned"]);
export const DEV_WORKSTREAM_MODES = Object.freeze(["shared", "isolated"]);
export const DEV_WORKSTREAM_SUPPORTED_MODE = "shared";
export const DEV_WORKSPACE_TYPES = Object.freeze(["isolated_worktree"]);
export const DEV_WORKSPACE_STATES = Object.freeze(["creating", "active", "removing", "removed", "error"]);
export const DEV_WORKSPACE_MAX_LIST_RESULTS = 100;
export const DEV_WORKSPACE_ID_PATTERN_SOURCE = "^dev_workspace_[a-f0-9]{24}$";
export const DEV_WORKSPACE_EXECUTION_ID_PATTERN_SOURCE = "^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$";
export const DEV_WORKSTREAM_LIST_LIFECYCLES = Object.freeze(["all", "active", "terminal"]);
export const DEV_WORKSTREAM_MAX_LABEL_CHARACTERS = 160;
export const DEV_WORKSTREAM_MAX_DEPENDENCIES = 16;
export const DEV_WORKSTREAM_MAX_SCOPE_ENTRIES = 64;
export const DEV_WORKSTREAM_MAX_SCOPE_ITEM_CHARACTERS = 256;
export const DEV_WORKSTREAM_MAX_METADATA_PROPERTIES = 16;
export const DEV_WORKSTREAM_MAX_METADATA_STRING_CHARACTERS = 512;
export const DEV_WORKSTREAM_MAX_RECORDS = 1000;
export const DEV_WORKSTREAM_MAX_LIST_RESULTS = 100;
export const DEV_WORKSTREAM_ID_PATTERN_SOURCE = "^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$";
export const DEV_WORKSTREAM_WORKSPACE_ID = "dev_workspace_shared_repository_v1";

const workstreamIdPattern = new RegExp(DEV_WORKSTREAM_ID_PATTERN_SOURCE, "u");
const workspaceIdPattern = new RegExp(DEV_WORKSPACE_ID_PATTERN_SOURCE, "u");
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const workspaceStateSet = new Set(DEV_WORKSPACE_STATES);
const workspaceTypeSet = new Set(DEV_WORKSPACE_TYPES);
const purposeSet = new Set(DEV_WORKSTREAM_PURPOSES);
const stateSet = new Set(DEV_WORKSTREAM_STATES);
const mutableStateSet = new Set(DEV_WORKSTREAM_MUTABLE_STATES);
const terminalStateSet = new Set(DEV_WORKSTREAM_TERMINAL_STATES);
const lifecycleSet = new Set(DEV_WORKSTREAM_LIST_LIFECYCLES);
const defaultRegistryPath = path.join(
  projectPaths.outputLogs,
  "development_runtime",
  "workstream_registry.json",
);
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const allowedRecordFields = new Set([
  "workstream_id",
  "schema_version",
  "revision",
  "label",
  "purpose",
  "state",
  "mode",
  "base_head",
  "created_at",
  "updated_at",
  "last_activity_at",
  "parent_workstream_id",
  "depends_on",
  "declared_scope",
  "workspace_id",
  "workspace",
  "metadata",
]);
const allowedRegistryFields = new Set([
  "schema_version",
  "revision",
  "updated_at",
  "workstreams",
  "checksum_sha256",
]);
const legalNonTerminalTransitions = Object.freeze({
  active: new Set(["active", "paused", "blocked"]),
  paused: new Set(["active", "paused", "blocked"]),
  blocked: new Set(["active", "paused", "blocked"]),
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(input, label, allowedKeys) {
  if (!isObject(input)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept ${unknown.sort().join(", ")}.`);
  }
}

function codePointLength(value) {
  return Array.from(value).length;
}

function assertBoundedString(value, label, { min = 1, max }) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  const length = codePointLength(normalized);
  if (length < min || length > max) {
    throw new Error(`${label} must contain ${min}-${max} characters after trimming.`);
  }
  if (/\u0000/u.test(normalized)) throw new Error(`${label} cannot contain NUL.`);
  return normalized;
}

function assertEnum(value, label, allowed) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} must be one of: ${[...allowed].join(", ")}.`);
  }
  return value;
}

function assertWorkstreamId(value, label = "workstream_id") {
  if (typeof value !== "string" || !workstreamIdPattern.test(value)) {
    throw new Error(`${label} must be a server-issued workstream ID.`);
  }
  return value;
}

function assertOptionalWorkstreamId(value, label) {
  if (value === undefined || value === null) return null;
  return assertWorkstreamId(value, label);
}

function normalizeIdList(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > DEV_WORKSTREAM_MAX_DEPENDENCIES) {
    throw new Error(`${label} must contain at most ${DEV_WORKSTREAM_MAX_DEPENDENCIES} items.`);
  }
  const seen = new Set();
  const normalized = [];
  for (let index = 0; index < value.length; index += 1) {
    const id = assertWorkstreamId(value[index], `${label}[${index}]`);
    if (!seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  }
  return normalized;
}

function normalizeDeclaredScope(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("declared_scope must be an array of bounded strings.");
  if (value.length > DEV_WORKSTREAM_MAX_SCOPE_ENTRIES) {
    throw new Error(`declared_scope must contain at most ${DEV_WORKSTREAM_MAX_SCOPE_ENTRIES} items.`);
  }
  const seen = new Set();
  const normalized = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = assertBoundedString(value[index], `declared_scope[${index}]`, {
      min: 1,
      max: DEV_WORKSTREAM_MAX_SCOPE_ITEM_CHARACTERS,
    });
    if (!seen.has(item)) {
      seen.add(item);
      normalized.push(item);
    }
  }
  return normalized;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new Error("metadata must be a bounded object.");
  const entries = Object.entries(value);
  if (entries.length > DEV_WORKSTREAM_MAX_METADATA_PROPERTIES) {
    throw new Error(`metadata must contain at most ${DEV_WORKSTREAM_MAX_METADATA_PROPERTIES} properties.`);
  }
  const normalized = {};
  for (const [key, raw] of entries) {
    const safeKey = assertBoundedString(key, "metadata key", { min: 1, max: 64 });
    if (!/^[A-Za-z0-9_.-]+$/u.test(safeKey)) {
      throw new Error("metadata keys may contain only letters, digits, '.', '_' and '-'.");
    }
    if (typeof raw === "string") {
      normalized[safeKey] = assertBoundedString(raw, `metadata.${safeKey}`, {
        min: 0,
        max: DEV_WORKSTREAM_MAX_METADATA_STRING_CHARACTERS,
      });
    } else if (typeof raw === "boolean") {
      normalized[safeKey] = raw;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      normalized[safeKey] = raw;
    } else if (raw === null) {
      normalized[safeKey] = null;
    } else {
      throw new Error(`metadata.${safeKey} must be a string, finite number, boolean, or null.`);
    }
  }
  return normalized;
}

function isoTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return value;
}

function registryPayload(registry) {
  return {
    schema_version: registry.schema_version,
    revision: registry.revision,
    updated_at: registry.updated_at,
    workstreams: registry.workstreams,
  };
}

function registryChecksum(registry) {
  return createHash("sha256").update(JSON.stringify(registryPayload(registry)), "utf8").digest("hex");
}

function createEmptyRegistry() {
  return {
    schema_version: DEV_WORKSTREAM_SCHEMA_VERSION,
    revision: 0,
    updated_at: null,
    workstreams: [],
    checksum_sha256: null,
  };
}

function validateWorkspaceRecord(workspace, workstreamId) {
  if (workspace === undefined || workspace === null) return null;
  const allowed = new Set([
    "workspace_id", "workstream_id", "workspace_type", "state", "repository_root",
    "worktree_relative_path", "branch_name", "base_head", "created_at", "updated_at",
    "locked", "lock_reason", "git_worktree_head", "revision", "last_error",
  ]);
  assertObject(workspace, "workspace record", allowed);
  if (typeof workspace.workspace_id !== "string" || !workspaceIdPattern.test(workspace.workspace_id)) {
    throw new Error("workspace_id must be a server-issued workspace ID.");
  }
  if (workspace.workstream_id !== workstreamId) throw new Error("workspace workstream_id mapping mismatch.");
  assertEnum(workspace.workspace_type, "workspace_type", workspaceTypeSet);
  assertEnum(workspace.state, "workspace state", workspaceStateSet);
  if (workspace.repository_root !== ".") throw new Error("workspace repository_root must use the server-owned canonical repository identity.");
  if (workspace.worktree_relative_path !== `../.writer-workbench-worktrees/${workspace.workspace_id}`) {
    throw new Error("workspace worktree_relative_path does not match the server-owned workspace ID mapping.");
  }
  if (workspace.branch_name !== workspaceBranchForId(workspace.workspace_id)) {
    throw new Error("workspace branch_name does not match the server-owned workspace ID mapping.");
  }
  if (typeof workspace.base_head !== "string" || !gitSha1Pattern.test(workspace.base_head)) throw new Error("workspace base_head is invalid.");
  isoTimestamp(workspace.created_at, "workspace created_at");
  isoTimestamp(workspace.updated_at, "workspace updated_at");
  if (typeof workspace.locked !== "boolean") throw new Error("workspace locked must be boolean.");
  if (workspace.lock_reason !== null && typeof workspace.lock_reason !== "string") throw new Error("workspace lock_reason must be string or null.");
  if (workspace.git_worktree_head !== null && (typeof workspace.git_worktree_head !== "string" || !gitSha1Pattern.test(workspace.git_worktree_head))) {
    throw new Error("workspace git_worktree_head is invalid.");
  }
  if (!Number.isSafeInteger(workspace.revision) || workspace.revision < 1) throw new Error("workspace revision must be positive.");
  if (workspace.last_error !== null && typeof workspace.last_error !== "string") throw new Error("workspace last_error must be string or null.");
  return workspace;
}

function validateRecord(record) {
  assertObject(record, "workstream record", allowedRecordFields);
  assertWorkstreamId(record.workstream_id);
  if (record.schema_version !== DEV_WORKSTREAM_SCHEMA_VERSION) {
    throw new Error(`Unsupported workstream schema_version: ${record.schema_version}.`);
  }
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new Error("workstream revision must be a positive safe integer.");
  }
  assertBoundedString(record.label, "label", { min: 1, max: DEV_WORKSTREAM_MAX_LABEL_CHARACTERS });
  assertEnum(record.purpose, "purpose", purposeSet);
  assertEnum(record.state, "state", stateSet);
  if (!DEV_WORKSTREAM_MODES.includes(record.mode)) throw new Error(`Persisted workstream mode must be one of: ${DEV_WORKSTREAM_MODES.join(", ")}.`);
  if (typeof record.base_head !== "string" || !gitSha1Pattern.test(record.base_head)) {
    throw new Error("base_head must be an exact lowercase Git SHA-1.");
  }
  isoTimestamp(record.created_at, "created_at");
  isoTimestamp(record.updated_at, "updated_at");
  isoTimestamp(record.last_activity_at, "last_activity_at");
  if (record.parent_workstream_id !== null) {
    assertWorkstreamId(record.parent_workstream_id, "parent_workstream_id");
  }
  normalizeIdList(record.depends_on, "depends_on");
  normalizeDeclaredScope(record.declared_scope);
  if (record.mode === "shared") {
    if (record.workspace_id !== DEV_WORKSTREAM_WORKSPACE_ID) throw new Error("shared workspace_id is invalid.");
    if (record.workspace !== undefined && record.workspace !== null) throw new Error("shared workstream cannot persist an isolated workspace record.");
  } else {
    validateWorkspaceRecord(record.workspace, record.workstream_id);
    if (!record.workspace || record.workspace_id !== record.workspace.workspace_id) throw new Error("isolated workspace_id mapping mismatch.");
  }
  normalizeMetadata(record.metadata);
  return record;
}

function validateRegistry(registry, { requireChecksum = true } = {}) {
  assertObject(registry, "workstream registry", allowedRegistryFields);
  if (registry.schema_version !== DEV_WORKSTREAM_SCHEMA_VERSION) {
    throw new Error(`Unsupported registry schema_version: ${registry.schema_version}.`);
  }
  if (!Number.isSafeInteger(registry.revision) || registry.revision < 0) {
    throw new Error("registry revision must be a non-negative safe integer.");
  }
  if (registry.updated_at !== null) isoTimestamp(registry.updated_at, "registry updated_at");
  if (!Array.isArray(registry.workstreams)) throw new Error("registry workstreams must be an array.");
  if (registry.workstreams.length > DEV_WORKSTREAM_MAX_RECORDS) {
    throw new Error(`registry exceeds the ${DEV_WORKSTREAM_MAX_RECORDS}-workstream limit.`);
  }
  const seen = new Set();
  for (const record of registry.workstreams) {
    validateRecord(record);
    if (seen.has(record.workstream_id)) throw new Error(`Duplicate workstream ID: ${record.workstream_id}.`);
    seen.add(record.workstream_id);
  }
  if (registry.revision === 0 && registry.workstreams.length === 0) {
    if (requireChecksum && registry.checksum_sha256 !== null) {
      throw new Error("Empty registry checksum must be null.");
    }
    return registry;
  }
  if (typeof registry.checksum_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(registry.checksum_sha256)) {
    throw new Error("registry checksum_sha256 is missing or invalid.");
  }
  if (requireChecksum && registryChecksum(registry) !== registry.checksum_sha256) {
    throw new Error("workstream registry checksum mismatch; storage is corrupt or externally modified.");
  }
  return registry;
}

function encodeRegistry(registry) {
  const next = { ...registry, checksum_sha256: registryChecksum(registry) };
  validateRegistry(next);
  return `${JSON.stringify(next, null, 2)}\n`;
}

function parseRegistryBuffer(content) {
  let parsed;
  try {
    parsed = JSON.parse(content.toString("utf8"));
  } catch (error) {
    throw new Error(`workstream registry is malformed JSON: ${error.message}`);
  }
  return validateRegistry(parsed);
}

function cloneRegistry(registry) {
  return structuredClone(registry);
}

function findRecord(registry, workstreamId) {
  return registry.workstreams.find((record) => record.workstream_id === workstreamId) ?? null;
}

function assertDependencyTargets(registry, workstreamId, parentWorkstreamId, dependsOn) {
  const targets = [parentWorkstreamId, ...dependsOn].filter(Boolean);
  for (const targetId of targets) {
    if (targetId === workstreamId) throw new Error("A workstream cannot depend on itself.");
    if (!findRecord(registry, targetId)) {
      throw new Error(`Referenced workstream does not exist: ${targetId}.`);
    }
  }
}

function outgoingIds(record) {
  return [record.parent_workstream_id, ...record.depends_on].filter(Boolean);
}

function assertAcyclic(registry) {
  const byId = new Map(registry.workstreams.map((record) => [record.workstream_id, record]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`Workstream dependency cycle detected at ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    const record = byId.get(id);
    if (record) {
      for (const nextId of outgoingIds(record)) visit(nextId);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}

function scopeOverlap(a, b) {
  const left = new Set(a.map((item) => item.toLowerCase()));
  return b.some((item) => left.has(item.toLowerCase()));
}

function withOverlap(registry, record) {
  const overlapping = registry.workstreams
    .filter((candidate) => candidate.workstream_id !== record.workstream_id)
    .filter((candidate) => !terminalStateSet.has(candidate.state))
    .filter((candidate) => scopeOverlap(record.declared_scope, candidate.declared_scope))
    .map((candidate) => candidate.workstream_id)
    .slice(0, DEV_WORKSTREAM_MAX_LIST_RESULTS);
  return {
    ...structuredClone(record),
    potential_overlap: overlapping.length > 0,
    overlap_workstream_ids: overlapping,
  };
}

function generateWorkstreamId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/gu, "").replace("T", "-").slice(0, 15);
  return `dev_workstream_${stamp}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

const worktreeRoot = path.join(path.dirname(projectRoot), ".writer-workbench-worktrees");

function generateWorkspaceId() {
  return `dev_workspace_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function workspacePathForId(workspaceId, root = worktreeRoot) {
  if (!workspaceIdPattern.test(workspaceId)) throw new Error("Invalid server workspace ID.");
  return path.join(root, workspaceId);
}

function workspaceRelativePath(workspaceId, root = worktreeRoot, repositoryRoot = projectRoot) {
  return path.relative(repositoryRoot, workspacePathForId(workspaceId, root)).replaceAll(path.sep, "/");
}

function workspaceBranchForId(workspaceId) {
  return `dev-ws/${workspaceId.slice("dev_workspace_".length)}`;
}

async function runFixedGit(args, { cwd = projectRoot, timeout = 30_000, maxBuffer = 256 * 1024 } = {}) {
  return execFileAsync(fixedGitExecutable, ["--no-pager", "-c", "core.fsmonitor=false", ...args], {
    cwd,
    env: controlledProcessEnvironment({
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_PAGER: "cat",
      PAGER: "cat",
      GIT_TERMINAL_PROMPT: "0",
    }),
    windowsHide: true,
    timeout,
    maxBuffer,
    shell: false,
  });
}

function normalizeGitMetadataPath(root, value, label) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${label} could not be resolved.`);
  return path.resolve(root, raw);
}

async function ensureSafeWorktreeRoot(root = worktreeRoot) {
  const parent = path.dirname(root);
  const parentInfo = await lstat(parent);
  if (parentInfo.isSymbolicLink()) throw new Error("Repository parent cannot be a symbolic link for isolated worktrees.");
  try {
    const info = await lstat(root);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Server worktree root is not a safe directory.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(root, { recursive: false });
    const info = await lstat(root);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Server worktree root creation was unsafe.");
  }
}

async function readLocalHead() {
  const { stdout } = await execFileAsync(
    fixedGitExecutable,
    ["--no-pager", "-c", "core.fsmonitor=false", "rev-parse", "--verify", "HEAD"],
    {
      cwd: projectRoot,
      env: controlledProcessEnvironment({
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_PAGER: "cat",
        PAGER: "cat",
        GIT_TERMINAL_PROMPT: "0",
      }),
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 8 * 1024,
      shell: false,
    },
  );
  const head = String(stdout).trim().toLowerCase();
  if (!gitSha1Pattern.test(head)) throw new Error("Could not read a valid local Git HEAD.");
  return head;
}

function normalizeRegistryPath(value) {
  const resolved = resolveProjectPath(value, "workstream registry path");
  return resolved;
}

async function assertSafeRegistryFile(filePath) {
  let info;
  try {
    info = await lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, size: 0 };
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error("workstream registry path cannot be a symbolic link or junction.");
  if (!info.isFile()) throw new Error("workstream registry path must be a regular file.");
  if (info.size > 4 * 1024 * 1024) throw new Error("workstream registry exceeds the 4 MiB safety limit.");
  return { exists: true, size: info.size };
}

export function createDevWorkstreamRegistryService({
  registryPath = defaultRegistryPath,
  headReader = readLocalHead,
  clock = () => new Date(),
  idGenerator = generateWorkstreamId,
  workspaceIdGenerator = generateWorkspaceId,
  repositoryRoot = projectRoot,
  worktreeRootPath = worktreeRoot,
  gitRunner = runFixedGit,
} = {}) {
  const storagePath = normalizeRegistryPath(registryPath);

  const absoluteWorkspacePath = (workspaceId) => workspacePathForId(workspaceId, worktreeRootPath);
  const relativeWorkspacePath = (workspaceId) => workspaceRelativePath(workspaceId, worktreeRootPath, repositoryRoot);

  async function listGitWorktrees() {
    const { stdout } = await gitRunner(["worktree", "list", "--porcelain", "-z"], { cwd: repositoryRoot });
    const tokens = String(stdout).split("\0");
    const entries = [];
    let current = null;
    for (const token of tokens) {
      if (!token) continue;
      if (token.startsWith("worktree ")) {
        if (current) entries.push(current);
        current = { path: token.slice(9), head: null, branch: null, locked: false, lock_reason: null };
      } else if (current && token.startsWith("HEAD ")) current.head = token.slice(5).toLowerCase();
      else if (current && token.startsWith("branch refs/heads/")) current.branch = token.slice("branch refs/heads/".length);
      else if (current && token === "locked") current.locked = true;
      else if (current && token.startsWith("locked ")) { current.locked = true; current.lock_reason = token.slice(7); }
    }
    if (current) entries.push(current);
    return entries;
  }

  async function findUnregisteredServerWorktrees(registry) {
    const registeredPaths = new Set(
      registry.workstreams
        .filter((record) => record.workspace)
        .map((record) => path.resolve(absoluteWorkspacePath(record.workspace.workspace_id))),
    );
    const rootPrefix = `${path.resolve(worktreeRootPath)}${path.sep}`;
    return (await listGitWorktrees())
      .filter((entry) => path.resolve(entry.path).startsWith(rootPrefix))
      .filter((entry) => !registeredPaths.has(path.resolve(entry.path)))
      .slice(0, DEV_WORKSPACE_MAX_LIST_RESULTS)
      .map((entry) => ({
        workspace_id_hint: path.basename(entry.path),
        branch_name: entry.branch,
        git_worktree_head: entry.head,
        locked: entry.locked,
      }));
  }

  async function inspectRegisteredWorkspace(workspace) {
    const absolutePath = absoluteWorkspacePath(workspace.workspace_id);
    let pathExists = false;
    try {
      const info = await lstat(absolutePath);
      pathExists = info.isDirectory() && !info.isSymbolicLink();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const entries = await listGitWorktrees();
    const mapping = entries.find((entry) => path.resolve(entry.path) === path.resolve(absolutePath)) ?? null;
    let dirty = null;
    let staged = [];
    let conflicted = [];
    let untracked = [];
    if (pathExists && mapping) {
      const { stdout } = await gitRunner(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: absolutePath });
      const lines = String(stdout).split(/\r?\n/u).filter(Boolean);
      staged = lines.filter((line) => line[0] && line[0] !== " " && line[0] !== "?").map((line) => line.slice(3));
      conflicted = lines.filter((line) => ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(line.slice(0, 2))).map((line) => line.slice(3));
      untracked = lines.filter((line) => line.startsWith("?? ")).map((line) => line.slice(3));
      dirty = lines.length > 0;
    }
    const mappingConsistent = workspace.worktree_relative_path === relativeWorkspacePath(workspace.workspace_id)
      && workspace.branch_name === workspaceBranchForId(workspace.workspace_id);
    const branchMatches = mapping?.branch === workspace.branch_name;
    return {
      filesystem_path_exists: pathExists,
      git_worktree_mapping_exists: Boolean(mapping),
      registered_branch_matches: Boolean(mapping) && branchMatches,
      git_worktree_head: mapping?.head ?? null,
      locked: Boolean(mapping?.locked),
      lock_reason: mapping?.lock_reason ?? null,
      dirty,
      staged,
      conflicted,
      untracked,
      registry_mapping_consistent: mappingConsistent,
      healthy: pathExists && Boolean(mapping) && branchMatches && mappingConsistent,
    };
  }

  async function readRegistryWithHealth() {
    const info = await assertSafeRegistryFile(storagePath);
    if (!info.exists) {
      return {
        registry: createEmptyRegistry(),
        health: "healthy",
        storage_health: "not_initialized",
      };
    }
    try {
      const registry = parseRegistryBuffer(await readFile(storagePath));
      return { registry, health: "healthy", storage_health: "healthy" };
    } catch (error) {
      error.code = "WORKSTREAM_REGISTRY_CORRUPT";
      throw error;
    }
  }

  async function mutate(toolName, mutation) {
    let mutationResult;
    await commitFileTransaction("dev-workstream-registry", [
      {
        type: "write",
        filePath: storagePath,
        contentFactory: async ({ previousExists, previousContent }) => {
          let current;
          if (previousExists) {
            current = parseRegistryBuffer(previousContent);
          } else {
            current = createEmptyRegistry();
          }
          const working = cloneRegistry(current);
          const resultFactory = await mutation(working, current);
          const now = clock().toISOString();
          working.schema_version = DEV_WORKSTREAM_SCHEMA_VERSION;
          working.revision = current.revision + 1;
          working.updated_at = now;
          validateRegistry({ ...working, checksum_sha256: registryChecksum(working) }, { requireChecksum: false });
          mutationResult = typeof resultFactory === "function"
            ? resultFactory(working)
            : resultFactory;
          return encodeRegistry(working);
        },
      },
    ], {
      tool: toolName,
      runtime: "development_workstream_registry",
    });
    return mutationResult;
  }

  function assertExpectedRevision(record, expectedRevision) {
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
      throw new Error("expected_workstream_revision must be a positive safe integer.");
    }
    if (expectedRevision !== undefined && record.revision !== expectedRevision) {
      const error = new Error(`stale workstream revision: expected ${expectedRevision}, current ${record.revision}.`);
      error.code = "WORKSTREAM_STALE_REVISION";
      throw error;
    }
  }

  async function workspaceView(record) {
    if (!record.workspace) return null;
    const health = await inspectRegisteredWorkspace(record.workspace);
    const expectedRemoved = record.workspace.state === "removed";
    return {
      ...structuredClone(record.workspace),
      ...health,
      healthy: expectedRemoved
        ? !health.filesystem_path_exists && !health.git_worktree_mapping_exists && health.registry_mapping_consistent
        : health.healthy && record.workspace.locked === health.locked,
    };
  }

  async function createIsolated(input = {}) {
    const allowed = new Set(["workstream_id", "expected_workstream_revision"]);
    assertObject(input, "dev_workspace_create_isolated input", allowed);
    const workstreamId = assertWorkstreamId(input.workstream_id);
    const expectedRevision = input.expected_workstream_revision;

    return mutate("dev_workspace_create_isolated", async (registry) => {
      const record = findRecord(registry, workstreamId);
      if (!record) throw new Error(`Unknown workstream: ${workstreamId}.`);
      if (terminalStateSet.has(record.state)) throw new Error("Terminal workstreams cannot create isolated workspaces.");
      assertExpectedRevision(record, expectedRevision);
      if (record.mode !== "shared" || record.workspace) throw new Error("Workstream already has an isolated workspace lifecycle record.");

      await ensureSafeWorktreeRoot(worktreeRootPath);
      const unregistered = await findUnregisteredServerWorktrees(registry);
      if (unregistered.length > 0) {
        const error = new Error("Unregistered server-owned worktree metadata exists; reconciliation is required before creating another isolated workspace.");
        error.code = "WORKSPACE_RECONCILIATION_REQUIRED";
        error.unregistered_server_worktree_count = unregistered.length;
        throw error;
      }
      let workspaceId;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = workspaceIdGenerator();
        if (typeof candidate !== "string" || !workspaceIdPattern.test(candidate)) throw new Error("Server workspace ID generator returned an invalid ID.");
        if (!registry.workstreams.some((candidateRecord) => candidateRecord.workspace_id === candidate)) {
          workspaceId = candidate;
          break;
        }
      }
      if (!workspaceId) throw new Error("Could not generate a unique workspace ID.");
      const branchName = workspaceBranchForId(workspaceId);
      const absolutePath = absoluteWorkspacePath(workspaceId);
      const relativePath = relativeWorkspacePath(workspaceId);
      if (relativePath !== `../.writer-workbench-worktrees/${workspaceId}`) throw new Error("Server worktree root resolved outside the approved repository-adjacent location.");
      try {
        await access(absolutePath);
        throw new Error("Generated worktree path already exists; refusing collision.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const branchCheck = await gitRunner(["branch", "--list", branchName], { cwd: repositoryRoot });
      if (String(branchCheck.stdout).trim()) throw new Error("Generated worktree branch already exists outside the registry; refusing collision.");
      await gitRunner(["cat-file", "-e", `${record.base_head}^{commit}`], { cwd: repositoryRoot });

      const now = clock().toISOString();
      record.mode = "isolated";
      record.workspace_id = workspaceId;
      record.workspace = {
        workspace_id: workspaceId,
        workstream_id: workstreamId,
        workspace_type: "isolated_worktree",
        state: "creating",
        repository_root: ".",
        worktree_relative_path: relativePath,
        branch_name: branchName,
        base_head: record.base_head,
        created_at: now,
        updated_at: now,
        locked: false,
        lock_reason: null,
        git_worktree_head: null,
        revision: 1,
        last_error: null,
      };

      let added = false;
      try {
        await gitRunner(["worktree", "add", "-b", branchName, absolutePath, record.base_head], { cwd: repositoryRoot, timeout: 60_000 });
        added = true;
        const reason = `Writer Workbench active workspace ${workspaceId}`;
        await gitRunner(["worktree", "lock", "--reason", reason, absolutePath], { cwd: repositoryRoot });
        const health = await inspectRegisteredWorkspace(record.workspace);
        if (!health.filesystem_path_exists || !health.git_worktree_mapping_exists || !health.registered_branch_matches) {
          throw new Error("Created worktree failed mapping verification.");
        }
        if (health.git_worktree_head !== record.base_head) throw new Error("Created worktree HEAD does not match the server-captured workstream base_head.");
        if (!health.locked) throw new Error("Created worktree is not Git-locked.");
        record.workspace.state = "active";
        record.workspace.locked = true;
        record.workspace.lock_reason = health.lock_reason ?? reason;
        record.workspace.git_worktree_head = health.git_worktree_head;
        record.workspace.updated_at = clock().toISOString();
        record.workspace.revision += 1;
        record.revision += 1;
        record.updated_at = record.workspace.updated_at;
        record.last_activity_at = record.workspace.updated_at;
        return (nextRegistry) => ({
          ...(findRecord(nextRegistry, workstreamId).workspace),
          registry_revision: nextRegistry.revision,
          workstream_revision: findRecord(nextRegistry, workstreamId).revision,
          isolated_from_committed_state_only: true,
          main_uncommitted_changes_copied: false,
        });
      } catch (error) {
        if (added) {
          try { await gitRunner(["worktree", "unlock", absolutePath], { cwd: repositoryRoot }); } catch {}
          try { await gitRunner(["worktree", "remove", absolutePath], { cwd: repositoryRoot }); } catch {}
        }
        throw error;
      }
    });
  }

  async function resolveExecutionContext(input = {}, { mutation = false } = {}) {
    const allowed = new Set(["workspace_id"]);
    assertObject(input, "workspace execution context input", allowed);
    const workspaceId = input.workspace_id ?? DEV_WORKSTREAM_WORKSPACE_ID;

    if (workspaceId === DEV_WORKSTREAM_WORKSPACE_ID) {
      const topLevel = await gitRunner(["rev-parse", "--show-toplevel"], { cwd: repositoryRoot });
      const gitDir = await gitRunner(["rev-parse", "--git-dir"], { cwd: repositoryRoot });
      const gitCommonDir = await gitRunner(["rev-parse", "--git-common-dir"], { cwd: repositoryRoot });
      const head = await gitRunner(["rev-parse", "--verify", "HEAD"], { cwd: repositoryRoot });
      let branch;
      try {
        branch = await gitRunner(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repositoryRoot });
      } catch (error) {
        if (error?.code !== 1) throw error;
        branch = { stdout: "" };
      }
      const resolvedRoot = path.resolve(String(topLevel.stdout).trim());
      const currentHead = String(head.stdout).trim().toLowerCase();
      if (resolvedRoot !== path.resolve(repositoryRoot)) throw new Error("Shared workspace Git top-level does not match the canonical repository root.");
      if (!gitSha1Pattern.test(currentHead)) throw new Error("Shared workspace HEAD is invalid.");
      return {
        workspace_id: DEV_WORKSTREAM_WORKSPACE_ID,
        workstream_id: null,
        workspace_type: "shared",
        root: resolvedRoot,
        branch: String(branch.stdout).trim() || null,
        base_head: currentHead,
        current_head: currentHead,
        git_dir: normalizeGitMetadataPath(resolvedRoot, gitDir.stdout, "git_dir"),
        git_common_dir: normalizeGitMetadataPath(resolvedRoot, gitCommonDir.stdout, "git_common_dir"),
        lifecycle_state: "active",
        workstream_state: null,
        healthy: true,
        mutation_allowed: true,
      };
    }

    if (typeof workspaceId !== "string" || !workspaceIdPattern.test(workspaceId)) {
      throw new Error("workspace_id must be a server-issued workspace ID.");
    }
    const { registry } = await readRegistryWithHealth();
    const record = registry.workstreams.find((candidate) => candidate.workspace_id === workspaceId && candidate.workspace) ?? null;
    if (!record) throw new Error(`Unknown workspace: ${workspaceId}.`);
    if (record.workspace.state !== "active") throw new Error(`Workspace is not active: ${record.workspace.state}.`);
    if (mutation && terminalStateSet.has(record.state)) throw new Error("Terminal workstreams cannot perform workspace mutations.");

    const health = await inspectRegisteredWorkspace(record.workspace);
    if (!health.healthy || record.workspace.locked !== health.locked) throw new Error("Workspace mapping is unhealthy; execution is refused.");
    const root = absoluteWorkspacePath(workspaceId);
    const topLevel = await gitRunner(["rev-parse", "--show-toplevel"], { cwd: root });
    const gitDir = await gitRunner(["rev-parse", "--git-dir"], { cwd: root });
    const gitCommonDir = await gitRunner(["rev-parse", "--git-common-dir"], { cwd: root });
    const head = await gitRunner(["rev-parse", "--verify", "HEAD"], { cwd: root });
    const branch = await gitRunner(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: root });
    const resolvedRoot = path.resolve(String(topLevel.stdout).trim());
    const currentHead = String(head.stdout).trim().toLowerCase();
    const branchName = String(branch.stdout).trim() || null;
    if (resolvedRoot !== path.resolve(root)) throw new Error("Workspace Git top-level does not match the registered worktree root.");
    if (!gitSha1Pattern.test(currentHead)) throw new Error("Workspace HEAD is invalid.");
    if (branchName !== record.workspace.branch_name) throw new Error("Workspace branch no longer matches the registry mapping.");
    return {
      workspace_id: workspaceId,
      workstream_id: record.workstream_id,
      workspace_type: record.workspace.workspace_type,
      root: resolvedRoot,
      branch: branchName,
      base_head: record.workspace.base_head,
      current_head: currentHead,
      git_dir: normalizeGitMetadataPath(resolvedRoot, gitDir.stdout, "git_dir"),
      git_common_dir: normalizeGitMetadataPath(resolvedRoot, gitCommonDir.stdout, "git_common_dir"),
      lifecycle_state: record.workspace.state,
      workstream_state: record.state,
      healthy: true,
      mutation_allowed: !terminalStateSet.has(record.state),
    };
  }

  async function getWorkspace(input = {}) {
    const allowed = new Set(["workspace_id"]);
    assertObject(input, "dev_workspace_get_workspace input", allowed);
    const workspaceId = input.workspace_id;
    if (typeof workspaceId !== "string" || !workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id must be a server-issued workspace ID.");
    const { registry } = await readRegistryWithHealth();
    const record = registry.workstreams.find((candidate) => candidate.workspace_id === workspaceId && candidate.workspace) ?? null;
    if (!record) throw new Error(`Unknown workspace: ${workspaceId}.`);
    return { ...(await workspaceView(record)), workstream_state: record.state, workstream_revision: record.revision, registry_revision: registry.revision };
  }

  async function listWorkspaces(input = {}) {
    const allowed = new Set(["workstream_id", "state", "type", "limit"]);
    assertObject(input, "dev_workspace_list_workspaces input", allowed);
    const workstreamId = input.workstream_id === undefined ? null : assertWorkstreamId(input.workstream_id);
    const state = input.state === undefined ? null : assertEnum(input.state, "state", workspaceStateSet);
    const type = input.type === undefined ? null : assertEnum(input.type, "type", workspaceTypeSet);
    const limit = input.limit ?? DEV_WORKSPACE_MAX_LIST_RESULTS;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_WORKSPACE_MAX_LIST_RESULTS) throw new Error(`limit must be an integer from 1-${DEV_WORKSPACE_MAX_LIST_RESULTS}.`);
    const { registry } = await readRegistryWithHealth();
    let records = registry.workstreams.filter((record) => record.workspace);
    if (workstreamId) records = records.filter((record) => record.workstream_id === workstreamId);
    if (state) records = records.filter((record) => record.workspace.state === state);
    if (type) records = records.filter((record) => record.workspace.workspace_type === type);
    const total = records.length;
    const workspaces = [];
    for (const record of records.slice(0, limit)) workspaces.push(await workspaceView(record));
    return { registry_revision: registry.revision, total, returned: workspaces.length, truncated: total > limit, workspaces };
  }

  async function lockWorkspace(input = {}) {
    const allowed = new Set(["workspace_id", "expected_workstream_revision"]);
    assertObject(input, "dev_workspace_lock input", allowed);
    const workspaceId = input.workspace_id;
    if (typeof workspaceId !== "string" || !workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id must be a server-issued workspace ID.");
    return mutate("dev_workspace_lock", async (registry) => {
      const record = registry.workstreams.find((candidate) => candidate.workspace_id === workspaceId && candidate.workspace);
      if (!record) throw new Error(`Unknown workspace: ${workspaceId}.`);
      assertExpectedRevision(record, input.expected_workstream_revision);
      if (record.workspace.state !== "active") throw new Error("Only active isolated workspaces can be locked.");
      const health = await inspectRegisteredWorkspace(record.workspace);
      if (!health.healthy) throw new Error("Workspace mapping is unhealthy; refusing lock mutation.");
      if (!health.locked) {
        const reason = `Writer Workbench active workspace ${workspaceId}`;
        await gitRunner(["worktree", "lock", "--reason", reason, absoluteWorkspacePath(workspaceId)], { cwd: repositoryRoot });
      }
      const after = await inspectRegisteredWorkspace(record.workspace);
      record.workspace.locked = after.locked;
      record.workspace.lock_reason = after.lock_reason ?? `Writer Workbench active workspace ${workspaceId}`;
      record.workspace.updated_at = clock().toISOString();
      record.workspace.revision += 1;
      record.revision += 1;
      record.updated_at = record.workspace.updated_at;
      record.last_activity_at = record.workspace.updated_at;
      return (nextRegistry) => ({ ...(findRecord(nextRegistry, record.workstream_id).workspace), workstream_revision: findRecord(nextRegistry, record.workstream_id).revision, registry_revision: nextRegistry.revision });
    });
  }

  async function unlockWorkspace(input = {}) {
    const allowed = new Set(["workspace_id", "expected_workstream_revision"]);
    assertObject(input, "dev_workspace_unlock input", allowed);
    const workspaceId = input.workspace_id;
    if (typeof workspaceId !== "string" || !workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id must be a server-issued workspace ID.");
    return mutate("dev_workspace_unlock", async (registry) => {
      const record = registry.workstreams.find((candidate) => candidate.workspace_id === workspaceId && candidate.workspace);
      if (!record) throw new Error(`Unknown workspace: ${workspaceId}.`);
      assertExpectedRevision(record, input.expected_workstream_revision);
      if (record.workspace.state !== "active") throw new Error("Only active isolated workspaces can be unlocked.");
      if (record.state === "active") throw new Error("An active workstream workspace must remain locked.");
      const health = await inspectRegisteredWorkspace(record.workspace);
      if (!health.healthy) throw new Error("Workspace mapping is unhealthy; refusing unlock mutation.");
      if (health.locked) await gitRunner(["worktree", "unlock", absoluteWorkspacePath(workspaceId)], { cwd: repositoryRoot });
      const after = await inspectRegisteredWorkspace(record.workspace);
      record.workspace.locked = after.locked;
      record.workspace.lock_reason = after.lock_reason;
      record.workspace.updated_at = clock().toISOString();
      record.workspace.revision += 1;
      record.revision += 1;
      record.updated_at = record.workspace.updated_at;
      record.last_activity_at = record.workspace.updated_at;
      return (nextRegistry) => ({ ...(findRecord(nextRegistry, record.workstream_id).workspace), workstream_revision: findRecord(nextRegistry, record.workstream_id).revision, registry_revision: nextRegistry.revision });
    });
  }

  async function removeIsolated(input = {}) {
    const allowed = new Set(["workspace_id", "expected_workstream_revision"]);
    assertObject(input, "dev_workspace_remove_isolated input", allowed);
    const workspaceId = input.workspace_id;
    if (typeof workspaceId !== "string" || !workspaceIdPattern.test(workspaceId)) throw new Error("workspace_id must be a server-issued workspace ID.");
    return mutate("dev_workspace_remove_isolated", async (registry) => {
      const record = registry.workstreams.find((candidate) => candidate.workspace_id === workspaceId && candidate.workspace);
      if (!record) throw new Error(`Unknown workspace: ${workspaceId}.`);
      assertExpectedRevision(record, input.expected_workstream_revision);
      if (!terminalStateSet.has(record.state)) throw new Error("Isolated workspace removal requires a completed or abandoned workstream.");
      if (record.workspace.state === "removed") throw new Error("Workspace is already removed.");
      const health = await inspectRegisteredWorkspace(record.workspace);
      if (!health.filesystem_path_exists || !health.git_worktree_mapping_exists || !health.registered_branch_matches || !health.registry_mapping_consistent) {
        throw new Error("Workspace mapping is unhealthy; refusing removal.");
      }
      if (health.dirty || health.staged.length > 0 || health.conflicted.length > 0 || health.untracked.length > 0) {
        const error = new Error("Dirty isolated worktree cannot be removed; tracked, staged, conflicted, and untracked state must be preserved.");
        error.code = "WORKSPACE_DIRTY_REMOVE_REJECTED";
        throw error;
      }
      record.workspace.state = "removing";
      record.workspace.updated_at = clock().toISOString();
      record.workspace.revision += 1;
      const absolutePath = absoluteWorkspacePath(workspaceId);
      if (health.locked) await gitRunner(["worktree", "unlock", absolutePath], { cwd: repositoryRoot });
      await gitRunner(["worktree", "remove", absolutePath], { cwd: repositoryRoot, timeout: 60_000 });
      const after = await inspectRegisteredWorkspace(record.workspace);
      if (after.filesystem_path_exists || after.git_worktree_mapping_exists) throw new Error("Git worktree removal verification failed.");
      record.workspace.state = "removed";
      record.workspace.locked = false;
      record.workspace.lock_reason = null;
      record.workspace.git_worktree_head = health.git_worktree_head;
      record.workspace.updated_at = clock().toISOString();
      record.workspace.revision += 1;
      record.revision += 1;
      record.updated_at = record.workspace.updated_at;
      record.last_activity_at = record.workspace.updated_at;
      return (nextRegistry) => ({ ...(findRecord(nextRegistry, record.workstream_id).workspace), healthy: true, workstream_revision: findRecord(nextRegistry, record.workstream_id).revision, registry_revision: nextRegistry.revision });
    });
  }

  async function begin(input = {}) {
    const allowed = new Set([
      "label", "purpose", "parent_workstream_id", "depends_on", "declared_scope", "metadata", "mode",
    ]);
    assertObject(input, "dev_workspace_begin_workstream input", allowed);
    const label = assertBoundedString(input.label, "label", {
      min: 1,
      max: DEV_WORKSTREAM_MAX_LABEL_CHARACTERS,
    });
    const purpose = input.purpose === undefined
      ? "primary"
      : assertEnum(input.purpose, "purpose", purposeSet);
    const mode = input.mode ?? DEV_WORKSTREAM_SUPPORTED_MODE;
    if (!DEV_WORKSTREAM_MODES.includes(mode)) {
      throw new Error(`mode must be one of: ${DEV_WORKSTREAM_MODES.join(", ")}.`);
    }
    if (mode !== DEV_WORKSTREAM_SUPPORTED_MODE) {
      const error = new Error("Create workstreams in shared mode, then use dev_workspace_create_isolated for the controlled Phase 2B transition.");
      error.code = "WORKSTREAM_ISOLATED_REQUIRES_CONTROLLED_CREATE";
      throw error;
    }
    const parentWorkstreamId = assertOptionalWorkstreamId(input.parent_workstream_id, "parent_workstream_id");
    const dependsOn = normalizeIdList(input.depends_on, "depends_on");
    const declaredScope = normalizeDeclaredScope(input.declared_scope);
    const metadata = normalizeMetadata(input.metadata);
    const baseHead = await headReader();
    if (typeof baseHead !== "string" || !gitSha1Pattern.test(baseHead.toLowerCase())) {
      throw new Error("Server HEAD reader returned an invalid Git SHA-1.");
    }
    const normalizedBaseHead = baseHead.toLowerCase();

    return mutate("dev_workspace_begin_workstream", async (registry) => {
      if (registry.workstreams.length >= DEV_WORKSTREAM_MAX_RECORDS) {
        throw new Error(`workstream registry reached the ${DEV_WORKSTREAM_MAX_RECORDS}-record limit.`);
      }
      let workstreamId;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = idGenerator(clock());
        assertWorkstreamId(candidate, "generated workstream_id");
        if (!findRecord(registry, candidate)) {
          workstreamId = candidate;
          break;
        }
      }
      if (!workstreamId) throw new Error("Could not generate a unique workstream ID.");
      assertDependencyTargets(registry, workstreamId, parentWorkstreamId, dependsOn);
      const now = clock().toISOString();
      const record = {
        workstream_id: workstreamId,
        schema_version: DEV_WORKSTREAM_SCHEMA_VERSION,
        revision: 1,
        label,
        purpose,
        state: "active",
        mode: DEV_WORKSTREAM_SUPPORTED_MODE,
        base_head: normalizedBaseHead,
        created_at: now,
        updated_at: now,
        last_activity_at: now,
        parent_workstream_id: parentWorkstreamId,
        depends_on: dependsOn,
        declared_scope: declaredScope,
        workspace_id: DEV_WORKSTREAM_WORKSPACE_ID,
        metadata,
      };
      registry.workstreams.push(record);
      assertAcyclic(registry);
      return (nextRegistry) => ({
        ...withOverlap(nextRegistry, findRecord(nextRegistry, workstreamId)),
        registry_revision: nextRegistry.revision,
      });
    });
  }

  async function get(input = {}) {
    const allowed = new Set(["workstream_id"]);
    assertObject(input, "dev_workspace_get_workstream input", allowed);
    const workstreamId = assertWorkstreamId(input.workstream_id);
    const { registry } = await readRegistryWithHealth();
    const record = findRecord(registry, workstreamId);
    if (!record) throw new Error(`Unknown workstream: ${workstreamId}.`);
    return {
      ...withOverlap(registry, record),
      registry_revision: registry.revision,
    };
  }

  async function list(input = {}) {
    const allowed = new Set(["state", "purpose", "lifecycle", "limit"]);
    assertObject(input, "dev_workspace_list_workstreams input", allowed);
    const state = input.state === undefined ? null : assertEnum(input.state, "state", stateSet);
    const purpose = input.purpose === undefined ? null : assertEnum(input.purpose, "purpose", purposeSet);
    const lifecycle = input.lifecycle === undefined
      ? "all"
      : assertEnum(input.lifecycle, "lifecycle", lifecycleSet);
    const limit = input.limit === undefined ? DEV_WORKSTREAM_MAX_LIST_RESULTS : input.limit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_WORKSTREAM_MAX_LIST_RESULTS) {
      throw new Error(`limit must be an integer from 1-${DEV_WORKSTREAM_MAX_LIST_RESULTS}.`);
    }
    const { registry, health, storage_health: storageHealth } = await readRegistryWithHealth();
    let records = registry.workstreams;
    if (state) records = records.filter((record) => record.state === state);
    if (purpose) records = records.filter((record) => record.purpose === purpose);
    if (lifecycle === "active") records = records.filter((record) => !terminalStateSet.has(record.state));
    if (lifecycle === "terminal") records = records.filter((record) => terminalStateSet.has(record.state));
    records = [...records].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const total = records.length;
    return {
      schema_version: DEV_WORKSTREAM_SCHEMA_VERSION,
      registry_revision: registry.revision,
      registry_health: health,
      storage_health: storageHealth,
      total,
      returned: Math.min(total, limit),
      truncated: total > limit,
      workstreams: records.slice(0, limit).map((record) => withOverlap(registry, record)),
    };
  }

  async function update(input = {}) {
    const allowed = new Set([
      "workstream_id",
      "expected_revision",
      "label",
      "purpose",
      "state",
      "parent_workstream_id",
      "depends_on",
      "declared_scope",
      "metadata",
    ]);
    assertObject(input, "dev_workspace_update_workstream input", allowed);
    const workstreamId = assertWorkstreamId(input.workstream_id);
    const expectedRevision = input.expected_revision;
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
      throw new Error("expected_revision must be a positive safe integer.");
    }
    const patchKeys = [
      "label", "purpose", "state", "parent_workstream_id", "depends_on", "declared_scope", "metadata",
    ].filter((key) => Object.hasOwn(input, key));
    if (patchKeys.length === 0) throw new Error("dev_workspace_update_workstream requires at least one mutable field.");

    return mutate("dev_workspace_update_workstream", async (registry) => {
      const record = findRecord(registry, workstreamId);
      if (!record) throw new Error(`Unknown workstream: ${workstreamId}.`);
      if (terminalStateSet.has(record.state)) {
        throw new Error("Terminal workstreams cannot be updated or restarted.");
      }
      if (expectedRevision !== undefined && record.revision !== expectedRevision) {
        const error = new Error(`stale workstream revision: expected ${expectedRevision}, current ${record.revision}.`);
        error.code = "WORKSTREAM_STALE_REVISION";
        throw error;
      }
      if (Object.hasOwn(input, "label")) {
        record.label = assertBoundedString(input.label, "label", {
          min: 1,
          max: DEV_WORKSTREAM_MAX_LABEL_CHARACTERS,
        });
      }
      if (Object.hasOwn(input, "purpose")) {
        record.purpose = assertEnum(input.purpose, "purpose", purposeSet);
      }
      if (Object.hasOwn(input, "state")) {
        const nextState = assertEnum(input.state, "state", mutableStateSet);
        if (!legalNonTerminalTransitions[record.state]?.has(nextState)) {
          throw new Error(`Illegal workstream state transition: ${record.state} -> ${nextState}.`);
        }
        record.state = nextState;
      }
      if (Object.hasOwn(input, "parent_workstream_id")) {
        record.parent_workstream_id = assertOptionalWorkstreamId(input.parent_workstream_id, "parent_workstream_id");
      }
      if (Object.hasOwn(input, "depends_on")) {
        record.depends_on = normalizeIdList(input.depends_on, "depends_on");
      }
      if (Object.hasOwn(input, "declared_scope")) {
        record.declared_scope = normalizeDeclaredScope(input.declared_scope);
      }
      if (Object.hasOwn(input, "metadata")) {
        record.metadata = normalizeMetadata(input.metadata);
      }
      assertDependencyTargets(
        registry,
        workstreamId,
        record.parent_workstream_id,
        record.depends_on,
      );
      assertAcyclic(registry);
      const now = clock().toISOString();
      record.revision += 1;
      record.updated_at = now;
      record.last_activity_at = now;
      return (nextRegistry) => ({
        ...withOverlap(nextRegistry, findRecord(nextRegistry, workstreamId)),
        registry_revision: nextRegistry.revision,
      });
    });
  }

  async function end(input = {}) {
    const allowed = new Set(["workstream_id", "outcome", "expected_revision"]);
    assertObject(input, "dev_workspace_end_workstream input", allowed);
    const workstreamId = assertWorkstreamId(input.workstream_id);
    const outcome = assertEnum(input.outcome, "outcome", terminalStateSet);
    const expectedRevision = input.expected_revision;
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
      throw new Error("expected_revision must be a positive safe integer.");
    }

    return mutate("dev_workspace_end_workstream", async (registry) => {
      const record = findRecord(registry, workstreamId);
      if (!record) throw new Error(`Unknown workstream: ${workstreamId}.`);
      if (terminalStateSet.has(record.state)) {
        throw new Error(`Workstream is already terminal: ${record.state}.`);
      }
      if (expectedRevision !== undefined && record.revision !== expectedRevision) {
        const error = new Error(`stale workstream revision: expected ${expectedRevision}, current ${record.revision}.`);
        error.code = "WORKSTREAM_STALE_REVISION";
        throw error;
      }
      const now = clock().toISOString();
      record.state = outcome;
      record.revision += 1;
      record.updated_at = now;
      record.last_activity_at = now;
      return (nextRegistry) => ({
        ...withOverlap(nextRegistry, findRecord(nextRegistry, workstreamId)),
        registry_revision: nextRegistry.revision,
      });
    });
  }

  async function status(input = {}) {
    const allowed = new Set([]);
    assertObject(input, "dev_workspace_status input", allowed);
    const [{ registry, health, storage_health: storageHealth }, currentHead] = await Promise.all([
      readRegistryWithHealth(),
      headReader(),
    ]);
    const normalizedHead = String(currentHead).toLowerCase();
    if (!gitSha1Pattern.test(normalizedHead)) throw new Error("Server HEAD reader returned an invalid Git SHA-1.");
    const active = registry.workstreams.filter((record) => record.state === "active");
    const paused = registry.workstreams.filter((record) => record.state === "paused");
    const blocked = registry.workstreams.filter((record) => record.state === "blocked");
    const terminal = registry.workstreams.filter((record) => terminalStateSet.has(record.state));
    const unregisteredServerWorktrees = await findUnregisteredServerWorktrees(registry);
    return {
      schema_version: DEV_WORKSTREAM_SCHEMA_VERSION,
      registry_revision: registry.revision,
      registry_health: health,
      storage_health: storageHealth,
      workspace_id: DEV_WORKSTREAM_WORKSPACE_ID,
      mode: DEV_WORKSTREAM_SUPPORTED_MODE,
      current_repository_head: normalizedHead,
      active_workstream_count: active.length,
      paused_workstream_count: paused.length,
      blocked_workstream_count: blocked.length,
      terminal_workstream_count: terminal.length,
      total_workstream_count: registry.workstreams.length,
      active_workstreams: active.slice(0, DEV_WORKSTREAM_MAX_LIST_RESULTS).map((record) => ({
        workstream_id: record.workstream_id,
        label: record.label,
        purpose: record.purpose,
        revision: record.revision,
        base_head: record.base_head,
        base_head_differs_from_current_head: record.base_head !== normalizedHead,
        declared_scope: structuredClone(record.declared_scope),
      })),
      active_summary_truncated: active.length > DEV_WORKSTREAM_MAX_LIST_RESULTS,
      workspace_reconciliation_required: unregisteredServerWorktrees.length > 0,
      unregistered_server_worktree_count: unregisteredServerWorktrees.length,
      unregistered_server_worktrees: unregisteredServerWorktrees,
      authoritative_remote_status_included: false,
      tracking_ref_used_as_authority: false,
    };
  }

  return {
    begin,
    get,
    list,
    update,
    end,
    status,
    createIsolated,
    getWorkspace,
    listWorkspaces,
    lockWorkspace,
    unlockWorkspace,
    removeIsolated,
    resolveExecutionContext,
    registryPath: storagePath,
  };
}

const defaultService = createDevWorkstreamRegistryService();

export const dev_workspace_begin_workstream = defaultService.begin;
export const dev_workspace_get_workstream = defaultService.get;
export const dev_workspace_list_workstreams = defaultService.list;
export const dev_workspace_update_workstream = defaultService.update;
export const dev_workspace_end_workstream = defaultService.end;
export const dev_workspace_status = defaultService.status;
export const dev_workspace_create_isolated = defaultService.createIsolated;
export const dev_workspace_get_workspace = defaultService.getWorkspace;
export const dev_workspace_list_workspaces = defaultService.listWorkspaces;
export const dev_workspace_lock = defaultService.lockWorkspace;
export const dev_workspace_unlock = defaultService.unlockWorkspace;
export const dev_workspace_remove_isolated = defaultService.removeIsolated;
export const resolveDevWorkspaceExecutionContext = defaultService.resolveExecutionContext;
