import assert from "node:assert/strict";

import {
  buildWritingCardDirectorContext,
} from "../../server/src/writing-card-director-service.mjs";

const context = buildWritingCardDirectorContext({
  taskPrompt: "Test prompt",
  generationContext: { chapter: 1 },
  retrievalContext: { characters: ["A"] },
  writingCardText: "Active writing card text",
  candidateText: "Candidate excerpt",
});

assert.deepEqual(context, {
  version: "v2.0.0-minimal",
  context_kind: "writing_card_director_context",
  source: "writing_card_director_service",
  basis: {
    writing_card_version: "v4.1-minimal",
  },
});

console.log("Writing card director service minimal contract test passed.");