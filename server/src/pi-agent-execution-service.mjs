import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { projectRoot, releaseRoot } from "./project-paths.mjs";

const execFileAsync = promisify(execFile);

export const PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";
export const PI_REQUIRED_NODE_VERSION = "22.19.0";
export const PI_RUNTIME_RUNNER_RELATIVE_PATH = "scripts/pi-runtime/runner.mjs";

const runnerPath = path.join(releaseRoot, ...PI_RUNTIME_RUNNER_RELATIVE_PATH.split("/"));
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

function parseNodeVersion(value) {
  const match = String(value ?? "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  if (!match) return null;
  return match.slice(1, 4).map((part) => Number(part));
}

export function isPiNodeVersionCompatible(value) {
  const parsed = parseNodeVersion(value);
  if (!parsed) return false;
  const required = [22, 19, 0];
  for (let index = 0; index < required.length; index += 1) {
    if (parsed[index] > required[index]) return true;
    if (parsed[index] < required[index]) return false;
  }
  return true;
}

function parseRunnerFailure(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT_BYTES) return null;
  let payload;
  try {
    payload = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (payload?.ok !== false || payload?.reason !== "pi_runtime_probe_failed") return null;
  const detail = typeof payload.detail === "string"
    && /^(?:ERR_[A-Z0-9_]{1,60}|MODULE_NOT_FOUND|ENOENT|SyntaxError|TypeError|ReferenceError)$/u.test(payload.detail)
    ? payload.detail
    : null;
  return { detail };
}

function boundedProbeFailure(error) {
  if (error?.code === "ENOENT") {
    return {
      ok: false,
      reason: "node_executable_unavailable",
      exit_code: null,
      timed_out: false,
    };
  }
  const runnerFailure = parseRunnerFailure(error?.stdout);
  return {
    ok: false,
    reason: runnerFailure ? "pi_runtime_probe_failed" : "sidecar_probe_failed",
    ...(runnerFailure?.detail ? { detail: runnerFailure.detail } : {}),
    exit_code: Number.isInteger(error?.code) ? error.code : null,
    timed_out: error?.killed === true,
  };
}

export async function probePiSidecar(options = {}) {
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const execute = options.execute ?? execFileAsync;
  try {
    const { stdout } = await execute(
      nodeExecutable,
      [runnerPath, "status"],
      {
        cwd: projectRoot,
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: "utf8",
      },
    );
    const payload = JSON.parse(String(stdout).trim());
    return {
      ok: payload?.ok === true,
      package_name: payload?.package_name === PI_PACKAGE_NAME
        ? payload.package_name
        : PI_PACKAGE_NAME,
      package_version: typeof payload?.package_version === "string"
        ? payload.package_version
        : null,
      node_version: typeof payload?.node_version === "string"
        ? payload.node_version
        : null,
      capabilities: payload?.capabilities && typeof payload.capabilities === "object"
        ? payload.capabilities
        : {},
      ...(payload?.ok === true ? {} : {
        reason: typeof payload?.reason === "string"
          ? payload.reason
          : "sidecar_not_ready",
      }),
    };
  } catch (error) {
    return boundedProbeFailure(error);
  }
}

export async function getPiRuntimeStatus(options = {}) {
  const hostNodeVersion = options.hostNodeVersion ?? process.versions.node;
  const configuredNodeExecutable = options.nodeExecutable
    ?? (process.env.WRITER_WORKBENCH_PI_NODE_EXECUTABLE?.trim() || process.execPath);
  const usingHostNode = configuredNodeExecutable === process.execPath;
  const hostCompatible = isPiNodeVersionCompatible(hostNodeVersion);

  if (usingHostNode && !hostCompatible) {
    return {
      ok: true,
      ready: false,
      integration_mode: "isolated_sidecar",
      package_name: PI_PACKAGE_NAME,
      required_node_version: `>=${PI_REQUIRED_NODE_VERSION}`,
      host_node_version: hostNodeVersion,
      host_node_compatible: false,
      node_executable_source: "host",
      runner: PI_RUNTIME_RUNNER_RELATIVE_PATH,
      reason: "host_node_version_too_old",
      probe: null,
    };
  }

  const probe = options.probe
    ? await options.probe({
      nodeExecutable: configuredNodeExecutable,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    : await probePiSidecar({
      nodeExecutable: configuredNodeExecutable,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

  return {
    ok: true,
    ready: probe?.ok === true,
    integration_mode: "isolated_sidecar",
    package_name: PI_PACKAGE_NAME,
    required_node_version: `>=${PI_REQUIRED_NODE_VERSION}`,
    host_node_version: hostNodeVersion,
    host_node_compatible: hostCompatible,
    node_executable_source: usingHostNode ? "host" : "configured",
    runner: PI_RUNTIME_RUNNER_RELATIVE_PATH,
    reason: probe?.ok === true ? null : (probe?.reason ?? "sidecar_not_ready"),
    probe,
  };
}
