import { spawn } from "node:child_process";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  controlledProcessEnvironment,
  createBoundedOutputCollector,
  redactProcessOutput,
  terminateProcessTree,
} from "./process-control.mjs";
import { projectRoot } from "./project-paths.mjs";
import { resolveDevWorkspaceExecutionContext } from "./mcp-development-workstream-tools.mjs";

export const DEV_LIST_MAX_ENTRIES = 500;
export const DEV_READ_MAX_BYTES = 256 * 1024;
export const DEV_READ_RANGE_MAX_FILE_BYTES = 16 * 1024 * 1024;
export const DEV_READ_RANGE_MAX_START_LINE = 10_000_000;
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

function pathSegments(filePath, repositoryRoot = projectRoot) {
  const relative = path.relative(repositoryRoot, filePath);
  return relative ? relative.split(/[\\/]+/u) : [];
}

function normalizeRepositoryPath(repositoryRoot, filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/");
}

function resolveRepositoryPath(repositoryRoot, value, label, fallback = "") {
  const candidate = value === undefined || value === null || value === "" ? fallback : value;
  if (typeof candidate !== "string" || !candidate.trim()) {
    throw new Error(`${label} requires a path.`);
  }
  if (path.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/u.test(candidate) || /^[\\/]{2}/u.test(candidate)) {
    throw new Error(`${label} must be workspace-relative; absolute paths are not allowed.`);
  }
  const resolved = path.resolve(repositoryRoot, candidate);
  if (!isInside(path.resolve(repositoryRoot), resolved)) {
    const scopeLabel = repositoryRoot === projectRoot ? "project" : "workspace";
    throw new Error(`${label} must stay inside the ${scopeLabel}.`);
  }
  return resolved;
}

export function workspaceExecutionProvenance(context) {
  return {
    workspace_id: context.workspace_id,
    workstream_id: context.workstream_id,
    workspace_type: context.workspace_type,
    branch: context.branch,
    base_head: context.base_head,
    current_head: context.current_head,
  };
}

export function isSecretName(name) {
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
    || /\.(?:cer|cert|crt|der|jks|key|keystore|p12|p7b|p7c|pem|pfx)$/iu.test(name);
}

export function assertAllowedPathPolicy(resolved, label, repositoryRoot = projectRoot) {
  const segments = pathSegments(resolved, repositoryRoot);
  if (segments.some((segment) => segment.toLowerCase() === ".git")) {
    throw new Error(`${label} cannot access .git internals.`);
  }
  if (segments.some(isSecretName)) {
    throw new Error(`${label} cannot access secret files.`);
  }
}

function resolveAllowedPath(value, label, fallback = "", repositoryRoot = projectRoot) {
  const resolved = resolveRepositoryPath(repositoryRoot, value, label, fallback);
  assertAllowedPathPolicy(resolved, label, repositoryRoot);
  return resolved;
}

