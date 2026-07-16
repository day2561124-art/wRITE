import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const serverPath = path.join(
  rootDir,
  "server",
  "src",
  "mcp-http-server.mjs",
);

const expectedExternalBrainTools = [
  "chatgpt_bridge_begin_external_brain_writing_session",
  "chatgpt_bridge_use_scene_planner",
  "chatgpt_bridge_use_character_simulator",
  "chatgpt_bridge_use_neural_critic",
  "chatgpt_bridge_use_style_drift_detector",
  "chatgpt_bridge_use_over_governance_detector",
  "chatgpt_bridge_use_writing_card_director",
  "chatgpt_bridge_use_final_polisher",
];

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (
        address === null ||
        typeof address !== "object"
      ) {
        server.close();
        reject(
          new Error(
            "Unable to resolve temporary HTTP MCP port.",
          ),
        );
        return;
      }

      const port = address.port;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function canConnect(port) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

async function waitForPort(
  child,
  port,
  readStderr,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      child.exitCode !== null ||
      child.signalCode !== null
    ) {
      throw new Error(
        "HTTP MCP server exited before readiness.\n" +
          readStderr(),
      );
    }

    if (await canConnect(port)) {
      return;
    }

    await delay(100);
  }

  throw new Error(
    "HTTP MCP server readiness timed out.\n" +
      readStderr(),
  );
}

async function withTimeout(
  promise,
  label,
  timeoutMs = 20_000,
) {
  let timeoutHandle;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new Error(
              label +
                " timed out after " +
                timeoutMs +
                "ms",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function stopChild(child) {
  if (
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  const exited = once(child, "exit");

  child.kill("SIGTERM");

  let timeoutHandle;
  let exitedGracefully;

  try {
    exitedGracefully = await Promise.race([
      exited.then(() => true),
      new Promise((resolve) => {
        timeoutHandle = setTimeout(
          () => resolve(false),
          5_000,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }

  if (
    !exitedGracefully &&
    child.exitCode === null &&
    child.signalCode === null
  ) {
    child.kill("SIGKILL");
    await exited;
  }
}

const temporaryDirectory = await mkdtemp(
  path.join(
    os.tmpdir(),
    "phase44c-http-mcp-",
  ),
);

const port = await reservePort();

const configPath = path.join(
  temporaryDirectory,
  "mcp-http.json",
);

await writeFile(
  configPath,
  JSON.stringify(
    {
      host: "127.0.0.1",
      port,
    },
    null,
    2,
  ),
  "utf8",
);

const child = spawn(
  process.execPath,
  [
    serverPath,
    "--config",
    configPath,
  ],
  {
    cwd: rootDir,
    stdio: [
      "ignore",
      "ignore",
      "pipe",
    ],
    windowsHide: true,
  },
);

child.stderr.setEncoding("utf8");

let stderr = "";

child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

let client;

try {
  await waitForPort(
    child,
    port,
    () => stderr,
  );

  client = new Client(
    {
      name:
        "phase44c-http-session-lifecycle-regression",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  const transport =
    new StreamableHTTPClientTransport(
      new URL(
        "http://127.0.0.1:" +
          port +
          "/mcp",
      ),
    );

  await withTimeout(
    client.connect(transport),
    "Client.connect",
  );

  const first = await withTimeout(
    client.listTools(),
    "First Client.listTools",
  );

  const second = await withTimeout(
    client.listTools(),
    "Second Client.listTools",
  );

  const firstNames = first.tools.map(
    (tool) => tool.name,
  );

  const secondNames = second.tools.map(
    (tool) => tool.name,
  );

  assert.equal(
    firstNames.length,
    25,
    "chatgpt_public HTTP surface must expose exactly 25 tools",
  );

  assert.deepEqual(
    secondNames,
    firstNames,
    "Repeated tools/list must remain stable in the same MCP session",
  );

  for (
    const toolName of expectedExternalBrainTools
  ) {
    assert(
      firstNames.includes(toolName),
      "Missing Phase44A HTTP MCP tool: " +
        toolName,
    );
  }

  const toolMap = new Map(
    first.tools.map(
      (tool) => [
        tool.name,
        tool,
      ],
    ),
  );

  assert.match(
    toolMap.get(
      "chatgpt_bridge_begin_external_brain_writing_session",
    )?.description ?? "",
    /Architecture-primary/i,
  );

  assert.match(
    toolMap.get(
      "chatgpt_bridge_build_full_neural_writing_handoff",
    )?.description ?? "",
    /aggregate compatibility/i,
  );

  assert.match(
    toolMap.get(
      "chatgpt_bridge_get_workbench_status",
    )?.description ?? "",
    /inspection only/i,
  );

  console.log(
    "Phase 44C HTTP MCP session lifecycle regression passed: " +
      "Client.connect + repeated listTools, tool_count=" +
      firstNames.length,
  );
} finally {
  if (client) {
    await client.close().catch(() => {});
  }

  await stopChild(child);

  await rm(
    temporaryDirectory,
    {
      recursive: true,
      force: true,
    },
  );
}
