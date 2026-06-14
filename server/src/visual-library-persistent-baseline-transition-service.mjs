import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

const defaultConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-persistent-baseline-transition.json",
);

const requiredPathFields = [
  "formal_visual_index_path",
  "formal_assets_root",
  "formal_intake_root",
  "active_engine_path",
  "compressed_rules_path",
  "approval_queue_root",
];

const requiredFalseFields = [
  "this_phase_writes_visual_index",
  "this_phase_copies_visual_assets",
  "this_phase_updates_acceptance_baseline",
  "this_phase_updates_active_engine",
  "this_phase_updates_canon_db",
  "this_phase_writes_approval_queue",
  "this_phase_creates_mcp_write_tool",
];

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

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256Lf(value) {
  return createHash("sha256")
    .update(normalizeLf(value), "utf8")
    .digest("hex")
    .toUpperCase();
}

function nonEmptyLineCount(value) {
  return normalizeLf(value).split("\n").filter((line) => line.trim()).length;
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

async function countImages(root) {
  let count = 0;
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        count += 1;
      }
    }
  }
  await walk(root);
  return count;
}

function requiredConfirmationGates(config) {
  return [
    {
      gate: "simulation_confirmation",
      required_text: "確認模擬視覺匯入",
    },
    {
      gate: "pre_write_confirmation",
      required_text: "確認進入視覺正式匯入準備",
    },
    {
      gate: "real_import_confirmation",
      required_text: "確認執行視覺正式匯入",
    },
    {
      gate: "persistent_baseline_transition_confirmation",
      required_text: config.required_transition_confirmation_text,
    },
  ].map((gate) => ({
    ...gate,
    required: true,
    accepted_in_this_phase: false,
  }));
}

function requiredInputs(config) {
  return [
    {
      input: "formal_image_files",
      requirement:
        `${config.min_persistent_import_count} to `
        + `${config.max_persistent_import_count} reviewed image files`,
    },
    { input: "intended_category", requirement: "one category per image" },
    {
      input: "visual_metadata",
      requirement: "title, description, and tags for every image",
    },
    { input: "target_path", requirement: "safe unoccupied path per image" },
    { input: "sha256", requirement: "uppercase SHA-256 per image" },
    {
      input: "controlled_guard_result",
      requirement: "all items ready for confirmed import",
    },
    {
      input: "import_simulation_result",
      requirement: "simulation passes with no blocked items",
    },
    {
      input: "rollback_manifest",
      requirement: "covers every asset and visual_index record",
    },
    {
      input: "baseline_update_confirmation",
      requirement: config.required_transition_confirmation_text,
    },
  ];
}

function acceptanceUpdatePlan() {
  return [
    {
      target: "final_e2e_acceptance",
      planned_change:
        "replace the fixed visual gallery record count of 0 with the configured persistent baseline count",
    },
    {
      target: "ui_server_contract",
      planned_change:
        "replace the fixed Visual gallery records checked value of 0 with the configured persistent baseline count",
    },
    {
      target: "visual_index_jsonl_validator",
      planned_change: "accept and validate N formal visual records",
    },
    {
      target: "visual_asset_reindex",
      planned_change: "require reindexed assets to align with visual_index",
    },
    {
      target: "phase_19f_mcp_readonly_visual_library_tool",
      planned_change: "verify the existing read-only tool can return N records",
    },
    {
      target: "rollback_delete_restore_tests",
      planned_change:
        "keep write-path tests sandboxed so they never damage the formal persistent baseline",
    },
  ].map((item) => ({
    ...item,
    apply_in_this_phase: false,
    apply_in_future_phase: "19H-B",
  }));
}

