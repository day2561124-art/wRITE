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
const normalizedWorkflow = workflow.replaceAll("\r\n", "\n");
assert(
  /- uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth:\s*0\b/u.test(normalizedWorkflow),
  "CI must fetch full Git history because maintenance baseline reconciliation reads historical commits.",
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
const node18IncompatibleCryptoHashApis = [];

function relativeSourcePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function cryptoHashImportBindings(source) {
  const bindings = [];
  const namedImportPattern =
    /import\s*\{([^}]*)\}\s*from\s*["'](?:node:)?crypto["']/gu;
  for (const match of source.matchAll(namedImportPattern)) {
    for (const rawSpecifier of match[1].split(",")) {
      const specifier = rawSpecifier.trim();
      const bindingMatch = /^hash(?:\s+as\s+([A-Za-z_$][\w$]*))?$/u.exec(specifier);
      if (bindingMatch) {
        bindings.push({
          kind: "named_import",
          binding: bindingMatch[1] || "hash",
        });
      }
    }
  }

  const objectImportPattern =
    /import\s+(?:\*\s+as\s+|)([A-Za-z_$][\w$]*)\s+from\s*["'](?:node:)?crypto["']/gu;
  for (const match of source.matchAll(objectImportPattern)) {
    bindings.push({
      kind: "crypto_object",
      binding: match[1],
    });
  }

  return bindings;
}

for (const root of scanRoots) {
  for (const filePath of await sourceFilesUnder(root)) {
    const source = await readFile(filePath, "utf8");
    const relativePath = relativeSourcePath(filePath);

    for (const methodName of forbiddenMethodNames) {
      const token = `.${methodName}(`;
      if (source.includes(token)) {
        incompatible.push(`${relativePath}:${methodName}`);
      }
    }

    for (const binding of cryptoHashImportBindings(source)) {
      if (binding.kind === "named_import") {
        node18IncompatibleCryptoHashApis.push(
          `${relativePath}:crypto.hash named import as ${binding.binding}`,
        );
        continue;
      }
      const escapedBinding = binding.binding.replaceAll("$", "\\$");
      const usagePattern = new RegExp(
        `\\b${escapedBinding}\\.hash\\s*\\(`,
        "u",
      );
      if (usagePattern.test(source)) {
        node18IncompatibleCryptoHashApis.push(
          `${relativePath}:${binding.binding}.hash()`,
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
assert.deepEqual(
  node18IncompatibleCryptoHashApis,
  [],
  [
    "Node 18-incompatible crypto.hash API usage found.",
    "crypto.hash was added after the repository's Node 18 floor.",
    ...node18IncompatibleCryptoHashApis,
  ].join("\n"),
);

console.log(JSON.stringify({
  ok: true,
  phase: "Maintenance Step 2A CI baseline portability/bootstrap",
  node_floor: packageJson.engines.node,
  npm_ci_before_run_all: true,
  full_git_history_for_historical_baselines: true,
  formal_canon_sources_lf: true,
  incompatible_copying_array_method_count: incompatible.length,
  node18_incompatible_crypto_hash_api_count:
    node18IncompatibleCryptoHashApis.length,
}));
console.log("Maintenance CI baseline portability/bootstrap guard passed.");
