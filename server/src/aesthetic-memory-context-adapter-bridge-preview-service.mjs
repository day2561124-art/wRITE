import { createHash } from "node:crypto";
import { buildAestheticMemoryContextAdapterPreview } from "./aesthetic-memory-context-adapter-preview-service.mjs";

export const aestheticMemoryContextAdapterBridgePreviewVersion = "aesthetic_memory_context_adapter_bridge_preview_v1";

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

function summarizeAdapter(adapter) {
  const item = object(adapter);
  const payload = object(item.adapter_payload_preview);
  return {
    key: text(item.key, 140) || "context_adapter",
    target_key: text(item.target_key, 140),
    context_path: text(item.context_path, 220),
    consumer: text(item.consumer, 180),
    status: text(item.status, 80) || "not_available",
    tone: text(item.status, 80) === "ready" ? "ready" : text(item.status, 80) === "watch" ? "watch" : "blocked",
    adapter_mode: text(item.adapter_mode, 160),
    can_preview_adapter_payload: item.can_preview_adapter_payload === true,
    can_attach_readonly_context: item.can_attach_readonly_context === true,
    will_attach_context_now: item.will_attach_context_now === true,
    will_mutate_context: item.will_mutate_context === true,
    materialized: item.materialized === true,
    payload_key: text(item.payload_key, 180),
    adapter_payload_key: text(item.adapter_payload_key, 180),
    adapter_payload_digest: text(item.adapter_payload_digest, 80),
    summary_focus: array(payload.summary_focus).map((focus) => text(focus, 80)).filter(Boolean),
    warning_count: array(item.warnings).length,
    blocker_count: array(item.blockers).length,
    safety_note: text(payload.safety_note, 360),
  };
}

function adapterStatusLine(adapter) {
  const summary = summarizeAdapter(adapter);
  return `${summary.context_path || summary.key}：${summary.status} / payload=${summary.adapter_payload_key} / readonly=${summary.can_preview_adapter_payload && !summary.will_mutate_context && !summary.materialized}`;
}

function bridgeSections(source) {
  const adapters = array(source.context_adapters).map(summarizeAdapter);
  return [
    {
      key: "bridge_header",
      title: "Bridge header",
      summary: `${text(source.adapter_kind, 160)} · status=${text(source.preview_status, 80)}`,
      tone: text(source.preview_status, 80) === "ready" ? "ready" : text(source.preview_status, 80) === "watch" ? "watch" : text(source.preview_status, 80) === "needs_context" ? "empty" : "blocked",
    },
    {
      key: "context_adapter_summary",
      title: "Context adapter summary",
      summary: "ChatGPT-readable summary of every aesthetic memory context adapter preview.",
      items: adapters,
      tone: adapters.some((adapter) => adapter.status === "blocked") ? "blocked" : adapters.some((adapter) => adapter.status === "watch") ? "watch" : "ready",
    },
    {
      key: "writing_context_adapter",
      title: "Writing context adapter",
      summary: adapterStatusLine(array(source.context_adapters).find((adapter) => object(adapter).key === "writing_context_adapter")),
      items: adapters.filter((adapter) => adapter.key === "writing_context_adapter"),
      tone: adapters.find((adapter) => adapter.key === "writing_context_adapter")?.tone ?? "blocked",
    },
    {
      key: "revision_context_adapter",
      title: "Revision context adapter",
      summary: adapterStatusLine(array(source.context_adapters).find((adapter) => object(adapter).key === "revision_context_adapter")),
      items: adapters.filter((adapter) => adapter.key === "revision_context_adapter"),
      tone: adapters.find((adapter) => adapter.key === "revision_context_adapter")?.tone ?? "blocked",
    },
    {
      key: "final_polisher_context_adapter",
      title: "Final polisher context adapter",
      summary: adapterStatusLine(array(source.context_adapters).find((adapter) => object(adapter).key === "final_polisher_context_adapter")),
      items: adapters.filter((adapter) => adapter.key === "final_polisher_context_adapter"),
      tone: adapters.find((adapter) => adapter.key === "final_polisher_context_adapter")?.tone ?? "blocked",
    },
    {
      key: "reader_response_context_adapter",
      title: "Reader response context adapter",
      summary: adapterStatusLine(array(source.context_adapters).find((adapter) => object(adapter).key === "reader_response_context_adapter")),
      items: adapters.filter((adapter) => adapter.key === "reader_response_context_adapter"),
      tone: adapters.find((adapter) => adapter.key === "reader_response_context_adapter")?.tone ?? "blocked",
    },
    {
      key: "adapter_payload_preview",
      title: "Adapter payload preview",
      summary: "Payload shapes are visible for review only and are not written into runtime context.",
      items: adapters.map((adapter) => ({
        key: adapter.key,
        label: adapter.context_path,
        payload_key: adapter.adapter_payload_key,
        digest: adapter.adapter_payload_digest,
        materialized: adapter.materialized,
      })),
      tone: "ready",
    },
    {
      key: "safety_boundary",
      title: "Safety boundary",
      summary: "Read-only ChatGPT bridge preview; no context mutation, materialized injection, adapter payload persistence, protected writes, runtime UI mutation, or MCP registration.",
      items: [
        { key: "read_only", value: true },
        { key: "preview_only", value: true },
        { key: "no_context_mutation", value: true },
        { key: "no_materialized_context_injection", value: true },
        { key: "no_adapter_payload_persist", value: true },
        { key: "can_write_canon", value: false },
        { key: "can_update_active_engine", value: false },
        { key: "can_register_mcp_tool", value: false },
        { key: "context_mutated", value: false },
        { key: "adapter_payload_persisted", value: false },
      ],
      tone: "ready",
    },
    {
      key: "raw_json_preview",
      title: "Raw JSON preview",
      summary: "Raw 31B adapter preview can be included only when include_raw is explicitly true.",
      visible_by_default: false,
      tone: "neutral",
    },
    {
      key: "no_mutation_snapshot",
      title: "No mutation snapshot",
      summary: "Bridge preview reports no protected writes, runtime UI mutation, MCP tool addition, memory file write, context mutation, or adapter payload persistence.",
      tone: "ready",
    },
  ];
}

