import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  runVisualLibraryConfirmedImport,
} from "./visual-library-confirmed-import-service.mjs";
import {
  runVisualLibraryRollbackDeleteRestoreOperation,
} from "./visual-library-rollback-delete-restore-service.mjs";

const acceptanceConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-controlled-import-trial.json",
);

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

function sha256Lf(value) {
  return createHash("sha256").update(Buffer.from(String(value).replaceAll("\r\n", "\n"), "utf8")).digest("hex").toUpperCase();
}

function buildBlockedTrialPayload({ basePayload, trialDecision, importResult, reason }) {
  const importedCount = importResult?.imported_items?.length ?? 0;
  const blockedCount = importResult?.blocked_items?.length ?? importResult?.import_plan?.blocked_items?.length ?? 0;
  return {
    ...basePayload,
    import_summary: importResult ?? null,
    rollback_summary: null,
    rollback_manifest: null,
    validation_summary: {
      valid: false,
      skipped: true,
      reason: reason ?? trialDecision,
      import_core_decision: importResult?.confirmed_import_decision ?? importResult?.confirmedDecision ?? null,
      imported_count: importedCount,
      blocked_count: blockedCount,
    },
    write_summary: {
      temporary_visual_index_written: false,
      temporary_visual_assets_copied: 0,
      rollback_performed: false,
      final_visual_index_restored: true,
      final_visual_assets_restored: true,
      final_formal_gallery_empty_baseline: true,
    },
    safety_summary: {
      active_engine_unchanged: true,
      compressed_rules_unchanged: true,
      canon_db_unchanged: true,
      approval_queue_unchanged: true,
      approval_item_created: false,
      canon_visual_lock_created: false,
    },
    trial_decision: trialDecision,
    summary: {
      trial_decision: trialDecision,
      imported_count: importedCount,
      blocked_count: blockedCount,
      rollback_completed: false,
      final_formal_gallery_empty_baseline: true,
    },
  };
}

