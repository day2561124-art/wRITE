import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sourceTrustFor,
  validateSourceTrustMetadata,
} from "../source-trust.mjs";
import { resolveGeneratedMarkdownPath } from "../project-paths.mjs";
import { atomicWriteFile } from "../file-transactions.mjs";
import {
  sourceFilePath,
  sourceSpecsFor,
} from "../source-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const defaultOutputPath = path.join(rootDir, "data", "outputs", "retrieval_context.md");
const defaultGenerationContextPath = path.join(
  rootDir,
  "data",
  "outputs",
  "generation_context.md",
);

const sourceSpecs = sourceSpecsFor("retrieval").map((entry) => ({
  key: entry.source_id,
  title: entry.title,
  authority: entry.authority,
  authorityRank: entry.authority_rank,
  type: entry.data_type,
  filePath: sourceFilePath(entry),
}));

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeText(text) {
  return text.normalize("NFKC").toLocaleLowerCase();
}

const wordSegmenter = new Intl.Segmenter("zh-TW", { granularity: "word" });

function retrievalTokens(text) {
  const normalized = normalizeText(text);
  const tokens = [];
  for (const part of wordSegmenter.segment(normalized)) {
    const token = part.segment.trim();
    if (part.isWordLike && token.length > 0) tokens.push(token);
  }
  for (const run of normalized.match(/\p{Script=Han}+/gu) ?? []) {
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= run.length - size; index += 1) {
        tokens.push(run.slice(index, index + size));
      }
    }
  }
  return tokens;
}

