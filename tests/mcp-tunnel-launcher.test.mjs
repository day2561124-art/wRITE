import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
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
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const tunnelScript = path.join(rootDir, "scripts", "start-mcp-tunnel.ps1");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function childEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete environment[key];
  }
  return environment;
}

function runTunnel(args, expectedStatus, env = {}) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tunnelScript, ...args],
    {
      cwd: rootDir,
      env: childEnvironment(env),
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
        env: childEnvironment(env),
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

async function freePort() {
  const server = await listenOnFreePort();
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForPortAvailable(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortAvailable(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Port ${port} did not become available after MCP cleanup.`);
}

async function waitForPortListening(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await isPortAvailable(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Port ${port} did not start listening.`);
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function waitUntil(predicate, message, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

function parseMcpHttpPayload(text) {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    const messages = [];
    for (const line of text.split(/\r?\n/u)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice("data:".length).trim();
      if (!data || data === "[DONE]") continue;
      try {
        messages.push(JSON.parse(data));
      } catch {
        // Ignore non-JSON SSE fields; the assertion below reports the body.
      }
    }
    return messages.at(-1) ?? text;
  }
}

function postMcpHttpRequest({
  port,
  agent,
  sessionId,
  protocolVersion,
  message,
}) {
  const payload = JSON.stringify(message);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Content-Length": Buffer.byteLength(payload),
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  if (protocolVersion) headers["MCP-Protocol-Version"] = protocolVersion;

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        agent,
        headers,
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { text += chunk; });
        response.once("error", reject);
        response.once("end", () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            text,
            payload: parseMcpHttpPayload(text),
          });
        });
      },
    );
    request.once("error", reject);
    request.end(payload);
  });
}

function beginSlowMcpHttpRequest({ port, sessionId, protocolVersion }) {
  const request = http.request({
    host: "127.0.0.1",
    port,
    path: "/mcp",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Content-Length": 4096,
      "Mcp-Session-Id": sessionId,
      "MCP-Protocol-Version": protocolVersion,
    },
  });
  request.on("error", () => {});
  request.flushHeaders();
  request.write('{"jsonrpc":"2.0","id":"slow-active-request","method":"tools/list","params":{}');
  return request;
}

async function initializeMcpHttpSession({ port, agent, clientName }) {
  const initialize = await postMcpHttpRequest({
    port,
    agent,
    message: {
      jsonrpc: "2.0",
      id: `initialize-${clientName}`,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: clientName,
          version: "1.0.0",
        },
      },
    },
  });
  assert(
    initialize.statusCode === 200 && initialize.payload?.result,
    `MCP session initialize failed for ${clientName}. status=${initialize.statusCode} body=${initialize.text}`,
  );
  const sessionIdHeader = initialize.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
  assert(sessionId, `MCP initialize response did not include Mcp-Session-Id for ${clientName}.`);
  const protocolVersion = initialize.payload.result.protocolVersion ?? "2025-03-26";
  const initialized = await postMcpHttpRequest({
    port,
    agent,
    sessionId,
    protocolVersion,
    message: {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
  });
  assert(
    initialized.statusCode === 202 || initialized.statusCode === 200,
    `MCP initialized notification failed for ${clientName}. status=${initialized.statusCode} body=${initialized.text}`,
  );
  return { sessionId, protocolVersion };
}