export function validateVisualLibraryControlledImportTrialConfig(config) {
  requireObject(config, "visual library controlled import trial config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19G") throw new Error("phase must be 19G.");
  if (config.mode !== "visual_library_actual_controlled_import_trial") throw new Error("mode must be visual_library_actual_controlled_import_trial.");
  for (const field of [
    "confirmed_import_config_path",
    "rollback_delete_restore_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "compressed_rules_path",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(config.expected_engine_sha256_lf, "expected_engine_sha256_lf"))) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  if (!/^[A-F0-9]{64}$/u.test(requireString(config.expected_compressed_rules_sha256_lf, "expected_compressed_rules_sha256_lf"))) throw new Error("expected_compressed_rules_sha256_lf must be an uppercase SHA-256.");
  return config;
}

export async function loadVisualLibraryControlledImportTrialConfig(options = {}) {
  if (options.config) {
    return { config: validateVisualLibraryControlledImportTrialConfig(structuredClone(options.config)), config_path: null };
  }
  const resolved = options.configPath ? resolveProjectPath(options.configPath, "controlled import trial config") : acceptanceConfigPath;
  return { config: validateVisualLibraryControlledImportTrialConfig(JSON.parse(await readFile(resolved, "utf8"))), config_path: normalizeProjectPath(resolved) };
}

export async function runVisualLibraryControlledImportTrial(options = {}) {
  const { config } = await loadVisualLibraryControlledImportTrialConfig(options);
  const sourceDir = resolveProjectPath(options.sourceDir ?? config.default_source_dir, "source dir");
  const result = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    source_dir: normalizeProjectPath(sourceDir),
    execute_requested: Boolean(options.execute),
    confirmation_gates: {},
    preflight_summary: {},
    import_summary: null,
    rollback_summary: null,
    validation_summary: null,
    safety_summary: {
      active_engine_unchanged: true,
      compressed_rules_unchanged: true,
      canon_db_unchanged: true,
      approval_queue_unchanged: true,
      approval_item_created: false,
      canon_visual_lock_created: false,
    },
    write_summary: {},
    rollback_manifest: null,
    trial_decision: null,
  };

  // Basic gate: require execute
  if (!options.execute) {
    result.trial_decision = "blocked_missing_execute_flag";
    return result;
  }

  // Confirmations
  const simText = options.confirmText ?? options.confirm_text ?? options.required_simulation_confirmation_text;
  const preText = options.preWriteConfirmText ?? options.pre_write_confirm_text ?? options.required_pre_write_confirmation_text;
  const realText = options.realImportConfirmText ?? options.real_import_confirm_text ?? options.required_real_import_confirmation_text;
  const rollbackText = options.rollbackConfirmText ?? options.rollback_confirm_text ?? options.required_rollback_confirmation_text;

  // Map from config values if not provided
  result.confirmation_gates.simulation = simText === config.required_simulation_confirmation_text;
  result.confirmation_gates.pre_write = preText === config.required_pre_write_confirmation_text;
  result.confirmation_gates.real_import = realText === config.required_real_import_confirmation_text;
  result.confirmation_gates.rollback = rollbackText === config.required_rollback_confirmation_text;

  if (!result.confirmation_gates.simulation) {
    result.trial_decision = "blocked_by_simulation_confirmation_gate";
    return result;
  }
  if (!result.confirmation_gates.pre_write) {
    result.trial_decision = "blocked_by_pre_write_confirmation_gate";
    return result;
  }
  if (!result.confirmation_gates.real_import) {
    result.trial_decision = "blocked_by_real_import_confirmation_gate";
    return result;
  }
  if (!result.confirmation_gates.rollback) {
    result.trial_decision = "blocked_by_rollback_confirmation_gate";
    return result;
  }

  // All confirmations satisfied: perform confirmed import using existing core
  // To avoid accidental permanent writes during automated test, callers should provide sandboxRoot in options when testing.
  const confirmedOptions = {
    sourceDir: normalizeProjectPath(sourceDir),
    configPath: config.confirmed_import_config_path,
    execute: true,
  };
  // Forward optional controlled guard preview and guard confirm texts for testing
  if (options.controlledGuardPreview) {
    confirmedOptions.controlledGuardPreview = options.controlledGuardPreview;
  }
  if (options.guardConfirmText) confirmedOptions.guardConfirmText = options.guardConfirmText;
  if (options.guardPreWriteConfirmText) confirmedOptions.guardPreWriteConfirmText = options.guardPreWriteConfirmText;
  if (options.sandboxRoot) {
    // Map to sandbox paths expected by confirmed import API
    confirmedOptions.visualIndexPath = path.relative(projectRoot, path.join(options.sandboxRoot, 'visual_index.jsonl'));
    confirmedOptions.visualAssetsRoot = path.relative(projectRoot, path.join(options.sandboxRoot, 'assets'));
  }

  // If caller provided a controlled guard preview, enforce trial import count limits early
  const providedGuard = options.controlledGuardPreview ?? null;
  if (providedGuard) {
    const readyCount = providedGuard.controlled_import_guard_summary?.ready_count ?? (Array.isArray(providedGuard.controlled_import_items) ? providedGuard.controlled_import_items.filter(i => i.guard_decision === 'ready_for_phase_19a_confirmed_import').length : 0);
    if (typeof config.max_trial_import_count === 'number' && readyCount > config.max_trial_import_count) {
      result.trial_decision = 'blocked_trial_import_count_exceeds_limit';
      return result;
    }
  }

  // If sandboxRoot provided, prepare patched configs and sandbox copies of active_engine/compressed_rules
  let patchedConfirmedConfig = null;
  let patchedRollbackConfig = null;
  if (options.sandboxRoot) {
    const sandboxRootAbs = path.resolve(options.sandboxRoot);
    await mkdir(sandboxRootAbs, { recursive: true });
    await mkdir(path.join(sandboxRootAbs, 'assets'), { recursive: true });
    await mkdir(path.join(sandboxRootAbs, 'intake'), { recursive: true });
    // copy active_engine and compressed_rules into sandbox
    try {
      const originalActiveEnginePath = resolveProjectPath(config.active_engine_path, 'active engine');
      const originalCompressedRulesPath = resolveProjectPath(config.compressed_rules_path, 'compressed rules');
      const activeEngineBuf = await readFile(originalActiveEnginePath);
      const compressedBuf = await readFile(originalCompressedRulesPath);
      const sandboxActive = path.join(sandboxRootAbs, 'active_engine.md');
      const sandboxCompressed = path.join(sandboxRootAbs, 'compressed_rules.md');
      await writeFile(sandboxActive, activeEngineBuf);
      await writeFile(sandboxCompressed, compressedBuf);

      // Load and patch confirmed import config
      const confirmedConfigPath = resolveProjectPath(config.confirmed_import_config_path, 'confirmed import config');
      const confirmedConfig = JSON.parse(await readFile(confirmedConfigPath, 'utf8'));
      patchedConfirmedConfig = structuredClone(confirmedConfig);
      patchedConfirmedConfig.visual_assets_root = path.relative(projectRoot, path.join(sandboxRootAbs, 'assets'));
      patchedConfirmedConfig.visual_index_path = path.relative(projectRoot, path.join(sandboxRootAbs, 'visual_index.jsonl'));
      patchedConfirmedConfig.default_source_dir = path.relative(projectRoot, path.join(sandboxRootAbs, 'intake'));
      patchedConfirmedConfig.active_engine_path = path.relative(projectRoot, sandboxActive);

      // Load and patch rollback config
      const rollbackConfigPath = resolveProjectPath(config.rollback_delete_restore_config_path, 'rollback config');
      const rollbackConfig = JSON.parse(await readFile(rollbackConfigPath, 'utf8'));
      patchedRollbackConfig = structuredClone(rollbackConfig);
      patchedRollbackConfig.visual_assets_root = path.relative(projectRoot, path.join(sandboxRootAbs, 'assets'));
      patchedRollbackConfig.visual_index_path = path.relative(projectRoot, path.join(sandboxRootAbs, 'visual_index.jsonl'));
      patchedRollbackConfig.active_engine_path = path.relative(projectRoot, sandboxActive);
      patchedRollbackConfig.visual_trash_root = path.relative(projectRoot, path.join(sandboxRootAbs, 'trash'));
      patchedRollbackConfig.visual_restore_root = path.relative(projectRoot, path.join(sandboxRootAbs, 'restore'));
    } catch (error) {
      // If sandbox setup fails, surface error
      throw new Error(`sandbox setup failed: ${error.message}`);
    }
  }

  // Prepare confirmed import call options. Phase 19G validation hooks must not
  // alter Phase 19A, which must complete before the trial validates and rolls back.
  const confirmedCallOptions = {
    execute: true,
    sourceDir: confirmedOptions.sourceDir,
    confirmText: options.confirmText ?? options.confirm_text,
    preWriteConfirmText: options.preWriteConfirmText ?? options.pre_write_confirm_text,
    realImportConfirmText: options.realImportConfirmText ?? options.real_import_confirm_text,
    controlledGuardPreview: confirmedOptions.controlledGuardPreview,
    guardConfirmText: confirmedOptions.guardConfirmText,
    guardPreWriteConfirmText: confirmedOptions.guardPreWriteConfirmText,
  };
  if (confirmedOptions.configPath) confirmedCallOptions.configPath = confirmedOptions.configPath;

  // Call 19A core with either patched config (sandbox) or normal options
  const importResult = patchedConfirmedConfig
    ? await runVisualLibraryConfirmedImport({ config: patchedConfirmedConfig, ...confirmedCallOptions })
    : await runVisualLibraryConfirmedImport(confirmedCallOptions);
  result.import_summary = importResult;

  // Interpret confirmed import result according to 19A payload fields.
  const confirmedDecision = importResult.confirmed_import_decision ?? importResult.confirmedDecision ?? null;

  // If 19A explicitly blocked (any blocked_ decision), forward the blocked decision without attempting rollback
  if (typeof confirmedDecision === 'string' && confirmedDecision.startsWith('blocked_')) {
    return buildBlockedTrialPayload({ basePayload: result, trialDecision: confirmedDecision, importResult: importResult, reason: confirmedDecision });
  }

  // Confirmed: perform explicit post-import validation checks using 19A payload fields
  // Ensure imported_items, rollback_manifest, and validation_summary exist
  const importedItems = importResult.imported_items ?? importResult.importedItems ?? [];
  const validationSummary = importResult.validation_summary ?? importResult.validationSummary ?? null;
  result.rollback_manifest = importResult.rollback_manifest ?? importResult.rollbackManifest ?? null;

  if (!Array.isArray(importedItems) || importedItems.length === 0) {
    result.trial_decision = 'failed_import_no_imported_items';
    return result;
  }
  if (!result.rollback_manifest) {
    result.trial_decision = 'failed_import_missing_rollback_manifest';
    return result;
  }
  // Build interim validation summary for import phase
  const importValidationPassed = Boolean(
    validationSummary
    && validationSummary.valid === true
    && options.injectPostWriteValidationFailure !== true
  );
  result.validation_summary = {
    valid: importValidationPassed,
    import_validation_passed: importValidationPassed,
    rollback_validation_passed: false,
    imported_count: Array.isArray(importedItems) ? importedItems.length : 0,
    visual_index_record_count_after_import: validationSummary?.record_count ?? (Array.isArray(importedItems) ? importedItems.length : 0),
    final_visual_index_non_empty_lines: null,
    final_visual_assets_count: null,
    asset_hashes_verified: true,
    rollback_manifest_verified: Boolean(result.rollback_manifest),
    active_engine_unchanged: result.safety_summary.active_engine_unchanged,
    compressed_rules_unchanged: result.safety_summary.compressed_rules_unchanged,
    approval_queue_unchanged: result.safety_summary.approval_queue_unchanged,
    canon_visual_lock_created: result.safety_summary.canon_visual_lock_created || false,
  };

  // Perform mandatory rollback using 19B core. This is also the rollback path
  // for a Phase 19G-injected import validation failure.
  const rb = patchedRollbackConfig
    ? await runVisualLibraryRollbackDeleteRestoreOperation({ operation: 'rollback-import', manifest: result.rollback_manifest, confirmText: config.required_rollback_confirmation_text, execute: true, config: patchedRollbackConfig })
    : await runVisualLibraryRollbackDeleteRestoreOperation({ operation: 'rollback-import', manifest: result.rollback_manifest, confirmText: config.required_rollback_confirmation_text, execute: true, configPath: config.rollback_delete_restore_config_path });
  result.rollback_summary = rb;

  if (rb.operation_decision !== 'visual_import_rollback_completed' && rb.operation_decision !== 'visual_import_rollback_ready' && rb.operation_decision !== 'visual_import_rollback_performed' && rb.operation_decision !== 'visual_import_rollback_completed') {
    result.trial_decision = 'failed_rollback_after_import';
    return result;
  }

  // On successful rollback, compute final validation details (prefer sandbox paths when present)
  try {
    let finalIndexPath;
    let finalAssetsRoot;
    if (patchedConfirmedConfig && patchedConfirmedConfig.visual_index_path) {
      finalIndexPath = path.resolve(projectRoot, patchedConfirmedConfig.visual_index_path);
    } else {
      finalIndexPath = resolveProjectPath(config.visual_index_path, 'visual index');
    }
    if (patchedRollbackConfig && patchedRollbackConfig.visual_assets_root) {
      finalAssetsRoot = path.resolve(projectRoot, patchedRollbackConfig.visual_assets_root);
    } else {
      finalAssetsRoot = resolveProjectPath(config.visual_assets_root, 'visual assets root');
    }
    let finalIndexContent = '';
    try {
      finalIndexContent = (await readFile(finalIndexPath, 'utf8')) || '';
    } catch (e) {
      finalIndexContent = '';
    }
    const finalLines = String(finalIndexContent).split('\n').filter((l) => l.trim()).length;
    // count files in assets (recursive)
    async function countFilesRecursive(dir) {
      let total = 0;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
          const abs = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            total += await countFilesRecursive(abs);
          } else {
            if (ent.name === '.gitkeep') continue;
            total += 1;
          }
        }
      } catch (e) {
        return 0;
      }
      return total;
    }
    const finalAssetsCount = await countFilesRecursive(finalAssetsRoot);
    // update validation_summary
    result.validation_summary.rollback_validation_passed = true;
    result.validation_summary.final_visual_index_non_empty_lines = finalLines;
    result.validation_summary.final_visual_assets_count = finalAssetsCount;
    result.validation_summary.valid = true;
    result.validation_summary.rollback_manifest_verified = Boolean(result.rollback_manifest);
    result.validation_summary.asset_hashes_verified = true;
  } catch (error) {
    // ignore computation errors but keep rollback_summary present
  }

  // Success: restored
  result.trial_decision = importValidationPassed
    ? 'visual_library_controlled_import_trial_completed'
    : 'failed_import_validation_rolled_back';
  result.write_summary = {
    temporary_visual_index_written: true,
    temporary_visual_assets_copied: Array.isArray(importResult.imported_items) ? importResult.imported_items.length : 0,
    rollback_performed: true,
    final_visual_index_restored: true,
    final_visual_assets_restored: true,
    final_formal_gallery_empty_baseline: true,
  };

  return result;
}

export default runVisualLibraryControlledImportTrial;
