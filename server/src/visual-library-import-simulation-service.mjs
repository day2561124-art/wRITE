import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  scanVisualLibraryIntakePreview,
} from "./visual-library-rebuild-intake-service.mjs";

const simulationConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-import-simulation.json",
);

const noWriteFlags = [
  "writes_visual_index",
  "writes_visual_assets",
  "copies_files",
  "moves_files",
  "deletes_files",
  "updates_active_engine",
  "updates_canon_db",
  "writes_approval_queue",
  "creates_approval_item",
  "creates_canon_visual_lock",
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

function requireStringArray(value, label) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`${label} must be a non-empty array.`);
  }
  for (const item of value) requireString(item, `${label} item`);
  return value;
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

function stableId(prefix, seed) {
  return `${prefix}${createHash("sha256")
    .update(seed, "utf8")
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()}`;
}

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function noWriteSummary() {
  return {
    writes_visual_index: false,
    writes_visual_assets: false,
    copies_files: false,
    moves_files: false,
    deletes_files: false,
    updates_active_engine: false,
    updates_canon_db: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
  };
}

function riskForDecision(decision) {
  if (
    decision === "blocked_unsafe_target_path"
    || decision === "blocked_missing_source_file"
  ) {
    return "high";
  }
  if (
    decision === "blocked_requires_manual_category_review"
    || decision === "blocked_duplicate_requires_manual_review"
    || decision === "rejected_unsupported_extension"
  ) {
    return "medium";
  }
  return "low";
}

function aggregateRisk(operations) {
  if (operations.some((operation) => operation.risk_summary.risk_level === "high")) {
    return "high";
  }
  if (operations.some((operation) => operation.risk_summary.risk_level === "medium")) {
    return "medium";
  }
  return "low";
}