function positiveIntegerWithin(value, fallback, maximum, field) {
  const normalized = value === undefined || value === null ? fallback : value;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}.`);
  }
  return normalized;
}

export async function assertExistingSafePath(resolved, label, repositoryRoot = projectRoot) {
  const info = await lstat(resolved);
  if (info.isSymbolicLink()) {
    throw new Error(`${label} cannot access symbolic links.`);
  }
  const [realRoot, realTarget] = await Promise.all([
    repositoryRoot === projectRoot ? realProjectRootPromise : realpath(repositoryRoot),
    realpath(resolved),
  ]);
  if (!isInside(realRoot, realTarget)) {
    const scopeLabel = repositoryRoot === projectRoot ? "project" : "workspace";
    throw new Error(`${label} resolves outside the ${scopeLabel} through a symbolic link.`);
  }
  assertAllowedPathPolicy(realTarget, label, repositoryRoot);
  return info;
}

export function isSupportedTextPath(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const extension = path.extname(name);
  return textExtensions.has(extension) || (!extension && extensionlessTextNames.has(name));
}

export function decodeText(buffer, label) {
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

function publicEntry(directory, entry, repositoryRoot) {
  const absolute = path.join(directory, entry.name);
  return {
    name: entry.name,
    path: normalizeRepositoryPath(repositoryRoot, absolute),
    type: entryType(entry),
  };
}

async function resolveWorkspaceContext(
  input,
  { mutation = false, workspaceContextResolver = resolveDevWorkspaceExecutionContext } = {},
) {
  return workspaceContextResolver(
    { workspace_id: input?.workspace_id },
    { mutation },
  );
}

function attachWorkspaceContext(result, context) {
  return {
    ...result,
    workspace_context: workspaceExecutionProvenance(context),
  };
}

export async function dev_list_directory(input = {}, options = {}) {
  const context = await resolveWorkspaceContext(input, options);
  const directory = resolveAllowedPath(input.path, "path", ".", context.root);
  const maxEntries = positiveIntegerWithin(
    input.maxEntries,
    200,
    DEV_LIST_MAX_ENTRIES,
    "maxEntries",
  );
  const info = await assertExistingSafePath(directory, "path", context.root);
  if (!info.isDirectory()) {
    throw new Error("path must reference a directory.");
  }

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.name.toLowerCase() !== ".git" && !isSecretName(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  return attachWorkspaceContext({
    path: normalizeRepositoryPath(context.root, directory) || ".",
    entries: entries.slice(0, maxEntries).map((entry) => publicEntry(directory, entry, context.root)),
    returned_entries: Math.min(entries.length, maxEntries),
    truncated: entries.length > maxEntries,
  }, context);
}

export async function dev_read_file(input = {}, options = {}) {
  const context = await resolveWorkspaceContext(input, options);
  const filePath = resolveAllowedPath(input.path, "path", "", context.root);
  const maxBytes = positiveIntegerWithin(
    input.maxBytes,
    DEV_READ_MAX_BYTES,
    DEV_READ_MAX_BYTES,
    "maxBytes",
  );
  if (!isSupportedTextPath(filePath)) {
    throw new Error("path must reference a supported UTF-8 text file.");
  }
  const info = await assertExistingSafePath(filePath, "path", context.root);
  if (!info.isFile()) {
    throw new Error("path must reference a file.");
  }
  if (info.size > maxBytes) {
    throw new Error(`path exceeds the ${maxBytes}-byte read limit.`);
  }

  const content = decodeText(await readFile(filePath), "path");
  return attachWorkspaceContext({
    path: normalizeRepositoryPath(context.root, filePath),
    bytes: info.size,
    content,
  }, context);
}

export async function dev_read_file_range(input = {}, options = {}) {
  const context = await resolveWorkspaceContext(input, options);
  const filePath = resolveAllowedPath(input.path, "path", "", context.root);
  const startLine = positiveIntegerWithin(
    input.startLine,
    1,
    DEV_READ_RANGE_MAX_START_LINE,
    "startLine",
  );
  const maxBytes = positiveIntegerWithin(
    input.maxBytes,
    DEV_READ_MAX_BYTES,
    DEV_READ_MAX_BYTES,
    "maxBytes",
  );
  if (!isSupportedTextPath(filePath)) {
    throw new Error("path must reference a supported UTF-8 text file.");
  }
  const info = await assertExistingSafePath(filePath, "path", context.root);
  if (!info.isFile()) {
    throw new Error("path must reference a file.");
  }
  if (info.size > DEV_READ_RANGE_MAX_FILE_BYTES) {
    throw new Error(
      `path exceeds the ${DEV_READ_RANGE_MAX_FILE_BYTES}-byte ranged-read file limit.`,
    );
  }

  const buffer = await readFile(filePath);
  decodeText(buffer, "path");
  const lineStarts = [0];
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0x0a && index + 1 < buffer.length) {
      lineStarts.push(index + 1);
    }
  }
  const totalLines = buffer.length === 0 ? 0 : lineStarts.length;
  if (totalLines === 0) {
    if (startLine !== 1) {
      throw new Error("startLine exceeds the file line count (0).");
    }
    return attachWorkspaceContext({
      path: normalizeRepositoryPath(context.root, filePath),
      bytes: info.size,
      total_lines: 0,
      start_line: 1,
      end_line: 0,
      next_start_line: null,
      returned_bytes: 0,
      truncated: false,
      content: "",
    }, context);
  }
  if (startLine > totalLines) {
    throw new Error(`startLine exceeds the file line count (${totalLines}).`);
  }

  const startOffset = lineStarts[startLine - 1];
  let endOffset = Math.min(startOffset + maxBytes, buffer.length);
  if (endOffset < buffer.length) {
    const lastNewline = buffer.lastIndexOf(0x0a, endOffset - 1);
    if (lastNewline < startOffset) {
      throw new Error(`The requested line exceeds the ${maxBytes}-byte ranged-read limit.`);
    }
    endOffset = lastNewline + 1;
  }

  const slice = buffer.subarray(startOffset, endOffset);
  const content = decodeText(slice, "path");
  let newlineCount = 0;
  for (const byte of slice) {
    if (byte === 0x0a) newlineCount += 1;
  }
  const returnedLineCount = newlineCount + (
    slice.length > 0 && slice[slice.length - 1] !== 0x0a ? 1 : 0
  );
  const endLine = startLine + returnedLineCount - 1;
  const truncated = endOffset < buffer.length;

  return attachWorkspaceContext({
    path: normalizeRepositoryPath(context.root, filePath),
    bytes: info.size,
    total_lines: totalLines,
    start_line: startLine,
    end_line: endLine,
    next_start_line: truncated ? endLine + 1 : null,
    returned_bytes: slice.length,
    truncated,
    content,
  }, context);
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

export async function dev_search_files(input = {}, options = {}) {
  const context = await resolveWorkspaceContext(input, options);
  const directory = resolveAllowedPath(input.path, "path", ".", context.root);
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
  const info = await assertExistingSafePath(directory, "path", context.root);
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
        const candidateInfo = await assertExistingSafePath(candidate, "search candidate", context.root);
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
            path: normalizeRepositoryPath(context.root, candidate),
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
  return attachWorkspaceContext({
    path: normalizeRepositoryPath(context.root, directory) || ".",
    query,
    case_sensitive: caseSensitive,
    matches,
    returned_matches: matches.length,
    scanned_files: scannedFiles,
    skipped_files: skippedFiles,
    truncated,
  }, context);
}

export const DEV_GIT_DIFF_MODES = Object.freeze(["working", "staged"]);
export const DEV_GIT_OUTPUT_MAX_CHARACTERS = 128 * 1024;
export const DEV_GIT_WHITESPACE_POLICY = "blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol";

const fixedGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const fixedGitPrefixArgv = Object.freeze([
  "--no-pager",
  "-c",
  "core.fsmonitor=false",
]);
const gitTimeoutMs = 30_000;
const activeGitChildren = new Set();

process.once("exit", () => {
  for (const child of activeGitChildren) terminateProcessTree(child);
});

function fixedGitEnvironment() {
  return controlledProcessEnvironment({
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
  });
}

function diffArgv(mode, check = false) {
  const argv = [
    ...fixedGitPrefixArgv,
    ...(check ? ["-c", `core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`] : []),
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
  ];
  if (mode === "staged") argv.push("--cached");
  if (check) argv.push("--check");
  return argv;
}

function statusArgv(includeUntracked) {
  return [
    ...fixedGitPrefixArgv,
    "status",
    "--porcelain=v1",
    "--branch",
    includeUntracked ? "--untracked-files=all" : "--untracked-files=no",
  ];
}

function assertGitMode(mode) {
  if (!DEV_GIT_DIFF_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${DEV_GIT_DIFF_MODES.join(", ")}.`);
  }
}

