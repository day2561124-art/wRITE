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
  {
    phase: "31Y",
    role: "operator_review_packet_bridge_evidence_packet_final_acceptance_settlement_handoff_readiness",
    relPath:
      "tests/phase31/phase31y-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-readiness.test.mjs",
  },
];

const phase31ZRel =
  "tests/phase31/phase31z-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-operator-checklist.test.mjs";

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

const phase31YRel = phase31Sources.find((source) => source.phase === "31Y").relPath;
const phase31YSource = readRepoText(phase31YRel);

assert.equal(
  phase31YSource.includes("final acceptance settlement handoff readiness"),
  true,
  "Phase31Y source must remain the settlement handoff readiness input for Phase31Z",
);

assert.equal(
  runAllSource.includes(phase31YRel),
  true,
  "run-all must include Phase31Y before Phase31Z",
);

assert.equal(
  runAllSource.includes(phase31ZRel),
  true,
  "run-all must include Phase31Z settlement handoff operator checklist",
);

assert.ok(
  runAllSource.indexOf(phase31YRel) < runAllSource.indexOf(phase31ZRel),
  "run-all order must place Phase31Z after Phase31Y",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31ZRel) < dailyMarkerIndex,
    "Phase31Z must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31Z settlement handoff operator checklist must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31Z settlement handoff operator checklist must not modify compressed_rules",
);

