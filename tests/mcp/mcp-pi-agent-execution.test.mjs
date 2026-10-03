import assert from "node:assert/strict";
import test from "node:test";
import {
  PI_PACKAGE_NAME,
  PI_REQUIRED_NODE_VERSION,
  getPiRuntimeStatus,
  isPiNodeVersionCompatible,
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
        package_version: "1.0.0",
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
  assert.equal(status.probe.package_version, "1.0.0");
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
