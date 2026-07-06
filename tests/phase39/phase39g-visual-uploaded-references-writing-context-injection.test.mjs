import assert from "node:assert/strict";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  analyzeVisualUploadedReferenceWritingContextRecord,
  buildVisualUploadedReferencesWritingContextInjection,
  serializeVisualUploadedReferencesWritingContextMarkdown,
} from "../../server/src/visual-uploaded-reference-writing-context-service.mjs";

const fixtureContexts = path.join(
  projectPaths.gptWritingContexts,
  ".phase39g-visual-context-test",
);
const fixtureActive = path.join(
  projectPaths.canonDb,
  ".phase39g-active-engine-test.md",
);

function jsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

async function snapshot(root) {
  const entries = [];
  async function walk(current) {
    let children;
    try {
      children = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push(`d:${relative}`);
        await walk(absolute);
      } else {
        entries.push(`f:${relative}:${(await readFile(absolute)).toString("base64")}`);
      }
    }
  }
  await walk(root);
  return entries;
}

const baselineRecord = {
  visual_id: "VIS-19HB-BASELINE-001",
  character: "既有基準圖",
  category: "character_sheet",
  title: "既有基準圖",
  canon_status: "reference",
  source: "visual_library_persistent_baseline_activation",
  status: "imported",
  path: "data/visual_db/assets/character_sheets/baseline.png",
  notes: "manual visual reference",
  description: "既有非使用者上傳基準圖。",
  ability_state: "visual_only",
  tags: ["baseline"],
};

const uploadedReadyRecord = {
  visual_id: "VIS-UPLOAD-PHASE39G-001",
  character: "貓狼",
  category: "character_design",
  title: "貓狼",
  canon_status: "reference",
  trust_level: "T7",
  source: "user_imported",
  status: "imported",
  path: "data/visual_db/assets/characters/phase39g-maolang.png",
  notes: "Uploaded visual reference only; does not establish canon facts.",
  description: "貓狼的使用者上傳視覺參考圖。僅作外觀、造型、姿態與氛圍參考，不建立能力、身分、關係、階級或時間線正史。",
  ability_state: "visual_only",
  tags: ["貓狼", "character-design", "user-uploaded-reference", "visual-only", "reference-only"],
  metadata_source: "manual_mapping",
  metadata_enriched_at: "2026-07-06T00:00:00.000Z",
  visual_usage_scope: "visual_only_reference",
};

const before = {
  index: await readFile(projectPaths.visualIndex),
  assets: await snapshot(projectPaths.visualAssets),
  activeEngine: await readFile(projectPaths.activeEngine),
};

