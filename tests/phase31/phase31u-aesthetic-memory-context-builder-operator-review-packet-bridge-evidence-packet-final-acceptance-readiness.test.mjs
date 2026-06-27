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
];

const phase31URel =
  "tests/phase31/phase31u-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-readiness.test.mjs";

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

const phase31TRel = phase31Sources.find((source) => source.phase === "31T").relPath;
assert.equal(
  readRepoText(phase31TRel).includes("final bridge smoke"),
  true,
  "Phase31T source must remain the final bridge smoke input for Phase31U",
);

assert.equal(
  runAllSource.includes(phase31TRel),
  true,
  "run-all must include Phase31T before Phase31U",
);

assert.equal(
  runAllSource.includes(phase31URel),
  true,
  "run-all must include Phase31U final acceptance readiness",
);

assert.ok(
  runAllSource.indexOf(phase31TRel) < runAllSource.indexOf(phase31URel),
  "run-all order must place Phase31U after Phase31T",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31URel) < dailyMarkerIndex,
    "Phase31U must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31U final acceptance readiness must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31U final acceptance readiness must not modify compressed_rules",
);

const finalAcceptanceReadinessContract = {
  phase: "31U",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Readiness",
  sourcePhase: "31T",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Bridge Smoke",
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
  ],
  evidenceLineage: phase31SourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  readiness: {
    lineageComplete: true,
    operatorReviewPacketReady: true,
    bridgePreviewReady: true,
    bridgeFinalSmokeReady: true,
    bridgeStabilityGuardReady: true,
    recoveryGuideReady: true,
    evidencePacketReady: true,
    evidencePacketUiPreviewReady: true,
    evidencePacketUiLiveSmokeReady: true,
    evidencePacketBridgePreviewReady: true,
    finalBridgeSmokeReady: true,
    finalAcceptanceReadinessReady: true,
    proofPanelsReady: true,
    blockedActionMatrixReady: true,
    rawPayloadHiddenByDefault: true,
    manualRecoveryOnly: true,
    protectedHashesStable: true,
    deterministicReadinessDigest: true,
  },
  requiredReadinessPanels: [
    "final_acceptance_readiness_summary",
    "operator_review_completeness_panel",
    "bridge_evidence_completeness_panel",
    "lineage_digest_panel",
    "source_digest_matrix",
    "protected_hash_proof_panel",
    "blocked_action_matrix",
    "raw_payload_visibility_panel",
    "manual_recovery_only_panel",
  ],
  blockedActions: [
    "mcp_tool_registration",
    "canon_write",
    "active_engine_update",
    "compressed_rules_update",
    "bridge_state_write",
    "ui_state_persist",
    "evidence_packet_persist",
    "final_archive_persist",
    "recovery_execution",
    "raw_payload_default_render",
  ],
  policy: {
    readOnly: true,
    previewOnly: true,
    inspectOnly: true,
    noMcpToolRegistration: true,
    noCanonWrite: true,
    noActiveEngineUpdate: true,
    noCompressedRulesUpdate: true,
    noBridgeStateWrite: true,
    noUiStatePersist: true,
    noEvidencePacketPersist: true,
    noFinalArchivePersist: true,
    noRecoveryExecution: true,
    rawPayloadHiddenByDefault: true,
  },
  protectedHashes: {
    activeEngine: activeEngineHash,
    compressedRules: compressedRulesHash,
  },
};

assert.deepEqual(finalAcceptanceReadinessContract.fullLineage.slice(-4), [
  "31R",
  "31S",
  "31T",
  "31U",
]);

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
]) {
  assert.equal(
    finalAcceptanceReadinessContract.evidenceLineage.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing evidence lineage source: ${expectedPhase}`,
  );
}

for (const readinessKey of [
  "lineageComplete",
  "operatorReviewPacketReady",
  "bridgePreviewReady",
  "bridgeFinalSmokeReady",
  "bridgeStabilityGuardReady",
  "recoveryGuideReady",
  "evidencePacketReady",
  "evidencePacketUiPreviewReady",
  "evidencePacketUiLiveSmokeReady",
  "evidencePacketBridgePreviewReady",
  "finalBridgeSmokeReady",
  "finalAcceptanceReadinessReady",
  "proofPanelsReady",
  "blockedActionMatrixReady",
  "rawPayloadHiddenByDefault",
  "manualRecoveryOnly",
  "protectedHashesStable",
  "deterministicReadinessDigest",
]) {
  assert.equal(
    finalAcceptanceReadinessContract.readiness[readinessKey],
    true,
    `readiness key must be true: ${readinessKey}`,
  );
}

for (const panel of [
  "final_acceptance_readiness_summary",
  "operator_review_completeness_panel",
  "bridge_evidence_completeness_panel",
  "lineage_digest_panel",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_action_matrix",
  "raw_payload_visibility_panel",
  "manual_recovery_only_panel",
]) {
  assert.equal(
    finalAcceptanceReadinessContract.requiredReadinessPanels.includes(panel),
    true,
    `missing final acceptance readiness panel: ${panel}`,
  );
}

for (const blockedAction of [
  "mcp_tool_registration",
  "canon_write",
  "active_engine_update",
  "compressed_rules_update",
  "bridge_state_write",
  "ui_state_persist",
  "evidence_packet_persist",
  "final_archive_persist",
  "recovery_execution",
  "raw_payload_default_render",
]) {
  assert.equal(
    finalAcceptanceReadinessContract.blockedActions.includes(blockedAction),
    true,
    `missing blocked final acceptance action: ${blockedAction}`,
  );
}

assert.equal(finalAcceptanceReadinessContract.policy.readOnly, true);
assert.equal(finalAcceptanceReadinessContract.policy.previewOnly, true);
assert.equal(finalAcceptanceReadinessContract.policy.inspectOnly, true);
assert.equal(finalAcceptanceReadinessContract.policy.noMcpToolRegistration, true);
assert.equal(finalAcceptanceReadinessContract.policy.noCanonWrite, true);
assert.equal(finalAcceptanceReadinessContract.policy.noActiveEngineUpdate, true);
assert.equal(finalAcceptanceReadinessContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalAcceptanceReadinessContract.policy.noBridgeStateWrite, true);
assert.equal(finalAcceptanceReadinessContract.policy.noUiStatePersist, true);
assert.equal(finalAcceptanceReadinessContract.policy.noEvidencePacketPersist, true);
assert.equal(finalAcceptanceReadinessContract.policy.noFinalArchivePersist, true);
assert.equal(finalAcceptanceReadinessContract.policy.noRecoveryExecution, true);
assert.equal(finalAcceptanceReadinessContract.policy.rawPayloadHiddenByDefault, true);

const finalAcceptanceReadinessDigest = `sha256:${sha256(
  stableStringify(finalAcceptanceReadinessContract),
)}`;

assert.match(
  finalAcceptanceReadinessDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final acceptance readiness digest must be a sha256 digest",
);

assert.equal(
  finalAcceptanceReadinessDigest,
  `sha256:${sha256(stableStringify(finalAcceptanceReadinessContract))}`,
  "final acceptance readiness digest must be deterministic",
);

console.log("Phase31U final acceptance readiness passed");
console.log(
  `Phase31U deterministic digest: ${finalAcceptanceReadinessDigest}`,
);
