import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { markPowerShellPreDispatchFailure, preservePowerShellPreDispatchFailure } from "../../server/src/mcp-powershell-predispatch-failure.mjs";
import { archivedPowerShellCwdResolution } from "../../server/src/mcp-powershell-recovery-resolution.mjs";
import { fingerprintMcpMutationRequest } from "../../server/src/mcp-operation-reconciliation-context.mjs";

async function fixture(t, { elevated = false, executor } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-powershell-predispatch-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storageRoot = path.join(root, "journal");
  const journal = createDevOperationJournalService({ storageRoot });
  const toolName = elevated ? "powershell_admin_run" : "powershell_run";
  const tool = createPowerShellMaintenanceTool({
    elevated, platform: "win32", journalApi: { ...journal, degrade: journal.markDegraded },
    workspaceContextResolver: async () => ({ root, workspace_id: "dev_workspace_shared_repository_v1", workstream_id: null }),
    executor: executor ?? (() => assert.fail("pre-dispatch rejection must never invoke the executor")),
  });
  const context = (key, input) => ({
    tool_name: toolName, reconciliation_key: key,
    request_fingerprint_sha256: fingerprintMcpMutationRequest(toolName, input),
  });
  return { journal, storageRoot, tool, toolName, context };
}

function errorResponse(error) {
  const response = { isError: true, content: [{ type: "text", text: error.message }] };
  preservePowerShellPreDispatchFailure(error, response);
  return response;
}

for (const elevated of [false, true]) {
  test(`known ${elevated ? "elevated" : "non-elevated"} PowerShell preflight rejection stays healthy after cold reopen`, async t => {
    const f = await fixture(t, { elevated });
    const input = { command: "Get-Location", cwd: "missing-directory" };
    const context = f.context("nexa-predispatch-rejected", input);
    if (elevated) {
      await assert.rejects(f.journal.executeReconciled(context, () => f.tool(input)), /ENOENT/);
    } else {
      const r = await f.journal.executeReconciled(context, () => f.tool(input).catch(errorResponse));
      assert.equal(r.value.isError, true);
    }
    const cold = createDevOperationJournalService({ storageRoot: f.storageRoot });
    const retry = await cold.executeReconciled(context, () => assert.fail("duplicate must not replay"));
    assert.equal(retry.reconciled, true);
    assert.equal(retry.operation.reconciliation_state, "no_effect");
    assert.equal(retry.operation.original_result.outcome, "failed_no_effect");
    assert.equal(retry.operation.reinitiate_requires_new_key, true);
    assert.equal(retry.operation.automatic_replay_allowed, false);
    assert.equal((await cold.status()).health, "healthy");
    assert.equal((await cold.verify()).events.length, 2);
  });
}

test("a PowerShell executor failure after the child starts stays ambiguous", async t => {
  const f = await fixture(t, { executor: () => { throw new Error("uncertain executor failure"); } });
  const input = { command: "Get-Location" };
  const result = await f.journal.executeReconciled(f.context("nexa-predispatch-executor", input), () => f.tool(input).catch(errorResponse));
  assert.equal(result.operation.reconciliation_state, "recovery_required");
  assert.equal(result.operation.automatic_replay_allowed, false);
  const cold = createDevOperationJournalService({ storageRoot: f.storageRoot });
  assert.equal((await cold.status()).health, "degraded");
  const events = (await cold.verify()).events;
  assert.equal(events.length, 4);
  assert.equal(events[1].parent_operation_id, result.operation.operation_id);
  assert.equal(events[2].stage, "operation_failed");
});

test("a timed-out PowerShell result with a recorded child remains ambiguous", async t => {
  const f = await fixture(t, { executor: ({ cwd, timeoutMs }) => ({
    cwd, timeout_ms: timeoutMs, execution_ok: true, ok: false, timed_out: true, exit_code: 0,
  }) });
  const input = { command: "Get-Location" };
  const result = await f.journal.executeReconciled(f.context("nexa-predispatch-timeout", input), async () => ({
    content: [{ type: "text", text: JSON.stringify(await f.tool(input)) }],
  }));
  assert.equal(result.operation.reconciliation_state, "recovery_required");
  assert.equal((await f.journal.status()).health, "degraded");
});

test("only non-elevated shared PowerShell accepts an absolute cwd", async t => {
  const f = await fixture(t);
  const cwd = await realpath(process.platform === "win32" ? process.env.SystemRoot || "C:\\Windows" : os.tmpdir());
  const input = { command: "[Environment]::CurrentDirectory", cwd };
  let dispatched = 0;
  const shell = (elevated, workspace_type) => createPowerShellMaintenanceTool({
    elevated, platform: "win32", journalApi: { ...f.journal, degrade: f.journal.markDegraded },
    workspaceContextResolver: async () => ({ root: path.dirname(f.storageRoot), workspace_type,
      workspace_id: "dev_workspace_shared_repository_v1", workstream_id: null }),
    ...(process.platform === "win32" ? {} : { executor: ({ cwd }) => {
      dispatched++;
      return { cwd, execution_ok: true, ok: true, timed_out: false, exit_code: 0, stdout: cwd };
    } }),
  });
  for (const [elevated, workspace_type] of [[true, "shared"], [false, "isolated_worktree"]]) {
    const tool_name = elevated ? "powershell_admin_run" : "powershell_run";
    const context = { tool_name, reconciliation_key: `nexa-cwd-denied-${workspace_type}`,
      request_fingerprint_sha256: fingerprintMcpMutationRequest(tool_name, input) };
    const rejected = await f.journal.executeReconciled(context, () => shell(elevated, workspace_type)(input).catch(errorResponse));
    assert.match(rejected.value.content[0].text, /absolute paths are not accepted/);
    assert.equal(rejected.operation.reconciliation_state, "no_effect");
  }
  assert.equal(dispatched, 0);
  const accepted = await f.journal.executeReconciled(f.context("nexa-cwd-shared-allowed", input), async () => ({
    content: [{ type: "text", text: JSON.stringify(await shell(false, "shared")(input)) }],
  }));
  const result = JSON.parse(accepted.value.content[0].text);
  assert.equal(result.exit_code, 0, result.stderr);
  assert.equal(result.stdout.trim().toLowerCase(), cwd.toLowerCase());
  assert.equal(accepted.operation.reconciliation_state, "completed");
  assert.equal((await createDevOperationJournalService({ storageRoot: f.storageRoot }).status()).health, "healthy");
});

