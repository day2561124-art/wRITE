import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

const configPath = path.join(
  projectRoot,
  "config",
  "visual-library-rollback-delete-restore.json",
);
const operations = new Set(["rollback-import", "delete", "restore"]);
const falseSafetyFields = [
  "writes_approval_queue",
  "creates_approval_item",
  "creates_canon_visual_lock",
  "updates_active_engine",
  "updates_canon_db",
];

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256Lf(value) {
  return sha256(Buffer.from(normalizeLf(value), "utf8"));
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ""
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
}

function gate(providedText, requiredText) {
  const provided = typeof providedText === "string" ? providedText : "";
  return {
    required_text: requiredText,
    provided_text: provided || null,
    accepted: provided === requiredText,
  };
}

function parseIndex(buffer) {
  const records = [];
  for (const [index, line] of normalizeLf(buffer.toString("utf8"))
    .split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`visual_index line ${index + 1} is invalid: ${error.message}`);
    }
  }
  return records;
}

function serializeIndex(records) {
  return Buffer.from(
    records.length ? `${records.map((item) => JSON.stringify(item)).join("\n")}\n` : "",
    "utf8",
  );
}

async function fileState(filePath) {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile()) return { exists: false, content: null };
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, content: null };
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function resolveRecordAssetPath(recordPath, assetsRoot) {
  const normalized = String(recordPath ?? "").replaceAll("\\", "/");
  const prefix = "data/visual_db/assets/";
  if (!normalized.startsWith(prefix) || normalized.includes("/../")) return null;
  const target = path.resolve(assetsRoot, normalized.slice(prefix.length));
  return isInside(assetsRoot, target) ? target : null;
}

async function loadManifest(options, missingDecision) {
  if (options.manifest && typeof options.manifest === "object") {
    return { manifest: structuredClone(options.manifest), manifest_path: null };
  }
  const value = options.manifestPath ?? options.manifest_path;
  if (!value) return { manifest: null, manifest_path: null, decision: missingDecision };
  const resolved = resolveProjectPath(value, "visual operation manifest");
  try {
    return {
      manifest: JSON.parse(await readFile(resolved, "utf8")),
      manifest_path: normalizeProjectPath(resolved),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { manifest: null, manifest_path: normalizeProjectPath(resolved), decision: missingDecision };
    }
    throw error;
  }
}

async function writeManifestIfRequested(manifestPath, manifest) {
  if (!manifestPath) return;
  const resolved = resolveProjectPath(manifestPath, "operation manifest output");
  await applyVisualIndexAtomicUpdate({
    visual_index_path: resolved,
    content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  });
}

export function validateVisualLibraryRollbackDeleteRestoreConfig(config) {
  requireObject(config, "visual rollback/delete/restore config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19B") throw new Error("phase must be 19B.");
  if (config.mode !== "visual_library_rollback_delete_restore_safety_core") {
    throw new Error(
      "mode must be visual_library_rollback_delete_restore_safety_core.",
    );
  }
  for (const field of [
    "confirmed_import_config_path",
    "visual_assets_root",
    "visual_index_path",
    "visual_trash_root",
    "visual_restore_root",
    "active_engine_path",
    "required_rollback_confirmation_text",
    "required_delete_confirmation_text",
    "required_restore_confirmation_text",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  for (const field of [
    "requires_execute_flag",
    "requires_exact_confirmation",
    "must_write_visual_index_atomically",
    "must_validate_after_write",
    "must_create_operation_manifest",
    "writes_visual_index",
    "writes_visual_assets",
    "copies_files",
    "moves_files",
    "deletes_files",
  ]) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of falseSafetyFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryRollbackDeleteRestoreConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryRollbackDeleteRestoreConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "visual rollback config")
    : configPath;
  const config = JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryRollbackDeleteRestoreConfig(config),
    config_path: normalizeProjectPath(resolved),
  };
}

export function validateVisualRollbackPreconditions(plan) {
  const checks = [
    ["manifest_valid", "blocked_missing_rollback_manifest"],
    ["index_state_matches", "blocked_visual_index_state_mismatch"],
    ["records_found", "blocked_visual_id_not_found"],
    ["paths_safe", "blocked_unsafe_target_path"],
    ["assets_exist", "blocked_missing_visual_asset"],
    ["assets_hash_match", "blocked_asset_hash_mismatch"],
  ];
  const failed = checks.filter(([key]) => plan.preconditions?.[key] !== true);
  return { valid: failed.length === 0, failed };
}

