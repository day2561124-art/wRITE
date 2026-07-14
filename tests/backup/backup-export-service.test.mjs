import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createProjectBackup,
  listProjectBackups,
  getProjectBackupDetail,
  verifyProjectBackup,
  previewRestoreFromBackup,
  requestRestoreFromBackup,
  createExportBundle,
} from "../../server/src/backup-export-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function runBackupExportServiceTest() {
  const fixtureRoot = path.join(
    projectRoot,
    "tests",
    ".tmp",
    `backup-export-service-${process.pid}-${Date.now()}`,
  );
  const outputsRoot = path.join(fixtureRoot, "source", "data", "outputs");
  const canonRoot = path.join(fixtureRoot, "source", "data", "canon_db");
  const workflowRoot = path.join(fixtureRoot, "source", "data", "writing_workflow");
  const activeEnginePath = path.join(canonRoot, "active_engine.md");
  const backupRoot = path.join(fixtureRoot, "state", "project_backups");
  const previewRoot = path.join(fixtureRoot, "state", "restore_previews");
  const exportRoot = path.join(fixtureRoot, "state", "exports");
  const approvalRoot = path.join(fixtureRoot, "state", "approval_queue");
  const isolatedApprovalItems = [];
  const productionHash = hash(await readFile(projectPaths.activeEngine));

  await rm(fixtureRoot, { recursive: true, force: true });
  try {
    await Promise.all([
      mkdir(outputsRoot, { recursive: true }),
      mkdir(canonRoot, { recursive: true }),
      mkdir(workflowRoot, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(outputsRoot, "current_prompt.md"), "# Fixture prompt\n", "utf8"),
      writeFile(activeEnginePath, "# Isolated active engine fixture\n", "utf8"),
      writeFile(path.join(workflowRoot, "workflow.json"), "{\"fixture\":true}\n", "utf8"),
    ]);

    const sourceScopes = [
      { root: outputsRoot, category: "outputs" },
      { root: canonRoot, category: "canon_db" },
      { root: workflowRoot, category: "writing_workflow" },
    ];
    const bk = await createProjectBackup({
      includeVisualAssets: false,
      createdBy: "test",
      sourceScopes,
      destinationRoot: backupRoot,
      activeEnginePath,
    });
    const dir = bk.path;

    assert(await exists(path.join(dir, "backup.json")), "backup.json missing");
    assert(await exists(path.join(dir, "manifest.json")), "manifest.json missing");
    assert(await exists(path.join(dir, "README.md")), "README.md missing");
    assert((await listProjectBackups({ destinationRoot: backupRoot })).includes(bk.backup_id), "backup not listed");

    const manifest = await getProjectBackupDetail(bk.backup_id, { destinationRoot: backupRoot });
    const activeRel = manifest.files.find(
      (file) => file.relative_path === path.relative(projectRoot, activeEnginePath).replaceAll(path.sep, "/"),
    );
    assert(activeRel, "isolated active_engine fixture not present in manifest");
    const activeBackupPath = path.join(dir, activeRel.backup_relative_path);
    const backupSha = hash(await readFile(activeBackupPath));
    assert(backupSha === activeRel.sha256, "manifest active_engine hash mismatch");
    assert(manifest.active_engine_hash === activeRel.sha256, "manifest active_engine_hash missing");
    const verified = await verifyProjectBackup(bk.backup_id, { destinationRoot: backupRoot });
    assert(verified.results.every((result) => result.ok), "isolated backup verification failed");

    await writeFile(activeBackupPath, "xxx altered isolated backup content\n", "utf8");
    const changed = await verifyProjectBackup(bk.backup_id, { destinationRoot: backupRoot });
    assert(changed.results.some((result) => result.relative_path === activeRel.relative_path && !result.ok), "integrity mismatch not detected");

    const exp = await createExportBundle({
      export_type: "active_engine",
      createdBy: "test",
      destinationRoot: exportRoot,
      activeEnginePath,
    });
    assert(await exists(path.join(exp.path, "content.md")), "export content.md missing");
    assert(hash(await readFile(path.join(exp.path, "content.md"))) === hash(await readFile(activeEnginePath)), "export used the wrong active_engine");

    const preview = await previewRestoreFromBackup(bk.backup_id, {
      destinationRoot: backupRoot,
      previewRoot,
    });
    const previewDir = path.join(previewRoot, preview.preview_id);
    assert(await exists(path.join(previewDir, "preview.json")), "preview.json missing");
    assert(await exists(path.join(previewDir, "diff_summary.md")), "diff_summary.md missing");

    const approvalItemCreator = async (input) => {
      const item = {
        approval_item_id: `isolated_approval_${process.pid}_${Date.now()}`,
        action_type: input.actionType,
        target_type: input.targetType,
        target_id: input.targetId,
        created_by: input.createdBy,
      };
      const itemDir = path.join(approvalRoot, "items", item.approval_item_id);
      await mkdir(itemDir, { recursive: true });
      await writeFile(path.join(itemDir, "item.json"), `${JSON.stringify(item, null, 2)}\n`, "utf8");
      isolatedApprovalItems.push(item);
      return item;
    };
    const approval = await requestRestoreFromBackup(
      bk.backup_id,
      { requestedBy: "test", reason: "testing isolated restore request" },
      { destinationRoot: backupRoot, approvalItemCreator },
    );
    assert(approval.action_type === "restore_from_backup", "approval action_type incorrect");
    assert(isolatedApprovalItems.some((item) => item.approval_item_id === approval.approval_item_id), "isolated approval item not recorded");
    assert(await exists(path.join(approvalRoot, "items", approval.approval_item_id, "item.json")), "isolated approval item file missing");

    const hasVisual = manifest.files.some((file) => file.relative_path.includes("data/visual_db/assets/"));
    assert(!hasVisual, "visual assets should be excluded by default");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "test modified production active_engine");

    const { resolveProjectPath } = await import("../../server/src/project-paths.mjs");
    let threw = false;
    try {
      resolveProjectPath("../");
    } catch {
      threw = true;
    }
    assert(threw, "resolveProjectPath did not reject traversal");

    console.log("Backup export service test passed.");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  runBackupExportServiceTest().catch((error) => {
    console.error(`Backup export service test failed: ${error.message}`);
    process.exitCode = 1;
  });
}
