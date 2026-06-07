import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitFileTransaction } from "../../server/src/file-transactions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const testDir = path.join(rootDir, "data", "outputs", ".transaction-test");
const transactionDir = path.join(rootDir, "data", "outputs", "logs", "transactions");
const firstPath = path.join(testDir, "first.txt");
const secondPath = path.join(testDir, "second.txt");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function optionalNames(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewEntries(dirPath, before) {
  for (const name of await optionalNames(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

async function main() {
  await rm(testDir, { recursive: true, force: true });
  const transactionsBefore = await optionalNames(transactionDir);
  try {
    await mkdir(testDir, { recursive: true });
    await writeFile(firstPath, "original\n", "utf8");
    process.env.FILE_TRANSACTION_TEST_MODE = "1";
    let failed = false;
    try {
      await commitFileTransaction("rollback-contract-test", [
        { type: "write", filePath: firstPath, content: "first\n" },
        { type: "write", filePath: secondPath, content: "second\n" },
      ], { test_fail_after_commits: 1 });
    } catch (error) {
      failed = error.message.includes("Injected transaction failure");
    } finally {
      delete process.env.FILE_TRANSACTION_TEST_MODE;
    }
    assert(failed, "Injected transaction failure was not observed.");
    assert(await exists(firstPath), "Pre-existing file disappeared during rollback.");
    assert(await readFile(firstPath, "utf8") === "original\n", "Pre-existing file content was not restored.");
    assert(!(await exists(secondPath)), "Second staged file escaped rollback.");
  } finally {
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    await rm(testDir, { recursive: true, force: true });
    await removeNewEntries(transactionDir, transactionsBefore);
  }
  console.log("File transaction rollback test passed.");
}

main().catch((error) => {
  console.error(`File transaction rollback test failed: ${error.message}`);
  process.exitCode = 1;
});
