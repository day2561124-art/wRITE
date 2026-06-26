import { createHash } from "node:crypto";
import { buildAestheticMemoryContextAdapterBridgePreview } from "./aesthetic-memory-context-adapter-bridge-preview-service.mjs";

export const aestheticMemoryContextBuilderReadinessGateVersion = "aesthetic_memory_context_builder_readiness_gate_v1";

export const aestheticMemoryContextBuilderReadinessGateContextPathTokens = [
  "writing_context.aesthetic_memory",
  "revision_context.aesthetic_memory",
  "final_polisher_context.aesthetic_memory",
  "reader_response_context.aesthetic_memory",
];

export const aestheticMemoryContextBuilderReadinessGateBuilderTokens = [
  "writing_context_builder",
  "revision_context_builder",
  "final_polisher_context_builder",
  "reader_response_context_builder",
];

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function stableDigest(value) {
  return sha256(JSON.stringify(value ?? null));
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function builderDefinitions() {
  return [
    {
      key: "writing_context_builder_readiness",
      builder_key: "writing_context_builder",
      builder_context_path: "writing_context.aesthetic_memory",
      source_adapter_key: "writing_context_adapter",
      expected_adapter_payload_key: "aesthetic_memory_for_generation",
      builder_preview_payload_key: "writing_context_aesthetic_memory_builder_payload",
      downstream_context: "writing_context",
      blocked_runtime_builder: "build_generation_context",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "revision_context_builder_readiness",
      builder_key: "revision_context_builder",
      builder_context_path: "revision_context.aesthetic_memory",
      source_adapter_key: "revision_context_adapter",
      expected_adapter_payload_key: "aesthetic_memory_for_revision",
      builder_preview_payload_key: "revision_context_aesthetic_memory_builder_payload",
      downstream_context: "revision_context",
      blocked_runtime_builder: "build_revision_context",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "final_polisher_context_builder_readiness",
      builder_key: "final_polisher_context_builder",
      builder_context_path: "final_polisher_context.aesthetic_memory",
      source_adapter_key: "final_polisher_context_adapter",
      expected_adapter_payload_key: "aesthetic_memory_for_final_polisher",
      builder_preview_payload_key: "final_polisher_context_aesthetic_memory_builder_payload",
      downstream_context: "final_polisher_context",
      blocked_runtime_builder: "build_final_polisher_context",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "reader_response_context_builder_readiness",
      builder_key: "reader_response_context_builder",
      builder_context_path: "reader_response_context.aesthetic_memory",
      source_adapter_key: "reader_response_context_adapter",
      expected_adapter_payload_key: "aesthetic_memory_for_reader_response",
      builder_preview_payload_key: "reader_response_context_aesthetic_memory_builder_payload",
      downstream_context: "reader_response_context",
      blocked_runtime_builder: "build_reader_response_context",
      summary_focus: ["審美記憶", "覆蓋", "安全"],
    },
  ];
}

function bridgeSafetyIssues(source) {
  const bridge = object(source);
  const safety = object(bridge.safety_boundary);
  const mutation = object(bridge.no_mutation_snapshot);
  const issues = [];
  if (bridge.phase !== "31C") issues.push("source_phase_not_31c");
  if (bridge.bridge_kind !== "aesthetic_memory_context_adapter_bridge_preview") issues.push("source_bridge_kind_invalid");
  if (bridge.preview_status === "needs_context") issues.push("source_needs_context");
  if (bridge.preview_status === "blocked") issues.push("source_blocked");
  if (bridge.can_read_adapter_payload_preview !== true && bridge.preview_status !== "needs_context") issues.push("source_adapter_payload_not_readable");
  if (bridge.will_attach_context_now !== false) issues.push("source_would_attach_context");
  if (bridge.will_mutate_context !== false) issues.push("source_would_mutate_context");
  if (bridge.adapter_payload_persisted !== false) issues.push("source_adapter_payload_persisted");
  for (const key of [
    "read_only",
    "preview_only",
    "candidate_only",
    "no_generation",
    "no_revision",
    "no_auto_persist",
    "no_candidate_save",
    "no_approval",
    "no_canon_update",
    "no_active_engine_update",
    "no_compressed_rules_update",
    "no_runtime_ui_mutation",
    "no_mcp_tool_added",
    "no_memory_file_write",
    "no_context_mutation",
    "no_materialized_context_injection",
    "no_adapter_payload_persist",
    "no_bridge_tool_registration",
  ]) {
    if (safety[key] !== true) issues.push(`${key}_not_true`);
  }
  for (const key of [
    "can_write_canon",
    "can_update_active_engine",
    "can_update_compressed_rules",
    "can_modify_runtime_ui",
    "can_register_mcp_tool",
    "can_save_candidate",
    "can_approve",
    "can_confirm_adoption",
    "can_write_memory_file",
    "can_materialize_context_injection",
    "can_attach_context_now",
    "can_persist_adapter_payload",
    "can_register_context_adapter_mcp_tool",
  ]) {
    if (safety[key] !== false) issues.push(`${key}_not_false`);
  }
  for (const key of [
    "active_engine_modified",
    "compressed_rules_modified",
    "candidate_saved",
    "canon_written",
    "approval_item_created",
    "runtime_ui_modified",
    "mcp_tool_added",
    "mcp_tool_registered",
    "memory_file_written",
    "context_mutated",
    "injection_materialized",
    "adapter_payload_persisted",
    "bridge_tool_registered",
  ]) {
    if (mutation[key] !== false) issues.push(`${key}_not_false`);
  }
  return issues;
}

function sourceAdapterByKey(source, key) {
  return array(source.context_adapter_summaries).find((adapter) => object(adapter).key === key) ?? null;
}

function sourceStatusLineExists(source, contextPath) {
  return array(source.adapter_status_lines).some((line) => text(line, 1000).includes(contextPath));
}

function readinessForBuilder(source, definition, baseIssues) {
  const adapter = object(sourceAdapterByKey(source, definition.source_adapter_key));
  const blockers = [];
  const warnings = [];
  if (baseIssues.length) blockers.push("source_bridge_preview_not_safe");
  if (!adapter.key) blockers.push(`missing_source_adapter:${definition.source_adapter_key}`);
  if (adapter.status === "blocked") blockers.push(`source_adapter_blocked:${definition.source_adapter_key}`);
  if (adapter.status === "watch") warnings.push(`source_adapter_watch:${definition.source_adapter_key}`);
  if (adapter.status && adapter.status !== "ready" && adapter.status !== "watch" && adapter.status !== "blocked") warnings.push(`source_adapter_status_unknown:${adapter.status}`);
  if (adapter.can_preview_adapter_payload !== true && adapter.key) blockers.push(`adapter_payload_not_previewable:${definition.source_adapter_key}`);
  if (adapter.will_attach_context_now !== false && adapter.key) blockers.push(`adapter_would_attach_context:${definition.source_adapter_key}`);
  if (adapter.will_mutate_context !== false && adapter.key) blockers.push(`adapter_would_mutate_context:${definition.source_adapter_key}`);
  if (adapter.materialized !== false && adapter.key) blockers.push(`adapter_materialized:${definition.source_adapter_key}`);
  if (adapter.context_path && adapter.context_path !== definition.builder_context_path) blockers.push(`context_path_mismatch:${adapter.context_path}`);
  if (adapter.adapter_payload_key && adapter.adapter_payload_key !== definition.expected_adapter_payload_key) warnings.push(`adapter_payload_key_mismatch:${adapter.adapter_payload_key}`);
  if (!sourceStatusLineExists(source, definition.builder_context_path)) warnings.push(`missing_bridge_status_line:${definition.builder_context_path}`);
  const status = blockers.length
    ? "blocked"
    : source.preview_status === "watch" || warnings.length
      ? "watch"
      : "ready";
  const builderPayloadPreview = {
    builder_key: definition.builder_key,
    builder_context_path: definition.builder_context_path,
    source_adapter_key: definition.source_adapter_key,
    source_adapter_payload_key: text(adapter.adapter_payload_key, 180) || definition.expected_adapter_payload_key,
    builder_preview_payload_key: definition.builder_preview_payload_key,
    downstream_context: definition.downstream_context,
    source_bridge_preview_digest: text(source.bridge_preview_digest, 80),
    source_adapter_payload_digest: text(adapter.adapter_payload_digest, 80),
    summary_focus: definition.summary_focus,
    readiness_status: status,
    safety_note: "Builder readiness gate preview only; this payload is not passed to a runtime context builder.",
  };
  return {
    key: definition.key,
    builder_key: definition.builder_key,
    builder_context_path: definition.builder_context_path,
    source_adapter_key: definition.source_adapter_key,
    expected_adapter_payload_key: definition.expected_adapter_payload_key,
    builder_preview_payload_key: definition.builder_preview_payload_key,
    downstream_context: definition.downstream_context,
    blocked_runtime_builder: definition.blocked_runtime_builder,
    status,
    can_build_readonly_context_preview: status === "ready" || status === "watch",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_builder_payload: false,
    builder_payload_preview: builderPayloadPreview,
    builder_payload_digest: stableDigest(builderPayloadPreview),
    blockers,
    warnings,
  };
}

function readinessStatus(source, safetyIssues, readiness) {
  if (source.used !== true || source.preview_status === "needs_context") return "needs_context";
  if (safetyIssues.length) return "blocked";
  if (readiness.some((item) => item.status === "blocked")) return "blocked";
  if (source.preview_status === "watch" || readiness.some((item) => item.status === "watch")) return "watch";
  return "ready";
}

function readinessCards(status, readiness, safetyIssues) {
  return [
    {
      key: "context_builder_readiness_overall",
      label: "Context builder readiness gate",
      value: status,
      tone: status === "ready" ? "ready" : status === "watch" ? "watch" : status === "needs_context" ? "empty" : "blocked",
      summary: "Preflight gate for downstream context builders to read aesthetic memory preview payloads.",
    },
    ...readiness.map((item) => ({
      key: item.key,
      label: item.builder_key,
      value: item.status,
      tone: item.status === "ready" ? "ready" : item.status === "watch" ? "watch" : "blocked",
      summary: `${item.builder_context_path} via ${item.source_adapter_key}`,
    })),
    {
      key: "safety_boundary",
      label: "Safety boundary",
      value: safetyIssues.length ? "blocked" : "clean",
      tone: safetyIssues.length ? "blocked" : "ready",
      summary: safetyIssues.length ? safetyIssues.join("; ") : "No context build, context attach, context mutation, Canon write, active_engine update, MCP registration, or payload persistence.",
    },
  ];
}

function allowedBuilderGateActions() {
  return [
    {
      key: "read_context_builder_readiness_summary",
      label: "Read context builder readiness summary",
      allowed: true,
      route: "#aesthetic-memory-context-builder-readiness",
    },
    {
      key: "copy_context_builder_readiness_markdown",
      label: "Copy context builder readiness markdown preview",
      allowed: true,
      route: "#aesthetic-memory-context-builder-readiness",
    },
    {
      key: "inspect_builder_payload_preview",
      label: "Inspect builder payload preview",
      allowed: true,
      route: "#aesthetic-memory-context-builder-readiness",
    },
    {
      key: "inspect_source_context_adapter_bridge_preview",
      label: "Inspect source context adapter bridge preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter-bridge",
    },
  ];
}

function blockedBuilderRuntimeCapabilities() {
  return [
    "generate_text",
    "revise_text",
    "save_candidate",
    "approve",
    "confirm_adoption",
    "auto_adopt",
    "auto_settle",
    "write_canon",
    "create_pending_engine_candidate",
    "update_active_engine",
    "update_compressed_rules",
    "modify_runtime_ui",
    "register_mcp_tool",
    "write_memory_file",
    "update_memory_registry_file",
    "build_generation_context",
    "build_revision_context",
    "build_final_polisher_context",
    "build_reader_response_context",
    "materialize_context_builder",
    "materialize_context_injection",
    "attach_context_now",
    "mutate_writing_context",
    "mutate_revision_context",
    "mutate_final_polisher_context",
    "mutate_reader_response_context",
    "persist_adapter_payload",
    "persist_builder_payload",
    "register_context_builder_mcp_tool",
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31E is a read-only context builder readiness gate, not a runtime context builder executor.",
  }));
}

