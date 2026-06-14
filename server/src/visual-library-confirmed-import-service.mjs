import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  loadVisualLibraryControlledImportGuardConfig,
  runVisualLibraryControlledImportGuardPreview,
} from "./visual-library-controlled-import-guard-service.mjs";

const confirmedImportConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-confirmed-import.json",
);

const falseSafetyFields = [
  "moves_files",
  "deletes_files",
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

function stableId(prefix, seed) {
  return `${prefix}${createHash("sha256")
    .update(seed, "utf8")
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()}`;
}

function gate(providedText, requiredText) {
  const provided = typeof providedText === "string" ? providedText : "";
  return {
    required_text: requiredText,
    provided_text: provided || null,
    accepted: provided === requiredText,
  };
}

function lineCount(text) {
  return normalizeLf(text).split("\n").filter((line) => line.trim()).length;
}

async function fileState(filePath) {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile()) return { exists: false, content: null, size: null };
    const content = await readFile(filePath);
    return { exists: true, content, size: metadata.size };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { exists: false, content: null, size: null };
    }
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

async function removeEmptyParents(startDirectory, stopDirectory) {
  let current = startDirectory;
  while (isInside(stopDirectory, current)) {
    try {
      await rmdir(current);
    } catch (error) {
      if (["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error?.code)) return;
      throw error;
    }
    current = path.dirname(current);
  }
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ""
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
}

function targetRelativePath(proposedPath) {
  const normalized = String(proposedPath ?? "").replaceAll("\\", "/");
  const prefix = "data/visual_db/assets/";
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : null;
}

function validateTargetPath(proposedPath, assetsRoot, category) {
  const relative = targetRelativePath(proposedPath);
  if (!relative || !category || relative.split("/")[0] !== category) {
    return { valid: false, target_path: null };
  }
  const targetPath = path.resolve(assetsRoot, relative);
  return {
    valid: isInside(assetsRoot, targetPath),
    target_path: targetPath,
  };
}

function confirmedRecord(item, createdAt, targetProjectPath) {
  const proposed = item.proposed_visual_index_record ?? {};
  return {
    visual_id: item.proposed_visual_id,
    created_at: createdAt,
    character: "unknown",
    category: proposed.category,
    title: proposed.title ?? path.parse(item.source_file).name,
    canon_status: "reference",
    trust_level: "T7",
    source: "visual_library_confirmed_import",
    status: "imported",
    path: targetProjectPath,
    notes:
      "Confirmed visual import reference only; does not establish canon facts or ability mechanics.",
    description: "",
    ability_state: "visual_only",
    tags: [],
    metadata_source: "confirmed_import",
  };
}

export function validateVisualLibraryConfirmedImportConfig(config) {
  requireObject(config, "visual library confirmed import config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19A") throw new Error("phase must be 19A.");
  if (config.mode !== "confirmed_visual_library_import_core") {
    throw new Error("mode must be confirmed_visual_library_import_core.");
  }
  for (const field of [
    "controlled_guard_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "required_simulation_confirmation_text",
    "required_pre_write_confirmation_text",
    "required_real_import_confirmation_text",
  ]) {
    requireString(config[field], field);
  }
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  for (const field of [
    "requires_execute_flag",
    "requires_exact_confirmation",
    "must_create_rollback_manifest",
    "must_write_visual_index_atomically",
    "must_copy_visual_assets_atomically",
    "must_validate_after_write",
    "writes_visual_index",
    "writes_visual_assets",
    "copies_files",
  ]) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of falseSafetyFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryConfirmedImportConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryConfirmedImportConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const configPath = options.configPath
    ? resolveProjectPath(options.configPath, "confirmed import config")
    : confirmedImportConfigPath;
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return {
    config: validateVisualLibraryConfirmedImportConfig(config),
    config_path: normalizeProjectPath(configPath),
  };
}

export function validateConfirmedImportPreconditions(plan) {
  requireObject(plan, "confirmed import plan");
  const checks = [
    ["guard_ready", "blocked_controlled_import_guard_not_ready"],
    ["source_exists", "blocked_missing_source_file"],
    ["source_hash_matches", "blocked_source_hash_mismatch"],
    ["target_safe", "blocked_unsafe_target_path"],
    ["target_not_occupied", "blocked_target_already_occupied"],
    ["visual_index_state_matches", "blocked_visual_index_state_mismatch"],
  ];
  const failed = checks
    .filter(([field]) => plan.preconditions?.[field] !== true)
    .map(([field, decision]) => ({ field, decision }));
  return { valid: failed.length === 0, failed };
}

export async function buildConfirmedImportPlan(input) {
  const guard = requireObject(input.controlled_guard, "controlled guard preview");
  const sourceDir = input.source_dir_absolute;
  const assetsRoot = input.visual_assets_root_absolute;
  const visualIndexBefore = input.visual_index_before;
  const expectedIndexHash = input.expected_visual_index_hash
    ?? sha256(visualIndexBefore);
  const expectedLineCount = input.expected_visual_index_line_count
    ?? lineCount(visualIndexBefore.toString("utf8"));
  const items = [];
  for (const guardItem of guard.controlled_import_items ?? []) {
    const sourcePath = path.resolve(sourceDir, guardItem.source_file ?? "");
    const sourceSafe = isInside(sourceDir, sourcePath);
    const source = sourceSafe
      ? await fileState(sourcePath)
      : { exists: false, content: null, size: null };
    const category = guardItem.proposed_visual_index_record?.category;
    const target = validateTargetPath(
      guardItem.proposed_target_path,
      assetsRoot,
      category,
    );
    const targetOccupied = target.valid
      ? await pathExists(target.target_path)
      : false;
    const currentIndex = await readFile(input.visual_index_path_absolute);
    const preconditions = {
      guard_ready:
        guardItem.guard_decision === "ready_for_phase_19a_confirmed_import",
      source_exists: source.exists,
      source_hash_matches:
        source.exists
        && sha256(source.content)
          === String(guardItem.source_sha256 ?? "").toUpperCase(),
      target_safe: target.valid,
      target_not_occupied: target.valid && !targetOccupied,
      visual_index_state_matches:
        sha256(currentIndex) === expectedIndexHash
        && lineCount(currentIndex.toString("utf8")) === expectedLineCount,
    };
    const validation = validateConfirmedImportPreconditions({ preconditions });
    const createdAt = input.created_at ?? new Date().toISOString();
    const targetProjectPath = guardItem.proposed_target_path;
    items.push({
      import_item_id: stableId(
        "VLCI-",
        `${guardItem.controlled_import_item_id}|${createdAt}`,
      ),
      source_file: guardItem.source_file,
      source_path: sourcePath,
      source_sha256: guardItem.source_sha256,
      source_size_bytes: guardItem.source_size_bytes,
      proposed_visual_id: guardItem.proposed_visual_id,
      target_path: target.target_path,
      target_project_path: targetProjectPath,
      visual_index_record: confirmedRecord(
        guardItem,
        createdAt,
        targetProjectPath,
      ),
      preconditions,
      import_decision: validation.valid
        ? "confirmed_import_ready"
        : validation.failed[0].decision,
      blocked_reasons: validation.failed.map(
        ({ field }) => `precondition_failed:${field}`,
      ),
      warnings: [...(guardItem.warnings ?? [])],
      risk_summary: {
        risk_level: validation.valid ? "high_controlled_write" : "high",
        reasons: validation.failed.map(({ field }) => field),
      },
    });
  }
  return {
    expected_visual_index_hash: expectedIndexHash,
    expected_visual_index_line_count: expectedLineCount,
    items,
    ready_items: items.filter(
      (item) => item.import_decision === "confirmed_import_ready",
    ),
    blocked_items: items.filter(
      (item) => item.import_decision !== "confirmed_import_ready",
    ),
  };
}

export function createVisualImportRollbackManifest(input) {
  return {
    rollback_manifest_id: `VLRM-${randomUUID().toUpperCase()}`,
    created_at: input.created_at ?? new Date().toISOString(),
    visual_index_before_hash: sha256(input.visual_index_before),
    visual_index_after_hash: null,
    copied_assets: [],
    index_records_added: [],
    rollback_actions: [],
    rollback_completed: false,
  };
}

export async function copyVisualAssetAtomically(input) {
  const targetPath = input.target_path;
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
  let completed = false;
  try {
    await copyFile(input.source_path, tempPath, 1);
    const copied = await readFile(tempPath);
    if (sha256(copied) !== String(input.expected_sha256).toUpperCase()) {
      throw new Error("copied asset hash mismatch");
    }
    await link(tempPath, targetPath);
    completed = true;
    return { target_path: targetPath, sha256: sha256(copied) };
  } finally {
    await rm(tempPath, { force: true });
    if (!completed && input.assets_root) {
      await removeEmptyParents(path.dirname(targetPath), input.assets_root);
    }
  }
}

export async function writeVisualIndexAtomically(input) {
  const tempPath = `${input.visual_index_path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(tempPath, input.content, { flag: "wx" });
    if (input.inject_failure === true) {
      throw new Error("injected visual index write failure");
    }
    await rename(tempPath, input.visual_index_path);
  } finally {
    await rm(tempPath, { force: true });
  }
}

export async function validateConfirmedImportResult(input) {
  const errors = [];
  const text = await readFile(input.visual_index_path, "utf8");
  const records = [];
  for (const [index, line] of normalizeLf(text).split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      records.push(record);
      for (const field of [
        "visual_id",
        "created_at",
        "category",
        "title",
        "path",
      ]) {
        if (typeof record[field] !== "string" || !record[field].trim()) {
          errors.push(`line_${index + 1}:${field}_must_be_non_empty`);
        }
      }
      for (const [field, expected] of Object.entries({
        character: "unknown",
        canon_status: "reference",
        trust_level: "T7",
        source: "visual_library_confirmed_import",
        status: "imported",
        ability_state: "visual_only",
        metadata_source: "confirmed_import",
      })) {
        if (record[field] !== expected) {
          errors.push(`line_${index + 1}:${field}_must_equal_${expected}`);
        }
      }
      if (!Array.isArray(record.tags)) {
        errors.push(`line_${index + 1}:tags_must_be_array`);
      }
      if (
        !String(record.path ?? "").startsWith("data/visual_db/assets/")
        || String(record.path).includes("/../")
      ) {
        errors.push(`line_${index + 1}:unsafe_visual_asset_path`);
      }
      if (Number.isNaN(Date.parse(record.created_at))) {
        errors.push(`line_${index + 1}:invalid_created_at`);
      }
    } catch (error) {
      errors.push(`line_${index + 1}:invalid_json:${error.message}`);
    }
  }
  for (const item of input.imported_items) {
    const target = await fileState(item.target_path);
    if (!target.exists) errors.push(`missing_target:${item.target_path}`);
    else if (sha256(target.content) !== item.source_sha256) {
      errors.push(`target_hash_mismatch:${item.target_path}`);
    }
    if (!records.some((record) => record.visual_id === item.proposed_visual_id)) {
      errors.push(`missing_index_record:${item.proposed_visual_id}`);
    }
  }
  if (input.inject_failure === true) {
    errors.push("injected_post_write_validation_failure");
  }
  return { valid: errors.length === 0, errors, record_count: records.length };
}

export async function rollbackConfirmedVisualImport(input) {
  const errors = [];
  try {
    await writeVisualIndexAtomically({
      visual_index_path: input.visual_index_path,
      content: input.visual_index_before,
    });
    input.manifest.rollback_actions.push("restore_visual_index");
  } catch (error) {
    errors.push(`restore_visual_index:${error.message}`);
  }
  for (const targetPath of [...input.copied_assets].reverse()) {
    try {
      await rm(targetPath, { force: true });
      input.manifest.rollback_actions.push(
        `delete_copied_asset:${normalizeProjectPath(targetPath)}`,
      );
      if (input.assets_root) {
        await removeEmptyParents(path.dirname(targetPath), input.assets_root);
      }
    } catch (error) {
      errors.push(`delete_copied_asset:${error.message}`);
    }
  }
  input.manifest.rollback_completed = errors.length === 0;
  return { completed: errors.length === 0, errors };
}

export function compileConfirmedVisualImportSummary(payload) {
  return {
    planned_count: payload.import_plan?.items?.length ?? 0,
    imported_count: payload.imported_items.length,
    blocked_count: payload.blocked_items.length,
    rollback_completed: payload.rollback_manifest?.rollback_completed ?? false,
    confirmed_import_decision: payload.confirmed_import_decision,
  };
}

export async function runVisualLibraryConfirmedImport(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryConfirmedImportConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "confirmed import source directory",
  );
  const visualAssetsRoot = resolveProjectPath(
    options.visualAssetsRoot ?? config.visual_assets_root,
    "confirmed import visual assets root",
  );
  const visualIndexPath = resolveProjectPath(
    options.visualIndexPath ?? config.visual_index_path,
    "confirmed import visual index path",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine path",
  );
  const executeRequested = options.execute === true;
  const confirmationGates = {
    simulation_confirmation: gate(
      options.confirmText ?? options.confirm_text,
      config.required_simulation_confirmation_text,
    ),
    pre_write_confirmation: gate(
      options.preWriteConfirmText ?? options.pre_write_confirm_text,
      config.required_pre_write_confirmation_text,
    ),
    real_import_confirmation: gate(
      options.realImportConfirmText ?? options.real_import_confirm_text,
      config.required_real_import_confirmation_text,
    ),
  };
  const payload = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    source_dir: normalizeProjectPath(sourceDir),
    execute_requested: executeRequested,
    confirmation_gates: confirmationGates,
    controlled_guard_summary: null,
    import_plan: null,
    imported_items: [],
    blocked_items: [],
    rollback_manifest: null,
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
      visual_assets_copied: 0,
      atomic_index_write: false,
      atomic_asset_copy: false,
      rollback_performed: false,
    },
    confirmed_import_decision: null,
  };
  if (!executeRequested) {
    payload.confirmed_import_decision = "blocked_missing_execute_flag";
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  if (!confirmationGates.simulation_confirmation.accepted) {
    payload.confirmed_import_decision =
      "blocked_by_simulation_confirmation_gate";
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  if (!confirmationGates.pre_write_confirmation.accepted) {
    payload.confirmed_import_decision =
      "blocked_by_pre_write_confirmation_gate";
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  if (!confirmationGates.real_import_confirmation.accepted) {
    payload.confirmed_import_decision =
      "blocked_by_real_import_confirmation_gate";
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  const activeEngineBefore = await readFile(activeEnginePath);
  if (sha256Lf(activeEngineBefore.toString("utf8"))
      !== config.expected_engine_sha256_lf) {
    throw new Error("active engine hash mismatch");
  }
  await mkdir(visualAssetsRoot, { recursive: true });
  const visualIndexBefore = await readFile(visualIndexPath);
  const { config: controlledGuardConfig } =
    await loadVisualLibraryControlledImportGuardConfig({
      configPath: config.controlled_guard_config_path,
    });
  const guard = options.controlledGuardPreview
    ?? await runVisualLibraryControlledImportGuardPreview({
      sourceDir: normalizeProjectPath(sourceDir),
      confirmText:
        options.guardConfirmText
        ?? controlledGuardConfig.required_simulation_confirmation_text,
      preWriteConfirmText:
        options.guardPreWriteConfirmText
        ?? controlledGuardConfig.required_pre_write_confirmation_text,
      configPath: config.controlled_guard_config_path,
    });
  payload.controlled_guard_summary = guard.controlled_import_guard_summary;
  if (
    guard.controlled_import_guard_decision
    !== "ready_for_phase_19a_confirmed_import"
  ) {
    payload.confirmed_import_decision =
      "blocked_controlled_import_guard_not_ready";
    payload.blocked_items = guard.blocked_items ?? [];
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  const plan = await buildConfirmedImportPlan({
    controlled_guard: guard,
    source_dir_absolute: sourceDir,
    visual_assets_root_absolute: visualAssetsRoot,
    visual_index_path_absolute: visualIndexPath,
    visual_index_before: visualIndexBefore,
    expected_visual_index_hash: options.expectedVisualIndexHash,
    expected_visual_index_line_count: options.expectedVisualIndexLineCount,
  });
  payload.import_plan = plan;
  payload.blocked_items = plan.blocked_items;
  if (plan.blocked_items.length > 0 || plan.ready_items.length === 0) {
    payload.confirmed_import_decision = plan.blocked_items[0]?.import_decision
      ?? "blocked_controlled_import_guard_not_ready";
    payload.summary = compileConfirmedVisualImportSummary(payload);
    return payload;
  }
  const manifest = createVisualImportRollbackManifest({
    visual_index_before: visualIndexBefore,
  });
  payload.rollback_manifest = manifest;
  const copiedAssets = [];
  try {
    for (const item of plan.ready_items) {
      if (options.injectAssetCopyFailure === true) {
        throw Object.assign(new Error("injected asset copy failure"), {
          phase: "asset_copy",
        });
      }
      const copied = await copyVisualAssetAtomically({
        source_path: item.source_path,
        target_path: item.target_path,
        expected_sha256: item.source_sha256,
        assets_root: visualAssetsRoot,
      });
      copiedAssets.push(item.target_path);
      manifest.copied_assets.push(normalizeProjectPath(item.target_path));
      payload.imported_items.push({
        ...item,
        target_sha256_after_copy: copied.sha256,
        import_decision: "asset_copied_pending_index",
        rollback_entries: [`delete:${normalizeProjectPath(item.target_path)}`],
        validation_result: null,
      });
    }
    const existingText = visualIndexBefore.toString("utf8");
    const separator = existingText.length > 0 && !existingText.endsWith("\n")
      ? "\n"
      : "";
    const addedText = payload.imported_items
      .map((item) => JSON.stringify(item.visual_index_record))
      .join("\n");
    const nextIndex = Buffer.from(
      `${existingText}${separator}${addedText}\n`,
      "utf8",
    );
    try {
      await writeVisualIndexAtomically({
        visual_index_path: visualIndexPath,
        content: nextIndex,
        inject_failure: options.injectIndexWriteFailure === true,
      });
    } catch (error) {
      error.phase = "index_write";
      throw error;
    }
    payload.write_summary.visual_index_written = true;
    payload.write_summary.atomic_index_write = true;
    payload.write_summary.visual_assets_copied = copiedAssets.length;
    payload.write_summary.atomic_asset_copy = true;
    manifest.index_records_added.push(
      ...payload.imported_items.map((item) => item.proposed_visual_id),
    );
    manifest.visual_index_after_hash = sha256(nextIndex);
    const validation = await validateConfirmedImportResult({
      visual_index_path: visualIndexPath,
      imported_items: payload.imported_items,
      inject_failure: options.injectPostWriteValidationFailure === true,
    });
    payload.validation_summary = validation;
    if (!validation.valid) {
      throw Object.assign(new Error("post-write validation failed"), {
        phase: "post_validation",
      });
    }
    for (const item of payload.imported_items) {
      item.import_decision = "confirmed_visual_import_completed";
      item.validation_result = { valid: true };
    }
    payload.confirmed_import_decision = "confirmed_visual_import_completed";
  } catch (error) {
    const rollback = await rollbackConfirmedVisualImport({
      visual_index_path: visualIndexPath,
      visual_index_before: visualIndexBefore,
      copied_assets: copiedAssets,
      assets_root: visualAssetsRoot,
      manifest,
    });
    payload.write_summary.rollback_performed = true;
    payload.validation_summary.errors.push(error.message, ...rollback.errors);
    payload.imported_items = [];
    payload.confirmed_import_decision = error.phase === "asset_copy"
      ? "failed_asset_copy_rolled_back"
      : error.phase === "index_write"
        ? "failed_visual_index_write_rolled_back"
        : "failed_post_write_validation_rolled_back";
  }
  payload.safety_summary.active_engine_unchanged =
    activeEngineBefore.equals(await readFile(activeEnginePath));
  payload.summary = compileConfirmedVisualImportSummary(payload);
  return payload;
}
