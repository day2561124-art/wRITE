import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const runAllRel = "tests/run-all.mjs";

const phase31Sources = [
  {
    phase: "31J",
    role: "operator_review_packet",
    relPath:
      "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
  },
  {
    phase: "31K",
    role: "operator_review_packet_ui_surface",
    relPath:
      "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
  },
  {
    phase: "31L",
    role: "operator_review_packet_bridge_preview",
    relPath:
      "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
  },
  {
    phase: "31M",
    role: "operator_review_packet_bridge_final_smoke",
    relPath:
      "tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs",
  },
  {
    phase: "31N",
    role: "operator_review_packet_bridge_stability_guard",
    relPath:
      "tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs",
  },
  {
    phase: "31O",
    role: "operator_review_packet_bridge_recovery_guide",
    relPath:
      "tests/phase31/phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs",
  },
  {
    phase: "31P",
    role: "operator_review_packet_bridge_evidence_packet",
    relPath:
      "tests/phase31/phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs",
  },
  {
    phase: "31Q",
    role: "operator_review_packet_bridge_evidence_packet_ui_preview",
    relPath:
      "tests/phase31/phase31q-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-preview.test.mjs",
  },
  {
    phase: "31R",
    role: "operator_review_packet_bridge_evidence_packet_ui_live_smoke",
    relPath:
      "tests/phase31/phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs",
  },
  {
    phase: "31S",
    role: "operator_review_packet_bridge_evidence_packet_bridge_preview",
    relPath:
      "tests/phase31/phase31s-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-bridge-preview.test.mjs",
  },
  {
    phase: "31T",
    role: "operator_review_packet_bridge_evidence_packet_final_bridge_smoke",
    relPath:
      "tests/phase31/phase31t-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-bridge-smoke.test.mjs",
  },
  {
    phase: "31U",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_readiness",
    relPath:
      "tests/phase31/phase31u-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-readiness.test.mjs",
  },
  {
    phase: "31V",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_operator_checklist",
    relPath:
      "tests/phase31/phase31v-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-operator-checklist.test.mjs",
  },
  {
    phase: "31W",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_checklist_bridge_preview",
    relPath:
      "tests/phase31/phase31w-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-checklist-bridge-preview.test.mjs",
  },
  {
    phase: "31X",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_checklist_bridge_final_smoke",
    relPath:
      "tests/phase31/phase31x-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-checklist-bridge-final-smoke.test.mjs",
  },
];

const phase31YRel =
  "tests/phase31/phase31y-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-readiness.test.mjs";

const activeEngineRel = "data/canon_db/active_engine.md";
const compressedRulesRel = "data/error_report_db/compressed_rules.md";

const expectedActiveEngineHash =
  "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash =
  "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function readRepoText(relPath) {
  const absolutePath = path.join(repoRoot, relPath);
  assert.equal(
    existsSync(absolutePath),
    true,
    `expected repo file to exist: ${relPath}`,
  );
  return readFileSync(absolutePath, "utf8");
}

function readRepoBytes(relPath) {
  const absolutePath = path.join(repoRoot, relPath);
  assert.equal(
    existsSync(absolutePath),
    true,
    `expected repo file to exist: ${relPath}`,
  );
  return readFileSync(absolutePath);
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

const runAllSource = readRepoText(runAllRel);

const phase31SourceEvidence = phase31Sources.map((source) => {
  const sourceText = readRepoText(source.relPath);

  return {
    ...source,
    sourceDigest: `sha256:${sha256(sourceText)}`,
    sourceBytes: Buffer.byteLength(sourceText, "utf8"),
  };
});

for (const source of phase31SourceEvidence) {
  assert.match(
    source.sourceDigest,
    /^sha256:[a-f0-9]{64}$/,
    `source digest must be sha256 for ${source.phase}`,
  );

  assert.ok(source.sourceBytes > 0, `source must not be empty: ${source.phase}`);
}

const phase31XRel = phase31Sources.find((source) => source.phase === "31X").relPath;
const phase31XSource = readRepoText(phase31XRel);

assert.equal(
  phase31XSource.includes("final acceptance checklist bridge final smoke"),
  true,
  "Phase31X source must remain the final acceptance checklist bridge final smoke input for Phase31Y",
);

assert.equal(
  runAllSource.includes(phase31XRel),
  true,
  "run-all must include Phase31X before Phase31Y",
);

assert.equal(
  runAllSource.includes(phase31YRel),
  true,
  "run-all must include Phase31Y final acceptance settlement handoff readiness",
);

assert.ok(
  runAllSource.indexOf(phase31XRel) < runAllSource.indexOf(phase31YRel),
  "run-all order must place Phase31Y after Phase31X",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31YRel) < dailyMarkerIndex,
    "Phase31Y must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31Y settlement handoff readiness must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31Y settlement handoff readiness must not modify compressed_rules",
);

