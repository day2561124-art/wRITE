import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  loadVisualLibraryFinalAcceptanceConfig,
  runVisualLibraryFinalAcceptancePreview,
} from "./visual-library-final-acceptance-service.mjs";
import {
  loadVisualLibraryImportSimulationConfig,
  validateVisualImportTargetPath,
} from "./visual-library-import-simulation-service.mjs";

const controlledImportGuardConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-controlled-import-guard.json",
);

const noWriteFields = [
  "writes_visual_index",
  "writes_visual_assets",
  "copies_files",
  "moves_files",
  "deletes_files",
  "writes_approval_queue",
  "creates_approval_item",
  "creates_canon_visual_lock",
  "updates_active_engine",
  "updates_canon_db",
];

const dangerousCardFields = [
  "can_write_visual_index",
  "can_copy_visual_asset",
  "can_write_approval_queue",
  "can_create_approval_item",
  "can_create_canon_visual_lock",
  "can_confirm_real_import",
];

const requiredLineageFields = [
  "source_file",
  "source_sha256",
  "source_size_bytes",
  "proposed_visual_id",
  "proposed_target_path",
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

function noWriteSummary() {
  return {
    writes_visual_index: false,
    writes_visual_assets: false,
    copies_files: false,
    moves_files: false,
    deletes_files: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

function phase19aPrerequisites() {
  return {
    must_create_snapshot_before_write: true,
    must_recheck_active_engine_hash: true,
    must_recheck_visual_index_hash: true,
    must_recheck_source_hashes: true,
    must_recheck_target_paths: true,
    must_require_user_exact_confirmation: true,
    must_write_visual_index_atomically: true,
    must_copy_visual_assets_atomically: true,
    must_support_rollback_manifest: true,
    must_not_create_canon_visual_lock: true,
    must_not_update_canon_db: true,
    must_not_update_active_engine: true,
  };
}

function visualIndexRecordCount(text) {
  return normalizeLf(text)
    .split("\n")
    .filter((line) => line.trim()).length;
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

async function pathOccupied(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function directorySnapshot(directory) {
  const entries = [];
  async function walk(current) {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(directory, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push(`d:${relative}`);
        await walk(absolute);
      } else {
        const content = await readFile(absolute);
        entries.push(`f:${relative}:${content.byteLength}:${sha256(content)}`);
      }
    }
  }
  await walk(directory);
  return entries;
}

function confirmationGate(providedText, requiredText) {
  const provided = typeof providedText === "string" ? providedText : "";
  return {
    required_text: requiredText,
    provided_text: provided || null,
    accepted: provided === requiredText,
  };
}

function lineageFromAcceptanceCase(acceptanceCase) {
  const dryRun = acceptanceCase.pipeline_results?.approval_queue_dry_run;
  const readiness = acceptanceCase.pipeline_results?.pending_import_readiness;
  const operation = acceptanceCase.pipeline_results?.import_simulation;
  return dryRun?.lineage ?? readiness?.lineage ?? {
    source_file: operation?.source_file ?? acceptanceCase.source_file,
    source_sha256: operation?.source_sha256,
    source_size_bytes: operation?.source_size_bytes,
    proposed_visual_id: operation?.proposed_visual_id,
    proposed_target_path: operation?.proposed_target_path,
  };
}

function lineageComplete(lineage) {
  return requiredLineageFields.every((field) => {
    const value = lineage?.[field];
    if (field === "source_size_bytes") {
      return typeof value === "number" && value >= 0;
    }
    return value !== null && value !== undefined && value !== "";
  });
}

function decisionRisk(decision) {
  if ([
    "blocked_source_hash_mismatch",
    "blocked_unsafe_target_path",
    "blocked_visual_index_not_empty",
    "blocked_target_already_occupied",
    "blocked_incomplete_lineage",
    "blocked_no_write_safety_violation",
  ].includes(decision)) return "high";
  if ([
    "blocked_requires_manual_category_review",
    "blocked_duplicate_requires_manual_review",
    "blocked_final_acceptance_not_passed",
  ].includes(decision)) return "medium";
  return "low";
}

export function validateVisualLibraryControlledImportGuardConfig(config) {
  requireObject(config, "visual library controlled import guard config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18G") throw new Error("phase must be 18G.");
  if (
    config.mode
    !== "read_only_visual_library_controlled_import_pre_write_final_gate"
  ) {
    throw new Error(
      "mode must be read_only_visual_library_controlled_import_pre_write_final_gate.",
    );
  }
  for (const field of [
    "final_acceptance_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "required_simulation_confirmation_text",
    "required_pre_write_confirmation_text",
    "next_phase",
  ]) {
    requireString(config[field], field);
  }
  const expectedHash = requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  );
  if (!/^[A-F0-9]{64}$/u.test(expectedHash)) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  if (config.next_phase !== "19A") throw new Error("next_phase must be 19A.");
  for (const field of ["read_only", "preview_only", "pre_write_gate_only"]) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of noWriteFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryControlledImportGuardConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryControlledImportGuardConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(options.configPath, "controlled import guard config")
    : controlledImportGuardConfigPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryControlledImportGuardConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function buildControlledImportPreWriteGate(input) {
  return confirmationGate(
    input?.provided_text ?? input?.providedText,
    requireString(input?.required_text ?? input?.requiredText, "required_text"),
  );
}

export function validateControlledImportNoWriteSafety(input) {
  const summary = input?.no_write_summary ?? input?.noWriteSummary ?? input;
  const card = input?.ui_guard_card ?? input?.uiGuardCard ?? null;
  const violations = [];
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    violations.push("missing_no_write_summary");
  } else {
    for (const field of noWriteFields) {
      if (summary[field] !== false) violations.push(`unsafe_flag:${field}`);
    }
  }
  if (card) {
    for (const field of dangerousCardFields) {
      if (card[field] !== false) violations.push(`dangerous_action:${field}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateControlledImportPreconditions(preconditions) {
  requireObject(preconditions, "controlled import preconditions");
  const checks = [
    ["final_acceptance_passed", "blocked_final_acceptance_not_passed"],
    ["source_exists", "blocked_missing_source_file"],
    ["source_hash_matches", "blocked_source_hash_mismatch"],
    ["target_path_safe", "blocked_unsafe_target_path"],
    ["visual_index_empty", "blocked_visual_index_not_empty"],
    ["target_not_occupied", "blocked_target_already_occupied"],
    ["category_valid", "blocked_requires_manual_category_review"],
    ["duplicate_resolved", "blocked_duplicate_requires_manual_review"],
    ["lineage_complete", "blocked_incomplete_lineage"],
    ["no_write_safety_passed", "blocked_no_write_safety_violation"],
  ];
  const failed = checks
    .filter(([field]) => preconditions[field] !== true)
    .map(([field, decision]) => ({ field, decision }));
  return { valid: failed.length === 0, failed };
}

export function evaluateControlledImportGuardDecision(input) {
  if (!input.simulation_confirmation_accepted) {
    return "blocked_by_simulation_confirmation_gate";
  }
  if (!input.pre_write_confirmation_accepted) {
    return "blocked_by_pre_write_confirmation_gate";
  }
  const validation = validateControlledImportPreconditions(input.preconditions);
  return validation.valid
    ? "ready_for_phase_19a_confirmed_import"
    : validation.failed[0].decision;
}

function buildUiGuardCard(item) {
  return {
    card_id: stableId("VLCIGC-", item.controlled_import_item_id),
    title: `Controlled visual import guard: ${item.source_file}`,
    phase: "18G",
    candidate_type: "visual_library_controlled_import",
    guard_decision: item.guard_decision,
    can_enter_phase_19a:
      item.guard_decision === "ready_for_phase_19a_confirmed_import",
    can_write_visual_index: false,
    can_copy_visual_asset: false,
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_create_canon_visual_lock: false,
    can_confirm_real_import: false,
    required_human_checks: [
      "source image identity check",
      "category check",
      "duplicate check",
      "canon status check",
      "target path check",
      "lineage check",
      "source hash check",
      "visual_index empty baseline check",
      "target not occupied check",
      "final acceptance decision check",
      "no canon_visual_lock check",
      "pre-write confirmation check",
    ],
    disabled_actions: [
      "write_visual_index",
      "copy_visual_asset",
      "write_approval_queue",
      "create_approval_item",
      "create_canon_visual_lock",
      "confirm_real_import",
    ],
    allowed_preview_actions: [
      "view_preflight_manifest",
      "view_phase_19a_prerequisites",
      "view_lineage",
      "view_risk_summary",
      "view_no_write_summary",
      "view_guard_summary",
    ],
  };
}

export async function buildControlledImportPreflightManifestPreview(input) {
  requireObject(input, "controlled import preflight manifest input");
  const acceptanceCase = requireObject(
    input.acceptance_case,
    "Phase 18F acceptance case",
  );
  const lineage = input.lineage ?? lineageFromAcceptanceCase(acceptanceCase);
  const sourcePath = input.source_path
    ?? path.join(input.source_dir_absolute, lineage.source_file ?? "");
  const targetPath = input.target_path
    ?? path.join(input.visual_assets_root_absolute, lineage.proposed_target_path ?? "");
  const sourceState = input.source_state ?? await fileState(sourcePath);
  const actualSourceHash = sourceState.exists ? sha256(sourceState.content) : null;
  const targetValidation = input.target_validation
    ?? validateVisualImportTargetPath({
      proposed_target_path: lineage.proposed_target_path,
      category_candidate:
        acceptanceCase.pipeline_results?.import_simulation?.category
        ?? acceptanceCase.pipeline_results?.pending_import_readiness
          ?.proposed_visual_index_record?.category,
    }, input.simulation_config);
  const noWrite = input.no_write_summary
    ?? acceptanceCase.no_write_summary
    ?? noWriteSummary();
  const noWriteValidation = validateControlledImportNoWriteSafety(noWrite);
  const readinessDecision =
    acceptanceCase.pipeline_results?.pending_import_readiness
      ?.readiness_decision ?? null;
  const dryRunDecision =
    acceptanceCase.pipeline_results?.approval_queue_dry_run
      ?.dry_run_decision ?? null;
  const category =
    acceptanceCase.pipeline_results?.pending_import_readiness
      ?.proposed_visual_index_record?.category
    ?? acceptanceCase.pipeline_results?.import_simulation?.category
    ?? acceptanceCase.pipeline_results?.import_simulation
      ?.proposed_visual_index_record?.category;
  const warnings = [
    ...(acceptanceCase.warnings ?? []),
    ...(input.warnings ?? []),
  ];
  const preconditions = {
    final_acceptance_passed:
      input.final_acceptance_passed
      ?? (
        acceptanceCase.passed === true
        && dryRunDecision === "approval_queue_import_dry_run_ready"
      ),
    source_exists: input.source_exists ?? sourceState.exists,
    source_hash_matches:
      input.source_hash_matches
      ?? (
        sourceState.exists
        && actualSourceHash === String(lineage.source_sha256 ?? "").toUpperCase()
      ),
    target_path_safe: input.target_path_safe ?? targetValidation.valid,
    visual_index_empty: input.visual_index_empty,
    target_not_occupied:
      input.target_not_occupied ?? !(await pathOccupied(targetPath)),
    category_valid:
      input.category_valid
      ?? (
        category !== null
        && category !== undefined
        && category !== "unknown"
      ),
    duplicate_resolved:
      input.duplicate_resolved
      ?? ![
        readinessDecision,
        dryRunDecision,
        acceptanceCase.actual_decision,
      ].includes("blocked_duplicate_requires_manual_review"),
    lineage_complete: input.lineage_complete ?? lineageComplete(lineage),
    no_write_safety_passed:
      input.no_write_safety_passed ?? noWriteValidation.valid,
  };
  const guardDecision = evaluateControlledImportGuardDecision({
    simulation_confirmation_accepted: input.simulation_confirmation_accepted,
    pre_write_confirmation_accepted: input.pre_write_confirmation_accepted,
    preconditions,
  });
  const validation = validateControlledImportPreconditions(preconditions);
  const blockedReasons = [
    ...validation.failed.map(({ field }) => `precondition_failed:${field}`),
    ...noWriteValidation.violations,
    ...(acceptanceCase.blocked_reasons ?? []),
  ];
  const item = {
    controlled_import_item_id: stableId(
      "VLCII-",
      `${lineage.source_file ?? ""}|${lineage.source_sha256 ?? ""}`,
    ),
    source_file: lineage.source_file ?? acceptanceCase.source_file ?? null,
    source_sha256: lineage.source_sha256 ?? null,
    source_size_bytes: lineage.source_size_bytes ?? null,
    proposed_visual_id: lineage.proposed_visual_id ?? null,
    proposed_target_path: lineage.proposed_target_path ?? null,
    proposed_visual_index_record:
      acceptanceCase.pipeline_results?.pending_import_readiness
        ?.proposed_visual_index_record
      ?? acceptanceCase.pipeline_results?.import_simulation
        ?.proposed_visual_index_record
      ?? null,
    final_acceptance_decision_from_18f: acceptanceCase.actual_decision,
    approval_dry_run_decision_from_18e: dryRunDecision,
    readiness_decision_from_18d: readinessDecision,
    preconditions,
    guard_decision: guardDecision,
    blocked_reasons: [...new Set(blockedReasons)],
    warnings: [...new Set(warnings)],
    risk_summary: {
      risk_level: decisionRisk(guardDecision),
      reasons: [...new Set(blockedReasons)],
    },
    no_write_summary: noWriteSummary(),
  };
  item.ui_guard_card = buildUiGuardCard(item);
  return item;
}

export function compileControlledImportGuardSummary(preview) {
  requireObject(preview, "controlled import guard preview");
  const items = preview.controlled_import_items ?? [];
  const readyCount = items.filter(
    (item) => item.guard_decision === "ready_for_phase_19a_confirmed_import",
  ).length;
  const decisionCounts = {};
  for (const item of items) {
    decisionCounts[item.guard_decision] =
      (decisionCounts[item.guard_decision] ?? 0) + 1;
  }
  return {
    item_count: items.length,
    ready_count: readyCount,
    blocked_count: items.length - readyCount,
    decision_counts: decisionCounts,
    can_enter_phase_19a: items.length > 0 && readyCount === items.length,
    writes_visual_index: false,
    copies_visual_assets: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    confirms_real_import: false,
  };
}

export async function runVisualLibraryControlledImportGuardPreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryControlledImportGuardConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "controlled import guard source directory",
  );
  const visualIndexPath = resolveProjectPath(
    config.visual_index_path,
    "visual index path",
  );
  const visualAssetsRoot = resolveProjectPath(
    config.visual_assets_root,
    "visual assets root",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine path",
  );
  await lstat(visualAssetsRoot);
  const before = {
    visual_index: await readFile(visualIndexPath),
    visual_assets: await directorySnapshot(visualAssetsRoot),
    active_engine: await readFile(activeEnginePath),
  };
  const activeEngineHash = sha256Lf(before.active_engine.toString("utf8"));
  if (activeEngineHash !== config.expected_engine_sha256_lf) {
    throw new Error(
      `engine hash mismatch: expected ${config.expected_engine_sha256_lf} got ${activeEngineHash}`,
    );
  }
  const simulationGate = confirmationGate(
    options.confirmText ?? options.confirm_text,
    config.required_simulation_confirmation_text,
  );
  const preWriteGate = buildControlledImportPreWriteGate({
    providedText:
      options.preWriteConfirmText ?? options.pre_write_confirm_text,
    requiredText: config.required_pre_write_confirmation_text,
  });
  const { config: finalAcceptanceConfig } =
    await loadVisualLibraryFinalAcceptanceConfig({
      configPath: config.final_acceptance_config_path,
    });
  const finalAcceptance = options.finalAcceptancePreview
    ?? await runVisualLibraryFinalAcceptancePreview({
      sourceDir: normalizeProjectPath(sourceDir),
      confirmText: simulationGate.accepted
        ? finalAcceptanceConfig.required_confirmation_text
        : undefined,
      configPath: config.final_acceptance_config_path,
    });
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig({
      configPath: finalAcceptanceConfig.simulation_config_path,
    });
  const visualIndexRecords = visualIndexRecordCount(
    before.visual_index.toString("utf8"),
  );
  const items = [];
  for (const acceptanceCase of finalAcceptance.acceptance_cases) {
    items.push(await buildControlledImportPreflightManifestPreview({
      acceptance_case: acceptanceCase,
      source_dir_absolute: sourceDir,
      visual_assets_root_absolute: visualAssetsRoot,
      simulation_config: simulationConfig,
      visual_index_empty: visualIndexRecords === 0,
      simulation_confirmation_accepted: simulationGate.accepted,
      pre_write_confirmation_accepted: preWriteGate.accepted,
    }));
  }
  items.sort((left, right) => (
    String(left.source_file).localeCompare(String(right.source_file), "en")
  ));
  const after = {
    visual_index: await readFile(visualIndexPath),
    visual_assets: await directorySnapshot(visualAssetsRoot),
    active_engine: await readFile(activeEnginePath),
  };
  const safetySummary = {
    visual_index_unchanged: before.visual_index.equals(after.visual_index),
    visual_assets_unchanged:
      JSON.stringify(before.visual_assets) === JSON.stringify(after.visual_assets),
    active_engine_unchanged: before.active_engine.equals(after.active_engine),
    actual_write_detected: !before.visual_index.equals(after.visual_index)
      || JSON.stringify(before.visual_assets) !== JSON.stringify(after.visual_assets)
      || !before.active_engine.equals(after.active_engine),
    dangerous_write_capability_enabled: items.some(
      (item) => !validateControlledImportNoWriteSafety({
        no_write_summary: item.no_write_summary,
        ui_guard_card: item.ui_guard_card,
      }).valid,
    ),
    no_real_import_executed: true,
  };
  const preview = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    source_dir: normalizeProjectPath(sourceDir),
    simulation_confirmation_gate: simulationGate,
    pre_write_confirmation_gate: preWriteGate,
    final_acceptance_summary: finalAcceptance.acceptance_summary,
    preflight_manifest_preview: items.map((item) => ({
      controlled_import_item_id: item.controlled_import_item_id,
      source_file: item.source_file,
      source_sha256: item.source_sha256,
      proposed_target_path: item.proposed_target_path,
      preconditions: item.preconditions,
      guard_decision: item.guard_decision,
    })),
    controlled_import_guard_summary: null,
    controlled_import_items: items,
    blocked_items: items.filter(
      (item) => item.guard_decision !== "ready_for_phase_19a_confirmed_import",
    ),
    ui_guard_cards: items.map((item) => item.ui_guard_card),
    phase_19a_prerequisites: phase19aPrerequisites(),
    safety_summary: safetySummary,
    no_write_summary: noWriteSummary(),
    controlled_import_guard_decision: null,
  };
  preview.controlled_import_guard_summary =
    compileControlledImportGuardSummary(preview);
  if (safetySummary.dangerous_write_capability_enabled) {
    preview.controlled_import_guard_decision =
      "failed_unexpected_write_capability";
  } else if (safetySummary.actual_write_detected) {
    preview.controlled_import_guard_decision =
      "failed_write_side_effect_detected";
  } else if (items.length === 0) {
    preview.controlled_import_guard_decision =
      "empty_controlled_import_guard_preview_passed";
  } else if (preview.blocked_items.length === 0) {
    preview.controlled_import_guard_decision =
      "ready_for_phase_19a_confirmed_import";
  } else {
    preview.controlled_import_guard_decision =
      "controlled_import_guard_contains_blocked_items";
  }
  return preview;
}