export function validateVisualDeletePreconditions(plan) {
  const checks = [
    ["record_found", "blocked_visual_id_not_found"],
    ["target_safe", "blocked_unsafe_target_path"],
    ["asset_exists", "blocked_missing_visual_asset"],
    ["asset_hash_matches", "blocked_asset_hash_mismatch"],
    ["trash_not_occupied", "blocked_trash_target_occupied"],
    ["index_state_matches", "blocked_visual_index_state_mismatch"],
  ];
  const failed = checks.filter(([key]) => plan.preconditions?.[key] !== true);
  return { valid: failed.length === 0, failed };
}

export function validateVisualRestorePreconditions(plan) {
  const checks = [
    ["manifest_valid", "blocked_missing_restore_manifest"],
    ["record_absent", "blocked_visual_index_state_mismatch"],
    ["target_safe", "blocked_unsafe_target_path"],
    ["source_exists", "blocked_missing_visual_asset"],
    ["source_hash_matches", "blocked_asset_hash_mismatch"],
    ["target_not_occupied", "blocked_restore_target_occupied"],
    ["index_state_matches", "blocked_visual_index_state_mismatch"],
  ];
  const failed = checks.filter(([key]) => plan.preconditions?.[key] !== true);
  return { valid: failed.length === 0, failed };
}

export async function buildVisualImportRollbackPlan(input) {
  const manifest = requireObject(input.manifest, "Phase 19A rollback manifest");
  const indexBefore = await readFile(input.visual_index_path);
  const records = parseIndex(indexBefore);
  const ids = Array.isArray(manifest.index_records_added)
    ? manifest.index_records_added
    : [];
  const assetPaths = [];
  let pathsSafe = true;
  for (const value of manifest.copied_assets ?? []) {
    let resolved;
    try {
      resolved = resolveProjectPath(value, "rollback copied asset");
    } catch {
      pathsSafe = false;
      continue;
    }
    if (!isInside(input.assets_root, resolved)) pathsSafe = false;
    assetPaths.push(resolved);
  }
  const assetStates = await Promise.all(assetPaths.map(fileState));
  const remaining = records.filter((record) => !ids.includes(record.visual_id));
  const removed = records.filter((record) => ids.includes(record.visual_id));
  const nextIndex = serializeIndex(remaining);
  const plan = {
    manifest,
    index_before: indexBefore,
    index_after: nextIndex,
    removed_records: removed,
    asset_paths: assetPaths,
    preconditions: {
      manifest_valid:
        typeof manifest.visual_index_before_hash === "string"
        && typeof manifest.visual_index_after_hash === "string"
        && ids.length > 0
        && assetPaths.length > 0,
      index_state_matches:
        sha256(indexBefore) === manifest.visual_index_after_hash,
      records_found: removed.length === ids.length,
      assets_exist: assetStates.every((state) => state.exists),
      assets_hash_match: assetStates.every((state, index) => {
        const record = removed.find((item) => (
          resolveRecordAssetPath(item.path, input.assets_root) === assetPaths[index]
        ));
        return state.exists && (!record || sha256(state.content).length === 64);
      }),
      paths_safe: pathsSafe,
    },
  };
  const validation = validateVisualRollbackPreconditions(plan);
  plan.decision = validation.valid
    ? "visual_import_rollback_ready"
    : validation.failed[0][1];
  return plan;
}

