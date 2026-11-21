import { spawn, spawnSync } from "node:child_process";
import {traceSpan} from "./mcp-request-tracing.mjs";
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
import { markPowerShellPreDispatchFailure } from "./mcp-powershell-predispatch-failure.mjs";
import { prepareAppContainerPowerShell } from "./mcp-powershell-appcontainer.mjs";
import { PI_TASK_AUTHORIZATION_ID, WINDOWS_SERVICE_NAME } from "./pi-execution-contract.mjs";
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

function scopedAdminStateRoot() {
  const grants = process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
  const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles;
  const root = programFiles && path.join(programFiles, "WriterWorkbench-PiMaintenance");
  if (!root || typeof grants !== "string" || !path.isAbsolute(grants)
    || path.relative(path.join(root, "grants"), grants) !== "") {
    throw new Error("SCOPED_ADMIN_AUTHORIZATION_STORE_REQUIRED");
  }
  return root;
}

async function assertScopedAdminReady() {
  const root = scopedAdminStateRoot();
  for (const dir of [root, ...["requests", "results", "grants"].map(name => path.join(root, name))]) {
    const info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("SCOPED_ADMIN_RUNNER_NOT_REGISTERED");
  }
  const configPath = path.join(root, "config.json");
  const info = await lstat(configPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384
    || JSON.parse(await readFile(configPath, "utf8"))?.schema_version !== 2) throw new Error("SCOPED_ADMIN_RUNNER_NOT_REGISTERED");
}

const ADMIN_RESULT_STARTUP_GRACE_MS = 20_000;
const ADMIN_RESULT_POLL_MS = 125;
const ADMIN_RECEIPT_ID = /^[a-f0-9]{32}$/u;

function scopedAdminBinding(grant) {
  return sha256([grant.workspace_id, grant.workstream_id, grant.goal, grant.service_name.toLowerCase()]
    .join("\n")).slice(0, 32);
}

function scopedAdminReceiptMatches(receipt, expected) {
  return receipt?.schema_version === 2 && receipt.request_id === expected.request_id
    && receipt.task_authorization_id === expected.task_authorization_id && receipt.scope_binding === expected.scope_binding
    && typeof receipt.dispatch_started === "boolean" && receipt.timed_out === false
    && ((receipt.execution_ok === true && receipt.exit_code === 0 && receipt.reason === null
      && receipt.service_name === expected.service_name)
      || (receipt.execution_ok === false && receipt.exit_code === null
        && ((receipt.reason === "SCOPED_ADMIN_SERVICE_FAILED" && receipt.service_name === expected.service_name)
          || (receipt.reason === "SCOPED_ADMIN_AUTHORIZATION_DENIED" && receipt.service_name === null
            && receipt.dispatch_started === false))));
}

// Inspect an already-published protected receipt without making a request to the runner.
export async function inspectScopedAdminRecovery(started, { stateRoot = scopedAdminStateRoot() } = {}) {
  const requestId = started.operation_id.slice("dev_operation_".length);
  const scope = started.result;
  if (!ADMIN_RECEIPT_ID.test(requestId) || !ADMIN_RECEIPT_ID.test(scope?.scoped_admin_scope_binding ?? "")
    || !PI_TASK_AUTHORIZATION_ID.test(scope?.task_authorization_id ?? "") || !WINDOWS_SERVICE_NAME.test(scope?.service_name ?? "")) {
    return null;
  }
  const file = path.join(stateRoot, "results", `${requestId}.result.json`);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384) return null;
  const raw = await readFile(file, "utf8");
  const receipt = JSON.parse(raw);
  if (!scopedAdminReceiptMatches(receipt, { ...scope, request_id: requestId, scope_binding: scope.scoped_admin_scope_binding })
    || (!receipt.execution_ok && receipt.dispatch_started)) return null;
  return {
    command_sha256: scope.command_sha256,
    scoped_admin_scope_binding: scope.scoped_admin_scope_binding,
    scoped_request_id: requestId,
    scoped_admin_receipt_sha256: sha256(raw),
    task_authorization_id: scope.task_authorization_id,
    service_name: scope.service_name,
    scoped_admin_dispatch_started: receipt.dispatch_started,
    execution_ok: receipt.execution_ok,
    exit_code: receipt.exit_code,
    reason: receipt.reason,
  };
}

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

