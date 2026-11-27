import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FIXED_ISOLATED_SUITE, FIXED_ISOLATED_SOURCE_PATHS, FIXED_MANIFEST_SUITE, FIXED_MANIFEST_SOURCE_PATHS, fixedIsolatedVerificationPlan, runFixedIsolatedVerification } from "../../server/src/mcp-fixed-isolated-verification.mjs";
import { createDevTestRunner } from "../../server/src/mcp-development-test-tools.mjs";
import { prepareAppContainerPowerShell } from "../../server/src/mcp-powershell-appcontainer.mjs";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPowerShellMaintenanceTool } from "../../server/src/mcp-powershell-maintenance-tools.mjs";
import { fingerprintMcpMutationRequest } from "../../server/src/mcp-operation-reconciliation-context.mjs";
import { adaptAuthorizedPiRequest } from "../../server/src/pi-execution-policy.mjs";
import { createPiProductionExecutionController } from "../../server/src/pi-production-execution-controller.mjs";
import { createPiProductionRouteStore } from "../../server/src/pi-production-execution-route.mjs";
import { createPiTaskAuthorizationStore, createPiTaskPolicy } from "../../server/src/pi-task-authorization.mjs";

const platform = { skip: process.platform !== "win32" || process.arch !== "x64", timeout: 60_000 };
const identities = { project_id: "writer_workbench", workspace_id: "dev_workspace_" + "4".repeat(24),
  workstream_id: "dev_workstream_20261121-010000_" + "3".repeat(12) };
const shellCapability = "workspace.powershell_isolated";
const goal = "Run ordinary Windows PowerShell while isolating fixture inputs and outputs";
const psString = value => `'${value.replaceAll("'", "''")}'`;

async function fixture(t, { allowRepair = false, loseFirstShellResponse = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-appcontainer-test-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5 }));
  const context = { ...identities, root: path.join(root, "workspace"), workspace_type: "isolated_worktree",
    state: "active", workstream_state: "active", lifecycle_state: "active", healthy: true, mutation_allowed: true };
  const taskRoot = path.join(root, "grants");
  await mkdir(context.root);
  await mkdir(taskRoot);
  const store = createPiTaskAuthorizationStore({ root: taskRoot });
  const grant = await store.issue({ ...identities, goal,
    capabilities: allowRepair ? [shellCapability, "filesystem.patch"] : [shellCapability], expires_at_ms: Date.now() + 120_000 });
  const journal = createDevOperationJournalService({ storageRoot: path.join(root, "journal") });
  const route = createPiProductionRouteStore({ journal });
  await route.change({ mode: "pi_default", expected_revision: 0, decision_id: "gpt-appcontainer-test", gate_hash: "1".repeat(64) },
    { validateGate: async () => true });
  const tool = createPowerShellMaintenanceTool({ isolated: true, workspaceContextResolver: async () => context,
    journalApi: { begin: journal.begin, complete: journal.complete, fail: journal.fail, degrade: journal.markDegraded } });
  let dispatches = 0;
  const controller = createPiProductionExecutionController({ journal, route, authorizeTask: createPiTaskPolicy({ store, required: true }),
    transport: {
      resolveWorkspace: async () => context,
      queryOperation: journal.getOperation,
      async callTool(params) {
        dispatches += 1;
        if (allowRepair && params.name === "dev_apply_patch") {
          const { path: file, expectedSha256, oldText, newText } = params.arguments;
          assert.equal(file, "code/probe.cs");
          const target = path.join(context.root, file);
          const source = await readFile(target, "utf8");
          assert.equal(createHash("sha256").update(source).digest("hex"), expectedSha256);
          assert.equal(source, oldText);
          await writeFile(target, newText);
          return { ok: true };
        }
        assert.equal(params.name, "powershell_run");
        assert.equal(params.arguments.sandbox, true);
        const result = await journal.executeReconciled({ reconciliation_key: params._meta.reconciliation_key,
          request_fingerprint_sha256: fingerprintMcpMutationRequest(params.name, params.arguments), tool_name: params.name,
          resolve_workspace_scope: async () => identities }, async () => {
          try {
            const payload = await tool(params.arguments);
            return { content: [{ type: "text", text: JSON.stringify(payload) }] };
          } catch (error) {
            // Only fixture paths and commands are used here. Keep the original
            // error and reconciliation behavior, but expose the pre-dispatch
            // failure to hosted CI before the controller records its outcome.
            t.diagnostic(JSON.stringify({ stage: "appcontainer-fixture-dispatch",
              code: error?.code ?? null, message: error?.message ?? String(error) }));
            throw error;
          }
        });
        if (loseFirstShellResponse && dispatches === 1) {
          throw Object.assign(new Error("Fixture lost the native build response"), { code: "TRANSPORT_ERROR" });
        }
        return result.value;
      },
    } });
  const intent = (intent_id, commandOrActions, options = {}) => adaptAuthorizedPiRequest({ request_kind: "autonomous_engineering",
    intent_id, workspace_id: context.workspace_id, goal, task_authorization_id: grant.task_authorization_id,
    ...(typeof commandOrActions === "string" ? { command: commandOrActions } : { requested_actions: commandOrActions }),
    ...options }, { resolveWorkspace: async () => context });
  return { root, context, journal, controller, intent, dispatches: () => dispatches };
}

