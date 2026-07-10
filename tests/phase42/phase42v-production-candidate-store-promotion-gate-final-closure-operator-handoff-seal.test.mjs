import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const CURRENT_PHASE = "Phase42V";
const CURRENT_PHASE_SLUG = "phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal";
const PREVIOUS_PHASE = "Phase42U";
const PREVIOUS_PHASE_SLUG = "phase42u-production-candidate-store-promotion-gate-final-closure-index";
const PHASE42U_DIGEST = "sha256:6656d8f2ca2e9f5359871ac0e53fa2904864bd413f8a97e1dc72258e47adb036";
const FULL_RUN_ALL_PENDING_STATUS = "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE = "Full run-all remains separately pending due to prior Backup export service timeout.";

const PROTECTED_FALSE_FIELDS = Object.freeze([
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
  "active_engine_updated",
  "authority_transferred",
  "production_execution_authorized",
  "full_run_all_passed_claimed"
]);

const BLOCKED_ACTIONS = Object.freeze([
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "production_gate_open",
  "guard_token_consume",
  "approval_request_create",
  "pending_engine_candidate_create",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "operator_handoff_seal_persist",
  "operator_handoff_packet_persist",
  "authority_transfer",
  "claim_full_run_all_passed"
]);

const PHASE_CHAIN = Object.freeze([
  Object.freeze({
    phase: "42A",
    phase_id: "Phase42A",
    order: 1,
    test_path: "tests/phase42/phase42a-production-candidate-store-promotion-gate-readiness-index.test.mjs",
    role: "readiness_index",
    outcome: "readiness_indexed",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42B",
    phase_id: "Phase42B",
    order: 2,
    test_path: "tests/phase42/phase42b-production-candidate-store-promotion-gate-audit-rollback-readiness-smoke.test.mjs",
    role: "audit_rollback_readiness",
    outcome: "readiness_confirmed",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42C",
    phase_id: "Phase42C",
    order: 3,
    test_path: "tests/phase42/phase42c-production-candidate-store-promotion-gate-preflight-contract-smoke.test.mjs",
    role: "preflight_contract",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42D",
    phase_id: "Phase42D",
    order: 4,
    test_path: "tests/phase42/phase42d-production-candidate-store-promotion-gate-operator-confirmation-boundary-smoke.test.mjs",
    role: "operator_confirmation_boundary",
    outcome: "boundary_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42E",
    phase_id: "Phase42E",
    order: 5,
    test_path: "tests/phase42/phase42e-production-candidate-store-promotion-gate-operator-confirmation-final-readiness-smoke.test.mjs",
    role: "operator_confirmation_final_readiness",
    outcome: "readiness_confirmed",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42F",
    phase_id: "Phase42F",
    order: 6,
    test_path: "tests/phase42/phase42f-production-candidate-store-promotion-gate-guard-token-pre-consumption-boundary-smoke.test.mjs",
    role: "guard_token_pre_consumption",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42G",
    phase_id: "Phase42G",
    order: 7,
    test_path: "tests/phase42/phase42g-production-candidate-store-promotion-gate-guard-token-consumption-denial-smoke.test.mjs",
    role: "guard_token_consumption",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42H",
    phase_id: "Phase42H",
    order: 8,
    test_path: "tests/phase42/phase42h-production-candidate-store-promotion-gate-approval-request-preflight-boundary-smoke.test.mjs",
    role: "approval_request_preflight",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42I",
    phase_id: "Phase42I",
    order: 9,
    test_path: "tests/phase42/phase42i-production-candidate-store-promotion-gate-approval-request-creation-denial-smoke.test.mjs",
    role: "approval_request_creation",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42J",
    phase_id: "Phase42J",
    order: 10,
    test_path: "tests/phase42/phase42j-production-candidate-store-promotion-gate-pending-engine-candidate-preflight-boundary-smoke.test.mjs",
    role: "pending_engine_candidate_preflight",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42K",
    phase_id: "Phase42K",
    order: 11,
    test_path: "tests/phase42/phase42k-production-candidate-store-promotion-gate-pending-engine-candidate-creation-denial-smoke.test.mjs",
    role: "pending_engine_candidate_creation",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42L",
    phase_id: "Phase42L",
    order: 12,
    test_path: "tests/phase42/phase42l-production-candidate-store-promotion-gate-production-write-preflight-boundary-smoke.test.mjs",
    role: "production_write_preflight",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42M",
    phase_id: "Phase42M",
    order: 13,
    test_path: "tests/phase42/phase42m-production-candidate-store-promotion-gate-production-write-execution-denial-smoke.test.mjs",
    role: "production_write_execution",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42N",
    phase_id: "Phase42N",
    order: 14,
    test_path: "tests/phase42/phase42n-production-candidate-store-promotion-gate-production-promotion-preflight-boundary-smoke.test.mjs",
    role: "production_promotion_preflight",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42O",
    phase_id: "Phase42O",
    order: 15,
    test_path: "tests/phase42/phase42o-production-candidate-store-promotion-gate-production-promotion-execution-denial-smoke.test.mjs",
    role: "production_promotion_execution",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42P",
    phase_id: "Phase42P",
    order: 16,
    test_path: "tests/phase42/phase42p-production-candidate-store-promotion-gate-production-gate-open-preflight-boundary-smoke.test.mjs",
    role: "production_gate_open_preflight",
    outcome: "preflight_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42Q",
    phase_id: "Phase42Q",
    order: 17,
    test_path: "tests/phase42/phase42q-production-candidate-store-promotion-gate-production-gate-open-execution-denial-smoke.test.mjs",
    role: "production_gate_open_execution",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42R",
    phase_id: "Phase42R",
    order: 18,
    test_path: "tests/phase42/phase42r-production-candidate-store-promotion-gate-audit-receipt-creation-denial-smoke.test.mjs",
    role: "audit_receipt_creation",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42S",
    phase_id: "Phase42S",
    order: 19,
    test_path: "tests/phase42/phase42s-production-candidate-store-promotion-gate-backup-snapshot-creation-denial-smoke.test.mjs",
    role: "backup_snapshot_creation",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42T",
    phase_id: "Phase42T",
    order: 20,
    test_path: "tests/phase42/phase42t-production-candidate-store-promotion-gate-rollback-restore-execution-denial-smoke.test.mjs",
    role: "rollback_restore_execution",
    outcome: "denied",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  }),
  Object.freeze({
    phase: "42U",
    phase_id: "Phase42U",
    order: 21,
    test_path: "tests/phase42/phase42u-production-candidate-store-promotion-gate-final-closure-index.test.mjs",
    role: "final_closure_index",
    outcome: "index_ready_preview_only",
    focused_validation_recorded: true,
    run_all_registered: true,
    persisted_runtime_artifact: false,
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
      "active_engine_updated": false,
      "authority_transferred": false,
      "production_execution_authorized": false,
      "full_run_all_passed_claimed": false
    })
  })
]);

