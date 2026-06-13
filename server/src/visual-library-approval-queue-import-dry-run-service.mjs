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
  validateVisualImportTargetPath,
} from "./visual-library-import-simulation-service.mjs";
import {
  loadVisualLibraryPendingImportReadinessConfig,
  runVisualLibraryPendingImportReadinessPreview,
  validatePendingVisualImportLineage,
} from "./visual-library-pending-import-readiness-service.mjs";

const dryRunConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-approval-queue-import-dry-run.json",
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

const approvalLineageFields = [
  "intake_candidate_id",
  "import_operation_id",
  "pending_candidate_id",
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

function riskForDecision(decision) {
  if (
    decision === "blocked_incomplete_lineage"
    || decision === "blocked_unsafe_target_path"
    || decision === "blocked_visual_index_not_empty"
    || decision === "blocked_no_write_safety_violation"
  ) {
    return "high";
  }
  if (
    decision === "blocked_duplicate_requires_manual_review"
    || decision === "blocked_requires_manual_category_review"
    || decision === "blocked_by_readiness_decision"
  ) {
    return "medium";
  }
  return "low";
}

function aggregateRisk(items) {
  if (items.some((item) => item.risk_summary.risk_level === "high")) return "high";
  if (items.some((item) => item.risk_summary.risk_level === "medium")) return "medium";
  return "low";
}

export function validateVisualLibraryApprovalQueueImportDryRunConfig(config) {
  requireObject(config, "visual library Approval Queue import dry-run config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18E") throw new Error("phase must be 18E.");
  if (
    config.mode
    !== "read_only_visual_library_approval_queue_import_dry_run_guard_preview"
  ) {
    throw new Error(
      "mode must be read_only_visual_library_approval_queue_import_dry_run_guard_preview.",
    );
  }
  requireString(config.readiness_config_path, "readiness_config_path");
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
  if (config.approval_item_type !== "visual_library_import") {
    throw new Error("approval_item_type must be visual_library_import.");
  }
  if (config.read_only !== true) throw new Error("read_only must be true.");
  if (config.dry_run_only !== true) throw new Error("dry_run_only must be true.");
  if (config.guard_preview_only !== true) {
    throw new Error("guard_preview_only must be true.");
  }
  for (const field of noWriteFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryApprovalQueueImportDryRunConfig(
  options = {},
) {
  if (options.config) {
    return {
      config: validateVisualLibraryApprovalQueueImportDryRunConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(
      options.configPath,
      "visual library Approval Queue import dry-run config",
    )
    : dryRunConfigPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryApprovalQueueImportDryRunConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function validateVisualLibraryApprovalItemLineage(lineage) {
  const missingFields = [];
  if (!lineage || typeof lineage !== "object" || Array.isArray(lineage)) {
    return {
      valid: false,
      missing_fields: [...approvalLineageFields],
    };
  }
  for (const field of approvalLineageFields) {
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
    valid: missingFields.length === 0,
    missing_fields: missingFields,
  };
}

export function validateVisualLibraryApprovalItemRisk(riskSummary) {
  if (!riskSummary || typeof riskSummary !== "object") {
    return {
      acceptable: false,
      reasons: ["missing_risk_summary"],
    };
  }
  if (!["low", "medium", "high"].includes(riskSummary.risk_level)) {
    return {
      acceptable: false,
      reasons: ["invalid_risk_level"],
    };
  }
  return {
    acceptable: riskSummary.risk_level === "low",
    reasons: riskSummary.risk_level === "low"
      ? []
      : [`risk_level_not_acceptable:${riskSummary.risk_level}`],
  };
}

export function validateVisualLibraryApprovalItemNoWriteSafety(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return {
      valid: false,
      violations: ["missing_no_write_summary"],
    };
  }
  const violations = noWriteFields.filter((field) => summary[field] !== false);
  return {
    valid: violations.length === 0,
    violations,
  };
}

function mapBlockedReadinessDecision(decision) {
  if (decision === "blocked_duplicate_requires_manual_review") {
    return "blocked_duplicate_requires_manual_review";
  }
  if (decision === "blocked_requires_manual_category_review") {
    return "blocked_requires_manual_category_review";
  }
  if (decision === "blocked_unsafe_target_path") {
    return "blocked_unsafe_target_path";
  }
  if (decision === "blocked_incomplete_lineage") {
    return "blocked_incomplete_lineage";
  }
  if (decision === "blocked_visual_index_not_empty") {
    return "blocked_visual_index_not_empty";
  }
  return "blocked_by_readiness_decision";
}

export function buildVisualLibraryApprovalItemDryRunPayload(input) {
  const {
    candidate,
    config,
    simulationConfig,
    confirmationGate,
    visualIndexRecords = 0,
    lineage: lineageOverride = null,
    noWrite: noWriteOverride = null,
  } = input;
  requireObject(candidate, "Phase 18D pending candidate");
  requireObject(config, "Phase 18E config");
  requireObject(simulationConfig, "Phase 18C simulation config");
  requireObject(confirmationGate, "confirmation gate");

  const lineage = lineageOverride ?? {
    intake_candidate_id: candidate.lineage?.intake_candidate_id,
    import_operation_id: candidate.lineage?.import_operation_id,
    pending_candidate_id: candidate.pending_candidate_id,
    source_file: candidate.lineage?.source_file,
    source_sha256: candidate.lineage?.source_sha256,
    source_size_bytes: candidate.lineage?.source_size_bytes,
    proposed_visual_id: candidate.lineage?.proposed_visual_id,
    proposed_target_path: candidate.lineage?.proposed_target_path,
  };
  const candidateNoWrite = noWriteOverride
    ?? candidate.no_write_summary
    ?? noWriteSummary();
  const lineageValidation = validateVisualLibraryApprovalItemLineage(lineage);
  const noWriteValidation =
    validateVisualLibraryApprovalItemNoWriteSafety(candidateNoWrite);
  const riskValidation = validateVisualLibraryApprovalItemRisk(
    candidate.risk_summary,
  );
  const targetValidation = validateVisualImportTargetPath({
    proposed_target_path: lineage.proposed_target_path,
    category_candidate: candidate.proposed_visual_index_record?.category,
  }, simulationConfig);

  let dryRunDecision = "blocked_from_real_approval_queue_write";
  const blockedReasons = [];
  if (!noWriteValidation.valid) {
    dryRunDecision = "blocked_no_write_safety_violation";
    blockedReasons.push(
      ...noWriteValidation.violations.map((field) => `unsafe_flag:${field}`),
    );
  } else if (!lineageValidation.valid) {
    dryRunDecision = "blocked_incomplete_lineage";
    blockedReasons.push(
      ...lineageValidation.missing_fields.map(
        (field) => `missing_lineage:${field}`,
      ),
    );
  } else if (visualIndexRecords !== 0) {
    dryRunDecision = "blocked_visual_index_not_empty";
    blockedReasons.push(`visual_index_records:${visualIndexRecords}`);
  } else if (
    candidate.readiness_decision
    !== "ready_for_human_visual_import_review"
  ) {
    dryRunDecision = mapBlockedReadinessDecision(
      candidate.readiness_decision,
    );
    blockedReasons.push(
      `readiness_decision:${candidate.readiness_decision}`,
      ...(candidate.blocked_reasons ?? []),
    );
  } else if (!targetValidation.valid) {
    dryRunDecision = "blocked_unsafe_target_path";
    blockedReasons.push(targetValidation.reason);
  } else if (!riskValidation.acceptable) {
    dryRunDecision = "blocked_by_readiness_decision";
    blockedReasons.push(...riskValidation.reasons);
  } else if (!confirmationGate.accepted) {
    dryRunDecision = "blocked_by_confirmation_gate";
    blockedReasons.push("confirmation_gate_locked");
  } else {
    dryRunDecision = "approval_queue_import_dry_run_ready";
  }

  const approvalItemPreviewId = stableId(
    "VAQDR-",
    `${candidate.pending_candidate_id}|${lineage.source_sha256 ?? ""}`,
  );
  const warnings = [...(candidate.warnings ?? [])];
  if (!lineageValidation.valid) warnings.push("incomplete_lineage");
  if (!noWriteValidation.valid) warnings.push("no_write_safety_violation");
  return {
    approval_item_preview_id: approvalItemPreviewId,
    approval_item_type: config.approval_item_type,
    source: config.approval_preview_source,
    status: "dry_run_preview_only",
    requested_action: "review_visual_library_import_candidate",
    readiness_decision_from_18d: candidate.readiness_decision,
    lineage,
    proposed_visual_index_record: candidate.proposed_visual_index_record,
    proposed_approval_payload: {
      approval_item_type: config.approval_item_type,
      source: config.approval_preview_source,
      requested_action: "review_visual_library_import_candidate",
      title: `Review visual import: ${lineage.source_file}`,
      summary:
        `${lineage.source_file} -> ${lineage.proposed_target_path ?? "unresolved target"}`,
      lineage,
      proposed_visual_index_record: candidate.proposed_visual_index_record,
      readiness_decision_from_18d: candidate.readiness_decision,
      writes_approval_queue: false,
      creates_approval_item: false,
      creates_canon_visual_lock: false,
    },
    human_review_requirements: [
      "source image identity check",
      "category check",
      "duplicate check",
      "canon status check",
      "target path check",
      "lineage check",
      "visual_index empty baseline check",
      "no canon_visual_lock check",
    ],
    dry_run_decision: dryRunDecision,
    blocked_reasons: [...new Set(blockedReasons)],
    warnings: [...new Set(warnings)],
    risk_summary: {
      risk_level: riskForDecision(dryRunDecision),
      source_risk_level: candidate.risk_summary?.risk_level ?? null,
      reasons: [...new Set(blockedReasons)],
    },
    guard_summary: {
      default_guard_decision: "blocked_from_real_approval_queue_write",
      dry_run_payload_accepted:
        dryRunDecision === "approval_queue_import_dry_run_ready",
      real_approval_queue_write_allowed: false,
      real_approval_item_creation_allowed: false,
      real_import_confirmation_allowed: false,
      lineage_valid: lineageValidation.valid,
      target_path_safe: targetValidation.valid,
      risk_acceptable: riskValidation.acceptable,
      no_write_safety_valid: noWriteValidation.valid,
      visual_index_empty: visualIndexRecords === 0,
      confirmation_accepted: confirmationGate.accepted,
    },
    no_write_summary: noWriteSummary(),
  };
}

export function buildVisualLibraryApprovalQueueGuardPreview(item) {
  requireObject(item, "visual library Approval Queue dry-run item");
  return {
    card_id: stableId("VAQGC-", item.approval_item_preview_id),
    title: `Approval Queue dry-run: ${item.lineage.source_file}`,
    approval_item_type: "visual_library_import",
    approval_item_preview_id: item.approval_item_preview_id,
    dry_run_decision: item.dry_run_decision,
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_confirm_import: false,
    can_write_visual_index: false,
    can_copy_visual_asset: false,
    can_create_canon_visual_lock: false,
    required_human_checks: [...item.human_review_requirements],
    disabled_actions: [
      "write_approval_queue",
      "create_approval_item",
      "confirm_import",
      "write_visual_index",
      "copy_visual_asset",
      "create_canon_visual_lock",
    ],
    allowed_preview_actions: [
      "view_approval_payload_preview",
      "view_lineage",
      "view_risk_summary",
      "view_guard_summary",
      "view_no_write_summary",
    ],
    guard_summary: item.guard_summary,
    risk_summary: item.risk_summary,
    no_write_summary: noWriteSummary(),
  };
}

export function compileVisualLibraryApprovalQueueImportDryRunSummary(preview) {
  requireObject(preview, "visual library Approval Queue import dry-run preview");
  return {
    phase: "18E",
    mode:
      "read_only_visual_library_approval_queue_import_dry_run_guard_preview",
    source_dir: preview.source_dir,
    decision: preview.approval_queue_dry_run_summary.decision,
    approval_item_preview_count:
      preview.approval_queue_dry_run_summary.approval_item_preview_count,
    ready_count: preview.approval_queue_dry_run_summary.ready_count,
    blocked_count: preview.approval_queue_dry_run_summary.blocked_count,
    guard_card_count: preview.guard_cards.length,
    risk_level: preview.approval_queue_dry_run_summary.risk_level,
    writes_visual_index: false,
    writes_visual_assets: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

export async function runVisualLibraryApprovalQueueImportDryRunPreview(
  options = {},
) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryApprovalQueueImportDryRunConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "visual library Approval Queue import dry-run source directory",
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
  await lstat(visualAssetsRoot);

  const readinessPreview = options.readinessPreview
    ?? await runVisualLibraryPendingImportReadinessPreview({
      sourceDir: normalizeProjectPath(sourceDir),
      confirmText: options.confirmText ?? options.confirm_text,
      configPath: config.readiness_config_path,
    });
  const { config: readinessConfig } =
    await loadVisualLibraryPendingImportReadinessConfig({
      configPath: config.readiness_config_path,
    });
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig({
      configPath: readinessConfig.simulation_config_path,
    });
  if (
    readinessConfig.required_confirmation_text
      !== config.required_confirmation_text
    || simulationConfig.required_confirmation_text
      !== config.required_confirmation_text
  ) {
    throw new Error(
      "required_confirmation_text does not match the Phase 18C/18D configs.",
    );
  }

  const allCandidates = [
    ...(readinessPreview.pending_candidates ?? []),
    ...(readinessPreview.blocked_candidates ?? []),
  ];
  const items = allCandidates.map((candidate) => (
    buildVisualLibraryApprovalItemDryRunPayload({
      candidate,
      config,
      simulationConfig,
      confirmationGate: readinessPreview.confirmation_gate,
      visualIndexRecords: readinessPreview.visual_index_records,
    })
  ));
  items.sort((left, right) => (
    left.lineage.source_file.localeCompare(right.lineage.source_file, "en")
  ));
  const guardCards = items.map(buildVisualLibraryApprovalQueueGuardPreview);
  const blockedItems = items.filter(
    (item) => item.dry_run_decision !== "approval_queue_import_dry_run_ready",
  );
  const readyCount = items.length - blockedItems.length;
  const decisionCounts = {};
  for (const item of items) {
    decisionCounts[item.dry_run_decision] =
      (decisionCounts[item.dry_run_decision] ?? 0) + 1;
  }
  const decision = items.length === 0
    ? "empty_approval_queue_import_dry_run"
    : blockedItems.length === 0
      ? "approval_queue_import_dry_run_ready"
      : "approval_queue_import_dry_run_contains_blocked_items";

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
    visual_index_records: readinessPreview.visual_index_records,
    visual_assets_root: normalizeProjectPath(visualAssetsRoot),
    confirmation_gate: readinessPreview.confirmation_gate,
    readiness_summary: readinessPreview.summary,
    approval_queue_dry_run_summary: {
      decision,
      approval_item_preview_count: items.length,
      ready_count: readyCount,
      blocked_count: blockedItems.length,
      decision_counts: decisionCounts,
      risk_level: aggregateRisk(items),
      can_write_approval_queue: false,
      can_create_approval_item: false,
      can_confirm_import: false,
    },
    approval_item_previews: items,
    guard_cards: guardCards,
    blocked_items: blockedItems,
    safety_summary: {
      dry_run_ready_is_not_write_authorization: true,
      approval_queue_write_allowed: false,
      approval_item_creation_allowed: false,
      import_confirmation_allowed: false,
      visual_index_write_allowed: false,
      visual_asset_copy_allowed: false,
      canon_visual_lock_creation_allowed: false,
      no_real_import_executed: true,
    },
    no_write_summary: noWriteSummary(),
  };
  preview.summary = compileVisualLibraryApprovalQueueImportDryRunSummary(preview);
  return preview;
}
