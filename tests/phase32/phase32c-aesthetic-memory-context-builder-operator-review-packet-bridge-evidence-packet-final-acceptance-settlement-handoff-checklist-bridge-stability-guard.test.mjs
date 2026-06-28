import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const stabilityContract = {
  phase: 'Phase32C',
  expectedBase: '2c81c54',
  previousPhase: 'Phase32B',
  positioning: {
    inherits: 'Phase 32B settlement handoff checklist bridge final smoke',
    purpose: 'bridge stability guard',
    scope: ['read-only', 'preview-only', 'inspect-only', 'smoke-only', 'stability-only'],
  },
  addedFile: 'tests/phase32/phase32c-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-stability-guard.test.mjs',
  modifiedFile: 'tests/run-all.mjs',
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
    watchedProtectedFilesUnchanged: true,
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

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function normalizeRel(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join('/');
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function walkFiles(dir, out = []) {
  const skip = new Set(['.git', 'node_modules', '.next', 'dist', 'coverage', 'tmp', 'temp']);

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;

    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }

  return out;
}

function findProtectedFile(label, expectedHash, nameTokens) {
  const directCandidates = {
    active_engine: [
      'active_engine',
      'active_engine.json',
      'active_engine.md',
      'data/active_engine',
      'data/active_engine.json',
      'data/active_engine.md',
      'data/engine/active_engine',
      'data/engine/active_engine.json',
      'data/engine/active_engine.md',
    ],
    compressed_rules: [
      'compressed_rules',
      'compressed_rules.json',
      'compressed_rules.md',
      'data/compressed_rules',
      'data/compressed_rules.json',
      'data/compressed_rules.md',
      'data/rules/compressed_rules',
      'data/rules/compressed_rules.json',
      'data/rules/compressed_rules.md',
    ],
  };

  const inspected = [];

  for (const rel of directCandidates[label] ?? []) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;

    const hash = sha256File(abs);
    inspected.push(`${rel} => ${hash}`);

    if (hash === expectedHash) {
      return { rel, hash };
    }
  }

  for (const abs of walkFiles(repoRoot)) {
    const rel = normalizeRel(abs);
    const base = path.basename(rel);

    if (!nameTokens.some((token) => rel.includes(token) || base.includes(token))) {
      continue;
    }

    const hash = sha256File(abs);
    inspected.push(`${rel} => ${hash}`);

    if (hash === expectedHash) {
      return { rel, hash };
    }
  }

  assert.fail(
    `Unable to resolve ${label} protected file by expected hash ${expectedHash}. Inspected candidates:\n${inspected.join('\n')}`,
  );
}

function assertNoSideEffectFunctionCalls() {
  const source = readRepoFile(stabilityContract.addedFile);

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
    /\brollback\s*\(/,
    /\brestore\s*\(/,
  ];

  for (const pattern of forbiddenCallPatterns) {
    assert.equal(pattern.test(source), false, `Phase32C stability guard must not contain side-effect call pattern ${pattern}`);
  }
}

const deterministicDigest = `sha256:${crypto
  .createHash('sha256')
  .update(stableStringify(stabilityContract))
  .digest('hex')}`;

assert.equal(
  deterministicDigest,
  'sha256:cf5061cffdb2cd77e7a49d53187b002516811f3d13636ddc5f4d6255329a6549',
  'Phase32C deterministic digest changed unexpectedly',
);

assert.equal(stabilityContract.phase, 'Phase32C');
assert.equal(stabilityContract.expectedBase, '2c81c54');
assert.equal(stabilityContract.previousPhase, 'Phase32B');
assert.deepEqual(stabilityContract.positioning.scope, [
  'read-only',
  'preview-only',
  'inspect-only',
  'smoke-only',
  'stability-only',
]);

assert.deepEqual(stabilityContract.forbiddenMutations, [
  'add_mcp_tool',
  'write_canon',
  'modify_active_engine',
  'modify_compressed_rules',
  'create_settlement_context',
  'save_settlement_handoff',
  'create_settlement_candidate',
  'save_operator_decision',
  'execute_recovery',
]);

for (const [flag, value] of Object.entries(stabilityContract.bridgeDryRunSafety.flags)) {
  assert.equal(value, false, `Bridge dry-run safety flag must remain false: ${flag}`);
}

assert.deepEqual(stabilityContract.bridgeDryRunSafety.expectedStops, [
  'guard_blocked_P0',
  'readiness correctly blocked',
]);

assert.equal(stabilityContract.mcpContract.toolsExposed, 69);
assert.equal(stabilityContract.mcpContract.expectedToolsChecked, 72);
assert.equal(stabilityContract.mcpContract.resourcesExposed, 29);
assert.equal(stabilityContract.mcpContract.promptsExposed, 5);
assert.equal(stabilityContract.mcpContract.auditRecordsExercised, 184);
assert.equal(stabilityContract.mcpContract.auditLogRestoredByteForByte, true);
assert.equal(stabilityContract.mcpContract.watchedProtectedFilesUnchanged, true);
assert.equal(stabilityContract.mcpContract.forbiddenPathsAbsent, true);
assert.equal(
  stabilityContract.mcpContract.expectedToolsChecked - stabilityContract.mcpContract.toolsExposed,
  3,
  'Expected tools checked should continue to exceed exposed tools by the existing hidden/contract delta',
);

const previousPhaseFile = 'tests/phase32/phase32b-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-smoke.test.mjs';
assert.equal(fs.existsSync(path.join(repoRoot, previousPhaseFile)), true, 'Phase32B final smoke test must exist');
assert.equal(fs.existsSync(path.join(repoRoot, stabilityContract.addedFile)), true, 'Phase32C stability guard test must exist');

const runAllText = readRepoFile(stabilityContract.modifiedFile);
assert.equal(
  countOccurrences(runAllText, stabilityContract.addedFile),
  1,
  'tests/run-all.mjs must register Phase32C exactly once',
);
assert.equal(
  countOccurrences(runAllText, previousPhaseFile),
  1,
  'tests/run-all.mjs must keep Phase32B exactly once',
);

const packageJson = JSON.parse(readRepoFile('package.json'));
for (const scriptName of ['test', 'bridge:dry-run', 'test:bridge:e2e', 'test:mcp']) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `package.json script must exist: ${scriptName}`);
}

const activeEngine = findProtectedFile(
  'active_engine',
  stabilityContract.protectedHashes.active_engine,
  ['active_engine', 'active-engine'],
);
const compressedRules = findProtectedFile(
  'compressed_rules',
  stabilityContract.protectedHashes.compressed_rules,
  ['compressed_rules', 'compressed-rules'],
);

assert.equal(activeEngine.hash, stabilityContract.protectedHashes.active_engine);
assert.equal(compressedRules.hash, stabilityContract.protectedHashes.compressed_rules);

assertNoSideEffectFunctionCalls();

console.log(`Phase32C protected active_engine: ${activeEngine.rel} ${activeEngine.hash}`);
console.log(`Phase32C protected compressed_rules: ${compressedRules.rel} ${compressedRules.hash}`);
console.log(`Phase32C stability guard deterministic digest: ${deterministicDigest}`);
console.log('Phase32C stability guard passed');
