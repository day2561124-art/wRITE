import { mkdir, readdir, stat, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { projectPaths, assertPathInside, projectRoot, normalizeProjectPath, resolveProjectPath } from "./project-paths.mjs";
import { createApprovalItem } from "./approval-queue-service.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function makeId(prefix = "backup") {
  const t = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${prefix}_${t}_${crypto.randomBytes(4).toString("hex")}`;
}

async function computeSha256(filePath) {
  const buf = await readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function walkDirectory(root, options = {}) {
  const entries = [];
  async function walk(dir) {
    const items = await readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) await walk(full);
      else if (it.isFile()) entries.push(full);
    }
  }
  await walk(root);
  return entries;
}

export async function createProjectBackup({ includeVisualAssets = false, createdBy = "system", note = null } = {}) {
  await mkdir(projectPaths.projectBackups, { recursive: true });
  const backupId = makeId("project_backup");
  const dir = path.join(projectPaths.projectBackups, backupId);
  await mkdir(dir, { recursive: true });
  // Define scopes to include and copy files into backup/files/
  const scopes = [
    { root: projectPaths.outputs, category: "outputs" },
    { root: projectPaths.canonDb, category: "canon_db" },
    { root: projectPaths.writingWorkflow, category: "writing_workflow" },
  ];
  if (includeVisualAssets === true) scopes.push({ root: projectPaths.visualDb, category: "visual_db" });

  const manifest = {
    backup_id: backupId,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    note: note || null,
    active_engine_hash: null,
    files: [],
  };

  const filesRoot = path.join(dir, "files");
  await mkdir(filesRoot, { recursive: true });

  function shouldExclude(filePath) {
    const rel = normalizeProjectPath(filePath);
    if (rel.startsWith("node_modules/")) return true;
    if (rel.startsWith(".git/")) return true;
    if (rel.startsWith("data/backups/")) return true;
    if (rel.startsWith("data/visual_db/assets/") && includeVisualAssets !== true) return true;
    if (rel.startsWith("data/visual_db/assets/") && includeVisualAssets === true) return false;
    // exclude common temp dirs
    if (rel.startsWith("tmp/") || rel.startsWith("temp/") || rel.endsWith("~")) return true;
    return false;
  }

  for (const scope of scopes) {
    try {
      const files = await walkDirectory(scope.root);
      for (const f of files) {
        const rel = normalizeProjectPath(f);
        if (shouldExclude(f)) continue;
        // backup relative path under files/
        const backupRelative = path.posix.join("files", rel);
        const dest = path.join(dir, backupRelative);
        await mkdir(path.dirname(dest), { recursive: true });
        await copyFile(f, dest);
        const s = await stat(dest);
        const sha = await computeSha256(dest);
        manifest.files.push({
          relative_path: rel,
          backup_relative_path: backupRelative,
          size_bytes: s.size,
          sha256: sha,
          category: scope.category,
        });
        // record active_engine hash if this is the active engine
        if (rel === normalizeProjectPath(projectPaths.activeEngine)) {
          manifest.active_engine_hash = sha;
        }
      }
    } catch (error) {
      // ignore missing scopes
    }
  }

  // write backup.json, manifest.json, README.md
  const backupJson = { backup_id: backupId, created_at: manifest.created_at, created_by: createdBy, note: manifest.note };
  await writeFile(path.join(dir, "backup.json"), json(backupJson), "utf8");
  await writeFile(path.join(dir, "manifest.json"), json(manifest), "utf8");
  const readme = `Backup: ${backupId}\nCreated: ${manifest.created_at}\nFiles: ${manifest.files.length}\n`;
  await writeFile(path.join(dir, "README.md"), readme, "utf8");
  return { backup_id: backupId, path: dir };
}

export async function listProjectBackups() {
  try {
    const entries = await readdir(projectPaths.projectBackups, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((d) => d.name).sort().reverse();
  } catch (error) {
    return [];
  }
}

export async function getProjectBackupDetail(backupId) {
  const dir = path.join(projectPaths.projectBackups, backupId);
  const manifestPath = path.join(dir, "manifest.json");
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

export async function verifyProjectBackup(backupId) {
  const manifest = await getProjectBackupDetail(backupId);
  const results = [];
  const dir = path.join(projectPaths.projectBackups, backupId);
  for (const file of manifest.files) {
    const backupPath = path.join(dir, file.backup_relative_path);
    try {
      const s = await stat(backupPath);
      const sha = await computeSha256(backupPath);
      results.push({ relative_path: file.relative_path, ok: sha === file.sha256, size_bytes: s.size, expected_sha: file.sha256, actual_sha: sha });
    } catch (error) {
      results.push({ relative_path: file.relative_path, ok: false, error: error.message });
    }
  }
  return { backup_id: backupId, verified_at: new Date().toISOString(), results };
}

export async function previewRestoreFromBackup(backupId) {
  const manifest = await getProjectBackupDetail(backupId);
  const diffs = [];
  const dir = path.join(projectPaths.projectBackups, backupId);
  for (const file of manifest.files) {
    const backupPath = path.join(dir, file.backup_relative_path);
    const currentPath = path.resolve(projectRoot, file.relative_path);
    try {
      const backupSha = await computeSha256(backupPath);
      let currentSha = null;
      try {
        currentSha = await computeSha256(currentPath);
      } catch {
        currentSha = null;
      }
      if (backupSha !== currentSha) diffs.push({ relative_path: file.relative_path, current_sha: currentSha, backup_sha: backupSha });
    } catch (error) {
      diffs.push({ relative_path: file.relative_path, current_sha: null, backup_error: error.message });
    }
  }
  const previewId = makeId("preview");
  const previewDir = path.join(projectPaths.restorePreviews, previewId);
  await mkdir(previewDir, { recursive: true });
  const preview = { preview_id: previewId, backup_id: backupId, created_at: new Date().toISOString(), diffs, count: diffs.length };
  await writeFile(path.join(previewDir, "preview.json"), json(preview), "utf8");
  const md = [`# Restore Preview ${previewId}`, `Backup: ${backupId}`, `Generated: ${preview.created_at}`, ``, `## Diff Summary`, ``];
  for (const d of diffs) {
    md.push(`- ${d.relative_path}: backup_sha=${d.backup_sha || d.backup_error}, current_sha=${d.current_sha}`);
  }
  await writeFile(path.join(previewDir, "diff_summary.md"), md.join("\n"), "utf8");
  return preview;
}

