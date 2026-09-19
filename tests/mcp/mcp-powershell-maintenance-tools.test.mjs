import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  POWERSHELL_MAINTENANCE_OUTPUT_MAX_CHARACTERS,
  assertPowerShellMaintenanceCommandAllowed,
  createPowerShellMaintenanceTool,
  runPowerShellProcess,
  runPowerShellViaAdminTask,
} from "../../server/src/mcp-powershell-maintenance-tools.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

for (const command of [
  "Format-Volume -DriveLetter C",
  "Clear-Disk -Number 0 -RemoveData",
  "shutdown.exe /s /t 0",
  "Set-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System -Name EnableLUA -Value 0",
  "Remove-Item C:\\Windows\\System32 -Recurse -Force",
  "Set-MpPreference -DisableRealtimeMonitoring $true",
]) {
  assert.throws(
    () => assertPowerShellMaintenanceCommandAllowed(command),
    /rejected|forbidden|outside/iu,
    command,
  );
}

for (const command of [
  "Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue",
  "Get-Process cloudflared -ErrorAction SilentlyContinue",
  "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force",
  "Get-Item .\\node_modules -ErrorAction SilentlyContinue | Select-Object LinkType,Target",
]) {
  assert.doesNotThrow(() => assertPowerShellMaintenanceCommandAllowed(command), command);
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ww-powershell-maintenance-"));
try {
  const journalEvents = [];
  const fakeJournal = {
    async begin(input) {
      journalEvents.push({ stage: "begin", input });
      return { operation_id: "dev_operation_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    },
    async complete(operationId, input) {
      journalEvents.push({ stage: "complete", operationId, input });
    },
    async fail(operationId, input) {
      journalEvents.push({ stage: "fail", operationId, input });
    },
    async degrade(reason) {
      journalEvents.push({ stage: "degrade", reason });
    },
  };
  const fakeContextResolver = async () => ({
    root: tempRoot,
    workstream_id: "dev_workstream_test",
    workspace_id: "dev_workspace_shared_repository_v1",
    workspace_type: "shared",
    branch: "main",
    base_head: "0".repeat(40),
    current_head: "0".repeat(40),
  });
  const fakeExecutor = async ({ command, cwd, timeoutMs }) => ({
    elevated: true,
    execution_ok: true,
    ok: true,
    command_sha256: "b".repeat(64),
    cwd,
    timeout_ms: timeoutMs,
    exit_code: 0,
    signal: null,
    timed_out: false,
    duration_ms: 5,
    stdout: "fake-admin-ok",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
  });

  const fakeAdminTool = createPowerShellMaintenanceTool({
    elevated: true,
    platform: "win32",
    workspaceContextResolver: fakeContextResolver,
    executor: fakeExecutor,
    journalApi: fakeJournal,
  });
  const fakeAdminResult = await fakeAdminTool({
    command: "Get-Process",
    cwd: ".",
    timeoutMs: 5_000,
  });
  assert.equal(fakeAdminResult.ok, true);
  assert.equal(fakeAdminResult.elevated, true);
  assert.equal(journalEvents[0].input.operation_type, "powershell_admin_maintenance");
  assert.equal(journalEvents[0].input.tool_name, "powershell_admin_run");
  assert.equal("command" in journalEvents[0].input.result, false);
  assert.match(journalEvents[0].input.result.command_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(journalEvents.at(-1).stage, "complete");

  await assert.rejects(
    () => fakeAdminTool({ command: "Get-Process", cwd: ".." }),
    /inside the selected Writer Workbench workspace/iu,
  );

  if (process.platform === "win32") {
    const normal = await runPowerShellProcess({
      command: "Write-Output 'normal-powershell-ok'",
      cwd: rootDir,
      timeoutMs: 5_000,
    });
    assert.equal(normal.execution_ok, true, normal.stderr);
    assert.equal(normal.ok, true, normal.stderr);
    assert.match(normal.stdout, /normal-powershell-ok/u);

    const oversized = await runPowerShellProcess({
      command: "Write-Output ('x' * 70000)",
      cwd: rootDir,
      timeoutMs: 5_000,
    });
    assert.equal(oversized.execution_ok, true, oversized.stderr);
    assert.equal(oversized.stdout_truncated, true);
    assert(oversized.stdout.length <= POWERSHELL_MAINTENANCE_OUTPUT_MAX_CHARACTERS + 80);

    const timed = await runPowerShellProcess({
      command: "Start-Sleep -Seconds 3",
      cwd: rootDir,
      timeoutMs: 1_000,
    });
    assert.equal(timed.timed_out, true);

    const fakeStateRoot = path.join(tempRoot, "fake-admin-state");
    const fakeSpawnSync = (executable, args) => {
      assert.equal(executable, "schtasks.exe");
      if (args[0] === "/Query") return { status: 0, stdout: "ready", stderr: "" };
      if (args[0] === "/Run") {
        const requestsDir = path.join(fakeStateRoot, "requests");
        const requestName = readdirSync(requestsDir).find((name) => name.endsWith(".request.json"));
        assert(requestName);
        const request = JSON.parse(readFileSync(path.join(requestsDir, requestName), "utf8"));
        const resultPath = path.join(fakeStateRoot, "results", `${request.request_id}.result.json`);
        writeFileSync(resultPath, JSON.stringify({
          schema_version: 1,
          request_id: request.request_id,
          execution_ok: true,
          exit_code: 0,
          timed_out: false,
          duration_ms: 7,
          stdout: "fake-scheduled-task-ok",
          stderr: "",
          stdout_truncated: false,
          stderr_truncated: false,
          reason: null,
        }));
        return { status: 0, stdout: "started", stderr: "" };
      }
      throw new Error(`unexpected schtasks argv: ${args.join(" ")}`);
    };
    const scheduled = await runPowerShellViaAdminTask({
      command: "Get-Process",
      cwd: rootDir,
      timeoutMs: 5_000,
      stateRoot: fakeStateRoot,
      spawnSyncImpl: fakeSpawnSync,
    });
    assert.equal(scheduled.ok, true);
    assert.equal(scheduled.elevated, true);
    assert.match(scheduled.stdout, /fake-scheduled-task-ok/u);

    const sidResult = spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(sidResult.status, 0, sidResult.stderr);
    const sid = sidResult.stdout.trim();
    assert.match(sid, /^S-1-/u);

    const runnerStateRoot = path.join(tempRoot, "runner-state");
    await mkdir(path.join(runnerStateRoot, "requests"), { recursive: true });
    await mkdir(path.join(runnerStateRoot, "results"), { recursive: true });
    const configPath = path.join(tempRoot, "runner-config.json");
    await writeFile(configPath, JSON.stringify({
      schema_version: 1,
      expected_user_sid: sid,
      request_root: runnerStateRoot,
      allowed_roots: [rootDir],
    }), "utf8");
    const requestId = "c".repeat(32);
    await writeFile(
      path.join(runnerStateRoot, "requests", `${requestId}.request.json`),
      JSON.stringify({
        schema_version: 1,
        request_id: requestId,
        command: "Write-Output 'admin-runner-path-ok'",
        cwd: rootDir,
        timeout_ms: 5_000,
      }),
      "utf8",
    );

    const runnerPath = path.join(rootDir, "scripts", "mcp-powershell-admin-runner.ps1");
    const runner = spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", runnerPath, "-ConfigPath", configPath],
      { cwd: rootDir, encoding: "utf8", windowsHide: true, timeout: 15_000 },
    );
    assert.equal(runner.status, 0, runner.stderr);
    const runnerResult = JSON.parse(await readFile(
      path.join(runnerStateRoot, "results", `${requestId}.result.json`),
      "utf8",
    ));
    assert.equal(runnerResult.execution_ok, true, runnerResult.stderr);
    assert.equal(runnerResult.exit_code, 0, runnerResult.stderr);
    assert.match(runnerResult.stdout, /admin-runner-path-ok/u);
  }

  const registrationScript = await readFile(
    path.join(rootDir, "scripts", "register-mcp-powershell-admin-runner.ps1"),
    "utf8",
  );
  assert.match(registrationScript, /RunLevel Highest/u);
  assert.match(registrationScript, /ProgramData/u);
  assert.match(registrationScript, /icacls\.exe/u);
  assert.match(registrationScript, /\(OI\)\(CI\)RX/u);
  assert.match(registrationScript, /foreach \(\$protectedFile in @\(\$protectedRunner, \$configPath\)\)/u);
  assert.match(registrationScript, /\*S-1-5-18:F/u);
  assert.match(registrationScript, /\*S-1-5-32-544:F/u);
  assert.match(registrationScript, /\$\(\$identity\.User\.Value\):RX/u);
  assert.doesNotMatch(registrationScript, /\$protectedRoot[^\r\n]*\/T\b/u);
  assert.match(registrationScript, /LogonType Interactive/u);
  assert.doesNotMatch(registrationScript, /EnableLUA|ConsentPromptBehaviorAdmin|PromptOnSecureDesktop/u);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("PowerShell maintenance tool tests passed.");
