import { stat } from "node:fs/promises";
import {
  isVisualAssetProjectPath,
  validateVisualRecord,
  visualCategorySpecs,
} from "../server/src/visual-db.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const valid = {
    visual_id: "VIS-CHIYA-ARMED-001",
    created_at: "2026-06-07T00:00:00.000Z",
    character: "朝日奈千夜",
    category: "armed_form",
    title: "正式選拔期武裝外觀",
    canon_status: "reference",
    trust_level: "T7",
    source: "user_imported",
    path: "data/visual_db/assets/armed_forms/chiya_armed_001.png",
    notes: "Visual reference only; ability mechanics are not established by this image.",
    tags: ["千夜", "異能武裝"],
  };
  const validResult = validateVisualRecord(valid);
  assert(validResult.errors.length === 0, `Valid visual record had errors: ${validResult.errors.join("; ")}`);
  assert(isVisualAssetProjectPath(valid.path), "Valid visual asset path was rejected.");

  const badPath = validateVisualRecord({
    ...valid,
    visual_id: "VIS-BAD-001",
    path: "data/canon_db/active_engine.md",
  });
  assert(badPath.errors.some((error) => error.includes("data/visual_db/assets")), "Bad visual path was not rejected.");

  const approvedWarning = validateVisualRecord({
    ...valid,
    canon_status: "approved_visual",
    trust_level: "T7",
  });
  assert(
    approvedWarning.warnings.some((warning) => warning.includes("trust_level T3")),
    "Approved visual trust-level warning was not emitted.",
  );

  assert(visualCategorySpecs.length >= 4, "Visual category registry is unexpectedly small.");
  const indexStats = await stat("data/visual_db/visual_index.jsonl");
  assert(indexStats.isFile(), "visual_index.jsonl is missing.");

  console.log("Visual DB contract test passed.");
}

main().catch((error) => {
  console.error(`Visual DB contract test failed: ${error.message}`);
  process.exitCode = 1;
});
