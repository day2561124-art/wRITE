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

const RUN_ALL = path.join(repoRoot, 'tests', 'run-all.mjs');

const PHASE_33A_DETERMINISTIC_DIGEST =
  'sha256:8643ab81616d762b73452c6b3b94732e93539cc2ca15caeff1b7bc6056cfceb7';

const PHASE_33B_BRIDGE_PREVIEW_DIGEST =
  'sha256:3eaaf69f6c18ed3ddb14a9f8729d028f1bb8078dfc079a921ad7a65d25e42867';

const PHASE_33C_FINAL_SMOKE_DIGEST =
  'sha256:0051d3c1c7c114052bc57f3c9088a415f42f0d08cdcc8fda6d15ec17b10ed411';

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

function createPhase33BBridgePreviewFixture() {
  return normalize({
    phase: '33B',
    source_phase: '33A',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-preview',
    mode: 'bridge-preview',
    digest: PHASE_33B_BRIDGE_PREVIEW_DIGEST,
    inherited_final_closure_index: {
      phase: '33A',
      source: 'aesthetic-memory-context-builder-final-closure-index',
      deterministic_digest: PHASE_33A_DETERMINISTIC_DIGEST,
      boundary: 'final-closure-index',
      closure_kind: 'final',
    },
    contract: {
      read_only: true,
      preview_only: true,
      inspect_only: true,
      bridge_preview_only: true,
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
    preview_effects: {
      persistence_targets: [],
      write_operations: [],
      recovery_operations: [],
      mcp_tools_added: [],
    },
    safety_flags: Object.fromEntries(REQUIRED_FALSE_SAFETY_FLAGS.map((flag) => [flag, false])),
  });
}

function createPhase33CFinalSmoke() {
  const preview = createPhase33BBridgePreviewFixture();

  return normalize({
    phase: '33C',
    source_phase: '33B',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke',
    mode: 'final-smoke',
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
    bridge_preview_under_test: {
      source_phase: preview.phase,
      source_name: preview.name,
      source_mode: preview.mode,
      source_digest: preview.digest,
      inherited_final_closure_index_digest:
        preview.inherited_final_closure_index.deterministic_digest,
      inherited_boundary: preview.inherited_final_closure_index.boundary,
      inherited_closure_kind: preview.inherited_final_closure_index.closure_kind,
    },
    final_smoke_assertions: {
      phase33a_digest_accepted: preview.inherited_final_closure_index.deterministic_digest ===
        PHASE_33A_DETERMINISTIC_DIGEST,
      phase33b_digest_accepted: preview.digest === PHASE_33B_BRIDGE_PREVIEW_DIGEST,
      final_closure_index_still_final: preview.inherited_final_closure_index.closure_kind === 'final',
      bridge_preview_still_read_only: preview.contract.read_only === true,
      bridge_preview_still_preview_only: preview.contract.preview_only === true,
      bridge_preview_still_inspect_only: preview.contract.inspect_only === true,
      no_write_operations: preview.preview_effects.write_operations.length === 0,
      no_persistence_targets: preview.preview_effects.persistence_targets.length === 0,
      no_recovery_operations: preview.preview_effects.recovery_operations.length === 0,
      no_mcp_tools_added: preview.preview_effects.mcp_tools_added.length === 0,
    },
    safety_flags: preview.safety_flags,
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

test('Phase33C final smoke is anchored to Phase33A and Phase33B artifacts', () => {
  assert.ok(fs.existsSync(PHASE_33A_TEST), 'Phase33A final closure index test must exist');
  assert.ok(fs.existsSync(PHASE_33B_TEST), 'Phase33B bridge preview test must exist');
  assert.ok(fs.existsSync(PHASE_33C_TEST), 'Phase33C final smoke test must exist');

  const smoke = createPhase33CFinalSmoke();

  assert.equal(smoke.phase, '33C');
  assert.equal(smoke.source_phase, '33B');
  assert.equal(smoke.mode, 'final-smoke');

  assert.equal(
    smoke.bridge_preview_under_test.inherited_final_closure_index_digest,
    PHASE_33A_DETERMINISTIC_DIGEST,
  );

  assert.equal(
    smoke.bridge_preview_under_test.source_digest,
    PHASE_33B_BRIDGE_PREVIEW_DIGEST,
  );

  assert.equal(smoke.bridge_preview_under_test.inherited_boundary, 'final-closure-index');
  assert.equal(smoke.bridge_preview_under_test.inherited_closure_kind, 'final');
});

test('Phase33C final smoke keeps the bridge preview read-only and write-empty', () => {
  const smoke = createPhase33CFinalSmoke();

  assert.equal(smoke.final_smoke_scope.read_only, true);
  assert.equal(smoke.final_smoke_scope.final_smoke_only, true);
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

  for (const [assertionName, value] of Object.entries(smoke.final_smoke_assertions)) {
    assert.equal(value, true, `final smoke assertion must be true: ${assertionName}`);
  }

  assert.deepEqual(smoke.mutation_report.mutation_targets, []);
});

test('Phase33C final smoke preserves all safety flags as false', () => {
  const smoke = createPhase33CFinalSmoke();

  for (const flag of REQUIRED_FALSE_SAFETY_FLAGS) {
    assert.equal(smoke.safety_flags[flag], false, `safety flag must remain false: ${flag}`);
  }

  assert.equal(smoke.mutation_report.active_engine_modified, false);
  assert.equal(smoke.mutation_report.compressed_rules_modified, false);
  assert.equal(smoke.mutation_report.canon_modified, false);
  assert.equal(smoke.mutation_report.settlement_context_persisted, false);
  assert.equal(smoke.mutation_report.handoff_persisted, false);
  assert.equal(smoke.mutation_report.candidate_persisted, false);
  assert.equal(smoke.mutation_report.operator_decision_persisted, false);
  assert.equal(smoke.mutation_report.recovery_executed, false);
  assert.equal(smoke.mutation_report.rollback_executed, false);
});

test('Phase33C final smoke is deterministic and registered in run-all', () => {
  const smoke = createPhase33CFinalSmoke();
  const digest = sha256Json(smoke);

  assert.equal(digest, PHASE_33C_FINAL_SMOKE_DIGEST);

  const runAll = fs.readFileSync(RUN_ALL, 'utf8');
  assert.match(
    runAll,
    /phase33c-aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke\.test\.mjs/,
    'Phase33C test must be registered in tests/run-all.mjs',
  );
});

