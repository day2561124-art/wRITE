import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { updateVisualMetadata } from "../server/src/visual-metadata-service.mjs";
import { validateVisualRecord } from "../server/src/visual-db.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), "visual-metadata-"));
  const indexPath = path.join(root, "visual_index.jsonl");
  const record = {
    visual_id: "VIS-REINDEX-TEST",
    created_at: "2026-06-07T00:00:00.000Z",
    character: "unknown",
    category: "character_design",
    title: "visual-test",
    canon_status: "reference",
    trust_level: "T7",
    source: "reindexed_from_assets",
    status: "imported",
    metadata_source: "fallback",
    path: "data/visual_db/assets/characters/visual-test.png",
    notes: "Visual reference only.",
    tags: [],
  };

  try {
    await writeFile(indexPath, `${JSON.stringify(record)}\n`);
    const result = await updateVisualMetadata({
      indexPath,
      mapping: [
        {
          path: record.path,
          title: "角色立繪A",
          character: "未命名少女",
          category: "人設",
          tags: ["半寫實", "角色基準圖"],
        },
        {
          path: "data/visual_db/assets/characters/missing.png",
          title: "不存在",
        },
      ],
    });
    assert(result.updated.length === 1, "Metadata updater did not report the updated path.");
    assert(result.skipped[0]?.reason === "path_not_found", "Missing path was not skipped.");

    const updated = JSON.parse((await readFile(indexPath, "utf8")).trim());
    assert(updated.title === "角色立繪A", "Title was not updated.");
    assert(updated.character === "未命名少女", "Character was not updated.");
    assert(updated.category === "character_design", "Category alias was not normalized.");
    assert(updated.tags.length === 2, "Tags were not updated.");
    assert(updated.metadata_source === "manual_mapping", "Metadata source was not recorded.");
    assert(validateVisualRecord(updated).errors.length === 0, "Updated record failed validation.");

    let traversalRejected = false;
    try {
      await updateVisualMetadata({
        indexPath,
        mapping: [{ path: "../active_engine.md", title: "bad" }],
      });
    } catch {
      traversalRejected = true;
    }
    assert(traversalRejected, "Metadata mapping accepted path traversal.");
    console.log("Visual metadata update test passed.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Visual metadata update test failed: ${error.message}`);
  process.exitCode = 1;
});
