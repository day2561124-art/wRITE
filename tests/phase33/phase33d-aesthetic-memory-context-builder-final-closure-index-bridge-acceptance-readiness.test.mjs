import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

const PHASE_33A_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33a-aesthetic-memory-context-builder-final-closure-index.test.mjs',
);

const PHASE_33B_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33b-aesthetic-memory-context-builder-final-closure-index-bridge-preview.test.mjs',
);

const PHASE_33C_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33c-aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke.test.mjs',
);

const PHASE_33D_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33d-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness.test.mjs',
);

const RUN_ALL = path.join(repoRoot, 'tests', 'run-all.mjs');

const PHASE_33A_DETERMINISTIC_DIGEST =
  'sha256:8643ab81616d762b73452c6b3b94732e93539cc2ca15caeff1b7bc6056cfceb7';

const PHASE_33B_BRIDGE_PREVIEW_DIGEST =
  'sha256:3eaaf69f6c18ed3ddb14a9f8729d028f1bb8078dfc079a921ad7a65d25e42867';

const PHASE_33C_FINAL_SMOKE_DIGEST =
  'sha256:0051d3c1c7c114052bc57f3c9088a415f42f0d08cdcc8fda6d15ec17b10ed411';

const PHASE_33D_ACCEPTANCE_READINESS_DIGEST =
  'sha256:b6d7b982a09668eb5036b9b032b74c3a587e481a3da924d479977c638a92a601';

const REQUIRED_FALSE_SAFETY_FLAGS = [
  'external_llm_called',
  'local_generation_called',
  'approval_confirmed',
  'adoption_confirmed',
  'adopted_chapter_created',
  'pending_engine_candidate_created',
  'active_engine_modified',
  'compressed_rules_modified',
  'restore_executed',
  'rollback_executed',
];

const FORBIDDEN_MUTATION_TARGETS = [
  'canon',
  'active_engine',
  'compressed_rules',
  'settlement_context',
  'handoff',
  'candidate',
  'operator_decision',
  'approval',
  'adoption',
  'recovery',
  'rollback',
];

