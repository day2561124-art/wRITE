import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import {
  buildCandidateProofingContext,
  getCandidateProofingContext,
} from "../../server/src/candidate-proofing-context-service.mjs";
import {
  getProofReportDetail,
  saveChatOutputAsProofReport,
} from "../../server/src/candidate-proof-report-service.mjs";
import {
  formatCharacterVoiceGuardForDisplay,
} from "../../server/src/character-voice-guard-display.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { buildWriterWorkbenchState } from "../../server/src/writer-workbench-state-service.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const protectedPaths = [
  projectPaths.activeEngine,
  path.join(process.cwd(), "data", "writing_policy_db", "active_writing_card.md"),
  path.join(process.cwd(), "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(process.cwd(), "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];
const protectedBefore = new Map(await Promise.all(protectedPaths.map(async (filePath) => [
  filePath,
  hash(await readFile(filePath)),
])));

const missingDisplay = formatCharacterVoiceGuardForDisplay(null);
assert.equal(missingDisplay.status_label, "尚未執行");
assert.equal(missingDisplay.badge_class, "is-missing");
assert.equal(missingDisplay.blocking, false);

const tempRoot = await mkdtemp(path.join(projectPaths.outputs, ".phase23g-test-"));
const options = {
  gptWritingContexts: path.join(tempRoot, "gpt_writing_contexts"),
  writingCandidates: path.join(tempRoot, "writing_candidates"),
  proofingContexts: path.join(tempRoot, "proofing_contexts"),
  proofReports: path.join(tempRoot, "proof_reports"),
};

try {
  const context = await buildGptWritingContext({
    task_prompt: "Phase23G character voice guard surface test.",
    generation_context: { cast: ["雪弟", "夜安晴"], safety: "candidate only" },
    retrieval_context: { character_voice_registry_role: "supporting guidance only" },
    output_mode: "candidate_save_later",
  }, options);

  const pass = await saveChatOutputAsWritingCandidate({
    source_bundle_id: context.bundle.bundle_id,
    chat_output_text: "雪弟調整人偶關節後說：「卡住。換軸。好了。」",
    title: "Phase23G pass candidate",
  }, options);
  assert.equal(pass.character_voice_guard_display.verdict, "pass");
  assert.equal(pass.character_voice_guard_display.status_label, "語氣正常");
  assert.equal(pass.character_voice_guard_display.blocking, false);

  const passDetail = await getWritingCandidateDetail(pass.candidate_id, options);
  assert.equal(passDetail.character_voice_guard_display.verdict, "pass");
  assert.equal(passDetail.metadata.character_voice_guard_display.status_label, "語氣正常");

  const warn = await saveChatOutputAsWritingCandidate({
    chat_output_text: "雪弟興奮地大喊，接著手舞足蹈。",
    title: "Phase23G warn candidate",
  }, options);
  assert.equal(warn.character_voice_guard_display.verdict, "warn");
  assert.ok(warn.character_voice_guard_display.findings_count > 0);
  assert.ok(warn.character_voice_guard_display.findings[0].characters.includes("雪弟"));
  assert.ok(warn.character_voice_guard_display.findings[0].recommendation);

  const fail = await saveChatOutputAsWritingCandidate({
    chat_output_text: "夜安晴擔任戰術總指揮，隨後下令擊殺。",
    title: "Phase23G fail candidate",
  }, options);
  assert.equal(fail.character_voice_guard_display.verdict, "fail");
  assert.equal(fail.character_voice_guard_display.severity, "high");
  assert.equal(fail.character_voice_guard_display.blocking, true);
  assert.equal(fail.character_voice_guard_display.status_label, "語氣高風險");
  assert.equal(fail.candidate_created, true);

  const proofing = await buildCandidateProofingContext({
    candidate_id: pass.candidate_id,
    proofing_mode: "full",
  }, options);
  assert.equal(proofing.context.character_voice_guard_display.verdict, "pass");
  const proofingDetail = await getCandidateProofingContext(
    proofing.context.proofing_context_id,
    options,
  );
  assert.match(proofingDetail.proofing_for_chat, /Character Voice Drift Guard/u);
  assert.match(proofingDetail.proofing_for_chat, /Verdict: pass/u);
  assert.match(proofingDetail.proofing_for_chat, /Severity: none/u);
  assert.match(proofingDetail.proofing_for_chat, /Findings count: 0/u);

  const proof = await saveChatOutputAsProofReport({
    candidate_id: pass.candidate_id,
    proofing_context_id: proofing.context.proofing_context_id,
    proof_report_text: "Phase23G proof report.",
    verdict: "pass",
    severity: "none",
  }, options);
  assert.equal(proof.character_voice_guard_display.status_label, "語氣正常");
  const proofDetail = await getProofReportDetail(proof.proof_report_id, options);
  assert.equal(
    proofDetail.metadata.character_voice_guard_display.status_label,
    "語氣正常",
  );

  const workbench = await buildWriterWorkbenchState(options);
  assert.equal(workbench.chapter.character_voice_guard_display.verdict, "pass");
  assert.equal(workbench.risk.character_voice_guard_display.verdict, "pass");
  assert.equal(workbench.risk.character_voice_guard_blocking, false);
  assert.equal(workbench.health.character_voice_guard, "pass");
  assert.equal(workbench.health.character_voice_registry_loaded, true);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

for (const filePath of protectedPaths) {
  assert.equal(
    hash(await readFile(filePath)),
    protectedBefore.get(filePath),
    `Protected file changed: ${filePath}`,
  );
}

console.log("Phase23G character voice guard surface tests passed.");
