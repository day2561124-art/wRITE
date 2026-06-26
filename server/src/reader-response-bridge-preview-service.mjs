import { createHash } from "node:crypto";
import { buildReaderResponseUiSurface } from "./reader-response-ui-surface-service.mjs";

export const readerResponseBridgePreviewVersion = "reader_response_bridge_preview_v1";

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
        tone: text(entry.tone, 40) || text(entry.type, 40) || "neutral",
      };
    })
    .filter((item) => item.label)
    .slice(0, maximum);
}

function bridgeSections(surface) {
  const questions = sectionByKey(surface, "reader_questions");
  const risks = sectionByKey(surface, "risk_points");
  const suggestions = sectionByKey(surface, "revision_suggestions");
  const safety = sectionByKey(surface, "safety_boundary");
  return [
    {
      key: "bridge_header",
      title: "Bridge header",
      summary: `${text(surface.headline, 160)} · status=${text(surface.status, 80)}`,
      tone: cardToneForStatus(surface.status),
    },
    {
      key: "reader_response_cards",
      title: "Reader response cards",
      summary: "ChatGPT-readable score cards from the UI surface.",
      items: array(surface.overview_cards).map(summarizeCard),
      tone: cardToneForStatus(surface.status),
    },
    {
      key: "reader_questions",
      title: "Reader questions to carry forward",
      summary: object(questions).summary || "Reasonable delayed questions preserved for the next chapter.",
      items: summarizeSectionItems(questions),
      tone: "watch",
    },
    {
      key: "risk_points",
      title: "Reader fatigue or skim risks",
      summary: object(risks).summary || "Reader-facing fatigue points for manual review.",
      items: summarizeSectionItems(risks),
      tone: summarizeSectionItems(risks).length ? "watch" : "ready",
    },
    {
      key: "revision_suggestions",
      title: "Revision suggestions",
      summary: object(suggestions).summary || "Suggestions are read-only and do not rewrite text.",
      items: summarizeSectionItems(suggestions),
      tone: summarizeSectionItems(suggestions).length ? "watch" : "ready",
    },
    {
      key: "safety_boundary",
      title: "Safety boundary",
      summary: object(safety).summary || "Read-only bridge preview; no candidate save, Canon write, active_engine update, or MCP registration.",
      items: summarizeSectionItems(safety, 10),
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
      summary: "Bridge preview reports no runtime UI mutation, no MCP tool addition, and no protected writes.",
      tone: "ready",
    },
  ];
}

function allowedBridgeActions() {
  return [
    {
      key: "read_reader_response_summary",
      label: "Read reader response summary",
      allowed: true,
      route: "#reader-response",
    },
    {
      key: "copy_reader_response_markdown",
      label: "Copy reader response markdown preview",
      allowed: true,
      route: "#reader-response",
    },
    {
      key: "inspect_reader_response_ui_surface",
      label: "Inspect Reader Response UI surface",
      allowed: true,
      route: "#reader-response",
    },
    {
      key: "open_writer_workbench_reader_response_route",
      label: "Open Writer Workbench reader response route",
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
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 29C is a read-only ChatGPT bridge preview contract.",
  }));
}

function chatgptSummaryLines(surface) {
  const cards = new Map(array(surface.overview_cards).map((card) => [object(card).key, object(card)]));
  const lineFor = (key, fallbackLabel) => {
    const card = object(cards.get(key));
    const label = text(card.label, 80) || fallbackLabel;
    const value = text(card.value, 80) || `${Math.round(number(card.score, 0))}%`;
    const tone = text(card.tone, 40) || "neutral";
    return `${label}：${value}（${tone}）`;
  };
  return [
    `狀態：${text(surface.status_badge?.label, 80) || text(surface.status, 80)}`,
    lineFor("reader_response_overall", "讀者體感"),
    lineFor("chapter_turn_satisfaction", "章節推進"),
    lineFor("hook_strength", "章尾鉤子"),
    lineFor("pacing_pressure", "資訊壓力"),
    lineFor("dialogue_tension", "對話張力"),
    lineFor("skim_risk", "跳讀風險"),
    text(surface.summary, 500),
  ].filter(Boolean);
}

function markdownFor(preview) {
  return [
    "## Reader Response Simulator Bridge Preview",
    "",
    `- phase: ${preview.phase}`,
    `- source_phase: ${preview.source_phase}`,
    `- bridge_channel: ${preview.bridge_channel}`,
    `- bridge_mode: ${preview.bridge_mode}`,
    `- preview_status: ${preview.preview_status}`,
    `- overall_reader_response_score: ${preview.overall_reader_response_score}`,
    `- read_only: ${preview.safety_boundary.read_only}`,
    `- preview_only: ${preview.safety_boundary.preview_only}`,
    `- can_write_canon: ${preview.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${preview.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${preview.safety_boundary.can_register_mcp_tool}`,
    "",
    "### ChatGPT Summary",
    ...preview.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildReaderResponseBridgePreview(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedSurface = object(
    options.surface
      ?? input.reader_response_ui_surface
      ?? input.readerResponseUiSurface
      ?? input.ui_surface
      ?? input.uiSurface
      ?? input.surface,
  );
  const surface = providedSurface.phase === "29B"
    ? providedSurface
    : await buildReaderResponseUiSurface(input, options);
  const cards = array(surface.overview_cards).map(summarizeCard);
  const sections = bridgeSections(surface);
  const safety = object(surface.safety);
  const bridgeReadability = {
    status: text(surface.status, 80) || "not_available",
    headline: text(surface.headline, 200),
    summary: text(surface.summary, 700),
    status_badge: object(surface.status_badge),
    overall_reader_response_score: Math.round(number(surface.overall_reader_response_score, 0)),
    card_count: cards.length,
    section_count: sections.length,
  };
  const preview = {
    used: surface.used === true,
    phase: "29C",
    version: readerResponseBridgePreviewVersion,
    bridge_kind: "reader_response_simulator_bridge_preview",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
    bridge_surface: "reader_response_ui_surface_summary",
    source_phase: text(surface.phase, 40) || "29B",
    source_version: text(surface.version, 160) || null,
    source_ui_kind: text(surface.ui_kind, 160) || "reader_response_simulator_ui_surface",
    source_surface_digest: stableDigest({
      phase: surface.phase,
      version: surface.version,
      status: surface.status,
      score: surface.overall_reader_response_score,
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
    bridge_readability: bridgeReadability,
    overall_reader_response_score: bridgeReadability.overall_reader_response_score,
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
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      can_save_candidate: false,
      can_approve: false,
      can_confirm_adoption: false,
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

export default buildReaderResponseBridgePreview;
