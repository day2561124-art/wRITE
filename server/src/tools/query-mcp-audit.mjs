import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultAuditPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/query-mcp-audit.mjs [options]",
    "",
    "Options:",
    "  --file <path>              Audit JSONL path. Default: data/outputs/logs/mcp_tool_audit.jsonl",
    "  --tool <name>              Filter by tool_name. Can be repeated.",
    "  --risk <risk>              Filter by risk. Can be repeated.",
    "  --status <status>          Filter by audit status. Can be repeated.",
    "  --actor <actor>            Filter by actor. Can be repeated.",
    "  --confirmation-id <id>     Filter by confirmation_id. Use none for null.",
    "  --affected-path <path>     Filter by affected path substring. Can be repeated.",
    "  --query <text>             Case-insensitive search across audit_id/tool/result/inputs.",
    "  --limit <n>                Maximum records to print. Default: 20",
    "  --latest                   Sort newest first. Default true.",
    "  --oldest                   Sort oldest first.",
    "  --json                     Output compact JSON summary.",
    "  --show-json                Output matching raw records as JSONL.",
    "",
    "Examples:",
    "  node server/src/tools/query-mcp-audit.mjs --latest --limit 5",
    "  node server/src/tools/query-mcp-audit.mjs --tool import_policy_file --confirmation-id none",
    "  node server/src/tools/query-mcp-audit.mjs --affected-path active_engine.md --json",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function normalizePath(filePath) {
  return path.relative(rootDir, path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath)).replaceAll(path.sep, "/");
}

function parseArgs(argv) {
  const options = {
    filePath: defaultAuditPath,
    tools: [],
    risks: [],
    statuses: [],
    actors: [],
    confirmationId: "",
    affectedPaths: [],
    query: "",
    limit: 20,
    latest: true,
    json: false,
    showJson: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--file requires a path.");
      }
      options.filePath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--tool") {
      options.tools.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--risk") {
      options.risks.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--status") {
      options.statuses.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--actor") {
      options.actors.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--confirmation-id") {
      options.confirmationId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--affected-path") {
      options.affectedPaths.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--query") {
      options.query = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const value = Number.parseInt(argv[index + 1], 10);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--limit must be a positive integer.");
      }
      options.limit = value;
      index += 1;
      continue;
    }

    if (arg === "--latest") {
      options.latest = true;
      continue;
    }

    if (arg === "--oldest") {
      options.latest = false;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--show-json") {
      options.showJson = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  options.tools = options.tools.filter(Boolean);
  options.risks = options.risks.filter(Boolean);
  options.statuses = options.statuses.filter(Boolean);
  options.actors = options.actors.filter(Boolean);
  options.affectedPaths = options.affectedPaths.filter(Boolean);
  return options;
}

async function readJsonl(filePath) {
  let text = "";
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter((entry) => entry.line)
    .map((entry) => {
      try {
        return {
          lineNumber: entry.lineNumber,
          record: JSON.parse(entry.line),
        };
      } catch (error) {
        throw new Error(`Invalid JSONL at ${normalizePath(filePath)}:${entry.lineNumber}: ${error.message}`);
      }
    });
}

function normalizeValue(value) {
  return String(value ?? "").toLowerCase();
}

function includesAnyExact(value, filters) {
  if (filters.length === 0) {
    return true;
  }
  const normalized = normalizeValue(value);
  return filters.some((filter) => normalized === normalizeValue(filter));
}

function includesAnySubstring(values, filters) {
  if (filters.length === 0) {
    return true;
  }
  const haystack = values.map(normalizeValue);
  return filters.some((filter) => haystack.some((value) => value.includes(normalizeValue(filter))));
}

function confirmationMatches(record, filter) {
  if (!filter) {
    return true;
  }
  if (normalizeValue(filter) === "none") {
    return record.confirmation_id === null || record.confirmation_id === undefined || record.confirmation_id === "";
  }
  return normalizeValue(record.confirmation_id) === normalizeValue(filter);
}

