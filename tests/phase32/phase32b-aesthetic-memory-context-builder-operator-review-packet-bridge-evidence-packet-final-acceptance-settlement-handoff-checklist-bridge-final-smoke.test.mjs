import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const runAllRel = "tests/run-all.mjs";

const phaseSources = [
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
  {
    phase: "31Y",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_settlement_handoff_readiness",
    relPath:
      "tests/phase31/phase31y-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-readiness.test.mjs",
  },
  {
    phase: "31Z",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_settlement_handoff_operator_checklist",
    relPath:
      "tests/phase31/phase31z-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-operator-checklist.test.mjs",
  },
  {
    phase: "32A",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_settlement_handoff_checklist_bridge_preview",
    relPath:
      "tests/phase32/phase32a-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-preview.test.mjs",
  },
];

const phase32BRel =
  "tests/phase32/phase32b-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-smoke.test.mjs";

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

const sourceEvidence = phaseSources.map((source) => {
  const sourceText = readRepoText(source.relPath);

  return {
    ...source,
    sourceDigest: `sha256:${sha256(sourceText)}`,
    sourceBytes: Buffer.byteLength(sourceText, "utf8"),
  };
});

for (const source of sourceEvidence) {
  assert.match(
    source.sourceDigest,
    /^sha256:[a-f0-9]{64}$/,
    `source digest must be sha256 for ${source.phase}`,
  );

  assert.ok(source.sourceBytes > 0, `source must not be empty: ${source.phase}`);
}

const phase32ARel = phaseSources.find((source) => source.phase === "32A").relPath;
const phase32ASource = readRepoText(phase32ARel);

assert.equal(
  phase32ASource.includes("final acceptance settlement handoff checklist bridge preview"),
  true,
  "Phase32A source must remain the settlement handoff checklist bridge preview input for Phase32B",
);

assert.equal(
  runAllSource.includes(phase32ARel),
  true,
  "run-all must include Phase32A before Phase32B",
);

assert.equal(
  runAllSource.includes(phase32BRel),
  true,
  "run-all must include Phase32B settlement handoff checklist bridge final smoke",
);

assert.ok(
  runAllSource.indexOf(phase32ARel) < runAllSource.indexOf(phase32BRel),
  "run-all order must place Phase32B after Phase32A",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase32BRel) < dailyMarkerIndex,
    "Phase32B must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase32B settlement handoff checklist bridge final smoke must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase32B settlement handoff checklist bridge final smoke must not modify compressed_rules",
);

