import assert from "node:assert/strict";
import { buildWritingCardDirectorContext } from "../../server/src/writing-card-director-service.mjs";

async function main() {
  const ctx = buildWritingCardDirectorContext({ taskPrompt: "tone: battle" , writingCardText: "戰鬥 場景 選拔"});
  assert.equal(typeof ctx.heuristics, "object");
  assert.ok(Array.isArray(ctx.archetype_engines) && ctx.archetype_engines.length === 0);
  assert.equal(ctx.basis.writing_card_version, "v3.0");
  console.log("Writing card director context test passed.");
}

main().catch((err) => {
  console.error(`Writing card director context test failed: ${err.message}`);
  process.exitCode = 1;
});
