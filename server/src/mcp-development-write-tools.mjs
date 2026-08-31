import { createHash } from "node:crypto";
import path from "node:path";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertAllowedPathPolicy,
  assertExistingSafePath,
  decodeText,
  isSupportedTextPath,
} from "./mcp-development-readonly-tools.mjs";
import {
  normalizeProjectPath,
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

function assertRepositoryRelativePath(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} requires a path.`);
  }
  if (path.isAbsolute(value)) {
    throw new Error(`${label} must be repository-relative; absolute paths are not allowed.`);
  }
  if (inputPathSegments(value).includes("..")) {
    throw new Error(`${label} cannot contain '..' path traversal segments.`);
  }
}

export function assertDevelopmentWritePathPolicy(resolved, label = "path") {
  const normalized = normalizeProjectPath(resolved);
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
    return resolved;
  }
  if (segments.length > 1 && allowedTopLevelDirectories.has(topLevel)) {
    return resolved;
  }
  throw new Error(
    `${label} must reference an approved development path (source, tests, scripts, configuration, package metadata, or documentation).`,
  );
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