const BASELINE_STATE = Object.freeze(Object.fromEntries(
  PROTECTED_FALSE_FIELDS.map((field) => [field, false])
));

const HANDOFF_TRUE_FIELDS = Object.freeze([
  "final_closure_index_required",
  "final_closure_index_must_be_ready",
  "final_closure_index_must_remain_unpersisted",
  "operator_handoff_required",
  "operator_handoff_seal_preview_only",
  "operator_handoff_packet_preview_only",
  "new_explicit_scope_required_for_future_work",
  "no_implicit_continuation"
]);

const handoffSealContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  expected_base: "a953080",
  previous_phase: PREVIOUS_PHASE,
  previous_phase_slug: PREVIOUS_PHASE_SLUG,
  mode: "final_closure_operator_handoff_seal_preview_only",
  request_scope: "production_candidate_store_promotion_gate",
  phase_range: "Phase42A-Phase42U",
  phase_count: 21,
  phase42u_digest: PHASE42U_DIGEST,
  final_closure_index_required: true,
  final_closure_index_must_be_ready: true,
  final_closure_index_must_remain_unpersisted: true,
  operator_handoff_required: true,
  operator_handoff_seal_preview_only: true,
  operator_handoff_seal_persistence_allowed: false,
  operator_handoff_packet_preview_only: true,
  operator_handoff_packet_persistence_allowed: false,
  authority_transfer_allowed: false,
  production_execution_authorized: false,
  direct_production_write_authorized: false,
  direct_production_promotion_authorized: false,
  direct_production_gate_open_authorized: false,
  direct_guard_token_consumption_authorized: false,
  direct_approval_request_creation_authorized: false,
  direct_pending_engine_candidate_creation_authorized: false,
  direct_audit_receipt_creation_authorized: false,
  direct_backup_snapshot_creation_authorized: false,
  direct_rollback_restore_authorized: false,
  direct_adoption_authorized: false,
  direct_settlement_authorized: false,
  direct_canon_update_authorized: false,
  direct_active_engine_update_authorized: false,
  new_explicit_scope_required_for_future_work: true,
  no_implicit_continuation: true,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  blocked_actions: BLOCKED_ACTIONS
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function assertAllFalse(target, label) {
  for (const field of PROTECTED_FALSE_FIELDS) {
    assert.equal(target[field], false, `${label}.${field} must remain false`);
  }
}

