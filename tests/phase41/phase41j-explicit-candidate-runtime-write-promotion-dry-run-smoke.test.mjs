import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASELINE_STATE = Object.freeze({
  production_candidate_saved: false,
  production_write_performed: false,
  production_guard_opened: false,
  production_promotion_performed: false,
  promotion_dry_run_plan_generated: false,
  promotion_dry_run_plan_persisted: false,
  promotion_dry_run_proof_generated: false,
  promotion_dry_run_proof_persisted: false,
  sandbox_candidate_saved: false,
  candidate_runtime_write_performed: false,
  guard_token_consumed: false,
  backup_snapshot_created: false,
  rollback_executed: false,
  dry_run_proof_persisted: false,
  approval_request_created: false,
  pending_engine_candidate_created: false,
  adoption_performed: false,
  settlement_performed: false,
  canon_update_performed: false,
  active_engine_update_performed: false,
});

const MUTATION_FIELDS = [
  "production_candidate_saved",
  "production_write_performed",
  "production_promotion_performed",
  "promotion_dry_run_plan_persisted",
  "promotion_dry_run_proof_persisted",
  "guard_token_consumed",
  "backup_snapshot_created",
  "rollback_executed",
  "dry_run_proof_persisted",
  "approval_request_created",
  "pending_engine_candidate_created",
  "adoption_performed",
  "settlement_performed",
  "canon_update_performed",
  "active_engine_update_performed",
];

const RUNTIME_MUTATION_FIELDS = [
  ...MUTATION_FIELDS,
  "production_guard_opened",
  "sandbox_candidate_saved",
  "candidate_runtime_write_performed",
  "promotion_dry_run_plan_generated",
  "promotion_dry_run_proof_generated",
];

const BLOCKED_ACTIONS = [
  "production_candidate_store_write",
  "production_candidate_store_promotion",
  "promotion_dry_run_plan_persist",
  "guard_token_consume",
  "backup_snapshot_create",
  "rollback_restore_execute",
  "dry_run_proof_persist",
  "approval_request_create",
  "pending_engine_candidate_create",
  "adoption",
  "settlement",
  "canon_update",
  "active_engine_update",
];

