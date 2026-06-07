import { promises as fs } from 'fs';
import { extname, join } from 'path';

function usage() {
  return [
    'Usage:',
    '  node server/src/tools/validate-json-codeblocks.mjs',
    '',
    'Validates JSON/JSONL fenced code blocks and every repository JSONL file.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0) return { help: false };
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    return { help: true };
  }
  throw new Error(`Unknown argument: ${argv[0]}`);
}

async function collectFiles(dir, exts = ['.md', '.jsonl']) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      files = files.concat(await collectFiles(p, exts));
    } else if (exts.includes(extname(p).toLowerCase())) {
      files.push(p);
    }
  }
  return files;
}

function parseFences(text) {
  const fenceRe = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const matches = [];
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    matches.push({ lang: (m[1] || '').toLowerCase(), content: m[2] });
  }
  return matches;
}

async function validateMdFile(path) {
  const text = await fs.readFile(path, 'utf8');
  const fences = parseFences(text);
  const problems = [];
  for (const [i, f] of fences.entries()) {
    if (['json', 'jsonl', 'jsonc', 'json5'].includes(f.lang)) {
      if (f.lang === 'jsonl') {
        const lines = f.content.split(/\r?\n/).filter(l => l.trim());
        for (const [li, line] of lines.entries()) {
          try {
            JSON.parse(line);
          } catch (e) {
            problems.push({ path, fenceIndex: i, fenceLang: f.lang, detail: `line ${li+1}: ${e.message}` });
          }
        }
      } else {
        try {
          JSON.parse(f.content);
        } catch (e) {
          problems.push({ path, fenceIndex: i, fenceLang: f.lang, detail: e.message });
        }
      }
    }
  }
  return problems;
}

async function validateJsonlFile(path) {
  const text = await fs.readFile(path, 'utf8');
  const problems = [];
  const lines = text.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      JSON.parse(line);
    } catch (e) {
      problems.push({ path, line: i + 1, detail: e.message });
    }
  }
  return problems;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const root = process.cwd();
  const files = await collectFiles(root, ['.md', '.jsonl']);
  let allProblems = [];
  for (const f of files) {
    if (f.endsWith('.md')) {
      const p = await validateMdFile(f);
      if (p.length) allProblems = allProblems.concat(p);
    } else if (f.endsWith('.jsonl')) {
      const p = await validateJsonlFile(f);
      if (p.length) allProblems = allProblems.concat(p);
    }
  }

  if (allProblems.length === 0) {
    console.log('OK: no JSON/codeblock parsing errors found');
    process.exit(0);
  }

  console.error('Found JSON parsing problems:');
  for (const prob of allProblems) {
    console.error(JSON.stringify(prob));
  }
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('validate-json-codeblocks.mjs')) {
  main().catch(err => {
    console.error(err.message);
    console.error('');
    console.error(usage());
    process.exit(3);
  });
}
