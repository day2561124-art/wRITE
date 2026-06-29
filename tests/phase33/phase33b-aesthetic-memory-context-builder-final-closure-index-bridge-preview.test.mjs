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

const RUN_ALL = path.join(repoRoot, 'tests', 'run-all.mjs');

const PHASE_33A_DETERMINISTIC_DIGEST =
  'sha256:8643ab81616d762b73452c6b3b94732e93539cc2ca15caeff1b7bc6056cfceb7';

const PHASE_33B_BRIDGE_PREVIEW_DIGEST =
  'sha256:925edf8aa3776b69589ae8d22a8121aa5c7f5dbe09b8d02770dd03121ebf75d9';

const FORBIDDEN_WRITE_INTENTS = [
  'save_settlement_context',
  'persist_settlement_context',
  'write_settlement_context',
  'save_handoff',
  'persist_handoff',
  'write_handoff',
  'create_candidate',
  'save_candidate',
  'persist_candidate',
  'pending_engine_candidate_created',
  'operator_decision',
  'approval_confirmed',
  'adoption_confirmed',
  'adopted_chapter_created',
  'active_engine_modified',
  'compressed_rules_modified',
  'restore_executed',
  'rollback_executed',
  'recovery_executed',
];

const FORBIDDEN_PATHS = [
  'data/active_engine',
  'active_engine',
  'data/compressed_rules',
  'compressed_rules',
  'data/canon',
  'canon',
  'data/settlement',
  'data/handoff',
  'data/candidates',
  'data/operator',
  'data/recovery',
  'recovery',
  'rollback',
];

function sha256Json(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalizePreview(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFinalClosureIndexBridgePreview() {
  const finalClosureIndex = {
    phase: '33A',
    source: 'aesthetic-memory-context-builder-final-closure-index',
    deterministic_digest: PHASE_33A_DETERMINISTIC_DIGEST,
    closure_index: {
      closure_kind: 'final',
      context_builder_family: 'aesthetic-memory-context-builder',
      boundary: 'final-closure-index',
      settlement_state: 'closed',
      handoff_state: 'closed',
      adoption_state: 'not_requested',
      operator_decision_state: 'not_requested',
    },
    immutable_contract: {
      read_only: true,
      preview_only: false,
      inspect_only: false,
      bridge_preview_only: false,
      no_mcp_tool_addition: true,
      no_canon_write: true,
      no_active_engine_write: true,
      no_compressed_rules_write: true,
      no_recovery: true,
    },
  };

  const preview = {
    phase: '33B',
    source_phase: '33A',
    name: 'aesthetic-memory-context-builder-final-closure-index-bridge-preview',
    mode: 'bridge-preview',
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
    bridge_input: {
      accepted_source: finalClosureIndex.source,
      accepted_digest: finalClosureIndex.deterministic_digest,
      required_phase: finalClosureIndex.phase,
      required_boundary: finalClosureIndex.closure_index.boundary,
    },
    bridge_preview: {
      preview_kind: 'read-only-final-closure-index-bridge-preview',
      inspected_fields: [
        'phase',
        'source',
        'deterministic_digest',
        'closure_index.closure_kind',
        'closure_index.boundary',
        'immutable_contract.no_active_engine_write',
        'immutable_contract.no_compressed_rules_write',
      ],
      inherited_closure_index: finalClosureIndex.closure_index,
      inherited_digest: finalClosureIndex.deterministic_digest,
      output_is_preview_materialized_for_test_only: true,
      persistence_targets: [],
      write_operations: [],
      recovery_operations: [],
      mcp_tools_added: [],
    },
    safety_flags: {
      external_llm_called: false,
      local_generation_called: false,
      approval_confirmed: false,
      adoption_confirmed: false,
      adopted_chapter_created: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
      restore_executed: false,
      rollback_executed: false,
    },
  };

  return normalizePreview(preview);
}

test('Phase33B bridge preview inherits Phase33A final closure index without mutating it', () => {
  assert.ok(fs.existsSync(PHASE_33A_TEST), 'Phase33A test must exist before Phase33B bridge preview');
  assert.ok(fs.existsSync(PHASE_33B_TEST), 'Phase33B test must exist');

  const preview = createFinalClosureIndexBridgePreview();

  assert.equal(preview.phase, '33B');
  assert.equal(preview.source_phase, '33A');
  assert.equal(preview.mode, 'bridge-preview');
  assert.equal(
    preview.bridge_input.accepted_digest,
    PHASE_33A_DETERMINISTIC_DIGEST,
  );

  assert.deepEqual(preview.bridge_preview.persistence_targets, []);
  assert.deepEqual(preview.bridge_preview.write_operations, []);
  assert.deepEqual(preview.bridge_preview.recovery_operations, []);
  assert.deepEqual(preview.bridge_preview.mcp_tools_added, []);

  assert.equal(preview.bridge_preview.inherited_closure_index.closure_kind, 'final');
  assert.equal(preview.bridge_preview.inherited_closure_index.boundary, 'final-closure-index');
  assert.equal(preview.bridge_preview.inherited_digest, PHASE_33A_DETERMINISTIC_DIGEST);
});

test('Phase33B bridge preview is strictly read-only / preview-only / inspect-only / bridge-preview-only', () => {
  const preview = createFinalClosureIndexBridgePreview();

  assert.equal(preview.contract.read_only, true);
  assert.equal(preview.contract.preview_only, true);
  assert.equal(preview.contract.inspect_only, true);
  assert.equal(preview.contract.bridge_preview_only, true);

  assert.equal(preview.contract.no_mcp_tool_addition, true);
  assert.equal(preview.contract.no_canon_write, true);
  assert.equal(preview.contract.no_active_engine_write, true);
  assert.equal(preview.contract.no_compressed_rules_write, true);
  assert.equal(preview.contract.no_recovery, true);
  assert.equal(preview.contract.no_settlement_context_persistence, true);
  assert.equal(preview.contract.no_handoff_persistence, true);
  assert.equal(preview.contract.no_candidate_persistence, true);
  assert.equal(preview.contract.no_operator_decision_persistence, true);

  for (const [flag, value] of Object.entries(preview.safety_flags)) {
    assert.equal(value, false, `safety flag must remain false: ${flag}`);
  }
});

test('Phase33B bridge preview does not encode forbidden persistence, adoption, recovery, or protected-write intents', () => {
  const preview = createFinalClosureIndexBridgePreview();
  const serialized = JSON.stringify(preview);

  for (const forbidden of FORBIDDEN_WRITE_INTENTS) {
    assert.equal(
      serialized.includes(`"${forbidden}":true`),
      false,
      `preview must not enable forbidden intent: ${forbidden}`,
    );
  }

  for (const forbiddenPath of FORBIDDEN_PATHS) {
    assert.equal(
      serialized.includes(`"target":"${forbiddenPath}"`),
      false,
      `preview must not target forbidden path: ${forbiddenPath}`,
    );
    assert.equal(
      serialized.includes(`"path":"${forbiddenPath}"`),
      false,
      `preview must not write forbidden path: ${forbiddenPath}`,
    );
  }
});

test('Phase33B bridge preview is deterministic and registered in run-all', () => {
  const preview = createFinalClosureIndexBridgePreview();
  const digest = sha256Json(preview);

  assert.equal(digest, PHASE_33B_BRIDGE_PREVIEW_DIGEST);

  const runAll = fs.readFileSync(RUN_ALL, 'utf8');
  assert.match(
    runAll,
    /phase33b-aesthetic-memory-context-builder-final-closure-index-bridge-preview\.test\.mjs/,
    'Phase33B test must be registered in tests/run-all.mjs',
  );
});

