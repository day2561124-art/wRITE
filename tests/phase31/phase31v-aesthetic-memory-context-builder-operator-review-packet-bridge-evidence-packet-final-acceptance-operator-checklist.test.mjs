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
];

const phase31VRel =
  "tests/phase31/phase31v-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-operator-checklist.test.mjs";

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

const phase31URel = phase31Sources.find((source) => source.phase === "31U").relPath;
const phase31USource = readRepoText(phase31URel);

assert.equal(
  phase31USource.includes("final acceptance readiness"),
  true,
  "Phase31U source must remain the final acceptance readiness input for Phase31V",
);

assert.equal(
  runAllSource.includes(phase31URel),
  true,
  "run-all must include Phase31U before Phase31V",
);

assert.equal(
  runAllSource.includes(phase31VRel),
  true,
  "run-all must include Phase31V final acceptance operator checklist",
);

assert.ok(
  runAllSource.indexOf(phase31URel) < runAllSource.indexOf(phase31VRel),
  "run-all order must place Phase31V after Phase31U",
);

const dailyMarkerIndex = runAllSource.search(/daily/i);
if (dailyMarkerIndex !== -1) {
  assert.ok(
    runAllSource.indexOf(phase31VRel) < dailyMarkerIndex,
    "Phase31V must remain before Daily scripts when a Daily marker is present",
  );
}

const activeEngineHash = sha256(readRepoBytes(activeEngineRel));
const compressedRulesHash = sha256(readRepoBytes(compressedRulesRel));

assert.equal(
  activeEngineHash,
  expectedActiveEngineHash,
  "Phase31V final acceptance operator checklist must not modify active_engine",
);

assert.equal(
  compressedRulesHash,
  expectedCompressedRulesHash,
  "Phase31V final acceptance operator checklist must not modify compressed_rules",
);

