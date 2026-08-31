import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  realpath,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertAllowedPathPolicy,
  assertExistingSafePath,
  createDevGitTools,
  decodeText,
  DEV_GIT_WHITESPACE_POLICY,
  isSecretName,
  isSupportedTextPath,
} from "./mcp-development-readonly-tools.mjs";
import {
  controlledProcessEnvironment,
  createBoundedOutputCollector,
  redactProcessOutput,
  terminateProcessTree,
} from "./process-control.mjs";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

export const DEV_APPLY_PATCH_MAX_BYTES = 256 * 1024;
export const DEV_APPLY_PATCH_MAX_TEXT_CHARACTERS = 256 * 1024;

export const DEV_WRITE_ALLOWED_TOP_LEVEL_DIRECTORIES = Object.freeze([
  ".github",
  "changelog",
  "config",
  "docs",
  "policies",
  "prompts",
  "runbooks",
  "schemas",
  "scripts",
  "server",
  "tests",
]);

export const DEV_WRITE_ALLOWED_ROOT_FILES = Object.freeze([
  ".gitattributes",
  ".gitignore",
  "launcher.cmd",
  "launcher.ps1",
  "package-lock.json",
  "package.json",
  "readme.md",
  "skill.md",
  "skill.md.renumbered",
  "start-ui.cmd",
]);

export const DEV_WRITE_PROTECTED_TOP_LEVEL_PATHS = Object.freeze([
  ".git",
  ".patch-backups",
  "data",
  "node_modules",
  "outputs",
]);

const allowedTopLevelDirectories = new Set(DEV_WRITE_ALLOWED_TOP_LEVEL_DIRECTORIES);
const allowedRootFiles = new Set(DEV_WRITE_ALLOWED_ROOT_FILES);
const protectedTopLevelPaths = new Set(DEV_WRITE_PROTECTED_TOP_LEVEL_PATHS);
const protectedGeneratedDirectoryNames = new Set([
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".pytest_cache",
  ".ruff_cache",
  ".turbo",
  ".vite",
  "assets",
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
]);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function inputPathSegments(value) {
  return value.split(/[\\/]+/u).filter(Boolean);
}

