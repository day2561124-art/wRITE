import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, opendir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertAllowedPathPolicy, assertExistingSafePath, decodeText, isExcludedSearchDirectory, isSecretName,
  isSupportedTextPath } from "./mcp-development-readonly-tools.mjs";
import { controlledProcessEnvironment, redactProcessOutput } from "./process-control.mjs";

const exec = promisify(execFile);
const runnerSource = fileURLToPath(new URL("../../scripts/mcp-powershell-appcontainer.cs", import.meta.url));
const fileBytes = 256 * 1024;
const outputBytes = 12 * 1024;
const badWindowsSegment = /[<>:"|?*\u0000-\u001f]|[. ]$|^(?:con(?:in\$|out\$)?|prn|aux|nul|(?:com|lpt)[0-9¹²³])(?:\.|$)/iu;

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function processText(base64) {
  return redactProcessOutput(Buffer.from(base64, "base64").toString("utf8")).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "");
}

function relativePath(root, input) {
  const segments = typeof input === "string" ? input.split(/[\\/]/u) : [];
  if (!segments.length || segments.some(segment => !segment || segment === "." || segment === ".."
    || badWindowsSegment.test(segment)) || input.length > 512) throw new Error("INVALID_SANDBOX_PATH");
  const target = path.join(root, ...segments);
  assertAllowedPathPolicy(target, "Sandbox path", root);
  return { target, name: segments.join("/") };
}

function selectedPaths(root, entries, limit, requireText = true) {
  if (!Array.isArray(entries) || entries.length > limit) throw new Error("INVALID_SANDBOX_PATHS");
  const paths = entries.map(entry => relativePath(root, entry));
  if (new Set(paths.map(entry => entry.name.toLowerCase())).size !== paths.length
    || (requireText && paths.some(entry => !isSupportedTextPath(entry.target)))) throw new Error("INVALID_SANDBOX_PATHS");
  return paths;
}

async function selectedSources(root, files, directories) {
  const explicit = selectedPaths(root, files, 64);
  const pending = selectedPaths(root, directories, 8, false);
  const sources = new Map(explicit.map(entry => [entry.name.toLowerCase(), entry]));
  const visited = new Set();
  let entries = 0;
  while (pending.length) {
    const directory = pending.pop();
    if (visited.has(directory.name.toLowerCase())) continue;
    visited.add(directory.name.toLowerCase());
    const info = await assertExistingSafePath(directory.target, "Sandbox directory", root);
    if (!info.isDirectory()) throw new Error("INVALID_SANDBOX_DIRECTORY");
    for await (const item of await opendir(directory.target)) {
      if (++entries > 2048) throw new Error("SANDBOX_DIRECTORY_SCAN_LIMIT");
      if (item.isSymbolicLink() || item.name.toLowerCase() === ".git" || isSecretName(item.name)) continue;
      if (item.isDirectory() && !isExcludedSearchDirectory(item.name)) {
        pending.push(relativePath(root, `${directory.name}/${item.name}`));
      } else if (item.isFile() && isSupportedTextPath(item.name)) {
        const source = relativePath(root, `${directory.name}/${item.name}`);
        const key = source.name.toLowerCase();
        if (sources.has(key) && sources.get(key).name !== source.name) throw new Error("SANDBOX_SOURCE_PATH_COLLISION");
        sources.set(key, source);
        if (sources.size > 512) throw new Error("SANDBOX_SOURCE_LIMIT");
      }
    }
  }
  const additional = [...sources.values()].slice(explicit.length);
  additional.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  return [...explicit, ...additional];
}

async function checkedFile(target, root, limit) {
  await assertExistingSafePath(target, "Sandbox path", root);
  const info = await lstat(target);
  if (!info.isFile() || info.size > limit) throw new Error("INVALID_SANDBOX_FILE");
  const bytes = await readFile(target);
  if (bytes.length > limit) throw new Error("INVALID_SANDBOX_FILE");
  decodeText(bytes, "Sandbox path");
  return bytes;
}

