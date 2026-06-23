import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket,
  foreshadowingSettlementOperatorManualAdoptionReviewEntryPacketVersion,
} from "../../server/src/foreshadowing-settlement-operator-manual-adoption-review-entry-packet-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function lockedSafety() {
  return {
    read_only: true,
    preview_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
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
  };
}

function readySurface() {
  return {
    ok: true,
    used: true,
    phase: "27U",
    version: "foreshadowing_settlement_operator_adoption_gate_surface_v1",
    surface_kind: "foreshadowing_settlement_operator_adoption_gate_ui_bridge_surface",
    source_phase: "27T",
    source_phases: ["27T", "27U"],
    gate_phase: "27T",
    gate_status: "ready_for_manual_adoption_review",
    gate_decision: "ready_for_manual_adoption_review",
    bridge_surface_status: "ready_for_manual_review_entry",
    decision: "ready_for_manual_review_entry",
    status_badge: { label: "manual review entry ready", class_name: "candidate-status-activated", tone: "ready" },
    can_enter_manual_adoption_review: true,
    can_enter_adoption_review: true,
    can_auto_adopt: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    manual_review_only: true,
    headline: "ready",
    summary: "ready",
    checks: {
      no_mutation_side_effects: true,
    },
    blocking_reasons: [],
    cards: [
      { key: "gate_decision", title: "Gate decision", value: "ready", tone: "ready" },
      { key: "manual_review_entry", title: "Manual review entry", value: "allowed", tone: "ready" },
      { key: "blocking_reasons", title: "Blocking reasons", value: "0", tone: "ready" },
      { key: "safety_boundary", title: "Safety boundary", value: "locked", tone: "ready" },
    ],
    safety_badges: [
      { key: "read_only", label: "Read-only", value: true },
      { key: "preview_only", label: "Preview-only", value: true },
      { key: "no_canon_update", label: "No Canon update", value: true },
      { key: "no_active_engine_update", label: "No active_engine update", value: true },
      { key: "no_bridge_approval", label: "No bridge approval", value: true },
      { key: "no_confirm_adoption", label: "No adoption confirmation", value: true },
      { key: "no_activate_engine", label: "No engine activation", value: true },
      { key: "no_auto_adoption", label: "No automatic adoption", value: true },
    ],
    next_operator_actions: [
      {
        key: "enter_manual_adoption_review",
        label: "Enter manual foreshadowing settlement adoption review",
        reason: "Gate is ready, but adoption still requires the existing human approval and confirmation flow.",
        route: "#approval",
        ui_target: "approval",
        priority: "primary",
      },
    ],
    bridge_readability: {
      gate_result_readable: true,
      decision_readable: true,
      blocking_reasons_readable: true,
      next_operator_actions_readable: true,
      safety_badges_readable: true,
      raw_gate_optional: true,
      markdown_optional: true,
    },
    safety: lockedSafety(),
    integrity: {
      gate_ok: true,
      gate_phase: "27T",
      gate_status: "ready_for_manual_adoption_review",
      gate_safety_locked: true,
      bridge_readability_passed: true,
      no_mutation_side_effects: true,
    },
    warnings: [],
    raw_gate: {
      phase: "27T",
      gate_status: "ready_for_manual_adoption_review",
      decision: "ready_for_manual_adoption_review",
    },
    surface_markdown: "## Foreshadowing Settlement Operator Adoption Gate Surface",
  };
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);

const readyPacket = buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket({
  operator_adoption_gate_surface: readySurface(),
  include_raw: true,
  include_markdown: true,
});

