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
import {
  runVisualLibraryFinalAcceptancePreview,
} from "./visual-library-final-acceptance-service.mjs";
import {
  runVisualLibraryControlledImportGuardPreview,
} from "./visual-library-controlled-import-guard-service.mjs";
import {
  runVisualLibraryConfirmedImport,
} from "./visual-library-confirmed-import-service.mjs";
import {
  runVisualLibraryRollbackDeleteRestoreOperation,
} from "./visual-library-rollback-delete-restore-service.mjs";

const uiConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-ui-import-flow.json",
);
const writeOperations = new Set([
  "import",
  "rollback-import",
  "delete",
  "restore",
]);
const allowedOperations = new Set(["preview", ...writeOperations]);
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

function lineCount(text) {
  return normalizeLf(text).split("\n").filter((line) => line.trim()).length;
}

async function imageCount(root) {
  let count = 0;
  async function walk(current) {
    let children;
    try {
      children = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const child of children) {
      const absolute = path.join(current, child.name);
      if (child.isDirectory()) await walk(absolute);
      else if ([".png", ".jpg", ".jpeg", ".webp", ".gif"]
        .includes(path.extname(child.name).toLowerCase())) count += 1;
    }
  }
  await walk(root);
  return count;
}

function phaseCard(input) {
  return {
    card_id: `VLUI-${input.phase_source}`,
    title: input.title,
    phase_source: input.phase_source,
    status: input.status,
    summary: input.summary,
    warnings: input.warnings ?? [],
    blockers: input.blockers ?? [],
    required_human_checks: input.required_human_checks ?? [],
    allowed_preview_actions: input.allowed_preview_actions ?? ["view_summary"],
    disabled_write_actions: [
      "write_visual_index",
      "copy_visual_asset",
      "move_visual_asset",
      "delete_visual_asset",
      "write_approval_queue",
      "create_approval_item",
      "create_canon_visual_lock",
    ],
    can_continue: input.can_continue ?? false,
    can_execute: input.can_execute ?? false,
  };
}

export function validateVisualLibraryUiImportFlowConfig(config) {
  requireObject(config, "visual library UI import flow config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19C") throw new Error("phase must be 19C.");
  if (config.mode !== "visual_library_ui_import_flow_review_screen") {
    throw new Error("mode must be visual_library_ui_import_flow_review_screen.");
  }
  for (const field of [
    "intake_config_path",
    "simulation_config_path",
    "readiness_config_path",
    "approval_dry_run_config_path",
    "final_acceptance_config_path",
    "controlled_guard_config_path",
    "confirmed_import_config_path",
    "rollback_delete_restore_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "required_simulation_confirmation_text",
    "required_pre_write_confirmation_text",
    "required_real_import_confirmation_text",
    "required_rollback_confirmation_text",
    "required_delete_confirmation_text",
    "required_restore_confirmation_text",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  for (const field of [
    "ui_preview_only_by_default",
    "requires_exact_confirmation",
    "requires_execute_flag",
  ]) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of noWriteFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryUiImportFlowConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryUiImportFlowConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "UI import flow config")
    : uiConfigPath;
  const config = JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryUiImportFlowConfig(config),
    config_path: normalizeProjectPath(resolved),
  };
}

export function buildVisualLibraryUiImportWizardState(input) {
  const steps = [
    ["intake_scan", input.intake_ready],
    ["simulation_confirmation", input.simulation_ready],
    ["pending_readiness_review", input.readiness_ready],
    ["approval_dry_run_review", input.approval_ready],
    ["final_acceptance_review", input.acceptance_ready],
    ["controlled_import_guard_review", input.guard_ready],
    ["confirmed_import_preflight", input.guard_ready],
    ["confirmed_import_execute", input.import_executed],
    ["rollback_delete_restore_review", input.operation_review_ready],
    ["final_safety_summary", input.safety_ready],
  ];
  return steps.map(([step_id, complete], index) => ({
    step_id,
    step_number: index + 1,
    status: complete ? "passed" : "review_required",
    can_continue: Boolean(complete),
  }));
}

