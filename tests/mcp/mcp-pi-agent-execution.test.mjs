import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inspectPiRelease, verifyPinnedRuntime } from "../../scripts/pi-runtime/release-preflight.mjs";
import {
  PI_PACKAGE_NAME,
  PI_REQUIRED_NODE_VERSION,
  getPiRuntimeStatus,
  isPiNodeVersionCompatible,
  probePiSidecar,
} from "../../server/src/pi-agent-execution-service.mjs";

test("Pi Node compatibility gate is exact and forward-compatible", () => {
  assert.equal(PI_REQUIRED_NODE_VERSION, "22.19.0");
  assert.equal(isPiNodeVersionCompatible("22.18.9"), false);
  assert.equal(isPiNodeVersionCompatible("22.19.0"), true);
  assert.equal(isPiNodeVersionCompatible("v22.19.1"), true);
  assert.equal(isPiNodeVersionCompatible("23.0.0"), true);
  assert.equal(isPiNodeVersionCompatible("24.18.0"), true);
  assert.equal(isPiNodeVersionCompatible("18.20.8"), false);
  assert.equal(isPiNodeVersionCompatible("not-a-version"), false);
});

test("Pi runtime status fails closed on an incompatible host before probing", async () => {
  let probes = 0;
  const status = await getPiRuntimeStatus({
    hostNodeVersion: "18.20.8",
    nodeExecutable: process.execPath,
    probe: async () => {
      probes += 1;
      return { ok: true };
    },
  });

  assert.equal(probes, 0);
  assert.equal(status.ok, true);
  assert.equal(status.ready, false);
  assert.equal(status.package_name, PI_PACKAGE_NAME);
  assert.equal(status.integration_mode, "isolated_sidecar");
  assert.equal(status.reason, "host_node_version_too_old");
  assert.equal(status.node_executable_source, "host");
  assert.equal(status.probe, null);
});

test("Pi runtime status reports a bounded ready sidecar surface", async () => {
  const status = await getPiRuntimeStatus({
    hostNodeVersion: "24.18.0",
    nodeExecutable: "pi-node",
    probe: async ({ nodeExecutable }) => {
      assert.equal(nodeExecutable, "pi-node");
      return {
        ok: true,
        package_name: PI_PACKAGE_NAME,
        package_version: "1.0.4",
        node_version: "24.18.0",
        capabilities: {
          createAgentSession: true,
          DefaultResourceLoader: true,
          createCodemodeExtension: true,
          createToolSearchExtension: true,
          createMcpExtension: true,
          SessionManager: true,
        },
      };
    },
  });

  assert.equal(status.ok, true);
  assert.equal(status.ready, true);
  assert.equal(status.node_executable_source, "configured");
  assert.equal(status.reason, null);
  assert.equal(status.runner, "scripts/pi-runtime/runner.mjs");
  assert.equal(status.probe.package_version, "1.0.4");
  assert.equal(status.probe.capabilities.createCodemodeExtension, true);
  assert.equal(status.probe.capabilities.createMcpExtension, true);
});

test("Pi runtime status uses host Node for blank executable environment", async () => {
  const previous = process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE;
  try {
    for (const value of ["", "   "]) {
      process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE = value;
      const status = await getPiRuntimeStatus({
        hostNodeVersion: "24.18.0",
        probe: async ({ nodeExecutable }) => {
          assert.equal(nodeExecutable, process.execPath);
          return { ok: true };
        },
      });
      assert.equal(status.ready, true);
      assert.equal(status.node_executable_source, "host");
    }
  } finally {
    if (previous === undefined) delete process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE;
    else process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE = previous;
  }
});

test("Pi runtime status preserves bounded probe failure state", async () => {
  const status = await getPiRuntimeStatus({
    hostNodeVersion: "24.18.0",
    nodeExecutable: "pi-node",
    probe: async () => ({
      ok: false,
      reason: "sidecar_probe_failed",
      exit_code: 1,
      timed_out: false,
    }),
  });

  assert.equal(status.ok, true);
  assert.equal(status.ready, false);
  assert.equal(status.reason, "sidecar_probe_failed");
  assert.equal(status.probe.exit_code, 1);
});

test("Installed Pi matches the pinned runtime and executes SDK to MCP with durable session restore", { timeout: 90_000 }, async (t) => {
  const { existsSync, readFileSync } = await import("node:fs");
  const installed = new URL("../../scripts/pi-runtime/node_modules/@earendil-works/pi-coding-agent/package.json", import.meta.url);
  if (!existsSync(installed) || !isPiNodeVersionCompatible(process.versions.node)) {
    t.skip("optional installed Pi sidecar and supported Node required");
    return;
  }
  const manifest = JSON.parse(readFileSync(new URL("../../scripts/pi-runtime/package.json", import.meta.url), "utf8"));
  const actual = await getPiRuntimeStatus();
  assert.equal(actual.ready, true);
  assert.equal(actual.probe.package_version, manifest.dependencies[PI_PACKAGE_NAME]);
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { fileURLToPath } = await import("node:url");
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL("../../scripts/pi-runtime/sdk-proof.mjs", import.meta.url))],
    { timeout: 60_000, windowsHide: true, maxBuffer: 64 * 1024, encoding: "utf8" });
  const result = JSON.parse(stdout.trim());
  assert.equal(result.ok, true);
  assert.equal(result.model_requests, 0);
  assert(result.checks.includes("real_stdio_mcp"));
  assert(result.checks.includes("session_disk_restore"));
  assert(result.mcp_calls >= 6);
});

