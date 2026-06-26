import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildForeshadowingSettlementOperatorReviewChainIndex,
} from "../../server/src/foreshadowing-settlement-operator-review-chain-index-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const runAllPath = path.join(rootDir, "tests", "run-all.mjs");
const phase28qTestPath = path.join(
  rootDir,
  "tests",
  "phase28",
  "phase28q-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-contract.test.mjs",
);
const servicePath = path.join(
  rootDir,
  "server",
  "src",
  "foreshadowing-settlement-operator-review-chain-index-service.mjs",
);
const uiIndexPath = path.join(rootDir, "server", "ui", "index.html");
const uiAppPath = path.join(rootDir, "server", "ui", "app.js");

const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const settlementContextsDir = path.join(rootDir, "data", "outputs", "settlement_contexts");
const settlementReportsDir = path.join(rootDir, "data", "outputs", "settlement_reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "logs", "approval_log.jsonl");
const backupProjectDir = path.join(rootDir, "data", "backups", "project_backups");
const backupExportsDir = path.join(rootDir, "data", "backups", "exports");
const restorePreviewsDir = path.join(rootDir, "data", "backups", "restore_previews");
const archiveFilesDir = path.join(rootDir, "data", "audit_retention", "archives");
const archiveIndexDir = path.join(rootDir, "data", "audit_retention", "archive_index");
const archiveManifestDir = path.join(rootDir, "data", "audit_retention", "archive_manifests");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

const phase28qRegistration =
  "tests/phase28/phase28q-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-contract.test.mjs";
const phase28rRegistration =
  "tests/phase28/phase28r-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-final-smoke.test.mjs";
const dailyScriptsRegistration = "tests/scripts/daily-scripts.test.mjs";

const expectedRunAllRegistrations = [
  "tests/phase28/phase28a-foreshadowing-settlement-operator-review-chain-index.test.mjs",
  "tests/phase28/phase28g-foreshadowing-settlement-operator-review-chain-index-evidence-packet-export-contract.test.mjs",
  "tests/phase28/phase28h-foreshadowing-settlement-operator-review-chain-index-evidence-packet-ui-preview-contract.test.mjs",
  "tests/phase28/phase28i-foreshadowing-settlement-operator-review-chain-index-evidence-packet-bridge-preview-contract.test.mjs",
  "tests/phase28/phase28j-foreshadowing-settlement-operator-review-chain-index-evidence-packet-operator-handoff-final-smoke.test.mjs",
  "tests/phase28/phase28k-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-readiness-contract.test.mjs",
  "tests/phase28/phase28l-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-ui-preview-contract.test.mjs",
  "tests/phase28/phase28m-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-bridge-preview-contract.test.mjs",
  "tests/phase28/phase28n-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-operator-handoff-final-smoke.test.mjs",
  "tests/phase28/phase28o-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-readiness-contract.test.mjs",
  "tests/phase28/phase28p-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-operator-checklist.test.mjs",
  phase28qRegistration,
  phase28rRegistration,
];

const expectedSourceChainPhases = [
  "28A",
  "28G",
  "28H",
  "28I",
  "28J",
  "28K",
  "28L",
  "28M",
  "28N",
  "28O",
  "28P",
  "28Q",
];

const expectedFinalSmokeVisibleSections = [
  "smoke_header",
  "source_checklist_bridge_preview_contract",
  "operator_checklist_preview",
  "blocking_conditions",
  "blocked_operator_actions",
  "retention_manifest",
  "source_chain",
  "bridge_readability",
  "raw_json_preview",
  "no_mutation_snapshot",
  "safety_boundary",
];

const expectedFinalSmokeCheckpoints = [
  "verify_phase_28q_contract_registered",
  "verify_run_all_order_28q_to_28r_to_daily",
  "verify_operator_checklist_preview_visible",
  "verify_blocking_conditions_visible",
  "verify_blocked_operator_actions_visible",
  "verify_retention_manifest_visible",
  "verify_source_chain_28a_to_28q_visible",
  "verify_raw_json_preview_visible",
  "verify_no_mutation_snapshot_visible",
  "verify_no_execution_capabilities_enabled",
  "verify_protected_hashes_unchanged",
  "verify_future_materialization_requires_new_phase",
];

const expectedBlockedBridgeCapabilities = [
  "complete_checklist_as_approval",
  "accept_final_archive_manifest",
  "materialize_archive_file",
  "write_archive_index",
  "write_archive_manifest",
  "approve",
  "confirm_adoption",
  "activate_engine",
  "auto_adopt",
  "auto_settle",
  "write_canon",
  "create_pending_engine_candidate",
  "update_compressed_rules",
  "restore_backup",
  "rollback",
  "modify_runtime_bridge",
  "modify_runtime_ui",
  "register_mcp_tool",
];

const expectedRequiredPhase28qTokens = [
  "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview",
  "phase28q_archive_manifest_checklist_bridge_preview_contract_v1",
  "archive_manifest_operator_checklist_bridge_preview",
  "chatgpt_bridge_readable_archive_manifest_operator_checklist_handoff",
  "source_operator_checklist_digest",
  "source_final_acceptance_readiness_digest",
  "source_operator_handoff_smoke_digest",
  "source_archive_manifest_bridge_preview_digest",
  "operator_checklist",
  "bridge_readability",
  "allowed_bridge_actions",
  "blocked_bridge_capabilities",
  "raw_json_preview",
  "raw_json_checklist_visible",
  "requires_human_approval",
  "requires_operator_confirmation",
  "future_archive_materialization_requires_new_phase",
  "cannot materialize archives",
  "not an approval",
  "not final acceptance execution",
  "not archive materialization",
];

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function readOptionalDirectory(dirPath) {
  try {
    return (await readdir(dirPath)).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be an array.`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} item key must be a string.`);
    assert.notEqual(item.key.trim(), "", `${label} item key must not be empty.`);
    assert.equal(map.has(item.key), false, `${label} has duplicate key ${item.key}.`);
    map.set(item.key, item);
  }
  return map;
}