const CONTRACT_TRUE_FIELDS = [
  "source_guard_preview_required",
  "source_sandbox_service_write_required",
  "explicit_promotion_dry_run_request_required",
  "append_only_production_write_plan_required",
  "backup_snapshot_plan_required",
  "rollback_restore_plan_required",
  "guard_token_must_remain_unconsumed",
  "dry_run_proof_preview_only",
  "dry_run_proof_must_not_persist",
  "deterministic_candidate_id_required",
  "candidate_content_hash_required",
  "source_text_hash_required",
  "source_route_link_required",
  "candidate_identity_match_required",
  "no_approval_request",
  "no_pending_engine_candidate",
  "no_adoption",
  "no_settlement",
  "no_canon_update",
  "no_active_engine_update",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function assertFalseFields(snapshot, fields) {
  for (const field of fields) assert.equal(snapshot[field], false, `${field} must remain false`);
}

function makeServiceWrite(overrides = {}) {
  const text = "Chapter title\n\nA safe story-like native chat output body.";
  const sourceTextHash = sha256Text(text);
  const candidateContentHash = sha256Text(JSON.stringify({ kind: "chat_output", route: "chatgpt_native_full_neural_writing_handoff", text }));
  const record = {
    id: `candidate_${sha256Text(["CandidateRuntimeWriteService.writeCandidate", "chat_output", "chatgpt_native_full_neural_writing_handoff", sourceTextHash, candidateContentHash].join("|")).slice(0, 24)}`,
    kind: "candidate",
    source_kind: "chat_output",
    source_route: "chatgpt_native_full_neural_writing_handoff",
    source_text_hash: sourceTextHash,
    candidate_content_hash: candidateContentHash,
    text,
    persisted_to_production: false,
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    approval_request_id: null,
    pending_engine_candidate_id: null,
    adoption_id: null,
    settlement_id: null,
    canon_update_id: null,
    active_engine_update_id: null,
  };
  return {
    accepted: true,
    service_api: "CandidateRuntimeWriteService.writeCandidate",
    store_scope: "sandbox_candidate_store",
    service_write_performed: true,
    candidate_runtime_write_performed: true,
    sandbox_candidate_saved: true,
    production_candidate_saved: false,
    candidate_record: record,
    direct_requests_detected: { approval: false, pending_engine: false, adoption: false, settlement: false, canon: false, active_engine: false },
    ...overrides,
  };
}

function makeGuardPreview(serviceWrite, overrides = {}) {
  const record = serviceWrite.candidate_record;
  return {
    accepted: true,
    reason: "production_candidate_store_guard_preview_only",
    production_guard_opened: true,
    guard_mode: "test_only_preview",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    source_candidate_id: record.id,
    source_text_hash: record.source_text_hash,
    candidate_content_hash: record.candidate_content_hash,
    source_route: record.source_route,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    future_promotion_required: true,
    explicit_future_promotion_request_required: true,
    production_write_performed: false,
    production_promotion_performed: false,
    guard_token_consumed: false,
    guard_preview: { persisted: false, token_consumed: false, production_write_performed: false },
    direct_requests_detected: { production_write: false, approval: false, pending_engine: false, adoption: false, settlement: false, canon: false, active_engine: false },
    ...overrides,
  };
}

function makeContract(overrides = {}) {
  return {
    kind: "candidate_runtime_write_promotion_dry_run_contract",
    mode: "promotion_dry_run_only",
    promotion_route: "sandbox_candidate_store_to_production_candidate_store",
    source_store_scope_required: "sandbox_candidate_store",
    target_store_scope: "production_candidate_store",
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_promotion_allowed: false,
    source_guard_preview_required: true,
    source_sandbox_service_write_required: true,
    explicit_promotion_dry_run_request_required: true,
    append_only_production_write_plan_required: true,
    backup_snapshot_plan_required: true,
    rollback_restore_plan_required: true,
    guard_token_must_remain_unconsumed: true,
    dry_run_proof_preview_only: true,
    dry_run_proof_must_not_persist: true,
    deterministic_candidate_id_required: true,
    candidate_content_hash_required: true,
    source_text_hash_required: true,
    source_route_link_required: true,
    candidate_identity_match_required: true,
    no_approval_request: true,
    no_pending_engine_candidate: true,
    no_adoption: true,
    no_settlement: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ...overrides,
  };
}

function classifyIntent(text) {
  const normalized = String(text || "").toLowerCase();
  return {
    explicit: /\bpromotion dry[- ]run\b/.test(normalized) || /\bdry[- ]run\b.*\bpromotion\b/.test(normalized) || /\bsandbox\b.*\bproduction\b.*\bdry[- ]run\b/.test(normalized),
    production_write: /\bwrite\b.*\bproduction\b|\bproduction write\b/.test(normalized),
    production_promotion: /\bpromote\b.*\bproduction\b|\bproduction promotion\b/.test(normalized),
    approval: /\bapproval\b|\bapprove\b/.test(normalized),
    pending_engine: /\bpending engine\b|\bpending_engine\b/.test(normalized),
    adoption: /\badopt\b/.test(normalized),
    settlement: /\bsettle\b/.test(normalized),
    canon: /\bcanon\b/.test(normalized),
    active_engine: /\bactive_engine\b|\bactive engine\b/.test(normalized),
  };
}

function validateServiceWrite(serviceWrite) {
  if (!serviceWrite?.accepted) return "sandbox_service_write_not_accepted";
  if (serviceWrite.service_api !== "CandidateRuntimeWriteService.writeCandidate" || serviceWrite.store_scope !== "sandbox_candidate_store" || serviceWrite.service_write_performed !== true || serviceWrite.candidate_runtime_write_performed !== true || serviceWrite.sandbox_candidate_saved !== true || serviceWrite.production_candidate_saved !== false) return "sandbox_service_write_contract_invalid";
  const record = serviceWrite.candidate_record;
  if (record?.kind !== "candidate") return "sandbox_candidate_record_missing";
  if (record.store_scope !== "sandbox_candidate_store") return "sandbox_candidate_record_scope_invalid";
  if (record.persisted_to_production !== false) return "sandbox_candidate_already_persisted_to_production";
  if (record.source_route !== "chatgpt_native_full_neural_writing_handoff") return "sandbox_candidate_source_route_invalid";
  for (const field of ["approval_request_id", "pending_engine_candidate_id", "adoption_id", "settlement_id", "canon_update_id", "active_engine_update_id"]) if (record[field] !== null) return "sandbox_candidate_direct_action_id_not_null";
  return null;
}

function validateGuardPreview(guard) {
  if (!guard?.accepted) return "source_production_guard_preview_not_accepted";
  if (guard.reason !== "production_candidate_store_guard_preview_only") return "source_production_guard_preview_reason_invalid";
  if (guard.production_guard_opened !== true || guard.guard_mode !== "test_only_preview" || guard.promotion_route !== "sandbox_candidate_store_to_production_candidate_store" || guard.source_store_scope !== "sandbox_candidate_store" || guard.target_store_scope !== "production_candidate_store") return "source_production_guard_preview_contract_invalid";
  if (guard.production_write_allowed !== false || guard.production_write_blocked_by_default !== true || guard.future_promotion_required !== true || guard.explicit_future_promotion_request_required !== true) return "source_production_guard_preview_write_policy_invalid";
  if (guard.production_write_performed !== false) return "source_production_guard_preview_performed_write";
  if (guard.production_promotion_performed !== false) return "source_production_guard_preview_performed_promotion";
  if (guard.guard_token_consumed !== false) return "source_production_guard_token_consumed";
  if (guard.guard_preview?.persisted !== false) return "source_production_guard_preview_persisted";
  if (guard.guard_preview?.token_consumed !== false) return "source_production_guard_preview_token_consumed";
  if (guard.guard_preview?.production_write_performed !== false) return "source_production_guard_preview_nested_write_performed";
  return null;
}

function validateContract(contract) {
  if (contract?.kind !== "candidate_runtime_write_promotion_dry_run_contract") return "promotion_dry_run_contract_missing";
  if (contract.mode !== "promotion_dry_run_only") return "promotion_dry_run_contract_mode_invalid";
  if (contract.promotion_route !== "sandbox_candidate_store_to_production_candidate_store") return "promotion_dry_run_contract_route_invalid";
  if (contract.source_store_scope_required !== "sandbox_candidate_store") return "promotion_dry_run_source_scope_invalid";
  if (contract.target_store_scope !== "production_candidate_store") return "promotion_dry_run_target_scope_invalid";
  if (contract.production_write_allowed !== false) return "promotion_dry_run_contract_allows_production_write";
  if (contract.production_promotion_allowed !== false) return "promotion_dry_run_contract_allows_production_promotion";
  for (const field of CONTRACT_TRUE_FIELDS) if (contract[field] !== true) return "promotion_dry_run_contract_required_field_invalid";
  return null;
}

function validateLinkage(serviceWrite, guard) {
  const record = serviceWrite.candidate_record;
  if (guard.source_candidate_id !== record.id) return "promotion_dry_run_source_candidate_id_mismatch";
  if (guard.candidate_content_hash !== record.candidate_content_hash) return "promotion_dry_run_candidate_content_hash_mismatch";
  if (guard.source_text_hash !== record.source_text_hash) return "promotion_dry_run_source_text_hash_mismatch";
  if (guard.source_route !== record.source_route) return "promotion_dry_run_source_route_mismatch";
  return null;
}

function reject(reason, state) {
  return { accepted: false, reason, promotion_dry_run_plan_generated: false, production_write_allowed: false, production_promotion_allowed: false, state_after: clone(state) };
}

function previewPromotionDryRun({ serviceWrite, guardPreview, userRequest, contract = makeContract(), state = BASELINE_STATE }) {
  const intent = classifyIntent(userRequest);
  for (const error of [validateServiceWrite(serviceWrite), validateGuardPreview(guardPreview)]) if (error) return reject(error, state);
  if (!intent.explicit) return reject("missing_explicit_promotion_dry_run_request", state);
  for (const error of [validateContract(contract), validateLinkage(serviceWrite, guardPreview)]) if (error) return reject(error, state);

  const record = serviceWrite.candidate_record;
  const planId = `promotion_dry_run_plan_${sha256Text([record.id, record.candidate_content_hash, record.source_text_hash, record.source_route].join("|")).slice(0, 24)}`;

  return {
    accepted: true,
    reason: "production_candidate_store_promotion_dry_run_plan_preview_only",
    dry_run_mode: "test_only_promotion_plan_preview",
    promotion_route: contract.promotion_route,
    source_store_scope: serviceWrite.store_scope,
    target_store_scope: contract.target_store_scope,
    source_candidate_id: record.id,
    planned_production_candidate_id: record.id,
    candidate_id_verified: true,
    candidate_content_hash: record.candidate_content_hash,
    planned_candidate_content_hash: record.candidate_content_hash,
    candidate_content_hash_verified: true,
    source_text_hash: record.source_text_hash,
    planned_source_text_hash: record.source_text_hash,
    source_text_hash_verified: true,
    source_route: record.source_route,
    planned_source_route: record.source_route,
    source_route_link_verified: true,
    production_write_allowed: false,
    production_write_blocked_by_default: true,
    production_write_performed: false,
    production_promotion_allowed: false,
    production_promotion_performed: false,
    production_candidate_saved: false,
    promotion_dry_run_plan_generated: true,
    promotion_dry_run_plan_persisted: false,
    promotion_dry_run_proof_generated: true,
    promotion_dry_run_proof_persisted: false,
    dry_run_proof_persisted: false,
    guard_token_consumed: false,
    backup_snapshot_created: false,
    rollback_executed: false,
    approval_request_created: false,
    pending_engine_candidate_created: false,
    adoption_performed: false,
    settlement_performed: false,
    canon_update_performed: false,
    active_engine_update_performed: false,
    promotion_dry_run_plan_preview: { kind: "production_candidate_store_promotion_dry_run_plan_preview", id: planId, persisted: false, plan_only: true, candidate_id_match: true, candidate_content_hash_match: true, source_text_hash_match: true, source_route_link_match: true, production_write_performed: false, production_promotion_performed: false },
    append_only_production_write_plan: { kind: "append_only_production_candidate_store_write_plan", operation: "append_only_jsonl_append", target_store_scope: "production_candidate_store", planned: true, write_performed: false, persisted: false, overwrite_existing_record: false, candidate_record_preview: { id: record.id, source_route: record.source_route, source_text_hash: record.source_text_hash, candidate_content_hash: record.candidate_content_hash, persisted_to_production: false, planned_only: true, approval_request_id: null, pending_engine_candidate_id: null, adoption_id: null, settlement_id: null, canon_update_id: null, active_engine_update_id: null } },
    backup_snapshot_plan: { kind: "production_candidate_store_backup_snapshot_plan", planned: true, executed: false, persisted: false },
    rollback_restore_plan: { kind: "production_candidate_store_rollback_restore_plan", planned: true, executed: false, persisted: false },
    dry_run_proof_preview: { kind: "production_candidate_store_promotion_dry_run_proof_preview", generated: true, persisted: false, production_write_performed: false, production_promotion_performed: false, guard_token_consumed: false, candidate_id_verified: true, candidate_content_hash_verified: true, source_text_hash_verified: true, source_route_link_verified: true, append_only_plan_verified: true, backup_snapshot_plan_verified: true, rollback_restore_plan_verified: true },
    direct_requests_detected: { production_write: guardPreview.direct_requests_detected.production_write || intent.production_write, production_promotion: intent.production_promotion, approval: guardPreview.direct_requests_detected.approval || serviceWrite.direct_requests_detected.approval || intent.approval, pending_engine: guardPreview.direct_requests_detected.pending_engine || serviceWrite.direct_requests_detected.pending_engine || intent.pending_engine, adoption: guardPreview.direct_requests_detected.adoption || serviceWrite.direct_requests_detected.adoption || intent.adoption, settlement: guardPreview.direct_requests_detected.settlement || serviceWrite.direct_requests_detected.settlement || intent.settlement, canon: guardPreview.direct_requests_detected.canon || serviceWrite.direct_requests_detected.canon || intent.canon, active_engine: guardPreview.direct_requests_detected.active_engine || serviceWrite.direct_requests_detected.active_engine || intent.active_engine },
    blocked_direct_actions: BLOCKED_ACTIONS,
    next_allowed_phase: "phase41k_or_later_explicit_candidate_runtime_write_promotion_persistence_readiness",
    state_after: clone(state),
  };
}

function assertRejected(result, reason) {
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.promotion_dry_run_plan_generated, false);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

{
  const serviceWrite = makeServiceWrite();
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: null, userRequest: "build promotion dry-run plan" }), "source_production_guard_preview_not_accepted");
}

