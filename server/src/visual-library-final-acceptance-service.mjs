import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  scanVisualLibraryIntakePreview,
} from "./visual-library-rebuild-intake-service.mjs";
import {
  runVisualLibraryImportSimulationPreview,
} from "./visual-library-import-simulation-service.mjs";
import {
  runVisualLibraryPendingImportReadinessPreview,
} from "./visual-library-pending-import-readiness-service.mjs";
import {
  runVisualLibraryApprovalQueueImportDryRunPreview,
} from "./visual-library-approval-queue-import-dry-run-service.mjs";

const finalAcceptanceConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-final-acceptance.json",
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
  "can_write_approval_queue",
  "can_create_approval_item",
  "can_confirm_import",
  "can_write_visual_index",
  "can_copy_visual_asset",
  "can_create_canon_visual_lock",
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

function expectedDecisionForOperation(operation) {
  const decisions = {
    simulated_import_ready: "approval_queue_import_dry_run_ready",
    blocked_by_confirmation_gate: "blocked_by_confirmation_gate",
    blocked_requires_manual_category_review:
      "blocked_requires_manual_category_review",
    blocked_duplicate_requires_manual_review:
      "blocked_duplicate_requires_manual_review",
    blocked_unsafe_target_path: "blocked_unsafe_target_path",
    rejected_unsupported_extension: "rejected_unsupported_extension",
    blocked_missing_source_file: "blocked_missing_source_file",
  };
  return decisions[operation?.import_decision]
    ?? operation?.import_decision
    ?? "blocked_by_readiness_decision";
}

function decisionsEquivalent(expected, actual) {
  if (expected === actual) return true;
  return actual === "blocked_by_readiness_decision"
    && [
      "blocked_requires_manual_category_review",
      "blocked_duplicate_requires_manual_review",
    ].includes(expected);
}

function riskLevelForDecision(decision) {
  if (
    decision === "blocked_unsafe_target_path"
    || decision === "blocked_incomplete_lineage"
    || decision === "blocked_no_write_safety_violation"
    || decision === "blocked_visual_index_not_empty"
  ) {
    return "high";
  }
  if (
    decision === "blocked_requires_manual_category_review"
    || decision === "blocked_duplicate_requires_manual_review"
    || decision === "blocked_by_readiness_decision"
    || decision === "rejected_unsupported_extension"
  ) {
    return "medium";
  }
  return "low";
}

