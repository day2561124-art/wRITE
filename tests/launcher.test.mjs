import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const launcherPath = path.join(rootDir, "launcher.ps1");
const launcherCmdPath = path.join(rootDir, "launcher.cmd");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function runLauncher(args, expectedStatus) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcherPath, ...args],
    {
      cwd: rootDir,
      timeout: 30_000,
      windowsHide: true,
      stdio: "ignore",
    },
  );

  if (result.error) {
    throw new Error(`Launcher ${args.join(" ")} failed to run: ${result.error.message}`);
  }
  assert(
    result.status === expectedStatus,
    `Launcher ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}.`,
  );
}

function runBatchLauncher(args, expectedStatus) {
  const result = spawnSync(
    "cmd.exe",
    ["/d", "/c", launcherCmdPath, ...args],
    {
      cwd: rootDir,
      timeout: 30_000,
      windowsHide: true,
      stdio: "ignore",
    },
  );

  if (result.error) {
    throw new Error(`launcher.cmd ${args.join(" ")} failed to run: ${result.error.message}`);
  }
  assert(
    result.status === expectedStatus,
    `launcher.cmd ${args.join(" ")} exited ${result.status}; expected ${expectedStatus}.`,
  );
}

async function waitForListening(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep waiting for the launcher-started server.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Launcher-started UI did not become healthy on port ${port}.`);
}

async function runWindowsRuntimeChecks() {
  const port = await getFreePort();
  const portArgs = ["-Port", String(port)];

  runLauncher(["-Status", ...portArgs], 1);
  runBatchLauncher(["-Status", ...portArgs], 1);
  runLauncher(["-StartUi", "-NoOpen", ...portArgs], 0);
  try {
    await waitForListening(port);
    runLauncher(["-Status", ...portArgs], 0);
  } finally {
    runLauncher(["-StopUi", ...portArgs], 0);
  }

  const occupiedPort = await getFreePort();
  const dummy = spawn(
    process.execPath,
    ["-e", `require("node:http").createServer((_,r)=>r.end("dummy")).listen(${occupiedPort},"127.0.0.1")`],
    { cwd: rootDir, stdio: "ignore", windowsHide: true },
  );
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    runLauncher(["-StopUi", "-Port", String(occupiedPort)], 1);
    assert(dummy.exitCode === null, "Launcher terminated an unrelated Node process.");
  } finally {
    terminateProcessTree(dummy);
  }
}

async function main() {
  const [launcher, launcherCmd, readme] = await Promise.all([
    readFile(launcherPath, "utf8"),
    readFile(launcherCmdPath, "utf8"),
    readFile(path.join(rootDir, "README.md"), "utf8"),
  ]);

  assert(launcher.includes("$UiScriptPath"), "Launcher must identify the absolute UI script path.");
  assert(launcher.includes("[switch]$NoOpen"), "Launcher must support noninteractive browser suppression.");
  assert(launcher.includes("[int]$Port = 4173"), "Launcher must expose a testable port override.");
  assert(launcherCmd.includes("launcher.ps1"), "launcher.cmd must delegate to launcher.ps1.");
  assert(launcherCmd.includes("%*"), "launcher.cmd must forward command-line arguments.");
  assert(launcherCmd.includes("exit /b %exitCode%"), "launcher.cmd must preserve the PowerShell exit code.");
  const startUiCmd = await readFile(path.join(rootDir, "start-ui.cmd"), "utf8");
  assert(
    startUiCmd.includes("launcher.ps1") && startUiCmd.includes("-StartUi"),
    "start-ui.cmd must use the same process-safe launcher path.",
  );
  assert(readme.includes("launcher.cmd"), "README must document the launcher entrypoint.");

  if (process.platform === "win32") {
    await runWindowsRuntimeChecks();
    console.log("Launcher contract test passed (static + Windows runtime).");
  } else {
    console.log("Launcher contract test passed (static; Windows runtime skipped).");
  }
}

main().catch((error) => {
  console.error(`Launcher contract test failed: ${error.message}`);
  process.exitCode = 1;
});
