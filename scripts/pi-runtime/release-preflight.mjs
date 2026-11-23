import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = "@earendil-works/pi-coding-agent";
const exportsRequired = ["createAgentSession", "DefaultResourceLoader", "createCodemodeExtension",
  "createToolSearchExtension", "createMcpExtension", "SessionManager"];
const MAX_STDOUT = 64 * 1024;
const failure = (reason, extra = {}) => ({ ok: false, reason, ...extra });
const nodeSupported = value => {
  const match = String(value).match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  if (!match) return false;
  const major = Number(match[1]), minor = Number(match[2]);
  return major > 22 || major === 22 && minor >= 19;
};
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const within = (root, item) => {
  const rel = path.relative(root, item);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
};

export function verifyPinnedRuntime(manifest, lock, installed) {
  const pinned = manifest?.dependencies?.[PACKAGE];
  if (typeof pinned !== "string" || !/^\d+\.\d+\.\d+$/u.test(pinned))
    return failure("PI_RELEASE_VERSION_NOT_PINNED");
  if (lock?.packages?.[""]?.dependencies?.[PACKAGE] !== pinned
    || lock?.packages?.["node_modules/" + PACKAGE]?.version !== pinned)
    return failure("PI_RELEASE_LOCK_MISMATCH", { expected_version: pinned });
  if (installed?.name !== PACKAGE || installed?.version !== pinned)
    return failure("PI_RELEASE_INSTALLED_VERSION_MISMATCH", { expected_version: pinned,
      installed_version: typeof installed?.version === "string" ? installed.version : null });
  return { ok: true, package_name: PACKAGE, package_version: pinned };
}

export async function inspectPiRelease({ root = runtimeRoot, runProbe, nodeVersion = process.versions.node } = {}) {
  if (!nodeSupported(nodeVersion)) return failure("PI_RELEASE_NODE_INCOMPATIBLE", { required_node_version: ">=22.19.0" });
  const packageFile = path.join(root, "package.json");
  const lockFile = path.join(root, "package-lock.json");
  const installedFile = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
  const runner = path.join(root, "runner.mjs");
  let manifest, lock, installed;
  try { manifest = await readJson(packageFile); }
  catch { return failure("PI_RELEASE_MANIFEST_UNAVAILABLE"); }
  try { lock = await readJson(lockFile); }
  catch { return failure("PI_RELEASE_LOCK_UNAVAILABLE"); }
  try { installed = await readJson(installedFile); }
  catch { return failure("PI_RELEASE_DEPENDENCY_UNAVAILABLE"); }
  const version = verifyPinnedRuntime(manifest, lock, installed);
  if (!version.ok) return version;
  try {
    const resolvedRoot = await realpath(root);
    const resolvedDependency = await realpath(installedFile);
    if (!within(resolvedRoot, resolvedDependency)) return failure("PI_RELEASE_DEPENDENCY_OUTSIDE_RELEASE");
    await readFile(runner, "utf8");
  } catch { return failure("PI_RELEASE_RUNNER_OR_PATH_UNAVAILABLE"); }
  const execute = runProbe ?? (async () => execFileAsync(process.execPath, [runner, "status"],
    { cwd: root, timeout: 60_000, windowsHide: true, encoding: "utf8", maxBuffer: MAX_STDOUT }));
  let stdout;
  try { ({ stdout } = await execute()); }
  catch (error) {
    const raw = typeof error?.stdout === "string" && Buffer.byteLength(error.stdout, "utf8") <= MAX_STDOUT
      ? error.stdout.trim() : "";
    let code = null;
    try {
      const result = JSON.parse(raw);
      if (result?.reason === "pi_runtime_probe_failed" && typeof result?.detail === "string"
        && /^(?:ERR_[A-Z0-9_]{1,60}|MODULE_NOT_FOUND|ENOENT|SyntaxError|TypeError|ReferenceError)$/u.test(result.detail))
        code = result.detail;
    } catch { /* Do not expose raw process output. */ }
    return failure("PI_RELEASE_RUNNER_FAILED", { exit_code: Number.isInteger(error?.code) ? error.code : null,
      ...(code ? { detail: code } : {}) });
  }
  let payload;
  try {
    if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > MAX_STDOUT) throw new Error();
    payload = JSON.parse(stdout.trim());
  } catch { return failure("PI_RELEASE_RUNNER_INVALID_RESPONSE"); }
  if (payload?.ok !== true || payload?.package_name !== PACKAGE
    || payload?.package_version !== version.package_version
    || exportsRequired.some(name => payload.capabilities?.[name] !== true))
    return failure("PI_RELEASE_RUNNER_UNREADY");
  return { ...version, checked: "real_sidecar_runner", node_version: payload.node_version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  inspectPiRelease().then(result => {
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.ok) process.exitCode = 1;
  }).catch(() => {
    process.stdout.write(JSON.stringify(failure("PI_RELEASE_PREFLIGHT_FAILED")) + "\n");
    process.exitCode = 1;
  });
}
