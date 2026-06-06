import { promises as fs } from 'fs';
import { join } from 'path';

async function readIfExists(path) {
  try {
    return await fs.readFile(path, 'utf8');
  } catch (e) {
    return null;
  }
}

function snippet(text, lines = 50) {
  if (!text) return '';
  return text.split(/\r?\n/).slice(0, lines).join('\n');
}

async function main() {
  const root = process.cwd();
  const activeEnginePath = join(root, 'data', 'canon_db', 'active_engine.md');
  const writingCardPath = join(root, 'data', 'writing_policy_db', 'active_writing_card.md');
  const compressedRulesPath = join(root, 'data', 'error_report_db', 'compressed_rules.md');

  const activeEngine = await readIfExists(activeEnginePath);
  const writingCard = await readIfExists(writingCardPath);
  const compressedRules = await readIfExists(compressedRulesPath);

  const ctxParts = [];
  if (activeEngine) {
    ctxParts.push('--- SOURCE: active_engine.md ---');
    ctxParts.push(snippet(activeEngine, 120));
  } else {
    ctxParts.push('--- SOURCE: active_engine.md MISSING ---');
  }

  if (writingCard) {
    ctxParts.push('\n--- SOURCE: active_writing_card.md ---');
    ctxParts.push(snippet(writingCard, 80));
  }

  if (compressedRules) {
    ctxParts.push('\n--- SOURCE: compressed_rules.md ---');
    ctxParts.push(snippet(compressedRules, 80));
  }

  // quick scan error_report_db for JSONL files
  const errorReportDir = join(root, 'data', 'error_report_db');
  let errorFiles = [];
  try {
    const dir = await fs.readdir(errorReportDir);
    errorFiles = dir.filter(f => f.endsWith('.jsonl')).slice(0, 5);
  } catch (e) {
    errorFiles = [];
  }

  const included = [];
  if (activeEngine) included.push({ path: activeEnginePath, reason: 'canon' });
  if (writingCard) included.push({ path: writingCardPath, reason: 'writing_card' });
  if (compressedRules) included.push({ path: compressedRulesPath, reason: 'error_rules' });
  for (const fn of errorFiles) included.push({ path: join(errorReportDir, fn), reason: 'error_report' });

  const prompt = ['# generation_context', '', ...ctxParts].join('\n');

  // ensure outputs dir
  const outputsDir = join(root, 'outputs');
  await fs.mkdir(outputsDir, { recursive: true });

  const promptPath = join(outputsDir, 'current_prompt.md');
  await fs.writeFile(promptPath, prompt, 'utf8');

  // write retrieval debug
  const debug = {
    retrieval_debug_id: cryptoUUID(),
    run_id: cryptoUUID(),
    timestamp: new Date().toISOString(),
    included_sources: included,
    final_context_status: 'usable'
  };
  await fs.writeFile(join(outputsDir, 'retrieval_debug_report.json'), JSON.stringify(debug, null, 2), 'utf8');

  console.log('wrote', promptPath);
}

function cryptoUUID() {
  if (typeof globalThis.crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('build-generation-context.mjs')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
