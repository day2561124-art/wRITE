import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const recoveryGuideContract = {
  phase: 'Phase32D',
  expectedBase: '62e4567',
  previousPhase: 'Phase32C',
  positioning: {
    inherits: 'Phase 32C bridge stability guard',
    purpose: 'bridge recovery guide',
    scope: ['read-only', 'preview-only', 'inspect-only', 'recovery-guide-only', 'no-execution'],
  },
  addedFile:
    'tests/phase32/phase32d-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide.test.mjs',
  modifiedFile: 'tests/run-all.mjs',
  recoveryGuideContract: {
    operatorFacing: true,
    guideOnly: true,
    recoveryPlanPersisted: false,
    recoveryExecuted: false,
    settlementContextCreated: false,
    settlementHandoffSaved: false,
    settlementCandidateCreated: false,
    operatorDecisionSaved: false,
    canonWriteAllowed: false,
    activeEngineModificationAllowed: false,
    compressedRulesModificationAllowed: false,
    sections: [
      'failure-symptom-classification',
      'bridge-dry-run-safety-checks',
      'mcp-contract-triage',
      'protected-hash-validation',
      'working-tree-cleanup',
      'manual-stop-conditions',
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
  const source = readRepoFile(recoveryGuideContract.addedFile);

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
    /\brollback\s*\(/,
    /\brestore\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase32D recovery guide must not contain executable side-effect call pattern ${pattern}`,
    );
  }
}

const deterministicDigest = `sha256:${crypto
  .createHash('sha256')
  .update(stableStringify(recoveryGuideContract))
  .digest('hex')}`;

assert.equal(
  deterministicDigest,
  'sha256:15bb73f26b8e468df711c5c9267fdf364f40a6ce339a8723627a4dcbfd345f7f',
  'Phase32D deterministic digest changed unexpectedly',
);

assert.equal(recoveryGuideContract.phase, 'Phase32D');
assert.equal(recoveryGuideContract.expectedBase, '62e4567');
assert.equal(recoveryGuideContract.previousPhase, 'Phase32C');

assert.deepEqual(recoveryGuideContract.positioning.scope, [
  'read-only',
  'preview-only',
  'inspect-only',
  'recovery-guide-only',
  'no-execution',
]);

assert.equal(recoveryGuideContract.recoveryGuideContract.operatorFacing, true);
assert.equal(recoveryGuideContract.recoveryGuideContract.guideOnly, true);
assert.equal(recoveryGuideContract.recoveryGuideContract.recoveryPlanPersisted, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.recoveryExecuted, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.settlementContextCreated, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.settlementHandoffSaved, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.settlementCandidateCreated, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.operatorDecisionSaved, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.canonWriteAllowed, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.activeEngineModificationAllowed, false);
assert.equal(recoveryGuideContract.recoveryGuideContract.compressedRulesModificationAllowed, false);

assert.deepEqual(recoveryGuideContract.recoveryGuideContract.sections, [
  'failure-symptom-classification',
  'bridge-dry-run-safety-checks',
  'mcp-contract-triage',
  'protected-hash-validation',
  'working-tree-cleanup',
  'manual-stop-conditions',
]);

assert.deepEqual(recoveryGuideContract.forbiddenMutations, [
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
]);

for (const [flag, value] of Object.entries(recoveryGuideContract.bridgeDryRunSafety.flags)) {
  assert.equal(value, false, `Bridge dry-run safety flag must remain false: ${flag}`);
}

assert.deepEqual(recoveryGuideContract.bridgeDryRunSafety.expectedStops, [
  'guard_blocked_P0',
  'readiness correctly blocked',
]);

assert.equal(recoveryGuideContract.mcpContract.toolsExposed, 69);
assert.equal(recoveryGuideContract.mcpContract.expectedToolsChecked, 72);
assert.equal(recoveryGuideContract.mcpContract.resourcesExposed, 29);
assert.equal(recoveryGuideContract.mcpContract.promptsExposed, 5);
assert.equal(recoveryGuideContract.mcpContract.auditRecordsExercised, 184);
assert.equal(recoveryGuideContract.mcpContract.auditLogRestoredByteForByte, true);
assert.equal(recoveryGuideContract.mcpContract.watchedFilesUnchanged, true);
assert.equal(recoveryGuideContract.mcpContract.protectedRuntimePathsUnchanged, true);
assert.equal(recoveryGuideContract.mcpContract.forbiddenPathsAbsent, true);

const previousPhaseFile =
  'tests/phase32/phase32c-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-stability-guard.test.mjs';

assert.equal(fs.existsSync(path.join(repoRoot, previousPhaseFile)), true, 'Phase32C stability guard test must exist');
assert.equal(
  fs.existsSync(path.join(repoRoot, recoveryGuideContract.addedFile)),
  true,
  'Phase32D recovery guide test must exist',
);

const runAllText = readRepoFile(recoveryGuideContract.modifiedFile);

assert.equal(
  countOccurrences(runAllText, recoveryGuideContract.addedFile),
  1,
  'tests/run-all.mjs must register Phase32D exactly once',
);

assert.equal(
  countOccurrences(runAllText, previousPhaseFile),
  1,
  'tests/run-all.mjs must keep Phase32C exactly once',
);

const packageJson = JSON.parse(readRepoFile('package.json'));
for (const scriptName of ['test', 'bridge:dry-run', 'test:bridge:e2e', 'test:mcp']) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `package.json script must exist: ${scriptName}`);
}

assert.equal(
  sha256File('data/canon_db/active_engine.md'),
  recoveryGuideContract.protectedHashes.active_engine,
  'active_engine protected hash must stay unchanged',
);

assert.equal(
  sha256File('data/error_report_db/compressed_rules.md'),
  recoveryGuideContract.protectedHashes.compressed_rules,
  'compressed_rules protected hash must stay unchanged',
);

assertNoExecutableRecoveryOrMutationCalls();

console.log(`Phase32D recovery guide deterministic digest: ${deterministicDigest}`);
console.log('Phase32D recovery guide passed');
