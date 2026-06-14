import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { projectRoot, projectPaths } from "./project-paths.mjs";

export async function loadVisualLibraryMcpReadonlyToolConfig(configPath = "config/visual-library-mcp-readonly-tool-registration.json") {
  const resolved = path.join(projectRoot, configPath);
  try {
    const content = await readFile(resolved, "utf8");
    return { config: JSON.parse(content), configPath: resolved };
  } catch (error) {
    throw new Error(`could_not_load_config: ${error.message}`);
  }
}

export function validateVisualLibraryMcpReadonlyToolConfig(config) {
  // Minimal validation to ensure required fields exist
  if (!config || typeof config !== "object") throw new Error("invalid_config");
  if (!config.tool_name) throw new Error("missing_tool_name");
  return config;
}

export function buildVisualLibraryMcpReadonlyToolDefinition(config) {
  return {
    name: config.tool_name,
    title: config.tool_title ?? "Visual Library UI Import Flow Preview",
    read_only: true,
    preview_only: true,
    accepts_execute: false,
    input_schema: buildVisualLibraryMcpReadonlyToolInputSchema(),
    output_summary: buildVisualLibraryMcpReadonlyToolOutputSchemaSummary(),
  };
}

export function buildVisualLibraryMcpReadonlyToolInputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      source_dir: { type: "string" },
      include_pipeline_summary: { type: "boolean" },
      include_ui_review_model: { type: "boolean" },
      include_bridge_readiness: { type: "boolean" },
      include_final_acceptance_summary: { type: "boolean" },
      output_mode: { type: "string", enum: ["summary", "full"] },
    },
  };
}

export function buildVisualLibraryMcpReadonlyToolOutputSchemaSummary() {
  return {
    phase: "19F",
    mode: "visual_library_mcp_readonly_tool_registration",
    tool_name: null,
    read_only: true,
    preview_only: true,
    accepts_execute: false,
  };
}

function normalizeLf(value) {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256Lf(content) {
  return createHash("sha256").update(normalizeLf(content), "utf8").digest("hex").toUpperCase();
}

async function countFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw err;
  }
}

export async function runVisualLibraryMcpReadonlyToolPreview(input = {}, options = {}) {
  const cfg = options.config ?? (await loadVisualLibraryMcpReadonlyToolConfig()).config;
  // forbidden arguments
  const forbidden = [];
  for (const key of [
    "execute",
    "confirm_text",
    "real_import_confirm_text",
    "delete_confirm_text",
    "restore_confirm_text",
    "rollback_confirm_text",
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) forbidden.push(key);
  }
  if (forbidden.length) {
    return {
      phase: "19F",
      mode: "visual_library_mcp_readonly_tool_registration",
      tool_name: cfg.tool_name,
      read_only: true,
      preview_only: true,
      accepts_execute: false,
      tool_decision: forbidden.includes("execute") ? "blocked_forbidden_execute_argument" : "blocked_forbidden_confirmation_argument",
      forbidden_arguments: forbidden,
    };
  }

  const sourceDir = input.source_dir ?? cfg.default_source_dir ?? "data/visual_db/intake";
  const resolvedSource = path.join(projectRoot, sourceDir);
  let sourceCount = 0;
  try {
    sourceCount = await countFiles(resolvedSource);
  } catch (err) {
    // swallow
  }

  // active engine
  const activeEnginePath = cfg.active_engine_path ?? "data/canon_db/active_engine.md";
  let activeEngineHash = null;
  try {
    const content = await readFile(path.join(projectRoot, activeEnginePath));
    activeEngineHash = sha256Lf(content.toString("utf8"));
  } catch (err) {
    activeEngineHash = null;
  }

  const visualIndexPath = cfg.visual_index_path ?? "data/visual_db/visual_index.jsonl";
  let visualIndexLines = 0;
  try {
    const idx = await readFile(path.join(projectRoot, visualIndexPath), "utf8");
    visualIndexLines = idx.split(/\r?\n/).filter(Boolean).length;
  } catch (err) {
    visualIndexLines = 0;
  }

  const assetsPath = cfg.visual_assets_root ?? "data/visual_db/assets";
  const assetCount = await countFiles(path.join(projectRoot, assetsPath)).catch(() => 0);

  const action_availability = {
    can_execute: false,
    can_import: false,
    can_rollback_import: false,
    can_delete: false,
    can_restore: false,
    can_write_visual_index: false,
    can_copy_visual_asset: false,
    can_move_visual_asset: false,
    can_delete_visual_asset: false,
    can_write_approval_queue: false,
    can_create_approval_item: false,
    can_create_canon_visual_lock: false,
  };

  const safety_envelope = {
    blocked_writes: true,
    read_only: true,
  };

  const result = {
    phase: "19F",
    mode: "visual_library_mcp_readonly_tool_registration",
    tool_name: cfg.tool_name,
    read_only: true,
    preview_only: true,
    accepts_execute: false,
    source_dir: sourceDir,
    ui_review_model: null,
    bridge_readiness_payload: null,
    final_acceptance_summary: null,
    pipeline_summary: {
      visual_index_line_count: visualIndexLines,
      visual_assets_image_count: assetCount,
    },
    action_availability,
    safety_envelope,
    no_write_summary: {
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
    },
    forbidden_side_effect_summary: {},
  };

  if (!sourceCount) {
    result.tool_decision = "empty_visual_library_mcp_readonly_preview_passed";
  } else {
    result.tool_decision = "visual_library_mcp_readonly_preview_ready";
  }

  // include active engine check
  if (cfg.expected_engine_sha256_lf && activeEngineHash) {
    if (cfg.expected_engine_sha256_lf.toUpperCase() !== activeEngineHash) {
      result.tool_decision = "blocked_active_engine_hash_mismatch";
    }
  }

  return result;
}