export function buildVisualLibraryUiOperationCards(input) {
  return [
    ["import", input.action_availability.can_import],
    ["rollback-import", input.action_availability.can_rollback_import],
    ["delete", input.action_availability.can_delete],
    ["restore", input.action_availability.can_restore],
  ].map(([operation, available]) => ({
    card_id: `VLUI-OP-${operation.toUpperCase()}`,
    operation,
    status: available ? "executable_with_confirmation" : "blocked",
    requires_execute: true,
    requires_exact_confirmation: true,
    available,
    disabled_reason:
      input.action_availability.disabled_reason_by_action[operation] ?? null,
  }));
}

export function buildVisualLibraryUiSafetyPanel(input) {
  const formalEmpty =
    input.visual_index_line_count === 0
    && input.visual_assets_image_count === 0;
  return {
    active_engine_hash_expected: input.expected_engine_hash,
    active_engine_hash_actual: input.actual_engine_hash,
    active_engine_hash_passed:
      input.expected_engine_hash === input.actual_engine_hash,
    visual_index_line_count: input.visual_index_line_count,
    visual_assets_image_count: input.visual_assets_image_count,
    formal_gallery_empty_baseline: formalEmpty,
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
    safety_decision:
      formalEmpty && input.expected_engine_hash === input.actual_engine_hash
        ? "formal_baseline_safe"
        : "formal_baseline_requires_review",
  };
}

export function buildVisualLibraryUiActionAvailability(input) {
  const guardReady =
    input.guard_decision === "ready_for_phase_19a_confirmed_import";
  const hasVisualId = Boolean(input.visual_id);
  const hasManifest = Boolean(input.manifest);
  return {
    can_preview: true,
    can_import: guardReady,
    can_rollback_import: hasManifest,
    can_delete: hasVisualId,
    can_restore: hasManifest,
    can_write_visual_index:
      input.execution_authorized === true
      && writeOperations.has(input.operation),
    can_copy_visual_asset:
      input.execution_authorized === true && input.operation === "import",
    can_move_visual_asset:
      input.execution_authorized === true
      && ["rollback-import", "delete", "restore"].includes(input.operation),
    can_delete_visual_asset:
      input.execution_authorized === true && input.operation === "rollback-import",
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_create_canon_visual_lock: false,
    disabled_reason_by_action: {
      import: guardReady ? null : "controlled_import_guard_not_ready",
      "rollback-import": hasManifest ? null : "rollback_manifest_required",
      delete: hasVisualId ? null : "visual_id_required",
      restore: hasManifest ? null : "delete_manifest_required",
      write_approval_queue: "forbidden_in_phase_19c",
      create_approval_item: "forbidden_in_phase_19c",
      create_canon_visual_lock: "forbidden_in_phase_19c",
    },
  };
}

export function evaluateVisualLibraryUiFlowDecision(input) {
  if (input.forbidden_capability) return "failed_forbidden_side_effect_capability";
  if (input.formal_write_attempt) return "failed_unexpected_formal_write_attempt";
  if (input.operation === "preview") {
    return input.item_count === 0
      ? "empty_ui_import_flow_preview_passed"
      : "visual_library_ui_import_flow_preview_ready";
  }
  if (!input.operation) return "blocked_missing_operation";
  if (!input.execute_requested) return "blocked_missing_execute_flag";
  if (!input.confirmation_accepted) return "blocked_by_confirmation_gate";
  if (input.operation === "import") {
    if (input.delegate_decision === "confirmed_visual_import_completed") {
      return "sandbox_ui_import_flow_import_completed";
    }
    return "blocked_confirmed_import_not_ready";
  }
  const success = {
    "rollback-import": "visual_import_rollback_completed",
    delete: "visual_delete_completed",
    restore: "visual_restore_completed",
  };
  const mapped = {
    "rollback-import": "sandbox_ui_import_flow_rollback_completed",
    delete: "sandbox_ui_import_flow_delete_completed",
    restore: "sandbox_ui_import_flow_restore_completed",
  };
  return input.delegate_decision === success[input.operation]
    ? mapped[input.operation]
    : "blocked_rollback_delete_restore_not_ready";
}

