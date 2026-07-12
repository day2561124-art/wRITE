import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertImmediateRegistrationAdjacency } from "../helpers/registration-adjacency-assertion.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const CURRENT_PHASE = "Phase43B";
const CURRENT_PHASE_SLUG =
  "phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke";
const PREVIOUS_PHASE = "Phase43A";
const PREVIOUS_PHASE_SLUG =
  "phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke";
const PHASE43A_CONTRACT_DIGEST =
  "sha256:148aff92b3b932359457ad0fd88c1a5569384b0756ca5a7ff47a2fe51f7f2806";
const PHASE43A_ACCEPTANCE_DIGEST =
  "sha256:abc7271b70588e04e415e4bdbdcae43b1e8743bd194f16d28debc3e54f8a93f3";
const PHASE42V_SEAL_DIGEST =
  "sha256:3754a52f0d8bddc778a0e39abceb56e07cf5b7e9f5b3889b905cccd4876cbd94";
const FULL_RUN_ALL_PENDING_STATUS =
  "pending_due_to_prior_backup_export_service_timeout";
const FULL_RUN_ALL_PENDING_MESSAGE =
  "Full run-all remains separately pending due to prior Backup export service timeout.";

const SOURCE_FALSE_FIELDS = Object.freeze([
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
  "phase42_chain_reopened",
  "source_authority_inherited",
  "authority_transferred",
  "scope_execution_authorized",
  "acceptance_preview_persisted",
  "scope_contract_persisted",
  "full_run_all_passed_claimed"
]);

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
  "phase42_chain_reopened",
  "source_authority_inherited",
  "authority_transferred",
  "scope_execution_authorized",
  "acceptance_preview_persisted",
  "scope_contract_persisted",
  "full_run_all_passed_claimed",
  "capability_contract_persisted",
  "capability_implementation_present",
  "capability_implementation_authorized",
  "capability_execution_authorized",
  "capability_invocation_performed",
  "status_report_generated",
  "production_candidate_store_contents_read",
  "production_candidate_records_enumerated"
]);

const PHASE43A_BLOCKED_ACTIONS = Object.freeze([
  "reopen_phase42_chain",
  "inherit_phase42_authority",
  "transfer_operator_authority",
  "authorize_scope_execution",
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
  "persist_scope_acceptance_preview",
  "persist_scope_contract",
  "claim_full_run_all_passed"
]);

const STATUS_FIELD_ALLOWLIST = Object.freeze([
  "source_chain",
  "source_chain_closed",
  "source_handoff_phase",
  "source_handoff_seal_digest",
  "explicit_scope_phase",
  "explicit_scope_id",
  "explicit_scope_acceptance_digest",
  "capability_contract_status",
  "full_run_all_status"
]);

const FORBIDDEN_DATA_CLASSES = Object.freeze([
  "production_candidate_payload",
  "production_candidate_content",
  "candidate_store_record_body",
  "approval_request_payload",
  "pending_engine_candidate_payload",
  "audit_receipt_payload",
  "backup_snapshot_payload",
  "rollback_restore_payload",
  "canon_document_body",
  "active_engine_document_body",
  "secret_or_credential_material"
]);

const BLOCKED_ACTIONS = Object.freeze([
  "reopen_phase42_chain",
  "inherit_phase42_authority",
  "transfer_operator_authority",
  "authorize_scope_execution",
  "persist_capability_contract",
  "implement_capability",
  "invoke_capability",
  "generate_status_report",
  "read_production_candidate_store_contents",
  "enumerate_production_candidate_records",
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
  "claim_full_run_all_passed"
]);

const SOURCE_BASELINE_STATE = Object.freeze(Object.fromEntries(
  SOURCE_FALSE_FIELDS.map((field) => [field, false])
));

const BASELINE_STATE = Object.freeze(Object.fromEntries(
  PROTECTED_FALSE_FIELDS.map((field) => [field, false])
));

const REQUIRED_TRUE_CONTRACT_FIELDS = Object.freeze([
  "source_chain_closed",
  "capability_scope_distinct_from_phase42_execution",
  "read_only_capability",
  "metadata_only_capability",
  "contract_preview_only",
  "future_implementation_requires_separate_explicit_phase",
  "explicit_capability_contract_request_required",
  "no_implicit_execution"
]);