test("Pi runs sandboxed PowerShell with exact staged input, denied host and loopback access, and a durable output", { ...platform, timeout: 120_000 }, async t => {
  const f = await fixture(t);
  const protectedPath = path.join(f.root, "host-only.txt");
  const source = path.join(f.context.root, "source.txt");
  await writeFile(protectedPath, "host-fixture");
  await writeFile(source, "source-fixture");
  process.env.NEXA_APPCONTAINER_TEST_HOST_ONLY = "fixture";
  t.after(() => { delete process.env.NEXA_APPCONTAINER_TEST_HOST_ONLY; });
  let connected = false;
  const service = createServer(socket => { connected = true; socket.end(); });
  t.after(() => new Promise(resolve => service.close(resolve)));
  service.listen(0, "127.0.0.1");
  await once(service, "listening");
  const command = [
    "if ($env:NEXA_APPCONTAINER_TEST_HOST_ONLY) { throw 'unexpected host environment' }",
    `$outside = ${psString(protectedPath)}`,
    `try { [IO.File]::ReadAllText($outside) | Out-Null; throw 'unexpected host read' } catch [UnauthorizedAccessException] {}`,
    `try { [IO.File]::WriteAllText($outside, 'unexpected'); throw 'unexpected host write' } catch [UnauthorizedAccessException] {}`,
    `$fixture = [Net.Sockets.TcpClient]::new()`,
    // A denied TCP connection can be silently dropped instead of immediately refused.
    // Bound the probe independently of the sandbox watchdog; any successful connection still fails.
    `try { $pending = $fixture.BeginConnect('127.0.0.1', ${service.address().port}, $null, $null); if ($pending.AsyncWaitHandle.WaitOne(5000)) { $fixture.EndConnect($pending); throw 'unexpected loopback' }; if ($fixture.Connected) { throw 'unexpected loopback' } } catch [Net.Sockets.SocketException] {} finally { $fixture.Dispose() }`,
    `$copied = [IO.File]::ReadAllText([IO.Path]::GetFullPath('source.txt'))`,
    `[IO.File]::WriteAllText([IO.Path]::GetFullPath('source.txt'), $copied + '-edited')`,
    "Write-Output 'isolated-fixture-ok'",
  ].join("\n");
  const intent = await f.intent("native-appcontainer-read-write", command, { sandbox_paths: ["source.txt"], output_paths: ["source.txt"], timeoutMs: 60_000 });
  assert.equal(intent.requested_actions[0].capability, shellCapability);
  const completed = await f.controller.execute(intent);
  assert.equal(completed.state.status, "COMPLETED", JSON.stringify(completed.state.last_error) + JSON.stringify(completed.receipts));
  const payload = JSON.parse(completed.receipts[0].evidence.content[0].text);
  assert.equal(payload.stdout.trim(), "isolated-fixture-ok");
  assert.equal(payload.artifacts[0].content, "source-fixture-edited");
  assert.match(payload.artifacts[0].source_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(payload.workspace_writes, false);
  assert.equal(await readFile(source, "utf8"), "source-fixture");
  assert.equal(await readFile(protectedPath, "utf8"), "host-fixture");
  assert.equal(connected, false);
  assert.equal((await f.controller.execute(intent)).state.operation_id, completed.state.operation_id);
  assert.equal(f.dispatches(), 1);
  assert.equal((await f.journal.status()).health, "healthy");
});

test("AppContainer timeout terminates a Windows child and records a safe workspace failure", { ...platform, timeout: 120_000 }, async t => {
  const f = await fixture(t);
  const command = [
    `$program = [Diagnostics.ProcessStartInfo]::new([IO.Path]::Combine($PSHOME, 'powershell.exe'), '-NoProfile -NonInteractive -Command [Threading.Thread]::Sleep(90000)')`,
    "$program.UseShellExecute = $false",
    "$program.CreateNoWindow = $true",
    "$child = [Diagnostics.Process]::Start($program)",
    "[Console]::WriteLine('sandbox-child=' + $child.Id)",
    "[Console]::Out.Flush()",
    "[Threading.Thread]::Sleep(90000)",
  ].join("\n");
  const intent = await f.intent("native-appcontainer-timeout", command, { timeoutMs: 45_000 });
  const stopped = await f.controller.execute(intent);
  assert.equal(stopped.state.status, "DECISION_REQUIRED");
  const observed = JSON.parse(stopped.command.receipt.evidence.content[0].text);
  assert.equal(observed.timed_out, true);
  assert.equal(observed.job_terminated, true);
  const pid = Number(/sandbox-child=([0-9]+)/u.exec(observed.stdout)?.[1]);
  assert.ok(pid > 0, observed.stdout);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  const recorded = await f.journal.getOperation({ reconciliation_key: intent.requested_actions[0].idempotency_key });
  assert.equal(recorded.reconciliation_state, "no_effect");
  assert.equal(recorded.automatic_replay_allowed, false);
  assert.equal((await f.journal.status()).health, "healthy");
});

test("AppContainer composes a real Windows build and preserves the native test exit code", platform, async t => {
  const f = await fixture(t);
  const source = 'class Probe { static int Main(string[] args) { System.Console.WriteLine("nexa-build-probe"); return args.Length == 0 ? 0 : 7; } }';
  await mkdir(path.join(f.context.root, "code"));
  await writeFile(path.join(f.context.root, "code", "probe.cs"), source);
  const scope = { cwd: "code", sandbox_paths: ["code/probe.cs"] };
  const build = [
    `$compiler = [IO.Path]::Combine($env:WINDIR, 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe')`,
    `& $compiler /nologo /out:probe.exe probe.cs`,
    `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`,
    `& ([IO.Path]::GetFullPath('probe.exe'))`,
  ].join("\n");
  const good = await f.controller.execute(await f.intent("native-appcontainer-build", build, scope));
  assert.equal(good.state.status, "COMPLETED", JSON.stringify(good.command));
  assert.equal(JSON.parse(good.receipts[0].evidence.content[0].text).stdout.trim(), "nexa-build-probe");
  const failure = await f.intent("native-appcontainer-test-failed", `${build} failed`, scope);
  const failed = await f.controller.execute(failure);
  assert.equal(failed.state.status, "DECISION_REQUIRED");
  assert.equal(JSON.parse(failed.command.receipt.evidence.content[0].text).exit_code, 7);
  assert.equal((await f.journal.getOperation({ reconciliation_key: failure.requested_actions[0].idempotency_key })).reconciliation_state, "no_effect");
  assert.equal((await f.journal.status()).health, "healthy");
  await assert.rejects(readFile(path.join(f.context.root, "code", "probe.exe")), { code: "ENOENT" });
});

test("AppContainer installs a workspace package offline and runs a Node test in one process", { ...platform, timeout: 120_000 }, async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.context.root, "fixture"));
  await writeFile(path.join(f.context.root, "package.json"), JSON.stringify({ name: "nexa-fixture-root", version: "1.0.0",
    dependencies: { "nexa-local-fixture": "file:./fixture" } }));
  await writeFile(path.join(f.context.root, "fixture", "package.json"), JSON.stringify({ name: "nexa-local-fixture", version: "1.0.0", main: "index.js" }));
  await writeFile(path.join(f.context.root, "fixture", "index.js"), 'module.exports = "local-package-installed";\n');
  await writeFile(path.join(f.context.root, "offline.test.cjs"), [
    'const assert = require("node:assert/strict");',
    'const test = require("node:test");',
    'test("offline package loads", () => assert.equal(require("nexa-local-fixture"), "local-package-installed"));',
  ].join("\n"));
  const runTest = process.allowedNodeEnvironmentFlags.has("--test-isolation")
    ? "& node.exe --test --test-isolation=none --test-reporter=tap offline.test.cjs"
    : "& node.exe offline.test.cjs";
  const command = [
    `& node.exe -e "try { require('nexa-local-fixture') } catch { process.exitCode = 7 }"`,
    "if ($LASTEXITCODE -ne 7) { throw 'expected missing dependency' }",
    "Write-Output 'dependency-missing-observed'",
    "& npm.cmd install --offline --install-links --ignore-scripts --no-package-lock",
    "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
    runTest,
  ].join("\n");
  const intent = await f.intent("native-appcontainer-npm", command, { toolchain: "node", timeoutMs: 60_000,
    sandbox_paths: ["package.json", "fixture/package.json", "fixture/index.js", "offline.test.cjs"] });
  const result = await f.controller.execute(intent);
  assert.equal(result.state.status, "COMPLETED", JSON.stringify(result.command));
  const payload = JSON.parse(result.receipts[0].evidence.content[0].text);
  assert.match(payload.stdout, /dependency-missing-observed/u);
  assert.match(payload.stdout, /ok 1 - offline package loads/u);
  assert.equal(payload.toolchain, "node");
  await assert.rejects(readFile(path.join(f.context.root, "node_modules", "nexa-local-fixture", "index.js")), { code: "ENOENT" });
  assert.equal((await f.journal.status()).health, "healthy");
});

