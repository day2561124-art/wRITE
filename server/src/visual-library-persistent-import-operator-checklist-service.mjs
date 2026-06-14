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
  "visual-library-persistent-import-operator-checklist.json",
);

const pathFields = [
  "formal_visual_index_path",
  "formal_assets_root",
  "formal_intake_root",
  "active_engine_path",
  "compressed_rules_path",
  "approval_queue_root",
];

const confirmationFields = [
  "required_simulation_confirmation_text",
  "required_pre_write_confirmation_text",
  "required_real_import_confirmation_text",
  "required_persistent_baseline_transition_confirmation_text",
];

const requiredFalseFields = [
  "writes_visual_index",
  "copies_visual_assets",
  "updates_acceptance_baseline",
  "updates_active_engine",
  "updates_canon_db",
  "writes_approval_queue",
  "creates_canon_visual_lock",
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
      if (entry.isDirectory()) await walk(absolute);
      else if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        count += 1;
      }
    }
  }
  await walk(root);
  return count;
}

function requiredOperatorSteps(config) {
  return [
    "Prepare 1 to 3 reviewed image files in the formal intake source.",
    "Confirm source identity and source hash.",
    "Confirm category and safe target path.",
    "Run the intake preview.",
    "Run the import simulation.",
    "Run pending import readiness.",
    "Run the final controlled import guard.",
    "Provide every required import confirmation.",
    "Provide the explicit --execute flag only in the future persistent import phase.",
    "Verify visual_index non-empty line count transitions from 0 to N.",
    "Verify the formal assets image count transitions from 0 to N.",
    "Verify every imported asset hash.",
    "Verify active_engine, compressed_rules, Canon DB, and Approval Queue are unchanged.",
    "Retain the rollback manifest and verify rollback remains available.",
    "After acceptance, explicitly confirm the persistent baseline transition.",
  ].map((description, index) => ({
    step: index + 1,
    description,
    required: true,
    preview_only_in_this_phase: true,
    future_import_count_range: index === 0
      ? {
        min: config.min_persistent_import_count,
        max: config.max_persistent_import_count,
      }
      : undefined,
  }));
}

function requiredConfirmationGates(config) {
  return confirmationFields.map((field) => ({
    gate: field.replace(/^required_/u, "").replace(/_text$/u, ""),
    required_text: config[field],
    required: true,
    accepted_in_this_phase: false,
  }));
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
    "write_approval_queue",
    "modify_canon_db",
    "modify_active_engine",
    "modify_compressed_rules",
    "change_mcp_tool_count",
    "create_mcp_write_tool",
  ];
}