async function runFixedGit({
  repositoryRoot,
  executable,
  argv,
  outputMaxCharacters,
  timeoutMs,
}) {
  const stdout = createBoundedOutputCollector(outputMaxCharacters);
  const stderr = createBoundedOutputCollector(outputMaxCharacters);
  let child;
  let spawnError = null;
  let exitCode = null;
  let signal = null;
  let timedOut = false;

  try {
    child = spawn(executable, argv, {
      cwd: repositoryRoot,
      env: fixedGitEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    activeGitChildren.add(child);
  } catch (error) {
    spawnError = error;
  }

  if (child) {
    child.stdout.on("data", (chunk) => stdout.append(chunk));
    child.stderr.on("data", (chunk) => stderr.append(chunk));
    await new Promise((resolve) => {
      let settled = false;
      let forceSettleTimer;
      const finish = (code, childSignal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(forceSettleTimer);
        exitCode = Number.isInteger(code) ? code : null;
        signal = typeof childSignal === "string" ? childSignal : null;
        resolve();
      };
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child);
        forceSettleTimer = setTimeout(() => finish(null, null), 5_000);
        forceSettleTimer.unref?.();
      }, timeoutMs);
      timeoutTimer.unref?.();
      child.once("error", (error) => {
        spawnError = error;
        finish(null, null);
      });
      child.once("close", finish);
    });
    activeGitChildren.delete(child);
  }

  const stdoutResult = stdout.finish();
  const stderrResult = stderr.finish();
  return {
    execution_ok: !spawnError && !timedOut,
    exit_code: exitCode,
    signal,
    timed_out: timedOut,
    stdout: stdoutResult.text,
    stderr: [
      stderrResult.text,
      spawnError ? redactProcessOutput(`Git process failed to start: ${spawnError.message}`) : "",
    ].filter(Boolean).join("\n"),
    stdout_truncated: stdoutResult.truncated,
    stderr_truncated: stderrResult.truncated,
    stdout_characters: stdoutResult.characters,
    stdout_bytes: stdoutResult.bytes,
    stderr_characters: stderrResult.characters,
    stderr_bytes: stderrResult.bytes,
  };
}

