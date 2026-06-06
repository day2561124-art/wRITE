import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");

const watchedFiles = [
  path.join(rootDir, "data", "canon_db", "active_engine.md"),
  path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(rootDir, "data", "longline_db", "active_longline.md"),
  path.join(rootDir, "data", "error_report_db", "compressed_rules.md"),
];

const forbiddenCreatedPaths = [
  path.join(rootDir, "data", "proofing_policy_db", "versions", "proofing_card_v999.999.md"),
  path.join(rootDir, "data", "outputs", "logs", "policy_import_backups"),
  path.join(rootDir, "data", "outputs", "logs", "policy_imports.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "engine_activations.jsonl"),
  path.join(rootDir, "data", "outputs", "logs", "compressed_rule_updates.jsonl"),
];

const expectedTools = [
  "get_current_project_state",
  "get_active_engine",
  "get_active_writing_card",
  "validate_jsonl",
  "query_mcp_audit",
  "build_generation_context",
  "search_context",
  "build_task_prompt",
  "run_pipeline",
  "add_feedback_raw",
  "save_draft",
  "save_proof_report",
  "import_policy_file",
  "commit_error_report",
  "compress_error_rules",
  "create_settlement_proposal",
  "activate_engine_version",
];

const invalidToolFixtures = [
  {
    label: "unknown tool name",
    params: {
      name: "not_a_real_tool",
    },
    expectedMessage: "Unknown tool: not_a_real_tool",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "tools/call params must be an object.",
  },
  {
    label: "missing tool name",
    params: {},
    expectedMessage: "name is required.",
  },
];

const toolLevelErrorFixtures = [
  {
    label: "non-positive audit limit",
    params: {
      name: "query_mcp_audit",
      arguments: {
        limit: 0,
      },
    },
    expectedMessage: "limit must be a positive integer.",
  },
  {
    label: "non-string audit tool filter",
    params: {
      name: "query_mcp_audit",
      arguments: {
        tool: 123,
      },
    },
    expectedMessage: "tool must be a string.",
  },
  {
    label: "non-boolean audit ordering",
    params: {
      name: "query_mcp_audit",
      arguments: {
        oldest: "yes",
      },
    },
    expectedMessage: "oldest must be a boolean.",
  },
];

const highRiskConfirmationFixtures = [
  {
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      dryRun: false,
    },
    expectedMessage: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
  },
  {
    name: "commit_error_report",
    arguments: {
      latest: true,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
  },
  {
    name: "compress_error_rules",
    arguments: {
      updateActive: true,
      allowEmpty: true,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
  },
  {
    name: "create_settlement_proposal",
    arguments: {
      chapter: "SMOKE",
      title: "Confirmation guard smoke",
      text: "This text must never be written.",
      confirmAdopted: false,
      dryRun: false,
    },
    expectedMessage: "Confirmation required: create_settlement_proposal real writes require confirmAdopted=true.",
  },
  {
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
      dryRun: false,
    },
    expectedMessage: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
  },
];

const wrongConfirmationFixtures = [
  {
    name: "import_policy_file",
    token: "WRONG_IMPORT_TOKEN",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
      dryRun: false,
      confirm: "WRONG_IMPORT_TOKEN",
    },
    expectedMessage: "Confirmation required: import_policy_file real writes require confirm=IMPORT_POLICY.",
  },
  {
    name: "commit_error_report",
    token: "WRONG_COMMIT_TOKEN",
    arguments: {
      latest: true,
      dryRun: false,
      confirm: "WRONG_COMMIT_TOKEN",
    },
    expectedMessage: "Confirmation required: commit_error_report real writes require confirm=COMMIT.",
  },
  {
    name: "compress_error_rules",
    token: "WRONG_RULES_TOKEN",
    arguments: {
      updateActive: true,
      allowEmpty: true,
      dryRun: false,
      confirm: "WRONG_RULES_TOKEN",
    },
    expectedMessage: "Confirmation required: compress_error_rules active updates require confirm=UPDATE_RULES.",
  },
  {
    name: "activate_engine_version",
    token: "WRONG_ACTIVATE_TOKEN",
    arguments: {
      version: "v5.0.12",
      dryRun: false,
      confirm: "WRONG_ACTIVATE_TOKEN",
    },
    expectedMessage: "Confirmation required: activate_engine_version real writes require confirm=ACTIVATE.",
  },
];

const expectedResources = [
  "armed-academy://canon/active_engine",
  "armed-academy://outputs/task_prompt",
  "armed-academy://jsonl/data:outputs:logs:mcp_tool_audit.jsonl",
];

const invalidResourceFixtures = [
  {
    label: "unknown resource URI",
    params: {
      uri: "armed-academy://not-a-real-resource",
    },
    expectedMessage: "Unknown resource URI: armed-academy://not-a-real-resource",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "resources/read params must be an object.",
  },
  {
    label: "missing resource URI",
    params: {},
    expectedMessage: "uri is required.",
  },
];

const promptFixtures = [
  {
    name: "generate_chapter",
    arguments: {
      task: "smoke test generate",
      query: "朝日奈千夜 九逃",
    },
    expectedFragments: [
      "# 下一章正文候選 Prompt｜正式模板",
      "## 正文輸出格式",
    ],
  },
  {
    name: "proofread_draft",
    arguments: {
      draft_id: "SMOKE-DRAFT-001",
    },
    expectedFragments: [
      "# 正式採用前驗稿精修 Prompt｜正式模板",
      "## Canon Guard",
    ],
  },
  {
    name: "settle_chapter",
    arguments: {
      chapter: "第二十章",
    },
    expectedFragments: [
      "# 章節正式結算模板",
      "## 正式成立事項",
    ],
  },
  {
    name: "compress_errors",
    arguments: {
      source_scope: "formal error reports",
    },
    expectedFragments: [
      "# 錯誤報告壓縮模板",
      "## 壓縮後正式規則",
    ],
  },
  {
    name: "rewrite_by_errors",
    arguments: {
      draft_id: "SMOKE-DRAFT-001",
      error_focus: "Canon Guard",
    },
    expectedFragments: [
      "# 依錯誤報告重寫模板",
      "## Canon Guard 自查",
    ],
  },
];

const expectedPrompts = promptFixtures.map((fixture) => fixture.name);

const invalidPromptFixtures = [
  {
    label: "unknown prompt name",
    params: {
      name: "not_a_real_prompt",
    },
    expectedMessage: "Unknown prompt: not_a_real_prompt",
  },
  {
    label: "non-object params",
    params: null,
    expectedMessage: "prompts/get params must be an object.",
  },
  {
    label: "missing prompt name",
    params: {},
    expectedMessage: "name is required.",
  },
];