function childPidForSessionLog(stderrText, sessionId) {
  const line = stderrText
    .split(/\r?\n/u)
    .find((candidate) => candidate.includes(`session initialized id=${sessionId} `));
  const match = line?.match(/child_pid=(\d+)/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function verifyMcpIdleSessionCapReclaimsChildren() {
  const port = await freePort();
  let stderrText = "";
  const agents = [];
  const serverProcess = spawn(
    process.execPath,
    ["server/src/mcp-http-server.mjs", "--port", String(port)],
    {
      cwd: rootDir,
      env: childEnvironment({
        MCP_TOOL_PROFILE: "chatgpt_developer",
        MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: "60000",
        MCP_HTTP_SESSION_REAPER_INTERVAL_MS: "50",
        MCP_HTTP_MAX_IDLE_SESSION_COUNT: "2",
      }),
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  serverProcess.stderr.on("data", (chunk) => { stderrText += chunk.toString("utf8"); });

  try {
    await waitForPortListening(port);
    const sessions = [];
    for (let index = 0; index < 4; index += 1) {
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });
      agents.push(agent);
      sessions.push(await initializeMcpHttpSession({
        port,
        agent,
        clientName: `bounded-session-${index}`,
      }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const childPids = sessions.map(({ sessionId }) => childPidForSessionLog(stderrText, sessionId));
    assert(childPids.every((pid) => Number.isInteger(pid) && pid > 0), `Could not resolve MCP child PIDs from lifecycle logs. stderr=${stderrText}`);

    await waitUntil(
      () => childPids.slice(0, 2).every((pid) => !isProcessRunning(pid)),
      `Oldest idle MCP child processes were not reclaimed by the idle-session cap. pids=${childPids.join(",")} stderr=${stderrText}`,
    );

    for (let index = 0; index < 2; index += 1) {
      const response = await postMcpHttpRequest({
        port,
        sessionId: sessions[index].sessionId,
        protocolVersion: sessions[index].protocolVersion,
        message: {
          jsonrpc: "2.0",
          id: `evicted-${index}`,
          method: "tools/list",
          params: {},
        },
      });
      assert(response.statusCode === 404, `Evicted MCP session ${index} remained addressable. status=${response.statusCode} body=${response.text}`);
    }

    for (let index = 2; index < 4; index += 1) {
      const response = await postMcpHttpRequest({
        port,
        sessionId: sessions[index].sessionId,
        protocolVersion: sessions[index].protocolVersion,
        message: {
          jsonrpc: "2.0",
          id: `survivor-${index}`,
          method: "tools/list",
          params: {},
        },
      });
      assert(response.statusCode === 200 && Array.isArray(response.payload?.result?.tools), `Newest bounded MCP session ${index} was evicted unexpectedly. status=${response.statusCode} body=${response.text}`);
      assert(isProcessRunning(childPids[index]), `Newest bounded MCP child ${childPids[index]} exited unexpectedly.`);
    }
    assert(stderrText.includes("reason=max_idle_session_count"), `Idle-session cap did not report bounded eviction. stderr=${stderrText}`);
  } finally {
    for (const agent of agents) agent.destroy();
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }
}

async function verifyMcpTotalSessionCapReclaimsIdleChildren() {
  const port = await freePort();
  let stderrText = "";
  const agents = [];
  const serverProcess = spawn(
    process.execPath,
    ["server/src/mcp-http-server.mjs", "--port", String(port)],
    {
      cwd: rootDir,
      env: childEnvironment({
        MCP_TOOL_PROFILE: "chatgpt_developer",
        MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: "60000",
        MCP_HTTP_SESSION_REAPER_INTERVAL_MS: "50",
        MCP_HTTP_MAX_IDLE_SESSION_COUNT: "32",
        MCP_HTTP_MAX_TOTAL_SESSION_COUNT: "2",
      }),
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  serverProcess.stderr.on("data", (chunk) => { stderrText += chunk.toString("utf8"); });

  try {
    await waitForPortListening(port);
    const sessions = [];
    for (let index = 0; index < 4; index += 1) {
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });
      agents.push(agent);
      sessions.push(await initializeMcpHttpSession({
        port,
        agent,
        clientName: `total-cap-session-${index}`,
      }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const childPids = sessions.map(({ sessionId }) => childPidForSessionLog(stderrText, sessionId));
    assert(childPids.every((pid) => Number.isInteger(pid) && pid > 0), `Could not resolve total-cap MCP child PIDs. stderr=${stderrText}`);
    await waitUntil(
      () => childPids.slice(0, 2).every((pid) => !isProcessRunning(pid)),
      `Oldest idle MCP children were not reclaimed by the total-session cap. pids=${childPids.join(",")} stderr=${stderrText}`,
    );

    for (let index = 0; index < 2; index += 1) {
      const response = await postMcpHttpRequest({
        port,
        sessionId: sessions[index].sessionId,
        protocolVersion: sessions[index].protocolVersion,
        message: {
          jsonrpc: "2.0",
          id: `total-cap-evicted-${index}`,
          method: "tools/list",
          params: {},
        },
      });
      assert(response.statusCode === 404, `Total-cap evicted MCP session ${index} remained addressable. status=${response.statusCode} body=${response.text}`);
    }

    for (let index = 2; index < 4; index += 1) {
      const response = await postMcpHttpRequest({
        port,
        sessionId: sessions[index].sessionId,
        protocolVersion: sessions[index].protocolVersion,
        message: {
          jsonrpc: "2.0",
          id: `total-cap-survivor-${index}`,
          method: "tools/list",
          params: {},
        },
      });
      assert(response.statusCode === 200 && Array.isArray(response.payload?.result?.tools), `Newest total-cap MCP session ${index} was evicted unexpectedly. status=${response.statusCode} body=${response.text}`);
      assert(isProcessRunning(childPids[index]), `Newest total-cap MCP child ${childPids[index]} exited unexpectedly.`);
    }
    assert(stderrText.includes("reason=max_total_session_count"), `Total-session cap did not report bounded eviction. stderr=${stderrText}`);
  } finally {
    for (const agent of agents) agent.destroy();
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }
}

async function verifyMcpTotalSessionCapProtectsActiveRequest() {
  const port = await freePort();
  let stderrText = "";
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });
  let slowRequest;
  const serverProcess = spawn(
    process.execPath,
    ["server/src/mcp-http-server.mjs", "--port", String(port)],
    {
      cwd: rootDir,
      env: childEnvironment({
        MCP_TOOL_PROFILE: "chatgpt_developer",
        MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: "60000",
        MCP_HTTP_SESSION_REAPER_INTERVAL_MS: "50",
        MCP_HTTP_MAX_IDLE_SESSION_COUNT: "32",
        MCP_HTTP_MAX_TOTAL_SESSION_COUNT: "1",
      }),
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  serverProcess.stderr.on("data", (chunk) => { stderrText += chunk.toString("utf8"); });

  try {
    await waitForPortListening(port);
    const session = await initializeMcpHttpSession({
      port,
      agent,
      clientName: "active-cap-session",
    });
    const childPid = childPidForSessionLog(stderrText, session.sessionId);
    assert(Number.isInteger(childPid) && childPid > 0, `Could not resolve active-cap MCP child PID. stderr=${stderrText}`);

    slowRequest = beginSlowMcpHttpRequest({
      port,
      sessionId: session.sessionId,
      protocolVersion: session.protocolVersion,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const rejected = await postMcpHttpRequest({
      port,
      message: {
        jsonrpc: "2.0",
        id: "capacity-rejected-initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "capacity-rejected-client",
            version: "1.0.0",
          },
        },
      },
    });
    assert(rejected.statusCode === 503, `Total-session cap did not reject a new session while the only existing session was active. status=${rejected.statusCode} body=${rejected.text}`);
    assert(String(rejected.payload?.error?.message ?? "").includes("capacity reached"), `Total-session cap rejection message drifted. body=${rejected.text}`);
    assert(isProcessRunning(childPid), `Active MCP child ${childPid} was killed to make room for a new session.`);
    await waitUntil(
      () => stderrText.includes("session initialization rejected reason=max_total_session_count"),
      `Active-session capacity rejection was not logged. stderr=${stderrText}`,
    );
  } finally {
    slowRequest?.destroy();
    agent.destroy();
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }
}

async function verifyMcpIdleTimeoutReclaimsChild() {
  const port = await freePort();
  let stderrText = "";
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });
  const serverProcess = spawn(
    process.execPath,
    ["server/src/mcp-http-server.mjs", "--port", String(port)],
    {
      cwd: rootDir,
      env: childEnvironment({
        MCP_TOOL_PROFILE: "chatgpt_developer",
        MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: "350",
        MCP_HTTP_SESSION_REAPER_INTERVAL_MS: "50",
        MCP_HTTP_MAX_IDLE_SESSION_COUNT: "32",
      }),
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  serverProcess.stderr.on("data", (chunk) => { stderrText += chunk.toString("utf8"); });

  try {
    await waitForPortListening(port);
    const session = await initializeMcpHttpSession({
      port,
      agent,
      clientName: "idle-timeout-session",
    });
    const childPid = childPidForSessionLog(stderrText, session.sessionId);
    assert(Number.isInteger(childPid) && childPid > 0, `Could not resolve idle-timeout MCP child PID. stderr=${stderrText}`);

    await waitUntil(
      () => stderrText.includes(`session evicted id=${session.sessionId} reason=idle_timeout`),
      `Idle MCP session was not reaped after the configured timeout. stderr=${stderrText}`,
    );
    await waitUntil(
      () => !isProcessRunning(childPid),
      `Idle MCP child ${childPid} remained alive after session timeout. stderr=${stderrText}`,
    );

    const response = await postMcpHttpRequest({
      port,
      sessionId: session.sessionId,
      protocolVersion: session.protocolVersion,
      message: {
        jsonrpc: "2.0",
        id: "expired-session-check",
        method: "tools/list",
        params: {},
      },
    });
    assert(response.statusCode === 404, `Expired MCP session remained addressable. status=${response.statusCode} body=${response.text}`);
  } finally {
    agent.destroy();
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }
}

async function verifyMcpSessionSurvivesIdleConnectionBoundary(port) {
  const firstConnectionAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 1,
    maxFreeSockets: 1,
  });
  const secondConnectionAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 1,
    maxFreeSockets: 1,
  });

  try {
    const initialize = await postMcpHttpRequest({
      port,
      agent: firstConnectionAgent,
      message: {
        jsonrpc: "2.0",
        id: "idle-session-init",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "mcp-http-idle-session-lifecycle-test",
            version: "1.0.0",
          },
        },
      },
    });
    assert(
      initialize.statusCode === 200 && initialize.payload?.result,
      `MCP session initialize failed. status=${initialize.statusCode} body=${initialize.text}`,
    );

    const sessionIdHeader = initialize.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader)
      ? sessionIdHeader[0]
      : sessionIdHeader;
    assert(sessionId, "MCP initialize response did not include Mcp-Session-Id.");
    const protocolVersion = initialize.payload.result.protocolVersion ?? "2025-03-26";

    const initialized = await postMcpHttpRequest({
      port,
      agent: firstConnectionAgent,
      sessionId,
      protocolVersion,
      message: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
    });
    assert(
      initialized.statusCode === 202 || initialized.statusCode === 200,
      `MCP initialized notification failed. status=${initialized.statusCode} body=${initialized.text}`,
    );

    const beforeIdle = await postMcpHttpRequest({
      port,
      agent: firstConnectionAgent,
      sessionId,
      protocolVersion,
      message: {
        jsonrpc: "2.0",
        id: "idle-session-before",
        method: "tools/list",
        params: {},
      },
    });
    assert(
      beforeIdle.statusCode === 200 && Array.isArray(beforeIdle.payload?.result?.tools),
      `MCP pre-idle tools/list failed. status=${beforeIdle.statusCode} body=${beforeIdle.text}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 6_200));

    // A distinct Agent guarantees a distinct TCP connection while preserving
    // the MCP session identity carried only by Mcp-Session-Id.
    const afterIdle = await postMcpHttpRequest({
      port,
      agent: secondConnectionAgent,
      sessionId,
      protocolVersion,
      message: {
        jsonrpc: "2.0",
        id: "idle-session-after",
        method: "tools/list",
        params: {},
      },
    });
    assert(
      afterIdle.statusCode === 200 && Array.isArray(afterIdle.payload?.result?.tools),
      `MCP session did not survive >5s idle/new-connection boundary. status=${afterIdle.statusCode} body=${afterIdle.text}`,
    );
  } finally {
    firstConnectionAgent.destroy();
    secondConnectionAgent.destroy();
  }
}

function externalProcessHandle(pid) {
  return {
    pid,
    exitCode: null,
    killed: false,
    kill() {
      try {
        process.kill(pid);
      } catch {
        // The process may already have exited.
      }
    },
  };
}

async function verifyLauncherMcpProfile({
  fixtureDir,
  fakeScript,
  argsLog,
  profile,
  expectedCount,
  expectRangeRead,
  expectPatch,
  expectDelete,
  expectRunTests,
  expectCommit,
  expectPush,
  expectReload,
  label,
}) {
  const preferredPort = 8787;
  const port = await isPortAvailable(preferredPort) ? preferredPort : await freePort();
  const logDir = path.join(fixtureDir, `${label}-profile-logs`);
  let mcpProcess;
  let tunnelStarted = false;
  let client;
  try {
    const result = await runTunnelStart(
      commonArgs(port, logDir, fakeScript),
      0,
      {
        FAKE_CLOUDFLARED_MODE: "quic-success",
        FAKE_ARGS_LOG: argsLog,
        MCP_TOOL_PROFILE: profile,
      },
    );
    tunnelStarted = true;
    const pidMatch = result.stdout.match(/MCP_HTTP_PID=(\d+)/u);
    assert(pidMatch, `Launcher did not report its MCP PID. stdout=${result.stdout}`);
    mcpProcess = externalProcessHandle(Number(pidMatch[1]));
    const expectedProfile = profile ?? "chatgpt_developer";
    assert(
      result.stdout.includes(`MCP_TOOL_PROFILE=${expectedProfile}`),
      `Launcher did not report MCP_TOOL_PROFILE=${expectedProfile}. stdout=${result.stdout}`,
    );

    if (expectReload) {
      await verifyMcpSessionSurvivesIdleConnectionBoundary(port);
    }

    client = new Client(
      { name: `mcp-tunnel-${label}-profile-test`, version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
    );
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assert(
      names.length === expectedCount,
      `${label} launcher profile exposed ${names.length} tools; expected ${expectedCount}.`,
    );
    assert(
      names.includes("dev_read_file_range") === expectRangeRead,
      `${label} launcher profile dev_read_file_range exposure was ${names.includes("dev_read_file_range")}.`,
    );
    assert(
      names.includes("dev_apply_patch") === expectPatch,
      `${label} launcher profile dev_apply_patch exposure was ${names.includes("dev_apply_patch")}.`,
    );
    assert(
      names.includes("dev_delete_file") === expectDelete,
      `${label} launcher profile dev_delete_file exposure was ${names.includes("dev_delete_file")}.`,
    );
    assert(
      names.includes("dev_run_tests") === expectRunTests,
      `${label} launcher profile dev_run_tests exposure was ${names.includes("dev_run_tests")}.`,
    );
    assert(
      names.includes("dev_git_commit") === expectCommit,
      `${label} launcher profile dev_git_commit exposure was ${names.includes("dev_git_commit")}.`,
    );
    assert(
      names.includes("dev_git_push") === expectPush,
      `${label} launcher profile dev_git_push exposure was ${names.includes("dev_git_push")}.`,
    );
    assert(
      names.includes("dev_mcp_reload") === expectReload,
      `${label} launcher profile dev_mcp_reload exposure was ${names.includes("dev_mcp_reload")}.`,
    );

    if (!expectReload) {
      let blockedError = null;
      try {
        await client.callTool({ name: "dev_mcp_reload", arguments: {} });
      } catch (error) {
        blockedError = error;
      }
      assert(blockedError, "chatgpt_public crafted dev_mcp_reload call was not blocked.");
      assert(
        String(blockedError.message ?? blockedError).includes("Tool not allowed by MCP tool profile chatgpt_public: dev_mcp_reload"),
        `chatgpt_public dev_mcp_reload rejection drifted: ${blockedError}`,
      );
    }

    if (expectReload) {
      const reloadTool = listed.tools.find((tool) => tool.name === "dev_mcp_reload");
      assert(reloadTool, `${label} launcher profile is missing dev_mcp_reload metadata.`);
      assert(reloadTool.annotations?.readOnlyHint === false, "dev_mcp_reload must be a write-like runtime action.");
      assert(reloadTool.inputSchema?.additionalProperties === false, "dev_mcp_reload schema must reject unknown arguments.");
      assert(Object.keys(reloadTool.inputSchema?.properties ?? {}).length === 0, "dev_mcp_reload must expose no caller-controlled process arguments.");
      assert(
        reloadTool._meta?.["armed-academy/permission"]?.permission_level === "write_low_risk",
        "dev_mcp_reload permission must be write_low_risk.",
      );

      let invalidReloadError = null;
      try {
        await client.callTool({
          name: "dev_mcp_reload",
          arguments: { command: "restart" },
        });
      } catch (error) {
        invalidReloadError = error;
      }
      assert(invalidReloadError, "dev_mcp_reload accepted caller-controlled process arguments.");
      assert(
        String(invalidReloadError.message ?? invalidReloadError).includes("dev_mcp_reload does not accept arguments."),
        `dev_mcp_reload invalid-argument rejection drifted: ${invalidReloadError}`,
      );

      const reloadResponse = await client.callTool({
        name: "dev_mcp_reload",
        arguments: {},
      });
      assert(reloadResponse.isError !== true, "dev_mcp_reload returned a tool error.");
      const reloadPayload = JSON.parse(reloadResponse.content?.[0]?.text ?? "{}");
      assert(reloadPayload.ok === true && reloadPayload.reloaded === true, "dev_mcp_reload did not report a successful reload.");
      assert(Number.isInteger(reloadPayload.previous_child_pid) && reloadPayload.previous_child_pid > 0, "dev_mcp_reload previous child PID is invalid.");
      assert(Number.isInteger(reloadPayload.child_pid) && reloadPayload.child_pid > 0, "dev_mcp_reload replacement child PID is invalid.");
      assert(reloadPayload.child_pid !== reloadPayload.previous_child_pid, "dev_mcp_reload did not replace the MCP child process.");
      assert(reloadPayload.http_parent_preserved === true, "dev_mcp_reload must preserve the HTTP parent.");
      assert(reloadPayload.tunnel_preserved === true, "dev_mcp_reload must preserve the tunnel.");
      assert(reloadPayload.prepared_turn_broker_preserved === true, "dev_mcp_reload must preserve the parent prepared-turn broker.");
      assert(reloadPayload.child_ephemeral_state_reset === true, "dev_mcp_reload must explicitly report child-local ephemeral state reset.");

      const listedAfterReload = await client.listTools();
      const namesAfterReload = listedAfterReload.tools.map((tool) => tool.name);
      assert(namesAfterReload.length === expectedCount, "Tool count drifted after dev_mcp_reload.");
      assert(namesAfterReload.includes("dev_mcp_reload"), "dev_mcp_reload disappeared after reloading the child.");
    }
  } finally {
    if (client) await client.close().catch(() => {});
    if (tunnelStarted) await stopManagedTunnel(logDir).catch(() => {});
    if (mcpProcess) terminateProcessTree(mcpProcess);
    await waitForPortAvailable(port);
  }
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
  let serverClosed = false;
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

    await new Promise((resolve) => server.close(resolve));
    serverClosed = true;

    await verifyMcpIdleSessionCapReclaimsChildren();
    await verifyMcpTotalSessionCapReclaimsIdleChildren();
    await verifyMcpTotalSessionCapProtectsActiveRequest();
    await verifyMcpIdleTimeoutReclaimsChild();

    await verifyLauncherMcpProfile({
      fixtureDir,
      fakeScript,
      argsLog,
      profile: undefined,
      expectedCount: 88,
      expectRangeRead: true,
      expectPatch: true,
      expectDelete: true,
      expectRunTests: true,
      expectCommit: true,
      expectPush: true,
      expectReload: true,
      label: "default-developer",
    });
    await verifyLauncherMcpProfile({
      fixtureDir,
      fakeScript,
      argsLog,
      profile: "chatgpt_public",
      expectedCount: 39,
      expectRangeRead: false,
      expectPatch: false,
      expectDelete: false,
      expectRunTests: false,
      expectCommit: false,
      expectPush: false,
      expectReload: false,
      label: "external-public-override",
    });

    console.log("MCP tunnel launcher integration tests passed.");
    console.log("- Launcher default MCP HTTP profile: chatgpt_developer (88 tools: 87 child-owned plus parent-owned dev_mcp_reload)");
    console.log("- External MCP_TOOL_PROFILE override: chatgpt_public (39 tools, development write/test tools absent)");
  } finally {
    if (!serverClosed) await new Promise((resolve) => server.close(resolve));
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
