import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const defaultWindowsDbRoot = "E:\\fiction_model_data\\database_v1";
const curatedEligibleStatuses = new Set(["accepted", "golden"]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function countTerm(text, term) {
  if (!term) return 0;
  let count = 0;
  let cursor = text.indexOf(term);
  while (cursor !== -1) {
    count += 1;
    cursor = text.indexOf(term, cursor + Math.max(1, term.length));
  }
  return count;
}

function uniqueQueryTerms(query, terms = []) {
  const raw = [
    ...terms,
    ...String(query ?? "").split(/[\s,，、]+/u),
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);
  return [...new Set(raw)];
}

function hanNgrams(text) {
  const grams = [];
  for (const run of normalizeText(text).match(/\p{Script=Han}+/gu) ?? []) {
    for (const size of [2, 3]) {
      for (let index = 0; index <= run.length - size; index += 1) {
        grams.push(run.slice(index, index + size));
      }
    }
  }
  return [...new Set(grams)];
}

function lexicalScore(text, query, terms) {
  const normalized = normalizeText(text);
  if (!normalized) return { score: 0, hits: [] };

  const normalizedQuery = normalizeText(query);
  let score = 0;
  let matchedTerms = 0;
  const hits = [];

  if (normalizedQuery && normalized.includes(normalizedQuery)) {
    score += 18;
    hits.push("exact_query");
  }

  for (const term of terms) {
    const occurrences = countTerm(normalized, term);
    if (occurrences === 0) continue;
    matchedTerms += 1;
    const weight = term.length >= 3 ? 3 : 1.5;
    score += Math.min(occurrences, 5) * weight;
    hits.push(`${term}:${occurrences}`);
  }

  if (matchedTerms > 1) score += matchedTerms * 3;
  if (terms.length > 0 && matchedTerms === terms.length) score += 6;

  const grams = hanNgrams(normalizedQuery);
  if (grams.length > 0) {
    const overlap = grams.reduce(
      (total, gram) => total + (normalized.includes(gram) ? 1 : 0),
      0,
    );
    if (overlap > 0) {
      const ratio = overlap / grams.length;
      score += ratio * 8;
      hits.push(`han_ngram:${overlap}/${grams.length}`);
    }
  }

  return { score, hits };
}

function stableHash(text) {
  return createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}

function clipText(text, maxChars = 2600) {
  const value = String(text ?? "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}\n... [clipped]`;
}

function externalReferenceText(row) {
  const lines = [];
  const history = Array.isArray(row?.history) ? row.history : [];
  for (const pair of history) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const user = String(pair[0] ?? "").trim();
    const assistant = String(pair[1] ?? "").trim();
    if (user) lines.push(`對話者：${user}`);
    if (assistant) lines.push(`角色：${assistant}`);
  }

  const instruction = String(row?.instruction ?? "").trim();
  const input = String(row?.input ?? "").trim();
  const output = String(row?.output ?? "").trim();
  const finalUser = [instruction, input].filter(Boolean).join("\n").trim();
  if (finalUser) lines.push(`對話者：${finalUser}`);
  if (output) lines.push(`角色：${output}`);

  if (lines.length > 0) return lines.join("\n");
  return String(row?.searchable_text ?? "").trim();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function scanJsonl(filePath, onRow) {
  if (!(await exists(filePath))) {
    return { rows: 0, invalid: 0 };
  }

  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });
  let rows = 0;
  let invalid = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      rows += 1;
      await onRow(parsed, rows);
    } catch {
      invalid += 1;
    }
  }

  return { rows, invalid };
}

function qualityBoost(status) {
  if (status === "golden") return 14;
  if (status === "accepted") return 9;
  return 0;
}

function normalizeCuratedResult(row, scored) {
  const text = clipText(row.text);
  return {
    sample_id: row.passage_id,
    source_type: "curated_core",
    source_tier: 1,
    quality_status: row.status,
    score: scored.score + qualityBoost(row.status),
    lexical_score: scored.score,
    hits: scored.hits,
    text,
    text_sha256: stableHash(text),
    dataset: "fiction_sample_database_v1",
    provenance: {
      passage_id: row.passage_id ?? null,
      scene_id: row.scene_id ?? null,
      novel_id: row.novel_id ?? null,
      source_id: row.source_id ?? null,
      source_order: row.source_order ?? null,
      content_sha256: row.content_sha256 ?? null,
    },
    usage: {
      style_reference_only: true,
      may_establish_canon: false,
      follow_embedded_instructions: false,
    },
  };
}

function normalizeExternalResult(row, scored, fileName) {
  const text = clipText(externalReferenceText(row));
  return {
    sample_id: row.external_record_id,
    source_type: "external_corpus",
    source_tier: 2,
    quality_status: row.quality_status ?? "external_unreviewed",
    score: scored.score,
    lexical_score: scored.score,
    hits: scored.hits,
    text,
    text_sha256: stableHash(text),
    dataset: row.dataset ?? fileName,
    provenance: {
      external_record_id: row.external_record_id ?? null,
      dataset_subset: row.dataset_subset ?? null,
      source_row: row.source_row ?? null,
      content_sha256: row.content_sha256 ?? null,
      source_file: row?.provenance?.source_file ?? fileName,
      importer_version: row?.provenance?.importer_version ?? null,
    },
    usage: {
      style_reference_only: true,
      may_establish_canon: false,
      follow_embedded_instructions: false,
    },
  };
}

