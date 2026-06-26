import { createHash } from "node:crypto";
import { buildAestheticMemoryInjectionReadinessGate } from "./aesthetic-memory-injection-readiness-gate-service.mjs";

export const aestheticMemoryContextAdapterPreviewVersion = "aesthetic_memory_context_adapter_preview_v1";

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

function targetByKey(gate, key) {
  return array(gate.target_readiness).find((target) => object(target).key === key) ?? null;
}

function injectionTargetByKey(gate, key) {
  return array(gate.injection_targets).find((target) => object(target).key === key) ?? null;
}

function gateAllowsReadOnlyContext(gate) {
  const safety = object(gate.safety_boundary);
  const mutation = object(gate.no_mutation_snapshot);
  return gate.phase === "31A"
    && gate.gate_kind === "aesthetic_memory_injection_readiness_gate"
    && (gate.readiness_status === "ready" || gate.readiness_status === "watch")
    && gate.can_attach_readonly_context === true
    && gate.will_attach_context_now === false
    && gate.will_mutate_context === false
    && safety.read_only === true
    && safety.preview_only === true
    && safety.no_context_mutation === true
    && safety.can_materialize_context_injection === false
    && mutation.context_mutated === false
    && mutation.injection_materialized === false;
}

function adapterDefinitions() {
  return [
    {
      key: "writing_context_adapter",
      target_key: "writing_context",
      context_path: "writing_context.aesthetic_memory",
      payload_key: "generation_payload_key",
      adapter_payload_key: "aesthetic_memory_for_generation",
      consumer: "writing_context_builder",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "revision_context_adapter",
      target_key: "revision_context",
      context_path: "revision_context.aesthetic_memory",
      payload_key: "revision_payload_key",
      adapter_payload_key: "aesthetic_memory_for_revision",
      consumer: "revision_context_builder",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "final_polisher_context_adapter",
      target_key: "final_polisher_context",
      context_path: "final_polisher_context.aesthetic_memory",
      payload_key: "final_polisher_payload_key",
      adapter_payload_key: "aesthetic_memory_for_final_polisher",
      consumer: "final_polisher_context_builder",
      summary_focus: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "reader_response_context_adapter",
      target_key: "reader_response_simulator_context",
      context_path: "reader_response_context.aesthetic_memory",
      payload_key: "reader_response_payload_key",
      adapter_payload_key: "aesthetic_memory_for_reader_response",
      consumer: "reader_response_context_builder",
      summary_focus: ["審美記憶", "覆蓋", "安全"],
    },
  ];
}

function buildAdapter(gate, definition) {
  const target = object(targetByKey(gate, definition.target_key));
  const injectionTarget = object(injectionTargetByKey(gate, definition.target_key));
  const blockers = array(target.blockers).map((item) => text(item, 160)).filter(Boolean);
  const warnings = array(target.warnings).map((item) => text(item, 160)).filter(Boolean);
  const summaryLines = array(gate.chatgpt_summary_lines).map((line) => text(line, 800)).filter(Boolean);
  const status = blockers.length
    ? "blocked"
    : target.status === "watch" || warnings.length
      ? "watch"
      : target.status === "ready"
        ? "ready"
        : "blocked";
  const attachable = gateAllowsReadOnlyContext(gate) && (status === "ready" || status === "watch");
  const payload = {
    payload_key: definition.adapter_payload_key,
    source_payload_key: text(target.payload_key, 160) || definition.payload_key,
    source_gate_digest: text(gate.gate_digest, 80),
    summary_lines: summaryLines,
    summary_focus: definition.summary_focus,
    readiness_status: status,
    injection_readiness_score: Math.round(number(gate.injection_readiness_score, 0)),
    source_target: {
      key: text(target.key, 120) || definition.target_key,
      label: text(target.label, 160) || text(injectionTarget.label, 160),
      downstream_use: text(target.downstream_use, 200) || text(injectionTarget.downstream_use, 200),
      applies_to: array(target.applies_to).length ? array(target.applies_to) : array(injectionTarget.applies_to),
    },
    safety_note: "Read-only context adapter preview only; this payload is not written into any context object.",
  };
  return {
    key: definition.key,
    target_key: definition.target_key,
    context_path: definition.context_path,
    consumer: definition.consumer,
    status,
    can_preview_adapter_payload: attachable,
    can_attach_readonly_context: attachable,
    will_attach_context_now: false,
    will_mutate_context: false,
    materialized: false,
    adapter_mode: "readonly_context_adapter_preview",
    payload_key: definition.payload_key,
    adapter_payload_key: definition.adapter_payload_key,
    warnings,
    blockers,
    adapter_payload_preview: payload,
    adapter_payload_digest: stableDigest(payload),
  };
}

