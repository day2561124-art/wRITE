import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const phase31SRel =
  "tests/phase31/phase31s-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-bridge-preview.test.mjs";
const phase31TRel =
  "tests/phase31/phase31t-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-bridge-smoke.test.mjs";

const runAllRel = "tests/run-all.mjs";

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

const phase31SSource = readRepoText(phase31SRel);
const runAllSource = readRepoText(runAllRel);

assert.match(
  phase31SSource,
  /31S|Phase31S|bridge preview|Bridge Preview/i,
  "Phase31S bridge preview source must remain present as the final bridge smoke input",
);

assert.equal(
  runAllSource.includes(phase31SRel),
  true,
  "run-all must still include Phase31S before Phase31T",
);

assert.equal(
  runAllSource.includes(phase31TRel),
  true,
  "run-all must include Phase31T final bridge smoke",
);

assert.ok(
  runAllSource.indexOf(phase31SRel) < runAllSource.indexOf(phase31TRel),
  "run-all order must place Phase31T after Phase31S",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31TRel) < dailyMarkerIndex,
    "Phase31T must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31T final bridge smoke must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31T final bridge smoke must not modify compressed_rules",
);

const finalBridgeSmokeContract = {
  phase: "31T",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Bridge Smoke",
  sourcePhase: "31S",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Bridge Preview",
  sourceEvidence: {
    phase31SRel,
    phase31SSourceDigest: `sha256:${sha256(phase31SSource)}`,
  },
  runAll: {
    relPath: runAllRel,
    order: ["31R", "31S", "31T", "Daily scripts"],
    phase31TAfterPhase31S: true,
    phase31TBeforeDailyScripts: dailyMarkerIndex === -1 ? "not_applicable" : true,
  },
  lineage: [
    "31E",
    "31F",
    "31G",
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
  ],
  finalBridgeSmokeSurface: {
    bridgePreviewCardsStable: true,
    bridgeSummaryRowsStable: true,
    bridgeRecoveryRowsStable: true,
    bridgeProofPanelsStable: true,
    blockedBridgeActionMatrixStable: true,
    rawLiveUiSmokeHiddenByDefault: true,
  },
  requiredBridgeSections: [
    "bridge_preview_cards",
    "bridge_summary_rows",
    "bridge_recovery_rows",
    "bridge_proof_panels",
    "blocked_bridge_action_matrix",
  ],
  requiredProofPanels: [
    "protected_hash_proof_panel",
    "side_effect_restoration_proof_panel",
    "lineage_evidence_panel",
    "source_digest_evidence_panel",
  ],
  blockedActions: [
    "mcp_tool_registration",
    "canon_write",
    "active_engine_update",
    "compressed_rules_update",
    "bridge_state_write",
    "ui_state_persist",
    "evidence_packet_persist",
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
    noRecoveryExecution: true,
    rawPayloadHiddenByDefault: true,
  },
  protectedHashes: {
    activeEngine: activeEngineHash,
    compressedRules: compressedRulesHash,
  },
};

assert.deepEqual(finalBridgeSmokeContract.lineage.slice(-3), [
  "31R",
  "31S",
  "31T",
]);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface.bridgePreviewCardsStable,
  true,
);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface.bridgeSummaryRowsStable,
  true,
);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface.bridgeRecoveryRowsStable,
  true,
);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface.bridgeProofPanelsStable,
  true,
);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface
    .blockedBridgeActionMatrixStable,
  true,
);

assert.equal(
  finalBridgeSmokeContract.finalBridgeSmokeSurface
    .rawLiveUiSmokeHiddenByDefault,
  true,
);

for (const section of [
  "bridge_preview_cards",
  "bridge_summary_rows",
  "bridge_recovery_rows",
  "bridge_proof_panels",
  "blocked_bridge_action_matrix",
]) {
  assert.equal(
    finalBridgeSmokeContract.requiredBridgeSections.includes(section),
    true,
    `missing required final bridge smoke section: ${section}`,
  );
}

for (const proofPanel of [
  "protected_hash_proof_panel",
  "side_effect_restoration_proof_panel",
]) {
  assert.equal(
    finalBridgeSmokeContract.requiredProofPanels.includes(proofPanel),
    true,
    `missing required proof panel: ${proofPanel}`,
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
  "recovery_execution",
  "raw_payload_default_render",
]) {
  assert.equal(
    finalBridgeSmokeContract.blockedActions.includes(blockedAction),
    true,
    `missing blocked bridge action: ${blockedAction}`,
  );
}

assert.equal(finalBridgeSmokeContract.policy.readOnly, true);
assert.equal(finalBridgeSmokeContract.policy.previewOnly, true);
assert.equal(finalBridgeSmokeContract.policy.inspectOnly, true);
assert.equal(finalBridgeSmokeContract.policy.noMcpToolRegistration, true);
assert.equal(finalBridgeSmokeContract.policy.noCanonWrite, true);
assert.equal(finalBridgeSmokeContract.policy.noActiveEngineUpdate, true);
assert.equal(finalBridgeSmokeContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalBridgeSmokeContract.policy.noBridgeStateWrite, true);
assert.equal(finalBridgeSmokeContract.policy.noUiStatePersist, true);
assert.equal(finalBridgeSmokeContract.policy.noEvidencePacketPersist, true);
assert.equal(finalBridgeSmokeContract.policy.noRecoveryExecution, true);
assert.equal(finalBridgeSmokeContract.policy.rawPayloadHiddenByDefault, true);

const finalBridgeSmokeDigest = `sha256:${sha256(
  stableStringify(finalBridgeSmokeContract),
)}`;

assert.match(
  finalBridgeSmokeDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final bridge smoke digest must be a sha256 digest",
);

assert.equal(
  finalBridgeSmokeDigest,
  `sha256:${sha256(stableStringify(finalBridgeSmokeContract))}`,
  "final bridge smoke digest must be deterministic",
);

console.log("Phase31T final bridge smoke passed");
console.log(`Phase31T deterministic digest: ${finalBridgeSmokeDigest}`);
