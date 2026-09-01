import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_APPLY_PATCH_MAX_BYTES,
  DEV_CREATE_FILE_MAX_TEXT_CHARACTERS,
  dev_apply_patch,
  dev_create_directory,
  dev_create_file,
  dev_delete_file,
  dev_get_file_info,
  dev_move_path,
} from "../../server/src/mcp-development-write-tools.mjs";
import {
  DEV_READ_MAX_BYTES,
  dev_read_file_range,
} from "../../server/src/mcp-development-readonly-tools.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const auditLogPath = path.join(rootDir, "data", "outputs", "logs", "mcp_tool_audit.jsonl");
const transactionDir = path.join(rootDir, "data", "outputs", "logs", "transactions");
const auditIntentDir = path.join(rootDir, "data", "outputs", "logs", "mcp_audit_intents");
const fixtureRoot = path.join(
  rootDir,
  "tests",
  ".tmp",
  `dev-apply-patch-${process.pid}-${randomUUID().slice(0, 8)}`,
);
const isolatedTransactionDir = path.join(fixtureRoot, "transactions");
let externalRoot;

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function projectRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

async function optionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function optionalDirectoryEntries(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function removeNewDirectoryEntries(directory, beforeEntries) {
  let afterEntries;
  try {
    afterEntries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of afterEntries) {
    if (!beforeEntries?.has(entry)) {
      await rm(path.join(directory, entry), { recursive: true, force: true });
    }
  }
}

function runMcp(profile, request) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: profile },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }
      try {
        const responses = stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(responses.find((response) => response.id === request.id));
      } catch (error) {
        reject(new Error(`Could not parse MCP response: ${error.message}\n${stdout}`));
      }
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}

async function expectRejected(operation, pattern) {
  await assert.rejects(operation, pattern);
}

await mkdir(fixtureRoot, { recursive: true });
externalRoot = await mkdtemp(path.join(tmpdir(), "writer-workbench-dev-patch-"));

const transactionOptions = {
  transactionMetadata: {
    test_transaction_dir: isolatedTransactionDir,
  },
};
const applyPatch = (input, options = transactionOptions) => dev_apply_patch(input, options);
const deleteFile = (input, options = transactionOptions) => dev_delete_file(input, options);

