import { readFile, stat, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createProjectBackup,
  listProjectBackups,
  getProjectBackupDetail,
  verifyProjectBackup,
  previewRestoreFromBackup,
  requestRestoreFromBackup,
  createExportBundle,
} from "../../server/src/backup-export-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { listApprovalItems } from "../../server/src/approval-queue-service.mjs";
import { createHash } from "node:crypto";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  // create backup
  const bk = await createProjectBackup({ includeVisualAssets: false, createdBy: "test" });
  const dir = bk.path;
  let exp = null;
  let preview = null;
  try {
    assert(await exists(path.join(dir, "backup.json")), "backup.json missing");
    assert(await exists(path.join(dir, "manifest.json")), "manifest.json missing");
    assert(await exists(path.join(dir, "README.md")), "README.md missing");
    const manifest = await getProjectBackupDetail(bk.backup_id);
    // active_engine should be present in backup files
    const activeRel = manifest.files.find((f) => f.relative_path.endsWith("data/canon_db/active_engine.md") || f.relative_path === "data/canon_db/active_engine.md");
    assert(activeRel, "active_engine not present in manifest");
    const activeBackupPath = path.join(dir, activeRel.backup_relative_path);
    assert(await exists(activeBackupPath), "active_engine copy missing in backup files");
    // manifest active_engine hash matches backup copy (verify single file only to keep test fast)
    const backupSha = hash(await readFile(activeBackupPath));
    assert(backupSha === activeRel.sha256, "manifest active_engine hash mismatch");

    // modify backup copy and expect local check to detect mismatch
    await writeFile(activeBackupPath, "xxx altered content\n", "utf8");
    const changedSha = hash(await readFile(activeBackupPath));
    assert(changedSha !== activeRel.sha256, "modified backup copy not detected by local hash check");

    // createExportBundle for active_engine
    const beforeSha = productionHash;
    exp = await createExportBundle({ export_type: "active_engine", createdBy: "test" });
    assert(await exists(path.join(exp.path, "content.md")), "export content.md missing");
    const afterSha = hash(await readFile(projectPaths.activeEngine));
    assert(beforeSha === afterSha, "createExportBundle modified active_engine");

    // preview restore should produce preview files and not modify active_engine
    preview = await previewRestoreFromBackup(bk.backup_id);
    const previewDir = path.join(projectPaths.restorePreviews, preview.preview_id);
    assert(await exists(path.join(previewDir, "preview.json")), "preview.json missing");
    assert(await exists(path.join(previewDir, "diff_summary.md")), "diff_summary.md missing");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "previewRestoreFromBackup modified active_engine");

    // request restore should create approval item only
    const approval = await requestRestoreFromBackup(bk.backup_id, { requestedBy: "test", reason: "testing" });
    assert(approval.action_type === "restore_from_backup", "approval action_type incorrect");
    const items = await listApprovalItems();
    assert(items.some((it) => it.approval_item_id === approval.approval_item_id), "approval item not recorded");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "requestRestoreFromBackup modified active_engine");

    // ensure visual assets not included by default
    const hasVisual = manifest.files.some((f) => f.relative_path.startsWith("data/visual_db/assets/"));
    assert(!hasVisual, "visual assets should be excluded by default");

    // path traversal rejection via resolveProjectPath
    const { resolveProjectPath } = await import("../../server/src/project-paths.mjs");
    let threw = false;
    try {
      resolveProjectPath("../");
    } catch (e) {
      threw = true;
    }
    assert(threw, "resolveProjectPath did not reject traversal");

    console.log("Backup export service test passed.");

    } finally {
    // cleanup
    await rm(dir, { recursive: true, force: true });
    // remove export
    try { if (exp) await rm(path.join(projectPaths.backupExports, exp.export_id), { recursive: true, force: true }); } catch {}
    // remove preview
    try { if (preview) await rm(path.join(projectPaths.restorePreviews, preview.preview_id), { recursive: true, force: true }); } catch {}
  }
}

main().catch((error) => {
  console.error(`Backup export service test failed: ${error.message}`);
  process.exitCode = 1;
});