export async function buildVisualDeletePlan(input) {
  const indexBefore = await readFile(input.visual_index_path);
  const records = parseIndex(indexBefore);
  const matches = records.filter((item) => item.visual_id === input.visual_id);
  const record = matches.length === 1 ? matches[0] : null;
  const assetPath = record
    ? resolveRecordAssetPath(record.path, input.assets_root)
    : null;
  const asset = assetPath
    ? await fileState(assetPath)
    : { exists: false, content: null };
  const trashPath = assetPath
    ? path.join(
      input.trash_root,
      input.visual_id,
      path.basename(assetPath),
    )
    : null;
  const expectedHash = input.expected_asset_sha256
    ?? (asset.exists ? sha256(asset.content) : null);
  const nextRecords = records.filter((item) => item.visual_id !== input.visual_id);
  const plan = {
    visual_id: input.visual_id,
    record,
    asset_path: assetPath,
    trash_path: trashPath,
    asset_sha256: asset.exists ? sha256(asset.content) : null,
    index_before: indexBefore,
    index_after: serializeIndex(nextRecords),
    preconditions: {
      record_found: record !== null,
      asset_exists: asset.exists,
      asset_hash_matches: asset.exists && sha256(asset.content) === expectedHash,
      target_safe:
        assetPath !== null
        && trashPath !== null
        && isInside(input.assets_root, assetPath)
        && isInside(input.trash_root, trashPath),
      trash_not_occupied: trashPath ? !(await pathExists(trashPath)) : false,
      index_state_matches:
        !input.expected_visual_index_hash
        || sha256(indexBefore) === input.expected_visual_index_hash,
    },
  };
  const validation = validateVisualDeletePreconditions(plan);
  plan.decision = validation.valid
    ? "visual_delete_ready"
    : validation.failed[0][1];
  return plan;
}

export async function buildVisualRestorePlan(input) {
  const manifest = requireObject(input.manifest, "visual delete manifest");
  const indexBefore = await readFile(input.visual_index_path);
  const records = parseIndex(indexBefore);
  const record = manifest.removed_record;
  const sourcePath = manifest.trash_asset_path
    ? resolveProjectPath(manifest.trash_asset_path, "trash restore source")
    : null;
  const targetPath = record
    ? resolveRecordAssetPath(record.path, input.assets_root)
    : null;
  const source = sourcePath
    ? await fileState(sourcePath)
    : { exists: false, content: null };
  const plan = {
    manifest,
    record,
    source_path: sourcePath,
    target_path: targetPath,
    index_before: indexBefore,
    index_after: serializeIndex([...records, record].filter(Boolean)),
    preconditions: {
      manifest_valid:
        manifest.operation === "delete"
        && manifest.operation_completed === true
        && record?.visual_id === manifest.visual_id,
      record_absent:
        !records.some((item) => item.visual_id === manifest.visual_id),
      source_exists: source.exists,
      source_hash_matches:
        source.exists && sha256(source.content) === manifest.original_asset_sha256,
      target_safe:
        sourcePath !== null
        && targetPath !== null
        && isInside(input.trash_root, sourcePath)
        && isInside(input.assets_root, targetPath),
      target_not_occupied: targetPath ? !(await pathExists(targetPath)) : false,
      index_state_matches:
        !input.expected_visual_index_hash
        || sha256(indexBefore) === input.expected_visual_index_hash,
    },
  };
  const validation = validateVisualRestorePreconditions(plan);
  plan.decision = validation.valid
    ? "visual_restore_ready"
    : validation.failed[0][1];
  return plan;
}

export function createVisualDeleteManifest(input) {
  return {
    delete_manifest_id: `VLDM-${randomUUID().toUpperCase()}`,
    created_at: new Date().toISOString(),
    operation: "delete",
    visual_id: input.plan.visual_id,
    visual_index_before_hash: sha256(input.plan.index_before),
    visual_index_after_hash: sha256(input.plan.index_after),
    removed_record: input.plan.record,
    original_asset_path: normalizeProjectPath(input.plan.asset_path),
    original_asset_sha256: input.plan.asset_sha256,
    trash_asset_path: normalizeProjectPath(input.plan.trash_path),
    trash_asset_sha256: input.plan.asset_sha256,
    rollback_actions: [],
    restore_instructions: {
      operation: "restore",
      manifest_required: true,
      exact_confirmation_required: true,
    },
    operation_completed: false,
  };
}

export function createVisualRestoreManifest(input) {
  return {
    restore_manifest_id: `VLRSM-${randomUUID().toUpperCase()}`,
    created_at: new Date().toISOString(),
    operation: "restore",
    visual_id: input.plan.manifest.visual_id,
    visual_index_before_hash: sha256(input.plan.index_before),
    visual_index_after_hash: sha256(input.plan.index_after),
    restored_record: input.plan.record,
    restore_source_asset_path: normalizeProjectPath(input.plan.source_path),
    restored_asset_path: normalizeProjectPath(input.plan.target_path),
    restored_asset_sha256: input.plan.manifest.original_asset_sha256,
    rollback_actions: [],
    operation_completed: false,
  };
}

