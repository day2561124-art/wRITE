import { loadCodemodeSandbox } from "./codemode-loader.mjs";

const MAX_FRAME = 64 * 1024;
const pending = new Map();
let started = false;
let sequence = 0;

function send(message) {
  if (!process.connected) throw new Error("bridge_closed");
  if (Buffer.byteLength(JSON.stringify(message), "utf8") > MAX_FRAME) throw new Error("output_limit");
  process.send(message);
}
function callHost(name, args) {
  if (pending.size >= 2) return Promise.reject(new Error("concurrency_limit"));
  if (Buffer.byteLength(JSON.stringify(args), "utf8") > 4096) return Promise.reject(new Error("argument_limit"));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { send({ type: "call", id, name, args }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}
process.on("disconnect", () => process.exit(0));
process.on("message", async (message) => {
  if (message?.type === "reply") {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.ok) request.resolve(message.value);
    else request.reject(new Error(message.reason));
    return;
  }
  if (message?.type !== "execute" || started) return;
  started = true;
  let sandbox;
  try {
    const CodemodeSandbox = await loadCodemodeSandbox();
    sandbox = new CodemodeSandbox({
      timeoutMs: message.timeoutMs,
      memoryLimitBytes: 32 * 1024 * 1024,
      tools: ["dev_read_file", "dev_list_directory"].map((name) => ({
        name,
        description: "Read-only Workbench tool; workspace is bound by the host.",
        execute: (args) => callHost(name, args),
      })),
    });
    const result = await sandbox.execute(message.code, { timeoutMs: message.timeoutMs });
    // No store or image buffers cross the process boundary.
    const value = result.ok
      ? { ok: true, value: result.value ?? null, output: result.output, calls: result.calls }
      : { ok: false, reason: result.error?.kind ?? "sandbox", output: result.output, calls: result.calls };
    try { send({ type: "result", value }); }
    catch { send({ type: "result", value: { ok: false, reason: "output_limit" } }); }
  } catch {
    if (process.connected) send({ type: "result", value: { ok: false, reason: "sidecar_failed" } });
  } finally {
    await sandbox?.close();
    process.disconnect?.();
  }
});