const REQUIRED_FALSE_CONTRACT_FIELDS = Object.freeze([
  "source_chain_reopen_allowed",
  "source_authority_inheritance_allowed",
  "authority_transfer_allowed",
  "contract_persistence_allowed",
  "capability_implementation_present",
  "capability_implementation_authorized",
  "capability_execution_authorized",
  "capability_invocation_allowed",
  "status_report_generation_allowed",
  "production_candidate_store_contents_read_allowed",
  "production_candidate_record_enumeration_allowed",
  "production_write_authorized",
  "production_promotion_authorized",
  "production_gate_open_authorized",
  "guard_token_consumption_authorized",
  "approval_request_creation_authorized",
  "pending_engine_candidate_creation_authorized",
  "audit_receipt_creation_authorized",
  "backup_snapshot_creation_authorized",
  "rollback_restore_authorized",
  "adoption_authorized",
  "settlement_authorized",
  "canon_update_authorized",
  "active_engine_update_authorized",
  "full_run_all_passed_claimed"
]);

const capabilityContract = Object.freeze({
  phase: CURRENT_PHASE,
  phase_slug: CURRENT_PHASE_SLUG,
  expected_base: "5f3352a",
  previous_phase: PREVIOUS_PHASE,
  previous_phase_slug: PREVIOUS_PHASE_SLUG,
  kind: "sealed_chain_read_only_status_inspection_capability_contract",
  mode: "capability_contract_preview_only_no_implementation_no_execution",
  source_chain: "Phase42A-Phase42V",
  source_chain_closed: true,
  source_chain_reopen_allowed: false,
  source_authority_inheritance_allowed: false,
  authority_transfer_allowed: false,
  explicit_scope_phase: PREVIOUS_PHASE,
  explicit_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
  phase43a_contract_digest: PHASE43A_CONTRACT_DIGEST,
  phase43a_acceptance_digest: PHASE43A_ACCEPTANCE_DIGEST,
  phase42v_seal_digest: PHASE42V_SEAL_DIGEST,
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only",
  capability_scope_distinct_from_phase42_execution: true,
  read_only_capability: true,
  metadata_only_capability: true,
  status_field_allowlist: STATUS_FIELD_ALLOWLIST,
  forbidden_data_classes: FORBIDDEN_DATA_CLASSES,
  contract_preview_only: true,
  contract_persistence_allowed: false,
  capability_implementation_present: false,
  capability_implementation_authorized: false,
  capability_execution_authorized: false,
  capability_invocation_allowed: false,
  status_report_generation_allowed: false,
  production_candidate_store_contents_read_allowed: false,
  production_candidate_record_enumeration_allowed: false,
  future_implementation_requires_separate_explicit_phase: true,
  explicit_capability_contract_request_required: true,
  no_implicit_execution: true,
  production_write_authorized: false,
  production_promotion_authorized: false,
  production_gate_open_authorized: false,
  guard_token_consumption_authorized: false,
  approval_request_creation_authorized: false,
  pending_engine_candidate_creation_authorized: false,
  audit_receipt_creation_authorized: false,
  backup_snapshot_creation_authorized: false,
  rollback_restore_authorized: false,
  adoption_authorized: false,
  settlement_authorized: false,
  canon_update_authorized: false,
  active_engine_update_authorized: false,
  full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
  full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
  full_run_all_passed_claimed: false,
  blocked_actions: BLOCKED_ACTIONS
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
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

function allFalseError(target, fields, label) {
  if (!target || typeof target !== "object") return `${label}_missing`;
  for (const field of fields) {
    if (target[field] !== false) return `${label}_${field}_must_remain_false`;
  }
  return null;
}

function assertAllFalse(target, fields, label) {
  const error = allFalseError(target, fields, label);
  assert.equal(error, null, error ?? `${label} must contain only protected false values`);
}

function makePhase43AAcceptanceEvidence(overrides = {}) {
  return Object.freeze({
    accepted: true,
    phase: PREVIOUS_PHASE,
    phase_slug: PREVIOUS_PHASE_SLUG,
    reason:
      "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_accepted_preview_only",
    source_chain: "Phase42A-Phase42V",
    source_chain_closed: true,
    source_chain_reopened: false,
    phase42v_handoff_seal_verified: true,
    phase42v_seal_digest: PHASE42V_SEAL_DIGEST,
    new_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope",
    new_scope_distinct_from_phase42: true,
    explicit_new_scope_detected: true,
    no_implicit_continuation: true,
    no_authority_inheritance: true,
    source_authority_inherited: false,
    authority_transferred: false,
    scope_execution_authorized: false,
    phase43a_explicit_scope_acceptance_generated: true,
    phase43a_explicit_scope_acceptance_persisted: false,
    scope_contract_generated: true,
    scope_contract_persisted: false,
    acceptance_mode: "explicit_new_scope_acceptance_preview_only",
    acceptance_digest: PHASE43A_ACCEPTANCE_DIGEST,
    contract_digest: PHASE43A_CONTRACT_DIGEST,
    blocked_direct_actions: [...PHASE43A_BLOCKED_ACTIONS],
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    final_state: clone(SOURCE_BASELINE_STATE),
    ...overrides
  });
}

function makeCapabilityContract(overrides = {}) {
  return Object.freeze({ ...capabilityContract, ...overrides });
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return Object.freeze({
    explicit_capability_contract:
      /phase43b/.test(normalized) ||
      /read-only status inspection capability contract/.test(normalized) ||
      /sealed chain status inspection contract/.test(normalized),
    invoke_capability:
      /\binvoke\b[\s\S]*\bcapability\b|\brun\b[\s\S]*\bstatus inspection\b/.test(normalized),
    generate_status_report:
      /\bgenerate\b[\s\S]*\bstatus report\b/.test(normalized),
    read_production_contents:
      /\bread\b[\s\S]*\bproduction candidate\b[\s\S]*\bcontent\b/.test(normalized),
    enumerate_production_records:
      /\benumerate\b[\s\S]*\bproduction candidate\b[\s\S]*\brecords\b/.test(normalized),
    persist_contract:
      /\bpersist\b[\s\S]*\bcapability contract\b|\bsave\b[\s\S]*\bcapability contract\b/.test(normalized),
    implement_capability:
      /\bimplement\b[\s\S]*\bcapability\b/.test(normalized),
    reopen_phase42:
      /\breopen\b[\s\S]*\bphase42\b|\bcontinue\b[\s\S]*\bphase42\b/.test(normalized),
    inherit_phase42_authority:
      /\binherit\b[\s\S]*\bphase42\b[\s\S]*\bauthority\b/.test(normalized),
    transfer_authority:
      /\btransfer\b[\s\S]*\bauthority\b/.test(normalized),
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
    adoption: /\badopt\b|\badoption\b/.test(normalized),
    settlement: /\bsettle\b|\bsettlement\b/.test(normalized),
    canon_update: /\bupdate\b[\s\S]*\bcanon\b/.test(normalized),
    active_engine_update:
      /\bupdate\b[\s\S]*\bactive_engine\b|\bupdate\b[\s\S]*\bactive engine\b/.test(normalized),
    full_run_all_passed_claim:
      /\bfull run-all passed\b|\bfull_run_all_passed\b/.test(normalized)
  });
}

function reject(reason, state = BASELINE_STATE) {
  return Object.freeze({
    accepted: false,
    reason,
    capability_contract_generated: false,
    capability_contract_persisted: false,
    capability_contract_ready: false,
    capability_implementation_present: false,
    capability_implementation_authorized: false,
    capability_execution_authorized: false,
    capability_invocation_performed: false,
    status_report_generated: false,
    source_chain_reopened: false,
    source_authority_inherited: false,
    authority_transferred: false,
    state_after: clone(state)
  });
}

function validatePhase43AAcceptanceEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return "phase43a_acceptance_evidence_missing";
  if (evidence.accepted !== true) return "phase43a_acceptance_not_accepted";
  if (evidence.phase !== PREVIOUS_PHASE) return "phase43a_acceptance_phase_invalid";
  if (evidence.phase_slug !== PREVIOUS_PHASE_SLUG) return "phase43a_acceptance_phase_slug_invalid";
  if (
    evidence.reason !==
    "production_candidate_store_promotion_gate_sealed_chain_explicit_scope_accepted_preview_only"
  ) return "phase43a_acceptance_reason_invalid";
  if (evidence.source_chain !== "Phase42A-Phase42V") return "phase43a_source_chain_invalid";
  if (evidence.source_chain_closed !== true) return "phase43a_source_chain_not_closed";
  if (evidence.source_chain_reopened !== false) return "phase43a_source_chain_reopened";
  if (evidence.phase42v_handoff_seal_verified !== true) return "phase43a_phase42v_seal_not_verified";
  if (evidence.phase42v_seal_digest !== PHASE42V_SEAL_DIGEST) return "phase43a_phase42v_seal_digest_invalid";
  if (
    evidence.new_scope_id !==
    "phase43-production-candidate-store-post-closure-explicit-scope"
  ) return "phase43a_scope_id_invalid";
  if (evidence.new_scope_distinct_from_phase42 !== true) return "phase43a_scope_not_distinct";
  if (evidence.explicit_new_scope_detected !== true) return "phase43a_explicit_scope_not_detected";
  if (evidence.no_implicit_continuation !== true) return "phase43a_no_implicit_continuation_missing";
  if (evidence.no_authority_inheritance !== true) return "phase43a_no_authority_inheritance_missing";
  if (evidence.source_authority_inherited !== false) return "phase43a_source_authority_inherited";
  if (evidence.authority_transferred !== false) return "phase43a_authority_transferred";
  if (evidence.scope_execution_authorized !== false) return "phase43a_scope_execution_authorized";
  if (evidence.phase43a_explicit_scope_acceptance_generated !== true) return "phase43a_acceptance_not_generated";
  if (evidence.phase43a_explicit_scope_acceptance_persisted !== false) return "phase43a_acceptance_persisted";
  if (evidence.scope_contract_generated !== true) return "phase43a_scope_contract_not_generated";
  if (evidence.scope_contract_persisted !== false) return "phase43a_scope_contract_persisted";
  if (evidence.acceptance_mode !== "explicit_new_scope_acceptance_preview_only") return "phase43a_acceptance_mode_invalid";
  if (evidence.acceptance_digest !== PHASE43A_ACCEPTANCE_DIGEST) return "phase43a_acceptance_digest_invalid";
  if (evidence.contract_digest !== PHASE43A_CONTRACT_DIGEST) return "phase43a_contract_digest_invalid";
  if (stableHash(evidence.blocked_direct_actions) !== stableHash(PHASE43A_BLOCKED_ACTIONS)) return "phase43a_blocked_actions_invalid";
  if (evidence.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) return "full_run_all_status_must_remain_pending";
  if (evidence.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) return "full_run_all_pending_message_changed";
  if (evidence.full_run_all_passed_claimed !== false) return "full_run_all_passed_claim_forbidden";
  return allFalseError(evidence.final_state, SOURCE_FALSE_FIELDS, "phase43a_final_state");
}

function validateCapabilityContract(contract) {
  if (!contract || typeof contract !== "object") return "capability_contract_missing";
  if (contract.phase !== CURRENT_PHASE) return "capability_contract_phase_invalid";
  if (contract.phase_slug !== CURRENT_PHASE_SLUG) return "capability_contract_phase_slug_invalid";
  if (contract.expected_base !== "5f3352a") return "capability_contract_expected_base_invalid";
  if (contract.previous_phase !== PREVIOUS_PHASE) return "capability_contract_previous_phase_invalid";
  if (contract.previous_phase_slug !== PREVIOUS_PHASE_SLUG) return "capability_contract_previous_phase_slug_invalid";
  if (contract.kind !== "sealed_chain_read_only_status_inspection_capability_contract") return "capability_contract_kind_invalid";
  if (contract.mode !== "capability_contract_preview_only_no_implementation_no_execution") return "capability_contract_mode_invalid";
  if (contract.source_chain !== "Phase42A-Phase42V") return "capability_contract_source_chain_invalid";
  if (contract.explicit_scope_phase !== PREVIOUS_PHASE) return "capability_contract_scope_phase_invalid";
  if (contract.explicit_scope_id !== "phase43-production-candidate-store-post-closure-explicit-scope") return "capability_contract_scope_id_invalid";
  if (contract.phase43a_contract_digest !== PHASE43A_CONTRACT_DIGEST) return "capability_contract_phase43a_contract_digest_invalid";
  if (contract.phase43a_acceptance_digest !== PHASE43A_ACCEPTANCE_DIGEST) return "capability_contract_phase43a_acceptance_digest_invalid";
  if (contract.phase42v_seal_digest !== PHASE42V_SEAL_DIGEST) return "capability_contract_phase42v_seal_digest_invalid";
  if (contract.capability_id !== "inspect_sealed_chain_closure_metadata") return "capability_contract_id_invalid";
  if (contract.capability_kind !== "read_only_status_inspection") return "capability_contract_kind_scope_invalid";
  if (contract.capability_scope !== "sealed_chain_closure_and_explicit_scope_metadata_only") return "capability_contract_scope_invalid";

  for (const field of REQUIRED_TRUE_CONTRACT_FIELDS) {
    if (contract[field] !== true) return `capability_contract_${field}_must_be_true`;
  }
  for (const field of REQUIRED_FALSE_CONTRACT_FIELDS) {
    if (contract[field] !== false) return "capability_contract_authorization_or_persistence_detected";
  }

  if (stableHash(contract.status_field_allowlist) !== stableHash(STATUS_FIELD_ALLOWLIST)) return "capability_contract_status_allowlist_invalid";
  if (stableHash(contract.forbidden_data_classes) !== stableHash(FORBIDDEN_DATA_CLASSES)) return "capability_contract_forbidden_data_classes_invalid";
  if (stableHash(contract.blocked_actions) !== stableHash(BLOCKED_ACTIONS)) return "capability_contract_blocked_actions_invalid";
  if (contract.full_run_all_status !== FULL_RUN_ALL_PENDING_STATUS) return "capability_contract_full_run_all_status_invalid";
  if (contract.full_run_all_pending_message !== FULL_RUN_ALL_PENDING_MESSAGE) return "capability_contract_full_run_all_message_invalid";
  return null;
}

function buildCapabilityPreviewDigest(evidence, contract) {
  return stableHash({
    phase: CURRENT_PHASE,
    previous_phase: PREVIOUS_PHASE,
    source_chain: evidence.source_chain,
    source_chain_closed: evidence.source_chain_closed,
    explicit_scope_id: evidence.new_scope_id,
    phase43a_contract_digest: evidence.contract_digest,
    phase43a_acceptance_digest: evidence.acceptance_digest,
    phase42v_seal_digest: evidence.phase42v_seal_digest,
    capability_id: contract.capability_id,
    capability_kind: contract.capability_kind,
    capability_scope: contract.capability_scope,
    contract_digest: stableHash(contract),
    full_run_all_status: contract.full_run_all_status
  });
}

function previewPhase43BStatusInspectionCapabilityContract({
  userRequest,
  acceptanceEvidence = makePhase43AAcceptanceEvidence(),
  contract = makeCapabilityContract(),
  state = BASELINE_STATE
} = {}) {
  const intent = classifyIntent(userRequest);
  if (!intent.explicit_capability_contract) return reject("missing_explicit_phase43b_capability_contract_request", state);

  if (allFalseError(state, PROTECTED_FALSE_FIELDS, "input_state")) {
    return reject("input_state_mutation_detected", BASELINE_STATE);
  }

  for (const error of [
    validatePhase43AAcceptanceEvidence(acceptanceEvidence),
    validateCapabilityContract(contract)
  ]) {
    if (error) return reject(error, state);
  }

  const previewDigest = buildCapabilityPreviewDigest(acceptanceEvidence, contract);
  const previewId =
    `phase43b_capability_contract_${previewDigest.slice("sha256:".length, "sha256:".length + 24)}`;
  const directRequestsDetected = Object.freeze({
    invoke_capability: intent.invoke_capability,
    generate_status_report: intent.generate_status_report,
    read_production_contents: intent.read_production_contents,
    enumerate_production_records: intent.enumerate_production_records,
    persist_contract: intent.persist_contract,
    implement_capability: intent.implement_capability,
    reopen_phase42: intent.reopen_phase42,
    inherit_phase42_authority: intent.inherit_phase42_authority,
    transfer_authority: intent.transfer_authority,
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
    full_run_all_passed_claim: intent.full_run_all_passed_claim
  });

  return Object.freeze({
    ...BASELINE_STATE,
    accepted: true,
    reason:
      "production_candidate_store_promotion_gate_sealed_chain_read_only_status_inspection_capability_contract_preview_only",
    phase: CURRENT_PHASE,
    phase_slug: CURRENT_PHASE_SLUG,
    source_phase: PREVIOUS_PHASE,
    source_phase_slug: PREVIOUS_PHASE_SLUG,
    source_chain: "Phase42A-Phase42V",
    source_chain_closed: true,
    source_chain_reopened: false,
    phase43a_acceptance_verified: true,
    phase43a_contract_digest_verified: true,
    phase43a_acceptance_digest_verified: true,
    phase42v_seal_digest_verified: true,
    explicit_scope_id: contract.explicit_scope_id,
    capability_id: contract.capability_id,
    capability_kind: contract.capability_kind,
    capability_scope: contract.capability_scope,
    read_only_capability: true,
    metadata_only_capability: true,
    capability_contract_generated: true,
    capability_contract_persisted: false,
    capability_contract_ready: true,
    capability_implementation_present: false,
    capability_implementation_authorized: false,
    capability_execution_authorized: false,
    capability_invocation_performed: false,
    status_report_generated: false,
    production_candidate_store_contents_read: false,
    production_candidate_records_enumerated: false,
    source_authority_inherited: false,
    authority_transferred: false,
    scope_execution_authorized: false,
    contract_mode: contract.mode,
    contract_digest: stableHash(contract),
    preview_id: previewId,
    preview_digest: previewDigest,
    status_field_allowlist: [...STATUS_FIELD_ALLOWLIST],
    forbidden_data_classes: [...FORBIDDEN_DATA_CLASSES],
    blocked_direct_actions: [...BLOCKED_ACTIONS],
    direct_requests_detected: directRequestsDetected,
    full_run_all_status: FULL_RUN_ALL_PENDING_STATUS,
    full_run_all_pending_message: FULL_RUN_ALL_PENDING_MESSAGE,
    full_run_all_passed_claimed: false,
    capability_contract_preview: Object.freeze({
      preview_id: previewId,
      generated: true,
      persisted: false,
      preview_only: true,
      capability_id: contract.capability_id,
      capability_kind: contract.capability_kind,
      capability_scope: contract.capability_scope,
      read_only: true,
      metadata_only: true,
      implementation_present: false,
      implementation_authorized: false,
      execution_authorized: false,
      invocation_performed: false,
      status_report_generated: false,
      production_candidate_store_contents_read: false,
      production_candidate_records_enumerated: false,
      source_chain_closed: true,
      source_chain_reopened: false,
      authority_transferred: false,
      status_field_allowlist: [...STATUS_FIELD_ALLOWLIST],
      forbidden_data_classes: [...FORBIDDEN_DATA_CLASSES],
      blocked_actions: [...BLOCKED_ACTIONS],
      full_run_all_status: FULL_RUN_ALL_PENDING_STATUS
    }),
    next_phase_guidance: Object.freeze({
      status: "read_only_status_inspection_capability_contract_ready_preview_only",
      current_phase_implements_capability: false,
      current_phase_authorizes_capability_execution: false,
      further_work_requires_separate_explicit_phase: true,
      recommended_next_step:
        "Define Phase43C implementation readiness for the metadata-only read-only status inspection capability. Do not implement or invoke the capability in Phase43B.",
      forbidden_inference:
        "Phase43B contract readiness does not grant production candidate content access, record enumeration, writes, promotion, gate opening, governance changes, adoption, settlement, Canon changes, or active_engine changes."
    }),
    state_after: clone(state)
  });
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.capability_contract_generated, false);
  assert.equal(result.capability_contract_persisted, false);
  assert.equal(result.capability_contract_ready, false);
  assert.equal(result.capability_implementation_present, false);
  assert.equal(result.capability_implementation_authorized, false);
  assert.equal(result.capability_execution_authorized, false);
  assert.equal(result.capability_invocation_performed, false);
  assert.equal(result.status_report_generated, false);
  assert.equal(result.source_chain_reopened, false);
  assert.equal(result.source_authority_inherited, false);
  assert.equal(result.authority_transferred, false);
  assert.deepEqual(result.state_after, BASELINE_STATE);
}