function rollbackPlan() {
  return {
    trigger_conditions: [
      "post_write_validation_failed",
      "asset_hash_mismatch",
      "visual_index_line_count_mismatch",
      "target_occupied",
      "active_engine_hash_changed",
      "compressed_rules_changed",
      "approval_queue_changed_unexpectedly",
      "canon_db_changed_unexpectedly",
      "mcp_tools_count_changed",
    ],
    required_restoration_state: [
      "visual_index_restored_to_previous_baseline",
      "visual_assets_restored_to_previous_baseline",
      "active_engine_unchanged",
      "compressed_rules_unchanged",
      "approval_queue_unchanged",
      "canon_db_unchanged",
    ],
    rollback_executes_in_this_phase: false,
    rollback_manifest_required_for_future_activation: true,
  };
}

function forbiddenActions() {
  return [
    "execute",
    "import",
    "rollback",
    "delete",
    "restore",
    "write_visual_index",
    "copy_assets",
    "update_acceptance_baseline",
    "modify_active_engine",
    "modify_canon_db",
    "modify_compressed_rules",
    "write_approval_queue",
    "create_mcp_write_tool",
  ];
}

function controlledImportState(result) {
  const importedItems = result?.imported_items ?? [];
  const planReadyItems = result?.import_plan?.ready_items ?? [];
  const planBlockedItems = result?.import_plan?.blocked_items ?? [];
  return {
    provided: Boolean(result),
    confirmed_import_decision:
      result?.confirmed_import_decision ?? null,
    imported_item_count:
      Array.isArray(importedItems) ? importedItems.length : 0,
    planned_ready_item_count:
      Array.isArray(planReadyItems) ? planReadyItems.length : 0,
    planned_blocked_item_count:
      Array.isArray(planBlockedItems) ? planBlockedItems.length : 0,
    rollback_manifest_present: Boolean(result?.rollback_manifest),
    usable_for_future_activation: Boolean(
      result
      && result.confirmed_import_decision === "confirmed_visual_import_completed"
      && Array.isArray(importedItems)
      && importedItems.length > 0
      && result.rollback_manifest
    ),
  };
}

