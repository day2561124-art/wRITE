import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  loadVisualLibraryImportSimulationConfig,
  runVisualLibraryImportSimulationPreview,
  validateVisualImportTargetPath,
} from "./visual-library-import-simulation-service.mjs";

const readinessConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-pending-import-readiness.json",
);

const noWriteFlags = [
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

const lineageFields = [
  "intake_candidate_id",
  "import_operation_id",
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

function visualIndexRecordCount(text) {
  return normalizeLf(text)
    .split("\n")
    .filter((line) => line.trim()).length;
}

function riskForDecision(decision) {
  if (
    decision === "blocked_unsafe_target_path"
    || decision === "blocked_missing_source_file"
    || decision === "blocked_visual_index_not_empty"
    || decision === "blocked_incomplete_lineage"
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

function aggregateRisk(candidates) {
  if (candidates.some((candidate) => candidate.risk_summary.risk_level === "high")) {
    return "high";
  }
  if (candidates.some((candidate) => candidate.risk_summary.risk_level === "medium")) {
    return "medium";
  }
  return "low";
}

export function validateVisualLibraryPendingImportReadinessConfig(config) {
  requireObject(config, "visual library pending import readiness config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18D") throw new Error("phase must be 18D.");
  if (
    config.mode
    !== "read_only_visual_library_pending_import_candidate_approval_readiness"
  ) {
    throw new Error(
      "mode must be read_only_visual_library_pending_import_candidate_approval_readiness.",
    );
  }
  requireString(config.simulation_config_path, "simulation_config_path");
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
  requireString(config.approval_preview_source, "approval_preview_source");
  if (config.read_only !== true) throw new Error("read_only must be true.");
  if (config.preview_only !== true) throw new Error("preview_only must be true.");
  for (const flag of noWriteFlags) {
    if (config[flag] !== false) throw new Error(`${flag} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryPendingImportReadinessConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryPendingImportReadinessConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(
      options.configPath,
      "visual library pending import readiness config",
    )
    : readinessConfigPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryPendingImportReadinessConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function validatePendingVisualImportLineage(lineage) {
  const missingFields = [];
  if (!lineage || typeof lineage !== "object" || Array.isArray(lineage)) {
    return {
      complete: false,
      missing_fields: [...lineageFields],
    };
  }
  for (const field of lineageFields) {
    const value = lineage[field];
    if (
      value === null
      || value === undefined
      || value === ""
      || (field === "source_size_bytes" && (
        typeof value !== "number" || value < 0
      ))
    ) {
      missingFields.push(field);
    }
  }
  return {
    complete: missingFields.length === 0,
    missing_fields: missingFields,
  };
}

export function evaluateVisualImportApprovalReadiness(input) {
  const {
    operation,
    lineage,
    targetValidation,
    visualIndexRecords,
  } = input;
  const lineageValidation = validatePendingVisualImportLineage(lineage);
  if (operation.import_decision === "rejected_unsupported_extension") {
    return {
      readiness_decision: "rejected_unsupported_extension",
      blocked_reasons: [...(operation.blocked_reasons ?? [])],
      lineage_validation: lineageValidation,
    };
  }
  if (!lineageValidation.complete) {
    return {
      readiness_decision: "blocked_incomplete_lineage",
      blocked_reasons: lineageValidation.missing_fields.map(
        (field) => `missing_lineage:${field}`,
      ),
      lineage_validation: lineageValidation,
    };
  }
  if (visualIndexRecords !== 0) {
    return {
      readiness_decision: "blocked_visual_index_not_empty",
      blocked_reasons: [`visual_index_records:${visualIndexRecords}`],
      lineage_validation: lineageValidation,
    };
  }
  const decisionMap = {
    blocked_by_confirmation_gate: "blocked_by_confirmation_gate",
    blocked_requires_manual_category_review:
      "blocked_requires_manual_category_review",
    blocked_duplicate_requires_manual_review:
      "blocked_duplicate_requires_manual_review",
    blocked_unsafe_target_path: "blocked_unsafe_target_path",
    blocked_missing_source_file: "blocked_missing_source_file",
  };
  if (decisionMap[operation.import_decision]) {
    return {
      readiness_decision: decisionMap[operation.import_decision],
      blocked_reasons: [...(operation.blocked_reasons ?? [])],
      lineage_validation: lineageValidation,
    };
  }
  if (!targetValidation.valid) {
    return {
      readiness_decision: "blocked_unsafe_target_path",
      blocked_reasons: [targetValidation.reason],
      lineage_validation: lineageValidation,
    };
  }
  if (operation.import_decision !== "simulated_import_ready") {
    return {
      readiness_decision: "blocked_by_confirmation_gate",
      blocked_reasons: ["simulation_operation_not_ready"],
      lineage_validation: lineageValidation,
    };
  }
  return {
    readiness_decision: "ready_for_human_visual_import_review",
    blocked_reasons: [],
    lineage_validation: lineageValidation,
  };
}

export function buildPendingVisualImportCandidatePreview(input) {
  const {
    operation,
    config,
    simulationConfig,
    visualIndexRecords = 0,
    lineage: lineageOverride = null,
  } = input;
  requireObject(operation, "visual import simulation operation");
  requireObject(config, "visual library pending import readiness config");
  requireObject(simulationConfig, "visual library import simulation config");

  const lineage = lineageOverride ?? {
    intake_candidate_id: operation.intake_candidate_id,
    import_operation_id: operation.operation_id,
    source_file: operation.source_file,
    source_sha256: operation.source_sha256,
    source_size_bytes: operation.source_size_bytes,
    proposed_visual_id: operation.proposed_visual_id,
    proposed_target_path: operation.proposed_target_path,
  };
  const targetValidation = validateVisualImportTargetPath({
    proposed_target_path: lineage.proposed_target_path,
    category_candidate: operation.category,
  }, simulationConfig);
  const readiness = evaluateVisualImportApprovalReadiness({
    operation,
    lineage,
    targetValidation,
    visualIndexRecords,
  });
  const warnings = [...(operation.warnings ?? [])];
  if (!readiness.lineage_validation.complete) {
    warnings.push("incomplete_lineage");
  }
  const pendingCandidateId = stableId(
    "VPIC-",
    `${operation.operation_id}|${operation.source_sha256 ?? ""}|${operation.source_file}`,
  );
  return {
    pending_candidate_id: pendingCandidateId,
    candidate_type: "visual_library_import",
    source: config.approval_preview_source,
    status: "preview_only",
    lineage,
    proposed_visual_index_record: operation.proposed_visual_index_record,
    approval_payload_preview: {
      candidate_id: pendingCandidateId,
      candidate_type: "visual_library_import",
      source: config.approval_preview_source,
      requested_action: "review_visual_library_import_candidate",
      title: `Review visual import: ${operation.source_file}`,
      summary:
        `${operation.source_file} -> ${operation.proposed_target_path ?? "unresolved target"}`,
      readiness_decision: readiness.readiness_decision,
      lineage,
      proposed_visual_index_record: operation.proposed_visual_index_record,
      writes_approval_queue: false,
      creates_approval_item: false,
    },
    readiness_decision: readiness.readiness_decision,
    blocked_reasons: readiness.blocked_reasons,
    warnings,
    risk_summary: {
      risk_level: riskForDecision(readiness.readiness_decision),
      reasons: readiness.blocked_reasons,
    },
    no_write_summary: noWriteSummary(),
  };
}

export function buildVisualImportApprovalReadinessCard(candidate) {
  requireObject(candidate, "pending visual import candidate");
  return {
    card_id: stableId("VIRC-", candidate.pending_candidate_id),
    title: `Visual import review: ${candidate.lineage.source_file}`,
    candidate_type: "visual_library_import",
    pending_candidate_id: candidate.pending_candidate_id,
    readiness_decision: candidate.readiness_decision,
    can_submit_to_approval_queue: false,
    can_confirm_import: false,
    required_human_checks: [
      "source image identity check",
      "category check",
      "duplicate check",
      "canon status check",
      "target path check",
      "no canon_visual_lock check",
    ],
    disabled_actions: [
      "submit_to_approval_queue",
      "confirm_import",
      "write_visual_index",
      "copy_visual_asset",
      "create_canon_visual_lock",
    ],
    allowed_preview_actions: [
      "view_candidate_payload",
      "view_lineage",
      "view_risk_summary",
      "view_no_write_summary",
    ],
    risk_summary: candidate.risk_summary,
    no_write_summary: noWriteSummary(),
  };
}

export function compileVisualLibraryPendingImportReadinessSummary(preview) {
  requireObject(preview, "visual library pending import readiness preview");
  return {
    phase: "18D",
    mode:
      "read_only_visual_library_pending_import_candidate_approval_readiness",
    source_dir: preview.source_dir,
    decision: preview.approval_readiness_summary.decision,
    candidate_count: preview.pending_candidate_summary.candidate_count,
    ready_candidate_count: preview.pending_candidate_summary.ready_candidate_count,
    blocked_candidate_count: preview.pending_candidate_summary.blocked_candidate_count,
    readiness_card_count: preview.readiness_cards.length,
    visual_index_records: preview.visual_index_records,
    risk_level: preview.approval_readiness_summary.risk_level,
    writes_visual_index: false,
    writes_visual_assets: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

export async function runVisualLibraryPendingImportReadinessPreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryPendingImportReadinessConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "visual library pending import readiness source directory",
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
  const visualIndexText = options.visualIndexText
    ?? await readFile(visualIndexPath, "utf8");
  const visualIndexRecords = options.visualIndexRecords
    ?? visualIndexRecordCount(visualIndexText);
  await lstat(visualAssetsRoot);

  const simulationPreview = options.simulationPreview
    ?? await runVisualLibraryImportSimulationPreview({
      sourceDir: normalizeProjectPath(sourceDir),
      confirmText: options.confirmText ?? options.confirm_text,
      configPath: config.simulation_config_path,
    });
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig({
      configPath: config.simulation_config_path,
    });
  if (
    simulationConfig.required_confirmation_text
    !== config.required_confirmation_text
  ) {
    throw new Error(
      "required_confirmation_text does not match the Phase 18C simulation config.",
    );
  }

  const candidates = simulationPreview.operations.map((operation) => (
    buildPendingVisualImportCandidatePreview({
      operation,
      config,
      simulationConfig,
      visualIndexRecords,
    })
  ));
  candidates.sort((left, right) => (
    left.lineage.source_file.localeCompare(right.lineage.source_file, "en")
  ));
  const pendingCandidates = candidates.filter(
    (candidate) => (
      candidate.readiness_decision
      === "ready_for_human_visual_import_review"
    ),
  );
  const blockedCandidates = candidates.filter(
    (candidate) => (
      candidate.readiness_decision
      !== "ready_for_human_visual_import_review"
    ),
  );
  const readinessCards = candidates.map(buildVisualImportApprovalReadinessCard);
  const decisionCounts = {};
  for (const candidate of candidates) {
    decisionCounts[candidate.readiness_decision] =
      (decisionCounts[candidate.readiness_decision] ?? 0) + 1;
  }
  const decision = candidates.length === 0
    ? "empty_approval_readiness_preview"
    : blockedCandidates.length === 0
      ? "ready_for_human_visual_import_review"
      : "approval_readiness_contains_blocked_candidates";

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
    visual_index_records: visualIndexRecords,
    visual_assets_root: normalizeProjectPath(visualAssetsRoot),
    confirmation_gate: simulationPreview.confirmation_gate,
    simulation_summary: simulationPreview.summary,
    pending_candidate_summary: {
      candidate_count: candidates.length,
      ready_candidate_count: pendingCandidates.length,
      blocked_candidate_count: blockedCandidates.length,
    },
    approval_readiness_summary: {
      decision,
      decision_counts: decisionCounts,
      risk_level: aggregateRisk(candidates),
      can_submit_to_approval_queue: false,
      can_confirm_import: false,
    },
    pending_candidates: pendingCandidates,
    readiness_cards: readinessCards,
    blocked_candidates: blockedCandidates,
    safety_summary: {
      candidates_are_preview_only: true,
      ready_means_human_review_only: true,
      approval_queue_write_allowed: false,
      import_confirmation_allowed: false,
      visual_index_write_allowed: false,
      visual_asset_copy_allowed: false,
      canon_visual_lock_creation_allowed: false,
      no_import_executed: true,
    },
    no_write_summary: noWriteSummary(),
  };
  preview.summary = compileVisualLibraryPendingImportReadinessSummary(preview);
  return preview;
}
