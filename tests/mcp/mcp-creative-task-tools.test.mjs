import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  creativeTaskToolMetadata,
  creativeTaskTools,
} from "../../server/src/mcp-creative-task-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureTasks = path.join(projectPaths.creativeTasks, ".mcp-creative-task-test");
const fixtureLog = path.join(projectPaths.outputLogs, ".mcp-creative-task-test-runs.jsonl");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = { creativeTasks: fixtureTasks, creativeTaskLog: fixtureLog };

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

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const activeHashBefore = hash(activeBefore);
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureTasks, { recursive: true, force: true });
  await rm(fixtureLog, { force: true });

  try {
    for (const name of [
      "run_creative_task",
      "get_creative_task_status",
      "list_creative_task_types",
    ]) {
      assert(typeof creativeTaskTools[name] === "function", `${name} is missing.`);
      const metadata = creativeTaskToolMetadata[name];
      assert(metadata, `${name} metadata is missing.`);
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_activate_engine === false, `${name} may activate engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_rollback === false, `${name} may rollback.`);
      assert(metadata.can_execute_cleanup === false, `${name} may execute cleanup.`);
    }

    const types = await creativeTaskTools.list_creative_task_types();
    assert(types.ok && types.task_types.length === 7, "Task type listing failed.");

    const run = await creativeTaskTools.run_creative_task({
      task_type: "generate_writing_candidate",
      task_prompt: "MCP dry run.",
      dry_run: true,
    }, options);
    assert(run.ok && run.status === "dry_run", "MCP creative task run failed.");

    const status = await creativeTaskTools.get_creative_task_status({
      task_id: run.task_id,
    }, options);
    assert(status.ok && status.task_id === run.task_id, "MCP creative task status failed.");

    const unknown = await creativeTaskTools.run_creative_task({
      task_type: "unknown",
    }, options);
    assert(!unknown.ok && unknown.status === "blocked", "Unknown MCP task was not blocked.");

    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "MCP creative task tools modified active_engine.md.",
    );
    console.log("MCP creative task tools test passed.");
  } finally {
    await rm(fixtureTasks, { recursive: true, force: true });
    await rm(fixtureLog, { force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP creative task tools test failed: ${error.message}`);
  process.exitCode = 1;
});
