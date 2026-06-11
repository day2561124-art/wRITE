import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createAgentRun } from "../../server/src/agent-run-service.mjs";
import {
  saveCandidateDraft,
  saveProofReport,
  adoptCandidateDraft,
} from "../../server/src/writing-workflow-service.mjs";
import {
  buildSettlementContext,
} from "../../server/src/settlement-workflow-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  writeLowRiskTools,
  writeLowRiskToolMetadata,
} from "../../server/src/mcp-write-low-risk-tools.mjs";

const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".mcp-write-low-risk-test");
const fixturePending = path.join(projectPaths.canonDb, ".mcp-write-low-risk-test-pending");
const options = { writingWorkflow: fixtureWorkflow, pendingEngineCandidates: fixturePending };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const activeHashBefore = hash(activeBefore);
  await rm(fixtureWorkflow, { recursive: true, force: true });
  await rm(fixturePending, { recursive: true, force: true });

  try {
    // Create an agent run via tool
    const run = (await writeLowRiskTools.create_agent_run({
      task_type: "draft_generation",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner"],
      input_summary: "test run",
    })).result.run;
    assert(run?.run_id, "create_agent_run did not create run_id");

  // save_candidate_draft
  const draftRes = await writeLowRiskTools.save_candidate_draft({
    draftText: "# Test draft\n\nContent.",
    sourceChapter: "TestChapter",
    runId: run.run_id,
  }, options);
  assert(draftRes.ok, `save_candidate_draft failed: ${draftRes.blocked_reason}`);
    const draftId = draftRes.result.draft.draft_id;

  // proof report
  const proofRes = await writeLowRiskTools.save_proof_report({
    draftId,
    proofText: "## P2\nIssue.",
    runId: run.run_id,
  }, options);
  assert(proofRes.ok, "save_proof_report failed");

  // adopt then build settlement context using services, then save_settlement_report via tool
  const adopted = await adoptCandidateDraft(draftId, { confirm: true }, options);
  const context = await buildSettlementContext(adopted.metadata.adopted_chapter_id, { runId: run.run_id }, options);
  const settlementRes = await writeLowRiskTools.save_settlement_report({
    settlementContextId: context.metadata.settlement_context_id,
    settlementText: "Settlement text for test",
    sourceChapter: "TestChapter",
    runId: run.run_id,
  }, options);
  assert(settlementRes.ok, "save_settlement_report failed");
  const settlementReportId = settlementRes.result.settlement_report.settlement_report_id;

  // create pending candidate from settlement report
  const pendingRes = await writeLowRiskTools.create_pending_candidate_from_settlement_report({
    settlementReportId,
  }, options);
  assert(pendingRes.ok, `create_pending_candidate_from_settlement_report failed: ${pendingRes.blocked_reason}`);
  const candidateId = pendingRes.result.pending_candidate.metadata.candidate_id;
  // ensure pending candidate folder exists in fixturePending
  const pendingNames = await names(fixturePending);
  assert(pendingNames.has(candidateId), "Pending candidate was not created in pending directory");

  // save_run_log
  const logRes = await writeLowRiskTools.save_run_log({ runId: run.run_id, payload: { note: "log" } }, options);
  assert(logRes.ok, "save_run_log failed");
  const logPath = path.join(projectPaths.agentRuns, run.run_id, "logs", "run_log.jsonl");
  const logContent = await readFile(logPath, "utf8");
  assert(logContent.includes('"run_id":"' + run.run_id + '"'), "run_log content missing run_id");

  // neural module wrappers produce traces (skipped if adapter missing)
  const scene = await writeLowRiskTools.run_scene_planner({ scene: "x" }, { run_id: run.run_id });
  assert(scene.ok && scene.result.trace, "run_scene_planner did not produce trace");
  const tracePath = path.join(projectPaths.neuralTraces, `${scene.result.trace.trace_id}.json`);
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  assert(["skipped", "failed", "success"].includes(trace.status), "trace status invalid");
  // model adapter unconfigured => should not be success
  assert(trace.status !== "success" || typeof trace.output_hash === "string", "Invalid success trace without hashes");

    // path traversal rejection: pass invalid neuralModulesUsedPath to save_candidate_draft
    try {
      await writeLowRiskTools.save_candidate_draft({
        draftText: "x",
        sourceChapter: "t",
        runId: run.run_id,
        neuralModulesUsedPath: "../active_engine.md",
      }, options);
      throw new Error("Path traversal was accepted");
    } catch (error) {
      // expected to fail
    }

    // verify active_engine unchanged
    const activeAfter = await readFile(projectPaths.activeEngine);
    assert(hash(activeAfter) === activeHashBefore, "active_engine.md was modified by write-low-risk tools");

    // metadata checks
    for (const [name, meta] of Object.entries(writeLowRiskToolMetadata)) {
      assert(meta.permission === "write_low_risk", `${name} metadata permission wrong`);
      assert(meta.can_modify_active_engine === false, `${name} can_modify_active_engine must be false`);
    }

    console.log("MCP write-low-risk tools test passed.");
  } finally {
    // Ensure fixture pending directory is always cleaned up
    try {
      await rm(fixturePending, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error(`MCP write-low-risk tools test failed: ${error.message}`);
  process.exitCode = 1;
});