test("Pi stages a bounded nested source tree without importing credentials, links or generated dependencies", platform, async t => {
  const f = await fixture(t);
  const source = path.join(f.context.root, "src");
  await mkdir(path.join(source, "nested"), { recursive: true });
  await mkdir(path.join(source, "node_modules"));
  await mkdir(path.join(f.root, "external"));
  await Promise.all(Array.from({ length: 72 }, (_, index) => writeFile(path.join(source, `source-${index}.txt`), String(index))));
  await writeFile(path.join(source, "nested", "probe.txt"), "nested-source");
  await writeFile(path.join(source, "nested", ".env"), "fixture-only");
  await writeFile(path.join(source, "node_modules", "dep.txt"), "generated");
  await writeFile(path.join(f.root, "external", "external.txt"), "outside");
  await symlink(path.join(f.root, "external"), path.join(source, "junction"), "junction");
  const command = [
    "if (Test-Path 'src/nested/.env') { exit 11 }",
    "if (Test-Path 'src/node_modules/dep.txt') { exit 12 }",
    "if (Test-Path 'src/junction/external.txt') { exit 13 }",
    "if (@(Get-ChildItem 'src' -File -Recurse -Force).Count -ne 73) { exit 14 }",
    "Get-Content 'src/nested/probe.txt'",
  ].join("\n");
  const executions = [];
  for (const [index, sandbox_directories] of [["src", "src/nested"], ["src/nested", "src"]].entries()) {
    const intent = await f.intent(`sandbox-source-tree-${index}`, command, {
      sandbox_paths: ["src/source-0.txt"], sandbox_directories,
    });
    const completed = await f.controller.execute(intent);
    assert.equal(completed.state.status, "COMPLETED", JSON.stringify(completed.command));
    const result = JSON.parse(completed.receipts[0].evidence.content[0].text);
    assert.equal(result.stdout.trim(), "nested-source");
    assert.equal(result.input_file_count, 73);
    executions.push(result.input_manifest_sha256);
  }
  assert.equal(executions[0], executions[1]);
});

