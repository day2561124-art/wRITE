import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  controlledProcessEnvironment,
  createBoundedOutputCollector,
  redactProcessOutput,
  terminateProcessTree,
} from "./process-control.mjs";
import { workspaceExecutionProvenance } from "./mcp-development-readonly-tools.mjs";
import { resolveDevWorkspaceExecutionContext } from "./mcp-development-workstream-tools.mjs";
import {
  beginDevJournalOperation,
  completeDevJournalOperation,
  failDevJournalOperation,
  markDevJournalDegraded,
} from "./mcp-development-journal-tools.mjs";

export const POWERSHELL_MAINTENANCE_COMMAND_MAX_CHARACTERS = 32 * 1024;
export const POWERSHELL_MAINTENANCE_OUTPUT_MAX_CHARACTERS = 64 * 1024;
export const POWERSHELL_MAINTENANCE_DEFAULT_TIMEOUT_MS = 30_000;
export const POWERSHELL_MAINTENANCE_MAX_TIMEOUT_MS = 120_000;
export const POWERSHELL_ADMIN_TASK_NAME = "WriterWorkbench-PowerShellAdminRunner";

const ADMIN_RESULT_STARTUP_GRACE_MS = 20_000;
const ADMIN_RESULT_POLL_MS = 125;

const blockedCommandPatterns = Object.freeze([
  {
    pattern: /\b(?:Format-Volume|Clear-Disk|Initialize-Disk|Remove-Partition|New-Partition|Set-Partition|diskpart(?:\.exe)?|bcdedit(?:\.exe)?|bootrec(?:\.exe)?)\b/iu,
    reason: "disk, partition, or boot configuration mutation is outside the maintenance channel",
  },
  {
    pattern: /\b(?:shutdown(?:\.exe)?|Stop-Computer|Restart-Computer|Remove-Computer)\b/iu,
    reason: "machine shutdown/restart/domain-removal commands are outside the maintenance channel",
  },
  {
    pattern: /\b(?:Disable-WindowsOptionalFeature|Uninstall-WindowsFeature|Remove-WindowsFeature)\b/iu,
    reason: "system feature removal is outside the maintenance channel",
  },
  {
    pattern: /\b(?:sc(?:\.exe)?\s+delete|Unregister-ScheduledTask)\b/iu,
    reason: "arbitrary service or scheduled-task deletion is outside the maintenance channel",
  },
  {
    pattern: /\bschtasks(?:\.exe)?\b[^\r\n;|]*\/Delete\b/iu,
    reason: "arbitrary scheduled-task deletion is outside the maintenance channel",
  },
  {
    pattern: /\breg(?:\.exe)?\s+delete\s+(?:HKLM|HKEY_LOCAL_MACHINE|HKCR|HKEY_CLASSES_ROOT|HKU|HKEY_USERS)\b/iu,
    reason: "machine-wide registry deletion is outside the maintenance channel",
  },
  {
    pattern: /\b(?:Set-ItemProperty|New-ItemProperty|reg(?:\.exe)?\s+add)\b[^\r\n;|]*\bEnableLUA\b/iu,
    reason: "changing Windows UAC policy is forbidden",
  },
  {
    pattern: /\b(?:Set-MpPreference|Add-MpPreference)\b[^\r\n;|]*(?:DisableRealtimeMonitoring|ExclusionPath|ExclusionProcess)/iu,
    reason: "weakening Microsoft Defender is outside the maintenance channel",
  },
  {
    pattern: /\bnetsh(?:\.exe)?\b[^\r\n;|]*advfirewall[^\r\n;|]*\bstate\s+off\b/iu,
    reason: "disabling Windows Firewall is outside the maintenance channel",
  },
  {
    pattern: /\bSet-NetFirewallProfile\b[^\r\n;|]*-Enabled\s+(?:False|\$false)\b/iu,
    reason: "disabling Windows Firewall is outside the maintenance channel",
  },
  {
    pattern: /\b(?:Remove-Item|Clear-Content|Set-Content|Move-Item|Rename-Item|del|erase|rd|rmdir)\b[^\r\n;|]*(?:[A-Za-z]:\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:\\|\b)|\\\\\.\\PhysicalDrive\d+|HKLM:|HKCR:|HKU:)/iu,
    reason: "destructive mutation of protected system roots is outside the maintenance channel",
  },
  {
    pattern: /\b(?:takeown(?:\.exe)?|icacls(?:\.exe)?)\b[^\r\n;|]*[A-Za-z]:\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:\\|\b)/iu,
    reason: "ownership/ACL mutation of protected system roots is outside the maintenance channel",
  },
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function normalizeTimeoutMs(value) {
  if (value === undefined || value === null) return POWERSHELL_MAINTENANCE_DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(value) || value < 1_000 || value > POWERSHELL_MAINTENANCE_MAX_TIMEOUT_MS) {
    throw new Error(`timeoutMs must be an integer from 1000 to ${POWERSHELL_MAINTENANCE_MAX_TIMEOUT_MS}.`);
  }
  return value;
}