const finalAcceptanceOperatorChecklistContract = {
  phase: "31V",
  title:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Operator Checklist",
  sourcePhase: "31U",
  sourceSurface:
    "Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Final Acceptance Readiness",
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
  ],
  sourceEvidence: phase31SourceEvidence.map((source) => ({
    phase: source.phase,
    role: source.role,
    relPath: source.relPath,
    sourceDigest: source.sourceDigest,
  })),
  checklistMode: {
    operatorFacing: true,
    finalAcceptancePreflight: true,
    manualReviewOnly: true,
    deterministicChecklist: true,
    evidenceBacked: true,
    previewOnly: true,
    inspectOnly: true,
    readOnly: true,
  },
  checklistSections: [
    {
      id: "lineage_complete",
      label: "Lineage completeness",
      requiresHumanReview: true,
      requiredEvidence: ["31J", "31K", "31L", "31M", "31N", "31O", "31P", "31Q", "31R", "31S", "31T", "31U"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "operator_review_packet_complete",
      label: "Operator review packet completeness",
      requiresHumanReview: true,
      requiredEvidence: ["31J", "31K", "31L", "31M"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "bridge_evidence_complete",
      label: "Bridge evidence completeness",
      requiresHumanReview: true,
      requiredEvidence: ["31P", "31Q", "31R", "31S", "31T"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "recovery_and_stability_reviewed",
      label: "Recovery guide and stability guard reviewed",
      requiresHumanReview: true,
      requiredEvidence: ["31N", "31O"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "protected_hashes_verified",
      label: "Protected hashes verified",
      requiresHumanReview: true,
      requiredEvidence: ["active_engine_hash", "compressed_rules_hash"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "blocked_actions_verified",
      label: "Blocked actions verified",
      requiresHumanReview: true,
      requiredEvidence: ["blocked_action_matrix"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "raw_payload_visibility_verified",
      label: "Raw payload hidden by default",
      requiresHumanReview: true,
      requiredEvidence: ["raw_payload_visibility_panel"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
    {
      id: "final_acceptance_ready_for_next_preview",
      label: "Ready for final acceptance bridge preview",
      requiresHumanReview: true,
      requiredEvidence: ["31U", "31V"],
      defaultDecision: "pending_operator_review",
      canAutoAccept: false,
    },
  ],
  requiredChecklistPanels: [
    "operator_final_acceptance_summary",
    "manual_review_checklist_table",
    "lineage_evidence_matrix",
    "source_digest_matrix",
    "protected_hash_proof_panel",
    "blocked_action_matrix",
    "raw_payload_visibility_panel",
    "next_phase_readiness_panel",
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

assert.deepEqual(finalAcceptanceOperatorChecklistContract.fullLineage.slice(-5), [
  "31R",
  "31S",
  "31T",
  "31U",
  "31V",
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
  "31U",
]) {
  assert.equal(
    finalAcceptanceOperatorChecklistContract.sourceEvidence.some(
      (source) => source.phase === expectedPhase,
    ),
    true,
    `missing checklist source evidence: ${expectedPhase}`,
  );
}

for (const modeKey of [
  "operatorFacing",
  "finalAcceptancePreflight",
  "manualReviewOnly",
  "deterministicChecklist",
  "evidenceBacked",
  "previewOnly",
  "inspectOnly",
  "readOnly",
]) {
  assert.equal(
    finalAcceptanceOperatorChecklistContract.checklistMode[modeKey],
    true,
    `checklist mode key must be true: ${modeKey}`,
  );
}

for (const checklistId of [
  "lineage_complete",
  "operator_review_packet_complete",
  "bridge_evidence_complete",
  "recovery_and_stability_reviewed",
  "protected_hashes_verified",
  "blocked_actions_verified",
  "raw_payload_visibility_verified",
  "final_acceptance_ready_for_next_preview",
]) {
  const section = finalAcceptanceOperatorChecklistContract.checklistSections.find(
    (item) => item.id === checklistId,
  );

  assert.ok(section, `missing checklist section: ${checklistId}`);
  assert.equal(section.requiresHumanReview, true);
  assert.equal(section.defaultDecision, "pending_operator_review");
  assert.equal(section.canAutoAccept, false);
}

for (const panel of [
  "operator_final_acceptance_summary",
  "manual_review_checklist_table",
  "lineage_evidence_matrix",
  "source_digest_matrix",
  "protected_hash_proof_panel",
  "blocked_action_matrix",
  "raw_payload_visibility_panel",
  "next_phase_readiness_panel",
]) {
  assert.equal(
    finalAcceptanceOperatorChecklistContract.requiredChecklistPanels.includes(panel),
    true,
    `missing final acceptance operator checklist panel: ${panel}`,
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
  "operator_decision_persist",
  "recovery_execution",
  "raw_payload_default_render",
  "auto_acceptance",
]) {
  assert.equal(
    finalAcceptanceOperatorChecklistContract.blockedActions.includes(blockedAction),
    true,
    `missing blocked final acceptance checklist action: ${blockedAction}`,
  );
}

assert.equal(finalAcceptanceOperatorChecklistContract.policy.readOnly, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.previewOnly, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.inspectOnly, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.manualReviewOnly, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noAutoAcceptance, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noMcpToolRegistration, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noCanonWrite, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noActiveEngineUpdate, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noCompressedRulesUpdate, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noBridgeStateWrite, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noUiStatePersist, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noEvidencePacketPersist, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noFinalArchivePersist, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noOperatorDecisionPersist, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.noRecoveryExecution, true);
assert.equal(finalAcceptanceOperatorChecklistContract.policy.rawPayloadHiddenByDefault, true);

const finalAcceptanceOperatorChecklistDigest = `sha256:${sha256(
  stableStringify(finalAcceptanceOperatorChecklistContract),
)}`;

assert.match(
  finalAcceptanceOperatorChecklistDigest,
  /^sha256:[a-f0-9]{64}$/,
  "final acceptance operator checklist digest must be a sha256 digest",
);

assert.equal(
  finalAcceptanceOperatorChecklistDigest,
  `sha256:${sha256(stableStringify(finalAcceptanceOperatorChecklistContract))}`,
  "final acceptance operator checklist digest must be deterministic",
);

console.log("Phase31V final acceptance operator checklist passed");
console.log(
  `Phase31V deterministic digest: ${finalAcceptanceOperatorChecklistDigest}`,
);
