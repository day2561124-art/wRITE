import { readdir } from "node:fs/promises";
import {
  repairDirectSettlementPromotionCandidateReviewability,
} from "../direct-chapter-settlement-promotion-service.mjs";
import { projectPaths } from "../project-paths.mjs";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function candidateIds() {
  const explicit = argumentValue("--candidate-id");
  if (explicit) return [explicit];
  if (!process.argv.includes("--all")) {
    throw new Error("Use --candidate-id <id> or --all.");
  }
  const entries = await readdir(projectPaths.pendingEngineCandidates, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("engine_candidate_"))
    .map((entry) => entry.name)
    .sort();
}

const results = [];
for (const candidateId of await candidateIds()) {
  try {
    results.push(await repairDirectSettlementPromotionCandidateReviewability(candidateId));
  } catch (error) {
    if (process.argv.includes("--all") && /not a direct chapter settlement promotion/u.test(error.message)) {
      continue;
    }
    throw error;
  }
}

process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
