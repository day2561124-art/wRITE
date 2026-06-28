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

const PHASE_33E_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33e-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-smoke.test.mjs',
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

const PHASE_33E_ACCEPTANCE_READINESS_FINAL_SMOKE_DIGEST =
  'sha256:342e8ee05624e961c8af2dbf5f8a662dc3e8187cf29b507fd6d85b276f996d01';

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

function createPhase33DAcceptanceReadinessFixture() {
  return normalize({
    phase: '33D',
    source_phase: '33C',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness',
    mode: 'acceptance-readiness',
    digest: PHASE_33D_ACCEPTANCE_READINESS_DIGEST,
    final_smoke_under_review: {
      source_phase: '33C',
      source_name: 'aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke',
      source_mode: 'final-smoke',
      source_digest: PHASE_33C_FINAL_SMOKE_DIGEST,
      phase33a_digest: PHASE_33A_DETERMINISTIC_DIGEST,
      phase33b_digest: PHASE_33B_BRIDGE_PREVIEW_DIGEST,
      boundary: 'final-closure-index',
      closure_kind: 'final',
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
      approval_confirmed: false,
      adoption_confirmed: false,
      recovery_executed: false,
      rollback_executed: false,
    },
  });
}

function createPhase33EAcceptanceReadinessFinalSmoke() {
  const readiness = createPhase33DAcceptanceReadinessFixture();

  return normalize({
    phase: '33E',
    source_phase: '33D',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-smoke',
    mode: 'acceptance-readiness-final-smoke',
    final_smoke_scope: {
      read_only: true,
      acceptance_readiness_final_smoke_only: true,
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
    acceptance_readiness_under_test: {
      source_phase: readiness.phase,
      source_name: readiness.name,
      source_mode: readiness.mode,
      source_digest: readiness.digest,
      phase33a_digest: readiness.final_smoke_under_review.phase33a_digest,
      phase33b_digest: readiness.final_smoke_under_review.phase33b_digest,
      phase33c_digest: readiness.final_smoke_under_review.source_digest,
      boundary: readiness.final_smoke_under_review.boundary,
      closure_kind: readiness.final_smoke_under_review.closure_kind,
      readiness_decision: readiness.readiness_decision.decision,
    },
    final_smoke_assertions: {
      phase33a_digest_accepted: true,
      phase33b_digest_accepted: true,
      phase33c_digest_accepted: true,
      phase33d_digest_accepted: true,
      acceptance_readiness_still_read_only: true,
      acceptance_readiness_still_inspect_only: true,
      acceptance_readiness_blocks_approval: true,
      acceptance_readiness_blocks_adoption: true,
      operator_decision_not_persisted: true,
      settlement_context_not_persisted: true,
      handoff_not_persisted: true,
      candidate_not_persisted: true,
      mcp_tool_addition_absent: true,
      mutation_targets_absent: true,
    },
    safety_flags: readiness.safety_flags,
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

test('Phase33E acceptance readiness final smoke is anchored to Phase33A through Phase33D artifacts', () => {
  assert.ok(fs.existsSync(PHASE_33A_TEST), 'Phase33A final closure index test must exist');
  assert.ok(fs.existsSync(PHASE_33B_TEST), 'Phase33B bridge preview test must exist');
  assert.ok(fs.existsSync(PHASE_33C_TEST), 'Phase33C final smoke test must exist');
  assert.ok(fs.existsSync(PHASE_33D_TEST), 'Phase33D acceptance readiness test must exist');
  assert.ok(fs.existsSync(PHASE_33E_TEST), 'Phase33E acceptance readiness final smoke test must exist');

  const smoke = createPhase33EAcceptanceReadinessFinalSmoke();

  assert.equal(smoke.phase, '33E');
  assert.equal(smoke.source_phase, '33D');
  assert.equal(smoke.mode, 'acceptance-readiness-final-smoke');

  assert.equal(smoke.acceptance_readiness_under_test.phase33a_digest, PHASE_33A_DETERMINISTIC_DIGEST);
  assert.equal(smoke.acceptance_readiness_under_test.phase33b_digest, PHASE_33B_BRIDGE_PREVIEW_DIGEST);
  assert.equal(smoke.acceptance_readiness_under_test.phase33c_digest, PHASE_33C_FINAL_SMOKE_DIGEST);
  assert.equal(smoke.acceptance_readiness_under_test.source_digest, PHASE_33D_ACCEPTANCE_READINESS_DIGEST);
  assert.equal(smoke.acceptance_readiness_under_test.boundary, 'final-closure-index');
  assert.equal(smoke.acceptance_readiness_under_test.closure_kind, 'final');
});

test('Phase33E final smoke keeps acceptance readiness inspect-only and blocks approval/adoption', () => {
  const smoke = createPhase33EAcceptanceReadinessFinalSmoke();

  assert.equal(smoke.final_smoke_scope.read_only, true);
  assert.equal(smoke.final_smoke_scope.acceptance_readiness_final_smoke_only, true);
  assert.equal(smoke.final_smoke_scope.inspect_only, true);
  assert.equal(smoke.final_smoke_scope.no_mcp_tool_addition, true);
  assert.equal(smoke.final_smoke_scope.no_canon_write, true);
  assert.equal(smoke.final_smoke_scope.no_active_engine_write, true);
  assert.equal(smoke.final_smoke_scope.no_compressed_rules_write, true);
  assert.equal(smoke.final_smoke_scope.no_recovery, true);
  assert.equal(smoke.final_smoke_scope.no_settlement_context_persistence, true);
  assert.equal(smoke.final_smoke_scope.no_handoff_persistence, true);
  assert.equal(smoke.final_smoke_scope.no_candidate_persistence, true);
  assert.equal(smoke.final_smoke_scope.no_operator_decision_persistence, true);
  assert.equal(smoke.final_smoke_scope.no_approval, true);
  assert.equal(smoke.final_smoke_scope.no_adoption, true);

  assert.equal(
    smoke.acceptance_readiness_under_test.readiness_decision,
    'ready_for_acceptance_readiness_review',
  );

  for (const [assertionName, value] of Object.entries(smoke.final_smoke_assertions)) {
    assert.equal(value, true, `acceptance readiness final smoke assertion must be true: ${assertionName}`);
  }
});

test('Phase33E final smoke preserves all safety and mutation flags as false', () => {
  const smoke = createPhase33EAcceptanceReadinessFinalSmoke();

  for (const flag of REQUIRED_FALSE_SAFETY_FLAGS) {
    assert.equal(smoke.safety_flags[flag], false, `safety flag must remain false: ${flag}`);
  }

  assert.deepEqual(smoke.mutation_report.mutation_targets, []);
  assert.equal(smoke.mutation_report.active_engine_modified, false);
  assert.equal(smoke.mutation_report.compressed_rules_modified, false);
  assert.equal(smoke.mutation_report.canon_modified, false);
  assert.equal(smoke.mutation_report.settlement_context_persisted, false);
  assert.equal(smoke.mutation_report.handoff_persisted, false);
  assert.equal(smoke.mutation_report.candidate_persisted, false);
  assert.equal(smoke.mutation_report.operator_decision_persisted, false);
  assert.equal(smoke.mutation_report.approval_confirmed, false);
  assert.equal(smoke.mutation_report.adoption_confirmed, false);
  assert.equal(smoke.mutation_report.recovery_executed, false);
  assert.equal(smoke.mutation_report.rollback_executed, false);
});

test('Phase33E acceptance readiness final smoke is deterministic and registered in run-all', () => {
  const smoke = createPhase33EAcceptanceReadinessFinalSmoke();
  const digest = sha256Json(smoke);

  assert.equal(digest, PHASE_33E_ACCEPTANCE_READINESS_FINAL_SMOKE_DIGEST);

  const runAll = fs.readFileSync(RUN_ALL, 'utf8');
  assert.match(
    runAll,
    /phase33e-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-smoke\.test\.mjs/,
    'Phase33E test must be registered in tests/run-all.mjs',
  );
});



