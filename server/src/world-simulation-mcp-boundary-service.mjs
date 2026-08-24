import path from "node:path";

import {
  hashCanonicalValue,
  stableSerializeCanonicalValue,
} from "./canonical-json-hash-service.mjs";

export const worldSimulationMcpBoundaryVersion =
  "phase62a-r1-step4a-mcp-boundary-v1";

export const worldSimulationFormalPublicBlockedTools = Object.freeze([
  "chatgpt_bridge_use_world_memory_retriever",
]);

export function isWorldSimulationMcpToolName(toolName) {
  const name = String(toolName ?? "").trim();
  return name === "chatgpt_bridge_begin_world_simulation_session"
    || name.startsWith("chatgpt_bridge_use_world_");
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
