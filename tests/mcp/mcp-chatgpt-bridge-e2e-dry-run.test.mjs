import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectPaths } from "../../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const fixtureName = ".phase14b-chatgpt-bridge-e2e-test";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await readdir(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function runScript() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/chatgpt-bridge-e2e-dry-run.mjs",
      "--dry-run",
      "--cleanup",
      "--json",
      "--include-settlement-fixture",
      "--fixture-root",
      fixtureName,
    ], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`dry-run script exited ${code}: ${stderr || stdout}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const compressedBefore = await readFile(projectPaths.compressedRules);
  const summary = await runScript();

  assert(summary.ok === true, "Dry-run summary was not ok.");
  for (const step of [
    "status_read",
    "current_inputs_read",
    "writing_context_built",
    "candidate_saved",
    "proofing_context_built",
    "proof_report_saved",
    "adoption_request_created",
    "stopped_at_approval_queue",
    "settlement_context_built_from_fixture",
  ]) {
    assert(summary.steps[step] === true, `Dry-run step failed: ${step}.`);
  }
  for (const flag of [
    "external_llm_called",
    "local_generation_called",
    "approval_confirmed",
    "adoption_confirmed",
    "adopted_chapter_created",
    "pending_engine_candidate_created",
    "active_engine_modified",
    "compressed_rules_modified",
    "restore_executed",
    "rollback_executed",
  ]) {
    assert(summary.safety[flag] === false, `Unsafe flag was true: ${flag}.`);
  }
  assert(
    summary.hashes.active_engine_before === summary.hashes.active_engine_after,
    "Active engine summary hashes differ.",
  );
  assert(
    summary.hashes.compressed_rules_before === summary.hashes.compressed_rules_after,
    "Compressed rules summary hashes differ.",
  );
  assert(
    summary.fixture.synthetic_adopted_writing_used === true,
    "Synthetic settlement fixture was not used.",
  );
  assert(
    summary.fixture.synthetic_adopted_writing_persisted === false,
    "Synthetic adopted writing persisted.",
  );
  assert(summary.fixture.cleanup_completed === true, "Fixture cleanup was not completed.");
  assert(summary.artifacts.adoption_request_id, "Adoption request ID is missing.");
  assert(summary.artifacts.settlement_context_id, "Settlement context ID is missing.");
  assert(summary.approval_queue_readiness.checked === true, "Readiness was not checked.");
  assert(summary.approval_queue_readiness.ok === true, "Readiness was not ok.");
  assert(
    summary.approval_queue_readiness.decision === "ready_for_human_review",
    "Readiness decision is wrong.",
  );
  assert(
    summary.approval_queue_readiness.source === "chatgpt_bridge",
    "Readiness source is wrong.",
  );
  assert(
    summary.approval_queue_readiness.lineage_complete === true,
    "Readiness lineage is incomplete.",
  );
  assert(summary.approval_queue_readiness.can_approve === false, "Bridge may approve.");
  assert(
    summary.approval_queue_readiness.can_confirm_adoption === false,
    "Bridge may confirm adoption.",
  );
  assert(
    Buffer.compare(await readFile(projectPaths.activeEngine), activeBefore) === 0,
    "Dry-run changed active_engine.md.",
  );
  assert(
    Buffer.compare(await readFile(projectPaths.compressedRules), compressedBefore) === 0,
    "Dry-run changed compressed_rules.md.",
  );

  const fixtureDirectories = [
    path.join(projectPaths.gptWritingContexts, fixtureName),
    path.join(projectPaths.writingCandidates, fixtureName),
    path.join(projectPaths.proofingContexts, fixtureName),
    path.join(projectPaths.proofReports, fixtureName),
    path.join(projectPaths.approvalQueue, fixtureName),
    path.join(projectPaths.adoptedWritings, fixtureName),
    path.join(projectPaths.adoptedWritingSettlementContexts, fixtureName),
    path.join(projectPaths.adoptedWritingSettlementReports, fixtureName),
  ];
  for (const directory of fixtureDirectories) {
    assert(!(await exists(directory)), `Fixture directory remains: ${directory}`);
  }
  console.log("MCP ChatGPT bridge E2E dry run test passed.");
}

main().catch((error) => {
  console.error(`MCP ChatGPT bridge E2E dry run test failed: ${error.message}`);
  process.exitCode = 1;
});