function summaryLines(source, status, readiness, safetyIssues) {
  const builderLine = readiness.map((item) => `${item.builder_key}/${item.builder_context_path}=${item.status}`).join("；");
  return [
    `狀態：${status}`,
    `來源：${text(source.bridge_kind, 180)} / ${text(source.phase, 40)}`,
    `builder readiness：${builderLine}`,
    safetyIssues.length ? `安全缺口：${safetyIssues.join("、")}` : "安全：只讀、只預覽、不 build context、不 attach context、不 mutate context、不保存 builder payload、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file",
    "結論：此 gate 只判斷 31C bridge preview 是否可被下游 context builder 作為 read-only 參考，不執行任何 runtime context builder。",
  ];
}

function markdownFor(gate) {
  return [
    "## Aesthetic Memory Context Builder Readiness Gate",
    "",
    `- phase: ${gate.phase}`,
    `- source_phase: ${gate.source_phase}`,
    `- gate_kind: ${gate.gate_kind}`,
    `- gate_channel: ${gate.gate_channel}`,
    `- gate_mode: ${gate.gate_mode}`,
    `- builder_readiness_status: ${gate.builder_readiness_status}`,
    `- can_build_readonly_context_preview: ${gate.can_build_readonly_context_preview}`,
    `- will_build_context_now: ${gate.will_build_context_now}`,
    `- will_attach_context_now: ${gate.will_attach_context_now}`,
    `- will_mutate_context: ${gate.will_mutate_context}`,
    `- builder_payload_persisted: ${gate.builder_payload_persisted}`,
    `- read_only: ${gate.safety_boundary.read_only}`,
    `- preview_only: ${gate.safety_boundary.preview_only}`,
    `- can_write_canon: ${gate.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${gate.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${gate.safety_boundary.can_register_mcp_tool}`,
    `- context_mutated: ${gate.no_mutation_snapshot.context_mutated}`,
    `- builder_payload_persisted_snapshot: ${gate.no_mutation_snapshot.builder_payload_persisted}`,
    "",
    "### Context Builder Targets",
    ...gate.builder_readiness.map((item) => `- ${item.builder_key}: ${item.status} / ${item.builder_context_path} / payload=${item.builder_preview_payload_key}`),
    "",
    "### ChatGPT Summary",
    ...gate.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryContextBuilderReadinessGate(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedBridgePreview = object(
    options.bridge_preview
      ?? options.bridgePreview
      ?? input.aesthetic_memory_context_adapter_bridge_preview
      ?? input.aestheticMemoryContextAdapterBridgePreview
      ?? input.context_adapter_bridge_preview
      ?? input.contextAdapterBridgePreview
      ?? input.bridge_preview
      ?? input.bridgePreview
      ?? input.preview,
  );
  const source = providedBridgePreview.phase === "31C"
    ? providedBridgePreview
    : await buildAestheticMemoryContextAdapterBridgePreview(input, options);
  const safetyIssues = bridgeSafetyIssues(source);
  const builderReadiness = builderDefinitions().map((definition) => readinessForBuilder(source, definition, safetyIssues));
  const status = readinessStatus(source, safetyIssues, builderReadiness);
  const gate = {
    used: source.used === true,
    phase: "31E",
    version: aestheticMemoryContextBuilderReadinessGateVersion,
    gate_kind: "aesthetic_memory_context_builder_readiness_gate",
    gate_channel: "internal_pipeline_context_builder_preflight",
    gate_mode: "readonly_builder_readiness",
    source_phase: text(source.phase, 40) || "31C",
    source_version: text(source.version, 160) || null,
    source_bridge_kind: text(source.bridge_kind, 180) || "aesthetic_memory_context_adapter_bridge_preview",
    source_bridge_preview_digest: text(source.bridge_preview_digest, 80) || stableDigest(source),
    builder_readiness_status: status,
    can_build_readonly_context_preview: status === "ready" || status === "watch",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    builder_payload_persisted: false,
    context_builder_targets: builderDefinitions().map((definition) => ({
      key: definition.key,
      builder_key: definition.builder_key,
      builder_context_path: definition.builder_context_path,
      source_adapter_key: definition.source_adapter_key,
      expected_adapter_payload_key: definition.expected_adapter_payload_key,
      builder_preview_payload_key: definition.builder_preview_payload_key,
      downstream_context: definition.downstream_context,
    })),
    builder_readiness: builderReadiness,
    readiness_cards: readinessCards(status, builderReadiness, safetyIssues),
    safety_issues: safetyIssues,
    chatgpt_summary_lines: summaryLines(source, status, builderReadiness, safetyIssues),
    allowed_builder_gate_actions: allowedBuilderGateActions(),
    blocked_builder_runtime_capabilities: blockedBuilderRuntimeCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_context_builder_readiness" : status === "watch" ? "inspect_context_builder_warnings" : "repair_context_adapter_bridge_before_builder",
      label: status === "ready" ? "Review context builder readiness" : status === "watch" ? "Inspect context builder warnings" : "Repair context adapter bridge before builder",
      route: "#aesthetic-memory-context-builder-readiness",
      ui_target: "aesthetic-memory-context-builder-readiness",
      enabled: true,
      reason: status === "ready"
        ? "All downstream context builders can read the aesthetic memory preview payload as read-only reference."
        : status === "watch"
          ? "One or more downstream builder checks has a warning but remains preview-only."
          : "The source context adapter bridge preview is incomplete or unsafe for downstream builder readiness.",
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      candidate_only: true,
      no_generation: true,
      no_revision: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      no_canon_update: true,
      no_active_engine_update: true,
      no_compressed_rules_update: true,
      no_runtime_ui_mutation: true,
      no_mcp_tool_added: true,
      no_memory_file_write: true,
      no_context_build: true,
      no_context_attach: true,
      no_context_mutation: true,
      no_materialized_context_injection: true,
      no_adapter_payload_persist: true,
      no_builder_payload_persist: true,
      no_builder_tool_registration: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      can_save_candidate: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_write_memory_file: false,
      can_build_generation_context: false,
      can_build_revision_context: false,
      can_build_final_polisher_context: false,
      can_build_reader_response_context: false,
      can_materialize_context_injection: false,
      can_attach_context_now: false,
      can_persist_adapter_payload: false,
      can_persist_builder_payload: false,
      can_register_context_builder_mcp_tool: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      candidate_saved: false,
      canon_written: false,
      approval_item_created: false,
      runtime_ui_modified: false,
      mcp_tool_added: false,
      mcp_tool_registered: false,
      memory_file_written: false,
      context_built: false,
      context_attached: false,
      context_mutated: false,
      injection_materialized: false,
      adapter_payload_persisted: false,
      builder_payload_persisted: false,
      builder_tool_registered: false,
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_bridge_preview_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_bridge_preview: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? source : null,
  };
  gate.builder_readiness_digest = stableDigest({
    gate_kind: gate.gate_kind,
    gate_channel: gate.gate_channel,
    gate_mode: gate.gate_mode,
    source_bridge_preview_digest: gate.source_bridge_preview_digest,
    builder_readiness_status: gate.builder_readiness_status,
    builder_readiness: gate.builder_readiness.map((item) => ({
      key: item.key,
      builder_key: item.builder_key,
      builder_context_path: item.builder_context_path,
      status: item.status,
      payload_digest: item.builder_payload_digest,
    })),
    safety_boundary: gate.safety_boundary,
  });
  gate.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(gate);
  return gate;
}

export default buildAestheticMemoryContextBuilderReadinessGate;

