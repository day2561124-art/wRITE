import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, readFile, writeFile, copyFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { projectPaths, assertPathInside, projectRoot, normalizeProjectPath, resolveProjectPath } from "./project-paths.mjs";
import { createApprovalItem } from "./approval-queue-service.mjs";

export const DEFAULT_BACKUP_IO_CONCURRENCY = 4;
const transientRenameErrors = new Set(["EACCES", "EBUSY", "EPERM"]);

async function renameWithRetry(source, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      if (!transientRenameErrors.has(error.code) || attempt >= 7) throw error;
      await delay(10 * (attempt + 1));
    }
  }
}

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
    items.sort((left, right) => left.name.localeCompare(right.name));
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) await walk(full);
      else if (it.isFile()) entries.push(full);
    }
  }
  await walk(root);
  return entries;
}

async function mapWithBoundedConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let active = 0;
  let maxActive = 0;
  let firstError = null;

  async function worker() {
    while (firstError === null) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        results[index] = await operation(items[index], index);
      } catch (error) {
        if (firstError === null) firstError = error;
      } finally {
        active -= 1;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  if (firstError !== null) throw firstError;
  return { results, maxActive };
}

async function copyAndHashFile(sourcePath, destinationPath) {
  const hash = crypto.createHash("sha256");
  let sizeBytes = 0;
  await pipeline(
    createReadStream(sourcePath),
    async function* hashExactBytes(chunks) {
      for await (const chunk of chunks) {
        hash.update(chunk);
        sizeBytes += chunk.length;
        yield chunk;
      }
    },
    createWriteStream(destinationPath, { flags: "wx" }),
  );
  return {
    size_bytes: sizeBytes,
    sha256: hash.digest("hex"),
  };
}

function validateConcurrency(value) {
  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new Error("ioConcurrency must be an integer between 1 and 16.");
  }
  return value;
}

function isPathInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveBackupDirectory(backupId, destinationRoot = projectPaths.projectBackups) {
  if (!/^project_backup_\d{14}_[0-9a-f]{8}$/u.test(String(backupId))) {
    throw new Error("Invalid project backup ID.");
  }
  const root = resolveProjectPath(destinationRoot, "backup destination root");
  return assertPathInside(path.join(root, backupId), root, "project backup directory");
}

