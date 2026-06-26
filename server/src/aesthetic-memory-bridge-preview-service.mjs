import { createHash } from "node:crypto";
import { buildAestheticMemoryUiSurface } from "./aesthetic-memory-ui-surface-service.mjs";

export const aestheticMemoryBridgePreviewVersion = "aesthetic_memory_bridge_preview_v1";

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

function cardToneForStatus(status) {
  if (status === "ready") return "ready";
  if (status === "watch") return "watch";
  if (status === "needs_context") return "empty";
  return "blocked";
}

function summarizeCard(card) {
  const item = object(card);
  return {
    key: text(item.key, 120) || "unknown",
    label: text(item.label, 120) || text(item.title, 120) || "未命名項目",
    value: text(item.value, 80) || `${Math.round(number(item.score, 0))}%`,
    score: Math.round(number(item.score, 0)),
    tone: text(item.tone, 40) || "neutral",
    summary: text(item.summary, 360),
  };
}

function sectionByKey(surface, key) {
  return array(surface.sections).find((section) => object(section).key === key) ?? null;
}

function summarizeSectionItems(section, maximum = 6) {
  return array(object(section).items)
    .map((item) => {
      const entry = object(item);
      return {
        key: text(entry.key, 120) || text(entry.type, 120) || "item",
        label: text(entry.label, 260) || text(entry.summary, 260) || text(entry.value, 260),
        value: text(entry.value, 120),
        tone: text(entry.tone, 40) || text(entry.type, 40) || "neutral",
        rule: text(entry.rule, 360),
      };
    })
    .filter((item) => item.label)
    .slice(0, maximum);
}

function labelsFromSection(surface, key, maximum = 4) {
  return summarizeSectionItems(sectionByKey(surface, key), maximum)
    .map((item) => item.label)
    .filter(Boolean);
}

function bridgeSections(surface) {
  const forbidden = sectionByKey(surface, "forbidden_patterns");
  const preferred = sectionByKey(surface, "preferred_patterns");
  const required = sectionByKey(surface, "required_principles");
  const coverage = sectionByKey(surface, "coverage");
  const provider = sectionByKey(surface, "provider_usage");
  const safety = sectionByKey(surface, "safety_boundary");
  return [
    {
      key: "bridge_header",
      title: "Bridge header",
      summary: `${text(surface.headline, 160)} · status=${text(surface.status, 80)}`,
      tone: cardToneForStatus(surface.status),
    },
    {
      key: "aesthetic_memory_cards",
      title: "Aesthetic memory cards",
      summary: "ChatGPT-readable aesthetic memory cards from the UI surface.",
      items: array(surface.overview_cards).map(summarizeCard),
      tone: cardToneForStatus(surface.status),
    },
    {
      key: "forbidden_patterns",
      title: "Forbidden patterns",
      summary: object(forbidden).summary || "Patterns ChatGPT should actively avoid.",
      items: summarizeSectionItems(forbidden),
      tone: summarizeSectionItems(forbidden).length ? "blocked" : "ready",
    },
    {
      key: "preferred_patterns",
      title: "Preferred patterns",
      summary: object(preferred).summary || "Patterns ChatGPT should move toward while writing or revising.",
      items: summarizeSectionItems(preferred),
      tone: summarizeSectionItems(preferred).length ? "ready" : "watch",
    },
    {
      key: "required_principles",
      title: "Required principles",
      summary: object(required).summary || "Required aesthetic principles for generation, revision, proofing, and final polish.",
      items: summarizeSectionItems(required),
      tone: summarizeSectionItems(required).length ? "ready" : "watch",
    },
    {
      key: "coverage",
      title: "Coverage",
      summary: object(coverage).summary || "Required aesthetic coverage state for operator review.",
      items: summarizeSectionItems(coverage, 10),
      tone: array(object(surface.coverage_summary).missing_categories).length ? "watch" : "ready",
    },
    {
      key: "provider_usage",
      title: "Provider usage",
      summary: object(provider).summary || "Aesthetic memory payload keys for downstream read-only use.",
      items: summarizeSectionItems(provider, 8),
      tone: "ready",
    },
    {
      key: "safety_boundary",
      title: "Safety boundary",
      summary: object(safety).summary || "Read-only bridge preview; no candidate save, Canon write, active_engine update, MCP registration, or memory file write.",
      items: summarizeSectionItems(safety, 12),
      tone: "ready",
    },
    {
      key: "raw_json_preview",
      title: "Raw JSON preview",
      summary: "Raw UI surface can be included only when include_raw is explicitly true.",
      visible_by_default: false,
      tone: "neutral",
    },
    {
      key: "no_mutation_snapshot",
      title: "No mutation snapshot",
      summary: "Bridge preview reports no runtime UI mutation, no MCP tool addition, no memory file write, and no protected writes.",
      tone: "ready",
    },
  ];
}

function allowedBridgeActions() {
  return [
    {
      key: "read_aesthetic_memory_summary",
      label: "Read aesthetic memory summary",
      allowed: true,
      route: "#aesthetic-memory",
    },
    {
      key: "copy_aesthetic_memory_markdown",
      label: "Copy aesthetic memory markdown preview",
      allowed: true,
      route: "#aesthetic-memory",
    },
    {
      key: "inspect_aesthetic_memory_ui_surface",
      label: "Inspect Aesthetic Memory UI surface",
      allowed: true,
      route: "#aesthetic-memory",
    },
    {
      key: "open_writer_workbench_aesthetic_memory_route",
      label: "Open Writer Workbench aesthetic memory route",
      allowed: true,
      route: "#writer-workbench",
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
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 30C is a read-only ChatGPT bridge preview contract.",
  }));
}

