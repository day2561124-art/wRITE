import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  saveDirectChapterSettlementSummary,
} from "../../server/src/direct-chapter-settlement-summary-service.mjs";
import {
  buildGptWritingContext,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  buildChatgptNativeNeuralWritingHandoff,
} from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });
await mkdir(path.join(projectRoot, "tests", ".tmp"), {
  recursive: true,
});

const outputFixture = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase51a-latest-settled-continuity-",
));
const agentFixture = await mkdtemp(path.join(
  projectRoot,
  "tests",
  ".tmp",
  "phase51a-agent-",
));
const activeEnginePath = path.join(
  projectPaths.canonDb,
  ".phase51a-active-engine.md",
);
const settlementReports = path.join(
  outputFixture,
  "settlement_reports",
);
const gptWritingContexts = path.join(
  outputFixture,
  "gpt_writing_contexts",
);
const options = {
  outputs: outputFixture,
  settlementReports,
  gptWritingContexts,
  activeEnginePath,
};

const chapter19Summary = [
  "# 第十九章結算",
  "",
  "## 已發生",
  "正式選拔第一場結束，九逃獲勝。",
  "",
  "## 角色狀態",
  "千夜與九逃都需要接受醫療處置。",
  "",
  "## 關係與立場變化",
  "兩人仍處於賽後僵持。",
  "",
  "## 待承接",
  "醫療後座尚未完成。",
  "",
  "## 下一章銜接判斷",
  "承接醫務室處置。",
].join("\n");

const chapter20Summary = [
  "# 第二十章〈不能沾水〉結算",
  "",
  "## 已發生",
  "九逃與朝日奈千夜已完成醫療處置。九逃左前臂清創縫合，左肩包紮；千夜右手腕固定。",
  "",
  "## 角色狀態",
  "兩人暫時禁止傷口沾水、出力及碰異能武裝。隔日複查為千夜 07:20、九逃 07:35。",
  "",
  "## 關係與立場變化",
  "兩人能互相協助，但尚未正式和解。九逃沒有抽回正在一起處理防水護套的手。",
  "",
  "## 待承接",
  "複查、換藥約定與未完成的對話仍須保留。",
  "",
  "## 下一章銜接判斷",
  "不必承接防水護套動作的下一秒。可以合理轉場、切換視角或開啟新場景，但不得把第二十章當作未發生。",
].join("\n");

const activeEngineText = [
  "# 測試用正式母本",
  "",
  "現行正式狀態：正史止於第十九章。",
].join("\n");
const oldTaskPrompt =
  "依第十九章結尾續寫下一章，從醫務室後座開始。";
const oldGenerationContext =
  "# generation context\n\nlatest chapter: 第十九章\n";
const oldRetrievalContext =
  "# retrieval context\n\ncurrent continuity: 第十九章\n";

async function expectMissing(targetPath) {
  await assert.rejects(
    access(targetPath),
    (error) => error?.code === "ENOENT",
  );
}

