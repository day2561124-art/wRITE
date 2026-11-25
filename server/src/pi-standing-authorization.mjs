import { randomUUID } from "node:crypto";
import { link, lstat, open, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { hashExecutionInput } from "./pi-execution-contract.mjs";
import { reviewEngineeringCapability } from "./pi-standing-policy-review.mjs";

const idPattern = /^pi_standing_[a-f0-9]{32}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const workspacePattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const maxBytes = 64 * 1024;
const maxPolicies = 128;
const maxDuration = 30 * 86400000;
// Runtime allowlist is deliberately independent of the review inventory.
// A change to the review-only classification cannot grant new authority.
const ordinaryCapabilities = new Set([
  "filesystem.read", "filesystem.list", "filesystem.write", "filesystem.patch",
  "workspace.create_checkpoint", "verification.focused", "verification.affected",
  "git.status", "git.commit",
]);
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const principalValid = value => typeof value === "string" && value.trim().length > 0
  && value.length <= 512 && !value.includes("\u0000");
const fail = (code = "PERMISSION_DENIED") => { throw Object.assign(new Error(code), { code }); };
const scopeKey = value => JSON.stringify([value.workspace_id, value.workstream_id]);
function validScope(scope) {
  return exact(scope, ["workspace_id", "workstream_id"])
    && typeof scope.workspace_id === "string" && workspacePattern.test(scope.workspace_id)
    && typeof scope.workstream_id === "string" && workstreamPattern.test(scope.workstream_id);
}
function validPlan(plan) {
  return exact(plan, ["schema_version", "project_id", "principal", "scopes", "capabilities", "expires_at_ms"])
    && plan.schema_version === 1 && plan.project_id === "writer_workbench" && principalValid(plan.principal)
    && Array.isArray(plan.scopes) && plan.scopes.length > 0 && plan.scopes.length <= 64
    && plan.scopes.every(validScope) && new Set(plan.scopes.map(scopeKey)).size === plan.scopes.length
    && Array.isArray(plan.capabilities) && plan.capabilities.length > 0 && plan.capabilities.length <= 9
    && new Set(plan.capabilities).size === plan.capabilities.length
    && plan.capabilities.every(capability => typeof capability === "string"
      && ordinaryCapabilities.has(capability)
      && reviewEngineeringCapability(capability) === "standing_scope_candidate")
    && Number.isSafeInteger(plan.expires_at_ms);
}
function validRecord(record) {
  if (!exact(record, ["kind", "policy_id", "issued_at_ms", "plan", "plan_sha256"])
    || record.kind !== "operator_approved_engineering_v1"
    || typeof record.policy_id !== "string" || !idPattern.test(record.policy_id)
    || !Number.isSafeInteger(record.issued_at_ms) || record.issued_at_ms < 0
    || !validPlan(record.plan) || record.plan.expires_at_ms <= record.issued_at_ms
    || record.plan.expires_at_ms - record.issued_at_ms > maxDuration
    || record.plan_sha256 !== hashExecutionInput(record.plan)) return false;
  return true;
}
function matchingContext(actual, scope) {
  return actual?.workspace_id === scope.workspace_id && actual.workstream_id === scope.workstream_id
    && actual.workspace_type === "isolated_worktree" && actual.lifecycle_state === "active"
    && actual.workstream_state === "active" && actual.healthy === true && actual.mutation_allowed === true;
}
async function directory(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail();
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) fail();
  return realpath(root);
}
function fileName(dir, id, kind) {
  if (typeof id !== "string" || !idPattern.test(id)) fail();
  return path.join(dir, id + "." + kind + ".json");
}
async function revoked(dir, id) {
  try { await lstat(fileName(dir, id, "revocation")); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
async function readRecord(dir, id) {
  const file = fileName(dir, id, "approved");
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) fail();
  const handle = await open(file, "r");
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size > maxBytes) fail();
    const buffer = Buffer.alloc(maxBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    const after = await handle.stat();
    if (total > maxBytes || total !== opened.size || after.size !== total
      || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) fail();
    const record = JSON.parse(buffer.subarray(0, total).toString("utf8"));
    if (!validRecord(record) || record.policy_id !== id) fail();
    return record;
  } finally { await handle.close(); }
}
async function publish(file, record) {
  const bytes = JSON.stringify(record) + "\n";
  if (Buffer.byteLength(bytes) > maxBytes) fail("STANDING_RECORD_TOO_LARGE");
  const temp = path.join(path.dirname(file), "." + randomUUID() + ".standing.tmp");
  const handle = await open(temp, "wx", 0o600);
  try {
    try { await handle.writeFile(bytes, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await link(temp, file);
  } finally { await unlink(temp); }
}

// The root is supplied only by trusted host composition. Its existing
// operator-owned ACL must be independently verified at installation.
// No runtime method writes grants or derives permission from review results.
// Only the separate operator publisher below creates approved records.
export function createPiStandingAuthorizationReader({ root, resolveWorkspace, clock = Date.now } = {}) {
  if (typeof resolveWorkspace !== "function" || typeof clock !== "function") fail();
  async function check(dir, record, intent) {
    const now = clock();
    const proof = intent.standing_authorization;
    if (!proof || intent.bootstrap || intent.task_authorization_id !== undefined
      || record.policy_id !== proof.policy_id || hashExecutionInput(record) !== proof.policy_sha256
      || record.plan.principal !== proof.principal || intent.context?.project_id !== record.plan.project_id
      || !Number.isSafeInteger(now) || now < record.issued_at_ms || now >= record.plan.expires_at_ms
      || !Array.isArray(intent.requested_actions) || intent.requested_actions.length === 0
      || intent.requested_actions.some(action => !record.plan.capabilities.includes(action.capability)
        || action.on_failure !== undefined)) fail();
    const scope = record.plan.scopes.find(item => item.workspace_id === intent.context.workspace_id
      && item.workstream_id === intent.context.workstream_id);
    if (!scope || await revoked(dir, record.policy_id)) fail();
    const actual = await resolveWorkspace({ workspace_id: scope.workspace_id }, { mutation: true });
    if (!matchingContext(actual, scope) || await revoked(dir, record.policy_id)
      || clock() >= record.plan.expires_at_ms) fail();
  }
  async function authorize(intent) {
    try {
      const dir = await directory(root);
      const proof = intent.standing_authorization;
      if (!exact(proof, ["policy_id", "policy_sha256", "principal"])
        || typeof proof.policy_id !== "string" || !idPattern.test(proof.policy_id)
        || typeof proof.policy_sha256 !== "string" || !digestPattern.test(proof.policy_sha256)
        || !principalValid(proof.principal)) fail();
      const record = await readRecord(dir, proof.policy_id);
      await check(dir, record, intent);
    } catch { fail(); }
  }
  async function bind(intent, { authenticatedPrincipal } = {}) {
    try {
      if (!principalValid(authenticatedPrincipal) || intent.standing_authorization !== undefined
        || intent.task_authorization_id !== undefined || intent.bootstrap) fail();
      const dir = await directory(root);
      const files = (await readdir(dir)).filter(name => /^pi_standing_[a-f0-9]{32}\.approved\.json$/u.test(name));
      if (files.length > maxPolicies) fail();
      const matches = [];
      for (const name of files) {
        const id = name.slice(0, -".approved.json".length);
        const record = await readRecord(dir, id);
        const now = clock();
        if (record.plan.principal !== authenticatedPrincipal || now < record.issued_at_ms
          || now >= record.plan.expires_at_ms || await revoked(dir, id)
          || !record.plan.scopes.some(scope => scope.workspace_id === intent.context.workspace_id
            && scope.workstream_id === intent.context.workstream_id)) continue;
        matches.push(record);
      }
      // Ambiguous overlapping policies are an operator error, not a chance
      // to combine capability lists or choose a more permissive policy.
      if (matches.length !== 1) fail();
      const record = matches[0];
      const proof = { policy_id: record.policy_id, policy_sha256: hashExecutionInput(record), principal: authenticatedPrincipal };
      const bound = { ...intent, standing_authorization: proof };
      await check(dir, record, bound);
      return bound;
    } catch { fail(); }
  }
  return Object.freeze({ bind, authorize });
}

// Operator-only composition. This is deliberately not an MCP tool or a
// dependency of the execution reader's bind/authorize methods.
export function createPiStandingPolicyPublisher({ root, resolveWorkspace, clock = Date.now } = {}) {
  if (typeof resolveWorkspace !== "function" || typeof clock !== "function") fail();
  async function prepare(input) {
    hashExecutionInput(input);
    const plan = JSON.parse(JSON.stringify(input));
    const now = clock();
    if (!validPlan(plan) || !Number.isSafeInteger(now) || now < 0
      || plan.expires_at_ms <= now || plan.expires_at_ms - now > maxDuration) fail("INVALID_STANDING_POLICY_PLAN");
    for (const scope of plan.scopes) {
      if (!matchingContext(await resolveWorkspace({ workspace_id: scope.workspace_id }, { mutation: true }), scope))
        fail("STANDING_WORKSPACE_UNAVAILABLE");
    }
    return { plan, plan_sha256: hashExecutionInput(plan) };
  }
  async function preview(input) {
    return { ...await prepare(input), publication_performed: false };
  }
  async function issue(input, reviewedDigest) {
    const { plan, plan_sha256 } = await prepare(input);
    if (reviewedDigest !== plan_sha256) fail("STANDING_POLICY_APPROVAL_MISMATCH");
    const dir = await directory(root);
    const lock = path.join(dir, ".standing-policy.publish.lock");
    const handle = await open(lock, "wx", 0o600);
    try {
      const files = (await readdir(dir)).filter(name => /^pi_standing_[a-f0-9]{32}\.approved\.json$/u.test(name));
      if (files.length >= maxPolicies) fail("STANDING_POLICY_STORE_FULL");
      for (const name of files) {
        const id = name.slice(0, -".approved.json".length);
        const record = await readRecord(dir, id);
        if (record.plan.principal === plan.principal && clock() < record.plan.expires_at_ms
          && !await revoked(dir, id) && record.plan.scopes.some(scope => plan.scopes.some(item =>
            scopeKey(scope) === scopeKey(item)))) fail("STANDING_POLICY_SCOPE_ALREADY_APPROVED");
      }
      // Recheck context and expiry after lock acquisition; no workspace
      // may be substituted between the reviewed plan and the record.
      await prepare(plan);
      const record = { kind: "operator_approved_engineering_v1",
        policy_id: "pi_standing_" + randomUUID().replaceAll("-", ""),
        issued_at_ms: clock(), plan, plan_sha256 };
      if (!validRecord(record)) fail("INVALID_STANDING_POLICY_PLAN");
      await publish(fileName(dir, record.policy_id, "approved"), record);
      return { policy_id: record.policy_id, policy_sha256: hashExecutionInput(record), plan_sha256, publication_performed: true };
    } finally {
      try { await handle.close(); } finally { await unlink(lock); }
    }
  }
  async function revoke(id) {
    const dir = await directory(root);
    await readRecord(dir, id);
    const file = fileName(dir, id, "revocation");
    try { await publish(file, { policy_id: id, revoked_at_ms: clock() }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    return { policy_id: id, revoked: true };
  }
  async function list() {
    const dir = await directory(root);
    const files = (await readdir(dir)).filter(name => /^pi_standing_[a-f0-9]{32}\.approved\.json$/u.test(name));
    if (files.length > maxPolicies) fail("STANDING_POLICY_STORE_FULL");
    const records = [];
    for (const name of files.sort()) {
      const id = name.slice(0, -".approved.json".length);
      const record = await readRecord(dir, id);
      records.push({ ...record, policy_sha256: hashExecutionInput(record),
        revoked: await revoked(dir, id), expired: clock() >= record.plan.expires_at_ms });
    }
    return records;
  }
  return Object.freeze({ preview, issue, revoke, list });
}