function lineForCard(cards, key, fallbackLabel) {
  const card = object(cards.get(key));
  const label = text(card.label, 80) || fallbackLabel;
  const value = text(card.value, 80) || `${Math.round(number(card.score, 0))}%`;
  const tone = text(card.tone, 40) || "neutral";
  return `${label}：${value}（${tone}）`;
}

function chatgptSummaryLines(surface) {
  const cards = new Map(array(surface.overview_cards).map((card) => [object(card).key, object(card)]));
  const forbidden = labelsFromSection(surface, "forbidden_patterns", 4);
  const preferred = labelsFromSection(surface, "preferred_patterns", 4);
  const required = labelsFromSection(surface, "required_principles", 4);
  const missing = array(object(surface.coverage_summary).missing_categories).map((item) => text(item, 80)).filter(Boolean);
  return [
    `狀態：${text(surface.status_badge?.label, 80) || text(surface.status, 80)}`,
    lineForCard(cards, "aesthetic_memory_overall", "審美記憶"),
    lineForCard(cards, "positive_preferences", "偏好／必守"),
    lineForCard(cards, "avoidance_rules", "禁止"),
    lineForCard(cards, "coverage_categories", "覆蓋"),
    forbidden.length ? `禁止：${forbidden.join("、")}` : "禁止：未提供明確禁忌項目",
    preferred.length ? `偏好：${preferred.join("、")}` : "偏好：未提供明確偏好項目",
    required.length ? `必守：${required.join("、")}` : "必守：未提供必守原則",
    missing.length ? `覆蓋缺口：${missing.join("、")}` : "覆蓋：必要審美分類完整",
    "安全：只讀、只預覽、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file",
    text(surface.summary, 500),
  ].filter(Boolean);
}

function markdownFor(preview) {
  return [
    "## Aesthetic Memory Bridge Preview",
    "",
    `- phase: ${preview.phase}`,
    `- source_phase: ${preview.source_phase}`,
    `- bridge_channel: ${preview.bridge_channel}`,
    `- bridge_mode: ${preview.bridge_mode}`,
    `- preview_status: ${preview.preview_status}`,
    `- aesthetic_memory_score: ${preview.aesthetic_memory_score}`,
    `- read_only: ${preview.safety_boundary.read_only}`,
    `- preview_only: ${preview.safety_boundary.preview_only}`,
    `- can_write_canon: ${preview.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${preview.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${preview.safety_boundary.can_register_mcp_tool}`,
    `- memory_file_written: ${preview.no_mutation_snapshot.memory_file_written}`,
    "",
    "### ChatGPT Summary",
    ...preview.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryBridgePreview(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedSurface = object(
    options.surface
      ?? input.aesthetic_memory_ui_surface
      ?? input.aestheticMemoryUiSurface
      ?? input.ui_surface
      ?? input.uiSurface
      ?? input.surface,
  );
  const surface = providedSurface.phase === "30B"
    ? providedSurface
    : await buildAestheticMemoryUiSurface(input, options);
  const cards = array(surface.overview_cards).map(summarizeCard);
  const sections = bridgeSections(surface);
  const safety = object(surface.safety);
  const bridgeReadability = {
    status: text(surface.status, 80) || "not_available",
    headline: text(surface.headline, 200),
    summary: text(surface.summary, 700),
    status_badge: object(surface.status_badge),
    aesthetic_memory_score: Math.round(number(surface.aesthetic_memory_score, 0)),
    card_count: cards.length,
    section_count: sections.length,
  };
  const preview = {
    used: surface.used === true,
    phase: "30C",
    version: aestheticMemoryBridgePreviewVersion,
    bridge_kind: "aesthetic_memory_bridge_preview",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
    bridge_surface: "aesthetic_memory_ui_surface_summary",
    source_phase: text(surface.phase, 40) || "30B",
    source_version: text(surface.version, 160) || null,
    source_ui_kind: text(surface.ui_kind, 160) || "aesthetic_memory_registry_ui_surface",
    source_surface_digest: stableDigest({
      phase: surface.phase,
      version: surface.version,
      status: surface.status,
      score: surface.aesthetic_memory_score,
      overview_cards: surface.overview_cards,
      sections: surface.sections,
      safety: surface.safety,
    }),
    preview_status: text(surface.status, 80) || "not_available",
    status_badge: object(surface.status_badge),
    read_only: true,
    preview_only: true,
    candidate_only: safety.candidate_only === true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_runtime_ui_mutation: true,
    no_mcp_tool_added: true,
    no_memory_file_write: true,
    bridge_readability: bridgeReadability,
    aesthetic_memory_score: bridgeReadability.aesthetic_memory_score,
    chatgpt_summary_lines: chatgptSummaryLines(surface),
    overview_cards: cards,
    bridge_sections: sections,
    allowed_bridge_actions: allowedBridgeActions(),
    blocked_bridge_capabilities: blockedBridgeCapabilities(),
    next_operator_action: object(surface.next_operator_action),
    safety_boundary: {
      read_only: true,
      preview_only: true,
      candidate_only: safety.candidate_only === true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      no_canon_update: true,
      no_active_engine_update: true,
      no_compressed_rules_update: true,
      no_runtime_ui_mutation: true,
      no_mcp_tool_added: true,
      no_memory_file_write: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      can_save_candidate: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_write_memory_file: false,
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
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_surface_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_surface: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? surface : null,
  };
  preview.bridge_preview_digest = stableDigest({
    bridge_kind: preview.bridge_kind,
    bridge_channel: preview.bridge_channel,
    bridge_mode: preview.bridge_mode,
    source_surface_digest: preview.source_surface_digest,
    chatgpt_summary_lines: preview.chatgpt_summary_lines,
    safety_boundary: preview.safety_boundary,
  });
  preview.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(preview);
  return preview;
}

export default buildAestheticMemoryBridgePreview;

