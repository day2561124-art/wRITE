import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "ui-server.mjs");
const draftIndexPath = path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl");
const draftsDir = path.join(rootDir, "data", "outputs", "drafts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForHealth(baseUrl, child, stderrBuffer) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`UI server exited early (${child.exitCode}): ${stderrBuffer.value}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`UI server did not become healthy: ${stderrBuffer.value}`);
}

async function readJson(response) {
  const payload = await response.json();
  return { response, payload };
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const beforeIndex = await readFile(draftIndexPath, "utf8");
  const beforeDraftFiles = (await readdir(draftsDir)).sort();
  const stderrBuffer = { value: "" };
  const child = spawn(process.execPath, [
    serverPath,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer.value += chunk;
  });

  try {
    await waitForHealth(baseUrl, child, stderrBuffer);

    const indexResponse = await fetch(`${baseUrl}/`);
    const indexText = await indexResponse.text();
    assert(indexResponse.ok, "UI index did not return 200.");
    assert(indexText.includes("武裝學院工作台"), "UI index is missing the application title.");
    assert(indexText.includes('data-view-panel="compose"'), "UI index is missing the compose workspace.");

    const appResponse = await fetch(`${baseUrl}/app.js`);
    const appText = await appResponse.text();
    assert(appResponse.ok && appText.includes("handlePipeline"), "UI app.js was not served.");
    assert(appText.includes('addEventListener("hashchange"'), "UI hash routing is not synchronized.");

    const stateResult = await readJson(await fetch(`${baseUrl}/api/state`));
    assert(stateResult.response.ok && stateResult.payload.ok, "State API failed.");
    const sources = stateResult.payload.state.sources;
    assert(sources.length === 5, `Expected 5 source cards, got ${sources.length}.`);
    assert(
      sources.find((source) => source.key === "active_proofing_card")?.trust === "T3",
      "Proofing source was not exposed as T3.",
    );
    assert(
      sources.find((source) => source.key === "active_longline")?.trust === "T3",
      "Longline source was not exposed as T3.",
    );

    const proofingResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("data/proofing_policy_db/active_proofing_card.md")}`,
    ));
    assert(proofingResult.response.ok, "Allowed proofing file read failed.");
    assert(
      proofingResult.payload.file.text.includes("正式驗稿卡母檔 v1.1"),
      "Allowed proofing file read returned unexpected content.",
    );

    const traversalResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("data/outputs/drafts/../../../SKILL.md")}`,
    ));
    assert(traversalResult.response.status === 403, "Path traversal was not rejected.");

    const unknownResult = await readJson(await fetch(`${baseUrl}/api/actions/not-real`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    assert(unknownResult.response.status === 404, "Unknown UI action was not rejected.");

    const invalidResult = await readJson(await fetch(`${baseUrl}/api/actions/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test", task: "test", mode: "invalid" }),
    }));
    assert(invalidResult.response.status === 400, "Invalid UI action input did not return 400.");

    const trustResult = await readJson(await fetch(`${baseUrl}/api/actions/sourceTrust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    assert(trustResult.response.ok && trustResult.payload.result.ok, "Source trust UI action failed.");
    const trustReport = JSON.parse(trustResult.payload.result.stdout);
    assert(trustReport.checked_sources === 15, "Source trust UI action checked the wrong source count.");

    const dryRunResult = await readJson(await fetch(`${baseUrl}/api/actions/saveDraft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "UI contract dry run",
        chapter: "TEST",
        text: "This dry run must not write a draft.",
        dryRun: true,
      }),
    }));
    assert(dryRunResult.response.ok && dryRunResult.payload.result.ok, "Draft dry-run UI action failed.");
    assert(
      dryRunResult.payload.result.stdout.includes("Dry run: no files written."),
      "Draft dry-run UI action did not report dry-run completion.",
    );

    const afterIndex = await readFile(draftIndexPath, "utf8");
    const afterDraftFiles = (await readdir(draftsDir)).sort();
    assert(afterIndex === beforeIndex, "Draft dry-run changed draft_index.jsonl.");
    assert(
      JSON.stringify(afterDraftFiles) === JSON.stringify(beforeDraftFiles),
      "Draft dry-run created or removed a draft file.",
    );

    console.log("UI server contract tests passed.");
    console.log(`- Static application served: yes`);
    console.log(`- Source status cards checked: ${sources.length}`);
    console.log("- Allowed project file read checked: yes");
    console.log("- Path traversal rejected: yes");
    console.log("- Unknown action rejected: yes");
    console.log("- Invalid action input rejected: yes");
    console.log(`- Source trust records checked through UI: ${trustReport.checked_sources}`);
    console.log("- Draft dry-run side effects: none");
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(`UI server contract tests failed: ${error.message}`);
  process.exitCode = 1;
});
