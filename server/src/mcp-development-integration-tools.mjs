import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readlink,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createDevTestRunner } from "./mcp-development-test-tools.mjs";
import {
  DEV_WORKSTREAM_ID_PATTERN_SOURCE,
  dev_workspace_get_workspace,
  dev_workspace_get_workstream,
} from "./mcp-development-workstream-tools.mjs";
import { controlledProcessEnvironment } from "./process-control.mjs";
import { projectPaths, projectRoot } from "./project-paths.mjs";
import {
  DEV_OPERATION_ID_PATTERN_SOURCE,
  beginDevJournalOperation,
  completeDevJournalOperation,
  failDevJournalOperation,
  markDevJournalDegraded,
} from "./mcp-development-journal-tools.mjs";

const execFileAsync = promisify(execFile);

export const DEV_INTEGRATION_SCHEMA_VERSION = 1;
export const DEV_INTEGRATION_TARGET_BRANCH = "main";
export const DEV_INTEGRATION_CANDIDATE_ID_PATTERN_SOURCE = "^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$";
export const DEV_INTEGRATION_MAX_LIST_RESULTS = 100;
export const DEV_INTEGRATION_STATES = Object.freeze([
  "created",
  "preflight_passed",
  "materialized",
  "testing",
  "validated",
  "ready",
  "applying",
  "integrated",
  "conflicted",
  "failed",
  "stale",
  "blocked",
  "abandoned",
]);
export const DEV_INTEGRATION_STRATEGIES = Object.freeze([
  "fast_forward",
  "merge_commit",
  "already_integrated",
]);

const candidateIdPattern = new RegExp(DEV_INTEGRATION_CANDIDATE_ID_PATTERN_SOURCE, "u");
const workstreamIdPattern = new RegExp(DEV_WORKSTREAM_ID_PATTERN_SOURCE, "u");
const operationIdPattern = new RegExp(DEV_OPERATION_ID_PATTERN_SOURCE, "u");
const workspaceIdPattern = /^dev_workspace_[a-f0-9]{24}$/u;
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
const stateSet = new Set(DEV_INTEGRATION_STATES);
const strategySet = new Set(DEV_INTEGRATION_STRATEGIES);
const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const registryDirectory = path.join(projectPaths.outputLogs, "development_runtime");
const defaultRegistryPath = path.join(registryDirectory, "integration_registry.json");
const defaultRegistryLockPath = path.join(registryDirectory, "integration_registry.lock");
const defaultApplyLockPath = path.join(registryDirectory, "integration_apply.lock");
const defaultIntegrationRoot = path.join(path.dirname(projectRoot), ".writer-workbench-integrations");
const DIRTY_SNAPSHOT_MAX_FILES = 10_000;
const DIRTY_SNAPSHOT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const DIRTY_SNAPSHOT_PATH_BUFFER = 8 * 1024 * 1024;
const DIRTY_VERIFY_MAX_REPORTED_PATHS = 256;
const INTEGRATION_SAFETY_STATUS_MAX_BUFFER = 2 * 1024 * 1024;
const CONFLICT_MAX_PATHS = 100;

