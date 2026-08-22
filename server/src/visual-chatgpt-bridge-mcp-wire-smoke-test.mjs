import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import readline from "node:readline";

const targetVisualId = "VIS-UPLOAD-20260711073438-623CB319";

const child = spawn(
  process.execPath,
  ["server/src/mcp-server.mjs"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TOOL_PROFILE: "chatgpt_public",
    },
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let stderr = "";

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const rl = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

const pending = new Map();

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;

  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    console.error("Non-JSON stdout from MCP server:");
    console.error(trimmed);
    return;
  }

  if (
    Object.prototype.hasOwnProperty.call(message, "id") &&
    pending.has(message.id)
  ) {
    const { resolve } = pending.get(message.id);
    pending.delete(message.id);
    resolve(message);
  }
});

function request(id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          `Timed out waiting for MCP response: ${method}\nSTDERR:\n${stderr}`,
        ),
      );
    }, 30000);

    pending.set(id, {
      resolve: (message) => {
        clearTimeout(timer);
        resolve(message);
      },
    });

    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }) + "\n",
    );
  });
}

function notify(method, params = {}) {
  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    }) + "\n",
  );
}

async function main() {
  console.log("=== Visual ChatGPT Bridge MCP Wire Test ===");

  const initialized = await request(
    1,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "visual-chatgpt-bridge-wire-test",
        version: "1.0.0",
      },
    },
  );

  assert(!initialized.error, JSON.stringify(initialized.error));

  console.log(
    "initialize:",
    initialized.result?.serverInfo?.name ?? "PASS",
  );

  notify("notifications/initialized", {});

  const tools = await request(
    2,
    "tools/list",
    {},
  );

  assert(!tools.error, JSON.stringify(tools.error));
  assert(Array.isArray(tools.result?.tools));

  const toolNames = new Set(
    tools.result.tools.map((tool) => tool.name),
  );

  assert(
    toolNames.has("chatgpt_bridge_search_visual_assets"),
    "tools/list missing chatgpt_bridge_search_visual_assets",
  );

  assert(
    toolNames.has("chatgpt_bridge_get_visual_asset"),
    "tools/list missing chatgpt_bridge_get_visual_asset",
  );

  console.log(
    "tools/list search tool: PASS",
  );

  console.log(
    "tools/list image tool : PASS",
  );

  const imageToolDefinition =
    tools.result.tools.find(
      (tool) =>
        tool.name ===
        "chatgpt_bridge_get_visual_asset",
    );

  assert.equal(
    imageToolDefinition.annotations?.readOnlyHint,
    true,
    "get visual asset tool is not marked readOnlyHint=true",
  );

  console.log(
    "readOnlyHint: PASS",
  );

  const search = await request(
    3,
    "tools/call",
    {
      name: "chatgpt_bridge_search_visual_assets",
      arguments: {
        query: "柊木璃央",
        limit: 10,
      },
    },
  );

  assert(!search.error, JSON.stringify(search.error));
  assert.equal(search.result?.isError, undefined);
  assert(Array.isArray(search.result?.content));

  const searchText = search.result.content.find(
    (part) => part.type === "text",
  );

  assert(searchText?.text);

  const searchData = JSON.parse(searchText.text);

  assert(
    searchData.results.some(
      (record) =>
        record.visual_id === targetVisualId,
    ),
    "search MCP call did not find 柊木璃央",
  );

  assert(
    !search.result.content.some(
      (part) => part.type === "image",
    ),
    "search MCP call unexpectedly returned image content",
  );

  console.log(
    "tools/call search: PASS",
  );

  const getImage = await request(
    4,
    "tools/call",
    {
      name: "chatgpt_bridge_get_visual_asset",
      arguments: {
        visual_id: targetVisualId,
      },
    },
  );

  assert(!getImage.error, JSON.stringify(getImage.error));
  assert.equal(
    getImage.result?.isError,
    undefined,
    JSON.stringify(getImage.result),
  );

  assert(
    Array.isArray(getImage.result?.content),
    "MCP image result has no content array",
  );

  const metadataPart =
    getImage.result.content.find(
      (part) => part.type === "text",
    );

  const imagePart =
    getImage.result.content.find(
      (part) => part.type === "image",
    );

  assert(
    metadataPart?.text,
    "MCP image result has no metadata text part",
  );

  assert(
    imagePart,
    "MCP image result has no native image part",
  );

  assert.equal(
    imagePart.mimeType,
    "image/png",
  );

  assert(
    typeof imagePart.data === "string" &&
      imagePart.data.length > 0,
    "MCP native image data is empty",
  );

  const decoded =
    Buffer.from(imagePart.data, "base64");

  const expectedPngHeader =
    Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

  assert(
    decoded
      .subarray(0, 8)
      .equals(expectedPngHeader),
    "Decoded MCP image is not PNG",
  );

  const metadata =
    JSON.parse(metadataPart.text);

  assert.equal(
    metadata.visual_id,
    targetVisualId,
  );

  console.log(
    "tools/call native image: PASS",
  );

  console.log(
    "mime type:",
    imagePart.mimeType,
  );

  console.log(
    "decoded bytes:",
    decoded.length,
  );

  console.log(
    "visual id:",
    metadata.visual_id,
  );

  console.log(
    "character:",
    metadata.character,
  );

  console.log("");
  console.log(
    "MCP NATIVE IMAGE CONTENT: PASS",
  );

  console.log(
    "CHATGPT PUBLIC VISUAL BRIDGE: PASS",
  );
}

try {
  await main();
} finally {
  rl.close();

  if (!child.killed) {
    child.kill();
  }
}