export function assertPowerShellMaintenanceCommandAllowed(command) {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("command is required.");
  }
  if (Array.from(command).length > POWERSHELL_MAINTENANCE_COMMAND_MAX_CHARACTERS) {
    throw new Error(`command must be at most ${POWERSHELL_MAINTENANCE_COMMAND_MAX_CHARACTERS} characters.`);
  }
  if (command.includes("\u0000")) {
    throw new Error("command must not contain NUL.");
  }
  for (const rule of blockedCommandPatterns) {
    if (rule.pattern.test(command)) {
      throw new Error(`PowerShell maintenance command rejected: ${rule.reason}.`);
    }
  }
}

function isPathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveMaintenanceCwd(root, requestedCwd = ".") {
  if (typeof requestedCwd !== "string" || !requestedCwd.trim()) {
    throw new Error("cwd must be a non-blank workspace-relative path.");
  }
  if (path.isAbsolute(requestedCwd)) {
    throw new Error("cwd must be workspace-relative; absolute paths are not accepted.");
  }
  const resolvedRoot = await realpath(root);
  const candidate = path.resolve(resolvedRoot, requestedCwd);
  if (!isPathInside(candidate, resolvedRoot)) {
    throw new Error("cwd must stay inside the selected Writer Workbench workspace.");
  }
  const resolvedCandidate = await realpath(candidate);
  if (!isPathInside(resolvedCandidate, resolvedRoot)) {
    throw new Error("cwd resolves through a symlink/junction outside the selected Writer Workbench workspace.");
  }
  const info = await lstat(resolvedCandidate);
  if (!info.isDirectory()) throw new Error("cwd must resolve to an existing directory.");
  return resolvedCandidate;
}

function processResultBase({ elevated, command, cwd, timeoutMs, startedAt }) {
  return {
    elevated,
    execution_ok: false,
    ok: false,
    command_sha256: sha256(command),
    cwd,
    timeout_ms: timeoutMs,
    exit_code: null,
    signal: null,
    timed_out: false,
    duration_ms: Math.max(0, Date.now() - startedAt),
    stdout: "",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
  };
}

export async function runPowerShellProcess({
  command,
  cwd,
  timeoutMs,
  spawnImpl = spawn,
} = {}) {
  const startedAt = Date.now();
  const stdoutCollector = createBoundedOutputCollector(POWERSHELL_MAINTENANCE_OUTPUT_MAX_CHARACTERS);
  const stderrCollector = createBoundedOutputCollector(POWERSHELL_MAINTENANCE_OUTPUT_MAX_CHARACTERS);
  let child;
  let timedOut = false;

  try {
    child = spawnImpl(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      {
        cwd,
        env: controlledProcessEnvironment(),
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    return {
      ...processResultBase({ elevated: false, command, cwd, timeoutMs, startedAt }),
      stderr: redactProcessOutput(error?.message ?? String(error)),
    };
  }

  child.stdout?.on("data", (chunk) => stdoutCollector.append(chunk));
  child.stderr?.on("data", (chunk) => stderrCollector.append(chunk));

  const result = await new Promise((resolve) => {
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);
    timer.unref?.();

    child.once("error", (error) => finish({ error }));
    child.once("close", (code, signal) => finish({ code, signal }));
  });

  const stdout = stdoutCollector.finish();
  const stderr = stderrCollector.finish();
  const executionOk = !result.error;
  const exitCode = Number.isInteger(result.code) ? result.code : null;
  return {
    elevated: false,
    execution_ok: executionOk,
    ok: executionOk && !timedOut && exitCode === 0,
    command_sha256: sha256(command),
    cwd,
    timeout_ms: timeoutMs,
    exit_code: exitCode,
    signal: typeof result.signal === "string" ? result.signal : null,
    timed_out: timedOut,
    duration_ms: Math.max(0, Date.now() - startedAt),
    stdout: stdout.text,
    stderr: result.error
      ? redactProcessOutput(`${stderr.text}\n${result.error.message}`.trim())
      : stderr.text,
    stdout_truncated: stdout.truncated,
    stderr_truncated: stderr.truncated,
  };
}

function defaultAdminStateRoot() {
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData) return path.join(localAppData, "WriterWorkbench", "PowerShellMaintenance");
  return path.join(os.homedir(), "AppData", "Local", "WriterWorkbench", "PowerShellMaintenance");
}

