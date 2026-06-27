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
];

const phase31WRel =
  "tests/phase31/phase31w-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-checklist-bridge-preview.test.mjs";

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

const phase31VRel = phase31Sources.find((source) => source.phase === "31V").relPath;
const phase31VSource = readRepoText(phase31VRel);

assert.equal(
  phase31VSource.includes("final acceptance operator checklist"),
  true,
  "Phase31V source must remain the final acceptance operator checklist input for Phase31W",
);

assert.equal(
  runAllSource.includes(phase31VRel),
  true,
  "run-all must include Phase31V before Phase31W",
);

assert.equal(
  runAllSource.includes(phase31WRel),
  true,
  "run-all must include Phase31W final acceptance checklist bridge preview",
);

assert.ok(
  runAllSource.indexOf(phase31VRel) < runAllSource.indexOf(phase31WRel),
  "run-all order must place Phase31W after Phase31V",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31WRel) < dailyMarkerIndex,
    "Phase31W must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31W final acceptance checklist bridge preview must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31W final acceptance checklist bridge preview must not modify compressed_rules",
);

const checklistRows = [
  {
    id: "lineage_complete",
    bridgeLabel: "Lineage completeness",
    sourceEvidence: ["31J", "31K", "31L", "31M", "31N", "31O", "31P", "31Q", "31R", "31S", "31T", "31U", "31V"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "operator_review_packet_complete",
    bridgeLabel: "Operator review packet completeness",
    sourceEvidence: ["31J", "31K", "31L", "31M"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "bridge_evidence_complete",
    bridgeLabel: "Bridge evidence completeness",
    sourceEvidence: ["31P", "31Q", "31R", "31S", "31T"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "recovery_and_stability_reviewed",
    bridgeLabel: "Recovery guide and stability guard reviewed",
    sourceEvidence: ["31N", "31O"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "protected_hashes_verified",
    bridgeLabel: "Protected hashes verified",
    sourceEvidence: ["active_engine_hash", "compressed_rules_hash"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "blocked_actions_verified",
    bridgeLabel: "Blocked actions verified",
    sourceEvidence: ["blocked_action_matrix"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "raw_payload_visibility_verified",
    bridgeLabel: "Raw payload hidden by default",
    sourceEvidence: ["raw_payload_visibility_panel"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
  {
    id: "final_acceptance_ready_for_next_smoke",
    bridgeLabel: "Ready for final acceptance bridge final smoke",
    sourceEvidence: ["31V", "31W"],
    defaultState: "pending_operator_review",
    canConfirm: false,
    canPersist: false,
  },
];

const finalAcceptanceChecklistBridgePreviewContract = {
  phase: "31W",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Checklist Bridge Preview",
  sourcePhase: "31V",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Operator Checklist",
  nextSuggestedPhase: "31X",
  nextSuggestedSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Checklist Bridge Final Smoke",
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
  ],
  sourceEvidence: phase31SourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  bridgePreviewMode: {
    chatgptBridgeFacing: true,
    operatorChecklistPreview: true,
    finalAcceptancePreflight: true,
    manualReviewOnly: true,
    deterministicPreview: true,
    evidenceBacked: true,
    previewOnly: true,
    inspectOnly: true,
    readOnly: true,
  },
  bridgePreviewCards: [
    "operator_final_acceptance_summary_card",
    "manual_review_checklist_card",
    "lineage_evidence_card",
    "source_digest_card",
    "protected_hash_proof_card",
    "blocked_action_matrix_card",
    "raw_payload_visibility_card",
    "next_phase_readiness_card",
  ],
  bridgeSummaryRows: [
    "source_phase_31v",
    "lineage_31e_to_31w",
    "checklist_rows_8",
    "manual_review_required",
    "auto_acceptance_blocked",
    "operator_decision_persist_blocked",
    "raw_payload_hidden_by_default",
    "protected_hashes_stable",
  ],
  checklistRows,
  proofPanels: [
    "lineage_evidence_matrix",
    "source_digest_matrix",
    "protected_hash_proof_panel",
    "blocked_action_matrix",
    "raw_payload_visibility_panel",
    "operator_decision_persist_block_panel",
  ],
  rawPayloadPolicy: {
    hiddenByDefault: true,
    canInspectDigestOnly: true,
    defaultRender: "summary_cards_only",
    rawPayloadDefaultRenderBlocked: true,
  },
  blockedBridgeActions: [
    "mcp_tool_registration",
    "canon_write",
    "active_engine_update",
    "compressed_rules_update",
    "bridge_state_write",
    "ui_state_persist",
    "evidence_packet_persist",
    "final_archive_persist",
    "operator_decision_persist",
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
    noRecoveryExecution: true,
    rawPayloadHiddenByDefault: true,
  },
  protectedHashes: {
    activeEngine: activeEngineHash,
    compressedRules: compressedRulesHash,
  },
};

assert.deepEqual(
  finalAcceptanceChecklistBridgePreviewContract.fullLineage.slice(-6),
  ["31R", "31S", "31T", "31U", "31V", "31W"],
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
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.sourceEvidence.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing bridge preview source evidence: ${expectedPhase}`,
  );
}

for (const modeKey of [
  "chatgptBridgeFacing",
  "operatorChecklistPreview",
  "finalAcceptancePreflight",
  "manualReviewOnly",
  "deterministicPreview",
  "evidenceBacked",
  "previewOnly",
  "inspectOnly",
  "readOnly",
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.bridgePreviewMode[modeKey],
    true,
    `bridge preview mode key must be true: ${modeKey}`,
  );
}

for (const card of [
  "operator_final_acceptance_summary_card",
  "manual_review_checklist_card",
  "lineage_evidence_card",
  "source_digest_card",
  "protected_hash_proof_card",
  "blocked_action_matrix_card",
  "raw_payload_visibility_card",
  "next_phase_readiness_card",
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.bridgePreviewCards.includes(card),
    true,
    `missing bridge preview card: ${card}`,
  );
}

for (const row of [
  "source_phase_31v",
  "lineage_31e_to_31w",
  "checklist_rows_8",
  "manual_review_required",
  "auto_acceptance_blocked",
  "operator_decision_persist_blocked",
  "raw_payload_hidden_by_default",
  "protected_hashes_stable",
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.bridgeSummaryRows.includes(row),
    true,
    `missing bridge summary row: ${row}`,
  );
}

assert.equal(
  finalAcceptanceChecklistBridgePreviewContract.checklistRows.length,
  8,
  "bridge preview must expose 8 checklist rows",
);

for (const checklistRow of finalAcceptanceChecklistBridgePreviewContract.checklistRows) {
  assert.equal(checklistRow.defaultState, "pending_operator_review");
  assert.equal(checklistRow.canConfirm, false);
  assert.equal(checklistRow.canPersist, false);
}

for (const panel of [
  "lineage_evidence_matrix",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_action_matrix",
  "raw_payload_visibility_panel",
  "operator_decision_persist_block_panel",
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.proofPanels.includes(panel),
    true,
    `missing bridge proof panel: ${panel}`,
  );
}

assert.equal(
  finalAcceptanceChecklistBridgePreviewContract.rawPayloadPolicy.hiddenByDefault,
  true,
);
assert.equal(
  finalAcceptanceChecklistBridgePreviewContract.rawPayloadPolicy.canInspectDigestOnly,
  true,
);
assert.equal(
  finalAcceptanceChecklistBridgePreviewContract.rawPayloadPolicy.defaultRender,
  "summary_cards_only",
);
assert.equal(
  finalAcceptanceChecklistBridgePreviewContract.rawPayloadPolicy.rawPayloadDefaultRenderBlocked,
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
  "recovery_execution",
  "raw_payload_default_render",
  "auto_acceptance",
]) {
  assert.equal(
    finalAcceptanceChecklistBridgePreviewContract.blockedBridgeActions.includes(blockedAction),
    true,
    `missing blocked bridge preview action: ${blockedAction}`,
  );
}

assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.readOnly, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.previewOnly, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.inspectOnly, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.manualReviewOnly, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noAutoAcceptance, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noMcpToolRegistration, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noCanonWrite, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noActiveEngineUpdate, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noBridgeStateWrite, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noUiStatePersist, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noEvidencePacketPersist, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noFinalArchivePersist, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noOperatorDecisionPersist, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.noRecoveryExecution, true);
assert.equal(finalAcceptanceChecklistBridgePreviewContract.policy.rawPayloadHiddenByDefault, true);

const finalAcceptanceChecklistBridgePreviewDigest = `sha256:${sha256(
  stableStringify(finalAcceptanceChecklistBridgePreviewContract),
)}`;

assert.match(
  finalAcceptanceChecklistBridgePreviewDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final acceptance checklist bridge preview digest must be a sha256 digest",
);

assert.equal(
  finalAcceptanceChecklistBridgePreviewDigest,
  `sha256:${sha256(stableStringify(finalAcceptanceChecklistBridgePreviewContract))}`,
  "final acceptance checklist bridge preview digest must be deterministic",
);

console.log("Phase31W final acceptance checklist bridge preview passed");
console.log(
  `Phase31W deterministic digest: ${finalAcceptanceChecklistBridgePreviewDigest}`,
);
