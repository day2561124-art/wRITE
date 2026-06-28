import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const closureIndexContract = {
  phase: 'Phase33A',
  expectedBase: '226d621',
  previousPhase: 'Phase32F',
  positioning: {
    inherits: 'Phase 32F final closure guard',
    purpose: 'aesthetic memory context builder final closure index',
    scope: ['read-only', 'preview-only', 'inspect-only', 'index-only', 'no-execution'],
  },
  addedFile: 'tests/phase33/phase33a-aesthetic-memory-context-builder-final-closure-index.test.mjs',
  modifiedFile: 'tests/run-all.mjs',
  closureIndexContract: {
    operatorFacing: true,
    indexOnly: true,
    phase31To32ChainIndexed: true,
    phase32ClosureConfirmed: true,
    closureIndexPersisted: false,
    canonWriteAllowed: false,
    activeEngineModificationAllowed: false,
    compressedRulesModificationAllowed: false,
    mcpSurfaceExpansionAllowed: false,
    recoveryExecuted: false,
    settlementContextCreated: false,
    settlementHandoffSaved: false,
    settlementCandidateCreated: false,
    operatorDecisionSaved: false,
    indexedSections: [
      'phase31-operator-review-packet-chain',
      'phase31-evidence-packet-chain',
      'phase31-final-acceptance-chain',
      'phase32-settlement-handoff-checklist-bridge-chain',
      'phase32-recovery-guide-chain',
      'phase32-final-closure-guard',
      'protected-hash-locks',
      'bridge-and-mcp-safety-contracts',
    ],
    phase32Sequence: ['Phase32A', 'Phase32B', 'Phase32C', 'Phase32D', 'Phase32E', 'Phase32F'],
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
    'create_closure_index_artifact',
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

function assertNoExecutableIndexOrMutationCalls() {
  const source = readRepoFile(closureIndexContract.addedFile);

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
    /\bcreateClosureIndexArtifact\s*\(/,
    /\bexpandMcpSurface\s*\(/,
    /\brollback\s*\(/,
    /\brestore\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Phase33A final closure index must not contain executable side-effect call pattern ${pattern}`,
    );
  }
}

const deterministicDigest = `sha256:${crypto
  .createHash('sha256')
  .update(stableStringify(closureIndexContract))
  .digest('hex')}`;

assert.equal(
  deterministicDigest,
  'sha256:8643ab81616d762b73452c6b3b94732e93539cc2ca15caeff1b7bc6056cfceb7',
  'Phase33A deterministic digest changed unexpectedly',
);

assert.equal(closureIndexContract.phase, 'Phase33A');
assert.equal(closureIndexContract.expectedBase, '226d621');
assert.equal(closureIndexContract.previousPhase, 'Phase32F');

assert.deepEqual(closureIndexContract.positioning.scope, [
  'read-only',
  'preview-only',
  'inspect-only',
  'index-only',
  'no-execution',
]);

assert.equal(closureIndexContract.closureIndexContract.operatorFacing, true);
assert.equal(closureIndexContract.closureIndexContract.indexOnly, true);
assert.equal(closureIndexContract.closureIndexContract.phase31To32ChainIndexed, true);
assert.equal(closureIndexContract.closureIndexContract.phase32ClosureConfirmed, true);
assert.equal(closureIndexContract.closureIndexContract.closureIndexPersisted, false);
assert.equal(closureIndexContract.closureIndexContract.canonWriteAllowed, false);
assert.equal(closureIndexContract.closureIndexContract.activeEngineModificationAllowed, false);
assert.equal(closureIndexContract.closureIndexContract.compressedRulesModificationAllowed, false);
assert.equal(closureIndexContract.closureIndexContract.mcpSurfaceExpansionAllowed, false);
assert.equal(closureIndexContract.closureIndexContract.recoveryExecuted, false);
assert.equal(closureIndexContract.closureIndexContract.settlementContextCreated, false);
assert.equal(closureIndexContract.closureIndexContract.settlementHandoffSaved, false);
assert.equal(closureIndexContract.closureIndexContract.settlementCandidateCreated, false);
assert.equal(closureIndexContract.closureIndexContract.operatorDecisionSaved, false);

assert.deepEqual(closureIndexContract.closureIndexContract.indexedSections, [
  'phase31-operator-review-packet-chain',
  'phase31-evidence-packet-chain',
  'phase31-final-acceptance-chain',
  'phase32-settlement-handoff-checklist-bridge-chain',
  'phase32-recovery-guide-chain',
  'phase32-final-closure-guard',
  'protected-hash-locks',
  'bridge-and-mcp-safety-contracts',
]);

assert.deepEqual(closureIndexContract.closureIndexContract.phase32Sequence, [
  'Phase32A',
  'Phase32B',
  'Phase32C',
  'Phase32D',
  'Phase32E',
  'Phase32F',
]);

assert.deepEqual(closureIndexContract.forbiddenMutations, [
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
  'create_closure_index_artifact',
  'expand_mcp_surface',
]);

for (const [flag, value] of Object.entries(closureIndexContract.bridgeDryRunSafety.flags)) {
  assert.equal(value, false, `Bridge dry-run safety flag must remain false: ${flag}`);
}

assert.deepEqual(closureIndexContract.bridgeDryRunSafety.expectedStops, [
  'guard_blocked_P0',
  'readiness correctly blocked',
]);

assert.equal(closureIndexContract.mcpContract.toolsExposed, 69);
assert.equal(closureIndexContract.mcpContract.expectedToolsChecked, 72);
assert.equal(closureIndexContract.mcpContract.resourcesExposed, 29);
assert.equal(closureIndexContract.mcpContract.promptsExposed, 5);
assert.equal(closureIndexContract.mcpContract.auditRecordsExercised, 184);
assert.equal(closureIndexContract.mcpContract.auditLogRestoredByteForByte, true);
assert.equal(closureIndexContract.mcpContract.watchedFilesUnchanged, true);
assert.equal(closureIndexContract.mcpContract.protectedRuntimePathsUnchanged, true);
assert.equal(closureIndexContract.mcpContract.forbiddenPathsAbsent, true);

const indexedChainFiles = [
  'tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs',
  'tests/phase31/phase31z-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-operator-checklist.test.mjs',
  'tests/phase32/phase32a-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-preview.test.mjs',
  'tests/phase32/phase32b-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-smoke.test.mjs',
  'tests/phase32/phase32c-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-stability-guard.test.mjs',
  'tests/phase32/phase32d-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide.test.mjs',
  'tests/phase32/phase32e-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide-final-smoke.test.mjs',
  'tests/phase32/phase32f-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-closure-guard.test.mjs',
  closureIndexContract.addedFile,
];

for (const relPath of indexedChainFiles) {
  assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `Closure index chain file must exist: ${relPath}`);
}

const runAllText = readRepoFile(closureIndexContract.modifiedFile);

for (const relPath of indexedChainFiles) {
  assert.equal(
    countOccurrences(runAllText, relPath),
    1,
    `tests/run-all.mjs must register indexed chain file exactly once: ${relPath}`,
  );
}

const packageJson = JSON.parse(readRepoFile('package.json'));
for (const scriptName of ['test', 'bridge:dry-run', 'test:bridge:e2e', 'test:mcp']) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `package.json script must exist: ${scriptName}`);
}

assert.equal(
  sha256File('data/canon_db/active_engine.md'),
  closureIndexContract.protectedHashes.active_engine,
  'active_engine protected hash must stay unchanged',
);

assert.equal(
  sha256File('data/error_report_db/compressed_rules.md'),
  closureIndexContract.protectedHashes.compressed_rules,
  'compressed_rules protected hash must stay unchanged',
);

assertNoExecutableIndexOrMutationCalls();

console.log(`Phase33A final closure index deterministic digest: ${deterministicDigest}`);
console.log('Phase33A final closure index passed');