function allProtectedFieldsFalse(target) {
  return Boolean(target) && PROTECTED_FALSE_FIELDS.every((field) => target[field] === false);
}

function makePhaseEvidence(overrides = {}) {
  return Object.freeze({
    phase_chain: PHASE_CHAIN.map((entry) => clone(entry)),
    latest_completed_phase: PREVIOUS_PHASE,
    latest_completed_phase_slug: PREVIOUS_PHASE_SLUG,
    phase42u_digest: PHASE42U_DIGEST,
    final_closure_index_ready: true,
    final_closure_index_persisted: false,
    operator_handoff_seal_created: false,
    phase42v_operator_handoff_seal_pending: true,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    final_state: clone(BASELINE_STATE),
    ...overrides
  });
}

function makeHandoffContract(overrides = {}) {
  return Object.freeze({
    ...handoffSealContract,
    ...overrides
  });
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return Object.freeze({
    explicit_handoff_seal:
      /phase42v/.test(normalized) ||
      /final closure operator handoff seal/.test(normalized) ||
      /operator handoff seal/.test(normalized) ||
      /handoff seal/.test(normalized),
    production_write:
      /\bproduction write\b|\bwrite\b[\s\S]*\bproduction candidate store\b/.test(normalized),
    production_promotion:
      /\bproduction promotion\b|\bpromote\b[\s\S]*\bproduction candidate\b/.test(normalized),
    production_gate_open:
      /\bopen\b[\s\S]*\bproduction gate\b|\bproduction gate\b[\s\S]*\bopen\b/.test(normalized),
    guard_token_consume:
      /\bconsume\b[\s\S]*\bguard token\b/.test(normalized),
    approval_request_create:
      /\bcreate\b[\s\S]*\bapproval request\b/.test(normalized),
    pending_engine_candidate_create:
      /\bcreate\b[\s\S]*\bpending engine candidate\b/.test(normalized),
    audit_receipt_create:
      /\bcreate\b[\s\S]*\baudit receipt\b/.test(normalized),
    backup_snapshot_create:
      /\bcreate\b[\s\S]*\bbackup snapshot\b/.test(normalized),
    rollback_restore_execute:
      /\bexecute\b[\s\S]*\brollback restore\b|\brollback restore\b[\s\S]*\bexecute\b/.test(normalized),
    adoption:
      /\badopt\b|\badoption\b/.test(normalized),
    settlement:
      /\bsettle\b|\bsettlement\b/.test(normalized),
    canon_update:
      /\bupdate\b[\s\S]*\bcanon\b/.test(normalized),
    active_engine_update:
      /\bupdate\b[\s\S]*\bactive_engine\b|\bupdate\b[\s\S]*\bactive engine\b/.test(normalized),
    persist_seal:
      /\bpersist\b[\s\S]*\bhandoff seal\b|\bsave\b[\s\S]*\bhandoff seal\b/.test(normalized),
    authority_transfer:
      /\btransfer\b[\s\S]*\bauthority\b|\bauthorize\b[\s\S]*\bproduction\b/.test(normalized),
    full_run_all_passed_claim:
      /\bfull run-all passed\b|\bfull_run_all_passed\b/.test(normalized)
  });
}

