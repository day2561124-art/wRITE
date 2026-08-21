import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const tunnelScript = path.join(rootDir, "scripts", "start-mcp-tunnel.ps1");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runTunnel(args, expectedStatus, env = {}) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tunnelScript, ...args],
    {
      cwd: rootDir,
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  assert(
    result.status === expectedStatus,
    `Tunnel launcher exited ${result.status}; expected ${expectedStatus}. stdout=${result.stdout} stderr=${result.stderr}`,
  );
  return result;
}

function runTunnelStart(args, expectedStatus, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tunnelScript, ...args],
      {
        cwd: rootDir,
        env: { ...process.env, ...env },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => {
      terminateProcessTree(child);
      reject(new Error(`Tunnel launcher timed out. stdout=${stdout} stderr=${stderr}`));
    }, 20_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (status) => {
      clearTimeout(timer);
      try {
        assert(
          status === expectedStatus,
          `Tunnel launcher exited ${status}; expected ${expectedStatus}. stdout=${stdout} stderr=${stderr}`,
        );
        resolve({ status, stdout, stderr });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function createFakeCloudflared(fixtureDir) {
  const fakeScript = path.join(fixtureDir, "fake-cloudflared.mjs");
  await writeFile(
    fakeScript,
    `import { appendFileSync } from "node:fs";

const protocolIndex = process.argv.indexOf("--protocol");
const protocol = protocolIndex >= 0 ? process.argv[protocolIndex + 1] : "missing";
appendFileSync(process.env.FAKE_ARGS_LOG, \`protocol=\${protocol} args=\${process.argv.slice(2).join(" ")}\\n\`);
const mode = process.env.FAKE_CLOUDFLARED_MODE;

if (mode === "quic-success" && protocol === "auto") {
  process.stderr.write("https://fresh-quic.trycloudflare.com\\n");
  process.stderr.write("Initial protocol quic\\n");
  process.stderr.write("Registered tunnel connection connIndex=0 protocol=quic\\n");
} else if (mode === "fallback-success" && protocol === "auto") {
  process.stderr.write("https://stale-auto.trycloudflare.com\\n");
  process.stderr.write("Failed to dial a quic connection\\n");
  process.stderr.write("UDP Connectivity test result: FAIL\\n");
} else if (mode === "fallback-success" && protocol === "http2") {
  process.stderr.write("https://fresh-http2.trycloudflare.com\\n");
  process.stderr.write("Initial protocol http2\\n");
  process.stderr.write("Registered tunnel connection connIndex=0 protocol=http2\\n");
}

setInterval(() => {}, 1000);
`,
    "utf8",
  );
  return { fakeScript };
}

function commonArgs(port, logDir, fakeScript) {
  return [
    "-McpPort",
    String(port),
    "-CloudflaredPath",
    process.execPath,
    "-CloudflaredPrefixArguments",
    fakeScript,
    "-RegistrationTimeoutSeconds",
    "3",
    "-PollIntervalMilliseconds",
    "100",
    "-LogDirectory",
    logDir,
  ];
}

async function readState(logDir) {
  const raw = await readFile(
    path.join(logDir, "cloudflared-tunnel.state.json"),
    "utf8",
  );
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function stopManagedTunnel(logDir) {
  const result = runTunnel(["-StopTunnel", "-LogDirectory", logDir], 0);
  assert(
    result.stdout.includes("Managed Cloudflare tunnel process stopped."),
    `Managed tunnel was not stopped. stdout=${result.stdout} stderr=${result.stderr}`,
  );
}

async function listenOnFreePort() {
  const server = createServer((_socket) => {});
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

async function main() {
  if (process.platform !== "win32") {
    console.log("MCP tunnel launcher integration test skipped (Windows only).");
    return;
  }

  const tempParent = path.join(rootDir, "tests", ".tmp");
  await mkdir(tempParent, { recursive: true });
  const fixtureDir = await mkdtemp(path.join(tempParent, "mcp-tunnel-"));
  const { fakeScript } = await createFakeCloudflared(fixtureDir);
  const argsLog = path.join(fixtureDir, "fake-args.log");
  const server = await listenOnFreePort();
  const port = server.address().port;

  try {
    const quicLogDir = path.join(fixtureDir, "quic-logs");
    const quicResult = await runTunnelStart(
      commonArgs(port, quicLogDir, fakeScript),
      0,
      {
        FAKE_CLOUDFLARED_MODE: "quic-success",
        FAKE_ARGS_LOG: argsLog,
      },
    );
    const quicState = await readState(quicLogDir);
    const quicEvents = await readFile(
      path.join(quicLogDir, "cloudflared-launcher.log"),
      "utf8",
    );
    assert(quicState.status === "registered", "QUIC success must be registered.");
    assert(quicState.protocol === "quic", "Actual QUIC protocol must be recorded.");
    assert(quicState.fallback === "none", "Healthy QUIC must not fall back.");
    assert(!quicEvents.includes("action=fallback"), "Healthy QUIC emitted a fallback event.");
    assert(
      quicResult.stdout.includes("https://fresh-quic.trycloudflare.com/mcp"),
      "Healthy QUIC did not print its current MCP URL.",
    );
    const quicStatus = runTunnel(["-Status", "-LogDirectory", quicLogDir], 0);
    assert(
      quicStatus.stdout.includes("Tunnel status: registered / healthy"),
      "Registered QUIC tunnel was not reported healthy.",
    );
    await stopManagedTunnel(quicLogDir);

    await writeFile(argsLog, "", "utf8");
    const fallbackLogDir = path.join(fixtureDir, "fallback-logs");
    const fallbackResult = await runTunnelStart(
      commonArgs(port, fallbackLogDir, fakeScript),
      0,
      {
        FAKE_CLOUDFLARED_MODE: "fallback-success",
        FAKE_ARGS_LOG: argsLog,
      },
    );
    const fallbackState = await readState(fallbackLogDir);
    const invocationLog = await readFile(argsLog, "utf8");
    const fallbackFiles = await readdir(fallbackLogDir);
    assert(
      invocationLog.match(/protocol=auto/g)?.length === 1 &&
        invocationLog.match(/protocol=http2/g)?.length === 1,
      `Expected one auto attempt and one HTTP2 attempt. Calls: ${invocationLog}`,
    );
    assert(fallbackState.status === "registered", "HTTP2 fallback must register.");
    assert(fallbackState.protocol === "http2", "Fallback protocol must be HTTP2.");
    assert(fallbackState.fallback === "quic->http2", "Fallback transition was not recorded.");
    assert(
      fallbackState.mcpUrl === "https://fresh-http2.trycloudflare.com/mcp",
      "Fallback state did not retain the new attempt URL.",
    );
    assert(
      fallbackResult.stdout.includes("https://fresh-http2.trycloudflare.com/mcp") &&
        !fallbackResult.stdout.includes("stale-auto.trycloudflare.com"),
      "Launcher printed a stale Quick Tunnel URL instead of the successful fallback URL.",
    );
    assert(
      fallbackResult.stdout.includes("MCP HTTP server is already listening; it will not be restarted."),
      "An existing MCP listener was not preserved.",
    );
    assert(
      !fallbackFiles.some((name) => name.startsWith("mcp-http.")),
      "Launcher restarted the MCP server even though its port was already listening.",
    );
    assert(server.listening, "Tunnel restart stopped the existing MCP server.");
    const fallbackStatus = runTunnel(["-Status", "-LogDirectory", fallbackLogDir], 0);
    assert(
      fallbackStatus.stdout.includes("https://fresh-http2.trycloudflare.com/mcp"),
      "Status did not print the successful fallback MCP URL.",
    );
    await stopManagedTunnel(fallbackLogDir);

    const connectingLogDir = path.join(fixtureDir, "connecting-logs");
    await mkdir(connectingLogDir, { recursive: true });
    const connectingOut = path.join(connectingLogDir, "connecting.stdout.log");
    const connectingErr = path.join(connectingLogDir, "connecting.stderr.log");
    await Promise.all([
      writeFile(connectingOut, "", "utf8"),
      writeFile(connectingErr, "", "utf8"),
    ]);
    const connectingProcess = spawn(
      process.execPath,
      [fakeScript, "tunnel", "--protocol", "auto", "--url", `http://127.0.0.1:${port}`],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          FAKE_CLOUDFLARED_MODE: "never-register",
          FAKE_ARGS_LOG: argsLog,
        },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await writeFile(
        path.join(connectingLogDir, "cloudflared-tunnel.state.json"),
        JSON.stringify({
          version: 1,
          attemptId: "connecting-test",
          pid: connectingProcess.pid,
          processStartedAtUtc: null,
          status: "connecting",
          requestedProtocol: "auto",
          protocol: null,
          fallback: "none",
          originUrl: `http://127.0.0.1:${port}`,
          baseUrl: null,
          mcpUrl: null,
          stdoutLog: connectingOut,
          stderrLog: connectingErr,
          failureReason: null,
          updatedAtUtc: new Date().toISOString(),
        }),
        "utf8",
      );
      const connectingStatus = runTunnel(
        ["-Status", "-LogDirectory", connectingLogDir],
        1,
      );
      assert(
        connectingStatus.stdout.includes("Cloudflare process: running") &&
          connectingStatus.stdout.includes("Tunnel status: connecting"),
        "A live but unregistered process must be reported as connecting.",
      );
      assert(
        !connectingStatus.stdout.includes("ChatGPT MCP URL:"),
        "A live but unregistered process must not print an MCP URL.",
      );
    } finally {
      terminateProcessTree(connectingProcess);
    }

    console.log("MCP tunnel launcher integration tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      await rm(fixtureDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Fixture cleanup warning: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`MCP tunnel launcher integration test failed: ${error.message}`);
  process.exitCode = 1;
});
