import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPowerShellMaintenanceTool, inspectScopedAdminRecovery, runPowerShellViaAdminTask } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { createPiTaskAuthorizationStore } from "../../server/src/pi-task-authorization.mjs";

const runner = fileURLToPath(new URL("../../scripts/mcp-powershell-scoped-admin-runner.ps1", import.meta.url));
const register = fileURLToPath(new URL("../../scripts/register-mcp-powershell-admin-runner.ps1", import.meta.url));
const goal = "查證工程服務與授權\n保留原有工作區";
const context = { workspace_id: `dev_workspace_${"a".repeat(24)}`,
  workstream_id: `dev_workstream_20261121-010000_${"b".repeat(12)}` };
const desktop = { skip: process.platform !== "win32", timeout: 45_000 };

function windowsPowerShell(args) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args],
    { encoding: "utf8", windowsHide: true, timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}

test("scoped scheduled runner reads protected grants and ignores the legacy command inbox", desktop, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-scoped-admin-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = path.join(root, "config.json");
  const requests = path.join(root, "requests");
  const results = path.join(root, "results");
  const grants = path.join(root, "grants");
  await Promise.all([requests, results, grants, path.join(root, "processing")].map(dir => mkdir(dir)));
  const userSid = windowsPowerShell(["-Command", "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"]);
  await writeFile(configPath, JSON.stringify({ schema_version: 2, expected_user_sid: userSid }));
  const actor = createPiTaskAuthorizationStore({ root: grants });
  const scoped = `nexa-test-${randomUUID().replaceAll("-", "")}`;
  const first = await actor.issue({ ...context, goal, expires_at_ms: Date.now() + 300_000,
    capabilities: ["windows.service.ensure_running"], windows_services: [scoped] });

  const legacy = path.join(requests, `${"0".repeat(32)}.request.json`);
  await writeFile(legacy, JSON.stringify({ schema_version: 1, command: "fixture-only" }));
  let lastMarker;
  const input = { command: "fixture audit text", cwd: root, timeoutMs: 1000, stateRoot: root };
  const authorization = { ...context, goal, task_authorization_id: first.task_authorization_id, service_name: scoped };
  const spawnSyncImpl = (_executable, argv) => {
    if (argv[0] === "/Query") return { status: 0 };
    [lastMarker] = readdirSync(requests).filter(name => name.endsWith(".scoped-request"));
    assert.equal(readFileSync(path.join(requests, lastMarker)).length, 0);
    windowsPowerShell(["-File", runner, "-ConfigPath", configPath]);
    return { status: 0 };
  };
  const launch = args => runPowerShellViaAdminTask({ ...input, spawnSyncImpl,
    serviceAuthorization: { ...authorization, ...args } });

  const witnessed = await launch({});
  assert.equal(witnessed.reason, "SCOPED_ADMIN_SERVICE_FAILED");
  assert.equal(witnessed.scoped_admin_dispatch_started, false);
  assert.equal(witnessed.service_name, scoped);
  assert.equal(await readFile(legacy, "utf8"), JSON.stringify({ schema_version: 1, command: "fixture-only" }));
  const receipt = path.join(results, `${witnessed.request_id}.result.json`);
  const preserved = await readFile(receipt, "utf8");
  await writeFile(path.join(requests, lastMarker), "fixture data is ignored");
  windowsPowerShell(["-File", runner, "-ConfigPath", configPath]);
  assert.equal(await readFile(receipt, "utf8"), preserved);
  assert.equal((await readdir(results)).length, 1);

  for (const override of [{ service_name: "nexa-unapproved-fixture" }, { goal: `${goal} altered` },
    { workspace_id: `dev_workspace_${"c".repeat(24)}` }]) {
    const denied = await launch(override);
    assert.equal(denied.reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");
    assert.equal(denied.scoped_admin_dispatch_started, false);
  }
  const past = Date.now() - 10_000;
  const expired = await createPiTaskAuthorizationStore({ root: grants, clock: () => past }).issue({ ...context, goal,
    expires_at_ms: past + 1, capabilities: ["windows.service.ensure_running"], windows_services: [scoped] });
  assert.equal((await launch({ task_authorization_id: expired.task_authorization_id })).reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");
  await actor.revoke(first.task_authorization_id);
  assert.equal((await launch({})).reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");

  const storageRoot = path.join(root, "journal");
  const journal = createDevOperationJournalService({ storageRoot });
  const maintenance = createPowerShellMaintenanceTool({ elevated: true,
    workspaceContextResolver: async () => ({ ...context, root, workspace_type: "isolated_worktree", workstream_state: "active" }),
    executor: args => runPowerShellViaAdminTask({ ...args, stateRoot: root, spawnSyncImpl }),
    journalApi: { begin: journal.begin, complete: journal.complete, fail: journal.fail, degrade: journal.markDegraded },
  });
  const request = { tool_name: "powershell_admin_run", reconciliation_key: "scoped-admin-denied-fixture",
    request_fingerprint_sha256: "1".repeat(64), resolve_workspace_scope: async () => context };
  const denied = await journal.executeReconciled(request, async () => {
    const payload = await maintenance({ workspace_id: context.workspace_id, command: input.command, service_authorization: authorization });
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
  });
  assert.equal(denied.operation.reconciliation_state, "no_effect");
  const verified = await journal.verify();
  const child = verified.events.find(event => event.parent_operation_id === denied.operation.operation_id && event.stage === "operation_started");
  const childTerminal = verified.events.find(event => event.operation_id === child.operation_id && event.stage === "operation_completed");
  assert.equal(childTerminal.result.scoped_request_id, child.operation_id.slice("dev_operation_".length));
  assert.equal((await journal.status()).health, "healthy");

  const journalModule = new URL("../../server/src/mcp-development-journal-tools.mjs", import.meta.url).href;
  const maintenanceModule = new URL("../../server/src/mcp-powershell-maintenance-tools.mjs", import.meta.url).href;
  const recoveryKey = "scoped-admin-worker-interrupted";
  const interrupted = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { spawnSync } from "node:child_process";
    import { createDevOperationJournalService } from ${JSON.stringify(journalModule)};
    import { createPowerShellMaintenanceTool, runPowerShellViaAdminTask } from ${JSON.stringify(maintenanceModule)};
    const journal = createDevOperationJournalService({ storageRoot: ${JSON.stringify(storageRoot)} });
    const context = ${JSON.stringify(context)};
    const root = ${JSON.stringify(root)};
    const maintenance = createPowerShellMaintenanceTool({ elevated: true,
      workspaceContextResolver: async () => ({ ...context, root, workspace_type: "isolated_worktree", workstream_state: "active" }),
      journalApi: { begin: journal.begin, fail: journal.fail, degrade: journal.markDegraded, complete: async () => process.exit(73) },
      executor: args => runPowerShellViaAdminTask({ ...args, stateRoot: root, spawnSyncImpl: (_name, argv) => argv[0] === "/Query" ? { status: 0 }
        : spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
          "-File", ${JSON.stringify(runner)}, "-ConfigPath", ${JSON.stringify(configPath)}], { timeout: 10000 }) }),
    });
    await journal.executeReconciled({ tool_name: "powershell_admin_run", reconciliation_key: ${JSON.stringify(recoveryKey)},
      request_fingerprint_sha256: "2".repeat(64), resolve_workspace_scope: async () => context }, () => maintenance({
        workspace_id: context.workspace_id, command: ${JSON.stringify(input.command)}, service_authorization: ${JSON.stringify(authorization)}
      }));
  `], { timeout: 35_000, encoding: "utf8", windowsHide: true });
  assert.equal(interrupted.status, 73, interrupted.stderr || interrupted.error?.message);
  const cold = createDevOperationJournalService({ storageRoot, scopedAdminEffectInspector: event => inspectScopedAdminRecovery(event, { stateRoot: root }) });
  const interruptedOperation = await cold.getOperation({ reconciliation_key: recoveryKey, request_fingerprint_sha256: "2".repeat(64) });
  const interruptedChild = (await cold.verify()).events.find(event => event.parent_operation_id === interruptedOperation.operation_id);
  const resultFile = path.join(results, `${interruptedChild.operation_id.slice("dev_operation_".length)}.result.json`);
  const stagedFile = resultFile + ".pending";
  await rename(resultFile, stagedFile);
  const [recovered] = await Promise.all([
    cold.initialize(),
    delay(500).then(() => rename(stagedFile, resultFile)),
  ]);
  assert.equal(recovered.health, "healthy");
  assert.equal(recovered.chain_verified, true);
  const previous = await cold.getOperation({ reconciliation_key: recoveryKey, request_fingerprint_sha256: "2".repeat(64) });
  assert.equal(previous.reconciliation_state, "no_effect");
  assert.equal(previous.automatic_replay_allowed, false);
  assert.equal(previous.original_result.reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");
  const receiptCount = (await readdir(results)).length;
  const duplicate = await cold.executeReconciled({ ...request, reconciliation_key: recoveryKey, request_fingerprint_sha256: "2".repeat(64) },
    () => assert.fail("the protected request must not be redispatched"));
  assert.equal(duplicate.reconciled, true);
  assert.equal((await readdir(results)).length, receiptCount);
});

test("the Windows PowerShell parser accepts the scoped registration and runner files", desktop, () => {
  const entries = [register, runner].map(file => `'${file.replaceAll("'", "''")}'`).join(",");
  windowsPowerShell(["-Command", `foreach ($path in @(${entries})) { $tokens = $null; $errors = $null;
    $null = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors);
    if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 } }`]);
});