const settlementHandoffChecklistSections = [
  {
    id: "handoff_readiness_verified",
    label: "Settlement handoff readiness verified",
    requiredEvidence: ["31Y"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "final_bridge_smoke_verified",
    label: "Final acceptance checklist bridge final smoke verified",
    requiredEvidence: ["31X"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "checklist_bridge_preview_verified",
    label: "Final acceptance checklist bridge preview verified",
    requiredEvidence: ["31W"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "operator_final_acceptance_checklist_verified",
    label: "Final acceptance operator checklist verified",
    requiredEvidence: ["31V"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "final_acceptance_readiness_verified",
    label: "Final acceptance readiness verified",
    requiredEvidence: ["31U"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "bridge_evidence_lineage_verified",
    label: "Bridge evidence lineage verified",
    requiredEvidence: ["31P", "31Q", "31R", "31S", "31T"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "recovery_and_stability_verified",
    label: "Recovery guide and stability guard verified",
    requiredEvidence: ["31N", "31O"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "protected_hashes_verified",
    label: "Protected hashes verified",
    requiredEvidence: ["active_engine_hash", "compressed_rules_hash"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
  {
    id: "blocked_settlement_actions_verified",
    label: "Blocked settlement handoff actions verified",
    requiredEvidence: ["blocked_settlement_action_matrix"],
    defaultDecision: "pending_operator_review",
    requiresOperatorCheck: true,
    canCreateSettlement: false,
    canPersistHandoff: false,
    canCreateSettlementCandidate: false,
  },
];

const finalAcceptanceSettlementHandoffOperatorChecklistContract = {
  phase: "31Z",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Operator Checklist",
  sourcePhase: "31Y",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Readiness",
  nextSuggestedPhase: "32A",
  nextSuggestedSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Settlement Handoff Checklist Bridge Preview",
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
  ],
  sourceEvidence: phase31SourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  checklistMode: {
    settlementHandoffFacing: true,
    operatorChecklistFacing: true,
    finalAcceptanceHandoffPreflight: true,
    operatorReviewRequired: true,
    manualReviewOnly: true,
    deterministicChecklist: true,
    evidenceBacked: true,
    previewOnly: true,
    inspectOnly: true,
    readOnly: true,
  },
  checklistAssertions: {
    readinessSourceVerified: true,
    finalBridgeSmokeVerified: true,
    bridgePreviewVerified: true,
    finalAcceptanceChecklistVerified: true,
    evidenceLineageComplete: true,
    protectedHashesStable: true,
    settlementContextCreationBlocked: true,
    settlementHandoffPersistBlocked: true,
    settlementCandidateCreationBlocked: true,
    operatorDecisionPersistBlocked: true,
    autoAcceptanceBlocked: true,
    rawPayloadHiddenByDefault: true,
    noRuntimeWrites: true,
  },
  checklistSections: settlementHandoffChecklistSections,
  checklistPanels: [
    "settlement_handoff_operator_summary_panel",
    "manual_handoff_checklist_table",
    "final_acceptance_lineage_panel",
    "source_digest_matrix",
    "protected_hash_proof_panel",
    "blocked_settlement_action_matrix",
    "raw_payload_visibility_panel",
    "next_phase_bridge_preview_panel",
  ],
  checklistSummaryRows: [
    "source_phase_31y",
    "lineage_31e_to_31z",
    "checklist_sections_9",
    "manual_review_required",
    "settlement_context_creation_blocked",
    "settlement_handoff_persist_blocked",
    "settlement_candidate_creation_blocked",
    "operator_decision_persist_blocked",
    "raw_payload_hidden_by_default",
    "protected_hashes_stable",
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
  finalAcceptanceSettlementHandoffOperatorChecklistContract.fullLineage.slice(-9),
  ["31R", "31S", "31T", "31U", "31V", "31W", "31X", "31Y", "31Z"],
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
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffOperatorChecklistContract.sourceEvidence.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing settlement handoff checklist source evidence: ${expectedPhase}`,
  );
}

for (const modeKey of [
  "settlementHandoffFacing",
  "operatorChecklistFacing",
  "finalAcceptanceHandoffPreflight",
  "operatorReviewRequired",
  "manualReviewOnly",
  "deterministicChecklist",
  "evidenceBacked",
  "previewOnly",
  "inspectOnly",
  "readOnly",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistMode[
      modeKey
    ],
    true,
    `settlement handoff checklist mode key must be true: ${modeKey}`,
  );
}

for (const assertionKey of [
  "readinessSourceVerified",
  "finalBridgeSmokeVerified",
  "bridgePreviewVerified",
  "finalAcceptanceChecklistVerified",
  "evidenceLineageComplete",
  "protectedHashesStable",
  "settlementContextCreationBlocked",
  "settlementHandoffPersistBlocked",
  "settlementCandidateCreationBlocked",
  "operatorDecisionPersistBlocked",
  "autoAcceptanceBlocked",
  "rawPayloadHiddenByDefault",
  "noRuntimeWrites",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistAssertions[
      assertionKey
    ],
    true,
    `checklist assertion must be true: ${assertionKey}`,
  );
}

assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistSections
    .length,
  9,
  "settlement handoff operator checklist must expose 9 checklist sections",
);

for (const section of finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistSections) {
  assert.equal(section.defaultDecision, "pending_operator_review");
  assert.equal(section.requiresOperatorCheck, true);
  assert.equal(section.canCreateSettlement, false);
  assert.equal(section.canPersistHandoff, false);
  assert.equal(section.canCreateSettlementCandidate, false);
}

for (const panel of [
  "settlement_handoff_operator_summary_panel",
  "manual_handoff_checklist_table",
  "final_acceptance_lineage_panel",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_settlement_action_matrix",
  "raw_payload_visibility_panel",
  "next_phase_bridge_preview_panel",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistPanels.includes(
      panel,
    ),
    true,
    `missing settlement handoff checklist panel: ${panel}`,
  );
}

for (const row of [
  "source_phase_31y",
  "lineage_31e_to_31z",
  "checklist_sections_9",
  "manual_review_required",
  "settlement_context_creation_blocked",
  "settlement_handoff_persist_blocked",
  "settlement_candidate_creation_blocked",
  "operator_decision_persist_blocked",
  "raw_payload_hidden_by_default",
  "protected_hashes_stable",
]) {
  assert.equal(
    finalAcceptanceSettlementHandoffOperatorChecklistContract.checklistSummaryRows.includes(
      row,
    ),
    true,
    `missing settlement handoff checklist summary row: ${row}`,
  );
}

assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistContract.rawPayloadPolicy.hiddenByDefault,
  true,
);
assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistContract.rawPayloadPolicy.canInspectDigestOnly,
  true,
);
assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistContract.rawPayloadPolicy.defaultRender,
  "summary_cards_only",
);
assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistContract.rawPayloadPolicy.rawPayloadDefaultRenderBlocked,
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
    finalAcceptanceSettlementHandoffOperatorChecklistContract.blockedSettlementHandoffActions.includes(
      blockedAction,
    ),
    true,
    `missing blocked settlement handoff checklist action: ${blockedAction}`,
  );
}

assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.readOnly, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.previewOnly, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.inspectOnly, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.manualReviewOnly, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noAutoAcceptance, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noMcpToolRegistration, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noCanonWrite, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noActiveEngineUpdate, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noBridgeStateWrite, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noUiStatePersist, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noEvidencePacketPersist, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noFinalArchivePersist, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noOperatorDecisionPersist, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noSettlementContextCreation, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noSettlementHandoffPersist, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noSettlementCandidateCreation, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.noRecoveryExecution, true);
assert.equal(finalAcceptanceSettlementHandoffOperatorChecklistContract.policy.rawPayloadHiddenByDefault, true);

const finalAcceptanceSettlementHandoffOperatorChecklistDigest = `sha256:${sha256(
  stableStringify(finalAcceptanceSettlementHandoffOperatorChecklistContract),
)}`;

assert.match(
  finalAcceptanceSettlementHandoffOperatorChecklistDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final acceptance settlement handoff operator checklist digest must be a sha256 digest",
);

assert.equal(
  finalAcceptanceSettlementHandoffOperatorChecklistDigest,
  `sha256:${sha256(stableStringify(finalAcceptanceSettlementHandoffOperatorChecklistContract))}`,
  "final acceptance settlement handoff operator checklist digest must be deterministic",
);

console.log("Phase31Z final acceptance settlement handoff operator checklist passed");
console.log(
  `Phase31Z deterministic digest: ${finalAcceptanceSettlementHandoffOperatorChecklistDigest}`,
);
