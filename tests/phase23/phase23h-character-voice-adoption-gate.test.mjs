import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  confirmApprovalItem,
  getApprovalItem,
} from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import {
  buildCharacterVoiceAdoptionGate,
} from "../../server/src/character-voice-adoption-gate-service.mjs";
import {
  adoptWritingCandidateAfterApproval,
} from "../../server/src/writing-candidate-adoption-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const exactText = "確認採用高風險角色語氣候選";
const hash = (value) => createHash("sha256").update(value).digest("hex");
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
const options = {
  writingCandidates: path.join(projectPaths.writingCandidates, ".phase23h-test"),
  proofReports: path.join(projectPaths.proofReports, ".phase23h-test"),
  approvalQueue: path.join(projectPaths.approvalQueue, ".phase23h-test"),
  adoptedWritings: path.join(projectPaths.adoptedWritings, ".phase23h-test"),
};
const fixturePaths = Object.values(options);
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

async function makeReady(candidateId) {
  const metadataPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  metadata.missing_required_neural_modules = [];
  metadata.neural_trace_complete = true;
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

async function candidateAndProof(text, title) {
  const candidate = await saveChatOutputAsWritingCandidate({
    chat_output_text: text,
    title,
  }, options);
  await makeReady(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidate_id: candidate.candidate_id,
    proof_report_text: "Proof passed.",
    verdict: "pass",
    severity: "none",
  }, options);
  return { candidate, proof };
}

const transactionsBefore = await names(transactionDir);
await Promise.all(fixturePaths.map((filePath) => rm(filePath, {
  recursive: true,
  force: true,
})));
try {
  const high = await candidateAndProof(
    "夜安晴擔任戰術總指揮，隨後下令擊殺。",
    "Phase23H high-risk candidate",
  );
  const gate = buildCharacterVoiceAdoptionGate(high.candidate);
  assert.equal(gate.blocking, true);
  assert.equal(gate.requires_approval_queue, true);
  assert.equal(gate.requires_second_confirmation, true);
  assert.equal(gate.exact_confirmation_text, exactText);

  const request = await requestWritingCandidateAdoption({
    candidate_id: high.candidate.candidate_id,
    proof_report_id: high.proof.proof_report_id,
  }, options);
  assert.equal(request.ok, true);
  assert.equal(request.character_voice_guard_blocking, true);
  assert.equal(request.can_confirm_adoption, false);
  const item = await getApprovalItem(request.approval_item_id, options);
  assert.equal(item.requires_second_confirmation, true);
  assert.equal(item.details.character_voice_adoption_gate.blocking, true);
  assert.equal(item.details.character_voice_guard_display.status_label, "語氣高風險");
  assert.notEqual(item.status.status, "blocked");

  await assert.rejects(
    confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      secondConfirm: false,
    }, options),
    /Character Voice Guard high-risk adoption requires second confirmation/u,
  );
  await assert.rejects(
    confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      secondConfirm: true,
      approvalText: "確認採用",
    }, options),
    /Character Voice Guard high-risk adoption requires exact confirmation text/u,
  );

  const malformedItem = {
    ...item,
    requires_second_confirmation: false,
    details: {},
  };
  await assert.rejects(
    adoptWritingCandidateAfterApproval({
      approval_item_id: item.approval_item_id,
      candidate_id: high.candidate.candidate_id,
      proof_report_id: high.proof.proof_report_id,
      dry_run: true,
    }, {
      ...options,
      approvalConfirmed: true,
      approvalItem: malformedItem,
    }),
    /Character Voice Guard blocking adoption requires approval queue second confirmation/u,
  );

  const confirmed = await confirmApprovalItem(request.approval_item_id, {
    confirm: true,
    secondConfirm: true,
    approvalText: exactText,
    approvedBy: "phase23h_test",
  }, options);
  assert.equal(confirmed.result.adopted, true);
  assert.equal(confirmed.result.character_voice_guard_blocking, true);
  assert.equal(confirmed.result.adoption.character_voice_guard_override_confirmed, true);

  const normal = await candidateAndProof(
    "雪弟調整人偶關節後說：「卡住。換軸。好了。」",
    "Phase23H pass candidate",
  );
  const normalRequest = await requestWritingCandidateAdoption({
    candidate_id: normal.candidate.candidate_id,
    proof_report_id: normal.proof.proof_report_id,
  }, options);
  const normalItem = await getApprovalItem(normalRequest.approval_item_id, options);
  assert.equal(normalItem.details.character_voice_adoption_gate.blocking, false);
  assert.equal(normalItem.details.character_voice_adoption_gate.status, "pass");
  assert.equal(normalItem.requires_second_confirmation, false);
  const normalConfirmed = await confirmApprovalItem(normalRequest.approval_item_id, {
    confirm: true,
    approvalText: "任何文字都不影響一般採用",
  }, options);
  assert.equal(normalConfirmed.result.adopted, true);
  assert.equal(normalConfirmed.result.character_voice_guard_blocking, false);
} finally {
  await Promise.all(fixturePaths.map((filePath) => rm(filePath, {
    recursive: true,
    force: true,
  })));
  await removeNew(transactionDir, transactionsBefore);
}

for (const filePath of protectedPaths) {
  assert.equal(
    hash(await readFile(filePath)),
    protectedBefore.get(filePath),
    `Protected file changed: ${filePath}`,
  );
}

console.log("Phase23H character voice adoption gate tests passed.");
