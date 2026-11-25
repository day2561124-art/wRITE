import { randomUUID } from "node:crypto";
import { link, lstat, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { hashExecutionInput } from "./pi-execution-contract.mjs";
import { loadPiEngineeringApprovalBindings, validatePiEngineeringBindingSnapshot } from "./pi-engineering-approval-source.mjs";

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

async function protectedDirectory(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail("INVALID_BINDING_ROOT");
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) fail("INVALID_BINDING_ROOT");
  return realpath(root);
}

async function currentManifest(dir) {
  const file = path.join(dir, "engineering-bindings.json");
  try { await lstat(file); }
  catch (error) {
    if (error.code === "ENOENT") return { sha256: null, count: 0 };
    throw error;
  }
  const bindings = validatePiEngineeringBindingSnapshot(await loadPiEngineeringApprovalBindings(dir));
  return { sha256: hashExecutionInput(bindings), count: bindings.length };
}

// Operator-side publication only. This module does not issue or extend
// grants and is not exposed by MCP. The existing protected directory ACL
// remains the independent authority controlling who may publish records.
export function createPiEngineeringBindingPublisher({ root, resolveWorkspace, authorizeTask } = {}) {
  if (typeof resolveWorkspace !== "function" || typeof authorizeTask !== "function") fail("INVALID_HOST_DEPENDENCIES");

  async function inspect() {
    return currentManifest(await protectedDirectory(root));
  }

  async function publish({ expected_current_sha256, bindings } = {}) {
    if (expected_current_sha256 !== null
      && (typeof expected_current_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expected_current_sha256))) fail("INVALID_EXPECTED_BINDING_DIGEST");
    const snapshot = validatePiEngineeringBindingSnapshot(bindings);
    const encoded = JSON.stringify(snapshot) + "\n";
    if (Buffer.byteLength(encoded, "utf8") > 256 * 1024) fail("BINDING_MANIFEST_TOO_LARGE");
    const dir = await protectedDirectory(root);
    const target = path.join(dir, "engineering-bindings.json");
    const lock = path.join(dir, ".engineering-bindings.publish.lock");
    const lockHandle = await open(lock, "wx", 0o600);
    const temporary = path.join(dir, "." + randomUUID() + ".engineering-bindings.tmp");
    let ownsTemporary = false;
    try {
      if ((await currentManifest(dir)).sha256 !== expected_current_sha256) fail("BINDING_MANIFEST_CHANGED");
      for (const binding of snapshot) {
        const context = await resolveWorkspace({ workspace_id: binding.workspace_id }, { mutation: true });
        if (context?.workspace_id !== binding.workspace_id || context.workstream_id !== binding.workstream_id
          || context.workspace_type !== "isolated_worktree" || context.lifecycle_state !== "active"
          || context.workstream_state !== "active" || context.healthy !== true
          || context.mutation_allowed !== true) fail("BINDING_WORKSPACE_UNAVAILABLE");
        // Validate the existing record's identity, goal, validity and
        // revocation state. Empty actions check metadata only; no operation
        // is authorized here. Actual capability checks remain at dispatch.
        await authorizeTask({
          task_authorization_id: binding.task_authorization_id,
          context: { project_id: "writer_workbench", workspace_id: binding.workspace_id,
            workstream_id: binding.workstream_id },
          goal: binding.goal,
          requested_actions: [],
        });
      }
      const handle = await open(temporary, "wx", 0o600);
      ownsTemporary = true;
      try {
        await handle.writeFile(encoded, "utf8");
        await handle.sync();
      } finally { await handle.close(); }
      if ((await currentManifest(dir)).sha256 !== expected_current_sha256) fail("BINDING_MANIFEST_CHANGED");
      if (expected_current_sha256 === null) {
        await link(temporary, target);
      } else {
        await rename(temporary, target);
        ownsTemporary = false;
      }
      return { sha256: hashExecutionInput(snapshot), count: snapshot.length };
    } finally {
      try {
        if (ownsTemporary) await unlink(temporary);
      } finally {
        try { await lockHandle.close(); }
        finally { await unlink(lock); }
      }
    }
  }
  return Object.freeze({ inspect, publish });
}
