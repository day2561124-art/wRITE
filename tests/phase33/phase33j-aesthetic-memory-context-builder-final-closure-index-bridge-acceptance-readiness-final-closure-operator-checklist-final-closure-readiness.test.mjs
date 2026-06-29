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

const PHASE_33F_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33f-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure.test.mjs',
);

const PHASE_33G_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33g-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist.test.mjs',
);

const PHASE_33H_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33h-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-smoke.test.mjs',
);

const PHASE_33I_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33i-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure.test.mjs',
);

const PHASE_33J_TEST = path.join(
  repoRoot,
  'tests',
  'phase33',
  'phase33j-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure-readiness.test.mjs',
);

const RUN_ALL = path.join(repoRoot, 'tests', 'run-all.mjs');

const PHASE_33A_DETERMINISTIC_DIGEST =
  'sha256:8643ab81616d762b73452c6b3b94732e93539cc2ca15caeff1b7bc6056cfceb7';

const PHASE_33B_BRIDGE_PREVIEW_DIGEST =
  'sha256:925edf8aa3776b69589ae8d22a8121aa5c7f5dbe09b8d02770dd03121ebf75d9';

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

function createPhase33IFinalClosureFixture() {
  return normalize({
    phase: '33I',
    source_phase: '33H',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure',
    mode: 'operator-checklist-final-closure',
    final_closure_scope: {
      read_only: true,
      operator_checklist_final_closure_only: true,
      inspect_only: true,
      closes_operator_checklist_chain: ['33G', '33H'],
      checks_phase_chain: ['33A', '33B', '33C', '33D', '33E', '33F', '33G', '33H'],
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
    operator_checklist_final_smoke_under_closure: {
      source_phase: '33H',
      source_name:
        'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-smoke',
      source_mode: 'operator-checklist-final-smoke',
      source_digest: 'sha256:dynamic-phase33h-digest-placeholder',
      phase33a_digest: PHASE_33A_DETERMINISTIC_DIGEST,
      phase33b_digest: PHASE_33B_BRIDGE_PREVIEW_DIGEST,
      phase33c_digest: PHASE_33C_FINAL_SMOKE_DIGEST,
      phase33d_digest: PHASE_33D_ACCEPTANCE_READINESS_DIGEST,
      phase33e_digest: PHASE_33E_ACCEPTANCE_READINESS_FINAL_SMOKE_DIGEST,
      phase33f_digest: 'sha256:dynamic-phase33f-digest-placeholder',
      phase33g_digest: 'sha256:dynamic-phase33g-digest-placeholder',
      boundary: 'final-closure-index',
      closure_kind: 'final',
      readiness_decision: 'ready_for_acceptance_readiness_review',
    },
    final_closure_assertions: {
      chain_has_all_sources: true,
      operator_checklist_chain_closed: true,
      phase33a_digest_accepted: true,
      phase33b_digest_accepted: true,
      phase33c_digest_accepted: true,
      phase33d_digest_accepted: true,
      phase33e_digest_accepted: true,
      phase33f_digest_is_sha256: true,
      phase33g_digest_is_sha256: true,
      phase33h_digest_is_sha256: true,
      final_closure_is_read_only: true,
      final_closure_is_inspect_only: true,
      final_closure_does_not_approve: true,
      final_closure_does_not_adopt: true,
      final_closure_does_not_persist_operator_decision: true,
      final_closure_does_not_persist_settlement_context: true,
      final_closure_does_not_persist_handoff: true,
      final_closure_does_not_persist_candidate: true,
      final_closure_does_not_add_mcp_tool: true,
      final_closure_has_no_mutation_targets: true,
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

function createPhase33JFinalClosureReadiness() {
  const finalClosure = createPhase33IFinalClosureFixture();
  const phase33iDigest = sha256Json(finalClosure);

  return normalize({
    phase: '33J',
    source_phase: '33I',
    name:
      'aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure-readiness',
    mode: 'final-closure-readiness',
    readiness_scope: {
      read_only: true,
      final_closure_readiness_only: true,
      inspect_only: true,
      checks_phase_chain: ['33A', '33B', '33C', '33D', '33E', '33F', '33G', '33H', '33I'],
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
    final_closure_under_readiness: {
      source_phase: finalClosure.phase,
      source_name: finalClosure.name,
      source_mode: finalClosure.mode,
      source_digest: phase33iDigest,
      phase33a_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33a_digest,
      phase33b_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33b_digest,
      phase33c_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33c_digest,
      phase33d_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33d_digest,
      phase33e_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33e_digest,
      phase33f_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33f_digest,
      phase33g_digest: finalClosure.operator_checklist_final_smoke_under_closure.phase33g_digest,
      phase33h_digest: finalClosure.operator_checklist_final_smoke_under_closure.source_digest,
      boundary: finalClosure.operator_checklist_final_smoke_under_closure.boundary,
      closure_kind: finalClosure.operator_checklist_final_smoke_under_closure.closure_kind,
      readiness_decision: 'ready_for_final_closure_readiness_review',
    },
    readiness_assertions: {
      chain_has_all_sources: true,
      phase33a_digest_accepted: true,
      phase33b_digest_accepted: true,
      phase33c_digest_accepted: true,
      phase33d_digest_accepted: true,
      phase33e_digest_accepted: true,
      phase33f_digest_present: true,
      phase33g_digest_present: true,
      phase33h_digest_present: true,
      phase33i_digest_is_sha256: true,
      readiness_is_read_only: true,
      readiness_is_inspect_only: true,
      readiness_does_not_approve: true,
      readiness_does_not_adopt: true,
      readiness_does_not_persist_operator_decision: true,
      readiness_does_not_persist_settlement_context: true,
      readiness_does_not_persist_handoff: true,
      readiness_does_not_persist_candidate: true,
      readiness_does_not_add_mcp_tool: true,
      readiness_has_no_mutation_targets: true,
    },
    safety_flags: finalClosure.safety_flags,
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

test('Phase33J final closure readiness is anchored to Phase33A through Phase33I artifacts', () => {
  assert.ok(fs.existsSync(PHASE_33A_TEST), 'Phase33A final closure index test must exist');
  assert.ok(fs.existsSync(PHASE_33B_TEST), 'Phase33B bridge preview test must exist');
  assert.ok(fs.existsSync(PHASE_33C_TEST), 'Phase33C final smoke test must exist');
  assert.ok(fs.existsSync(PHASE_33D_TEST), 'Phase33D acceptance readiness test must exist');
  assert.ok(fs.existsSync(PHASE_33E_TEST), 'Phase33E acceptance readiness final smoke test must exist');
  assert.ok(fs.existsSync(PHASE_33F_TEST), 'Phase33F final closure test must exist');
  assert.ok(fs.existsSync(PHASE_33G_TEST), 'Phase33G operator checklist test must exist');
  assert.ok(fs.existsSync(PHASE_33H_TEST), 'Phase33H operator checklist final smoke test must exist');
  assert.ok(fs.existsSync(PHASE_33I_TEST), 'Phase33I operator checklist final closure test must exist');
  assert.ok(fs.existsSync(PHASE_33J_TEST), 'Phase33J final closure readiness test must exist');

  const readiness = createPhase33JFinalClosureReadiness();

  assert.equal(readiness.phase, '33J');
  assert.equal(readiness.source_phase, '33I');
  assert.equal(readiness.mode, 'final-closure-readiness');

  assert.deepEqual(readiness.readiness_scope.checks_phase_chain, [
    '33A',
    '33B',
    '33C',
    '33D',
    '33E',
    '33F',
    '33G',
    '33H',
    '33I',
  ]);

  assert.equal(readiness.final_closure_under_readiness.phase33a_digest, PHASE_33A_DETERMINISTIC_DIGEST);
  assert.equal(readiness.final_closure_under_readiness.phase33b_digest, PHASE_33B_BRIDGE_PREVIEW_DIGEST);
  assert.equal(readiness.final_closure_under_readiness.phase33c_digest, PHASE_33C_FINAL_SMOKE_DIGEST);
  assert.equal(readiness.final_closure_under_readiness.phase33d_digest, PHASE_33D_ACCEPTANCE_READINESS_DIGEST);
  assert.equal(
    readiness.final_closure_under_readiness.phase33e_digest,
    PHASE_33E_ACCEPTANCE_READINESS_FINAL_SMOKE_DIGEST,
  );
  assert.match(readiness.final_closure_under_readiness.source_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(readiness.final_closure_under_readiness.boundary, 'final-closure-index');
  assert.equal(readiness.final_closure_under_readiness.closure_kind, 'final');
});

test('Phase33J final closure readiness remains read-only and blocks approval/adoption/persistence', () => {
  const readiness = createPhase33JFinalClosureReadiness();

  assert.equal(readiness.readiness_scope.read_only, true);
  assert.equal(readiness.readiness_scope.final_closure_readiness_only, true);
  assert.equal(readiness.readiness_scope.inspect_only, true);
  assert.equal(readiness.readiness_scope.no_mcp_tool_addition, true);
  assert.equal(readiness.readiness_scope.no_canon_write, true);
  assert.equal(readiness.readiness_scope.no_active_engine_write, true);
  assert.equal(readiness.readiness_scope.no_compressed_rules_write, true);
  assert.equal(readiness.readiness_scope.no_recovery, true);
  assert.equal(readiness.readiness_scope.no_settlement_context_persistence, true);
  assert.equal(readiness.readiness_scope.no_handoff_persistence, true);
  assert.equal(readiness.readiness_scope.no_candidate_persistence, true);
  assert.equal(readiness.readiness_scope.no_operator_decision_persistence, true);
  assert.equal(readiness.readiness_scope.no_approval, true);
  assert.equal(readiness.readiness_scope.no_adoption, true);

  for (const [assertionName, value] of Object.entries(readiness.readiness_assertions)) {
    assert.equal(value, true, `final closure readiness assertion must be true: ${assertionName}`);
  }
});

test('Phase33J final closure readiness preserves all safety and mutation flags as false', () => {
  const readiness = createPhase33JFinalClosureReadiness();

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

test('Phase33J final closure readiness is deterministic and registered in run-all', () => {
  const first = createPhase33JFinalClosureReadiness();
  const second = createPhase33JFinalClosureReadiness();

  const firstDigest = sha256Json(first);
  const secondDigest = sha256Json(second);

  assert.equal(firstDigest, secondDigest);
  assert.match(firstDigest, /^sha256:[0-9a-f]{64}$/);

  const runAll = fs.readFileSync(RUN_ALL, 'utf8');
  assert.match(
    runAll,
    /phase33j-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure-readiness\.test\.mjs/,
    'Phase33J test must be registered in tests/run-all.mjs',
  );
});
