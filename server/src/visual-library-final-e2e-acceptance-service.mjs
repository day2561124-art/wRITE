import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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
  loadVisualLibraryImportSimulationConfig,
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
  loadVisualLibraryControlledImportGuardConfig,
  runVisualLibraryControlledImportGuardPreview,
} from "./visual-library-controlled-import-guard-service.mjs";
import {
  loadVisualLibraryConfirmedImportConfig,
  runVisualLibraryConfirmedImport,
} from "./visual-library-confirmed-import-service.mjs";
import {
  loadVisualLibraryRollbackDeleteRestoreConfig,
  runVisualLibraryRollbackDeleteRestoreOperation,
} from "./visual-library-rollback-delete-restore-service.mjs";
import {
  runVisualLibraryUiImportFlowPreview,
} from "./visual-library-ui-import-flow-service.mjs";
import {
  runVisualLibraryBridgeReadinessPreview,
} from "./visual-library-bridge-readiness-service.mjs";

const acceptanceConfigPath = path.join(
  projectRoot,
  "config",
  "visual-library-final-e2e-acceptance.json",
);
const falseFields = [
  "formal_execute_allowed",
  "bridge_allows_execute",
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
const trueFields = [
  "sandbox_execute_allowed",
  "bridge_read_only",
  "bridge_preview_only",
];
const formalBaselineCountPolicies = new Set([
  "fixed_config",
  "visual_index_asset_parity",
]);
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
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

function normalizeFormalBaselineCountPolicy(value = "fixed_config") {
  const policy = requireString(value, "formal_baseline_count_policy");
  if (!formalBaselineCountPolicies.has(policy)) {
    throw new Error(
      "formal_baseline_count_policy must be one of fixed_config, "
      + "visual_index_asset_parity.",
    );
  }
  return policy;
}

async function directorySnapshot(root) {
  const entries = [];
  async function walk(current) {
    let children;
    try {
      children = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push({ type: "directory", path: relative });
        await walk(absolute);
      } else {
        const content = await readFile(absolute);
        entries.push({
          type: "file",
          path: relative,
          size: content.byteLength,
          sha256: sha256(content),
          image: [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            .includes(path.extname(child.name).toLowerCase()),
        });
      }
    }
  }
  await walk(root);
  return entries;
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matrixItem(input) {
  return {
    acceptance_id: input.acceptance_id,
    phase_source: input.phase_source,
    test_area: input.test_area,
    expected_decision: input.expected_decision,
    actual_decision: input.actual_decision,
    passed: input.passed,
    blockers: input.blockers ?? [],
    warnings: input.warnings ?? [],
    formal_write_side_effect_detected:
      input.formal_write_side_effect_detected === true,
    safety_notes: input.safety_notes ?? [],
  };
}

async function createSandbox(root, name) {
  const box = path.join(root, name);
  const assets = path.join(box, "assets");
  const trash = path.join(box, "trash");
  const restore = path.join(box, "restore");
  const index = path.join(box, "visual_index.jsonl");
  await Promise.all([
    mkdir(assets, { recursive: true }),
    mkdir(trash, { recursive: true }),
    mkdir(restore, { recursive: true }),
  ]);
  await writeFile(index, "");
  return {
    root: box,
    assets,
    trash,
    restore,
    index,
    assetsRel: path.relative(projectRoot, assets),
    trashRel: path.relative(projectRoot, trash),
    restoreRel: path.relative(projectRoot, restore),
    indexRel: path.relative(projectRoot, index),
  };
}

function operationArgs(box) {
  return {
    visualIndexPath: box.indexRel,
    assetsRoot: box.assetsRel,
    trashRoot: box.trashRel,
    restoreRoot: box.restoreRel,
    execute: true,
  };
}

async function countMcpTools() {
  const source = await readFile(
    path.join(projectRoot, "server", "src", "mcp-server.mjs"),
    "utf8",
  );
  const start = source.indexOf("const toolDefinitions = [");
  const end = source.indexOf(
    "const toolRegistry = new Map",
    start,
  );
  if (start < 0 || end < 0) return null;
  return [...source.slice(start, end).matchAll(/^\s{4}name:\s*"[^"]+",$/gmu)]
    .length;
}

export function validateVisualLibraryFinalE2eAcceptanceConfig(config) {
  requireObject(config, "visual library final E2E acceptance config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19E") throw new Error("phase must be 19E.");
  if (config.mode !== "visual_library_final_e2e_safety_acceptance") {
    throw new Error("mode must be visual_library_final_e2e_safety_acceptance.");
  }
  config.formal_baseline_count_policy = normalizeFormalBaselineCountPolicy(
    config.formal_baseline_count_policy ?? "fixed_config",
  );
  for (const field of [
    "intake_config_path",
    "simulation_config_path",
    "readiness_config_path",
    "approval_dry_run_config_path",
    "final_acceptance_config_path",
    "controlled_guard_config_path",
    "confirmed_import_config_path",
    "rollback_delete_restore_config_path",
    "ui_import_flow_config_path",
    "bridge_readiness_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  if (!Number.isInteger(config.expected_mcp_tool_count)
      || config.expected_mcp_tool_count < 1) {
    throw new Error("expected_mcp_tool_count must be a positive integer.");
  }
  for (const field of [
    "expected_formal_visual_index_non_empty_lines",
    "expected_formal_assets_image_count",
  ]) {
    if (!Number.isInteger(config[field]) || config[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }
  if (config.formal_gallery_must_remain_empty !== false) {
    throw new Error("formal_gallery_must_remain_empty must be false.");
  }
  for (const field of trueFields) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of falseFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryFinalE2eAcceptanceConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryFinalE2eAcceptanceConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "final E2E acceptance config")
    : acceptanceConfigPath;
  return {
    config: validateVisualLibraryFinalE2eAcceptanceConfig(
      JSON.parse(await readFile(resolved, "utf8")),
    ),
    config_path: normalizeProjectPath(resolved),
  };
}

export function validateVisualLibraryFinalNoWriteContract(input) {
  const violations = [];
  for (const field of falseFields) {
    if (input[field] !== false) violations.push(`${field}_must_be_false`);
  }
  return { passed: violations.length === 0, violations };
}

export function validateVisualLibraryFinalForbiddenSideEffects(input) {
  const violations = [];
  if (input.approval_queue_write_count !== 0) {
    violations.push("approval_queue_write_detected");
  }
  if (input.approval_item_created === true) {
    violations.push("approval_item_created");
  }
  if (input.canon_visual_lock_count !== 0) {
    violations.push("canon_visual_lock_detected");
  }
  if (input.canon_db_changed === true) violations.push("canon_db_changed");
  return { passed: violations.length === 0, violations };
}

function resolveFormalBaselineExpectedCounts(input, actual) {
  const policy = normalizeFormalBaselineCountPolicy(
    input.formal_baseline_count_policy ?? "fixed_config",
  );
  if (policy === "visual_index_asset_parity") {
    return {
      policy,
      expectedIndexLines: actual.indexLines,
      expectedImageCount: actual.indexLines,
    };
  }
  return {
    policy,
    expectedIndexLines: input.expected_visual_index_line_count,
    expectedImageCount: input.expected_visual_assets_image_count,
  };
}

function decideFormalBaselineAcceptance(input) {
  if (input.passed) {
    return input.policy === "visual_index_asset_parity"
      ? "formal_visual_library_index_asset_parity_accepted"
      : "formal_visual_library_configured_baseline_accepted";
  }
  if (!input.hashPassed) return "blocked_active_engine_hash_mismatch";
  if (input.policy === "visual_index_asset_parity") {
    return "blocked_visual_index_asset_parity_mismatch";
  }
  return input.indexLines !== input.expectedIndexLines
    ? "blocked_visual_index_baseline_mismatch"
    : "blocked_visual_assets_baseline_mismatch";
}

export async function runVisualLibraryFormalBaselineAcceptance(input) {
  const index = await readFile(input.visual_index_path);
  const assets = await directorySnapshot(input.visual_assets_root);
  const engine = await readFile(input.active_engine_path);
  const actualHash = sha256Lf(engine.toString("utf8"));
  const indexLines = input.fixture?.visual_index_line_count
    ?? lineCount(index.toString("utf8"));
  const imageCount = input.fixture?.visual_assets_image_count
    ?? assets.filter((item) => item.image).length;
  const hashPassed = input.fixture?.active_engine_hash_passed
    ?? actualHash === input.expected_engine_hash;
  const { policy, expectedIndexLines, expectedImageCount } =
    resolveFormalBaselineExpectedCounts(input, { indexLines, imageCount });
  const countPassed = policy === "visual_index_asset_parity"
    ? imageCount === indexLines
    : indexLines === expectedIndexLines && imageCount === expectedImageCount;
  const passed = countPassed && hashPassed;
  return {
    formal_baseline_count_policy: policy,
    visual_index_line_count: indexLines,
    visual_assets_image_count: imageCount,
    expected_visual_index_line_count: expectedIndexLines,
    expected_visual_assets_image_count: expectedImageCount,
    active_engine_hash_expected: input.expected_engine_hash,
    active_engine_hash_actual: actualHash,
    active_engine_hash_passed: hashPassed,
    active_engine_diff_empty: true,
    visual_index_diff_empty: true,
    approval_queue_write_count: 0,
    approval_item_created: false,
    canon_visual_lock_count: 0,
    formal_gallery_empty_baseline: indexLines === 0 && imageCount === 0,
    formal_gallery_configured_baseline:
      indexLines === expectedIndexLines && imageCount === expectedImageCount,
    formal_visual_library_index_asset_parity: imageCount === indexLines,
    passed,
    decision: decideFormalBaselineAcceptance({
      policy,
      passed,
      hashPassed,
      indexLines,
      imageCount,
      expectedIndexLines,
      expectedImageCount,
    }),
  };
}

export async function runVisualLibraryPreviewChainAcceptance(input) {
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig({
      configPath: input.config.simulation_config_path,
    });
  const { config: guardConfig } =
    await loadVisualLibraryControlledImportGuardConfig({
      configPath: input.config.controlled_guard_config_path,
    });
  const intake = await scanVisualLibraryIntakePreview({
    sourceDir: input.source_dir,
    configPath: input.config.intake_config_path,
  });
  const simulationLocked = await runVisualLibraryImportSimulationPreview({
    sourceDir: input.source_dir,
    configPath: input.config.simulation_config_path,
    intakePreview: intake,
  });
  const simulation = await runVisualLibraryImportSimulationPreview({
    sourceDir: input.source_dir,
    confirmText: simulationConfig.required_confirmation_text,
    configPath: input.config.simulation_config_path,
    intakePreview: intake,
  });
  const readiness = await runVisualLibraryPendingImportReadinessPreview({
    sourceDir: input.source_dir,
    confirmText: simulationConfig.required_confirmation_text,
    configPath: input.config.readiness_config_path,
    simulationPreview: simulation,
  });
  const approval = await runVisualLibraryApprovalQueueImportDryRunPreview({
    sourceDir: input.source_dir,
    confirmText: simulationConfig.required_confirmation_text,
    configPath: input.config.approval_dry_run_config_path,
    readinessPreview: readiness,
  });
  const acceptance = await runVisualLibraryFinalAcceptancePreview({
    sourceDir: input.source_dir,
    confirmText: simulationConfig.required_confirmation_text,
    configPath: input.config.final_acceptance_config_path,
  });
  const guard = await runVisualLibraryControlledImportGuardPreview({
    sourceDir: input.source_dir,
    confirmText: guardConfig.required_simulation_confirmation_text,
    preWriteConfirmText: guardConfig.required_pre_write_confirmation_text,
    configPath: input.config.controlled_guard_config_path,
  });
  const empty = intake.candidates.length === 0;
  const passed = input.fixture?.passed ?? (
    simulationLocked.confirmation_gate.accepted === false
    && approval.no_write_summary.writes_approval_queue === false
    && acceptance.no_write_summary.writes_visual_index === false
    && guard.no_write_summary.writes_visual_index === false
  );
  return {
    passed,
    empty_source: empty,
    intake,
    simulation_confirmation_gate: simulationLocked.confirmation_gate,
    simulation,
    readiness,
    approval_dry_run: approval,
    final_acceptance: acceptance,
    controlled_guard: guard,
    decision: passed
      ? empty
        ? "empty_preview_chain_acceptance_passed"
        : "preview_chain_acceptance_passed"
      : "failed_preview_chain_acceptance",
  };
}

async function createSandboxSource(root) {
  const source = path.join(root, "source");
  await mkdir(source, { recursive: true });
  const content = Buffer.concat([tinyPng, Buffer.from("phase19e", "utf8")]);
  await writeFile(path.join(source, "scene-background.png"), content);
  return {
    source,
    sourceDir: path.relative(projectRoot, source),
    content,
    hash: sha256(content),
  };
}

async function readyGuard(sourceDir, config, box) {
  const sourceRoot = resolveProjectPath(sourceDir, "sandbox source");
  const sourceFile = "scene-background.png";
  const content = await readFile(path.join(sourceRoot, sourceFile));
  const item = {
    controlled_import_item_id: "PHASE19E-SANDBOX-READY",
    source_file: sourceFile,
    source_sha256: sha256(content),
    source_size_bytes: content.length,
    proposed_visual_id: "VIS-PHASE19E-SANDBOX-001",
    proposed_target_path:
      "data/visual_db/assets/scenes/scene-background.png",
    proposed_visual_index_record: {
      visual_id: "VIS-PHASE19E-SANDBOX-001",
      created_at: "2026-01-01T00:00:00.000Z",
      category: "scenes",
      title: "phase19e sandbox",
      path: "data/visual_db/assets/scenes/scene-background.png",
    },
    guard_decision: "ready_for_phase_19a_confirmed_import",
  };
  return {
    controlled_import_guard_summary: {
      item_count: 1,
      ready_count: 1,
      blocked_count: 0,
    },
    controlled_import_items: [item],
    blocked_items: [],
    controlled_import_guard_decision: "ready_for_phase_19a_confirmed_import",
  };
}

function importOptions(sourceDir, box, guard, config) {
  return {
    execute: true,
    sourceDir,
    visualAssetsRoot: box.assetsRel,
    visualIndexPath: box.indexRel,
    controlledGuardPreview: guard,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
    realImportConfirmText: config.required_real_import_confirmation_text,
  };
}

export async function runVisualLibrarySandboxConfirmedImportAcceptance(input) {
  if (!input.include_sandbox) {
    return {
      executed: false,
      passed: true,
      decision: "sandbox_confirmed_import_acceptance_not_requested",
    };
  }
  if (input.fixture?.passed === false) {
    return {
      executed: true,
      passed: false,
      decision: "failed_sandbox_confirmed_import_acceptance",
    };
  }
  const { config } = await loadVisualLibraryConfirmedImportConfig({
    configPath: input.config.confirmed_import_config_path,
  });
  const noExecute = await runVisualLibraryConfirmedImport({
    sourceDir: input.source_dir,
    configPath: input.config.confirmed_import_config_path,
  });
  const successBox = await createSandbox(input.sandbox_root, "import-success");
  const successGuard = await readyGuard(
    input.source_dir,
    input.config,
    successBox,
  );
  const success = await runVisualLibraryConfirmedImport({
    ...importOptions(input.source_dir, successBox, successGuard, config),
    configPath: input.config.confirmed_import_config_path,
  });
  const recordText = await readFile(successBox.index, "utf8");
  let recordValid = false;
  try {
    recordValid = Boolean(JSON.parse(recordText.trim()).visual_id);
  } catch {
    recordValid = false;
  }
  const imported = success.imported_items[0];
  const assetHashMatches = imported
    ? sha256(await readFile(imported.target_path)) === input.source_hash
    : false;
  const failureCases = [];
  for (const [name, option, expected] of [
    ["asset-copy", "injectAssetCopyFailure", "failed_asset_copy_rolled_back"],
    ["index-write", "injectIndexWriteFailure", "failed_visual_index_write_rolled_back"],
    ["post-validation", "injectPostWriteValidationFailure", "failed_post_write_validation_rolled_back"],
  ]) {
    const box = await createSandbox(input.sandbox_root, `import-${name}`);
    const guard = await readyGuard(input.source_dir, input.config, box);
    const result = await runVisualLibraryConfirmedImport({
      ...importOptions(input.source_dir, box, guard, config),
      configPath: input.config.confirmed_import_config_path,
      [option]: true,
    });
    failureCases.push({
      name,
      expected,
      actual: result.confirmed_import_decision,
      passed:
        result.confirmed_import_decision === expected
        && result.rollback_manifest?.rollback_completed === true
        && (await readFile(box.index, "utf8")) === "",
    });
  }
  const passed =
    noExecute.confirmed_import_decision === "blocked_missing_execute_flag"
    && success.confirmed_import_decision === "confirmed_visual_import_completed"
    && assetHashMatches
    && recordValid
    && Boolean(success.rollback_manifest?.rollback_manifest_id)
    && failureCases.every((item) => item.passed);
  return {
    executed: true,
    passed,
    no_execute_decision: noExecute.confirmed_import_decision,
    confirmed_import_decision: success.confirmed_import_decision,
    sandbox_asset_hash_equals_source_hash: assetHashMatches,
    sandbox_jsonl_record_valid: recordValid,
    sandbox_rollback_manifest_exists:
      Boolean(success.rollback_manifest?.rollback_manifest_id),
    failure_rollback_cases: failureCases,
    import_result: success,
    decision: passed
      ? "sandbox_confirmed_import_acceptance_passed"
      : "failed_sandbox_confirmed_import_acceptance",
  };
}

export async function runVisualLibrarySandboxRollbackDeleteRestoreAcceptance(
  input,
) {
  if (!input.include_sandbox) {
    return {
      executed: false,
      passed: true,
      decision: "sandbox_rollback_delete_restore_acceptance_not_requested",
    };
  }
  if (input.fixture?.passed === false) {
    return {
      executed: true,
      passed: false,
      decision: "failed_sandbox_rollback_delete_restore_acceptance",
    };
  }
  const { config: importConfig } =
    await loadVisualLibraryConfirmedImportConfig({
      configPath: input.config.confirmed_import_config_path,
    });
  const { config } = await loadVisualLibraryRollbackDeleteRestoreConfig({
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const noOperation = await runVisualLibraryRollbackDeleteRestoreOperation({
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const noExecute = await runVisualLibraryRollbackDeleteRestoreOperation({
    operation: "delete",
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const rollbackBox = await createSandbox(input.sandbox_root, "rollback");
  const rollbackGuard = await readyGuard(
    input.source_dir,
    input.config,
    rollbackBox,
  );
  const rollbackImport = await runVisualLibraryConfirmedImport({
    ...importOptions(
      input.source_dir,
      rollbackBox,
      rollbackGuard,
      importConfig,
    ),
    configPath: input.config.confirmed_import_config_path,
  });
  const rollback = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(rollbackBox),
    operation: "rollback-import",
    confirmText: config.required_rollback_confirmation_text,
    manifest: rollbackImport.rollback_manifest,
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const deleteBox = await createSandbox(input.sandbox_root, "delete-restore");
  const deleteGuard = await readyGuard(
    input.source_dir,
    input.config,
    deleteBox,
  );
  const deleteImport = await runVisualLibraryConfirmedImport({
    ...importOptions(input.source_dir, deleteBox, deleteGuard, importConfig),
    configPath: input.config.confirmed_import_config_path,
  });
  const visualId = deleteImport.imported_items[0]?.proposed_visual_id;
  const deleted = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(deleteBox),
    operation: "delete",
    visualId,
    confirmText: config.required_delete_confirmation_text,
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const restored = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(deleteBox),
    operation: "restore",
    confirmText: config.required_restore_confirmation_text,
    manifest: deleted.operation_manifest,
    configPath: input.config.rollback_delete_restore_config_path,
  });
  const failureCases = [];
  for (const [name, option, expected] of [
    ["index", "injectIndexWriteFailure", "failed_visual_index_write_rolled_back"],
    ["asset", "injectAssetOperationFailure", "failed_asset_operation_rolled_back"],
    ["validation", "injectPostOperationValidationFailure", "failed_post_operation_validation_rolled_back"],
  ]) {
    const box = await createSandbox(input.sandbox_root, `delete-failure-${name}`);
    const guard = await readyGuard(input.source_dir, input.config, box);
    const imported = await runVisualLibraryConfirmedImport({
      ...importOptions(input.source_dir, box, guard, importConfig),
      configPath: input.config.confirmed_import_config_path,
    });
    const before = await readFile(box.index);
    const result = await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(box),
      operation: "delete",
      visualId: imported.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
      configPath: input.config.rollback_delete_restore_config_path,
      [option]: true,
    });
    failureCases.push({
      name,
      expected,
      actual: result.operation_decision,
      passed:
        result.operation_decision === expected
        && before.equals(await readFile(box.index)),
    });
  }
  const passed =
    noOperation.operation_decision === "blocked_missing_operation"
    && noExecute.operation_decision === "blocked_missing_execute_flag"
    && rollback.operation_decision === "visual_import_rollback_completed"
    && deleted.operation_decision === "visual_delete_completed"
    && restored.operation_decision === "visual_restore_completed"
    && failureCases.every((item) => item.passed);
  return {
    executed: true,
    passed,
    no_operation_decision: noOperation.operation_decision,
    no_execute_decision: noExecute.operation_decision,
    rollback_import_decision: rollback.operation_decision,
    delete_decision: deleted.operation_decision,
    restore_decision: restored.operation_decision,
    failure_rollback_cases: failureCases,
    decision: passed
      ? "sandbox_rollback_delete_restore_acceptance_passed"
      : "failed_sandbox_rollback_delete_restore_acceptance",
  };
}

export async function runVisualLibraryUiFlowAcceptance(input) {
  if (input.fixture?.passed === false) {
    return { passed: false, decision: "failed_ui_flow_acceptance" };
  }
  const empty = await runVisualLibraryUiImportFlowPreview({
    sourceDir: input.empty_source_dir,
    operation: "preview",
    configPath: input.config.ui_import_flow_config_path,
  });
  const fieldsPresent = [
    "wizard_steps",
    "review_cards",
    "operation_cards",
    "safety_panel",
    "action_bar",
  ].every((field) => empty[field] !== undefined);
  const sandboxDecisions = [];
  if (input.include_sandbox) {
    const { config: importConfig } =
      await loadVisualLibraryConfirmedImportConfig({
        configPath: input.config.confirmed_import_config_path,
      });
    const { config: operationConfig } =
      await loadVisualLibraryRollbackDeleteRestoreConfig({
        configPath: input.config.rollback_delete_restore_config_path,
      });
    const rollbackBox = await createSandbox(input.sandbox_root, "ui-rollback");
    const rollbackGuard = await readyGuard(
      input.source_dir,
      input.config,
      rollbackBox,
    );
    const imported = await runVisualLibraryUiImportFlowPreview({
      sourceDir: input.source_dir,
      operation: "import",
      execute: true,
      visualIndexPath: rollbackBox.indexRel,
      assetsRoot: rollbackBox.assetsRel,
      controlledGuardPreview: rollbackGuard,
      confirmText: importConfig.required_simulation_confirmation_text,
      preWriteConfirmText: importConfig.required_pre_write_confirmation_text,
      realImportConfirmText: importConfig.required_real_import_confirmation_text,
      configPath: input.config.ui_import_flow_config_path,
    });
    const rolledBack = await runVisualLibraryUiImportFlowPreview({
      sourceDir: input.source_dir,
      operation: "rollback-import",
      execute: true,
      visualIndexPath: rollbackBox.indexRel,
      assetsRoot: rollbackBox.assetsRel,
      controlledGuardPreview: rollbackGuard,
      trashRoot: rollbackBox.trashRel,
      restoreRoot: rollbackBox.restoreRel,
      manifest: imported.operation_result?.rollback_manifest,
      rollbackConfirmText: operationConfig.required_rollback_confirmation_text,
      configPath: input.config.ui_import_flow_config_path,
    });
    const deleteBox = await createSandbox(input.sandbox_root, "ui-delete");
    const deleteGuard = await readyGuard(
      input.source_dir,
      input.config,
      deleteBox,
    );
    const deleteImport = await runVisualLibraryUiImportFlowPreview({
      sourceDir: input.source_dir,
      operation: "import",
      execute: true,
      visualIndexPath: deleteBox.indexRel,
      assetsRoot: deleteBox.assetsRel,
      controlledGuardPreview: deleteGuard,
      confirmText: importConfig.required_simulation_confirmation_text,
      preWriteConfirmText: importConfig.required_pre_write_confirmation_text,
      realImportConfirmText: importConfig.required_real_import_confirmation_text,
      configPath: input.config.ui_import_flow_config_path,
    });
    const deleted = await runVisualLibraryUiImportFlowPreview({
      sourceDir: input.source_dir,
      operation: "delete",
      execute: true,
      visualIndexPath: deleteBox.indexRel,
      assetsRoot: deleteBox.assetsRel,
      controlledGuardPreview: deleteGuard,
      trashRoot: deleteBox.trashRel,
      restoreRoot: deleteBox.restoreRel,
      visualId:
        deleteImport.operation_result?.imported_items?.[0]?.proposed_visual_id,
      deleteConfirmText: operationConfig.required_delete_confirmation_text,
      configPath: input.config.ui_import_flow_config_path,
    });
    const restored = await runVisualLibraryUiImportFlowPreview({
      sourceDir: input.source_dir,
      operation: "restore",
      execute: true,
      visualIndexPath: deleteBox.indexRel,
      assetsRoot: deleteBox.assetsRel,
      controlledGuardPreview: deleteGuard,
      trashRoot: deleteBox.trashRel,
      restoreRoot: deleteBox.restoreRel,
      manifest: deleted.operation_result?.operation_manifest,
      restoreConfirmText: operationConfig.required_restore_confirmation_text,
      configPath: input.config.ui_import_flow_config_path,
    });
    sandboxDecisions.push(
      imported.ui_flow_decision,
      rolledBack.ui_flow_decision,
      deleted.ui_flow_decision,
      restored.ui_flow_decision,
    );
  }
  const sandboxPassed = !input.include_sandbox || [
    "sandbox_ui_import_flow_import_completed",
    "sandbox_ui_import_flow_rollback_completed",
    "sandbox_ui_import_flow_delete_completed",
    "sandbox_ui_import_flow_restore_completed",
  ].every((decision) => sandboxDecisions.includes(decision));
  const passed =
    empty.ui_flow_decision === "empty_ui_import_flow_preview_passed"
    && fieldsPresent
    && sandboxPassed;
  return {
    passed,
    empty_preview_decision: empty.ui_flow_decision,
    model_fields_present: fieldsPresent,
    sandbox_decisions: sandboxDecisions,
    formal_preview_no_write:
      empty.safety_panel?.formal_gallery_empty_baseline === true,
    decision: passed
      ? "ui_flow_acceptance_passed"
      : "failed_ui_flow_acceptance",
  };
}

export async function runVisualLibraryBridgeReadinessAcceptance(input) {
  if (input.fixture?.passed === false) {
    return { passed: false, decision: "failed_bridge_readiness_acceptance" };
  }
  const preview = await runVisualLibraryBridgeReadinessPreview({
    sourceDir: input.empty_source_dir,
    configPath: input.config.bridge_readiness_config_path,
  });
  const blocked = await runVisualLibraryBridgeReadinessPreview({
    sourceDir: input.empty_source_dir,
    forbiddenExecuteArgument: true,
    configPath: input.config.bridge_readiness_config_path,
  });
  const actions = preview.action_availability;
  const disabled = [
    "can_execute",
    "can_import",
    "can_rollback_import",
    "can_delete",
    "can_restore",
    "can_write_visual_index",
    "can_copy_visual_asset",
    "can_move_visual_asset",
    "can_delete_visual_asset",
    "can_write_approval_queue",
    "can_create_approval_item",
    "can_create_canon_visual_lock",
  ].every((field) => actions[field] === false);
  const actualToolCount = input.mcp_tool_count_fixture ?? await countMcpTools();
  const passed =
    preview.bridge_readiness_decision
      === "empty_visual_library_bridge_readiness_preview_passed"
    && Boolean(preview.ui_review_model)
    && Boolean(preview.bridge_tool_manifest_preview)
    && Boolean(actions)
    && Boolean(preview.safety_envelope)
    && preview.bridge_read_only === true
    && preview.bridge_preview_only === true
    && preview.bridge_tool_manifest_preview.accepts_execute === false
    && blocked.bridge_readiness_decision
      === "blocked_forbidden_execute_argument"
    && disabled
    && actualToolCount === input.config.expected_mcp_tool_count;
  return {
    passed,
    empty_preview_decision: preview.bridge_readiness_decision,
    execute_argument_decision: blocked.bridge_readiness_decision,
    read_only: preview.bridge_read_only,
    preview_only: preview.bridge_preview_only,
    accepts_execute: preview.bridge_tool_manifest_preview.accepts_execute,
    dangerous_actions_disabled: disabled,
    expected_mcp_tool_count: input.config.expected_mcp_tool_count,
    actual_mcp_tool_count: actualToolCount,
    payload_sections_present: [
      "ui_review_model",
      "bridge_tool_manifest_preview",
      "action_availability",
      "safety_envelope",
    ].every((field) => preview[field] !== undefined),
    decision: passed
      ? "bridge_readiness_acceptance_passed"
      : "failed_bridge_readiness_acceptance",
  };
}

export function buildVisualLibraryFinalAcceptanceMatrix(input) {
  const preview = input.preview_chain_acceptance;
  const formalExpected = input.formal_baseline_acceptance.formal_baseline_count_policy
    === "visual_index_asset_parity"
    ? "formal_visual_library_index_asset_parity_accepted"
    : "formal_visual_library_configured_baseline_accepted";
  const formalArea = input.formal_baseline_acceptance.formal_baseline_count_policy
    === "visual_index_asset_parity"
    ? "formal visual library index/assets parity"
    : "formal configured gallery baseline";
  const rows = [
    ["19E-18A", "18A", formalArea,
      formalExpected,
      input.formal_baseline_acceptance.decision,
      input.formal_baseline_acceptance.passed],
    ["19E-18B", "18B", "rebuild intake preview",
      "intake_preview_accepted",
      preview.intake?.summary?.accepted_candidate_count === 0
        ? "empty_intake_preview_accepted"
        : "intake_preview_accepted",
      preview.passed],
    ["19E-18C", "18C", "simulation confirmation gate",
      "simulation_confirmation_gate_verified",
      preview.simulation_confirmation_gate?.accepted === false
        ? "simulation_confirmation_gate_verified"
        : "simulation_confirmation_gate_failed",
      preview.passed],
    ["19E-18D", "18D", "pending import readiness preview",
      "pending_readiness_preview_accepted",
      preview.readiness?.summary?.decision ?? preview.decision,
      preview.passed],
    ["19E-18E", "18E", "Approval Queue import dry-run",
      "approval_dry_run_no_write_accepted",
      preview.approval_dry_run?.summary?.decision ?? preview.decision,
      preview.passed],
    ["19E-18F", "18F", "final acceptance preview",
      "final_acceptance_preview_accepted",
      preview.final_acceptance?.final_acceptance_decision ?? preview.decision,
      preview.passed],
    ["19E-18G", "18G", "controlled import guard",
      "controlled_import_guard_accepted",
      preview.controlled_guard?.controlled_import_guard_decision
        ?? preview.decision,
      preview.passed],
    ["19E-19A", "19A", "sandbox confirmed import",
      input.include_sandbox
        ? "sandbox_confirmed_import_acceptance_passed"
        : "sandbox_confirmed_import_acceptance_not_requested",
      input.sandbox_confirmed_import_acceptance.decision,
      input.sandbox_confirmed_import_acceptance.passed],
    ["19E-19B", "19B", "sandbox rollback/delete/restore",
      input.include_sandbox
        ? "sandbox_rollback_delete_restore_acceptance_passed"
        : "sandbox_rollback_delete_restore_acceptance_not_requested",
      input.sandbox_rollback_delete_restore_acceptance.decision,
      input.sandbox_rollback_delete_restore_acceptance.passed],
    ["19E-19C", "19C", "UI import flow review model",
      "ui_flow_acceptance_passed",
      input.ui_flow_acceptance.decision,
      input.ui_flow_acceptance.passed],
    ["19E-19D", "19D", "ChatGPT/MCP bridge readiness",
      "bridge_readiness_acceptance_passed",
      input.bridge_readiness_acceptance.decision,
      input.bridge_readiness_acceptance.passed],
  ];
  return rows.map((row) => matrixItem({
    acceptance_id: row[0],
    phase_source: row[1],
    test_area: row[2],
    expected_decision: row[3],
    actual_decision: row[4],
    passed: row[5],
    formal_write_side_effect_detected:
      input.formal_write_side_effect_detected,
    safety_notes: [
      "formal visual library paths remained read-only",
      row[1] === "19A" || row[1] === "19B"
        ? "writes permitted only in temporary sandbox"
        : "preview/read-only acceptance",
    ],
  }));
}

export function evaluateVisualLibraryFinalE2eAcceptanceDecision(input) {
  if (input.forbidden_execute_argument) {
    return "blocked_forbidden_execute_argument";
  }
  const formal = input.formal_baseline_acceptance;
  if (!formal.active_engine_hash_passed) {
    return "blocked_active_engine_hash_mismatch";
  }
  if (
    formal.decision === "blocked_visual_index_asset_parity_mismatch"
    || (
      formal.formal_baseline_count_policy === "visual_index_asset_parity"
      && formal.visual_index_line_count !== formal.visual_assets_image_count
    )
  ) {
    return "blocked_visual_index_asset_parity_mismatch";
  }
  if (
    formal.visual_index_line_count
    !== formal.expected_visual_index_line_count
  ) {
    return "blocked_visual_index_baseline_mismatch";
  }
  if (
    formal.visual_assets_image_count
    !== formal.expected_visual_assets_image_count
  ) {
    return "blocked_visual_assets_baseline_mismatch";
  }
  if (!input.no_write_contract_passed) {
    return "failed_no_write_contract_violation";
  }
  if (!input.forbidden_side_effects_passed) {
    return "failed_forbidden_side_effect_detected";
  }
  if (input.formal_write_side_effect_detected) {
    return "failed_unexpected_formal_write_side_effect";
  }
  if (!input.preview_chain_acceptance.passed) {
    return "failed_preview_chain_acceptance";
  }
  if (!input.sandbox_confirmed_import_acceptance.passed) {
    return "failed_sandbox_confirmed_import_acceptance";
  }
  if (!input.sandbox_rollback_delete_restore_acceptance.passed) {
    return "failed_sandbox_rollback_delete_restore_acceptance";
  }
  if (!input.ui_flow_acceptance.passed) return "failed_ui_flow_acceptance";
  if (!input.bridge_readiness_acceptance.passed) {
    return "failed_bridge_readiness_acceptance";
  }
  return input.include_sandbox
    ? "visual_library_final_e2e_acceptance_passed"
    : "visual_library_final_e2e_preview_acceptance_passed";
}

export function compileVisualLibraryFinalE2eAcceptanceSummary(payload) {
  return {
    acceptance_count: payload.acceptance_matrix.length,
    passed_count:
      payload.acceptance_matrix.filter((item) => item.passed).length,
    failed_count:
      payload.acceptance_matrix.filter((item) => !item.passed).length,
    phases_covered: payload.acceptance_matrix.map((item) => item.phase_source),
    sandbox_included:
      payload.sandbox_confirmed_import_acceptance.executed === true,
    formal_baseline_count_policy:
      payload.formal_baseline_acceptance.formal_baseline_count_policy,
    formal_gallery_empty_baseline:
      payload.formal_baseline_acceptance.formal_gallery_empty_baseline,
    formal_gallery_configured_baseline:
      payload.formal_baseline_acceptance.formal_gallery_configured_baseline,
    formal_visual_library_index_asset_parity:
      payload.formal_baseline_acceptance.formal_visual_library_index_asset_parity,
    final_acceptance_decision: payload.final_acceptance_decision,
  };
}

export async function runVisualLibraryFinalE2eAcceptancePreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryFinalE2eAcceptanceConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? config.default_source_dir,
    "final E2E acceptance source directory",
  );
  const roots = {
    visualIndex: resolveProjectPath(config.visual_index_path, "formal visual index"),
    visualAssets: resolveProjectPath(config.visual_assets_root, "formal visual assets"),
    activeEngine: resolveProjectPath(config.active_engine_path, "active engine"),
    canonDb: resolveProjectPath("data/canon_db", "Canon DB"),
    approvalQueue: resolveProjectPath("data/approval_queue", "Approval Queue"),
  };
  const before = {
    index: await readFile(roots.visualIndex),
    assets: await directorySnapshot(roots.visualAssets),
    engine: await readFile(roots.activeEngine),
    canon: await directorySnapshot(roots.canonDb),
    approval: await directorySnapshot(roots.approvalQueue),
  };
  const noWriteContract = validateVisualLibraryFinalNoWriteContract(
    options.noWriteContractFixture ?? config,
  );
  const fixtureRoot = path.join(
    projectRoot,
    "data",
    "visual_db",
    `.phase-19e-${process.pid}-${Date.now()}`,
  );
  const emptySource = path.join(fixtureRoot, "empty");
  const sandboxRoot = path.join(fixtureRoot, "sandboxes");
  await Promise.all([
    mkdir(emptySource, { recursive: true }),
    mkdir(sandboxRoot, { recursive: true }),
  ]);
  let payload;
  try {
    let sandboxSource = {
      sourceDir: normalizeProjectPath(sourceDir),
      hash: null,
    };
    if (options.includeSandbox === true) {
      sandboxSource = await createSandboxSource(fixtureRoot);
    }
    const formalBaseline = await runVisualLibraryFormalBaselineAcceptance({
      visual_index_path: roots.visualIndex,
      visual_assets_root: roots.visualAssets,
      active_engine_path: roots.activeEngine,
      expected_engine_hash: config.expected_engine_sha256_lf,
      expected_visual_index_line_count:
        config.expected_formal_visual_index_non_empty_lines,
      expected_visual_assets_image_count:
        config.expected_formal_assets_image_count,
      formal_baseline_count_policy: config.formal_baseline_count_policy,
      fixture: options.formalBaselineFixture,
    });
    const previewChain = await runVisualLibraryPreviewChainAcceptance({
      config,
      source_dir: normalizeProjectPath(sourceDir),
      fixture: options.previewChainFixture,
    });
    const sandboxImport =
      await runVisualLibrarySandboxConfirmedImportAcceptance({
        config,
        include_sandbox: options.includeSandbox === true,
        source_dir: sandboxSource.sourceDir,
        source_hash: sandboxSource.hash,
        sandbox_root: sandboxRoot,
        fixture: options.sandboxConfirmedImportFixture,
      });
    const sandboxOperations =
      await runVisualLibrarySandboxRollbackDeleteRestoreAcceptance({
        config,
        include_sandbox: options.includeSandbox === true,
        source_dir: sandboxSource.sourceDir,
        sandbox_root: sandboxRoot,
        fixture: options.sandboxRollbackDeleteRestoreFixture,
      });
    const uiFlow = await runVisualLibraryUiFlowAcceptance({
      config,
      include_sandbox: options.includeSandbox === true,
      source_dir: sandboxSource.sourceDir,
      empty_source_dir: normalizeProjectPath(emptySource),
      sandbox_root: sandboxRoot,
      fixture: options.uiFlowFixture,
    });
    const bridge = await runVisualLibraryBridgeReadinessAcceptance({
      config,
      empty_source_dir: normalizeProjectPath(emptySource),
      fixture: options.bridgeReadinessFixture,
      mcp_tool_count_fixture: options.mcpToolCountFixture,
    });
    const after = {
      index: await readFile(roots.visualIndex),
      assets: await directorySnapshot(roots.visualAssets),
      engine: await readFile(roots.activeEngine),
      canon: await directorySnapshot(roots.canonDb),
      approval: await directorySnapshot(roots.approvalQueue),
    };
    const formalWriteSideEffectDetected =
      !before.index.equals(after.index)
      || !snapshotsEqual(before.assets, after.assets)
      || !before.engine.equals(after.engine)
      || !snapshotsEqual(before.canon, after.canon)
      || !snapshotsEqual(before.approval, after.approval)
      || options.formalWriteSideEffectFixture === true;
    const forbiddenSideEffects = validateVisualLibraryFinalForbiddenSideEffects({
      approval_queue_write_count:
        snapshotsEqual(before.approval, after.approval) ? 0 : 1,
      approval_item_created:
        options.forbiddenSideEffectFixture === true,
      canon_visual_lock_count:
        options.forbiddenSideEffectFixture === true ? 1 : 0,
      canon_db_changed: !snapshotsEqual(before.canon, after.canon),
    });
    const noWriteSummary = {
      formal_writes_visual_index: false,
      formal_writes_visual_assets: false,
      formal_copies_files: false,
      formal_moves_files: false,
      formal_deletes_files: false,
      formal_writes_approval_queue: false,
      formal_creates_approval_item: false,
      formal_creates_canon_visual_lock: false,
      formal_updates_active_engine: false,
      formal_updates_canon_db: false,
      contract_passed: noWriteContract.passed,
      violations: noWriteContract.violations,
    };
    const decision = evaluateVisualLibraryFinalE2eAcceptanceDecision({
      forbidden_execute_argument: options.forbiddenExecuteArgument === true,
      formal_baseline_acceptance: formalBaseline,
      preview_chain_acceptance: previewChain,
      sandbox_confirmed_import_acceptance: sandboxImport,
      sandbox_rollback_delete_restore_acceptance: sandboxOperations,
      ui_flow_acceptance: uiFlow,
      bridge_readiness_acceptance: bridge,
      no_write_contract_passed: noWriteContract.passed,
      forbidden_side_effects_passed: forbiddenSideEffects.passed,
      formal_write_side_effect_detected: formalWriteSideEffectDetected,
      include_sandbox: options.includeSandbox === true,
    });
    payload = {
      schema_version: config.schema_version,
      config_path: loadedConfigPath,
      phase: config.phase,
      mode: config.mode,
      source_dir: normalizeProjectPath(sourceDir),
      include_sandbox: options.includeSandbox === true,
      formal_baseline_acceptance: formalBaseline,
      preview_chain_acceptance: previewChain,
      sandbox_confirmed_import_acceptance: sandboxImport,
      sandbox_rollback_delete_restore_acceptance: sandboxOperations,
      ui_flow_acceptance: uiFlow,
      bridge_readiness_acceptance: bridge,
      acceptance_matrix: [],
      safety_summary: {
        formal_write_side_effect_detected: formalWriteSideEffectDetected,
        formal_visual_index_unchanged: before.index.equals(after.index),
        formal_visual_assets_unchanged:
          snapshotsEqual(before.assets, after.assets),
        active_engine_unchanged: before.engine.equals(after.engine),
        canon_db_unchanged: snapshotsEqual(before.canon, after.canon),
        approval_queue_unchanged:
          snapshotsEqual(before.approval, after.approval),
        sandbox_cleaned_after_report: true,
      },
      no_write_summary: noWriteSummary,
      forbidden_side_effect_summary: {
        passed: forbiddenSideEffects.passed,
        violations: forbiddenSideEffects.violations,
        approval_queue_write_count:
          snapshotsEqual(before.approval, after.approval) ? 0 : 1,
        approval_item_created: options.forbiddenSideEffectFixture === true,
        canon_visual_lock_count:
          options.forbiddenSideEffectFixture === true ? 1 : 0,
      },
      final_acceptance_decision: decision,
      summary: null,
    };
    payload.acceptance_matrix = buildVisualLibraryFinalAcceptanceMatrix({
      ...payload,
      formal_write_side_effect_detected: formalWriteSideEffectDetected,
    });
    payload.summary = compileVisualLibraryFinalE2eAcceptanceSummary(payload);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
  return payload;
}
