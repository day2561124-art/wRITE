import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const testResultCacheSchemaVersion = "verification-test-result-cache-v1";
export const TEST_RESULT_CACHE_MAX_MODULES = 256;
export const TEST_RESULT_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export const TEST_RESULT_CACHE_MAX_ENTRIES = 512;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function normalizeProjectPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "")
    .replace(/\/{2,}/gu, "/");
}

function isApprovedLocalModule(modulePath) {
  return (modulePath.startsWith("tests/") || modulePath.startsWith("server/src/"))
    && modulePath.endsWith(".mjs")
    && !modulePath.split("/").some((part) => part === "." || part === ".." || part === "");
}

function extractModuleSpecifiers(source) {
  const specifiers = new Set();
  const staticPattern = /\b(?:import|export)\s+(?:[^"'\r\n]*?\s+from\s+)?["']([^"'\r\n]+)["']/gu;
  const literalDynamicPattern = /\bimport\s*\(\s*["']([^"'\r\n]+)["']\s*\)/gu;
  for (const match of source.matchAll(staticPattern)) specifiers.add(match[1]);
  for (const match of source.matchAll(literalDynamicPattern)) specifiers.add(match[1]);
  const dynamicImportWithoutLiteral = /\bimport\s*\(\s*(?!["'])/u.test(source);
  return { specifiers: [...specifiers], dynamicImportWithoutLiteral };
}

function externalStateReason(source) {
  const checks = [
    ["FILESYSTEM_DEPENDENCY", /node:fs|from\s+["']fs["']|\breadFile(?:Sync)?\s*\(|\bwriteFile(?:Sync)?\s*\(|\bmkdir\s*\(|\bmkdtemp\s*\(|\brm\s*\(/u],
    ["PROCESS_DEPENDENCY", /node:child_process|\bspawn(?:Sync)?\s*\(|\bexecFile(?:Sync)?\s*\(|terminateProcessTree/u],
    ["NETWORK_DEPENDENCY", /node:(?:http|https|net|tls|dns|dgram)|\bfetch\s*\(|localhost|127\.0\.0\.1|trycloudflare|cloudflared/u],
    ["ENVIRONMENT_DEPENDENCY", /process\.(?:env|cwd|execPath|pid|platform|arch|hrtime|uptime)\b|node:os/u],
    ["CLOCK_DEPENDENCY", /Date\.now\s*\(|new\s+Date\s*\(|setTimeout\s*\(|setInterval\s*\(|performance\.now\s*\(/u],
    ["RANDOM_DEPENDENCY", /Math\.random\s*\(|randomUUID\s*\(|randomBytes\s*\(|randomInt\s*\(/u],
    ["WORKER_DEPENDENCY", /node:worker_threads/u],
  ];
  for (const [reason, pattern] of checks) {
    if (pattern.test(source)) return reason;
  }
  return null;
}

function resolveLocalSpecifier(fromPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const resolved = normalizeProjectPath(
    path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier)),
  );
  return resolved;
}

function hashEntries(entries) {
  return sha256(JSON.stringify([...entries]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path: modulePath, sha256: digest }) => [modulePath, digest])));
}

function runtimeContract() {
  return Object.freeze({
    node: process.version,
    modules: process.versions.modules ?? null,
    v8: process.versions.v8 ?? null,
    platform: process.platform,
    arch: process.arch,
  });
}

export function defaultTestResultCacheRoot(projectRoot) {
  return path.join(projectRoot, "tests", ".tmp", "verification-result-cache-v1");
}

export async function buildTestResultCacheManifest({
  projectRoot,
  testPath,
  args = [testPath],
  declaredEnvironment = {},
} = {}) {
  const root = path.resolve(String(projectRoot ?? ""));
  const normalizedTestPath = normalizeProjectPath(testPath);
  if (!root || !normalizedTestPath.startsWith("tests/") || !normalizedTestPath.endsWith(".test.mjs")) {
    return Object.freeze({ eligible: false, reason: "INVALID_TEST_PATH" });
  }

  const queue = [normalizedTestPath];
  const visited = new Set();
  const modules = [];
  let totalBytes = 0;

  while (queue.length > 0) {
    const modulePath = queue.shift();
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);
    if (visited.size > TEST_RESULT_CACHE_MAX_MODULES) {
      return Object.freeze({ eligible: false, reason: "DEPENDENCY_CLOSURE_TOO_LARGE" });
    }
    if (!isApprovedLocalModule(modulePath)) {
      return Object.freeze({ eligible: false, reason: `UNAPPROVED_LOCAL_MODULE:${modulePath}` });
    }

    const absolutePath = path.resolve(root, ...modulePath.split("/"));
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
      return Object.freeze({ eligible: false, reason: `MODULE_ESCAPES_PROJECT:${modulePath}` });
    }

    let source;
    try {
      source = await readFile(absolutePath, "utf8");
    } catch {
      return Object.freeze({ eligible: false, reason: `MODULE_UNAVAILABLE:${modulePath}` });
    }
    totalBytes += Buffer.byteLength(source, "utf8");
    if (totalBytes > TEST_RESULT_CACHE_MAX_BYTES) {
      return Object.freeze({ eligible: false, reason: "DEPENDENCY_CLOSURE_TOO_LARGE" });
    }

    const externalReason = externalStateReason(source);
    if (externalReason) {
      return Object.freeze({ eligible: false, reason: `${externalReason}:${modulePath}` });
    }

    const { specifiers, dynamicImportWithoutLiteral } = extractModuleSpecifiers(source);
    if (dynamicImportWithoutLiteral) {
      return Object.freeze({ eligible: false, reason: `DYNAMIC_IMPORT_UNDECLARED:${modulePath}` });
    }

    modules.push(Object.freeze({
      path: modulePath,
      sha256: sha256(source),
      bytes: Buffer.byteLength(source, "utf8"),
    }));

    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      const local = resolveLocalSpecifier(modulePath, specifier);
      if (!local) {
        return Object.freeze({
          eligible: false,
          reason: `EXTERNAL_PACKAGE_UNDECLARED:${specifier}`,
        });
      }
      if (!local.endsWith(".mjs")) {
        return Object.freeze({ eligible: false, reason: `NON_MJS_LOCAL_IMPORT:${local}` });
      }
      queue.push(local);
    }
  }

  const byPath = new Map(modules.map((entry) => [entry.path, entry]));
  const testEntry = byPath.get(normalizedTestPath);
  if (!testEntry) return Object.freeze({ eligible: false, reason: "TEST_INPUT_MISSING" });

  const dependencies = modules.filter((entry) => entry.path !== normalizedTestPath);
  const sourceEntries = dependencies.filter((entry) => entry.path.startsWith("server/src/"));
  const fixtureEntries = dependencies.filter((entry) => /(?:^|\/)(?:fixture|fixtures)(?:\/|$)/u.test(entry.path));
  const runtime = runtimeContract();
  const normalizedEnvironment = Object.fromEntries(
    Object.entries(declaredEnvironment ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  );

  const inputContract = Object.freeze({
    schema_version: testResultCacheSchemaVersion,
    test_path: normalizedTestPath,
    test_hash: testEntry.sha256,
    source_hash: hashEntries(sourceEntries),
    dependency_hash: hashEntries(dependencies),
    fixture_hash: hashEntries(fixtureEntries),
    args_hash: sha256(JSON.stringify(args)),
    runtime_hash: sha256(JSON.stringify(runtime)),
    environment_contract_hash: sha256(JSON.stringify(normalizedEnvironment)),
    runtime,
    declared_environment: Object.freeze(normalizedEnvironment),
    dependency_count: dependencies.length,
    source_dependency_count: sourceEntries.length,
    fixture_dependency_count: fixtureEntries.length,
  });
  const cacheKey = sha256(JSON.stringify(inputContract));

  return Object.freeze({
    eligible: true,
    reason: null,
    cache_key: cacheKey,
    input_contract: inputContract,
    modules: Object.freeze(modules),
  });
}

function entryPath(cacheRoot, cacheKey) {
  if (!/^[a-f0-9]{64}$/u.test(String(cacheKey ?? ""))) {
    throw new Error("Invalid test-result cache key.");
  }
  return path.join(path.resolve(cacheRoot), `${cacheKey}.json`);
}

export async function readCachedTestPass({ cacheRoot, manifest } = {}) {
  if (manifest?.eligible !== true) return null;
  try {
    const parsed = JSON.parse(await readFile(entryPath(cacheRoot, manifest.cache_key), "utf8"));
    if (
      parsed?.schema_version !== testResultCacheSchemaVersion
      || parsed?.cache_key !== manifest.cache_key
      || parsed?.test_path !== manifest.input_contract.test_path
      || parsed?.passed !== true
    ) {
      return null;
    }
    return Object.freeze({
      cache_hit: true,
      cache_key: parsed.cache_key,
      test_path: parsed.test_path,
      passed: true,
    });
  } catch {
    return null;
  }
}

export async function writeCachedTestPass({ cacheRoot, manifest } = {}) {
  if (manifest?.eligible !== true) return false;
  const root = path.resolve(cacheRoot);
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const cacheFiles = entries.filter((entry) => entry.isFile() && /^[a-f0-9]{64}\.json$/u.test(entry.name));
  if (cacheFiles.length >= TEST_RESULT_CACHE_MAX_ENTRIES) return false;

  const target = entryPath(root, manifest.cache_key);
  const temporary = `${target}.${process.pid}.tmp`;
  const record = {
    schema_version: testResultCacheSchemaVersion,
    cache_key: manifest.cache_key,
    test_path: manifest.input_contract.test_path,
    passed: true,
    input_contract: manifest.input_contract,
    created_at: new Date().toISOString(),
  };
  await writeFile(temporary, `${JSON.stringify(record)}\n`, "utf8");
  try {
    await rename(temporary, target);
    return true;
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
