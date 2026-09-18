import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { terminateProcessTree } from "../../server/src/process-control.mjs";
import { runMcpProbe } from "../../scripts/probe-mcp.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate, message, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(50);
  }

  throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address
          ? address.port
          : null;

      server.close((error) =>
        error ? reject(error) : resolve(port),
      );
    });
  });
}

async function waitForPortListening(port) {
  await waitUntil(
    () =>
      new Promise((resolve) => {
        const socket = net.connect({
          host: "127.0.0.1",
          port,
        });

        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });

        socket.once("error", () => resolve(false));
      }),
    `MCP HTTP server did not listen on ${port}.`,
  );
}

async function waitForPortAvailable(port) {
  await waitUntil(
    () =>
      new Promise((resolve) => {
        const socket = net.connect({
          host: "127.0.0.1",
          port,
        });

        socket.once("connect", () => {
          socket.destroy();
          resolve(false);
        });

        socket.once("error", () => resolve(true));
      }),
    `MCP HTTP server did not release ${port}.`,
  );
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

function parsePayload(text) {
  const trimmed = text.trim();

  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const line = trimmed
      .split(/\r?\n/u)
      .find((candidate) => candidate.startsWith("data: "));

    return line
      ? JSON.parse(line.slice(6))
      : null;
  }
}

function postMcp({
  port,
  sessionId,
  protocolVersion,
  message,
}) {
  const payload = JSON.stringify(message);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Content-Length": Buffer.byteLength(payload),
          ...(sessionId
            ? { "Mcp-Session-Id": sessionId }
            : {}),
          ...(protocolVersion
            ? { "MCP-Protocol-Version": protocolVersion }
            : {}),
        },
      },
      (response) => {
        let text = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });

        response.once("end", () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            text,
            payload: parsePayload(text),
          }),
        );
      },
    );

    request.once("error", reject);
    request.end(payload);
  });
}

async function initializeSession(port) {
  const initialize = await postMcp({
    port,
    message: {
      jsonrpc: "2.0",
      id: "r6-cert-initialize",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "r6-certification",
          version: "1.0.0",
        },
      },
    },
  });

  assert.equal(initialize.statusCode, 200);

  const rawSession =
    initialize.headers["mcp-session-id"];

  const sessionId = Array.isArray(rawSession)
    ? rawSession[0]
    : rawSession;

  assert.ok(sessionId);

  const protocolVersion =
    initialize.payload?.result?.protocolVersion ??
    "2025-03-26";

  const initialized = await postMcp({
    port,
    sessionId,
    protocolVersion,
    message: {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
  });

  assert.ok(
    initialized.statusCode === 200 ||
      initialized.statusCode === 202,
  );

  return {
    sessionId,
    protocolVersion,
  };
}

function childPidForSession(stderrText, sessionId) {
  const line = stderrText
    .split(/\r?\n/u)
    .find((candidate) =>
      candidate.includes(
        `session initialized id=${sessionId} `,
      ),
    );

  const match = line?.match(/child_pid=(\d+)/u);

  return match
    ? Number.parseInt(match[1], 10)
    : null;
}

async function verifyRemoteTunnelUnreachable() {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new TypeError(
        "synthetic R6 remote transport failure",
      );
    };

    await assert.rejects(
      runMcpProbe({
        endpoint:
          "https://r6-unreachable.example.invalid/mcp",
        mode: "identity",
        startupBudgetMs: 1_000,
        hardDeadlineMs: 2_000,
      }),
      (error) =>
        error?.code ===
        "REMOTE_TRANSPORT_UNREACHABLE",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(
    "R6 certification: remote tunnel unreachable passed.",
  );
}

async function verifyDisconnectDoesNotLeakSession() {
  const port = await freePort();
  let stderrText = "";

  const serverProcess = spawn(
    process.execPath,
    [
      "server/src/mcp-http-server.mjs",
      "--port",
      String(port),
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: "chatgpt_developer",
        MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: "350",
        MCP_HTTP_SESSION_REAPER_INTERVAL_MS: "50",
        MCP_HTTP_MAX_IDLE_SESSION_COUNT: "16",
        MCP_HTTP_MAX_TOTAL_SESSION_COUNT: "16",
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );

  serverProcess.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  try {
    await waitForPortListening(port);

    const session =
      await initializeSession(port);

    const childPid =
      childPidForSession(
        stderrText,
        session.sessionId,
      );

    assert.ok(
      Number.isInteger(childPid) &&
        childPid > 0,
      `Unable to resolve MCP child PID. stderr=${stderrText}`,
    );

    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept:
          "application/json, text/event-stream",
        "Content-Length": 4096,
        "Mcp-Session-Id":
          session.sessionId,
        "MCP-Protocol-Version":
          session.protocolVersion,
      },
    });

    request.on("error", () => {});
    request.on("response", (response) => {
      response.resume();
    });

    request.flushHeaders();

    request.write(
      '{"jsonrpc":"2.0","id":"r6-disconnect",' +
      '"method":"tools/list","params":{}',
    );

    await sleep(150);

    request.destroy();

    await waitUntil(
      () => !isProcessRunning(childPid),
      `Disconnected request left child ${childPid} alive. stderr=${stderrText}`,
      5_000,
    );

    await waitUntil(
      () =>
        stderrText.includes(
          `session lifecycle closed id=${session.sessionId}`,
        ),
      `Disconnected request left session lifecycle open. stderr=${stderrText}`,
      5_000,
    );

    const stale = await postMcp({
      port,
      sessionId: session.sessionId,
      protocolVersion:
        session.protocolVersion,
      message: {
        jsonrpc: "2.0",
        id: "r6-stale-session-check",
        method: "tools/list",
        params: {},
      },
    });

    assert.equal(
      stale.statusCode,
      404,
      `Disconnected session remained addressable. ${stale.text}`,
    );
  } finally {
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }

  console.log(
    "R6 certification: disconnect mid-operation cleanup passed.",
  );
}

await verifyRemoteTunnelUnreachable();
await verifyDisconnectDoesNotLeakSession();

console.log(
  "R6 MCP reliability certification gap tests passed.",
);