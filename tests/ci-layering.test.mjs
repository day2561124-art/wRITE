import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = await readFile(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

function block(start, end) {
  const startIndex = workflow.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing CI block: ${start.trim()}`);
  const endIndex = end ? workflow.indexOf(end, startIndex + start.length) : workflow.length;
  assert.notEqual(endIndex, -1, `Missing CI block boundary: ${end?.trim()}`);
  return workflow.slice(startIndex, endIndex);
}

assert.match(workflow, /\n  pull_request:\r?\n/u);
assert.match(workflow, /\n  push:\r?\n/u);
assert.match(workflow, /\n  schedule:\r?\n/u);
assert.match(workflow, /\n  workflow_dispatch:\r?\n/u);
assert.doesNotMatch(workflow, /\n\s+paths(?:-ignore)?:/u,
  "VA-12 keeps required checks visible instead of skipping whole workflows by path.");
assert.match(workflow, /actions\/checkout@v7/u);
assert.match(workflow, /actions\/setup-node@v7/u);

const pr = block("  pr-affected:\n", "  cross-platform-smoke:\n");
assert.match(pr, /fetch-depth: 0/u);
assert.match(pr, /node tests\/run-ci-affected\.mjs/u);
assert.match(pr, /pull_request\.base\.sha/u);
assert.match(pr, /pull_request\.head\.sha/u);
assert.doesNotMatch(pr, /tests\/run-all\.mjs/u);

const smoke = block("  cross-platform-smoke:\n", "  main-regression:\n");
assert.match(smoke, /ubuntu-latest/u);
assert.match(smoke, /windows-latest/u);
assert.match(smoke, /node: 18/u);
assert.match(smoke, /ci-change-detection\.test\.mjs/u);
assert.match(smoke, /affected-test-selector\.test\.mjs/u);
assert.doesNotMatch(smoke, /tests\/run-all\.mjs/u);

const main = block("  main-regression:\n", "  scheduled-full:\n");
assert.match(main, /github\.ref == 'refs\/heads\/main'/u);
assert.match(main, /node-version: 24/u);
assert.match(main, /node tests\/run-all\.mjs/u);

const scheduled = block("  scheduled-full:\n", "  manual-full:\n");
assert.match(scheduled, /ubuntu-latest/u);
assert.match(scheduled, /windows-latest/u);
assert.match(scheduled, /node: 18/u);
assert.match(scheduled, /node: 24/u);
assert.match(scheduled, /node tests\/run-all\.mjs/u);

const manual = block("  manual-full:\n");
assert.match(manual, /workflow_dispatch/u);
assert.match(manual, /node tests\/run-all\.mjs/u);
assert.match(manual, /inputs\.mode == 'certification'/u);
assert.match(manual, /character-memory-core-certification\.test\.mjs/u);

console.log("VA-12 CI layering contract passed.");