try {
  await mkdir(outputFixture, { recursive: true });
  await writeFile(activeEnginePath, activeEngineText, "utf8");
  await Promise.all([
    writeFile(
      path.join(outputFixture, "task_prompt.md"),
      oldTaskPrompt,
      "utf8",
    ),
    writeFile(
      path.join(outputFixture, "generation_context.md"),
      oldGenerationContext,
      "utf8",
    ),
    writeFile(
      path.join(outputFixture, "retrieval_context.md"),
      oldRetrievalContext,
      "utf8",
    ),
  ]);

  const oldDate = new Date("2026-06-15T00:00:00.000Z");
  await Promise.all([
    "task_prompt.md",
    "generation_context.md",
    "retrieval_context.md",
  ].map((fileName) => utimes(
    path.join(outputFixture, fileName),
    oldDate,
    oldDate,
  )));

  const chapter19 = await saveDirectChapterSettlementSummary({
    settlement_summary_text: chapter19Summary,
    source: "chatgpt",
  }, options);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const chapter20 = await saveDirectChapterSettlementSummary({
    settlement_summary_text: chapter20Summary,
    source: "chatgpt",
  }, options);

  assert.notEqual(
    chapter19.settlement_report_id,
    chapter20.settlement_report_id,
  );

  const activeBefore = await readFile(activeEnginePath, "utf8");
  const built = await buildGptWritingContext({
    task_prompt: oldTaskPrompt,
    generation_context: {
      source_path: "data/outputs/generation_context.md",
      content: oldGenerationContext,
      latest_settled_continuity: {
        report_id: "stale_generation_overlay",
      },
    },
    retrieval_context: {
      source_path: "data/outputs/retrieval_context.md",
      content: oldRetrievalContext,
      latest_settled_continuity: {
        report_id: "stale_retrieval_overlay",
      },
    },
    chapter_mode: "next_chapter",
    include_visual_references: false,
    max_context_chars: 48_000,
  }, options);
  const { bundle } = built;

  assert.equal(bundle.latest_settled_continuity.loaded, true);
  assert.equal(
    bundle.latest_settled_continuity.report_id,
    chapter20.settlement_report_id,
  );
  assert.match(
    bundle.latest_settled_continuity.summary_text,
    /第二十章〈不能沾水〉/u,
  );
  assert.doesNotMatch(
    bundle.latest_settled_continuity.summary_text,
    /第十九章結算/u,
  );
  assert.equal(
    bundle.latest_settled_continuity_task_guard_applied,
    true,
  );
  assert.match(
    bundle.task_prompt,
    /\[\[LATEST_SETTLED_CONTINUITY_OVERRIDE\]\]/u,
  );
  assert.match(bundle.task_prompt, /第二十章/u);
  assert.match(bundle.task_prompt, /第十九章結尾/u);
  assert.equal(bundle.original_task_prompt, oldTaskPrompt);

  const generationOverlay =
    bundle.inputs.generation_context
      .latest_settled_continuity;
  const retrievalOverlay =
    bundle.inputs.retrieval_context
      .latest_settled_continuity;
  assert.equal(
    generationOverlay.report_id,
    chapter20.settlement_report_id,
  );
  assert.equal(
    retrievalOverlay.report_id,
    chapter20.settlement_report_id,
  );
  assert.equal(generationOverlay.summary_text, "");
  assert.equal(retrievalOverlay.summary_text, "");
  assert.match(
    bundle.latest_settled_continuity.summary_text,
    /隔日複查/u,
  );
  assert(
    bundle.context_composition.duplicate_sources.some(
      (entry) =>
        entry.source.includes("generation_context")
        && entry.duplicate_of.includes(
          "latest_continuity_overlay",
        ),
    ),
  );
  assert.equal(
    bundle.current_input_settlement_freshness
      .stale_due_to_newer_settlement,
    true,
  );
  assert.equal(
    bundle.current_input_settlement_freshness
      .inputs.task_prompt
      .stale_due_to_newer_settlement,
    true,
  );
  assert.equal(
    bundle.sources.latest_settled_continuity.hash,
    chapter20.settlement_report_hash,
  );
  assert.match(
    bundle.fixed_guard_section,
    /最新章節結算承接鎖/u,
  );
  assert.match(
    bundle.fixed_guard_section,
    /continuity rollback: forbidden/u,
  );
  assert.equal(
    bundle.content.chapter_anchor.chapter,
    "第二十章",
  );
  assert.equal(
    bundle.content.chapter_anchor
      .latest_settled_continuity_applied,
    true,
  );
  assert.equal(
    bundle.content.chapter_anchor
      .viewpoint_switch_allowed,
    true,
  );
  assert.deepEqual(
    bundle.content.chapter_anchor
      .required_core_characters,
    [],
  );
  assert.equal(bundle.active_engine_update_allowed, false);
  assert.equal(bundle.canon_update_allowed, false);
  assert.equal(bundle.adoption_allowed, false);
  assert.equal(bundle.settlement_allowed, false);

  const capturedNeuralInputs = [];
  const nativeResult =
    await buildChatgptNativeNeuralWritingHandoff({
      task_prompt: oldTaskPrompt,
      generation_context: {
        source: "old_generation_context",
      },
      retrieval_context: {
        source: "old_retrieval_context",
      },
      output_mode: "chatgpt_native_handoff",
    }, {
      fixtureRoot: agentFixture,
      buildGptWritingContextFn: async () => built,
      chatgptNativeNeuralAdapter: async (input) => {
        capturedNeuralInputs.push(input);
        return {
          summary: "captured",
          result_summary: "captured",
        };
      },
    });

  assert.equal(capturedNeuralInputs.length > 0, true);
  assert.equal(
    capturedNeuralInputs[0].task_prompt,
    oldTaskPrompt,
  );
  assert.equal(
    capturedNeuralInputs[0]
      .writing_context
      .materials
      .continuity
      .report_id,
    chapter20.settlement_report_id,
  );
  assert.equal(
    capturedNeuralInputs[0]
      .writing_context
      .materials
      .continuity
      .transition_suggestion_included,
    false,
  );
  assert.equal(
    capturedNeuralInputs[0]
      .generation_context
      .latest_settled_continuity
      .report_id,
    chapter20.settlement_report_id,
  );
  assert.equal(
    capturedNeuralInputs[0]
      .retrieval_context
      .latest_settled_continuity
      .report_id,
    chapter20.settlement_report_id,
  );
  assert.match(
    nativeResult.chatgpt_native_writing_handoff
      .final_chatgpt_writing_instruction,
    /依第十九章結尾續寫下一章/u,
  );
  assert.equal(nativeResult.active_engine_updated, false);
  assert.equal(nativeResult.canon_updated, false);
  assert.equal(nativeResult.adopted, false);
  assert.equal(nativeResult.settled, false);

  const activeAfter = await readFile(activeEnginePath, "utf8");
  assert.equal(activeAfter, activeBefore);

  await expectMissing(path.join(
    outputFixture,
    "adopted_writings",
  ));
  await expectMissing(path.join(
    outputFixture,
    "pending_engine_candidates",
  ));

  console.log(
    "Phase51A latest settled continuity overlay test passed.",
  );
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(agentFixture, { recursive: true, force: true }),
    rm(activeEnginePath, { force: true }),
  ]);
}