function assertRunAllOrder(runAllText) {
  for (const registration of expectedRunAllRegistrations) {
    assert(runAllText.includes(registration), `run-all missing ${registration}.`);
  }

  for (let index = 1; index < expectedRunAllRegistrations.length; index += 1) {
    assert(
      runAllText.indexOf(expectedRunAllRegistrations[index - 1])
        < runAllText.indexOf(expectedRunAllRegistrations[index]),
      `run-all should execute ${expectedRunAllRegistrations[index - 1]} before ${expectedRunAllRegistrations[index]}.`,
    );
  }

  assert(
    runAllText.indexOf(phase28qRegistration) < runAllText.indexOf(phase28rRegistration),
    "run-all should execute Phase 28Q before Phase 28R.",
  );
  assert(
    runAllText.indexOf(phase28rRegistration) < runAllText.indexOf(dailyScriptsRegistration),
    "run-all should execute Phase 28R before Daily scripts and docs.",
  );
}

function assertStaticSourceTokens({ serviceText, uiIndexText, uiAppText, phase28qText }) {
  for (const token of [
    "chain_segments",
    "phase_rows",
    "cards",
    "operator_entrypoints",
    "prohibited_actions",
    "safety",
    "checks",
    "integrity",
    "index_markdown",
  ]) {
    assert(serviceText.includes(token), `28R service missing final smoke source token: ${token}`);
  }

  for (const token of [
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "foreshadowing-settlement-operator-review-chain-index-surface-raw",
    "Chain segments",
    "Indexed phases",
    "Operator entrypoints",
    "Prohibited actions",
    "Safety boundary",
  ]) {
    assert(uiIndexText.includes(token), `28R existing UI HTML missing final smoke source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28R existing app.js missing final smoke source token: ${token}`);
  }

  for (const token of expectedRequiredPhase28qTokens) {
    assert(phase28qText.includes(token), `28R Phase 28Q source contract missing required bridge token: ${token}`);
  }
}

