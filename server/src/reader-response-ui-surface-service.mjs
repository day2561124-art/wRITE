import { buildReaderResponseSimulatorReport } from "./reader-response-simulator-service.mjs";

export const readerResponseUiSurfaceVersion = "reader_response_ui_surface_v1";

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

function scoreLabel(score) {
  if (score >= 76) return "強";
  if (score >= 55) return "需注意";
  return "偏弱";
}

function statusFrom(report) {
  const score = number(report.overall_reader_response_score, 0);
  if (report.status !== "completed") return "needs_context";
  if (score >= 76) return "ready";
  if (score >= 55) return "watch";
  return "needs_revision";
}

function statusBadge(status) {
  if (status === "ready") {
    return {
      label: "讀者體感良好",
      class_name: "candidate-status-activated",
      tone: "ready",
    };
  }
  if (status === "watch") {
    return {
      label: "需要注意",
      class_name: "candidate-status-candidate",
      tone: "watch",
    };
  }
  if (status === "needs_context") {
    return {
      label: "缺少上下文",
      class_name: "candidate-status-rejected",
      tone: "empty",
    };
  }
  return {
    label: "建議重寫",
    class_name: "candidate-status-blocked",
    tone: "blocked",
  };
}

function cardTone(tone) {
  if (tone === "safe" || tone === "ready") return "ready";
  if (tone === "watch") return "watch";
  if (tone === "blocked") return "blocked";
  return "neutral";
}

function percentage(score) {
  return `${Math.max(0, Math.min(100, Math.round(number(score, 0))))}%`;
}

function normalizeReportCard(card) {
  const item = object(card);
  return {
    key: text(item.key, 120) || "unknown",
    label: text(item.label, 120) || text(item.title, 120) || "未命名項目",
    title: text(item.title, 160) || text(item.label, 160) || "Untitled card",
    value: percentage(item.score),
    score: Math.round(number(item.score, 0)),
    tone: cardTone(item.tone),
    summary: text(item.summary, 500),
  };
}

function safetyBadges(report) {
  const safety = object(report.safety_boundary);
  const mutation = object(report.no_mutation_snapshot);
  return [
    ["read_only", "只讀", safety.read_only === true, false],
    ["preview_only", "只預覽", safety.preview_only === true, false],
    ["candidate_only", "候選階段", report.candidate_only === true, false],
    ["no_candidate_save", "不保存候選", safety.no_candidate_save === true, false],
    ["can_write_canon", "可寫入正史", safety.can_write_canon === true, true],
    ["can_update_active_engine", "可更新 active_engine", safety.can_update_active_engine === true, true],
    ["can_update_compressed_rules", "可更新 compressed_rules", safety.can_update_compressed_rules === true, true],
    ["runtime_ui_modified", "已改 runtime UI", mutation.runtime_ui_modified === true, true],
    ["mcp_tool_added", "已新增 MCP tool", mutation.mcp_tool_added === true, true],
  ].map(([key, label, value, dangerous]) => ({
    key,
    label,
    value,
    tone: dangerous ? (value ? "blocked" : "ready") : (value ? "ready" : "blocked"),
    allowed: dangerous ? false : value === true,
    denied: dangerous ? value !== true : false,
  }));
}

function humanSummary(report, status) {
  const score = number(report.overall_reader_response_score, 0);
  const pacing = object(report.pacing_pressure);
  const dialogue = object(report.dialogue_tension);
  const hook = object(report.hook_strength);
  const skim = object(report.skim_risk);
  if (status === "needs_context") {
    return "讀者體感報告缺少正文或讀者期待上下文；目前只能當作不完整預覽，不應用來判定章節品質。";
  }
  const parts = [
    `整體讀者體感為${scoreLabel(score)}（${percentage(score)}）`,
    `章尾鉤子${scoreLabel(number(hook.score, 0))}`,
    `對話張力${scoreLabel(number(dialogue.score, 0))}`,
    `資訊壓力${scoreLabel(number(pacing.score, 0))}`,
    `跳讀風險為${text(skim.label, 40) || "unknown"}`,
  ];
  if (status === "ready") {
    return `${parts.join("；")}。這章目前具備可讀推進感，可以進入人工閱讀與後續驗稿。`;
  }
  if (status === "watch") {
    return `${parts.join("；")}。這章可讀，但需要注意疲勞點或資訊密度，建議先看下方黃色項目。`;
  }
  return `${parts.join("；")}。讀者可能感到章節推進不足或跳讀風險偏高，建議先修正文稿再進入後續流程。`;
}