for (const loseFirstShellResponse of [false, true]) {
  test(`Pi repairs a real Windows build in one grant (${loseFirstShellResponse ? "reconciled" : "direct"} receipt)`, platform, async t => {
    const f = await fixture(t, { allowRepair: true, loseFirstShellResponse });
    const broken = "class Probe { static int Main() { return MissingValue; } }";
    const fixed = "class Probe { static int Main() { return 0; } }";
    await mkdir(path.join(f.context.root, "code"));
    await writeFile(path.join(f.context.root, "code", "probe.cs"), broken);
    const input = { cwd: "code", sandbox_paths: ["code/probe.cs"], command: [
      `$compiler = [IO.Path]::Combine($env:WINDIR, 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe')`,
      "& $compiler /nologo /out:probe.exe probe.cs",
      "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
      "& ([IO.Path]::GetFullPath('probe.exe'))",
    ].join("\n") };
    const plan = await f.intent("native-build-repair", [
      { step_id: "build", capability: shellCapability, input, on_failure: ["repair", "rebuild"] },
      { step_id: "repair", capability: "filesystem.patch", depends_on: ["build"],
        input: { path: "code/probe.cs", oldText: broken, newText: fixed,
          expectedSha256: createHash("sha256").update(broken).digest("hex") } },
      { step_id: "rebuild", capability: shellCapability, input, depends_on: ["repair"] },
    ]);
    const completed = await f.controller.execute(plan);
    assert.equal(completed.state.status, "COMPLETED", JSON.stringify(completed.command));
    assert.deepEqual(completed.state.recovery.recovered_steps, ["build"]);
    assert.deepEqual(completed.state.completed_steps, ["repair", "rebuild"]);
    const operations = await f.journal.readExecutionProjections();
    const failure = operations.find(event => event.execution_projection.command.type === "shell_recovery_scheduled");
    assert.equal(failure.execution_projection.command.receipt.kind, loseFirstShellResponse ? "reconciled_facts" : "tool_response");
    const replay = await f.controller.execute(plan);
    assert.equal(replay.state.operation_id, completed.state.operation_id);
    assert.equal(f.dispatches(), 3);
    assert.equal(await readFile(path.join(f.context.root, "code", "probe.cs"), "utf8"), fixed);
    await assert.rejects(readFile(path.join(f.context.root, "code", "probe.exe")), { code: "ENOENT" });
    assert.equal((await f.journal.status()).health, "healthy");
  });
}

test("fixed isolated verification rejects host suites and invalid workspace contexts before staging", async () => {
  const context = { root: path.resolve("."), workspace_type: "isolated_worktree",
    workstream_state: "active", lifecycle_state: "active", healthy: true, mutation_allowed: true };
  const plan = fixedIsolatedVerificationPlan(FIXED_ISOLATED_SUITE, context);
  assert.deepEqual(plan.sandbox_paths, FIXED_ISOLATED_SOURCE_PATHS);
  assert.deepEqual(plan.sandbox_directories, []);
  assert.deepEqual(plan.output_paths, []);
  assert.equal(plan.toolchain, "node");
  assert.equal(plan.fixedHermeticCore, true);
  assert.equal(plan.timeoutMs, 120_000);
  const manifestPlan = fixedIsolatedVerificationPlan(FIXED_MANIFEST_SUITE, context);
  assert.deepEqual(manifestPlan.sandbox_paths, FIXED_MANIFEST_SOURCE_PATHS);
  assert.equal(manifestPlan.fixedHermeticCore, false);
  assert.equal(manifestPlan.fixedVerificationManifest, true);
  assert.deepEqual(manifestPlan.output_paths, []);
  for (const suite of ["mcp_pi_postseal", "affected", "all", "mcp; whoami"]) {
    await assert.rejects(runFixedIsolatedVerification({ suite, context,
      prepare: () => assert.fail("must not stage a rejected suite") }), { code: "ISOLATED_VERIFICATION_REQUIRED" });
  }
  for (const invalid of [{ workspace_type: "shared" }, { healthy: false },
    { lifecycle_state: "closed" }, { workstream_state: "closed" }, { mutation_allowed: false }]) {
    await assert.rejects(runFixedIsolatedVerification({ suite: FIXED_ISOLATED_SUITE, context: { ...context, ...invalid },
      prepare: () => assert.fail("must not stage a rejected workspace") }), { code: "ISOLATED_WORKSPACE_REQUIRED" });
  }
});

