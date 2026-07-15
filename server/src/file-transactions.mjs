import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

const lockDir = path.join(projectPaths.outputLogs, "locks");
const lockPath = path.join(lockDir, "project-write.lock");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const lockTimeoutMs = 15_000;
const staleLockMs = 10 * 60 * 1000;
const transientRenameErrors = new Set(["EACCES", "EBUSY", "EPERM"]);

async function renameWithRetry(source, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      if (!transientRenameErrors.has(error.code) || attempt >= 7) throw error;
      await delay(10 * (attempt + 1));
    }
  }
}

async function readOptionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function acquireProjectLock(transactionId) {
  await mkdir(lockDir, { recursive: true });
  const deadline = Date.now() + lockTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({
        transaction_id: transactionId,
        pid: process.pid,
        acquired_at: new Date().toISOString(),
      }));
      return handle;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const lockStats = await stat(lockPath);
        if (Date.now() - lockStats.mtimeMs > staleLockMs) {
          await rm(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code !== "ENOENT") throw statError;
      }
      await delay(50);
    }
  }
  throw new Error("Could not acquire the project write lock within 15 seconds.");
}

async function releaseProjectLock(handle) {
  try {
    await handle.close();
  } finally {
    await rm(lockPath, { force: true });
  }
}

function operationContent(operation, previous) {
  if (operation.type === "delete") return null;
  const content = Buffer.isBuffer(operation.content)
    ? operation.content
    : Buffer.from(String(operation.content ?? ""), operation.encoding ?? "utf8");
  return operation.type === "append"
    ? Buffer.concat([previous.content, content])
    : content;
}

async function atomicWriteUnlogged(filePath, content, transactionId, suffix) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${transactionId}.${suffix}.tmp`,
  );
  await writeFile(tempPath, content, { flag: "wx" });
  await renameWithRetry(tempPath, filePath);
}

function transactionDirectoryFor(metadata = {}) {
  if (!metadata.test_transaction_dir) return transactionDir;
  return assertPathInside(
    metadata.test_transaction_dir,
    path.join(projectRoot, "tests", ".tmp"),
    "test transaction directory",
  );
}

async function writeManifest(manifest, targetDirectory = transactionDir) {
  await mkdir(targetDirectory, { recursive: true });
  const manifestPath = path.join(targetDirectory, `${manifest.transaction_id}.json`);
  await atomicWriteUnlogged(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    manifest.transaction_id,
    "manifest",
  );
}

export function createTransactionId() {
  return `TX-${new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function commitFileTransaction(name, operations, metadata = {}) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("A file transaction requires at least one operation.");
  }

  const transactionId = metadata.transaction_id || createTransactionId();
  const manifestDirectory = transactionDirectoryFor(metadata);
  const normalizedOperations = operations.map((operation) => ({
    ...operation,
    type: operation.type ?? "write",
    filePath: resolveProjectPath(operation.filePath, `${name} target`),
  }));
  const uniquePaths = new Set(normalizedOperations.map((operation) => operation.filePath));
  if (uniquePaths.size !== normalizedOperations.length) {
    throw new Error(`${name} contains duplicate transaction targets.`);
  }
  for (const operation of normalizedOperations) {
    if (!["write", "append", "delete"].includes(operation.type)) {
      throw new Error(`Unsupported transaction operation: ${operation.type}`);
    }
  }

  const lockHandle = await acquireProjectLock(transactionId);
  const startedAt = new Date();
  const prepared = [];
  const committed = [];
  try {
    for (const [index, operation] of normalizedOperations.entries()) {
      const previous = await readOptionalBuffer(operation.filePath);
      const nextContent = operationContent(operation, previous);
      let tempPath = "";
      if (nextContent !== null) {
        await mkdir(path.dirname(operation.filePath), { recursive: true });
        tempPath = path.join(
          path.dirname(operation.filePath),
          `.${path.basename(operation.filePath)}.${transactionId}.${index}.tmp`,
        );
        await writeFile(tempPath, nextContent, { flag: "wx" });
      }
      prepared.push({ ...operation, previous, nextContent, tempPath });
    }

    for (const item of prepared) {
      if (item.type === "delete") {
        await rm(item.filePath, { force: true });
      } else {
        await renameWithRetry(item.tempPath, item.filePath);
      }
      committed.push(item);
      if (
        process.env.FILE_TRANSACTION_TEST_MODE === "1"
        && Number(metadata.test_fail_after_commits) === committed.length
      ) {
        throw new Error(`Injected transaction failure after ${committed.length} commit(s).`);
      }
    }

    const manifest = {
      transaction_id: transactionId,
      name,
      status: "committed",
      pid: process.pid,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      affected_paths: prepared.map((item) => normalizeProjectPath(item.filePath)),
      operations: prepared.map((item) => ({
        type: item.type,
        path: normalizeProjectPath(item.filePath),
        previous_exists: item.previous.exists,
        previous_bytes: item.previous.content.length,
        next_bytes: item.nextContent?.length ?? 0,
      })),
      metadata: Object.fromEntries(
        Object.entries(metadata).filter(([key]) => !key.startsWith("test_")),
      ),
      rollback_available: true,
    };
    await writeManifest(manifest, manifestDirectory);
    return manifest;
  } catch (error) {
    const rollbackErrors = [];
    for (const item of committed.reverse()) {
      try {
        if (item.previous.exists) {
          await atomicWriteUnlogged(
            item.filePath,
            item.previous.content,
            transactionId,
            "rollback",
          );
        } else {
          await rm(item.filePath, { force: true });
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${normalizeProjectPath(item.filePath)}: ${rollbackError.message}`);
      }
    }
    for (const item of prepared) {
      if (item.tempPath) await rm(item.tempPath, { force: true });
    }
    try {
      await writeManifest({
        transaction_id: transactionId,
        name,
        status: rollbackErrors.length === 0 ? "rolled_back" : "rollback_failed",
        pid: process.pid,
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        affected_paths: prepared.map((item) => normalizeProjectPath(item.filePath)),
        metadata: Object.fromEntries(
          Object.entries(metadata).filter(([key]) => !key.startsWith("test_")),
        ),
        error: error.message,
        rollback_errors: rollbackErrors,
        rollback_available: rollbackErrors.length === 0,
      }, manifestDirectory);
    } catch {
      // Preserve the original transaction failure.
    }
    if (rollbackErrors.length > 0) {
      throw new Error(`${error.message}; rollback failed: ${rollbackErrors.join("; ")}`);
    }
    throw error;
  } finally {
    for (const item of prepared) {
      if (item.tempPath) await rm(item.tempPath, { force: true });
    }
    await releaseProjectLock(lockHandle);
  }
}

export async function atomicWriteFile(filePath, content, metadata = {}) {
  return commitFileTransaction("atomic-write", [
    { type: "write", filePath, content },
  ], metadata);
}

export async function atomicAppendFile(filePath, content, metadata = {}) {
  return commitFileTransaction("atomic-append", [
    { type: "append", filePath, content },
  ], metadata);
}