try {
  const analyzed = analyzeVisualUploadedReferenceWritingContextRecord(uploadedReadyRecord);
  assert.equal(
    analyzed.decision,
    "visual_uploaded_reference_writing_context_injection_item_accepted",
  );
  assert.equal(analyzed.inclusion_allowed, true);
  assert.equal(analyzed.reference_only_contract_passed, true);
  assert.equal(analyzed.metadata_ready, true);
  assert.ok(analyzed.forbidden_usage.includes("canon facts"));
  assert.ok(analyzed.forbidden_usage.includes("ability mechanics"));

  const fixturePacket = await buildVisualUploadedReferencesWritingContextInjection({
    visualIndexText: jsonl([baselineRecord, uploadedReadyRecord]),
  });
  assert.equal(
    fixturePacket.decision,
    "visual_uploaded_references_writing_context_injection_accepted",
  );
  assert.equal(fixturePacket.phase, "39G");
  assert.equal(fixturePacket.loaded, true);
  assert.equal(fixturePacket.reference_count, 1);
  assert.equal(fixturePacket.summary.ignored_non_user_uploaded_count, 1);
  assert.equal(fixturePacket.side_effect_summary.writes_visual_index, false);
  assert.equal(fixturePacket.side_effect_summary.writes_visual_assets, false);
  assert.equal(fixturePacket.side_effect_summary.updates_active_engine, false);
  assert.equal(fixturePacket.side_effect_summary.updates_canon_db, false);
  assert.equal(fixturePacket.safety_contract.must_not_establish_canon, true);
  assert.equal(fixturePacket.safety_contract.must_not_update_active_engine, true);

  const markdown = serializeVisualUploadedReferencesWritingContextMarkdown(fixturePacket);
  assert.match(markdown, /貓狼/u);
  assert.match(markdown, /visual-only reference/u);
  assert.match(markdown, /forbidden: canon facts/u);

  const blocked = await buildVisualUploadedReferencesWritingContextInjection({
    visualIndexText: jsonl([{ ...uploadedReadyRecord, ability_state: "canon_ability" }]),
  });
  assert.equal(
    blocked.decision,
    "blocked_visual_uploaded_references_writing_context_injection",
  );
  assert.equal(blocked.blocked_reference_count, 1);

  const repoPacket = await buildVisualUploadedReferencesWritingContextInjection();
  assert.equal(
    repoPacket.decision,
    "visual_uploaded_references_writing_context_injection_accepted",
  );
  assert.equal(repoPacket.summary.total_record_count, 10);
  assert.equal(repoPacket.summary.ignored_non_user_uploaded_count, 3);
  assert.equal(repoPacket.reference_count, 7);
  assert.equal(repoPacket.blocked_reference_count, 0);
  assert.ok(repoPacket.items.some((item) => item.character === "貓狼"));
  assert.equal(repoPacket.items.every((item) => item.canon_status === "reference"), true);
  assert.equal(repoPacket.items.every((item) => item.ability_state === "visual_only"), true);
  assert.equal(repoPacket.items.every((item) => item.visual_usage_scope === "visual_only_reference"), true);

  await rm(fixtureContexts, { recursive: true, force: true });
  await writeFile(fixtureActive, "# Phase39G fixture active engine\n", "utf8");
  const built = await buildGptWritingContext({
    taskPrompt: "Write with visual-only uploaded references.",
    retrievalContext: { focus: "visual references" },
    generationContext: { chapter: "phase39g" },
    includeActiveEngine: false,
    includeWritingCard: false,
    includeProofingCard: false,
    includeLongline: false,
  }, {
    gptWritingContexts: fixtureContexts,
    activeEnginePath: fixtureActive,
  });
  assert.equal(built.bundle.visual_uploaded_references_loaded, true);
  assert.equal(built.bundle.visual_uploaded_references_count, 7);
  assert.equal(built.bundle.visual_uploaded_references.safety_contract.must_not_establish_canon, true);
  assert.equal(built.bundle.inputs.retrieval_context.visual_uploaded_references.reference_count, 7);
  assert.equal(built.bundle.inputs.generation_context.visual_uploaded_references.reference_count, 7);
  const storedChat = await readFile(path.resolve(built.context_for_chat_path), "utf8");
  assert.match(storedChat, /## Visual Uploaded References \(Visual-only\)/u);
  assert.match(storedChat, /appearance, pose, style, and atmosphere guidance only/u);
  assert.match(storedChat, /canon update permission: none/u);

  const disabled = await buildGptWritingContext({
    taskPrompt: "Write without visual references.",
    includeVisualReferences: false,
    includeActiveEngine: false,
    includeWritingCard: false,
    includeProofingCard: false,
    includeLongline: false,
  }, {
    gptWritingContexts: fixtureContexts,
    activeEnginePath: fixtureActive,
  });
  assert.equal(disabled.bundle.visual_uploaded_references_loaded, false);
  assert.equal(disabled.bundle.inputs.retrieval_context.visual_uploaded_references.reference_count, 0);

  assert.deepEqual(await readFile(projectPaths.visualIndex), before.index);
  assert.deepEqual(await snapshot(projectPaths.visualAssets), before.assets);
  assert.deepEqual(await readFile(projectPaths.activeEngine), before.activeEngine);
  console.log("Phase39G visual uploaded references writing context injection tests passed.");
} finally {
  await rm(fixtureContexts, { recursive: true, force: true });
  await rm(fixtureActive, { force: true });
  assert.deepEqual(await readFile(projectPaths.visualIndex), before.index);
  assert.deepEqual(await snapshot(projectPaths.visualAssets), before.assets);
  assert.deepEqual(await readFile(projectPaths.activeEngine), before.activeEngine);
}
