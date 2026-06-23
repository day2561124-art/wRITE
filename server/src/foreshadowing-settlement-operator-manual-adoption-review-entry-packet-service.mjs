import {
  buildForeshadowingSettlementOperatorAdoptionGateSurface,
} from "./foreshadowing-settlement-operator-adoption-gate-surface-service.mjs";

export const foreshadowingSettlementOperatorManualAdoptionReviewEntryPacketVersion =
  "foreshadowing_settlement_operator_manual_adoption_review_entry_packet_v1";

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
  if (ready || status === "ready_for_operator_manual_review_entry") {
    return { label: "manual review entry packet ready", class_name: "candidate-status-activated", tone: "ready" };
  }
  if (status === "not_loaded" || status === "not_available") {
    return { label: "not loaded", class_name: "candidate-status-rejected", tone: "empty" };
  }
  return { label: "blocked", class_name: "candidate-status-blocked", tone: "blocked" };
}

function evidence(key, label, present, sourcePhase, summary = "") {
  return {
    key,
    label,
    present: Boolean(present),
    source_phase: text(sourcePhase, 40),
    summary: text(summary, 500),
  };
}

function step(key, label, reason, route = "#approval", priority = "secondary") {
  return {
    key,
    label,
    reason: text(reason, 500),
    route,
    ui_target: String(route).replace(/^#/u, "") || "approval",
    priority,
  };
}

function prohibitedAction(key, label, reason) {
  return {
    key,
    label,
    allowed: false,
    reason: text(reason, 500),
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

function normalizeSurface(input) {
  const bundle = object(input);
  const providedSurface = object(
    bundle.operator_adoption_gate_surface
      ?? bundle.adoption_gate_surface
      ?? bundle.adoption_gate_bridge_surface
      ?? bundle.gate_surface
      ?? bundle.surface,
  );
  if (providedSurface.phase === "27U") return providedSurface;
  return buildForeshadowingSettlementOperatorAdoptionGateSurface({
    ...bundle,
    include_raw: true,
    include_markdown: true,
  });
}

function surfaceSafetyLocked(surface) {
  const safety = object(surface.safety);
  return safety.read_only === true
    && safety.preview_only === true
    && safety.no_auto_persist === true
    && safety.no_canon_update === true
    && safety.no_active_engine_update === true
    && safety.bridge_can_approve === false
    && safety.bridge_can_confirm_adoption === false
    && safety.bridge_can_activate_engine === false
    && safety.surface_can_approve === false
    && safety.surface_can_confirm_adoption === false
    && safety.surface_can_activate_engine === false
    && safety.ui_can_approve === false
    && safety.ui_can_confirm_adoption === false
    && safety.ui_can_activate_engine === false
    && safety.pending_engine_candidate_created === false
    && safety.active_engine_modified === false
    && safety.canon_modified === false
    && safety.compressed_rules_modified === false
    && safety.automatic_adoption_performed === false
    && safety.manual_review_entry_only === true;
}

function collectBlockingReasons(checks, surfaceBlockingReasons) {
  const reasons = [];
  if (!checks.surface_loaded) reasons.push("adoption_gate_surface_not_loaded");
  if (!checks.surface_decision_readable) reasons.push("adoption_gate_surface_decision_not_readable");
  if (!checks.surface_ready_for_entry) {
    reasons.push("adoption_gate_surface_blocked");
    reasons.push(...surfaceBlockingReasons);
  }
  if (!checks.bridge_readability_passed) reasons.push("adoption_gate_bridge_readability_not_ready");
  if (!checks.safety_locked) reasons.push("adoption_gate_surface_safety_not_locked");
  if (!checks.manual_review_only) reasons.push("manual_review_only_boundary_not_locked");
  if (!checks.no_direct_adoption) reasons.push("direct_adoption_boundary_not_locked");
  if (!checks.no_automatic_settlement) reasons.push("automatic_settlement_boundary_not_locked");
  if (!checks.required_evidence_complete) reasons.push("manual_adoption_review_required_evidence_incomplete");
  if (!checks.no_mutation_side_effects) reasons.push("mutation_side_effect_detected");
  return Array.from(new Set(reasons.filter(Boolean)));
}

function markdownFor(packet) {
  return [
    "## Foreshadowing Settlement Operator Manual Adoption Review Entry Packet",
    "",
    "- phase: " + packet.phase,
    "- source_phase: " + packet.source_phase,
    "- packet_status: " + packet.packet_status,
    "- surface_phase: " + packet.surface_phase,
    "- surface_status: " + packet.surface_status,
    "- can_enter_manual_adoption_review: " + String(packet.can_enter_manual_adoption_review),
    "- can_approve: " + String(packet.can_approve),
    "- can_confirm_adoption: " + String(packet.can_confirm_adoption),
    "- can_activate_engine: " + String(packet.can_activate_engine),
    "- active_engine_modified: " + String(packet.safety.active_engine_modified),
    "- canon_modified: " + String(packet.safety.canon_modified),
    "",
    "### Required Evidence",
    ...packet.required_evidence.map((item) => `- ${item.key}: ${item.present ? "present" : "missing"}`),
    "",
    "### Blocking Reasons",
    ...(packet.blocking_reasons.length ? packet.blocking_reasons.map((reason) => `- ${reason}`) : ["- none"]),
    "",
    "### Manual Review Steps",
    ...packet.manual_review_steps.map((item) => `- ${item.key}: ${item.label}`),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket(input = {}) {
  const bundle = object(input);
  const surface = normalizeSurface(bundle);
  const safety = object(surface.safety);
  const bridgeReadability = object(surface.bridge_readability);
  const surfaceBlockingReasons = array(surface.blocking_reasons)
    .map((reason) => text(reason, 240))
    .filter(Boolean);

  const checks = {
    surface_loaded: surface.phase === "27U",
    surface_source_ready: surface.source_phase === "27T" || array(surface.source_phases).includes("27T"),
    gate_phase_ready: surface.gate_phase === "27T" || object(surface.raw_gate).phase === "27T",
    surface_decision_readable: Boolean(text(surface.decision ?? surface.bridge_surface_status ?? surface.gate_decision, 160)),
    surface_ready_for_entry: surface.ok === true
      && surface.bridge_surface_status === "ready_for_manual_review_entry"
      && surface.can_enter_manual_adoption_review === true,
    bridge_readability_passed: bridgeReadability.gate_result_readable === true
      && bridgeReadability.decision_readable === true
      && bridgeReadability.blocking_reasons_readable === true
      && bridgeReadability.next_operator_actions_readable === true
      && bridgeReadability.safety_badges_readable === true,
    safety_locked: surfaceSafetyLocked(surface),
    manual_review_only: surface.manual_review_only === true
      && surface.requires_human_approval === true
      && surface.requires_operator_confirmation === true,
    no_direct_adoption: surface.can_auto_adopt === false
      && surface.direct_adoption_allowed === false,
    no_automatic_settlement: surface.automatic_settlement_allowed === false,
    operator_actions_available: array(surface.next_operator_actions).length > 0,
    raw_gate_available: object(surface.raw_gate).phase === "27T",
    no_mutation_side_effects: safety.pending_engine_candidate_created === false
      && safety.active_engine_modified === false
      && safety.canon_modified === false
      && safety.compressed_rules_modified === false
      && safety.automatic_adoption_performed === false,
  };

  const requiredEvidence = [
    evidence("phase27u_adoption_gate_surface", "Phase 27U adoption gate surface", checks.surface_loaded, "27U", "Surface payload must be loaded and identified as Phase 27U."),
    evidence("phase27t_gate_result", "Phase 27T gate result", checks.gate_phase_ready, "27T", "Gate phase and result must be readable before manual review entry."),
    evidence("gate_decision", "Gate decision", checks.surface_decision_readable, "27U", "Decision/status must be readable by UI and bridge surfaces."),
    evidence("bridge_readability", "Bridge readability", checks.bridge_readability_passed, "27U", "Gate result, decision, blockers, actions, and safety badges must be bridge-readable."),
    evidence("blocking_reasons", "Blocking reasons", Array.isArray(surface.blocking_reasons), "27U", "Blocking reasons must be visible even when empty."),
    evidence("next_operator_actions", "Next operator actions", checks.operator_actions_available, "27U", "Operator must receive the next manual review action."),
    evidence("safety_boundary", "Safety boundary", checks.safety_locked, "27U", "Read-only / preview-only / no mutation boundaries must be locked."),
    evidence("raw_gate_json", "Raw gate JSON", checks.raw_gate_available, "27T", "Raw gate JSON must be available for manual inspection."),
  ];

  checks.required_evidence_complete = requiredEvidence.every((item) => item.present);

  const blockingReasons = collectBlockingReasons(checks, surfaceBlockingReasons);
  const ready = blockingReasons.length === 0;
  const packetStatus = ready ? "ready_for_operator_manual_review_entry" : "blocked";

  const manualReviewSteps = ready
    ? [
      step("inspect_entry_packet", "Inspect manual adoption review entry packet", "Review evidence, gate decision, safety locks, and raw gate JSON before entering any human approval flow.", "#writer-workbench", "primary"),
      step("open_existing_approval_queue", "Open existing human approval queue", "Use the existing approval queue and confirmation flow. This packet cannot approve or confirm adoption.", "#approval", "primary"),
      step("verify_no_mutation_boundary", "Verify no-mutation boundary", "Confirm that active_engine, Canon DB, compressed_rules, pending engine candidates, and settlement outputs remain unchanged.", "#writer-workbench", "secondary"),
      step("continue_operator_review_only", "Continue operator review only", "Proceed only as a human review entry. Do not activate engine or auto-settle from this packet.", "#approval", "secondary"),
    ]
    : [
      step("repair_manual_review_entry_packet", "Repair manual adoption review entry blockers", blockingReasons.join(" · ") || "Manual adoption review entry is blocked.", "#writer-workbench", "primary"),
      step("rerun_adoption_gate_surface", "Rerun 27T / 27U / 27V readiness chain", "Refresh gate, bridge-readable surface, and live UI smoke after blockers are repaired.", "#writer-workbench", "secondary"),
    ];

  const packet = {
    ok: ready,
    used: true,
    phase: "27W",
    version: foreshadowingSettlementOperatorManualAdoptionReviewEntryPacketVersion,
    packet_kind: "foreshadowing_settlement_operator_manual_adoption_review_entry_packet",
    source_phase: "27U",
    source_phases: ["27T", "27U", "27V"],
    surface_phase: text(surface.phase, 40) || "not_available",
    surface_status: text(surface.bridge_surface_status ?? surface.decision, 160) || "not_available",
    gate_phase: text(surface.gate_phase, 40) || text(object(surface.raw_gate).phase, 40) || "not_available",
    gate_status: text(surface.gate_status ?? object(surface.raw_gate).gate_status, 160) || "not_available",
    gate_decision: text(surface.gate_decision ?? object(surface.raw_gate).decision, 160) || "not_available",
    packet_status: packetStatus,
    decision: packetStatus,
    status_badge: statusBadge(packetStatus, ready),
    can_enter_manual_review: ready,
    can_enter_manual_adoption_review: ready,
    can_enter_adoption_review: ready,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    manual_review_only: true,
    headline: ready
      ? "Foreshadowing settlement manual adoption review entry packet is ready"
      : "Foreshadowing settlement manual adoption review entry packet is blocked",
    summary: ready
      ? "The operator can enter the existing human review flow. This packet does not approve, confirm adoption, settle, write Canon, or activate engine."
      : "Manual adoption review entry is blocked until required evidence, gate readiness, and safety locks are repaired.",
    checks,
    required_evidence: requiredEvidence,
    blocking_reasons: blockingReasons,
    manual_review_steps: manualReviewSteps,
    next_operator_actions: manualReviewSteps,
    prohibited_actions: [
      prohibitedAction("approve_from_packet", "Approve from packet", "This packet is evidence-only and cannot approve."),
      prohibitedAction("confirm_adoption_from_packet", "Confirm adoption from packet", "Adoption confirmation must use the existing human approval flow."),
      prohibitedAction("activate_engine_from_packet", "Activate engine from packet", "Engine activation is forbidden from this packet."),
      prohibitedAction("write_canon_from_packet", "Write Canon from packet", "Canon DB writes are forbidden from this packet."),
      prohibitedAction("create_pending_engine_candidate_from_packet", "Create pending engine candidate from packet", "Pending engine candidate creation is forbidden from this packet."),
      prohibitedAction("auto_settle_from_packet", "Auto-settle from packet", "Automatic settlement is forbidden from this packet."),
    ],
    safety_badges: [
      safetyBadge("read_only", "Read-only", true, "Packet displays review-entry evidence only."),
      safetyBadge("preview_only", "Preview-only", true, "Packet does not persist or mutate project state."),
      safetyBadge("no_approval", "No approval", true, "Packet cannot approve."),
      safetyBadge("no_confirm_adoption", "No adoption confirmation", true, "Packet cannot confirm adoption."),
      safetyBadge("no_activate_engine", "No engine activation", true, "Packet cannot activate engine."),
      safetyBadge("no_canon_update", "No Canon update", true, "Packet cannot write Canon DB."),
      safetyBadge("no_active_engine_update", "No active_engine update", true, "Packet cannot modify active_engine."),
      safetyBadge("no_pending_engine_candidate", "No pending engine candidate", true, "Packet cannot create pending engine candidates."),
    ],
    bridge_readability: {
      packet_readable: true,
      decision_readable: true,
      required_evidence_readable: true,
      blocking_reasons_readable: true,
      manual_review_steps_readable: true,
      prohibited_actions_readable: true,
      safety_badges_readable: true,
      raw_surface_optional: true,
      markdown_optional: true,
    },
    safety: {
      read_only: true,
      preview_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      packet_can_approve: false,
      packet_can_confirm_adoption: false,
      packet_can_activate_engine: false,
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
      source_surface_loaded: checks.surface_loaded,
      source_surface_status: text(surface.bridge_surface_status ?? surface.decision, 160),
      source_gate_phase: text(surface.gate_phase, 40) || text(object(surface.raw_gate).phase, 40),
      source_safety_locked: checks.safety_locked,
      required_evidence_complete: checks.required_evidence_complete,
      no_mutation_side_effects: checks.no_mutation_side_effects,
      prohibited_actions_locked: true,
    },
    warnings: [
      ...array(surface.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(ready ? [] : ["foreshadowing_settlement_operator_manual_adoption_review_entry_packet_blocked"]),
    ],
    raw_surface: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? surface : null,
  };

  packet.packet_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(packet)
    : "";

  return packet;
}

export default buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket;
