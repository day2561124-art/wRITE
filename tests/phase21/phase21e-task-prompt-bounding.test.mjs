import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { buildChatgptBridgeWritingContext } from "../../server/src/chatgpt-bridge-service.mjs";

async function run() {
  const tempRoot = path.join(process.cwd(), "data", "outputs", `tmp_task_prompt_test_${Date.now()}`);
  const taskPath = path.join(tempRoot, "task_prompt.md");
  const gptRoots = path.join(tempRoot, "gpt_writing_contexts");
  await fs.mkdir(gptRoots, { recursive: true });
  const longText = "A".repeat(30000);
  await fs.writeFile(taskPath, longText, "utf8");

  const res = await buildChatgptBridgeWritingContext({}, { outputs: tempRoot, gptWritingContexts: gptRoots });
  // bundle file should have been created and task_prompt bounded
  assert(res && res.bundle, "bundle returned");
  const bundle = res.bundle;
  assert(typeof bundle.task_prompt === "string", "bundle.task_prompt present");
  assert(bundle.task_prompt.length < 20000, "task_prompt should be bounded (under 20k)");
  assert(bundle.task_prompt.length <= 12000, "task_prompt should be bounded to task_prompt max length");
  // metadata recorded
  assert(bundle.task_prompt_metadata && typeof bundle.task_prompt_metadata.original_task_prompt_chars === "number", "metadata present");
  // original file unchanged
  const original = await fs.readFile(taskPath, "utf8");
  assert(original.length === 30000, "original task_prompt.md not modified");

  // cleanup
  await fs.rm(tempRoot, { recursive: true, force: true });

  console.log("Phase21E task prompt bounding test passed.");
}

run().catch((err) => { console.error(err); process.exitCode = 1; });