test("fixed hermetic suite executes its real five-file closure in Windows AppContainer", { ...platform, timeout: 180_000 }, async t => {
  const f = await fixture(t);
  const original = new Map();
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    const bytes = await readFile(new URL("../../" + file, import.meta.url));
    original.set(file, bytes);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const result = await runFixedIsolatedVerification({ suite: FIXED_ISOLATED_SUITE, context: f.context });
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.exit_code, 0);
  assert.equal(result.input_file_count, 5);
  assert.equal(result.execution_mode, "fixed_node");
  assert.equal(result.workspace_writes, false);
  assert.equal(result.cleanup_pending, false);
  assert.match(result.input_manifest_sha256, /^[a-f0-9]{64}$/u);
  for (const [file, bytes] of original) assert.deepEqual(await readFile(path.join(f.context.root, file)), bytes);

  // The fixed entrypoint must propagate a real test failure without host writes.
  const entry = path.join(f.context.root, FIXED_ISOLATED_SOURCE_PATHS[0]);
  await writeFile(entry, 'import "node:test"; throw new Error("intentional fixed-suite failure");\n');
  const failure = await runFixedIsolatedVerification({ suite: FIXED_ISOLATED_SUITE, context: f.context });
  assert.equal(failure.passed, false, JSON.stringify(failure));
  assert.notEqual(failure.exit_code, 0);
  assert.equal(failure.workspace_writes, false);
});

test("fixed hermetic suite denies host files, toolchain writes and host loopback in Windows AppContainer", { ...platform, timeout: 180_000 }, async t => {
  const f = await fixture(t);
  const outside = path.join(f.root, "host-only.txt");
  await writeFile(outside, "host-fixture");
  const protectedEnv = "NEXA_FIXED_ISOLATION_TEST_HOST_ONLY";
  process.env[protectedEnv] = "host-fixture";
  t.after(() => { delete process.env[protectedEnv]; });
  let connected = false;
  const listener = createServer(socket => { connected = true; socket.destroy(); });
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  t.after(() => new Promise(resolve => listener.close(resolve)));
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL("../../" + file, import.meta.url)));
  }
  const entry = path.join(f.context.root, FIXED_ISOLATED_SOURCE_PATHS[0]);
  // Only synthetic fixture inputs are used. Exercise the real fixed Node
  // route; successful access to any protected resource makes the test fail.
  const probe = [
    'import assert from "node:assert/strict";',
    'import { readFile, writeFile } from "node:fs/promises";',
    'import { createConnection } from "node:net";',
    'import path from "node:path";',
    `const host = ${JSON.stringify(outside)};`,
    `assert.equal(process.env[${JSON.stringify(protectedEnv)}], undefined);`,
    'const denied = error => ["EACCES", "EPERM", "ENOENT"].includes(error?.code);',
    'await assert.rejects(readFile(host, "utf8"), denied);',
    'await assert.rejects(writeFile(host, "unexpected"), denied);',
    'await assert.rejects(writeFile(path.join(path.dirname(process.execPath), "fixture-forbidden.txt"), "unexpected", { flag: "wx" }), denied);',
    // Windows can redirect TEMP to an uncreated package-specific directory.
    // Use the explicit staged workspace for the positive write control instead.
    'const guestFile = path.join(process.env.NEXA_SANDBOX_WORK, "guest-only.txt");',
    'await writeFile(guestFile, "allowed", { flag: "wx" });',
    'assert.equal(await readFile(guestFile, "utf8"), "allowed");',
    `await new Promise((resolve, reject) => { const socket = createConnection({ host: "127.0.0.1", port: ${listener.address().port} }); socket.once("connect", () => { socket.destroy(); reject(new Error("host loopback allowed")); }); socket.once("error", resolve); socket.setTimeout(5000, () => { socket.destroy(); resolve(); }); });`,
    'console.log("FIXED_ISOLATION_NEGATIVE_PROBE_PASS");',
  ].join("\n");
  await writeFile(entry, probe);
  const result = await runFixedIsolatedVerification({ suite: FIXED_ISOLATED_SUITE, context: f.context });
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.match(result.stdout, /FIXED_ISOLATION_NEGATIVE_PROBE_PASS/u);
  assert.equal(result.exit_code, 0);
  assert.equal(result.input_file_count, 5);
  assert.equal(result.workspace_writes, false);
  assert.equal(result.cleanup_pending, false);
  assert.equal(result.job_terminated, true);
  assert.equal(connected, false);
  assert.equal(await readFile(outside, "utf8"), "host-fixture");
  assert.equal(await readFile(entry, "utf8"), probe);
});