test("Sidecar probe preserves allowlisted runner failure codes without exposing stderr", async () => {
  const error = Object.assign(new Error("runner exited"), {
    code: 1,
    killed: false,
    stdout: '{"ok":false,"reason":"pi_runtime_probe_failed","detail":"ERR_MODULE_NOT_FOUND"}\n',
    stderr: "private diagnostic not to expose",
  });
  const probe = await probePiSidecar({ execute: async () => { throw error; } });
  assert.deepEqual(probe, {
    ok: false,
    reason: "pi_runtime_probe_failed",
    detail: "ERR_MODULE_NOT_FOUND",
    exit_code: 1,
    timed_out: false,
  });
  assert.equal(JSON.stringify(probe).includes("private diagnostic"), false);
});

test("Sidecar probe rejects arbitrary runner failure details and malformed output", async () => {
  for (const stdout of [
    '{"ok":false,"reason":"pi_runtime_probe_failed","detail":"PRIVATE_TOKEN"}',
    '{"ok":false,"reason":"invented_reason","detail":"ERR_MODULE_NOT_FOUND"}',
    "not-json",
    "x".repeat(70_000),
  ]) {
    const error = Object.assign(new Error("runner exited"), { code: 1, killed: false, stdout });
    const actual = await probePiSidecar({ execute: async () => { throw error; } });
    assert.equal(actual.ok, false);
    assert.equal(actual.exit_code, 1);
    assert.equal(actual.detail, undefined);
    assert.equal(actual.reason, stdout.includes('"reason":"pi_runtime_probe_failed"') && stdout.length < 70_000
      ? "pi_runtime_probe_failed" : "sidecar_probe_failed");
  }
});

const releasePin = "1.5.0";
const releaseStatus = JSON.stringify({
  ok: true, package_name: PI_PACKAGE_NAME, package_version: releasePin,
  node_version: "24.18.0", capabilities: Object.fromEntries([
    "createAgentSession", "DefaultResourceLoader", "createCodemodeExtension",
    "createToolSearchExtension", "createMcpExtension", "SessionManager",
  ].map(name => [name, true])),
});

async function releaseFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-release-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const node = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  await mkdir(node, { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { [PI_PACKAGE_NAME]: releasePin } }));
  await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ packages: {
    "": { dependencies: { [PI_PACKAGE_NAME]: releasePin } },
    ["node_modules/" + PI_PACKAGE_NAME]: { version: releasePin },
  } }));
  await writeFile(path.join(node, "package.json"), JSON.stringify({ name: PI_PACKAGE_NAME, version: releasePin }));
  await writeFile(path.join(root, "runner.mjs"), "// synthetic runner; never executed\n");
  return { root, node };
}
const releaseOptions = root => ({ root, nodeVersion: "24.18.0",
  runProbe: async () => ({ stdout: releaseStatus }) });

test("Release preflight rejects incompatible Node and missing dependency", async t => {
  const { root, node } = await releaseFixture(t);
  assert.equal((await inspectPiRelease({ ...releaseOptions(root), nodeVersion: "22.18.0" })).reason,
    "PI_RELEASE_NODE_INCOMPATIBLE");
  await rm(path.join(node, "package.json"));
  assert.equal((await inspectPiRelease(releaseOptions(root))).reason, "PI_RELEASE_DEPENDENCY_UNAVAILABLE");
});

test("Release preflight pins manifest, lock, and installed package", async t => {
  const { root, node } = await releaseFixture(t);
  assert.equal((await inspectPiRelease(releaseOptions(root))).ok, true);
  const bad = verifyPinnedRuntime({ dependencies: { [PI_PACKAGE_NAME]: "^1.5.0" } }, {}, {});
  assert.equal(bad.reason, "PI_RELEASE_VERSION_NOT_PINNED");
  await writeFile(path.join(node, "package.json"), JSON.stringify({ name: PI_PACKAGE_NAME, version: "1.0.4" }));
  assert.equal((await inspectPiRelease(releaseOptions(root))).reason, "PI_RELEASE_INSTALLED_VERSION_MISMATCH");
});

test("Release preflight bounds structured runner errors and redacts stderr", async t => {
  const { root } = await releaseFixture(t);
  const error = Object.assign(new Error("unpublished"), { code: 1,
    stdout: '{"ok":false,"reason":"pi_runtime_probe_failed","detail":"ERR_MODULE_NOT_FOUND"}\n',
    stderr: "private path and secret" });
  const output = await inspectPiRelease({ ...releaseOptions(root), runProbe: async () => { throw error; } });
  assert.equal(output.reason, "PI_RELEASE_RUNNER_FAILED");
  assert.equal(output.detail, "ERR_MODULE_NOT_FOUND");
  assert.equal(output.exit_code, 1);
  assert.equal(JSON.stringify(output).includes("private"), false);
});

test("Release preflight rejects Pi SDK with missing factory exports", async t => {
  const { root } = await releaseFixture(t);
  const payload = JSON.parse(releaseStatus);
  payload.capabilities.SessionManager = false;
  const output = await inspectPiRelease({ ...releaseOptions(root),
    runProbe: async () => ({ stdout: JSON.stringify(payload) }) });
  assert.equal(output.reason, "PI_RELEASE_RUNNER_UNREADY");
});
