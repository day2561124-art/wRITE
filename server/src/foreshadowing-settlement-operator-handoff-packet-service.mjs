import { createHash } from "node:crypto";

export const foreshadowingSettlementOperatorHandoffPacketVersion =
  "foreshadowing_settlement_operator_handoff_packet_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
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

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function normalizeCounts(source) {
  const counts = object(source.counts);
  const rawPanel = object(source.raw_panel);
  const rawCounts = object(rawPanel.counts);
  return {
    paid: integer(counts.paid, integer(rawCounts.paid, 0)),
    kept_open: integer(counts.kept_open, integer(rawCounts.kept_open, 0)),
    blocked: integer(counts.blocked, integer(rawCounts.blocked, 0)),
    allowed_candidate_items: integer(
      counts.allowed_candidate_items,
      integer(rawCounts.allowed_candidate_items, 0),
    ),
  };
}

function normalizeSafety(source) {
  const safety = object(source.safety);
  return {
    read_only: true,
    preview_only: safety.preview_only !== false,
    candidate_only: safety.candidate_only !== false,
    no_auto_persist: safety.no_auto_persist !== false,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
    packet_can_approve: false,
    packet_can_confirm_adoption: false,
    packet_can_activate_engine: false,
    packet_can_modify_canon: false,
    packet_can_modify_active_engine: false,
    requires_explicit_human_operator_decision: true,
  };
}

function sourceBlockedReasons(source) {
  const rawPanel = object(source.raw_panel);
  const reasons = array(rawPanel.blocked_reasons).map((item, index) => {
    const reason = object(item);
    return {
      reason: text(reason.reason, 240) || "blocked_reason_" + String(index + 1),
      source: text(reason.source, 160) || "operator_panel",
    };
  });
  const direct = text(source.blocked_reason ?? rawPanel.blocked_reason, 240);
  if (direct && !reasons.some((item) => item.reason === direct)) {
    reasons.push({ reason: direct, source: "operator_panel_ui" });
  }
  return reasons;
}

function evidenceFromSections(source) {
  const rawPanel = object(source.raw_panel);
  const sectionItems = array(source.sections).length
    ? array(source.sections)
    : array(rawPanel.display_sections);
  return sectionItems.map((section, index) => {
    const item = object(section);
    return {
      key: text(item.key, 160) || "section_" + String(index + 1),
      title: text(item.title, 240) || "Untitled evidence section",
      count: integer(item.count, array(item.items).length),
      summary: text(item.summary, 500),
    };
  });
}

function cardsFromSource(source) {
  return array(source.cards).map((card, index) => {
    const item = object(card);
    return {
      key: text(item.key, 160) || "card_" + String(index + 1),
      title: text(item.title, 240) || "Untitled card",
      value: text(item.value, 80) || String(item.value ?? ""),
      tone: text(item.tone, 80) || "neutral",
      summary: text(item.summary, 500),
    };
  });
}

function checklistFor(source, status, reasons, counts) {
  const base = [
    {
      key: "verify_identity",
      label: "Verify settlement and approval identifiers",
      required: true,
      passed: Boolean(source.settlement_context_id || object(source.raw_panel).settlement_context_id),
      evidence: {
        settlement_context_id: source.settlement_context_id ?? object(source.raw_panel).settlement_context_id ?? null,
        approval_item_id: source.approval_item_id ?? object(source.raw_panel).approval_item_id ?? null,
      },
    },
    {
      key: "inspect_debt_split",
      label: "Inspect paid debts, kept-open debts, and allowed candidate-only settlement items",
      required: true,
      passed: counts.paid + counts.kept_open + counts.allowed_candidate_items > 0,
      evidence: counts,
    },
    {
      key: "confirm_bridge_denied",
      label: "Confirm ChatGPT bridge cannot approve, confirm adoption, or activate engine",
      required: true,
      passed: true,
      evidence: {
        bridge_can_approve: false,
        bridge_can_confirm_adoption: false,
        bridge_can_activate_engine: false,
      },
    },
    {
      key: "confirm_no_direct_canon_intake",
      label: "Confirm this handoff packet does not modify Canon DB or active_engine",
      required: true,
      passed: true,
      evidence: {
        no_canon_update: true,
        no_active_engine_update: true,
      },
    },
  ];

  if (status === "blocked_review") {
    base.splice(1, 0, {
      key: "resolve_blocked_guard",
      label: "Resolve blocked Approval Queue guard state before settlement intake",
      required: true,
      passed: reasons.length > 0,
      evidence: reasons,
    });
  }

  if (status === "review_ready") {
    base.push({
      key: "human_review_before_canon_intake",
      label: "Human operator must review the preview before any Canon intake route",
      required: true,
      passed: true,
      evidence: {
        candidate_only: true,
        explicit_human_review_required: true,
      },
    });
  }

  return base;
}

function blockedPathFor(status, reasons) {
  return {
    active: status === "blocked_review",
    action_key: "return_to_approval_queue_guard_review",
    label: "Return to Approval Queue guard review",
    reasons,
    allowed: status === "blocked_review",
    forbidden: [
      "approve_from_chatgpt_bridge",
      "confirm_adoption_from_chatgpt_bridge",
      "activate_engine_from_chatgpt_bridge",
      "canonize_blocked_settlement_items",
    ],
  };
}

