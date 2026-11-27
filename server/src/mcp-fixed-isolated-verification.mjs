import path from "node:path";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { assertExistingSafePath, decodeText } from "./mcp-development-readonly-tools.mjs";
import { prepareAppContainerPowerShell } from "./mcp-powershell-appcontainer.mjs";

// A fixed, explicitly named subset of the existing VA-9 hermetic tests.
// No caller-selected command, paths, timeout, toolchain, or output files.
// The host-only suites remain unavailable in the scoped dispatcher.
export const FIXED_ISOLATED_SUITE = "mcp_hermetic_core";
export const FIXED_ISOLATED_SOURCE_PATHS = Object.freeze([
  "tests/tools/mcp-hermetic-core.test.mjs",
  "tests/mcp/mcp-verification-failure-classifier.test.mjs",
  "tests/mcp/mcp-verification-controlled-retry.test.mjs",
  "server/src/mcp-verification-failure-classifier.mjs",
  "server/src/mcp-verification-controlled-retry.mjs",
]);
export const FIXED_MANIFEST_SUITE = "mcp_hermetic_manifest";
export const FIXED_MANIFEST_SOURCE_PATHS = Object.freeze([
  "tests/mcp/mcp-verification-manifest.test.mjs",
  "server/src/mcp-verification-manifest.mjs",
  "server/src/mcp-verification-failure-classifier.mjs",
]);
export const FIXED_ISOLATED_TIMEOUT_MS = 120_000;
export const isFixedIsolatedSuite = suite => suite === FIXED_ISOLATED_SUITE || suite === FIXED_MANIFEST_SUITE;

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

export function fixedIsolatedVerificationPlan(suite, context) {
  if (!isFixedIsolatedSuite(suite)) reject("ISOLATED_VERIFICATION_REQUIRED");
  const manifestSuite = suite === FIXED_MANIFEST_SUITE;
  if (context?.workspace_type !== "isolated_worktree" ||
      context.workstream_state !== "active" || context.lifecycle_state !== "active" ||
      context.healthy !== true || context.mutation_allowed !== true ||
      typeof context.root !== "string" || !path.isAbsolute(context.root)) {
    reject("ISOLATED_WORKSPACE_REQUIRED");
  }
  return {
    context,
    cwd: context.root,
    command: manifestSuite
      ? "& (Join-Path $env:NEXA_SANDBOX_TOOLCHAIN 'node.exe') (Join-Path $env:NEXA_SANDBOX_WORK 'tests/mcp/mcp-verification-manifest.test.mjs')"
      : "& (Join-Path $env:NEXA_SANDBOX_TOOLCHAIN 'node.exe') (Join-Path $env:NEXA_SANDBOX_WORK 'tests/tools/mcp-hermetic-core.test.mjs')",
    timeoutMs: FIXED_ISOLATED_TIMEOUT_MS,
    sandbox_paths: [...(manifestSuite ? FIXED_MANIFEST_SOURCE_PATHS : FIXED_ISOLATED_SOURCE_PATHS)],
    sandbox_directories: [],
    output_paths: [],
    toolchain: "node",
    fixedHermeticCore: !manifestSuite,
    fixedVerificationManifest: manifestSuite,
  };
}

// Reproduce the staging manifest from independently observed workspace bytes.
// The sandbox receipt must bind the exact suite sources, not merely a file count.
const sha256 = value => createHash("sha256").update(value).digest("hex");
async function observeInputManifest(root, paths) {
  const entries = [];
  for (const file of paths) {
    const target = path.join(root, file);
    await assertExistingSafePath(target, "Fixed verification source", root);
    const info = await lstat(target);
    if (!info.isFile() || info.size > 256 * 1024) reject("INVALID_FIXED_VERIFICATION_SOURCE");
    const bytes = await readFile(target);
    if (bytes.length > 256 * 1024) reject("INVALID_FIXED_VERIFICATION_SOURCE");
    decodeText(bytes, "Fixed verification source");
    entries.push({ path: file, sha256: sha256(bytes), bytes: bytes.length });
  }
  return sha256(JSON.stringify(entries));
}

// This is a trusted server-side runner, not an additional authorization source.
// The enclosing dev_run_tests handler continues to own Journal admission,
// snapshot provenance and durable completion.
export async function runFixedIsolatedVerification({ suite, context, prepare = prepareAppContainerPowerShell }) {
  const plan = fixedIsolatedVerificationPlan(suite, context);
  const expectedManifest = await observeInputManifest(context.root, plan.sandbox_paths);
  const prepared = await prepare(plan);
  let observed;
  try {
    if (prepared.manifest?.input_manifest_sha256 !== expectedManifest ||
        prepared.manifest?.input_file_count !== plan.sandbox_paths.length) {
      reject("ISOLATED_VERIFICATION_INPUT_CHANGED");
    }
    observed = await prepared.run();
  } finally {
    // A cleanup failure must never become a successful verification receipt.
    await prepared.cleanup();
  }
  const valid = observed?.isolation_mode === "appcontainer" &&
    observed.workspace_writes === false && observed.job_terminated === true &&
    observed.input_file_count === plan.sandbox_paths.length &&
    observed.input_manifest_sha256 === expectedManifest &&
    observed.toolchain === "node" &&
    observed.execution_mode === "fixed_node" &&
    Array.isArray(observed.artifacts) && observed.artifacts.length === 0;
  if (!valid) reject("INVALID_ISOLATED_VERIFICATION_RECEIPT");
  if (await observeInputManifest(context.root, plan.sandbox_paths) !== expectedManifest) reject("ISOLATED_VERIFICATION_INPUT_CHANGED");
  const execution_ok = observed.execution_ok === true;
  const passed = execution_ok && observed.ok === true &&
    observed.exit_code === 0 && observed.timed_out === false;
  return {
    suite, execution_ok, passed,
    exit_code: observed.exit_code,
    signal: null,
    timed_out: observed.timed_out === true,
    duration_ms: observed.duration_ms,
    stdout: observed.stdout, stderr: observed.stderr,
    stdout_truncated: observed.stdout_truncated === true,
    stderr_truncated: observed.stderr_truncated === true,
    isolation_mode: "appcontainer",
    execution_mode: "fixed_node",
    workspace_writes: false,
    input_manifest_sha256: observed.input_manifest_sha256,
    input_file_count: observed.input_file_count,
    cleanup_pending: false,
    job_terminated: true,
  };
}
