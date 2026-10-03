import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { controlledProcessEnvironment, terminateProcessTree } from "./process-control.mjs";
import { isPiNodeVersionCompatible } from "./pi-agent-execution-service.mjs";

export const PI_READ_ONLY_LIMITS = Object.freeze({
  codeBytes: 16 * 1024, argumentBytes: 4096, callBytes: 16 * 1024,
  totalCallBytes: 64 * 1024, resultBytes: 32 * 1024,
  calls: 8, concurrency: 2, timeoutMs: 5000,
});
const workerPath = fileURLToPath(new URL("../../scripts/pi-runtime/codemode-worker.mjs", import.meta.url));
const activeChildren = new Set();
let activeHostCalls = 0;
process.once("exit", () => { for (const child of activeChildren) terminateProcessTree(child); });

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function bytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
function validateCall(name, args) {
  if (!plainObject(args) || bytes(args) > PI_READ_ONLY_LIMITS.argumentBytes) throw new Error("invalid_arguments");
  const fields = name === "dev_read_file" ? ["path", "maxBytes"]
    : name === "dev_list_directory" ? ["path", "maxEntries"] : null;
  if (!fields) throw new Error("tool_not_allowed");
  if (Object.keys(args).some((key) => !fields.includes(key))) throw new Error("invalid_arguments");
  if (typeof args.path !== "string" || !args.path.trim() || args.path.length > 1024) throw new Error("invalid_arguments");
  const field = name === "dev_read_file" ? "maxBytes" : "maxEntries";
  const maximum = name === "dev_read_file" ? 8192 : 50;
  if (args[field] !== undefined && (!Number.isInteger(args[field]) || args[field] < 1 || args[field] > maximum)) {
    throw new Error("invalid_arguments");
  }
  return { ...args, [field]: args[field] ?? maximum };
}

async function workbenchRead(name, args, workspaceId) {
  const tools = await import("./mcp-development-readonly-tools.mjs");
  return tools[name]({ ...args, workspace_id: workspaceId });
}

// Internal service: options are server-owned, never accepted from sandbox code.
// No MCP tool is registered until the bridge's formal integration phase.
export async function executePiReadOnly(input, options = {}) {
  if (!plainObject(input) || Object.keys(input).some((key) => key !== "code")
    || typeof input.code !== "string" || !input.code.trim()
    || Buffer.byteLength(input.code, "utf8") > PI_READ_ONLY_LIMITS.codeBytes) {
    return { ok: false, reason: "invalid_request" };
  }
  const workspaceId = options.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 256) {
    return { ok: false, reason: "workspace_required" };
  }
  const nodeExecutable = options.nodeExecutable
    ?? (process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE?.trim() || process.execPath);
  if (nodeExecutable === process.execPath && !isPiNodeVersionCompatible(process.versions.node)) {
    return { ok: false, reason: "host_node_version_too_old" };
  }
  if (activeChildren.size) return { ok: false, reason: "execution_busy" };
  const timeoutMs = options.timeoutMs ?? PI_READ_ONLY_LIMITS.timeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > PI_READ_ONLY_LIMITS.timeoutMs) {
    return { ok: false, reason: "invalid_deadline" };
  }
  let child;
  try {
    child = fork(workerPath, [], {
      execPath: nodeExecutable, execArgv: ["--max-old-space-size=64"], shell: false, windowsHide: true,
      env: controlledProcessEnvironment({}), stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
  } catch { return { ok: false, reason: "sidecar_unavailable" }; }
  activeChildren.add(child);
  return new Promise((resolve) => {
    let settled = false;
    let stopped = false;
    let outcome;
    let calls = 0;
    let inflight = 0;
    let totalBytes = 0;
    let logBytes = 0;
    const ids = new Set();
    let forceTimer;
    const finish = () => {
      if (settled) return;
      settled = true;
      stopped = true;
      clearTimeout(deadline);
      clearTimeout(forceTimer);
      resolve({ ...(outcome ?? { ok: false, reason: "sidecar_exited" }), host_calls: calls, model_requests: 0 });
    };
    const stop = (reason) => {
      if (stopped) return;
      stopped = true;
      outcome = { ok: false, reason };
      terminateProcessTree(child);
      // Bound response time even if an OS process teardown stalls.
      forceTimer = setTimeout(finish, 2000);
    };
    const deadline = setTimeout(() => stop("timeout"), timeoutMs);
    const reply = (id, value) => {
      if (stopped || !child.connected) return;
      try { child.send({ type: "reply", id, ...value }, (error) => { if (error) stop("ipc_failed"); }); }
      catch { stop("ipc_failed"); }
    };
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
      logBytes += chunk.length;
      if (logBytes > 4096) stop("output_limit");
    });
    child.on("message", async (message) => {
      if (stopped) return;
      if (!plainObject(message) || bytes(message) > 64 * 1024) return stop("protocol_error");
      if (message.type === "result") {
        if (!plainObject(message.value) || typeof message.value.ok !== "boolean") return stop("protocol_error");
        if (bytes(message.value) > PI_READ_ONLY_LIMITS.resultBytes) return stop("output_limit");
        outcome = message.value;
        stopped = true;
        terminateProcessTree(child);
        forceTimer = setTimeout(finish, 2000);
        return;
      }
      if (message.type !== "call" || !Number.isSafeInteger(message.id) || message.id < 1 || ids.has(message.id)) {
        return stop("protocol_error");
      }
      ids.add(message.id);
      calls += 1;
      if (calls > PI_READ_ONLY_LIMITS.calls) return stop("call_limit");
      let args;
      try { args = validateCall(message.name, message.args); }
      catch (error) { reply(message.id, { ok: false, reason: error.message }); return; }
      if (inflight >= PI_READ_ONLY_LIMITS.concurrency || activeHostCalls >= PI_READ_ONLY_LIMITS.concurrency) {
        reply(message.id, { ok: false, reason: "concurrency_limit" }); return;
      }
      inflight += 1;
      activeHostCalls += 1;
      try {
        const value = await (options.readTool ?? workbenchRead)(message.name, args, workspaceId);
        if (stopped) return;
        const size = bytes(value);
        totalBytes += size;
        if (size > PI_READ_ONLY_LIMITS.callBytes || totalBytes > PI_READ_ONLY_LIMITS.totalCallBytes) {
          stop("output_limit"); return;
        }
        reply(message.id, { ok: true, value });
      } catch {
        // Host errors may contain protected paths; only this fixed reason crosses IPC.
        reply(message.id, { ok: false, reason: "workbench_read_failed" });
      } finally {
        inflight -= 1;
        activeHostCalls -= 1;
      }
    });
    child.once("error", () => stop("sidecar_unavailable"));
    child.once("close", () => { activeChildren.delete(child); finish(); });
    try {
      child.send({ type: "execute", code: input.code, timeoutMs }, (error) => { if (error) stop("ipc_failed"); });
    } catch { stop("ipc_failed"); }
  });
}