function allowedBridgeActions() {
  return [
    {
      key: "read_context_adapter_bridge_summary",
      label: "Read context adapter bridge summary",
      allowed: true,
      route: "#aesthetic-memory-context-adapter-bridge",
    },
    {
      key: "copy_context_adapter_bridge_markdown",
      label: "Copy context adapter bridge markdown preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter-bridge",
    },
    {
      key: "inspect_context_adapter_payload_preview",
      label: "Inspect context adapter payload preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter",
    },
    {
      key: "inspect_source_context_adapter_preview",
      label: "Inspect source context adapter preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter",
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
    "materialize_context_injection",
    "attach_context_now",
    "mutate_writing_context",
    "mutate_revision_context",
    "mutate_final_polisher_context",
    "mutate_reader_response_context",
    "persist_adapter_payload",
    "register_context_adapter_mcp_tool",
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31C is a read-only ChatGPT bridge preview for context adapter payloads.",
  }));
}

function previewStatusFor(source) {
  const safety = object(source.safety_boundary);
  const mutation = object(source.no_mutation_snapshot);
  if (source.used !== true || source.preview_status === "needs_context") return "needs_context";
  if (source.preview_status === "blocked") return "blocked";
  if (source.can_preview_adapter_payload !== true) return "blocked";
  if (source.will_attach_context_now !== false || source.will_mutate_context !== false) return "blocked";
  if (safety.read_only !== true || safety.preview_only !== true || safety.no_context_mutation !== true || safety.no_adapter_payload_persist !== true) return "blocked";
  if (safety.can_write_canon !== false || safety.can_update_active_engine !== false || safety.can_register_mcp_tool !== false) return "blocked";
  if (mutation.context_mutated !== false || mutation.adapter_payload_persisted !== false || mutation.mcp_tool_added !== false || mutation.memory_file_written !== false) return "blocked";
  if (source.preview_status === "watch") return "watch";
  return "ready";
}

function chatgptSummaryLines(source, status) {
  const adapterLines = array(source.context_adapters).map(adapterStatusLine);
  return [
    `狀態：${status}`,
    `來源：${text(source.adapter_kind, 160)} / ${text(source.phase, 40)}`,
    ...adapterLines,
    "安全：preview-only、read-only、不實際寫入 context、不保存 adapter payload、不生成、不修稿、不審核、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file",
    "結論：ChatGPT 只能讀取 31B 的 context adapter preview 摘要，不能把 payload 寫進任何 runtime context。",
  ];
}