test("missing child or serialized proof is not enough to clear an unknown PowerShell error", async t => {
  const f = await fixture(t);
  const input = { command: "Get-Location", cwd: "missing-directory" };
  const result = await f.journal.executeReconciled(f.context("nexa-predispatch-no-proof", input), async () => {
    const real = await f.tool(input).catch(errorResponse);
    return JSON.parse(JSON.stringify({ ...real, pre_dispatch: true }));
  });
  assert.equal(result.operation.reconciliation_state, "recovery_required");
  assert.equal((await f.journal.status()).health, "degraded");
});

test("a real witness cannot be reused for another operation", async t => {
  const f = await fixture(t);
  const input = { command: "Get-Location", cwd: "missing-directory" };
  let retained;
  await f.journal.executeReconciled(f.context("nexa-predispatch-first", input), async () => {
    retained = await f.tool(input).catch(errorResponse);
    return retained;
  });
  const second = await f.journal.executeReconciled(f.context("nexa-predispatch-second", input), () => retained);
  assert.equal(second.operation.reconciliation_state, "recovery_required");
});

test("a child admission defeats even a trusted pre-dispatch witness", async t => {
  const f = await fixture(t);
  const result = await f.journal.executeReconciled(f.context("nexa-predispatch-has-child", {}), async () => {
    const error = markPowerShellPreDispatchFailure(new Error("preflight"), f.toolName);
    const child = await f.journal.begin({ operation_type: "powershell_maintenance", tool_name: f.toolName });
    await f.journal.complete(child.operation_id, { result: { outcome: "no_effect_observed" } });
    return errorResponse(error);
  });
  assert.equal(result.operation.reconciliation_state, "recovery_required");
  assert.equal((await f.journal.status()).health, "degraded");
});

test("a child published during terminal CAS downgrades no-effect to ambiguous", async t => {
  const f = await fixture(t);
  const peer = createDevOperationJournalService({ storageRoot: f.storageRoot });
  const original = fs.promises.open;
  let armed = false, injected = false;
  fs.promises.open = async function(file, ...args) {
    if (armed && String(file) === path.join(f.storageRoot, "append.lock")) {
      armed = false;
      const child = await peer.begin({ operation_type: "powershell_maintenance", tool_name: f.toolName });
      await peer.complete(child.operation_id, { result: { outcome: "no_effect_observed" } });
      injected = true;
    }
    return original.call(this, file, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try {
    const input = { command: "Get-Location", cwd: "missing-directory" };
    result = await f.journal.executeReconciled(f.context("nexa-predispatch-cas", input), async () => {
      const response = await f.tool(input).catch(errorResponse);
      armed = true;
      return response;
    });
  } finally {
    fs.promises.open = original;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.equal(result.operation.terminal, true);
  assert.equal(result.operation.reconciliation_state, "recovery_required");
  assert.equal(result.operation.original_result.outcome, "ambiguous_effect");
});

test("the archived November 13 recovery requires the original claim and both published records", () => {
  // Event signatures are literal references from the published, verified
  // chain. Journal verification checks event hashes before calling this matcher.
  const claim = { sequence: 62034, stage: "operation_completed", operation_type: "pi_execution_projection",
    event_hash: "569653dd13d2fd74cf8bbb57fba4ee992b2a3b811e65797c2d7db25d08c1409e" };
  const started = { sequence: 62035, operation_id: "dev_operation_c32926abce154831b6c82bbfe39ebd8f",
    event_hash: "3949f1ed54f034c7666284359d692efdf1735695bfd3a3ca8bbacc24f3a75c42" };
  const terminal = { sequence: 62036, event_hash: "a129bd92e458b6a48857b529e0ae99abf186f462580f9e75ed2c94f00c4b729e" };
  const admission = { sequence: 62037, stage: "operation_started",
    event_hash: "110922a6197665215c193c83fccd5c17bf69778581dced6bdb90cdee117db7e5" };
  const receipt = { sequence: 62038, stage: "operation_completed",
    event_hash: "cfa7f64d5efcd70b0f32065ff3103c06ecc977240f793c19976972f28fcc2d06" };
  const events = [claim, started, terminal, admission, receipt];
  assert.deepEqual(archivedPowerShellCwdResolution(events, started, terminal), { admission, receipt });
  for (const e of [claim, admission, receipt]) {
    assert.equal(archivedPowerShellCwdResolution(events.filter(other => other !== e), started, terminal), null);
  }
  assert.equal(archivedPowerShellCwdResolution(events, started, { ...terminal, event_hash: "f".repeat(64) }), null);
  assert.equal(archivedPowerShellCwdResolution(events, { ...started, operation_id: "other-operation" }, terminal), null);
});