function queryScheduledTask(taskName, spawnSyncImpl = spawnSync) {
  const result = spawnSyncImpl(
    "schtasks.exe",
    ["/Query", "/TN", taskName],
    {
      windowsHide: true,
      shell: false,
      encoding: "utf8",
      env: controlledProcessEnvironment(),
    },
  );
  return result.status === 0;
}

async function waitForAdminResult(resultPath, deadline) {
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(resultPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, ADMIN_RESULT_POLL_MS));
  }
  return null;
}

let adminInvocationActive = false;

export async function runPowerShellViaAdminTask({
  command,
  cwd,
  timeoutMs,
  stateRoot = defaultAdminStateRoot(),
  taskName = POWERSHELL_ADMIN_TASK_NAME,
  spawnSyncImpl = spawnSync,
} = {}) {
  const startedAt = Date.now();
  const base = processResultBase({ elevated: true, command, cwd, timeoutMs, startedAt });

  if (adminInvocationActive) {
    return {
      ...base,
      reason: "ADMIN_RUNNER_BUSY",
      stderr: "Another powershell_admin_run invocation is already active in this MCP child.",
    };
  }
  adminInvocationActive = true;

  const requestId = randomUUID().replaceAll("-", "");
  const requestsDir = path.join(stateRoot, "requests");
  const resultsDir = path.join(stateRoot, "results");
  const requestPath = path.join(requestsDir, `${requestId}.request.json`);
  const resultPath = path.join(resultsDir, `${requestId}.result.json`);

  try {
    if (!queryScheduledTask(taskName, spawnSyncImpl)) {
      return {
        ...base,
        reason: "ADMIN_RUNNER_NOT_REGISTERED",
        stderr: "The elevated PowerShell runner is not registered. Run scripts/register-mcp-powershell-admin-runner.ps1 once from an elevated PowerShell window.",
      };
    }

    await mkdir(requestsDir, { recursive: true });
    await mkdir(resultsDir, { recursive: true });
    await writeFile(requestPath, `${JSON.stringify({
      schema_version: 1,
      request_id: requestId,
      command,
      cwd,
      timeout_ms: timeoutMs,
      created_at: new Date().toISOString(),
    })}\n`, { encoding: "utf8", flag: "wx" });

    const runResult = spawnSyncImpl(
      "schtasks.exe",
      ["/Run", "/TN", taskName],
      {
        windowsHide: true,
        shell: false,
        encoding: "utf8",
        env: controlledProcessEnvironment(),
      },
    );
    if (runResult.status !== 0) {
      await rm(requestPath, { force: true }).catch(() => {});
      return {
        ...base,
        reason: "ADMIN_RUNNER_START_FAILED",
        stderr: redactProcessOutput(runResult.stderr || runResult.stdout || "Could not start elevated scheduled task."),
      };
    }

    const payload = await waitForAdminResult(
      resultPath,
      Date.now() + timeoutMs + ADMIN_RESULT_STARTUP_GRACE_MS,
    );
    if (!payload) {
      await rm(requestPath, { force: true }).catch(() => {});
      return {
        ...base,
        reason: "ADMIN_RUNNER_RESULT_TIMEOUT",
        timed_out: true,
        duration_ms: Math.max(0, Date.now() - startedAt),
        stderr: "Elevated runner did not publish a result before the bounded wait expired.",
      };
    }

    return {
      elevated: true,
      execution_ok: payload.execution_ok === true,
      ok: payload.execution_ok === true && payload.timed_out !== true && payload.exit_code === 0,
      command_sha256: sha256(command),
      cwd,
      timeout_ms: timeoutMs,
      exit_code: Number.isInteger(payload.exit_code) ? payload.exit_code : null,
      signal: null,
      timed_out: payload.timed_out === true,
      duration_ms: Number.isFinite(payload.duration_ms)
        ? Math.max(0, payload.duration_ms)
        : Math.max(0, Date.now() - startedAt),
      stdout: redactProcessOutput(payload.stdout ?? ""),
      stderr: redactProcessOutput(payload.stderr ?? ""),
      stdout_truncated: payload.stdout_truncated === true,
      stderr_truncated: payload.stderr_truncated === true,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      request_id: requestId,
    };
  } finally {
    await rm(requestPath, { force: true }).catch(() => {});
    await rm(resultPath, { force: true }).catch(() => {});
    adminInvocationActive = false;
  }
}