const legalTransitions = Object.freeze({
  created: new Set(["preflight_passed", "conflicted", "blocked", "failed", "integrated", "abandoned"]),
  preflight_passed: new Set(["materialized", "stale", "failed", "abandoned"]),
  materialized: new Set(["testing", "stale", "failed"]),
  testing: new Set(["validated", "stale", "failed"]),
  validated: new Set(["ready", "stale", "failed"]),
  ready: new Set(["applying", "stale", "blocked", "abandoned"]),
  applying: new Set(["integrated", "stale", "failed"]),
  blocked: new Set(["applying", "stale", "failed", "abandoned"]),
  conflicted: new Set(["abandoned"]),
  failed: new Set(["abandoned"]),
  stale: new Set(["abandoned"]),
  integrated: new Set([]),
  abandoned: new Set([]),
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(input, label, allowedKeys) {
  if (!isObject(input)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) throw new Error(`${label} does not accept ${unknown.sort().join(", ")}.`);
}

function assertCandidateId(value) {
  if (typeof value !== "string" || !candidateIdPattern.test(value)) {
    throw new Error("integration_candidate_id must be a server-issued integration candidate ID.");
  }
  return value;
}

function assertWorkstreamId(value) {
  if (typeof value !== "string" || !workstreamIdPattern.test(value)) {
    throw new Error("workstream_id must be a server-issued workstream ID.");
  }
  return value;
}

function assertExpectedRevision(value, label = "expected_revision") {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer.`);
}

function normalizeSha(value, label) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!gitSha1Pattern.test(normalized)) throw new Error(`${label} must be an exact Git SHA-1.`);
  return normalized;
}

function isoTimestamp(value, label) {
  if (value !== null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
    throw new Error(`${label} must be null or a valid ISO timestamp.`);
  }
  return value;
}

function generateCandidateId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/gu, "").replace("T", "-").slice(0, 15);
  return `dev_integration_${stamp}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function workspaceBranchForId(workspaceId) {
  return `dev-ws/${workspaceId.slice("dev_workspace_".length)}`;
}

function createEmptyRegistry() {
  return {
    schema_version: DEV_INTEGRATION_SCHEMA_VERSION,
    revision: 0,
    updated_at: null,
    candidates: [],
    checksum_sha256: null,
  };
}

function registryPayload(registry) {
  return {
    schema_version: registry.schema_version,
    revision: registry.revision,
    updated_at: registry.updated_at,
    candidates: registry.candidates,
  };
}

function registryChecksum(registry) {
  return createHash("sha256").update(JSON.stringify(registryPayload(registry)), "utf8").digest("hex");
}

function validateDependencySnapshot(value) {
  if (!isObject(value)) throw new Error("candidate dependency snapshot must be an object.");
  assertWorkstreamId(value.workstream_id);
  if (value.source_branch !== null && typeof value.source_branch !== "string") throw new Error("dependency source_branch must be string or null.");
  if (value.source_head !== null) normalizeSha(value.source_head, "dependency source_head");
  if (value.integration_commit !== null) normalizeSha(value.integration_commit, "dependency integration_commit");
}

function validateCandidate(candidate) {
  if (!isObject(candidate)) throw new Error("integration candidate must be an object.");
  assertCandidateId(candidate.integration_candidate_id);
  if (candidate.schema_version !== DEV_INTEGRATION_SCHEMA_VERSION) throw new Error("Unsupported integration candidate schema_version.");
  if (!Number.isSafeInteger(candidate.revision) || candidate.revision < 1) throw new Error("candidate revision must be positive.");
  assertWorkstreamId(candidate.workstream_id);
  if (typeof candidate.workspace_id !== "string" || !workspaceIdPattern.test(candidate.workspace_id)) throw new Error("candidate workspace_id is invalid.");
  if (typeof candidate.source_branch !== "string" || !candidate.source_branch.startsWith("dev-ws/")) throw new Error("candidate source_branch is invalid.");
  normalizeSha(candidate.source_head, "candidate source_head");
  normalizeSha(candidate.workstream_base_head, "candidate workstream_base_head");
  if (candidate.target_branch !== DEV_INTEGRATION_TARGET_BRANCH) throw new Error("candidate target_branch must be main.");
  normalizeSha(candidate.target_head, "candidate target_head");
  if (candidate.result_tree !== null) normalizeSha(candidate.result_tree, "candidate result_tree");
  if (candidate.integration_commit !== null) normalizeSha(candidate.integration_commit, "candidate integration_commit");
  if (candidate.strategy !== null && !strategySet.has(candidate.strategy)) throw new Error("candidate strategy is invalid.");
  if (!stateSet.has(candidate.state)) throw new Error("candidate state is invalid.");
  isoTimestamp(candidate.created_at, "candidate created_at");
  isoTimestamp(candidate.updated_at, "candidate updated_at");
  isoTimestamp(candidate.validated_at, "candidate validated_at");
  isoTimestamp(candidate.integrated_at, "candidate integrated_at");
  if (!Array.isArray(candidate.depends_on) || candidate.depends_on.length > 16) throw new Error("candidate depends_on must be bounded.");
  candidate.depends_on.forEach(validateDependencySnapshot);
  if (candidate.validation_report !== null && !isObject(candidate.validation_report)) throw new Error("candidate validation_report must be object or null.");
  if (candidate.failure_reason !== null && !isObject(candidate.failure_reason)) throw new Error("candidate failure_reason must be object or null.");
  if (candidate.stale_reason !== null && !isObject(candidate.stale_reason)) throw new Error("candidate stale_reason must be object or null.");
  if (!isObject(candidate.integration_workspace)) throw new Error("candidate integration_workspace must be an object.");
  if (typeof candidate.integration_workspace.relative_path !== "string") throw new Error("integration workspace relative_path is invalid.");
  if (!["not_materialized", "active", "removed", "cleanup_pending"].includes(candidate.integration_workspace.state)) throw new Error("integration workspace state is invalid.");
  if (typeof candidate.integration_workspace.cleanup_pending !== "boolean") throw new Error("integration workspace cleanup_pending must be boolean.");
  if (candidate.integration_workspace.last_error !== null && typeof candidate.integration_workspace.last_error !== "string") throw new Error("integration workspace last_error must be string or null.");
}

function validateRegistry(registry, { requireChecksum = true } = {}) {
  if (!isObject(registry)) throw new Error("integration registry must be an object.");
  if (registry.schema_version !== DEV_INTEGRATION_SCHEMA_VERSION) throw new Error("Unsupported integration registry schema_version.");
  if (!Number.isSafeInteger(registry.revision) || registry.revision < 0) throw new Error("integration registry revision is invalid.");
  isoTimestamp(registry.updated_at, "integration registry updated_at");
  if (!Array.isArray(registry.candidates) || registry.candidates.length > 2000) throw new Error("integration registry candidates are invalid or exceed limit.");
  const ids = new Set();
  for (const candidate of registry.candidates) {
    validateCandidate(candidate);
    if (ids.has(candidate.integration_candidate_id)) throw new Error("duplicate integration candidate ID.");
    ids.add(candidate.integration_candidate_id);
  }
  if (registry.revision === 0 && registry.candidates.length === 0) {
    if (requireChecksum && registry.checksum_sha256 !== null) throw new Error("empty integration registry checksum must be null.");
    return;
  }
  if (typeof registry.checksum_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(registry.checksum_sha256)) throw new Error("integration registry checksum is invalid.");
  if (requireChecksum && registryChecksum(registry) !== registry.checksum_sha256) throw new Error("integration registry checksum mismatch.");
}

function encodeRegistry(registry) {
  const next = { ...registry, checksum_sha256: registryChecksum(registry) };
  validateRegistry(next);
  return `${JSON.stringify(next, null, 2)}\n`;
}

async function readRegistryFile(registryPath) {
  try {
    const info = await lstat(registryPath);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("integration registry path is not a regular file.");
    if (info.size > 8 * 1024 * 1024) throw new Error("integration registry exceeds 8 MiB.");
    const parsed = JSON.parse(await readFile(registryPath, "utf8"));
    validateRegistry(parsed);
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return createEmptyRegistry();
    throw error;
  }
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function tryRemoveStaleLock(lockPath) {
  try {
    const record = JSON.parse(await readFile(lockPath, "utf8"));
    if (record.hostname !== os.hostname()) return false;
    if (!Number.isInteger(record.pid) || isProcessRunning(record.pid)) return false;
    await unlink(lockPath);
    return true;
  } catch {
    return false;
  }
}

async function acquireFileLock(lockPath, kind) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        kind,
        acquired_at: new Date().toISOString(),
      })}\n`, "utf8");
      return handle;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt === 0 && await tryRemoveStaleLock(lockPath)) continue;
      return null;
    }
  }
  return null;
}

async function releaseFileLock(handle, lockPath) {
  if (!handle) return;
  await handle.close().catch(() => {});
  await unlink(lockPath).catch(() => {});
}

async function atomicWriteRegistry(registryPath, registry) {
  await mkdir(path.dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.${process.pid}.${Date.now()}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temporaryPath, encodeRegistry(registry), "utf8");
  try {
    await rename(temporaryPath, registryPath);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
}

function transitionCandidate(candidate, nextState) {
  if (candidate.state === nextState) return;
  if (!legalTransitions[candidate.state]?.has(nextState)) {
    const error = new Error(`Illegal integration candidate transition: ${candidate.state} -> ${nextState}.`);
    error.code = "INTEGRATION_ILLEGAL_TRANSITION";
    throw error;
  }
  candidate.state = nextState;
}

function relativeIntegrationPath(candidateId, integrationRoot, repositoryRoot) {
  return path.relative(repositoryRoot, path.join(integrationRoot, candidateId)).replaceAll(path.sep, "/");
}

async function defaultGitRunner(args, {
  cwd = projectRoot,
  timeout = 60_000,
  maxBuffer = 512 * 1024,
  allowFailure = false,
  extraEnv = {},
} = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(
      fixedGitExecutable,
      ["--no-pager", "-c", "core.fsmonitor=false", ...args],
      {
        cwd,
        env: controlledProcessEnvironment({
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_PAGER: "cat",
          PAGER: "cat",
          GIT_TERMINAL_PROMPT: "0",
          ...extraEnv,
        }),
        windowsHide: true,
        timeout,
        maxBuffer,
        shell: false,
      },
    );
    return { stdout: String(stdout), stderr: String(stderr), exit_code: 0 };
  } catch (error) {
    const exitCode = Number.isInteger(error?.code) ? error.code : null;
    if (allowFailure && exitCode !== null) {
      return { stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? ""), exit_code: exitCode };
    }
    throw error;
  }
}

function parseStatus(raw) {
  const lines = String(raw).split(/\r?\n/u).filter(Boolean);
  const conflictCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
  return {
    lines,
    staged: lines.filter((line) => line[0] && line[0] !== " " && line[0] !== "?").map((line) => line.slice(3)),
    conflicted: lines.filter((line) => conflictCodes.has(line.slice(0, 2))).map((line) => line.slice(3)),
    untracked: lines.filter((line) => line.startsWith("?? ")).map((line) => line.slice(3)),
    dirty: lines.length > 0,
  };
}

function splitNullPaths(raw) {
  return String(raw).split("\0").filter(Boolean);
}

async function snapshotPath(filePath) {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      return { exists: true, type: "symbolic_link", size: info.size, sha256: null, link_target: await readlink(filePath) };
    }
    if (!info.isFile()) return { exists: true, type: info.isDirectory() ? "directory" : "other", size: info.size, sha256: null, link_target: null };
    if (info.size > DIRTY_SNAPSHOT_MAX_FILE_BYTES) {
      return { exists: true, type: "file", size: info.size, sha256: null, link_target: null };
    }
    const content = await readFile(filePath);
    return {
      exists: true,
      type: "file",
      size: info.size,
      sha256: createHash("sha256").update(content).digest("hex"),
      link_target: null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, type: null, size: null, sha256: null, link_target: null };
    throw error;
  }
}

function snapshotsEqual(a, b) {
  return a.exists === b.exists
    && a.type === b.type
    && a.size === b.size
    && a.sha256 === b.sha256
    && a.link_target === b.link_target;
}

function parseMergeTreeConflicts(stdout, stderr) {
  const text = `${stdout}\n${stderr}`;
  const conflicts = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/u)) {
    const categoryMatch = line.match(/^CONFLICT \(([^)]+)\):\s*(.*)$/u);
    if (!categoryMatch) continue;
    const category = categoryMatch[1].trim().slice(0, 80);
    const detail = categoryMatch[2].trim();
    const quoted = [...detail.matchAll(/(?:in|at|file)\s+['"]?([^'"]+)['"]?/giu)].at(-1)?.[1];
    const affectedPath = (quoted ?? detail).trim().slice(0, 4096);
    const key = `${category}\0${affectedPath}`;
    if (!seen.has(key) && conflicts.length < CONFLICT_MAX_PATHS) {
      seen.add(key);
      conflicts.push({ path: affectedPath || null, category });
    }
  }
  if (conflicts.length === 0) conflicts.push({ path: null, category: "merge_conflict" });
  return conflicts;
}

async function productionValidationRunner(root, candidate) {
  const contextResolver = async () => ({
    workspace_id: candidate.workspace_id,
    workstream_id: candidate.workstream_id,
    workspace_type: "integration_worktree",
    root,
    branch: null,
    base_head: candidate.target_head,
    current_head: candidate.integration_commit,
    lifecycle_state: "active",
    workstream_state: "completed",
    healthy: true,
    mutation_allowed: true,
  });
  const runner = createDevTestRunner({ workspaceContextResolver: contextResolver });
  const results = [];
  for (const suite of ["mcp", "mcp_tunnel"]) {
    results.push(await runner({ suite, workspace_id: candidate.workspace_id }));
  }
  return results;
}

export function createDevIntegrationService({
  repositoryRoot = projectRoot,
  registryPath = defaultRegistryPath,
  registryLockPath = defaultRegistryLockPath,
  applyLockPath = defaultApplyLockPath,
  integrationRootPath = defaultIntegrationRoot,
  gitRunner = defaultGitRunner,
  workstreamReader = dev_workspace_get_workstream,
  workspaceReader = dev_workspace_get_workspace,
  validationRunner = productionValidationRunner,
  clock = () => new Date(),
  candidateIdGenerator = generateCandidateId,
} = {}) {
  const repoRoot = path.resolve(repositoryRoot);
  const registryFile = path.resolve(registryPath);
  const registryLock = path.resolve(registryLockPath);
  const applyLock = path.resolve(applyLockPath);
  const integrationRoot = path.resolve(integrationRootPath);

  async function readRegistry() {
    return readRegistryFile(registryFile);
  }

  async function mutateRegistry(mutator) {
    const lock = await acquireFileLock(registryLock, "integration_registry");
    if (!lock) {
      const error = new Error("Integration registry is busy in another process.");
      error.code = "INTEGRATION_REGISTRY_BUSY";
      throw error;
    }
    try {
      const current = await readRegistry();
      const next = structuredClone(current);
      const result = await mutator(next, current);
      next.schema_version = DEV_INTEGRATION_SCHEMA_VERSION;
      next.revision = current.revision + 1;
      next.updated_at = clock().toISOString();
      for (const candidate of next.candidates) validateCandidate(candidate);
      await atomicWriteRegistry(registryFile, next);
      return typeof result === "function" ? result(next) : result;
    } finally {
      await releaseFileLock(lock, registryLock);
    }
  }

  function findCandidate(registry, candidateId) {
    return registry.candidates.find((candidate) => candidate.integration_candidate_id === candidateId) ?? null;
  }

  async function updateCandidate(candidateId, expectedRevision, updater) {
    assertExpectedRevision(expectedRevision);
    return mutateRegistry((registry) => {
      const candidate = findCandidate(registry, candidateId);
      if (!candidate) throw new Error(`Unknown integration candidate: ${candidateId}.`);
      if (expectedRevision !== undefined && candidate.revision !== expectedRevision) {
        const error = new Error(`stale integration candidate revision: expected ${expectedRevision}, current ${candidate.revision}.`);
        error.code = "INTEGRATION_STALE_REVISION";
        throw error;
      }
      updater(candidate);
      candidate.revision += 1;
      candidate.updated_at = clock().toISOString();
      return (nextRegistry) => ({ ...structuredClone(findCandidate(nextRegistry, candidateId)), registry_revision: nextRegistry.revision });
    });
  }

  async function readMainHead() {
    const result = await gitRunner(["rev-parse", "--verify", "refs/heads/main"], { cwd: repoRoot });
    return normalizeSha(result.stdout, "main HEAD");
  }

  async function readBranchHead(branchName) {
    const result = await gitRunner(["rev-parse", "--verify", `refs/heads/${branchName}`], { cwd: repoRoot });
    return normalizeSha(result.stdout, "source branch HEAD");
  }

  async function treeForCommit(commit) {
    const result = await gitRunner(["rev-parse", "--verify", `${commit}^{tree}`], { cwd: repoRoot });
    return normalizeSha(result.stdout, "result tree");
  }

  async function isAncestor(ancestor, descendant) {
    const result = await gitRunner(["merge-base", "--is-ancestor", ancestor, descendant], { cwd: repoRoot, allowFailure: true });
    if (result.exit_code === 0) return true;
    if (result.exit_code === 1) return false;
    throw new Error(`Git ancestry inspection failed with exit ${result.exit_code}.`);
  }

  async function resolveSource(workstreamId, expectedWorkstreamRevision) {
    assertExpectedRevision(expectedWorkstreamRevision, "expected_workstream_revision");
    const workstream = await workstreamReader({ workstream_id: workstreamId });
    if (expectedWorkstreamRevision !== undefined && workstream.revision !== expectedWorkstreamRevision) {
      const error = new Error(`stale workstream revision: expected ${expectedWorkstreamRevision}, current ${workstream.revision}.`);
      error.code = "WORKSTREAM_STALE_REVISION";
      throw error;
    }
    if (workstream.state !== "completed") {
      const error = new Error("Integration requires a completed workstream in Phase 2D v1.");
      error.code = "WORKSTREAM_NOT_COMPLETED";
      throw error;
    }
    if (workstream.mode !== "isolated" || typeof workstream.workspace_id !== "string" || !workstream.workspace) {
      throw new Error("Integration requires a registered isolated workspace.");
    }
    const workspace = await workspaceReader({ workspace_id: workstream.workspace_id });
    if (workspace.state !== "active" || workspace.workspace_type !== "isolated_worktree") throw new Error("Source workspace must remain an active isolated worktree through integration.");
    if (workspace.healthy !== true || workspace.registered_branch_matches !== true || workspace.registry_mapping_consistent !== true) throw new Error("Source workspace mapping is unhealthy.");
    if (workspace.branch_name !== workspaceBranchForId(workspace.workspace_id)) throw new Error("Source branch does not match server workspace ownership mapping.");
    if (workspace.worktree_relative_path !== `../.writer-workbench-worktrees/${workspace.workspace_id}`) throw new Error("Source workspace path does not match server ownership mapping.");
    const sourceHead = await readBranchHead(workspace.branch_name);
    if (workspace.git_worktree_head !== sourceHead) throw new Error("Source workspace live HEAD differs from source branch HEAD.");
    return { workstream, workspace, source_head: sourceHead };
  }

  async function latestIntegratedCandidate(workstreamId, registry = null) {
    const source = registry ?? await readRegistry();
    return source.candidates
      .filter((candidate) => candidate.workstream_id === workstreamId && candidate.state === "integrated")
      .sort((a, b) => String(b.integrated_at ?? b.updated_at).localeCompare(String(a.integrated_at ?? a.updated_at)))[0] ?? null;
  }

  async function dependencySnapshots(workstream, targetHead) {
    const registry = await readRegistry();
    const snapshots = [];
    const blockers = [];
    for (const dependencyId of workstream.depends_on ?? []) {
      const dependency = await workstreamReader({ workstream_id: dependencyId });
      const integrated = await latestIntegratedCandidate(dependencyId, registry);
      if (dependency.state !== "completed" || !integrated) {
        blockers.push({ workstream_id: dependencyId, reason: "dependency must be completed and integrated" });
        snapshots.push({ workstream_id: dependencyId, source_branch: integrated?.source_branch ?? null, source_head: integrated?.source_head ?? null, integration_commit: integrated?.integration_commit ?? null });
        continue;
      }
      if (!await isAncestor(integrated.integration_commit, targetHead)) {
        blockers.push({ workstream_id: dependencyId, reason: "dependency integration commit is not contained in current main" });
      }
      snapshots.push({
        workstream_id: dependencyId,
        source_branch: integrated.source_branch,
        source_head: integrated.source_head,
        integration_commit: integrated.integration_commit,
      });
    }
    return { snapshots, blockers };
  }

  async function createCandidateRecord(source, targetHead, dependencies) {
    return mutateRegistry((registry) => {
      let candidateId = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const generated = candidateIdGenerator(clock());
        assertCandidateId(generated);
        if (!findCandidate(registry, generated)) {
          candidateId = generated;
          break;
        }
      }
      if (!candidateId) throw new Error("Could not generate a unique integration candidate ID.");
      const now = clock().toISOString();
      const candidate = {
        integration_candidate_id: candidateId,
        schema_version: DEV_INTEGRATION_SCHEMA_VERSION,
        revision: 1,
        workstream_id: source.workstream.workstream_id,
        workspace_id: source.workspace.workspace_id,
        source_branch: source.workspace.branch_name,
        source_head: source.source_head,
        workstream_base_head: source.workstream.base_head,
        target_branch: DEV_INTEGRATION_TARGET_BRANCH,
        target_head: targetHead,
        result_tree: null,
        integration_commit: null,
        strategy: null,
        state: "created",
        created_at: now,
        updated_at: now,
        validated_at: null,
        integrated_at: null,
        depends_on: dependencies,
        validation_report: null,
        failure_reason: null,
        stale_reason: null,
        integration_workspace: {
          relative_path: relativeIntegrationPath(candidateId, integrationRoot, repoRoot),
          state: "not_materialized",
          cleanup_pending: false,
          last_error: null,
        },
      };
      registry.candidates.push(candidate);
      return (nextRegistry) => ({ ...structuredClone(findCandidate(nextRegistry, candidateId)), registry_revision: nextRegistry.revision });
    });
  }

  async function preflight(input = {}) {
    const allowed = new Set(["workstream_id", "expected_workstream_revision"]);
    assertObject(input, "dev_workspace_integration_preflight input", allowed);
    const workstreamId = assertWorkstreamId(input.workstream_id);
    const source = await resolveSource(workstreamId, input.expected_workstream_revision);
    const targetHead = await readMainHead();
    const dependencyResult = await dependencySnapshots(source.workstream, targetHead);
    const created = await createCandidateRecord(source, targetHead, dependencyResult.snapshots);
    const candidateId = created.integration_candidate_id;

    if (dependencyResult.blockers.length > 0) {
      return updateCandidate(candidateId, created.revision, (candidate) => {
        transitionCandidate(candidate, "blocked");
        candidate.failure_reason = { code: "BLOCKED_BY_DEPENDENCY", dependencies: dependencyResult.blockers };
      });
    }

    if (await isAncestor(source.source_head, targetHead)) {
      const resultTree = await treeForCommit(targetHead);
      return updateCandidate(candidateId, created.revision, (candidate) => {
        transitionCandidate(candidate, "integrated");
        candidate.strategy = "already_integrated";
        candidate.result_tree = resultTree;
        candidate.integration_commit = targetHead;
        candidate.validated_at = clock().toISOString();
        candidate.integrated_at = clock().toISOString();
        candidate.validation_report = {
          status: "not_required_already_integrated",
          target_head: targetHead,
          source_head: source.source_head,
          integration_commit: targetHead,
          suites: [],
          execution_ok: true,
          passed: true,
          timed_out: false,
          diff_check: { execution_ok: true, passed: true },
          completed_at: clock().toISOString(),
        };
      });
    }

    if (await isAncestor(targetHead, source.source_head)) {
      const resultTree = await treeForCommit(source.source_head);
      return updateCandidate(candidateId, created.revision, (candidate) => {
        transitionCandidate(candidate, "preflight_passed");
        candidate.strategy = "fast_forward";
        candidate.result_tree = resultTree;
        candidate.integration_commit = source.source_head;
      });
    }

    const mergeTree = await gitRunner(["merge-tree", "--write-tree", targetHead, source.source_head], {
      cwd: repoRoot,
      allowFailure: true,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    if (mergeTree.exit_code === 1) {
      const conflicts = parseMergeTreeConflicts(mergeTree.stdout, mergeTree.stderr);
      return updateCandidate(candidateId, created.revision, (candidate) => {
        transitionCandidate(candidate, "conflicted");
        candidate.failure_reason = {
          code: "CONFLICT",
          target_head: targetHead,
          source_head: source.source_head,
          conflicts,
          conflict_metadata_truncated: conflicts.length >= CONFLICT_MAX_PATHS,
        };
      });
    }
    if (mergeTree.exit_code !== 0) {
      return updateCandidate(candidateId, created.revision, (candidate) => {
        transitionCandidate(candidate, "failed");
        candidate.failure_reason = { code: "MERGE_TREE_FAILED", exit_code: mergeTree.exit_code };
      });
    }
    const resultTree = normalizeSha(String(mergeTree.stdout).split(/\r?\n/u)[0], "merge-tree result tree");
    const commitTree = await gitRunner([
      "commit-tree",
      resultTree,
      "-p",
      targetHead,
      "-p",
      source.source_head,
      "-m",
      `merge(workstream): integrate ${workstreamId}`,
    ], {
      cwd: repoRoot,
      extraEnv: {
        GIT_AUTHOR_NAME: "Writer Workbench Integration",
        GIT_AUTHOR_EMAIL: "writer-workbench@local.invalid",
        GIT_COMMITTER_NAME: "Writer Workbench Integration",
        GIT_COMMITTER_EMAIL: "writer-workbench@local.invalid",
      },
    });
    const integrationCommit = normalizeSha(commitTree.stdout, "integration commit");
    await gitRunner(["cat-file", "-e", `${integrationCommit}^{commit}`], { cwd: repoRoot });
    return updateCandidate(candidateId, created.revision, (candidate) => {
      transitionCandidate(candidate, "preflight_passed");
      candidate.strategy = "merge_commit";
      candidate.result_tree = resultTree;
      candidate.integration_commit = integrationCommit;
    });
  }

  async function getCandidate(input = {}) {
    const allowed = new Set(["integration_candidate_id"]);
    assertObject(input, "dev_workspace_get_integration_candidate input", allowed);
    const candidateId = assertCandidateId(input.integration_candidate_id);
    const registry = await readRegistry();
    const candidate = findCandidate(registry, candidateId);
    if (!candidate) throw new Error(`Unknown integration candidate: ${candidateId}.`);
    return { ...structuredClone(candidate), registry_revision: registry.revision };
  }

  async function listCandidates(input = {}) {
    const allowed = new Set(["state", "workstream_id", "limit"]);
    assertObject(input, "dev_workspace_list_integration_candidates input", allowed);
    const state = input.state === undefined ? null : input.state;
    if (state !== null && !stateSet.has(state)) throw new Error(`state must be one of: ${DEV_INTEGRATION_STATES.join(", ")}.`);
    const workstreamId = input.workstream_id === undefined ? null : assertWorkstreamId(input.workstream_id);
    const limit = input.limit ?? DEV_INTEGRATION_MAX_LIST_RESULTS;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEV_INTEGRATION_MAX_LIST_RESULTS) throw new Error(`limit must be 1-${DEV_INTEGRATION_MAX_LIST_RESULTS}.`);
    const registry = await readRegistry();
    let candidates = registry.candidates;
    if (state) candidates = candidates.filter((candidate) => candidate.state === state);
    if (workstreamId) candidates = candidates.filter((candidate) => candidate.workstream_id === workstreamId);
    candidates = [...candidates].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return {
      schema_version: DEV_INTEGRATION_SCHEMA_VERSION,
      registry_revision: registry.revision,
      total: candidates.length,
      returned: Math.min(limit, candidates.length),
      truncated: candidates.length > limit,
      candidates: candidates.slice(0, limit).map((candidate) => structuredClone(candidate)),
    };
  }

  async function candidateFreshness(candidate) {
    const reasons = [];
    const currentMain = await readMainHead();
    if (currentMain !== candidate.target_head) reasons.push({ code: "TARGET_HEAD_CHANGED", expected: candidate.target_head, actual: currentMain });
    let currentSource = null;
    try {
      currentSource = await readBranchHead(candidate.source_branch);
      if (currentSource !== candidate.source_head) reasons.push({ code: "SOURCE_HEAD_CHANGED", expected: candidate.source_head, actual: currentSource });
    } catch (error) {
      reasons.push({ code: "SOURCE_BRANCH_UNAVAILABLE", message: error.message });
    }
    try {
      const workspace = await workspaceReader({ workspace_id: candidate.workspace_id });
      if (workspace.git_worktree_head !== candidate.source_head || workspace.branch_name !== candidate.source_branch) reasons.push({ code: "SOURCE_WORKSPACE_DRIFT" });
    } catch (error) {
      reasons.push({ code: "SOURCE_WORKSPACE_UNAVAILABLE", message: error.message });
    }
    for (const dependency of candidate.depends_on) {
      try {
        const workstream = await workstreamReader({ workstream_id: dependency.workstream_id });
        if (workstream.state !== "completed") reasons.push({ code: "DEPENDENCY_STATE_CHANGED", workstream_id: dependency.workstream_id, actual: workstream.state });
        if (dependency.source_branch && dependency.source_head) {
          const actualHead = await readBranchHead(dependency.source_branch);
          if (actualHead !== dependency.source_head) reasons.push({ code: "DEPENDENCY_HEAD_CHANGED", workstream_id: dependency.workstream_id, expected: dependency.source_head, actual: actualHead });
        }
        if (dependency.integration_commit && !await isAncestor(dependency.integration_commit, currentMain)) reasons.push({ code: "DEPENDENCY_NOT_IN_TARGET", workstream_id: dependency.workstream_id });
      } catch (error) {
        reasons.push({ code: "DEPENDENCY_UNAVAILABLE", workstream_id: dependency.workstream_id, message: error.message });
      }
    }
    return { fresh: reasons.length === 0, reasons, current_main: currentMain, current_source: currentSource };
  }

  async function ensureIntegrationRoot() {
    const parentInfo = await lstat(path.dirname(integrationRoot));
    if (parentInfo.isSymbolicLink()) throw new Error("Integration worktree parent cannot be a symbolic link.");
    try {
      const info = await lstat(integrationRoot);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Integration worktree root is unsafe.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(integrationRoot, { recursive: false });
    }
  }

  async function cleanupIntegrationWorktree(integrationPath) {
    try {
      const status = parseStatus((await gitRunner(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: integrationPath })).stdout);
      if (status.dirty || status.staged.length > 0 || status.conflicted.length > 0 || status.untracked.length > 0) {
        return { cleaned: false, error: "Integration worktree is dirty; cleanup refused without force." };
      }
      await gitRunner(["worktree", "unlock", integrationPath], { cwd: repoRoot, allowFailure: true });
      await gitRunner(["worktree", "remove", integrationPath], { cwd: repoRoot, timeout: 60_000 });
      return { cleaned: true, error: null };
    } catch (error) {
      return { cleaned: false, error: error.message };
    }
  }

  async function validateIntegration(input = {}) {
    const allowed = new Set(["integration_candidate_id", "expected_revision"]);
    assertObject(input, "dev_workspace_validate_integration input", allowed);
    const candidateId = assertCandidateId(input.integration_candidate_id);
    assertExpectedRevision(input.expected_revision);
    let candidate = await getCandidate({ integration_candidate_id: candidateId });
    if (input.expected_revision !== undefined && candidate.revision !== input.expected_revision) {
      const error = new Error(`stale integration candidate revision: expected ${input.expected_revision}, current ${candidate.revision}.`);
      error.code = "INTEGRATION_STALE_REVISION";
      throw error;
    }
    if (candidate.state !== "preflight_passed") throw new Error(`Candidate must be preflight_passed before validation; current state is ${candidate.state}.`);
    const freshness = await candidateFreshness(candidate);
    if (!freshness.fresh) {
      return updateCandidate(candidateId, candidate.revision, (record) => {
        transitionCandidate(record, "stale");
        record.stale_reason = { code: "VALIDATION_INPUT_STALE", reasons: freshness.reasons };
      });
    }

    const journalOperation = await beginDevJournalOperation({
      operation_type: "integration_validation",
      tool_name: "dev_workspace_validate_integration",
      workstream_id: candidate.workstream_id,
      workspace_id: candidate.workspace_id,
      links: [
        { relation: "used", commit: candidate.source_head },
        { relation: "related_to", integration_candidate_id: candidate.integration_candidate_id },
      ],
      result: {
        integration_candidate_id: candidate.integration_candidate_id,
        source_head: candidate.source_head,
        target_head: candidate.target_head,
        integration_commit: candidate.integration_commit,
        strategy: candidate.strategy,
      },
    });

    try {
      await ensureIntegrationRoot();
    const integrationPath = path.join(integrationRoot, candidateId);
    try {
      await access(integrationPath);
      throw new Error("Integration worktree path already exists; refusing collision.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    await gitRunner(["worktree", "add", "--detach", integrationPath, candidate.integration_commit], { cwd: repoRoot, timeout: 60_000 });
    await gitRunner(["worktree", "lock", "--reason", `Writer Workbench integration ${candidateId}`, integrationPath], { cwd: repoRoot });
    candidate = await updateCandidate(candidateId, candidate.revision, (record) => {
      transitionCandidate(record, "materialized");
      record.integration_workspace.state = "active";
      record.integration_workspace.cleanup_pending = false;
      record.integration_workspace.last_error = null;
    });

    const materializedHead = normalizeSha((await gitRunner(["rev-parse", "--verify", "HEAD"], { cwd: integrationPath })).stdout, "materialized integration HEAD");
    if (materializedHead !== candidate.integration_commit) throw new Error("Materialized integration worktree HEAD does not match candidate integration_commit.");
    const beforeStatus = parseStatus((await gitRunner(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: integrationPath })).stdout);
    const workingCheck = await gitRunner(["diff", "--check"], { cwd: integrationPath, allowFailure: true });
    const stagedCheck = await gitRunner(["diff", "--cached", "--check"], { cwd: integrationPath, allowFailure: true });
    const diffCheck = {
      execution_ok: workingCheck.exit_code !== null && stagedCheck.exit_code !== null,
      passed: workingCheck.exit_code === 0 && stagedCheck.exit_code === 0 && !beforeStatus.dirty,
      working_exit_code: workingCheck.exit_code,
      staged_exit_code: stagedCheck.exit_code,
      worktree_clean: !beforeStatus.dirty,
    };

    candidate = await updateCandidate(candidateId, candidate.revision, (record) => transitionCandidate(record, "testing"));
    let suites;
    try {
      suites = await validationRunner(integrationPath, candidate);
    } catch (error) {
      suites = [{ suite: "validation_runner", execution_ok: false, passed: false, timed_out: false, stderr: error.message }];
    }
    const afterStatus = parseStatus((await gitRunner(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: integrationPath })).stdout);
    const allPassed = diffCheck.passed
      && suites.length > 0
      && suites.every((result) => result.execution_ok === true && result.passed === true && result.timed_out !== true)
      && !afterStatus.dirty;
    const completedAt = clock().toISOString();
    const validationReport = {
      status: allPassed ? "passed" : "failed",
      integration_commit: candidate.integration_commit,
      target_head: candidate.target_head,
      source_head: candidate.source_head,
      suites: suites.map((result) => ({
        suite: result.suite,
        execution_ok: result.execution_ok === true,
        passed: result.passed === true,
        timed_out: result.timed_out === true,
        exit_code: Number.isInteger(result.exit_code) ? result.exit_code : null,
        duration_ms: Number.isFinite(result.duration_ms) ? result.duration_ms : null,
      })),
      execution_ok: suites.every((result) => result.execution_ok === true),
      passed: allPassed,
      timed_out: suites.some((result) => result.timed_out === true),
      diff_check: diffCheck,
      post_test_worktree_clean: !afterStatus.dirty,
      completed_at: completedAt,
    };
    candidate = await updateCandidate(candidateId, candidate.revision, (record) => {
      transitionCandidate(record, allPassed ? "validated" : "failed");
      record.validation_report = validationReport;
      record.validated_at = allPassed ? completedAt : null;
      if (!allPassed) record.failure_reason = { code: "INTEGRATION_VALIDATION_FAILED" };
    });

    const cleanup = await cleanupIntegrationWorktree(integrationPath);
    candidate = await updateCandidate(candidateId, candidate.revision, (record) => {
      record.integration_workspace.state = cleanup.cleaned ? "removed" : "cleanup_pending";
      record.integration_workspace.cleanup_pending = !cleanup.cleaned;
      record.integration_workspace.last_error = cleanup.error;
      if (allPassed) transitionCandidate(record, "ready");
    });
    const validationEvidenceLinks = suites
      .filter((result) => operationIdPattern.test(result?.operation_id ?? ""))
      .map((result) => ({ relation: "validated_by", operation_id: result.operation_id }));
    try {
      await completeDevJournalOperation(journalOperation.operation_id, {
        links: [
          { relation: "used", commit: candidate.source_head },
          { relation: "used", commit: candidate.integration_commit },
          { relation: "related_to", integration_candidate_id: candidate.integration_candidate_id },
          ...validationEvidenceLinks,
        ],
        result: {
          integration_candidate_id: candidate.integration_candidate_id,
          source_head: candidate.source_head,
          target_head: candidate.target_head,
          integration_commit: candidate.integration_commit,
          strategy: candidate.strategy,
          passed: allPassed,
          execution_ok: validationReport.execution_ok,
          timed_out: validationReport.timed_out,
          diff_check_passed: validationReport.diff_check?.passed === true,
          suite_names: validationReport.suites.map((item) => item.suite),
          cleanup_completed: cleanup.cleaned,
        },
      });
    } catch (error) {
      await markDevJournalDegraded(`dev_workspace_validate_integration terminal append failed: ${error.message}`);
      const provenanceError = new Error(`Integration validation completed but provenance terminal append failed: ${error.message}`);
      provenanceError.code = "JOURNAL_TERMINAL_APPEND_FAILED";
      throw provenanceError;
    }
    return candidate;
    } catch (error) {
      if (error?.code === "JOURNAL_TERMINAL_APPEND_FAILED") throw error;
      try {
        await failDevJournalOperation(journalOperation.operation_id, {
          result: {
            integration_candidate_id: candidate.integration_candidate_id,
            source_head: candidate.source_head,
            target_head: candidate.target_head,
            integration_commit: candidate.integration_commit,
            strategy: candidate.strategy,
            validation_failed: true,
            reason: String(error.message ?? error).slice(0, 1024),
          },
        });
      } catch (journalError) {
        await markDevJournalDegraded(`dev_workspace_validate_integration failure terminal append failed: ${journalError.message}`);
        throw new Error(`Integration validation failed and provenance terminal append failed: ${journalError.message}`);
      }
      throw error;
    }
  }

  async function operationState() {
    const active = [];
    for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
      const result = await gitRunner(["rev-parse", "--git-path", name], { cwd: repoRoot });
      const rawPath = String(result.stdout).trim();
      const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(repoRoot, rawPath);
      try {
        await access(resolved);
        active.push(name);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return active;
  }

  async function dirtySnapshot() {
    const tracked = splitNullPaths((await gitRunner(
      ["diff", "--name-only", "-z", "--no-renames"],
      { cwd: repoRoot, maxBuffer: DIRTY_SNAPSHOT_PATH_BUFFER },
    )).stdout);
    const untracked = splitNullPaths((await gitRunner(
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: repoRoot, maxBuffer: DIRTY_SNAPSHOT_PATH_BUFFER },
    )).stdout);
    const paths = [...new Set([...tracked, ...untracked])];
    if (paths.length > DIRTY_SNAPSHOT_MAX_FILES) {
      const error = new Error(`Dirty main contains more than ${DIRTY_SNAPSHOT_MAX_FILES} paths; bounded carry-forward verification is unavailable.`);
      error.code = "DIRTY_MAIN_UNSUPPORTED_FOR_APPLY";
      throw error;
    }
    const snapshots = [];
    for (const relativePath of paths) snapshots.push({ path: relativePath, snapshot: await snapshotPath(path.join(repoRoot, relativePath)) });
    return snapshots;
  }

  async function verifyDirtySnapshot(snapshots) {
    const changed = [];
    for (const entry of snapshots) {
      const current = await snapshotPath(path.join(repoRoot, entry.path));
      if (!snapshotsEqual(entry.snapshot, current)) changed.push(entry.path);
    }
    return changed;
  }

  async function mainSafetyStatus() {
    const branchResult = await gitRunner(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: repoRoot, allowFailure: true });
    const branch = String(branchResult.stdout).trim() || null;
    const status = parseStatus((await gitRunner(["status", "--porcelain=v1", "--untracked-files=no"], {
      cwd: repoRoot,
      maxBuffer: INTEGRATION_SAFETY_STATUS_MAX_BUFFER,
    })).stdout);
    return { branch, ...status, operation_state: await operationState() };
  }

  async function overlayPreflight(targetHead, integrationCommit) {
    return gitRunner(["read-tree", "--dry-run", "-m", "-u", targetHead, integrationCommit], {
      cwd: repoRoot,
      allowFailure: true,
      timeout: 60_000,
      maxBuffer: 512 * 1024,
    });
  }

  async function integrate(input = {}) {
    const allowed = new Set(["integration_candidate_id", "expected_revision"]);
    assertObject(input, "dev_workspace_integrate input", allowed);
    const candidateId = assertCandidateId(input.integration_candidate_id);
    assertExpectedRevision(input.expected_revision);
    let candidate = await getCandidate({ integration_candidate_id: candidateId });
    if (input.expected_revision !== undefined && candidate.revision !== input.expected_revision) {
      const error = new Error(`stale integration candidate revision: expected ${input.expected_revision}, current ${candidate.revision}.`);
      error.code = "INTEGRATION_STALE_REVISION";
      throw error;
    }
    const overlayRetry = candidate.state === "blocked" && candidate.failure_reason?.code === "MAIN_WORKTREE_OVERLAY_CONFLICT";
    if (candidate.state !== "ready" && !overlayRetry) throw new Error(`Candidate must be ready before integration; current state is ${candidate.state}.`);
    if (candidate.validation_report?.passed !== true || candidate.validation_report?.integration_commit !== candidate.integration_commit) throw new Error("Candidate does not hold a valid exact integration validation report.");

    const lock = await acquireFileLock(applyLock, "repository_integration_apply");
    if (!lock) {
      const error = new Error("Another integration apply is currently active.");
      error.code = "INTEGRATION_LOCK_BUSY";
      throw error;
    }
    try {
      candidate = await getCandidate({ integration_candidate_id: candidateId });
      const freshness = await candidateFreshness(candidate);
      if (!freshness.fresh) {
        return updateCandidate(candidateId, candidate.revision, (record) => {
          transitionCandidate(record, "stale");
          record.stale_reason = { code: "APPLY_INPUT_STALE", reasons: freshness.reasons };
        });
      }
      const safety = await mainSafetyStatus();
      if (safety.branch !== DEV_INTEGRATION_TARGET_BRANCH) throw new Error("Shared repository must have main checked out before integration.");
      if (safety.staged.length > 0) {
        const error = new Error("Integration refuses a shared main index with staged changes.");
        error.code = "MAIN_INDEX_NOT_CLEAN";
        throw error;
      }
      if (safety.conflicted.length > 0) {
        const error = new Error("Integration refuses a shared main with conflicted paths.");
        error.code = "MAIN_CONFLICTED";
        throw error;
      }
      if (safety.operation_state.length > 0) {
        const error = new Error(`Integration refuses active Git operation state: ${safety.operation_state.join(", ")}.`);
        error.code = "MAIN_GIT_OPERATION_ACTIVE";
        throw error;
      }

      const snapshots = await dirtySnapshot();
      const overlay = await overlayPreflight(candidate.target_head, candidate.integration_commit);
      if (overlay.exit_code !== 0) {
        return updateCandidate(candidateId, candidate.revision, (record) => {
          if (record.state === "ready") transitionCandidate(record, "blocked");
          record.failure_reason = { code: "MAIN_WORKTREE_OVERLAY_CONFLICT", target_head: record.target_head, integration_commit: record.integration_commit };
        });
      }

      const finalHead = await readMainHead();
      const finalSource = await readBranchHead(candidate.source_branch);
      if (finalHead !== candidate.target_head || finalSource !== candidate.source_head) {
        return updateCandidate(candidateId, candidate.revision, (record) => {
          transitionCandidate(record, "stale");
          record.stale_reason = { code: "APPLY_RACE_DETECTED", target_actual: finalHead, source_actual: finalSource };
        });
      }
      const secondOverlay = await overlayPreflight(candidate.target_head, candidate.integration_commit);
      if (secondOverlay.exit_code !== 0) {
        return updateCandidate(candidateId, candidate.revision, (record) => {
          transitionCandidate(record, "failed");
          record.failure_reason = { code: "MAIN_WORKTREE_OVERLAY_CONFLICT_AFTER_LOCK" };
        });
      }

      const journalOperation = await beginDevJournalOperation({
        operation_type: "integration_apply",
        tool_name: "dev_workspace_integrate",
        workstream_id: candidate.workstream_id,
        workspace_id: candidate.workspace_id,
        links: [
          { relation: "used", commit: candidate.source_head },
          { relation: "related_to", integration_candidate_id: candidate.integration_candidate_id },
        ],
        result: {
          integration_candidate_id: candidate.integration_candidate_id,
          source_head: candidate.source_head,
          target_head: candidate.target_head,
          integration_commit: candidate.integration_commit,
          strategy: candidate.strategy,
          validation_passed: candidate.validation_report?.passed === true,
        },
      });

      candidate = await updateCandidate(candidateId, candidate.revision, (record) => {
        transitionCandidate(record, "applying");
        record.failure_reason = null;
      });

      // The candidate integration commit is proven to descend from the exact target_head.
      // A fixed ff-only merge delegates ref/index/worktree transition to Git as one native
      // fast-forward operation, preserving safe local dirty carry-forward semantics. No
      // caller branch, strategy, refspec, merge option, executable, cwd, or environment exists.
      const advancement = await gitRunner(["merge", "--ff-only", "--no-stat", candidate.integration_commit], {
        cwd: repoRoot,
        allowFailure: true,
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
        extraEnv: { GIT_MERGE_AUTOEDIT: "no" },
      });
      if (advancement.exit_code !== 0) {
        const actualHead = await readMainHead();
        try {
          await failDevJournalOperation(journalOperation.operation_id, {
            result: {
              integration_candidate_id: candidate.integration_candidate_id,
              source_head: candidate.source_head,
              target_head: candidate.target_head,
              integration_commit: candidate.integration_commit,
              strategy: candidate.strategy,
              actual_head: actualHead,
              advancement_exit_code: advancement.exit_code,
              effect_observed: actualHead !== candidate.target_head,
            },
          });
        } catch (error) {
          await markDevJournalDegraded(`dev_workspace_integrate failure terminal append failed: ${error.message}`);
          throw new Error(`Integration apply failed and provenance terminal append failed: ${error.message}`);
        }
        return updateCandidate(candidateId, candidate.revision, (record) => {
          if (actualHead !== record.target_head) {
            transitionCandidate(record, "stale");
            record.stale_reason = { code: "MAIN_ADVANCEMENT_CAS_FAILED", expected: record.target_head, actual: actualHead };
          } else {
            transitionCandidate(record, "failed");
            record.failure_reason = { code: "MAIN_ADVANCEMENT_FAILED", exit_code: advancement.exit_code };
          }
        });
      }

      const postHead = await readMainHead();
      const postSafety = await mainSafetyStatus();
      const dirtyChanges = await verifyDirtySnapshot(snapshots);
      const postDiffCheck = await gitRunner(["diff", "--check"], { cwd: repoRoot, allowFailure: true });
      if (
        postHead !== candidate.integration_commit
        || postSafety.branch !== DEV_INTEGRATION_TARGET_BRANCH
        || postSafety.staged.length > 0
        || postSafety.conflicted.length > 0
        || dirtyChanges.length > 0
        || postDiffCheck.exit_code !== 0
      ) {
        try {
          await failDevJournalOperation(journalOperation.operation_id, {
            result: {
              integration_candidate_id: candidate.integration_candidate_id,
              source_head: candidate.source_head,
              target_head: candidate.target_head,
              integration_commit: candidate.integration_commit,
              strategy: candidate.strategy,
              actual_head: postHead,
              post_verify_passed: false,
              effect_observed: postHead === candidate.integration_commit,
            },
          });
        } catch (error) {
          await markDevJournalDegraded(`dev_workspace_integrate post-verify terminal append failed: ${error.message}`);
          throw new Error(`Integration effect completed but provenance terminal append failed: ${error.message}`);
        }
        return updateCandidate(candidateId, candidate.revision, (record) => {
          transitionCandidate(record, "failed");
          record.failure_reason = {
            code: "POST_INTEGRATION_VERIFY_FAILED",
            head_matches: postHead === record.integration_commit,
            staged_count: postSafety.staged.length,
            conflicted_count: postSafety.conflicted.length,
            changed_dirty_paths: dirtyChanges.slice(0, DIRTY_VERIFY_MAX_REPORTED_PATHS),
            diff_check_passed: postDiffCheck.exit_code === 0,
          };
        });
      }

      const integrated = await updateCandidate(candidateId, candidate.revision, (record) => {
        transitionCandidate(record, "integrated");
        record.integrated_at = clock().toISOString();
        record.failure_reason = null;
        record.stale_reason = null;
      });
      try {
        await completeDevJournalOperation(journalOperation.operation_id, {
          links: [
            { relation: "used", commit: candidate.source_head },
            { relation: "integrated_by", commit: candidate.integration_commit },
            { relation: "related_to", integration_candidate_id: candidate.integration_candidate_id },
          ],
          result: {
            integration_candidate_id: candidate.integration_candidate_id,
            source_head: candidate.source_head,
            target_head: candidate.target_head,
            integration_commit: candidate.integration_commit,
            strategy: candidate.strategy,
            actual_head: postHead,
            post_verify_passed: true,
            integrated: true,
          },
        });
      } catch (error) {
        await markDevJournalDegraded(`dev_workspace_integrate terminal append failed: ${error.message}`);
        throw new Error(`Integration effect completed but provenance terminal append failed: ${error.message}`);
      }
      return integrated;
    } finally {
      await releaseFileLock(lock, applyLock);
    }
  }

  return {
    preflight,
    getCandidate,
    listCandidates,
    validateIntegration,
    integrate,
    registryPath: registryFile,
    integrationRootPath: integrationRoot,
  };
}

const defaultService = createDevIntegrationService();

export const dev_workspace_integration_preflight = defaultService.preflight;
export const dev_workspace_get_integration_candidate = defaultService.getCandidate;
export const dev_workspace_list_integration_candidates = defaultService.listCandidates;
export const dev_workspace_validate_integration = defaultService.validateIntegration;
export const dev_workspace_integrate = defaultService.integrate;