function normalizeStatusPath(rawPath) {
  const renameMarker = " -> ";
  const pathValue = rawPath.includes(renameMarker)
    ? rawPath.slice(rawPath.lastIndexOf(renameMarker) + renameMarker.length)
    : rawPath;
  return redactProcessOutput(pathValue);
}

function parseBranchLine(line) {
  if (!line.startsWith("## ")) return { branch: null, head: null };
  const value = line.slice(3).trim();
  if (value.startsWith("No commits yet on ")) {
    const branch = value.slice("No commits yet on ".length).trim();
    return { branch, head: branch };
  }
  if (value.startsWith("Initial commit on ")) {
    const branch = value.slice("Initial commit on ".length).trim();
    return { branch, head: branch };
  }
  if (value.startsWith("HEAD (no branch)")) {
    return { branch: null, head: "HEAD" };
  }
  const branch = value.split("...")[0].trim().split(/\s/u)[0] || null;
  return { branch: branch ? redactProcessOutput(branch) : null, head: branch ? redactProcessOutput(branch) : null };
}

function unique(values) {
  return [...new Set(values)];
}

function parseGitStatus(raw) {
  const lines = raw.split(/\r?\n/u).filter(Boolean);
  const branchInfo = parseBranchLine(lines[0] ?? "");
  const statusLines = lines.filter((line) => !line.startsWith("## "));
  const staged = [];
  const modified = [];
  const deleted = [];
  const renamed = [];
  const untracked = [];
  const conflicted = [];

  for (const line of statusLines) {
    if (line.startsWith("?? ")) {
      untracked.push(normalizeStatusPath(line.slice(3)));
      continue;
    }
    if (line.length < 3) continue;
    const indexCode = line[0];
    const worktreeCode = line[1];
    const filePath = normalizeStatusPath(line.slice(3));
    if (indexCode !== " " && indexCode !== "?") {
      staged.push({ code: indexCode, path: filePath });
    }
    if (indexCode === "M" || worktreeCode === "M") modified.push(filePath);
    if (indexCode === "D" || worktreeCode === "D") deleted.push(filePath);
    if (indexCode === "R" || worktreeCode === "R") renamed.push(filePath);
    if (indexCode === "U" || worktreeCode === "U" || indexCode === "A" && worktreeCode === "A") {
      conflicted.push(filePath);
    }
  }

  return {
    ...branchInfo,
    staged,
    modified: unique(modified),
    deleted: unique(deleted),
    renamed: unique(renamed),
    untracked: unique(untracked),
    conflicted: unique(conflicted),
    clean: statusLines.length === 0,
  };
}

