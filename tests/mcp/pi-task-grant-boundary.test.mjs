import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_DEFINITIONS } from "../../server/src/pi-execution-contract.mjs";
import { createPiTaskPolicy, requiresPiTaskGrant } from "../../server/src/pi-task-authorization.mjs";

test("baseline: existing task-grant layer retains its exact effect boundary", async () => {
  // This snapshot records the current grant layer, not a permission allowlist.
  const gated = new Set([
    "filesystem.write", "filesystem.patch", "workspace.create_checkpoint",
    "verification.focused", "verification.affected", "host.powershell",
    "workspace.powershell", "workspace.powershell_isolated", "git.commit",
    "windows.service.ensure_running", "windows.powershell.run_approved",
  ]);
  const policy = createPiTaskPolicy({ required: true, store: {
    authorize: () => assert.fail("A missing grant cannot be resolved by the store"),
  } });
  for (const { capability } of CAPABILITY_DEFINITIONS) {
    assert.equal(requiresPiTaskGrant(capability), gated.has(capability), capability);
    const result = policy({ requested_actions: [{ capability }] });
    if (gated.has(capability)) {
      await assert.rejects(result, { code: "PERMISSION_DENIED" }, capability);
    } else {
      // Passing only this layer does not grant execution permission.
      await result;
    }
  }
});

test("an explicit grant is validated even when the task-grant mode is not required", async () => {
  let calls = 0;
  const store = { authorize: async () => {
    calls++;
    throw Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
  } };
  for (const required of [true, false]) {
    const policy = createPiTaskPolicy({ store, required });
    await assert.rejects(policy({
      task_authorization_id: "invalid-fixture-grant",
      requested_actions: [{ capability: "filesystem.read" }],
    }), { code: "PERMISSION_DENIED" });
  }
  assert.equal(calls, 2);
});

test("a mixed intent is denied as a whole when any step requires a grant", async () => {
  const policy = createPiTaskPolicy({ required: true });
  const requested_actions = [
    { capability: "filesystem.read" },
    { capability: "windows.service.ensure_running" },
  ];
  await assert.rejects(policy({ requested_actions }), { code: "PERMISSION_DENIED" });
});