{
  const serviceWrite = makeServiceWrite();
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(serviceWrite), userRequest: "looks good, continue" }), "missing_explicit_promotion_dry_run_request");
}

{
  const serviceWrite = makeServiceWrite({ candidate_record: { ...makeServiceWrite().candidate_record, persisted_to_production: true } });
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(makeServiceWrite()), userRequest: "build promotion dry-run plan" }), "sandbox_candidate_already_persisted_to_production");
}

for (const [override, reason] of [
  [{ production_write_allowed: true }, "source_production_guard_preview_write_policy_invalid"],
  [{ production_write_performed: true }, "source_production_guard_preview_performed_write"],
  [{ production_promotion_performed: true }, "source_production_guard_preview_performed_promotion"],
  [{ guard_token_consumed: true }, "source_production_guard_token_consumed"],
  [{ guard_preview: { ...makeGuardPreview(makeServiceWrite()).guard_preview, persisted: true } }, "source_production_guard_preview_persisted"],
]) {
  const serviceWrite = makeServiceWrite();
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(serviceWrite, override), userRequest: "build promotion dry-run plan" }), reason);
}

for (const [override, reason] of [
  [{ mode: "promotion_write" }, "promotion_dry_run_contract_mode_invalid"],
  [{ target_store_scope: "sandbox_candidate_store" }, "promotion_dry_run_target_scope_invalid"],
  [{ production_write_allowed: true }, "promotion_dry_run_contract_allows_production_write"],
  [{ production_promotion_allowed: true }, "promotion_dry_run_contract_allows_production_promotion"],
  [{ dry_run_proof_must_not_persist: false }, "promotion_dry_run_contract_required_field_invalid"],
]) {
  const serviceWrite = makeServiceWrite();
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(serviceWrite), userRequest: "build promotion dry-run plan", contract: makeContract(override) }), reason);
}