const finalSmokeRows = [
  {
    id: "bridge_preview_source_loaded",
    bridgeLabel: "Settlement handoff checklist bridge preview source loaded",
    sourceEvidence: ["32A"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "handoff_readiness_verified",
    bridgeLabel: "Settlement handoff readiness verified",
    sourceEvidence: ["31Y", "31Z", "32A"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "final_bridge_smoke_verified",
    bridgeLabel: "Final acceptance checklist bridge final smoke verified",
    sourceEvidence: ["31X"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "checklist_bridge_preview_verified",
    bridgeLabel: "Final acceptance checklist bridge preview verified",
    sourceEvidence: ["31W", "32A"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "operator_final_acceptance_checklist_verified",
    bridgeLabel: "Final acceptance operator checklist verified",
    sourceEvidence: ["31V", "31Z"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "final_acceptance_readiness_verified",
    bridgeLabel: "Final acceptance readiness verified",
    sourceEvidence: ["31U"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "bridge_evidence_lineage_verified",
    bridgeLabel: "Bridge evidence lineage verified",
    sourceEvidence: ["31P", "31Q", "31R", "31S", "31T"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "recovery_and_stability_verified",
    bridgeLabel: "Recovery guide and stability guard verified",
    sourceEvidence: ["31N", "31O"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "protected_hashes_verified",
    bridgeLabel: "Protected hashes verified",
    sourceEvidence: ["active_engine_hash", "compressed_rules_hash"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
  {
    id: "blocked_settlement_actions_verified",
    bridgeLabel: "Blocked settlement handoff actions verified",
    sourceEvidence: ["blocked_settlement_action_matrix"],
    defaultDecision: "pending_operator_review",
    finalSmokeStable: true,
    renderedInBridge: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
    canPersistOperatorDecision: false,
  },
];

const settlementHandoffChecklistBridgeFinalSmokeContract = {
  phase: "32B",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Checklist Bridge Final Smoke",
  sourcePhase: "32A",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Checklist Bridge Preview",
  nextSuggestedPhase: "32C",
  nextSuggestedSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Checklist Bridge Stability Guard",
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
    "31Z",
    "32A",
    "32B",
  ],
  sourceEvidence: sourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  bridgeFinalSmokeMode: {
    chatgptBridgeFacing: true,
    settlementHandoffFacing: true,
    operatorChecklistFacing: true,
    checklistBridgeFinalSmoke: true,
    finalAcceptanceHandoffPreflight: true,
    operatorReviewRequired: true,
    manualReviewOnly: true,
    deterministicFinalSmoke: true,
    evidenceBacked: true,
    previewOnly: true,
    inspectOnly: true,
    readOnly: true,
    smokeOnly: true,
  },
  bridgeFinalSmokeAssertions: {
    bridgePreviewSourceVerified: true,
    bridgePreviewCardsRenderable: true,
    checklistRowsRenderable: true,
    summaryRowsRenderable: true,
    proofPanelsRenderable: true,
    evidenceLineageComplete: true,
    protectedHashesStable: true,
    settlementContextCreationBlocked: true,
    settlementHandoffPersistBlocked: true,
    settlementCandidateCreationBlocked: true,
    operatorDecisionPersistBlocked: true,
    autoAcceptanceBlocked: true,
    rawPayloadHiddenByDefault: true,
    summaryCardsOnlyByDefault: true,
    noRuntimeWrites: true,
  },
  bridgeFinalSmokeCards: [
    "settlement_handoff_checklist_final_smoke_summary_card",
    "manual_handoff_checklist_final_smoke_table_card",
    "final_acceptance_lineage_final_smoke_card",
    "source_digest_final_smoke_matrix_card",
    "protected_hash_final_smoke_proof_card",
    "blocked_settlement_action_final_smoke_matrix_card",
    "raw_payload_visibility_final_smoke_card",
    "next_phase_stability_guard_card",
  ],
  bridgeFinalSmokeRows: finalSmokeRows,
  bridgeSummaryRows: [
    "source_phase_32a",
    "lineage_31e_to_32b",
    "final_smoke_rows_10",
    "manual_review_required",
    "settlement_context_creation_blocked",
    "settlement_handoff_persist_blocked",
    "settlement_candidate_creation_blocked",
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
    "operator_decision_persist_block_panel",
    "bridge_final_smoke_stability_panel",
    "next_phase_stability_guard_panel",
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
    smokeOnly: true,
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
  settlementHandoffChecklistBridgeFinalSmokeContract.fullLineage.slice(-11),
  ["31R", "31S", "31T", "31U", "31V", "31W", "31X", "31Y", "31Z", "32A", "32B"],
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
  "31Y",
  "31Z",
  "32A",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.sourceEvidence.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing settlement handoff checklist bridge final smoke source evidence: ${expectedPhase}`,
  );
}

for (const modeKey of [
  "chatgptBridgeFacing",
  "settlementHandoffFacing",
  "operatorChecklistFacing",
  "checklistBridgeFinalSmoke",
  "finalAcceptanceHandoffPreflight",
  "operatorReviewRequired",
  "manualReviewOnly",
  "deterministicFinalSmoke",
  "evidenceBacked",
  "previewOnly",
  "inspectOnly",
  "readOnly",
  "smokeOnly",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.bridgeFinalSmokeMode[modeKey],
    true,
    `bridge final smoke mode key must be true: ${modeKey}`,
  );
}

for (const assertionKey of [
  "bridgePreviewSourceVerified",
  "bridgePreviewCardsRenderable",
  "checklistRowsRenderable",
  "summaryRowsRenderable",
  "proofPanelsRenderable",
  "evidenceLineageComplete",
  "protectedHashesStable",
  "settlementContextCreationBlocked",
  "settlementHandoffPersistBlocked",
  "settlementCandidateCreationBlocked",
  "operatorDecisionPersistBlocked",
  "autoAcceptanceBlocked",
  "rawPayloadHiddenByDefault",
  "summaryCardsOnlyByDefault",
  "noRuntimeWrites",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.bridgeFinalSmokeAssertions[
      assertionKey
    ],
    true,
    `bridge final smoke assertion must be true: ${assertionKey}`,
  );
}

assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeContract.bridgeFinalSmokeRows.length,
  10,
  "settlement handoff checklist bridge final smoke must expose 10 final smoke rows",
);

for (const row of settlementHandoffChecklistBridgeFinalSmokeContract.bridgeFinalSmokeRows) {
  assert.equal(row.defaultDecision, "pending_operator_review");
  assert.equal(row.finalSmokeStable, true);
  assert.equal(row.renderedInBridge, true);
  assert.equal(row.canCreateSettlement, false);
  assert.equal(row.canPersistHandoff, false);
  assert.equal(row.canCreateSettlementCandidate, false);
  assert.equal(row.canPersistOperatorDecision, false);
}

for (const card of [
  "settlement_handoff_checklist_final_smoke_summary_card",
  "manual_handoff_checklist_final_smoke_table_card",
  "final_acceptance_lineage_final_smoke_card",
  "source_digest_final_smoke_matrix_card",
  "protected_hash_final_smoke_proof_card",
  "blocked_settlement_action_final_smoke_matrix_card",
  "raw_payload_visibility_final_smoke_card",
  "next_phase_stability_guard_card",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.bridgeFinalSmokeCards.includes(
      card,
    ),
    true,
    `missing bridge final smoke card: ${card}`,
  );
}

for (const row of [
  "source_phase_32a",
  "lineage_31e_to_32b",
  "final_smoke_rows_10",
  "manual_review_required",
  "settlement_context_creation_blocked",
  "settlement_handoff_persist_blocked",
  "settlement_candidate_creation_blocked",
  "operator_decision_persist_blocked",
  "raw_payload_hidden_by_default",
  "protected_hashes_stable",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.bridgeSummaryRows.includes(
      row,
    ),
    true,
    `missing bridge summary row: ${row}`,
  );
}

for (const panel of [
  "lineage_evidence_matrix",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_settlement_action_matrix",
  "raw_payload_visibility_panel",
  "operator_decision_persist_block_panel",
  "bridge_final_smoke_stability_panel",
  "next_phase_stability_guard_panel",
]) {
  assert.equal(
    settlementHandoffChecklistBridgeFinalSmokeContract.proofPanels.includes(panel),
    true,
    `missing proof panel: ${panel}`,
  );
}

assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeContract.rawPayloadPolicy.hiddenByDefault,
  true,
);
assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeContract.rawPayloadPolicy.canInspectDigestOnly,
  true,
);
assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeContract.rawPayloadPolicy.defaultRender,
  "summary_cards_only",
);
assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeContract.rawPayloadPolicy.rawPayloadDefaultRenderBlocked,
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
    settlementHandoffChecklistBridgeFinalSmokeContract.blockedSettlementHandoffActions.includes(
      blockedAction,
    ),
    true,
    `missing blocked settlement handoff action: ${blockedAction}`,
  );
}

assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.readOnly, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.previewOnly, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.inspectOnly, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.manualReviewOnly, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.smokeOnly, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noAutoAcceptance, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noMcpToolRegistration, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noCanonWrite, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noActiveEngineUpdate, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noCompressedRulesUpdate, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noBridgeStateWrite, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noUiStatePersist, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noEvidencePacketPersist, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noFinalArchivePersist, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noOperatorDecisionPersist, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noSettlementContextCreation, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noSettlementHandoffPersist, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noSettlementCandidateCreation, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.noRecoveryExecution, true);
assert.equal(settlementHandoffChecklistBridgeFinalSmokeContract.policy.rawPayloadHiddenByDefault, true);

const settlementHandoffChecklistBridgeFinalSmokeDigest = `sha256:${sha256(
  stableStringify(settlementHandoffChecklistBridgeFinalSmokeContract),
)}`;

assert.match(
  settlementHandoffChecklistBridgeFinalSmokeDigest,
  /^sha256:[a-f0-9]{64}$/,
  "settlement handoff checklist bridge final smoke digest must be a sha256 digest",
);

assert.equal(
  settlementHandoffChecklistBridgeFinalSmokeDigest,
  `sha256:${sha256(stableStringify(settlementHandoffChecklistBridgeFinalSmokeContract))}`,
  "settlement handoff checklist bridge final smoke digest must be deterministic",
);

console.log("Phase32B final acceptance settlement handoff checklist bridge final smoke passed");
console.log(
  `Phase32B deterministic digest: ${settlementHandoffChecklistBridgeFinalSmokeDigest}`,
);
