import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  runVisualLibraryUiImportFlowPreview,
} from "./visual-library-ui-import-flow-service.mjs";

const configPath = path.join(
  projectRoot,
  "config",
  "visual-library-bridge-readiness.json",
);

const requiredTrueFields = [
  "bridge_read_only",
  "bridge_preview_only",
];
const requiredFalseFields = [
  "bridge_allows_execute",
  "bridge_allows_confirmed_import",
  "bridge_allows_rollback",
  "bridge_allows_delete",
  "bridge_allows_restore",
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
const dangerousActionFields = [
  "can_import",
  "can_rollback_import",
  "can_delete",
  "can_restore",
  "can_execute",
  "can_write_visual_index",
  "can_copy_visual_asset",
  "can_move_visual_asset",
  "can_delete_visual_asset",
  "can_write_approval_queue",
  "can_create_approval_item",
  "can_create_canon_visual_lock",
];
const sideEffectCapabilityFields = [
  "can_write_approval_queue",
  "can_create_approval_item",
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

function sha256Lf(value) {
  return createHash("sha256")
    .update(normalizeLf(value), "utf8")
    .digest("hex")
    .toUpperCase();
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function lineCount(value) {
  return normalizeLf(value).split("\n").filter((line) => line.trim()).length;
}

async function directoryState(root) {
  const files = [];
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
      if (child.isDirectory()) {
        await walk(absolute);
      } else {
        const content = await readFile(absolute);
        files.push({
          path: normalizeProjectPath(absolute),
          sha256: sha256Buffer(content),
          image: [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            .includes(path.extname(child.name).toLowerCase()),
        });
      }
    }
  }
  await walk(root);
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export function validateVisualLibraryBridgeReadinessConfig(config) {
  requireObject(config, "visual library bridge readiness config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "19D") throw new Error("phase must be 19D.");
  if (config.mode !== "visual_library_chatgpt_mcp_bridge_readiness_preview") {
    throw new Error(
      "mode must be visual_library_chatgpt_mcp_bridge_readiness_preview.",
    );
  }
  for (const field of [
    "ui_import_flow_config_path",
    "default_source_dir",
    "visual_assets_root",
    "visual_index_path",
    "active_engine_path",
    "bridge_tool_name",
  ]) requireString(config[field], field);
  if (!/^[A-F0-9]{64}$/u.test(requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  ))) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  for (const field of requiredTrueFields) {
    if (config[field] !== true) throw new Error(`${field} must be true.`);
  }
  for (const field of requiredFalseFields) {
    if (config[field] !== false) throw new Error(`${field} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryBridgeReadinessConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryBridgeReadinessConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolved = options.configPath
    ? resolveProjectPath(options.configPath, "bridge readiness config")
    : configPath;
  const config = JSON.parse(await readFile(resolved, "utf8"));
  return {
    config: validateVisualLibraryBridgeReadinessConfig(config),
    config_path: normalizeProjectPath(resolved),
  };
}

export function validateVisualLibraryBridgeNoWriteContract(input) {
  const violations = [];
  for (const field of requiredTrueFields) {
    if (input[field] !== true) violations.push(`${field}_must_be_true`);
  }
  for (const field of requiredFalseFields) {
    if (input[field] !== false) violations.push(`${field}_must_be_false`);
  }
  return {
    passed: violations.length === 0,
    violations,
  };
}

export function evaluateVisualLibraryBridgeActionAvailability() {
  return {
    can_preview: true,
    can_import: false,
    can_rollback_import: false,
    can_delete: false,
    can_restore: false,
    can_execute: false,
    can_write_visual_index: false,
    can_copy_visual_asset: false,
    can_move_visual_asset: false,
    can_delete_visual_asset: false,
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_create_canon_visual_lock: false,
    disabled_reason_by_action: {
      import: "bridge_preview_only",
      "rollback-import": "bridge_preview_only",
      delete: "bridge_preview_only",
      restore: "bridge_preview_only",
      execute: "bridge_does_not_accept_execute",
      write_visual_index: "bridge_read_only",
      copy_visual_asset: "bridge_read_only",
      move_visual_asset: "bridge_read_only",
      delete_visual_asset: "bridge_read_only",
      write_approval_queue: "forbidden_in_phase_19d",
      create_approval_item: "forbidden_in_phase_19d",
      create_canon_visual_lock: "forbidden_in_phase_19d",
    },
  };
}

export function buildVisualLibraryBridgeToolManifestPreview(input = {}) {
  return {
    tool_name: input.toolName
      ?? "chatgpt_bridge_visual_library_ui_import_flow_preview",
    title: "Visual Library UI Import Flow Preview",
    description:
      "Read-only ChatGPT/MCP bridge preview for visual-library review state.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        source_dir: { type: "string" },
        tool_name: { type: "string" },
      },
    },
    output_schema_summary: {
      type: "object",
      includes: [
        "ui_review_model",
        "bridge_tool_manifest_preview",
        "action_availability",
        "safety_envelope",
        "readiness_summary",
        "bridge_readiness_decision",
      ],
    },
    allowed_operations: [
      "preview_visual_library_ui_import_flow",
      "view_visual_index_state",
      "view_visual_assets_state",
      "view_active_engine_hash_state",
      "view_pipeline_summary",
      "view_required_human_checks",
      "view_blockers_and_warnings",
      "view_action_availability",
      "view_safety_panel",
    ],
    forbidden_operations: [
      "confirmed_visual_import_execute",
      "rollback_import_execute",
      "visual_delete_execute",
      "visual_restore_execute",
      "write_visual_index",
      "copy_visual_asset",
      "move_visual_asset",
      "delete_visual_asset",
      "write_approval_queue",
      "create_approval_item",
      "create_canon_visual_lock",
      "update_active_engine",
      "update_canon_db",
    ],
    read_only: true,
    preview_only: true,
    accepts_execute: false,
    writes_visual_index: false,
    writes_visual_assets: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

export function buildVisualLibraryBridgeSafetyEnvelope(input) {
  const dangerousActionsDisabled = dangerousActionFields.every(
    (field) => input.action_availability[field] === false,
  );
  const forbiddenSideEffectsAbsent =
    input.formal_write_side_effect_detected !== true;
  return {
    active_engine_hash_expected: input.active_engine_hash_expected,
    active_engine_hash_actual: input.active_engine_hash_actual,
    active_engine_hash_passed:
      input.active_engine_hash_expected === input.active_engine_hash_actual,
    visual_index_line_count: input.visual_index_line_count,
    visual_assets_image_count: input.visual_assets_image_count,
    formal_gallery_empty_baseline:
      input.visual_index_line_count === 0
      && input.visual_assets_image_count === 0,
    no_write_contract_passed: input.no_write_contract.passed,
    dangerous_actions_disabled: dangerousActionsDisabled,
    forbidden_side_effects_absent: forbiddenSideEffectsAbsent,
    safety_decision:
      input.no_write_contract.passed
      && dangerousActionsDisabled
      && forbiddenSideEffectsAbsent
        ? "visual_library_bridge_safety_passed"
        : "visual_library_bridge_safety_failed",
  };
}

export function evaluateVisualLibraryBridgeReadinessDecision(input) {
  if (input.forbidden_execute_argument) {
    return "blocked_forbidden_execute_argument";
  }
  if (!input.active_engine_hash_passed) {
    return "blocked_active_engine_hash_mismatch";
  }
  if (!input.ui_review_model) {
    return "blocked_ui_review_model_unavailable";
  }
  if (!input.no_write_contract_passed) {
    return "failed_no_write_contract_violation";
  }
  if (sideEffectCapabilityFields.some(
    (field) => input.action_availability?.[field] === true,
  )) return "failed_forbidden_side_effect_capability";
  if (dangerousActionFields.some(
    (field) => input.action_availability?.[field] === true,
  )) return "failed_forbidden_action_enabled";
  if (input.formal_write_side_effect_detected) {
    return "failed_unexpected_formal_write_side_effect";
  }
  return input.source_item_count === 0
    ? "empty_visual_library_bridge_readiness_preview_passed"
    : "visual_library_bridge_preview_ready";
}

export function compileVisualLibraryBridgeReadinessSummary(payload) {
  const cards = payload.ui_review_model?.review_cards ?? [];
  return {
    source_item_count:
      payload.ui_review_model?.pipeline_summaries?.intake
        ?.accepted_candidate_count ?? 0,
    pipeline_stage_count:
      Object.keys(payload.ui_review_model?.pipeline_summaries ?? {}).length,
    review_card_count: cards.length,
    blocker_count: cards.flatMap((card) => card.blockers ?? []).length,
    warning_count: cards.flatMap((card) => card.warnings ?? []).length,
    required_human_check_count:
      cards.flatMap((card) => card.required_human_checks ?? []).length,
    formal_gallery_empty_baseline:
      payload.safety_envelope.formal_gallery_empty_baseline,
    bridge_readiness_decision: payload.bridge_readiness_decision,
  };
}

export function buildVisualLibraryBridgePayload(input) {
  const payload = {
    schema_version: input.config.schema_version,
    config_path: input.config_path,
    phase: input.config.phase,
    mode: input.config.mode,
    bridge_tool_name: input.tool_name,
    source_dir: input.source_dir,
    bridge_read_only: true,
    bridge_preview_only: true,
    bridge_allows_execute: false,
    ui_review_model: input.ui_review_model,
    bridge_tool_manifest_preview: input.bridge_tool_manifest_preview,
    action_availability: input.action_availability,
    safety_envelope: input.safety_envelope,
    no_write_summary: input.no_write_summary,
    readiness_summary: null,
    bridge_readiness_decision: input.bridge_readiness_decision,
  };
  payload.readiness_summary =
    compileVisualLibraryBridgeReadinessSummary(payload);
  return payload;
}

export async function runVisualLibraryBridgeReadinessPreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryBridgeReadinessConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? config.default_source_dir,
    "bridge readiness source directory",
  );
  const visualIndexPath = resolveProjectPath(
    config.visual_index_path,
    "formal visual index",
  );
  const visualAssetsRoot = resolveProjectPath(
    config.visual_assets_root,
    "formal visual assets",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine",
  );
  const canonDbRoot = resolveProjectPath("data/canon_db", "Canon DB");
  const approvalQueueRoot = resolveProjectPath(
    "data/approval_queue",
    "Approval Queue",
  );
  const indexBefore = await readFile(visualIndexPath);
  const assetsBefore = await directoryState(visualAssetsRoot);
  const canonDbBefore = await directoryState(canonDbRoot);
  const approvalQueueBefore = await directoryState(approvalQueueRoot);
  const engineBefore = await readFile(activeEnginePath);
  const actualEngineHash = sha256Lf(engineBefore.toString("utf8"));
  const noWriteContract = validateVisualLibraryBridgeNoWriteContract(
    options.noWriteContractFixture ?? config,
  );
  const actionAvailability = {
    ...evaluateVisualLibraryBridgeActionAvailability(),
    ...(options.actionAvailabilityFixture ?? {}),
  };
  let uiReviewModel = null;
  if (
    options.forbiddenExecuteArgument !== true
    && actualEngineHash === config.expected_engine_sha256_lf
  ) {
    const runner = options.uiImportFlowRunner
      ?? runVisualLibraryUiImportFlowPreview;
    uiReviewModel = await runner({
      sourceDir: normalizeProjectPath(sourceDir),
      operation: "preview",
      configPath: config.ui_import_flow_config_path,
    });
  }
  const indexAfter = await readFile(visualIndexPath);
  const assetsAfter = await directoryState(visualAssetsRoot);
  const canonDbAfter = await directoryState(canonDbRoot);
  const approvalQueueAfter = await directoryState(approvalQueueRoot);
  const engineAfter = await readFile(activeEnginePath);
  const formalWriteSideEffectDetected =
    !indexBefore.equals(indexAfter)
    || JSON.stringify(assetsBefore) !== JSON.stringify(assetsAfter)
    || JSON.stringify(canonDbBefore) !== JSON.stringify(canonDbAfter)
    || JSON.stringify(approvalQueueBefore) !== JSON.stringify(approvalQueueAfter)
    || !engineBefore.equals(engineAfter)
    || options.formalWriteSideEffectFixture === true;
  const safetyEnvelope = buildVisualLibraryBridgeSafetyEnvelope({
    active_engine_hash_expected: config.expected_engine_sha256_lf,
    active_engine_hash_actual: actualEngineHash,
    visual_index_line_count: lineCount(indexAfter.toString("utf8")),
    visual_assets_image_count:
      assetsAfter.filter((item) => item.image).length,
    no_write_contract: noWriteContract,
    action_availability: actionAvailability,
    formal_write_side_effect_detected: formalWriteSideEffectDetected,
  });
  const sourceItemCount =
    uiReviewModel?.pipeline_summaries?.intake?.accepted_candidate_count ?? 0;
  const decision = evaluateVisualLibraryBridgeReadinessDecision({
    forbidden_execute_argument: options.forbiddenExecuteArgument === true,
    active_engine_hash_passed: safetyEnvelope.active_engine_hash_passed,
    ui_review_model: uiReviewModel,
    no_write_contract_passed: noWriteContract.passed,
    action_availability: actionAvailability,
    formal_write_side_effect_detected: formalWriteSideEffectDetected,
    source_item_count: sourceItemCount,
  });
  return buildVisualLibraryBridgePayload({
    config,
    config_path: loadedConfigPath,
    tool_name: options.toolName ?? config.bridge_tool_name,
    source_dir: normalizeProjectPath(sourceDir),
    ui_review_model: uiReviewModel,
    bridge_tool_manifest_preview: buildVisualLibraryBridgeToolManifestPreview({
      toolName: options.toolName ?? config.bridge_tool_name,
    }),
    action_availability: actionAvailability,
    safety_envelope: safetyEnvelope,
    no_write_summary: {
      passed: noWriteContract.passed,
      violations: noWriteContract.violations,
      formal_write_side_effect_detected: formalWriteSideEffectDetected,
      invoked_ui_operation: uiReviewModel ? "preview" : null,
      execute_forwarded: false,
      confirmation_text_forwarded: false,
    },
    bridge_readiness_decision: decision,
  });
}
