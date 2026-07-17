import assert from "node:assert/strict";
import { buildWritingCardDirectorContext } from "../../server/src/writing-card-director-service.mjs";

async function main() {
  const ctx = buildWritingCardDirectorContext({
    taskPrompt: "Test prompt",
    generationContext: { chapter: 1 },
    retrievalContext: { chars: ["A"] },
    writingCardText: "Active writing card text",
    candidateText: "Candidate excerpt",
  });
  assert.equal(ctx.context_kind, "writing_card_director_context");
  assert.equal(ctx.basis.writing_card_version, "v3.0");
  assert.equal(ctx.fusion_mode, "mature_creator_fused_into_writing_card");
  assert(Array.isArray(ctx.twelve_core_judgments) && ctx.twelve_core_judgments.length === 0);
  console.log("Writing card director service test passed.");
}

main().catch((err) => {
  console.error(`Writing card director service test failed: ${err.message}`);
  process.exitCode = 1;
});
