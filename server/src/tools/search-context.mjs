import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultOutputPath = path.join(rootDir, "data", "outputs", "retrieval_context.md");

const sourceSpecs = [
  {
    key: "active_engine",
    title: "Canon DB｜active_engine.md",
    authority: "P0 highest authority",
    authorityRank: 100,
    type: "markdown",
    filePath: path.join(rootDir, "data", "canon_db", "active_engine.md"),
  },
  {
    key: "active_writing_card",
    title: "Writing Policy DB｜active_writing_card.md",
    authority: "Writing policy, cannot override canon",
    authorityRank: 80,
    type: "markdown",
    filePath: path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  },
  {
    key: "active_proofing_card",
    title: "Proofing Policy DB｜active_proofing_card.md",
    authority: "Proofing policy, cannot override canon",
    authorityRank: 70,
    type: "markdown",
    filePath: path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  },
  {
    key: "active_longline",
    title: "Longline DB｜active_longline.md",
    authority: "Longline boundary index, cannot become canon by itself",
    authorityRank: 75,
    type: "markdown",
    filePath: path.join(rootDir, "data", "longline_db", "active_longline.md"),
  },
  {
    key: "compressed_error_rules",
    title: "Error Report DB｜compressed_rules.md",
    authority: "Error avoidance rule, cannot rewrite canon",
    authorityRank: 65,
    type: "markdown",
    filePath: path.join(rootDir, "data", "error_report_db", "compressed_rules.md"),
  },
  {
    key: "canon_errors",
    title: "Error Report DB｜canon_errors.jsonl",
    authority: "Canon error report, cannot rewrite canon",
    authorityRank: 60,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "canon_errors.jsonl"),
  },
  {
    key: "character_errors",
    title: "Error Report DB｜character_errors.jsonl",
    authority: "Character error report",
    authorityRank: 55,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "character_errors.jsonl"),
  },
  {
    key: "dialogue_errors",
    title: "Error Report DB｜dialogue_errors.jsonl",
    authority: "Dialogue error report",
    authorityRank: 55,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "dialogue_errors.jsonl"),
  },
  {
    key: "pacing_errors",
    title: "Error Report DB｜pacing_errors.jsonl",
    authority: "Pacing error report",
    authorityRank: 55,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "pacing_errors.jsonl"),
  },
  {
    key: "battle_errors",
    title: "Error Report DB｜battle_errors.jsonl",
    authority: "Battle error report",
    authorityRank: 55,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "battle_errors.jsonl"),
  },
  {
    key: "preference_errors",
    title: "Error Report DB｜preference_errors.jsonl",
    authority: "Preference error report",
    authorityRank: 50,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "error_report_db", "preference_errors.jsonl"),
  },
  {
    key: "pending_error_reports",
    title: "Feedback DB｜pending_error_reports.jsonl",
    authority: "Pending feedback-derived error candidates",
    authorityRank: 45,
    type: "jsonl",
    filePath: path.join(rootDir, "data", "feedback_db", "pending_error_reports.jsonl"),
  },
  {
    key: "canon_memory",
    title: "Memory Store｜canon_memory.json",
    authority: "Memory cache, cannot override Canon DB",
    authorityRank: 40,
    type: "json",
    filePath: path.join(rootDir, "data", "memory_store", "canon_memory.json"),
  },
  {
    key: "preference_memory",
    title: "Memory Store｜preference_memory.json",
    authority: "Preference memory, cannot become canon",
    authorityRank: 35,
    type: "json",
    filePath: path.join(rootDir, "data", "memory_store", "preference_memory.json"),
  },
  {
    key: "working_memory",
    title: "Memory Store｜working_memory.json",
    authority: "Working memory for current task only",
    authorityRank: 30,
    type: "json",
    filePath: path.join(rootDir, "data", "memory_store", "working_memory.json"),
  },
];

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeText(text) {
  return text.normalize("NFKC").toLocaleLowerCase();
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/search-context.mjs <keyword...> [--top 12] [--output data/outputs/retrieval_context.md]",
    "",
    "Examples:",
    "  node server/src/tools/search-context.mjs 朝日奈千夜 九逃 醫療後座",
    "  node server/src/tools/search-context.mjs 正式選拔 戰鬥 後座 --top 20",
  ].join("\n");
}