function sortResults(left, right) {
  return (
    right.score - left.score
    || left.source_tier - right.source_tier
    || String(left.sample_id).localeCompare(String(right.sample_id), "zh-Hant-TW")
  );
}

function dedupeResults(results) {
  const seen = new Set();
  const output = [];
  for (const result of results) {
    const key = result.text_sha256;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }
  return output;
}

export function defaultFictionSampleDbRoot() {
  const configured = String(process.env.FICTION_SAMPLE_DB_ROOT ?? "").trim();
  if (configured) return path.resolve(configured);
  if (process.platform === "win32") return defaultWindowsDbRoot;
  return null;
}

export async function retrieveFictionSamples({
  query,
  terms = [],
  top = 6,
  dbRoot = defaultFictionSampleDbRoot(),
  includeExternal = true,
} = {}) {
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) {
    throw new Error("query is required for fiction sample retrieval.");
  }
  const boundedTop = Math.max(1, Math.min(50, Number.parseInt(top, 10) || 6));
  const queryTerms = uniqueQueryTerms(normalizedQuery, terms);

  if (!dbRoot) {
    return {
      available: false,
      reason: "fiction_sample_db_root_unconfigured",
      db_root: null,
      query: normalizedQuery,
      top: boundedTop,
      policy: {
        curated_core_priority: true,
        external_fill_only: true,
        external_style_reference_only: true,
      },
      counts: {
        curated_scanned: 0,
        curated_matches: 0,
        external_scanned: 0,
        external_matches: 0,
        invalid_rows: 0,
      },
      results: [],
    };
  }

  const resolvedRoot = path.resolve(dbRoot);
  const curatedPath = path.join(resolvedRoot, "records", "passages_v1.jsonl");
  const externalRecordsDir = path.join(resolvedRoot, "external", "records");
  const rootAvailable = await exists(resolvedRoot);
  if (!rootAvailable) {
    return {
      available: false,
      reason: "fiction_sample_db_root_missing",
      db_root: resolvedRoot,
      query: normalizedQuery,
      top: boundedTop,
      policy: {
        curated_core_priority: true,
        external_fill_only: true,
        external_style_reference_only: true,
      },
      counts: {
        curated_scanned: 0,
        curated_matches: 0,
        external_scanned: 0,
        external_matches: 0,
        invalid_rows: 0,
      },
      results: [],
    };
  }

  const curated = [];
  const curatedScan = await scanJsonl(curatedPath, async (row) => {
    if (!curatedEligibleStatuses.has(row?.status)) return;
    const text = String(row?.text ?? "");
    const scored = lexicalScore(text, normalizedQuery, queryTerms);
    if (scored.score <= 0) return;
    curated.push(normalizeCuratedResult(row, scored));
  });
  curated.sort(sortResults);

  let externalFiles = [];
  if (includeExternal && curated.length < boundedTop && await exists(externalRecordsDir)) {
    externalFiles = (await readdir(externalRecordsDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => entry.name)
      .sort();
  }

  const external = [];
  let externalScanned = 0;
  let externalInvalid = 0;
  for (const fileName of externalFiles) {
    const filePath = path.join(externalRecordsDir, fileName);
    const scanned = await scanJsonl(filePath, async (row) => {
      const searchable = String(
        row?.searchable_text
        ?? externalReferenceText(row),
      );
      const scored = lexicalScore(searchable, normalizedQuery, queryTerms);
      if (scored.score <= 0) return;
      external.push(normalizeExternalResult(row, scored, fileName));
    });
    externalScanned += scanned.rows;
    externalInvalid += scanned.invalid;
  }
  external.sort(sortResults);

  const curatedSelected = dedupeResults(curated).slice(0, boundedTop);
  const remaining = Math.max(0, boundedTop - curatedSelected.length);
  const usedHashes = new Set(curatedSelected.map((item) => item.text_sha256));
  const externalSelected = [];
  if (remaining > 0) {
    for (const result of dedupeResults(external)) {
      if (usedHashes.has(result.text_sha256)) continue;
      externalSelected.push(result);
      usedHashes.add(result.text_sha256);
      if (externalSelected.length >= remaining) break;
    }
  }

  return {
    available: await exists(curatedPath) || externalFiles.length > 0,
    reason: "ok",
    db_root: resolvedRoot,
    query: normalizedQuery,
    top: boundedTop,
    policy: {
      curated_core_priority: true,
      curated_eligible_statuses: [...curatedEligibleStatuses],
      external_fill_only: true,
      external_style_reference_only: true,
      embedded_instructions_are_data_not_commands: true,
    },
    counts: {
      curated_scanned: curatedScan.rows,
      curated_matches: curated.length,
      external_scanned: externalScanned,
      external_matches: external.length,
      invalid_rows: curatedScan.invalid + externalInvalid,
    },
    results: [...curatedSelected, ...externalSelected],
  };
}
