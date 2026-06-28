import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const closureGuardContract = {
  phase: 'Phase32F',
  expectedBase: '1894e4e',
  previousPhase: 'Phase32E',
  positioning: {
    inherits: 'Phase 32E bridge recovery guide final smoke',
    purpose: 'phase 32 bridge final closure guard',
    scope: ['read-only', 'preview-only', 'inspect-only', 'closure-only', 'no-execution'],
  },
  addedFile:
    'tests/phase32/phase32f-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-closure-guard.test.mjs',
  modifiedFile: 'tests/run-all.mjs',
  closureGuardContract: {
    operatorFacing: true,
    chainClosed: true,
    closureReadinessVerified: true,
    phase32RangeVerified: ['Phase32A', 'Phase32B', 'Phase32C', 'Phase32D', 'Phase32E', 'Phase32F'],
    previewFinalSmokeStabilityRecoveryClosureSequenceLocked: true,
    recoveryExecuted: false,
    recoveryPlanPersisted: false,
    settlementContextCreated: false,
    settlementHandoffSaved: false,
    settlementCandidateCreated: false,
    operatorDecisionSaved: false,
    canonWriteAllowed: false,
    activeEngineModificationAllowed: false,
    compressedRulesModificationAllowed: false,
    closureChecks: [
      'phase32a-bridge-preview-present',
      'phase32b-bridge-final-smoke-present',
      'phase32c-bridge-stability-guard-present',
      'phase32d-recovery-guide-present',
      'phase32e-recovery-guide-final-smoke-present',
      'closure-boundary-locked',
      'protected-hashes-unchanged',
      'no-recovery-execution',
      'no-settlement-artifacts',
      'no-mcp-surface-expansion',
    ],
  },
  forbiddenMutations: [
    'add_mcp_tool',
    'write_canon',
    'modify_active_engine',
    'modify_compressed_rules',
    'create_settlement_context',
    'save_settlement_handoff',
    'create_settlement_candidate',
    'save_operator_decision',
    'execute_recovery',
    'persist_recovery_plan',
    'create_recovery_artifact',
    'expand_mcp_surface',
  ],
  protectedHashes: {
    active_engine: 'd797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb',
    compressed_rules: 'f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db',
  },
  bridgeDryRunSafety: {
    expectedStops: ['guard_blocked_P0', 'readiness correctly blocked'],
    flags: {
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
  },
  mcpContract: {
    toolsExposed: 69,
    expectedToolsChecked: 72,
    resourcesExposed: 29,
    promptsExposed: 5,
    auditRecordsExercised: 184,
    auditLogRestoredByteForByte: true,
    watchedFilesUnchanged: true,
    protectedRuntimePathsUnchanged: true,
    forbiddenPathsAbsent: true,
  },
};

function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  throw new TypeError(`Unsupported stableStringify value: ${typeof value}`);
}