export function validateVisualLibraryPersistentBaselineTransitionConfig(config) {
  requireObject(config, "persistent baseline transition config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19H-A") throw new Error("phase must be 19H-A.");
  if (
    config.mode !== "visual_library_persistent_baseline_transition_tooling"
  ) {
    throw new Error(
      "mode must be visual_library_persistent_baseline_transition_tooling.",
    );
  }
  if (config.preview_only !== true) {
    throw new Error("preview_only must be true.");
  }
  for (const field of requiredPathFields) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  for (const field of [
    "expected_formal_visual_index_non_empty_lines_before",
    "expected_formal_assets_count_before",
    "min_persistent_import_count",
    "max_persistent_import_count",
  ]) requireNonNegativeInteger(config[field], field);
  if (config.min_persistent_import_count < 1) {
    throw new Error("min_persistent_import_count must be at least 1.");
  }
  if (config.max_persistent_import_count < config.min_persistent_import_count) {
    throw new Error(
      "max_persistent_import_count must be greater than or equal to min_persistent_import_count.",
    );
  }
  if (requireString(config.future_phase, "future_phase") !== "19H-B") {
    throw new Error("future_phase must be 19H-B.");
  }
  requireString(
    config.required_transition_confirmation_text,
    "required_transition_confirmation_text",
  );
  if (config.required_execute_flag_for_future_activation !== true) {
    throw new Error(
      "required_execute_flag_for_future_activation must be true.",
    );
  }
  for (const field of requiredFalseFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryPersistentBaselineTransitionConfig(
  options = {},
) {
  if (options.config) {
    return {
      config: validateVisualLibraryPersistentBaselineTransitionConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "persistent baseline config")
    : defaultConfigPath;
  const config = JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryPersistentBaselineTransitionConfig(config),
    config_path: normalizeProjectPath(resolved),
  };
}

export function evaluatePersistentBaselineTransitionDecision(input) {
  if (input.config_valid === false) return "blocked_config_invalid";
  if (input.forbidden_argument) return "blocked_forbidden_argument";
  if (!input.active_engine_hash_matches) {
    return "blocked_active_engine_hash_mismatch";
  }
  if (
    input.formal_visual_index_non_empty_lines
    !== input.expected_formal_visual_index_non_empty_lines_before
  ) return "blocked_formal_visual_index_not_empty";
  if (
    input.formal_assets_image_count
    !== input.expected_formal_assets_count_before
  ) return "blocked_formal_assets_not_empty";
  return "persistent_baseline_transition_tooling_ready";
}

export async function runVisualLibraryPersistentBaselineTransitionPreview(
  options = {},
) {
  let loaded;
  try {
    loaded = await loadVisualLibraryPersistentBaselineTransitionConfig(options);
  } catch (error) {
    return {
      schema_version: 1,
      phase: "19H-A",
      mode: "visual_library_persistent_baseline_transition_tooling",
      preview_only: true,
      source_state: null,
      current_formal_baseline: null,
      proposed_future_baseline: null,
      required_inputs_for_phase_19h_b: [],
      required_confirmation_gates: [],
      acceptance_update_plan: [],
      rollback_plan: rollbackPlan(),
      protected_file_checks: null,
      forbidden_actions: forbiddenActions(),
      next_phase_readiness: {
        ready: false,
        future_phase: "19H-B",
        blocked_reasons: ["blocked_config_invalid"],
      },
      transition_decision: "blocked_config_invalid",
      summary: {
        transition_decision: "blocked_config_invalid",
        error: error.message,
      },
    };
  }

  const { config, config_path: loadedConfigPath } = loaded;
  const visualIndexPath = resolveProjectPath(
    config.formal_visual_index_path,
    "formal visual index",
  );
  const assetsRoot = resolveProjectPath(
    config.formal_assets_root,
    "formal visual assets",
  );
  const intakeRoot = resolveProjectPath(
    config.formal_intake_root,
    "formal visual intake",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine",
  );
  const compressedRulesPath = resolveProjectPath(
    config.compressed_rules_path,
    "compressed rules",
  );
  const approvalQueueRoot = resolveProjectPath(
    config.approval_queue_root,
    "Approval Queue",
  );

  const [
    visualIndexExists,
    visualIndexText,
    assetsRootExists,
    assetsImageCount,
    intakeRootExists,
    activeEngineText,
    compressedRulesExists,
    approvalQueueExists,
  ] = await Promise.all([
    pathExists(visualIndexPath),
    readFile(visualIndexPath, "utf8"),
    pathExists(assetsRoot),
    countImages(assetsRoot),
    pathExists(intakeRoot),
    readFile(activeEnginePath, "utf8"),
    pathExists(compressedRulesPath),
    pathExists(approvalQueueRoot),
  ]);
  const indexLines = nonEmptyLineCount(visualIndexText);
  const engineHash = sha256Lf(activeEngineText);
  const engineHashMatches = engineHash === config.expected_engine_sha256_lf;
  const decision = evaluatePersistentBaselineTransitionDecision({
    config_valid: true,
    forbidden_argument: options.forbiddenArgument ?? null,
    active_engine_hash_matches: engineHashMatches,
    formal_visual_index_non_empty_lines: indexLines,
    expected_formal_visual_index_non_empty_lines_before:
      config.expected_formal_visual_index_non_empty_lines_before,
    formal_assets_image_count: assetsImageCount,
    expected_formal_assets_count_before:
      config.expected_formal_assets_count_before,
  });
  const ready = decision === "persistent_baseline_transition_tooling_ready";
  const importState = controlledImportState(options.controlledImportResult);
  const nextPhaseReady = ready && importState.usable_for_future_activation;

  const payload = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    preview_only: true,
    source_state: {
      formal_visual_index_exists: visualIndexExists,
      formal_visual_index_non_empty_lines: indexLines,
      formal_assets_root_exists: assetsRootExists,
      formal_assets_image_count: assetsImageCount,
      formal_intake_root_exists: intakeRootExists,
      active_engine_sha256_lf: engineHash,
      active_engine_hash_matches: engineHashMatches,
      compressed_rules_path_exists: compressedRulesExists,
      approval_queue_root_exists: approvalQueueExists,
      controlled_import_result: importState,
    },
    current_formal_baseline: {
      expected_visual_index_non_empty_lines:
        config.expected_formal_visual_index_non_empty_lines_before,
      actual_visual_index_non_empty_lines: indexLines,
      expected_assets_image_count: config.expected_formal_assets_count_before,
      actual_assets_image_count: assetsImageCount,
      empty_baseline_matches:
        indexLines
          === config.expected_formal_visual_index_non_empty_lines_before
        && assetsImageCount === config.expected_formal_assets_count_before,
    },
    proposed_future_baseline: {
      from_visual_index_non_empty_lines: 0,
      from_assets_count: 0,
      to_visual_index_non_empty_lines: "N where 1 <= N <= 3",
      to_assets_count: "N where 1 <= N <= 3",
      requires_real_image_files: true,
      requires_asset_hash_validation: true,
      requires_acceptance_baseline_update: true,
      applied_in_this_phase: false,
    },
    required_inputs_for_phase_19h_b: requiredInputs(config),
    required_confirmation_gates: requiredConfirmationGates(config),
    acceptance_update_plan: acceptanceUpdatePlan(),
    rollback_plan: rollbackPlan(),
    protected_file_checks: {
      active_engine_hash_expected: config.expected_engine_sha256_lf,
      active_engine_hash_actual: engineHash,
      active_engine_hash_matches: engineHashMatches,
      active_engine_must_remain_unchanged: true,
      compressed_rules_path_exists: compressedRulesExists,
      compressed_rules_must_remain_unchanged: true,
      approval_queue_root_exists: approvalQueueExists,
      approval_queue_must_remain_unchanged: true,
      canon_db_must_remain_unchanged: true,
      mcp_tool_count_must_remain_unchanged: true,
    },
    forbidden_actions: forbiddenActions(),
    next_phase_readiness: {
      ready: nextPhaseReady,
      transition_tooling_ready: ready,
      future_phase: config.future_phase,
      blocked_reasons: !ready
        ? [decision]
        : nextPhaseReady
          ? []
          : ["controlled_import_result_not_provided_or_not_usable"],
      requires_controlled_import_result: true,
      controlled_import_result_currently_usable:
        importState.usable_for_future_activation,
      requires_human_confirmation: true,
      required_transition_confirmation_text:
        config.required_transition_confirmation_text,
      requires_execute_flag: config.required_execute_flag_for_future_activation,
    },
    safety_summary: {
      preview_only: true,
      execute_accepted: false,
      import_executed: false,
      rollback_executed: false,
      visual_index_written: false,
      visual_assets_copied: false,
      acceptance_baseline_updated: false,
      active_engine_updated: false,
      canon_db_updated: false,
      compressed_rules_updated: false,
      approval_queue_written: false,
      approval_item_created: false,
      canon_visual_lock_created: false,
      mcp_write_tool_created: false,
      mcp_tool_count_changed: false,
      no_write_operations_invoked: true,
    },
    transition_decision: decision,
    summary: null,
  };
  payload.summary = {
    transition_decision: decision,
    preview_only: true,
    current_visual_index_non_empty_lines: indexLines,
    current_assets_image_count: assetsImageCount,
    future_import_count_min: config.min_persistent_import_count,
    future_import_count_max: config.max_persistent_import_count,
    confirmation_gate_count: payload.required_confirmation_gates.length,
    acceptance_update_count: payload.acceptance_update_plan.length,
    rollback_trigger_count: payload.rollback_plan.trigger_conditions.length,
    active_engine_hash_matches: engineHashMatches,
    next_phase_ready: nextPhaseReady,
  };
  return payload;
}

export default runVisualLibraryPersistentBaselineTransitionPreview;
