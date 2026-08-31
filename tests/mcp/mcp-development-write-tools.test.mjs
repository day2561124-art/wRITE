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
  dev_apply_patch,
} from "../../server/src/mcp-development-write-tools.mjs";

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

try {
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
    /exceeds the 262144-byte patch limit/u,
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
