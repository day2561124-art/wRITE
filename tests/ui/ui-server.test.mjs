import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createConnection, createServer } from "node:net";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "ui-server.mjs");
const draftIndexPath = path.join(rootDir, "data", "outputs", "logs", "draft_index.jsonl");
const draftsDir = path.join(rootDir, "data", "outputs", "drafts");
const visualIndexPath = path.join(rootDir, "data", "visual_db", "visual_index.jsonl");
const agentRunsDir = path.join(rootDir, "data", "agent_runs");
const neuralTracesDir = path.join(agentRunsDir, "neural_traces");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

function rawHttpStatus(port, pathName, method = "GET", body = "") {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      const bodyBytes = Buffer.byteLength(body);
      socket.write([
        `${method} ${pathName} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        ...(body ? ["Content-Type: application/json", `Content-Length: ${bodyBytes}`] : []),
        "Connection: close",
        "",
        body,
      ].join("\r\n"));
    });
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => { data += chunk; });
    socket.on("end", () => {
      const status = Number.parseInt(data.match(/^HTTP\/1\.1 (\d+)/u)?.[1] ?? "", 10);
      resolve({ status, raw: data });
    });
    socket.on("error", reject);
  });
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function readOptionalDirectory(dirPath) {
  try {
    return (await readdir(dirPath)).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const beforeIndex = await readOptionalText(draftIndexPath);
  const beforeDraftFiles = await readOptionalDirectory(draftsDir);
  const beforeVisualIndex = await readOptionalText(visualIndexPath);
  const activeEngineBefore = await readFile(activeEnginePath);
  const activeEngineHashBefore = createHash("sha256").update(activeEngineBefore).digest("hex");
  const createdVisualAssetPaths = [];
  const createdAgentRunIds = [];
  const createdNeuralTraceIds = [];
  const createdCandidateIds = [];
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
    assert(indexText.includes('data-view-panel="visuals"'), "UI index is missing the visual gallery workspace.");
    assert(indexText.includes('data-view-panel="neural"'), "UI index is missing the neural status workspace.");
    assert(indexText.includes('data-view-panel="settlement"'), "UI index is missing the settlement workspace.");
    assert(indexText.includes("神經網路模組狀態"), "UI index is missing the neural status heading.");
    assert(indexText.includes('id="settlement-import-form"'), "UI index is missing the settlement import form.");
    assert(indexText.includes('id="visual-upload-form"'), "UI index is missing the visual upload form.");

    const appResponse = await fetch(`${baseUrl}/app.js`);
    const appText = await appResponse.text();
    assert(appResponse.ok && appText.includes("handlePipeline"), "UI app.js was not served.");
    assert(appText.includes("handleVisualUpload"), "UI app.js is missing the visual upload handler.");
    assert(appText.includes("handleVisualDelete"), "UI app.js is missing the visual delete handler.");
    assert(appText.includes("renderNeuralStatus"), "UI app.js is missing the neural status renderer.");
    assert(appText.includes("handleSettlementImport"), "UI app.js is missing the settlement import handler.");
    assert(appText.includes("renderRiskReport"), "UI app.js is missing the risk report renderer.");
    assert(appText.includes("renderDiff"), "UI app.js is missing the diff renderer.");
    assert(appText.includes('addEventListener("hashchange"'), "UI hash routing is not synchronized.");
    const stylesResponse = await fetch(`${baseUrl}/styles.css`);
    const stylesText = await stylesResponse.text();
    assert(stylesResponse.ok && stylesText.includes(".risk-critical"), "UI styles are missing risk-critical.");

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
    const visuals = stateResult.payload.state.visuals;
    assert(visuals && visuals.indexPath === "data/visual_db/visual_index.jsonl", "State API did not expose visual index metadata.");
    assert(Array.isArray(visuals.items), "State API visual items are not an array.");
    assert(visuals.categories.length >= 4, "State API visual categories were not exposed.");

    const visualsResult = await readJson(await fetch(`${baseUrl}/api/visuals`));
    assert(visualsResult.response.ok && visualsResult.payload.ok, "Visuals API failed.");
    assert(
      visualsResult.payload.visuals.indexPath === "data/visual_db/visual_index.jsonl",
      "Visuals API returned the wrong index path.",
    );

    const createRunResult = await readJson(await fetch(`${baseUrl}/api/agent/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: "test",
        requires_neural_modules: true,
        required_neural_modules: ["scene_planner"],
        input: "UI API text says 已使用神經網路模型, but no trace exists yet.",
      }),
    }));
    assert(createRunResult.response.status === 201, "Agent run creation API failed.");
    const apiRunId = createRunResult.payload.run.run_id;
    createdAgentRunIds.push(apiRunId);

    const runsApiResult = await readJson(await fetch(`${baseUrl}/api/agent/runs`));
    assert(
      runsApiResult.response.ok && runsApiResult.payload.runs.some((run) => run.run_id === apiRunId),
      "Agent runs API did not include the created run.",
    );
    const runApiResult = await readJson(await fetch(`${baseUrl}/api/agent/runs/${apiRunId}`));
    assert(runApiResult.response.ok, "Agent run detail API failed.");
    assert(
      runApiResult.payload.run.neural_usage.used_neural_network === false,
      "Text-only neural claim incorrectly counted as neural usage.",
    );

    const neuralCallResult = await readJson(await fetch(`${baseUrl}/api/neural/scene-planner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_id: apiRunId,
        task_type: "test",
        input: "Plan a test scene.",
      }),
    }));
    assert(neuralCallResult.response.ok, "Neural wrapper API failed.");
    const apiTrace = neuralCallResult.payload.result.trace;
    createdNeuralTraceIds.push(apiTrace.trace_id);
    assert(apiTrace.status === "skipped", "Missing local adapter was not reported as skipped.");
    assert(apiTrace.status !== "success", "Missing local adapter produced a false success trace.");

    const tracesApiResult = await readJson(await fetch(`${baseUrl}/api/neural/traces?run_id=${apiRunId}`));
    assert(
      tracesApiResult.response.ok
        && tracesApiResult.payload.traces.some((trace) => trace.trace_id === apiTrace.trace_id),
      "Neural traces API did not include the wrapper trace.",
    );
    const traceApiResult = await readJson(await fetch(`${baseUrl}/api/neural/traces/${apiTrace.trace_id}`));
    assert(traceApiResult.response.ok, "Neural trace detail API failed.");
    const usageApiResult = await readJson(await fetch(`${baseUrl}/api/agent/runs/${apiRunId}/neural-usage`));
    assert(usageApiResult.response.ok, "Neural usage API failed.");
    assert(
      usageApiResult.payload.usage.used_neural_network === false,
      "Skipped trace incorrectly counted as neural network usage.",
    );
    assert(
      usageApiResult.payload.usage.warning === true
        && usageApiResult.payload.usage.missing_required_neural_modules.includes("scene_planner"),
      "Required module without a success trace was not reported as warning.",
    );
    const invalidRunApiResult = await readJson(await fetch(`${baseUrl}/api/agent/runs/${encodeURIComponent("../bad")}`));
    assert(invalidRunApiResult.response.status === 400, "Invalid API run_id was not rejected.");

    const activeStatusResult = await readJson(await fetch(`${baseUrl}/api/canon/active-engine/status`));
    assert(activeStatusResult.response.ok, "Active engine status API failed.");
    assert(
      activeStatusResult.payload.active_engine.active_engine_hash === activeEngineHashBefore,
      "Active engine status API returned the wrong hash.",
    );
    const activeText = activeEngineBefore.toString("utf8").replace(/\s+$/u, "");
    const settlementRaw = [
      "## 新版完整創作引擎候選",
      "",
      "```md",
      activeText,
      "UI 合約新增規則：維持正式承接一致。",
      "```",
    ].join("\n");
    const importCandidateResult = await readJson(await fetch(`${baseUrl}/api/canon/settlement/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChapter: "UI 合約測試章",
        note: "Phase 2 API fixture",
        rawText: settlementRaw,
      }),
    }));
    assert(importCandidateResult.response.status === 201, "Settlement import API failed.");
    const apiCandidateId = importCandidateResult.payload.candidate.metadata.candidate_id;
    createdCandidateIds.push(apiCandidateId);
    assert(
      importCandidateResult.payload.candidate.status.status === "candidate",
      "Valid settlement import did not create candidate status.",
    );
    assert(
      importCandidateResult.payload.candidate.status.can_activate === false,
      "Phase 2 import exposed can_activate=true.",
    );

    const candidatesResult = await readJson(await fetch(`${baseUrl}/api/canon/pending-candidates`));
    assert(
      candidatesResult.response.ok
        && candidatesResult.payload.candidates.some((item) => item.candidate_id === apiCandidateId),
      "Pending candidate list omitted the imported candidate.",
    );
    const candidateDetailResult = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}`,
    ));
    assert(candidateDetailResult.response.ok, "Pending candidate detail API failed.");
    assert(candidateDetailResult.payload.candidate.diff?.raw_unified_diff, "Candidate diff was not returned.");

    const reparseResult = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}/reparse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(reparseResult.response.ok, "Candidate reparse API failed.");
    assert(reparseResult.payload.candidate.metadata.reparsed_at, "Candidate reparse timestamp missing.");

    const activateResult = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}/activate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(
      activateResult.response.status === 501
        && activateResult.payload.error === "not_implemented_in_phase_2",
      "Phase 2 activate API was not blocked.",
    );

    for (const unsafePath of [
      "/api/canon/pending-candidates/../active_engine.md",
      "/api/canon/pending-candidates/engine_candidate_../../active_engine.md",
      "/api/canon/pending-candidates/%2e%2e%2factive_engine.md",
    ]) {
      const unsafeResult = await rawHttpStatus(port, unsafePath);
      assert(
        unsafeResult.status >= 400 && unsafeResult.status < 500,
        `Candidate traversal path was not rejected: ${unsafePath}`,
      );
    }
    const unsafeReparse = await rawHttpStatus(
      port,
      "/api/canon/pending-candidates/%2e%2e%2factive_engine.md/reparse",
      "POST",
      "{}",
    );
    assert(unsafeReparse.status >= 400 && unsafeReparse.status < 500, "Unsafe reparse path was accepted.");
    const unsafeReject = await rawHttpStatus(
      port,
      "/api/canon/pending-candidates/%2e%2e%2factive_engine.md/reject",
      "POST",
      "{}",
    );
    assert(unsafeReject.status >= 400 && unsafeReject.status < 500, "Unsafe reject path was accepted.");

    const rejectResult = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "UI contract complete" }),
      },
    ));
    assert(rejectResult.response.ok, "Candidate reject API failed.");
    assert(rejectResult.payload.candidate.status.status === "rejected", "Candidate was not rejected.");
    assert(
      rejectResult.payload.candidate.status.rejection_reason === "UI contract complete",
      "Candidate rejection reason was not preserved.",
    );
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex") === activeEngineHashBefore,
      "Canon candidate APIs changed active_engine.md.",
    );

    const proofingResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("data/proofing_policy_db/active_proofing_card.md")}`,
    ));
    assert(proofingResult.response.ok, "Allowed proofing file read failed.");
    assert(
      proofingResult.payload.file.text.includes("正式驗稿卡母檔 v1.1"),
      "Allowed proofing file read returned unexpected content.",
    );

    const visualReadmeResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("data/visual_db/README.md")}`,
    ));
    assert(visualReadmeResult.response.ok, "Allowed visual DB README read failed.");
    assert(
      visualReadmeResult.payload.file.text.includes("Visual Reference DB"),
      "Allowed visual DB README returned unexpected content.",
    );

    const traversalResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("data/outputs/drafts/../../../SKILL.md")}`,
    ));
    assert(traversalResult.response.status === 403, "Path traversal was not rejected.");

    const directTraversalResult = await readJson(await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent("../README.md")}`,
    ));
    assert(directTraversalResult.response.status === 403, "Direct project escape was not rejected.");

    const visualTraversalResult = await rawHttpStatus(port, "/visual-assets/%2e%2e/README.md");
    assert(visualTraversalResult.status === 403, "Visual asset traversal was not rejected.");

    const visualTypeResult = await readJson(await fetch(`${baseUrl}/visual-assets/characters/not-image.txt`));
    assert(visualTypeResult.response.status === 403, "Visual asset type restriction was not enforced.");

    const dryRunVisualUpload = await readJson(await fetch(`${baseUrl}/api/visuals/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "ui-upload-dry-run.png",
        mimeType: "image/png",
        dataBase64: tinyPngBase64,
        character: "UI測試角色",
        title: "UI contract dry-run visual",
        category: "character_design",
        tags: "測試, 人設",
        dryRun: true,
      }),
    }));
    assert(dryRunVisualUpload.response.ok, "Visual upload dry-run failed.");
    assert(dryRunVisualUpload.payload.upload.dryRun === true, "Visual upload dry-run did not report dryRun=true.");
    assert(
      dryRunVisualUpload.payload.upload.record.path.startsWith("data/visual_db/assets/characters/"),
      "Visual upload dry-run chose the wrong asset folder.",
    );

    const visualUpload = await readJson(await fetch(`${baseUrl}/api/visuals/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "ui-upload.png",
        mimeType: "image/png",
        dataBase64: tinyPngBase64,
        character: "UI測試角色",
        title: "UI contract uploaded visual",
        category: "armed_form",
        notes: "Visual-only test upload; does not establish ability mechanics.",
        tags: ["測試", "異能武裝"],
      }),
    }));
    assert(visualUpload.response.ok, "Visual upload failed.");
    const uploadedRecord = visualUpload.payload.upload.record;
    createdVisualAssetPaths.push(uploadedRecord.path);
    assert(
      String(visualUpload.payload.upload.transactionId ?? "").startsWith("TX-"),
      "Visual upload did not report a transaction id.",
    );
    assert(uploadedRecord.canon_status === "reference", "Visual upload must default to reference status.");
    assert(uploadedRecord.trust_level === "T7", "Visual upload must default to T7 trust.");
    assert(uploadedRecord.source === "user_imported", "Visual upload source must be user_imported.");
    assert(
      (await readOptionalText(visualIndexPath)).includes(uploadedRecord.visual_id),
      "Visual upload did not append to visual_index.jsonl.",
    );
    const uploadedItem = visualUpload.payload.visuals.items.find((item) => item.visual_id === uploadedRecord.visual_id);
    assert(uploadedItem?.assetUrl, "Visual upload response did not expose an asset URL.");
    const uploadedAssetResponse = await fetch(`${baseUrl}${uploadedItem.assetUrl}`);
    assert(uploadedAssetResponse.ok, "Uploaded visual asset was not served.");
    assert(
      uploadedAssetResponse.headers.get("content-type")?.startsWith("image/png"),
      "Uploaded visual asset used the wrong content type.",
    );

    const unconfirmedVisualDelete = await readJson(await fetch(`${baseUrl}/api/visuals/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visualId: uploadedRecord.visual_id,
        deleteAsset: true,
        confirmDelete: false,
      }),
    }));
    assert(unconfirmedVisualDelete.response.status === 400, "Unconfirmed visual delete was not rejected.");

    const visualDelete = await readJson(await fetch(`${baseUrl}/api/visuals/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visualId: uploadedRecord.visual_id,
        deleteAsset: true,
        confirmDelete: true,
      }),
    }));
    assert(visualDelete.response.ok, "Visual delete failed.");
    assert(
      String(visualDelete.payload.deleted.transactionId ?? "").startsWith("TX-"),
      "Visual delete did not report a transaction id.",
    );
    assert(visualDelete.payload.deleted.assetDeleted === true, "Visual delete did not remove the asset file.");
    assert(
      !(await readOptionalText(visualIndexPath)).includes(uploadedRecord.visual_id),
      "Visual delete did not remove the index record.",
    );
    assert(
      !visualDelete.payload.visuals.items.some((item) => item.visual_id === uploadedRecord.visual_id),
      "Visual delete response still included the deleted record.",
    );
    const deletedAssetResponse = await fetch(`${baseUrl}${uploadedItem.assetUrl}`);
    assert(deletedAssetResponse.status === 404, "Deleted visual asset was still served.");

    const invalidVisualUpload = await readJson(await fetch(`${baseUrl}/api/visuals/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "ui-upload.png",
        mimeType: "image/png",
        dataBase64: "not-valid-image-data",
        character: "UI測試角色",
        title: "Invalid visual",
        category: "character_design",
      }),
    }));
    assert(invalidVisualUpload.response.status === 400, "Invalid visual upload was not rejected.");

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

    const afterIndex = await readOptionalText(draftIndexPath);
    const afterDraftFiles = await readOptionalDirectory(draftsDir);
    assert(afterIndex === beforeIndex, "Draft dry-run changed draft_index.jsonl.");
    assert(
      JSON.stringify(afterDraftFiles) === JSON.stringify(beforeDraftFiles),
      "Draft dry-run created or removed a draft file.",
    );

    console.log("UI server contract tests passed.");
    console.log(`- Static application served: yes`);
    console.log(`- Source status cards checked: ${sources.length}`);
    console.log(`- Visual gallery records checked: ${visuals.items.length}`);
    console.log("- Allowed project file read checked: yes");
    console.log("- Path traversal rejected: yes");
    console.log("- Visual upload checked: yes");
    console.log("- Visual delete checked: yes");
    console.log("- Agent run and neural trace APIs checked: yes");
    console.log("- Pending candidate import, diff, risk, reparse, and reject APIs checked: yes");
    console.log("- Phase 2 active engine activation blocked: yes");
    console.log("- Unknown action rejected: yes");
    console.log("- Invalid action input rejected: yes");
    console.log(`- Source trust records checked through UI: ${trustReport.checked_sources}`);
    console.log("- Draft dry-run side effects: none");
  } finally {
    await writeFile(visualIndexPath, beforeVisualIndex, "utf8");
    await Promise.all(createdVisualAssetPaths.map((projectPath) => (
      rm(path.join(rootDir, projectPath), { force: true })
    )));
    await Promise.all(createdAgentRunIds.map((runId) => (
      rm(path.join(agentRunsDir, runId), { recursive: true, force: true })
    )));
    await Promise.all(createdNeuralTraceIds.map((traceId) => (
      rm(path.join(neuralTracesDir, `${traceId}.json`), { force: true })
    )));
    await Promise.all(createdCandidateIds.map((candidateId) => (
      rm(path.join(pendingCandidatesDir, candidateId), { recursive: true, force: true })
    )));
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex") === activeEngineHashBefore,
      "active_engine.md changed during UI test cleanup.",
    );
    terminateProcessTree(child);
  }
}

main().catch((error) => {
  console.error(`UI server contract tests failed: ${error.message}`);
  process.exitCode = 1;
});
