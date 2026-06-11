import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  projectPaths,
  resolveGeneratedMarkdownPath,
  resolveProjectPath,
} from "../../server/src/project-paths.mjs";
import { assertAgentRunId } from "../../server/src/agent-run-service.mjs";
import { assertNeuralTraceId } from "../../server/src/neural-trace-service.mjs";
import {
  assertArchiveId,
  assertEngineCandidateId,
  assertSnapshotId,
  isSafeArchiveId,
  isSafeCandidateId,
  isSafeSnapshotId,
} from "../../server/src/engine-candidate-service.mjs";
import {
  assertAdoptedChapterId,
  assertContextBundleId,
  assertDraftId,
  assertProofId,
  isSafeAdoptedChapterId,
  isSafeContextBundleId,
  isSafeDraftId,
  isSafeProofId,
} from "../../server/src/writing-workflow-service.mjs";
import {
  assertSettlementContextId,
  assertSettlementReportId,
  isSafeSettlementContextId,
  isSafeSettlementReportId,
} from "../../server/src/settlement-workflow-service.mjs";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const auditPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");
const intentDir = path.join(rootDir, "data", "outputs", "logs", "mcp_audit_intents");
const transactionDir = path.join(rootDir, "data", "outputs", "logs", "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function optionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function optionalNames(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewFiles(dirPath, before) {
  for (const name of await optionalNames(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

function callMcpPathViolation() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      terminateProcessTree(child);
      reject(new Error(`MCP path policy fixture timed out: ${stderr}`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline === -1) return;
      clearTimeout(timer);
      const response = JSON.parse(stdout.slice(0, newline));
      child.stdin.end();
      resolve(response);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "build_task_prompt",
        arguments: {
          task: "Path policy fixture.",
          output: "data/canon_db/active_engine.md",
        },
        _meta: { actor: "path-policy-test" },
      },
    })}\n`);
  });
}

async function main() {
  assert(
    (() => {
      try {
        resolveProjectPath("../outside.md", "fixture");
        return false;
      } catch {
        return true;
      }
    })(),
    "Project traversal was not rejected.",
  );
  assert(
    (() => {
      try {
        resolveGeneratedMarkdownPath("data/canon_db/active_engine.md", "fixture");
        return false;
      } catch {
        return true;
      }
    })(),
    "Generated output policy allowed a Canon target.",
  );
  assert(
    projectPaths.agentRuns.startsWith(path.join(rootDir, "data", "agent_runs")),
    "Agent run path is outside data/agent_runs.",
  );
  assert(
    (() => {
      try {
        assertAgentRunId("../active_engine");
        return false;
      } catch {
        return true;
      }
    })(),
    "Agent run traversal id was not rejected.",
  );
  assert(
    (() => {
      try {
        assertNeuralTraceId("../../trace");
        return false;
      } catch {
        return true;
      }
    })(),
    "Neural trace traversal id was not rejected.",
  );
  for (const unsafeId of [
    "../active_engine.md",
    "engine_candidate_../../active_engine.md",
    "engine_candidate_20260611-120000-../../x",
    "%2e%2e%2factive_engine.md",
  ]) {
    assert(!isSafeCandidateId(unsafeId), `Unsafe candidate id was accepted: ${unsafeId}`);
    assert(
      (() => {
        try {
          assertEngineCandidateId(unsafeId);
          return false;
        } catch {
          return true;
        }
      })(),
      `Candidate traversal id was not rejected: ${unsafeId}`,
    );
  }
  for (const unsafeId of [
    "../active_engine.md",
    "settlement_context_../../active_engine.md",
    "%2e%2e%2factive_engine.md",
  ]) {
    assert(
      !isSafeSettlementContextId(unsafeId),
      `Unsafe settlement context id was accepted: ${unsafeId}`,
    );
    assert(
      (() => {
        try {
          assertSettlementContextId(unsafeId);
          return false;
        } catch {
          return true;
        }
      })(),
      `Settlement context traversal id was not rejected: ${unsafeId}`,
    );
  }
  for (const unsafeId of [
    "../active_engine.md",
    "settlement_report_../../active_engine.md",
    "%2e%2e%2factive_engine.md",
  ]) {
    assert(
      !isSafeSettlementReportId(unsafeId),
      `Unsafe settlement report id was accepted: ${unsafeId}`,
    );
    assert(
      (() => {
        try {
          assertSettlementReportId(unsafeId);
          return false;
        } catch {
          return true;
        }
      })(),
      `Settlement report traversal id was not rejected: ${unsafeId}`,
    );
  }
  assert(
    projectPaths.settlementContexts.startsWith(projectPaths.settlementWorkflow),
    "Settlement contexts path is outside settlement workflow.",
  );
  assert(
    projectPaths.settlementReports.startsWith(projectPaths.settlementWorkflow),
    "Settlement reports path is outside settlement workflow.",
  );
  assert(
    projectPaths.pendingEngineCandidates.startsWith(projectPaths.canonDb),
    "Pending engine candidates path is outside canon_db.",
  );
  assert(
    projectPaths.rejectedEngineCandidates.startsWith(projectPaths.canonDb),
    "Rejected engine candidates path is outside canon_db.",
  );
  for (const unsafeId of [
    "../active_engine.md",
    "engine_snapshot_../../active_engine.md",
    "%2e%2e%2factive_engine.md",
  ]) {
    assert(!isSafeSnapshotId(unsafeId), `Unsafe snapshot id was accepted: ${unsafeId}`);
    assert(
      (() => {
        try {
          assertSnapshotId(unsafeId);
          return false;
        } catch {
          return true;
        }
      })(),
      `Snapshot traversal id was not rejected: ${unsafeId}`,
    );
  }
  for (const unsafeId of ["../archive", "engine_archive_../../x"]) {
    assert(!isSafeArchiveId(unsafeId), `Unsafe archive id was accepted: ${unsafeId}`);
    assert(
      (() => {
        try {
          assertArchiveId(unsafeId);
          return false;
        } catch {
          return true;
        }
      })(),
      `Archive traversal id was not rejected: ${unsafeId}`,
    );
  }
  assert(projectPaths.engineSnapshots.startsWith(projectPaths.canonDb), "Snapshot path escaped canon_db.");
  assert(projectPaths.engineArchive.startsWith(projectPaths.canonDb), "Archive path escaped canon_db.");
  assert(projectPaths.rollbackIndex.startsWith(projectPaths.rollback), "Rollback index escaped rollback root.");
  const workflowIdChecks = [
    ["draft", isSafeDraftId, assertDraftId],
    ["proof", isSafeProofId, assertProofId],
    ["adopted chapter", isSafeAdoptedChapterId, assertAdoptedChapterId],
    ["context bundle", isSafeContextBundleId, assertContextBundleId],
  ];
  for (const [label, isSafe, assertSafe] of workflowIdChecks) {
    for (const unsafeId of ["../active_engine.md", "%2e%2e%2factive_engine.md", `${label}_../../x`]) {
      assert(!isSafe(unsafeId), `Unsafe ${label} id was accepted: ${unsafeId}`);
      assert(
        (() => {
          try {
            assertSafe(unsafeId);
            return false;
          } catch {
            return true;
          }
        })(),
        `${label} traversal id was not rejected: ${unsafeId}`,
      );
    }
  }
  assert(
    projectPaths.candidateDrafts.startsWith(projectPaths.writingWorkflow),
    "Candidate drafts path escaped writing_workflow.",
  );
  assert(
    projectPaths.workflowProofReports.startsWith(projectPaths.writingWorkflow),
    "Workflow proof reports path escaped writing_workflow.",
  );
  assert(
    projectPaths.adoptedChapters.startsWith(projectPaths.writingWorkflow),
    "Adopted chapters path escaped writing_workflow.",
  );

  const activeBefore = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
  const auditBefore = await optionalBuffer(auditPath);
  const intentsBefore = await optionalNames(intentDir);
  const transactionsBefore = await optionalNames(transactionDir);
  try {
    const response = await callMcpPathViolation();
    const text = response.result?.content?.[0]?.text ?? "";
    assert(response.result?.isError === true, "MCP path violation did not return a tool error.");
    assert(
      text.includes("output must stay under data/outputs"),
      `Unexpected MCP path policy message: ${text}`,
    );
    const activeAfter = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
    assert(activeAfter === activeBefore, "MCP path violation changed active_engine.md.");
  } finally {
    if (auditBefore.exists) await writeFile(auditPath, auditBefore.content);
    else await rm(auditPath, { force: true });
    await removeNewFiles(intentDir, intentsBefore);
    await removeNewFiles(transactionDir, transactionsBefore);
  }
  console.log("Path policy security test passed.");
}

main().catch((error) => {
  console.error(`Path policy security test failed: ${error.message}`);
  process.exitCode = 1;
});
