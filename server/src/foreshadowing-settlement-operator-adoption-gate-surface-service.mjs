import {
  buildForeshadowingSettlementOperatorAdoptionReadinessGate,
} from "./foreshadowing-settlement-operator-adoption-readiness-gate-service.mjs";

export const foreshadowingSettlementOperatorAdoptionGateSurfaceVersion =
  "foreshadowing_settlement_operator_adoption_gate_surface_v1";

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
  if (ready || status === "ready_for_manual_review_entry") {
    return { label: "manual review entry ready", class_name: "candidate-status-activated", tone: "ready" };
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

function safetyBadge(key, label, value, summary = "") {
  return {
    key,
    label,
    value: Boolean(value),
    tone: value ? "ready" : "blocked",
    summary: text(summary, 500),
  };
}

function normalizeGate(input) {
  const bundle = object(input);
  const providedGate = object(bundle.adoption_gate ?? bundle.gate ?? bundle.adoption_readiness_gate);
  if (providedGate.phase === "27T") return providedGate;
  return buildForeshadowingSettlementOperatorAdoptionReadinessGate({
    ...bundle,
    include_raw: false,
    include_markdown: true,
  });
}

function safetyLocked(safety) {
  return safety.read_only === true
    && safety.preview_only === true
    && safety.no_auto_persist === true
    && safety.no_canon_update === true
    && safety.no_active_engine_update === true
    && safety.bridge_can_approve === false
    && safety.bridge_can_confirm_adoption === false
    && safety.bridge_can_activate_engine === false
    && safety.gate_can_approve === false
    && safety.gate_can_confirm_adoption === false
    && safety.gate_can_activate_engine === false
    && safety.pending_engine_candidate_created === false
    && safety.active_engine_modified === false
    && safety.canon_modified === false
    && safety.compressed_rules_modified === false
    && safety.automatic_adoption_performed === false;
}

function markdownFor(surface) {
  return [
    "## Foreshadowing Settlement Operator Adoption Gate Surface",
    "",
    "- phase: " + surface.phase,
    "- source_phase: " + surface.source_phase,
    "- bridge_surface_status: " + surface.bridge_surface_status,
    "- gate_status: " + surface.gate_status,
    "- can_enter_manual_adoption_review: " + String(surface.can_enter_manual_adoption_review),
    "- direct_adoption_allowed: " + String(surface.direct_adoption_allowed),
    "- automatic_settlement_allowed: " + String(surface.automatic_settlement_allowed),
    "- bridge_can_approve: " + String(surface.safety.bridge_can_approve),
    "- bridge_can_confirm_adoption: " + String(surface.safety.bridge_can_confirm_adoption),
    "- bridge_can_activate_engine: " + String(surface.safety.bridge_can_activate_engine),
    "- active_engine_modified: " + String(surface.safety.active_engine_modified),
    "- canon_modified: " + String(surface.safety.canon_modified),
    "",
    "### Blocking Reasons",
    ...(surface.blocking_reasons.length
      ? surface.blocking_reasons.map((reason) => `- ${reason}`)
      : ["- none"]),
    "",
    "### Next Operator Actions",
    ...(surface.next_operator_actions.length
      ? surface.next_operator_actions.map((action) => `- ${action.key}: ${action.label}`)
      : ["- none"]),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorAdoptionGateSurface(input = {}) {
  const bundle = object(input);
  const gate = normalizeGate(bundle);
  const safety = object(gate.safety);
  const blockingReasons = array(gate.blocking_reasons)
    .map((reason) => text(reason, 240))
    .filter(Boolean);
  const nextOperatorActions = array(gate.next_operator_actions).map((action) => ({
    key: text(action?.key, 120) || "operator_action",
    label: text(action?.label, 240) || "Review adoption gate",
    reason: text(action?.reason, 500),
    route: text(action?.route, 120) || "#writer-workbench",
    ui_target: text(action?.ui_target, 80) || String(action?.route ?? "#writer-workbench").replace(/^#/u, ""),
    priority: text(action?.priority, 80) || "secondary",
  }));

  const gateLoaded = gate.phase === "27T";
  const gateSafetyLocked = safetyLocked(safety);
  const decisionReadable = Boolean(text(gate.decision ?? gate.gate_status, 160));
  const ready = gateLoaded
    && gate.ok === true
    && gate.can_enter_manual_adoption_review === true
    && gate.can_auto_adopt === false
    && gate.direct_adoption_allowed === false
    && gate.automatic_settlement_allowed === false
    && gateSafetyLocked
    && decisionReadable
    && nextOperatorActions.length > 0;

  const bridgeSurfaceStatus = ready ? "ready_for_manual_review_entry" : "blocked";
  const gateStatus = text(gate.gate_status ?? gate.decision, 160) || "not_available";
  const checks = {
    gate_loaded: gateLoaded,
    gate_ready: gate.ok === true,
    decision_readable: decisionReadable,
    blocking_reasons_readable: Array.isArray(gate.blocking_reasons),
    next_operator_actions_readable: Array.isArray(gate.next_operator_actions),
    safety_badges_readable: gateSafetyLocked,
    no_direct_adoption: gate.direct_adoption_allowed === false && gate.can_auto_adopt === false,
    no_automatic_settlement: gate.automatic_settlement_allowed === false,
    no_mutation_side_effects: safety.pending_engine_candidate_created === false
      && safety.active_engine_modified === false
      && safety.canon_modified === false
      && safety.compressed_rules_modified === false
      && safety.automatic_adoption_performed === false,
  };

  const surface = {
    ok: ready,
    used: true,
    phase: "27U",
    version: foreshadowingSettlementOperatorAdoptionGateSurfaceVersion,
    surface_kind: "foreshadowing_settlement_operator_adoption_gate_ui_bridge_surface",
    source_phase: "27T",
    source_phases: ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q", "27R", "27S", "27T"],
    gate_phase: text(gate.phase, 40) || "not_available",
    gate_status: gateStatus,
    gate_decision: text(gate.decision, 160) || gateStatus,
    bridge_surface_status: bridgeSurfaceStatus,
    decision: bridgeSurfaceStatus,
    status_badge: statusBadge(bridgeSurfaceStatus, ready),
    can_enter_manual_adoption_review: ready,
    can_enter_adoption_review: ready,
    can_auto_adopt: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    manual_review_only: true,
    headline: ready
      ? "Foreshadowing settlement adoption gate is ready for manual review entry"
      : "Foreshadowing settlement adoption gate is blocked",
    summary: ready
      ? "The read-only bridge surface can route the operator to manual review. It does not approve, adopt, settle, or modify Canon."
      : "Manual review entry is blocked until the gate readiness issues are repaired.",
    checks,
    blocking_reasons: blockingReasons,
    cards: [
      card("gate_decision", "27T gate decision", gateStatus, ready ? "ready" : "blocked", `gate_phase=${text(gate.phase, 40) || "unknown"}`),
      card("manual_review_entry", "Manual review entry", ready ? "allowed" : "blocked", ready ? "ready" : "blocked", "Entry only; no approval, adoption, settlement, Canon, or active_engine update is performed."),
      card("blocking_reasons", "Blocking reasons", String(blockingReasons.length), blockingReasons.length ? "blocked" : "ready", blockingReasons.join(" 繚 ") || "none"),
      card("safety_boundary", "Safety boundary", gateSafetyLocked ? "locked" : "failed", gateSafetyLocked ? "ready" : "blocked", "Read-only / preview-only / no bridge approval / no active_engine / no Canon mutation."),
    ],
    safety_badges: [
      safetyBadge("read_only", "Read-only", safety.read_only === true, "Surface only displays gate data."),
      safetyBadge("preview_only", "Preview-only", safety.preview_only === true, "No persistence is performed."),
      safetyBadge("no_canon_update", "No Canon update", safety.no_canon_update === true, "Canon DB remains unchanged."),
      safetyBadge("no_active_engine_update", "No active_engine update", safety.no_active_engine_update === true, "active_engine remains unchanged."),
      safetyBadge("no_bridge_approval", "No bridge approval", safety.bridge_can_approve === false, "ChatGPT bridge cannot approve."),
      safetyBadge("no_confirm_adoption", "No adoption confirmation", safety.bridge_can_confirm_adoption === false, "Bridge cannot confirm adoption."),
      safetyBadge("no_activate_engine", "No engine activation", safety.bridge_can_activate_engine === false, "Bridge cannot activate engine."),
      safetyBadge("no_auto_adoption", "No automatic adoption", safety.automatic_adoption_performed === false, "No adoption is performed."),
    ],
    next_operator_actions: nextOperatorActions,
    bridge_readability: {
      gate_result_readable: gateLoaded,
      decision_readable: checks.decision_readable,
      blocking_reasons_readable: checks.blocking_reasons_readable,
      next_operator_actions_readable: checks.next_operator_actions_readable,
      safety_badges_readable: gateSafetyLocked,
      raw_gate_optional: true,
      markdown_optional: true,
    },
    safety: {
      read_only: true,
      preview_only: true,
      no_auto_persist: true,
      no_canon_update: safety.no_canon_update === true,
      no_active_engine_update: safety.no_active_engine_update === true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      surface_can_approve: false,
      surface_can_confirm_adoption: false,
      surface_can_activate_engine: false,
      ui_can_approve: false,
      ui_can_confirm_adoption: false,
      ui_can_activate_engine: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      canon_modified: false,
      compressed_rules_modified: false,
      automatic_adoption_performed: false,
      manual_review_entry_only: true,
    },
    integrity: {
      gate_ok: gate.ok === true,
      gate_phase: text(gate.phase, 40),
      gate_status: gateStatus,
      gate_safety_locked: gateSafetyLocked,
      bridge_readability_passed: checks.decision_readable
        && checks.blocking_reasons_readable
        && checks.next_operator_actions_readable,
      no_mutation_side_effects: checks.no_mutation_side_effects,
    },
    warnings: [
      ...array(gate.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(ready ? [] : ["foreshadowing_settlement_operator_adoption_gate_surface_blocked"]),
    ],
    raw_gate: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? gate : null,
  };
  surface.surface_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(surface)
    : "";
  return surface;
}

export default buildForeshadowingSettlementOperatorAdoptionGateSurface;