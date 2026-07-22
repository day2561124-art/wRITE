import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const port = await freePort();
const child = spawn(process.execPath, [
  "server/src/ui-server.mjs",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`UI server exited: ${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(healthy, true, `UI server did not become healthy: ${stderr}`);

  const policy = await fetch(`${baseUrl}/approval-ui-policy.mjs`);
  assert.equal(policy.status, 200);
  assert.match(policy.headers.get("content-type") ?? "", /text\/javascript/iu);

  const response = await fetch(`${baseUrl}/api/approval-queue/items`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.pending_count, payload.pending_items.length);
  for (const item of payload.pending_items) {
    const status = item.status?.status;
    assert(
      status === "pending"
        || (status === "blocked" && item.resolution_path?.available === true),
      `Non-actionable status leaked into pending API: ${status}`,
    );
    assert.notEqual(item.status?.target_exists, false);
    assert.notEqual(item.test_fixture, true);
  }
  console.log("Approval UI static module and read-only actionable API passed.");
} finally {
  await terminateProcessTree(child);
}
