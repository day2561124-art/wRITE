import path from "node:path";

import {
  hashCanonicalValue,
  stableSerializeCanonicalValue,
} from "./canonical-json-hash-service.mjs";

export const worldSimulationMcpBoundaryVersion =
  "phase62a-r1-step4b2-mcp-boundary-v2";

export const worldSimulationFormalPublicToolNames = Object.freeze([
  "chatgpt_bridge_begin_world_simulation_session",
  "chatgpt_bridge_prepare_world_turn",
  "chatgpt_bridge_submit_world_character_action",
  "chatgpt_bridge_resolve_world_turn",
]);

export const worldSimulationLegacyCapabilityToolNames = Object.freeze([
  "chatgpt_bridge_use_world_scene_causal_analyzer",
  "chatgpt_bridge_use_world_perception_filter",
  "chatgpt_bridge_use_world_memory_retriever",
  "chatgpt_bridge_use_world_character_cognition",
  "chatgpt_bridge_use_world_action_proposer",
  "chatgpt_bridge_use_world_agency_guard",
  "chatgpt_bridge_use_world_consistency_critic",
]);

export const worldSimulationFormalPublicBlockedTools = Object.freeze([
  ...worldSimulationLegacyCapabilityToolNames,
]);

const worldSimulationMcpToolNames = new Set([
  ...worldSimulationFormalPublicToolNames,
  ...worldSimulationLegacyCapabilityToolNames,
]);

export function isWorldSimulationMcpToolName(toolName) {
  return worldSimulationMcpToolNames.has(
    String(toolName ?? "").trim(),
  );
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function safeSerializedLength(value) {
  const serialized = stableSerializeCanonicalValue(value ?? null);
  return Buffer.isBuffer(serialized)
    ? serialized.length
    : Buffer.byteLength(serialized, "utf8");
}

function summarizeOpaqueValue(value) {
  const summary = {
    type: valueType(value),
    bytes: safeSerializedLength(value),
    sha256: hashCanonicalValue(value ?? null),
    preview_omitted: true,
  };
  if (Array.isArray(value)) {
    summary.item_count = value.length;
  } else if (value && typeof value === "object") {
    summary.top_level_keys = Object.keys(value).sort().slice(0, 64);
  }
  return summary;
}

export function summarizeWorldSimulationMcpAuditArguments(args = {}) {
  const source = args && typeof args === "object" && !Array.isArray(args)
    ? args
    : {};
  return {
    redaction_policy: worldSimulationMcpBoundaryVersion,
    sensitive_payload_preview_omitted: true,
    arguments: Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        summarizeOpaqueValue(value),
      ]),
    ),
  };
}

export function summarizeWorldSimulationMcpAuditOutput(result = {}) {
  const text = Array.isArray(result?.content)
    ? result.content.map((item) => item?.text ?? "").join("\n")
    : "";
  return {
    redaction_policy: worldSimulationMcpBoundaryVersion,
    is_error: result?.isError === true,
    text_chars: text.length,
    text_sha256: text ? hashCanonicalValue(text) : null,
    text_preview_omitted: true,
  };
}

function pathInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isMcpResourceAllowedForProfile(
  resource,
  {
    profile_name: profileName,
    output_logs_root: outputLogsRoot,
  } = {},
) {
  if (String(profileName ?? "") !== "chatgpt_public") return true;
  if (!resource?.filePath || !outputLogsRoot) return true;
  return !pathInside(resource.filePath, outputLogsRoot);
}