async function resolveMaintenanceCwd(root, requestedCwd = ".", { hostAbsoluteCwd = false } = {}) {
  if (typeof requestedCwd !== "string" || !requestedCwd.trim()) {
    throw new Error("cwd must be a non-blank path.");
  }
  const absolute = path.isAbsolute(requestedCwd);
  if (absolute && !hostAbsoluteCwd) {
    throw new Error("cwd must be workspace-relative; absolute paths are not accepted.");
  }
  if (absolute && hostAbsoluteCwd && process.platform === "win32"
    && !/^[a-z]:[\\/]/iu.test(requestedCwd)) {
    throw new Error("host cwd must be a local absolute drive path.");
  }
  const resolvedRoot = await realpath(root);
  const candidate = absolute ? path.resolve(requestedCwd) : path.resolve(resolvedRoot, requestedCwd);
  if (!absolute && !isPathInside(candidate, resolvedRoot)) {
    throw new Error("cwd must stay inside the selected Writer Workbench workspace.");
  }
  const resolvedCandidate = await realpath(candidate);
  if (!absolute && !isPathInside(resolvedCandidate, resolvedRoot)) {
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

export async function runPowerShellProcess(args={}) {
  return traceSpan("powershell.process",()=>runPowerShellProcessObserved(args));
}
async function runPowerShellProcessObserved({
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
  serviceAuthorization,
  stateRoot = serviceAuthorization ? scopedAdminStateRoot() : defaultAdminStateRoot(),
  taskName = POWERSHELL_ADMIN_TASK_NAME,
  spawnSyncImpl = spawnSync,
  requestId = randomUUID().replaceAll("-", ""),
} = {}) {
  if (typeof requestId !== "string" || !ADMIN_RECEIPT_ID.test(requestId)) throw new Error("INVALID_ADMIN_REQUEST_ID");
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

  const requestsDir = path.join(stateRoot, "requests");
  const resultsDir = path.join(stateRoot, "results");
  const scopeBinding = serviceAuthorization ? scopedAdminBinding(serviceAuthorization) : null;
  const requestPath = path.join(requestsDir, serviceAuthorization
    ? `${requestId}~${serviceAuthorization.task_authorization_id}~${scopeBinding}~${Date.now()}.scoped-request`
    : `${requestId}.request.json`);
  const resultPath = path.join(resultsDir, `${requestId}.result.json`);

  try {
    if (!queryScheduledTask(taskName, spawnSyncImpl)) {
      return {
        ...base,
        reason: "ADMIN_RUNNER_NOT_REGISTERED",
        stderr: "The elevated PowerShell runner is not registered. Run scripts/register-mcp-powershell-admin-runner.ps1 once from an elevated PowerShell window.",
      };
    }

    if (!serviceAuthorization) {
      await mkdir(requestsDir, { recursive: true });
      await mkdir(resultsDir, { recursive: true });
    }
    const request = serviceAuthorization ? "" : `${JSON.stringify({
      schema_version: 1,
      request_id: requestId,
      command,
      cwd,
      timeout_ms: timeoutMs,
      created_at: new Date().toISOString(),
    })}\n`;
    await writeFile(requestPath, request, { encoding: "utf8", flag: "wx" });

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
    if (serviceAuthorization && !scopedAdminReceiptMatches(payload, { request_id: requestId,
      task_authorization_id: serviceAuthorization.task_authorization_id, scope_binding: scopeBinding,
      service_name: serviceAuthorization.service_name.toLowerCase() })) {
      return { ...base, reason: "SCOPED_ADMIN_RECEIPT_MISMATCH", stderr: "The protected service receipt did not match the request." };
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
      ...(serviceAuthorization ? { task_authorization_id: payload.task_authorization_id,
        service_name: serviceAuthorization.service_name.toLowerCase(), scoped_admin_dispatch_started: payload.dispatch_started,
        scoped_admin_scope_binding: scopeBinding } : {}),
    };
  } finally {
    await rm(requestPath, { force: true }).catch(() => {});
    if (!serviceAuthorization) await rm(resultPath, { force: true }).catch(() => {});
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
    ...(result.task_authorization_id ? { task_authorization_id: result.task_authorization_id, service_name: result.service_name,
      scoped_admin_dispatch_started: result.scoped_admin_dispatch_started, scoped_request_id: result.request_id,
      scoped_admin_scope_binding: result.scoped_admin_scope_binding } : {}),
    ...(result.isolation_mode === "appcontainer" ? {
      isolation_mode: result.isolation_mode,
      workspace_writes: false,
      job_terminated: result.job_terminated === true,
      cleanup_pending: result.cleanup_pending === true,
      input_manifest_sha256: result.input_manifest_sha256,
      input_file_count: result.input_file_count,
      ...(result.toolchain ? { toolchain: result.toolchain } : {}),
      artifact_manifest_sha256: sha256(JSON.stringify((result.artifacts ?? []).map(({content, ...item}) => item))),
    } : {}),
  };
}

export function createPowerShellMaintenanceTool({
  elevated = false,
  isolated = false,
  platform = process.platform,
  workspaceContextResolver = resolveDevWorkspaceExecutionContext,
  executor = elevated ? runPowerShellViaAdminTask : runPowerShellProcess,
  journalApi = defaultJournalApi,
} = {}) {
  if (isolated && elevated) throw new Error("INVALID_POWERSHELL_RUNNER_CONFIGURATION");
  const toolName = elevated ? "powershell_admin_run" : "powershell_run";
  const operationType = elevated ? "powershell_admin_maintenance" : "powershell_maintenance";

  return async function powershellMaintenance(input = {}) {
    let timeoutMs, context, cwd, prepared, serviceAuthorization;
    try {
      if (platform !== "win32") throw new Error(`${toolName} is only available on Windows.`);
      assertPowerShellMaintenanceCommandAllowed(input.command);
      timeoutMs = normalizeTimeoutMs(input.timeoutMs);
      context = await workspaceContextResolver(
        { workspace_id: input.workspace_id },
        { mutation: true },
      );
      cwd = await resolveMaintenanceCwd(context.root, input.cwd ?? ".", {
        hostAbsoluteCwd: !isolated && !elevated && context.workspace_type === "shared",
      });
      if (input.service_authorization !== undefined) {
        const grant = input.service_authorization;
        if (!elevated || context.workspace_type !== "isolated_worktree" || context.workstream_state !== "active"
          || !grant || typeof grant.task_authorization_id !== "string" || !PI_TASK_AUTHORIZATION_ID.test(grant.task_authorization_id)
          || typeof grant.service_name !== "string" || !WINDOWS_SERVICE_NAME.test(grant.service_name)
          || typeof grant.goal !== "string" || !grant.goal.trim() || grant.goal.length > 4096
          || grant.workstream_id !== context.workstream_id) throw new Error("SCOPED_ADMIN_AUTHORIZATION_REQUIRED");
        serviceAuthorization = { task_authorization_id: grant.task_authorization_id, goal: grant.goal,
          workstream_id: context.workstream_id, workspace_id: context.workspace_id, service_name: grant.service_name };
        if (executor === runPowerShellViaAdminTask) await assertScopedAdminReady();
      }
      if (isolated) {
        if (context.workspace_type !== "isolated_worktree" || context.workstream_state !== "active"
          || context.lifecycle_state !== "active" || context.mutation_allowed !== true) throw new Error("ISOLATED_WORKSPACE_REQUIRED");
        prepared = await prepareAppContainerPowerShell({ context, cwd, command: input.command, timeoutMs,
          sandbox_paths: input.sandbox_paths, output_paths: input.output_paths, toolchain: input.toolchain });
      }
    } catch (error) {
      throw markPowerShellPreDispatchFailure(error, toolName);
    }
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
        ...(prepared ? { isolation_mode: "appcontainer", workspace_writes: false, ...prepared.manifest } : {}),
        ...(serviceAuthorization ? { task_authorization_id: serviceAuthorization.task_authorization_id,
          service_name: serviceAuthorization.service_name.toLowerCase(),
          scoped_admin_scope_binding: scopedAdminBinding(serviceAuthorization) } : {}),
      },
    }).catch(async error => {
      await prepared?.cleanup();
      throw error;
    });

    let result;
    try {
      result = prepared ? await prepared.run() : await executor({
        command: input.command,
        cwd,
        timeoutMs,
        ...(serviceAuthorization ? { serviceAuthorization, requestId: operation.operation_id.slice("dev_operation_".length) } : {}),
      });
      if (prepared) {
        try { await prepared.cleanup(); }
        catch { result = { ...result, ok: false, cleanup_pending: true, reason: "SANDBOX_CLEANUP_PENDING" }; }
      }
    } catch (error) {
      await prepared?.cleanup().catch(() => {});
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
export const powershell_isolated_run = createPowerShellMaintenanceTool({ isolated: true });
