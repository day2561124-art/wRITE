import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const CURRENT_PHASE = "Phase42U";
const CURRENT_PHASE_SLUG = "phase42u-production-candidate-store-promotion-gate-final-closure-index";
const PREVIOUS_PHASE = "Phase42T";
const PREVIOUS_PHASE_SLUG = "phase42t-production-candidate-store-promotion-gate-rollback-restore-execution-denial-smoke";
const NEXT_PHASE = "Phase42V";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE = "Full run-all remains separately pending due to prior Backup export service timeout.";

const FINAL_FALSE_FIELDS = Object.freeze([
  "approval_request_created",
  "pending_engine_candidate_created",
  "production_candidate_store_mutated",
  "production_candidate_store_write_executed",
  "production_candidate_store_promotion_executed",
  "production_promotion_gate_opened",
  "guard_token_consumed",
  "audit_receipt_created",
  "backup_snapshot_created",
  "rollback_restore_executed",
  "adoption_executed",
  "settlement_executed",
  "canon_updated",
  "active_engine_updated"
]);

const phase42ClosureIndex = Object.freeze([
  Object.freeze({
    phase: "42A",
    phase_id: "Phase42A",
    test_path: "tests/phase42/phase42a-production-candidate-store-promotion-gate-readiness-index.test.mjs",
    boundary_kind: "readiness_index",
    action: "index_promotion_gate_readiness",
    outcome: "readiness_indexed",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42B",
    phase_id: "Phase42B",
    test_path: "tests/phase42/phase42b-production-candidate-store-promotion-gate-audit-rollback-readiness-smoke.test.mjs",
    boundary_kind: "readiness_smoke",
    action: "inspect_audit_rollback_readiness",
    outcome: "readiness_confirmed",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42C",
    phase_id: "Phase42C",
    test_path: "tests/phase42/phase42c-production-candidate-store-promotion-gate-preflight-contract-smoke.test.mjs",
    boundary_kind: "preflight_contract",
    action: "inspect_promotion_gate_preflight_contract",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42D",
    phase_id: "Phase42D",
    test_path: "tests/phase42/phase42d-production-candidate-store-promotion-gate-operator-confirmation-boundary-smoke.test.mjs",
    boundary_kind: "confirmation_boundary",
    action: "inspect_operator_confirmation_boundary",
    outcome: "boundary_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42E",
    phase_id: "Phase42E",
    test_path: "tests/phase42/phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke.test.mjs",
    boundary_kind: "final_readiness",
    action: "inspect_operator_confirmation_final_readiness",
    outcome: "readiness_confirmed",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42F",
    phase_id: "Phase42F",
    test_path: "tests/phase42/phase42f-production-candidate-store-promotion-gate-guard-token-pre-consumption-boundary-smoke.test.mjs",
    boundary_kind: "pre_consumption_boundary",
    action: "inspect_guard_token_pre_consumption",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42G",
    phase_id: "Phase42G",
    test_path: "tests/phase42/phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke.test.mjs",
    boundary_kind: "execution_denial",
    action: "consume_guard_token",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42H",
    phase_id: "Phase42H",
    test_path: "tests/phase42/phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke.test.mjs",
    boundary_kind: "preflight_boundary",
    action: "inspect_approval_request_preflight",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42I",
    phase_id: "Phase42I",
    test_path: "tests/phase42/phase42i-production-candidate-store-promotion-gate-approval-request-creation-denial-smoke.test.mjs",
    boundary_kind: "creation_denial",
    action: "create_approval_request",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42J",
    phase_id: "Phase42J",
    test_path: "tests/phase42/phase42j-production-candidate-store-promotion-gate-pending-engine-candidate-preflight-boundary-smoke.test.mjs",
    boundary_kind: "preflight_boundary",
    action: "inspect_pending_engine_candidate_preflight",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42K",
    phase_id: "Phase42K",
    test_path: "tests/phase42/phase42k-production-candidate-store-promotion-gate-pending-engine-candidate-creation-denial-smoke.test.mjs",
    boundary_kind: "creation_denial",
    action: "create_pending_engine_candidate",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42L",
    phase_id: "Phase42L",
    test_path: "tests/phase42/phase42l-production-candidate-store-promotion-gate-production-write-preflight-boundary-smoke.test.mjs",
    boundary_kind: "preflight_boundary",
    action: "inspect_production_write_preflight",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42M",
    phase_id: "Phase42M",
    test_path: "tests/phase42/phase42m-production-candidate-store-promotion-gate-production-write-execution-denial-smoke.test.mjs",
    boundary_kind: "execution_denial",
    action: "execute_production_write",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42N",
    phase_id: "Phase42N",
    test_path: "tests/phase42/phase42n-production-candidate-store-promotion-gate-production-promotion-preflight-boundary-smoke.test.mjs",
    boundary_kind: "preflight_boundary",
    action: "inspect_production_promotion_preflight",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42O",
    phase_id: "Phase42O",
    test_path: "tests/phase42/phase42o-production-candidate-store-promotion-gate-production-promotion-execution-denial-smoke.test.mjs",
    boundary_kind: "execution_denial",
    action: "execute_production_promotion",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42P",
    phase_id: "Phase42P",
    test_path: "tests/phase42/phase42p-production-candidate-store-promotion-gate-production-gate-open-preflight-boundary-smoke.test.mjs",
    boundary_kind: "preflight_boundary",
    action: "inspect_production_gate_open_preflight",
    outcome: "preflight_only",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42Q",
    phase_id: "Phase42Q",
    test_path: "tests/phase42/phase42q-production-candidate-store-promotion-gate-production-gate-open-execution-denial-smoke.test.mjs",
    boundary_kind: "execution_denial",
    action: "execute_production_gate_open",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42R",
    phase_id: "Phase42R",
    test_path: "tests/phase42/phase42r-production-candidate-store-promotion-gate-audit-receipt-creation-denial-smoke.test.mjs",
    boundary_kind: "creation_denial",
    action: "create_audit_receipt",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42S",
    phase_id: "Phase42S",
    test_path: "tests/phase42/phase42s-production-candidate-store-promotion-gate-backup-snapshot-creation-denial-smoke.test.mjs",
    boundary_kind: "creation_denial",
    action: "create_backup_snapshot",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  }),
  Object.freeze({
    phase: "42T",
    phase_id: "Phase42T",
    test_path: "tests/phase42/phase42t-production-candidate-store-promotion-gate-rollback-restore-execution-denial-smoke.test.mjs",
    boundary_kind: "execution_denial",
    action: "execute_rollback_restore",
    outcome: "denied",
    index_only: true,
    preview_only: true,
    persisted: false,
    safety_flags: Object.freeze({
      "approval_request_created": false,
      "pending_engine_candidate_created": false,
      "production_candidate_store_mutated": false,
      "production_candidate_store_write_executed": false,
      "production_candidate_store_promotion_executed": false,
      "production_promotion_gate_opened": false,
      "guard_token_consumed": false,
      "audit_receipt_created": false,
      "backup_snapshot_created": false,
      "rollback_restore_executed": false,
      "adoption_executed": false,
      "settlement_executed": false,
      "canon_updated": false,
      "active_engine_updated": false
    })
  })
]);