function reviewReadyPathFor(status, counts) {
  return {
    active: status === "review_ready",
    action_key: "human_operator_review_candidate_settlement_preview",
    label: "Human operator reviews candidate settlement preview",
    allowed: status === "review_ready",
    evidence: counts,
    forbidden: [
      "automatic_canon_intake",
      "automatic_active_engine_update",
      "bridge_side_approval",
    ],
  };
}

function markdownFor(packet) {
  const checklistLines = packet.operator_intake_checklist.map((item) => (
    "- [" + (item.passed ? "x" : " ") + "] " + item.key + ": " + item.label
  ));
  const reasonLines = packet.blocked_reasons.length
    ? packet.blocked_reasons.map((item) => "- reason=" + item.reason + "; source=" + item.source)
    : ["- none"];
  return [
    "## Foreshadowing Settlement Operator Handoff Packet",
    "",
    "- phase: " + packet.phase,
    "- version: " + packet.version,
    "- status: " + packet.status,
    "- decision: " + packet.decision,
    "- source_phase: " + (packet.source_phase ?? "none"),
    "- settlement_context_id: " + (packet.settlement_context_id ?? "none"),
    "- approval_item_id: " + (packet.approval_item_id ?? "none"),
    "- read_only: " + String(packet.safety.read_only),
    "- no_canon_update: " + String(packet.safety.no_canon_update),
    "- no_active_engine_update: " + String(packet.safety.no_active_engine_update),
    "",
    "### Operator Intake Checklist",
    ...checklistLines,
    "",
    "### Blocked Reasons",
    ...reasonLines,
    "",
    "### Forbidden Actions",
    ...packet.forbidden_actions.map((item) => "- " + item),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorHandoffPacket(input = {}) {
  const bundle = object(input);
  const source = object(
    bundle.operator_panel_ui
      ?? bundle.panel_ui
      ?? bundle.foreshadowing_settlement_operator_panel_ui
      ?? bundle.ui
      ?? bundle.panel,
  );
  const rawPanel = object(source.raw_panel);
  const status = text(source.status ?? rawPanel.status, 120) || "not_available";
  const decision = text(source.decision ?? rawPanel.decision, 120) || "not_available";
  const counts = normalizeCounts(source);
  const blockedReasons = sourceBlockedReasons(source);
  const safety = normalizeSafety(source);
  const sourceUsed = source.used === true || rawPanel.used === true;
  const cards = cardsFromSource(source);
  const evidenceSections = evidenceFromSections(source);
  const checklist = checklistFor(source, status, blockedReasons, counts);
  const requiredFailures = checklist.filter((item) => item.required === true && item.passed !== true);

  const forbiddenActions = [
    "approve_from_chatgpt_bridge",
    "confirm_adoption_from_chatgpt_bridge",
    "activate_engine_from_chatgpt_bridge",
    "modify_active_engine",
    "modify_canon_db",
    "persist_candidate_settlement_without_human_review",
  ];

  const packet = {
    used: sourceUsed,
    phase: "27L",
    version: foreshadowingSettlementOperatorHandoffPacketVersion,
    packet_kind: "foreshadowing_settlement_operator_handoff_packet",
    source_phase: text(source.phase ?? rawPanel.phase, 40) || null,
    source_version: text(source.version ?? rawPanel.version, 160) || null,
    status,
    decision,
    settlement_context_id: text(source.settlement_context_id ?? rawPanel.settlement_context_id, 200) || null,
    approval_item_id: text(source.approval_item_id ?? rawPanel.approval_item_id, 200) || null,
    counts,
    blocked_reasons: blockedReasons,
    evidence_cards: cards,
    evidence_sections: evidenceSections,
    operator_intake_checklist: checklist,
    required_check_failures: requiredFailures,
    blocked_path: blockedPathFor(status, blockedReasons),
    review_ready_path: reviewReadyPathFor(status, counts),
    forbidden_actions: forbiddenActions,
    safety,
    warnings: [
      ...array(source.warnings ?? rawPanel.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(sourceUsed ? [] : ["foreshadowing_settlement_operator_handoff_source_not_available"]),
      ...(status === "blocked_review" ? ["foreshadowing_settlement_operator_handoff_blocked_by_guard"] : []),
      ...(requiredFailures.length ? ["foreshadowing_settlement_operator_handoff_required_check_failed"] : []),
    ],
  };

  packet.review_packet_id = "foreshadowing_settlement_operator_handoff_" + sha256(JSON.stringify({
    status: packet.status,
    decision: packet.decision,
    counts: packet.counts,
    settlement_context_id: packet.settlement_context_id,
    approval_item_id: packet.approval_item_id,
    checklist: packet.operator_intake_checklist.map((item) => [item.key, item.passed]),
  })).slice(0, 16);
  packet.packet_markdown = markdownFor(packet);
  return packet;
}

export default buildForeshadowingSettlementOperatorHandoffPacket;