export function validateVisualLibraryPersistentImportOperatorChecklistConfig(
  config,
) {
  requireObject(config, "persistent import operator checklist config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19H-Lite") throw new Error("phase must be 19H-Lite.");
  if (
    config.mode
    !== "visual_library_persistent_import_operator_checklist"
  ) {
    throw new Error(
      "mode must be visual_library_persistent_import_operator_checklist.",
    );
  }
  for (const field of [...pathFields, ...confirmationFields]) {
    requireString(config[field], field);
  }
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
  if (config.requires_execute_flag_for_future_persistent_import !== true) {
    throw new Error(
      "requires_execute_flag_for_future_persistent_import must be true.",
    );
  }
  if (config.this_phase_is_preview_only !== true) {
    throw new Error("this_phase_is_preview_only must be true.");
  }
  for (const field of requiredFalseFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryPersistentImportOperatorChecklistConfig(
  options = {},
) {
  if (options.config) {
    return {
      config: validateVisualLibraryPersistentImportOperatorChecklistConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "operator checklist config")
    : defaultConfigPath;
  const config = JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryPersistentImportOperatorChecklistConfig(config),
    config_path: normalizeProjectPath(resolved),
  };
}

export function evaluatePersistentImportOperatorChecklistDecision(input) {
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
  return "persistent_import_operator_checklist_ready";
}

export async function runVisualLibraryPersistentImportOperatorChecklist(
  options = {},
) {
  let loaded;
  try {
    loaded = await loadVisualLibraryPersistentImportOperatorChecklistConfig(
      options,
    );
  } catch (error) {
    return {
      schema_version: 1,
      phase: "19H-Lite",
      mode: "visual_library_persistent_import_operator_checklist",
      preview_only: true,
      source_state: null,
      formal_baseline_state: null,
      required_operator_steps: [],
      required_confirmation_gates: [],
      required_pre_import_checks: [],
      required_post_import_checks: [],
      rollback_requirements: [],
      forbidden_actions: forbiddenActions(),
      next_phase_readiness: {
        ready: false,
        blocked_reasons: ["config_invalid"],
      },
      safety_summary: {
        preview_only: true,
        no_write_operations_invoked: true,
      },
      checklist_decision: "blocked_config_invalid",
      summary: {
        checklist_decision: "blocked_config_invalid",
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
    visualIndexText,
    formalAssetsImageCount,
    intakeExists,
    activeEngineText,
    compressedRulesExists,
    approvalQueueExists,
  ] = await Promise.all([
    readFile(visualIndexPath, "utf8"),
    countImages(assetsRoot),
    pathExists(intakeRoot),
    readFile(activeEnginePath, "utf8"),
    pathExists(compressedRulesPath),
    pathExists(approvalQueueRoot),
  ]);
  const indexExists = await pathExists(visualIndexPath);
  const assetsExists = await pathExists(assetsRoot);
  const engineHash = sha256Lf(activeEngineText);
  const indexLines = nonEmptyLineCount(visualIndexText);
  const decision = evaluatePersistentImportOperatorChecklistDecision({
    config_valid: true,
    forbidden_argument: options.forbiddenArgument ?? null,
    active_engine_hash_matches:
      engineHash === config.expected_engine_sha256_lf,
    formal_visual_index_non_empty_lines: indexLines,
    expected_formal_visual_index_non_empty_lines_before:
      config.expected_formal_visual_index_non_empty_lines_before,
    formal_assets_image_count: formalAssetsImageCount,
    expected_formal_assets_count_before:
      config.expected_formal_assets_count_before,
  });
  const ready = decision === "persistent_import_operator_checklist_ready";
  const sourceState = {
    formal_visual_index_exists: indexExists,
    formal_visual_index_non_empty_lines: indexLines,
    formal_assets_root_exists: assetsExists,
    formal_assets_image_count: formalAssetsImageCount,
    formal_intake_root_exists: intakeExists,
    active_engine_sha256_lf: engineHash,
    active_engine_hash_matches:
      engineHash === config.expected_engine_sha256_lf,
    compressed_rules_path_exists: compressedRulesExists,
    approval_queue_root_exists: approvalQueueExists,
  };
  const formalBaselineState = {
    expected_visual_index_non_empty_lines:
      config.expected_formal_visual_index_non_empty_lines_before,
    actual_visual_index_non_empty_lines: indexLines,
    expected_assets_image_count: config.expected_formal_assets_count_before,
    actual_assets_image_count: formalAssetsImageCount,
    empty_baseline_matches:
      indexLines === config.expected_formal_visual_index_non_empty_lines_before
      && formalAssetsImageCount === config.expected_formal_assets_count_before,
    persistent_baseline_transition_performed: false,
  };
  const payload = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    preview_only: true,
    source_state: sourceState,
    formal_baseline_state: formalBaselineState,
    required_operator_steps: requiredOperatorSteps(config),
    required_confirmation_gates: requiredConfirmationGates(config),
    required_pre_import_checks: [
      "import count is within the configured 1 to 3 item range",
      "intake preview contains only reviewed source files",
      "source hashes match the reviewed files",
      "target paths are safe and unoccupied",
      "formal visual library matches the empty baseline",
      "active engine hash matches the protected expected hash",
      "controlled import guard reports every item ready",
    ],
    required_post_import_checks: [
      "visual_index non-empty line count equals imported item count",
      "formal asset image count equals imported item count",
      "source and target asset hashes match",
      "active_engine and compressed_rules are unchanged",
      "Canon DB and Approval Queue are unchanged",
      "no approval item or canon_visual_lock was created",
      "persistent baseline transition has explicit operator confirmation",
    ],
    rollback_requirements: [
      "rollback manifest exists before persistent baseline acceptance",
      "rollback manifest identifies every copied asset and index record",
      "rollback remains available until post-import validation passes",
      "failed validation must restore the pre-import empty baseline",
    ],
    forbidden_actions: forbiddenActions(),
    next_phase_readiness: {
      ready,
      target_phase: "19H",
      purpose: "persistent_visual_library_import_baseline_transition",
      blocked_reasons: ready ? [] : [decision],
      import_count_range: {
        min: config.min_persistent_import_count,
        max: config.max_persistent_import_count,
      },
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
      mcp_tool_registered: false,
      mcp_tool_count_changed: false,
      no_write_operations_invoked: true,
    },
    checklist_decision: decision,
    summary: null,
  };
  payload.summary = {
    checklist_decision: decision,
    preview_only: true,
    operator_step_count: payload.required_operator_steps.length,
    confirmation_gate_count: payload.required_confirmation_gates.length,
    formal_visual_index_non_empty_lines: indexLines,
    formal_assets_image_count: formalAssetsImageCount,
    active_engine_hash_matches: sourceState.active_engine_hash_matches,
    next_phase_ready: ready,
  };
  return payload;
}

export default runVisualLibraryPersistentImportOperatorChecklist;
