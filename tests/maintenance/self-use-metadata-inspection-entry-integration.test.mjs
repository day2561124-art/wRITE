import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSealedChainClosureMetadata } from "../../server/src/inspect-sealed-chain-closure-metadata-service.mjs";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const endpointPath = "/api/system/inspect-sealed-chain-closure-metadata";
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const expectedPublicDigest = "db04340efd514ab9dfa8888c37e9eca5f8ca201ca4cdbb41500ce53944abf2a5";
const requiredIdentities = {
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
};

const fullMetadata = {
  full_run_all_status: "pending_due_to_prior_backup_export_service_timeout",
  capability_scope: requiredIdentities.capability_scope,
  capability_id: requiredIdentities.capability_id,
  source_chain_closed: true,
  source_chain: "Phase42A-Phase42V",
  source_handoff_phase: "Phase42V",
  source_handoff_seal_digest: "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94",
  explicit_scope_phase: "Phase43A",
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  explicit_scope_acceptance_digest: "sha256:abc7271b70588e04e415e4bdbdcae43b1e8743bd194f16d28debc3e54f8a93f3",
  capability_contract_phase: "Phase43B",
  capability_contract_digest: "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8",
  capability_contract_preview_digest: "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6",
  capability_kind: requiredIdentities.capability_kind,
  capability_contract_status: "accepted",
  implementation_readiness_status: "accepted",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function directoryDigest(directory) {
  const entries = [];
  async function visit(current, relative = "") {
    for (const entry of (await readdir(current, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = path.posix.join(relative, entry.name);
      const childPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(childPath, childRelative);
      else if (entry.isFile()) entries.push(`${childRelative}\0${sha256(await readFile(childPath))}`);
    }
  }
  await visit(directory);
  return sha256(entries.join("\n"));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function requestJson(port, { method = "POST", body, contentType = "application/json" } = {}) {
  return new Promise((resolve, reject) => {
    const serialized = body === undefined
      ? ""
      : typeof body === "string" ? body : JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: endpointPath,
      method,
      agent: false,
      headers: serialized ? {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(serialized),
      } : {},
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch { /* Non-JSON 404 is still rejected. */ }
        resolve({ status: response.statusCode, payload, text });
      });
    });
    request.once("error", reject);
    request.end(serialized);
  });
}

async function waitForHealth(port, child, stderr) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`UI server exited early: ${stderr.value}`);
    }
    try {
      const response = await new Promise((resolve, reject) => {
        const request = http.get({ host: "127.0.0.1", port, path: "/api/health", agent: false }, resolve);
        request.once("error", reject);
      });
      response.resume();
      if (response.statusCode === 200) return;
    } catch {
      // The loopback server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`UI server did not become healthy: ${stderr.value}`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("UI server shutdown timed out.")), 10_000);
    timer.unref();
  });
  try {
    await Promise.race([once(child, "exit"), timeout]);
  } catch (error) {
    terminateProcessTree(child);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function assertPortRebinds(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function listPublicToolNames() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server/src/mcp-server.mjs"], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_public" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`chatgpt_public MCP exited ${code}: ${stderr}`));
        return;
      }
      const messages = stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
      resolve(messages.find((message) => message.id === 2)?.result?.tools?.map((tool) => tool.name) ?? []);
    });
    child.stdin.end(`${[
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "self-use-integration", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ].map((message) => JSON.stringify(message)).join("\n")}\n`);
  });
}

const uiSource = await readFile(path.join(rootDir, "server", "src", "ui-server.mjs"), "utf8");
assert.match(uiSource, /import\s*\{\s*inspectSealedChainClosureMetadata,?\s*\}/u);
assert.match(uiSource, /inspectSealedChainClosureMetadata\(await parseBody\(request\)\)/u);
assert.match(uiSource, /\/api\/system\/inspect-sealed-chain-closure-metadata/u);

