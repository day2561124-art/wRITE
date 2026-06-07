import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const runsDir = path.join(rootDir, "data", "outputs", "runs");
const transactionDir = path.join(rootDir, "data", "outputs", "logs", "transactions");
const publishedPaths = [
  "data/outputs/current_prompt.md",
  "data/outputs/generation_context.md",
  "data/outputs/retrieval_context.md",
  "data/outputs/task_prompt.md",
].map((filePath) => path.join(rootDir, filePath));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function hash(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
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

function runFailureFixture() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "server/src/tools/run-pipeline.mjs",
      "--query",
      "atomic pipeline failure fixture",
      "--task",
      "This run must not publish.",
      "--mode",
      "debug",
      "--top",
      "2",
    ], {
      cwd: rootDir,
      env: { ...process.env, PIPELINE_TEST_FAIL_AFTER: "search" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function main() {
  const beforeHashes = await Promise.all(publishedPaths.map(hash));
  const beforeRuns = await optionalNames(runsDir);
  const transactionsBefore = await optionalNames(transactionDir);
  try {
    const result = await runFailureFixture();
    assert(result.code !== 0, "Injected pipeline failure unexpectedly succeeded.");
    assert(
      result.output.includes("Injected pipeline failure after search."),
      "Pipeline failure did not report the injected boundary.",
    );
    const afterHashes = await Promise.all(publishedPaths.map(hash));
    assert(
      JSON.stringify(afterHashes) === JSON.stringify(beforeHashes),
      "Failed pipeline changed one or more published outputs.",
    );
    const afterRuns = await optionalNames(runsDir);
    const createdRuns = [...afterRuns].filter((name) => !beforeRuns.has(name));
    assert(createdRuns.length === 1, `Expected one isolated failed run, got ${createdRuns.length}.`);
    const manifestPath = path.join(runsDir, createdRuns[0], "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert(manifest.status === "failed", "Failed pipeline manifest did not record failed status.");
  } finally {
    await removeNewEntries(runsDir, beforeRuns);
    await removeNewEntries(transactionDir, transactionsBefore);
  }
  console.log("Atomic pipeline failure test passed.");
}

main().catch((error) => {
  console.error(`Atomic pipeline failure test failed: ${error.message}`);
  process.exitCode = 1;
});
