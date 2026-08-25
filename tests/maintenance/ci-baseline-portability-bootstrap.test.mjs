import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const packageJson = JSON.parse(await readFile(
  path.join(rootDir, "package.json"),
  "utf8",
));
assert.equal(
  packageJson.engines?.node,
  ">=18",
  "CI portability guard expects the repository Node floor to remain >=18.",
);

const workflow = await readFile(
  path.join(rootDir, ".github", "workflows", "ci.yml"),
  "utf8",
);
const npmCiIndex = workflow.indexOf("- run: npm ci");
const runAllIndex = workflow.indexOf("- run: node tests/run-all.mjs");
assert(npmCiIndex >= 0, "CI must install locked dependencies with npm ci.");
assert(runAllIndex >= 0, "CI must execute tests/run-all.mjs.");
assert(
  npmCiIndex < runAllIndex,
  "CI must run npm ci before tests/run-all.mjs.",
);
assert(
  /node:\s*18\b/u.test(workflow),
  "CI must retain a Node 18 job while package.json declares node >=18.",
);

const attributes = await readFile(
  path.join(rootDir, ".gitattributes"),
  "utf8",
);
assert(
  /^data\/canon_db\/sources\/\*\.md\s+text\s+eol=lf\s*$/mu.test(attributes),
  "Formal Canon source Markdown must be checked out as LF on every platform.",
);

const scanRoots = [
  path.join(rootDir, "server"),
  path.join(rootDir, "tests"),
  path.join(rootDir, "scripts"),
];
const forbiddenMethodNames = [
  "toReversed",
  "toSorted",
  "toSpliced",
];

async function sourceFilesUnder(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFilesUnder(target));
    } else if (
      entry.isFile()
      && /\.(?:mjs|cjs|js)$/u.test(entry.name)
    ) {
      files.push(target);
    }
  }
  return files;
}

const incompatible = [];
for (const root of scanRoots) {
  for (const filePath of await sourceFilesUnder(root)) {
    const source = await readFile(filePath, "utf8");
    for (const methodName of forbiddenMethodNames) {
      const token = `.${methodName}(`;
      if (source.includes(token)) {
        incompatible.push(
          `${path.relative(rootDir, filePath).split(path.sep).join("/")}:${methodName}`,
        );
      }
    }
  }
}

assert.deepEqual(
  incompatible,
  [],
  `Node 18-incompatible copying Array methods found:\n${incompatible.join("\n")}`,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Maintenance Step 2A CI baseline portability/bootstrap",
  node_floor: packageJson.engines.node,
  npm_ci_before_run_all: true,
  formal_canon_sources_lf: true,
  incompatible_copying_array_method_count: incompatible.length,
}));
console.log("Maintenance CI baseline portability/bootstrap guard passed.");