export function buildVisualLibraryUiReviewScreenModel(input) {
  const guardReady =
    input.guard.controlled_import_guard_decision
    === "ready_for_phase_19a_confirmed_import";
  const cards = [
    phaseCard({
      title: "Intake scan",
      phase_source: "18B",
      status: input.intake.candidate_count === 0 ? "empty" : "preview_ready",
      summary: input.intake,
      can_continue: true,
    }),
    phaseCard({
      title: "Import simulation",
      phase_source: "18C",
      status: input.simulation.confirmation_accepted
        ? "confirmation_accepted"
        : "preview_only",
      summary: input.simulation,
      required_human_checks: ["exact simulation confirmation"],
      can_continue: input.simulation.confirmation_accepted,
    }),
    phaseCard({
      title: "Pending import readiness",
      phase_source: "18D",
      status: input.readiness.decision,
      summary: input.readiness,
      can_continue: input.readiness.ready_candidate_count > 0,
    }),
    phaseCard({
      title: "Approval dry-run",
      phase_source: "18E",
      status: input.approval.decision,
      summary: input.approval,
      can_continue: input.approval.ready_count > 0,
    }),
    phaseCard({
      title: "Final acceptance",
      phase_source: "18F",
      status: input.acceptance.final_acceptance_decision,
      summary: input.acceptance,
      can_continue: input.acceptance.failed_count === 0,
    }),
    phaseCard({
      title: "Controlled import guard",
      phase_source: "18G",
      status: input.guard.controlled_import_guard_decision,
      summary: input.guard.controlled_import_guard_summary,
      blockers: input.guard.blocked_items.map((item) => item.guard_decision),
      required_human_checks: [
        "source identity",
        "source hash",
        "target path",
        "visual index baseline",
      ],
      can_continue: guardReady,
    }),
    phaseCard({
      title: "Confirmed import preflight",
      phase_source: "19A",
      status: guardReady ? "confirmed_import_executable" : "blocked",
      summary: input.confirmed_import,
      required_human_checks: ["three exact confirmations", "explicit execute"],
      can_continue: guardReady,
      can_execute: input.action_availability.can_import,
    }),
    phaseCard({
      title: "Rollback / delete / restore",
      phase_source: "19B",
      status: "operation_review_ready",
      summary: input.rollback_delete_restore,
      required_human_checks: [
        "explicit operation",
        "operation manifest where required",
        "exact confirmation",
      ],
      can_continue: true,
    }),
  ];
  const wizard = buildVisualLibraryUiImportWizardState({
    intake_ready: true,
    simulation_ready: input.simulation.confirmation_accepted,
    readiness_ready: input.readiness.ready_candidate_count > 0,
    approval_ready: input.approval.ready_count > 0,
    acceptance_ready: input.acceptance.failed_count === 0,
    guard_ready: guardReady,
    import_executed:
      input.operation_result?.confirmed_import_decision
      === "confirmed_visual_import_completed",
    operation_review_ready: true,
    safety_ready: input.safety_panel.safety_decision === "formal_baseline_safe",
  });
  return {
    phase: "19C",
    mode: "visual_library_ui_import_flow_review_screen",
    source_dir: input.source_dir,
    visual_index_state: {
      path: input.visual_index_path,
      line_count: input.safety_panel.visual_index_line_count,
    },
    visual_assets_state: {
      root: input.visual_assets_root,
      image_count: input.safety_panel.visual_assets_image_count,
    },
    active_engine_state: {
      hash: input.safety_panel.active_engine_hash_actual,
      passed: input.safety_panel.active_engine_hash_passed,
    },
    wizard_steps: wizard,
    review_cards: cards,
    operation_cards: buildVisualLibraryUiOperationCards(input),
    safety_panel: input.safety_panel,
    action_bar: input.action_availability,
    warnings: cards.flatMap((card) => card.warnings),
    blockers: cards.flatMap((card) => card.blockers),
    operation_result: input.operation_result,
    ui_flow_decision: input.ui_flow_decision,
  };
}

