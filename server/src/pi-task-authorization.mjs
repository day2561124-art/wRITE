import { randomUUID } from "node:crypto";
import { link, lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { capabilityDefinition, PI_TASK_AUTHORIZATION_ID, WINDOWS_APPROVED_SCRIPT_ID, WINDOWS_SERVICE_NAME } from "./pi-execution-contract.mjs";

const project = "writer_workbench";
const allowed = new Set([
  "filesystem.read", "filesystem.list", "filesystem.write", "filesystem.patch",
  "git.status", "git.commit", "verification.focused", "verification.affected",
  "workspace.create_checkpoint", "windows.service.ensure_running", "windows.powershell.run_approved", "workspace.powershell_isolated",
]);
const maxRecordBytes = 16 * 1024;
const unconfinedShell = new Set(["host.powershell", "workspace.powershell"]);

// This is only the task-grant layer. A false result does not authorize execution:
// the strict intent contract, dispatch, workspace and tool-specific gates still apply.
export function requiresPiTaskGrant(capability) {
  return unconfinedShell.has(capability)
    || (allowed.has(capability) && capabilityDefinition(capability).effect);
}

function denied() {
  throw Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
}

function validGrant(grant) {
  const services = grant?.windows_services ?? [];
  const scripts = grant?.windows_scripts ?? [];
  if (!Array.isArray(services) || services.length > 16 || services.some(name => typeof name !== "string"
    || !WINDOWS_SERVICE_NAME.test(name) || name !== name.toLowerCase()) || new Set(services).size !== services.length) return false;
  const allowsServiceStart = Array.isArray(grant?.capabilities) && grant.capabilities.includes("windows.service.ensure_running");
  const allowsScript = Array.isArray(grant?.capabilities) && grant.capabilities.includes("windows.powershell.run_approved");
  if (!Array.isArray(scripts) || scripts.length > 8 || scripts.some(script => !script
    || Object.keys(script).sort().join(",") !== "script_id,script_sha256"
    || typeof script.script_id !== "string" || !WINDOWS_APPROVED_SCRIPT_ID.test(script.script_id)
    || typeof script.script_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(script.script_sha256))
    || new Set(scripts.map(script => script.script_id)).size !== scripts.length || allowsScript !== (scripts.length > 0)) return false;
  return grant?.schema_version === 1 && grant.project_id === project && allowsServiceStart === (services.length > 0)
    && grant.permission_level === (allowsScript ? "workspace_with_admin_script" : allowsServiceStart ? "workspace_with_admin_service" : "workspace_standard")
    && typeof grant.task_authorization_id === "string" && PI_TASK_AUTHORIZATION_ID.test(grant.task_authorization_id)
    && typeof grant.goal === "string" && grant.goal.trim() && grant.goal.length <= 4096
    && typeof grant.workspace_id === "string" && /^dev_workspace_[a-f0-9]{24}$/u.test(grant.workspace_id)
    && typeof grant.workstream_id === "string" && /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u.test(grant.workstream_id)
    && Array.isArray(grant.capabilities) && grant.capabilities.length > 0
    && grant.capabilities.every(capability => allowed.has(capability))
    && new Set(grant.capabilities).size === grant.capabilities.length
    && Number.isSafeInteger(grant.issued_at_ms) && Number.isSafeInteger(grant.expires_at_ms)
    && grant.expires_at_ms > grant.issued_at_ms;
}

// Operator-owned grants, read by the MCP process and durable worker. This
// directory must have an OS ACL that only lets the operator publish records.
export function createPiTaskAuthorizationStore({ root, clock = Date.now } = {}) {
  async function directory() {
    if (typeof root !== "string" || !path.isAbsolute(root)) denied();
    const entry = await lstat(root);
    if (entry.isSymbolicLink() || !entry.isDirectory()) denied();
    return realpath(root);
  }

  function filename(dir, id, kind) {
    if (typeof id !== "string" || !PI_TASK_AUTHORIZATION_ID.test(id)) denied();
    return path.join(dir, `${id}.${kind}.json`);
  }

  async function read(file) {
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile() || info.size > maxRecordBytes) denied();
    return JSON.parse(await readFile(file, "utf8"));
  }

  async function publish(file, record) {
    const encoded = `${JSON.stringify(record)}\n`;
    if (Buffer.byteLength(encoded, "utf8") > maxRecordBytes) denied();
    const temp = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
    const handle = await open(temp, "wx", 0o600);
    try {
      try {
        await handle.writeFile(encoded, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await link(temp, file);
    } finally {
      await unlink(temp).catch(() => {});
    }
  }

  async function issue({ goal, workspace_id, workstream_id, capabilities, expires_at_ms, windows_services = [], windows_scripts = [] }) {
    if (!Array.isArray(windows_services) || windows_services.some(name => typeof name !== "string" || !WINDOWS_SERVICE_NAME.test(name))) denied();
    if (!Array.isArray(windows_scripts)) denied();
    const services = windows_services.map(name => name.toLowerCase());
    const grant = { schema_version: 1, project_id: project,
      permission_level: windows_scripts.length ? "workspace_with_admin_script" : services.length ? "workspace_with_admin_service" : "workspace_standard",
      ...(services.length ? { windows_services: services } : {}),
      ...(windows_scripts.length ? { windows_scripts } : {}),
      task_authorization_id: `pi_task_${randomUUID().replaceAll("-", "")}`,
      goal, workspace_id, workstream_id, capabilities, issued_at_ms: clock(), expires_at_ms };
    if (!validGrant(grant)) denied();
    await publish(filename(await directory(), grant.task_authorization_id, "grant"), grant);
    return grant;
  }

  async function revoke(id) {
    const dir = await directory();
    const grant = await read(filename(dir, id, "grant"));
    if (!validGrant(grant) || grant.task_authorization_id !== id) denied();
    const file = filename(dir, id, "revocation");
    const record = { schema_version: 1, task_authorization_id: id, revoked_at_ms: clock() };
    try {
      await publish(file, record);
      return record;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      return read(file);
    }
  }

  async function authorize(intent, actions = intent.requested_actions) {
    const id = intent.task_authorization_id;
    try {
      const dir = await directory();
      const grant = await read(filename(dir, id, "grant"));
      const context = intent.context;
      const now = clock();
      if (!validGrant(grant) || grant.task_authorization_id !== id
        || grant.project_id !== context.project_id || grant.workspace_id !== context.workspace_id
        || grant.workstream_id !== context.workstream_id || grant.goal !== intent.goal
        || now < grant.issued_at_ms || now >= grant.expires_at_ms
        || actions.some(action => !grant.capabilities.includes(action.capability)
          || (action.capability === "windows.service.ensure_running"
            && !grant.windows_services.includes(action.input.service_name.toLowerCase()))
          || (action.capability === "windows.powershell.run_approved" && !grant.windows_scripts.some(script =>
            script.script_id === action.input.script_id && script.script_sha256 === action.input.script_sha256)))) denied();
      // Existence is enough, including after a malformed or interrupted revocation.
      try {
        await lstat(filename(dir, id, "revocation"));
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
    } catch {
      denied();
    }
    denied();
  }

  return Object.freeze({ issue, revoke, authorize });
}

export function createPiTaskPolicy({ store = createPiTaskAuthorizationStore({
  root: process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT,
}), required = process.env.NEXA_PI_REQUIRE_TASK_AUTHORIZATION === "1", authorizeStanding } = {}) {
  return async function authorizeTask(intent, actions = intent.requested_actions) {
    // A standing reference never turns the mandatory grant gate off. A
    // separate independently published policy must authorize the entire
    // intent, and the trusted controller must install its reader.
    if (intent.standing_authorization !== undefined) {
      if (intent.task_authorization_id !== undefined || typeof authorizeStanding !== "function") denied();
      return authorizeStanding(intent);
    }
    if (intent.task_authorization_id !== undefined) return store.authorize(intent, actions);
    if (required && actions.some(action => requiresPiTaskGrant(action.capability))) denied();
  };
}
