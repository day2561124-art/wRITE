import path from "node:path";
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
export const FIXED_ISOLATED_TIMEOUT_MS = 120_000;

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

export function fixedIsolatedVerificationPlan(suite, context) {
  if (suite !== FIXED_ISOLATED_SUITE) reject("ISOLATED_VERIFICATION_REQUIRED");
  if (context?.workspace_type !== "isolated_worktree" ||
      context.workstream_state !== "active" || context.lifecycle_state !== "active" ||
      context.healthy !== true || context.mutation_allowed !== true ||
      typeof context.root !== "string" || !path.isAbsolute(context.root)) {
    reject("ISOLATED_WORKSPACE_REQUIRED");
  }
  return {
    context,
    cwd: context.root,
    command: "& (Join-Path $env:NEXA_SANDBOX_TOOLCHAIN 'node.exe') (Join-Path $env:NEXA_SANDBOX_WORK 'tests/tools/mcp-hermetic-core.test.mjs')",
    timeoutMs: FIXED_ISOLATED_TIMEOUT_MS,
    sandbox_paths: [...FIXED_ISOLATED_SOURCE_PATHS],
    sandbox_directories: [],
    output_paths: [],
    toolchain: "node",
  };
}

// This is a trusted server-side runner, not an additional authorization source.
// The enclosing dev_run_tests handler continues to own Journal admission,
// snapshot provenance and durable completion.
export async function runFixedIsolatedVerification({ suite, context, prepare = prepareAppContainerPowerShell }) {
  const prepared = await prepare(fixedIsolatedVerificationPlan(suite, context));
  let observed;
  try {
    observed = await prepared.run();
  } finally {
    // A cleanup failure must never become a successful verification receipt.
    await prepared.cleanup();
  }
  const valid = observed?.isolation_mode === "appcontainer" &&
    observed.workspace_writes === false && observed.job_terminated === true &&
    observed.input_file_count === FIXED_ISOLATED_SOURCE_PATHS.length &&
    /^[a-f0-9]{64}$/u.test(observed.input_manifest_sha256 ?? "") &&
    observed.toolchain === "node" &&
    observed.artifacts?.length === 0;
  if (!valid) reject("INVALID_ISOLATED_VERIFICATION_RECEIPT");
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
    workspace_writes: false,
    input_manifest_sha256: observed.input_manifest_sha256,
    input_file_count: observed.input_file_count,
    cleanup_pending: false,
    job_terminated: true,
  };
}
