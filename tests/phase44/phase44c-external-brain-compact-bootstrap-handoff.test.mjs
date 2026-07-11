import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { getGptWritingContextBundle } from "../../server/src/gpt-writing-context-service.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const capabilities = new Map([
  ["scene_planner", chatgpt_bridge_use_scene_planner],
  ["character_simulator", chatgpt_bridge_use_character_simulator],
  ["neural_critic", chatgpt_bridge_use_neural_critic],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
  ["writing_card_director", chatgpt_bridge_use_writing_card_director],
]);
const mutationGuards = [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
];

async function treeDigest(relativePath) {
  const records = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(prefix, entry.name).replaceAll("\\", "/");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) records.push(`${relative}:${sha256(await readFile(absolute))}`);
    }
  }
  await visit(path.join(rootDir, relativePath));
  return sha256(records.join("\n"));
}

const protectedStateBefore = {
  canon: await treeDigest("data/canon_db"),
  candidates: await treeDigest("data/outputs/writing_candidates"),
};

const begin = await chatgpt_bridge_begin_external_brain_writing_session({
  task_prompt: "Phase44C compact bootstrap：由 ChatGPT 編排六個 external-brain capabilities。",
  chapter_mode: "specific_scene",
  max_context_chars: 48_000,
});

assert.equal(begin.ok, true);
assert.equal(begin.architecture_route, "chatgpt_owned_external_brain");
assert.equal(begin.orchestration_owner, "ChatGPT");
assert.equal(begin.prose_generator, "ChatGPT");
assert.match(begin.external_brain_session_id, /^agent_run_/u);
assert.match(begin.writing_context_bundle_id, /^gptctx_/u);
assert.deepEqual(begin.next_capabilities, [...capabilities.keys()]);
for (const guard of mutationGuards) {
  assert.equal(begin.mutation_guards[guard], false);
  assert.equal(begin[guard], false);
}

assert.equal("writing_context" in begin, false);
assert.equal("context_for_chat" in begin, false);
assert.equal("context_bundle" in begin, false);
const serializedBytes = Buffer.byteLength(JSON.stringify(begin), "utf8");
// 16 KiB leaves ample room for small bootstrap metadata while catching any
// accidental reintroduction of the full context bundle or chat markdown.
assert(serializedBytes < 16 * 1024, `bootstrap response is not compact: ${serializedBytes} bytes`);

const persisted = await getGptWritingContextBundle(begin.writing_context_bundle_id);
assert.equal(persisted.bundle.bundle_id, begin.writing_context_bundle_id);
assert.match(persisted.bundle.task_prompt, /Phase44C compact bootstrap/u);
assert(persisted.context_for_chat.length > 0);

for (const [capability, invoke] of capabilities) {
  const called = await invoke({
    external_brain_session_id: begin.external_brain_session_id,
    writing_context_bundle_id: begin.writing_context_bundle_id,
    capability_input: { regression: "phase44c_compact_bootstrap" },
  });
  assert.equal(called.ok, true, `${capability} call must succeed`);
  assert.equal(called.result.external_brain_session_id, begin.external_brain_session_id);
  assert.equal(called.result.writing_context_bundle_id, begin.writing_context_bundle_id);
  assert.equal(called.result.trace.module_name, capability);
  assert.equal(called.result.trace.status, "success");
}

assert.deepEqual({
  canon: await treeDigest("data/canon_db"),
  candidates: await treeDigest("data/outputs/writing_candidates"),
}, protectedStateBefore);

console.log(
  `Phase 44C compact external brain bootstrap handoff passed: size=${serializedBytes} bytes, capabilities=6/6`,
);
