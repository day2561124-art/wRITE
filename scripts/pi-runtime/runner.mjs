import { readFile } from "node:fs/promises";

const PACKAGE_NAME = "@earendil-works/pi-coding-agent";
const REQUIRED_EXPORTS = Object.freeze([
  "createAgentSession",
  "DefaultResourceLoader",
  "createCodemodeExtension",
  "createToolSearchExtension",
  "createMcpExtension",
  "SessionManager",
]);

function fail(reason, detail = null, exitCode = 1) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    reason,
    ...(detail ? { detail } : {}),
  })}\n`);
  process.exitCode = exitCode;
}

async function readInstalledPackageVersion() {
  const packageUrl = new URL(
    "./node_modules/@earendil-works/pi-coding-agent/package.json",
    import.meta.url,
  );
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  return typeof packageJson.version === "string" ? packageJson.version : null;
}

async function buildStatus() {
  const sdk = await import(PACKAGE_NAME);
  const capabilities = Object.fromEntries(
    REQUIRED_EXPORTS.map((name) => [name, typeof sdk[name] === "function"]),
  );
  return {
    ok: Object.values(capabilities).every(Boolean),
    package_name: PACKAGE_NAME,
    package_version: await readInstalledPackageVersion(),
    node_version: process.versions.node,
    capabilities,
  };
}

const action = process.argv[2] ?? "status";

if (action !== "status") {
  fail("unsupported_action", action, 2);
} else {
  try {
    process.stdout.write(`${JSON.stringify(await buildStatus())}\n`);
  } catch (error) {
    fail("pi_runtime_probe_failed", error?.code ?? error?.name ?? "unknown_error");
  }
}