export async function createProjectBackup({
  includeVisualAssets = false,
  createdBy = "system",
  note = null,
  sourceScopes = null,
  destinationRoot = projectPaths.projectBackups,
  activeEnginePath = projectPaths.activeEngine,
  ioConcurrency = DEFAULT_BACKUP_IO_CONCURRENCY,
  onEvent = null,
} = {}) {
  const startedAt = performance.now();
  const concurrency = validateConcurrency(ioConcurrency);
  const resolvedDestinationRoot = resolveProjectPath(destinationRoot, "backup destination root");
  const resolvedActiveEnginePath = resolveProjectPath(activeEnginePath, "active engine");
  await mkdir(resolvedDestinationRoot, { recursive: true });
  const backupId = makeId("project_backup");
  const dir = path.join(resolvedDestinationRoot, backupId);
  const stagingDir = path.join(resolvedDestinationRoot, `.${backupId}.staging`);
  // Define scopes to include and copy files into backup/files/
  const defaultScopes = [
    { root: projectPaths.outputs, category: "outputs" },
    { root: projectPaths.canonDb, category: "canon_db" },
    { root: projectPaths.writingWorkflow, category: "writing_workflow" },
  ];
  if (includeVisualAssets === true) defaultScopes.push({ root: projectPaths.visualDb, category: "visual_db" });
  const scopes = (sourceScopes ?? defaultScopes).map((scope, index) => {
    if (!scope || typeof scope.category !== "string" || !scope.category.trim()) {
      throw new Error(`Backup source scope ${index} requires a category.`);
    }
    const root = resolveProjectPath(scope.root, `backup source scope ${scope.category}`);
    if (isPathInside(root, resolvedDestinationRoot)) {
      throw new Error(`Backup destination cannot be inside source scope ${scope.category}.`);
    }
    return { root, category: scope.category };
  });

  const diagnostics = {
    io_concurrency_bound: concurrency,
    max_concurrent_file_operations: 0,
    source_traversal_passes: 0,
    files_discovered: 0,
    files_exported: 0,
    source_content_streams: 0,
    destination_hash_reads: 0,
    stage_ms: {
      traversal: 0,
      directory_creation: 0,
      copy_and_hash: 0,
      manifest_write: 0,
      finalization: 0,
      total: 0,
    },
  };

  async function emit(event) {
    if (typeof onEvent === "function") await onEvent(event);
  }

  const manifest = {
    backup_id: backupId,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    note: note || null,
    active_engine_hash: null,
    files: [],
  };

  const filesRoot = path.join(stagingDir, "files");

  function shouldExclude(rel) {
    if (rel.startsWith("node_modules/")) return true;
    if (rel.startsWith(".git/")) return true;
    if (rel.startsWith("data/backups/")) return true;
    if (rel.startsWith("data/visual_db/assets/") && includeVisualAssets !== true) return true;
    if (rel.startsWith("data/visual_db/assets/") && includeVisualAssets === true) return false;
    // exclude common temp dirs
    if (rel.startsWith("tmp/") || rel.startsWith("temp/") || rel.endsWith("~")) return true;
    return false;
  }

  try {
    await mkdir(filesRoot, { recursive: true });
    const filePlans = [];
    const traversalStartedAt = performance.now();
    for (const scope of scopes) {
      await emit({ type: "scope-traversal-start", category: scope.category, root: scope.root });
      const files = await walkDirectory(scope.root);
      diagnostics.source_traversal_passes += 1;
      for (const f of files) {
        const rel = normalizeProjectPath(f);
        if (shouldExclude(rel)) continue;
        const backupRelative = path.posix.join("files", rel);
        filePlans.push({
          sourcePath: f,
          destinationPath: path.join(stagingDir, backupRelative),
          relativePath: rel,
          backupRelativePath: backupRelative,
          category: scope.category,
        });
      }
      await emit({ type: "scope-traversal-complete", category: scope.category, files: files.length });
    }
    diagnostics.stage_ms.traversal = performance.now() - traversalStartedAt;
    diagnostics.files_discovered = filePlans.length;

    const directoryStartedAt = performance.now();
    const destinationDirectories = [...new Set(filePlans.map((plan) => path.dirname(plan.destinationPath)))].sort();
    const directoryResult = await mapWithBoundedConcurrency(
      destinationDirectories,
      concurrency,
      (directoryPath) => mkdir(directoryPath, { recursive: true }),
    );
    diagnostics.max_concurrent_file_operations = Math.max(
      diagnostics.max_concurrent_file_operations,
      directoryResult.maxActive,
    );
    diagnostics.stage_ms.directory_creation = performance.now() - directoryStartedAt;

    const copyStartedAt = performance.now();
    const copyResult = await mapWithBoundedConcurrency(filePlans, concurrency, async (plan, index) => {
      await emit({
        type: "file-copy-start",
        index,
        source_path: plan.sourcePath,
        relative_path: plan.relativePath,
      });
      let integrity;
      try {
        integrity = await copyAndHashFile(plan.sourcePath, plan.destinationPath);
      } catch (error) {
        throw new Error(`Failed to export ${plan.relativePath}: ${error.message}`, { cause: error });
      }
      diagnostics.source_content_streams += 1;
      await emit({
        type: "file-copy-complete",
        index,
        relative_path: plan.relativePath,
        size_bytes: integrity.size_bytes,
        sha256: integrity.sha256,
      });
      return {
        relative_path: plan.relativePath,
        backup_relative_path: plan.backupRelativePath,
        size_bytes: integrity.size_bytes,
        sha256: integrity.sha256,
        category: plan.category,
      };
    });
    diagnostics.max_concurrent_file_operations = Math.max(
      diagnostics.max_concurrent_file_operations,
      copyResult.maxActive,
    );
    diagnostics.stage_ms.copy_and_hash = performance.now() - copyStartedAt;
    manifest.files = copyResult.results;
    diagnostics.files_exported = manifest.files.length;
    const activeEngineRelativePath = normalizeProjectPath(resolvedActiveEnginePath);
    manifest.active_engine_hash = manifest.files.find(
      (file) => file.relative_path === activeEngineRelativePath,
    )?.sha256 ?? null;

    const manifestStartedAt = performance.now();
    const backupJson = { backup_id: backupId, created_at: manifest.created_at, created_by: createdBy, note: manifest.note };
    await writeFile(path.join(stagingDir, "backup.json"), json(backupJson), "utf8");
    await writeFile(path.join(stagingDir, "manifest.json"), json(manifest), "utf8");
    const readme = `Backup: ${backupId}\nCreated: ${manifest.created_at}\nFiles: ${manifest.files.length}\n`;
    await writeFile(path.join(stagingDir, "README.md"), readme, "utf8");
    diagnostics.stage_ms.manifest_write = performance.now() - manifestStartedAt;

    const finalizationStartedAt = performance.now();
    await renameWithRetry(stagingDir, dir);
    diagnostics.stage_ms.finalization = performance.now() - finalizationStartedAt;
    diagnostics.stage_ms.total = performance.now() - startedAt;
    return { backup_id: backupId, path: dir, diagnostics };
  } catch (error) {
    try {
      await rm(stagingDir, { recursive: true, force: true });
    } catch (cleanupError) {
      error.cleanup_error = cleanupError.message;
    }
    throw error;
  }
}

export async function listProjectBackups({ destinationRoot = projectPaths.projectBackups } = {}) {
  const resolvedDestinationRoot = resolveProjectPath(destinationRoot, "backup destination root");
  try {
    const entries = await readdir(resolvedDestinationRoot, { withFileTypes: true });
    const completed = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("project_backup_")) continue;
      const directory = path.join(resolvedDestinationRoot, entry.name);
      try {
        await stat(path.join(directory, "backup.json"));
        await stat(path.join(directory, "manifest.json"));
        completed.push(entry.name);
      } catch {
        // Incomplete historical or interrupted artifacts are not completed backups.
      }
    }
    return completed.sort().reverse();
  } catch (error) {
    return [];
  }
}

