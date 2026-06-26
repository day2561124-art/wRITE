import { createHash } from "node:crypto";
import { buildAestheticMemoryContextBuilderReadinessGate } from "./aesthetic-memory-context-builder-readiness-gate-service.mjs";

export const aestheticMemoryContextBuilderPreviewSurfaceVersion = "aesthetic_memory_context_builder_preview_surface_v1";

export const aestheticMemoryContextBuilderPreviewSurfaceSlots = [
  "writing_context_builder_surface",
  "revision_context_builder_surface",
  "final_polisher_context_builder_surface",
  "reader_response_context_builder_surface",
];

export const aestheticMemoryContextBuilderPreviewSurfaceContextPathTokens = [
  "writing_context.aesthetic_memory",
  "revision_context.aesthetic_memory",
  "final_polisher_context.aesthetic_memory",
  "reader_response_context.aesthetic_memory",
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

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toneFor(status) {
  return status === "ready" ? "ready" : status === "watch" ? "watch" : status === "needs_context" ? "empty" : "blocked";
}

function slotForBuilderKey(builderKey) {
  if (builderKey === "writing_context_builder") return "writing_context_builder_surface";
  if (builderKey === "revision_context_builder") return "revision_context_builder_surface";
  if (builderKey === "final_polisher_context_builder") return "final_polisher_context_builder_surface";
  if (builderKey === "reader_response_context_builder") return "reader_response_context_builder_surface";
  return "unknown_context_builder_surface";
}

function displayLabelForBuilderKey(builderKey) {
  if (builderKey === "writing_context_builder") return "Writing context builder";
  if (builderKey === "revision_context_builder") return "Revision context builder";
  if (builderKey === "final_polisher_context_builder") return "Final polisher context builder";
  if (builderKey === "reader_response_context_builder") return "Reader response context builder";
  return builderKey || "Unknown context builder";
}

function compactBuilderItem(item) {
  const readiness = object(item);
  const payload = object(readiness.builder_payload_preview);
  return {
    key: text(readiness.key, 180),
    surface_slot: slotForBuilderKey(text(readiness.builder_key, 180)),
    label: displayLabelForBuilderKey(text(readiness.builder_key, 180)),
    builder_key: text(readiness.builder_key, 180),
    builder_context_path: text(readiness.builder_context_path, 220),
    source_adapter_key: text(readiness.source_adapter_key, 180),
    expected_adapter_payload_key: text(readiness.expected_adapter_payload_key, 220),
    builder_preview_payload_key: text(readiness.builder_preview_payload_key, 220),
    downstream_context: text(readiness.downstream_context, 180),
    status: text(readiness.status, 80) || "blocked",
    tone: toneFor(text(readiness.status, 80)),
    can_build_readonly_context_preview: readiness.can_build_readonly_context_preview === true,
    will_build_context_now: readiness.will_build_context_now === true,
    will_attach_context_now: readiness.will_attach_context_now === true,
    will_mutate_context: readiness.will_mutate_context === true,
    will_persist_builder_payload: readiness.will_persist_builder_payload === true,
    builder_payload_digest: text(readiness.builder_payload_digest, 80),
    source_bridge_preview_digest: text(payload.source_bridge_preview_digest, 80),
    source_adapter_payload_digest: text(payload.source_adapter_payload_digest, 80),
    warning_count: array(readiness.warnings).length,
    blocker_count: array(readiness.blockers).length,
    preview_note: text(payload.safety_note, 360),
  };
}

function buildSurfaceCards(gate, builderItems) {
  const status = text(gate.builder_readiness_status, 80) || "blocked";
  const readyCount = builderItems.filter((item) => item.status === "ready").length;
  const watchCount = builderItems.filter((item) => item.status === "watch").length;
  const blockedCount = builderItems.filter((item) => item.status === "blocked").length;
  return [
    {
      key: "context_builder_surface_overall",
      label: "Context builder preview surface",
      value: `${readyCount}/${builderItems.length} ready`,
      status,
      tone: toneFor(status),
      summary: "UI/ChatGPT-readable surface for aesthetic memory context builder readiness.",
    },
    ...builderItems.map((item) => ({
      key: item.surface_slot,
      label: item.label,
      value: item.status,
      status: item.status,
      tone: item.tone,
      route: `#${item.surface_slot}`,
      summary: `${item.builder_context_path} / preview-only / payload=${item.builder_preview_payload_key}`,
    })),
    {
      key: "surface_safety_boundary",
      label: "Safety boundary",
      value: blockedCount ? "blocked" : watchCount ? "watch" : "clean",
      status: blockedCount ? "blocked" : watchCount ? "watch" : "ready",
      tone: blockedCount ? "blocked" : watchCount ? "watch" : "ready",
      summary: "No context build, attach, mutation, payload persistence, Canon write, active_engine update, compressed_rules update, runtime UI mutation, MCP registration, or memory file write.",
    },
  ];
}

function buildStatusRows(builderItems) {
  return builderItems.map((item) => ({
    key: item.surface_slot,
    label: item.label,
    builder_key: item.builder_key,
    context_path: item.builder_context_path,
    payload_key: item.builder_preview_payload_key,
    status: item.status,
    tone: item.tone,
    readonly_preview: item.can_build_readonly_context_preview && !item.will_build_context_now && !item.will_attach_context_now && !item.will_mutate_context && !item.will_persist_builder_payload,
    digest: item.builder_payload_digest,
  }));
}

function buildSurfaceSections(surfaceCards, statusRows, gate) {
  return [
    {
      key: "surface_header",
      title: "Aesthetic memory context builder preview",
      tone: toneFor(text(gate.builder_readiness_status, 80)),
      summary: `Phase 31F preview surface for ${text(gate.gate_kind, 180)}.`,
    },
    {
      key: "surface_cards",
      title: "Surface cards",
      tone: "ready",
      items: surfaceCards,
    },
    {
      key: "builder_status_rows",
      title: "Builder status rows",
      tone: statusRows.some((row) => row.status === "blocked") ? "blocked" : statusRows.some((row) => row.status === "watch") ? "watch" : "ready",
      items: statusRows,
    },
    {
      key: "chatgpt_bridge_summary",
      title: "ChatGPT bridge summary",
      tone: toneFor(text(gate.builder_readiness_status, 80)),
      items: array(gate.chatgpt_summary_lines),
    },
    {
      key: "operator_safety",
      title: "Operator safety",
      tone: "ready",
      items: [
        { key: "will_build_context_now", value: false },
        { key: "will_attach_context_now", value: false },
        { key: "will_mutate_context", value: false },
        { key: "builder_payload_persisted", value: false },
        { key: "runtime_ui_modified", value: false },
        { key: "mcp_tool_added", value: false },
      ],
    },
    {
      key: "raw_json_preview",
      title: "Raw JSON preview",
      tone: "neutral",
      visible_by_default: false,
      summary: "Raw 31E builder readiness gate can be included only when include_raw is explicitly true.",
    },
  ];
}

function allowedSurfaceActions() {
  return [
    {
      key: "read_context_builder_preview_surface",
      label: "Read context builder preview surface",
      allowed: true,
      route: "#aesthetic-memory-context-builder-preview-surface",
    },
    {
      key: "copy_context_builder_preview_markdown",
      label: "Copy context builder preview markdown",
      allowed: true,
      route: "#aesthetic-memory-context-builder-preview-surface",
    },
    {
      key: "inspect_context_builder_status_rows",
      label: "Inspect context builder status rows",
      allowed: true,
      route: "#builder-status-rows",
    },
    {
      key: "inspect_source_context_builder_readiness_gate",
      label: "Inspect source context builder readiness gate",
      allowed: true,
      route: "#aesthetic-memory-context-builder-readiness",
    },
  ];
}

function blockedSurfaceCapabilities() {
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
    "write_surface_state",
    "persist_surface_state",
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31F is a read-only preview surface, not a context builder or UI mutation executor.",
  }));
}

