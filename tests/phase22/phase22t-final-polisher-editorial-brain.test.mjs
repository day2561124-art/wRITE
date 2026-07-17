import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFinalPolisherEditorialBrain } from "../../server/src/final-polisher-editorial-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".phase22t-final-polisher-test");
const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".phase22t-final-polisher-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

const directorContext = {
  chapter_turn: "終端通知逼角色重新選擇。",
  scene_function: "角色選擇",
  ending_event_hook: "章尾用具體終端通知收束。",
};

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

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine, "utf8");
  const productionHash = hash(productionActive);
  const transactionsBefore = await names(transactionDir);
  await Promise.all([
    rm(fixtureCandidates, { recursive: true, force: true }),
    rm(fixtureContexts, { recursive: true, force: true }),
  ]);

  try {
    const skipped = runFinalPolisherEditorialBrain({});
    assert.equal(skipped.status, "skipped");
    assert.equal(skipped.writing_pipeline_complete, false);
    assert.equal(skipped.revision_report.revision_scope, "skipped");
    assert(skipped.warnings.includes("raw_draft_missing"));

    const blocked = runFinalPolisherEditorialBrain({
      raw_draft_text: "# Candidate\n\n戰鬥開始。真正的風暴才剛開始。",
      writing_card_director_context: {
        chapter_turn: "",
        scene_function: "推進",
        ending_event_hook: "",
      },
    });
    assert.equal(blocked.status, "completed");
    assert.equal(blocked.needs_structural_revision, false);
    assert.equal(blocked.suggested_return_stage, null);
    assert.ok(blocked.polished_text.length > 0);
    assert(!blocked.revision_report.risk_flags.includes("missing_chapter_turn"));
    assert(!blocked.revision_report.risk_flags.includes("missing_scene_function"));
    assert(!blocked.revision_report.risk_flags.includes("missing_ending_event_hook"));
    assert(!blocked.revision_report.risk_flags.includes("ending_hook_is_pretty_sentence_only"));
    assert(!blocked.revision_report.risk_flags.includes("battle_payment_insufficient"));

    const rawDraft = [
      "# Candidate",
      "",
      "走廊的終端亮了一下。",
      "「我認為我們現在應該重新評估這件事的意義。」",
      "千夜感受到一種難以言喻的壓迫感在胸口蔓延。",
      "她沒有立刻回話，只把螢幕按暗。",
      "下一秒，候場名單更新了。",
    ].join("\n");
    const completed = runFinalPolisherEditorialBrain({
      raw_draft_text: rawDraft,
      writing_card_director_context: directorContext,
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.needs_structural_revision, false);
    assert(completed.polished_text.includes("難以言喻的壓迫感"));
    assert(!completed.polished_text.includes("胸口悶了一下"));
    assert(!/[。！？]{2,}/u.test(completed.polished_text), "Polished text contains duplicate sentence punctuation.");
    assert(!completed.polished_text.includes("這事不對。。"), "Human diction polish left duplicate punctuation.");
    assert.equal(completed.revision_report.raw_draft_hash, hash(rawDraft));
    assert.equal(completed.revision_report.polished_text_hash, hash(completed.polished_text));

    const context = await buildGptWritingContext({
      taskPrompt: "Phase22T: save polished text as candidate.",
      include_active_engine: false,
    }, {
      gptWritingContexts: fixtureContexts,
    });
    const saved = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      raw_draft_text: rawDraft,
      title: "Phase22T candidate",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });
    assert.equal(saved.candidate_created, true);
    assert.equal(saved.final_polisher_result.status, "completed");
    const detail = await getWritingCandidateDetail(saved.candidate_id, {
      writingCandidates: fixtureCandidates,
      includeContent: true,
      maxContentChars: 1000,
    });
    assert(detail.content.includes("難以言喻的壓迫感"), "Candidate did not preserve the original text.");
    assert(!detail.content.includes("胸口悶了一下"), "Candidate applied a fixed body-response replacement.");
    assert(!/[。！？]{2,}/u.test(detail.content), "Candidate polished_text contains duplicate sentence punctuation.");
    assert.equal(detail.metadata.raw_draft_hash, hash(rawDraft));
    assert.equal(detail.metadata.polished_text_hash, saved.candidate_hash);

    const blockedSave = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      raw_draft_text: "# Candidate\n\n戰鬥開始。真正的風暴才剛開始。",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });
    assert.equal(blockedSave.candidate_created, true);
    assert.equal(
      blockedSave.final_polisher_result.status,
      "completed",
    );
    assert.equal(
      blockedSave.final_polisher_result.needs_structural_revision,
      false,
    );
    assert.equal(
      blockedSave.final_polisher_result.suggested_return_stage,
      null,
    );

    assert.equal(hash(await readFile(projectPaths.activeEngine, "utf8")), productionHash);
    console.log("Phase22T final polisher editorial brain tests passed.");
  } finally {
    await Promise.all([
      rm(fixtureCandidates, { recursive: true, force: true }),
      rm(fixtureContexts, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Phase22T final polisher editorial brain test failed: ${error.message}`);
  process.exitCode = 1;
});
