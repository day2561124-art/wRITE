import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { buildFullNeuralWritingOrchestration } from "../../server/src/full-neural-writing-orchestrator-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const registryContent = await readFile(projectPaths.characterVoiceRegistry, "utf8");
const activeEngineBefore = await readFile(projectPaths.activeEngine);
const tempRoot = await mkdtemp(path.join(projectPaths.outputs, ".phase23c-test-"));

try {
  const built = await buildGptWritingContext({
    task_prompt: "Phase23C registry context test.",
    generation_context: { scene: "走廊" },
    retrieval_context: { characters: ["朝日奈千夜", "九逃"] },
  }, {
    gptWritingContexts: path.join(tempRoot, "loaded"),
  });

  assert.equal(built.bundle.character_voice_registry_loaded, true);
  assert.equal(
    built.bundle.character_voice_registry_path,
    "data/character_profile_db/active_character_voice_registry.md",
  );
  assert.equal(
    built.bundle.character_voice_registry_hash_sha256,
    sha256(registryContent),
  );
  assert.equal(
    built.bundle.character_voice_registry_bytes,
    Buffer.byteLength(registryContent, "utf8"),
  );
  assert.equal(
    built.bundle.character_voice_registry_source_type,
    "read_only_derived_index",
  );
  assert.equal(built.bundle.character_voice_registry_authority, "below_canon_db");
  assert.equal(
    built.bundle.content.character_voice_registry_content,
    registryContent,
  );
  assert.equal(
    built.bundle.inputs.generation_context.character_voice_registry.loaded,
    true,
  );
  assert.equal(
    built.bundle.inputs.retrieval_context.character_voice_registry.authority,
    "below_canon_db",
  );
  assert(
    built.bundle.content.writing_card_director_context.input_summary
      .generation_context_keys.includes("character_voice_registry"),
  );
  assert(
    built.bundle.content.writing_card_director_context.input_summary
      .retrieval_context_keys.includes("character_voice_registry"),
  );

  const missing = await buildGptWritingContext({
    task_prompt: "Phase23C missing registry test.",
  }, {
    gptWritingContexts: path.join(tempRoot, "missing"),
    characterVoiceRegistryPath: path.join(
      projectPaths.characterProfileDb,
      ".missing-character-voice-registry.md",
    ),
  });

  assert.equal(missing.bundle.character_voice_registry_loaded, false);
  assert.equal(missing.bundle.character_voice_registry_hash_sha256, null);
  assert.equal(missing.bundle.character_voice_registry_bytes, null);
  assert.equal(missing.bundle.content.character_voice_registry_content, "");
  assert(
    missing.bundle.warnings.includes("Missing source: character_voice_registry"),
  );

  const orchestration = await buildFullNeuralWritingOrchestration({
    task_prompt: "Phase23C orchestrator metadata test.",
  }, {
    gptWritingContexts: path.join(tempRoot, "orchestrator"),
  });

  assert.equal(
    orchestration.orchestration_report.character_voice_registry_loaded,
    true,
  );
  assert.equal(
    orchestration.pre_generation.character_voice_registry_source_type,
    "read_only_derived_index",
  );
  assert.equal(
    orchestration.pre_generation.character_voice_registry_authority,
    "below_canon_db",
  );

  assert.equal(
    sha256(await readFile(projectPaths.activeEngine)),
    sha256(activeEngineBefore),
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("Phase23C character voice registry context tests passed.");