function reject(reason, state = BASELINE_STATE) {
  return Object.freeze({
    accepted: false,
    reason,
    operator_handoff_seal_generated: false,
    operator_handoff_packet_generated: false,
    operator_handoff_seal_persisted: false,
    operator_handoff_packet_persisted: false,
    authority_transferred: false,
    production_execution_authorized: false,
    state_after: clone(state)
  });
}

function validatePhaseEvidence(evidence) {
  if (!evidence || !Array.isArray(evidence.phase_chain)) return "phase42_chain_evidence_missing";
  if (evidence.phase_chain.length !== PHASE_CHAIN.length) return "phase42_chain_length_invalid";

  for (let index = 0; index < PHASE_CHAIN.length; index += 1) {
    const expected = PHASE_CHAIN[index];
    const actual = evidence.phase_chain[index];

    if (actual?.phase !== expected.phase) return "phase42_chain_order_invalid";
    if (actual.phase_id !== expected.phase_id) return "phase42_chain_phase_id_invalid";
    if (actual.order !== index + 1) return "phase42_chain_order_invalid";
    if (actual.test_path !== expected.test_path) return "phase42_chain_test_path_invalid";
    if (actual.role !== expected.role) return "phase42_chain_role_invalid";
    if (actual.outcome !== expected.outcome) return "phase42_chain_outcome_invalid";
    if (actual.focused_validation_recorded !== true) return "phase42_chain_focused_validation_missing";
    if (actual.run_all_registered !== true) return "phase42_chain_run_all_registration_missing";
    if (actual.persisted_runtime_artifact !== false) return "phase42_chain_runtime_artifact_persisted";
    if (!allProtectedFieldsFalse(actual.safety_flags)) return "phase42_chain_mutation_detected";
  }

  if (evidence.latest_completed_phase !== PREVIOUS_PHASE) return "phase42_latest_phase_invalid";
  if (evidence.latest_completed_phase_slug !== PREVIOUS_PHASE_SLUG) return "phase42_latest_phase_slug_invalid";
  if (evidence.phase42u_digest !== PHASE42U_DIGEST) return "phase42u_digest_invalid";
  if (evidence.final_closure_index_ready !== true) return "phase42u_final_closure_index_not_ready";
  if (evidence.final_closure_index_persisted !== false) return "phase42u_final_closure_index_persisted";
  if (evidence.operator_handoff_seal_created !== false) return "phase42u_operator_handoff_seal_already_created";
  if (evidence.phase42v_operator_handoff_seal_pending !== true) return "phase42v_handoff_pending_marker_missing";
  if (evidence.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) return "full_run_all_status_must_remain_pending";
  if (evidence.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) return "full_run_all_pending_message_changed";
  if (evidence.full_run_all_passed_claimed !== false) return "full_run_all_passed_claim_forbidden";
  if (!allProtectedFieldsFalse(evidence.final_state)) return "phase42_final_state_mutation_detected";
  return null;
}

function validateHandoffContract(contract) {
  if (contract?.phase !== CURRENT_PHASE) return "handoff_contract_phase_invalid";
  if (contract.phase_slug !== CURRENT_PHASE_SLUG) return "handoff_contract_phase_slug_invalid";
  if (contract.expected_base !== "a953080") return "handoff_contract_expected_base_invalid";
  if (contract.previous_phase !== PREVIOUS_PHASE) return "handoff_contract_previous_phase_invalid";
  if (contract.previous_phase_slug !== PREVIOUS_PHASE_SLUG) return "handoff_contract_previous_phase_slug_invalid";
  if (contract.mode !== "final_closure_operator_handoff_seal_preview_only") return "handoff_contract_mode_invalid";
  if (contract.request_scope !== "production_candidate_store_promotion_gate") return "handoff_contract_scope_invalid";
  if (contract.phase_range !== "Phase42A-Phase42U") return "handoff_contract_phase_range_invalid";
  if (contract.phase_count !== 21) return "handoff_contract_phase_count_invalid";
  if (contract.phase42u_digest !== PHASE42U_DIGEST) return "handoff_contract_phase42u_digest_invalid";

  for (const field of HANDOFF_TRUE_FIELDS) {
    if (contract[field] !== true) return "handoff_contract_required_true_field_invalid";
  }

  for (const field of [
    "operator_handoff_seal_persistence_allowed",
    "operator_handoff_packet_persistence_allowed",
    "authority_transfer_allowed",
    "production_execution_authorized",
    "direct_production_write_authorized",
    "direct_production_promotion_authorized",
    "direct_production_gate_open_authorized",
    "direct_guard_token_consumption_authorized",
    "direct_approval_request_creation_authorized",
    "direct_pending_engine_candidate_creation_authorized",
    "direct_audit_receipt_creation_authorized",
    "direct_backup_snapshot_creation_authorized",
    "direct_rollback_restore_authorized",
    "direct_adoption_authorized",
    "direct_settlement_authorized",
    "direct_canon_update_authorized",
    "direct_active_engine_update_authorized",
    "full_run_all_passed_claimed"
  ]) {
    if (contract[field] !== false) return "handoff_contract_authorization_or_persistence_detected";
  }

  if (contract.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) return "handoff_contract_full_run_all_status_invalid";
  if (contract.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) return "handoff_contract_full_run_all_message_invalid";
  if (!Array.isArray(contract.blocked_actions)) return "handoff_contract_blocked_actions_missing";
  if (stableHash(contract.blocked_actions) !== stableHash(BLOCKED_ACTIONS)) return "handoff_contract_blocked_actions_invalid";
  return null;
}

