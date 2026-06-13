import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildGptWritingContext,
  getGptWritingContextBundle,
  listGptWritingContextBundles,
} from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".gpt-writing-context-test");
const fixtureActive = path.join(projectPaths.canonDb, ".gpt-writing-context-active-test.md");
const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".gpt-writing-context-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".gpt-writing-context-test");
const fixturePending = path.join(projectPaths.canonDb, ".gpt-writing-context-pending-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const expectedActiveEngineLfHash = (
  "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB"
);
const expectedNeuralModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
];
const options = {
  gptWritingContexts: fixtureContexts,
  activeEnginePath: fixtureActive,
};

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

async function expectReject(action, expected) {
  try {
    await action();
  } catch (error) {
    assert(error.message.includes(expected), `Unexpected error: ${error.message}`);
    return;
  }
  throw new Error(`Expected rejection containing: ${expected}`);
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const transactionsBefore = await names(transactionDir);
  const activeText = "# GPT Context Fixture\n\nCanon remains unchanged.\n";
  await Promise.all([
    rm(fixtureContexts, { recursive: true, force: true }),
    rm(fixtureWorkflow, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
    rm(fixturePending, { recursive: true, force: true }),
  ]);
  await mkdir(path.dirname(fixtureActive), { recursive: true });
  await writeFile(fixtureActive, activeText, "utf8");

  try {
    const built = await buildGptWritingContext({
      task_prompt: "Write the next chapter candidate in chat.",
      generation_context: { chapter: 13, tone: "quiet" },
      retrieval_context: { characters: ["A", "B"] },
    }, options);
    const { bundle } = built;
    assert(bundle.bundle_kind === "gpt_writing_context", "Bundle kind was wrong.");
    assert(bundle.for_chat_output === true, "Bundle was not marked for chat.");
    assert(bundle.engine_first === true, "Bundle was not marked engine-first.");
    assert(bundle.engine_components_valid === true, "Engine components were not valid.");
    assert(bundle.engine_components_status.ok === true, "Engine component status failed.");
    assert(
      bundle.engine_components_status.components.canon_data.expected_sha256_lf
        === expectedActiveEngineLfHash
        && bundle.engine_components_status.components.canon_data.actual_sha256_lf
          === expectedActiveEngineLfHash,
      "Bundle did not use the registry LF active engine hash.",
    );
    assert(
      bundle.engine_components_status.components.writing_method.version === "v2.8",
      "Writing method version was missing.",
    );
    assert(
      bundle.engine_components_status.components.proofing_method.version === "v1.1",
      "Proofing method version was missing.",
    );
    assert(bundle.neural_pipeline_required === true, "Neural pipeline was not required.");
    assert(
      JSON.stringify(bundle.required_neural_modules) === JSON.stringify(expectedNeuralModules),
      "Required neural modules were incomplete.",
    );
    assert(bundle.governance_policy_required === true, "Governance policy was not required.");
    assert(bundle.local_generation_allowed === false, "Bundle allowed local generation.");
    assert(bundle.active_engine_update_allowed === false, "Bundle allowed engine updates.");
    assert(bundle.canon_update_allowed === false, "Bundle allowed canon updates.");
    assert(bundle.adoption_allowed === false, "Bundle allowed adoption.");
    assert(bundle.settlement_allowed === false, "Bundle allowed settlement.");
    assert(
      bundle.sources.active_engine.hash === hash(activeText),
      "Fixture active engine hash was wrong.",
    );
    assert(
      built.context_bundle_path.endsWith("/context_bundle.json")
        && built.context_for_chat_path.endsWith("/context_for_chat.md"),
      "Bundle paths were wrong.",
    );

    const stored = await getGptWritingContextBundle(bundle.bundle_id, options);
    assert(
      stored.context_for_chat.includes("# GPT Writing Context Bundle"),
      "Chat markdown was not created.",
    );
    assert(
      stored.context_for_chat.includes("Write the requested candidate directly in chat."),
      "Chat markdown omitted GPT output instruction.",
    );
    assert(
      stored.context_for_chat.includes("Do not modify active_engine.md"),
      "Chat markdown omitted active engine boundary.",
    );
    assert(
      stored.context_for_chat.includes("## 完整創作引擎狀態")
        && stored.context_for_chat.includes("- active_engine：valid")
        && stored.context_for_chat.includes("- writing_method：v2.8")
        && stored.context_for_chat.includes("- proofing_method：v1.1")
        && stored.context_for_chat.includes("- neural_pipeline：required")
        && expectedNeuralModules.every((moduleName) => (
          stored.context_for_chat.includes(`  - ${moduleName}`)
        ))
        && stored.context_for_chat.includes("- governance policy present：true")
        && stored.context_for_chat.includes("- canon update permission：none"),
      "Chat markdown omitted the integrated engine status summary.",
    );
    assert(
      (await listGptWritingContextBundles({ limit: 20 }, options))[0].bundle_id
        === bundle.bundle_id,
      "Bundle list omitted the stored bundle.",
    );

    const limited = await buildGptWritingContext({
      taskPrompt: "Budget test.",
      generationContext: { text: "g".repeat(200) },
      retrievalContext: { text: "r".repeat(200) },
      maxContextChars: 40,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    assert(limited.bundle.truncated_sections.length > 0, "Context budget did not truncate.");
    assert(limited.bundle.max_context_chars === 40, "Context budget limit was not recorded.");

    const invalid = await buildGptWritingContext({
      taskPrompt: "Validation warning test.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, {
      ...options,
      engineComponentsStatusProvider: async () => ({
        ok: false,
        read_only: true,
        engine_id: "fixture-engine",
        design_principle: "engine-first",
        components: {
          neural_pipeline: {
            required: true,
            modules: expectedNeuralModules.map((name) => ({
              name,
              required_status: "available",
            })),
          },
          governance_policy: { required: true, exists: false },
        },
        issues: ["governance_policy:missing"],
      }),
    });
    assert(invalid.bundle.engine_first === true, "Invalid bundle lost engine-first metadata.");
    assert(invalid.bundle.engine_components_valid === false, "Invalid registry was marked valid.");
    assert(
      invalid.bundle.engine_component_validation_errors.includes("governance_policy:missing")
        && invalid.bundle.warnings.includes(
          "Engine component validation: governance_policy:missing",
        ),
      "Registry validation failure was silently omitted.",
    );

    await expectReject(() => buildGptWritingContext({}, options), "task_prompt is required");
    await expectReject(
      () => buildGptWritingContext({ taskPrompt: "x", chapterMode: "invalid" }, options),
      "Unknown chapter_mode",
    );
    await expectReject(
      () => buildGptWritingContext({ taskPrompt: "x", outputMode: "invalid" }, options),
      "Unknown output_mode",
    );
    await expectReject(
      () => buildGptWritingContext({ taskPrompt: "x", maxContextChars: 250001 }, options),
      "max_context_chars must be an integer",
    );

    assert((await names(fixtureWorkflow)).size === 0, "Service created writing workflow records.");
    assert((await names(fixtureApproval)).size === 0, "Service created approval records.");
    assert((await names(fixturePending)).size === 0, "Service created engine candidates.");
    assert(hash(await readFile(fixtureActive)) === hash(activeText), "Fixture active engine changed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Production active engine changed.",
    );
    console.log("GPT writing context service test passed.");
  } finally {
    await Promise.all([
      rm(fixtureContexts, { recursive: true, force: true }),
      rm(fixtureActive, { force: true }),
      rm(fixtureWorkflow, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
      rm(fixturePending, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`GPT writing context service test failed: ${error.message}`);
  process.exitCode = 1;
});