export async function applyVisualIndexAtomicUpdate(input) {
  const target = input.visual_index_path;
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temp, input.content, { flag: "wx" });
    if (input.inject_failure === true) {
      throw new Error("injected visual index write failure");
    }
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function moveVisualAssetToTrash(input) {
  await mkdir(path.dirname(input.trash_path), { recursive: true });
  if (input.inject_failure === true) {
    throw new Error("injected asset move failure");
  }
  await rename(input.asset_path, input.trash_path);
}

export async function restoreVisualAssetFromTrash(input) {
  await mkdir(path.dirname(input.target_path), { recursive: true });
  if (input.inject_failure === true) {
    throw new Error("injected asset restore failure");
  }
  await rename(input.source_path, input.target_path);
}

export async function rollbackVisualDeleteOperation(input) {
  const errors = [];
  try {
    if (await pathExists(input.plan.trash_path)) {
      await mkdir(path.dirname(input.plan.asset_path), { recursive: true });
      await rename(input.plan.trash_path, input.plan.asset_path);
      input.rollback_actions.push("restore_asset_from_trash");
    }
  } catch (error) {
    errors.push(`restore_asset:${error.message}`);
  }
  try {
    await applyVisualIndexAtomicUpdate({
      visual_index_path: input.visual_index_path,
      content: input.plan.index_before,
    });
    input.rollback_actions.push("restore_visual_index");
  } catch (error) {
    errors.push(`restore_index:${error.message}`);
  }
  return { completed: errors.length === 0, errors };
}

export async function rollbackVisualRestoreOperation(input) {
  const errors = [];
  try {
    if (await pathExists(input.plan.target_path)) {
      await mkdir(path.dirname(input.plan.source_path), { recursive: true });
      await rename(input.plan.target_path, input.plan.source_path);
      input.rollback_actions.push("return_asset_to_trash");
    }
  } catch (error) {
    errors.push(`return_asset:${error.message}`);
  }
  try {
    await applyVisualIndexAtomicUpdate({
      visual_index_path: input.visual_index_path,
      content: input.plan.index_before,
    });
    input.rollback_actions.push("restore_visual_index");
  } catch (error) {
    errors.push(`restore_index:${error.message}`);
  }
  return { completed: errors.length === 0, errors };
}

export async function validateVisualLibraryOperationResult(input) {
  const errors = [];
  const records = parseIndex(await readFile(input.visual_index_path));
  if (input.operation === "delete" || input.operation === "rollback-import") {
    for (const visualId of input.visual_ids) {
      if (records.some((item) => item.visual_id === visualId)) {
        errors.push(`record_still_present:${visualId}`);
      }
    }
  } else {
    for (const visualId of input.visual_ids) {
      if (!records.some((item) => item.visual_id === visualId)) {
        errors.push(`record_not_restored:${visualId}`);
      }
    }
  }
  for (const asset of input.expected_assets ?? []) {
    const state = await fileState(asset.path);
    if (state.exists !== asset.exists) {
      errors.push(`asset_state_mismatch:${normalizeProjectPath(asset.path)}`);
    } else if (state.exists && asset.sha256 && sha256(state.content) !== asset.sha256) {
      errors.push(`asset_hash_mismatch:${normalizeProjectPath(asset.path)}`);
    }
  }
  if (input.inject_failure === true) {
    errors.push("injected_post_operation_validation_failure");
  }
  return { valid: errors.length === 0, errors, record_count: records.length };
}

function basePayload(config, loadedConfigPath, input, roots) {
  return {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    operation: input.operation ?? null,
    execute_requested: input.execute === true,
    confirmation_gate: null,
    visual_index_path: normalizeProjectPath(roots.visualIndexPath),
    assets_root: normalizeProjectPath(roots.assetsRoot),
    trash_root: normalizeProjectPath(roots.trashRoot),
    manifest_path: input.manifestPath ?? null,
    operation_plan: null,
    operation_manifest: null,
    affected_visual_ids: [],
    affected_assets: [],
    rollback_actions: [],
    validation_summary: { valid: false, errors: [], record_count: 0 },
    safety_summary: {
      active_engine_unchanged: true,
      approval_queue_written: false,
      approval_item_created: false,
      canon_visual_lock_created: false,
      canon_db_updated: false,
    },
    write_summary: {
      visual_index_written: false,
      assets_moved: 0,
      assets_deleted: 0,
      rollback_performed: false,
    },
    operation_decision: null,
  };
}