function buildSealDigest(evidence, contract) {
  return stableHash({
    phase_chain: evidence.phase_chain.map((entry) => ({
      phase: entry.phase,
      order: entry.order,
      test_path: entry.test_path,
      role: entry.role,
      outcome: entry.outcome
    })),
    latest_completed_phase: evidence.latest_completed_phase,
    phase42u_digest: evidence.phase42u_digest,
    contract_digest: stableHash(contract),
    full_run_all_status: evidence.full_run_all_status
  });
}

function previewPhase42VOperatorHandoffSeal({
  userRequest,
  phaseEvidence = makePhaseEvidence(),
  contract = makeHandoffContract(),
  state = BASELINE_STATE
} = {}) {
  const intent = classifyIntent(userRequest);
  if (!intent.explicit_handoff_seal) {
    return reject("missing_explicit_phase42v_operator_handoff_seal_request", state);
  }

  try {
    assertAllFalse(state, "state");
  } catch {
    return reject("input_state_mutation_detected", BASELINE_STATE);
  }

  for (const error of [
    validatePhaseEvidence(phaseEvidence),
    validateHandoffContract(contract)
  ]) {
    if (error) return reject(error, state);
  }

  const sealDigest = buildSealDigest(phaseEvidence, contract);
  const sealId = `phase42v_handoff_${sealDigest.slice("sha256:".length, "sha256:".length + 24)}`;
  const directRequestsDetected = Object.freeze({
    production_write: intent.production_write,
    production_promotion: intent.production_promotion,
    production_gate_open: intent.production_gate_open,
    guard_token_consume: intent.guard_token_consume,
    approval_request_create: intent.approval_request_create,
    pending_engine_candidate_create: intent.pending_engine_candidate_create,
    audit_receipt_create: intent.audit_receipt_create,
    backup_snapshot_create: intent.backup_snapshot_create,
    rollback_restore_execute: intent.rollback_restore_execute,
    adoption: intent.adoption,
    settlement: intent.settlement,
    canon_update: intent.canon_update,
    active_engine_update: intent.active_engine_update,
    persist_seal: intent.persist_seal,
    authority_transfer: intent.authority_transfer,
    full_run_all_passed_claim: intent.full_run_all_passed_claim
  });

  return Object.freeze({
    ...BASELINE_STATE,
    accepted: true,
    reason: "production_candidate_store_promotion_gate_final_closure_operator_handoff_seal_preview_only",
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    seal_id: sealId,
    seal_digest: sealDigest,
    contract_digest: stableHash(contract),
    seal_mode: contract.mode,
    request_scope: contract.request_scope,
    phase42_completed_range: "Phase42A-Phase42U",
    phase42_closed_by: CURRENT_PHASE,
    phase42_chain_verified: true,
    phase42_chain_length: PHASE_CHAIN.length,
    phase42u_final_closure_index_verified: true,
    phase42u_digest_verified: true,
    operator_handoff_seal_generated: true,
    operator_handoff_seal_persisted: false,
    operator_handoff_packet_generated: true,
    operator_handoff_packet_persisted: false,
    authority_transferred: false,
    production_execution_authorized: false,
    direct_production_write_authorized: false,
    direct_production_promotion_authorized: false,
    direct_production_gate_open_authorized: false,
    direct_guard_token_consumption_authorized: false,
    direct_approval_request_creation_authorized: false,
    direct_pending_engine_candidate_creation_authorized: false,
    direct_audit_receipt_creation_authorized: false,
    direct_backup_snapshot_creation_authorized: false,
    direct_rollback_restore_authorized: false,
    direct_adoption_authorized: false,
    direct_settlement_authorized: false,
    direct_canon_update_authorized: false,
    direct_active_engine_update_authorized: false,
    no_implicit_continuation: true,
    new_explicit_scope_required_for_future_work: true,
    seal_status: "sealed_preview_only",
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    blocked_direct_actions: [...BLOCKED_ACTIONS],
    direct_requests_detected: directRequestsDetected,
    operator_handoff_seal_preview: Object.freeze({
      seal_id: sealId,
      generated: true,
      persisted: false,
      preview_only: true,
      authority_transferred: false,
      production_execution_authorized: false,
      phase_range: "Phase42A-Phase42U",
      phase_count: PHASE_CHAIN.length,
      final_closure_index_phase: PREVIOUS_PHASE,
      final_closure_index_digest: PHASE42U_DIGEST,
      full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
      blocked_actions: [...BLOCKED_ACTIONS]
    }),
    operator_handoff_packet_preview: Object.freeze({
      generated: true,
      persisted: false,
      preview_only: true,
      status: "sealed_preview_only",
      source_phase: PREVIOUS_PHASE,
      closed_by_phase: CURRENT_PHASE,
      recommended_next_container: "new_explicitly_scoped_phase_after_phase42",
      next_work_must_be_explicit: true,
      no_implicit_continuation: true,
      authority_transferred: false,
      direct_production_write_authorized: false,
      direct_production_promotion_authorized: false,
      next_engineer_instruction:
        "Treat the Phase42 production candidate store promotion gate chain as closed. Start a new explicitly scoped phase before any further work. This handoff seal grants no production, governance, adoption, settlement, Canon, or active_engine authority.",
      blocked_actions: [...BLOCKED_ACTIONS]
    }),
    state_after: clone(state)
  });
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.operator_handoff_seal_generated, false);
  assert.equal(result.operator_handoff_packet_generated, false);
  assert.equal(result.operator_handoff_seal_persisted, false);
  assert.equal(result.operator_handoff_packet_persisted, false);
  assert.equal(result.authority_transferred, false);
  assert.equal(result.production_execution_authorized, false);
  assert.deepEqual(result.state_after, BASELINE_STATE);
}