function parseArgs(argv) {
  const queryParts = [];
  let top = 12;
  let outputPath = defaultOutputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--top") {
      const value = Number.parseInt(argv[index + 1], 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--top must be a positive integer.");
      }
      top = value;
      index += 1;
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a path.");
      }
      outputPath = path.isAbsolute(value) ? value : path.join(rootDir, value);
      index += 1;
      continue;
    }

    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    throw new Error("At least one keyword is required.");
  }

  const terms = [...new Set(query.split(/[\s,，、]+/).map((term) => term.trim()).filter(Boolean))];
  if (terms.length === 0) {
    throw new Error("At least one non-empty keyword is required.");
  }

  return { query, terms, top, outputPath };
}

async function readSource(spec) {
  try {
    const [text, stats] = await Promise.all([readFile(spec.filePath, "utf8"), stat(spec.filePath)]);
    const versionMatch = text.slice(0, 1200).match(/v\d+(?:\.\d+)+/i) ?? spec.filePath.match(/v\d+(?:\.\d+)+/i);
    return {
      ...spec,
      exists: true,
      text,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: hashText(text),
      version: versionMatch ? versionMatch[0] : "active",
    };
  } catch (error) {
    return {
      ...spec,
      exists: false,
      text: "",
      bytes: 0,
      modifiedAt: "",
      sha256: "",
      version: "missing",
      error: error.message,
    };
  }
}

function headingLevel(line) {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  return match ? { level: match[1].length, text: match[2].trim() } : null;
}

function makeChunk(source, startLine, endLine, lines, headings, ordinal) {
  const headingText = headings.filter(Boolean).join(" > ");
  const body = lines.join("\n").trim();
  const text = headingText ? `${headingText}\n${body}` : body;
  return {
    source,
    paragraphId: `${source.key}:P${String(ordinal).padStart(4, "0")}`,
    lineRange: `L${startLine}-L${endLine}`,
    headings: headings.filter(Boolean),
    text,
  };
}

function markdownChunks(source) {
  const lines = source.text.split(/\r?\n/);
  const headings = [];
  const chunks = [];
  let buffer = [];
  let startLine = 1;
  let ordinal = 1;

  function flush(endLine) {
    const hasText = buffer.some((line) => line.trim().length > 0);
    if (hasText) {
      chunks.push(makeChunk(source, startLine, endLine, buffer, headings, ordinal));
      ordinal += 1;
    }
    buffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const heading = headingLevel(line);

    if (heading) {
      flush(Math.max(startLine, lineNumber - 1));
      headings[heading.level - 1] = heading.text;
      headings.length = heading.level;
      startLine = lineNumber;
      buffer = [line];
      continue;
    }

    if (line.trim() === "") {
      flush(Math.max(startLine, lineNumber - 1));
      startLine = lineNumber + 1;
      continue;
    }

    if (buffer.length === 0) {
      startLine = lineNumber;
    }
    buffer.push(line);
  }

  flush(lines.length);
  return chunks;
}

function jsonlChunks(source) {
  const lines = source.text.split(/\r?\n/);
  const chunks = [];
  let ordinal = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (!text) {
      continue;
    }

    chunks.push({
      source,
      paragraphId: `${source.key}:J${String(ordinal).padStart(4, "0")}`,
      lineRange: `L${index + 1}`,
      headings: [source.title],
      text,
    });
    ordinal += 1;
  }

  return chunks;
}

function jsonChunks(source) {
  const text = source.text.trim();
  if (!text || text === "{}") {
    return [];
  }

  return [
    {
      source,
      paragraphId: `${source.key}:M0001`,
      lineRange: "L1",
      headings: [source.title],
      text,
    },
  ];
}

function chunksForSource(source) {
  if (!source.exists || source.text.trim().length === 0) {
    return [];
  }

  if (source.type === "jsonl") {
    return jsonlChunks(source);
  }

  if (source.type === "json") {
    return jsonChunks(source);
  }

  return markdownChunks(source);
}

function countTerm(text, term) {
  if (!term) {
    return 0;
  }

  let count = 0;
  let position = text.indexOf(term);
  while (position !== -1) {
    count += 1;
    position = text.indexOf(term, position + Math.max(term.length, 1));
  }
  return count;
}

function lineSpan(lineRange) {
  const match = lineRange.match(/^L(\d+)(?:-L(\d+))?$/);
  if (!match) {
    return 1;
  }

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2] ?? match[1], 10);
  return Math.max(1, end - start + 1);
}