function recordSearchText(record) {
  return [
    record.audit_id,
    record.tool_name,
    record.risk,
    record.actor,
    record.status,
    record.confirmation_id,
    ...(Array.isArray(record.affected_paths) ? record.affected_paths : []),
    JSON.stringify(record.input_summary ?? {}),
    JSON.stringify(record.result ?? {}),
  ].join("\n");
}

function matchesRecord(record, options) {
  if (!includesAnyExact(record.tool_name, options.tools)) {
    return false;
  }
  if (!includesAnyExact(record.risk, options.risks)) {
    return false;
  }
  if (!includesAnyExact(record.status, options.statuses)) {
    return false;
  }
  if (!includesAnyExact(record.actor, options.actors)) {
    return false;
  }
  if (!confirmationMatches(record, options.confirmationId)) {
    return false;
  }
  if (!includesAnySubstring(Array.isArray(record.affected_paths) ? record.affected_paths : [], options.affectedPaths)) {
    return false;
  }
  if (options.query && !normalizeValue(recordSearchText(record)).includes(normalizeValue(options.query))) {
    return false;
  }
  return true;
}

function sortRecords(entries, latest) {
  return entries.sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? "");
    const rightTime = Date.parse(right.created_at ?? "");
    return latest ? rightTime - leftTime : leftTime - rightTime;
  });
}

function countBy(records, field) {
  const counts = new Map();
  for (const record of records) {
    const key = String(record[field] ?? "none");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function formatChangedPaths(record) {
  const paths = Array.isArray(record.affected_paths) ? record.affected_paths : [];
  if (paths.length === 0) {
    return "-";
  }
  if (paths.length <= 3) {
    return paths.join(", ");
  }
  return `${paths.slice(0, 3).join(", ")} +${paths.length - 3}`;
}

function printTable(records, totalCount, options) {
  console.log("MCP audit query:");
  console.log(`- Source: ${normalizePath(options.filePath)}`);
  console.log(`- Total records: ${totalCount}`);
  console.log(`- Matched records: ${records.length}`);
  console.log(`- Showing: ${Math.min(records.length, options.limit)}`);
  console.log("");

  if (records.length === 0) {
    console.log("No matching audit records.");
    return;
  }

  console.log("| Created At | Tool | Risk | Status | Actor | Confirm | Affected Paths | Audit ID |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const record of records.slice(0, options.limit)) {
    console.log([
      record.created_at,
      record.tool_name,
      record.risk,
      record.status,
      record.actor,
      record.confirmation_id ?? "none",
      formatChangedPaths(record),
      record.audit_id,
    ].map(escapeCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
}

function summaryJson(records, totalCount, shown, options) {
  return {
    source: normalizePath(options.filePath),
    total_records: totalCount,
    matched_records: records.length,
    shown_records: shown.length,
    filters: {
      tools: options.tools,
      risks: options.risks,
      statuses: options.statuses,
      actors: options.actors,
      confirmation_id: options.confirmationId || null,
      affected_paths: options.affectedPaths,
      query: options.query || null,
      latest: options.latest,
      limit: options.limit,
    },
    counts: {
      by_tool: countBy(records, "tool_name"),
      by_risk: countBy(records, "risk"),
      by_status: countBy(records, "status"),
      by_actor: countBy(records, "actor"),
    },
    records: shown,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const entries = await readJsonl(options.filePath);
  const matched = sortRecords(
    entries.map((entry) => entry.record).filter((record) => matchesRecord(record, options)),
    options.latest,
  );
  const shown = matched.slice(0, options.limit);

  if (options.showJson) {
    for (const record of shown) {
      console.log(JSON.stringify(record));
    }
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(summaryJson(matched, entries.length, shown, options), null, 2));
    return;
  }

  printTable(matched, entries.length, options);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
