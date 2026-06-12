import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { reindexVisualAssets } from "../server/src/visual-reindex-service.mjs";
import { validateVisualRecord } from "../server/src/visual-db.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), "visual-reindex-"));
  const assetsPath = path.join(root, "assets");
  const indexPath = path.join(root, "visual_index.jsonl");
  const expectedCategories = {
    characters: "character_design",
    armed_forms: "armed_form",
    outfits: "outfit",
    abilities: "ability",
    expressions: "expression",
    scenes: "scene_reference",
    other: "scene_reference",
  };

  try {
    for (const directory of Object.keys(expectedCategories)) {
      const target = path.join(assetsPath, directory);
      await mkdir(target, { recursive: true });
      await writeFile(path.join(target, `${directory}.png`), "png fixture");
    }

    const result = await reindexVisualAssets({ assetsPath, indexPath });
    const records = (await readFile(indexPath, "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));

    assert(result.records === 7 && records.length === 7, "Reindex did not create one record per PNG.");
    for (const record of records) {
      const directory = record.path.split("/").at(-2);
      assert(record.category === expectedCategories[directory], `Wrong category for ${record.path}.`);
      assert(record.title === directory, `Filename title fallback missing for ${record.path}.`);
      assert(record.character === "unknown", `Character fallback missing for ${record.path}.`);
      assert(record.status === "imported", `Imported status missing for ${record.path}.`);
      assert(record.source === "reindexed_from_assets", `Reindex source missing for ${record.path}.`);
      assert(record.metadata_source === "fallback", `Fallback metadata source missing for ${record.path}.`);
      assert(record.tags.length === 0, `Tag fallback missing for ${record.path}.`);
      assert(validateVisualRecord(record).errors.length === 0, `Invalid record for ${record.path}.`);
    }

    const secondResult = await reindexVisualAssets({ assetsPath, indexPath });
    assert(secondResult.records === records.length, "Reindex is not idempotent.");

    const preservedPath = records[0].path;
    const preservedCreatedAt = records[0].created_at;
    const preservedStatus = records[0].status;
    const preserved = records.map((record) => record.path === preservedPath
      ? {
          ...record,
          title: "人工命名",
          character: "測試角色",
          tags: ["角色基準圖"],
          metadata_source: "manual_mapping",
        }
      : record);
    await writeFile(indexPath, `${preserved.map((record) => JSON.stringify(record)).join("\n")}\n`);
    await reindexVisualAssets({ assetsPath, indexPath });
    const afterPreserve = (await readFile(indexPath, "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line))
      .find((record) => record.path === preservedPath);
    assert(afterPreserve.title === "人工命名", "Reindex overwrote an existing title.");
    assert(afterPreserve.character === "測試角色", "Reindex overwrote an existing character.");
    assert(afterPreserve.category === records[0].category, "Reindex overwrote an existing category.");
    assert(afterPreserve.tags[0] === "角色基準圖", "Reindex overwrote existing tags.");
    assert(afterPreserve.created_at === preservedCreatedAt, "Reindex overwrote created_at.");
    assert(afterPreserve.status === preservedStatus, "Reindex overwrote status.");

    const gitignore = await readFile(path.resolve(".gitignore"), "utf8");
    assert(
      gitignore.split(/\r?\n/u).includes("data/visual_db/assets/"),
      "Visual PNG assets are no longer ignored by git.",
    );
    console.log("Visual asset reindex test passed.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Visual asset reindex test failed: ${error.message}`);
  process.exitCode = 1;
});