export async function requestRestoreFromBackup(backupId, { requestedBy = "system", reason = "restore request" } = {}) {
  const manifest = await getProjectBackupDetail(backupId);
  const title = `Restore Project Backup ${backupId}`;
  const summary = `Requesting manual approval to restore project backup ${backupId}. Files: ${manifest.files.length}`;
  const item = await createApprovalItem({
    actionType: "restore_from_backup",
    targetType: "project_backup",
    targetId: backupId,
    title,
    summary,
    riskLevel: "high",
    requiresSecondConfirmation: true,
    requiresUserConfirmation: true,
    createdBy: requestedBy,
    reason,
    safety: { direct_restore_allowed: false },
    details: { files_count: manifest.files.length, manifest_path: `${backupId}/manifest.json`, restore_performed: false, active_engine_modified: false },
  });
  return item;
}

export default {
  createProjectBackup,
  listProjectBackups,
  getProjectBackupDetail,
  verifyProjectBackup,
  previewRestoreFromBackup,
  requestRestoreFromBackup,
  createExportBundle,
};

export async function createExportBundle({ export_type = "active_engine", createdBy = "system", note = null } = {}) {
  if (export_type !== "active_engine") throw new Error("Unsupported export_type");
  await mkdir(projectPaths.backupExports, { recursive: true });
  const exportId = makeId("export");
  const dir = path.join(projectPaths.backupExports, exportId);
  await mkdir(dir, { recursive: true });
  const activePath = resolveProjectPath(projectPaths.activeEngine, "active engine");
  const content = await readFile(activePath, "utf8");
  // write content.md
  await writeFile(path.join(dir, "content.md"), content, "utf8");
  const meta = {
    export_id: exportId,
    export_type,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    note: note || null,
    source_active_engine_path: normalizeProjectPath(projectPaths.activeEngine),
  };
  await writeFile(path.join(dir, "metadata.json"), json(meta), "utf8");
  const exportJson = { export_id: exportId, generated_at: meta.created_at, type: export_type };
  await writeFile(path.join(dir, "export.json"), json(exportJson), "utf8");
  return { export_id: exportId, path: dir };
}
