import { createHash } from "node:crypto";
import { buildAestheticMemoryContextBuilderPreviewSurface } from "./aesthetic-memory-context-builder-preview-surface-service.mjs";

export const aestheticMemoryContextBuilderBridgePreviewVersion = "aesthetic_memory_context_builder_bridge_preview_v1";

export const aestheticMemoryContextBuilderBridgePreviewSlots = [
  "writing_context_builder_bridge_preview",
  "revision_context_builder_bridge_preview",
  "final_polisher_context_builder_bridge_preview",
  "reader_response_context_builder_bridge_preview",
];

export const aestheticMemoryContextBuilderBridgePreviewContextPathTokens = [
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

function bridgeSlotForSurfaceSlot(surfaceSlot) {
  if (surfaceSlot === "writing_context_builder_surface") return "writing_context_builder_bridge_preview";
  if (surfaceSlot === "revision_context_builder_surface") return "revision_context_builder_bridge_preview";
  if (surfaceSlot === "final_polisher_context_builder_surface") return "final_polisher_context_builder_bridge_preview";
  if (surfaceSlot === "reader_response_context_builder_surface") return "reader_response_context_builder_bridge_preview";
  return "unknown_context_builder_bridge_preview";
}

function compactBridgeRow(row) {
  const item = object(row);
  const status = text(item.status, 80) || "blocked";
  return {
    key: bridgeSlotForSurfaceSlot(text(item.key, 180)),
    source_surface_slot: text(item.key, 180),
    builder_key: text(item.builder_key, 180),
    context_path: text(item.context_path, 220),
    payload_key: text(item.payload_key, 220),
    status,
    tone: toneFor(status),
    readonly_preview: item.readonly_preview === true,
    digest: text(item.digest, 80),
    chatgpt_line: `${text(item.builder_key, 180)}/${text(item.context_path, 220)}=${status} / readonly_preview=${item.readonly_preview === true}`,
  };
}

function sourceSafetyIssues(surface) {
  const src = object(surface);
  const safety = object(src.safety_boundary);
  const mutation = object(src.no_mutation_snapshot);
  const issues = [];
  if (src.phase !== "31F") issues.push("source_phase_not_31f");
  if (src.surface_kind !== "aesthetic_memory_context_builder_preview_surface") issues.push("source_surface_kind_invalid");
  if (src.preview_status === "needs_context") issues.push("source_needs_context");
  if (src.preview_status === "blocked") issues.push("source_blocked");
  if (src.can_display_builder_preview !== true && src.preview_status !== "needs_context") issues.push("source_cannot_display_builder_preview");
  if (src.will_build_context_now !== false) issues.push("source_would_build_context");
  if (src.will_attach_context_now !== false) issues.push("source_would_attach_context");
  if (src.will_mutate_context !== false) issues.push("source_would_mutate_context");
  if (src.builder_payload_persisted !== false) issues.push("source_builder_payload_persisted");
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
    "no_context_build",
    "no_context_attach",
    "no_context_mutation",
    "no_materialized_context_injection",
    "no_adapter_payload_persist",
    "no_builder_payload_persist",
    "no_surface_state_persist",
    "no_surface_tool_registration",
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
    "can_build_generation_context",
    "can_build_revision_context",
    "can_build_final_polisher_context",
    "can_build_reader_response_context",
    "can_materialize_context_injection",
    "can_attach_context_now",
    "can_persist_adapter_payload",
    "can_persist_builder_payload",
    "can_write_surface_state",
    "can_register_context_builder_mcp_tool",
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
    "context_built",
    "context_attached",
    "context_mutated",
    "injection_materialized",
    "adapter_payload_persisted",
    "builder_payload_persisted",
    "surface_state_written",
    "surface_state_persisted",
    "surface_tool_registered",
  ]) {
    if (mutation[key] !== false) issues.push(`${key}_not_false`);
  }
  return issues;
}

function bridgeStatusFor(source, rows, safetyIssues) {
  if (source.used !== true || source.preview_status === "needs_context") return "needs_context";
  if (safetyIssues.length) return "blocked";
  if (source.preview_status === "blocked") return "blocked";
  if (source.can_display_builder_preview !== true) return "blocked";
  if (rows.some((row) => row.status === "blocked")) return "blocked";
  if (source.preview_status === "watch" || rows.some((row) => row.status === "watch")) return "watch";
  return "ready";
}

