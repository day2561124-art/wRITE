import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  ensurePastedChapterAdopted,
  settlePastedChapter,
} from "../../server/src/direct-pasted-chapter-settlement-service.mjs";
import {
  chatgpt_bridge_save_settlement_report,
  directSettlementEnvelopeMarkers,
} from "../../server/src/mcp-direct-pasted-chapter-settlement-wrapper.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureRoot = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase42a-direct-pasted-chapter-settlement-",
));
const options = {
  adoptedWritings: path.join(fixtureRoot, "adopted_writings"),
  settlementContexts: path.join(fixtureRoot, "settlement_contexts"),
  settlementReports: path.join(fixtureRoot, "settlement_reports"),
};

const chapterText = [
  "第二十章　不能沾水",
  "",
  "「今晚不能沾水。」",
  "",
  "九逃看著千夜，沒有把手抽回去。",
].join("\n");

try {
  const first = await ensurePastedChapterAdopted({
    chapter_text: chapterText,
    user_confirmed_chapter_settlement: true,
  }, options);

  assert.match(
    first.adopted_chapter_id,
    /^adopted_chapter_\d{8}-\d{6}-[a-f0-9]{8}$/u,
  );
  assert.equal(first.adopted_reused, false);
  assert.equal(first.identity.chapter_title, "不能沾水");
  assert.equal(first.adoption.canon_status, "adopted_chapter");
  assert.equal(first.adoption.status, "accepted_pending_settlement");
  assert.equal(first.adoption.direct_settlement_authorized, true);
  assert.equal(first.adoption.active_engine_modified, false);

  const persistedChapter = await readFile(first.paths.chapter, "utf8");
  assert.equal(persistedChapter, `${chapterText}\n`);

  const second = await ensurePastedChapterAdopted({
    chapter_text: chapterText,
    user_confirmed_chapter_settlement: true,
  }, options);
  assert.equal(second.adopted_chapter_id, first.adopted_chapter_id);
  assert.equal(second.adopted_reused, true);

  const prepared = await settlePastedChapter({
    mode: "prepare",
    chapter_text: chapterText,
    user_confirmed_chapter_settlement: true,
    include_active_engine: false,
    include_foreshadowing_settlement_proposal_bridge: false,
  }, options);

  assert.equal(prepared.mode, "prepare");
  assert.equal(prepared.adopted_chapter_id, first.adopted_chapter_id);
  assert.equal(prepared.settlement_context_created, true);
  assert.match(
    prepared.settlement_context_id,
    /^settlement_ctx_\d{8}-\d{6}-[a-f0-9]{8}$/u,
  );
  assert.equal(prepared.active_engine_modified, false);
  assert.equal(prepared.engine_activation_requested, false);
  assert.equal(prepared.pending_engine_candidate_created, false);

  const envelopeDryRun = await chatgpt_bridge_save_settlement_report({
    adopted_chapter_id: "adopted_chapter_00000000-000000-00000000",
    settlement_context_id: "settlement_ctx_00000000-000000-00000000",
    settlement_report_text:
      `${directSettlementEnvelopeMarkers.prepare}\n${chapterText}`,
    dry_run: true,
  }, options);

  assert.equal(envelopeDryRun.dry_run, true);
  assert.equal(envelopeDryRun.direct_settlement_envelope_mode, "prepare");
  assert.equal(envelopeDryRun.safety.existing_tool_schema_modified, false);
  assert.equal(envelopeDryRun.safety.direct_pasted_chapter_settlement_allowed, true);
  assert.equal(envelopeDryRun.active_engine_modified, false);
  assert.equal(envelopeDryRun.engine_activation_requested, false);

  await assert.rejects(
    ensurePastedChapterAdopted({
      chapter_text: chapterText,
      user_confirmed_chapter_settlement: false,
    }, options),
    /user_confirmed_chapter_settlement must be true/u,
  );

  console.log("Phase42A direct pasted chapter settlement compatibility route passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
