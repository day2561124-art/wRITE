import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
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
import { validateVisualRecord } from "./visual-db.mjs";

const defaultConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-persistent-baseline-activation.json",
);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

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

function lineCount(value) {
  return normalizeLf(value).split("\n").filter((line) => line.trim()).length;
}

function gate(provided, required) {
  return {
    required_text: required,
    provided_text: provided ?? null,
    accepted: provided === required,
  };
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ""
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function directorySnapshot(root) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        files.push({ type: "directory", path: relative });
        await walk(absolute);
      } else {
        const content = await readFile(absolute);
        files.push({
          type: "file",
          path: relative,
          sha256: sha256(content),
          image: imageExtensions.has(path.extname(entry.name).toLowerCase()),
        });
      }
    }
  }
  await walk(root);
  return files;
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function writeAtomic(target, content) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function copyAtomic(source, target, expectedHash) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  let completed = false;
  try {
    await copyFile(source, temporary, 1);
    const copied = await readFile(temporary);
    if (sha256(copied) !== expectedHash) {
      throw new Error(`copied asset hash mismatch: ${path.basename(source)}`);
    }
    await link(temporary, target);
    completed = true;
  } finally {
    await rm(temporary, { force: true });
    if (!completed) await rm(target, { force: true });
  }
}

function selectedRecord(item, createdAt) {
  return {
    visual_id: item.visual_id,
    created_at: createdAt,
    character: item.character,
    category: item.category,
    title: item.title,
    canon_status: item.canon_status,
    trust_level: item.trust_level,
    source: item.source,
    status: item.status,
    path: item.target_path,
    notes: item.description,
    description: item.description,
    ability_state: item.ability_state,
    tags: item.tags,
    metadata_source: "manual_mapping",
  };
}