for (const [override, reason] of [
  [{ source_candidate_id: "candidate_mismatched" }, "promotion_dry_run_source_candidate_id_mismatch"],
  [{ candidate_content_hash: "mismatched_hash" }, "promotion_dry_run_candidate_content_hash_mismatch"],
  [{ source_text_hash: "mismatched_source_hash" }, "promotion_dry_run_source_text_hash_mismatch"],
  [{ source_route: "other_route" }, "promotion_dry_run_source_route_mismatch"],
]) {
  const serviceWrite = makeServiceWrite();
  assertRejected(previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(serviceWrite, override), userRequest: "build promotion dry-run plan" }), reason);
}

{
  const serviceWrite = makeServiceWrite();
  const result = previewPromotionDryRun({ serviceWrite, guardPreview: makeGuardPreview(serviceWrite), userRequest: "build promotion dry-run plan" });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "production_candidate_store_promotion_dry_run_plan_preview_only");
  assert.equal(result.dry_run_mode, "test_only_promotion_plan_preview");
  assert.equal(result.source_candidate_id, serviceWrite.candidate_record.id);
  assert.equal(result.planned_production_candidate_id, serviceWrite.candidate_record.id);
  assert.equal(result.candidate_id_verified, true);
  assert.equal(result.candidate_content_hash_verified, true);
  assert.equal(result.source_text_hash_verified, true);
  assert.equal(result.source_route_link_verified, true);
  assert.equal(result.production_write_allowed, false);
  assert.equal(result.production_promotion_allowed, false);
  assert.equal(result.promotion_dry_run_plan_generated, true);
  assert.equal(result.promotion_dry_run_plan_persisted, false);
  assert.equal(result.promotion_dry_run_proof_generated, true);
  assert.equal(result.promotion_dry_run_proof_persisted, false);
  assert.equal(result.guard_token_consumed, false);
  assert.equal(result.promotion_dry_run_plan_preview.persisted, false);
  assert.equal(result.promotion_dry_run_plan_preview.plan_only, true);
  assert.equal(result.promotion_dry_run_plan_preview.candidate_id_match, true);
  assert.equal(result.promotion_dry_run_plan_preview.candidate_content_hash_match, true);
  assert.equal(result.promotion_dry_run_plan_preview.source_text_hash_match, true);
  assert.equal(result.promotion_dry_run_plan_preview.source_route_link_match, true);
  assert.equal(result.append_only_production_write_plan.operation, "append_only_jsonl_append");
  assert.equal(result.append_only_production_write_plan.write_performed, false);
  assert.equal(result.append_only_production_write_plan.persisted, false);
  assert.equal(result.append_only_production_write_plan.overwrite_existing_record, false);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.id, serviceWrite.candidate_record.id);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.persisted_to_production, false);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.planned_only, true);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.approval_request_id, null);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.pending_engine_candidate_id, null);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.adoption_id, null);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.settlement_id, null);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.canon_update_id, null);
  assert.equal(result.append_only_production_write_plan.candidate_record_preview.active_engine_update_id, null);
  assert.equal(result.backup_snapshot_plan.planned, true);
  assert.equal(result.backup_snapshot_plan.executed, false);
  assert.equal(result.backup_snapshot_plan.persisted, false);
  assert.equal(result.rollback_restore_plan.planned, true);
  assert.equal(result.rollback_restore_plan.executed, false);
  assert.equal(result.rollback_restore_plan.persisted, false);
  assert.equal(result.dry_run_proof_preview.generated, true);
  assert.equal(result.dry_run_proof_preview.persisted, false);
  assert.equal(result.dry_run_proof_preview.production_write_performed, false);
  assert.equal(result.dry_run_proof_preview.production_promotion_performed, false);
  assert.equal(result.dry_run_proof_preview.guard_token_consumed, false);
  assert.equal(result.dry_run_proof_preview.append_only_plan_verified, true);
  assert.equal(result.dry_run_proof_preview.backup_snapshot_plan_verified, true);
  assert.equal(result.dry_run_proof_preview.rollback_restore_plan_verified, true);
  assertFalseFields(result, MUTATION_FIELDS);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