async function stageNodeToolchain(target) {
  const executable = await realpath(process.execPath);
  if (path.basename(executable).toLowerCase() !== "node.exe" || (await lstat(executable)).size > 128 * 1024 * 1024) {
    throw new Error("SANDBOX_NODE_TOOLCHAIN_UNAVAILABLE");
  }
  const npm = path.join(path.dirname(executable), "node_modules", "npm");
  if (path.relative(npm, await realpath(npm)) !== "") throw new Error("SANDBOX_NPM_TOOLCHAIN_UNAVAILABLE");
  const queue = [{ source: npm, destination: path.join(target, "npm") }];
  let count = 0;
  let bytes = 0;
  for (const item of queue) {
    const info = await lstat(item.source);
    if (++count > 4096 || info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error("SANDBOX_NPM_TOOLCHAIN_LIMIT");
    if (info.isDirectory()) {
      await mkdir(item.destination, { recursive: true });
      for (const name of await readdir(item.source)) queue.push({ source: path.join(item.source, name), destination: path.join(item.destination, name) });
    } else {
      bytes += info.size;
      if (bytes > 32 * 1024 * 1024) throw new Error("SANDBOX_NPM_TOOLCHAIN_LIMIT");
      await copyFile(item.source, item.destination);
    }
  }
  await copyFile(executable, path.join(target, "node.exe"));
  await writeFile(path.join(target, "npm.cmd"), '@"%~dp0node.exe" "%~dp0npm\\bin\\npm-cli.js" %*\r\n', { flag: "wx" });
}

export async function prepareAppContainerPowerShell({ context, cwd, command, timeoutMs,
  sandbox_paths = [], sandbox_directories = [], output_paths = [], toolchain, fixedHermeticCore = false }) {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("WINDOWS_APPCONTAINER_UNAVAILABLE");
  if (toolchain !== undefined && toolchain !== "node") throw new Error("INVALID_SANDBOX_TOOLCHAIN");
  // Internal fixed verification only: no caller-selected executable or arguments.
  if (fixedHermeticCore && (toolchain !== "node" || cwd !== context.root || output_paths.length !== 0 || sandbox_directories.length !== 0)) {
    throw new Error("INVALID_FIXED_APPCONTAINER_PLAN");
  }
  const sources = await selectedSources(context.root, sandbox_paths, sandbox_directories);
  const outputs = selectedPaths(context.root, output_paths, 8);
  if (Buffer.byteLength(JSON.stringify(outputs.map(output => output.name))) > 4096) throw new Error("SANDBOX_OUTPUT_PATH_LIMIT");
  const relativeCwd = path.relative(context.root, cwd) || ".";
  if (relativeCwd !== ".") relativePath(context.root, relativeCwd);
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-pi-shell-"));
  const stage = path.join(root, "stage");
  const work = path.join(stage, "work");
  const runner = path.join(root, "runner.exe");
  const commandHash = hash(command);
  const before = new Map();
  const inputManifest = [];
  const env = controlledProcessEnvironment();
  const windows = env.SystemRoot ?? env.SYSTEMROOT ?? env.WINDIR;
  const cleanup = async () => {
    const info = await lstat(root).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return;
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("nexa-pi-shell-")
      || !info.isDirectory() || info.isSymbolicLink()) throw new Error("SANDBOX_CLEANUP_PATH_MISMATCH");
    await rm(root, { recursive: true, force: true, maxRetries: 4 });
  };
  try {
    if (!windows || !path.isAbsolute(windows)) throw new Error("WINDOWS_APPCONTAINER_UNAVAILABLE");
    await mkdir(path.join(work, relativeCwd), { recursive: true });
    await mkdir(path.join(stage, "temp"));
    let total = 0;
    for (const source of sources) {
      const bytes = await checkedFile(source.target, context.root, fileBytes);
      total += bytes.length;
      if (total > 8 * 1024 * 1024) throw new Error("SANDBOX_SOURCE_LIMIT");
      const target = relativePath(work, source.name).target;
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
      const sha256 = hash(bytes);
      before.set(source.name.toLowerCase(), sha256);
      inputManifest.push({ path: source.name, sha256, bytes: bytes.length });
    }
    for (const entry of outputs) {
      // If an existing host file will be proposed for replacement, capture its
      // exact original bytes even when it wasn't copied into the guest.
      const key = entry.name.toLowerCase();
      if (!before.has(key)) {
        try { before.set(key, hash(await checkedFile(entry.target, context.root, fileBytes))); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
    await writeFile(path.join(stage, "command.txt"), command, { flag: "wx" });
    if (toolchain === "node") await stageNodeToolchain(path.join(root, "tools"));
    const compiler = path.join(windows, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
    await exec(compiler, ["/nologo", "/target:exe", "/platform:x64", `/out:${runner}`, runnerSource],
      { cwd: root, env, windowsHide: true, timeout: 30_000, maxBuffer: 65_536 });
  } catch (error) {
    await cleanup();
    throw error;
  }
  const manifest = { input_manifest_sha256: hash(JSON.stringify(inputManifest)), input_file_count: inputManifest.length,
    ...(toolchain ? { toolchain } : {}), ...(fixedHermeticCore ? { execution_mode: "fixed_node" } : {}) };
  const run = async () => {
    const start = Date.now();
    const base = { elevated: false, command_sha256: commandHash, cwd, timeout_ms: timeoutMs,
      execution_ok: false, ok: false, exit_code: null, timed_out: false, stdout: "", stderr: "",
      stdout_truncated: false, stderr_truncated: false, isolation_mode: "appcontainer", workspace_writes: false, ...manifest };
    let facts;
    try {
      const runnerArgs = [stage, relativeCwd, String(timeoutMs)];
      if (fixedHermeticCore) runnerArgs.push("fixed-hermetic-core");
      const { stdout, stderr } = await exec(runner, runnerArgs,
        { cwd: root, env, windowsHide: true, timeout: timeoutMs + 15_000, maxBuffer: 65_536 });
      if (stderr) throw new Error("APPCONTAINER_CLEANUP_UNVERIFIED");
      facts = JSON.parse(stdout);
      if (!["completed", "timeout", "stage_limit"].includes(facts.state)
        || (facts.state === "completed" ? !Number.isSafeInteger(facts.exit_code) : facts.exit_code !== null)) {
        throw new Error("INVALID_APPCONTAINER_RECEIPT");
      }
    } catch (error) {
      return { ...base, duration_ms: Date.now() - start, reason: "APPCONTAINER_RUNNER_FAILED",
        stderr: redactProcessOutput(error.stderr || error.message || "AppContainer runner failed").slice(0, 1024) };
    }
    const artifacts = [];
    let available = outputBytes;
    let artifactFailure = false;
    if (facts.state === "completed") for (const entry of outputs) {
      const source_sha256 = before.get(entry.name.toLowerCase()) ?? null;
      const target = relativePath(work, entry.name).target;
      try {
        const bytes = await checkedFile(target, work, fileBytes);
        const content = decodeText(bytes, "Sandbox output");
        const clean = redactProcessOutput(content) === content;
        const size = Buffer.byteLength(JSON.stringify(JSON.stringify(content)), "utf8");
        const include = clean && size <= available;
        if (include) available -= size;
        artifacts.push({ path: entry.name, source_sha256, sha256: hash(bytes), bytes: bytes.length,
          utf8_bom: bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
          ...(include ? { content } : { content_omitted: clean ? "size_limit" : "sensitive_output" }) });
      } catch (error) {
        const state = error.code === "ENOENT" ? "missing" : "unavailable";
        if (state === "unavailable") artifactFailure = true;
        artifacts.push({ path: entry.name, source_sha256, state });
      }
    }
    return { ...base, duration_ms: Date.now() - start, execution_ok: facts.state === "completed",
      ok: facts.state === "completed" && facts.exit_code === 0 && !artifactFailure,
      exit_code: facts.exit_code, timed_out: facts.state === "timeout",
      stdout: processText(facts.stdout_b64), stderr: processText(facts.stderr_b64),
      stdout_truncated: facts.stdout_truncated, stderr_truncated: facts.stderr_truncated,
      reason: facts.state === "completed" ? (artifactFailure ? "SANDBOX_ARTIFACT_UNAVAILABLE" : null) : facts.state.toUpperCase(),
      artifacts, job_terminated: true };
  };
  return { run, cleanup, manifest };
}
