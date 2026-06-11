import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  gptWritingContextToolMetadata,
  gptWritingContextTools,
} from "../../server/src/mcp-gpt-writing-context-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".mcp-gpt-writing-context-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = { gptWritingContexts: fixtureContexts };

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
  await rm(fixtureContexts, { recursive: true, force: true });

  try {
    for (const name of [
      "build_gpt_writing_context",
      "get_gpt_writing_context_bundle",
      "list_gpt_writing_context_bundles",
    ]) {
      assert(typeof gptWritingContextTools[name] === "function", `${name} is missing.`);
      const metadata = gptWritingContextToolMetadata[name];
      assert(metadata, `${name} metadata is missing.`);
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_activate_engine === false, `${name} may activate engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_rollback === false, `${name} may rollback.`);
      assert(metadata.can_execute_cleanup === false, `${name} may execute cleanup.`);
      assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
    }

    const built = await gptWritingContextTools.build_gpt_writing_context({
      task_prompt: "Write a candidate in chat.",
    }, options);
    assert(built.ok && built.result.bundle.bundle_id, "MCP build failed.");
    const bundleId = built.result.bundle.bundle_id;

    const read = await gptWritingContextTools.get_gpt_writing_context_bundle({
      bundle_id: bundleId,
    }, options);
    assert(read.ok && read.result.bundle.bundle_id === bundleId, "MCP get failed.");

    const list = await gptWritingContextTools.list_gpt_writing_context_bundles(
      { limit: 20 },
      options,
    );
    assert(list.ok && list.result.count === 1, "MCP list failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "MCP GPT context tools modified active_engine.md.",
    );
    console.log("MCP GPT writing context tools test passed.");
  } finally {
    await rm(fixtureContexts, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP GPT writing context tools test failed: ${error.message}`);
  process.exitCode = 1;
});