test("approved PowerShell executes only the protected script with the exact authorized digest", desktop, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-approved-script-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(["requests", "results", "grants", "processing", "approved-scripts"].map(directory => mkdir(path.join(root, directory))));
  const configPath = path.join(root, "config.json");
  const userSid = windowsPowerShell(["-Command", "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"]);
  await writeFile(configPath, JSON.stringify({ schema_version: 2, expected_user_sid: userSid, approved_scripts: true }));
  const fixture = "param()\n[IO.File]::WriteAllText([IO.Path]::GetFullPath('script-created.txt'), 'reviewed')\nWrite-Output 'private-fixture-output'\nexit 0";
  const failure = "exit 7";
  const sha = code => createHash("sha256").update(code).digest("hex");
  const scripts = [{ script_id: "reviewed-fixture", script_sha256: sha(fixture) }, { script_id: "native-exit", script_sha256: sha(failure) }];
  await writeFile(path.join(root, "approved-scripts", "reviewed-fixture.ps1"), fixture);
  await writeFile(path.join(root, "approved-scripts", "native-exit.ps1"), failure);
  const store = createPiTaskAuthorizationStore({ root: path.join(root, "grants") });
  const { task_authorization_id } = await store.issue({ ...context, goal, expires_at_ms: Date.now() + 300_000,
    capabilities: ["windows.powershell.run_approved"], windows_scripts: scripts });
  const output = path.join(root, "script-created.txt");
  const dispatch = (script, requestId) => runPowerShellViaAdminTask({
    command: `approved_script:${script.script_id}:${script.script_sha256}`, cwd: root, timeoutMs: 60000, stateRoot: root,
    requestId,
    scriptAuthorization: { ...context, goal, task_authorization_id, ...script },
    spawnSyncImpl: (_executable, argv) => {
      if (argv[0] === "/Query") return { status: 0 };
      const [marker] = readdirSync(path.join(root, "requests"));
      assert.match(marker, /~script\.scoped-request$/u);
      assert.equal(readFileSync(path.join(root, "requests", marker)).length, 0);
      windowsPowerShell(["-File", runner, "-ConfigPath", configPath]);
      return { status: 0 };
    },
  });
  const completed = await dispatch(scripts[0]);
  assert.equal(completed.ok, true, JSON.stringify(completed));
  assert.equal(completed.scoped_admin_dispatch_started, true);
  assert.equal(completed.script_sha256, scripts[0].script_sha256);
  assert.equal(completed.stdout, "approved_script_completed");
  assert.match(completed.script_stdout_sample_sha256, /^[a-f0-9]{64}$/u);
  const stored = await readFile(path.join(root, "results", `${completed.request_id}.result.json`), "utf8");
  assert.doesNotMatch(stored, /private-fixture-output/u);
  assert.equal(await readFile(output, "utf8"), "reviewed");

  const failed = await dispatch(scripts[1]);
  assert.equal(failed.scoped_admin_dispatch_started, true);
  assert.equal(failed.ok, false);
  assert.equal(failed.exit_code, 7);
  assert.equal(failed.reason, "SCOPED_ADMIN_SCRIPT_FAILED");

  await writeFile(path.join(root, "approved-scripts", "reviewed-fixture.ps1"), fixture.replace("reviewed", "replaced"));
  const edited = await dispatch(scripts[0]);
  assert.equal(edited.reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");
  assert.equal(edited.scoped_admin_dispatch_started, false);
  assert.equal(await readFile(output, "utf8"), "reviewed");

  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const maintenance = createPowerShellMaintenanceTool({ elevated: true,
    workspaceContextResolver: async () => ({ ...context, root, workspace_type: "isolated_worktree", workstream_state: "active" }),
    executor: args => dispatch(args.scriptAuthorization, args.requestId),
    journalApi: { begin: journal.begin, complete: journal.complete, fail: journal.fail, degrade: journal.markDegraded },
  });
  const script = scripts[0];
  const key = { tool_name: "powershell_admin_run", reconciliation_key: "changed-script-no-dispatch",
    request_fingerprint_sha256: "3".repeat(64), resolve_workspace_scope: async () => context };
  const journaled = await journal.executeReconciled(key, async () => {
    const payload = await maintenance({ workspace_id: context.workspace_id, command: `approved_script:${script.script_id}:${script.script_sha256}`,
      script_authorization: { ...context, goal, task_authorization_id, ...script }, timeoutMs: 60000 });
    return { content: [{ type: "text", text: JSON.stringify(payload) }] };
  });
  assert.equal(journaled.operation.reconciliation_state, "no_effect");
  assert.equal((await journal.status()).health, "healthy");
  await store.revoke(task_authorization_id);
  assert.equal((await dispatch(scripts[1])).reason, "SCOPED_ADMIN_AUTHORIZATION_DENIED");
});
