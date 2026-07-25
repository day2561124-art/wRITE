import assert from "node:assert";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptBridgeWritingContext,
  buildChatgptBridgeProofingContext,
  saveChatgptBridgeCandidate,
} from "../../server/src/chatgpt-bridge-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

async function run() {
  const writingCandidates = path.join(
    projectPaths.writingCandidates,
    ".phase21c-entity-registry-context-test",
  );
  const proofingContexts = path.join(
    projectPaths.proofingContexts,
    ".phase21c-entity-registry-context-test",
  );
  const options = { writingCandidates, proofingContexts };
  try {
    // Disabled behavior: should not include entity context
    const disabled = await buildChatgptBridgeWritingContext(
      { includeEntityRegistry: false },
      options,
    );
    assert(!disabled.entity_registry_context, "disabled: no entity_registry_context when not requested");

    const enabled = await buildChatgptBridgeWritingContext(
      { includeEntityRegistry: true, entityLimit: 5 },
      options,
    );
    assert(enabled.entity_registry_context, "enabled: entity_registry_context present");
    assert(Array.isArray(enabled.entity_registry_context.entities), "entities array present");

    // Proofing is candidate-bound; create an isolated candidate before checking
    // that the entity registry context mirrors the writing route.
    const candidate = await saveChatgptBridgeCandidate({
      chatOutputText: "隔離測試候選文字。",
      chapterLabel: "Phase21C",
    }, options);
    const p = await buildChatgptBridgeProofingContext({
      candidateId: candidate.candidate_id,
      includeEntityRegistry: true,
      entityLimit: 3,
    }, options);
    assert(p.entity_registry_context, "proofing: entity_registry_context present");
    assert(Array.isArray(p.entity_registry_context.entities), "proofing entities array");

    console.log("Phase21C entity registry context test passed.");
  } finally {
    await Promise.all([
      rm(writingCandidates, { recursive: true, force: true }),
      rm(proofingContexts, { recursive: true, force: true }),
    ]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