export function validateVisualLibraryFinalAcceptanceConfig(config) {
  requireObject(config, "visual library final acceptance config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18F") throw new Error("phase must be 18F.");
  if (
    config.mode
    !== "read_only_visual_library_approval_guard_ui_readiness_final_acceptance_preview"
  ) {
    throw new Error(
      "mode must be read_only_visual_library_approval_guard_ui_readiness_final_acceptance_preview.",
    );
  }
  for (const field of [
    "intake_config_path",
    "simulation_config_path",
    "readiness_config_path",
    "approval_dry_run_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "required_confirmation_text",
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
  if (config.read_only !== true) throw new Error("read_only must be true.");
  if (config.preview_only !== true) throw new Error("preview_only must be true.");
  if (config.final_acceptance_preview_only !== true) {
    throw new Error("final_acceptance_preview_only must be true.");
  }
  for (const field of noWriteFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryFinalAcceptanceConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryFinalAcceptanceConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(options.configPath, "visual library final acceptance config")
    : finalAcceptanceConfigPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryFinalAcceptanceConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function validateVisualLibraryFinalAcceptanceNoWriteSafety(input) {
  const summary = input?.no_write_summary ?? input;
  const card = input?.ui_readiness_card ?? null;
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
  return {
    valid: violations.length === 0,
    violations,
  };
}

export function buildVisualLibraryUiReadinessCardPreview(input) {
  const sourceFile = input.source_file ?? "empty visual library intake";
  return {
    card_id: stableId(
      "VLFAC-",
      `${input.case_id}|${sourceFile}|${input.actual_decision}`,
    ),
    title: `Visual library final acceptance: ${sourceFile}`,
    phase: "18F",
    candidate_type: "visual_library_import",
    final_acceptance_decision: input.actual_decision,
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_confirm_import: false,
    can_write_visual_index: false,
    can_copy_visual_asset: false,
    can_create_canon_visual_lock: false,
    required_human_checks: [
      "source image identity check",
      "category check",
      "duplicate check",
      "canon status check",
      "target path check",
      "lineage check",
      "visual_index empty baseline check",
      "no canon_visual_lock check",
      "final approval queue guard check",
    ],
    disabled_actions: [
      "write_approval_queue",
      "create_approval_item",
      "confirm_import",
      "write_visual_index",
      "copy_visual_asset",
      "create_canon_visual_lock",
    ],
    allowed_preview_actions: [
      "view_final_acceptance_summary",
      "view_approval_payload_preview",
      "view_lineage",
      "view_risk_summary",
      "view_guard_summary",
      "view_no_write_summary",
    ],
    no_write_summary: noWriteSummary(),
  };
}

export function buildVisualLibraryFinalAcceptanceCase(input) {
  requireObject(input, "visual library final acceptance case input");
  const operation = input.pipeline_results?.import_simulation ?? null;
  const readiness = input.pipeline_results?.pending_import_readiness ?? null;
  const dryRun = input.pipeline_results?.approval_queue_dry_run ?? null;
  const actualDecision = input.actual_decision
    ?? (operation?.import_decision === "rejected_unsupported_extension"
      ? "rejected_unsupported_extension"
      : dryRun?.dry_run_decision === "blocked_by_readiness_decision"
        && readiness?.readiness_decision === "blocked_by_confirmation_gate"
        ? "blocked_by_confirmation_gate"
      : dryRun?.dry_run_decision
        ?? readiness?.readiness_decision
        ?? operation?.import_decision
        ?? "empty_final_acceptance_preview_passed");
  const expectedDecision = input.expected_decision
    ?? expectedDecisionForOperation(operation);
  const caseId = input.case_id ?? stableId(
    "VLFACASE-",
    `${input.case_name ?? ""}|${input.source_file ?? ""}|${actualDecision}`,
  );
  const uiCard = input.ui_readiness_card
    ?? buildVisualLibraryUiReadinessCardPreview({
      case_id: caseId,
      source_file: input.source_file,
      actual_decision: actualDecision,
    });
  const noWrite = input.no_write_summary
    ?? dryRun?.no_write_summary
    ?? noWriteSummary();
  const safety = validateVisualLibraryFinalAcceptanceNoWriteSafety({
    no_write_summary: noWrite,
    ui_readiness_card: uiCard,
  });
  const blockedReasons = [
    ...(dryRun?.blocked_reasons ?? []),
    ...(input.pipeline_results?.pending_import_readiness?.blocked_reasons ?? []),
    ...(operation?.blocked_reasons ?? []),
    ...(input.blocked_reasons ?? []),
    ...safety.violations,
  ];
  const warnings = [
    ...(dryRun?.warnings ?? []),
    ...(input.pipeline_results?.pending_import_readiness?.warnings ?? []),
    ...(operation?.warnings ?? []),
    ...(input.warnings ?? []),
  ];
  return {
    case_id: caseId,
    case_name: input.case_name ?? input.source_file ?? "visual acceptance case",
    source_fixture_type: input.source_fixture_type ?? "scanned_source_file",
    expected_decision: expectedDecision,
    actual_decision: actualDecision,
    passed: decisionsEquivalent(expectedDecision, actualDecision) && safety.valid,
    pipeline_results: {
      intake_preview: input.pipeline_results?.intake_preview ?? null,
      import_simulation: operation,
      pending_import_readiness: readiness,
      approval_queue_dry_run: dryRun,
    },
    ui_readiness_card: uiCard,
    blocked_reasons: [...new Set(blockedReasons)],
    warnings: [...new Set(warnings)],
    risk_summary: input.risk_summary
      ?? dryRun?.risk_summary
      ?? { risk_level: riskLevelForDecision(actualDecision), reasons: blockedReasons },
    no_write_summary: noWrite,
  };
}

export async function runVisualLibraryAcceptanceCasePipeline(options = {}) {
  const sourceDir = options.sourceDir ?? options.source_dir;
  const confirmText = options.confirmText ?? options.confirm_text;
  const intakePreview = options.intakePreview
    ?? await scanVisualLibraryIntakePreview({
      sourceDir,
      configPath: options.intakeConfigPath,
    });
  const simulationPreview = options.simulationPreview
    ?? await runVisualLibraryImportSimulationPreview({
      sourceDir,
      confirmText,
      configPath: options.simulationConfigPath,
      intakePreview,
    });
  const readinessPreview = options.readinessPreview
    ?? await runVisualLibraryPendingImportReadinessPreview({
      sourceDir,
      confirmText,
      configPath: options.readinessConfigPath,
      simulationPreview,
    });
  const approvalDryRunPreview = options.approvalDryRunPreview
    ?? await runVisualLibraryApprovalQueueImportDryRunPreview({
      sourceDir,
      confirmText,
      configPath: options.approvalDryRunConfigPath,
      readinessPreview,
    });

  const intakeBySource = new Map(
    intakePreview.candidates.map((item) => [item.source_file, item]),
  );
  for (const item of intakePreview.rejected_files) {
    intakeBySource.set(item.source_file, item);
  }
  const readinessItems = [
    ...readinessPreview.pending_candidates,
    ...readinessPreview.blocked_candidates,
  ];
  const readinessBySource = new Map(
    readinessItems.map((item) => [item.lineage.source_file, item]),
  );
  const dryRunBySource = new Map(
    approvalDryRunPreview.approval_item_previews.map(
      (item) => [item.lineage.source_file, item],
    ),
  );
  const cases = simulationPreview.operations.map((operation) => (
    buildVisualLibraryFinalAcceptanceCase({
      case_name: operation.source_file,
      source_file: operation.source_file,
      source_fixture_type: operation.import_decision
        === "rejected_unsupported_extension"
        ? "unsupported_extension"
        : "scanned_source_file",
      expected_decision: expectedDecisionForOperation(operation),
      pipeline_results: {
        intake_preview: intakeBySource.get(operation.source_file) ?? null,
        import_simulation: operation,
        pending_import_readiness:
          readinessBySource.get(operation.source_file) ?? null,
        approval_queue_dry_run: dryRunBySource.get(operation.source_file) ?? null,
      },
    })
  ));
  return {
    intake_preview: intakePreview,
    import_simulation: simulationPreview,
    pending_import_readiness: readinessPreview,
    approval_queue_dry_run: approvalDryRunPreview,
    acceptance_cases: cases,
  };
}

export function evaluateVisualLibraryFinalAcceptanceDecision(input) {
  if (input.visual_index_unchanged === false) {
    return "failed_visual_index_modified";
  }
  if (input.visual_assets_unchanged === false) {
    return "failed_visual_assets_modified";
  }
  if (input.active_engine_unchanged === false) {
    return "failed_active_engine_modified";
  }
  if (input.unexpected_write_capability_count > 0) {
    return "failed_unexpected_write_capability";
  }
  if (input.case_count === 0 && input.failed_count === 0) {
    return "empty_final_acceptance_preview_passed";
  }
  if (input.failed_count > 0) return "visual_library_final_acceptance_failed";
  return "visual_library_final_acceptance_passed";
}

export function compileVisualLibraryFinalAcceptanceSummary(preview) {
  requireObject(preview, "visual library final acceptance preview");
  const cases = preview.acceptance_cases;
  const passedCount = cases.filter((item) => item.passed).length;
  const failedCount = cases.length - passedCount;
  const unexpectedWriteCapabilityCount = cases.filter(
    (item) => !validateVisualLibraryFinalAcceptanceNoWriteSafety({
      no_write_summary: item.no_write_summary,
      ui_readiness_card: item.ui_readiness_card,
    }).valid,
  ).length;
  const unexpectedReadyCount = cases.filter(
    (item) => item.actual_decision === "approval_queue_import_dry_run_ready"
      && item.expected_decision !== "approval_queue_import_dry_run_ready",
  ).length;
  const finalDecision = evaluateVisualLibraryFinalAcceptanceDecision({
    case_count: cases.length,
    failed_count: failedCount,
    unexpected_write_capability_count: unexpectedWriteCapabilityCount,
    visual_index_unchanged: preview.safety_summary.visual_index_unchanged,
    visual_assets_unchanged: preview.safety_summary.visual_assets_unchanged,
    active_engine_unchanged: preview.safety_summary.active_engine_unchanged,
  });
  return {
    case_count: cases.length,
    passed_count: passedCount,
    failed_count: failedCount,
    empty_case_count: cases.length === 0 ? 1 : 0,
    ready_dry_run_case_count: cases.filter(
      (item) => item.actual_decision === "approval_queue_import_dry_run_ready",
    ).length,
    blocked_as_expected_count: cases.filter(
      (item) => item.passed
        && item.actual_decision !== "approval_queue_import_dry_run_ready",
    ).length,
    unexpected_ready_count: unexpectedReadyCount,
    unexpected_write_capability_count: unexpectedWriteCapabilityCount,
    no_write_safety_passed: unexpectedWriteCapabilityCount === 0
      && preview.safety_summary.visual_index_unchanged
      && preview.safety_summary.visual_assets_unchanged
      && preview.safety_summary.active_engine_unchanged,
    final_acceptance_decision: finalDecision,
  };
}

export async function runVisualLibraryFinalAcceptancePreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryFinalAcceptanceConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "visual library final acceptance source directory",
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
  const engineHash = sha256Lf(before.active_engine.toString("utf8"));
  if (engineHash !== config.expected_engine_sha256_lf) {
    throw new Error(
      `engine hash mismatch: expected ${config.expected_engine_sha256_lf} got ${engineHash}`,
    );
  }

  const pipeline = await runVisualLibraryAcceptanceCasePipeline({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText: options.confirmText ?? options.confirm_text,
    intakeConfigPath: config.intake_config_path,
    simulationConfigPath: config.simulation_config_path,
    readinessConfigPath: config.readiness_config_path,
    approvalDryRunConfigPath: config.approval_dry_run_config_path,
  });
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
    approval_queue_write_allowed: false,
    approval_item_creation_allowed: false,
    import_confirmation_allowed: false,
    visual_index_write_allowed: false,
    visual_asset_copy_allowed: false,
    canon_visual_lock_creation_allowed: false,
    no_real_import_executed: true,
  };
  const preview = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    source_dir: normalizeProjectPath(sourceDir),
    confirmation_gate: pipeline.import_simulation.confirmation_gate,
    pipeline_summary: {
      intake_preview: pipeline.intake_preview.summary,
      import_simulation: pipeline.import_simulation.summary,
      pending_import_readiness: pipeline.pending_import_readiness.summary,
      approval_queue_dry_run: pipeline.approval_queue_dry_run.summary,
    },
    acceptance_summary: null,
    acceptance_cases: pipeline.acceptance_cases,
    ui_readiness_cards: pipeline.acceptance_cases.map(
      (item) => item.ui_readiness_card,
    ),
    blocked_cases: pipeline.acceptance_cases.filter(
      (item) => item.actual_decision !== "approval_queue_import_dry_run_ready",
    ),
    safety_summary: safetySummary,
    no_write_summary: noWriteSummary(),
    final_acceptance_decision: null,
  };
  preview.acceptance_summary = compileVisualLibraryFinalAcceptanceSummary(preview);
  preview.final_acceptance_decision =
    preview.acceptance_summary.final_acceptance_decision;
  return preview;
}