const canonBefore = await directoryDigest(path.join(rootDir, "data", "canon_db"));
const activeEngineBefore = await readFile(activeEnginePath);
const publicNamesBefore = await listPublicToolNames();
assert.equal(publicNamesBefore.length, 16);
assert.equal(sha256(publicNamesBefore.join("\n")), expectedPublicDigest);
assert.equal(publicNamesBefore.includes("inspect_sealed_chain_closure_metadata"), false);
assert.equal(publicNamesBefore.includes("inspectSealedChainClosureMetadata"), false);

const port = await getFreePort();
const stderr = { value: "" };
const child = spawn(process.execPath, [
  "server/src/ui-server.mjs", "--host", "127.0.0.1", "--port", String(port),
], {
  cwd: rootDir,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderr.value += chunk; });

try {
  await waitForHealth(port, child, stderr);

  const inputSnapshot = structuredClone(fullMetadata);
  const positive = await requestJson(port, { body: fullMetadata });
  assert.equal(positive.status, 200);
  assert.equal(positive.payload.ok, true);
  assert.deepEqual(positive.payload.metadata, inspectSealedChainClosureMetadata(fullMetadata));
  assert.deepEqual(fullMetadata, inputSnapshot);

  const identityOnly = await requestJson(port, { body: requiredIdentities });
  assert.equal(identityOnly.status, 200);
  assert.deepEqual(identityOnly.payload, { ok: true, metadata: requiredIdentities });

  const invalidBodies = [
    { ...requiredIdentities, unknown_key: "blocked" },
    { ...requiredIdentities, source_chain: { nested: true } },
    [requiredIdentities],
    { ...requiredIdentities, capability_id: "mismatch" },
    { ...requiredIdentities, production_store_access: "blocked" },
    { ...requiredIdentities, secret: "blocked" },
    { ...requiredIdentities, credential: "blocked" },
  ];
  for (const body of invalidBodies) {
    const result = await requestJson(port, { body });
    assert.equal(result.status, 400);
    assert.deepEqual(result.payload, { ok: false, error: "stable_runtime_error" });
    assert.equal(result.text.includes("stack"), false);
  }

  const malformed = await requestJson(port, { body: "{not-json" });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.payload, { ok: false, error: "stable_runtime_error" });
  assert.equal(malformed.text.includes("stack"), false);

  const wrongContentType = await requestJson(port, {
    body: requiredIdentities,
    contentType: "text/plain",
  });
  assert.equal(wrongContentType.status, 400);
  assert.deepEqual(wrongContentType.payload, { ok: false, error: "stable_runtime_error" });

  const unsupported = await requestJson(port, { method: "GET" });
  assert([404, 405].includes(unsupported.status));
  assert.equal(unsupported.text.includes("stack"), false);
} finally {
  await stopChild(child);
}

assert(child.exitCode !== null || child.signalCode !== null);
await assertPortRebinds(port);
await new Promise((resolve) => setTimeout(resolve, 50));
assert.equal(process.getActiveResourcesInfo().includes("TCPSERVERWRAP"), false);
assert.equal(process.getActiveResourcesInfo().includes("Timeout"), false);
assert((await readFile(activeEnginePath)).equals(activeEngineBefore));
assert.equal(await directoryDigest(path.join(rootDir, "data", "canon_db")), canonBefore);

const publicNamesAfter = await listPublicToolNames();
assert.deepEqual(publicNamesAfter, publicNamesBefore);
assert.equal(sha256(publicNamesAfter.join("\n")), expectedPublicDigest);

const runAllSource = await readFile(path.join(rootDir, "tests", "run-all.mjs"), "utf8");
assert.equal(/Phase 43K|phase43k/iu.test(runAllSource), false);
assert.deepEqual(
  (await readdir(path.join(rootDir, "tests", "phase43"))).filter((name) => /^phase43k/iu.test(name)),
  [],
);

console.log("Maintenance self-use metadata inspection entry integration tests passed.");
