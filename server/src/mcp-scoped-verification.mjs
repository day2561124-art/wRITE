import { prepareAppContainerPowerShell } from "./mcp-powershell-appcontainer.mjs";
import { redactProcessOutput } from "./process-control.mjs";

// Host-owned fixed suite. The request can select only the suite name, not a
// shell command, input paths, dependencies, timeout, or writable output path.
// This is the existing VA-9 hermetic suite, never a substitute for the broader
// postseal/core/affected/full verification groups.
export const SCOPED_HERMETIC_SUITE = "mcp_hermetic_core";
export const SCOPED_HERMETIC_ENTRYPOINT = "tests/tools/mcp-hermetic-core.test.mjs";
export const SCOPED_HERMETIC_TIMEOUT_MS = 60_000;
export const SCOPED_HERMETIC_SOURCES = Object.freeze([
  SCOPED_HERMETIC_ENTRYPOINT,
  "tests/mcp/mcp-verification-failure-classifier.test.mjs",
  "tests/mcp/mcp-verification-controlled-retry.test.mjs",
  "server/src/mcp-verification-failure-classifier.mjs",
  "server/src/mcp-verification-controlled-retry.mjs",
]);

export async function runScopedHermeticVerification({ suite, context }, {
  prepare = prepareAppContainerPowerShell,
} = {}) {
  if (suite !== SCOPED_HERMETIC_SUITE) throw Object.assign(
    new Error("ISOLATED_VERIFICATION_REQUIRED"), { code: "ISOLATED_VERIFICATION_REQUIRED" });
  if (!context || context.workspace_type !== "isolated_worktree"
    || context.lifecycle_state !== "active" || context.workstream_state !== "active"
    || context.healthy !== true || context.mutation_allowed !== true) {
    throw Object.assign(new Error("ISOLATED_WORKSPACE_REQUIRED"), { code: "ISOLATED_WORKSPACE_REQUIRED" });
  }
  const startedAt = Date.now();
  let prepared, receipt, error, cleaned = false;
  try {
    prepared = await prepare({
      context, cwd: context.root,
      command: "& node.exe tests/tools/mcp-hermetic-core.test.mjs\nexit $LASTEXITCODE",
      timeoutMs: SCOPED_HERMETIC_TIMEOUT_MS, toolchain: "node",
      sandbox_paths: [...SCOPED_HERMETIC_SOURCES], sandbox_directories: [], output_paths: [],
    });
    receipt = await prepared.run();
  } catch (cause) { error = cause; }
  finally {
    if (prepared) {
      try { await prepared.cleanup(); cleaned = true; }
      catch (cause) { error ??= cause; }
    }
  }
  const manifest = prepared?.manifest;
  const verified = cleaned && !error
    && receipt?.isolation_mode === "appcontainer" && receipt.workspace_writes === false
    && receipt.job_terminated === true
    && /^[a-f0-9]{64}$/u.test(manifest?.input_manifest_sha256 ?? "")
    && manifest.input_file_count === SCOPED_HERMETIC_SOURCES.length
    && manifest.toolchain === "node"
    && receipt.input_manifest_sha256 === manifest.input_manifest_sha256
    && receipt.input_file_count === manifest.input_file_count
    && receipt.toolchain === "node";
  const execution_ok = verified === true && receipt.execution_ok === true
    && Number.isInteger(receipt.exit_code) && receipt.timed_out === false;
  const passed = execution_ok && receipt.ok === true && receipt.exit_code === 0;
  return {
    suite, execution_ok, passed, exit_code: Number.isInteger(receipt?.exit_code) ? receipt.exit_code : null,
    signal: null, timed_out: receipt?.timed_out === true, duration_ms: Date.now() - startedAt,
    stdout: redactProcessOutput(receipt?.stdout ?? ""),
    stderr: redactProcessOutput([receipt?.stderr, error?.message,
      !verified ? "Scoped verification receipt or cleanup could not be verified." : null].filter(Boolean).join("\n")),
    stdout_truncated: receipt?.stdout_truncated === true, stderr_truncated: receipt?.stderr_truncated === true,
    isolation_mode: "appcontainer", workspace_writes: false,
    input_manifest_sha256: manifest?.input_manifest_sha256 ?? null,
    input_file_count: manifest?.input_file_count ?? null,
    job_terminated: receipt?.job_terminated === true, cleanup_pending: !!prepared && !cleaned,
    failure_code: passed ? null : !verified ? "SCOPED_VERIFICATION_UNVERIFIED" : "SCOPED_VERIFICATION_FAILED",
  };
}