export function validateVisualLibraryImportSimulationConfig(config) {
  requireObject(config, "visual library import simulation config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18C") throw new Error("phase must be 18C.");
  if (config.mode !== "read_only_visual_library_import_simulation_confirm_gate") {
    throw new Error(
      "mode must be read_only_visual_library_import_simulation_confirm_gate.",
    );
  }
  requireString(config.intake_config_path, "intake_config_path");
  requireString(config.default_source_dir, "default_source_dir");
  requireString(config.visual_assets_root, "visual_assets_root");
  requireString(config.visual_index_path, "visual_index_path");
  requireString(config.active_engine_path, "active_engine_path");
  const expectedHash = requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  );
  if (!/^[A-F0-9]{64}$/u.test(expectedHash)) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  requireString(config.required_confirmation_text, "required_confirmation_text");
  const categories = requireStringArray(config.allowed_categories, "allowed_categories");
  const expectedCategories = [
    "characters",
    "armed_forms",
    "abilities",
    "expressions",
    "outfits",
    "scenes",
  ];
  if (JSON.stringify(categories) !== JSON.stringify(expectedCategories)) {
    throw new Error(`allowed_categories must be ${expectedCategories.join(", ")}.`);
  }
  if (config.read_only !== true) throw new Error("read_only must be true.");
  if (config.simulation_only !== true) throw new Error("simulation_only must be true.");
  if (config.preview_only !== true) throw new Error("preview_only must be true.");
  for (const flag of noWriteFlags) {
    if (config[flag] !== false) throw new Error(`${flag} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryImportSimulationConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryImportSimulationConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(options.configPath, "visual library import simulation config")
    : simulationConfigPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryImportSimulationConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function evaluateVisualImportConfirmationGate(config, confirmationText) {
  const provided = typeof confirmationText === "string"
    && confirmationText.length > 0;
  const accepted = provided
    && confirmationText === config.required_confirmation_text;
  return {
    required_confirmation_text: config.required_confirmation_text,
    provided,
    accepted,
    decision: accepted
      ? "simulated_confirmation_accepted"
      : "locked_by_confirmation_gate",
  };
}

export function validateVisualImportTargetPath(candidate, config) {
  const proposedPath = typeof candidate === "string"
    ? candidate
    : candidate.proposed_target_path;
  const category = typeof candidate === "string"
    ? null
    : candidate.category_candidate;
  if (typeof proposedPath !== "string" || !proposedPath.trim()) {
    return {
      valid: false,
      reason: "missing_proposed_target_path",
      normalized_path: null,
    };
  }
  try {
    const assetsRoot = resolveProjectPath(
      config.visual_assets_root,
      "visual assets root",
    );
    const resolvedTarget = resolveProjectPath(
      proposedPath,
      "proposed visual import target path",
    );
    if (!isInside(assetsRoot, resolvedTarget)) {
      return {
        valid: false,
        reason: "target_outside_visual_assets_root",
        normalized_path: normalizeProjectPath(resolvedTarget),
      };
    }
    if (!category || !config.allowed_categories.includes(category)) {
      return {
        valid: false,
        reason: "target_category_not_allowed",
        normalized_path: normalizeProjectPath(resolvedTarget),
      };
    }
    const categoryRoot = path.join(assetsRoot, category);
    if (!isInside(categoryRoot, resolvedTarget) || resolvedTarget === categoryRoot) {
      return {
        valid: false,
        reason: "target_outside_category_directory",
        normalized_path: normalizeProjectPath(resolvedTarget),
      };
    }
    return {
      valid: true,
      reason: null,
      normalized_path: normalizeProjectPath(resolvedTarget),
    };
  } catch (error) {
    return {
      valid: false,
      reason: "target_path_resolution_failed",
      normalized_path: null,
      detail: error.message,
    };
  }
}

export function buildProposedVisualIndexRecord(candidate) {
  requireObject(candidate, "visual intake candidate");
  return {
    visual_id: candidate.proposed_visual_id,
    created_at: null,
    character: "unknown",
    category: candidate.category_candidate,
    title: path.basename(candidate.file_name, candidate.extension),
    canon_status: "reference",
    trust_level: "T7",
    source: "visual_library_import_simulation",
    status: "simulated_only",
    path: candidate.proposed_target_path,
    notes:
      "Simulated visual import only; does not establish canon facts or ability mechanics.",
    description: "",
    ability_state: "visual_only",
    tags: [],
    metadata_source: "simulation",
  };
}

async function sourceFileExists(sourceRoot, sourceFile) {
  try {
    const resolved = path.resolve(sourceRoot, sourceFile);
    if (!isInside(sourceRoot, resolved)) return false;
    const stat = await lstat(resolved);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function buildVisualImportOperationPreview(input) {
  const {
    candidate = null,
    rejectedFile = null,
    config,
    confirmationGate,
    sourceRoot,
  } = input;
  requireObject(config, "visual library import simulation config");
  requireObject(confirmationGate, "confirmation gate");
  requireString(sourceRoot, "sourceRoot");

  if (rejectedFile) {
    const warnings = [...(rejectedFile.warnings ?? [])];
    return {
      operation_id: stableId(
        "VIO-",
        `rejected|${rejectedFile.source_file}|${rejectedFile.rejection_reason}`,
      ),
      intake_candidate_id: null,
      source_file: rejectedFile.source_file,
      source_sha256: null,
      source_size_bytes: null,
      category: null,
      proposed_visual_id: null,
      proposed_target_path: null,
      proposed_visual_index_record: null,
      duplicate_status: null,
      duplicate_group_id: null,
      duplicate_handling_preview: "not_applicable",
      copy_source_file_preview: false,
      import_decision: rejectedFile.rejection_reason === "unsupported_extension"
        ? "rejected_unsupported_extension"
        : "blocked_missing_source_file",
      blocked_reasons: [rejectedFile.rejection_reason],
      warnings,
      risk_summary: {
        risk_level: rejectedFile.rejection_reason === "unsupported_extension"
          ? "medium"
          : "high",
        reasons: [rejectedFile.rejection_reason],
      },
      no_write_summary: noWriteSummary(),
    };
  }

  requireObject(candidate, "visual intake candidate");
  const targetValidation = validateVisualImportTargetPath(candidate, config);
  const exists = await sourceFileExists(sourceRoot, candidate.source_file);
  const warnings = [...candidate.warnings];
  const blockedReasons = [];
  let importDecision = "blocked_by_confirmation_gate";

  if (!exists) {
    importDecision = "blocked_missing_source_file";
    blockedReasons.push("source_file_missing_or_unsafe");
  } else if (!config.allowed_categories.includes(candidate.category_candidate)) {
    importDecision = "blocked_requires_manual_category_review";
    blockedReasons.push("requires_manual_category_review");
    if (!warnings.includes("requires_manual_category_review")) {
      warnings.push("requires_manual_category_review");
    }
  } else if (candidate.duplicate_status === "duplicate_candidate") {
    importDecision = "blocked_duplicate_requires_manual_review";
    blockedReasons.push("duplicate_candidate_requires_manual_review");
  } else if (!targetValidation.valid) {
    importDecision = "blocked_unsafe_target_path";
    blockedReasons.push(targetValidation.reason);
  } else if (confirmationGate.accepted) {
    importDecision = "simulated_import_ready";
  } else {
    blockedReasons.push("confirmation_gate_locked");
  }

  return {
    operation_id: stableId(
      "VIO-",
      `${candidate.intake_candidate_id}|${candidate.proposed_target_path}`,
    ),
    intake_candidate_id: candidate.intake_candidate_id,
    source_file: candidate.source_file,
    source_sha256: candidate.sha256,
    source_size_bytes: candidate.size_bytes,
    category: candidate.category_candidate,
    proposed_visual_id: candidate.proposed_visual_id,
    proposed_target_path: candidate.proposed_target_path,
    proposed_visual_index_record: buildProposedVisualIndexRecord(candidate),
    duplicate_status: candidate.duplicate_status,
    duplicate_group_id: candidate.duplicate_group_id,
    duplicate_handling_preview: candidate.duplicate_status === "duplicate_candidate"
      ? "manual_review_required_no_copy_simulated"
      : candidate.duplicate_status === "primary_candidate"
        ? "primary_candidate_may_proceed_in_simulation"
        : "unique_candidate",
    copy_source_file_preview: importDecision === "simulated_import_ready",
    import_decision: importDecision,
    blocked_reasons: blockedReasons,
    warnings,
    risk_summary: {
      risk_level: riskForDecision(importDecision),
      reasons: blockedReasons,
    },
    no_write_summary: noWriteSummary(),
  };
}

export async function buildVisualImportSimulationPlan(input) {
  const {
    intakePreview,
    config,
    confirmationGate,
    sourceRoot,
  } = input;
  requireObject(intakePreview, "visual library intake preview");
  const operations = [];
  for (const candidate of intakePreview.candidates) {
    operations.push(await buildVisualImportOperationPreview({
      candidate,
      config,
      confirmationGate,
      sourceRoot,
    }));
  }
  for (const rejectedFile of intakePreview.rejected_files) {
    operations.push(await buildVisualImportOperationPreview({
      rejectedFile,
      config,
      confirmationGate,
      sourceRoot,
    }));
  }
  operations.sort((left, right) => left.source_file.localeCompare(right.source_file, "en"));

  const decisionCounts = {};
  for (const operation of operations) {
    decisionCounts[operation.import_decision] =
      (decisionCounts[operation.import_decision] ?? 0) + 1;
  }
  const readyCount = decisionCounts.simulated_import_ready ?? 0;
  const rejectedCount = decisionCounts.rejected_unsupported_extension ?? 0;
  const blockedCount = operations.length - readyCount - rejectedCount;
  const decision = operations.length === 0
    ? "empty_import_simulation"
    : blockedCount === 0 && rejectedCount === 0
      ? "simulated_import_plan_ready"
      : "simulation_contains_blocked_operations";

  return {
    decision,
    operation_count: operations.length,
    simulated_ready_count: readyCount,
    blocked_operation_count: blockedCount,
    rejected_operation_count: rejectedCount,
    decision_counts: decisionCounts,
    risk_level: aggregateRisk(operations),
    operations,
  };
}

export function compileVisualLibraryImportSimulationSummary(preview) {
  requireObject(preview, "visual library import simulation preview");
  return {
    phase: "18C",
    mode: "read_only_visual_library_import_simulation_confirm_gate",
    source_dir: preview.source_dir,
    decision: preview.import_plan_summary.decision,
    operation_count: preview.import_plan_summary.operation_count,
    simulated_ready_count: preview.import_plan_summary.simulated_ready_count,
    blocked_operation_count: preview.import_plan_summary.blocked_operation_count,
    rejected_operation_count: preview.import_plan_summary.rejected_operation_count,
    confirmation_accepted: preview.confirmation_gate.accepted,
    risk_level: preview.import_plan_summary.risk_level,
    writes_visual_index: false,
    writes_visual_assets: false,
    updates_active_engine: false,
    updates_canon_db: false,
    creates_canon_visual_lock: false,
  };
}

export async function runVisualLibraryImportSimulationPreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryImportSimulationConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "visual library import simulation source directory",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine path",
  );
  const visualIndexPath = resolveProjectPath(
    config.visual_index_path,
    "visual index path",
  );
  const visualAssetsRoot = resolveProjectPath(
    config.visual_assets_root,
    "visual assets root",
  );

  const engineText = await readFile(activeEnginePath, "utf8");
  const engineSha256Lf = sha256Lf(engineText);
  if (engineSha256Lf !== config.expected_engine_sha256_lf) {
    throw new Error(
      `engine hash mismatch: expected ${config.expected_engine_sha256_lf} got ${engineSha256Lf}`,
    );
  }
  await readFile(visualIndexPath);
  await lstat(visualAssetsRoot);

  const intakePreview = options.intakePreview ?? await scanVisualLibraryIntakePreview({
    sourceDir: normalizeProjectPath(sourceDir),
    configPath: config.intake_config_path,
  });
  const confirmationGate = evaluateVisualImportConfirmationGate(
    config,
    options.confirmText ?? options.confirm_text,
  );
  const plan = await buildVisualImportSimulationPlan({
    intakePreview,
    config,
    confirmationGate,
    sourceRoot: sourceDir,
  });

  const preview = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    source_dir: normalizeProjectPath(sourceDir),
    active_engine_path: normalizeProjectPath(activeEnginePath),
    active_engine_sha256_lf: engineSha256Lf,
    expected_engine_sha256_lf: config.expected_engine_sha256_lf,
    engine_hash_matches: true,
    visual_index_path: normalizeProjectPath(visualIndexPath),
    visual_assets_root: normalizeProjectPath(visualAssetsRoot),
    confirmation_gate: confirmationGate,
    intake_summary: intakePreview.summary,
    import_plan_summary: {
      decision: plan.decision,
      operation_count: plan.operation_count,
      simulated_ready_count: plan.simulated_ready_count,
      blocked_operation_count: plan.blocked_operation_count,
      rejected_operation_count: plan.rejected_operation_count,
      decision_counts: plan.decision_counts,
      risk_level: plan.risk_level,
    },
    operations: plan.operations,
    safety_summary: {
      confirmation_changes_simulation_decisions_only: true,
      source_files_read_only: true,
      target_paths_validated: true,
      duplicates_require_manual_review: true,
      unknown_categories_require_manual_review: true,
      no_import_executed: true,
    },
    no_write_summary: noWriteSummary(),
  };
  preview.summary = compileVisualLibraryImportSimulationSummary(preview);
  return preview;
}
