import {
  buildForeshadowingSettlementOperatorFullBridgeSmoke,
} from "./foreshadowing-settlement-operator-full-bridge-smoke-service.mjs";

export const foreshadowingSettlementOperatorReadinessDashboardVersion =
  "foreshadowing_settlement_operator_readiness_dashboard_v1";

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

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function statusBadge(status, ok = false) {
  if (ok || status === "ready" || status === "passed") {
    return { label: "ready", class_name: "candidate-status-activated", tone: "ready" };
  }
  if (status === "warning") {
    return { label: "warning", class_name: "candidate-status-rejected", tone: "warning" };
  }
  if (status === "not_loaded" || status === "not_available") {
    return { label: "not loaded", class_name: "candidate-status-rejected", tone: "empty" };
  }
  return { label: "blocked", class_name: "candidate-status-blocked", tone: "blocked" };
}

function card(key, title, value, tone, summary = "") {
  return {
    key,
    title,
    value: text(String(value ?? ""), 240),
    tone,
    summary: text(summary, 500),
  };
}

function stageCards(smoke) {
  return array(object(smoke.chain).stages).map((stage) => ({
    key: text(stage.key, 120),
    title: text(stage.label, 200) || text(stage.key, 120),
    phase: text(stage.phase, 40) || "not_available",
    expected_phase: text(stage.expected_phase, 40) || "not_available",
    status: text(stage.status, 160),
    passed: stage.passed === true,
    tone: stage.passed === true ? "ready" : "blocked",
    summary: [
      `phase=${text(stage.phase, 40) || "none"}`,
      `expected=${text(stage.expected_phase, 40) || "none"}`,
      `status=${text(stage.status, 160) || "unknown"}`,
      stage.tool_name ? `tool=${text(stage.tool_name, 240)}` : "",
      Number.isInteger(stage.entry_count) ? `entries=${stage.entry_count}` : "",
      Number.isInteger(stage.row_count) ? `rows=${stage.row_count}` : "",
    ].filter(Boolean).join(" · "),
  }));
}

function handoffCards(smoke) {
  const handoff = object(smoke.operator_handoff);
  return [
    ["review_panel", "Review panel"],
    ["handoff_packet", "Handoff packet"],
    ["audit_receipt", "Audit receipt"],
    ["decision_ledger", "Decision ledger"],
    ["ledger_ui", "Ledger UI"],
    ["bridge_surface", "Bridge surface"],
  ].map(([key, label]) => ({
    key,
    title: label,
    value: handoff[key] === true ? "connected" : "missing",
    tone: handoff[key] === true ? "ready" : "blocked",
    passed: handoff[key] === true,
  }));
}

function chatgptSurfaceCards(smoke) {
  const surface = object(smoke.chatgpt_surface);
  return [
    card(
      "tool_name",
      "ChatGPT bridge tool",
      surface.tool_name || "not_available",
      surface.tool_name ? "ready" : "blocked",
      `bridge_surface=${text(surface.bridge_surface, 120) || "none"} · content_type=${text(surface.content_type, 120) || "none"}`,
    ),
    card(
      "rows",
      "Rows returned",
      `${integer(surface.rows_returned, 0)} / ${integer(surface.row_count, 0)}`,
      integer(surface.rows_returned, 0) > 0 ? "ready" : "blocked",
      "Operator ledger rows visible to ChatGPT read-only surface.",
    ),
    card(
      "safety_badges",
      "Safety badges",
      surface.has_safety_badges === true ? "available" : "missing",
      surface.has_safety_badges === true ? "ready" : "blocked",
      "Surface should expose read-only / no Canon / no active_engine badges.",
    ),
    card(
      "next_operator_actions",
      "Next operator actions",
      surface.has_next_operator_actions === true ? "available" : "missing",
      surface.has_next_operator_actions === true ? "ready" : "blocked",
      "Surface should expose follow-up operator routes.",
    ),
    card(
      "integrity",
      "Integrity payload",
      surface.has_integrity === true ? "available" : "missing",
      surface.has_integrity === true ? "ready" : "blocked",
      "Bridge response should include hashes or traceable integrity metadata.",
    ),
  ];
}

