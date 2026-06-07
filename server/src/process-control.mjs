import { spawn } from "node:child_process";

export function terminateProcessTree(child, { forceAfterMs = 2_000 } = {}) {
  if (!child || child.exitCode !== null || child.killed || !child.pid) return;

  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return;
  }

  child.kill("SIGTERM");
  const forceTimer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, forceAfterMs);
  forceTimer.unref();
}