function tokenCounts(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function buildCorpusStats(chunks) {
  const documents = new Map();
  const documentFrequency = new Map();
  let totalLength = 0;
  for (const chunk of chunks) {
    const counts = tokenCounts(retrievalTokens(`${chunk.headings.join(" ")}\n${chunk.text}`));
    const length = [...counts.values()].reduce((total, count) => total + count, 0);
    documents.set(chunk.paragraphId, { counts, length });
    totalLength += length;
    for (const token of counts.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return {
    documents,
    documentFrequency,
    documentCount: chunks.length,
    averageLength: chunks.length > 0 ? totalLength / chunks.length : 1,
  };
}

function bm25Score(chunk, queryTokens, corpus) {
  const document = corpus.documents.get(chunk.paragraphId);
  if (!document || document.length === 0) return 0;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const token of new Set(queryTokens)) {
    const frequency = document.counts.get(token) ?? 0;
    if (frequency === 0) continue;
    const documentFrequency = corpus.documentFrequency.get(token) ?? 0;
    const inverseDocumentFrequency = Math.log(
      1 + (corpus.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
    );
    const lengthNormalization = k1 * (
      1 - b + b * document.length / Math.max(1, corpus.averageLength)
    );
    score += inverseDocumentFrequency * (
      frequency * (k1 + 1) / (frequency + lengthNormalization)
    );
  }
  return score;
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
      outputPath = resolveGeneratedMarkdownPath(value, "--output");
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
    const version = versionMatch ? versionMatch[0] : "active";
    const trust = sourceTrustFor(spec.key, text, {
      sourceVersion: version,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      exists: true,
    });
    const trustErrors = validateSourceTrustMetadata(trust);
    if (trustErrors.length > 0) {
      throw new Error(`${spec.key} source trust metadata is invalid: ${trustErrors.join("; ")}`);
    }
    return {
      ...spec,
      exists: true,
      text,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: hashText(text),
      version,
      trust,
    };
  } catch (error) {
    const trust = sourceTrustFor(spec.key, "", {
      sourceVersion: "missing",
      exists: false,
    });
    return {
      ...spec,
      exists: false,
      text: "",
      bytes: 0,
      modifiedAt: "",
      sha256: "",
      version: "missing",
      trust,
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

function scoreChunk(chunk, terms, fullQuery, queryTokens, corpus) {
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

  const lexicalScore = bm25Score(chunk, queryTokens, corpus);
  if (lexicalScore > 0) {
    score += lexicalScore * 2.5;
    hits.push(`bm25:${lexicalScore.toFixed(2)}`);
  }

  if (score > 0) {
    score += chunk.source.authorityRank / 100;
    score -= Math.min(8, Math.max(0, lineSpan(chunk.lineRange) - 12) * 0.2);
    if (!chunk.source.trust.approved_by_user) score *= 0.85;
    if (chunk.source.trust.source_trust_level === "T8") score *= 0.7;
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
    "| Key | Path | Version | Trust | Canon Status | Status | Bytes | Modified | SHA-256 |",
    "| --- | --- | --- | --- | --- | --- | ---: | --- | --- |",
  ];

  for (const source of sources) {
    rows.push(
      [
        source.key,
        normalizePath(source.filePath),
        source.version,
        source.trust.source_trust_level,
        source.trust.canon_status,
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
    `Source Trust: \`${source.trust.source_trust_level}\``,
    `Canon Status: \`${source.trust.canon_status}\``,
    `Can Use For Canon: \`${source.trust.can_be_used_for_canon}\``,
    `Requires User Confirmation: \`${!source.trust.approved_by_user}\``,
    `Score: ${result.score.toFixed(2)}`,
    `Hits: ${result.hits.join(", ")}`,
    "",
    "```markdown",
    clipText(chunk.text),
    "```",
    "",
  ].join("\n");
}

async function generationContextReference() {
  try {
    const text = await readFile(defaultGenerationContextPath, "utf8");
    const value = (key) => (
      text.match(new RegExp(`^- ${key}:\\s*(.+)$`, "mu"))?.[1]?.trim()
      ?? "unknown"
    );
    return {
      path: normalizePath(defaultGenerationContextPath),
      sha256: hashText(text),
      effective_canon_head: value("effective_canon_head"),
      continuity_head: value("continuity_head"),
      settlement_report_id: value("settlement_report_id"),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      path: normalizePath(defaultGenerationContextPath),
      sha256: null,
      effective_canon_head: "unknown",
      continuity_head: "unknown",
      settlement_report_id: "unknown",
    };
  }
}

function buildRetrievalContext({
  query,
  terms,
  top,
  sources,
  results,
  generatedAt,
  generationReference,
}) {
  const activeEngine = sources.find(
    (source) => source.key === "active_engine",
  );
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
    "## Source Authority",
    "",
    "current user instruction > latest formal continuity overlay > active_engine hard canon > older generated working inputs",
    "",
    `- effective_canon_head: ${generationReference.effective_canon_head}`,
    `- continuity_head: ${generationReference.continuity_head}`,
    `- settlement_report_id: ${generationReference.settlement_report_id}`,
    "",
    "## Context References",
    "",
    `- generation_context_reference: ${generationReference.path}`,
    `- generation_context_sha256: ${generationReference.sha256 ?? "missing"}`,
    `- continuity_overlay_reference: data/outputs/settlement_reports/${generationReference.settlement_report_id}/settlement_report.md`,
    "",
    "## Active Engine Metadata",
    "",
    `- path: ${activeEngine ? normalizePath(activeEngine.filePath) : "data/canon_db/active_engine.md"}`,
    `- sha256: ${activeEngine?.sha256 ?? "missing"}`,
    "- authority_level: active_hard_canon",
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
  const [sources, generationReference] = await Promise.all([
    Promise.all(sourceSpecs.map(readSource)),
    generationContextReference(),
  ]);
  const chunks = sources.flatMap(chunksForSource);
  const corpus = buildCorpusStats(chunks);
  const queryTokens = retrievalTokens(`${options.query} ${options.terms.join(" ")}`);
  const results = chunks
    .map((chunk) => {
      const scored = scoreChunk(chunk, options.terms, options.query, queryTokens, corpus);
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
    generationReference,
  });

  await atomicWriteFile(options.outputPath, `${markdown}\n`, {
    tool: "search-context",
    query: options.query,
  });

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
