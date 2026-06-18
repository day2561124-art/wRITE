import assert from "node:assert/strict";
import { runFinalPolisher } from "../../server/src/final-polisher-service.mjs";

async function main() {
  // No candidate -> skipped
  const res1 = runFinalPolisher({});
  assert.equal(res1.module, "final_polisher");
  assert.equal(res1.scope, "candidate_text_only");
  assert.equal(res1.status, "skipped");
  console.log("Final polisher skipped test passed.");

  // With candidate -> completed + revision_report
  const sample = `她的右腕麻感漸漸顯現。\n"我很難過，這是我的錯。"\n最後，他們在夜色中收束，心中有一種希望。\n`;
  const res2 = runFinalPolisher({ candidateText: sample });
  assert.equal(res2.module, "final_polisher");
  assert.equal(res2.scope, "candidate_text_only");
  assert.equal(res2.status, "completed");
  assert(Array.isArray(res2.revision_report.paragraph_level_issues));
  assert(Array.isArray(res2.revision_report.dialogue_subtext_issues));
  assert(typeof res2.polished_text === "string");
  console.log("Final polisher completed test passed.");
}

main().catch((err)=>{
  console.error(`Final polisher service test failed: ${err.message}`);
  process.exitCode = 1;
});