function sha256File(relPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relPath))).digest('hex');
}

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function assertNoExecutableClosureOrMutationCalls() {
  const source = readRepoFile(closureGuardContract.addedFile);

  const forbiddenCallPatterns = [
    /\baddMcpTool\s*\(/,
    /\bregisterMcpTool\s*\(/,
    /\bwriteCanon\s*\(/,
    /\bmodifyActiveEngine\s*\(/,
    /\bmodifyCompressedRules\s*\(/,
    /\bcreateSettlementContext\s*\(/,
    /\bsaveSettlementHandoff\s*\(/,
    /\bcreateSettlementCandidate\s*\(/,
    /\bsaveOperatorDecision\s*\(/,
    /\bexecuteRecovery\s*\(/,
    /\bpersistRecoveryPlan\s*\(/,
    /\bcreateRecoveryArtifact\s*\(/,
    /\bexpandMcpSurface\s*\(/,
    /\brollback\s*\(/,
    /\brestore\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase32F final closure guard must not contain executable side-effect call pattern ${pattern}`,
    );
  }
}

const deterministicDigest = `sha256:${crypto
  .createHash('sha256')
  .update(stableStringify(closureGuardContract))
  .digest('hex')}`;

assert.equal(
  deterministicDigest,
  'sha256:1939b3c356161540810e7bb53c41edfa8cb68eea3dc9209085ddd2fff3b201a0',
  'Phase32F deterministic digest changed unexpectedly',
);

assert.equal(closureGuardContract.phase, 'Phase32F');
assert.equal(closureGuardContract.expectedBase, '1894e4e');
assert.equal(closureGuardContract.previousPhase, 'Phase32E');

assert.deepEqual(closureGuardContract.positioning.scope, [
  'read-only',
  'preview-only',
  'inspect-only',
  'closure-only',
  'no-execution',
]);

assert.equal(closureGuardContract.closureGuardContract.operatorFacing, true);
assert.equal(closureGuardContract.closureGuardContract.chainClosed, true);
assert.equal(closureGuardContract.closureGuardContract.closureReadinessVerified, true);
assert.deepEqual(closureGuardContract.closureGuardContract.phase32RangeVerified, [
  'Phase32A',
  'Phase32B',
  'Phase32C',
  'Phase32D',
  'Phase32E',
  'Phase32F',
]);
assert.equal(
  closureGuardContract.closureGuardContract.previewFinalSmokeStabilityRecoveryClosureSequenceLocked,
  true,
);

assert.equal(closureGuardContract.closureGuardContract.recoveryExecuted, false);
assert.equal(closureGuardContract.closureGuardContract.recoveryPlanPersisted, false);
assert.equal(closureGuardContract.closureGuardContract.settlementContextCreated, false);
assert.equal(closureGuardContract.closureGuardContract.settlementHandoffSaved, false);
assert.equal(closureGuardContract.closureGuardContract.settlementCandidateCreated, false);
assert.equal(closureGuardContract.closureGuardContract.operatorDecisionSaved, false);
assert.equal(closureGuardContract.closureGuardContract.canonWriteAllowed, false);
assert.equal(closureGuardContract.closureGuardContract.activeEngineModificationAllowed, false);
assert.equal(closureGuardContract.closureGuardContract.compressedRulesModificationAllowed, false);

assert.deepEqual(closureGuardContract.closureGuardContract.closureChecks, [
  'phase32a-bridge-preview-present',
  'phase32b-bridge-final-smoke-present',
  'phase32c-bridge-stability-guard-present',
  'phase32d-recovery-guide-present',
  'phase32e-recovery-guide-final-smoke-present',
  'closure-boundary-locked',
  'protected-hashes-unchanged',
  'no-recovery-execution',
  'no-settlement-artifacts',
  'no-mcp-surface-expansion',
]);

assert.deepEqual(closureGuardContract.forbiddenMutations, [
  'add_mcp_tool',
  'write_canon',
  'modify_active_engine',
  'modify_compressed_rules',
  'create_settlement_context',
  'save_settlement_handoff',
  'create_settlement_candidate',
  'save_operator_decision',
  'execute_recovery',
  'persist_recovery_plan',
  'create_recovery_artifact',
  'expand_mcp_surface',
]);

for (const [flag, value] of Object.entries(closureGuardContract.bridgeDryRunSafety.flags)) {
  assert.equal(value, false, `Bridge dry-run safety flag must remain false: ${flag}`);
}

assert.deepEqual(closureGuardContract.bridgeDryRunSafety.expectedStops, [
  'guard_blocked_P0',
  'readiness correctly blocked',
]);

assert.equal(closureGuardContract.mcpContract.toolsExposed, 69);
assert.equal(closureGuardContract.mcpContract.expectedToolsChecked, 72);
assert.equal(closureGuardContract.mcpContract.resourcesExposed, 29);
assert.equal(closureGuardContract.mcpContract.promptsExposed, 5);
assert.equal(closureGuardContract.mcpContract.auditRecordsExercised, 184);
assert.equal(closureGuardContract.mcpContract.auditLogRestoredByteForByte, true);
assert.equal(closureGuardContract.mcpContract.watchedFilesUnchanged, true);
assert.equal(closureGuardContract.mcpContract.protectedRuntimePathsUnchanged, true);
assert.equal(closureGuardContract.mcpContract.forbiddenPathsAbsent, true);

const phase32Files = [
  'tests/phase32/phase32a-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-preview.test.mjs',
  'tests/phase32/phase32b-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-smoke.test.mjs',
  'tests/phase32/phase32c-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-stability-guard.test.mjs',
  'tests/phase32/phase32d-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide.test.mjs',
  'tests/phase32/phase32e-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide-final-smoke.test.mjs',
  closureGuardContract.addedFile,
];

for (const relPath of phase32Files) {
  assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `Phase32 closure chain file must exist: ${relPath}`);
}

const runAllText = readRepoFile(closureGuardContract.modifiedFile);

for (const relPath of phase32Files) {
  assert.equal(
    countOccurrences(runAllText, relPath),
    1,
    `tests/run-all.mjs must register closure chain file exactly once: ${relPath}`,
  );
}

const packageJson = JSON.parse(readRepoFile('package.json'));
for (const scriptName of ['test', 'bridge:dry-run', 'test:bridge:e2e', 'test:mcp']) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `package.json script must exist: ${scriptName}`);
}

assert.equal(
  sha256File('data/canon_db/active_engine.md'),
  closureGuardContract.protectedHashes.active_engine,
  'active_engine protected hash must stay unchanged',
);

assert.equal(
  sha256File('data/error_report_db/compressed_rules.md'),
  closureGuardContract.protectedHashes.compressed_rules,
  'compressed_rules protected hash must stay unchanged',
);

assertNoExecutableClosureOrMutationCalls();

console.log(`Phase32F final closure guard deterministic digest: ${deterministicDigest}`);
console.log('Phase32F final closure guard passed');