function assertNoExecutableMutationCalls() {
  const source = readRepoFile(
    "tests/phase42/phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal.test.mjs"
  );

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
      `Phase42V operator handoff seal must not contain executable mutation call pattern ${pattern}`
    );
  }
}

const handoffContractDigest = stableHash(handoffSealContract);
assert.equal(
  handoffContractDigest,
  "sha256:59f268f8d02ffacbed577e44fc4b97f9142d4a37d40c3a9f2ae88a7ef0f3f7bf",
  "Phase42V handoff seal contract deterministic digest changed unexpectedly"
);

assert.equal(PHASE_CHAIN.length, 21);
assert.deepEqual(
  PHASE_CHAIN.map((entry) => entry.phase),
  Array.from({ length: 21 }, (_, index) =>
    `42${String.fromCharCode("A".charCodeAt(0) + index)}`
  )
);
assert.equal(new Set(PHASE_CHAIN.map((entry) => entry.test_path)).size, 21);

for (const entry of PHASE_CHAIN) {
  assert.equal(entry.phase_id, `Phase${entry.phase}`);
  assert.equal(entry.order >= 1 && entry.order <= 21, true);
  assert.equal(entry.focused_validation_recorded, true);
  assert.equal(entry.run_all_registered, true);
  assert.equal(entry.persisted_runtime_artifact, false);
  assertAllFalse(entry.safety_flags, `${entry.phase}.safety_flags`);
  assert.equal(
    fs.existsSync(path.join(repoRoot, entry.test_path)),
    true,
    `Phase42 handoff chain file must exist: ${entry.test_path}`
  );
}