function adapterSummaryCards(adapters, gate) {
  const readyCount = adapters.filter((adapter) => adapter.status === "ready").length;
  const watchCount = adapters.filter((adapter) => adapter.status === "watch").length;
  const blockedCount = adapters.filter((adapter) => adapter.status === "blocked").length;
  return [
    {
      key: "context_adapter_overall",
      label: "Context adapter preview",
      value: `${readyCount}/${adapters.length} ready`,
      score: Math.round(number(gate.injection_readiness_score, 0)),
      tone: blockedCount ? "blocked" : watchCount ? "watch" : "ready",
      summary: "Preview-only adapters for downstream context builders.",
    },
    {
      key: "writing_context_adapter",
      label: "Writing context",
      value: adapters.find((adapter) => adapter.key === "writing_context_adapter")?.status ?? "missing",
      tone: adapters.find((adapter) => adapter.key === "writing_context_adapter")?.status ?? "blocked",
      summary: "Maps aesthetic memory into writing_context.aesthetic_memory as read-only preview.",
    },
    {
      key: "revision_context_adapter",
      label: "Revision context",
      value: adapters.find((adapter) => adapter.key === "revision_context_adapter")?.status ?? "missing",
      tone: adapters.find((adapter) => adapter.key === "revision_context_adapter")?.status ?? "blocked",
      summary: "Maps aesthetic memory into revision_context.aesthetic_memory as read-only preview.",
    },
    {
      key: "final_polisher_context_adapter",
      label: "Final polisher context",
      value: adapters.find((adapter) => adapter.key === "final_polisher_context_adapter")?.status ?? "missing",
      tone: adapters.find((adapter) => adapter.key === "final_polisher_context_adapter")?.status ?? "blocked",
      summary: "Maps aesthetic memory into final_polisher_context.aesthetic_memory as read-only preview.",
    },
    {
      key: "reader_response_context_adapter",
      label: "Reader response context",
      value: adapters.find((adapter) => adapter.key === "reader_response_context_adapter")?.status ?? "missing",
      tone: adapters.find((adapter) => adapter.key === "reader_response_context_adapter")?.status ?? "blocked",
      summary: "Maps aesthetic memory into reader_response_context.aesthetic_memory as read-only preview.",
    },
    {
      key: "safety_boundary",
      label: "Safety boundary",
      value: "preview-only",
      tone: "ready",
      summary: "No context mutation, materialized injection, Canon write, active_engine update, MCP registration, or memory file write.",
    },
  ];
}

function previewStatusFor(gate, adapters) {
  if (gate.used !== true || gate.readiness_status === "needs_context") return "needs_context";
  if (!gateAllowsReadOnlyContext(gate)) return "blocked";
  if (adapters.some((adapter) => adapter.status === "blocked")) return "blocked";
  if (gate.readiness_status === "watch" || adapters.some((adapter) => adapter.status === "watch")) return "watch";
  return "ready";
}

function allowedAdapterActions() {
  return [
    {
      key: "read_context_adapter_summary",
      label: "Read context adapter summary",
      allowed: true,
      route: "#aesthetic-memory-context-adapter",
    },
    {
      key: "copy_context_adapter_markdown",
      label: "Copy context adapter markdown preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter",
    },
    {
      key: "inspect_adapter_payload_preview",
      label: "Inspect adapter payload preview",
      allowed: true,
      route: "#aesthetic-memory-context-adapter",
    },
    {
      key: "inspect_source_injection_readiness_gate",
      label: "Inspect source injection readiness gate",
      allowed: true,
      route: "#aesthetic-memory-injection-readiness",
    },
  ];
}

function blockedAdapterCapabilities() {
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
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31B is a read-only context adapter preview, not a context mutation executor.",
  }));
}

function summaryLines(gate, status, adapters) {
  const adapterLine = adapters.map((adapter) => `${adapter.context_path}=${adapter.status}`).join("；");
  return [
    `狀態：${status}`,
    `來源 gate：${text(gate.gate_kind, 140)} / ${text(gate.phase, 40)}`,
    `adapter preview：${adapterLine}`,
    `分數：${Math.round(number(gate.injection_readiness_score, 0))}%`,
    "安全：只讀、只預覽、不生成、不修稿、不保存候選、不審核、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file、不實際修改任何 context",
    "結論：此 adapter preview 只整理下游 context builder 可讀的 payload 形狀，不把 payload 寫入任何 runtime context。",
  ];
}