test("fixed hermetic suite times out a running guest and verifies resource cleanup", { ...platform, timeout: 120_000 }, async t => {
  const f = await fixture(t);
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL("../../" + file, import.meta.url)));
  }
  const entry = path.join(f.context.root, FIXED_ISOLATED_SOURCE_PATHS[0]);
  const source = 'console.log("GUEST_ENTERED_TIMEOUT_FIXTURE"); setInterval(() => {}, 1000);';
  await writeFile(entry, source);
  const prepared = await prepareAppContainerPowerShell({
    context: f.context, cwd: f.context.root, command: "fixed-verification-timeout-fixture",
    timeoutMs: 5000, sandbox_paths: FIXED_ISOLATED_SOURCE_PATHS,
    sandbox_directories: [], output_paths: [], toolchain: "node", fixedHermeticCore: true,
  });
  try {
    const result = await prepared.run();
    assert.equal(result.timed_out, true, JSON.stringify(result));
    assert.equal(result.execution_ok, false);
    assert.equal(result.job_terminated, true);
    assert.equal(result.workspace_writes, false);
    assert.equal(result.exit_code, null);
    assert.match(result.stdout, /GUEST_ENTERED_TIMEOUT_FIXTURE/u);
    assert.equal(await readFile(entry, "utf8"), source);
  } finally {
    await prepared.cleanup();
  }
});

test("fixed isolated verification rejects incomplete or changed evidence and always cleans staging", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexa-fixed-receipt-test-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5 }));
  const context = { root, workspace_type: "isolated_worktree", workstream_state: "active",
    lifecycle_state: "active", healthy: true, mutation_allowed: true };
  const entries = [];
  const hash = value => createHash("sha256").update(value).digest("hex");
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const bytes = Buffer.from("// isolated receipt fixture: " + file + "\n");
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    entries.push({ path: file, sha256: hash(bytes), bytes: bytes.length });
  }
  const manifest = { input_manifest_sha256: hash(JSON.stringify(entries)),
    input_file_count: entries.length };
  const valid = { ...manifest, isolation_mode: "appcontainer", execution_mode: "fixed_node", workspace_writes: false,
    job_terminated: true, artifacts: [], toolchain: "node", execution_ok: true,
    ok: true, exit_code: 0, timed_out: false, duration_ms: 1, stdout: "", stderr: "" };
  const execute = async ({ staged = manifest, receipt = valid, run, cleanupError } = {}) => {
    const calls = { run: 0, cleanup: 0 };
    let value, error;
    try {
      value = await runFixedIsolatedVerification({ suite: FIXED_ISOLATED_SUITE, context,
        prepare: async () => ({
          manifest: staged,
          run: async () => { calls.run++; return run ? run() : receipt; },
          cleanup: async () => { calls.cleanup++; if (cleanupError) throw cleanupError; },
        }) });
    } catch (caught) { error = caught; }
    assert.equal(calls.cleanup, 1);
    return { value, error, calls };
  };
  const good = await execute();
  assert.equal(good.error, undefined);
  assert.equal(good.value.passed, true);
  const mismatch = await execute({ staged: { ...manifest, input_manifest_sha256: "0".repeat(64) } });
  assert.equal(mismatch.calls.run, 0);
  assert.equal(mismatch.error?.code, "ISOLATED_VERIFICATION_INPUT_CHANGED");
  for (const patch of [{ job_terminated: false }, { workspace_writes: true },
    { input_file_count: 4 }, { input_manifest_sha256: "0".repeat(64) },
    { isolation_mode: "host" }, { execution_mode: "powershell" }, { artifacts: { length: 0 } },
    { artifacts: [{ path: "unexpected.txt" }] },
    { toolchain: "unknown" }]) {
    const bad = await execute({ receipt: { ...valid, ...patch } });
    assert.equal(bad.error?.code, "INVALID_ISOLATED_VERIFICATION_RECEIPT");
  }
  const failed = await execute({ receipt: { ...valid, ok: false, exit_code: 1 } });
  assert.equal(failed.value.passed, false);
  const cleanup = await execute({ cleanupError: new Error("fixture cleanup failed") });
  assert.equal(cleanup.error?.message, "fixture cleanup failed");
  const changed = await execute({ run: async () => {
    await writeFile(path.join(root, FIXED_ISOLATED_SOURCE_PATHS[0]), "// changed after staging\n");
    return valid;
  } });
  assert.equal(changed.error?.code, "ISOLATED_VERIFICATION_INPUT_CHANGED");
});