export function compileVisualRollbackDeleteRestoreSummary(payload) {
  return {
    operation: payload.operation,
    affected_visual_count: payload.affected_visual_ids.length,
    affected_asset_count: payload.affected_assets.length,
    rollback_action_count: payload.rollback_actions.length,
    operation_decision: payload.operation_decision,
  };
}

export async function runVisualLibraryRollbackDeleteRestoreOperation(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryRollbackDeleteRestoreConfig(options);
  const roots = {
    visualIndexPath: resolveProjectPath(
      options.visualIndexPath ?? config.visual_index_path,
      "visual index path",
    ),
    assetsRoot: resolveProjectPath(
      options.assetsRoot ?? config.visual_assets_root,
      "visual assets root",
    ),
    trashRoot: resolveProjectPath(
      options.trashRoot ?? config.visual_trash_root,
      "visual trash root",
    ),
    restoreRoot: resolveProjectPath(
      options.restoreRoot ?? config.visual_restore_root,
      "visual restore root",
    ),
    activeEnginePath: resolveProjectPath(
      config.active_engine_path,
      "active engine path",
    ),
  };
  const payload = basePayload(config, loadedConfigPath, options, roots);
  if (!options.operation) {
    payload.operation_decision = "blocked_missing_operation";
    payload.summary = compileVisualRollbackDeleteRestoreSummary(payload);
    return payload;
  }
  if (!operations.has(options.operation)) {
    payload.operation_decision = "blocked_unknown_operation";
    payload.summary = compileVisualRollbackDeleteRestoreSummary(payload);
    return payload;
  }
  if (options.execute !== true) {
    payload.operation_decision = "blocked_missing_execute_flag";
    payload.summary = compileVisualRollbackDeleteRestoreSummary(payload);
    return payload;
  }
  const requiredText = options.operation === "rollback-import"
    ? config.required_rollback_confirmation_text
    : options.operation === "delete"
      ? config.required_delete_confirmation_text
      : config.required_restore_confirmation_text;
  payload.confirmation_gate = gate(options.confirmText, requiredText);
  if (!payload.confirmation_gate.accepted) {
    payload.operation_decision = "blocked_by_confirmation_gate";
    payload.summary = compileVisualRollbackDeleteRestoreSummary(payload);
    return payload;
  }
  const activeEngineBefore = await readFile(roots.activeEnginePath);
  if (sha256Lf(activeEngineBefore.toString("utf8"))
      !== config.expected_engine_sha256_lf) {
    throw new Error("active engine hash mismatch");
  }
  await mkdir(roots.assetsRoot, { recursive: true });
  await mkdir(roots.trashRoot, { recursive: true });
  await mkdir(roots.restoreRoot, { recursive: true });

  if (options.operation === "rollback-import") {
    const loaded = await loadManifest(options, "blocked_missing_rollback_manifest");
    payload.manifest_path = loaded.manifest_path;
    if (!loaded.manifest) {
      payload.operation_decision = loaded.decision;
    } else {
      const plan = await buildVisualImportRollbackPlan({
        manifest: loaded.manifest,
        visual_index_path: roots.visualIndexPath,
        assets_root: roots.assetsRoot,
      });
      payload.operation_plan = plan;
      if (plan.decision !== "visual_import_rollback_ready") {
        payload.operation_decision = plan.decision;
      } else {
        const staged = [];
        try {
          for (const assetPath of plan.asset_paths) {
            const stagingPath = path.join(
              roots.restoreRoot,
              `rollback-${randomUUID()}`,
              path.basename(assetPath),
            );
            await mkdir(path.dirname(stagingPath), { recursive: true });
            if (options.injectAssetOperationFailure === true) {
              throw Object.assign(new Error("injected asset operation failure"), {
                phase: "asset",
              });
            }
            await rename(assetPath, stagingPath);
            staged.push({ assetPath, stagingPath });
          }
          try {
            await applyVisualIndexAtomicUpdate({
              visual_index_path: roots.visualIndexPath,
              content: plan.index_after,
              inject_failure: options.injectIndexWriteFailure === true,
            });
          } catch (error) {
            error.phase = "index";
            throw error;
          }
          const validation = await validateVisualLibraryOperationResult({
            operation: "rollback-import",
            visual_index_path: roots.visualIndexPath,
            visual_ids: plan.removed_records.map((item) => item.visual_id),
            expected_assets: plan.asset_paths.map((assetPath) => ({
              path: assetPath,
              exists: false,
            })),
            inject_failure: options.injectPostOperationValidationFailure === true,
          });
          payload.validation_summary = validation;
          if (!validation.valid) {
            throw Object.assign(new Error("post-operation validation failed"), {
              phase: "validation",
            });
          }
          for (const item of staged) await rm(path.dirname(item.stagingPath), {
            recursive: true,
            force: true,
          });
          payload.affected_visual_ids =
            plan.removed_records.map((item) => item.visual_id);
          payload.affected_assets =
            plan.asset_paths.map(normalizeProjectPath);
          payload.write_summary.visual_index_written = true;
          payload.write_summary.assets_deleted = plan.asset_paths.length;
          payload.operation_manifest = {
            ...loaded.manifest,
            rollback_actions: [
              ...(loaded.manifest.rollback_actions ?? []),
              "remove_manifest_records",
              "remove_manifest_assets",
            ],
            rollback_completed: true,
          };
          payload.operation_decision = "visual_import_rollback_completed";
        } catch (error) {
          for (const item of staged.reverse()) {
            if (await pathExists(item.stagingPath)) {
              await mkdir(path.dirname(item.assetPath), { recursive: true });
              await rename(item.stagingPath, item.assetPath);
            }
          }
          await applyVisualIndexAtomicUpdate({
            visual_index_path: roots.visualIndexPath,
            content: plan.index_before,
          });
          payload.write_summary.rollback_performed = true;
          payload.rollback_actions.push("restore_import_assets", "restore_visual_index");
          payload.operation_decision = error.phase === "asset"
            ? "failed_asset_operation_rolled_back"
            : error.phase === "index"
              ? "failed_visual_index_write_rolled_back"
              : "failed_post_operation_validation_rolled_back";
        }
      }
    }
  } else if (options.operation === "delete") {
    if (!options.visualId) {
      payload.operation_decision = "blocked_missing_visual_id";
    } else {
      const plan = await buildVisualDeletePlan({
        visual_id: options.visualId,
        visual_index_path: roots.visualIndexPath,
        assets_root: roots.assetsRoot,
        trash_root: roots.trashRoot,
        expected_asset_sha256: options.expectedAssetSha256,
        expected_visual_index_hash: options.expectedVisualIndexHash,
      });
      payload.operation_plan = plan;
      if (plan.decision !== "visual_delete_ready") {
        payload.operation_decision = plan.decision;
      } else {
        const manifest = createVisualDeleteManifest({ plan });
        payload.operation_manifest = manifest;
        try {
          try {
            await moveVisualAssetToTrash({
              asset_path: plan.asset_path,
              trash_path: plan.trash_path,
              inject_failure: options.injectAssetOperationFailure === true,
            });
          } catch (error) {
            error.phase = "asset";
            throw error;
          }
          try {
            await applyVisualIndexAtomicUpdate({
              visual_index_path: roots.visualIndexPath,
              content: plan.index_after,
              inject_failure: options.injectIndexWriteFailure === true,
            });
          } catch (error) {
            error.phase = "index";
            throw error;
          }
          const validation = await validateVisualLibraryOperationResult({
            operation: "delete",
            visual_index_path: roots.visualIndexPath,
            visual_ids: [plan.visual_id],
            expected_assets: [
              { path: plan.asset_path, exists: false },
              { path: plan.trash_path, exists: true, sha256: plan.asset_sha256 },
            ],
            inject_failure: options.injectPostOperationValidationFailure === true,
          });
          payload.validation_summary = validation;
          if (!validation.valid) {
            throw Object.assign(new Error("post-operation validation failed"), {
              phase: "validation",
            });
          }
          manifest.operation_completed = true;
          await writeManifestIfRequested(options.manifestOutputPath, manifest);
          payload.affected_visual_ids = [plan.visual_id];
          payload.affected_assets = [
            normalizeProjectPath(plan.asset_path),
            normalizeProjectPath(plan.trash_path),
          ];
          payload.write_summary.visual_index_written = true;
          payload.write_summary.assets_moved = 1;
          payload.operation_decision = "visual_delete_completed";
        } catch (error) {
          const rollback = await rollbackVisualDeleteOperation({
            plan,
            visual_index_path: roots.visualIndexPath,
            rollback_actions: payload.rollback_actions,
          });
          payload.write_summary.rollback_performed = true;
          payload.validation_summary.errors.push(...rollback.errors);
          payload.operation_decision = error.phase === "asset"
            ? "failed_asset_operation_rolled_back"
            : error.phase === "index"
              ? "failed_visual_index_write_rolled_back"
              : "failed_post_operation_validation_rolled_back";
        }
      }
    }
  } else {
    const loaded = await loadManifest(options, "blocked_missing_restore_manifest");
    payload.manifest_path = loaded.manifest_path;
    if (!loaded.manifest) {
      payload.operation_decision = loaded.decision;
    } else {
      const plan = await buildVisualRestorePlan({
        manifest: loaded.manifest,
        visual_index_path: roots.visualIndexPath,
        assets_root: roots.assetsRoot,
        trash_root: roots.trashRoot,
        expected_visual_index_hash: options.expectedVisualIndexHash,
      });
      payload.operation_plan = plan;
      if (plan.decision !== "visual_restore_ready") {
        payload.operation_decision = plan.decision;
      } else {
        const manifest = createVisualRestoreManifest({ plan });
        payload.operation_manifest = manifest;
        try {
          try {
            await restoreVisualAssetFromTrash({
              source_path: plan.source_path,
              target_path: plan.target_path,
              inject_failure: options.injectAssetOperationFailure === true,
            });
          } catch (error) {
            error.phase = "asset";
            throw error;
          }
          try {
            await applyVisualIndexAtomicUpdate({
              visual_index_path: roots.visualIndexPath,
              content: plan.index_after,
              inject_failure: options.injectIndexWriteFailure === true,
            });
          } catch (error) {
            error.phase = "index";
            throw error;
          }
          const validation = await validateVisualLibraryOperationResult({
            operation: "restore",
            visual_index_path: roots.visualIndexPath,
            visual_ids: [plan.manifest.visual_id],
            expected_assets: [{
              path: plan.target_path,
              exists: true,
              sha256: plan.manifest.original_asset_sha256,
            }],
            inject_failure: options.injectPostOperationValidationFailure === true,
          });
          payload.validation_summary = validation;
          if (!validation.valid) {
            throw Object.assign(new Error("post-operation validation failed"), {
              phase: "validation",
            });
          }
          manifest.operation_completed = true;
          await writeManifestIfRequested(options.manifestOutputPath, manifest);
          payload.affected_visual_ids = [plan.manifest.visual_id];
          payload.affected_assets = [
            normalizeProjectPath(plan.source_path),
            normalizeProjectPath(plan.target_path),
          ];
          payload.write_summary.visual_index_written = true;
          payload.write_summary.assets_moved = 1;
          payload.operation_decision = "visual_restore_completed";
        } catch (error) {
          const rollback = await rollbackVisualRestoreOperation({
            plan,
            visual_index_path: roots.visualIndexPath,
            rollback_actions: payload.rollback_actions,
          });
          payload.write_summary.rollback_performed = true;
          payload.validation_summary.errors.push(...rollback.errors);
          payload.operation_decision = error.phase === "asset"
            ? "failed_asset_operation_rolled_back"
            : error.phase === "index"
              ? "failed_visual_index_write_rolled_back"
              : "failed_post_operation_validation_rolled_back";
        }
      }
    }
  }
  payload.safety_summary.active_engine_unchanged =
    activeEngineBefore.equals(await readFile(roots.activeEnginePath));
  payload.summary = compileVisualRollbackDeleteRestoreSummary(payload);
  return payload;
}
