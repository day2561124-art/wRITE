import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const runAllPath = path.join(projectRoot, "tests", "run-all.mjs");
const source = await readFile(runAllPath, "utf8");

const manifestStart = source.indexOf("const steps = [");
const manifestEnd = source.indexOf("\n];", manifestStart);
assert(manifestStart >= 0, "tests/run-all.mjs steps manifest was not found.");
assert(manifestEnd > manifestStart, "tests/run-all.mjs steps manifest did not terminate.");

const manifest = source.slice(manifestStart, manifestEnd + 3);
const stepPattern = /\[\s*"([^"]+)"\s*,\s*\[([\s\S]*?)\]\s*\]\s*,?/gu;
const stringPattern = /"([^"]+)"/gu;
const steps = [...manifest.matchAll(stepPattern)].map((match) => ({
  label: match[1],
  args: [...match[2].matchAll(stringPattern)].map((item) => item[1]),
}));

assert(
  steps.length > 100,
  `Unexpectedly small run-all manifest: ${steps.length} parsed steps.`,
);

const malformed = [];
for (const step of steps) {
  const scripts = step.args.filter((arg) => arg.endsWith(".mjs"));
  if (scripts.length !== 1 || !step.args[0]?.endsWith(".mjs")) {
    malformed.push({
      label: step.label,
      args: step.args,
      script_count: scripts.length,
    });
  }
}

assert.deepEqual(
  malformed,
  [],
  "Each run-all step must execute exactly one .mjs entry script; any remaining args are CLI arguments for that script.",
);

const strictJsonl = steps.find(
  (step) => step.label === "Strict JSONL validation",
);
assert(strictJsonl, "Strict JSONL validation step is missing.");
assert.deepEqual(
  strictJsonl.args,
  ["server/src/tools/validate-jsonl.mjs", "--all", "--strict"],
  "Legitimate CLI arguments must remain attached to their entry script.",
);

const formerlyBundledScripts = [
  "tests/phase22/phase22a-writing-card-director-context.test.mjs",
  "tests/phase22/phase22h-neural-trace-option-exposure.test.mjs",
  "tests/phase22/phase22p-guard-report-display-polish.test.mjs",
  "tests/phase33/phase33b-aesthetic-memory-context-builder-final-closure-index-bridge-preview.test.mjs",
  "tests/phase33/phase33c-aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke.test.mjs",
  "tests/phase33/phase33d-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness.test.mjs",
  "tests/phase33/phase33e-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-smoke.test.mjs",
  "tests/phase33/phase33f-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure.test.mjs",
  "tests/phase33/phase33g-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist.test.mjs",
  "tests/phase33/phase33h-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-smoke.test.mjs",
  "tests/phase33/phase33i-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure.test.mjs",
  "tests/phase33/phase33j-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure-readiness.test.mjs",
];

for (const script of formerlyBundledScripts) {
  const owners = steps.filter((step) => step.args[0] === script);
  assert.equal(
    owners.length,
    1,
    `Previously bundled test must be registered as one executable step: ${script}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  phase: "Maintenance run-all script argv integrity Step 1",
  parsed_step_count: steps.length,
  malformed_step_count: malformed.length,
  formerly_bundled_tests_now_executable: formerlyBundledScripts.length,
  legitimate_cli_arguments_preserved: true,
}));
console.log("Run-all script argv integrity test passed.");