const phase42UPath =
  "tests/phase42/phase42u-production-candidate-store-promotion-gate-final-closure-index.test.mjs";
const phase42USource = readRepoFile(phase42UPath);
for (const marker of [
  'const CURRENT_PHASE = "Phase42U";',
  'const PREVIOUS_PHASE = "Phase42T";',
  'const NEXT_PHASE = "Phase42V";',
  'phase_range: "Phase42A-Phase42T"',
  "phase_count: 20",
  "final_closure_index_ready: true",
  "closure_index_persisted: false",
  "operator_handoff_seal_created: false",
  "phase42v_operator_handoff_seal_pending: true",
  "full_run_all_passed_claimed: false",
  PHASE42U_DIGEST,
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(
    phase42USource.includes(marker),
    true,
    `Phase42U source contract marker missing: ${marker}`
  );
}

const runAllText = readRepoFile("tests/run-all.mjs");
const phase42VPath =
  "tests/phase42/phase42v-production-candidate-store-promotion-gate-final-closure-operator-handoff-seal.test.mjs";

for (const entry of PHASE_CHAIN) {
  assert.equal(
    countOccurrences(runAllText, entry.test_path),
    1,
    `tests/run-all.mjs must register ${entry.test_path} exactly once`
  );
}
assert.equal(
  countOccurrences(runAllText, phase42VPath),
  1,
  "tests/run-all.mjs must register Phase42V exactly once"
);

const orderedPaths = [...PHASE_CHAIN.map((entry) => entry.test_path), phase42VPath];
let previousPosition = -1;
for (const testPath of orderedPaths) {
  const position = runAllText.indexOf(testPath);
  assert.equal(position > previousPosition, true, `run-all order is invalid at ${testPath}`);
  previousPosition = position;
}

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Continue ordinary work."
  }),
  "missing_explicit_phase42v_operator_handoff_seal_request"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: null
  }),
  "phase42_chain_evidence_missing"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.slice(0, -1)
    })
  }),
  "phase42_chain_length_invalid"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.map((entry, index) =>
        index === 19 ? { ...entry, phase: "42U" } : entry
      )
    })
  }),
  "phase42_chain_order_invalid"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.map((entry, index) =>
        index === 8 ? { ...entry, focused_validation_recorded: false } : entry
      )
    })
  }),
  "phase42_chain_focused_validation_missing"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({
      phase_chain: makePhaseEvidence().phase_chain.map((entry, index) =>
        index === 12 ? {
          ...entry,
          safety_flags: {
            ...entry.safety_flags,
            production_candidate_store_write_executed: true
          }
        } : entry
      )
    })
  }),
  "phase42_chain_mutation_detected"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ phase42u_digest: "sha256:tampered" })
  }),
  "phase42u_digest_invalid"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ final_closure_index_ready: false })
  }),
  "phase42u_final_closure_index_not_ready"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ final_closure_index_persisted: true })
  }),
  "phase42u_final_closure_index_persisted"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ operator_handoff_seal_created: true })
  }),
  "phase42u_operator_handoff_seal_already_created"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    phaseEvidence: makePhaseEvidence({ full_run_all_status: "passed" })
  }),
  "full_run_all_status_must_remain_pending"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    contract: makeHandoffContract({ mode: "execute_production" })
  }),
  "handoff_contract_mode_invalid"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    contract: makeHandoffContract({ operator_handoff_seal_persistence_allowed: true })
  }),
  "handoff_contract_authorization_or_persistence_detected"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    contract: makeHandoffContract({ direct_production_write_authorized: true })
  }),
  "handoff_contract_authorization_or_persistence_detected"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    contract: makeHandoffContract({ no_implicit_continuation: false })
  }),
  "handoff_contract_required_true_field_invalid"
);

assertRejected(
  previewPhase42VOperatorHandoffSeal({
    userRequest: "Phase42V final closure operator handoff seal",
    state: { ...BASELINE_STATE, active_engine_updated: true }
  }),
  "input_state_mutation_detected"
);

const success = previewPhase42VOperatorHandoffSeal({
  userRequest:
    "Phase42V final closure operator handoff seal for the production candidate store promotion gate. Keep it preview-only and do not authorize production."
});