const defaultJournalApi = Object.freeze({
  begin: beginDevJournalOperation,
  complete: completeDevJournalOperation,
  fail: failDevJournalOperation,
  degrade: markDevJournalDegraded,
});

function journalResult(result) {
  return {
    elevated: result.elevated === true,
    execution_ok: result.execution_ok === true,
    ok: result.ok === true,
    command_sha256: result.command_sha256,
    cwd: result.cwd,
    timeout_ms: result.timeout_ms,
    exit_code: result.exit_code,
    timed_out: result.timed_out === true,
    duration_ms: result.duration_ms,
    stdout_sha256: sha256(result.stdout),
    stderr_sha256: sha256(result.stderr),
    stdout_truncated: result.stdout_truncated === true,
    stderr_truncated: result.stderr_truncated === true,
    reason: result.reason ?? null,
  };
}

export function createPowerShellMaintenanceTool({
  elevated = false,
  platform = process.platform,
  workspaceContextResolver = resolveDevWorkspaceExecutionContext,
  executor = elevated ? runPowerShellViaAdminTask : runPowerShellProcess,
  journalApi = defaultJournalApi,
} = {}) {
  const toolName = elevated ? "powershell_admin_run" : "powershell_run";
  const operationType = elevated ? "powershell_admin_maintenance" : "powershell_maintenance";

  return async function powershellMaintenance(input = {}) {
    if (platform !== "win32") {
      throw new Error(`${toolName} is only available on Windows.`);
    }

    assertPowerShellMaintenanceCommandAllowed(input.command);
    const timeoutMs = normalizeTimeoutMs(input.timeoutMs);
    const context = await workspaceContextResolver(
      { workspace_id: input.workspace_id },
      { mutation: true },
    );
    const cwd = await resolveMaintenanceCwd(context.root, input.cwd ?? ".");
    const commandHash = sha256(input.command);

    const operation = await journalApi.begin({
      operation_type: operationType,
      tool_name: toolName,
      workstream_id: context.workstream_id,
      workspace_id: context.workspace_id,
      result: {
        elevated,
        command_sha256: commandHash,
        cwd,
        timeout_ms: timeoutMs,
      },
    });

    let result;
    try {
      result = await executor({
        command: input.command,
        cwd,
        timeoutMs,
      });
    } catch (error) {
      const reason = redactProcessOutput(error?.message ?? String(error)).slice(0, 512);
      try {
        await journalApi.fail(operation.operation_id, {
          result: {
            elevated,
            command_sha256: commandHash,
            cwd,
            timeout_ms: timeoutMs,
            execution_ok: false,
            reason,
          },
        });
      } catch (journalError) {
        await journalApi.degrade(`${toolName} failure terminal append failed: ${journalError.message}`);
      }
      throw error;
    }

    try {
      await journalApi.complete(operation.operation_id, {
        result: journalResult(result),
      });
    } catch (error) {
      await journalApi.degrade(`${toolName} terminal append failed: ${error.message}`);
      return {
        ...result,
        execution_ok: false,
        ok: false,
        stderr: [result.stderr, redactProcessOutput(`PowerShell effect completed but Journal terminal append failed: ${error.message}`)]
          .filter(Boolean)
          .join("\n"),
        operation_id: operation.operation_id,
        workspace_context: workspaceExecutionProvenance(context),
      };
    }

    return {
      ...result,
      operation_id: operation.operation_id,
      workspace_context: workspaceExecutionProvenance(context),
    };
  };
}

export const powershell_run = createPowerShellMaintenanceTool({ elevated: false });
export const powershell_admin_run = createPowerShellMaintenanceTool({ elevated: true });