function buildPhase28rFinalSmoke({ index, phase28qText, runAllText }) {
  const sourceIndexDigest = stableDigest({
    index_kind: index.index_kind,
    version: index.version,
    phase: index.phase,
    source_phase: index.source_phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
  });

  const phase28qContractFileDigest = hashText(phase28qText);
  const phase28qRegistrationDigest = stableDigest({
    phase: "28Q",
    registration: phase28qRegistration,
    registered_before_daily_scripts: runAllText.indexOf(phase28qRegistration) < runAllText.indexOf(dailyScriptsRegistration),
    file_digest: phase28qContractFileDigest,
  });

  const sourceChain = expectedSourceChainPhases.map((phase, order) => ({
    key: phase,
    phase,
    order,
    digest_key:
      phase === "28A"
        ? "source_index_digest"
        : phase === "28Q"
          ? "checklist_bridge_preview_contract_digest"
          : `phase_${phase.toLowerCase()}_lineage_digest`,
    digest:
      phase === "28A"
        ? sourceIndexDigest
        : phase === "28Q"
          ? phase28qRegistrationDigest
          : stableDigest({
              phase,
              source_index_digest: sourceIndexDigest,
              source_phase28q_contract_file_digest: phase28qContractFileDigest,
              lineage_position: order,
            }),
    retained: true,
    visible: true,
    copyable: true,
  }));

  const finalSmokeCheckpoints = expectedFinalSmokeCheckpoints.map((key, order) => ({
    key,
    order,
    passed_by_contract: true,
    required: true,
    final_smoke_only: true,
    cannot_execute: true,
    reason: `${key} is verified by Phase 28R final smoke without enabling any bridge, archive, approval, runtime, MCP, Canon, or protected-file mutation.`,
  }));

  const blockedBridgeCapabilities = expectedBlockedBridgeCapabilities.map((key, order) => ({
    key,
    order,
    allowed: false,
    enabled: false,
    blocked_by_final_smoke: true,
    reason: `${key} remains blocked because Phase 28R is a final smoke for read-only checklist bridge preview, not an execution surface.`,
  }));

  const smokePayload = {
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview_final_smoke",
    smoke_version: "phase28r_archive_manifest_checklist_bridge_preview_final_smoke_v1",
    smoke_mode: "checklist_bridge_preview_final_smoke_only",
    generated_for: "chatgpt_bridge_readable_archive_manifest_operator_checklist_final_smoke",
    source_phase: "28Q",
    source_checklist_bridge_preview_contract_kind:
      "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview",
    source_checklist_bridge_preview_contract_version: "phase28q_archive_manifest_checklist_bridge_preview_contract_v1",
    source_checklist_bridge_preview_contract_digest: phase28qRegistrationDigest,
    source_checklist_bridge_preview_contract_file_digest: phase28qContractFileDigest,
    source_index_digest: sourceIndexDigest,
    source_index_kind: index.index_kind,
    source_index_version: index.version,
    source_index_phase: index.phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
    headline: index.headline,
    summary: index.summary,
    status_badge: index.status_badge,
    warnings: index.warnings,
    read_only: true,
    smoke_only: true,
    final_smoke_only: true,
    preview_only: true,
    bridge_preview_only: true,
    checklist_bridge_preview_only: true,
    operator_handoff_only: true,
    no_execution_surface: true,
    archive_materialization_blocked: true,
    retention_manifest_only: true,
    raw_json_preview_only: true,
    raw_json_checklist_visible: true,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    future_archive_materialization_requires_new_phase: true,
    can_complete_checklist_as_approval: false,
    can_accept_final_archive_manifest: false,
    can_archive_materialize_file: false,
    can_write_archive_index: false,
    can_write_archive_manifest: false,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    can_write_canon: false,
    can_create_pending_engine_candidate: false,
    can_update_compressed_rules: false,
    can_restore_backup: false,
    can_rollback: false,
    can_modify_runtime_bridge: false,
    can_modify_runtime_ui: false,
    can_register_mcp_tool: false,
    source_chain: sourceChain,
    visible_sections: expectedFinalSmokeVisibleSections,
    final_smoke_checkpoints: finalSmokeCheckpoints,
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    bridge_readability_smoke: {
      markdown_summary: [
        "# Archive manifest checklist bridge preview final smoke",
        "",
        "Phase 28R verifies that the Phase 28Q checklist bridge preview remains readable, complete, and safe for ChatGPT bridge display.",
        "It is read-only / preview-only / final-smoke-only.",
        "It is not an approval, not final acceptance execution, and not archive materialization.",
        "It cannot materialize archives, write archive indexes or manifests, approve, adopt, settle, activate engine, write Canon, update compressed_rules, modify runtime bridge/UI, or register MCP tools.",
      ].join("\n"),
      required_visible_sections: expectedFinalSmokeVisibleSections,
      required_checkpoint_keys: expectedFinalSmokeCheckpoints,
      required_blocked_capability_keys: expectedBlockedBridgeCapabilities,
      source_chain_phases: expectedSourceChainPhases,
    },
    safety_boundary: {
      read_only: true,
      smoke_only: true,
      final_smoke_only: true,
      preview_only: true,
      bridge_preview_only: true,
      checklist_bridge_preview_only: true,
      operator_handoff_only: true,
      no_execution_surface: true,
      archive_materialization_blocked: true,
      retention_manifest_only: true,
      raw_json_preview_only: true,
      raw_json_checklist_visible: true,
      requires_human_approval: true,
      requires_operator_confirmation: true,
      future_archive_materialization_requires_new_phase: true,
      can_complete_checklist_as_approval: false,
      can_accept_final_archive_manifest: false,
      can_archive_materialize_file: false,
      can_write_archive_index: false,
      can_write_archive_manifest: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_activate_engine: false,
      can_auto_adopt: false,
      can_auto_settle: false,
      can_write_canon: false,
      can_create_pending_engine_candidate: false,
      can_update_compressed_rules: false,
      can_restore_backup: false,
      can_rollback: false,
      can_modify_runtime_bridge: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      pending_engine_candidate_created: false,
      settlement_context_created: false,
      settlement_report_created: false,
      approval_item_created: false,
      backup_created: false,
      export_created: false,
      restore_preview_created: false,
      archive_file_created: false,
      archive_index_written: false,
      archive_manifest_written: false,
      runtime_ui_modified: false,
      runtime_service_modified: false,
      runtime_bridge_modified: false,
      mcp_tool_added: false,
      bridge_tool_added: false,
      canon_written: false,
    },
    counts: {
      source_chain: sourceChain.length,
      visible_sections: expectedFinalSmokeVisibleSections.length,
      final_smoke_checkpoints: finalSmokeCheckpoints.length,
      blocked_bridge_capabilities: blockedBridgeCapabilities.length,
      source_phase_rows: index.phase_rows.length,
      source_chain_segments: index.chain_segments.length,
      source_operator_entrypoints: index.operator_entrypoints.length,
      source_prohibited_actions: index.prohibited_actions.length,
    },
  };

  return {
    ...smokePayload,
    checklist_bridge_preview_final_smoke_digest: stableDigest(smokePayload),
  };
}