export function createDevGitTools({
  repositoryRoot = projectRoot,
  executable = fixedGitExecutable,
  outputMaxCharacters = DEV_GIT_OUTPUT_MAX_CHARACTERS,
  timeoutMs = gitTimeoutMs,
} = {}) {
  async function run(argv) {
    return runFixedGit({
      repositoryRoot,
      executable,
      argv,
      outputMaxCharacters,
      timeoutMs,
    });
  }

  return {
    async status(input = {}) {
      const includeUntracked = input.includeUntracked ?? true;
      if (typeof includeUntracked !== "boolean") {
        throw new Error("includeUntracked must be a boolean.");
      }
      const result = await run(statusArgv(includeUntracked));
      const parsed = result.execution_ok && result.exit_code === 0
        ? parseGitStatus(result.stdout)
        : {
          branch: null,
          head: null,
          staged: [],
          modified: [],
          deleted: [],
          renamed: [],
          untracked: [],
          conflicted: [],
          clean: false,
        };
      return {
        ...parsed,
        execution_ok: result.execution_ok,
        exit_code: result.exit_code,
        signal: result.signal,
        timed_out: result.timed_out,
        raw: result.stdout,
        raw_truncated: result.stdout_truncated,
        raw_characters: result.stdout_characters,
        raw_bytes: result.stdout_bytes,
        stderr: result.stderr,
        stderr_truncated: result.stderr_truncated,
      };
    },

    async diff(input = {}) {
      const mode = input.mode ?? "working";
      assertGitMode(mode);
      const result = await run(diffArgv(mode, false));
      return {
        mode,
        execution_ok: result.execution_ok,
        exit_code: result.exit_code,
        signal: result.signal,
        timed_out: result.timed_out,
        diff: result.stdout,
        truncated: result.stdout_truncated,
        characters: result.stdout_characters,
        bytes: result.stdout_bytes,
        stderr: result.stderr,
        stderr_truncated: result.stderr_truncated,
      };
    },

    async diffCheck(input = {}) {
      const mode = input.mode ?? "working";
      assertGitMode(mode);
      const result = await run(diffArgv(mode, true));
      return {
        mode,
        execution_ok: result.execution_ok,
        passed: result.execution_ok && result.exit_code === 0,
        exit_code: result.exit_code,
        signal: result.signal,
        timed_out: result.timed_out,
        output: result.stdout,
        truncated: result.stdout_truncated,
        characters: result.stdout_characters,
        bytes: result.stdout_bytes,
        stderr: result.stderr,
        stderr_truncated: result.stderr_truncated,
      };
    },
  };
}

async function runWorkspaceGitTool(input, method, options = {}) {
  const context = await resolveWorkspaceContext(input, options);
  const tools = createDevGitTools({ repositoryRoot: context.root });
  const toolInput = { ...input };
  delete toolInput.workspace_id;
  return attachWorkspaceContext(await tools[method](toolInput), context);
}

export async function dev_git_status(input = {}, options = {}) {
  return runWorkspaceGitTool(input, "status", options);
}

export async function dev_git_diff(input = {}, options = {}) {
  return runWorkspaceGitTool(input, "diff", options);
}

export async function dev_git_diff_check(input = {}, options = {}) {
  return runWorkspaceGitTool(input, "diffCheck", options);
}

export function getDevGitCommandMapping() {
  return {
    executable: fixedGitExecutable,
    cwd: ".",
    shell: false,
    status: {
      include_untracked_true: statusArgv(true),
      include_untracked_false: statusArgv(false),
    },
    diff: {
      working: diffArgv("working", false),
      staged: diffArgv("staged", false),
    },
    diff_check: {
      working: diffArgv("working", true),
      staged: diffArgv("staged", true),
    },
  };
}
