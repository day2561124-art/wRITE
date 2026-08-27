import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const testsRoot = path.join(projectRoot, "tests");
const runAllPath = path.join(testsRoot, "run-all.mjs");

const formalPhaseFloor = 62;
const phaseDirectoryPattern = /^phase(\d+)$/u;

function normalizeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

async function collectTestFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await collectTestFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      output.push(normalizeProjectPath(absolute));
    }
  }

  return output;
}

function parseRunAllSteps(source) {
  const manifestStart = source.indexOf("const steps = [");
  const manifestEnd = source.indexOf("\n];", manifestStart);
  assert(manifestStart >= 0, "tests/run-all.mjs steps manifest was not found.");
  assert(manifestEnd > manifestStart, "tests/run-all.mjs steps manifest did not terminate.");

  const manifest = source.slice(manifestStart, manifestEnd + 3);
  const stepPattern = /\[\s*"([^"]+)"\s*,\s*\[([\s\S]*?)\]\s*\]\s*,?/gu;
  const stringPattern = /"([^"]+)"/gu;

  return [...manifest.matchAll(stepPattern)].map((match) => ({
    label: match[1],
    args: [...match[2].matchAll(stringPattern)].map((item) => item[1]),
  }));
}

function formalPhaseNumber(scriptPath) {
  const match = /^tests\/phase(\d+)\//u.exec(scriptPath);
  if (!match) return null;
  return Number(match[1]);
}

function auditFormalInventory({ inventory, steps }) {
  const ownersByScript = new Map();

  for (const step of steps) {
    const entryScript = step.args[0];
    if (typeof entryScript !== "string") continue;

    const owners = ownersByScript.get(entryScript) ?? [];
    owners.push(step.label);
    ownersByScript.set(entryScript, owners);
  }

  const missing = [];
  const duplicate = [];

  for (const script of inventory) {
    const owners = ownersByScript.get(script) ?? [];
    if (owners.length === 0) {
      missing.push(script);
    } else if (owners.length > 1) {
      duplicate.push({ script, owners });
    }
  }

  const inventorySet = new Set(inventory);
  const stale = [];

  for (const [script, owners] of ownersByScript) {
    const phaseNumber = formalPhaseNumber(script);
    if (
      phaseNumber === null
      || phaseNumber < formalPhaseFloor
      || !script.endsWith(".test.mjs")
      || inventorySet.has(script)
    ) {
      continue;
    }
    stale.push({ script, owners });
  }

  missing.sort();
  duplicate.sort((left, right) => left.script.localeCompare(right.script, "en"));
  stale.sort((left, right) => left.script.localeCompare(right.script, "en"));

  return { missing, duplicate, stale };
}

const topLevelEntries = await readdir(testsRoot, { withFileTypes: true });
const formalPhaseDirectories = topLevelEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const match = phaseDirectoryPattern.exec(entry.name);
    return match
      ? {
          name: entry.name,
          number: Number(match[1]),
        }
      : null;
  })
  .filter((entry) => entry && entry.number >= formalPhaseFloor)
  .sort((left, right) => left.number - right.number);

assert(
  formalPhaseDirectories.length > 0,
  `No formal phase directories >= Phase${formalPhaseFloor} were discovered.`,
);

const inventory = [];
for (const phaseDirectory of formalPhaseDirectories) {
  inventory.push(
    ...await collectTestFiles(path.join(testsRoot, phaseDirectory.name)),
  );
}
inventory.sort();

assert(
  inventory.length > 0,
  `No *.test.mjs files were discovered under Phase${formalPhaseFloor}+ directories.`,
);

const runAllSource = await readFile(runAllPath, "utf8");
const steps = parseRunAllSteps(runAllSource);
const audit = auditFormalInventory({ inventory, steps });

assert.deepEqual(
  audit.missing,
  [],
  `Formal Phase${formalPhaseFloor}+ tests missing from run-all:\n${audit.missing.join("\n")}`,
);
assert.deepEqual(
  audit.duplicate,
  [],
  `Formal Phase${formalPhaseFloor}+ tests with duplicate run-all owners:\n${JSON.stringify(audit.duplicate, null, 2)}`,
);
assert.deepEqual(
  audit.stale,
  [],
  `Stale formal Phase${formalPhaseFloor}+ run-all registrations:\n${JSON.stringify(audit.stale, null, 2)}`,
);

/*
 * Negative self-checks keep this guard from becoming a ceremonial green test.
 * They prove the detector catches each failure class without modifying files.
 */
const sentinel = inventory[0];
const missingProbe = auditFormalInventory({
  inventory,
  steps: steps.filter((step) => step.args[0] !== sentinel),
});
assert(
  missingProbe.missing.includes(sentinel),
  "Completeness detector failed its synthetic missing-owner probe.",
);

const duplicateProbe = auditFormalInventory({
  inventory,
  steps: [
    ...steps,
    {
      label: "Synthetic duplicate owner probe",
      args: [sentinel],
    },
  ],
});
assert(
  duplicateProbe.duplicate.some((entry) => entry.script === sentinel),
  "Completeness detector failed its synthetic duplicate-owner probe.",
);

const staleSentinel =
  "tests/phase999/phase999z-synthetic-stale-registration.test.mjs";
const staleProbe = auditFormalInventory({
  inventory,
  steps: [
    ...steps,
    {
      label: "Synthetic stale owner probe",
      args: [staleSentinel],
    },
  ],
});
assert(
  staleProbe.stale.some((entry) => entry.script === staleSentinel),
  "Completeness detector failed its synthetic stale-registration probe.",
);

console.log(JSON.stringify({
  ok: true,
  phase: "Maintenance Step 2B formal phase inventory completeness",
  formal_phase_floor: formalPhaseFloor,
  formal_phase_directory_count: formalPhaseDirectories.length,
  formal_test_count: inventory.length,
  missing_owner_count: audit.missing.length,
  duplicate_owner_count: audit.duplicate.length,
  stale_registration_count: audit.stale.length,
  synthetic_missing_probe_verified: true,
  synthetic_duplicate_probe_verified: true,
  synthetic_stale_probe_verified: true,
}));
console.log("Formal phase inventory completeness test passed.");