const finalState = Object.freeze(Object.fromEntries(
  FINAL_FALSE_FIELDS.map((field) => [field, false])
));

const closureIndexContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  expected_base: "fd0d3c7",
  previous_phase: PREVIOUS_PHASE,
  previous_phase_slug: PREVIOUS_PHASE_SLUG,
  purpose: "production candidate store promotion gate final closure index",
  mode: "read_only_preview_only_inspect_only_index_only_no_execution",
  phase_range: "Phase42A-Phase42T",
  phase_count: 20,
  terminal_phase: PREVIOUS_PHASE,
  terminal_reason: "rollback_restore_execution_denied_preview_only",
  terminal_mode: "rollback_restore_execution_denial_smoke",
  final_closure_index_ready: true,
  closure_index_persisted: false,
  operator_handoff_seal_created: false,
  phase42v_operator_handoff_seal_pending: true,
  next_phase: NEXT_PHASE,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  final_state: finalState,
  index: phase42ClosureIndex
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function stableHash(value) {
  return "sha256:" + crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function assertAllFalse(target, label) {
  for (const field of FINAL_FALSE_FIELDS) {
    assert.equal(target[field], false, `${label}.${field} must remain false`);
  }
}

function assertNoExecutableMutationCalls() {
  const source = readRepoFile("tests/phase42/phase42u-production-candidate-store-promotion-gate-final-closure-index.test.mjs");
  const forbiddenCallPatterns = [
    /\bcreateApprovalRequest\s*\(/,
    /\bcreatePendingEngineCandidate\s*\(/,
    /\bwriteProductionCandidateStore\s*\(/,
    /\bpromoteProductionCandidate\s*\(/,
    /\bopenProductionGate\s*\(/,
    /\bconsumeGuardToken\s*\(/,
    /\bcreateAuditReceipt\s*\(/,
    /\bcreateBackupSnapshot\s*\(/,
    /\bexecuteRollbackRestore\s*\(/,
    /\bexecuteAdoption\s*\(/,
    /\bexecuteSettlement\s*\(/,
    /\bupdateCanon\s*\(/,
    /\bupdateActiveEngine\s*\(/,
    /\bwriteFileSync\s*\(/,
    /\bappendFileSync\s*\(/,
    /\brenameSync\s*\(/,
    /\bunlinkSync\s*\(/,
    /\brmSync\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase42U final closure index must not contain executable mutation call pattern ${pattern}`
    );
  }
}

const deterministicDigest = stableHash(closureIndexContract);
assert.equal(
  deterministicDigest,
  "sha256:6656d8f2ca2e9f5359871ac0e53fa2904864bd413f8a97e1dc72258e47adb036",
  "Phase42U final closure index deterministic digest changed unexpectedly"
);

assert.equal(closureIndexContract.phase, CURRENT_PHASE);
assert.equal(closureIndexContract.phase_slug, CURRENT_PHASE_SLUG);
assert.equal(closureIndexContract.expected_base, "fd0d3c7");
assert.equal(closureIndexContract.previous_phase, PREVIOUS_PHASE);
assert.equal(closureIndexContract.previous_phase_slug, PREVIOUS_PHASE_SLUG);
assert.equal(closureIndexContract.phase_range, "Phase42A-Phase42T");
assert.equal(closureIndexContract.phase_count, 20);
assert.equal(closureIndexContract.terminal_phase, PREVIOUS_PHASE);
assert.equal(closureIndexContract.terminal_reason, "rollback_restore_execution_denied_preview_only");
assert.equal(closureIndexContract.terminal_mode, "rollback_restore_execution_denial_smoke");
assert.equal(closureIndexContract.final_closure_index_ready, true);
assert.equal(closureIndexContract.closure_index_persisted, false);
assert.equal(closureIndexContract.operator_handoff_seal_created, false);
assert.equal(closureIndexContract.phase42v_operator_handoff_seal_pending, true);
assert.equal(closureIndexContract.next_phase, NEXT_PHASE);
assert.equal(closureIndexContract.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
assert.equal(closureIndexContract.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
assert.equal(closureIndexContract.full_run_all_passed_claimed, false);
assertAllFalse(closureIndexContract.final_state, "closureIndexContract.final_state");

const expectedPhases = Array.from({ length: 20 }, (_, index) =>
  `42${String.fromCharCode("A".charCodeAt(0) + index)}`
);
assert.deepEqual(
  phase42ClosureIndex.map((entry) => entry.phase),
  expectedPhases,
  "Phase42 closure index must preserve exact Phase42A-Phase42T order"
);

assert.equal(new Set(phase42ClosureIndex.map((entry) => entry.phase)).size, 20);
assert.equal(new Set(phase42ClosureIndex.map((entry) => entry.test_path)).size, 20);

for (const entry of phase42ClosureIndex) {
  assert.equal(entry.phase_id, `Phase${entry.phase}`);
  assert.equal(entry.test_path.startsWith("tests/phase42/phase42"), true);
  assert.equal(entry.index_only, true);
  assert.equal(entry.preview_only, true);
  assert.equal(entry.persisted, false);
  assertAllFalse(entry.safety_flags, `${entry.phase}.safety_flags`);
}

const denialEntries = phase42ClosureIndex.filter((entry) => entry.outcome === "denied");
assert.deepEqual(
  denialEntries.map((entry) => entry.phase),
  ["42G", "42I", "42K", "42M", "42O", "42Q", "42R", "42S", "42T"]
);
assert.deepEqual(
  denialEntries.map((entry) => entry.action),
  [
    "consume_guard_token",
    "create_approval_request",
    "create_pending_engine_candidate",
    "execute_production_write",
    "execute_production_promotion",
    "execute_production_gate_open",
    "create_audit_receipt",
    "create_backup_snapshot",
    "execute_rollback_restore"
  ]
);

const terminalEntry = phase42ClosureIndex.at(-1);
assert.equal(terminalEntry.phase, "42T");
assert.equal(terminalEntry.action, "execute_rollback_restore");
assert.equal(terminalEntry.outcome, "denied");
assert.equal(terminalEntry.boundary_kind, "execution_denial");

for (const entry of phase42ClosureIndex) {
  assert.equal(
    fs.existsSync(path.join(repoRoot, entry.test_path)),
    true,
    `Phase42 closure index file must exist: ${entry.test_path}`
  );
}

const runAllPath = "tests/run-all.mjs";
const runAllText = readRepoFile(runAllPath);
const currentTestPath = "tests/phase42/phase42u-production-candidate-store-promotion-gate-final-closure-index.test.mjs";

for (const entry of phase42ClosureIndex) {
  assert.equal(
    countOccurrences(runAllText, entry.test_path),
    1,
    `tests/run-all.mjs must register ${entry.test_path} exactly once`
  );
}

assert.equal(
  countOccurrences(runAllText, currentTestPath),
  1,
  "tests/run-all.mjs must register Phase42U exactly once"
);

const orderedPaths = [...phase42ClosureIndex.map((entry) => entry.test_path), currentTestPath];
let previousPosition = -1;
for (const testPath of orderedPaths) {
  const position = runAllText.indexOf(testPath);
  assert.equal(position > previousPosition, true, `run-all order is invalid at ${testPath}`);
  previousPosition = position;
}

const phase42TSource = readRepoFile(terminalEntry.test_path);
for (const requiredMarker of [
  'const CURRENT_PHASE = "Phase42T";',
  'const PREVIOUS_PHASE = "Phase42S";',
  'reason: "rollback_restore_execution_denied_preview_only"',
  'mode: "rollback_restore_execution_denial_smoke"',
  "rollback_restore_execution_denied: true",
  "rollback_restore_execution_authorized: false",
  "rollback_restore_executed: false",
  "backup_snapshot_created: false",
  "audit_receipt_created: false",
  "production_promotion_gate_opened: false",
  "guard_token_consumed: false",
  "production_candidate_store_mutated: false",
  "full_run_all_passed_claimed: false",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(
    phase42TSource.includes(requiredMarker),
    true,
    `Phase42T source contract marker missing: ${requiredMarker}`
  );
}

assertNoExecutableMutationCalls();

console.log(`Phase42U production candidate store promotion gate final closure index deterministic digest: ${deterministicDigest}`);
console.log("Phase42U production candidate store promotion gate final closure index tests passed.");