export function validateVisualLibraryPersistentBaselineActivationConfig(config) {
  requireObject(config, "persistent baseline activation config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19H-B") throw new Error("phase must be 19H-B.");
  if (config.mode !== "visual_library_persistent_baseline_activation") {
    throw new Error(
      "mode must be visual_library_persistent_baseline_activation.",
    );
  }
  for (const field of [
    "selected_set_config_path",
    "rollback_manifest_path",
    "formal_visual_index_path",
    "formal_assets_root",
    "formal_intake_root",
    "active_engine_path",
    "compressed_rules_path",
    "approval_queue_root",
    "canon_db_root",
    "required_simulation_confirmation_text",
    "required_pre_write_confirmation_text",
    "required_real_import_confirmation_text",
    "required_persistent_baseline_transition_confirmation_text",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  for (const field of [
    "expected_formal_visual_index_non_empty_lines_before",
    "expected_formal_assets_count_before",
    "expected_formal_visual_index_non_empty_lines_after",
    "expected_formal_assets_count_after",
  ]) {
    if (!Number.isInteger(config[field]) || config[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }
  for (const field of [
    "requires_execute_flag",
    "writes_visual_index",
    "copies_visual_assets",
    "updates_acceptance_baseline",
  ]) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of [
    "updates_active_engine",
    "updates_canon_db",
    "writes_approval_queue",
    "creates_canon_visual_lock",
  ]) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export function validatePersistentBaselineSelectedSet(selectedSet, config) {
  requireObject(selectedSet, "persistent baseline selected set");
  if (selectedSet.schema_version !== 1) {
    throw new Error("selected set schema_version must be 1.");
  }
  if (selectedSet.phase !== "19H-B") {
    throw new Error("selected set phase must be 19H-B.");
  }
  requireString(selectedSet.selected_set_id, "selected_set_id");
  if (!Array.isArray(selectedSet.items)) {
    throw new Error("selected set items must be an array.");
  }
  if (
    selectedSet.items.length
    !== config.expected_formal_visual_index_non_empty_lines_after
  ) throw new Error("selected set item count must match the configured baseline.");
  const ids = new Set();
  const sources = new Set();
  const targets = new Set();
  for (const item of selectedSet.items) {
    requireObject(item, "selected set item");
    for (const field of [
      "visual_id", "source_file", "source_sha256", "target_path", "character",
      "title", "category", "canon_status", "trust_level", "source", "status",
      "description", "ability_state",
    ]) requireString(item[field], field);
    if (!/^[A-F0-9]{64}$/u.test(item.source_sha256)) {
      throw new Error("source_sha256 must be an uppercase SHA-256.");
    }
    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      throw new Error("tags must be a non-empty array.");
    }
    if (ids.has(item.visual_id) || sources.has(item.source_file)
        || targets.has(item.target_path)) {
      throw new Error("selected set IDs, sources, and targets must be unique.");
    }
    ids.add(item.visual_id);
    sources.add(item.source_file);
    targets.add(item.target_path);
    const validation = validateVisualRecord(
      selectedRecord(item, "2026-01-01T00:00:00.000Z"),
    );
    if (validation.errors.length > 0) {
      throw new Error(`invalid selected record: ${validation.errors.join("; ")}`);
    }
  }
  return selectedSet;
}

export async function loadVisualLibraryPersistentBaselineActivationConfig(
  options = {},
) {
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "activation config")
    : defaultConfigPath;
  const config = options.config
    ? structuredClone(options.config)
    : JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryPersistentBaselineActivationConfig(config),
    config_path: options.config ? null : normalizeProjectPath(resolved),
  };
}

export async function loadPersistentBaselineSelectedSet(config, options = {}) {
  if (options.selectedSet) {
    return validatePersistentBaselineSelectedSet(
      structuredClone(options.selectedSet),
      config,
    );
  }
  const selectedPath = resolveProjectPath(
    config.selected_set_config_path,
    "selected set config",
  );
  return validatePersistentBaselineSelectedSet(
    JSON.parse(await readFile(selectedPath, "utf8")),
    config,
  );
}

export async function runVisualLibraryPersistentBaselineActivation(
  options = {},
) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryPersistentBaselineActivationConfig(options);
  const selectedSet = await loadPersistentBaselineSelectedSet(config, options);
  const roots = {
    index: resolveProjectPath(config.formal_visual_index_path, "visual index"),
    assets: resolveProjectPath(config.formal_assets_root, "visual assets"),
    intake: resolveProjectPath(config.formal_intake_root, "visual intake"),
    engine: resolveProjectPath(config.active_engine_path, "active engine"),
    compressed: resolveProjectPath(config.compressed_rules_path, "compressed rules"),
    approval: resolveProjectPath(config.approval_queue_root, "Approval Queue"),
    canon: resolveProjectPath(config.canon_db_root, "Canon DB"),
    manifest: resolveProjectPath(config.rollback_manifest_path, "rollback manifest"),
  };
  const confirmationGates = {
    simulation_confirmation: gate(
      options.confirmText,
      config.required_simulation_confirmation_text,
    ),
    pre_write_confirmation: gate(
      options.preWriteConfirmText,
      config.required_pre_write_confirmation_text,
    ),
    real_import_confirmation: gate(
      options.realImportConfirmText,
      config.required_real_import_confirmation_text,
    ),
    persistent_baseline_transition_confirmation: gate(
      options.transitionConfirmText,
      config.required_persistent_baseline_transition_confirmation_text,
    ),
  };
  const indexBefore = await readFile(roots.index);
  const assetsBefore = await directorySnapshot(roots.assets);
  const engineBefore = await readFile(roots.engine);
  const compressedBefore = await readFile(roots.compressed);
  const approvalBefore = await directorySnapshot(roots.approval);
  const canonBefore = await directorySnapshot(roots.canon);
  const indexCountBefore = lineCount(indexBefore.toString("utf8"));
  const assetCountBefore = assetsBefore.filter((item) => item.image).length;
  const planItems = [];
  for (const item of selectedSet.items) {
    const sourcePath = path.resolve(roots.intake, item.source_file);
    const targetRelative = item.target_path.replaceAll("\\", "/")
      .replace(/^data\/visual_db\/assets\//u, "");
    const targetPath = path.resolve(roots.assets, targetRelative);
    const sourceSafe = isInside(roots.intake, sourcePath);
    const sourceExists = sourceSafe && await pathExists(sourcePath);
    const sourceContent = sourceExists ? await readFile(sourcePath) : null;
    planItems.push({
      ...item,
      source_path: sourcePath,
      target_path_absolute: targetPath,
      preconditions: {
        source_safe: sourceSafe,
        source_exists: sourceExists,
        source_hash_matches:
          sourceExists && sha256(sourceContent) === item.source_sha256,
        target_safe: isInside(roots.assets, targetPath),
        target_not_occupied: !(await pathExists(targetPath)),
      },
    });
  }
  const alreadyActive =
    indexCountBefore === config.expected_formal_visual_index_non_empty_lines_after
    && assetCountBefore === config.expected_formal_assets_count_after
    && planItems.every((item) => !item.preconditions.target_not_occupied);
  const preconditions = {
    formal_visual_index_baseline_matches:
      indexCountBefore
        === config.expected_formal_visual_index_non_empty_lines_before,
    formal_assets_baseline_matches:
      assetCountBefore === config.expected_formal_assets_count_before,
    active_engine_hash_matches:
      sha256Lf(engineBefore.toString("utf8"))
        === config.expected_engine_sha256_lf,
    selected_item_count_matches:
      planItems.length
        === config.expected_formal_visual_index_non_empty_lines_after,
    selected_items_ready: planItems.every(
      (item) => Object.values(item.preconditions).every(Boolean),
    ),
  };
  const payload = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    selected_set_id: selectedSet.selected_set_id,
    execute_requested: options.execute === true,
    confirmation_gates: confirmationGates,
    baseline_before: {
      visual_index_non_empty_lines: indexCountBefore,
      formal_assets_image_count: assetCountBefore,
    },
    activation_plan: { items: planItems, preconditions },
    imported_items: [],
    rollback_manifest: null,
    rollback_manifest_path: normalizeProjectPath(roots.manifest),
    validation_summary: { valid: false, errors: [] },
    protected_file_checks: {
      active_engine_unchanged: true,
      compressed_rules_unchanged: true,
      approval_queue_unchanged: true,
      canon_db_unchanged: true,
    },
    write_summary: {
      visual_index_written: false,
      visual_assets_copied: 0,
      rollback_manifest_written: false,
      rollback_performed: false,
    },
    activation_decision: null,
    summary: null,
  };
  if (alreadyActive) {
    payload.activation_decision = "persistent_baseline_already_active";
    payload.summary = {
      activation_decision: payload.activation_decision,
      imported_count: 0,
    };
    return payload;
  }
  if (options.execute !== true && options.cli === true) {
    // When invoked from CLI without --execute, require explicit execute flag.
    payload.activation_decision = "blocked_missing_execute_flag";
    payload.safety_summary = {
      activation_requested: false,
      visual_index_written: false,
      visual_assets_copied: false,
      acceptance_baseline_updated: false,
      no_write_operations_invoked: true,
    };
    payload.summary = {
      activation_decision: payload.activation_decision,
      imported_count: 0,
    };
    return payload;
  }
  if (options.execute !== true) {
    payload.activation_decision = Object.values(preconditions).every(Boolean)
      ? "persistent_baseline_activation_ready"
      : "blocked_activation_preconditions_not_ready";
    payload.summary = {
      activation_decision: payload.activation_decision,
      imported_count: 0,
    };
    return payload;
  }
  for (const [name, value] of Object.entries(confirmationGates)) {
    if (!value.accepted) {
      payload.activation_decision = `blocked_by_${name}_gate`;
      payload.summary = {
        activation_decision: payload.activation_decision,
        imported_count: 0,
      };
      return payload;
    }
  }
  if (!Object.values(preconditions).every(Boolean)) {
    payload.activation_decision = "blocked_activation_preconditions_not_ready";
    payload.summary = {
      activation_decision: payload.activation_decision,
      imported_count: 0,
    };
    return payload;
  }

  const createdAt = options.createdAt ?? new Date().toISOString();
  const records = planItems.map((item) => selectedRecord(item, createdAt));
  const nextIndex = Buffer.from(
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  const manifest = {
    rollback_manifest_id: `VLRM-${randomUUID().toUpperCase()}`,
    created_at: createdAt,
    phase: "19H-B",
    selected_set_id: selectedSet.selected_set_id,
    visual_index_before_hash: sha256(indexBefore),
    visual_index_after_hash: sha256(nextIndex),
    copied_assets: planItems.map(
      (item) => normalizeProjectPath(item.target_path_absolute),
    ),
    index_records_added: records.map((record) => record.visual_id),
    source_asset_hashes: Object.fromEntries(
      planItems.map((item) => [item.source_file, item.source_sha256]),
    ),
    rollback_actions: [],
    rollback_completed: false,
  };
  payload.rollback_manifest = manifest;
  const copied = [];
  try {
    for (const item of planItems) {
      await copyAtomic(
        item.source_path,
        item.target_path_absolute,
        item.source_sha256,
      );
      copied.push(item.target_path_absolute);
    }
    await writeAtomic(roots.index, nextIndex);
    payload.write_summary.visual_index_written = true;
    payload.write_summary.visual_assets_copied = copied.length;

    const errors = [];
    const indexAfter = await readFile(roots.index, "utf8");
    const assetsAfter = await directorySnapshot(roots.assets);
    if (
      lineCount(indexAfter)
      !== config.expected_formal_visual_index_non_empty_lines_after
    ) errors.push("visual_index_line_count_mismatch");
    if (
      assetsAfter.filter((item) => item.image).length
      !== config.expected_formal_assets_count_after
    ) errors.push("formal_assets_count_mismatch");
    for (const item of planItems) {
      if (sha256(await readFile(item.target_path_absolute)) !== item.source_sha256) {
        errors.push(`asset_hash_mismatch:${item.source_file}`);
      }
    }
    if (!engineBefore.equals(await readFile(roots.engine))) {
      errors.push("active_engine_changed");
    }
    if (!compressedBefore.equals(await readFile(roots.compressed))) {
      errors.push("compressed_rules_changed");
    }
    if (!snapshotsEqual(approvalBefore, await directorySnapshot(roots.approval))) {
      errors.push("approval_queue_changed");
    }
    if (!snapshotsEqual(canonBefore, await directorySnapshot(roots.canon))) {
      errors.push("canon_db_changed");
    }
    payload.validation_summary = { valid: errors.length === 0, errors };
    if (errors.length > 0) throw new Error("post-write validation failed");
    await writeAtomic(
      roots.manifest,
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    );
    payload.write_summary.rollback_manifest_written = true;
    payload.imported_items = planItems.map((item, index) => ({
      visual_id: records[index].visual_id,
      source_file: item.source_file,
      source_sha256: item.source_sha256,
      target_path: item.target_path,
      target_sha256: item.source_sha256,
    }));
    // canonical top-level success decision
    payload.activation_decision = "visual_library_persistent_baseline_activation_completed";
    // keep legacy short name as a compatibility alias in the summary
    payload.summary = payload.summary ?? {};
    payload.summary.activation_decision_alias = "persistent_baseline_activation_completed";
  } catch (error) {
    const rollbackErrors = [];
    try {
      await writeAtomic(roots.index, indexBefore);
      manifest.rollback_actions.push("restore_visual_index");
    } catch (rollbackError) {
      rollbackErrors.push(`restore_visual_index:${rollbackError.message}`);
    }
    for (const target of [...copied].reverse()) {
      try {
        await rm(target, { force: true });
        manifest.rollback_actions.push(
          `delete_copied_asset:${normalizeProjectPath(target)}`,
        );
      } catch (rollbackError) {
        rollbackErrors.push(`delete_asset:${rollbackError.message}`);
      }
    }
    manifest.rollback_completed = rollbackErrors.length === 0;
    payload.write_summary.rollback_performed = true;
    payload.validation_summary.errors.push(error.message, ...rollbackErrors);
    payload.activation_decision = "failed_activation_rolled_back";
  }
  payload.protected_file_checks = {
    active_engine_unchanged: engineBefore.equals(await readFile(roots.engine)),
    compressed_rules_unchanged:
      compressedBefore.equals(await readFile(roots.compressed)),
    approval_queue_unchanged:
      snapshotsEqual(approvalBefore, await directorySnapshot(roots.approval)),
    canon_db_unchanged:
      snapshotsEqual(canonBefore, await directorySnapshot(roots.canon)),
  };
  payload.summary = {
    activation_decision: payload.activation_decision,
    imported_count: payload.imported_items.length,
    visual_index_non_empty_lines_after:
      lineCount(await readFile(roots.index, "utf8")),
    formal_assets_image_count_after:
      (await directorySnapshot(roots.assets)).filter((item) => item.image).length,
    rollback_manifest_written:
      payload.write_summary.rollback_manifest_written,
  };
  return payload;
}

export default runVisualLibraryPersistentBaselineActivation;