function markdownFor(preview) {
  return [
    "## Aesthetic Memory Context Adapter Bridge Preview",
    "",
    `- phase: ${preview.phase}`,
    `- source_phase: ${preview.source_phase}`,
    `- bridge_kind: ${preview.bridge_kind}`,
    `- bridge_channel: ${preview.bridge_channel}`,
    `- bridge_mode: ${preview.bridge_mode}`,
    `- preview_status: ${preview.preview_status}`,
    `- can_read_adapter_payload_preview: ${preview.can_read_adapter_payload_preview}`,
    `- will_attach_context_now: ${preview.will_attach_context_now}`,
    `- will_mutate_context: ${preview.will_mutate_context}`,
    `- adapter_payload_persisted: ${preview.adapter_payload_persisted}`,
    `- read_only: ${preview.safety_boundary.read_only}`,
    `- preview_only: ${preview.safety_boundary.preview_only}`,
    `- can_write_canon: ${preview.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${preview.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${preview.safety_boundary.can_register_mcp_tool}`,
    `- context_mutated: ${preview.no_mutation_snapshot.context_mutated}`,
    `- adapter_payload_persisted_snapshot: ${preview.no_mutation_snapshot.adapter_payload_persisted}`,
    "",
    "### Context adapter status",
    ...preview.adapter_status_lines.map((line) => `- ${line}`),
    "",
    "### ChatGPT Summary",
    ...preview.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryContextAdapterBridgePreview(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedAdapterPreview = object(
    options.adapter_preview
      ?? options.adapterPreview
      ?? input.aesthetic_memory_context_adapter_preview
      ?? input.aestheticMemoryContextAdapterPreview
      ?? input.context_adapter_preview
      ?? input.contextAdapterPreview
      ?? input.adapter_preview
      ?? input.adapterPreview,
  );
  const source = providedAdapterPreview.phase === "31B"
    ? providedAdapterPreview
    : await buildAestheticMemoryContextAdapterPreview(input, options);
  const status = previewStatusFor(source);
  const adapterSummaries = array(source.context_adapters).map(summarizeAdapter);
  const bridge = {
    used: source.used === true,
    phase: "31C",
    version: aestheticMemoryContextAdapterBridgePreviewVersion,
    bridge_kind: "aesthetic_memory_context_adapter_bridge_preview",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_bridge_preview",
    bridge_surface: "aesthetic_memory_context_adapter_summary",
    source_phase: text(source.phase, 40) || "31B",
    source_version: text(source.version, 160) || null,
    source_adapter_kind: text(source.adapter_kind, 180) || "aesthetic_memory_context_adapter_preview",
    source_adapter_preview_digest: text(source.adapter_preview_digest, 80) || stableDigest(source),
    preview_status: status,
    can_read_adapter_payload_preview: status === "ready" || status === "watch",
    will_attach_context_now: false,
    will_mutate_context: false,
    adapter_payload_persisted: false,
    adapter_status_lines: array(source.context_adapters).map(adapterStatusLine),
    context_adapter_summaries: adapterSummaries,
    chatgpt_summary_lines: chatgptSummaryLines(source, status),
    bridge_sections: bridgeSections(source),
    allowed_bridge_actions: allowedBridgeActions(),
    blocked_bridge_capabilities: blockedBridgeCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_context_adapter_bridge_preview" : status === "watch" ? "inspect_context_adapter_bridge_warnings" : "repair_context_adapter_preview_before_bridge",
      label: status === "ready" ? "Review context adapter bridge preview" : status === "watch" ? "Inspect context adapter bridge warnings" : "Repair context adapter preview before bridge",
      route: "#aesthetic-memory-context-adapter-bridge",
      ui_target: "aesthetic-memory-context-adapter-bridge",
      enabled: true,
      reason: status === "ready"
        ? "All context adapter payload previews are ChatGPT-readable and remain read-only."
        : status === "watch"
          ? "One or more adapter payload previews has a warning but remains read-only."
          : "The source context adapter preview is incomplete or unsafe for ChatGPT bridge display.",
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
      no_context_mutation: true,
      no_materialized_context_injection: true,
      no_adapter_payload_persist: true,
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
      can_materialize_context_injection: false,
      can_attach_context_now: false,
      can_persist_adapter_payload: false,
      can_register_context_adapter_mcp_tool: false,
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
      context_mutated: false,
      injection_materialized: false,
      adapter_payload_persisted: false,
      bridge_tool_registered: false,
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_adapter_preview_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_adapter_preview: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? source : null,
  };
  bridge.bridge_preview_digest = stableDigest({
    bridge_kind: bridge.bridge_kind,
    bridge_channel: bridge.bridge_channel,
    bridge_mode: bridge.bridge_mode,
    source_adapter_preview_digest: bridge.source_adapter_preview_digest,
    adapter_status_lines: bridge.adapter_status_lines,
    safety_boundary: bridge.safety_boundary,
  });
  bridge.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(bridge);
  return bridge;
}

export default buildAestheticMemoryContextAdapterBridgePreview;