try {
  const lifecycleDirectory = path.join(fixtureRoot, "filesystem-lifecycle");
  const createdDirectory = await dev_create_directory({
    path: projectRelative(lifecycleDirectory),
  });
  assert.equal(createdDirectory.ok, true);
  assert.equal(createdDirectory.created, true);
  assert.equal(createdDirectory.type, "directory");
  assert.equal(createdDirectory.recursive, false);
  assert.equal(createdDirectory.path, projectRelative(lifecycleDirectory));
  await expectRejected(
    dev_create_directory({ path: projectRelative(lifecycleDirectory) }),
    /already exists; overwrite is not allowed/u,
  );

  const directoryInfo = await dev_get_file_info({ path: projectRelative(lifecycleDirectory) });
  assert.equal(directoryInfo.exists, true);
  assert.equal(directoryInfo.type, "directory");
  assert.equal(directoryInfo.path, projectRelative(lifecycleDirectory));
  assert.equal(directoryInfo.sha256, null);
  assert.equal(directoryInfo.line_count, null);
  assert.equal(directoryInfo.is_symlink, false);
  assert.equal(directoryInfo.protected, false);
  assert.equal(directoryInfo.writable, true);
  assert.equal(directoryInfo.classification, "approved_development_path");

  const createdFilePath = path.join(lifecycleDirectory, "created.txt");
  const createdFileContent = "alpha\n繁體中文 UTF-8\nomega\n";
  const createdFile = await dev_create_file({
    path: projectRelative(createdFilePath),
    content: createdFileContent,
  });
  const createdFileBuffer = await readFile(createdFilePath);
  assert.equal(createdFile.ok, true);
  assert.equal(createdFile.created, true);
  assert.equal(createdFile.path, projectRelative(createdFilePath));
  assert.equal(createdFile.bytes, createdFileBuffer.length);
  assert.equal(createdFile.sha256, sha256(createdFileBuffer));
  assert.equal(createdFileBuffer.toString("utf8"), createdFileContent);

  const createdFileInfo = await dev_get_file_info({ path: projectRelative(createdFilePath) });
  assert.equal(createdFileInfo.exists, true);
  assert.equal(createdFileInfo.type, "file");
  assert.equal(createdFileInfo.size, createdFileBuffer.length);
  assert.equal(createdFileInfo.sha256, sha256(createdFileBuffer));
  assert.equal(createdFileInfo.line_count, 3);
  assert.match(createdFileInfo.modified_time, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(createdFileInfo.is_symlink, false);
  assert.equal(createdFileInfo.protected, false);
  assert.equal(createdFileInfo.writable, true);

  const createdFileBeforeOverwriteAttempt = await readFile(createdFilePath);
  await expectRejected(
    dev_create_file({
      path: projectRelative(createdFilePath),
      content: "overwrite attempt\n",
    }),
    /already exists; overwrite is not allowed/u,
  );
  assert.deepEqual(await readFile(createdFilePath), createdFileBeforeOverwriteAttempt);

  const missingInfoPath = path.join(lifecycleDirectory, "not-created.txt");
  const missingInfo = await dev_get_file_info({ path: projectRelative(missingInfoPath) });
  assert.equal(missingInfo.exists, false);
  assert.equal(missingInfo.type, null);
  assert.equal(missingInfo.size, null);
  assert.equal(missingInfo.sha256, null);
  assert.equal(missingInfo.line_count, null);
  assert.equal(missingInfo.writable, true);

  const movedFilePath = path.join(lifecycleDirectory, "moved.txt");
  const moved = await dev_move_path({
    sourcePath: projectRelative(createdFilePath),
    destinationPath: projectRelative(movedFilePath),
    expectedSha256: createdFile.sha256,
  });
  assert.equal(moved.ok, true);
  assert.equal(moved.moved, true);
  assert.equal(moved.source_path, projectRelative(createdFilePath));
  assert.equal(moved.destination_path, projectRelative(movedFilePath));
  assert.equal(moved.sha256, createdFile.sha256);
  assert.equal(moved.source_exists, false);
  assert.equal(moved.destination_exists, true);
  assert.deepEqual(await readFile(movedFilePath), createdFileBuffer);
  await assert.rejects(
    () => readFile(createdFilePath),
    (error) => error?.code === "ENOENT",
  );

  const destinationExistsPath = path.join(lifecycleDirectory, "destination-exists.txt");
  const destinationBefore = Buffer.from("destination stays unchanged\n", "utf8");
  await writeFile(destinationExistsPath, destinationBefore);
  const moveSourcePath = path.join(lifecycleDirectory, "move-source.txt");
  const moveSourceBefore = Buffer.from("source stays unchanged\n", "utf8");
  await writeFile(moveSourcePath, moveSourceBefore);
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(moveSourcePath),
      destinationPath: projectRelative(destinationExistsPath),
    }),
    /already exists; overwrite is not allowed/u,
  );
  assert.deepEqual(await readFile(destinationExistsPath), destinationBefore);
  assert.deepEqual(await readFile(moveSourcePath), moveSourceBefore);

  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(path.join(lifecycleDirectory, "missing-source.txt")),
      destinationPath: projectRelative(path.join(lifecycleDirectory, "missing-source-destination.txt")),
    }),
    /sourcePath must reference an existing file/u,
  );
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(moveSourcePath),
      destinationPath: projectRelative(path.join(lifecycleDirectory, "stale-sha-destination.txt")),
      expectedSha256: "0".repeat(64),
    }),
    /expectedSha256 mismatch/u,
  );
  assert.deepEqual(await readFile(moveSourcePath), moveSourceBefore);
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(lifecycleDirectory),
      destinationPath: projectRelative(path.join(fixtureRoot, "filesystem-lifecycle-moved.txt")),
    }),
    /supports approved regular files only; directory move is not supported/u,
  );

  await expectRejected(
    dev_create_file({ path: "../escape.txt", content: "blocked\n" }),
    /path traversal/u,
  );
  await expectRejected(
    dev_create_directory({ path: "../escape-directory" }),
    /path traversal/u,
  );
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(moveSourcePath),
      destinationPath: "../escape-move.txt",
    }),
    /path traversal/u,
  );
  await expectRejected(
    dev_get_file_info({ path: "../package.json" }),
    /path traversal/u,
  );

  for (const protectedPath of [
    "data/canon_db/dev-create-file.txt",
    ".git/dev-create-file.txt",
    "tests/build/dev-create-file.txt",
  ]) {
    await expectRejected(
      dev_create_file({ path: protectedPath, content: "blocked\n" }),
      /protected from development writes|cannot access \.git internals|dependency, build, runtime, generated, or visual asset paths/u,
    );
  }
  await expectRejected(
    dev_create_directory({ path: "data/dev-create-directory" }),
    /protected from development writes/u,
  );
  await expectRejected(
    dev_get_file_info({ path: "data/canon_db/active_engine.md" }),
    /protected from development writes/u,
  );
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(moveSourcePath),
      destinationPath: "data/dev-move.txt",
    }),
    /protected from development writes/u,
  );
  await expectRejected(
    dev_move_path({
      sourcePath: "data/canon_db/active_engine.md",
      destinationPath: projectRelative(path.join(lifecycleDirectory, "protected-source.txt")),
    }),
    /protected from development writes/u,
  );

  const lifecycleSecretPath = path.join(lifecycleDirectory, ".env.local");
  await expectRejected(
    dev_create_file({ path: projectRelative(lifecycleSecretPath), content: "TOKEN=blocked\n" }),
    /cannot access secret files/u,
  );
  await expectRejected(
    dev_create_directory({ path: projectRelative(path.join(lifecycleDirectory, ".env.secret")) }),
    /cannot access secret files/u,
  );

  await expectRejected(
    dev_create_file({
      path: projectRelative(path.join(lifecycleDirectory, "oversized-create.txt")),
      content: "x".repeat(DEV_CREATE_FILE_MAX_TEXT_CHARACTERS + 1),
    }),
    /content must be at most \d+ characters/u,
  );
  await expectRejected(
    dev_create_file({
      path: projectRelative(path.join(lifecycleDirectory, "nul-create.txt")),
      content: "alpha\u0000omega",
    }),
    /content must reference a UTF-8 text file/u,
  );
  await expectRejected(
    dev_create_file({
      path: projectRelative(path.join(lifecycleDirectory, "unsupported.png")),
      content: "not actually an image",
    }),
    /supported UTF-8 text file/u,
  );

  const successPath = path.join(fixtureRoot, "success.txt");
  const successBefore = Buffer.from("alpha\nbeta\ngamma\n", "utf8");
  await writeFile(successPath, successBefore);
  const success = await applyPatch({
    path: projectRelative(successPath),
    oldText: "beta",
    newText: "BETA",
    expectedSha256: sha256(successBefore),
  });
  const successAfter = await readFile(successPath);
  assert.equal(successAfter.toString("utf8"), "alpha\nBETA\ngamma\n");
  assert.equal(success.ok, true);
  assert.equal(success.changed, true);
  assert.equal(success.path, projectRelative(successPath));
  assert.equal(success.before_sha256, sha256(successBefore));
  assert.equal(success.after_sha256, sha256(successAfter));
  assert.notEqual(success.before_sha256, success.after_sha256);
  assert.equal(success.before_bytes, successBefore.length);
  assert.equal(success.after_bytes, successAfter.length);
  assert.equal(Object.hasOwn(success, "content"), false);

  const rangedPath = path.join(fixtureRoot, "ranged-large.txt");
  const rangedLines = Array.from(
    { length: 12_000 },
    (_value, index) => `line-${String(index + 1).padStart(5, "0")} ${"x".repeat(24)}\n`,
  );
  const rangedContent = rangedLines.join("");
  assert(Buffer.byteLength(rangedContent, "utf8") > DEV_READ_MAX_BYTES);
  await writeFile(rangedPath, rangedContent, "utf8");
  const firstRange = await dev_read_file_range({
    path: projectRelative(rangedPath),
    startLine: 1,
    maxBytes: 4096,
  });
  assert.equal(firstRange.start_line, 1);
  assert.equal(firstRange.truncated, true);
  assert.equal(firstRange.returned_bytes <= 4096, true);
  assert.equal(firstRange.total_lines, rangedLines.length);
  assert.equal(firstRange.content.startsWith("line-00001 "), true);
  assert.equal(Number.isInteger(firstRange.next_start_line), true);
  const secondRange = await dev_read_file_range({
    path: projectRelative(rangedPath),
    startLine: firstRange.next_start_line,
    maxBytes: 4096,
  });
  assert.equal(secondRange.start_line, firstRange.next_start_line);
  assert.equal(
    secondRange.content.startsWith(
      `line-${String(firstRange.next_start_line).padStart(5, "0")} `,
    ),
    true,
  );
  const tailRange = await dev_read_file_range({
    path: projectRelative(rangedPath),
    startLine: rangedLines.length,
    maxBytes: 4096,
  });
  assert.equal(tailRange.end_line, rangedLines.length);
  assert.equal(tailRange.next_start_line, null);
  assert.equal(tailRange.truncated, false);
  assert.match(tailRange.content, /^line-12000 /u);
  await expectRejected(
    dev_read_file_range({
      path: projectRelative(rangedPath),
      startLine: rangedLines.length + 1,
      maxBytes: 4096,
    }),
    /startLine exceeds the file line count/u,
  );

  const deletePath = path.join(fixtureRoot, "delete-success.txt");
  const deleteBefore = Buffer.from("retire this legacy file\n", "utf8");
  await writeFile(deletePath, deleteBefore);
  const deleted = await deleteFile({
    path: projectRelative(deletePath),
    expectedSha256: sha256(deleteBefore),
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.path, projectRelative(deletePath));
  assert.equal(deleted.before_sha256, sha256(deleteBefore));
  assert.equal(deleted.before_bytes, deleteBefore.length);
  assert.equal(deleted.after_exists, false);
  await assert.rejects(
    () => readFile(deletePath),
    (error) => error?.code === "ENOENT",
  );

  const deleteStalePath = path.join(fixtureRoot, "delete-stale.txt");
  const deleteStaleBefore = Buffer.from("legacy v1\n", "utf8");
  await writeFile(deleteStalePath, deleteStaleBefore);
  const deleteStaleSha = sha256(deleteStaleBefore);
  const deleteStaleCurrent = Buffer.from("legacy v2\n", "utf8");
  await writeFile(deleteStalePath, deleteStaleCurrent);
  await expectRejected(
    deleteFile({
      path: projectRelative(deleteStalePath),
      expectedSha256: deleteStaleSha,
    }),
    /expectedSha256 mismatch/u,
  );
  assert.deepEqual(await readFile(deleteStalePath), deleteStaleCurrent);

  const zeroPath = path.join(fixtureRoot, "zero.txt");
  await writeFile(zeroPath, "alpha\nbeta\ngamma\n");
  const zeroBefore = await readFile(zeroPath);
  await expectRejected(
    applyPatch({ path: projectRelative(zeroPath), oldText: "delta", newText: "DELTA" }),
    /oldText was not found/u,
  );
  assert.equal(sha256(await readFile(zeroPath)), sha256(zeroBefore));

  const ambiguousPath = path.join(fixtureRoot, "ambiguous.txt");
  await writeFile(ambiguousPath, "beta\nalpha\nbeta\n");
  const ambiguousBefore = await readFile(ambiguousPath);
  await expectRejected(
    applyPatch({ path: projectRelative(ambiguousPath), oldText: "beta", newText: "BETA" }),
    /appears more than once/u,
  );
  assert.deepEqual(await readFile(ambiguousPath), ambiguousBefore);

  const stalePath = path.join(fixtureRoot, "stale.txt");
  await writeFile(stalePath, "alpha\nbeta\n");
  const staleSha = sha256(await readFile(stalePath));
  const externallyUpdated = Buffer.from("alpha\nnewer beta\n", "utf8");
  await writeFile(stalePath, externallyUpdated);
  await expectRejected(
    applyPatch({
      path: projectRelative(stalePath),
      oldText: "beta",
      newText: "BETA",
      expectedSha256: staleSha,
    }),
    /expectedSha256 mismatch/u,
  );
  assert.deepEqual(await readFile(stalePath), externallyUpdated);

  await expectRejected(
    applyPatch({ path: "../package.json", oldText: "a", newText: "b" }),
    /path traversal/u,
  );
  await expectRejected(
    applyPatch({ path: successPath, oldText: "BETA", newText: "beta" }),
    /absolute paths are not allowed/u,
  );

  const externalFile = path.join(externalRoot, "external.txt");
  const externalBefore = Buffer.from("outside beta\n", "utf8");
  await writeFile(externalFile, externalBefore);
  const externalLink = path.join(fixtureRoot, "external-link");
  await symlink(externalRoot, externalLink, process.platform === "win32" ? "junction" : "dir");
  await expectRejected(
    applyPatch({
      path: projectRelative(path.join(externalLink, "external.txt")),
      oldText: "beta",
      newText: "BETA",
    }),
    /outside the project through a symbolic link/u,
  );
  assert.deepEqual(await readFile(externalFile), externalBefore);

  await expectRejected(
    dev_create_file({
      path: projectRelative(path.join(externalLink, "created-through-link.txt")),
      content: "blocked\n",
    }),
    /symbolic links|outside the project/u,
  );
  await expectRejected(
    dev_create_directory({
      path: projectRelative(path.join(externalLink, "directory-through-link")),
    }),
    /symbolic links|outside the project/u,
  );
  await expectRejected(
    dev_move_path({
      sourcePath: projectRelative(moveSourcePath),
      destinationPath: projectRelative(path.join(externalLink, "moved-through-link.txt")),
    }),
    /symbolic links|outside the project/u,
  );
  await expectRejected(
    dev_get_file_info({ path: projectRelative(externalLink) }),
    /symbolic links|outside the project/u,
  );
  assert.deepEqual(await readFile(externalFile), externalBefore);
  assert.deepEqual(await readFile(moveSourcePath), moveSourceBefore);

  const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
  const activeEngineBefore = await readFile(activeEnginePath);
  await expectRejected(
    applyPatch({
      path: "data/canon_db/active_engine.md",
      oldText: "#",
      newText: "##",
    }),
    /protected from development writes/u,
  );
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  await expectRejected(
    deleteFile({ path: "data/canon_db/active_engine.md" }),
    /protected from development writes/u,
  );
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  await expectRejected(
    deleteFile({ path: "../package.json" }),
    /path traversal/u,
  );

  await expectRejected(
    applyPatch({ path: ".git/config", oldText: "repositoryformatversion", newText: "version" }),
    /cannot access .git internals/u,
  );
  await expectRejected(
    applyPatch({ path: "server/build/fixture.txt", oldText: "a", newText: "b" }),
    /dependency, build, runtime, generated, or visual asset paths/u,
  );

  const secretPath = path.join(fixtureRoot, ".env.local");
  await writeFile(secretPath, "TOKEN=do-not-touch\n");
  await expectRejected(
    applyPatch({ path: projectRelative(secretPath), oldText: "TOKEN", newText: "VALUE" }),
    /cannot access secret files/u,
  );
  for (const secretName of [".npmrc", ".pypirc"]) {
    const registrySecretPath = path.join(fixtureRoot, secretName);
    await writeFile(registrySecretPath, "token=do-not-touch\n");
    await expectRejected(
      applyPatch({
        path: projectRelative(registrySecretPath),
        oldText: "token",
        newText: "value",
      }),
      /cannot access secret files/u,
    );
  }
  const certificatePath = path.join(fixtureRoot, "client.pem");
  await writeFile(certificatePath, "certificate fixture\n");
  await expectRejected(
    applyPatch({
      path: projectRelative(certificatePath),
      oldText: "fixture",
      newText: "changed",
    }),
    /cannot access secret files/u,
  );

  const binaryPath = path.join(fixtureRoot, "binary.txt");
  const binaryBefore = Buffer.from([0x61, 0x00, 0x62]);
  await writeFile(binaryPath, binaryBefore);
  await expectRejected(
    applyPatch({ path: projectRelative(binaryPath), oldText: "a", newText: "A" }),
    /must reference a UTF-8 text file/u,
  );
  assert.deepEqual(await readFile(binaryPath), binaryBefore);

  const unsupportedBinaryPath = path.join(fixtureRoot, "image.png");
  await writeFile(unsupportedBinaryPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await expectRejected(
    applyPatch({ path: projectRelative(unsupportedBinaryPath), oldText: "PNG", newText: "png" }),
    /supported UTF-8 text file/u,
  );

  const oversizedPath = path.join(fixtureRoot, "oversized.txt");
  const oversizedBefore = Buffer.alloc(DEV_APPLY_PATCH_MAX_BYTES + 1, 0x61);
  await writeFile(oversizedPath, oversizedBefore);
  await expectRejected(
    applyPatch({ path: projectRelative(oversizedPath), oldText: "a", newText: "A" }),
    /exceeds the \d+-byte patch limit/u,
  );
  assert.equal((await readFile(oversizedPath)).length, oversizedBefore.length);

  const crlfPath = path.join(fixtureRoot, "crlf.txt");
  const crlfBefore = Buffer.from("alpha\r\nbeta\r\ngamma\r\n", "utf8");
  await writeFile(crlfPath, crlfBefore);
  await applyPatch({
    path: projectRelative(crlfPath),
    oldText: "alpha\nbeta",
    newText: "ALPHA\nBETA",
  });
  const crlfAfter = await readFile(crlfPath);
  assert.equal(crlfAfter.toString("utf8"), "ALPHA\r\nBETA\r\ngamma\r\n");
  assert.equal(crlfAfter.toString("utf8").replaceAll("\r\n", "").includes("\n"), false);

  const deletionPath = path.join(fixtureRoot, "deletion.txt");
  await writeFile(deletionPath, "alpha\nremove\nomega\n");
  const deletionResult = await applyPatch({
    path: projectRelative(deletionPath),
    oldText: "remove\n",
    newText: "",
  });
  assert.equal(deletionResult.changed, true);
  assert.equal((await readFile(deletionPath, "utf8")), "alpha\nomega\n");

  const wholeFilePath = path.join(fixtureRoot, "whole-file.txt");
  await writeFile(wholeFilePath, "only");
  await expectRejected(
    applyPatch({ path: projectRelative(wholeFilePath), oldText: "only", newText: "" }),
    /cannot delete the entire file contents/u,
  );
  assert.equal(await readFile(wholeFilePath, "utf8"), "only");

  const atomicPath = path.join(fixtureRoot, "atomic.txt");
  const atomicBefore = Buffer.from("alpha\nbeta\ngamma\n", "utf8");
  await writeFile(atomicPath, atomicBefore);
  const originalTransactionTestMode = process.env.FILE_TRANSACTION_TEST_MODE;
  process.env.FILE_TRANSACTION_TEST_MODE = "1";
  try {
    await expectRejected(
      applyPatch(
        { path: projectRelative(atomicPath), oldText: "beta", newText: "BETA" },
        {
          transactionMetadata: {
            test_transaction_dir: isolatedTransactionDir,
            test_fail_after_commits: 1,
          },
        },
      ),
      /Injected transaction failure/u,
    );
  } finally {
    if (originalTransactionTestMode === undefined) {
      delete process.env.FILE_TRANSACTION_TEST_MODE;
    } else {
      process.env.FILE_TRANSACTION_TEST_MODE = originalTransactionTestMode;
    }
  }
  assert.deepEqual(await readFile(atomicPath), atomicBefore);
  assert.equal(
    (await readdir(fixtureRoot)).some((name) => name.endsWith(".tmp")),
    false,
    "atomic failure left a temp file beside the target",
  );

  const auditFixturePath = path.join(fixtureRoot, "audit.txt");
  const auditFixtureBefore = Buffer.from("alpha\nbeta\ngamma\n", "utf8");
  await writeFile(auditFixturePath, auditFixtureBefore);
  const mcpEmptyPath = path.join(fixtureRoot, "mcp-empty-new-text.txt");
  await writeFile(mcpEmptyPath, "alpha\nremove\nomega\n");
  const mcpDeletePath = path.join(fixtureRoot, "mcp-delete.txt");
  const mcpDeleteBefore = Buffer.from("legacy tool deletion audit\n", "utf8");
  await writeFile(mcpDeletePath, mcpDeleteBefore);
  const mcpCreatePath = path.join(fixtureRoot, "mcp-create.txt");
  const mcpCreateContent = "created through MCP filesystem lifecycle\n";
  const mcpMovePath = path.join(fixtureRoot, "mcp-create-moved.txt");
  const mcpCreateDirectoryPath = path.join(fixtureRoot, "mcp-created-directory");
  const auditLogBefore = await optionalBuffer(auditLogPath);
  const transactionsBefore = await optionalDirectoryEntries(transactionDir);
  const intentsBefore = await optionalDirectoryEntries(auditIntentDir);
  try {
    const response = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-patch-audit",
      method: "tools/call",
      params: {
        name: "dev_apply_patch",
        arguments: {
          path: projectRelative(auditFixturePath),
          oldText: "beta",
          newText: "BETA",
          expectedSha256: sha256(auditFixtureBefore),
        },
        _meta: { actor: "dev-wr-1-audit-test" },
      },
    });
    assert.equal(response.error, undefined);
    assert.equal(response.result?.isError, undefined);
    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.changed, true);

    const emptyNewTextResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-patch-empty-new-text",
      method: "tools/call",
      params: {
        name: "dev_apply_patch",
        arguments: {
          path: projectRelative(mcpEmptyPath),
          oldText: "remove\n",
          newText: "",
        },
        _meta: { actor: "dev-wr-1-empty-new-text-test" },
      },
    });
    assert.equal(emptyNewTextResponse.error, undefined);
    assert.equal(emptyNewTextResponse.result?.isError, undefined);
    assert.equal(await readFile(mcpEmptyPath, "utf8"), "alpha\nomega\n");

    const deleteResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-delete-audit",
      method: "tools/call",
      params: {
        name: "dev_delete_file",
        arguments: {
          path: projectRelative(mcpDeletePath),
          expectedSha256: sha256(mcpDeleteBefore),
        },
        _meta: { actor: "dev-wr-delete-audit-test" },
      },
    });
    assert.equal(deleteResponse.error, undefined);
    assert.equal(deleteResponse.result?.isError, undefined);
    const deletePayload = JSON.parse(deleteResponse.result.content[0].text);
    assert.equal(deletePayload.deleted, true);
    assert.equal(deletePayload.before_sha256, sha256(mcpDeleteBefore));
    await assert.rejects(
      () => readFile(mcpDeletePath),
      (error) => error?.code === "ENOENT",
    );

    const createResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-create-audit",
      method: "tools/call",
      params: {
        name: "dev_create_file",
        arguments: {
          path: projectRelative(mcpCreatePath),
          content: mcpCreateContent,
        },
        _meta: { actor: "dev-wr-create-audit-test" },
      },
    });
    assert.equal(createResponse.error, undefined);
    assert.equal(createResponse.result?.isError, undefined);
    const createPayload = JSON.parse(createResponse.result.content[0].text);
    assert.equal(createPayload.created, true);
    assert.equal(createPayload.sha256, sha256(Buffer.from(mcpCreateContent, "utf8")));
    assert.equal(await readFile(mcpCreatePath, "utf8"), mcpCreateContent);

    const createDirectoryResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-create-directory-audit",
      method: "tools/call",
      params: {
        name: "dev_create_directory",
        arguments: { path: projectRelative(mcpCreateDirectoryPath) },
        _meta: { actor: "dev-wr-create-directory-audit-test" },
      },
    });
    assert.equal(createDirectoryResponse.error, undefined);
    assert.equal(createDirectoryResponse.result?.isError, undefined);
    const createDirectoryPayload = JSON.parse(createDirectoryResponse.result.content[0].text);
    assert.equal(createDirectoryPayload.created, true);
    assert.equal(createDirectoryPayload.type, "directory");

    const moveResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-move-audit",
      method: "tools/call",
      params: {
        name: "dev_move_path",
        arguments: {
          sourcePath: projectRelative(mcpCreatePath),
          destinationPath: projectRelative(mcpMovePath),
          expectedSha256: createPayload.sha256,
        },
        _meta: { actor: "dev-wr-move-audit-test" },
      },
    });
    assert.equal(moveResponse.error, undefined);
    assert.equal(moveResponse.result?.isError, undefined);
    const movePayload = JSON.parse(moveResponse.result.content[0].text);
    assert.equal(movePayload.moved, true);
    assert.equal(movePayload.sha256, createPayload.sha256);
    assert.equal(await readFile(mcpMovePath, "utf8"), mcpCreateContent);
    await assert.rejects(
      () => readFile(mcpCreatePath),
      (error) => error?.code === "ENOENT",
    );

    const infoResponse = await runMcp("chatgpt_developer", {
      jsonrpc: "2.0",
      id: "dev-info-readonly",
      method: "tools/call",
      params: {
        name: "dev_get_file_info",
        arguments: { path: projectRelative(mcpMovePath) },
      },
    });
    assert.equal(infoResponse.error, undefined);
    assert.equal(infoResponse.result?.isError, undefined);
    const infoPayload = JSON.parse(infoResponse.result.content[0].text);
    assert.equal(infoPayload.exists, true);
    assert.equal(infoPayload.type, "file");
    assert.equal(infoPayload.sha256, createPayload.sha256);

    const mcpFailureFixtures = [
      {
        actor: "dev-wr-1-zero-match-test",
        arguments: {
          path: projectRelative(zeroPath),
          oldText: "delta",
          newText: "DELTA",
        },
        message: /oldText was not found/u,
      },
      {
        actor: "dev-wr-1-ambiguous-match-test",
        arguments: {
          path: projectRelative(ambiguousPath),
          oldText: "beta",
          newText: "BETA",
        },
        message: /appears more than once/u,
      },
      {
        actor: "dev-wr-1-stale-sha-test",
        arguments: {
          path: projectRelative(stalePath),
          oldText: "beta",
          newText: "BETA",
          expectedSha256: staleSha,
        },
        message: /expectedSha256 mismatch/u,
      },
      {
        actor: "dev-wr-1-traversal-test",
        arguments: {
          path: "../package.json",
          oldText: "package",
          newText: "PACKAGE",
        },
        message: /path traversal/u,
      },
    ];
    for (const [index, fixture] of mcpFailureFixtures.entries()) {
      const failureResponse = await runMcp("chatgpt_developer", {
        jsonrpc: "2.0",
        id: `dev-patch-failure-${index}`,
        method: "tools/call",
        params: {
          name: "dev_apply_patch",
          arguments: fixture.arguments,
          _meta: { actor: fixture.actor },
        },
      });
      assert.equal(failureResponse.error, undefined);
      assert.equal(failureResponse.result?.isError, true);
      assert.match(failureResponse.result.content[0].text, fixture.message);
    }

    const auditLogAfter = await readFile(auditLogPath);
    const appended = auditLogAfter.subarray(auditLogBefore.content.length).toString("utf8");
    const records = appended.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
    const record = records.find((item) => item.actor === "dev-wr-1-audit-test");
    assert(record, "dev_apply_patch did not append an MCP audit record");
    assert.equal(record.tool_name, "dev_apply_patch");
    assert.equal(record.risk, "low-risk-write");
    assert.equal(record.status, "completed");
    assert.equal(record.result?.is_error, false);
    assert(record.affected_paths.includes(projectRelative(auditFixturePath)));
    assert.equal(record.input_summary?.oldText?.sensitive_payload_preview_omitted, true);
    assert.equal(record.input_summary?.newText?.sensitive_payload_preview_omitted, true);
    assert.equal(Object.hasOwn(record.input_summary?.oldText ?? {}, "preview"), false);
    assert.equal(Object.hasOwn(record.input_summary?.newText ?? {}, "preview"), false);
    assert.equal(
      record.previous_version?.[projectRelative(auditFixturePath)]?.sha256,
      payload.before_sha256,
    );
    assert.equal(
      record.new_version?.[projectRelative(auditFixturePath)]?.sha256,
      payload.after_sha256,
    );

    const deleteRecord = records.find((item) => item.actor === "dev-wr-delete-audit-test");
    assert(deleteRecord, "dev_delete_file did not append an MCP audit record");
    assert.equal(deleteRecord.tool_name, "dev_delete_file");
    assert.equal(deleteRecord.risk, "low-risk-write");
    assert.equal(deleteRecord.status, "completed");
    assert.equal(deleteRecord.result?.is_error, false);
    assert(deleteRecord.affected_paths.includes(projectRelative(mcpDeletePath)));
    assert.equal(
      deleteRecord.previous_version?.[projectRelative(mcpDeletePath)]?.sha256,
      deletePayload.before_sha256,
    );
    assert.equal(
      deleteRecord.new_version?.[projectRelative(mcpDeletePath)]?.exists,
      false,
    );

    const createRecord = records.find((item) => item.actor === "dev-wr-create-audit-test");
    assert(createRecord, "dev_create_file did not append an MCP audit record");
    assert.equal(createRecord.tool_name, "dev_create_file");
    assert.equal(createRecord.risk, "low-risk-write");
    assert.equal(createRecord.status, "completed");
    assert(createRecord.affected_paths.includes(projectRelative(mcpCreatePath)));
    assert.equal(createRecord.input_summary?.content?.sensitive_payload_preview_omitted, true);
    assert.equal(Object.hasOwn(createRecord.input_summary?.content ?? {}, "preview"), false);
    assert.equal(
      createRecord.previous_version?.[projectRelative(mcpCreatePath)]?.exists,
      false,
    );
    assert.equal(
      createRecord.new_version?.[projectRelative(mcpCreatePath)]?.sha256,
      createPayload.sha256,
    );

    const createDirectoryRecord = records.find(
      (item) => item.actor === "dev-wr-create-directory-audit-test",
    );
    assert(createDirectoryRecord, "dev_create_directory did not append an MCP audit record");
    assert.equal(createDirectoryRecord.tool_name, "dev_create_directory");
    assert.equal(createDirectoryRecord.status, "completed");
    assert(createDirectoryRecord.affected_paths.includes(projectRelative(mcpCreateDirectoryPath)));
    assert.equal(
      createDirectoryRecord.previous_version?.[projectRelative(mcpCreateDirectoryPath)]?.exists,
      false,
    );
    assert.equal(
      createDirectoryRecord.new_version?.[projectRelative(mcpCreateDirectoryPath)]?.exists,
      true,
    );

    const moveRecord = records.find((item) => item.actor === "dev-wr-move-audit-test");
    assert(moveRecord, "dev_move_path did not append an MCP audit record");
    assert.equal(moveRecord.tool_name, "dev_move_path");
    assert.equal(moveRecord.status, "completed");
    assert(moveRecord.affected_paths.includes(projectRelative(mcpCreatePath)));
    assert(moveRecord.affected_paths.includes(projectRelative(mcpMovePath)));
    assert.equal(moveRecord.previous_version?.[projectRelative(mcpCreatePath)]?.exists, true);
    assert.equal(moveRecord.new_version?.[projectRelative(mcpCreatePath)]?.exists, false);
    assert.equal(moveRecord.previous_version?.[projectRelative(mcpMovePath)]?.exists, false);
    assert.equal(moveRecord.new_version?.[projectRelative(mcpMovePath)]?.sha256, movePayload.sha256);

    for (const fixture of mcpFailureFixtures) {
      const failureRecord = records.find((item) => item.actor === fixture.actor);
      assert(failureRecord, `missing failed audit record for ${fixture.actor}`);
      assert.equal(failureRecord.tool_name, "dev_apply_patch");
      assert.equal(failureRecord.risk, "low-risk-write");
      assert.equal(failureRecord.status, "tool_error");
      assert.equal(failureRecord.result?.is_error, true);
      assert.deepEqual(failureRecord.affected_paths, []);
    }
  } finally {
    if (auditLogBefore.exists) {
      await writeFile(auditLogPath, auditLogBefore.content);
    } else {
      await rm(auditLogPath, { force: true });
    }
    await removeNewDirectoryEntries(transactionDir, transactionsBefore);
    await removeNewDirectoryEntries(auditIntentDir, intentsBefore);
  }

  console.log("MCP development write security tests passed.");
  console.log("- exact replacement, hashes, and bounded payload: passed");
  console.log("- zero/multiple/stale/path/protected/secret/binary/oversized guards: passed");
  console.log("- external symlink or junction escape: passed");
  console.log("- CRLF preservation and empty newText deletion: passed");
  console.log("- atomic rollback/no partial write/no temp residue: passed");
  console.log("- developer-profile MCP audit record and redaction: passed");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  if (externalRoot) await rm(externalRoot, { recursive: true, force: true });
}
