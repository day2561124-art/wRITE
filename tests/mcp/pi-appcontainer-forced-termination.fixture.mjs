// R15 diagnostic: intentionally terminate only a directly spawned native
// runner in the dedicated disposable Session 0 CI fixture. Never use on
// production or from the ordinary test-suite discovery path.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FIXED_ISOLATED_SOURCE_PATHS } from "../../server/src/mcp-fixed-isolated-verification.mjs";
import { prepareAppContainerPowerShell } from "../../server/src/mcp-powershell-appcontainer.mjs";
import { controlledProcessEnvironment } from "../../server/src/process-control.mjs";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function observe(fn, label, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const result = await fn();
    if (result) return result;
    await delay(100);
  }
  throw new Error("R15 observation timeout: " + label);
}
async function optionalText(file) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return ""; throw error; }
}
const exists = async file => {
  try { await stat(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
};
function pidExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
function acquired(log) {
  return [...log.matchAll(/^acquired=([a-f0-9]{32}); package=(S-1-15-2-[0-9-]+)\r?$/gmu)]
    .map(match => ({ id: match[1], package: match[2] }));
}
function probeProfile(id) {
  assert.match(id, /^[a-f0-9]{32}$/u);
  const name = "NexaLease" + id;
  // CreateAppContainerProfile documents ERROR_ALREADY_EXISTS for an existing
  // profile. In this throwaway account only, re-creation distinguishes a
  // residual profile from an absent one. Immediately delete the exact fixture
  // profile afterwards. Fixture cleanup is NOT original-runner cleanup.
  const script = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class R15ProfileProbe {",
    '  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int CreateAppContainerProfile(string name, string display, string description, IntPtr capabilities, uint count, out IntPtr sid);',
    '  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name);',
    '  [DllImport("advapi32.dll")] public static extern IntPtr FreeSid(IntPtr sid);',
    "}",
    "'@",
    "$name='" + name + "'",
    "$sid=[IntPtr]::Zero",
    "$hr=[R15ProfileProbe]::CreateAppContainerProfile($name,$name,'Disposable R15 observation',[IntPtr]::Zero,0,[ref]$sid)",
    "if ($sid -ne [IntPtr]::Zero) { $null=[R15ProfileProbe]::FreeSid($sid) }",
    "$created=$hr.ToString('X8')",
    "$deleted=$null",
    "if ($created -eq '00000000' -or $created -eq '800700B7') { $deleted=([R15ProfileProbe]::DeleteAppContainerProfile($name)).ToString('X8') }",
    "[pscustomobject]@{create_hresult=$created;fixture_delete_hresult=$deleted}|ConvertTo-Json -Compress",
  ].join("\n");
  const powershell = path.join(process.env.SystemRoot ?? process.env.SYSTEMROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return JSON.parse(execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 65536,
  }));
}

assert.equal(process.platform, "win32");
assert.equal(process.arch, "x64");
assert.equal(process.env.NEXA_R15_DISPOSABLE_FIXTURE, "1");
const parentTemp = await realpath(os.tmpdir());
const parentMatch = /^NexaDiag-([a-f0-9]{12})$/iu.exec(path.basename(path.dirname(parentTemp)));
assert.ok(parentMatch && path.basename(parentTemp).toLowerCase() === "run", "dedicated disposable runner directory required");
assert.equal(os.userInfo().username.toLowerCase(), ("NexaDiag" + parentMatch[1]).toLowerCase(), "dedicated disposable account required");

const root = await mkdtemp(path.join(parentTemp, "r15-forced-"));
const scratch = path.join(root, "scratch");
const workspace = path.join(root, "workspace");
await mkdir(scratch);
await mkdir(workspace);
const oldTemp = process.env.TEMP, oldTmp = process.env.TMP;
const providerLog = path.join(process.env.ProgramW6432 ?? process.env.ProgramFiles, "WriterWorkbench-NexaStationLease-v1", "station-leases.log");
let prepared, runner, child, closed, guest, lease, stageRoot;
let evidence = {};
try {
  process.env.TEMP = scratch;
  process.env.TMP = scratch;
  for (const file of FIXED_ISOLATED_SOURCE_PATHS) {
    const target = path.join(workspace, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL("../../" + file, import.meta.url)));
  }
  const entry = path.join(workspace, FIXED_ISOLATED_SOURCE_PATHS[0]);
  const fixture = [
    'import { writeFile, rename } from "node:fs/promises";',
    'import path from "node:path";',
    'const file = path.join(process.env.NEXA_SANDBOX_WORK, "r15-entered.json");',
    'await writeFile(file + ".tmp", JSON.stringify({ pid: process.pid, ppid: process.ppid }), { flag: "wx" });',
    'await rename(file + ".tmp", file);',
    'setInterval(() => {}, 1000);',
  ].join("\n");
  await writeFile(entry, fixture);
  prepared = await prepareAppContainerPowerShell({
    context: { root: workspace }, cwd: workspace, command: "r15-forced-native-runner-fixture",
    timeoutMs: 60000, sandbox_paths: FIXED_ISOLATED_SOURCE_PATHS,
    sandbox_directories: [], output_paths: [], toolchain: "node", fixedHermeticCore: true,
  });
  const directories = (await readdir(scratch)).filter(name => /^nexa-pi-shell-[A-Za-z0-9]+$/u.test(name));
  assert.equal(directories.length, 1, "exactly one fresh staging root");
  stageRoot = path.join(scratch, directories[0]);
  runner = path.join(stageRoot, "runner.exe");
  const stage = path.join(stageRoot, "stage");
  const marker = path.join(stage, "work", "r15-entered.json");
  const prior = new Set(acquired(await optionalText(providerLog)).map(x => x.id));
  child = spawn(runner, [stage, ".", "60000", "fixed-hermetic-core"], {
    cwd: stageRoot, env: controlledProcessEnvironment(), windowsHide: true, stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", data => { stderr = (stderr + data.toString("utf8")).slice(-4096); });
  closed = new Promise(resolve => {
    child.once("error", error => resolve({ error: error.message }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0);
  guest = await observe(async () => {
    assert.equal(child.exitCode, null, stderr || "runner exited before guest entry");
    const value = await optionalText(marker);
    return value ? JSON.parse(value) : null;
  }, "guest marker", 25000);
  assert.equal(guest.ppid, child.pid, "guest must belong to directly spawned runner");
  assert.ok(Number.isSafeInteger(guest.pid) && guest.pid > 0 && guest.pid !== child.pid);
  assert.equal(pidExists(guest.pid), true, "guest must actually be running");
  lease = await observe(async () => {
    const fresh = acquired(await optionalText(providerLog)).filter(x => !prior.has(x.id));
    assert.ok(fresh.length <= 1, "ambiguous fixture lease");
    return fresh[0];
  }, "fresh unique lease");
  evidence = { runner_pid: child.pid, guest_pid: guest.pid, lease: lease.id, package: lease.package, guest_entered: true };
  // Kill ONLY the exact ChildProcess handle created above. No process-name
  // searches, host PID selection, task termination or privilege changes.
  assert.equal(child.kill("SIGKILL"), true);
  const terminal = await Promise.race([closed, delay(10000).then(() => null)]);
  assert.ok(terminal && !terminal.error, "runner termination not observed");
  assert.notEqual(terminal.code, 0, "forced termination must not look successful");
  evidence.runner_terminal = terminal;
  await observe(() => !pidExists(guest.pid), "Job Object guest termination");
  evidence.guest_terminated = true;
  await observe(async () => (await optionalText(providerLog)).split(/\r?\n/u)
    .includes("closed=" + lease.id + "; released=False; cleaned=True"), "provider disconnect cleanup");
  evidence.provider_handles_closed = true;
  const guardianStarted = path.join(stageRoot, "profile-guardian.started");
  const guardianFinished = path.join(stageRoot, "profile-guardian.finished");
  assert.equal(await readFile(guardianStarted, "ascii"), "NexaLease" + lease.id);
  await observe(async () => (await optionalText(guardianFinished)) ===
    "name=NexaLease" + lease.id + "; cleaned=True", "independent guardian cleanup receipt", 15000);
  evidence.guardian_cleanup_observed = true;
  // The same-user API independently checks absence AFTER the production
  // guardian's receipt, not as a substitute for the guardian itself.
  evidence.profile_probe = probeProfile(lease.id);
  evidence.profile_orphaned = evidence.profile_probe.create_hresult === "800700B7";
  assert.ok(["00000000", "800700B7"].includes(evidence.profile_probe.create_hresult), "profile observation indeterminate");
  assert.equal(evidence.profile_probe.fixture_delete_hresult, "00000000", "fixture profile cleanup failed");
  assert.equal(await readFile(entry, "utf8"), fixture, "workspace entry changed");
  await prepared.cleanup();
  assert.equal(await exists(stageRoot), false, "staging directory remains");
  evidence.staging_removed = true;
  console.log("R15_FORCED_TERMINATION_OBSERVATION " + JSON.stringify(evidence));
  assert.equal(evidence.profile_orphaned, false, "R15: native runner termination left a per-user AppContainer profile; fixture removal is not production cleanup");
  console.log("R15_FORCED_TERMINATION_GATE_PASS");
} finally {
  // Emergency fixture cleanup is bounded to our directly spawned child and
  // exact temporary root. Failure remains a failed test.
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([closed, delay(10000)]);
  }
  try { if (prepared) await prepared.cleanup(); }
  finally {
    if (oldTemp === undefined) delete process.env.TEMP; else process.env.TEMP = oldTemp;
    if (oldTmp === undefined) delete process.env.TMP; else process.env.TMP = oldTmp;
    await rm(root, { recursive: true, force: true, maxRetries: 4 });
  }
}