export function compileVisualLibraryUiImportFlowSummary(model) {
  return {
    wizard_step_count: model.wizard_steps.length,
    review_card_count: model.review_cards.length,
    operation_card_count: model.operation_cards.length,
    blocker_count: model.blockers.length,
    formal_gallery_empty_baseline:
      model.safety_panel.formal_gallery_empty_baseline,
    ui_flow_decision: model.ui_flow_decision,
  };
}

export async function runVisualLibraryUiImportFlowPreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryUiImportFlowConfig(options);
  const operation = options.operation ?? "preview";
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? config.default_source_dir,
    "UI import flow source directory",
  );
  const formalIndexPath = resolveProjectPath(
    config.visual_index_path,
    "formal visual index",
  );
  const formalAssetsRoot = resolveProjectPath(
    config.visual_assets_root,
    "formal visual assets",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine",
  );
  const formalIndexBefore = await readFile(formalIndexPath);
  const formalAssetCountBefore = await imageCount(formalAssetsRoot);
  const engineBefore = await readFile(activeEnginePath);
  const actualEngineHash = sha256Lf(engineBefore.toString("utf8"));
  if (actualEngineHash !== config.expected_engine_sha256_lf) {
    throw new Error("active engine hash mismatch");
  }
  const confirmText = options.confirmText;
  const preWriteConfirmText = options.preWriteConfirmText;
  const intake = await scanVisualLibraryIntakePreview({
    sourceDir: normalizeProjectPath(sourceDir),
    configPath: config.intake_config_path,
  });
  const simulation = await runVisualLibraryImportSimulationPreview({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText,
    configPath: config.simulation_config_path,
    intakePreview: intake,
  });
  const readiness = await runVisualLibraryPendingImportReadinessPreview({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText,
    configPath: config.readiness_config_path,
    simulationPreview: simulation,
  });
  const approval = await runVisualLibraryApprovalQueueImportDryRunPreview({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText,
    configPath: config.approval_dry_run_config_path,
    readinessPreview: readiness,
  });
  const acceptance = await runVisualLibraryFinalAcceptancePreview({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText,
    configPath: config.final_acceptance_config_path,
  });
  const guard = await runVisualLibraryControlledImportGuardPreview({
    sourceDir: normalizeProjectPath(sourceDir),
    confirmText,
    preWriteConfirmText,
    configPath: config.controlled_guard_config_path,
  });
  const manifest = options.manifest ?? null;
  let actionAvailability = buildVisualLibraryUiActionAvailability({
    guard_decision: guard.controlled_import_guard_decision,
    visual_id: options.visualId,
    manifest,
    execute_requested: options.execute === true,
    operation,
    execution_authorized: false,
  });
  let operationResult = null;
  let confirmationAccepted = operation === "preview";
  if (writeOperations.has(operation) && options.execute === true) {
    if (operation === "import") {
      confirmationAccepted =
        confirmText === config.required_simulation_confirmation_text
        && preWriteConfirmText === config.required_pre_write_confirmation_text
        && options.realImportConfirmText
          === config.required_real_import_confirmation_text;
      if (confirmationAccepted) {
        operationResult = await runVisualLibraryConfirmedImport({
          execute: true,
          sourceDir: normalizeProjectPath(sourceDir),
          visualIndexPath: options.visualIndexPath,
          visualAssetsRoot: options.assetsRoot,
          controlledGuardPreview: guard,
          confirmText,
          preWriteConfirmText,
          realImportConfirmText: options.realImportConfirmText,
          configPath: config.confirmed_import_config_path,
        });
      }
    } else {
      const supplied = operation === "rollback-import"
        ? options.rollbackConfirmText
        : operation === "delete"
          ? options.deleteConfirmText
          : options.restoreConfirmText;
      const required = operation === "rollback-import"
        ? config.required_rollback_confirmation_text
        : operation === "delete"
          ? config.required_delete_confirmation_text
          : config.required_restore_confirmation_text;
      confirmationAccepted = supplied === required;
      if (confirmationAccepted) {
        operationResult = await runVisualLibraryRollbackDeleteRestoreOperation({
          operation,
          execute: true,
          visualId: options.visualId,
          manifest,
          manifestPath: options.manifestPath,
          visualIndexPath: options.visualIndexPath,
          assetsRoot: options.assetsRoot,
          trashRoot: options.trashRoot,
          restoreRoot: options.restoreRoot,
          confirmText: supplied,
          configPath: config.rollback_delete_restore_config_path,
        });
      }
    }
  }
  const formalIndexAfter = await readFile(formalIndexPath);
  const formalAssetCountAfter = await imageCount(formalAssetsRoot);
  const formalWriteAttempt =
    !formalIndexBefore.equals(formalIndexAfter)
    || formalAssetCountBefore !== formalAssetCountAfter;
  const forbiddenCapability =
    actionAvailability.can_write_approval_queue
    || actionAvailability.can_create_approval_item
    || actionAvailability.can_create_canon_visual_lock;
  const safetyPanel = buildVisualLibraryUiSafetyPanel({
    expected_engine_hash: config.expected_engine_sha256_lf,
    actual_engine_hash: actualEngineHash,
    visual_index_line_count: lineCount(formalIndexAfter.toString("utf8")),
    visual_assets_image_count: formalAssetCountAfter,
  });
  const delegateDecision =
    operationResult?.confirmed_import_decision
    ?? operationResult?.operation_decision
    ?? null;
  const successfulDelegate = [
    "confirmed_visual_import_completed",
    "visual_import_rollback_completed",
    "visual_delete_completed",
    "visual_restore_completed",
  ].includes(delegateDecision);
  actionAvailability = buildVisualLibraryUiActionAvailability({
    guard_decision: guard.controlled_import_guard_decision,
    visual_id: options.visualId,
    manifest,
    execute_requested: options.execute === true,
    operation,
    execution_authorized: successfulDelegate,
  });
  const uiFlowDecision = !allowedOperations.has(operation)
    ? "blocked_missing_operation"
    : evaluateVisualLibraryUiFlowDecision({
      operation,
      execute_requested: options.execute === true,
      confirmation_accepted: confirmationAccepted,
      delegate_decision: delegateDecision,
      item_count: intake.summary?.candidate_count ?? intake.candidates.length,
      forbidden_capability: forbiddenCapability,
      formal_write_attempt: formalWriteAttempt,
    });
  const model = buildVisualLibraryUiReviewScreenModel({
    source_dir: normalizeProjectPath(sourceDir),
    visual_index_path: normalizeProjectPath(formalIndexPath),
    visual_assets_root: normalizeProjectPath(formalAssetsRoot),
    intake: {
      ...(intake.summary ?? {}),
      candidate_count: intake.candidates.length,
    },
    simulation: {
      ...simulation.summary,
      confirmation_accepted: simulation.confirmation_gate.accepted,
    },
    readiness: readiness.summary,
    approval: approval.summary,
    acceptance: acceptance.acceptance_summary,
    guard,
    confirmed_import: {
      guard_ready:
        guard.controlled_import_guard_decision
        === "ready_for_phase_19a_confirmed_import",
      execute_requested: options.execute === true,
      result: operation === "import" ? operationResult : null,
    },
    rollback_delete_restore: {
      rollback_manifest_available: Boolean(manifest),
      visual_id_available: Boolean(options.visualId),
      result: operation !== "import" ? operationResult : null,
    },
    operation_result: operationResult,
    operation,
    action_availability: actionAvailability,
    safety_panel: safetyPanel,
    ui_flow_decision: uiFlowDecision,
  });
  return {
    schema_version: config.schema_version,
    config_path: loadedConfigPath,
    ...model,
    pipeline_summaries: {
      intake: intake.summary,
      simulation: simulation.summary,
      readiness: readiness.summary,
      approval_dry_run: approval.summary,
      final_acceptance: acceptance.acceptance_summary,
      controlled_guard: guard.controlled_import_guard_summary,
    },
    summary: compileVisualLibraryUiImportFlowSummary(model),
  };
}
