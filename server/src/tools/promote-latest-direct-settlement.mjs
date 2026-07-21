import {
  readdir,
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import {
  saveDirectChapterSettlementSummary,
} from "../direct-chapter-settlement-summary-service.mjs";
import {
  projectPaths,
} from "../project-paths.mjs";

function parseArgs(argv) {
  const options = {
    chapter: "",
    heading: "",
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--chapter" || arg === "--chapter-number") {
      options.chapter = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--heading") {
      options.heading = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function latestDirectSettlement() {
  const root = projectPaths.adoptedWritingSettlementReports;
  const entries = await readdir(root, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^settlement_report_/u.test(entry.name)) {
      continue;
    }
    const directory = path.join(root, entry.name);
    const metadataPath = path.join(directory, "settlement_report.json");
    const reportPath = path.join(directory, "settlement_report.md");
    try {
      const [metadata, reportText, reportStat] = await Promise.all([
        readFile(metadataPath, "utf8").then(JSON.parse),
        readFile(reportPath, "utf8"),
        stat(reportPath),
      ]);
      if (
        metadata.report_kind !== "direct_chapter_continuity_handoff"
        || metadata.continuity_handoff !== true
      ) {
        continue;
      }
      candidates.push({
        metadata,
        reportText,
        createdAt:
          Date.parse(metadata.created_at ?? "")
          || reportStat.mtimeMs,
      });
    } catch {
      // Ignore incomplete records.
    }
  }
  candidates.sort((left, right) => right.createdAt - left.createdAt);
  if (!candidates.length) {
    throw new Error("No direct chapter settlement report was found.");
  }
  return candidates[0];
}

const args = parseArgs(process.argv.slice(2));
const latest = await latestDirectSettlement();
const result = await saveDirectChapterSettlementSummary({
  settlement_summary_text: latest.reportText,
  summary: latest.metadata.summary ?? "",
  source: latest.metadata.source ?? "chatgpt",
  chapter: args.chapter || latest.metadata.chapter || undefined,
  heading: args.heading || latest.metadata.heading || undefined,
  create_pending_engine_candidate: true,
  dry_run: args.dryRun,
});

console.log(JSON.stringify({
  ok: true,
  dry_run: args.dryRun,
  settlement_report_id: result.settlement_report_id ?? null,
  settlement_report_reused: result.settlement_report_reused === true,
  chapter: result.chapter ?? null,
  chapter_number: result.chapter_number ?? null,
  heading: result.heading ?? null,
  pending_engine_candidate_created:
    result.pending_engine_candidate_created === true,
  pending_engine_candidate_id:
    result.pending_engine_candidate_id ?? null,
  active_engine_modified: result.active_engine_modified === true,
  next_action: result.next_action ?? null,
}, null, 2));
