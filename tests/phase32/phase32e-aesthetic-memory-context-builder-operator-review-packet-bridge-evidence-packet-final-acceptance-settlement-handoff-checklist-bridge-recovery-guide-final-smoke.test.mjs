import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const finalSmokeContract = {
  phase: 'Phase32E',
  expectedBase: '08a1499',
  previousPhase: 'Phase32D',
  positioning: {
    inherits: 'Phase 32D bridge recovery guide',
    purpose: 'bridge recovery guide final smoke',
    scope: ['read-only', 'preview-only', 'inspect-only', 'final-smoke-only', 'no-execution'],
  },
  addedFile:
    'tests/phase32/phase32e-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide-final-smoke.test.mjs',
  modifiedFile: 'tests/run-all.mjs',
  finalSmokeContract: {
    operatorFacing: true,
    guideLoadVerified: true,
    guideSectionsVerified: true,
    dryRunSafetyVerified: true,
    mcpContractVerified: true,
    protectedHashesLocked: true,
    recoveryExecuted: false,
    recoveryPlanPersisted: false,
    settlementContextCreated: false,
    settlementHandoffSaved: false,
    settlementCandidateCreated: false,
    operatorDecisionSaved: false,
    canonWriteAllowed: false,
    activeEngineModificationAllowed: false,
    compressedRulesModificationAllowed: false,
    finalSmokeChecks: [
      'recovery-guide-contract-present',
      'guide-only-boundary-locked',
      'bridge-dry-run-blocked',
      'mcp-contract-stable',
      'protected-hashes-unchanged',
      'no-recovery-execution',
      'no-settlement-artifacts',
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

function assertNoExecutableRecoveryOrMutationCalls() {
  const source = readRepoFile(finalSmokeContract.addedFile);

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
    /\brollback\s*\(/,
    /\brestore\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase32E final smoke must not contain executable side-effect call pattern ${pattern}`,
    );
  }
}

const deterministicDigest = `sha256:${crypto
  .createHash('sha256')
  .update(stableStringify(finalSmokeContract))
  .digest('hex')}`;

assert.equal(
  deterministicDigest,
  'sha256:54696b57dd4c1c099c420c7dc4cbd19bb971a9d1e73b5c082a600ca6cabeae30',
  'Phase32E deterministic digest changed unexpectedly',
);

assert.equal(finalSmokeContract.phase, 'Phase32E');
assert.equal(finalSmokeContract.expectedBase, '08a1499');
assert.equal(finalSmokeContract.previousPhase, 'Phase32D');

assert.deepEqual(finalSmokeContract.positioning.scope, [
  'read-only',
  'preview-only',
  'inspect-only',
  'final-smoke-only',
  'no-execution',
]);

assert.equal(finalSmokeContract.finalSmokeContract.operatorFacing, true);
assert.equal(finalSmokeContract.finalSmokeContract.guideLoadVerified, true);
assert.equal(finalSmokeContract.finalSmokeContract.guideSectionsVerified, true);
assert.equal(finalSmokeContract.finalSmokeContract.dryRunSafetyVerified, true);
assert.equal(finalSmokeContract.finalSmokeContract.mcpContractVerified, true);
assert.equal(finalSmokeContract.finalSmokeContract.protectedHashesLocked, true);
assert.equal(finalSmokeContract.finalSmokeContract.recoveryExecuted, false);
assert.equal(finalSmokeContract.finalSmokeContract.recoveryPlanPersisted, false);
assert.equal(finalSmokeContract.finalSmokeContract.settlementContextCreated, false);
assert.equal(finalSmokeContract.finalSmokeContract.settlementHandoffSaved, false);
assert.equal(finalSmokeContract.finalSmokeContract.settlementCandidateCreated, false);
assert.equal(finalSmokeContract.finalSmokeContract.operatorDecisionSaved, false);
assert.equal(finalSmokeContract.finalSmokeContract.canonWriteAllowed, false);
assert.equal(finalSmokeContract.finalSmokeContract.activeEngineModificationAllowed, false);
assert.equal(finalSmokeContract.finalSmokeContract.compressedRulesModificationAllowed, false);

assert.deepEqual(finalSmokeContract.finalSmokeContract.finalSmokeChecks, [
  'recovery-guide-contract-present',
  'guide-only-boundary-locked',
  'bridge-dry-run-blocked',
  'mcp-contract-stable',
  'protected-hashes-unchanged',
  'no-recovery-execution',
  'no-settlement-artifacts',
]);

assert.deepEqual(finalSmokeContract.forbiddenMutations, [
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
]);

for (const [flag, value] of Object.entries(finalSmokeContract.bridgeDryRunSafety.flags)) {
  assert.equal(value, false, `Bridge dry-run safety flag must remain false: ${flag}`);
}

assert.deepEqual(finalSmokeContract.bridgeDryRunSafety.expectedStops, [
  'guard_blocked_P0',
  'readiness correctly blocked',
]);

assert.equal(finalSmokeContract.mcpContract.toolsExposed, 69);
assert.equal(finalSmokeContract.mcpContract.expectedToolsChecked, 72);
assert.equal(finalSmokeContract.mcpContract.resourcesExposed, 29);
assert.equal(finalSmokeContract.mcpContract.promptsExposed, 5);
assert.equal(finalSmokeContract.mcpContract.auditRecordsExercised, 184);
assert.equal(finalSmokeContract.mcpContract.auditLogRestoredByteForByte, true);
assert.equal(finalSmokeContract.mcpContract.watchedFilesUnchanged, true);
assert.equal(finalSmokeContract.mcpContract.protectedRuntimePathsUnchanged, true);
assert.equal(finalSmokeContract.mcpContract.forbiddenPathsAbsent, true);

const previousPhaseFile =
  'tests/phase32/phase32d-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide.test.mjs';

assert.equal(fs.existsSync(path.join(repoRoot, previousPhaseFile)), true, 'Phase32D recovery guide test must exist');
assert.equal(
  fs.existsSync(path.join(repoRoot, finalSmokeContract.addedFile)),
  true,
  'Phase32E recovery guide final smoke test must exist',
);

const runAllText = readRepoFile(finalSmokeContract.modifiedFile);

assert.equal(
  countOccurrences(runAllText, finalSmokeContract.addedFile),
  1,
  'tests/run-all.mjs must register Phase32E exactly once',
);

assert.equal(
  countOccurrences(runAllText, previousPhaseFile),
  1,
  'tests/run-all.mjs must keep Phase32D exactly once',
);

const packageJson = JSON.parse(readRepoFile('package.json'));
for (const scriptName of ['test', 'bridge:dry-run', 'test:bridge:e2e', 'test:mcp']) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `package.json script must exist: ${scriptName}`);
}

assert.equal(
  sha256File('data/canon_db/active_engine.md'),
  finalSmokeContract.protectedHashes.active_engine,
  'active_engine protected hash must stay unchanged',
);

assert.equal(
  sha256File('data/error_report_db/compressed_rules.md'),
  finalSmokeContract.protectedHashes.compressed_rules,
  'compressed_rules protected hash must stay unchanged',
);

assertNoExecutableRecoveryOrMutationCalls();

console.log(`Phase32E recovery guide final smoke deterministic digest: ${deterministicDigest}`);
console.log('Phase32E recovery guide final smoke passed');