function overviewSections(report) {
  const riskItems = [
    ...array(report.confusion_points).map((item) => ({ type: "confusion", label: text(item, 240) })),
    ...array(report.fatigue_points).map((item) => ({ type: "fatigue", label: text(item, 240) })),
    ...array(object(report.skim_risk).reasons).map((item) => ({ type: "skim_risk", label: text(item, 240) })),
  ].filter((item) => item.label);

  return [
    {
      key: "at_a_glance",
      title: "一眼看懂",
      summary: "把 29A 的分數轉成人類可讀狀態卡。",
      items: array(report.cards).map(normalizeReportCard),
    },
    {
      key: "reader_questions",
      title: "讀者會想追下去的問題",
      summary: "保留合理延遲的疑問，不把它們誤判成錯誤。",
      items: array(report.reader_questions_to_carry_forward).map((item, index) => ({
        key: `question_${index + 1}`,
        label: text(item, 240),
        tone: "watch",
      })),
    },
    {
      key: "risk_points",
      title: "可能讓讀者累或跳讀的地方",
      summary: riskItems.length ? "這些是優先檢查點。" : "目前沒有明顯疲勞或跳讀警訊。",
      items: riskItems,
    },
    {
      key: "revision_suggestions",
      title: "建議修正方向",
      summary: "這些建議只作為人工判斷參考，不會自動重寫正文。",
      items: array(report.revision_suggestions).map((item, index) => ({
        key: `suggestion_${index + 1}`,
        label: text(item, 300),
        tone: "watch",
      })),
    },
    {
      key: "safety_boundary",
      title: "安全邊界",
      summary: "此 UI surface 只顯示讀者體感，不會保存候選、不會寫入正史、不會更新引擎。",
      items: safetyBadges(report),
    },
  ];
}

function nextAction(status) {
  if (status === "ready") {
    return {
      key: "manual_reader_review",
      label: "人工閱讀讀者體感摘要",
      route: "#reader-response",
      ui_target: "reader-response",
      reason: "讀者體感足夠清楚；可由使用者人工判斷是否進入驗稿或修稿。",
      enabled: true,
    };
  }
  if (status === "watch") {
    return {
      key: "inspect_reader_warnings",
      label: "先檢查黃色警訊",
      route: "#reader-response",
      ui_target: "reader-response",
      reason: "報告指出可讀但仍有資訊壓力、對話張力或跳讀風險需要人工確認。",
      enabled: true,
    };
  }
  return {
    key: "revise_candidate_text",
    label: "先修正文稿再重新檢查",
    route: "#writer-workbench",
    ui_target: "writer-workbench",
    reason: "讀者體感不足或上下文不完整；此 surface 不會自動重寫，只提示需要修正。",
    enabled: true,
  };
}

function markdownFor(surface) {
  return [
    "## Reader Response Simulator UI Surface",
    "",
    `- phase: ${surface.phase}`,
    `- source_phase: ${surface.source_phase}`,
    `- status: ${surface.status}`,
    `- headline: ${surface.headline}`,
    `- overall_reader_response_score: ${surface.overall_reader_response_score}`,
    `- read_only: ${surface.safety.read_only}`,
    `- preview_only: ${surface.safety.preview_only}`,
    `- can_write_canon: ${surface.safety.can_write_canon}`,
    `- can_update_active_engine: ${surface.safety.can_update_active_engine}`,
    "",
    "### Cards",
    ...surface.overview_cards.map((card) => `- ${card.label}: ${card.value} (${card.tone})`),
    "",
  ].join("\n");
}

export async function buildReaderResponseUiSurface(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedReport = object(options.report ?? input.reader_response_report ?? input.readerResponseReport ?? input.report);
  const report = providedReport.phase === "29A"
    ? providedReport
    : await buildReaderResponseSimulatorReport(input, options);
  const status = statusFrom(report);
  const badge = statusBadge(status);
  const sections = overviewSections(report);
  const overviewCards = array(report.cards).map(normalizeReportCard);
  const safety = object(report.safety_boundary);
  const mutation = object(report.no_mutation_snapshot);
  const surface = {
    used: report.used === true,
    phase: "29B",
    version: readerResponseUiSurfaceVersion,
    ui_kind: "reader_response_simulator_ui_surface",
    source_phase: text(report.phase, 40) || "29A",
    source_version: text(report.version, 160) || null,
    status,
    status_badge: badge,
    headline: status === "ready"
      ? "讀者體感可以閱讀"
      : status === "watch"
        ? "讀者體感需要注意"
        : status === "needs_context"
          ? "讀者體感缺少上下文"
          : "讀者體感建議先重寫",
    summary: humanSummary(report, status),
    overall_reader_response_score: Math.round(number(report.overall_reader_response_score, 0)),
    overview_cards: overviewCards,
    sections,
    next_operator_action: nextAction(status),
    safety_badges: safetyBadges(report),
    safety: {
      read_only: true,
      preview_only: true,
      candidate_only: report.candidate_only === true,
      no_auto_persist: report.no_auto_persist === true,
      no_generation: report.no_generation === true,
      no_candidate_save: report.no_candidate_save === true,
      no_approval: report.no_approval === true,
      no_canon_update: report.no_canon_update === true,
      no_active_engine_update: report.no_active_engine_update === true,
      no_compressed_rules_update: report.no_compressed_rules_update === true,
      can_write_canon: safety.can_write_canon === true,
      can_update_active_engine: safety.can_update_active_engine === true,
      can_update_compressed_rules: safety.can_update_compressed_rules === true,
      can_modify_runtime_ui: safety.can_modify_runtime_ui === true,
      can_register_mcp_tool: safety.can_register_mcp_tool === true,
      active_engine_modified: mutation.active_engine_modified === true,
      compressed_rules_modified: mutation.compressed_rules_modified === true,
      candidate_saved: mutation.candidate_saved === true,
      canon_written: mutation.canon_written === true,
      runtime_ui_modified: mutation.runtime_ui_modified === true,
      mcp_tool_added: mutation.mcp_tool_added === true,
    },
    raw_report: options.include_raw === true || input.include_raw === true || input.includeRaw === true ? report : null,
  };
  surface.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(surface);
  return surface;
}

export default buildReaderResponseUiSurface;
