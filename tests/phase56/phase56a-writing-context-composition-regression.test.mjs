import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  composeWritingContextSources,
  normalizedContextBlockHash,
  truncateStructuredContextAtBoundaries,
} from "../../server/src/context-composition-service.mjs";
import {
  buildCurrentInputRefresh,
} from "../../server/src/direct-chapter-settlement-promotion-service.mjs";
import {
  buildGptWritingContext,
  getGptWritingContextBundle,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const protectedRelativePaths = [
  "data/canon_db/active_engine.md",
  "data/error_report_db/compressed_rules.md",
  "data/writing_policy_db/active_writing_card.md",
  "data/proofing_policy_db/active_proofing_card.md",
  "data/longline_db/active_longline.md",
  "data/outputs/task_prompt.md",
  "data/outputs/generation_context.md",
  "data/outputs/retrieval_context.md",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function protectedHashes() {
  return Object.fromEntries(await Promise.all(
    protectedRelativePaths.map(async (relativePath) => [
      relativePath,
      sha256(await readFile(path.join(projectRoot, relativePath))),
    ]),
  ));
}

const settlementSummary = [
  "# 第二十三章〈先斷哪一條〉",
  "",
  "## 已發生",
  "- 雪弟勝出，貓狼主動認輸。",
  "",
  "## 角色狀態",
  "- 雪弟右大腿需縫合；貓狼左腳踝割傷。",
  "",
  "## 關係變化",
  "- 競爭性上升，信任未裂。",
  "",
  "## 待承接／未收事項",
  "- 御先的未分類靈力殘痕仍須追加比對。",
  "",
  "## 下一章銜接判斷",
  "- 可由實際比對程序或傷勢限制開場。",
].join("\n");

const identity = {
  chapter: "第二十三章",
  chapter_number: 23,
  heading: "先斷哪一條",
  display: "第二十三章〈先斷哪一條〉",
  continuity_head: "第二十三章〈先斷哪一條〉結束後",
};
const settlementReportId =
  "settlement_report_20260722-132349-1bbe3b4c";
const activeEngineHash = "a".repeat(64);

const hashesBefore = await protectedHashes();
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  "phase56a-writing-context-composition",
);
const settlementReports = path.join(
  projectPaths.outputs,
  ".phase56a-empty-settlement-reports",
);

try {
  const refresh = buildCurrentInputRefresh({
    identity,
    settlementReportId,
    settlementSummary,
    createdAt: "2026-07-22T13:23:49.969Z",
    activeEngineHash,
  });
  const taskPrompt = refresh.files.task_prompt.content;
  const generationContext =
    refresh.files.generation_context.content;
  const retrievalContext =
    refresh.files.retrieval_context.content;

  assert.doesNotMatch(taskPrompt, /雪弟勝出/u);
  assert.match(taskPrompt, /settlement_report_id/u);
  assert.match(taskPrompt, /continuity_rollback: forbidden/u);
  assert.match(generationContext, /雪弟勝出/u);
  assert.match(generationContext, /角色狀態/u);
  assert.doesNotMatch(retrievalContext, /雪弟勝出/u);
  assert.match(retrievalContext, new RegExp(activeEngineHash, "u"));
  assert.match(
    retrievalContext,
    new RegExp(refresh.files.generation_context.sha256, "u"),
  );
  for (const content of [
    taskPrompt,
    generationContext,
    retrievalContext,
  ]) {
    assert.match(
      content,
      /continuity_head: 第二十三章〈先斷哪一條〉結束後/u,
    );
  }

  const composed = composeWritingContextSources({
    taskPrompt: "承接正式章節並創作下一章。",
    continuityOverlay: settlementSummary,
    generationContext: {
      content: settlementSummary.replace(/\n/gu, "\r\n"),
    },
    retrievalContext: {
      content: settlementSummary,
    },
  });
  assert.match(composed.continuity_overlay, /雪弟勝出/u);
  assert.doesNotMatch(
    composed.generation_context.content,
    /雪弟勝出/u,
  );
  assert.doesNotMatch(
    composed.retrieval_context.content,
    /雪弟勝出/u,
  );
  assert.equal(
    composed.metadata.duplicate_sources.length,
    12,
  );
  assert.equal(
    composed.metadata.duplicate_chars_removed,
    composed.metadata.duplicate_sources.reduce(
      (total, item) =>
        total + item.dropped_character_count,
      0,
    ),
  );
  assert.equal(
    composed.metadata.duplicate_sources[0].normalized_hash,
    normalizedContextBlockHash(
      "# 第二十三章〈先斷哪一條〉",
    ),
  );
  assert.match(
    composed.metadata.duplicate_sources[0].duplicate_of,
    /latest_continuity_overlay/u,
  );

  const oldGeneratedTask = composeWritingContextSources({
    taskPrompt: [
      "# 舊 generated task",
      "",
      settlementSummary,
    ].join("\n"),
    taskPromptSource: "old_generated_inputs",
    continuityOverlay: settlementSummary,
    generationContext: {},
    retrievalContext: {},
  });
  assert.match(
    oldGeneratedTask.continuity_overlay,
    /雪弟勝出/u,
  );
  assert.doesNotMatch(
    oldGeneratedTask.task_prompt,
    /雪弟勝出/u,
  );
  assert(
    oldGeneratedTask.metadata.duplicate_sources.some(
      (entry) =>
        entry.source.includes(
          "old_generated_inputs.task_prompt",
        )
        && entry.duplicate_of.includes(
          "latest_continuity_overlay",
        ),
    ),
  );

  const bounded = truncateStructuredContextAtBoundaries({
    first: "# 第一區\n\n保留完整區塊。",
    second: `# 第二區\n\n${"長內容".repeat(200)}`,
  }, 90, "fixture_context");
  assert.equal(bounded.truncated, true);
  assert.doesNotThrow(() => JSON.parse(bounded.text));
  assert.equal(
    bounded.text.includes("...[truncated"),
    false,
  );

  await rm(fixtureRoot, {
    recursive: true,
    force: true,
  });
  await rm(settlementReports, {
    recursive: true,
    force: true,
  });
  await Promise.all([
    mkdir(fixtureRoot, { recursive: true }),
    mkdir(settlementReports, { recursive: true }),
  ]);

  const session =
    await beginChatgptOwnedExternalBrainWritingSession({
      task_prompt: "承接第二十三章，創作下一章正文候選。",
      generation_context: {
        continuity_head: identity.continuity_head,
        continuity_summary: settlementSummary,
      },
      retrieval_context: {
        generation_context_reference:
          "data/outputs/generation_context.md",
        retrieved: [{
          source_path:
            "data/canon_db/active_engine.md",
          content: "與本章直接相關的短檢索片段。",
        }],
      },
      max_context_chars: 48_000,
      includeActiveEngine: true,
    }, {
      fixtureRoot,
      settlementReports,
    });
  assert.equal(session.ok, true);
  assert.deepEqual(
    session.active_pre_generation_capabilities,
    [
      "scene_planner",
      "character_simulator",
      "over_governance_detector",
      "writing_card_director",
    ],
  );
  assert.deepEqual(
    session.pre_generation_compatibility_capabilities,
    ["neural_critic", "style_drift_detector"],
  );

  const stored = await getGptWritingContextBundle(
    session.writing_context_bundle_id,
    {
      fixtureRoot,
    },
  );
  const { bundle } = stored;
  assert.equal(
    bundle.sources.active_engine.included,
    false,
  );
  assert.equal(
    bundle.sources.active_engine.text_included,
    false,
  );
  assert.equal(
    bundle.sources.active_engine.exists,
    true,
  );
  assert.equal(
    bundle.sources.active_engine.hash,
    hashesBefore["data/canon_db/active_engine.md"],
  );
  assert.equal(
    bundle.sources.active_engine.authority_level,
    "active_hard_canon",
  );
  assert.equal(
    bundle.content.active_engine_excerpt_or_reference,
    "",
  );
  assert.equal(
    bundle.context_composition.active_engine_full_text_included,
    false,
  );
  assert.equal(
    bundle.context_composition.active_engine_text_requested,
    false,
  );
  assert.equal(
    bundle.context_composition.formal_context_only,
    true,
  );
  assert.equal(
    bundle.context_composition.proofing_card_included,
    false,
  );
  assert.equal(
    bundle.content.proofing_card_excerpt_or_reference,
    "",
  );
  assert.equal(
    bundle.context_composition.writing_card_included,
    false,
  );
  assert.equal(
    bundle.context_composition.longline_included,
    false,
  );
  assert(
    bundle.context_composition.task_prompt_chars <= 4_000,
  );
  assert(
    bundle.context_composition.generation_context_chars
      <= 12_000,
  );
  assert(
    bundle.context_composition.retrieval_context_chars
      <= 12_000,
  );
  assert(
    bundle.context_composition.active_engine_retrieval_chars
      <= 12_000,
  );
  assert(
    bundle.context_composition.total_chars_after_budget
      <= bundle.max_context_chars,
  );

  const optedInSession =
    await buildGptWritingContext({
      task_prompt: "驗證 active_engine 明確 opt-in 相容路徑。",
      generation_context: {},
      retrieval_context: {},
      includeActiveEngine: true,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
      max_context_chars: 48_000,
    }, {
      fixtureRoot,
      settlementReports,
    });
  const optedIn = await getGptWritingContextBundle(
    optedInSession.bundle.bundle_id,
    { fixtureRoot },
  );
  assert.equal(
    optedIn.bundle.sources.active_engine.included,
    true,
  );
  assert.equal(
    optedIn.bundle.context_composition
      .active_engine_text_requested,
    true,
  );
  assert.equal(
    optedIn.bundle.context_composition
      .active_engine_full_text_included,
    false,
  );
  assert(
    optedIn.bundle.content
      .active_engine_excerpt_or_reference.length > 0,
  );

  assert.deepEqual(await protectedHashes(), hashesBefore);

  console.log(
    "Phase56A writing context composition regression test passed.",
  );
} finally {
  await Promise.all([
    rm(fixtureRoot, {
      recursive: true,
      force: true,
    }),
    rm(settlementReports, {
      recursive: true,
      force: true,
    }),
  ]);
}
