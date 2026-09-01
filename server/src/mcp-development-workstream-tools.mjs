import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
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
const gitSha1Pattern = /^[a-f0-9]{40}$/u;
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
  if (record.mode !== DEV_WORKSTREAM_SUPPORTED_MODE) {
    throw new Error(`Persisted workstream mode must be ${DEV_WORKSTREAM_SUPPORTED_MODE}.`);
  }
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
  if (record.workspace_id !== DEV_WORKSTREAM_WORKSPACE_ID) {
    throw new Error("workspace_id does not match the Phase 2A shared workspace identity.");
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
} = {}) {
  const storagePath = normalizeRegistryPath(registryPath);

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
      const error = new Error("isolated mode is not supported in Phase 2A; Controlled Worktree Lifecycle is reserved for Phase 2B.");
      error.code = "WORKSTREAM_MODE_NOT_SUPPORTED";
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
