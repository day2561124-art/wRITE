import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  confirmApprovalItem,
  getApprovalItem,
} from "../../server/src/approval-queue-service.mjs";
import {
  buildApprovalQueueReadinessReport,
} from "../../server/src/approval-queue-readiness-service.mjs";
import {
  requestWritingCandidateAdoption,
} from "../../server/src/candidate-adoption-request-service.mjs";
import {
  buildCandidateProofingContext,
} from "../../server/src/candidate-proofing-context-service.mjs";
import {
  saveChatOutputAsProofReport,
} from "../../server/src/candidate-proof-report-service.mjs";
import {
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  adoptWritingCandidateAfterApproval,
} from "../../server/src/writing-candidate-adoption-service.mjs";
import {
  buildWriterWorkbenchState,
} from "../../server/src/writer-workbench-state-service.mjs";

const exactConfirmationText = "確認採用高風險角色語氣候選";
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const protectedPaths = [
  projectPaths.activeEngine,
  path.join(process.cwd(), "data", "writing_policy_db", "active_writing_card.md"),
  path.join(process.cwd(), "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(process.cwd(), "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];
const entityRegistryPaths = [
  "entity_registry.json",
  "entity_registry.index.json",
  "entity_registry_build_report.json",
  "conflict_report.json",
  "provenance.json",
].map((name) => path.join(process.cwd(), "data", "entity_registry", name));

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileHashes(filePaths) {
  return new Map(await Promise.all(filePaths.map(async (filePath) => [
    filePath,
    hash(await readFile(filePath)),
  ])));
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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function flowOptions(tempRoot, approvalRoot, name) {
  const root = path.join(tempRoot, name);
  return {
    gptWritingContexts: path.join(root, "gpt_writing_contexts"),
    writingCandidates: path.join(root, "writing_candidates"),
    proofingContexts: path.join(root, "proofing_contexts"),
    proofReports: path.join(root, "proof_reports"),
    approvalQueue: path.join(approvalRoot, name),
    adoptedWritings: path.join(root, "adopted_writings"),
  };
}

async function markCandidateReady(candidateId, options) {
  const metadataPath = path.join(
    options.writingCandidates,
    candidateId,
    "candidate.json",
  );
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  metadata.missing_required_neural_modules = [];
  metadata.neural_trace_complete = true;
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

async function prepareFlow(tempRoot, approvalRoot, {
  name,
  text,
  expectedVerdict,
  expectedGateStatus,
}) {
  const options = flowOptions(tempRoot, approvalRoot, name);
  const context = await buildGptWritingContext({
    task_prompt: `Phase23I ${name} live adoption smoke.`,
    generation_context: { cast: ["雪弟", "夜安晴"], safety: "candidate only" },
    retrieval_context: { character_voice_registry_role: "supporting guidance only" },
    output_mode: "candidate_save_later",
  }, options);
  const candidate = await saveChatOutputAsWritingCandidate({
    source_bundle_id: context.bundle.bundle_id,
    chat_output_text: text,
    title: `Phase23I ${name} candidate`,
  }, options);
  assert.equal(candidate.candidate_created, true);
  assert.equal(candidate.character_voice_guard_display.verdict, expectedVerdict);
  await markCandidateReady(candidate.candidate_id, options);

  const proofing = await buildCandidateProofingContext({
    candidate_id: candidate.candidate_id,
    proofing_mode: "full",
  }, options);
  assert.equal(
    proofing.context.character_voice_guard_display.verdict,
    expectedVerdict,
  );
  const proof = await saveChatOutputAsProofReport({
    candidate_id: candidate.candidate_id,
    proofing_context_id: proofing.context.proofing_context_id,
    proof_report_text: `Phase23I ${name} proof passed.`,
    verdict: "pass",
    severity: "none",
  }, options);
  assert.equal(proof.character_voice_guard_display.verdict, expectedVerdict);

  const request = await requestWritingCandidateAdoption({
    candidate_id: candidate.candidate_id,
    proof_report_id: proof.proof_report_id,
    reason: `Phase23I ${name} live adoption smoke.`,
    request_source: "chatgpt_bridge",
    source_phase: "phase_23i",
    verified_by: "phase23i_character_voice_live_adoption_smoke",
  }, options);
  assert.equal(request.ok, true, JSON.stringify(request, null, 2));
  assert.equal(request.character_voice_adoption_gate.status, expectedGateStatus);

  const item = await getApprovalItem(request.approval_item_id, options);
  const readiness = await buildApprovalQueueReadinessReport(
    request.approval_item_id,
    options,
  );
  assert.equal(readiness.ok, true);
  assert.equal(readiness.character_voice_adoption_gate.status, expectedGateStatus);

  const workbench = await buildWriterWorkbenchState(options);
  assert.equal(
    workbench.chapter.character_voice_guard_display.verdict,
    expectedVerdict,
  );
  assert.equal(
    workbench.risk.character_voice_adoption_gate.status,
    expectedGateStatus,
  );
  assert.equal(
    workbench.health.character_voice_adoption_gate,
    expectedGateStatus,
  );

  return {
    options,
    candidate,
    proof,
    request,
    item,
    readiness,
    workbench,
  };
}

const protectedBefore = await fileHashes(protectedPaths);
const entityRegistryBefore = await fileHashes(entityRegistryPaths);
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(projectPaths.outputs, ".phase23i-test-"));
const approvalRoot = await mkdtemp(
  path.join(projectPaths.approvalQueue, ".phase23i-test-"),
);

try {
  const pass = await prepareFlow(tempRoot, approvalRoot, {
    name: "pass",
    text: "雪弟調整人偶關節後說：「卡住。換軸。好了。」",
    expectedVerdict: "pass",
    expectedGateStatus: "pass",
  });
  assert.equal(pass.candidate.character_voice_guard_display.verdict, "pass");
  assert.equal(pass.request.character_voice_adoption_gate.blocking, false);
  assert.equal(pass.item.requires_second_confirmation, false);
  assert.equal(
    pass.item.details.character_voice_adoption_gate.requires_exact_confirmation_text,
    false,
  );
  const passConfirmed = await confirmApprovalItem(pass.request.approval_item_id, {
    confirm: true,
    approvedBy: "phase23i_test",
  }, pass.options);
  assert.equal(passConfirmed.result.adopted, true);
  assert.equal(passConfirmed.result.active_engine_modified, false);
  assert.equal(
    passConfirmed.result.adoption.canon_status,
    "adopted_chapter",
  );

  const warn = await prepareFlow(tempRoot, approvalRoot, {
    name: "warn",
    text: "雪弟興奮地大喊，接著手舞足蹈，長篇宣告自己現在有多麼激動。",
    expectedVerdict: "warn",
    expectedGateStatus: "requires_attention",
  });
  assert.ok(
    warn.candidate.character_voice_guard_display.verdict === "warn"
      || warn.candidate.character_voice_guard_display.severity === "medium",
  );
  assert.equal(warn.request.character_voice_adoption_gate.risk_level, "medium");
  assert.equal(warn.request.character_voice_adoption_gate.blocking, false);
  assert.equal(warn.item.requires_second_confirmation, false);
  assert.equal(warn.readiness.character_voice_guard_status, "requires_attention");
  assert.equal(
    warn.workbench.risk.character_voice_adoption_gate.status,
    "requires_attention",
  );

  const high = await prepareFlow(tempRoot, approvalRoot, {
    name: "high-risk",
    text: "夜安晴擔任戰術總指揮，隨後下令擊殺。",
    expectedVerdict: "fail",
    expectedGateStatus: "requires_second_confirmation",
  });
  assert.equal(high.candidate.character_voice_guard_display.blocking, true);
  assert.equal(high.request.character_voice_adoption_gate.blocking, true);
  assert.equal(
    high.request.character_voice_adoption_gate.requires_approval_queue,
    true,
  );
  assert.equal(
    high.request.character_voice_adoption_gate.requires_second_confirmation,
    true,
  );
  assert.equal(
    high.request.character_voice_adoption_gate.exact_confirmation_text,
    exactConfirmationText,
  );
  assert.equal(high.item.requires_second_confirmation, true);
  assert.equal(
    high.readiness.character_voice_required_confirmation_text,
    exactConfirmationText,
  );
  assert.equal(
    high.workbench.risk.character_voice_requires_second_confirmation,
    true,
  );
  assert.equal(high.workbench.risk.character_voice_adoption_gate.blocking, true);

  await assert.rejects(
    confirmApprovalItem(high.request.approval_item_id, {
      confirm: true,
      secondConfirm: false,
    }, high.options),
    /Character Voice Guard high-risk adoption requires second confirmation/u,
  );
  await assert.rejects(
    confirmApprovalItem(high.request.approval_item_id, {
      confirm: true,
      secondConfirm: true,
      approvalText: "確認採用",
    }, high.options),
    /Character Voice Guard high-risk adoption requires exact confirmation text/u,
  );

  const malformedItem = {
    ...high.item,
    requires_second_confirmation: false,
    details: {},
  };
  await assert.rejects(
    adoptWritingCandidateAfterApproval({
      approval_item_id: high.item.approval_item_id,
      candidate_id: high.candidate.candidate_id,
      proof_report_id: high.proof.proof_report_id,
      dry_run: true,
    }, {
      ...high.options,
      approvalConfirmed: true,
      approvalItem: malformedItem,
    }),
    {
      message:
        "Character Voice Guard blocking adoption requires approval queue second confirmation.",
    },
  );

  const highConfirmed = await confirmApprovalItem(high.request.approval_item_id, {
    confirm: true,
    secondConfirm: true,
    approvalText: exactConfirmationText,
    approvedBy: "phase23i_test",
  }, high.options);
  assert.equal(highConfirmed.result.adopted, true);
  assert.equal(highConfirmed.result.adoption.character_voice_guard_blocking, true);
  assert.equal(
    highConfirmed.result.adoption.character_voice_guard_override_confirmed,
    true,
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await rm(approvalRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}

for (const filePath of protectedPaths) {
  assert.equal(
    hash(await readFile(filePath)),
    protectedBefore.get(filePath),
    `Protected file changed: ${filePath}`,
  );
}
for (const filePath of entityRegistryPaths) {
  assert.equal(
    hash(await readFile(filePath)),
    entityRegistryBefore.get(filePath),
    `Entity registry side effect detected: ${filePath}`,
  );
}

console.log("Phase23I character voice live adoption smoke tests passed.");
