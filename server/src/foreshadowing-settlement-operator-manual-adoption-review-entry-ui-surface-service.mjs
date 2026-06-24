import {
  buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket,
} from "./foreshadowing-settlement-operator-manual-adoption-review-entry-packet-service.mjs";

export const foreshadowingSettlementOperatorManualAdoptionReviewEntryUiSurfaceVersion =
  "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface_v1";

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

function statusBadge(status, ready = false) {
  if (ready || status === "ready_for_operator_manual_review_entry") {
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
    value: text(String(value ?? ""), 160),
    tone,
    summary: text(summary, 500),
  };
}

function evidenceCard(item) {
  return {
    key: text(item.key, 120),
    title: text(item.label ?? item.key, 160),
    value: item.present === true ? "present" : "missing",
    tone: item.present === true ? "ready" : "blocked",
    summary: text(item.summary ?? item.source_phase ?? "", 500),
    source_phase: text(item.source_phase, 40),
  };
}

function blockerCard(reason) {
  return {
    key: text(reason, 160),
    title: text(reason, 160),
    value: "blocked",
    tone: "blocked",
    summary: "Resolve this blocker before entering manual adoption review.",
  };
}

function stepCard(step) {
  return {
    key: text(step.key, 120),
    title: text(step.label ?? step.key, 180),
    value: text(step.priority ?? "secondary", 80),
    tone: step.priority === "primary" ? "ready" : "neutral",
    summary: text(step.reason ?? "", 500),
    route: text(step.route ?? "#approval", 80),
    ui_target: text(step.ui_target ?? String(step.route ?? "#approval").replace(/^#/u, ""), 80),
    priority: text(step.priority ?? "secondary", 80),
  };
}

function prohibitedCard(item) {
  return {
    key: text(item.key, 120),
    title: text(item.label ?? item.key, 180),
    value: item.allowed === true ? "allowed" : "forbidden",
    tone: item.allowed === true ? "blocked" : "ready",
    summary: text(item.reason ?? "", 500),
    allowed: item.allowed === true,
  };
}

function safetyCard(item) {
  return {
    key: text(item.key, 120),
    title: text(item.label ?? item.key, 180),
    value: item.value === true ? "locked" : "not locked",
    tone: item.value === true ? "ready" : "blocked",
    summary: text(item.summary ?? "", 500),
  };
}

function normalizePacket(input) {
  const bundle = object(input);
  const packet = object(
    bundle.operator_manual_adoption_review_entry_packet
      ?? bundle.manual_adoption_review_entry_packet
      ?? bundle.review_entry_packet
      ?? bundle.packet,
  );
  if (packet.phase === "27W") return packet;
  return buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket({
    ...bundle,
    include_raw: true,
    include_markdown: true,
  });
}

function markdownFor(surface) {
  return [
    "## Foreshadowing Settlement Operator Manual Adoption Review Entry UI Surface",
    "",
    "- phase: " + surface.phase,
    "- source_phase: " + surface.source_phase,
    "- packet_phase: " + surface.packet_phase,
    "- surface_status: " + surface.surface_status,
    "- decision: " + surface.decision,
    "- can_enter_manual_adoption_review: " + String(surface.can_enter_manual_adoption_review),
    "- can_approve: " + String(surface.can_approve),
    "- can_confirm_adoption: " + String(surface.can_confirm_adoption),
    "- can_activate_engine: " + String(surface.can_activate_engine),
    "",
    "### Required Evidence",
    ...surface.required_evidence.map((item) => `- ${item.key}: ${item.value}`),
    "",
    "### Blocking Reasons",
    ...(surface.blocking_reason_cards.length ? surface.blocking_reason_cards.map((item) => `- ${item.key}`) : ["- none"]),
    "",
    "### Manual Review Steps",
    ...surface.manual_review_steps.map((item) => `- ${item.key}: ${item.title}`),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface(input = {}) {
  const bundle = object(input);
  const packet = normalizePacket(bundle);
  const blockingReasons = array(packet.blocking_reasons).map((reason) => text(reason, 240)).filter(Boolean);
  const requiredEvidence = array(packet.required_evidence).map(evidenceCard);
  const manualReviewSteps = array(packet.manual_review_steps ?? packet.next_operator_actions).map(stepCard);
  const prohibitedActions = array(packet.prohibited_actions).map(prohibitedCard);
  const safetyBadges = array(packet.safety_badges).map(safetyCard);
  const safety = object(packet.safety);
  const ready = packet.ok === true
    && packet.packet_status === "ready_for_operator_manual_review_entry"
    && packet.can_enter_manual_adoption_review === true
    && requiredEvidence.every((item) => item.value === "present");

  const surface = {
    ok: ready,
    used: true,
    phase: "27X",
    version: foreshadowingSettlementOperatorManualAdoptionReviewEntryUiSurfaceVersion,
    surface_kind: "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface",
    source_phase: "27W",
    source_phases: ["27T", "27U", "27V", "27W"],
    packet_phase: text(packet.phase, 40) || "not_available",
    packet_status: text(packet.packet_status ?? packet.decision, 160) || "not_available",
    surface_status: ready ? "ready_for_operator_manual_review_entry" : "blocked",
    decision: ready ? "ready_for_operator_manual_review_entry" : "blocked",
    status_badge: statusBadge(ready ? "ready_for_operator_manual_review_entry" : "blocked", ready),
    headline: ready
      ? "Manual adoption review entry is ready"
      : "Manual adoption review entry is blocked",
    summary: ready
      ? "Operator can inspect evidence and enter the existing human review flow. This UI surface cannot approve, confirm adoption, settle, write Canon, or activate engine."
      : "Manual adoption review entry is blocked. Inspect required evidence, blocking reasons, and safety locks before continuing.",
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
    cards: [
      card("packet_status", "Packet status", packet.packet_status ?? "not_available", ready ? "ready" : "blocked", "Phase 27W manual review entry packet status."),
      card("required_evidence", "Required evidence", `${requiredEvidence.filter((item) => item.value === "present").length}/${requiredEvidence.length}`, requiredEvidence.every((item) => item.value === "present") ? "ready" : "blocked", "Required evidence completeness for manual review entry."),
      card("blocking_reasons", "Blocking reasons", blockingReasons.length, blockingReasons.length ? "blocked" : "ready", "Blocking reasons carried from Phase 27W packet."),
      card("manual_review_steps", "Manual review steps", manualReviewSteps.length, manualReviewSteps.length ? "ready" : "blocked", "Operator steps for entering the existing human review flow."),
      card("prohibited_actions", "Prohibited actions", prohibitedActions.length, prohibitedActions.every((item) => item.allowed === false) ? "ready" : "blocked", "Actions this UI surface must not perform."),
      card("safety_boundary", "Safety boundary", safety.read_only === true && safety.preview_only === true ? "locked" : "not locked", safety.read_only === true && safety.preview_only === true ? "ready" : "blocked", "Read-only / preview-only boundary."),
    ],
    required_evidence: requiredEvidence,
    blocking_reasons: blockingReasons,
    blocking_reason_cards: blockingReasons.map(blockerCard),
    manual_review_steps: manualReviewSteps,
    next_operator_actions: manualReviewSteps,
    prohibited_actions: prohibitedActions,
    safety_badges: safetyBadges,
    bridge_readability: {
      surface_readable: true,
      packet_status_readable: true,
      required_evidence_readable: true,
      blocking_reasons_readable: true,
      manual_review_steps_readable: true,
      prohibited_actions_readable: true,
      safety_badges_readable: true,
      raw_packet_json_available: true,
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
      ui_can_approve: false,
      ui_can_confirm_adoption: false,
      ui_can_activate_engine: false,
      surface_can_approve: false,
      surface_can_confirm_adoption: false,
      surface_can_activate_engine: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      canon_modified: false,
      compressed_rules_modified: false,
      automatic_adoption_performed: false,
      manual_review_entry_only: true,
    },
    integrity: {
      packet_loaded: packet.phase === "27W",
      packet_status: text(packet.packet_status ?? "", 160),
      required_evidence_complete: requiredEvidence.every((item) => item.value === "present"),
      prohibited_actions_locked: prohibitedActions.every((item) => item.allowed === false),
      safety_locked: safety.read_only === true
        && safety.preview_only === true
        && safety.packet_can_approve === false
        && safety.packet_can_confirm_adoption === false
        && safety.packet_can_activate_engine === false
        && safety.active_engine_modified === false
        && safety.canon_modified === false
        && safety.compressed_rules_modified === false,
      no_mutation_side_effects: safety.pending_engine_candidate_created === false
        && safety.active_engine_modified === false
        && safety.canon_modified === false
        && safety.compressed_rules_modified === false
        && safety.automatic_adoption_performed === false,
    },
    warnings: [
      ...array(packet.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(ready ? [] : ["foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface_blocked"]),
    ],
    raw_packet: bundle.include_raw === false ? null : packet,
  };

  surface.surface_markdown = bundle.include_markdown === false ? "" : markdownFor(surface);
  return surface;
}

export default buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface;