assert.equal(success.accepted, true);
assert.equal(
  success.reason,
  "production_candidate_store_promotion_gate_final_closure_operator_handoff_seal_preview_only"
);
assert.equal(success.phase, CURRENT_PHASE);
assert.equal(success.phase_slug, CURRENT_PHASE_SLUG);
assert.equal(success.phase42_completed_range, "Phase42A-Phase42U");
assert.equal(success.phase42_closed_by, CURRENT_PHASE);
assert.equal(success.phase42_chain_verified, true);
assert.equal(success.phase42_chain_length, 21);
assert.equal(success.phase42u_final_closure_index_verified, true);
assert.equal(success.phase42u_digest_verified, true);
assert.equal(success.operator_handoff_seal_generated, true);
assert.equal(success.operator_handoff_seal_persisted, false);
assert.equal(success.operator_handoff_packet_generated, true);
assert.equal(success.operator_handoff_packet_persisted, false);
assert.equal(success.authority_transferred, false);
assert.equal(success.production_execution_authorized, false);
assert.equal(success.no_implicit_continuation, true);
assert.equal(success.new_explicit_scope_required_for_future_work, true);
assert.equal(success.seal_status, "sealed_preview_only");
assert.equal(success.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
assert.equal(success.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
assert.equal(success.full_run_all_passed_claimed, false);
assert.equal(success.operator_handoff_seal_preview.persisted, false);
assert.equal(success.operator_handoff_seal_preview.preview_only, true);
assert.equal(success.operator_handoff_seal_preview.authority_transferred, false);
assert.equal(success.operator_handoff_seal_preview.production_execution_authorized, false);
assert.equal(success.operator_handoff_packet_preview.persisted, false);
assert.equal(success.operator_handoff_packet_preview.preview_only, true);
assert.equal(
  success.operator_handoff_packet_preview.recommended_next_container,
  "new_explicitly_scoped_phase_after_phase42"
);
assert.equal(success.operator_handoff_packet_preview.next_work_must_be_explicit, true);
assert.equal(success.operator_handoff_packet_preview.no_implicit_continuation, true);
assert.deepEqual(success.blocked_direct_actions, BLOCKED_ACTIONS);
assertAllFalse(success, "success");
assert.deepEqual(success.state_after, BASELINE_STATE);

const riskyRequest = previewPhase42VOperatorHandoffSeal({
  userRequest: [
    "Phase42V final closure operator handoff seal.",
    "Write the production candidate store and execute production promotion.",
    "Open the production gate and consume the guard token.",
    "Create approval request and pending engine candidate.",
    "Create audit receipt and backup snapshot.",
    "Execute rollback restore.",
    "Adopt and settle.",
    "Update Canon and update active_engine.",
    "Persist the handoff seal and transfer authority.",
    "Claim full run-all passed."
  ].join(" ")
});

assert.equal(riskyRequest.accepted, true);
for (const field of [
  "production_write",
  "production_promotion",
  "production_gate_open",
  "guard_token_consume",
  "approval_request_create",
  "pending_engine_candidate_create",
  "audit_receipt_create",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
  "persist_seal",
  "authority_transfer",
  "full_run_all_passed_claim"
]) {
  assert.equal(
    riskyRequest.direct_requests_detected[field],
    true,
    `direct_requests_detected.${field} must be true`
  );
}
assert.equal(riskyRequest.operator_handoff_seal_generated, true);
assert.equal(riskyRequest.operator_handoff_seal_persisted, false);
assert.equal(riskyRequest.operator_handoff_packet_persisted, false);
assert.equal(riskyRequest.authority_transferred, false);
assert.equal(riskyRequest.production_execution_authorized, false);
assertAllFalse(riskyRequest, "riskyRequest");
assert.deepEqual(riskyRequest.state_after, BASELINE_STATE);

assertNoExecutableMutationCalls();

console.log(
  `Phase42V production candidate store promotion gate final closure operator handoff seal contract digest: ${handoffContractDigest}`
);
console.log(
  `Phase42V production candidate store promotion gate final closure operator handoff seal digest: ${success.seal_digest}`
);
console.log(
  "Phase42V production candidate store promotion gate final closure operator handoff seal tests passed."
);