assert.equal(readyPacket.ok, true, "Ready manual adoption review entry packet should be ok.");
assert.equal(readyPacket.phase, "27W", "Manual adoption review entry packet phase mismatch.");
assert.equal(readyPacket.version, foreshadowingSettlementOperatorManualAdoptionReviewEntryPacketVersion, "Manual adoption review entry packet version mismatch.");
assert.equal(
  readyPacket.packet_kind,
  "foreshadowing_settlement_operator_manual_adoption_review_entry_packet",
  "Manual adoption review entry packet kind mismatch.",
);
assert.equal(readyPacket.source_phase, "27U", "Manual adoption review entry packet source phase mismatch.");
assert.equal(readyPacket.surface_phase, "27U", "Manual adoption review entry packet surface phase mismatch.");
assert.equal(readyPacket.gate_phase, "27T", "Manual adoption review entry packet gate phase mismatch.");
assert.equal(readyPacket.packet_status, "ready_for_operator_manual_review_entry", "Ready packet status mismatch.");
assert.equal(readyPacket.can_enter_manual_adoption_review, true, "Ready packet should allow manual review entry.");
assert.equal(readyPacket.can_approve, false, "Packet can approve.");
assert.equal(readyPacket.can_confirm_adoption, false, "Packet can confirm adoption.");
assert.equal(readyPacket.can_activate_engine, false, "Packet can activate engine.");
assert.equal(readyPacket.direct_adoption_allowed, false, "Packet allows direct adoption.");
assert.equal(readyPacket.automatic_settlement_allowed, false, "Packet allows automatic settlement.");
assert.equal(readyPacket.requires_human_approval, true, "Packet must require human approval.");
assert.equal(readyPacket.requires_operator_confirmation, true, "Packet must require operator confirmation.");
assert.equal(readyPacket.manual_review_only, true, "Packet must be manual-review-only.");
assert(Array.isArray(readyPacket.required_evidence), "Packet required evidence must be an array.");
assert.equal(
  readyPacket.required_evidence.every((item) => item.present === true),
  true,
  "Ready packet required evidence should all be present.",
);
assert.equal(readyPacket.blocking_reasons.length, 0, "Ready packet should have no blocking reasons.");
assert(readyPacket.manual_review_steps.length >= 4, "Ready packet should expose manual review steps.");
assert(readyPacket.prohibited_actions.length >= 6, "Ready packet should expose prohibited actions.");
assert.equal(
  readyPacket.prohibited_actions.every((item) => item.allowed === false),
  true,
  "All packet prohibited actions must be locked.",
);
assert.equal(readyPacket.bridge_readability.packet_readable, true, "Packet is not bridge-readable.");
assert.equal(readyPacket.bridge_readability.required_evidence_readable, true, "Packet evidence is not bridge-readable.");
assert.equal(readyPacket.bridge_readability.prohibited_actions_readable, true, "Packet prohibited actions are not bridge-readable.");
assert.equal(readyPacket.safety.read_only, true, "Packet is not read-only.");
assert.equal(readyPacket.safety.preview_only, true, "Packet is not preview-only.");
assert.equal(readyPacket.safety.no_auto_persist, true, "Packet can auto-persist.");
assert.equal(readyPacket.safety.bridge_can_approve, false, "Packet allows bridge approval.");
assert.equal(readyPacket.safety.bridge_can_confirm_adoption, false, "Packet allows bridge adoption confirmation.");
assert.equal(readyPacket.safety.bridge_can_activate_engine, false, "Packet allows bridge engine activation.");
assert.equal(readyPacket.safety.packet_can_approve, false, "Packet can approve.");
assert.equal(readyPacket.safety.packet_can_confirm_adoption, false, "Packet can confirm adoption.");
assert.equal(readyPacket.safety.packet_can_activate_engine, false, "Packet can activate engine.");
assert.equal(readyPacket.safety.pending_engine_candidate_created, false, "Packet created pending engine candidate.");
assert.equal(readyPacket.safety.active_engine_modified, false, "Packet modified active_engine.");
assert.equal(readyPacket.safety.canon_modified, false, "Packet modified Canon DB.");
assert.equal(readyPacket.safety.compressed_rules_modified, false, "Packet modified compressed_rules.");
assert.equal(readyPacket.safety.automatic_adoption_performed, false, "Packet performed automatic adoption.");
assert.equal(readyPacket.integrity.required_evidence_complete, true, "Packet required evidence integrity mismatch.");
assert.equal(readyPacket.integrity.no_mutation_side_effects, true, "Packet mutation integrity mismatch.");
assert(readyPacket.raw_surface?.phase === "27U", "Packet raw surface missing.");
assert.match(
  readyPacket.packet_markdown,
  /Foreshadowing Settlement Operator Manual Adoption Review Entry Packet/u,
  "Packet markdown heading missing.",
);

const blockedSurface = {
  ...readySurface(),
  ok: false,
  gate_status: "blocked",
  gate_decision: "blocked",
  bridge_surface_status: "blocked",
  decision: "blocked",
  can_enter_manual_adoption_review: false,
  can_enter_adoption_review: false,
  blocking_reasons: ["phase27s_live_ui_smoke_missing"],
  next_operator_actions: [
    {
      key: "repair_operator_adoption_readiness_gate",
      label: "Repair blocked adoption readiness gate",
      reason: "phase27s_live_ui_smoke_missing",
      route: "#writer-workbench",
      ui_target: "writer-workbench",
      priority: "primary",
    },
  ],
  raw_gate: {
    phase: "27T",
    gate_status: "blocked",
    decision: "blocked",
  },
};

const blockedPacket = buildForeshadowingSettlementOperatorManualAdoptionReviewEntryPacket({
  adoption_gate_surface: blockedSurface,
  include_raw: true,
  include_markdown: true,
});

assert.equal(blockedPacket.ok, false, "Blocked packet should not be ok.");
assert.equal(blockedPacket.packet_status, "blocked", "Blocked packet status mismatch.");
assert.equal(blockedPacket.can_enter_manual_adoption_review, false, "Blocked packet should not allow manual review entry.");
assert(blockedPacket.blocking_reasons.includes("phase27s_live_ui_smoke_missing"), "Blocked packet missing source blocker.");
assert(blockedPacket.blocking_reasons.includes("adoption_gate_surface_blocked"), "Blocked packet missing surface blocked reason.");
assert.equal(blockedPacket.safety.read_only, true, "Blocked packet should remain read-only.");
assert.equal(blockedPacket.safety.packet_can_approve, false, "Blocked packet can approve.");
assert.equal(blockedPacket.safety.packet_can_confirm_adoption, false, "Blocked packet can confirm adoption.");
assert.equal(blockedPacket.safety.packet_can_activate_engine, false, "Blocked packet can activate engine.");
assert(blockedPacket.manual_review_steps.some((item) => item.key === "repair_manual_review_entry_packet"), "Blocked packet missing repair step.");
assert(blockedPacket.warnings.includes("foreshadowing_settlement_operator_manual_adoption_review_entry_packet_blocked"), "Blocked packet missing warning.");
assert.equal(blockedPacket.raw_surface?.phase, "27U", "Blocked packet raw surface missing.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "Manual adoption review entry packet changed active_engine.");
assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "Manual adoption review entry packet changed compressed_rules.");

console.log("Phase27W foreshadowing settlement operator manual adoption review entry packet tests passed.");