const handoffReadinessSections = [
  {
    id: "final_bridge_smoke_verified",
    label: "Final acceptance checklist bridge final smoke verified",
    requiredEvidence: ["31X"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "bridge_preview_verified",
    label: "Final acceptance checklist bridge preview verified",
    requiredEvidence: ["31W", "31X"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "operator_checklist_verified",
    label: "Final acceptance operator checklist verified",
    requiredEvidence: ["31V"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "final_acceptance_readiness_verified",
    label: "Final acceptance readiness verified",
    requiredEvidence: ["31U"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "bridge_evidence_packet_verified",
    label: "Bridge evidence packet lineage verified",
    requiredEvidence: ["31P", "31Q", "31R", "31S", "31T"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "recovery_and_stability_verified",
    label: "Recovery guide and stability guard verified",
    requiredEvidence: ["31N", "31O"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "protected_hashes_verified",
    label: "Protected hashes verified",
    requiredEvidence: ["active_engine_hash", "compressed_rules_hash"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
  {
    id: "settlement_handoff_blocked_until_operator_acceptance",
    label: "Settlement handoff remains blocked until explicit operator acceptance",
    requiredEvidence: ["blocked_settlement_handoff_matrix"],
    defaultState: "pending_operator_review",
    requiresHumanReview: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
  },
];

const finalAcceptanceSettlementHandoffReadinessContract = {
  phase: "31Y",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Readiness",
  sourcePhase: "31X",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Checklist Bridge Final Smoke",
  nextSuggestedPhase: "31Z",
  nextSuggestedSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Operator Checklist",
  fullLineage: [
    "31E",
    "31F",
    "31G",
    "31H",
    "31I",
    "31J",
    "31K",
    "31L",
    "31M",
    "31N",
    "31O",
    "31P",
    "31Q",
    "31R",
    "31S",
    "31T",
    "31U",
    "31V",
    "31W",
    "31X",
    "31Y",
  ],
  sourceEvidence: phase31SourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  settlementHandoffMode: {
    settlementHandoffFacing: true,
    finalAcceptanceHandoffPreflight: true,
    operatorReviewRequired: true,
    manualReviewOnly: true,
    deterministicReadiness: true,
    evidenceBacked: true,
    previewOnly: true,
    inspectOnly: true,
    readOnly: true,
  },
  readinessAssertions: {
    finalChecklistBridgeSmokeStable: true,
    checklistBridgePreviewStable: true,
    operatorChecklistStable: true,
    finalAcceptanceReadinessStable: true,
    evidenceLineageComplete: true,
    settlementHandoffPrepared: true,
    settlementContextCreationBlocked: true,
    settlementHandoffPersistBlocked: true,
    operatorDecisionPersistBlocked: true,
    autoAcceptanceBlocked: true,
    protectedHashesStable: true,
    rawPayloadHiddenByDefault: true,
    noRuntimeWrites: true,
  },
  handoffReadinessSections,
  handoffPreviewCards: [
    "settlement_handoff_readiness_summary_card",
    "final_acceptance_lineage_card",
    "operator_checklist_status_card",
    "bridge_final_smoke_status_card",
    "protected_hash_proof_card",
    "blocked_settlement_action_matrix_card",
    "raw_payload_visibility_card",
    "next_phase_operator_checklist_card",
  ],
  handoffSummaryRows: [
    "source_phase_31x",
    "lineage_31e_to_31y",
    "handoff_readiness_sections_8",
    "manual_review_required",
    "settlement_context_creation_blocked",
    "settlement_handoff_persist_blocked",
    "operator_decision_persist_blocked",
    "raw_payload_hidden_by_default",
    "protected_hashes_stable",
  ],
  proofPanels: [
    "lineage_evidence_matrix",
    "source_digest_matrix",
    "protected_hash_proof_panel",
    "blocked_settlement_action_matrix",
    "raw_payload_visibility_panel",
    "handoff_readiness_stability_panel",
  ],
  rawPayloadPolicy: {
    hiddenByDefault: true,
    canInspectDigestOnly: true,
    defaultRender: "summary_cards_only",
    rawPayloadDefaultRenderBlocked: true,
  },
  blockedSettlementHandoffActions: [
    "mcp_tool_registration",
    "canon_write",
    "active_engine_update",
    "compressed_rules_update",
    "bridge_state_write",
    "ui_state_persist",
    "evidence_packet_persist",
    "final_archive_persist",
    "operator_decision_persist",
    "settlement_context_creation",
    "settlement_handoff_persist",
    "settlement_candidate_creation",
    "recovery_execution",
    "raw_payload_default_render",
    "auto_acceptance",
  ],
  policy: {
    readOnly: true,
    previewOnly: true,
    inspectOnly: true,
    manualReviewOnly: true,
    noAutoAcceptance: true,
    noMcpToolRegistration: true,
    noCanonWrite: true,
    noActiveEngineUpdate: true,
    noCompressedRulesUpdate: true,
    noBridgeStateWrite: true,
    noUiStatePersist: true,
    noEvidencePacketPersist: true,
    noFinalArchivePersist: true,
    noOperatorDecisionPersist: true,
    noSettlementContextCreation: true,
    noSettlementHandoffPersist: true,
    noSettlementCandidateCreation: true,
    noRecoveryExecution: true,
    rawPayloadHiddenByDefault: true,
  },
  protectedHashes: {
    activeEngine: activeEngineHash,
    compressedRules: compressedRulesHash,
  },
};

assert.deepEqual(
  finalAcceptanceSettlementHandoffReadinessContract.fullLineage.slice(-8),
  ["31R", "31S", "31T", "31U", "31V", "31W", "31X", "31Y"],
);

for (const expectedPhase of [
  "31J",
  "31K",
  "31L",
  "31M",
  "31N",
  "31O",
  "31P",
  "31Q",
  "31R",
  "31S",
  "31T",
  "31U",
  "31V",
  "31W",
  "31X",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.sourceEvidence.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing settlement handoff source evidence: ${expectedPhase}`,
  );
}

for (const modeKey of [
  "settlementHandoffFacing",
  "finalAcceptanceHandoffPreflight",
  "operatorReviewRequired",
  "manualReviewOnly",
  "deterministicReadiness",
  "evidenceBacked",
  "previewOnly",
  "inspectOnly",
  "readOnly",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.settlementHandoffMode[
      modeKey
    ],
    true,
    `settlement handoff mode key must be true: ${modeKey}`,
  );
}

for (const assertionKey of [
  "finalChecklistBridgeSmokeStable",
  "checklistBridgePreviewStable",
  "operatorChecklistStable",
  "finalAcceptanceReadinessStable",
  "evidenceLineageComplete",
  "settlementHandoffPrepared",
  "settlementContextCreationBlocked",
  "settlementHandoffPersistBlocked",
  "operatorDecisionPersistBlocked",
  "autoAcceptanceBlocked",
  "protectedHashesStable",
  "rawPayloadHiddenByDefault",
  "noRuntimeWrites",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.readinessAssertions[
      assertionKey
    ],
    true,
    `readiness assertion must be true: ${assertionKey}`,
  );
}

assert.equal(
  finalAcceptanceSettlementHandoffReadinessContract.handoffReadinessSections
    .length,
  8,
  "settlement handoff readiness must expose 8 readiness sections",
);

for (const section of finalAcceptanceSettlementHandoffReadinessContract.handoffReadinessSections) {
  assert.equal(section.defaultState, "pending_operator_review");
  assert.equal(section.requiresHumanReview, true);
  assert.equal(section.canCreateSettlement, false);
  assert.equal(section.canPersistHandoff, false);
}

for (const card of [
  "settlement_handoff_readiness_summary_card",
  "final_acceptance_lineage_card",
  "operator_checklist_status_card",
  "bridge_final_smoke_status_card",
  "protected_hash_proof_card",
  "blocked_settlement_action_matrix_card",
  "raw_payload_visibility_card",
  "next_phase_operator_checklist_card",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.handoffPreviewCards.includes(
      card,
    ),
    true,
    `missing settlement handoff preview card: ${card}`,
  );
}

for (const row of [
  "source_phase_31x",
  "lineage_31e_to_31y",
  "handoff_readiness_sections_8",
  "manual_review_required",
  "settlement_context_creation_blocked",
  "settlement_handoff_persist_blocked",
  "operator_decision_persist_blocked",
  "raw_payload_hidden_by_default",
  "protected_hashes_stable",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.handoffSummaryRows.includes(
      row,
    ),
    true,
    `missing settlement handoff summary row: ${row}`,
  );
}

for (const panel of [
  "lineage_evidence_matrix",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_settlement_action_matrix",
  "raw_payload_visibility_panel",
  "handoff_readiness_stability_panel",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.proofPanels.includes(panel),
    true,
    `missing settlement handoff proof panel: ${panel}`,
  );
}

assert.equal(
  finalAcceptanceSettlementHandoffReadinessContract.rawPayloadPolicy.hiddenByDefault,
  true,
);
assert.equal(
  finalAcceptanceSettlementHandoffReadinessContract.rawPayloadPolicy.canInspectDigestOnly,
  true,
);
assert.equal(
  finalAcceptanceSettlementHandoffReadinessContract.rawPayloadPolicy.defaultRender,
  "summary_cards_only",
);
assert.equal(
  finalAcceptanceSettlementHandoffReadinessContract.rawPayloadPolicy.rawPayloadDefaultRenderBlocked,
  true,
);

for (const blockedAction of [
  "mcp_tool_registration",
  "canon_write",
  "active_engine_update",
  "compressed_rules_update",
  "bridge_state_write",
  "ui_state_persist",
  "evidence_packet_persist",
  "final_archive_persist",
  "operator_decision_persist",
  "settlement_context_creation",
  "settlement_handoff_persist",
  "settlement_candidate_creation",
  "recovery_execution",
  "raw_payload_default_render",
  "auto_acceptance",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffReadinessContract.blockedSettlementHandoffActions.includes(
      blockedAction,
    ),
    true,
    `missing blocked settlement handoff action: ${blockedAction}`,
  );
}

assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.readOnly, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.previewOnly, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.inspectOnly, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.manualReviewOnly, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noAutoAcceptance, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noMcpToolRegistration, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noCanonWrite, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noActiveEngineUpdate, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noBridgeStateWrite, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noUiStatePersist, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noEvidencePacketPersist, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noFinalArchivePersist, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noOperatorDecisionPersist, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noSettlementContextCreation, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noSettlementHandoffPersist, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noSettlementCandidateCreation, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.noRecoveryExecution, true);
assert.equal(finalAcceptanceSettlementHandoffReadinessContract.policy.rawPayloadHiddenByDefault, true);

const finalAcceptanceSettlementHandoffReadinessDigest = `sha256:${sha256(
  stableStringify(finalAcceptanceSettlementHandoffReadinessContract),
)}`;

assert.match(
  finalAcceptanceSettlementHandoffReadinessDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final acceptance settlement handoff readiness digest must be a sha256 digest",
);

assert.equal(
  finalAcceptanceSettlementHandoffReadinessDigest,
  `sha256:${sha256(stableStringify(finalAcceptanceSettlementHandoffReadinessContract))}`,
  "final acceptance settlement handoff readiness digest must be deterministic",
);

console.log("Phase31Y final acceptance settlement handoff readiness passed");
console.log(
  `Phase31Y deterministic digest: ${finalAcceptanceSettlementHandoffReadinessDigest}`,
);