function assertNoExecutableMutationCalls() {
  const source = readRepoFile(
    "tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs"
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
    /\breadProductionCandidateContents\s*\(/,
    /\benumerateProductionCandidateRecords\s*\(/,
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
      `Phase43B capability contract must not contain executable mutation or protected data access call pattern ${pattern}`
    );
  }
}

const capabilityContractDigest = stableHash(capabilityContract);
assert.equal(
  capabilityContractDigest,
  "sha256:60af34792b3034bd1a99214680d00da028ce6dce53abf800197722617f344de8",
  "Phase43B capability contract deterministic digest changed unexpectedly"
);

const phase43APath =
  "tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs";
const phase43ASource = readRepoFile(phase43APath);

for (const marker of [
  'const CURRENT_PHASE = "Phase43A";',
  'const PREVIOUS_PHASE = "Phase42V";',
  PHASE43A_CONTRACT_DIGEST,
  PHASE42V_SEAL_DIGEST,
  'new_scope_id: "phase43-production-candidate-store-post-closure-explicit-scope"',
  'source_chain: "Phase42A-Phase42V"',
  "source_chain_closed: true",
  "source_chain_reopened: false",
  "scope_execution_authorized: false",
  "phase43a_explicit_scope_acceptance_generated: true",
  "phase43a_explicit_scope_acceptance_persisted: false",
  "scope_contract_generated: true",
  "scope_contract_persisted: false",
  "no_implicit_continuation: true",
  "Define a separate Phase43B contract for one narrowly scoped post-closure capability.",
  FULL_RUN_ALL_PENDING_MESSAGE
]) {
  assert.equal(
    phase43ASource.includes(marker),
    true,
    `Phase43A source contract marker missing: ${marker}`
  );
}

const runAllText = readRepoFile("tests/run-all.mjs");
const currentTestPath =
  "tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs";
const phase43ARegistration =
  '  ["Phase 43A production candidate store promotion gate sealed chain explicit scope acceptance smoke", ["tests/phase43/phase43a-production-candidate-store-promotion-gate-sealed-chain-explicit-scope-acceptance-smoke.test.mjs"]],';
const phase43BRegistration =
  '  ["Phase 43B production candidate store promotion gate sealed chain read-only status inspection capability contract smoke", ["tests/phase43/phase43b-production-candidate-store-promotion-gate-sealed-chain-read-only-status-inspection-capability-contract-smoke.test.mjs"]],';

assert.equal(countOccurrences(runAllText, phase43APath), 1);
assert.equal(countOccurrences(runAllText, currentTestPath), 1);
assertImmediateRegistrationAdjacency({
  sourceText: runAllText,
  previousRegistration: phase43ARegistration,
  currentRegistration: phase43BRegistration,
  message: "Phase43B registration must be immediately after Phase43A",
});

assertRejected(
  previewPhase43BStatusInspectionCapabilityContract({ userRequest: "Continue ordinary work." }),
  "missing_explicit_phase43b_capability_contract_request"
);
assertRejected(
  previewPhase43BStatusInspectionCapabilityContract({
    userRequest: "Phase43B read-only status inspection capability contract",
    acceptanceEvidence: null
  }),
  "phase43a_acceptance_evidence_missing"
);

for (const [override, reason] of [
  [{ accepted: false }, "phase43a_acceptance_not_accepted"],
  [{ source_chain_closed: false }, "phase43a_source_chain_not_closed"],
  [{ source_chain_reopened: true }, "phase43a_source_chain_reopened"],
  [{ phase42v_seal_digest: "sha256:tampered" }, "phase43a_phase42v_seal_digest_invalid"],
  [{ source_authority_inherited: true }, "phase43a_source_authority_inherited"],
  [{ authority_transferred: true }, "phase43a_authority_transferred"],
  [{ scope_execution_authorized: true }, "phase43a_scope_execution_authorized"],
  [{ phase43a_explicit_scope_acceptance_persisted: true }, "phase43a_acceptance_persisted"],
  [{ scope_contract_persisted: true }, "phase43a_scope_contract_persisted"],
  [{ acceptance_digest: "sha256:tampered" }, "phase43a_acceptance_digest_invalid"],
  [{ contract_digest: "sha256:tampered" }, "phase43a_contract_digest_invalid"],
  [{ full_run_all_status: "passed" }, "full_run_all_status_must_remain_pending"]
]) {
  assertRejected(
    previewPhase43BStatusInspectionCapabilityContract({
      userRequest: "Phase43B read-only status inspection capability contract",
      acceptanceEvidence: makePhase43AAcceptanceEvidence(override)
    }),
    reason
  );
}

assertRejected(
  previewPhase43BStatusInspectionCapabilityContract({
    userRequest: "Phase43B read-only status inspection capability contract",
    acceptanceEvidence: makePhase43AAcceptanceEvidence({
      final_state: {
        ...SOURCE_BASELINE_STATE,
        production_candidate_store_mutated: true
      }
    })
  }),
  "phase43a_final_state_production_candidate_store_mutated_must_remain_false"
);

for (const [override, reason] of [
  [{ mode: "implement_and_execute" }, "capability_contract_mode_invalid"],
  [{ source_chain_closed: false }, "capability_contract_source_chain_closed_must_be_true"],
  [{ source_chain_reopen_allowed: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ read_only_capability: false }, "capability_contract_read_only_capability_must_be_true"],
  [{ metadata_only_capability: false }, "capability_contract_metadata_only_capability_must_be_true"],
  [{ contract_persistence_allowed: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ capability_implementation_present: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ capability_execution_authorized: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ capability_invocation_allowed: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ production_candidate_store_contents_read_allowed: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ production_write_authorized: true }, "capability_contract_authorization_or_persistence_detected"],
  [{ phase43a_acceptance_digest: "sha256:tampered" }, "capability_contract_phase43a_acceptance_digest_invalid"],
  [{ status_field_allowlist: ["source_chain"] }, "capability_contract_status_allowlist_invalid"],
  [{ forbidden_data_classes: [] }, "capability_contract_forbidden_data_classes_invalid"],
  [{ full_run_all_status: "passed" }, "capability_contract_full_run_all_status_invalid"]
]) {
  assertRejected(
    previewPhase43BStatusInspectionCapabilityContract({
      userRequest: "Phase43B read-only status inspection capability contract",
      contract: makeCapabilityContract(override)
    }),
    reason
  );
}

assertRejected(
  previewPhase43BStatusInspectionCapabilityContract({
    userRequest: "Phase43B read-only status inspection capability contract",
    state: { ...BASELINE_STATE, active_engine_updated: true }
  }),
  "input_state_mutation_detected"
);

const success = previewPhase43BStatusInspectionCapabilityContract({
  userRequest:
    "Phase43B read-only status inspection capability contract for sealed-chain closure metadata only. Define the contract without implementation, execution, persistence, production content access, or authority transfer."
});

assert.equal(success.accepted, true);
assert.equal(
  success.reason,
  "production_candidate_store_promotion_gate_sealed_chain_read_only_status_inspection_capability_contract_preview_only"
);
assert.equal(success.phase, CURRENT_PHASE);
assert.equal(success.source_phase, PREVIOUS_PHASE);
assert.equal(success.source_chain_closed, true);
assert.equal(success.source_chain_reopened, false);
assert.equal(success.phase43a_acceptance_verified, true);
assert.equal(success.phase43a_contract_digest_verified, true);
assert.equal(success.phase43a_acceptance_digest_verified, true);
assert.equal(success.phase42v_seal_digest_verified, true);
assert.equal(success.capability_id, "inspect_sealed_chain_closure_metadata");
assert.equal(success.capability_kind, "read_only_status_inspection");
assert.equal(success.capability_scope, "sealed_chain_closure_and_explicit_scope_metadata_only");
assert.equal(success.read_only_capability, true);
assert.equal(success.metadata_only_capability, true);
assert.equal(success.capability_contract_generated, true);
assert.equal(success.capability_contract_persisted, false);
assert.equal(success.capability_contract_ready, true);
assert.equal(success.capability_implementation_present, false);
assert.equal(success.capability_implementation_authorized, false);
assert.equal(success.capability_execution_authorized, false);
assert.equal(success.capability_invocation_performed, false);
assert.equal(success.status_report_generated, false);
assert.equal(success.production_candidate_store_contents_read, false);
assert.equal(success.production_candidate_records_enumerated, false);
assert.equal(success.contract_digest, capabilityContractDigest);
assert.equal(success.preview_digest, "sha256:9821708af022f349c178729909afc98b5c0b80410390421b25b9c8e5490f13f6");
assert.deepEqual(success.status_field_allowlist, STATUS_FIELD_ALLOWLIST);
assert.deepEqual(success.forbidden_data_classes, FORBIDDEN_DATA_CLASSES);
assert.deepEqual(success.blocked_direct_actions, BLOCKED_ACTIONS);
assert.equal(success.full_run_all_status, FULL_RUN_ALL_PENDING_STATUS);
assert.equal(success.full_run_all_pending_message, FULL_RUN_ALL_PENDING_MESSAGE);
assert.equal(success.full_run_all_passed_claimed, false);
assert.equal(success.capability_contract_preview.persisted, false);
assert.equal(success.capability_contract_preview.preview_only, true);
assert.equal(success.capability_contract_preview.implementation_present, false);
assert.equal(success.capability_contract_preview.execution_authorized, false);
assert.equal(success.capability_contract_preview.invocation_performed, false);
assert.equal(success.capability_contract_preview.production_candidate_store_contents_read, false);
assert.equal(success.next_phase_guidance.current_phase_implements_capability, false);
assert.equal(success.next_phase_guidance.current_phase_authorizes_capability_execution, false);
assert.equal(success.next_phase_guidance.further_work_requires_separate_explicit_phase, true);
assertAllFalse(success, PROTECTED_FALSE_FIELDS, "success");
assert.deepEqual(success.state_after, BASELINE_STATE);

const riskyRequest = previewPhase43BStatusInspectionCapabilityContract({
  userRequest: [
    "Phase43B read-only status inspection capability contract.",
    "Implement and invoke the capability and generate a status report.",
    "Read production candidate content and enumerate production candidate records.",
    "Persist the capability contract.",
    "Reopen Phase42, inherit Phase42 authority, and transfer authority.",
    "Write the production candidate store and execute production promotion.",
    "Open the production gate and consume the guard token.",
    "Create approval request and pending engine candidate.",
    "Create audit receipt and backup snapshot.",
    "Execute rollback restore.",
    "Adopt and settle.",
    "Update Canon and update active_engine.",
    "Claim full run-all passed."
  ].join(" ")
});

for (const field of [
  "invoke_capability",
  "generate_status_report",
  "read_production_contents",
  "enumerate_production_records",
  "persist_contract",
  "implement_capability",
  "reopen_phase42",
  "inherit_phase42_authority",
  "transfer_authority",
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
  "full_run_all_passed_claim"
]) {
  assert.equal(riskyRequest.direct_requests_detected[field], true);
}
assert.equal(riskyRequest.accepted, true);
assert.equal(riskyRequest.capability_contract_generated, true);
assert.equal(riskyRequest.capability_contract_persisted, false);
assert.equal(riskyRequest.capability_implementation_present, false);
assert.equal(riskyRequest.capability_execution_authorized, false);
assert.equal(riskyRequest.capability_invocation_performed, false);
assert.equal(riskyRequest.status_report_generated, false);
assert.equal(riskyRequest.production_candidate_store_contents_read, false);
assert.equal(riskyRequest.production_candidate_records_enumerated, false);
assert.equal(riskyRequest.source_chain_reopened, false);
assert.equal(riskyRequest.source_authority_inherited, false);
assert.equal(riskyRequest.authority_transferred, false);
assertAllFalse(riskyRequest, PROTECTED_FALSE_FIELDS, "riskyRequest");
assert.deepEqual(riskyRequest.state_after, BASELINE_STATE);

assertNoExecutableMutationCalls();

console.log(
  `Phase43B production candidate store promotion gate sealed chain read-only status inspection capability contract digest: ${capabilityContractDigest}`
);
console.log(
  `Phase43B production candidate store promotion gate sealed chain read-only status inspection capability preview digest: ${success.preview_digest}`
);
console.log(
  "Phase43B production candidate store promotion gate sealed chain read-only status inspection capability contract smoke tests passed."
);