function nextOperatorActions(smoke) {
  if (smoke.ok === true) {
    return [
      {
        key: "inspect_operator_chain",
        label: "Inspect full operator bridge readiness in Workbench",
        reason: "27J-27P lineage, handoff, ChatGPT surface, and safety boundary passed.",
        route: "#writer-workbench",
        ui_target: "writer-workbench",
        priority: "primary",
      },
      {
        key: "continue_manual_review",
        label: "Continue manual foreshadowing settlement review",
        reason: "Dashboard is read-only; approval and adoption still require existing gated flows.",
        route: "#approval",
        ui_target: "approval",
        priority: "secondary",
      },
    ];
  }

  const warnings = array(smoke.warnings).map((warning) => text(warning, 240)).filter(Boolean);
  return [
    {
      key: "repair_operator_chain",
      label: "Repair blocked foreshadowing settlement operator chain",
      reason: warnings.join(" · ") || "Full bridge smoke did not pass.",
      route: "#writer-workbench",
      ui_target: "writer-workbench",
      priority: "primary",
    },
  ];
}

function markdownFor(dashboard) {
  return [
    "## Foreshadowing Settlement Operator Readiness Dashboard",
    "",
    "- phase: " + dashboard.phase,
    "- source_phase: " + dashboard.source_phase,
    "- dashboard_status: " + dashboard.dashboard_status,
    "- read_only: " + String(dashboard.safety.read_only),
    "- no_canon_update: " + String(dashboard.safety.no_canon_update),
    "- no_active_engine_update: " + String(dashboard.safety.no_active_engine_update),
    "- bridge_can_approve: " + String(dashboard.safety.bridge_can_approve),
    "- bridge_can_confirm_adoption: " + String(dashboard.safety.bridge_can_confirm_adoption),
    "- bridge_can_activate_engine: " + String(dashboard.safety.bridge_can_activate_engine),
    "- pending_engine_candidate_created: " + String(dashboard.safety.pending_engine_candidate_created),
    "- active_engine_modified: " + String(dashboard.safety.active_engine_modified),
    "- canon_modified: " + String(dashboard.safety.canon_modified),
    "",
    "### Stage Cards",
    ...dashboard.stage_cards.map((stage) => (
      `- ${stage.key}: ${stage.phase}/${stage.expected_phase}; passed=${stage.passed}; status=${stage.status}`
    )),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorReadinessDashboard(input = {}) {
  const bundle = object(input);
  const providedSmoke = object(bundle.full_bridge_smoke ?? bundle.smoke ?? bundle.fullBridgeSmoke);
  const smoke = providedSmoke.phase === "27Q"
    ? providedSmoke
    : buildForeshadowingSettlementOperatorFullBridgeSmoke({
      ...bundle,
      operator_review_panel: bundle.operator_review_panel ?? bundle.operator_panel,
      include_raw: boolean(bundle.include_raw ?? bundle.includeRaw, false),
      include_markdown: true,
    });
  const badge = statusBadge(smoke.smoke_status, smoke.ok === true);
  const safety = object(smoke.safety_boundary);
  const stages = stageCards(smoke);
  const handoff = handoffCards(smoke);
  const chatgpt = chatgptSurfaceCards(smoke);
  const warnings = [
    ...array(smoke.warnings).map((warning) => text(warning, 240)).filter(Boolean),
    ...(smoke.ok === true ? [] : ["foreshadowing_settlement_operator_readiness_dashboard_smoke_failed"]),
  ];

  const dashboard = {
    ok: smoke.ok === true,
    used: smoke.used === true,
    phase: "27R",
    version: foreshadowingSettlementOperatorReadinessDashboardVersion,
    dashboard_kind: "foreshadowing_settlement_operator_readiness_dashboard",
    source_phase: "27Q",
    source_phases: ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q"],
    smoke_phase: text(smoke.smoke_phase, 40) || "27Q",
    full_bridge_smoke_version: text(smoke.version, 240),
    settlement_context_id: text(smoke.settlement_context_id, 240) || null,
    approval_item_id: text(smoke.approval_item_id, 240) || null,
    dashboard_status: smoke.ok === true ? "ready" : "blocked",
    status_badge: badge,
    headline: smoke.ok === true
      ? "Foreshadowing settlement operator bridge is ready"
      : "Foreshadowing settlement operator bridge needs review",
    summary: smoke.ok === true
      ? "27J-27P operator lineage, handoff, ChatGPT read-only surface, and safety boundary are connected."
      : "One or more operator bridge readiness checks failed. Review warnings and stage cards before continuing.",
    cards: [
      card("full_bridge_smoke", "27Q full bridge smoke", smoke.smoke_status, smoke.ok === true ? "ready" : "blocked", `source_phase=${text(smoke.phase, 40)}`),
      card("phase_lineage", "Phase lineage", object(smoke.chain).phase_lineage_passed === true ? "passed" : "failed", object(smoke.chain).phase_lineage_passed === true ? "ready" : "blocked", `${stages.filter((stage) => stage.passed).length}/${stages.length} stages passed`),
      card("handoff_continuity", "Operator handoff", object(smoke.operator_handoff).passed === true ? "connected" : "incomplete", object(smoke.operator_handoff).passed === true ? "ready" : "blocked", `${handoff.filter((item) => item.passed).length}/${handoff.length} handoff segments connected`),
      card("chatgpt_surface", "ChatGPT read-only surface", object(smoke.chatgpt_surface).passed === true ? "readable" : "incomplete", object(smoke.chatgpt_surface).passed === true ? "ready" : "blocked", `rows=${integer(object(smoke.chatgpt_surface).rows_returned, 0)} / ${integer(object(smoke.chatgpt_surface).row_count, 0)}`),
      card("safety_boundary", "Safety boundary", safety.passed === true ? "locked" : "failed", safety.passed === true ? "ready" : "blocked", "No approve / no adoption confirmation / no active_engine / no Canon mutation."),
    ],
    stage_cards: stages,
    handoff_cards: handoff,
    chatgpt_surface_cards: chatgpt,
    next_operator_actions: nextOperatorActions(smoke),
    safety: {
      read_only: true,
      preview_only: true,
      no_auto_persist: true,
      no_canon_update: safety.no_canon_update === true,
      no_active_engine_update: safety.no_active_engine_update === true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      canon_modified: false,
      compressed_rules_modified: false,
      ui_can_approve: false,
      ui_can_confirm_adoption: false,
      ui_can_activate_engine: false,
    },
    integrity: {
      smoke_ok: smoke.ok === true,
      smoke_status: text(smoke.smoke_status, 120),
      phase_lineage_passed: object(smoke.chain).phase_lineage_passed === true,
      handoff_passed: object(smoke.operator_handoff).passed === true,
      safety_passed: safety.passed === true,
      chatgpt_surface_passed: object(smoke.chatgpt_surface).passed === true,
      decision_ledger_entries_hash: text(object(smoke.integrity).decision_ledger_entries_hash, 80) || null,
      ledger_ui_entries_hash: text(object(smoke.integrity).ledger_ui_entries_hash, 80) || null,
      bridge_integrity_available: object(smoke.integrity).bridge_integrity_available === true,
    },
    warnings,
    raw_smoke: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? smoke : null,
  };
  dashboard.surface_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(dashboard)
    : "";
  return dashboard;
}

export default buildForeshadowingSettlementOperatorReadinessDashboard;