function scoreChunk(chunk, terms, fullQuery) {
  const normalizedText = normalizeText(chunk.text);
  const normalizedHeading = normalizeText(chunk.headings.join(" "));
  const normalizedQuery = normalizeText(fullQuery);
  let score = 0;
  const hits = [];
  let matchedTermCount = 0;

  for (const rawTerm of terms) {
    const term = normalizeText(rawTerm);
    const bodyCount = countTerm(normalizedText, term);
    const headingCount = countTerm(normalizedHeading, term);
    if (bodyCount > 0 || headingCount > 0) {
      matchedTermCount += 1;
      const weight = term.length >= 3 ? 3 : 1;
      score += Math.min(bodyCount, 5) * weight;
      score += Math.min(headingCount, 3) * weight * 2;
      hits.push(`${rawTerm}:${bodyCount + headingCount}`);
    }
  }

  if (matchedTermCount > 1) {
    score += matchedTermCount * 4;
  }

  if (matchedTermCount === terms.length) {
    score += 8;
  }

  if (terms.length > 1 && normalizedText.includes(normalizedQuery)) {
    score += 10;
    hits.push("exact_query:1");
  }

  if (score > 0) {
    score += chunk.source.authorityRank / 100;
    score -= Math.min(8, Math.max(0, lineSpan(chunk.lineRange) - 12) * 0.2);
  }

  return { score, hits };
}

function clipText(text, maxChars = 1800) {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars).trimEnd()}\n\n... [clipped]`;
}

function manifestTable(sources) {
  const rows = [
    "| Key | Path | Version | Status | Bytes | Modified | SHA-256 |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
  ];

  for (const source of sources) {
    rows.push(
      [
        source.key,
        normalizePath(source.filePath),
        source.version,
        source.exists ? "ready" : "missing",
        source.bytes,
        source.modifiedAt,
        source.sha256 ? source.sha256.slice(0, 16) : "",
      ]
        .map(escapeCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  return rows.join("\n");
}

function resultSection(result, index) {
  const chunk = result.chunk;
  const source = chunk.source;

  return [
    `## ${index + 1}. ${source.title}`,
    "",
    `Source: \`${normalizePath(source.filePath)}\``,
    `Version: \`${source.version}\``,
    `Paragraph ID: \`${chunk.paragraphId}\``,
    `Lines: \`${chunk.lineRange}\``,
    `Authority: ${source.authority}`,
    `Score: ${result.score.toFixed(2)}`,
    `Hits: ${result.hits.join(", ")}`,
    "",
    "```markdown",
    clipText(chunk.text),
    "```",
    "",
  ].join("\n");
}

function buildRetrievalContext({ query, terms, top, sources, results, generatedAt }) {
  return [
    "# Retrieval Context",
    "",
    `Generated at: ${generatedAt}`,
    `Query: ${query}`,
    `Terms: ${terms.map((term) => `\`${term}\``).join("、")}`,
    `Top K: ${top}`,
    "",
    "This file is generated by `server/src/tools/search-context.mjs`.",
    "",
    "## Retrieval Rules",
    "",
    "- Results preserve source path, version, paragraph ID and line range.",
    "- Canon DB outranks writing policy, error reports, feedback and memory.",
    "- Retrieved material is evidence for the current task, not a Canon DB update.",
    "- If sources conflict, follow the authority order in `data/outputs/generation_context.md`.",
    "",
    "## Source Manifest",
    "",
    manifestTable(sources),
    "",
    "## Results",
    "",
    results.length > 0 ? results.map(resultSection).join("\n") : "No matching chunks found.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const generatedAt = new Date().toISOString();
  const sources = await Promise.all(sourceSpecs.map(readSource));
  const chunks = sources.flatMap(chunksForSource);
  const results = chunks
    .map((chunk) => {
      const scored = scoreChunk(chunk, options.terms, options.query);
      return {
        chunk,
        ...scored,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.chunk.source.authorityRank - a.chunk.source.authorityRank)
    .slice(0, options.top);

  const markdown = buildRetrievalContext({
    query: options.query,
    terms: options.terms,
    top: options.top,
    sources,
    results,
    generatedAt,
  });

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${markdown}\n`, "utf8");

  console.log(`Wrote ${normalizePath(options.outputPath)}`);
  console.log(`Query: ${options.query}`);
  console.log(`Results: ${results.length}/${chunks.length} chunks`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
