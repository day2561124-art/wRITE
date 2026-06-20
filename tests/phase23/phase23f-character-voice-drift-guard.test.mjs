import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  evaluateCharacterVoiceDrift,
} from "../../server/src/character-voice-drift-guard-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import {
  buildCandidateProofingContext,
} from "../../server/src/candidate-proofing-context-service.mjs";
import {
  getProofReportDetail,
  saveChatOutputAsProofReport,
} from "../../server/src/candidate-proof-report-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function finding(result, code, character = null) {
  return result.findings.find((item) => (
    item.code === code
    && (!character || item.characters.includes(character))
  ));
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

const passText = `
朝日奈千夜輕聲說：「我有點緊張，但撤離順序由我來補。」
九逃把重物移開後說：「可以。妳負責順序，我替妳核對傷口。」
貓狼挑眉說：「一個補表，一個補人，總算沒有把流程補成迷宮。」
雪弟調整人偶關節後說：「卡住。換軸。好了。」
夜安晴揮著引導帶說：「小澤，我先跑一遍，你幫我看轉角！」
夜文澤看著地圖說：「好。姐姐，第二個轉角會不會太窄？」
宇天笑著說：「圖都快被我們看害羞了。千函，妳來救場。」
千函調低燈光說：「入口偏十五度即可。哥，先別轉筆。」
拉芙蒂・里德斯特記下修改後說：「保留原案與修訂理由，明日才能回看。」
莉莉絲微笑說：「備用路線已排好，只需決定是否加入說明。」
`.trim();

{
  const result = await evaluateCharacterVoiceDrift({ candidate_text: passText });
  assert.equal(result.character_voice_guard_used, true);
  assert.equal(result.character_voice_registry_loaded, true);
  assert.equal(result.character_voice_registry_source_type, "read_only_derived_index");
  assert.equal(result.character_voice_registry_authority, "below_canon_db");
  assert.equal(result.verdict, "pass");
  assert.equal(result.severity, "none");
  assert.equal(result.findings.length, 0);
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: "千夜安靜地整理表格。",
    context_bundle: {
      character_voice_registry_loaded: false,
      content: { character_voice_registry_content: "" },
    },
  }, {
    characterVoiceRegistryPath: path.join(
      projectPaths.characterProfileDb,
      ".phase23f-missing-registry.md",
    ),
  });
  assert.equal(result.character_voice_registry_loaded, false);
  assert.equal(result.verdict, "warn");
  assert.ok(finding(result, "voice_registry_missing"));
  assert.ok(finding(result, "voice_registry_unavailable"));
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: "雪弟興奮地大喊，接著手舞足蹈，滔滔不絕地說了很久。",
  });
  assert.ok(finding(result, "voice_trait_contradiction", "雪弟"));
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: [
      "夜安晴開心地說：「大家一起加油就好了！」",
      "夜文澤開心地說：「大家一起加油就好了！」",
    ].join("\n"),
  });
  const conflation = finding(result, "voice_pair_conflation");
  assert.deepEqual(conflation.characters, ["夜安晴", "夜文澤"]);
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: "九逃是萬能補師，一鍵治好所有傷勢，所有問題都能治好。",
  });
  assert.ok(finding(result, "role_reduction", "九逃"));
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: "莊是個笨蛋，腦袋空空，完全沒有思考能力。",
  });
  assert.ok(finding(result, "voice_trait_contradiction", "莊"));
}

{
  const result = await evaluateCharacterVoiceDrift({
    candidate_text: [
      "拉芙蒂・里德斯特冷冰冰地用公文口吻說：「依規定辦理。」",
      "莉莉絲也冷冰冰地用公文口吻說：「依規定辦理。」",
    ].join("\n"),
  });
  const conflation = finding(result, "voice_pair_conflation");
  assert.deepEqual(conflation.characters, ["拉芙蒂・里德斯特", "莉莉絲"]);
}

const tempRoot = await mkdtemp(path.join(projectPaths.outputs, ".phase23f-test-"));
const options = {
  gptWritingContexts: path.join(tempRoot, "gpt_writing_contexts"),
  writingCandidates: path.join(tempRoot, "writing_candidates"),
  proofingContexts: path.join(tempRoot, "proofing_contexts"),
  proofReports: path.join(tempRoot, "proof_reports"),
};

try {
  const context = await buildGptWritingContext({
    task_prompt: "Phase23F proof metadata integration test.",
    generation_context: {
      cast: ["朝日奈千夜", "九逃", "貓狼", "雪弟"],
      safety: "candidate only",
    },
    retrieval_context: {
      character_voice_registry_role: "supporting guidance only",
    },
    output_mode: "candidate_save_later",
  }, options);

  const saved = await saveChatOutputAsWritingCandidate({
    source_bundle_id: context.bundle.bundle_id,
    chat_output_text: passText,
    title: "Phase23F integration candidate",
  }, options);
  assert.equal(saved.candidate_created, true);
  assert.equal(saved.character_voice_guard_used, true);
  assert.equal(saved.character_voice_guard_verdict, "pass");

  const candidate = await getWritingCandidateDetail(saved.candidate_id, options);
  assert.equal(candidate.metadata.character_voice_registry_loaded, true);
  assert.equal(
    candidate.metadata.character_voice_registry_hash_sha256,
    context.bundle.character_voice_registry_hash_sha256,
  );
  assert.equal(candidate.metadata.character_voice_guard_findings_count, 0);
  assert.equal(candidate.metadata.canon_status, "candidate_only");
  assert.equal(candidate.metadata.adopted, false);
  assert.equal(candidate.metadata.settled, false);

  const proofing = await buildCandidateProofingContext({
    candidate_id: saved.candidate_id,
    proofing_mode: "full",
  }, options);
  assert.equal(proofing.context.character_voice_guard_used, true);
  assert.equal(proofing.context.character_voice_guard_verdict, "pass");
  assert.equal(proofing.context.character_voice_guard_findings_count, 0);

  const proof = await saveChatOutputAsProofReport({
    candidate_id: saved.candidate_id,
    proofing_context_id: proofing.context.proofing_context_id,
    proof_report_text: "Phase23F proof report: voice guard passed.",
    verdict: "pass",
    severity: "none",
  }, options);
  assert.equal(proof.character_voice_guard_used, true);
  assert.equal(proof.character_voice_guard_verdict, "pass");

  const proofDetail = await getProofReportDetail(proof.proof_report_id, options);
  assert.equal(proofDetail.metadata.character_voice_registry_loaded, true);
  assert.equal(proofDetail.metadata.character_voice_guard_severity, "none");
  assert.equal(proofDetail.metadata.character_voice_guard_findings_count, 0);
  assert.equal(proofDetail.metadata.character_voice_guard.verdict, "pass");
  assert.equal(proofDetail.metadata.canon_status, "candidate_only");
  assert.equal(proofDetail.metadata.approval_item_created, false);
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

console.log("Phase23F character voice drift guard tests passed.");
