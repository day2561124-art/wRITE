import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveActiveEngineDependencies,
} from "../../server/src/active-engine-dependency-manifest.mjs";
import {
  get_active_engine_dependency_status,
} from "../../server/src/mcp-active-engine-dependency-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const toolName = "get_active_engine_dependency_status";
const fixtureRoot = path.join(
  projectPaths.canonDb,
  ".mcp-active-engine-dependency-status-test",
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function hashFiles(filePaths) {
  return new Map(await Promise.all(filePaths.map(async (filePath) => [
    filePath,
    sha256(await readFile(filePath)),
  ])));
}

async function assertHashesEqual(expected, filePaths, message) {
  const actual = await hashFiles(filePaths);
  for (const filePath of filePaths) {
    assert.equal(actual.get(filePath), expected.get(filePath), `${message}: ${filePath}`);
  }
}

function runPublicMcp(requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_public" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP Active Engine dependency status test timed out: ${stderr}`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`MCP server exited code=${code} signal=${signal}: ${stderr}`));
        return;
      }
      try {
        resolve(stdout.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line)));
      } catch (error) {
        reject(new Error(`Could not parse MCP output: ${error.message}\n${stdout}`));
      }
    });
    child.stdin.end(`${requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
  });
}

async function copyFixture() {
  const fixtureOptions = {
    activeEnginePath: path.join(fixtureRoot, "active_engine.md"),
    dependencyRoot: fixtureRoot,
    entityRegistryRoot: path.join(fixtureRoot, "data", "entity_registry"),
    includeExtendedDependencies: false,
  };
  const sourceManifest = resolveActiveEngineDependencies({ includeExtendedDependencies: false });
  const fixtureManifest = resolveActiveEngineDependencies(fixtureOptions);
  await rm(fixtureRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(path.join(fixtureRoot, "config"), { recursive: true }),
    mkdir(fixtureOptions.entityRegistryRoot, { recursive: true }),
  ]);
  await copyFile(projectPaths.activeEngine, fixtureOptions.activeEnginePath);
  await Promise.all(sourceManifest.map((sourceDependency) => {
    const fixtureDependency = fixtureManifest.find(
      (dependency) => dependency.id === sourceDependency.id,
    );
    return copyFile(sourceDependency.filePath, fixtureDependency.filePath);
  }));
  return {
    fixtureOptions,
    fixturePaths: [
      fixtureOptions.activeEnginePath,
      ...fixtureManifest.map((dependency) => dependency.filePath),
    ],
  };
}

const liveManifest = resolveActiveEngineDependencies();
const protectedPaths = [...new Set([
  projectPaths.activeEngine,
  ...liveManifest.map((dependency) => dependency.filePath),
])];
const liveHashesBefore = await hashFiles(protectedPaths);

const responses = await runPublicMcp([
  {
    jsonrpc: "2.0",
    id: "initialize",
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "active-engine-dependency-status-test", version: "1" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  { jsonrpc: "2.0", id: "list", method: "tools/list", params: {} },
  {
    jsonrpc: "2.0",
    id: "dependency-status",
    method: "tools/call",
    params: { name: toolName, arguments: {} },
  },
  {
    jsonrpc: "2.0",
    id: "component-status",
    method: "tools/call",
    params: { name: "get_engine_components_status", arguments: {} },
  },
]);

const list = responses.find((response) => response.id === "list");
const tool = list.result.tools.find((entry) => entry.name === toolName);
assert(tool, `${toolName} missing from chatgpt_public tools/list`);
assert.match(tool.description, /^\[read\] \[read-only\]/u);
assert.equal(tool.annotations.readOnlyHint, true);
assert.equal(tool._meta["armed-academy/permission"].permission_level, "read_only");
assert.equal(tool._meta["armed-academy/permission"].read_or_write, "read");
assert.equal(tool._meta["armed-academy/permission"].can_modify_canon, false);
assert.equal(tool._meta["armed-academy/permission"].can_modify_active_engine, false);
assert.equal(tool._meta["armed-academy/permission"].log_required, false);

const dependencyResponse = responses.find((response) => response.id === "dependency-status");
assert.equal(dependencyResponse.result.isError, undefined);
const dependencyStatus = JSON.parse(dependencyResponse.result.content[0].text);
assert.equal(dependencyStatus.ok, true);
assert.equal(dependencyStatus.tool_name, toolName);
assert.equal(dependencyStatus.read_only, true);
assert.deepEqual(dependencyStatus.issues, []);
assert.equal(dependencyStatus.dependencies.engine_components.current, true);
assert.equal(dependencyStatus.dependencies.canon_zones.hash_matches, true);
assert.equal(dependencyStatus.dependencies.canon_zones.anchors_valid, true);
assert.equal(dependencyStatus.dependencies.canon_zones.coverage_valid, true);
assert.equal(dependencyStatus.dependencies.canon_zones.order_valid, true);
assert.equal(dependencyStatus.dependencies.canon_zones.roundtrip_matches, true);
assert.equal(dependencyStatus.dependencies.entity_registry.provenance_matches, true);
assert.equal(dependencyStatus.dependencies.entity_intake.current, true);
assert.equal(dependencyStatus.stale_count, 0);
assert.equal(dependencyStatus.current_count, dependencyStatus.dependency_count);
for (const dependency of Object.values(dependencyStatus.extended_operational_dependencies)) {
  assert.equal(dependency.current, true);
}

const componentResponse = responses.find((response) => response.id === "component-status");
assert.equal(componentResponse.result.isError, undefined);
const componentStatus = JSON.parse(componentResponse.result.content[0].text);
assert.equal(componentStatus.ok, true);
assert.equal(componentStatus.components.canon_data.hash_matches, true);
assert.deepEqual(componentStatus.issues, []);

await assertHashesEqual(
  liveHashesBefore,
  protectedPaths,
  "Live protected dependency changed during MCP read-only calls",
);

try {
  const { fixtureOptions, fixturePaths } = await copyFixture();
  const canonPath = path.join(fixtureRoot, "config", "canon-zones.json");
  const canonConfig = JSON.parse(await readFile(canonPath, "utf8"));
  canonConfig.expected_sha256_lf = "0".repeat(64);
  await writeFile(canonPath, `${JSON.stringify(canonConfig, null, 2)}\n`, "utf8");
  const staleFixtureHashes = await hashFiles(fixturePaths);

  const staleStatus = await get_active_engine_dependency_status({}, fixtureOptions);
  assert.equal(staleStatus.ok, false);
  assert.equal(staleStatus.read_only, true);
  assert.equal(staleStatus.dependencies.canon_zones.current, false);
  assert.equal(staleStatus.dependencies.canon_zones.hash_matches, false);
  assert(staleStatus.issues.includes("canon_zones:hash_mismatch"));
  assert(staleStatus.stale_count >= 1);
  await assertHashesEqual(
    staleFixtureHashes,
    fixturePaths,
    "Stale fixture changed during status inspection",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("MCP Active Engine dependency status tests A-F passed.");