export function assertRepositoryRelativePath(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} requires a path.`);
  }
  if (
    path.isAbsolute(value)
    || /^[A-Za-z]:[\\/]/u.test(value)
    || /^[\\/]{2}/u.test(value)
  ) {
    throw new Error(`${label} must be repository-relative; absolute paths are not allowed.`);
  }
  if (inputPathSegments(value).includes("..")) {
    throw new Error(`${label} cannot contain '..' path traversal segments.`);
  }
}

export function assertDevelopmentRelativePathPolicy(relativePath, label = "path") {
  const normalized = String(relativePath).replaceAll("\\", "/").replace(/^\.\//u, "");
  const segments = normalized.split("/").filter(Boolean);
  const lowered = segments.map((segment) => segment.toLowerCase());
  const topLevel = lowered[0] ?? "";

  if (protectedTopLevelPaths.has(topLevel)) {
    throw new Error(`${label} is protected from development writes: ${topLevel}/**.`);
  }
  const generatedSegment = lowered.find((segment) => (
    protectedGeneratedDirectoryNames.has(segment)
  ));
  if (generatedSegment) {
    throw new Error(
      `${label} cannot modify dependency, build, runtime, generated, or visual asset paths (${generatedSegment}/).`,
    );
  }
  if (segments.length === 1 && allowedRootFiles.has(topLevel)) {
    return normalized;
  }
  if (segments.length > 1 && allowedTopLevelDirectories.has(topLevel)) {
    return normalized;
  }
  throw new Error(
    `${label} must reference an approved development path (source, tests, scripts, configuration, package metadata, or documentation).`,
  );
}

export function assertDevelopmentWritePathPolicy(resolved, label = "path") {
  assertDevelopmentRelativePathPolicy(normalizeProjectPath(resolved), label);
  return resolved;
}

function resolveDevelopmentPatchPath(value, label = "path") {
  assertRepositoryRelativePath(value, label);
  const resolved = resolveProjectPath(value, label);
  assertAllowedPathPolicy(resolved, label);
  return assertDevelopmentWritePathPolicy(resolved, label);
}

async function assertExistingPatchFile(filePath, label = "path") {
  if (!isSupportedTextPath(filePath)) {
    throw new Error(`${label} must reference a supported UTF-8 text file.`);
  }
  let info;
  try {
    info = await assertExistingSafePath(filePath, label);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} must reference an existing file.`);
    }
    throw error;
  }
  if (!info.isFile()) {
    throw new Error(`${label} must reference an existing regular file.`);
  }
  if (info.size > DEV_APPLY_PATCH_MAX_BYTES) {
    throw new Error(`${label} exceeds the ${DEV_APPLY_PATCH_MAX_BYTES}-byte patch limit.`);
  }
  return info;
}

function predominantLineEnding(text) {
  const crlfCount = text.match(/\r\n/gu)?.length ?? 0;
  const lfCount = (text.match(/\n/gu)?.length ?? 0) - crlfCount;
  if (crlfCount === 0 && lfCount === 0) return null;
  return crlfCount > lfCount ? "\r\n" : "\n";
}

function adaptPatchLineEndings(text, lineEnding) {
  if (!lineEnding) return text;
  return text.replace(/\r\n|\r|\n/gu, lineEnding);
}

function occurrenceCount(content, needle) {
  let count = 0;
  let offset = 0;
  while (offset <= content.length - needle.length) {
    const index = content.indexOf(needle, offset);
    if (index === -1) break;
    count += 1;
    if (count > 1) break;
    offset = index + 1;
  }
  return count;
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("dev_apply_patch input must be an object.");
  }
  if (typeof input.oldText !== "string" || input.oldText.length === 0) {
    throw new Error("oldText is required and must be a non-empty string.");
  }
  if (typeof input.newText !== "string") {
    throw new Error("newText is required and must be a string.");
  }
  if (
    input.expectedSha256 !== undefined
    && input.expectedSha256 !== null
    && !sha256Pattern.test(String(input.expectedSha256).toLowerCase())
  ) {
    throw new Error("expectedSha256 must be exactly 64 hexadecimal characters.");
  }
}

export async function dev_apply_patch(input = {}, options = {}) {
  validateInput(input);
  const filePath = resolveDevelopmentPatchPath(input.path, "path");
  await assertExistingPatchFile(filePath, "path");

  const expectedSha256 = input.expectedSha256 === undefined || input.expectedSha256 === null
    ? null
    : input.expectedSha256.toLowerCase();
  let result;

  await commitFileTransaction("dev-apply-patch", [
    {
      type: "write",
      filePath,
      beforeRead: async () => {
        await assertExistingPatchFile(filePath, "path");
      },
      contentFactory: async ({ previousExists, previousContent }) => {
        if (!previousExists) {
          throw new Error("path must reference an existing file.");
        }
        if (previousContent.length > DEV_APPLY_PATCH_MAX_BYTES) {
          throw new Error(`path exceeds the ${DEV_APPLY_PATCH_MAX_BYTES}-byte patch limit.`);
        }

        const beforeSha256 = sha256(previousContent);
        if (expectedSha256 && beforeSha256 !== expectedSha256) {
          throw new Error(
            `expectedSha256 mismatch: current file sha256 is ${beforeSha256}.`,
          );
        }

        const hasBom = previousContent.subarray(0, utf8Bom.length).equals(utf8Bom);
        const textBuffer = hasBom ? previousContent.subarray(utf8Bom.length) : previousContent;
        const currentText = decodeText(textBuffer, "path");
        const lineEnding = predominantLineEnding(currentText);
        const oldText = adaptPatchLineEndings(input.oldText, lineEnding);
        const newText = adaptPatchLineEndings(input.newText, lineEnding);
        const matches = occurrenceCount(currentText, oldText);

        if (matches === 0) {
          throw new Error("oldText was not found in the current file.");
        }
        if (matches > 1) {
          throw new Error("oldText is ambiguous because it appears more than once.");
        }

        const index = currentText.indexOf(oldText);
        const nextText = `${currentText.slice(0, index)}${newText}${currentText.slice(index + oldText.length)}`;
        const encodedText = Buffer.from(nextText, "utf8");
        const nextContent = hasBom ? Buffer.concat([utf8Bom, encodedText]) : encodedText;
        if (nextContent.length === 0) {
          throw new Error("dev_apply_patch cannot delete the entire file contents.");
        }
        if (nextContent.length > DEV_APPLY_PATCH_MAX_BYTES) {
          throw new Error(
            `patched content exceeds the ${DEV_APPLY_PATCH_MAX_BYTES}-byte patch limit.`,
          );
        }

        const afterSha256 = sha256(nextContent);
        if (afterSha256 === beforeSha256) {
          throw new Error("newText must produce an actual file change.");
        }

        result = {
          ok: true,
          path: normalizeProjectPath(filePath),
          changed: true,
          before_sha256: beforeSha256,
          after_sha256: afterSha256,
          before_bytes: previousContent.length,
          after_bytes: nextContent.length,
        };
        return nextContent;
      },
    },
  ], {
    ...(options.transactionMetadata ?? {}),
    tool: "dev_apply_patch",
    path: normalizeProjectPath(filePath),
  });

  if (!result) {
    throw new Error("dev_apply_patch completed without a patch result.");
  }
  return result;
}

export const DEV_GIT_COMMIT_MAX_PATHS = 100;
export const DEV_GIT_COMMIT_MESSAGE_MAX_CHARACTERS = 500;
export const DEV_GIT_COMMIT_OUTPUT_MAX_CHARACTERS = 128 * 1024;

const devGitCommitTimeoutMs = 60_000;
const fixedCommitGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const activeCommitGitChildren = new Set();
let commitInProgress = false;

process.once("exit", () => {
  for (const child of activeCommitGitChildren) terminateProcessTree(child);
});

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeCommitPath(value, index) {
  const label = `paths[${index}]`;
  assertRepositoryRelativePath(value, label);
  if (/\u0000/u.test(value)) {
    throw new Error(`${label} cannot contain NUL.`);
  }
  if (/[\u0001-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} cannot contain control characters.`);
  }
  if (/[*?\[]/u.test(value) || value.startsWith(":")) {
    throw new Error(`${label} cannot contain Git glob or pathspec magic.`);
  }
  if (value.startsWith("-")) {
    throw new Error(`${label} cannot begin with '-'.`);
  }
  const segments = inputPathSegments(value);
  if (segments.length === 0 || segments.some((segment) => segment === ".")) {
    throw new Error(`${label} must be a canonical repository-relative file path.`);
  }
  if (segments.some(isSecretName)) {
    throw new Error(`${label} cannot reference secret files.`);
  }
  return assertDevelopmentRelativePathPolicy(segments.join("/"), label);
}

function validateCommitInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("dev_git_commit input must be an object.");
  }
  if (!Array.isArray(input.paths) || input.paths.length === 0) {
    throw new Error("paths is required and must contain at least one path.");
  }
  if (input.paths.length > DEV_GIT_COMMIT_MAX_PATHS) {
    throw new Error(`paths must contain at most ${DEV_GIT_COMMIT_MAX_PATHS} items.`);
  }
  if (input.paths.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("paths must contain non-blank strings only.");
  }
  if (typeof input.message !== "string") {
    throw new Error("message is required and must be a string.");
  }
  const message = input.message.trim();
  if (!message) {
    throw new Error("message is required and must not be blank.");
  }
  if (Array.from(message).length > DEV_GIT_COMMIT_MESSAGE_MAX_CHARACTERS) {
    throw new Error(`message must be at most ${DEV_GIT_COMMIT_MESSAGE_MAX_CHARACTERS} characters.`);
  }
  if (message.includes("\u0000")) {
    throw new Error("message cannot contain NUL.");
  }
  if (/\r|\n/u.test(message)) {
    throw new Error("message must be a single-line commit subject.");
  }

  const normalizedPaths = [];
  const seen = new Set();
  for (let index = 0; index < input.paths.length; index += 1) {
    const normalized = normalizeCommitPath(input.paths[index], index);
    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (!seen.has(key)) {
      seen.add(key);
      normalizedPaths.push(normalized);
    }
  }
  return { paths: normalizedPaths, message };
}

async function assertCommitFilesystemPathSafety(repositoryRoot, relativePath, label) {
  const realRoot = await realpath(repositoryRoot);
  const segments = relativePath.split("/").filter(Boolean);
  let current = repositoryRoot;
  let finalInfo = null;

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new Error(`${label} cannot reference symbolic links or junctions.`);
    }
    const realCurrent = await realpath(current);
    if (!isInside(realRoot, realCurrent)) {
      throw new Error(`${label} resolves outside the repository.`);
    }
    if (index === segments.length - 1) finalInfo = info;
  }

  const resolved = path.resolve(repositoryRoot, ...segments);
  if (!isInside(path.resolve(repositoryRoot), resolved)) {
    throw new Error(`${label} resolves outside the repository.`);
  }
  if (finalInfo?.isDirectory()) {
    throw new Error(`${label} must reference a file path, not a directory.`);
  }
  return resolved;
}

function fixedCommitEnvironment() {
  return controlledProcessEnvironment({
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_EDITOR: process.platform === "win32" ? "cmd.exe /d /c exit 0" : "true",
    GIT_SEQUENCE_EDITOR: process.platform === "win32" ? "cmd.exe /d /c exit 0" : "true",
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
  });
}

function commitGitPrefix(hooksPath) {
  return [
    "--no-pager",
    "-c",
    "core.fsmonitor=false",
    "-c",
    `core.hooksPath=${hooksPath}`,
    "-c",
    "commit.gpgSign=false",
    "--literal-pathspecs",
  ];
}

async function runCommitGit({
  repositoryRoot,
  executable,
  argv,
  outputMaxCharacters,
  timeoutMs,
  hashStdout = false,
}) {
  const stdout = createBoundedOutputCollector(outputMaxCharacters);
  const stderr = createBoundedOutputCollector(outputMaxCharacters);
  const stdoutHash = hashStdout ? createHash("sha256") : null;
  let child;
  let spawnError = null;
  let exitCode = null;
  let signal = null;
  let timedOut = false;

  try {
    child = spawn(executable, argv, {
      cwd: repositoryRoot,
      env: fixedCommitEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    activeCommitGitChildren.add(child);
  } catch (error) {
    spawnError = error;
  }

  if (child) {
    child.stdout.on("data", (chunk) => {
      stdout.append(chunk);
      stdoutHash?.update(chunk);
    });
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
    activeCommitGitChildren.delete(child);
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
      spawnError
        ? redactProcessOutput(`Git process failed to start: ${spawnError.message}`)
        : "",
    ].filter(Boolean).join("\n"),
    stdout_truncated: stdoutResult.truncated,
    stderr_truncated: stderrResult.truncated,
    stdout_sha256: stdoutHash ? stdoutHash.digest("hex") : null,
  };
}

function parseNulList(value) {
  return value.split("\u0000").filter(Boolean).map((item) => item.replaceAll("\\", "/"));
}

function parseFilterAssignments(value) {
  const parts = value.split("\u0000");
  const assignments = [];
  for (let index = 0; index + 2 < parts.length; index += 3) {
    const filePath = parts[index];
    const attribute = parts[index + 1];
    const filterValue = parts[index + 2];
    if (!filePath || attribute !== "filter") continue;
    if (filterValue === "unspecified" || filterValue === "unset") continue;
    assignments.push({
      path: redactProcessOutput(filePath.replaceAll("\\", "/")),
      filter: redactProcessOutput(filterValue),
    });
  }
  return assignments;
}

async function scanTrackedGitFilters({
  repositoryRoot,
  executable,
  hooksPath,
  timeoutMs,
  outputMaxCharacters,
}) {
  const stderr = createBoundedOutputCollector(outputMaxCharacters);
  const prefix = commitGitPrefix(hooksPath);
  const environment = fixedCommitEnvironment();
  let lsChild;
  let attrChild;
  let spawnError = null;
  let timedOut = false;
  let lsExitCode = null;
  let attrExitCode = null;
  let pending = "";
  const attrDecoder = new StringDecoder("utf8");
  let fields = [];
  let activeFilterCount = 0;
  const activeFilters = [];

  const consumeField = (field) => {
    fields.push(field);
    if (fields.length < 3) return;
    const [filePath, attribute, filterValue] = fields;
    fields = [];
    if (
      filePath
      && attribute === "filter"
      && filterValue !== "unspecified"
      && filterValue !== "unset"
    ) {
      activeFilterCount += 1;
      if (activeFilters.length < 20) {
        activeFilters.push({
          path: redactProcessOutput(filePath.replaceAll("\\", "/")),
          filter: redactProcessOutput(filterValue),
        });
      }
    }
  };

  try {
    lsChild = spawn(executable, [...prefix, "ls-files", "-z"], {
      cwd: repositoryRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    attrChild = spawn(executable, [...prefix, "check-attr", "-z", "--stdin", "filter"], {
      cwd: repositoryRoot,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: false,
    });
    activeCommitGitChildren.add(lsChild);
    activeCommitGitChildren.add(attrChild);
    lsChild.stdout.pipe(attrChild.stdin);
    lsChild.stderr.on("data", (chunk) => stderr.append(chunk));
    attrChild.stderr.on("data", (chunk) => stderr.append(chunk));
    attrChild.stdout.on("data", (chunk) => {
      pending += attrDecoder.write(chunk);
      const parts = pending.split("\u0000");
      pending = parts.pop() ?? "";
      for (const part of parts) consumeField(part);
    });
  } catch (error) {
    spawnError = error;
  }

  if (lsChild && attrChild) {
    await new Promise((resolve) => {
      let settled = false;
      let lsClosed = false;
      let attrClosed = false;
      let forceSettleTimer;
      const maybeFinish = () => {
        if (settled || !lsClosed || !attrClosed) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(forceSettleTimer);
        resolve();
      };
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(lsChild);
        terminateProcessTree(attrChild);
        forceSettleTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve();
        }, 5_000);
        forceSettleTimer.unref?.();
      }, timeoutMs);
      timeoutTimer.unref?.();
      lsChild.once("error", (error) => {
        spawnError ??= error;
      });
      attrChild.once("error", (error) => {
        spawnError ??= error;
      });
      lsChild.once("close", (code) => {
        lsExitCode = Number.isInteger(code) ? code : null;
        lsClosed = true;
        maybeFinish();
      });
      attrChild.once("close", (code) => {
        attrExitCode = Number.isInteger(code) ? code : null;
        attrClosed = true;
        maybeFinish();
      });
    });
  }

  if (lsChild) activeCommitGitChildren.delete(lsChild);
  if (attrChild) activeCommitGitChildren.delete(attrChild);
  pending += attrDecoder.end();
  if (pending) consumeField(pending);
  const stderrResult = stderr.finish();
  const structurallyComplete = fields.length === 0;
  return {
    execution_ok: !spawnError
      && !timedOut
      && structurallyComplete
      && lsExitCode === 0
      && attrExitCode === 0,
    active_filter_count: activeFilterCount,
    active_filters: activeFilters,
    timed_out: timedOut,
    exit_code: attrExitCode ?? lsExitCode,
    stderr: [
      stderrResult.text,
      spawnError
        ? redactProcessOutput(`Git filter audit failed to start: ${spawnError.message}`)
        : "",
      structurallyComplete ? "" : "Git filter audit returned an incomplete NUL-delimited record.",
    ].filter(Boolean).join("\n"),
    stderr_truncated: stderrResult.truncated,
  };
}

function parseNumstat(value) {
  let insertions = 0;
  let deletions = 0;
  for (const line of value.split(/\r?\n/u)) {
    if (!line) continue;
    const [added, removed] = line.split("\t", 3);
    if (/^\d+$/u.test(added)) insertions += Number(added);
    if (/^\d+$/u.test(removed)) deletions += Number(removed);
  }
  return { insertions, deletions };
}

function failureResult({
  reason,
  executionOk = true,
  stageCompleted = false,
  stagedPaths = [],
  exitCode = null,
  signal = null,
  timedOut = false,
  stderr = "",
  stderrTruncated = false,
  durationMs = null,
  branch = null,
}) {
  return {
    execution_ok: executionOk,
    committed: false,
    commit_created: false,
    stage_completed: stageCompleted,
    reason,
    staged_paths: stagedPaths,
    branch,
    exit_code: exitCode,
    signal,
    timed_out: timedOut,
    stderr,
    stderr_truncated: stderrTruncated,
    duration_ms: durationMs,
  };
}

export function createDevGitCommitTool({
  repositoryRoot = projectRoot,
  executable = fixedCommitGitExecutable,
  outputMaxCharacters = DEV_GIT_COMMIT_OUTPUT_MAX_CHARACTERS,
  timeoutMs = devGitCommitTimeoutMs,
} = {}) {
  const gitTools = createDevGitTools({
    repositoryRoot,
    executable,
    outputMaxCharacters,
    timeoutMs,
  });

  async function run(hooksPath, args, options = {}) {
    return runCommitGit({
      repositoryRoot,
      executable,
      argv: [...commitGitPrefix(hooksPath), ...args],
      outputMaxCharacters,
      timeoutMs,
      ...options,
    });
  }

  async function stagedPaths(hooksPath) {
    const result = await run(hooksPath, [
      "diff",
      "--cached",
      "--name-only",
      "--no-renames",
      "-z",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
    ]);
    return {
      result,
      paths: result.execution_ok && result.exit_code === 0 ? parseNulList(result.stdout) : [],
    };
  }

  return async function commit(input = {}) {
    const startedAt = Date.now();
    let normalized;
    try {
      normalized = validateCommitInput(input);
      for (let index = 0; index < normalized.paths.length; index += 1) {
        await assertCommitFilesystemPathSafety(
          repositoryRoot,
          normalized.paths[index],
          `paths[${index}]`,
        );
      }
    } catch (error) {
      return failureResult({
        reason: error.message,
        executionOk: false,
        durationMs: Date.now() - startedAt,
      });
    }

    if (commitInProgress) {
      return failureResult({
        reason: "Another dev_git_commit invocation is already running.",
        executionOk: false,
        durationMs: Date.now() - startedAt,
      });
    }
    commitInProgress = true;

    let hooksPath = null;
    try {
      hooksPath = await mkdtemp(path.join(os.tmpdir(), "writer-workbench-empty-hooks-"));

      const trackedFilterAudit = await scanTrackedGitFilters({
        repositoryRoot,
        executable,
        hooksPath,
        timeoutMs,
        outputMaxCharacters,
      });
      if (!trackedFilterAudit.execution_ok) {
        return failureResult({
          reason: "Could not complete the tracked-file Git filter audit before worktree-sensitive Git operations.",
          executionOk: false,
          exitCode: trackedFilterAudit.exit_code,
          timedOut: trackedFilterAudit.timed_out,
          stderr: trackedFilterAudit.stderr,
          stderrTruncated: trackedFilterAudit.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (trackedFilterAudit.active_filter_count > 0) {
        return failureResult({
          reason: `Repository tracked files use Git filters; external filter execution is blocked before worktree-sensitive Git operations: ${trackedFilterAudit.active_filters.map((item) => item.path).join(", ")}.`,
          durationMs: Date.now() - startedAt,
        });
      }

      const requestedFilterCheck = await run(hooksPath, [
        "check-attr",
        "-z",
        "filter",
        "--",
        ...normalized.paths,
      ]);
      if (!requestedFilterCheck.execution_ok || requestedFilterCheck.exit_code !== 0) {
        return failureResult({
          reason: "Could not verify Git filter safety for requested paths before worktree-sensitive Git operations.",
          executionOk: false,
          exitCode: requestedFilterCheck.exit_code,
          signal: requestedFilterCheck.signal,
          timedOut: requestedFilterCheck.timed_out,
          stderr: requestedFilterCheck.stderr,
          stderrTruncated: requestedFilterCheck.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      const requestedFilterAssignments = parseFilterAssignments(requestedFilterCheck.stdout);
      if (requestedFilterAssignments.length > 0) {
        return failureResult({
          reason: `Requested paths use Git filters; external filter execution is blocked: ${requestedFilterAssignments.map((item) => item.path).join(", ")}.`,
          durationMs: Date.now() - startedAt,
        });
      }

      const statusBefore = await gitTools.status({ includeUntracked: true });
      if (!statusBefore.execution_ok || statusBefore.exit_code !== 0) {
        return failureResult({
          reason: "Could not read repository status before commit.",
          executionOk: false,
          exitCode: statusBefore.exit_code,
          signal: statusBefore.signal,
          timedOut: statusBefore.timed_out,
          stderr: statusBefore.stderr,
          stderrTruncated: statusBefore.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (statusBefore.conflicted.length > 0) {
        return failureResult({
          reason: "Repository has conflicted paths; dev_git_commit refuses to commit.",
          branch: statusBefore.branch,
          stagedPaths: statusBefore.staged.map((item) => item.path),
          durationMs: Date.now() - startedAt,
        });
      }

      const requestedSet = new Set(normalized.paths);
      const beforeStage = await stagedPaths(hooksPath);
      if (!beforeStage.result.execution_ok || beforeStage.result.exit_code !== 0) {
        return failureResult({
          reason: "Could not inspect the preexisting staged set.",
          executionOk: false,
          branch: statusBefore.branch,
          exitCode: beforeStage.result.exit_code,
          signal: beforeStage.result.signal,
          timedOut: beforeStage.result.timed_out,
          stderr: beforeStage.result.stderr,
          stderrTruncated: beforeStage.result.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      const unrelatedPreexisting = beforeStage.paths.filter((filePath) => !requestedSet.has(filePath));
      if (unrelatedPreexisting.length > 0) {
        return failureResult({
          reason: "Preexisting unrelated staged changes are present; commit rejected without changing the index.",
          branch: statusBefore.branch,
          stagedPaths: beforeStage.paths,
          durationMs: Date.now() - startedAt,
        });
      }

      const addResult = await run(hooksPath, ["add", "--", ...normalized.paths]);
      const afterAdd = await stagedPaths(hooksPath);
      if (!addResult.execution_ok || addResult.exit_code !== 0) {
        return failureResult({
          reason: "git add failed; current staged state is preserved.",
          executionOk: addResult.execution_ok,
          branch: statusBefore.branch,
          stageCompleted: false,
          stagedPaths: afterAdd.paths,
          exitCode: addResult.exit_code,
          signal: addResult.signal,
          timedOut: addResult.timed_out,
          stderr: addResult.stderr,
          stderrTruncated: addResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (!afterAdd.result.execution_ok || afterAdd.result.exit_code !== 0) {
        return failureResult({
          reason: "Staging completed but the staged set could not be re-read; index is preserved.",
          executionOk: false,
          branch: statusBefore.branch,
          stageCompleted: true,
          exitCode: afterAdd.result.exit_code,
          signal: afterAdd.result.signal,
          timedOut: afterAdd.result.timed_out,
          stderr: afterAdd.result.stderr,
          stderrTruncated: afterAdd.result.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (afterAdd.paths.length === 0) {
        return failureResult({
          reason: "Requested paths produced no staged changes; empty commits are not allowed.",
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: [],
          durationMs: Date.now() - startedAt,
        });
      }
      const unexpectedStaged = afterAdd.paths.filter((filePath) => !requestedSet.has(filePath));
      if (unexpectedStaged.length > 0) {
        return failureResult({
          reason: "Staged isolation check failed; unexpected staged paths are present and the index is preserved.",
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: afterAdd.paths,
          durationMs: Date.now() - startedAt,
        });
      }

      const diffCheck = await run(hooksPath, [
        "-c",
        `core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`,
        "diff",
        "--cached",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "--check",
      ]);
      if (!diffCheck.execution_ok) {
        return failureResult({
          reason: "Staged diff check could not complete; staged state is preserved.",
          executionOk: false,
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: afterAdd.paths,
          exitCode: diffCheck.exit_code,
          signal: diffCheck.signal,
          timedOut: diffCheck.timed_out,
          stderr: diffCheck.stderr,
          stderrTruncated: diffCheck.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (diffCheck.exit_code !== 0) {
        return failureResult({
          reason: `Staged diff --check failed; commit not created. ${diffCheck.stdout}`.trim(),
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: afterAdd.paths,
          exitCode: diffCheck.exit_code,
          stderr: diffCheck.stderr,
          stderrTruncated: diffCheck.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }

      const [numstatResult, diffHashResult] = await Promise.all([
        run(hooksPath, [
          "diff",
          "--cached",
          "--numstat",
          "--no-renames",
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
        ]),
        run(hooksPath, [
          "diff",
          "--cached",
          "--binary",
          "--no-renames",
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
        ], { hashStdout: true }),
      ]);
      if (
        !numstatResult.execution_ok
        || numstatResult.exit_code !== 0
        || !diffHashResult.execution_ok
        || diffHashResult.exit_code !== 0
      ) {
        return failureResult({
          reason: "Could not compute the staged commit summary; staged state is preserved.",
          executionOk: false,
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: afterAdd.paths,
          exitCode: numstatResult.exit_code ?? diffHashResult.exit_code,
          stderr: [numstatResult.stderr, diffHashResult.stderr].filter(Boolean).join("\n"),
          stderrTruncated: numstatResult.stderr_truncated || diffHashResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      const summary = parseNumstat(numstatResult.stdout);

      const commitResult = await run(hooksPath, [
        "commit",
        "--no-gpg-sign",
        "-m",
        normalized.message,
      ]);
      if (!commitResult.execution_ok || commitResult.exit_code !== 0) {
        const stagedAfterFailure = await stagedPaths(hooksPath);
        return failureResult({
          reason: "git commit failed; staged state is intentionally preserved and no automatic reset/restore was performed.",
          executionOk: commitResult.execution_ok,
          branch: statusBefore.branch,
          stageCompleted: true,
          stagedPaths: stagedAfterFailure.paths,
          exitCode: commitResult.exit_code,
          signal: commitResult.signal,
          timedOut: commitResult.timed_out,
          stderr: commitResult.stderr,
          stderrTruncated: commitResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }

      const hashResult = await run(hooksPath, ["rev-parse", "--verify", "HEAD"]);
      const statusAfter = await gitTools.status({ includeUntracked: true });
      if (!hashResult.execution_ok || hashResult.exit_code !== 0) {
        return {
          ...failureResult({
            reason: "Commit was created but its HEAD hash could not be read.",
            executionOk: false,
            branch: statusAfter.branch ?? statusBefore.branch,
            stageCompleted: true,
            stagedPaths: statusAfter.staged.map((item) => item.path),
            exitCode: hashResult.exit_code,
            signal: hashResult.signal,
            timedOut: hashResult.timed_out,
            stderr: hashResult.stderr,
            stderrTruncated: hashResult.stderr_truncated,
            durationMs: Date.now() - startedAt,
          }),
          committed: true,
          commit_created: true,
        };
      }

      return {
        execution_ok: statusAfter.execution_ok,
        committed: true,
        commit_created: true,
        commit: hashResult.stdout.trim(),
        message: normalized.message,
        paths: normalized.paths,
        staged_paths: afterAdd.paths,
        files_changed: afterAdd.paths.length,
        insertions: summary.insertions,
        deletions: summary.deletions,
        staged_diff_sha256: diffHashResult.stdout_sha256,
        branch: statusAfter.branch ?? statusBefore.branch,
        working_tree_clean: statusAfter.clean === true,
        remaining_staged_paths: statusAfter.staged.map((item) => item.path),
        modified: statusAfter.modified,
        untracked: statusAfter.untracked,
        exit_code: commitResult.exit_code,
        signal: commitResult.signal,
        timed_out: commitResult.timed_out,
        stderr: commitResult.stderr,
        stderr_truncated: commitResult.stderr_truncated,
        duration_ms: Date.now() - startedAt,
      };
    } catch (error) {
      let currentStaged = [];
      if (hooksPath) {
        try {
          currentStaged = (await stagedPaths(hooksPath)).paths;
        } catch {
          currentStaged = [];
        }
      }
      return failureResult({
        reason: redactProcessOutput(error.message),
        executionOk: false,
        stagedPaths: currentStaged,
        durationMs: Date.now() - startedAt,
      });
    } finally {
      commitInProgress = false;
      if (hooksPath) await rm(hooksPath, { recursive: true, force: true }).catch(() => {});
    }
  };
}

export const dev_git_commit = createDevGitCommitTool();

export function getDevGitCommitCommandMapping() {
  const hooksPlaceholder = "<server-owned-empty-hooks-dir>";
  const prefix = commitGitPrefix(hooksPlaceholder);
  return {
    executable: fixedCommitGitExecutable,
    cwd: ".",
    shell: false,
    fixed_prefix: prefix,
    tracked_filter_audit: {
      ls_files: [...prefix, "ls-files", "-z"],
      check_attr_stdin: [...prefix, "check-attr", "-z", "--stdin", "filter"],
    },
    requested_filter_check: [...prefix, "check-attr", "-z", "filter", "--", "<literal validated paths>"],
    add: [...prefix, "add", "--", "<literal validated paths>"],
    staged_paths: [
      ...prefix,
      "diff",
      "--cached",
      "--name-only",
      "--no-renames",
      "-z",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
    ],
    diff_check: [
      ...prefix,
      "-c",
      `core.whitespace=${DEV_GIT_WHITESPACE_POLICY}`,
      "diff",
      "--cached",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--check",
    ],
    commit: [...prefix, "commit", "--no-gpg-sign", "-m", "<literal message>"],
    head: [...prefix, "rev-parse", "--verify", "HEAD"],
  };
}

export const DEV_GIT_PUSH_OUTPUT_MAX_CHARACTERS = 128 * 1024;
export const DEV_GIT_PUSH_TIMEOUT_MS = 120_000;
export const DEV_GIT_PUSH_PRODUCTION_POLICY = Object.freeze({
  remote: "origin",
  branch: "main",
  upstream: "origin/main",
  canonicalUrl: "https://github.com/day2561124-art/wRITE.git",
  allowedProtocols: Object.freeze(["https"]),
  allowedCredentialHelpers: Object.freeze(["manager", "manager-core", "wincred"]),
});

const gitSha1Pattern = /^[A-Fa-f0-9]{40}$/u;
const fixedPushGitExecutable = process.platform === "win32" ? "git.exe" : "git";
const activePushGitChildren = new Set();
let pushInProgress = false;

process.once("exit", () => {
  for (const child of activePushGitChildren) terminatePushProcessTree(child);
});

function terminatePushProcessTree(child, { forceAfterMs = 2_000 } = {}) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    terminateProcessTree(child, { forceAfterMs });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    terminateProcessTree(child, { forceAfterMs });
    return;
  }
  const forceTimer = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The isolated process group may already have exited.
    }
  }, forceAfterMs);
  forceTimer.unref?.();
}

function validatePushInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("dev_git_push input must be an object.");
  }
  const unknown = Object.keys(input).filter((key) => key !== "expectedHead");
  if (unknown.length > 0) {
    throw new Error(`dev_git_push does not accept caller-controlled ${unknown.join(", ")}.`);
  }
  if (typeof input.expectedHead !== "string" || !gitSha1Pattern.test(input.expectedHead)) {
    throw new Error("expectedHead must be exactly 40 hexadecimal Git SHA-1 characters.");
  }
  return { expectedHead: input.expectedHead.toLowerCase() };
}

function normalizePushPolicy(policy) {
  const normalized = {
    remote: policy?.remote ?? "",
    branch: policy?.branch ?? "",
    upstream: policy?.upstream ?? "",
    canonicalUrl: policy?.canonicalUrl ?? "",
    allowedProtocols: Array.isArray(policy?.allowedProtocols) ? [...policy.allowedProtocols] : [],
    allowedCredentialHelpers: Array.isArray(policy?.allowedCredentialHelpers)
      ? [...policy.allowedCredentialHelpers]
      : [],
  };
  if (
    normalized.remote !== "origin"
    || normalized.branch !== "main"
    || normalized.upstream !== "origin/main"
    || typeof normalized.canonicalUrl !== "string"
    || !normalized.canonicalUrl
    || normalized.allowedProtocols.length === 0
    || normalized.allowedProtocols.some((item) => typeof item !== "string" || !/^[a-z][a-z0-9+.-]*$/u.test(item))
    || normalized.allowedCredentialHelpers.some((item) => typeof item !== "string" || !item)
  ) {
    throw new Error("Invalid internal dev_git_push policy configuration.");
  }
  return Object.freeze({
    ...normalized,
    allowedProtocols: Object.freeze(normalized.allowedProtocols),
    allowedCredentialHelpers: Object.freeze(normalized.allowedCredentialHelpers),
  });
}

function pushAuditGitPrefix(hooksPath) {
  return [
    "--no-pager",
    "-c",
    "core.fsmonitor=false",
    "-c",
    `core.hooksPath=${hooksPath}`,
  ];
}

function pushNetworkGitPrefix(hooksPath, policy, credentialHelpers) {
  const prefix = [
    ...pushAuditGitPrefix(hooksPath),
    "-c",
    "credential.helper=",
    "-c",
    "http.sslVerify=true",
    "-c",
    "protocol.allow=never",
  ];
  for (const protocol of ["ext", "file", "git", "ssh"]) {
    prefix.push("-c", `protocol.${protocol}.allow=never`);
  }
  for (const protocol of policy.allowedProtocols) {
    prefix.push("-c", `protocol.${protocol}.allow=always`);
  }
  for (const helper of credentialHelpers) {
    prefix.push("-c", `credential.helper=${helper}`);
  }
  return prefix;
}

function fixedPushEnvironment(policy) {
  return controlledProcessEnvironment({
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_ALLOW_PROTOCOL: policy.allowedProtocols.join(":"),
  });
}

async function runPushGit({
  repositoryRoot,
  executable,
  argv,
  outputMaxCharacters,
  timeoutMs,
  policy,
  executablePrefix = [],
}) {
  const stdout = createBoundedOutputCollector(outputMaxCharacters);
  const stderr = createBoundedOutputCollector(outputMaxCharacters);
  let child;
  let spawnError = null;
  let exitCode = null;
  let signal = null;
  let timedOut = false;

  try {
    child = spawn(executable, [...executablePrefix, ...argv], {
      cwd: repositoryRoot,
      env: fixedPushEnvironment(policy),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
    });
    activePushGitChildren.add(child);
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
        terminatePushProcessTree(child);
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
    activePushGitChildren.delete(child);
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
      spawnError
        ? redactProcessOutput(`Git process failed to start: ${spawnError.message}`)
        : "",
    ].filter(Boolean).join("\n"),
    stdout_truncated: stdoutResult.truncated,
    stderr_truncated: stderrResult.truncated,
  };
}

function configLines(stdout) {
  const lines = String(stdout ?? "").split(/\r?\n/u);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

async function readPushConfigValues(runAudit, key, { local = false } = {}) {
  const result = await runAudit([
    "config",
    ...(local ? ["--local"] : []),
    "--get-all",
    key,
  ]);
  if (!result.execution_ok) {
    return { ok: false, result, present: false, values: [] };
  }
  if (result.exit_code === 1) {
    return { ok: true, result, present: false, values: [] };
  }
  if (result.exit_code !== 0) {
    return { ok: false, result, present: false, values: [] };
  }
  return {
    ok: true,
    result,
    present: true,
    values: configLines(result.stdout),
  };
}

async function readPushConfigRegexp(runAudit, regexp) {
  const result = await runAudit(["config", "--get-regexp", regexp]);
  if (!result.execution_ok) return { ok: false, result, entries: [] };
  if (result.exit_code === 1) return { ok: true, result, entries: [] };
  if (result.exit_code !== 0) return { ok: false, result, entries: [] };
  return {
    ok: true,
    result,
    entries: configLines(result.stdout).map((line) => {
      const separator = line.search(/\s/u);
      return separator === -1
        ? { key: line, value: "" }
        : { key: line.slice(0, separator), value: line.slice(separator + 1) };
    }),
  };
}

async function auditPushConfiguration({ runAudit, policy }) {
  const remoteUrl = await readPushConfigValues(runAudit, "remote.origin.url", { local: true });
  if (!remoteUrl.ok) {
    return { ok: false, execution_ok: false, reason: "CONFIG_AUDIT_FAILED", details: "Could not read remote.origin.url.", result: remoteUrl.result };
  }
  if (
    !remoteUrl.present
    || remoteUrl.values.length !== 1
    || remoteUrl.values[0] !== policy.canonicalUrl
  ) {
    return { ok: false, execution_ok: true, reason: "REMOTE_URL_MISMATCH", details: "remote.origin.url does not exactly match the server-owned canonical origin URL." };
  }

  for (const [key, reason, details] of [
    ["remote.origin.pushurl", "PUSHURL_CONFIGURED", "remote.origin.pushurl is not allowed."],
    ["remote.origin.receivepack", "RECEIVEPACK_CONFIGURED", "remote.origin.receivepack is not allowed."],
    ["core.askPass", "ASKPASS_CONFIGURED", "core.askPass is not allowed."],
    ["core.sshCommand", "SSH_COMMAND_CONFIGURED", "core.sshCommand is not allowed."],
  ]) {
    const configured = await readPushConfigValues(runAudit, key);
    if (!configured.ok) {
      return { ok: false, execution_ok: false, reason: "CONFIG_AUDIT_FAILED", details: `Could not audit ${key}.`, result: configured.result };
    }
    if (configured.present) {
      return { ok: false, execution_ok: true, reason, details };
    }
  }

  const urlEntries = await readPushConfigRegexp(runAudit, "^url\\.");
  if (!urlEntries.ok) {
    return { ok: false, execution_ok: false, reason: "CONFIG_AUDIT_FAILED", details: "Could not audit url.* rewrite configuration.", result: urlEntries.result };
  }
  const rewriteEntries = urlEntries.entries.filter(({ key }) => {
    const lowered = key.toLowerCase();
    return lowered.endsWith(".insteadof") || lowered.endsWith(".pushinsteadof");
  });
  if (rewriteEntries.length > 0) {
    return { ok: false, execution_ok: true, reason: "URL_REWRITE_CONFIGURED", details: "url.*.insteadOf and url.*.pushInsteadOf are not allowed for dev_git_push." };
  }

  const credentialHelpers = await readPushConfigValues(runAudit, "credential.helper");
  if (!credentialHelpers.ok) {
    return { ok: false, execution_ok: false, reason: "CONFIG_AUDIT_FAILED", details: "Could not audit credential.helper.", result: credentialHelpers.result };
  }
  const nonBlankHelpers = credentialHelpers.values.filter((value) => value.trim() !== "");
  const allowedHelpers = new Set(policy.allowedCredentialHelpers);
  const unsafeHelpers = nonBlankHelpers.filter((value) => !allowedHelpers.has(value));
  if (unsafeHelpers.length > 0) {
    return { ok: false, execution_ok: true, reason: "UNSAFE_CREDENTIAL_HELPER", details: "credential.helper contains a value outside the server-owned safe helper allowlist." };
  }

  return {
    ok: true,
    execution_ok: true,
    credential_helpers: [...new Set(nonBlankHelpers)],
  };
}

async function gitOperationState(runAudit, repositoryRoot) {
  const gitDirResult = await runAudit(["rev-parse", "--absolute-git-dir"]);
  if (!gitDirResult.execution_ok || gitDirResult.exit_code !== 0) {
    return { ok: false, result: gitDirResult, active: [] };
  }
  const gitDir = gitDirResult.stdout.trim();
  if (!gitDir || !path.isAbsolute(gitDir)) {
    return { ok: false, result: gitDirResult, active: [] };
  }
  const active = [];
  for (const marker of [
    "MERGE_HEAD",
    "rebase-merge",
    "rebase-apply",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "sequencer",
  ]) {
    try {
      await lstat(path.join(gitDir, marker));
      active.push(marker);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { ok: true, active, repository_root: repositoryRoot };
}

function parseAheadBehind(value) {
  const match = String(value ?? "").trim().match(/^(\d+)\s+(\d+)$/u);
  if (!match) return null;
  return { ahead: Number(match[1]), behind: Number(match[2]) };
}

function pushFailureResult({
  reason,
  details = "",
  executionOk = true,
  remote = "origin",
  branch = "main",
  head = null,
  expectedHead = null,
  upstream = null,
  aheadBefore = null,
  behindBefore = null,
  exitCode = null,
  signal = null,
  timedOut = false,
  stdout = "",
  stderr = "",
  stdoutTruncated = false,
  stderrTruncated = false,
  durationMs = null,
}) {
  return {
    execution_ok: executionOk,
    pushed: false,
    reason,
    details,
    remote,
    branch,
    head,
    expected_head: expectedHead,
    upstream,
    ahead_before: aheadBefore,
    behind_before: behindBefore,
    exit_code: exitCode,
    signal,
    timed_out: timedOut,
    output: stdout,
    stderr,
    stdout_truncated: stdoutTruncated,
    stderr_truncated: stderrTruncated,
    duration_ms: durationMs,
  };
}

export function createDevGitPushTool({
  repositoryRoot = projectRoot,
  executable = fixedPushGitExecutable,
  outputMaxCharacters = DEV_GIT_PUSH_OUTPUT_MAX_CHARACTERS,
  timeoutMs = DEV_GIT_PUSH_TIMEOUT_MS,
  policy: suppliedPolicy = DEV_GIT_PUSH_PRODUCTION_POLICY,
  networkExecutable = executable,
  networkExecutablePrefix = [],
} = {}) {
  const policy = normalizePushPolicy(suppliedPolicy);
  const gitTools = createDevGitTools({
    repositoryRoot,
    executable,
    outputMaxCharacters,
    timeoutMs,
  });

  return async function push(input = {}) {
    const startedAt = Date.now();
    let normalized;
    try {
      normalized = validatePushInput(input);
    } catch (error) {
      return pushFailureResult({
        reason: "INVALID_INPUT",
        details: redactProcessOutput(error.message),
        executionOk: false,
        durationMs: Date.now() - startedAt,
      });
    }

    if (pushInProgress) {
      return pushFailureResult({
        reason: "PUSH_BUSY",
        details: "Another dev_git_push invocation is already running.",
        executionOk: false,
        expectedHead: normalized.expectedHead,
        durationMs: Date.now() - startedAt,
      });
    }
    pushInProgress = true;

    let hooksPath = null;
    let actualHead = null;
    let upstream = null;
    let aheadBefore = null;
    let behindBefore = null;
    try {
      hooksPath = await mkdtemp(path.join(os.tmpdir(), "writer-workbench-empty-push-hooks-"));
      const runAudit = (args) => runPushGit({
        repositoryRoot,
        executable,
        argv: [...pushAuditGitPrefix(hooksPath), ...args],
        outputMaxCharacters,
        timeoutMs,
        policy,
      });

      const configAudit = await auditPushConfiguration({ runAudit, policy });
      if (!configAudit.ok) {
        const result = configAudit.result ?? {};
        return pushFailureResult({
          reason: configAudit.reason,
          details: configAudit.details,
          executionOk: configAudit.execution_ok,
          expectedHead: normalized.expectedHead,
          exitCode: result.exit_code ?? null,
          signal: result.signal ?? null,
          timedOut: result.timed_out === true,
          stderr: result.stderr ?? "",
          stderrTruncated: result.stderr_truncated === true,
          durationMs: Date.now() - startedAt,
        });
      }

      const headResult = await runAudit(["rev-parse", "--verify", "HEAD"]);
      if (!headResult.execution_ok || headResult.exit_code !== 0 || !gitSha1Pattern.test(headResult.stdout.trim())) {
        return pushFailureResult({
          reason: "HEAD_READ_FAILED",
          details: "Could not read a valid current HEAD before push.",
          executionOk: false,
          expectedHead: normalized.expectedHead,
          exitCode: headResult.exit_code,
          signal: headResult.signal,
          timedOut: headResult.timed_out,
          stderr: headResult.stderr,
          stderrTruncated: headResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      actualHead = headResult.stdout.trim().toLowerCase();
      if (actualHead !== normalized.expectedHead) {
        return pushFailureResult({
          reason: "STALE_HEAD",
          details: "Current HEAD no longer matches expectedHead; push was not attempted.",
          head: actualHead,
          expectedHead: normalized.expectedHead,
          durationMs: Date.now() - startedAt,
        });
      }

      const branchResult = await runAudit(["symbolic-ref", "--quiet", "--short", "HEAD"]);
      if (branchResult.execution_ok && branchResult.exit_code === 1) {
        return pushFailureResult({
          reason: "DETACHED_HEAD",
          details: "Detached HEAD is not allowed.",
          head: actualHead,
          expectedHead: normalized.expectedHead,
          branch: null,
          durationMs: Date.now() - startedAt,
        });
      }
      if (!branchResult.execution_ok || branchResult.exit_code !== 0) {
        return pushFailureResult({
          reason: "BRANCH_READ_FAILED",
          details: "Could not resolve the current branch.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          exitCode: branchResult.exit_code,
          signal: branchResult.signal,
          timedOut: branchResult.timed_out,
          stderr: branchResult.stderr,
          stderrTruncated: branchResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      const branch = branchResult.stdout.trim();
      if (branch !== policy.branch) {
        return pushFailureResult({
          reason: "WRONG_BRANCH",
          details: `dev_git_push only allows branch ${policy.branch}.`,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          branch,
          durationMs: Date.now() - startedAt,
        });
      }

      const upstreamResult = await runAudit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
      if (!upstreamResult.execution_ok || upstreamResult.exit_code !== 0) {
        return pushFailureResult({
          reason: "UPSTREAM_READ_FAILED",
          details: "Current main branch must have the exact origin/main upstream.",
          executionOk: upstreamResult.execution_ok,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          exitCode: upstreamResult.exit_code,
          signal: upstreamResult.signal,
          timedOut: upstreamResult.timed_out,
          stderr: upstreamResult.stderr,
          stderrTruncated: upstreamResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      upstream = upstreamResult.stdout.trim();
      if (upstream !== policy.upstream) {
        return pushFailureResult({
          reason: "WRONG_UPSTREAM",
          details: `dev_git_push requires upstream ${policy.upstream}.`,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          durationMs: Date.now() - startedAt,
        });
      }

      const operationState = await gitOperationState(runAudit, repositoryRoot);
      if (!operationState.ok) {
        return pushFailureResult({
          reason: "OPERATION_STATE_READ_FAILED",
          details: "Could not verify merge/rebase/cherry-pick/revert/sequencer state.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          exitCode: operationState.result?.exit_code ?? null,
          timedOut: operationState.result?.timed_out === true,
          stderr: operationState.result?.stderr ?? "",
          stderrTruncated: operationState.result?.stderr_truncated === true,
          durationMs: Date.now() - startedAt,
        });
      }
      if (operationState.active.length > 0) {
        return pushFailureResult({
          reason: "OPERATION_IN_PROGRESS",
          details: `Repository operation state is active: ${operationState.active.join(", ")}.`,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          durationMs: Date.now() - startedAt,
        });
      }

      const relationResult = await runAudit(["rev-list", "--left-right", "--count", `HEAD...${policy.upstream}`]);
      const relation = relationResult.execution_ok && relationResult.exit_code === 0
        ? parseAheadBehind(relationResult.stdout)
        : null;
      if (!relation) {
        return pushFailureResult({
          reason: "AHEAD_BEHIND_READ_FAILED",
          details: "Could not read local/upstream ahead-behind relation.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          exitCode: relationResult.exit_code,
          signal: relationResult.signal,
          timedOut: relationResult.timed_out,
          stderr: relationResult.stderr,
          stderrTruncated: relationResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      aheadBefore = relation.ahead;
      behindBefore = relation.behind;
      if (behindBefore > 0) {
        return pushFailureResult({
          reason: "BEHIND_UPSTREAM",
          details: "Local main is behind origin/main; automatic fetch/pull/rebase/force is forbidden.",
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          durationMs: Date.now() - startedAt,
        });
      }
      if (aheadBefore === 0) {
        return pushFailureResult({
          reason: "NOT_AHEAD",
          details: "Local main is not ahead of origin/main; no-op push was not attempted.",
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          durationMs: Date.now() - startedAt,
        });
      }

      const trackedFilterAudit = await scanTrackedGitFilters({
        repositoryRoot,
        executable,
        hooksPath,
        timeoutMs,
        outputMaxCharacters,
      });
      if (!trackedFilterAudit.execution_ok) {
        return pushFailureResult({
          reason: "FILTER_AUDIT_FAILED",
          details: "Could not complete the tracked-file Git filter audit before worktree-sensitive Git operations.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: trackedFilterAudit.exit_code,
          timedOut: trackedFilterAudit.timed_out,
          stderr: trackedFilterAudit.stderr,
          stderrTruncated: trackedFilterAudit.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (trackedFilterAudit.active_filter_count > 0) {
        return pushFailureResult({
          reason: "GIT_FILTER_ACTIVE",
          details: `Tracked files use Git filters; external filter execution is blocked before push: ${trackedFilterAudit.active_filters.map((item) => item.path).join(", ")}.`,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          durationMs: Date.now() - startedAt,
        });
      }

      const status = await gitTools.status({ includeUntracked: true });
      if (!status.execution_ok || status.exit_code !== 0) {
        return pushFailureResult({
          reason: "STATUS_READ_FAILED",
          details: "Could not read repository status before push.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: status.exit_code,
          signal: status.signal,
          timedOut: status.timed_out,
          stderr: status.stderr,
          stderrTruncated: status.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (status.conflicted.length > 0) {
        return pushFailureResult({ reason: "CONFLICTED", details: "Conflicted paths are present.", head: actualHead, expectedHead: normalized.expectedHead, upstream, aheadBefore, behindBefore, durationMs: Date.now() - startedAt });
      }
      if (status.staged.length > 0) {
        return pushFailureResult({ reason: "STAGED_CHANGES", details: "The Git index is not empty.", head: actualHead, expectedHead: normalized.expectedHead, upstream, aheadBefore, behindBefore, durationMs: Date.now() - startedAt });
      }
      if (status.untracked.length > 0) {
        return pushFailureResult({ reason: "UNTRACKED_FILES", details: "Untracked files are present.", head: actualHead, expectedHead: normalized.expectedHead, upstream, aheadBefore, behindBefore, durationMs: Date.now() - startedAt });
      }
      if (!status.clean || status.modified.length > 0 || status.deleted.length > 0 || status.renamed.length > 0) {
        return pushFailureResult({ reason: "WORKTREE_DIRTY", details: "Working tree must be clean before push.", head: actualHead, expectedHead: normalized.expectedHead, upstream, aheadBefore, behindBefore, durationMs: Date.now() - startedAt });
      }

      const finalHeadResult = await runAudit(["rev-parse", "--verify", "HEAD"]);
      const finalHead = finalHeadResult.execution_ok && finalHeadResult.exit_code === 0
        ? finalHeadResult.stdout.trim().toLowerCase()
        : "";
      if (!gitSha1Pattern.test(finalHead) || finalHead !== normalized.expectedHead) {
        return pushFailureResult({
          reason: "STALE_HEAD",
          details: "HEAD changed during the pre-push gate; push was not attempted.",
          executionOk: finalHeadResult.execution_ok,
          head: finalHead || actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: finalHeadResult.exit_code,
          signal: finalHeadResult.signal,
          timedOut: finalHeadResult.timed_out,
          stderr: finalHeadResult.stderr,
          stderrTruncated: finalHeadResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      actualHead = finalHead;

      const finalConfigAudit = await auditPushConfiguration({ runAudit, policy });
      if (!finalConfigAudit.ok) {
        const result = finalConfigAudit.result ?? {};
        return pushFailureResult({
          reason: finalConfigAudit.reason,
          details: finalConfigAudit.details,
          executionOk: finalConfigAudit.execution_ok,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: result.exit_code ?? null,
          timedOut: result.timed_out === true,
          stderr: result.stderr ?? "",
          stderrTruncated: result.stderr_truncated === true,
          durationMs: Date.now() - startedAt,
        });
      }

      const networkPrefix = pushNetworkGitPrefix(
        hooksPath,
        policy,
        finalConfigAudit.credential_helpers,
      );
      const pushArgv = [
        ...networkPrefix,
        "push",
        "--porcelain",
        "--no-verify",
        policy.canonicalUrl,
        `HEAD:refs/heads/${policy.branch}`,
      ];
      const pushResult = await runPushGit({
        repositoryRoot,
        executable: networkExecutable,
        executablePrefix: networkExecutablePrefix,
        argv: pushArgv,
        outputMaxCharacters,
        timeoutMs,
        policy,
      });
      if (!pushResult.execution_ok) {
        return pushFailureResult({
          reason: pushResult.timed_out ? "PUSH_TIMEOUT" : "PUSH_EXECUTION_FAILED",
          details: pushResult.timed_out
            ? "Git push timed out and its process tree was terminated."
            : "Git push could not be executed.",
          executionOk: false,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: pushResult.exit_code,
          signal: pushResult.signal,
          timedOut: pushResult.timed_out,
          stdout: pushResult.stdout,
          stderr: pushResult.stderr,
          stdoutTruncated: pushResult.stdout_truncated,
          stderrTruncated: pushResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }
      if (pushResult.exit_code !== 0) {
        return pushFailureResult({
          reason: "GIT_PUSH_REJECTED",
          details: "Git push completed with a nonzero exit; local repository state was left unchanged.",
          executionOk: true,
          head: actualHead,
          expectedHead: normalized.expectedHead,
          upstream,
          aheadBefore,
          behindBefore,
          exitCode: pushResult.exit_code,
          signal: pushResult.signal,
          stdout: pushResult.stdout,
          stderr: pushResult.stderr,
          stdoutTruncated: pushResult.stdout_truncated,
          stderrTruncated: pushResult.stderr_truncated,
          durationMs: Date.now() - startedAt,
        });
      }

      return {
        execution_ok: true,
        pushed: true,
        remote: policy.remote,
        branch: policy.branch,
        head: actualHead,
        expected_head: normalized.expectedHead,
        upstream,
        ahead_before: aheadBefore,
        behind_before: behindBefore,
        exit_code: pushResult.exit_code,
        signal: pushResult.signal,
        timed_out: false,
        output: pushResult.stdout,
        stderr: pushResult.stderr,
        stdout_truncated: pushResult.stdout_truncated,
        stderr_truncated: pushResult.stderr_truncated,
        duration_ms: Date.now() - startedAt,
      };
    } catch (error) {
      return pushFailureResult({
        reason: "INTERNAL_ERROR",
        details: redactProcessOutput(error.message),
        executionOk: false,
        head: actualHead,
        expectedHead: normalized.expectedHead,
        upstream,
        aheadBefore,
        behindBefore,
        durationMs: Date.now() - startedAt,
      });
    } finally {
      pushInProgress = false;
      if (hooksPath) await rm(hooksPath, { recursive: true, force: true }).catch(() => {});
    }
  };
}

export const dev_git_push = createDevGitPushTool();

export function getDevGitPushCommandMapping() {
  const policy = DEV_GIT_PUSH_PRODUCTION_POLICY;
  const hooksPlaceholder = "<server-owned-empty-hooks-dir>";
  const auditPrefix = pushAuditGitPrefix(hooksPlaceholder);
  const networkPrefix = pushNetworkGitPrefix(
    hooksPlaceholder,
    policy,
    ["<server-validated-safe-credential-helper-if-configured>"],
  );
  return {
    executable: fixedPushGitExecutable,
    cwd: ".",
    shell: false,
    timeout_ms: DEV_GIT_PUSH_TIMEOUT_MS,
    remote: policy.remote,
    branch: policy.branch,
    upstream: policy.upstream,
    canonical_url: policy.canonicalUrl,
    allowed_protocols: [...policy.allowedProtocols],
    config_audit_prefix: auditPrefix,
    tracked_filter_audit: {
      ls_files: [...commitGitPrefix(hooksPlaceholder), "ls-files", "-z"],
      check_attr_stdin: [...commitGitPrefix(hooksPlaceholder), "check-attr", "-z", "--stdin", "filter"],
    },
    head: [...auditPrefix, "rev-parse", "--verify", "HEAD"],
    branch_check: [...auditPrefix, "symbolic-ref", "--quiet", "--short", "HEAD"],
    upstream_check: [...auditPrefix, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    ahead_behind: [...auditPrefix, "rev-list", "--left-right", "--count", "HEAD...origin/main"],
    push: [
      ...networkPrefix,
      "push",
      "--porcelain",
      "--no-verify",
      policy.canonicalUrl,
      "HEAD:refs/heads/main",
    ],
  };
}