function buildBridgeCards(rows, status, safetyIssues) {
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const watchCount = rows.filter((row) => row.status === "watch").length;
  const blockedCount = rows.filter((row) => row.status === "blocked").length;
  return [
    {
      key: "context_builder_bridge_overall",
      label: "Context builder bridge preview",
      value: `${readyCount}/${rows.length} ready`,
      status,
      tone: toneFor(status),
      summary: "ChatGPT bridge preview for aesthetic memory context builder surface rows.",
    },
    ...rows.map((row) => ({
      key: row.key,
      label: row.builder_key,
      value: row.status,
      status: row.status,
      tone: row.tone,
      route: `#${row.key}`,
      summary: `${row.context_path} / readonly_preview=${row.readonly_preview}`,
    })),
    {
      key: "bridge_safety_boundary",
      label: "Safety boundary",
      value: safetyIssues.length ? "blocked" : blockedCount ? "blocked" : watchCount ? "watch" : "clean",
      status: safetyIssues.length ? "blocked" : blockedCount ? "blocked" : watchCount ? "watch" : "ready",
      tone: safetyIssues.length ? "blocked" : blockedCount ? "blocked" : watchCount ? "watch" : "ready",
      summary: safetyIssues.length ? safetyIssues.join("; ") : "No context build, attach, mutation, payload persistence, surface state persistence, Canon write, active_engine update, compressed_rules update, runtime UI mutation, MCP registration, or memory file write.",
    },
  ];
}

function buildBridgeSections(cards, rows, source, safetyIssues) {
  return [
    {
      key: "bridge_header",
      title: "Aesthetic memory context builder bridge preview",
      tone: toneFor(text(source.preview_status, 80)),
      summary: `ChatGPT bridge dedicated summary for ${text(source.surface_kind, 180)}.`,
    },
    {
      key: "bridge_cards",
      title: "Bridge cards",
      tone: cards.some((card) => card.status === "blocked") ? "blocked" : cards.some((card) => card.status === "watch") ? "watch" : "ready",
      items: cards,
    },
    {
      key: "builder_bridge_rows",
      title: "Builder bridge rows",
      tone: rows.some((row) => row.status === "blocked") ? "blocked" : rows.some((row) => row.status === "watch") ? "watch" : "ready",
      items: rows,
    },
    {
      key: "chatgpt_status_lines",
      title: "ChatGPT status lines",
      tone: "ready",
      items: rows.map((row) => row.chatgpt_line),
    },
    {
      key: "source_surface_trace",
      title: "Source surface trace",
      tone: "neutral",
      items: [
        { key: "source_phase", value: text(source.phase, 40) },
        { key: "source_surface_kind", value: text(source.surface_kind, 180) },
        { key: "source_surface_digest", value: text(source.surface_digest, 80) },
      ],
    },
    {
      key: "operator_safety",
      title: "Operator safety",
      tone: safetyIssues.length ? "blocked" : "ready",
      items: [
        { key: "will_build_context_now", value: false },
        { key: "will_attach_context_now", value: false },
        { key: "will_mutate_context", value: false },
        { key: "builder_payload_persisted", value: false },
        { key: "runtime_ui_modified", value: false },
        { key: "mcp_tool_added", value: false },
        { key: "bridge_state_written", value: false },
      ],
    },
    {
      key: "raw_json_preview",
      title: "Raw JSON preview",
      tone: "neutral",
      visible_by_default: false,
      summary: "Raw 31F preview surface can be included only when include_raw is explicitly true.",
    },
  ];
}

function allowedBridgeActions() {
  return [
    {
      key: "read_context_builder_bridge_preview",
      label: "Read context builder bridge preview",
      allowed: true,
      route: "#aesthetic-memory-context-builder-bridge-preview",
    },
    {
      key: "copy_context_builder_bridge_markdown",
      label: "Copy context builder bridge markdown",
      allowed: true,
      route: "#aesthetic-memory-context-builder-bridge-preview",
    },
    {
      key: "inspect_builder_bridge_rows",
      label: "Inspect builder bridge rows",
      allowed: true,
      route: "#builder-bridge-rows",
    },
    {
      key: "inspect_source_context_builder_preview_surface",
      label: "Inspect source context builder preview surface",
      allowed: true,
      route: "#aesthetic-memory-context-builder-preview-surface",
    },
  ];
}

function blockedBridgeCapabilities() {
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
    "write_surface_state",
    "persist_surface_state",
    "write_bridge_state",
    "persist_bridge_state",
    "register_context_builder_mcp_tool",
    "register_context_builder_bridge_mcp_tool",
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31G is a read-only ChatGPT bridge preview, not a context builder executor or bridge state writer.",
  }));
}

function summaryLines(source, status, rows, safetyIssues) {
  const rowLine = rows.map((row) => `${row.builder_key}/${row.context_path}=${row.status}`).join("；");
  return [
    `狀態：${status}`,
    `來源 surface：${text(source.surface_kind, 180)} / ${text(source.phase, 40)}`,
    `builder bridge preview：${rowLine}`,
    safetyIssues.length ? `安全缺口：${safetyIssues.join("、")}` : "安全：只讀、只預覽、不 build context、不 attach context、不 mutate context、不保存 builder payload、不寫 surface/bridge state、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file、不修改 runtime UI",
    "結論：此 bridge preview 只把 31F builder preview surface 壓成 ChatGPT bridge 專用摘要，不執行任何 runtime context builder。",
  ];
}