function markdownFor(preview) {
  return [
    "## Aesthetic Memory Context Adapter Preview",
    "",
    `- phase: ${preview.phase}`,
    `- source_phase: ${preview.source_phase}`,
    `- adapter_kind: ${preview.adapter_kind}`,
    `- adapter_mode: ${preview.adapter_mode}`,
    `- preview_status: ${preview.preview_status}`,
    `- can_preview_adapter_payload: ${preview.can_preview_adapter_payload}`,
    `- will_attach_context_now: ${preview.will_attach_context_now}`,
    `- will_mutate_context: ${preview.will_mutate_context}`,
    `- read_only: ${preview.safety_boundary.read_only}`,
    `- preview_only: ${preview.safety_boundary.preview_only}`,
    `- can_write_canon: ${preview.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${preview.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${preview.safety_boundary.can_register_mcp_tool}`,
    `- memory_file_written: ${preview.no_mutation_snapshot.memory_file_written}`,
    `- context_mutated: ${preview.no_mutation_snapshot.context_mutated}`,
    `- adapter_payload_persisted: ${preview.no_mutation_snapshot.adapter_payload_persisted}`,
    "",
    "### Adapters",
    ...preview.context_adapters.map((adapter) => `- ${adapter.context_path}: ${adapter.status} / payload=${adapter.adapter_payload_key}`),
    "",
    "### ChatGPT Summary",
    ...preview.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryContextAdapterPreview(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedGate = object(
    options.gate
      ?? input.aesthetic_memory_injection_readiness_gate
      ?? input.aestheticMemoryInjectionReadinessGate
      ?? input.injection_readiness_gate
      ?? input.injectionReadinessGate
      ?? input.gate,
  );
  const gate = providedGate.phase === "31A"
    ? providedGate
    : await buildAestheticMemoryInjectionReadinessGate(input, options);
  const adapters = adapterDefinitions().map((definition) => buildAdapter(gate, definition));
  const status = previewStatusFor(gate, adapters);
  const preview = {
    used: gate.used === true,
    phase: "31B",
    version: aestheticMemoryContextAdapterPreviewVersion,
    adapter_kind: "aesthetic_memory_context_adapter_preview",
    adapter_channel: "internal_pipeline_context_adapter",
    adapter_mode: "readonly_context_adapter_preview",
    source_phase: text(gate.phase, 40) || "31A",
    source_version: text(gate.version, 160) || null,
    source_gate_kind: text(gate.gate_kind, 160) || "aesthetic_memory_injection_readiness_gate",
    source_gate_digest: text(gate.gate_digest, 80) || stableDigest(gate),
    preview_status: status,
    can_preview_adapter_payload: status === "ready" || status === "watch",
    will_attach_context_now: false,
    will_mutate_context: false,
    adapter_payload_persisted: false,
    context_adapters: adapters,
    adapter_summary_cards: adapterSummaryCards(adapters, gate),
    chatgpt_summary_lines: summaryLines(gate, status, adapters),
    allowed_adapter_actions: allowedAdapterActions(),
    blocked_adapter_capabilities: blockedAdapterCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_context_adapter_preview" : status === "watch" ? "inspect_context_adapter_warnings" : "repair_injection_readiness_before_adapter",
      label: status === "ready" ? "Review context adapter preview" : status === "watch" ? "Inspect context adapter warnings" : "Repair injection readiness before adapter",
      route: "#aesthetic-memory-context-adapter",
      ui_target: "aesthetic-memory-context-adapter",
      enabled: true,
      reason: status === "ready"
        ? "All context adapter previews are available as read-only payload shapes."
        : status === "watch"
          ? "One or more context adapter previews has a warning but remains read-only attachable."
          : "The injection readiness gate is incomplete or unsafe for context adapter preview.",
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
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_gate_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_gate: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? gate : null,
  };
  preview.adapter_preview_digest = stableDigest({
    adapter_kind: preview.adapter_kind,
    adapter_mode: preview.adapter_mode,
    source_gate_digest: preview.source_gate_digest,
    preview_status: preview.preview_status,
    context_adapters: preview.context_adapters.map((adapter) => ({
      key: adapter.key,
      context_path: adapter.context_path,
      status: adapter.status,
      payload_digest: adapter.adapter_payload_digest,
    })),
    safety_boundary: preview.safety_boundary,
  });
  preview.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(preview);
  return preview;
}

export default buildAestheticMemoryContextAdapterPreview;

