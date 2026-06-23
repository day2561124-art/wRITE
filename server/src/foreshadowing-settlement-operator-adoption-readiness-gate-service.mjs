import {
  buildForeshadowingSettlementOperatorReadinessDashboard,
} from "./foreshadowing-settlement-operator-readiness-dashboard-service.mjs";

export const foreshadowingSettlementOperatorAdoptionReadinessGateVersion =
  "foreshadowing_settlement_operator_adoption_readiness_gate_v1";

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

function statusBadge(status, ready = false) {
  if (ready || status === "ready_for_manual_adoption_review") {
    return { label: "manual review ready", class_name: "candidate-status-activated", tone: "ready" };
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

function normalizeLiveUiSmoke(value) {
  const smoke = object(value);
  const status = text(smoke.status ?? smoke.smoke_status ?? smoke.live_ui_smoke_status, 120)
    || (smoke.ok === true ? "passed" : "not_available");
  const phase = text(smoke.phase ?? smoke.smoke_phase, 40) || "not_available";
  const checked = smoke.checked === true
    || smoke.used === true
    || smoke.ok === true
    || phase === "27S"
    || status === "passed";
  const flags = {
    server_started: boolean(smoke.server_started ?? smoke.ui_server_started, false),
    html_readable: boolean(smoke.html_readable ?? smoke.workbench_html_readable, false),
    app_js_readable: boolean(smoke.app_js_readable, false),
    endpoint_readable: boolean(smoke.endpoint_readable ?? smoke.dashboard_api_readable, false),
    dashboard_payload_readable: boolean(smoke.dashboard_payload_readable, false),
    dashboard_block_present: boolean(smoke.dashboard_block_present, false),
    safety_passed: boolean(smoke.safety_passed, false),
    side_effects_absent: boolean(smoke.side_effects_absent ?? smoke.no_side_effects, false),
    no_canon_update: boolean(smoke.no_canon_update, false),
    no_active_engine_update: boolean(smoke.no_active_engine_update, false),
    pending_engine_candidate_created: boolean(smoke.pending_engine_candidate_created, false),
    active_engine_modified: boolean(smoke.active_engine_modified, false),
    canon_modified: boolean(smoke.canon_modified, false),
    compressed_rules_modified: boolean(smoke.compressed_rules_modified, false),
  };
  const ok = smoke.ok === true
    && status === "passed"
    && phase === "27S"
    && flags.server_started
    && flags.html_readable
    && flags.app_js_readable
    && flags.endpoint_readable
    && flags.dashboard_payload_readable
    && flags.dashboard_block_present
    && flags.safety_passed
    && flags.side_effects_absent
    && flags.no_canon_update
    && flags.no_active_engine_update
    && flags.pending_engine_candidate_created === false
    && flags.active_engine_modified === false
    && flags.canon_modified === false
    && flags.compressed_rules_modified === false;

  return {
    checked,
    ok,
    phase,
    status,
    flags,
    raw: smoke,
  };
}

function safetyLocked(dashboard) {
  const safety = object(dashboard.safety);
  return safety.read_only === true
    && safety.preview_only === true
    && safety.no_auto_persist === true
    && safety.no_canon_update === true
    && safety.no_active_engine_update === true
    && safety.bridge_can_approve === false
    && safety.bridge_can_confirm_adoption === false
    && safety.bridge_can_activate_engine === false
    && safety.pending_engine_candidate_created === false
    && safety.active_engine_modified === false
    && safety.canon_modified === false
    && safety.compressed_rules_modified === false
    && safety.ui_can_approve === false
    && safety.ui_can_confirm_adoption === false
    && safety.ui_can_activate_engine === false;
}

function collectBlockingReasons(checks, live) {
  const reasons = [];
  if (!checks.dashboard_loaded) reasons.push("readiness_dashboard_not_loaded");
  if (!checks.dashboard_ready) reasons.push("readiness_dashboard_not_ready");
  if (!checks.phase_lineage_passed) reasons.push("operator_phase_lineage_not_ready");
  if (!checks.handoff_passed) reasons.push("operator_handoff_not_ready");
  if (!checks.chatgpt_surface_passed) reasons.push("chatgpt_surface_not_ready");
  if (!checks.dashboard_safety_passed) reasons.push("dashboard_safety_not_ready");
  if (!checks.read_only_boundary_locked) reasons.push("read_only_boundary_not_locked");
  if (!live.checked) reasons.push("phase27s_live_ui_smoke_missing");
  if (live.checked && live.phase !== "27S") reasons.push("phase27s_live_ui_smoke_wrong_phase");
  if (live.checked && !checks.live_ui_smoke_passed) reasons.push("phase27s_live_ui_smoke_not_ready");
  if (!checks.no_mutation_side_effects) reasons.push("mutation_side_effect_detected");
  if (!checks.operator_actions_available) reasons.push("operator_actions_missing");
  return Array.from(new Set(reasons));
}

function markdownFor(gate) {
  return [
    "## Foreshadowing Settlement Operator Adoption Readiness Gate",
    "",
    "- phase: " + gate.phase,
    "- source_phase: " + gate.source_phase,
    "- gate_status: " + gate.gate_status,
    "- can_enter_manual_adoption_review: " + String(gate.can_enter_manual_adoption_review),
    "- direct_adoption_allowed: " + String(gate.direct_adoption_allowed),
    "- requires_human_approval: " + String(gate.requires_human_approval),
    "- bridge_can_approve: " + String(gate.safety.bridge_can_approve),
    "- bridge_can_confirm_adoption: " + String(gate.safety.bridge_can_confirm_adoption),
    "- bridge_can_activate_engine: " + String(gate.safety.bridge_can_activate_engine),
    "- active_engine_modified: " + String(gate.safety.active_engine_modified),
    "- canon_modified: " + String(gate.safety.canon_modified),
    "",
    "### Blocking Reasons",
    ...(gate.blocking_reasons.length
      ? gate.blocking_reasons.map((reason) => `- ${reason}`)
      : ["- none"]),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorAdoptionReadinessGate(input = {}) {
  const bundle = object(input);
  const providedDashboard = object(bundle.readiness_dashboard ?? bundle.dashboard);
  const dashboard = providedDashboard.phase === "27R"
    ? providedDashboard
    : buildForeshadowingSettlementOperatorReadinessDashboard({
      ...bundle,
      include_raw: boolean(bundle.include_dashboard_raw, false),
      include_markdown: true,
    });
  const live = normalizeLiveUiSmoke(bundle.live_ui_smoke ?? bundle.dashboard_live_ui_smoke ?? bundle.phase27s_live_ui_smoke);
  const integrity = object(dashboard.integrity);
  const dashboardSafety = object(dashboard.safety);
  const checks = {
    dashboard_loaded: dashboard.phase === "27R",
    dashboard_ready: dashboard.ok === true && dashboard.dashboard_status === "ready",
    phase_lineage_passed: integrity.phase_lineage_passed === true,
    handoff_passed: integrity.handoff_passed === true,
    chatgpt_surface_passed: integrity.chatgpt_surface_passed === true,
    dashboard_safety_passed: integrity.safety_passed === true,
    read_only_boundary_locked: safetyLocked(dashboard),
    live_ui_smoke_passed: live.ok === true,
    no_mutation_side_effects: live.flags.side_effects_absent === true
      && live.flags.no_canon_update === true
      && live.flags.no_active_engine_update === true
      && live.flags.pending_engine_candidate_created === false
      && live.flags.active_engine_modified === false
      && live.flags.canon_modified === false
      && live.flags.compressed_rules_modified === false,
    operator_actions_available: array(dashboard.next_operator_actions).length > 0,
  };
  const blockingReasons = collectBlockingReasons(checks, live);
  const ready = blockingReasons.length === 0;
  const gateStatus = ready ? "ready_for_manual_adoption_review" : "blocked";
  const warnings = [
    ...array(dashboard.warnings).map((warning) => text(warning, 240)).filter(Boolean),
    ...(ready ? [] : ["foreshadowing_settlement_operator_adoption_readiness_gate_blocked"]),
  ];

  const gate = {
    ok: ready,
    used: true,
    phase: "27T",
    version: foreshadowingSettlementOperatorAdoptionReadinessGateVersion,
    gate_kind: "foreshadowing_settlement_operator_adoption_readiness_gate",
    source_phase: "27S",
    source_phases: ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q", "27R", "27S"],
    dashboard_phase: text(dashboard.phase, 40) || "not_available",
    dashboard_status: text(dashboard.dashboard_status, 120) || "not_available",
    live_ui_smoke_phase: live.phase,
    live_ui_smoke_status: live.status,
    gate_status: gateStatus,
    decision: gateStatus,
    status_badge: statusBadge(gateStatus, ready),
    can_enter_manual_adoption_review: ready,
    can_enter_adoption_review: ready,
    can_auto_adopt: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    manual_review_only: true,
    summary: ready
      ? "27R dashboard and 27S live UI smoke are ready for manual adoption review. This gate does not approve or adopt anything."
      : "Manual adoption review is blocked until the operator dashboard and live UI smoke are repaired.",
    checks,
    blocking_reasons: blockingReasons,
    cards: [
      card("readiness_dashboard", "27R readiness dashboard", checks.dashboard_ready ? "ready" : "blocked", checks.dashboard_ready ? "ready" : "blocked", `dashboard_status=${text(dashboard.dashboard_status, 120) || "unknown"}`),
      card("live_ui_smoke", "27S live UI smoke", checks.live_ui_smoke_passed ? "passed" : "blocked", checks.live_ui_smoke_passed ? "ready" : "blocked", `phase=${live.phase} · status=${live.status}`),
      card("manual_review", "Manual adoption review", ready ? "allowed to enter" : "blocked", ready ? "ready" : "blocked", "Entry only; no approval, adoption, Canon, or active_engine update is performed."),
      card("safety_boundary", "Safety boundary", checks.read_only_boundary_locked ? "locked" : "failed", checks.read_only_boundary_locked ? "ready" : "blocked", "No approve / no adoption confirmation / no active_engine / no Canon mutation."),
    ],
    next_operator_actions: ready
      ? [
        {
          key: "enter_manual_adoption_review",
          label: "Enter manual foreshadowing settlement adoption review",
          reason: "Gate is ready, but adoption still requires the existing human approval and confirmation flow.",
          route: "#approval",
          ui_target: "approval",
          priority: "primary",
        },
        {
          key: "inspect_readiness_dashboard",
          label: "Inspect operator readiness dashboard before review",
          reason: "Review 27J-27S lineage, dashboard cards, and safety flags before any human approval.",
          route: "#writer-workbench",
          ui_target: "writer-workbench",
          priority: "secondary",
        },
      ]
      : [
        {
          key: "repair_operator_adoption_readiness_gate",
          label: "Repair blocked adoption readiness gate",
          reason: blockingReasons.join(" · ") || "Adoption readiness gate is blocked.",
          route: "#writer-workbench",
          ui_target: "writer-workbench",
          priority: "primary",
        },
      ],
    safety: {
      read_only: true,
      preview_only: true,
      no_auto_persist: true,
      no_canon_update: dashboardSafety.no_canon_update === true,
      no_active_engine_update: dashboardSafety.no_active_engine_update === true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      gate_can_approve: false,
      gate_can_confirm_adoption: false,
      gate_can_activate_engine: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      canon_modified: false,
      compressed_rules_modified: false,
      automatic_adoption_performed: false,
      manual_review_entry_only: true,
    },
    integrity: {
      dashboard_ok: dashboard.ok === true,
      dashboard_status: text(dashboard.dashboard_status, 120),
      live_ui_smoke_ok: live.ok === true,
      phase_lineage_passed: checks.phase_lineage_passed,
      handoff_passed: checks.handoff_passed,
      chatgpt_surface_passed: checks.chatgpt_surface_passed,
      dashboard_safety_passed: checks.dashboard_safety_passed,
      decision_ledger_entries_hash: text(integrity.decision_ledger_entries_hash, 80) || null,
      ledger_ui_entries_hash: text(integrity.ledger_ui_entries_hash, 80) || null,
      bridge_integrity_available: integrity.bridge_integrity_available === true,
    },
    warnings,
    raw_dashboard: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? dashboard : null,
    raw_live_ui_smoke: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? live.raw : null,
  };
  gate.surface_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(gate)
    : "";
  return gate;
}

export default buildForeshadowingSettlementOperatorAdoptionReadinessGate;