function markdownFor(preview) {
  return [
    "## Aesthetic Memory Context Builder Bridge Preview",
    "",
    `- phase: ${preview.phase}`,
    `- source_phase: ${preview.source_phase}`,
    `- bridge_kind: ${preview.bridge_kind}`,
    `- bridge_channel: ${preview.bridge_channel}`,
    `- bridge_mode: ${preview.bridge_mode}`,
    `- preview_status: ${preview.preview_status}`,
    `- can_display_builder_bridge_preview: ${preview.can_display_builder_bridge_preview}`,
    `- will_build_context_now: ${preview.will_build_context_now}`,
    `- will_attach_context_now: ${preview.will_attach_context_now}`,
    `- will_mutate_context: ${preview.will_mutate_context}`,
    `- builder_payload_persisted: ${preview.builder_payload_persisted}`,
    `- runtime_ui_modified: ${preview.no_mutation_snapshot.runtime_ui_modified}`,
    `- mcp_tool_added: ${preview.no_mutation_snapshot.mcp_tool_added}`,
    `- bridge_state_written: ${preview.no_mutation_snapshot.bridge_state_written}`,
    "",
    "### Builder Bridge Rows",
    ...preview.builder_bridge_rows.map((row) => `- ${row.builder_key}: ${row.status} / ${row.context_path} / readonly_preview=${row.readonly_preview}`),
    "",
    "### ChatGPT Summary",
    ...preview.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryContextBuilderBridgePreview(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedSurface = object(
    options.surface
      ?? options.preview_surface
      ?? options.previewSurface
      ?? input.aesthetic_memory_context_builder_preview_surface
      ?? input.aestheticMemoryContextBuilderPreviewSurface
      ?? input.context_builder_preview_surface
      ?? input.contextBuilderPreviewSurface
      ?? input.preview_surface
      ?? input.previewSurface
      ?? input.surface,
  );
  const source = providedSurface.phase === "31F"
    ? providedSurface
    : await buildAestheticMemoryContextBuilderPreviewSurface(input, options);
  const safetyIssues = sourceSafetyIssues(source);
  const rows = array(source.builder_status_rows).map(compactBridgeRow);
  const status = bridgeStatusFor(source, rows, safetyIssues);
  const cards = buildBridgeCards(rows, status, safetyIssues);
  const preview = {
    used: source.used === true,
    phase: "31G",
    version: aestheticMemoryContextBuilderBridgePreviewVersion,
    bridge_kind: "aesthetic_memory_context_builder_bridge_preview",
    bridge_channel: "chatgpt_bridge_context_builder_preview",
    bridge_mode: "readonly_bridge_preview",
    source_phase: text(source.phase, 40) || "31F",
    source_version: text(source.version, 160) || null,
    source_surface_kind: text(source.surface_kind, 180) || "aesthetic_memory_context_builder_preview_surface",
    source_surface_digest: text(source.surface_digest, 80) || stableDigest(source),
    preview_status: status,
    can_display_builder_bridge_preview: status === "ready" || status === "watch",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    builder_payload_persisted: false,
    bridge_state_persisted: false,
    builder_bridge_cards: cards,
    builder_bridge_rows: rows,
    bridge_sections: buildBridgeSections(cards, rows, source, safetyIssues),
    safety_issues: safetyIssues,
    chatgpt_summary_lines: summaryLines(source, status, rows, safetyIssues),
    allowed_bridge_actions: allowedBridgeActions(),
    blocked_bridge_capabilities: blockedBridgeCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_context_builder_bridge_preview" : status === "watch" ? "inspect_context_builder_bridge_warnings" : "repair_context_builder_surface_before_bridge",
      label: status === "ready" ? "Review context builder bridge preview" : status === "watch" ? "Inspect context builder bridge warnings" : "Repair context builder surface before bridge",
      route: "#aesthetic-memory-context-builder-bridge-preview",
      ui_target: "aesthetic-memory-context-builder-bridge-preview",
      enabled: true,
      reason: status === "ready"
        ? "All builder preview surface rows are available as ChatGPT bridge-readable summaries."
        : status === "watch"
          ? "One or more builder bridge rows has a warning but remains read-only."
          : "The source builder preview surface is incomplete or unsafe for bridge display.",
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
      no_bridge_state_persist: true,
      no_bridge_tool_registration: true,
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
      can_write_bridge_state: false,
      can_register_context_builder_mcp_tool: false,
      can_register_context_builder_bridge_mcp_tool: false,
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
      bridge_state_written: false,
      bridge_state_persisted: false,
      bridge_tool_registered: false,
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_surface_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_surface: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? source : null,
  };
  preview.bridge_preview_digest = stableDigest({
    bridge_kind: preview.bridge_kind,
    bridge_channel: preview.bridge_channel,
    bridge_mode: preview.bridge_mode,
    source_surface_digest: preview.source_surface_digest,
    preview_status: preview.preview_status,
    builder_bridge_rows: preview.builder_bridge_rows.map((row) => ({
      key: row.key,
      builder_key: row.builder_key,
      context_path: row.context_path,
      status: row.status,
      digest: row.digest,
    })),
    safety_boundary: preview.safety_boundary,
  });
  preview.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(preview);
  return preview;
}

export default buildAestheticMemoryContextBuilderBridgePreview;