const invalidJsonRpcFixtures = [
  {
    label: "unknown method",
    message: {
      jsonrpc: "2.0",
      method: "not/a/real/method",
      params: {},
    },
    expectedCode: -32601,
    expectedMessage: "Method not found: not/a/real/method",
  },
  {
    label: "invalid request",
    message: {
      jsonrpc: "2.0",
      params: {},
    },
    expectedCode: -32600,
    expectedMessage: "Invalid Request",
  },
];

function usage() {
  return [
    "Usage:",
    "  node server/src/mcp-smoke-test.mjs [--verbose]",
    "",
    "What it checks:",
    "  - Starts server/src/mcp-server.mjs over stdio.",
    "  - Runs initialize, tools/list, and safe tools/call requests.",
    "  - Verifies expected tool names are exposed.",
    "  - Verifies invalid tools/call requests return JSON-RPC -32602 errors.",
    "  - Verifies known read-tool argument errors return result.isError instead of protocol errors.",
    "  - Verifies high-risk real-write requests fail without explicit confirmation.",
    "  - Verifies incorrect confirmation tokens are rejected and preserved in audit records.",
    "  - Verifies resources/list and resources/read expose readable project data.",
    "  - Verifies invalid resources/read requests return JSON-RPC -32602 errors.",
    "  - Verifies prompts/list and prompts/get expose all prompt fixtures and runtime arguments.",
    "  - Verifies invalid prompts/get requests return JSON-RPC -32602 errors.",
    "  - Verifies JSON-RPC method, request, and parse errors return -32601, -32600, and -32700.",
    "  - Verifies Content-Length and newline framing can coexist on one connection.",
    "  - Verifies Content-Length headers and multibyte UTF-8 bodies survive chunked writes.",
    "  - Verifies two Content-Length frames can be consumed from one write.",
    "  - Verifies one Content-Length frame and one newline frame can share one write.",
    "  - Verifies one newline frame followed by one Content-Length frame can share one write.",
    "  - Verifies malformed Content-Length headers return header-framed -32700 and recover.",
    "  - Verifies invalid JSON bodies with valid Content-Length return header-framed -32700 and recover.",
    "  - Verifies import_policy_file, activate_engine_version, and compress_error_rules stay dry-run by default.",
    "  - Verifies MCP write audit records are appended.",
    "  - Verifies active policy files and compressed_rules.md hashes are unchanged.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    verbose: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

async function hashFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return hashText(text);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function countJsonlRecords(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function readJsonlRecords(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function snapshotWatchedFiles() {
  const entries = await Promise.all(
    watchedFiles.map(async (filePath) => [normalizePath(filePath), await hashFile(filePath)]),
  );
  return new Map(entries);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeRequest(id, method, params) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

function makeNotification(method, params = {}) {
  return {
    jsonrpc: "2.0",
    method,
    params,
  };
}

function sendMessage(child, message, verbose) {
  const line = JSON.stringify(message);
  if (verbose) {
    console.log(`--> ${line}`);
  }
  child.stdin.write(`${line}\n`);
}

function sendRawLine(child, line, verbose) {
  if (verbose) {
    console.log(`--> [raw] ${line}`);
  }
  child.stdin.write(`${line}\n`);
}

function encodeHeaderFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  return {
    body,
    header,
    frame: Buffer.concat([header, body]),
  };
}

function sendHeaderMessage(child, message, verbose) {
  const { frame } = encodeHeaderFrame(message);
  if (verbose) {
    console.log(`--> [header] ${frame.toString("utf8")}`);
  }
  child.stdin.write(frame);
}

function writeChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function waitForChunkBoundary() {
  return new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

async function sendChunkedHeaderMessage(child, message, marker, verbose) {
  const { body, header, frame } = encodeHeaderFrame(message);
  const markerOffset = body.indexOf(Buffer.from(marker, "utf8"));
  assert(markerOffset >= 0, `Chunk marker not found in header-framed body: ${marker}`);

  const splitOffsets = [
    8,
    header.length - 1,
    header.length,
    header.length + markerOffset + 1,
    frame.length,
  ];

  let start = 0;
  for (const [index, end] of splitOffsets.entries()) {
    const chunk = frame.subarray(start, end);
    if (verbose) {
      console.log(`--> [header chunk ${index + 1}/${splitOffsets.length}] ${chunk.toString("hex")}`);
    }
    await writeChunk(child.stdin, chunk);
    start = end;
    if (index < splitOffsets.length - 1) {
      await waitForChunkBoundary();
    }
  }

  return splitOffsets.length;
}

async function sendBackToBackHeaderMessages(child, messages, verbose) {
  const frames = messages.map((message) => encodeHeaderFrame(message).frame);
  const payload = Buffer.concat(frames);
  if (verbose) {
    console.log(`--> [header batch ${frames.length} frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: frames.length,
    writes: 1,
  };
}

async function sendMixedBatchMessages(child, headerMessage, lineMessage, verbose) {
  const headerFrame = encodeHeaderFrame(headerMessage).frame;
  const lineFrame = Buffer.from(`${JSON.stringify(lineMessage)}\n`, "utf8");
  const payload = Buffer.concat([headerFrame, lineFrame]);
  if (verbose) {
    console.log(`--> [mixed batch 2 frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: 2,
    writes: 1,
  };
}

async function sendReverseMixedBatchMessages(child, lineMessage, headerMessage, verbose) {
  const lineFrame = Buffer.from(`${JSON.stringify(lineMessage)}\n`, "utf8");
  const headerFrame = encodeHeaderFrame(headerMessage).frame;
  const payload = Buffer.concat([lineFrame, headerFrame]);
  if (verbose) {
    console.log(`--> [reverse mixed batch 2 frames / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    frames: 2,
    writes: 1,
  };
}

async function sendMalformedHeaderWithRecovery(child, recoveryMessage, verbose) {
  const malformedHeader = Buffer.from("Content-Length: not-a-number\r\n\r\n", "ascii");
  const recoveryFrame = Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8");
  const payload = Buffer.concat([malformedHeader, recoveryFrame]);
  if (verbose) {
    console.log(`--> [malformed header + recovery / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    errors: 1,
    recovery_frames: 1,
    writes: 1,
  };
}

async function sendMalformedBodyWithRecovery(child, recoveryMessage, verbose) {
  const malformedBody = Buffer.from("{\"jsonrpc\":\"2.0\",invalid-body", "utf8");
  const header = Buffer.from(`Content-Length: ${malformedBody.length}\r\n\r\n`, "ascii");
  const recoveryFrame = Buffer.from(`${JSON.stringify(recoveryMessage)}\n`, "utf8");
  const payload = Buffer.concat([header, malformedBody, recoveryFrame]);
  if (verbose) {
    console.log(`--> [malformed body + recovery / 1 write] ${payload.toString("utf8")}`);
  }
  await writeChunk(child.stdin, payload);
  return {
    errors: 1,
    recovery_frames: 1,
    writes: 1,
  };
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}\n${line}`);
  }
}

function waitForResponse(responses, id, timeoutMs) {
  const queued = responses.queued.get(id);
  if (queued?.length) {
    const message = queued.shift();
    if (queued.length === 0) {
      responses.queued.delete(id);
    }
    return Promise.resolve(message);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for response id ${id}.`));
    }, timeoutMs);

    const waiters = responses.waiters.get(id) ?? [];
    waiters.push({
      resolve: (message) => {
        clearTimeout(timeout);
        resolve(message);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    responses.waiters.set(id, waiters);
  });
}

function recordResponse(responses, message) {
  const waiters = responses.waiters.get(message.id);
  if (waiters?.length) {
    const waiter = waiters.shift();
    if (waiters.length === 0) {
      responses.waiters.delete(message.id);
    }
    waiter.resolve(message);
    return;
  }

  const queued = responses.queued.get(message.id) ?? [];
  queued.push(message);
  responses.queued.set(message.id, queued);
}

async function runSmokeTest(options) {
  const before = await snapshotWatchedFiles();
  const auditCountBefore = await countJsonlRecords(auditLogPath);
  const expectedAuditRecordsAdded = (
    3
    + highRiskConfirmationFixtures.length
    + wrongConfirmationFixtures.length
  );
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdoutBuffer = Buffer.alloc(0);
  let stderrBuffer = "";
  const responses = {
    queued: new Map(),
    waiters: new Map(),
  };
  const responseFramings = new WeakMap();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer = Buffer.concat([
      stdoutBuffer,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"),
    ]);

    while (stdoutBuffer.length > 0) {
      const prefix = stdoutBuffer.subarray(0, 32).toString("ascii");
      if (/^Content-Length:/i.test(prefix)) {
        const headerEnd = stdoutBuffer.indexOf(Buffer.from("\r\n\r\n"));
        if (headerEnd === -1) {
          return;
        }

        const header = stdoutBuffer.subarray(0, headerEnd).toString("ascii");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          throw new Error(`Invalid Content-Length response header: ${header}`);
        }

        const length = Number.parseInt(match[1], 10);
        const bodyStart = headerEnd + 4;
        if (stdoutBuffer.length < bodyStart + length) {
          return;
        }

        const body = stdoutBuffer.subarray(bodyStart, bodyStart + length).toString("utf8");
        stdoutBuffer = stdoutBuffer.subarray(bodyStart + length);
        if (options.verbose) {
          console.log(`<-- [header] ${body}`);
        }
        const message = parseJsonLine(body);
        responseFramings.set(message, "header");
        recordResponse(responses, message);
        continue;
      }

      const newlineIndex = stdoutBuffer.indexOf(0x0a);
      if (newlineIndex === -1) {
        return;
      }

      const line = stdoutBuffer.subarray(0, newlineIndex).toString("utf8").trim();
      stdoutBuffer = stdoutBuffer.subarray(newlineIndex + 1);
      if (!line) {
        continue;
      }
      if (options.verbose) {
        console.log(`<-- [line] ${line}`);
      }
      const message = parseJsonLine(line);
      responseFramings.set(message, "line");
      recordResponse(responses, message);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
  });

  child.on("error", (error) => {
    for (const waiters of responses.waiters.values()) {
      for (const waiter of waiters) {
        waiter.reject(error);
      }
    }
    responses.waiters.clear();
  });

  sendMessage(child, makeRequest(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "mcp-smoke-test",
      version: "0.1.0",
    },
  }), options.verbose);
  sendMessage(child, makeNotification("notifications/initialized"), options.verbose);
  sendMessage(child, makeRequest(2, "tools/list", {}), options.verbose);
  sendMessage(child, makeRequest(3, "tools/call", {
    name: "get_current_project_state",
    arguments: {
      includeHashes: false,
    },
  }), options.verbose);
  sendMessage(child, makeRequest(4, "tools/call", {
    name: "validate_jsonl",
    arguments: {
      files: ["data/feedback_db/pending_error_reports.jsonl"],
    },
  }), options.verbose);
  sendMessage(child, makeRequest(5, "tools/call", {
    name: "compress_error_rules",
    arguments: {},
  }), options.verbose);
  sendMessage(child, makeRequest(6, "tools/call", {
    name: "activate_engine_version",
    arguments: {
      version: "v5.0.12",
    },
  }), options.verbose);
  sendMessage(child, makeRequest(7, "tools/call", {
    name: "import_policy_file",
    arguments: {
      kind: "proofing",
      source: "README.md",
      version: "v999.999",
    },
  }), options.verbose);
  sendMessage(child, makeRequest(8, "tools/call", {
    name: "query_mcp_audit",
    arguments: {
      tool: "import_policy_file",
      confirmationId: "none",
      limit: 2,
      json: true,
    },
  }), options.verbose);
  sendMessage(child, makeRequest(9, "resources/list", {}), options.verbose);
  sendMessage(child, makeRequest(10, "resources/read", {
    uri: "armed-academy://error-report/compressed_rules",
  }), options.verbose);
  sendMessage(child, makeRequest(11, "prompts/list", {}), options.verbose);
  const firstPromptRequestId = 12;
  for (const [index, fixture] of promptFixtures.entries()) {
    sendMessage(child, makeRequest(firstPromptRequestId + index, "prompts/get", {
      name: fixture.name,
      arguments: fixture.arguments,
    }), options.verbose);
  }
  const firstInvalidPromptRequestId = firstPromptRequestId + promptFixtures.length;
  for (const [index, fixture] of invalidPromptFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidPromptRequestId + index, "prompts/get", fixture.params),
      options.verbose,
    );
  }
  const postInvalidPingRequestId = firstInvalidPromptRequestId + invalidPromptFixtures.length;
  sendMessage(child, makeRequest(postInvalidPingRequestId, "ping", {}), options.verbose);
  const firstInvalidResourceRequestId = postInvalidPingRequestId + 1;
  for (const [index, fixture] of invalidResourceFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidResourceRequestId + index, "resources/read", fixture.params),
      options.verbose,
    );
  }
  const postInvalidResourcePingRequestId = (
    firstInvalidResourceRequestId + invalidResourceFixtures.length
  );
  sendMessage(child, makeRequest(postInvalidResourcePingRequestId, "ping", {}), options.verbose);
  const firstInvalidToolRequestId = postInvalidResourcePingRequestId + 1;
  for (const [index, fixture] of invalidToolFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstInvalidToolRequestId + index, "tools/call", fixture.params),
      options.verbose,
    );
  }
  const postInvalidToolPingRequestId = firstInvalidToolRequestId + invalidToolFixtures.length;
  sendMessage(child, makeRequest(postInvalidToolPingRequestId, "ping", {}), options.verbose);
  const firstToolLevelErrorRequestId = postInvalidToolPingRequestId + 1;
  for (const [index, fixture] of toolLevelErrorFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstToolLevelErrorRequestId + index, "tools/call", fixture.params),
      options.verbose,
    );
  }
  const postToolLevelErrorPingRequestId = (
    firstToolLevelErrorRequestId + toolLevelErrorFixtures.length
  );
  sendMessage(child, makeRequest(postToolLevelErrorPingRequestId, "ping", {}), options.verbose);
  const firstHighRiskConfirmationRequestId = postToolLevelErrorPingRequestId + 1;
  for (const [index, fixture] of highRiskConfirmationFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstHighRiskConfirmationRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-confirmation",
        },
      }),
      options.verbose,
    );
  }
  const postHighRiskConfirmationPingRequestId = (
    firstHighRiskConfirmationRequestId + highRiskConfirmationFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postHighRiskConfirmationPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstWrongConfirmationRequestId = postHighRiskConfirmationPingRequestId + 1;
  for (const [index, fixture] of wrongConfirmationFixtures.entries()) {
    sendMessage(
      child,
      makeRequest(firstWrongConfirmationRequestId + index, "tools/call", {
        name: fixture.name,
        arguments: fixture.arguments,
        _meta: {
          actor: "mcp-smoke-wrong-confirmation",
        },
      }),
      options.verbose,
    );
  }
  const postWrongConfirmationPingRequestId = (
    firstWrongConfirmationRequestId + wrongConfirmationFixtures.length
  );
  sendMessage(
    child,
    makeRequest(postWrongConfirmationPingRequestId, "ping", {}),
    options.verbose,
  );
  const firstInvalidJsonRpcRequestId = postWrongConfirmationPingRequestId + 1;
  for (const [index, fixture] of invalidJsonRpcFixtures.entries()) {
    sendMessage(
      child,
      {
        ...fixture.message,
        id: firstInvalidJsonRpcRequestId + index,
      },
      options.verbose,
    );
  }
  sendRawLine(child, "{\"jsonrpc\":\"2.0\",invalid-json", options.verbose);
  const postParseErrorPingRequestId = firstInvalidJsonRpcRequestId + invalidJsonRpcFixtures.length;
  sendMessage(child, makeRequest(postParseErrorPingRequestId, "ping", {}), options.verbose);
  const headerPingRequestId = postParseErrorPingRequestId + 1;
  sendHeaderMessage(child, makeRequest(headerPingRequestId, "ping", {
    marker: "武裝學院 framing smoke",
  }), options.verbose);
  const postHeaderLinePingRequestId = headerPingRequestId + 1;
  sendMessage(child, makeRequest(postHeaderLinePingRequestId, "ping", {}), options.verbose);
  const chunkedHeaderPingRequestId = postHeaderLinePingRequestId + 1;
  const chunkedHeaderWriteCount = await sendChunkedHeaderMessage(
    child,
    makeRequest(chunkedHeaderPingRequestId, "ping", {
      marker: "分片測試",
    }),
    "分片測試",
    options.verbose,
  );
  const postChunkedLinePingRequestId = chunkedHeaderPingRequestId + 1;
  sendMessage(child, makeRequest(postChunkedLinePingRequestId, "ping", {}), options.verbose);
  const firstBackToBackPingRequestId = postChunkedLinePingRequestId + 1;
  const backToBackWriteResult = await sendBackToBackHeaderMessages(
    child,
    [
      makeRequest(firstBackToBackPingRequestId, "ping", {
        marker: "連續第一幀",
      }),
      makeRequest(firstBackToBackPingRequestId + 1, "ping", {
        marker: "連續第二幀",
      }),
    ],
    options.verbose,
  );
  const postBackToBackLinePingRequestId = firstBackToBackPingRequestId + 2;
  sendMessage(child, makeRequest(postBackToBackLinePingRequestId, "ping", {}), options.verbose);
  const mixedBatchHeaderPingRequestId = postBackToBackLinePingRequestId + 1;
  const mixedBatchLinePingRequestId = mixedBatchHeaderPingRequestId + 1;
  const mixedBatchWriteResult = await sendMixedBatchMessages(
    child,
    makeRequest(mixedBatchHeaderPingRequestId, "ping", {
      marker: "混合批次標頭幀",
    }),
    makeRequest(mixedBatchLinePingRequestId, "ping", {
      marker: "混合批次換行幀",
    }),
    options.verbose,
  );
  const postMixedBatchPingRequestId = mixedBatchLinePingRequestId + 1;
  sendMessage(child, makeRequest(postMixedBatchPingRequestId, "ping", {}), options.verbose);
  const reverseMixedBatchLinePingRequestId = postMixedBatchPingRequestId + 1;
  const reverseMixedBatchHeaderPingRequestId = reverseMixedBatchLinePingRequestId + 1;
  const reverseMixedBatchWriteResult = await sendReverseMixedBatchMessages(
    child,
    makeRequest(reverseMixedBatchLinePingRequestId, "ping", {
      marker: "反向混合換行幀",
    }),
    makeRequest(reverseMixedBatchHeaderPingRequestId, "ping", {
      marker: "反向混合標頭幀",
    }),
    options.verbose,
  );
  const postReverseMixedBatchPingRequestId = reverseMixedBatchHeaderPingRequestId + 1;
  sendMessage(
    child,
    makeRequest(postReverseMixedBatchPingRequestId, "ping", {}),
    options.verbose,
  );
  const malformedHeaderRecoveryPingRequestId = postReverseMixedBatchPingRequestId + 1;
  const malformedHeaderWriteResult = await sendMalformedHeaderWithRecovery(
    child,
    makeRequest(malformedHeaderRecoveryPingRequestId, "ping", {
      marker: "壞標頭後恢復",
    }),
    options.verbose,
  );
  const malformedBodyRecoveryPingRequestId = malformedHeaderRecoveryPingRequestId + 1;
  const malformedBodyWriteResult = await sendMalformedBodyWithRecovery(
    child,
    makeRequest(malformedBodyRecoveryPingRequestId, "ping", {
      marker: "壞內容後恢復",
    }),
    options.verbose,
  );

  const initialize = await waitForResponse(responses, 1, 10_000);
  const toolsList = await waitForResponse(responses, 2, 10_000);
  const projectState = await waitForResponse(responses, 3, 10_000);
  const validateJsonl = await waitForResponse(responses, 4, 10_000);
  const compressRules = await waitForResponse(responses, 5, 10_000);
  const activateEngine = await waitForResponse(responses, 6, 10_000);
  const importPolicy = await waitForResponse(responses, 7, 10_000);
  const queryAudit = await waitForResponse(responses, 8, 10_000);
  const resourcesList = await waitForResponse(responses, 9, 10_000);
  const resourceRead = await waitForResponse(responses, 10, 10_000);
  const promptsList = await waitForResponse(responses, 11, 10_000);
  const promptGets = await Promise.all(
    promptFixtures.map((_, index) => waitForResponse(responses, firstPromptRequestId + index, 10_000)),
  );
  const invalidPromptGets = await Promise.all(
    invalidPromptFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidPromptRequestId + index, 10_000)
    )),
  );
  const postInvalidPing = await waitForResponse(responses, postInvalidPingRequestId, 10_000);
  const invalidResourceReads = await Promise.all(
    invalidResourceFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidResourceRequestId + index, 10_000)
    )),
  );
  const postInvalidResourcePing = await waitForResponse(
    responses,
    postInvalidResourcePingRequestId,
    10_000,
  );
  const invalidToolCalls = await Promise.all(
    invalidToolFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidToolRequestId + index, 10_000)
    )),
  );
  const postInvalidToolPing = await waitForResponse(
    responses,
    postInvalidToolPingRequestId,
    10_000,
  );
  const toolLevelErrorCalls = await Promise.all(
    toolLevelErrorFixtures.map((_, index) => (
      waitForResponse(responses, firstToolLevelErrorRequestId + index, 10_000)
    )),
  );
  const postToolLevelErrorPing = await waitForResponse(
    responses,
    postToolLevelErrorPingRequestId,
    10_000,
  );
  const highRiskConfirmationCalls = await Promise.all(
    highRiskConfirmationFixtures.map((_, index) => (
      waitForResponse(responses, firstHighRiskConfirmationRequestId + index, 10_000)
    )),
  );
  const postHighRiskConfirmationPing = await waitForResponse(
    responses,
    postHighRiskConfirmationPingRequestId,
    10_000,
  );
  const wrongConfirmationCalls = await Promise.all(
    wrongConfirmationFixtures.map((_, index) => (
      waitForResponse(responses, firstWrongConfirmationRequestId + index, 10_000)
    )),
  );
  const postWrongConfirmationPing = await waitForResponse(
    responses,
    postWrongConfirmationPingRequestId,
    10_000,
  );
  const invalidJsonRpcResponses = await Promise.all(
    invalidJsonRpcFixtures.map((_, index) => (
      waitForResponse(responses, firstInvalidJsonRpcRequestId + index, 10_000)
    )),
  );
  const parseErrorResponse = await waitForResponse(responses, null, 10_000);
  const postParseErrorPing = await waitForResponse(
    responses,
    postParseErrorPingRequestId,
    10_000,
  );
  const headerPing = await waitForResponse(responses, headerPingRequestId, 10_000);
  const postHeaderLinePing = await waitForResponse(
    responses,
    postHeaderLinePingRequestId,
    10_000,
  );
  const chunkedHeaderPing = await waitForResponse(
    responses,
    chunkedHeaderPingRequestId,
    10_000,
  );
  const postChunkedLinePing = await waitForResponse(
    responses,
    postChunkedLinePingRequestId,
    10_000,
  );
  const backToBackPings = await Promise.all([
    waitForResponse(responses, firstBackToBackPingRequestId, 10_000),
    waitForResponse(responses, firstBackToBackPingRequestId + 1, 10_000),
  ]);
  const postBackToBackLinePing = await waitForResponse(
    responses,
    postBackToBackLinePingRequestId,
    10_000,
  );
  const mixedBatchHeaderPing = await waitForResponse(
    responses,
    mixedBatchHeaderPingRequestId,
    10_000,
  );
  const mixedBatchLinePing = await waitForResponse(
    responses,
    mixedBatchLinePingRequestId,
    10_000,
  );
  const postMixedBatchPing = await waitForResponse(
    responses,
    postMixedBatchPingRequestId,
    10_000,
  );
  const reverseMixedBatchLinePing = await waitForResponse(
    responses,
    reverseMixedBatchLinePingRequestId,
    10_000,
  );
  const reverseMixedBatchHeaderPing = await waitForResponse(
    responses,
    reverseMixedBatchHeaderPingRequestId,
    10_000,
  );
  const postReverseMixedBatchPing = await waitForResponse(
    responses,
    postReverseMixedBatchPingRequestId,
    10_000,
  );
  const malformedHeaderError = await waitForResponse(responses, null, 10_000);
  const malformedHeaderRecoveryPing = await waitForResponse(
    responses,
    malformedHeaderRecoveryPingRequestId,
    10_000,
  );
  const malformedBodyError = await waitForResponse(responses, null, 10_000);
  const malformedBodyRecoveryPing = await waitForResponse(
    responses,
    malformedBodyRecoveryPingRequestId,
    10_000,
  );

  child.stdin.end();
  child.kill();

  assert(!initialize.error, `initialize failed: ${JSON.stringify(initialize.error)}`);
  assert(initialize.result?.serverInfo?.name === "armed-academy-fiction-engine", "initialize returned unexpected serverInfo.");

  assert(!toolsList.error, `tools/list failed: ${JSON.stringify(toolsList.error)}`);
  const toolNames = new Set((toolsList.result?.tools ?? []).map((tool) => tool.name));
  for (const expectedTool of expectedTools) {
    assert(toolNames.has(expectedTool), `tools/list missing expected tool: ${expectedTool}`);
  }

  const projectText = projectState.result?.content?.[0]?.text ?? "";
  assert(projectText.includes("\"project\": \"武裝學院的二三事\""), "get_current_project_state returned unexpected content.");

  const validateText = validateJsonl.result?.content?.[0]?.text ?? "";
  assert(validateText.includes("Validated 1 files"), "validate_jsonl single-file call did not validate exactly one file.");
  assert(validateText.includes("0 errors"), "validate_jsonl reported errors.");

  const compressText = compressRules.result?.content?.[0]?.text ?? "";
  assert(compressText.includes("Dry run: yes"), "compress_error_rules did not default to dry-run.");
  assert(compressText.includes("No files written."), "compress_error_rules dry-run did not report no writes.");

  const activateText = activateEngine.result?.content?.[0]?.text ?? "";
  assert(activateText.includes("Dry run: yes"), "activate_engine_version did not default to dry-run.");
  assert(activateText.includes("Dry run complete. No files written."), "activate_engine_version dry-run did not report no writes.");

  const importText = importPolicy.result?.content?.[0]?.text ?? "";
  assert(importText.includes("Dry run: yes"), "import_policy_file did not default to dry-run.");
  assert(importText.includes("Dry run complete. No files written."), "import_policy_file dry-run did not report no writes.");

  const queryAuditText = queryAudit.result?.content?.[0]?.text ?? "";
  assert(queryAuditText.includes("\"matched_records\""), "query_mcp_audit did not return JSON summary.");
  assert(queryAuditText.includes("\"import_policy_file\""), "query_mcp_audit did not find import_policy_file audit records.");

  assert(!resourcesList.error, `resources/list failed: ${JSON.stringify(resourcesList.error)}`);
  const resourceUris = new Set((resourcesList.result?.resources ?? []).map((resource) => resource.uri));
  for (const expectedResource of expectedResources) {
    assert(resourceUris.has(expectedResource), `resources/list missing expected resource: ${expectedResource}`);
  }

  assert(!resourceRead.error, `resources/read failed: ${JSON.stringify(resourceRead.error)}`);
  const resourceText = resourceRead.result?.contents?.[0]?.text ?? "";
  assert(resourceText.includes("錯誤壓縮規則"), "resources/read did not return compressed_rules.md content.");

  assert(!promptsList.error, `prompts/list failed: ${JSON.stringify(promptsList.error)}`);
  const promptsByName = new Map(
    (promptsList.result?.prompts ?? []).map((prompt) => [prompt.name, prompt]),
  );
  const promptNames = new Set(promptsByName.keys());
  for (const expectedPrompt of expectedPrompts) {
    assert(promptNames.has(expectedPrompt), `prompts/list missing expected prompt: ${expectedPrompt}`);
  }

  for (const [index, fixture] of promptFixtures.entries()) {
    const publicPrompt = promptsByName.get(fixture.name);
    const declaredArguments = new Set(
      (publicPrompt?.arguments ?? []).map((argument) => argument.name),
    );
    for (const argumentName of Object.keys(fixture.arguments)) {
      assert(
        declaredArguments.has(argumentName),
        `prompts/list ${fixture.name} missing fixture argument: ${argumentName}`,
      );
    }

    const promptGet = promptGets[index];
    assert(
      !promptGet.error,
      `prompts/get ${fixture.name} failed: ${JSON.stringify(promptGet.error)}`,
    );
    const promptText = promptGet.result?.messages?.[0]?.content?.text ?? "";
    for (const fragment of fixture.expectedFragments) {
      assert(
        promptText.includes(fragment),
        `prompts/get ${fixture.name} missing expected fragment: ${fragment}`,
      );
    }
    assert(
      promptText.includes("## Runtime Arguments"),
      `prompts/get ${fixture.name} did not include runtime arguments.`,
    );
    assert(
      promptText.includes(JSON.stringify(fixture.arguments, null, 2)),
      `prompts/get ${fixture.name} did not preserve fixture arguments.`,
    );
  }

  for (const [index, fixture] of invalidPromptFixtures.entries()) {
    const promptGet = invalidPromptGets[index];
    assert(
      promptGet.error?.code === -32602,
      `prompts/get ${fixture.label} returned unexpected error: ${JSON.stringify(promptGet.error)}`,
    );
    assert(
      promptGet.error?.message === fixture.expectedMessage,
      `prompts/get ${fixture.label} returned unexpected message: ${promptGet.error?.message}`,
    );
  }
  assert(
    !postInvalidPing.error,
    `ping after invalid prompts/get requests failed: ${JSON.stringify(postInvalidPing.error)}`,
  );

  for (const [index, fixture] of invalidResourceFixtures.entries()) {
    const resourceReadError = invalidResourceReads[index];
    assert(
      resourceReadError.error?.code === -32602,
      `resources/read ${fixture.label} returned unexpected error: ${JSON.stringify(resourceReadError.error)}`,
    );
    assert(
      resourceReadError.error?.message === fixture.expectedMessage,
      `resources/read ${fixture.label} returned unexpected message: ${resourceReadError.error?.message}`,
    );
  }
  assert(
    !postInvalidResourcePing.error,
    `ping after invalid resources/read requests failed: ${JSON.stringify(postInvalidResourcePing.error)}`,
  );

  for (const [index, fixture] of invalidToolFixtures.entries()) {
    const toolCallError = invalidToolCalls[index];
    assert(
      toolCallError.error?.code === -32602,
      `tools/call ${fixture.label} returned unexpected error: ${JSON.stringify(toolCallError.error)}`,
    );
    assert(
      toolCallError.error?.message === fixture.expectedMessage,
      `tools/call ${fixture.label} returned unexpected message: ${toolCallError.error?.message}`,
    );
  }
  assert(
    !postInvalidToolPing.error,
    `ping after invalid tools/call requests failed: ${JSON.stringify(postInvalidToolPing.error)}`,
  );

  for (const [index, fixture] of toolLevelErrorFixtures.entries()) {
    const response = toolLevelErrorCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `tool-level ${fixture.label} unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `tool-level ${fixture.label} did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `tool-level ${fixture.label} returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postToolLevelErrorPing.error,
    `ping after tool-level errors failed: ${JSON.stringify(postToolLevelErrorPing.error)}`,
  );

  for (const [index, fixture] of highRiskConfirmationFixtures.entries()) {
    const response = highRiskConfirmationCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} confirmation guard unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} confirmation guard did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.name} confirmation guard returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postHighRiskConfirmationPing.error,
    `ping after high-risk confirmation errors failed: ${JSON.stringify(postHighRiskConfirmationPing.error)}`,
  );

  for (const [index, fixture] of wrongConfirmationFixtures.entries()) {
    const response = wrongConfirmationCalls[index];
    const errorText = response.result?.content?.[0]?.text ?? "";
    assert(
      !response.error,
      `${fixture.name} wrong confirmation unexpectedly returned a protocol error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.result?.isError === true,
      `${fixture.name} wrong confirmation did not set result.isError: ${JSON.stringify(response.result)}`,
    );
    assert(
      errorText === fixture.expectedMessage,
      `${fixture.name} wrong confirmation returned unexpected message: ${errorText}`,
    );
  }
  assert(
    !postWrongConfirmationPing.error,
    `ping after wrong confirmation errors failed: ${JSON.stringify(postWrongConfirmationPing.error)}`,
  );

  for (const [index, fixture] of invalidJsonRpcFixtures.entries()) {
    const response = invalidJsonRpcResponses[index];
    assert(
      response.error?.code === fixture.expectedCode,
      `${fixture.label} returned unexpected error: ${JSON.stringify(response.error)}`,
    );
    assert(
      response.error?.message === fixture.expectedMessage,
      `${fixture.label} returned unexpected message: ${response.error?.message}`,
    );
  }
  assert(
    parseErrorResponse.error?.code === -32700,
    `parse error returned unexpected error: ${JSON.stringify(parseErrorResponse.error)}`,
  );
  assert(
    parseErrorResponse.error?.message?.startsWith("Parse error:"),
    `parse error returned unexpected message: ${parseErrorResponse.error?.message}`,
  );
  assert(
    !postParseErrorPing.error,
    `ping after parse error failed: ${JSON.stringify(postParseErrorPing.error)}`,
  );
  assert(
    !headerPing.error && responseFramings.get(headerPing) === "header",
    `Content-Length ping did not return a header-framed response: ${JSON.stringify(headerPing)}`,
  );
  assert(
    !postHeaderLinePing.error && responseFramings.get(postHeaderLinePing) === "line",
    `newline ping after Content-Length request did not return a line-framed response: ${JSON.stringify(postHeaderLinePing)}`,
  );
  assert(
    !chunkedHeaderPing.error && responseFramings.get(chunkedHeaderPing) === "header",
    `chunked Content-Length ping did not return a header-framed response: ${JSON.stringify(chunkedHeaderPing)}`,
  );
  assert(
    !postChunkedLinePing.error && responseFramings.get(postChunkedLinePing) === "line",
    `newline ping after chunked Content-Length request did not return a line-framed response: ${JSON.stringify(postChunkedLinePing)}`,
  );
  for (const [index, response] of backToBackPings.entries()) {
    const requestId = firstBackToBackPingRequestId + index;
    assert(
      !response.error && responseFramings.get(response) === "header",
      `back-to-back Content-Length frame ${index + 1} did not return a header-framed response: ${JSON.stringify(response)}`,
    );
  }
  assert(
    !postBackToBackLinePing.error
      && responseFramings.get(postBackToBackLinePing) === "line",
    `newline ping after back-to-back frames did not return a line-framed response: ${JSON.stringify(postBackToBackLinePing)}`,
  );
  assert(
    !mixedBatchHeaderPing.error
      && responseFramings.get(mixedBatchHeaderPing) === "header",
    `mixed-batch Content-Length frame did not return a header-framed response: ${JSON.stringify(mixedBatchHeaderPing)}`,
  );
  assert(
    !mixedBatchLinePing.error
      && responseFramings.get(mixedBatchLinePing) === "line",
    `mixed-batch newline frame did not return a line-framed response: ${JSON.stringify(mixedBatchLinePing)}`,
  );
  assert(
    !postMixedBatchPing.error && responseFramings.get(postMixedBatchPing) === "line",
    `newline ping after mixed-batch frames failed: ${JSON.stringify(postMixedBatchPing)}`,
  );
  assert(
    !reverseMixedBatchLinePing.error
      && responseFramings.get(reverseMixedBatchLinePing) === "line",
    `reverse mixed-batch newline frame did not return a line-framed response: ${JSON.stringify(reverseMixedBatchLinePing)}`,
  );
  assert(
    !reverseMixedBatchHeaderPing.error
      && responseFramings.get(reverseMixedBatchHeaderPing) === "header",
    `reverse mixed-batch Content-Length frame did not return a header-framed response: ${JSON.stringify(reverseMixedBatchHeaderPing)}`,
  );
  assert(
    !postReverseMixedBatchPing.error
      && responseFramings.get(postReverseMixedBatchPing) === "line",
    `newline ping after reverse mixed-batch frames failed: ${JSON.stringify(postReverseMixedBatchPing)}`,
  );
  assert(
    malformedHeaderError.error?.code === -32700,
    `malformed Content-Length returned unexpected error: ${JSON.stringify(malformedHeaderError.error)}`,
  );
  assert(
    malformedHeaderError.error?.message === "Parse error: missing Content-Length",
    `malformed Content-Length returned unexpected message: ${malformedHeaderError.error?.message}`,
  );
  assert(
    responseFramings.get(malformedHeaderError) === "header",
    `malformed Content-Length error was not header-framed: ${JSON.stringify(malformedHeaderError)}`,
  );
  assert(
    !malformedHeaderRecoveryPing.error
      && responseFramings.get(malformedHeaderRecoveryPing) === "line",
    `newline recovery request after malformed Content-Length failed: ${JSON.stringify(malformedHeaderRecoveryPing)}`,
  );
  assert(
    malformedBodyError.error?.code === -32700,
    `malformed header body returned unexpected error: ${JSON.stringify(malformedBodyError.error)}`,
  );
  assert(
    malformedBodyError.error?.message?.startsWith("Parse error:"),
    `malformed header body returned unexpected message: ${malformedBodyError.error?.message}`,
  );
  assert(
    responseFramings.get(malformedBodyError) === "header",
    `malformed header body error was not header-framed: ${JSON.stringify(malformedBodyError)}`,
  );
  assert(
    !malformedBodyRecoveryPing.error
      && responseFramings.get(malformedBodyRecoveryPing) === "line",
    `newline recovery request after malformed header body failed: ${JSON.stringify(malformedBodyRecoveryPing)}`,
  );

  const after = await snapshotWatchedFiles();
  for (const [filePath, beforeHash] of before.entries()) {
    const afterHash = after.get(filePath);
    assert(afterHash === beforeHash, `${filePath} hash changed: ${beforeHash} -> ${afterHash}`);
  }

  for (const filePath of forbiddenCreatedPaths) {
    assert(!(await pathExists(filePath)), `${normalizePath(filePath)} was unexpectedly created.`);
  }

  const auditRecordsAfter = await readJsonlRecords(auditLogPath);
  const auditCountAfter = auditRecordsAfter.length;
  const auditRecordsAdded = auditCountAfter - auditCountBefore;
  assert(
    auditRecordsAdded === expectedAuditRecordsAdded,
    `Expected exactly ${expectedAuditRecordsAdded} new MCP audit records, got ${auditRecordsAdded}.`,
  );

  const newAuditRecords = auditRecordsAfter.slice(auditCountBefore);
  const confirmationAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-confirmation",
  );
  assert(
    confirmationAudits.length === highRiskConfirmationFixtures.length,
    `Expected ${highRiskConfirmationFixtures.length} confirmation guard audits, got ${confirmationAudits.length}.`,
  );
  const expectedConfirmationTools = new Set(
    highRiskConfirmationFixtures.map((fixture) => fixture.name),
  );
  for (const record of confirmationAudits) {
    assert(
      expectedConfirmationTools.delete(record.tool_name),
      `Unexpected or duplicate confirmation guard audit tool: ${record.tool_name}`,
    );
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(record.confirmation_id === null, `${record.tool_name} unexpectedly recorded confirmation.`);
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    expectedConfirmationTools.size === 0,
    `Missing confirmation guard audits: ${[...expectedConfirmationTools].join(", ")}`,
  );

  const wrongConfirmationAudits = newAuditRecords.filter(
    (record) => record.actor === "mcp-smoke-wrong-confirmation",
  );
  assert(
    wrongConfirmationAudits.length === wrongConfirmationFixtures.length,
    `Expected ${wrongConfirmationFixtures.length} wrong-confirmation audits, got ${wrongConfirmationAudits.length}.`,
  );
  const expectedWrongConfirmationTools = new Map(
    wrongConfirmationFixtures.map((fixture) => [fixture.name, fixture.token]),
  );
  for (const record of wrongConfirmationAudits) {
    const expectedToken = expectedWrongConfirmationTools.get(record.tool_name);
    assert(expectedToken, `Unexpected wrong-confirmation audit tool: ${record.tool_name}`);
    expectedWrongConfirmationTools.delete(record.tool_name);
    assert(record.status === "tool_error", `${record.tool_name} audit status was ${record.status}.`);
    assert(record.risk === "high-risk-write", `${record.tool_name} audit risk was ${record.risk}.`);
    assert(
      record.confirmation_id === expectedToken,
      `${record.tool_name} audit confirmation was ${record.confirmation_id}, expected ${expectedToken}.`,
    );
    assert(
      Array.isArray(record.affected_paths) && record.affected_paths.length === 0,
      `${record.tool_name} unexpectedly affected paths: ${JSON.stringify(record.affected_paths)}`,
    );
    assert(record.result?.is_error === true, `${record.tool_name} audit did not record is_error=true.`);
  }
  assert(
    expectedWrongConfirmationTools.size === 0,
    `Missing wrong-confirmation audits: ${[...expectedWrongConfirmationTools.keys()].join(", ")}`,
  );

  if (stderrBuffer.trim()) {
    console.log("[stderr]");
    console.log(stderrBuffer.trimEnd());
  }

  return {
    tools: toolNames.size,
    checked_tools: expectedTools.length,
    invalid_tool_fixtures: invalidToolFixtures.length,
    tool_level_error_fixtures: toolLevelErrorFixtures.length,
    high_risk_confirmation_fixtures: highRiskConfirmationFixtures.length,
    confirmation_guard_audits: confirmationAudits.length,
    wrong_confirmation_fixtures: wrongConfirmationFixtures.length,
    wrong_confirmation_audits: wrongConfirmationAudits.length,
    resources: resourceUris.size,
    checked_resources: expectedResources.length,
    invalid_resource_fixtures: invalidResourceFixtures.length,
    prompts: promptNames.size,
    checked_prompts: expectedPrompts.length,
    prompt_fixtures: promptFixtures.length,
    invalid_prompt_fixtures: invalidPromptFixtures.length,
    invalid_json_rpc_fixtures: invalidJsonRpcFixtures.length + 1,
    framing_fixtures: 2,
    chunked_framing_fixtures: 1,
    chunked_header_writes: chunkedHeaderWriteCount,
    back_to_back_framing_fixtures: backToBackWriteResult.frames,
    back_to_back_header_writes: backToBackWriteResult.writes,
    mixed_batch_framing_fixtures: mixedBatchWriteResult.frames,
    mixed_batch_writes: mixedBatchWriteResult.writes,
    reverse_mixed_batch_framing_fixtures: reverseMixedBatchWriteResult.frames,
    reverse_mixed_batch_writes: reverseMixedBatchWriteResult.writes,
    malformed_header_errors: malformedHeaderWriteResult.errors,
    malformed_header_recovery_frames: malformedHeaderWriteResult.recovery_frames,
    malformed_header_writes: malformedHeaderWriteResult.writes,
    malformed_body_errors: malformedBodyWriteResult.errors,
    malformed_body_recovery_frames: malformedBodyWriteResult.recovery_frames,
    malformed_body_writes: malformedBodyWriteResult.writes,
    watched_files: [...before.keys()],
    forbidden_paths: forbiddenCreatedPaths.map(normalizePath),
    audit_records_added: auditRecordsAdded,
    audit_log: normalizePath(auditLogPath),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const result = await runSmokeTest(options);
  console.log("MCP smoke test passed.");
  console.log(`- Tools exposed: ${result.tools}`);
  console.log(`- Expected tools checked: ${result.checked_tools}`);
  console.log(`- Invalid tool fixtures checked for -32602: ${result.invalid_tool_fixtures}`);
  console.log(`- Tool-level result.isError fixtures checked: ${result.tool_level_error_fixtures}`);
  console.log(`- High-risk confirmation fixtures checked: ${result.high_risk_confirmation_fixtures}`);
  console.log(`- Confirmation guard audits checked: ${result.confirmation_guard_audits}`);
  console.log(`- Wrong-confirmation fixtures checked: ${result.wrong_confirmation_fixtures}`);
  console.log(`- Wrong-confirmation audits checked: ${result.wrong_confirmation_audits}`);
  console.log(`- Resources exposed: ${result.resources}`);
  console.log(`- Expected resources checked: ${result.checked_resources}`);
  console.log(`- Invalid resource fixtures checked for -32602: ${result.invalid_resource_fixtures}`);
  console.log(`- Prompts exposed: ${result.prompts}`);
  console.log(`- Expected prompts checked: ${result.checked_prompts}`);
  console.log(`- Prompt fixtures checked through prompts/get: ${result.prompt_fixtures}`);
  console.log(`- Invalid prompt fixtures checked for -32602: ${result.invalid_prompt_fixtures}`);
  console.log(`- JSON-RPC shell error fixtures checked: ${result.invalid_json_rpc_fixtures}`);
  console.log(`- Mixed framing fixtures checked: ${result.framing_fixtures}`);
  console.log(`- Chunked framing fixtures checked: ${result.chunked_framing_fixtures}`);
  console.log(`- Writes used for chunked header fixture: ${result.chunked_header_writes}`);
  console.log(`- Back-to-back framing fixtures checked: ${result.back_to_back_framing_fixtures}`);
  console.log(`- Writes used for back-to-back frames: ${result.back_to_back_header_writes}`);
  console.log(`- Mixed-batch framing fixtures checked: ${result.mixed_batch_framing_fixtures}`);
  console.log(`- Writes used for mixed-batch frames: ${result.mixed_batch_writes}`);
  console.log(`- Reverse mixed-batch fixtures checked: ${result.reverse_mixed_batch_framing_fixtures}`);
  console.log(`- Writes used for reverse mixed-batch frames: ${result.reverse_mixed_batch_writes}`);
  console.log(`- Malformed header errors checked: ${result.malformed_header_errors}`);
  console.log(`- Recovery frames checked after malformed header: ${result.malformed_header_recovery_frames}`);
  console.log(`- Writes used for malformed header fixture: ${result.malformed_header_writes}`);
  console.log(`- Malformed body errors checked: ${result.malformed_body_errors}`);
  console.log(`- Recovery frames checked after malformed body: ${result.malformed_body_recovery_frames}`);
  console.log(`- Writes used for malformed body fixture: ${result.malformed_body_writes}`);
  console.log(`- Watched files unchanged: ${result.watched_files.join(", ")}`);
  console.log(`- Forbidden paths absent: ${result.forbidden_paths.join(", ")}`);
  console.log(`- MCP audit records added: ${result.audit_records_added} (${result.audit_log})`);
}

main().catch((error) => {
  console.error(`MCP smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