test("fixed isolated verification records real scoped dispatcher and Journal evidence", { ...platform, timeout: 180_000 }, async t => {
  const f = await fixture(t);
  const git = (...args) => execFileSync("git.exe", args, { cwd: f.context.root, encoding: "utf8", windowsHide: true }).trim();
  git("init");
  git("config", "user.name", "Nexa CI");
  git("config", "user.email", "nexa-ci@example.invalid");
  git("config", "core.autocrlf", "false");
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL("../../" + file, import.meta.url)));
  }
  git("add", "--", ...FIXED_ISOLATED_SOURCE_PATHS);
  git("commit", "-m", "test: fixed verification fixture");
  const head = git("rev-parse", "HEAD");
  const context = { ...f.context, current_head: head, base_head: head, branch: git("branch", "--show-current") };
  // Exercise only the scope selector in this CI process. No grant files or
  // protected host state are created, opened, or changed by the fixture.
  const previous = process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles;
  assert.ok(programFiles);
  process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT = path.join(programFiles, "WriterWorkbench-PiMaintenance-v3", "grants");
  t.after(() => {
    if (previous === undefined) delete process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
    else process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT = previous;
  });
  const resultPath = path.join(f.root, "fixed-verification.last.json");
  const run = createDevTestRunner({
    workspaceContextResolver: async () => context,
    lockPath: path.join(f.root, "fixed-verification.lock"),
    resultPath,
    journal: { begin: f.journal.begin, complete: f.journal.complete, fail: f.journal.fail, markDegraded: f.journal.markDegraded },
  });
  await assert.rejects(run({ suite: "all", workspace_id: context.workspace_id }), { code: "ISOLATED_VERIFICATION_REQUIRED" });
  const result = await run({ suite: FIXED_ISOLATED_SUITE, workspace_id: context.workspace_id });
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.head, head);
  assert.equal(result.post_snapshot_verified, true);
  assert.equal(result.verification_manifest.gate_result, "passed");
  assert.deepEqual(result.verification_manifest.tests_selected, [FIXED_ISOLATED_SUITE]);
  assert.equal(result.verification_manifest.isolation_evidence.execution_mode, "fixed_node");
  assert.equal(result.verification_manifest.isolation_evidence.post_snapshot_verified, true);
  assert.match(result.operation_id, /^dev_operation_[a-f0-9]{32}$/u);
  const persisted = JSON.parse(await readFile(resultPath, "utf8"));
  assert.deepEqual(persisted.verification_manifest, result.verification_manifest);
  assert.equal(persisted.verification_manifest_sha256, result.verification_manifest_sha256);
  assert.equal((await f.journal.status()).health, "healthy");
  assert.equal(git("status", "--porcelain"), "");
});