function surfaceStatusFor(gate, builderItems) {
  if (gate.used !== true || gate.builder_readiness_status === "needs_context") return "needs_context";
  if (gate.builder_readiness_status === "blocked") return "blocked";
  if (gate.can_build_readonly_context_preview !== true) return "blocked";
  if (gate.will_build_context_now !== false || gate.will_attach_context_now !== false || gate.will_mutate_context !== false || gate.builder_payload_persisted !== false) return "blocked";
  if (builderItems.some((item) => item.status === "blocked")) return "blocked";
  if (gate.builder_readiness_status === "watch" || builderItems.some((item) => item.status === "watch")) return "watch";
  return "ready";
}

function summaryLines(gate, status, statusRows) {
  const rowLine = statusRows.map((row) => `${row.builder_key}/${row.context_path}=${row.status}`).join("；");
  return [
    `狀態：${status}`,
    `來源 gate：${text(gate.gate_kind, 180)} / ${text(gate.phase, 40)}`,
    `builder preview surface：${rowLine}`,
    "安全：只讀、只預覽、不 build context、不 attach context、不 mutate context、不保存 builder payload、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file、不修改 runtime UI",
    "結論：此 surface 只把 31E builder readiness gate 整理成 UI / ChatGPT bridge 可讀摘要，不執行任何下游 context builder。",
  ];
}

