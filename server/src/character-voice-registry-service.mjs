import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { projectPaths } from "./project-paths.mjs";

const sourceType = "read_only_derived_index";
const authority = "below_canon_db";

export const characterVoiceAliases = Object.freeze({
  朝日奈千夜: Object.freeze(["千夜"]),
  夜安晴: Object.freeze(["小晴"]),
  夜文澤: Object.freeze(["小澤"]),
  "拉芙蒂・里德斯特": Object.freeze(["拉芙蒂", "拉芙蒂・里德ス特"]),
  夜: Object.freeze(["夜老師"]),
  榛名小暮: Object.freeze(["小暮"]),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function splitMarkdownRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function sectionLines(markdown, heading) {
  const lines = String(markdown ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const output = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/u.test(lines[index])) break;
    output.push({ line: lines[index], line_number: index + 1 });
  }
  return output;
}

export function parseCoreProtagonistNames(markdown) {
  const lines = sectionLines(markdown, "## 二十七位正式主角唯一名單");
  const content = lines
    .map((entry) => entry.line.trim())
    .filter((line) => line && line !== "---")
    .join("");
  return [...new Set(content
    .replace(/[。.]$/u, "")
    .split("、")
    .map(normalizeName)
    .filter(Boolean))];
}

export function parseAuthoritativeCoreProtagonistNames(activeEngineContent) {
  const match = String(activeEngineContent ?? "").match(
    /^\|\s*二十七位正式主角唯一名單\s*\|\s*([^|]+?)\s*\|\s*$/mu,
  );
  if (!match) return [];
  return [...new Set(match[1]
    .replace(/[。.]$/u, "")
    .split("、")
    .map(normalizeName)
    .filter(Boolean))];
}

export function parseCharacterVoiceRegistry(markdown) {
  const entries = [];
  for (const heading of ["## 性格設定總表", "## 其他正式角色聲線"]) {
    const lines = sectionLines(markdown, heading);
    for (const { line, line_number: lineNumber } of lines) {
      const cells = splitMarkdownRow(line);
      if (cells.length !== 5) continue;
      if (cells[0] === "角色" || /^-+$/u.test(cells[0])) continue;
      const canonicalName = normalizeName(cells[0]);
      if (!canonicalName) continue;
      entries.push({
        canonical_name: canonicalName,
        source_status: cells[1],
        personality: cells[2],
        voice: cells[3],
        source: cells[4],
        aliases: [...(characterVoiceAliases[canonicalName] ?? [])],
        line_number: lineNumber,
        section: heading.slice(3),
        effective: Boolean(cells[2] && cells[3]),
      });
    }
  }
  return entries;
}

export function resolveCharacterVoiceProfile(entries, rawName) {
  const name = normalizeName(rawName);
  if (!name) {
    return { status: "not_found", requested_name: null, candidates: [] };
  }
  const exact = entries.filter((entry) => entry.canonical_name === name);
  if (exact.length === 1) {
    return {
      status: exact[0].effective ? "resolved" : "missing_data",
      requested_name: name,
      canonical_name: exact[0].canonical_name,
      match_type: "exact_canonical_name",
      profile: exact[0],
      candidates: exact,
    };
  }
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      requested_name: name,
      match_type: "duplicate_canonical_name",
      candidates: exact,
    };
  }
  const aliases = entries.filter((entry) => entry.aliases.includes(name));
  if (aliases.length === 1) {
    return {
      status: aliases[0].effective ? "resolved" : "missing_data",
      requested_name: name,
      canonical_name: aliases[0].canonical_name,
      match_type: "registered_alias",
      profile: aliases[0],
      candidates: aliases,
    };
  }
  return {
    status: aliases.length > 1 ? "ambiguous" : "not_found",
    requested_name: name,
    match_type: aliases.length > 1 ? "duplicate_alias" : null,
    candidates: aliases,
  };
}

export function inspectCharacterVoiceCoverage(markdown) {
  const entries = parseCharacterVoiceRegistry(markdown);
  const coreProtagonists = parseCoreProtagonistNames(markdown);
  const profiles = coreProtagonists.map((canonicalName) => ({
    canonical_name: canonicalName,
    resolution: resolveCharacterVoiceProfile(entries, canonicalName),
  }));
  return {
    core_protagonists: coreProtagonists,
    core_protagonist_count: coreProtagonists.length,
    entries,
    profiles,
    coverage_complete: profiles.every(({ resolution }) => (
      resolution.status === "resolved"
    )),
  };
}

export async function loadCharacterVoiceRegistry(options = {}) {
  const registryPath = options.characterVoiceRegistryPath
    ?? projectPaths.characterVoiceRegistry;
  if (typeof options.characterVoiceRegistryContent === "string") {
    const content = options.characterVoiceRegistryContent;
    const coverage = inspectCharacterVoiceCoverage(content);
    return {
      loaded: Boolean(content.trim()),
      path: registryPath,
      content,
      hash: sha256(content),
      source_type: sourceType,
      authority,
      ...coverage,
    };
  }
  try {
    const content = await readFile(registryPath, "utf8");
    const coverage = inspectCharacterVoiceCoverage(content);
    return {
      loaded: Boolean(content.trim()),
      path: registryPath,
      content,
      hash: sha256(content),
      source_type: sourceType,
      authority,
      ...coverage,
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return {
      loaded: false,
      path: registryPath,
      content: "",
      hash: null,
      source_type: sourceType,
      authority,
      core_protagonists: [],
      core_protagonist_count: 0,
      entries: [],
      profiles: [],
      coverage_complete: false,
    };
  }
}
