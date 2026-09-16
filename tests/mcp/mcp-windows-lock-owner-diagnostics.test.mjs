import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  findWindowsPathLockOwners,
} from "../../server/src/mcp-windows-lock-owner-diagnostics.mjs";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

function waitForSpawn(child) {
  return new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
}

test("non-Windows lock-owner diagnostics fail soft as unsupported", async () => {
  const result = await findWindowsPathLockOwners(rootDir, { platform: "linux" });
  assert.equal(result.supported, false);
  assert.equal(result.platform, "linux");
  assert.equal(result.owner_count, 0);
  assert.deepEqual(result.owners, []);
  assert.equal(result.scan, null);
});

test("Windows live lock-owner diagnostics find a child whose cwd is the target directory", {
  skip: process.platform !== "win32",
  timeout: 60_000,
}, async () => {
  const target = path.join(
    rootDir,
    "tests",
    ".tmp",
    `lock-owner-live-${process.pid}-${Date.now()}`,
  );
  await mkdir(target, { recursive: true });
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
    cwd: target,
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    await waitForSpawn(child);
    const result = await findWindowsPathLockOwners(target);
    assert.equal(result.supported, true);
    assert.equal(result.platform, "win32");
    assert(result.scan);
    assert(result.scan.system_handle_count > 0);
    assert(result.scan.scanned_handle_count > 0);
    const owner = result.owners.find((item) => item.pid === child.pid);
    assert(owner, `expected PID ${child.pid} among lock owners: ${JSON.stringify(result.owners)}`);
    assert.equal(owner.matches_workspace_root, true);
    assert.equal(owner.matched_relative_path, ".");
  } finally {
    terminateProcessTree(child);
    await new Promise((resolve) => child.once("close", resolve));
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