{
  const serviceWrite = makeServiceWrite({ direct_requests_detected: { approval: true, pending_engine: true, adoption: true, settlement: true, canon: true, active_engine: true } });
  const guardPreview = makeGuardPreview(serviceWrite, { direct_requests_detected: { production_write: true, approval: true, pending_engine: true, adoption: true, settlement: true, canon: true, active_engine: true } });
  const result = previewPromotionDryRun({ serviceWrite, guardPreview, userRequest: "build promotion dry-run plan, write production, promote to production, approve it, create pending engine, adopt, settle into canon, and update active_engine" });
  assert.equal(result.accepted, true);
  assert.equal(result.direct_requests_detected.production_write, true);
  assert.equal(result.direct_requests_detected.production_promotion, true);
  assert.equal(result.direct_requests_detected.approval, true);
  assert.equal(result.direct_requests_detected.pending_engine, true);
  assert.equal(result.direct_requests_detected.adoption, true);
  assert.equal(result.direct_requests_detected.settlement, true);
  assert.equal(result.direct_requests_detected.canon, true);
  assert.equal(result.direct_requests_detected.active_engine, true);
  for (const action of BLOCKED_ACTIONS) assert.ok(result.blocked_direct_actions.includes(action), `${action} must be blocked`);
  assertFalseFields(result, MUTATION_FIELDS);
  assertFalseFields(result.state_after, RUNTIME_MUTATION_FIELDS);
}

console.log(
  "Phase41J explicit candidate runtime write promotion dry-run smoke tests passed."
);