// Feasibility only: use the existing, explicitly granted disposable workspace
// shell fixture, not the fixed five-file verification capability. No change
// to production suite membership, privilege or verification evidence.
test("R16 existing AppContainer executes real verification manifest regression", { ...platform, timeout: 180_000 }, async t => {
  const paths = [
    "tests/mcp/mcp-verification-manifest.test.mjs",
    "server/src/mcp-verification-manifest.mjs",
    "server/src/mcp-verification-failure-classifier.mjs",
  ];
  const command = [
    "& node.exe tests/mcp/mcp-verification-manifest.test.mjs",
    "exit $LASTEXITCODE",
  ].join("\n");
  async function run(failFixture) {
    const f = await fixture(t);
    const manifest = [];
    for (const file of paths) {
      const bytes = await readFile(new URL("../../" + file, import.meta.url));
      const staged = failFixture && file === paths[0]
        ? Buffer.concat([bytes, Buffer.from('\n;test("R16 deliberate failure",()=>assert.fail("R16 deliberate failure"));\n')])
        : bytes;
      const target = path.join(f.context.root, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, staged);
      manifest.push({ path: file, sha256: createHash("sha256").update(staged).digest("hex"), bytes: staged.length });
    }
    const result = await f.controller.execute(await f.intent(
      failFixture ? "r16-real-manifest-failure" : "r16-real-manifest-success", command,
      { toolchain: "node", sandbox_paths: paths, timeoutMs: 60_000 }));
    const receipt = failFixture ? result.command?.receipt : result.receipts?.[0];
    assert.equal(result.state.status, failFixture ? "DECISION_REQUIRED" : "COMPLETED", JSON.stringify(result.command));
    const evidence = JSON.parse(receipt.evidence.content[0].text);
    assert.equal(evidence.isolation_mode, "appcontainer");
    assert.equal(evidence.input_file_count, paths.length);
    assert.equal(evidence.input_manifest_sha256, createHash("sha256").update(JSON.stringify(manifest)).digest("hex"));
    assert.equal(evidence.job_terminated, true);
    assert.equal(evidence.workspace_writes, false);
    assert.equal(evidence.timed_out, false);
    assert.equal(evidence.exit_code, failFixture ? 1 : 0);
    assert.match(evidence.stdout, /fixed AppContainer development evidence is complete and fail-closed/u);
    // Node 24 defaults to the spec reporter in this non-TTY fixture;
    // accept the explicit counts in either supported reporter format.
    assert.match(evidence.stdout, failFixture ? /(?:#|ℹ) fail 1\b/u : /(?:#|ℹ) fail 0\b/u);
    assert.match(evidence.stdout, /(?:#|ℹ) pass 11\b/u);
    assert.match(evidence.stdout, failFixture ? /(?:#|ℹ) tests 12\b/u : /(?:#|ℹ) tests 11\b/u);
    assert.match(evidence.stdout, /(?:#|ℹ) skipped 0\b/u);
    if (failFixture) assert.match(evidence.stdout, /R16 deliberate failure/u);
    for (const entry of manifest)
      assert.equal(createHash("sha256").update(await readFile(path.join(f.context.root, entry.path))).digest("hex"), entry.sha256);
    assert.equal((await f.journal.status()).health, "healthy");
  }
  await run(false);
  await run(true);
});


test("R16 fixed manifest suite executes native scoped verification with durable evidence", { ...platform, timeout: 180_000 }, async t => {
  const f = await fixture(t);
  const git = (...args) => execFileSync("git.exe", args, { cwd: f.context.root, encoding: "utf8", windowsHide: true }).trim();
  git("init"); git("config", "user.name", "Nexa CI"); git("config", "user.email", "nexa-ci@example.invalid");
  git("config", "core.autocrlf", "false");
  for (const file of FIXED_MANIFEST_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL("../../" + file, import.meta.url)));
  }
  git("add", "--", ...FIXED_MANIFEST_SOURCE_PATHS);
  git("commit", "-m", "test: fixed manifest fixture");
  const head = git("rev-parse", "HEAD");
  const context = { ...f.context, current_head: head, base_head: head, branch: git("branch", "--show-current") };
  const previous = process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles;
  assert.ok(programFiles);
  process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT = path.join(programFiles, "WriterWorkbench-PiMaintenance-v3", "grants");
  t.after(() => {
    if (previous === undefined) delete process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
    else process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT = previous;
  });
  const resultPath = path.join(f.root, "fixed-manifest.last.json");
  const run = createDevTestRunner({ workspaceContextResolver: async () => context,
    lockPath: path.join(f.root, "fixed-manifest.lock"), resultPath,
    journal: { begin: f.journal.begin, complete: f.journal.complete, fail: f.journal.fail, markDegraded: f.journal.markDegraded } });
  const good = await run({ suite: FIXED_MANIFEST_SUITE, workspace_id: context.workspace_id });
  assert.equal(good.passed, true, JSON.stringify(good));
  assert.equal(good.exit_code, 0);
  assert.equal(good.input_file_count, 3);
  assert.equal(good.post_snapshot_verified, true);
  assert.equal(good.verification_manifest.gate_result, "passed");
  assert.deepEqual(good.verification_manifest.tests_selected, [FIXED_MANIFEST_SUITE]);
  assert.equal(good.verification_manifest.isolation_evidence.execution_mode, "fixed_node");
  assert.match(good.stdout, /(?:#|ℹ) pass 11\b/u);
  assert.equal(git("status", "--porcelain"), "");
  const target = path.join(f.context.root, FIXED_MANIFEST_SOURCE_PATHS[0]);
  const body = await readFile(target, "utf8");
  const changed = body+'\n;test("R16 native deliberate failure",()=>assert.fail("R16 deliberate failure"));\n';
  await writeFile(target, changed);
  const failed = await run({ suite: FIXED_MANIFEST_SUITE, workspace_id: context.workspace_id });
  assert.equal(failed.passed, false, JSON.stringify(failed));
  assert.equal(failed.exit_code, 1);
  assert.equal(failed.post_snapshot_verified, true);
  assert.equal(failed.verification_manifest.gate_result, "failed");
  assert.equal(failed.verification_manifest.isolation_evidence.input_file_count, 3);
  assert.equal(failed.head, head);
  assert.notEqual(failed.workspace_snapshot_id, good.workspace_snapshot_id);
  assert.match(failed.stdout, /(?:#|ℹ) fail 1\b/u);
  assert.equal(JSON.parse(await readFile(resultPath, "utf8")).verification_manifest.gate_result, "failed");
  assert.equal((await f.journal.status()).health, "healthy");
  assert.equal(await readFile(target, "utf8"), changed);
});


// Same protected direct Node runner and exact three-file closure in an
// actual limited Session 0 account; no Git or host state dependency.
test("R16 fixed manifest suite executes direct native runner with station lease", { ...platform, timeout: 180_000 }, async t => {
  const f = await fixture(t);
  const originals = new Map();
  for (const file of FIXED_MANIFEST_SOURCE_PATHS) {
    const target = path.join(f.context.root, file);
    const bytes = await readFile(new URL("../../" + file, import.meta.url));
    originals.set(target, bytes);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const good = await runFixedIsolatedVerification({ suite: FIXED_MANIFEST_SUITE, context: f.context });
  assert.equal(good.passed, true, JSON.stringify(good));
  assert.equal(good.exit_code, 0);
  assert.equal(good.input_file_count, 3);
  assert.equal(good.cleanup_pending, false);
  assert.equal(good.job_terminated, true);
  assert.equal(good.workspace_writes, false);
  assert.match(good.stdout, /(?:#|ℹ) pass 11\b/u);
  for (const [file, bytes] of originals) assert.deepEqual(await readFile(file), bytes);
  const entry = path.join(f.context.root, FIXED_MANIFEST_SOURCE_PATHS[0]);
  const changed = (await readFile(entry, "utf8"))+'\n;test("R16 station deliberate failure",()=>assert.fail("R16 deliberate failure"));\n';
  await writeFile(entry, changed);
  const failure = await runFixedIsolatedVerification({ suite: FIXED_MANIFEST_SUITE, context: f.context });
  assert.equal(failure.passed, false, JSON.stringify(failure));
  assert.equal(failure.exit_code, 1);
  assert.equal(failure.cleanup_pending, false);
  assert.equal(failure.job_terminated, true);
  assert.equal(failure.workspace_writes, false);
  assert.equal(failure.input_file_count, 3);
  assert.notEqual(failure.input_manifest_sha256, good.input_manifest_sha256);
  assert.match(failure.stdout, /(?:#|ℹ) fail 1\b/u);
  assert.equal(await readFile(entry, "utf8"), changed);
});