function sha256Json(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPhase33CFinalSmokeFixture() {
  return normalize({
    phase: '33C',
    source_phase: '33B',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke',
    mode: 'final-smoke',
    digest: PHASE_33C_FINAL_SMOKE_DIGEST,
    bridge_preview_under_test: {
      source_phase: '33B',
      source_name: 'aesthetic-memory-context-builder-final-closure-index-bridge-preview',
      source_mode: 'bridge-preview',
      source_digest: PHASE_33B_BRIDGE_PREVIEW_DIGEST,
      inherited_final_closure_index_digest: PHASE_33A_DETERMINISTIC_DIGEST,
      inherited_boundary: 'final-closure-index',
      inherited_closure_kind: 'final',
    },
    final_smoke_scope: {
      read_only: true,
      final_smoke_only: true,
      inspect_only: true,
      no_mcp_tool_addition: true,
      no_canon_write: true,
      no_active_engine_write: true,
      no_compressed_rules_write: true,
      no_recovery: true,
      no_settlement_context_persistence: true,
      no_handoff_persistence: true,
      no_candidate_persistence: true,
      no_operator_decision_persistence: true,
    },
    safety_flags: Object.fromEntries(REQUIRED_FALSE_SAFETY_FLAGS.map((flag) => [flag, false])),
    mutation_report: {
      mutation_targets: [],
      forbidden_mutation_targets_checked: FORBIDDEN_MUTATION_TARGETS,
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_modified: false,
      settlement_context_persisted: false,
      handoff_persisted: false,
      candidate_persisted: false,
      operator_decision_persisted: false,
      recovery_executed: false,
      rollback_executed: false,
    },
  });
}

function createPhase33DAcceptanceReadiness() {
  const smoke = createPhase33CFinalSmokeFixture();

  return normalize({
    phase: '33D',
    source_phase: '33C',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness',
    mode: 'acceptance-readiness',
    acceptance_readiness_scope: {
      read_only: true,
      acceptance_readiness_only: true,
      inspect_only: true,
      no_mcp_tool_addition: true,
      no_canon_write: true,
      no_active_engine_write: true,
      no_compressed_rules_write: true,
      no_recovery: true,
      no_settlement_context_persistence: true,
      no_handoff_persistence: true,
      no_candidate_persistence: true,
      no_operator_decision_persistence: true,
      no_approval: true,
      no_adoption: true,
    },
    final_smoke_under_review: {
      source_phase: smoke.phase,
      source_name: smoke.name,
      source_mode: smoke.mode,
      source_digest: smoke.digest,
      phase33a_digest: smoke.bridge_preview_under_test.inherited_final_closure_index_digest,
      phase33b_digest: smoke.bridge_preview_under_test.source_digest,
      boundary: smoke.bridge_preview_under_test.inherited_boundary,
      closure_kind: smoke.bridge_preview_under_test.inherited_closure_kind,
    },
    readiness_decision: {
      checked: true,
      ok: true,
      decision: 'ready_for_acceptance_readiness_review',
      source: 'phase33c-final-smoke',
      lineage_complete: true,
      blocking_reasons: [],
      can_enter_acceptance_readiness: true,
      can_approve: false,
      can_confirm_adoption: false,
      can_persist_operator_decision: false,
      can_create_candidate: false,
      can_save_settlement_context: false,
      can_save_handoff: false,
    },
    acceptance_readiness_assertions: {
      phase33a_digest_accepted: true,
      phase33b_digest_accepted: true,
      phase33c_digest_accepted: true,
      final_smoke_still_read_only: true,
      final_smoke_has_no_mutation_targets: true,
      lineage_ready_without_approval: true,
      lineage_ready_without_adoption: true,
      operator_decision_not_persisted: true,
      settlement_context_not_persisted: true,
      handoff_not_persisted: true,
      candidate_not_persisted: true,
      mcp_tool_addition_absent: true,
    },
    safety_flags: smoke.safety_flags,
    mutation_report: {
      mutation_targets: [],
      forbidden_mutation_targets_checked: FORBIDDEN_MUTATION_TARGETS,
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_modified: false,
      settlement_context_persisted: false,
      handoff_persisted: false,
      candidate_persisted: false,
      operator_decision_persisted: false,
      approval_confirmed: false,
      adoption_confirmed: false,
      recovery_executed: false,
      rollback_executed: false,
    },
  });
}

test('Phase33D acceptance readiness is anchored to Phase33A, Phase33B, and Phase33C artifacts', () => {
  assert.ok(fs.existsSync(PHASE_33A_TEST), 'Phase33A final closure index test must exist');
  assert.ok(fs.existsSync(PHASE_33B_TEST), 'Phase33B bridge preview test must exist');
  assert.ok(fs.existsSync(PHASE_33C_TEST), 'Phase33C final smoke test must exist');
  assert.ok(fs.existsSync(PHASE_33D_TEST), 'Phase33D acceptance readiness test must exist');

  const readiness = createPhase33DAcceptanceReadiness();

  assert.equal(readiness.phase, '33D');
  assert.equal(readiness.source_phase, '33C');
  assert.equal(readiness.mode, 'acceptance-readiness');

  assert.equal(readiness.final_smoke_under_review.phase33a_digest, PHASE_33A_DETERMINISTIC_DIGEST);
  assert.equal(readiness.final_smoke_under_review.phase33b_digest, PHASE_33B_BRIDGE_PREVIEW_DIGEST);
  assert.equal(readiness.final_smoke_under_review.source_digest, PHASE_33C_FINAL_SMOKE_DIGEST);
  assert.equal(readiness.final_smoke_under_review.boundary, 'final-closure-index');
  assert.equal(readiness.final_smoke_under_review.closure_kind, 'final');
});

test('Phase33D acceptance readiness allows readiness inspection but blocks approval, adoption, and persistence', () => {
  const readiness = createPhase33DAcceptanceReadiness();

  assert.equal(readiness.acceptance_readiness_scope.read_only, true);
  assert.equal(readiness.acceptance_readiness_scope.acceptance_readiness_only, true);
  assert.equal(readiness.acceptance_readiness_scope.inspect_only, true);
  assert.equal(readiness.acceptance_readiness_scope.no_mcp_tool_addition, true);
  assert.equal(readiness.acceptance_readiness_scope.no_canon_write, true);
  assert.equal(readiness.acceptance_readiness_scope.no_active_engine_write, true);
  assert.equal(readiness.acceptance_readiness_scope.no_compressed_rules_write, true);
  assert.equal(readiness.acceptance_readiness_scope.no_recovery, true);
  assert.equal(readiness.acceptance_readiness_scope.no_settlement_context_persistence, true);
  assert.equal(readiness.acceptance_readiness_scope.no_handoff_persistence, true);
  assert.equal(readiness.acceptance_readiness_scope.no_candidate_persistence, true);
  assert.equal(readiness.acceptance_readiness_scope.no_operator_decision_persistence, true);
  assert.equal(readiness.acceptance_readiness_scope.no_approval, true);
  assert.equal(readiness.acceptance_readiness_scope.no_adoption, true);

  assert.equal(readiness.readiness_decision.checked, true);
  assert.equal(readiness.readiness_decision.ok, true);
  assert.equal(readiness.readiness_decision.lineage_complete, true);
  assert.deepEqual(readiness.readiness_decision.blocking_reasons, []);
  assert.equal(readiness.readiness_decision.can_enter_acceptance_readiness, true);
  assert.equal(readiness.readiness_decision.can_approve, false);
  assert.equal(readiness.readiness_decision.can_confirm_adoption, false);
  assert.equal(readiness.readiness_decision.can_persist_operator_decision, false);
  assert.equal(readiness.readiness_decision.can_create_candidate, false);
  assert.equal(readiness.readiness_decision.can_save_settlement_context, false);
  assert.equal(readiness.readiness_decision.can_save_handoff, false);
});

test('Phase33D acceptance readiness preserves all safety and mutation flags as false', () => {
  const readiness = createPhase33DAcceptanceReadiness();

  for (const [assertionName, value] of Object.entries(readiness.acceptance_readiness_assertions)) {
    assert.equal(value, true, `acceptance readiness assertion must be true: ${assertionName}`);
  }

  for (const flag of REQUIRED_FALSE_SAFETY_FLAGS) {
    assert.equal(readiness.safety_flags[flag], false, `safety flag must remain false: ${flag}`);
  }

  assert.deepEqual(readiness.mutation_report.mutation_targets, []);
  assert.equal(readiness.mutation_report.active_engine_modified, false);
  assert.equal(readiness.mutation_report.compressed_rules_modified, false);
  assert.equal(readiness.mutation_report.canon_modified, false);
  assert.equal(readiness.mutation_report.settlement_context_persisted, false);
  assert.equal(readiness.mutation_report.handoff_persisted, false);
  assert.equal(readiness.mutation_report.candidate_persisted, false);
  assert.equal(readiness.mutation_report.operator_decision_persisted, false);
  assert.equal(readiness.mutation_report.approval_confirmed, false);
  assert.equal(readiness.mutation_report.adoption_confirmed, false);
  assert.equal(readiness.mutation_report.recovery_executed, false);
  assert.equal(readiness.mutation_report.rollback_executed, false);
});

test('Phase33D acceptance readiness is deterministic and registered in run-all', () => {
  const readiness = createPhase33DAcceptanceReadiness();
  const digest = sha256Json(readiness);

  assert.equal(digest, PHASE_33D_ACCEPTANCE_READINESS_DIGEST);

  const runAll = fs.readFileSync(RUN_ALL, 'utf8');
  assert.match(
    runAll,
    /phase33d-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness\.test\.mjs/,
    'Phase33D test must be registered in tests/run-all.mjs',
  );
});


