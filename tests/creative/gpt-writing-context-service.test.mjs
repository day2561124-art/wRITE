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
  "9FC2984B3126B12FD35D6CA57B1C05F7038F7FD7414726AB6C12A9C2F308DD55"
);
const expectedNeuralModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
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
      persist_context: true,
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
      bundle.engine_components_status.components.writing_method.version === "v3.0",
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
      stored.context_for_chat.includes("# GPT Formal Writing Context"),
      "Formal chat context markdown was not created.",
    );
    assert(
      stored.context_for_chat.includes('"context_kind": "formal_writing_context"')
        && stored.context_for_chat.includes(
          '"user_request": "Write the next chapter candidate in chat."',
        ),
      "Formal chat context omitted its kind or current user request.",
    );
    assert(
      stored.context_for_chat.includes('"full_text_included": false')
        && stored.context_for_chat.includes('"requires_explicit_candidate_workflow_to_persist": true')
        && stored.context_for_chat.includes('"may_mutate_active_engine": false'),
      "Formal chat context omitted the active-engine and persistence boundaries.",
    );
    assert(
      bundle.formal_context.context_kind === "formal_writing_context"
        && bundle.formal_context.user_request
          === "Write the next chapter candidate in chat.",
      "Formal context omitted its kind or current request.",
    );
    assert(
      bundle.formal_context.active_engine_metadata.full_text_included === false
        && bundle.formal_context.original_candidate_policy
          .canon_status.requires_explicit_candidate_workflow_to_persist === true
        && bundle.formal_context.external_research.may_mutate_active_engine === false,
      "Formal context omitted authority or active-engine boundaries.",
    );
    assert(
      expectedNeuralModules.every((moduleName) => (
          Object.hasOwn(
            bundle.formal_context.neural_module_contracts.modules,
            moduleName.replace(/^run_/u, ""),
          )
        )),
      "Formal context omitted neural-module contracts.",
    );
    assert(
      (await listGptWritingContextBundles({ limit: 20 }, options))[0].bundle_id
        === bundle.bundle_id,
      "Bundle list omitted the stored bundle.",
    );

    const limited = await buildGptWritingContext({
      taskPrompt: "Budget test.",
      generationContext: { text: "g".repeat(20_000) },
      retrievalContext: { text: "r".repeat(20_000) },
      maxContextChars: 48_000,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    assert(limited.bundle.truncated_sections.length > 0, "Context budget did not truncate.");
    assert(limited.bundle.max_context_chars === 48_000, "Context budget limit was not recorded.");

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
