import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

export const DEV_LIST_MAX_ENTRIES = 500;
export const DEV_READ_MAX_BYTES = 256 * 1024;
export const DEV_SEARCH_MAX_RESULTS = 200;

const searchMaxFiles = 10_000;
const searchFileMaxBytes = DEV_READ_MAX_BYTES;
const previewMaxCharacters = 300;

const excludedSearchDirectoryNames = new Set([
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".pytest_cache",
  ".ruff_cache",
  ".turbo",
  ".vite",
  "build",
  "cache",
  "coverage",
  "dist",
  "generated",
  "logs",
  "node_modules",
  "out",
  "outputs",
  "target",
  "temp",
  "tmp",
]);

const textExtensions = new Set([
  ".bat",
  ".c",
  ".cjs",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".gitattributes",
  ".gitignore",
  ".gql",
  ".graphql",
  ".h",
  ".hpp",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".kt",
  ".lock",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".svg",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const extensionlessTextNames = new Set([
  "dockerfile",
  "license",
  "makefile",
  "notice",
  "readme",
]);

const realProjectRootPromise = realpath(projectRoot);

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function pathSegments(filePath) {
  const relative = path.relative(projectRoot, filePath);
  return relative ? relative.split(/[\\/]+/u) : [];
}

function isSecretName(name) {
  const lower = name.toLowerCase();
  return lower === ".env"
    || lower.startsWith(".env.")
    || [
      ".netrc",
      ".npmrc",
      ".pypirc",
      "credentials.json",
      "id_dsa",
      "id_ecdsa",
      "id_ed25519",
      "id_rsa",
      "secrets.json",
      "service-account.json",
      "service_account.json",
    ].includes(lower)
    || /^(?:secret|secrets|credentials)(?:\.|$)/iu.test(name)
    || /^service[-_]account(?:\.|$)/iu.test(name)
    || /\.(?:key|p12|pem|pfx)$/iu.test(name);
}

function assertAllowedPathPolicy(resolved, label) {
  const segments = pathSegments(resolved);
  if (segments.some((segment) => segment.toLowerCase() === ".git")) {
    throw new Error(`${label} cannot access .git internals.`);
  }
  if (segments.some(isSecretName)) {
    throw new Error(`${label} cannot access secret files.`);
  }
}

function resolveAllowedPath(value, label, fallback = "") {
  const candidate = value === undefined || value === null || value === "" ? fallback : value;
  const resolved = resolveProjectPath(candidate, label);
  assertAllowedPathPolicy(resolved, label);
  return resolved;
}

function positiveIntegerWithin(value, fallback, maximum, field) {
  const normalized = value === undefined || value === null ? fallback : value;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}.`);
  }
  return normalized;
}

async function assertExistingSafePath(resolved, label) {
  const info = await lstat(resolved);
  if (info.isSymbolicLink()) {
    throw new Error(`${label} cannot access symbolic links.`);
  }
  const [realRoot, realTarget] = await Promise.all([
    realProjectRootPromise,
    realpath(resolved),
  ]);
  if (!isInside(realRoot, realTarget)) {
    throw new Error(`${label} resolves outside the project through a symbolic link.`);
  }
  assertAllowedPathPolicy(realTarget, label);
  return info;
}

function isSupportedTextPath(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const extension = path.extname(name);
  return textExtensions.has(extension) || (!extension && extensionlessTextNames.has(name));
}

function decodeText(buffer, label) {
  if (buffer.includes(0)) {
    throw new Error(`${label} must reference a UTF-8 text file.`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(`${label} must reference a UTF-8 text file.`);
  }
}

function entryType(entry) {
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  if (entry.isSymbolicLink()) return "symbolic_link";
  return "other";
}

function publicEntry(directory, entry) {
  const absolute = path.join(directory, entry.name);
  return {
    name: entry.name,
    path: normalizeProjectPath(absolute),
    type: entryType(entry),
  };
}

export async function dev_list_directory(input = {}) {
  const directory = resolveAllowedPath(input.path, "path", ".");
  const maxEntries = positiveIntegerWithin(
    input.maxEntries,
    200,
    DEV_LIST_MAX_ENTRIES,
    "maxEntries",
  );
  const info = await assertExistingSafePath(directory, "path");
  if (!info.isDirectory()) {
    throw new Error("path must reference a directory.");
  }

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.name.toLowerCase() !== ".git" && !isSecretName(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  return {
    path: normalizeProjectPath(directory) || ".",
    entries: entries.slice(0, maxEntries).map((entry) => publicEntry(directory, entry)),
    returned_entries: Math.min(entries.length, maxEntries),
    truncated: entries.length > maxEntries,
  };
}

export async function dev_read_file(input = {}) {
  const filePath = resolveAllowedPath(input.path, "path");
  const maxBytes = positiveIntegerWithin(
    input.maxBytes,
    DEV_READ_MAX_BYTES,
    DEV_READ_MAX_BYTES,
    "maxBytes",
  );
  if (!isSupportedTextPath(filePath)) {
    throw new Error("path must reference a supported UTF-8 text file.");
  }
  const info = await assertExistingSafePath(filePath, "path");
  if (!info.isFile()) {
    throw new Error("path must reference a file.");
  }
  if (info.size > maxBytes) {
    throw new Error(`path exceeds the ${maxBytes}-byte read limit.`);
  }

  const content = decodeText(await readFile(filePath), "path");
  return {
    path: normalizeProjectPath(filePath),
    bytes: info.size,
    content,
  };
}

function isExcludedSearchDirectory(name) {
  const lower = name.toLowerCase();
  return lower === ".git" || excludedSearchDirectoryNames.has(lower) || isSecretName(name);
}

function lineMatch(line, query, normalizedQuery, caseSensitive) {
  const haystack = caseSensitive ? line : line.toLocaleLowerCase();
  const needle = caseSensitive ? query : normalizedQuery;
  return haystack.indexOf(needle);
}

function previewLine(line, column) {
  if (line.length <= previewMaxCharacters) return line;
  const start = Math.max(0, column - Math.floor(previewMaxCharacters / 2));
  return line.slice(start, start + previewMaxCharacters);
}

export async function dev_search_files(input = {}) {
  const directory = resolveAllowedPath(input.path, "path", ".");
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim()) {
    throw new Error("query is required.");
  }
  const maxResults = positiveIntegerWithin(
    input.maxResults,
    50,
    DEV_SEARCH_MAX_RESULTS,
    "maxResults",
  );
  const caseSensitive = input.caseSensitive ?? false;
  if (typeof caseSensitive !== "boolean") {
    throw new Error("caseSensitive must be a boolean.");
  }
  const info = await assertExistingSafePath(directory, "path");
  if (!info.isDirectory()) {
    throw new Error("path must reference a directory.");
  }
  if (isExcludedSearchDirectory(path.basename(directory))) {
    throw new Error("path references a directory excluded from development search.");
  }

  const matches = [];
  const stack = [directory];
  let scannedFiles = 0;
  let skippedFiles = 0;
  let truncated = false;
  const normalizedQuery = query.toLocaleLowerCase();

  while (stack.length > 0 && matches.length < maxResults && scannedFiles < searchMaxFiles) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      skippedFiles += 1;
      continue;
    }

    entries.sort((left, right) => right.name.localeCompare(left.name, "en"));
    for (const entry of entries) {
      if (matches.length >= maxResults || scannedFiles >= searchMaxFiles) break;
      if (entry.isSymbolicLink() || isSecretName(entry.name)) {
        skippedFiles += 1;
        continue;
      }
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isExcludedSearchDirectory(entry.name)) stack.push(candidate);
        continue;
      }
      if (!entry.isFile() || !isSupportedTextPath(candidate)) {
        skippedFiles += 1;
        continue;
      }

      scannedFiles += 1;
      try {
        const candidateInfo = await assertExistingSafePath(candidate, "search candidate");
        if (candidateInfo.size > searchFileMaxBytes) {
          skippedFiles += 1;
          continue;
        }
        const content = decodeText(await readFile(candidate), "search candidate");
        const lines = content.split(/\r?\n/u);
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const column = lineMatch(lines[lineIndex], query, normalizedQuery, caseSensitive);
          if (column === -1) continue;
          matches.push({
            path: normalizeProjectPath(candidate),
            line: lineIndex + 1,
            column: column + 1,
            preview: previewLine(lines[lineIndex], column),
          });
          if (matches.length >= maxResults) break;
        }
      } catch {
        skippedFiles += 1;
      }
    }
  }

  if (matches.length >= maxResults || scannedFiles >= searchMaxFiles) {
    truncated = true;
  }
  return {
    path: normalizeProjectPath(directory) || ".",
    query,
    case_sensitive: caseSensitive,
    matches,
    returned_matches: matches.length,
    scanned_files: scannedFiles,
    skipped_files: skippedFiles,
    truncated,
  };
}