function assertPhase28rFinalSmoke(smoke) {
  assert.equal(
    smoke.smoke_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview_final_smoke",
    "28R smoke kind drifted.",
  );
  assert.equal(smoke.smoke_version, "phase28r_archive_manifest_checklist_bridge_preview_final_smoke_v1", "28R smoke version drifted.");
  assert.equal(smoke.smoke_mode, "checklist_bridge_preview_final_smoke_only", "28R smoke mode drifted.");
  assert.equal(smoke.generated_for, "chatgpt_bridge_readable_archive_manifest_operator_checklist_final_smoke", "28R generated_for drifted.");
  assert.equal(smoke.source_phase, "28Q", "28R source phase should be 28Q.");
  assert.equal(
    smoke.source_checklist_bridge_preview_contract_version,
    "phase28q_archive_manifest_checklist_bridge_preview_contract_v1",
    "28R source Phase 28Q contract version drifted.",
  );

  for (const key of [
    "source_checklist_bridge_preview_contract_digest",
    "source_checklist_bridge_preview_contract_file_digest",
    "source_index_digest",
    "checklist_bridge_preview_final_smoke_digest",
  ]) {
    assert.match(smoke[key], /^[a-f0-9]{64}$/u, `28R ${key} should be sha256 hex.`);
  }

  for (const key of [
    "read_only",
    "smoke_only",
    "final_smoke_only",
    "preview_only",
    "bridge_preview_only",
    "checklist_bridge_preview_only",
    "operator_handoff_only",
    "no_execution_surface",
    "archive_materialization_blocked",
    "retention_manifest_only",
    "raw_json_preview_only",
    "raw_json_checklist_visible",
    "requires_human_approval",
    "requires_operator_confirmation",
    "future_archive_materialization_requires_new_phase",
  ]) {
    assert.equal(smoke[key], true, `28R ${key} must remain true.`);
    assert.equal(smoke.safety_boundary[key], true, `28R safety boundary ${key} must remain true.`);
  }

  for (const key of [
    "can_complete_checklist_as_approval",
    "can_accept_final_archive_manifest",
    "can_archive_materialize_file",
    "can_write_archive_index",
    "can_write_archive_manifest",
    "can_approve",
    "can_confirm_adoption",
    "can_activate_engine",
    "can_auto_adopt",
    "can_auto_settle",
    "can_write_canon",
    "can_create_pending_engine_candidate",
    "can_update_compressed_rules",
    "can_restore_backup",
    "can_rollback",
    "can_modify_runtime_bridge",
    "can_modify_runtime_ui",
    "can_register_mcp_tool",
  ]) {
    assert.equal(smoke[key], false, `28R ${key} must remain false.`);
    assert.equal(smoke.safety_boundary[key], false, `28R safety boundary ${key} must remain false.`);
  }

  const sourceChain = keyed(smoke.source_chain, "28R source chain");
  assert.deepEqual([...sourceChain.keys()], expectedSourceChainPhases, "28R source chain phase order drifted.");
  for (const item of sourceChain.values()) {
    assert.equal(item.key, item.phase, `${item.phase} key should match phase.`);
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
    assert.equal(item.retained, true, `${item.phase} should be retained.`);
    assert.equal(item.visible, true, `${item.phase} should be visible.`);
    assert.equal(item.copyable, true, `${item.phase} should be copyable.`);
  }
  assert.equal(sourceChain.get("28A").digest, smoke.source_index_digest, "28R source chain 28A digest should match source index digest.");
  assert.equal(sourceChain.get("28Q").digest, smoke.source_checklist_bridge_preview_contract_digest, "28R source chain 28Q digest should match source checklist bridge preview contract digest.");

  assert.deepEqual(smoke.visible_sections, expectedFinalSmokeVisibleSections, "28R visible section order drifted.");

  const finalSmokeCheckpoints = keyed(smoke.final_smoke_checkpoints, "28R final smoke checkpoints");
  assert.deepEqual([...finalSmokeCheckpoints.keys()], expectedFinalSmokeCheckpoints, "28R final smoke checkpoint order drifted.");
  for (const checkpoint of finalSmokeCheckpoints.values()) {
    assert.equal(checkpoint.passed_by_contract, true, `${checkpoint.key} should pass by contract.`);
    assert.equal(checkpoint.required, true, `${checkpoint.key} should be required.`);
    assert.equal(checkpoint.final_smoke_only, true, `${checkpoint.key} should remain final smoke only.`);
    assert.equal(checkpoint.cannot_execute, true, `${checkpoint.key} must not execute.`);
  }

  const blockedBridgeCapabilities = keyed(smoke.blocked_bridge_capabilities, "28R blocked bridge capabilities");
  assert.deepEqual([...blockedBridgeCapabilities.keys()], expectedBlockedBridgeCapabilities, "28R blocked bridge capability order drifted.");
  for (const capability of blockedBridgeCapabilities.values()) {
    assert.equal(capability.allowed, false, `${capability.key} must not be allowed.`);
    assert.equal(capability.enabled, false, `${capability.key} must not be enabled.`);
    assert.equal(capability.blocked_by_final_smoke, true, `${capability.key} should be blocked by final smoke.`);
    assert(capability.reason.includes("not an execution surface"), `${capability.key} reason should preserve execution-surface warning.`);
  }

  assert.equal(typeof smoke.bridge_readability_smoke.markdown_summary, "string", "28R markdown summary should be a string.");
  for (const token of [
    "read-only / preview-only / final-smoke-only",
    "not an approval",
    "not final acceptance execution",
    "not archive materialization",
    "cannot materialize archives",
  ]) {
    assert(smoke.bridge_readability_smoke.markdown_summary.includes(token), `28R markdown summary missing warning: ${token}`);
  }

  assert.deepEqual(smoke.bridge_readability_smoke.required_visible_sections, expectedFinalSmokeVisibleSections, "28R readability visible sections drifted.");
  assert.deepEqual(smoke.bridge_readability_smoke.required_checkpoint_keys, expectedFinalSmokeCheckpoints, "28R readability checkpoint keys drifted.");
  assert.deepEqual(smoke.bridge_readability_smoke.required_blocked_capability_keys, expectedBlockedBridgeCapabilities, "28R readability blocked capability keys drifted.");
  assert.deepEqual(smoke.bridge_readability_smoke.source_chain_phases, expectedSourceChainPhases, "28R readability source chain phases drifted.");

  for (const key of [
    "active_engine_modified",
    "compressed_rules_modified",
    "pending_engine_candidate_created",
    "settlement_context_created",
    "settlement_report_created",
    "approval_item_created",
    "backup_created",
    "export_created",
    "restore_preview_created",
    "archive_file_created",
    "archive_index_written",
    "archive_manifest_written",
    "runtime_ui_modified",
    "runtime_service_modified",
    "runtime_bridge_modified",
    "mcp_tool_added",
    "bridge_tool_added",
    "canon_written",
  ]) {
    assert.equal(smoke.no_mutation_snapshot[key], false, `28R no mutation ${key} must remain false.`);
  }

  assert.equal(smoke.counts.source_chain, 12, "28R source chain count drifted.");
  assert.equal(smoke.counts.visible_sections, expectedFinalSmokeVisibleSections.length, "28R visible section count drifted.");
  assert.equal(smoke.counts.final_smoke_checkpoints, expectedFinalSmokeCheckpoints.length, "28R checkpoint count drifted.");
  assert.equal(smoke.counts.blocked_bridge_capabilities, expectedBlockedBridgeCapabilities.length, "28R blocked capability count drifted.");
  assert(smoke.counts.source_phase_rows >= 7, "28R source phase row count should remain populated.");
  assert(smoke.counts.source_chain_segments >= 3, "28R source chain segment count should remain populated.");
  assert(smoke.counts.source_operator_entrypoints >= 3, "28R source operator entrypoint count should remain populated.");
  assert(smoke.counts.source_prohibited_actions >= 7, "28R source prohibited action count should remain populated.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);
const backupProjectBefore = await readOptionalDirectory(backupProjectDir);
const backupExportsBefore = await readOptionalDirectory(backupExportsDir);
const restorePreviewsBefore = await readOptionalDirectory(restorePreviewsDir);
const archiveFilesBefore = await readOptionalDirectory(archiveFilesDir);
const archiveIndexBefore = await readOptionalDirectory(archiveIndexDir);
const archiveManifestBefore = await readOptionalDirectory(archiveManifestDir);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28R active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28R compressed_rules hash baseline drifted before test.");

const [runAllText, phase28qText, serviceText, uiIndexText, uiAppText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(phase28qTestPath, "utf8"),
  readFile(servicePath, "utf8"),
  readFile(uiIndexPath, "utf8"),
  readFile(uiAppPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticSourceTokens({ serviceText, uiIndexText, uiAppText, phase28qText });

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: true,
});

assert.equal(index.ok, true, "28R source index should be ready.");
assert.equal(index.raw_dashboard, null, "28R source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28R source index should omit raw manual review surface.");

const finalSmoke = buildPhase28rFinalSmoke({ index, phase28qText, runAllText });

assertPhase28rFinalSmoke(finalSmoke);
assert.deepEqual(
  buildPhase28rFinalSmoke({ index, phase28qText, runAllText }),
  finalSmoke,
  "28R archive manifest checklist bridge preview final smoke should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28R changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28R changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28R changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28R changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28R changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28R changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28R changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28R changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28R changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28R changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28R created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28R wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28R wrote archive manifest.");

console.log("Phase28R foreshadowing settlement operator review chain index evidence packet archive manifest checklist bridge preview final smoke tests passed.");
