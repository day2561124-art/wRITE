import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import { projectPaths } from "../../server/src/project-paths.mjs";
import { runBackupExportServiceTest } from "./backup-export-service.test.mjs";

async function topLevelInventory(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.map((entry) => `${entry.isDirectory() ? "d" : "f"}:${entry.name}`).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function snapshotProductionState() {
  const [projectBackups, approvalQueue, writingWorkflow, activeEngine, compressedRules] = await Promise.all([
    topLevelInventory(projectPaths.projectBackups),
    topLevelInventory(projectPaths.approvalQueue),
    topLevelInventory(projectPaths.writingWorkflow),
    sha256(projectPaths.activeEngine),
    sha256(projectPaths.compressedRules),
  ]);
  return { projectBackups, approvalQueue, writingWorkflow, activeEngine, compressedRules };
}

const before = await snapshotProductionState();
await runBackupExportServiceTest();
const after = await snapshotProductionState();

assert.deepEqual(after.projectBackups, before.projectBackups, "backup test changed production project_backups inventory");
assert.deepEqual(after.approvalQueue, before.approvalQueue, "backup test changed production approval_queue inventory");
assert.deepEqual(after.writingWorkflow, before.writingWorkflow, "backup test changed production writing_workflow inventory");
assert.equal(after.activeEngine, before.activeEngine, "backup test changed production active_engine");
assert.equal(after.compressedRules, before.compressedRules, "backup test changed production compressed_rules");

console.log("Backup export production residue regression test passed.");