export async function getProjectBackupDetail(
  backupId,
  { destinationRoot = projectPaths.projectBackups } = {},
) {
  const dir = resolveBackupDirectory(backupId, destinationRoot);
  const manifestPath = path.join(dir, "manifest.json");
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

export async function verifyProjectBackup(
  backupId,
  { destinationRoot = projectPaths.projectBackups } = {},
) {
  const manifest = await getProjectBackupDetail(backupId, { destinationRoot });
  const results = [];
  const dir = resolveBackupDirectory(backupId, destinationRoot);
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

export async function previewRestoreFromBackup(
  backupId,
  {
    destinationRoot = projectPaths.projectBackups,
    previewRoot = projectPaths.restorePreviews,
  } = {},
) {
  const manifest = await getProjectBackupDetail(backupId, { destinationRoot });
  const diffs = [];
  const dir = resolveBackupDirectory(backupId, destinationRoot);
  const resolvedPreviewRoot = resolveProjectPath(previewRoot, "restore preview root");
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
  const previewDir = path.join(resolvedPreviewRoot, previewId);
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

export async function requestRestoreFromBackup(
  backupId,
  { requestedBy = "system", reason = "restore request" } = {},
  {
    destinationRoot = projectPaths.projectBackups,
    approvalItemCreator = createApprovalItem,
  } = {},
) {
  if (typeof approvalItemCreator !== "function") {
    throw new Error("approvalItemCreator must be a function.");
  }
  const manifest = await getProjectBackupDetail(backupId, { destinationRoot });
  const title = `Restore Project Backup ${backupId}`;
  const summary = `Requesting manual approval to restore project backup ${backupId}. Files: ${manifest.files.length}`;
  const item = await approvalItemCreator({
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

export async function createExportBundle({
  export_type = "active_engine",
  createdBy = "system",
  note = null,
  destinationRoot = projectPaths.backupExports,
  activeEnginePath = projectPaths.activeEngine,
} = {}) {
  if (!["active_engine", "review_package"].includes(export_type)) {
    throw new Error("Unsupported export_type");
  }
  const resolvedDestinationRoot = resolveProjectPath(destinationRoot, "backup export destination root");
  const activePath = resolveProjectPath(activeEnginePath, "active engine");
  await mkdir(resolvedDestinationRoot, { recursive: true });
  const exportId = makeId("export");
  const dir = path.join(resolvedDestinationRoot, exportId);
  await mkdir(dir, { recursive: true });
  if (export_type === "active_engine") {
    const content = await readFile(activePath, "utf8");
    await writeFile(path.join(dir, "content.md"), content, "utf8");
  } else {
    const requiredFiles = [
      ".gitignore",
      "README.md",
      "SKILL.md",
      "package.json",
      "package-lock.json",
      "launcher.cmd",
      "launcher.ps1",
      ".github/workflows/ci.yml",
      "data/memory_store/canon_memory.json",
      "data/memory_store/preference_memory.json",
      "data/memory_store/working_memory.json",
      "data/outputs/current_prompt.md",
      "data/outputs/generation_context.md",
      "data/outputs/retrieval_context.md",
      "data/outputs/task_prompt.md",
      "prompts/generate_chapter.md",
      "prompts/proofread_draft.md",
      "prompts/settle_chapter.md",
      "prompts/compress_errors.md",
      "prompts/rewrite_by_errors.md",
      "data/visual_db/index.jsonl",
    ];
    const markdownPlaceholder =
      "# Placeholder\n\nStatus: not yet generated. This file contains no canon data.\n";
    const jsonPlaceholder =
      `${JSON.stringify({ status: "empty", placeholder: true, generated: false }, null, 2)}\n`;
    for (const relativePath of requiredFiles) {
      const sourcePath = path.join(projectRoot, relativePath);
      const destinationPath = path.join(dir, relativePath);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      try {
        await copyFile(sourcePath, destinationPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await writeFile(
          destinationPath,
          relativePath.endsWith(".json") || relativePath.endsWith(".jsonl")
            ? jsonPlaceholder
            : markdownPlaceholder,
          "utf8",
        );
      }
    }
    const visualAssetsDestination = path.join(dir, "data", "visual_db", "assets");
    await mkdir(visualAssetsDestination, { recursive: true });
    try {
      for (const filePath of await walkDirectory(projectPaths.visualAssets)) {
        const relativePath = path.relative(projectPaths.visualAssets, filePath);
        const destinationPath = path.join(visualAssetsDestination, relativePath);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(filePath, destinationPath);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const meta = {
    export_id: exportId,
    export_type,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    note: note || null,
    source_active_engine_path: normalizeProjectPath(activePath),
    package_root: export_type === "review_package" ? "." : null,
  };
  await writeFile(path.join(dir, "metadata.json"), json(meta), "utf8");
  const exportJson = { export_id: exportId, generated_at: meta.created_at, type: export_type };
  await writeFile(path.join(dir, "export.json"), json(exportJson), "utf8");
  return { export_id: exportId, path: dir };
}