function markdownFor(surface) {
  return [
    "## Aesthetic Memory Context Builder Preview Surface",
    "",
    `- phase: ${surface.phase}`,
    `- source_phase: ${surface.source_phase}`,
    `- surface_kind: ${surface.surface_kind}`,
    `- surface_channel: ${surface.surface_channel}`,
    `- surface_mode: ${surface.surface_mode}`,
    `- preview_status: ${surface.preview_status}`,
    `- can_display_builder_preview: ${surface.can_display_builder_preview}`,
    `- will_build_context_now: ${surface.will_build_context_now}`,
    `- will_attach_context_now: ${surface.will_attach_context_now}`,
    `- will_mutate_context: ${surface.will_mutate_context}`,
    `- builder_payload_persisted: ${surface.builder_payload_persisted}`,
    `- runtime_ui_modified: ${surface.no_mutation_snapshot.runtime_ui_modified}`,
    `- mcp_tool_added: ${surface.no_mutation_snapshot.mcp_tool_added}`,
    `- surface_state_written: ${surface.no_mutation_snapshot.surface_state_written}`,
    "",
    "### Builder Rows",
    ...surface.builder_status_rows.map((row) => `- ${row.builder_key}: ${row.status} / ${row.context_path} / readonly_preview=${row.readonly_preview}`),
    "",
    "### ChatGPT Summary",
    ...surface.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryContextBuilderPreviewSurface(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedGate = object(
    options.gate
      ?? options.builder_gate
      ?? options.builderGate
      ?? input.aesthetic_memory_context_builder_readiness_gate
      ?? input.aestheticMemoryContextBuilderReadinessGate
      ?? input.context_builder_readiness_gate
      ?? input.contextBuilderReadinessGate
      ?? input.builder_gate
      ?? input.builderGate
      ?? input.gate,
  );
  const gate = providedGate.phase === "31E"
    ? providedGate
    : await buildAestheticMemoryContextBuilderReadinessGate(input, options);
  const builderItems = array(gate.builder_readiness).map(compactBuilderItem);
  const status = surfaceStatusFor(gate, builderItems);
  const surfaceCards = buildSurfaceCards(gate, builderItems);
  const statusRows = buildStatusRows(builderItems);
  const surface = {
    used: gate.used === true,
    phase: "31F",
    version: aestheticMemoryContextBuilderPreviewSurfaceVersion,
    surface_kind: "aesthetic_memory_context_builder_preview_surface",
    surface_channel: "ui_chatgpt_bridge_preview",
    surface_mode: "readonly_preview_surface",
    source_phase: text(gate.phase, 40) || "31E",
    source_version: text(gate.version, 160) || null,
    source_gate_kind: text(gate.gate_kind, 180) || "aesthetic_memory_context_builder_readiness_gate",
    source_builder_readiness_digest: text(gate.builder_readiness_digest, 80) || stableDigest(gate),
    preview_status: status,
    can_display_builder_preview: status === "ready" || status === "watch",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    builder_payload_persisted: false,
    surface_cards: surfaceCards,
    builder_status_rows: statusRows,
    surface_sections: buildSurfaceSections(surfaceCards, statusRows, gate),
    chatgpt_summary_lines: summaryLines(gate, status, statusRows),
    allowed_surface_actions: allowedSurfaceActions(),
    blocked_surface_capabilities: blockedSurfaceCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_context_builder_preview_surface" : status === "watch" ? "inspect_context_builder_surface_warnings" : "repair_context_builder_readiness_before_surface",
      label: status === "ready" ? "Review context builder preview surface" : status === "watch" ? "Inspect context builder surface warnings" : "Repair context builder readiness before surface",
      route: "#aesthetic-memory-context-builder-preview-surface",
      ui_target: "aesthetic-memory-context-builder-preview-surface",
      enabled: true,
      reason: status === "ready"
        ? "All builder readiness rows are available as UI/ChatGPT-readable preview."
        : status === "watch"
          ? "One or more builder readiness rows has a warning but remains read-only."
          : "The source context builder readiness gate is incomplete or unsafe for preview surface display.",
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
      no_surface_state_persist: true,
      no_surface_tool_registration: true,
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
      can_write_surface_state: false,
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
      surface_state_written: false,
      surface_state_persisted: false,
      surface_tool_registered: false,
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_gate_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_gate: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? gate : null,
  };
  surface.surface_digest = stableDigest({
    surface_kind: surface.surface_kind,
    surface_channel: surface.surface_channel,
    surface_mode: surface.surface_mode,
    source_builder_readiness_digest: surface.source_builder_readiness_digest,
    preview_status: surface.preview_status,
    builder_status_rows: surface.builder_status_rows.map((row) => ({
      key: row.key,
      builder_key: row.builder_key,
      context_path: row.context_path,
      status: row.status,
      digest: row.digest,
    })),
    safety_boundary: surface.safety_boundary,
  });
  surface.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(surface);
  return surface;
}

export default buildAestheticMemoryContextBuilderPreviewSurface;

