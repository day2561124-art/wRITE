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
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const writingCardPath = path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md");
const proofingCardPath = path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md");
const feedbackLoopDir = path.join(rootDir, "data", "feedback_loop");
const backupsDir = path.join(rootDir, "data", "backups");
const currentPromptPath = path.join(rootDir, "data", "outputs", "current_prompt.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const engineSnapshotsDir = path.join(rootDir, "data", "canon_db", "engine_snapshots");
const engineArchiveDir = path.join(rootDir, "data", "canon_db", "archive");
const activationLogPath = path.join(rootDir, "data", "canon_db", "activation_logs", "activation_log.jsonl");
const rollbackIndexPath = path.join(rootDir, "data", "canon_db", "rollback", "rollback_index.json");
const writingWorkflowDir = path.join(rootDir, "data", "writing_workflow");
const workflowDraftsDir = path.join(writingWorkflowDir, "candidate_drafts");
const workflowProofsDir = path.join(writingWorkflowDir, "proof_reports");
const workflowAdoptedDir = path.join(writingWorkflowDir, "adopted_chapters");
const workflowContextsDir = path.join(writingWorkflowDir, "context_bundles");
const workflowSettlementContextsDir = path.join(writingWorkflowDir, "settlements", "contexts");
const workflowSettlementReportsDir = path.join(writingWorkflowDir, "settlements", "reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "logs", "approval_log.jsonl");
const cleanupProposalsDir = path.join(rootDir, "data", "cleanup", "proposals");
const cleanupTrashDir = path.join(rootDir, "data", "cleanup", "trash");
const cleanupTombstonesDir = path.join(rootDir, "data", "cleanup", "tombstones");
const cleanupLogPath = path.join(rootDir, "data", "cleanup", "logs", "cleanup_log.jsonl");
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

async function readOptionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
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
  const compressedRulesBefore = await readOptionalBuffer(compressedRulesPath);
  const writingCardBefore = await readOptionalBuffer(writingCardPath);
  const proofingCardBefore = await readOptionalBuffer(proofingCardPath);
  const feedbackLoopBefore = new Set(await readOptionalDirectory(feedbackLoopDir));
  const backupsBefore = new Set(await readOptionalDirectory(backupsDir));
  const currentPromptBefore = await readOptionalBuffer(currentPromptPath);
  const snapshotsBefore = new Set(await readOptionalDirectory(engineSnapshotsDir));
  const archiveBefore = new Set(await readOptionalDirectory(engineArchiveDir));
  const activationLogBefore = await readOptionalBuffer(activationLogPath);
  const rollbackIndexBefore = await readOptionalBuffer(rollbackIndexPath);
  const workflowDraftsBefore = new Set(await readOptionalDirectory(workflowDraftsDir));
  const workflowProofsBefore = new Set(await readOptionalDirectory(workflowProofsDir));
  const workflowAdoptedBefore = new Set(await readOptionalDirectory(workflowAdoptedDir));
  const workflowContextsBefore = new Set(await readOptionalDirectory(workflowContextsDir));
  const workflowSettlementContextsBefore = new Set(
    await readOptionalDirectory(workflowSettlementContextsDir),
  );
  const workflowSettlementReportsBefore = new Set(
    await readOptionalDirectory(workflowSettlementReportsDir),
  );
  const approvalItemsBefore = new Set(await readOptionalDirectory(approvalItemsDir));
  const approvalLogBefore = await readOptionalBuffer(approvalLogPath);
  const cleanupProposalsBefore = new Set(await readOptionalDirectory(cleanupProposalsDir));
  const cleanupTrashBefore = new Set(await readOptionalDirectory(cleanupTrashDir));
  const cleanupTombstonesBefore = new Set(await readOptionalDirectory(cleanupTombstonesDir));
  const cleanupLogBefore = await readOptionalBuffer(cleanupLogPath);
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
    assert(indexText.includes('data-view-panel="approval"'), "UI index is missing the approval workspace.");
    assert(indexText.includes('data-view-panel="cleanup"'), "UI index is missing the cleanup workspace.");
    assert(indexText.includes("神經網路模組狀態"), "UI index is missing the neural status heading.");
    assert(indexText.includes('id="settlement-import-form"'), "UI index is missing the settlement import form.");
    assert(indexText.includes('id="workflow-task-form"'), "UI index is missing the draft workflow task form.");
    assert(indexText.includes('id="workflow-draft-list"'), "UI index is missing candidate_draft management.");
    assert(indexText.includes('id="proof-level-summary"'), "UI index is missing P0-P4 proof summary.");
    assert(indexText.includes('id="workflow-adopt-button"'), "UI index is missing draft adoption.");
    assert(
      indexText.includes('id="create-settlement-context-button"'),
      "UI index is missing settlement context creation.",
    );
    assert(
      indexText.includes('id="workflow-settlement-report-form"'),
      "UI index is missing settlement report creation.",
    );
    assert(
      indexText.includes('id="create-workflow-pending-candidate-button"'),
      "UI index is missing Phase 4B pending candidate creation.",
    );
    assert(
      indexText.includes("active_engine 啟用仍需 Phase 3 人工確認"),
      "UI index is missing the Phase 4B activation boundary.",
    );
    assert(indexText.includes('id="scan-approval-queue-button"'), "UI index is missing approval scan.");
    assert(indexText.includes('id="approval-item-list"'), "UI index is missing approval item list.");
    assert(indexText.includes('id="scan-cleanup-button"'), "UI index is missing cleanup scan.");
    assert(
      indexText.includes('id="create-cleanup-proposal-button"'),
      "UI index is missing cleanup proposal creation.",
    );
    assert(
      indexText.includes('id="cleanup-execute-button"'),
      "UI index is missing cleanup execution control.",
    );
    assert(
      indexText.includes("不會永久刪除"),
      "UI index is missing the no-permanent-delete boundary.",
    );
    assert(
      indexText.includes('id="approval-second-confirm-checkbox"'),
      "UI index is missing high-risk approval checkbox.",
    );
    assert(
      indexText.includes('id="approval-confirm-text"'),
      "UI index is missing high-risk approval text.",
    );
    assert(indexText.includes('id="candidate-activate-button"'), "UI index is missing the activation button.");
    assert(indexText.includes('id="candidate-second-confirm-panel"'), "UI index is missing high-risk confirmation.");
    assert(indexText.includes('id="snapshot-list"'), "UI index is missing the snapshot list.");
    assert(indexText.includes('id="activation-log-list"'), "UI index is missing the activation log.");
    assert(indexText.includes('id="visual-upload-form"'), "UI index is missing the visual upload form.");
    assert(indexText.includes('data-view-panel="writer-workbench"'), "UI index is missing the writer workbench view.");
    assert(indexText.includes("今日下一步"), "Overview is missing the operator next-step card.");
    assert(indexText.includes("本輪流程進度"), "Overview is missing workflow progress guidance.");
    assert(indexText.includes("你現在在："), "Writer Workbench is missing the current-stage guidance.");
    assert(indexText.includes("visual_index records"), "Visual gallery is missing index diagnostics.");
    assert(indexText.includes("asset png files"), "Visual gallery is missing PNG diagnostics.");
    assert(indexText.includes("PNG 圖片本體不進 Git"), "Visual gallery is missing Git-ignore guidance.");
    assert(
      indexText.includes("神經模組目前是輔助 trace，不是正文生成必要條件"),
      "Neural view is missing the optional-module explanation.",
    );
    assert(indexText.includes("此頁只讀，不會修改正式資料"), "Library is missing its read-only notice.");
    assert(
      indexText.includes("記錄回饋不會自動修改正史"),
      "Activity view is missing Feedback Learning canon safety guidance.",
    );
    assert(indexText.includes('寫作工作台'), "UI index is missing the writer workbench heading.");
    assert(indexText.includes('id="writer-workbench-state"'), "UI index is missing the writer workbench state element.");
    assert(indexText.includes('id="feedback-learning-panel"'), "UI index is missing the Feedback Learning panel.");
    assert(indexText.includes("此面板只讀"), "Feedback Learning panel is missing its read-only warning.");
    assert(indexText.includes("待確認更新請到確認佇列處理"), "Feedback Learning panel is missing its Approval Queue guidance.");

    const appResponse = await fetch(`${baseUrl}/app.js`);
    const appText = await appResponse.text();
    assert(appResponse.ok && appText.includes("handlePipeline"), "UI app.js was not served.");
    assert(appText.includes("handleVisualUpload"), "UI app.js is missing the visual upload handler.");
    assert(appText.includes("handleVisualDelete"), "UI app.js is missing the visual delete handler.");
    assert(
      appText.includes("/api/visual-db/asset?path=${encodeURIComponent(projectPath)}"),
      "Visual cards do not build encoded asset API URLs.",
    );
    assert(
      !appText.includes('<img src="${escapeHtml(item.path)}"'),
      "Visual cards use a local project path directly as img src.",
    );
    assert(appText.includes("renderNeuralStatus"), "UI app.js is missing the neural status renderer.");
    assert(appText.includes("handleSettlementImport"), "UI app.js is missing the settlement import handler.");
    assert(appText.includes("renderRiskReport"), "UI app.js is missing the risk report renderer.");
    assert(appText.includes("renderDiff"), "UI app.js is missing the diff renderer.");
    assert(appText.includes("handleActivateCandidate"), "UI app.js is missing the activation handler.");
    assert(appText.includes("handleRollbackSnapshot"), "UI app.js is missing the rollback handler.");
    assert(appText.includes("handleWorkflowTask"), "UI app.js is missing draft task handling.");
    assert(appText.includes("refreshWorkflowState"), "UI app.js is missing workflow state loading.");
    assert(appText.includes("renderFeedbackLearning"), "UI app.js is missing Feedback Learning rendering.");
    assert(appText.includes("primaryNextStep"), "UI app.js is missing operator next-step derivation.");
    assert(appText.includes("operatorStatusLabel"), "UI app.js is missing localized status rendering.");
    assert(appText.includes("可稍後處理"), "Approval Queue is missing deferred grouping guidance.");
    assert(
      appText.includes("/api/writer-workbench/feedback-learning-state"),
      "UI app.js is missing Feedback Learning state loading.",
    );
    assert(appText.includes("renderProofSummary"), "UI app.js is missing P0-P4 rendering.");
    assert(
      appText.includes("handleCreateSettlementContext"),
      "UI app.js is missing settlement context handling.",
    );
    assert(
      appText.includes("handleSaveSettlementReport"),
      "UI app.js is missing settlement report handling.",
    );
    assert(
      appText.includes("handleCreateWorkflowPendingCandidate"),
      "UI app.js is missing Phase 4B pending candidate handling.",
    );
    assert(appText.includes("refreshApprovalQueue"), "UI app.js is missing approval queue loading.");
    assert(appText.includes("handleApprovalDecision"), "UI app.js is missing approval decisions.");
    assert(appText.includes("refreshCleanup"), "UI app.js is missing cleanup loading.");
    // Additional UI interaction checks
    assert(indexText.includes('id="pipeline-submit-button"'), "index.html missing pipeline submit button id");
    assert(indexText.includes('id="search-only-button"'), "index.html missing search-only button id");
    assert(indexText.includes('id="workflow-task-submit-button"'), "index.html missing workflow task submit button id");
    assert(indexText.includes('id="visual-upload-file-status"'), "index.html missing visual upload file status element");
    assert(indexText.includes('id="visual-upload-status"'), "index.html missing visual upload status element");
    assert(indexText.includes('id="visual-upload-submit"'), "index.html missing visual upload submit button");

    // app.js should reference the key selectors and helper functions
    assert(appText.includes('pipeline-submit-button'), "app.js missing pipeline-submit-button selector reference");
    assert(appText.includes('search-only-button'), "app.js missing search-only-button selector reference");
    assert(appText.includes('workflow-task-submit-button'), "app.js missing workflow-task-submit-button selector reference");
    assert(appText.includes('visual-upload-file'), "app.js missing visual-upload-file selector reference");
    assert(appText.includes('describeVisualUploadFile'), "app.js missing describeVisualUploadFile helper");
    assert(appText.includes('setVisualUploadStatus'), "app.js missing setVisualUploadStatus helper");

    // Ensure workflow form does not contain nested <form> and has balanced details
    const wfStart = indexText.indexOf('id="workflow-task-form"');
    const wfEnd = indexText.indexOf('</form>', wfStart);
    const wfHtml = wfStart >= 0 && wfEnd > wfStart ? indexText.slice(wfStart, wfEnd) : '';
    assert(!wfHtml.includes('<form'), 'workflow-task-form contains a nested <form>');
    const detailsOpen = (wfHtml.match(/<details/gu) || []).length;
    const detailsClose = (wfHtml.match(/<\/details>/gu) || []).length;
    assert(detailsOpen === detailsClose, 'workflow-task-form has unbalanced <details> tags');

    // Check loading/feedback labels exist in JS
    assert(appText.includes('建立中…') || appText.includes('檢索中…') || appText.includes('上傳中…'), 'app.js missing loading label text for actions');
    assert(appText.includes("handleCleanupDecision"), "UI app.js is missing cleanup decisions.");
    assert(
      appText.includes('status !== "approved"'),
      "UI app.js does not restrict cleanup execution to approved proposals.",
    );
    assert(
      appText.includes('$("#approval-confirm-text").value === "確認啟用"'),
      "UI app.js does not enforce exact high-risk approval text.",
    );
    assert(appText.includes('addEventListener("hashchange"'), "UI hash routing is not synchronized.");
    const stylesResponse = await fetch(`${baseUrl}/styles.css`);
    const stylesText = await stylesResponse.text();
    assert(stylesResponse.ok && stylesText.includes(".risk-critical"), "UI styles are missing risk-critical.");
    assert(stylesText.includes(".activation-panel"), "UI styles are missing the activation panel.");
    assert(stylesText.includes(".workflow-draft-item"), "UI styles are missing workflow draft items.");
    assert(stylesText.includes(".proof-level-summary"), "UI styles are missing proof level summary.");
    assert(
      stylesText.includes(".workflow-settlement-panel"),
      "UI styles are missing the Phase 4B workflow panel.",
    );
    assert(stylesText.includes(".approval-layout"), "UI styles are missing approval layout.");
    assert(stylesText.includes(".approval-item.is-high-risk"), "UI styles are missing high-risk state.");
    assert(stylesText.includes(".cleanup-layout"), "UI styles are missing cleanup layout.");
    assert(
      stylesText.includes(".cleanup-item-blocked_from_cleanup"),
      "UI styles are missing blocked cleanup state.",
    );

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
    // Allow empty visual galleries (empty baseline)
    assert(typeof visuals.count === "number" && visuals.count >= 0, "State API visual gallery count is invalid.");
    assert(
      visuals.diagnostics?.indexRecords === visuals.count,
      "Visual diagnostics index count does not match the gallery count.",
    );
    // PNG file count may be zero for empty baseline
    assert(typeof visuals.diagnostics?.pngFiles === "number" && visuals.diagnostics.pngFiles >= 0, "Visual diagnostics pngFiles is invalid.");
    assert(visuals.diagnostics?.gitIgnored === true, "Visual diagnostics did not report ignored assets.");
    assert(visuals.categories.length >= 4, "State API visual categories were not exposed.");

    // writer-workbench aggregated state endpoint
    const wbRes = await fetch(`${baseUrl}/api/writer-workbench/state`);
    assert(wbRes.ok, "/api/writer-workbench/state did not return 200");
    const wbPayload = await wbRes.json();
    assert(wbPayload.ok, "/api/writer-workbench/state payload missing ok=true");
    assert(wbPayload.state.safety, "writer-workbench state missing safety metadata");
    // Phase 9B additional assertions
    const wbState = wbPayload.state;
    assert(Array.isArray(wbState.workflow?.steps), "workflow.steps must be an array");
    const requiredKeys = ["writing_context","chat_output_candidate","proof_report","adoption_request","settlement_report","pending_engine_candidate","engine_candidate_review","activation_request"];
    const stepKeys = (wbState.workflow.steps || []).map((s) => s.key);
    requiredKeys.forEach((k) => { if (!stepKeys.includes(k)) throw new Error(`workflow missing step: ${k}`); });
    assert(typeof wbState.blocked === "object", "state.blocked must exist");
    assert(Array.isArray(wbState.next_actions), "state.next_actions must exist");
    assert(wbState.risk && wbState.risk.direct_activation_allowed === false, "risk.direct_activation_allowed must be false");
    assert(wbState.risk && wbState.risk.activation_requires_approval === true, "risk.activation_requires_approval must be true");
    assert(wbState.safety && wbState.safety.approval_required_for_adoption === true, "safety.approval_required_for_adoption must be true");
    assert(wbState.safety && wbState.safety.approval_required_for_activation === true, "safety.approval_required_for_activation must be true");
    // Ensure state endpoint is read-only: active_engine unchanged
    const activeEngineAfter = await readFile(activeEnginePath, "utf8");
    const activeEngineHashAfter = createHash("sha256").update(activeEngineAfter).digest("hex");
    assert(activeEngineHashAfter === activeEngineHashBefore, "active_engine file changed after calling state endpoint");

    const feedbackStateResult = await readJson(await fetch(
      `${baseUrl}/api/writer-workbench/feedback-learning-state`,
    ));
    assert(feedbackStateResult.response.ok, "Feedback Learning state API did not return 200.");
    const feedbackState = feedbackStateResult.payload.feedback_learning;
    assert(feedbackStateResult.payload.ok === true, "Feedback Learning state API missing ok=true.");
    assert(Array.isArray(feedbackState.items), "Feedback Learning items must be an array.");
    assert(Array.isArray(feedbackState.digests), "Feedback Learning digests must be an array.");
    assert(Array.isArray(feedbackState.rule_candidates), "Rule candidates must be an array.");
    assert(
      Array.isArray(feedbackState.compressed_rule_proposals),
      "Compressed rule proposals must be an array.",
    );
    assert(
      Array.isArray(feedbackState.compressed_rule_applications),
      "Compressed rule applications must be an array.",
    );
    assert(Array.isArray(feedbackState.pending_approvals), "Pending approvals must be an array.");
    assert(feedbackState.risk.can_apply_from_this_panel === false, "Feedback panel can apply rules.");
    assert(feedbackState.risk.requires_approval_queue === true, "Approval Queue is not required.");
    assert(feedbackState.risk.modifies_active_engine === false, "Feedback API can modify active_engine.");
    assert(
      feedbackState.risk.modifies_compressed_rules_from_ui === false,
      "Feedback API can modify compressed_rules from UI.",
    );
    assert(
      (await readOptionalBuffer(activeEnginePath)).content.equals(activeEngineBefore),
      "Feedback API changed active_engine.md.",
    );
    assert(
      (await readOptionalBuffer(compressedRulesPath)).content.equals(compressedRulesBefore.content),
      "Feedback API changed compressed_rules.md.",
    );
    assert(
      (await readOptionalBuffer(writingCardPath)).content.equals(writingCardBefore.content),
      "Feedback API changed active_writing_card.md.",
    );
    assert(
      (await readOptionalBuffer(proofingCardPath)).content.equals(proofingCardBefore.content),
      "Feedback API changed active_proofing_card.md.",
    );
    assert(
      JSON.stringify(await readOptionalDirectory(feedbackLoopDir))
        === JSON.stringify([...feedbackLoopBefore].sort()),
      "Feedback API created feedback_loop runtime artifacts.",
    );
    assert(
      JSON.stringify(await readOptionalDirectory(backupsDir))
        === JSON.stringify([...backupsBefore].sort()),
      "Feedback API created backup runtime artifacts.",
    );
    const currentPromptAfter = await readOptionalBuffer(currentPromptPath);
    assert(
      currentPromptAfter.exists === currentPromptBefore.exists
        && currentPromptAfter.content.equals(currentPromptBefore.content),
      "Read-only UI state created or changed data/outputs/current_prompt.md.",
    );
    const unsafeFeedbackState = await rawHttpStatus(
      port,
      "/api/writer-workbench/feedback-learning-state/%2e%2e%2factive_engine.md",
    );
    assert(
      unsafeFeedbackState.status >= 400 && unsafeFeedbackState.status < 500,
      "Feedback Learning traversal path was not rejected.",
    );

    const visualsResult = await readJson(await fetch(`${baseUrl}/api/visuals`));
    assert(visualsResult.response.ok && visualsResult.payload.ok, "Visuals API failed.");
    assert(
      visualsResult.payload.visuals.indexPath === "data/visual_db/visual_index.jsonl",
      "Visuals API returned the wrong index path.",
    );
    const visualsInfo = visualsResult.payload.visuals;
    assert(Array.isArray(visualsInfo.items), "Visuals API items are not an array.");
    assert(
      typeof visualsInfo.count === "number" && visualsInfo.count >= 0,
      "Visuals API returned an invalid gallery count.",
    );
    assert(
      visualsInfo.items.length === visualsInfo.count,
      "Visuals API item count does not match the gallery count.",
    );
    assert(
      visualsInfo.diagnostics?.indexRecords === visualsInfo.count,
      "Visuals API diagnostics do not match the gallery count.",
    );
    if (visualsInfo.count === 0) {
      assert(visualsInfo.items.length === 0, "Empty visual baseline did not return an empty list.");
    }

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

    const draftTaskResult = await readJson(await fetch(`${baseUrl}/api/workflow/draft-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChapter: "UI Workflow 測試章",
        task: "建立正文候選，不升格正史。",
      }),
    }));
    assert(draftTaskResult.response.status === 201, "Draft task API failed.");
    const workflowRunId = draftTaskResult.payload.result.run.run_id;
    createdAgentRunIds.push(workflowRunId);
    const workflowContextId = draftTaskResult.payload.result.context_bundle.context_bundle_id;
    assert(
      draftTaskResult.payload.result.context_bundle.status === "ready",
      "Draft context bundle was not ready.",
    );

    const workflowDraftResult = await readJson(await fetch(`${baseUrl}/api/workflow/candidate-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChapter: "UI Workflow 測試章",
        note: "UI contract",
        draftText: "UI workflow 正文候選。\n\n此內容不是正史。",
        runId: workflowRunId,
        contextBundleId: workflowContextId,
        neuralModulesUsedPath: `data/agent_runs/${workflowRunId}/neural_modules_used.json`,
      }),
    }));
    assert(workflowDraftResult.response.status === 201, "Candidate draft API failed.");
    const workflowDraftId = workflowDraftResult.payload.draft.metadata.draft_id;
    assert(
      workflowDraftResult.payload.draft.status.status === "candidate",
      "Candidate draft initial status was not candidate.",
    );
    assert(
      workflowDraftResult.payload.draft.neural_usage.used_neural_network === false,
      "Draft text incorrectly created neural success.",
    );
    const workflowDraftList = await readJson(await fetch(`${baseUrl}/api/workflow/candidate-drafts`));
    assert(
      workflowDraftList.response.ok
        && workflowDraftList.payload.drafts.some((draft) => draft.draft_id === workflowDraftId),
      "Candidate draft list omitted saved draft.",
    );
    const workflowDraftDetail = await readJson(await fetch(
      `${baseUrl}/api/workflow/candidate-drafts/${workflowDraftId}`,
    ));
    assert(workflowDraftDetail.response.ok, "Candidate draft detail API failed.");

    const sendProofResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/candidate-drafts/${workflowDraftId}/send-to-proofing`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(sendProofResult.response.ok, "Send-to-proofing API failed.");
    const proofRunId = sendProofResult.payload.result.run.run_id;
    createdAgentRunIds.push(proofRunId);
    const proofContextId = sendProofResult.payload.result.context_bundle.context_bundle_id;

    const saveProofResult = await readJson(await fetch(`${baseUrl}/api/workflow/proof-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: workflowDraftId,
        proofText: "## P0 正史衝突\n\n### P2 節奏問題",
        runId: proofRunId,
        contextBundleId: proofContextId,
        neuralModulesUsedPath: `data/agent_runs/${proofRunId}/neural_modules_used.json`,
      }),
    }));
    assert(saveProofResult.response.status === 201, "Proof report API failed.");
    const workflowProofId = saveProofResult.payload.proof_report.metadata.proof_id;
    assert(
      saveProofResult.payload.proof_report.issue_summary.p0_count === 1
        && saveProofResult.payload.proof_report.issue_summary.p2_count === 1,
      "Proof report API returned wrong P0-P4 counts.",
    );
    assert(
      saveProofResult.payload.proof_report.issue_summary.can_adopt_recommendation === false,
      "P0 proof report recommended adoption.",
    );
    const proofListResult = await readJson(await fetch(`${baseUrl}/api/workflow/proof-reports`));
    assert(
      proofListResult.response.ok
        && proofListResult.payload.proof_reports.some((proof) => proof.proof_id === workflowProofId),
      "Proof report list omitted saved report.",
    );
    const proofDetailResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/proof-reports/${workflowProofId}`,
    ));
    assert(proofDetailResult.response.ok, "Proof report detail API failed.");

    const unconfirmedAdopt = await readJson(await fetch(
      `${baseUrl}/api/workflow/candidate-drafts/${workflowDraftId}/adopt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(unconfirmedAdopt.response.status === 409, "Unconfirmed draft adoption was not blocked.");
    const adoptResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/candidate-drafts/${workflowDraftId}/adopt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, adoptedBy: "ui_contract_test" }),
      },
    ));
    assert(adoptResult.response.ok, "Confirmed draft adoption failed.");
    const adoptedChapterId = adoptResult.payload.result.metadata.adopted_chapter_id;
    assert(
      adoptResult.payload.result.status.status === "accepted_pending_settlement",
      "Adopted chapter status was not accepted_pending_settlement.",
    );
    const adoptedList = await readJson(await fetch(`${baseUrl}/api/workflow/adopted-chapters`));
    assert(
      adoptedList.response.ok
        && adoptedList.payload.adopted_chapters.some(
          (chapter) => chapter.adopted_chapter_id === adoptedChapterId,
        ),
      "Adopted chapter list omitted adopted chapter.",
    );
    const adoptedDetail = await readJson(await fetch(
      `${baseUrl}/api/workflow/adopted-chapters/${adoptedChapterId}`,
    ));
    assert(adoptedDetail.response.ok, "Adopted chapter detail API failed.");
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex") === activeEngineHashBefore,
      "Writing workflow APIs changed active_engine.md.",
    );

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
    const settlementContextResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/adopted-chapters/${adoptedChapterId}/settlement-context`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "UI Phase 4B context" }),
      },
    ));
    assert(settlementContextResult.response.status === 201, "Settlement context API failed.");
    const settlementContextId =
      settlementContextResult.payload.settlement_context.metadata.settlement_context_id;
    assert(
      settlementContextResult.payload.settlement_context.status.status === "ready",
      "Settlement context API did not create ready context.",
    );
    assert(
      settlementContextResult.payload.settlement_context.source_manifest.sources.some(
        (source) => source.label === "active_engine" && source.exists,
      ),
      "Settlement context source manifest omitted active_engine.",
    );
    const settlementContextList = await readJson(
      await fetch(`${baseUrl}/api/workflow/settlement-contexts`),
    );
    assert(
      settlementContextList.response.ok
        && settlementContextList.payload.settlement_contexts.some(
          (context) => context.settlement_context_id === settlementContextId,
        ),
      "Settlement context list omitted context.",
    );
    const settlementContextDetail = await readJson(await fetch(
      `${baseUrl}/api/workflow/settlement-contexts/${settlementContextId}`,
    ));
    assert(settlementContextDetail.response.ok, "Settlement context detail API failed.");

    const settlementReportResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/settlement-reports`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementContextId,
          settlementText: settlementRaw,
          sourceChapter: "UI Workflow 結算章",
          note: "UI Phase 4B report",
        }),
      },
    ));
    assert(settlementReportResult.response.status === 201, "Settlement report API failed.");
    const settlementReportId =
      settlementReportResult.payload.settlement_report.metadata.settlement_report_id;
    assert(
      settlementReportResult.payload.settlement_report.status.status === "settlement_report_saved",
      "Settlement report status was wrong.",
    );
    assert(
      settlementReportResult.payload.settlement_report.neural_usage.used_neural_network === false,
      "Settlement report text incorrectly created neural success.",
    );
    const settlementReportList = await readJson(
      await fetch(`${baseUrl}/api/workflow/settlement-reports`),
    );
    assert(
      settlementReportList.response.ok
        && settlementReportList.payload.settlement_reports.some(
          (report) => report.settlement_report_id === settlementReportId,
        ),
      "Settlement report list omitted report.",
    );
    const settlementReportDetail = await readJson(await fetch(
      `${baseUrl}/api/workflow/settlement-reports/${settlementReportId}`,
    ));
    assert(settlementReportDetail.response.ok, "Settlement report detail API failed.");

    const workflowPendingResult = await readJson(await fetch(
      `${baseUrl}/api/workflow/settlement-reports/${settlementReportId}/create-pending-candidate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(
      workflowPendingResult.response.status === 201,
      "Phase 4B pending candidate creation API failed.",
    );
    const workflowCandidateId =
      workflowPendingResult.payload.result.pending_candidate.metadata.candidate_id;
    createdCandidateIds.push(workflowCandidateId);
    assert(
      workflowPendingResult.payload.result.pending_candidate.diff
        && workflowPendingResult.payload.result.pending_candidate.risk_report,
      "Phase 4B did not return Phase 2 diff and risk.",
    );
    assert(
      workflowPendingResult.payload.result.settlement_report.status.status
        === "pending_candidate_created",
      "Settlement report was not linked to pending candidate.",
    );
    assert(
      workflowPendingResult.payload.result.adopted_chapter.status.status
        === "settlement_candidate_created",
      "Adopted chapter was not linked to pending candidate.",
    );
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex")
        === activeEngineHashBefore,
      "Phase 4B changed active_engine.md.",
    );

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
    const approvalScan = await readJson(await fetch(`${baseUrl}/api/approval-queue/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    assert(approvalScan.response.ok, "Approval queue scan API failed.");
    const candidateApproval = approvalScan.payload.scan.items.find(
      (item) => item.target_id === apiCandidateId
        && item.action_type === "activate_engine_candidate",
    );
    assert(candidateApproval, "Approval scan omitted pending candidate.");
    const approvalCount = approvalScan.payload.scan.items.length;
    const repeatedApprovalScan = await readJson(await fetch(`${baseUrl}/api/approval-queue/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    assert(
      repeatedApprovalScan.payload.scan.items.length === approvalCount,
      "Repeated approval scan created duplicate items.",
    );
    const approvalDetail = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/items/${candidateApproval.approval_item_id}`,
    ));
    assert(approvalDetail.response.ok, "Approval item detail API failed.");
    const unconfirmedApproval = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/items/${candidateApproval.approval_item_id}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(unconfirmedApproval.response.status === 409, "Approval item confirmed without checkbox.");
    const deferredApproval = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/items/${candidateApproval.approval_item_id}/defer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "UI contract defer" }),
      },
    ));
    assert(
      deferredApproval.response.ok && deferredApproval.payload.result.status.status === "deferred",
      "Approval defer API failed.",
    );
    const rejectedApproval = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/items/${candidateApproval.approval_item_id}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "UI contract reject" }),
      },
    ));
    assert(
      rejectedApproval.response.ok && rejectedApproval.payload.result.status.status === "rejected",
      "Approval reject API failed.",
    );
    const approvalLogs = await readJson(await fetch(`${baseUrl}/api/approval-queue/logs`));
    assert(
      approvalLogs.response.ok
        && approvalLogs.payload.logs.some((log) => log.event === "approval_deferred")
        && approvalLogs.payload.logs.some((log) => log.event === "approval_rejected")
        && approvalLogs.payload.logs.some((log) => log.event === "approval_failed"),
      "Approval log API omitted decision events.",
    );

    const cleanupScan = await readJson(await fetch(`${baseUrl}/api/cleanup/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retentionPolicy: {
          keep_latest_archives: 10,
          keep_latest_snapshots: 10,
          rejected_candidate_days: 90,
          failed_candidate_days: 90,
          blocked_candidate_days: 90,
          trash_retention_days: 30,
        },
      }),
    }));
    assert(cleanupScan.response.ok, "Cleanup scan API failed.");
    assert(
      Array.isArray(cleanupScan.payload.scan.eligible_items)
        && Array.isArray(cleanupScan.payload.scan.must_keep_items)
        && Array.isArray(cleanupScan.payload.scan.needs_review_items)
        && Array.isArray(cleanupScan.payload.scan.blocked_items),
      "Cleanup scan API omitted classification buckets.",
    );
    const cleanupCreate = await readJson(await fetch(`${baseUrl}/api/cleanup/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdBy: "ui_contract_test" }),
    }));
    assert(cleanupCreate.response.ok, "Cleanup proposal API failed.");
    const cleanupProposalId = cleanupCreate.payload.proposal.cleanup_proposal_id;
    const cleanupDetail = await readJson(
      await fetch(`${baseUrl}/api/cleanup/proposals/${cleanupProposalId}`),
    );
    assert(cleanupDetail.response.ok, "Cleanup proposal detail API failed.");
    const unconfirmedCleanupApproval = await readJson(await fetch(
      `${baseUrl}/api/cleanup/proposals/${cleanupProposalId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(
      unconfirmedCleanupApproval.response.status === 409,
      "Cleanup proposal approved without confirmation.",
    );
    const deferredCleanup = await readJson(await fetch(
      `${baseUrl}/api/cleanup/proposals/${cleanupProposalId}/defer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "UI contract defer" }),
      },
    ));
    assert(
      deferredCleanup.response.ok && deferredCleanup.payload.result.status.status === "deferred",
      "Cleanup defer API failed.",
    );
    const rejectedCleanup = await readJson(await fetch(
      `${baseUrl}/api/cleanup/proposals/${cleanupProposalId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "UI contract reject" }),
      },
    ));
    assert(
      rejectedCleanup.response.ok && rejectedCleanup.payload.result.status.status === "rejected",
      "Cleanup reject API failed.",
    );
    const cleanupLogs = await readJson(await fetch(`${baseUrl}/api/cleanup/logs`));
    assert(
      cleanupLogs.response.ok
        && cleanupLogs.payload.logs.some((log) => log.event === "cleanup_scan")
        && cleanupLogs.payload.logs.some((log) => log.event === "cleanup_proposal_created")
        && cleanupLogs.payload.logs.some((log) => log.event === "cleanup_proposal_deferred")
        && cleanupLogs.payload.logs.some((log) => log.event === "cleanup_proposal_rejected")
        && cleanupLogs.payload.logs.some((log) => log.event === "cleanup_failed"),
      "Cleanup log API omitted lifecycle events.",
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
      activateResult.response.status === 409,
      "Unconfirmed Phase 3 activation was not blocked.",
    );

    const directActivation = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}/activate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, approvedBy: "ui_contract_test" }),
      },
    ));
    assert(directActivation.response.status === 409, "Direct UI activation was not blocked.");
    const activationApprovalScan = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/scan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    const activationApproval = activationApprovalScan.payload.scan.items.find(
      (item) => item.target_id === apiCandidateId
        && item.action_type === "activate_engine_candidate"
        && ["pending", "deferred"].includes(item.status.status),
    );
    assert(activationApproval, "Approval scan did not create an activatable item.");
    const confirmedActivation = await readJson(await fetch(
      `${baseUrl}/api/approval-queue/items/${activationApproval.approval_item_id}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, approvedBy: "ui_contract_test" }),
      },
    ));
    assert(confirmedActivation.response.ok, "Approval-confirmed Phase 3 activation failed.");
    const activationResult = confirmedActivation.payload.result.result;
    assert(activationResult.snapshot_id, "Activation did not return a snapshot id.");
    assert(activationResult.archive_id, "Activation did not return an archive id.");
    const rollbackApprovalResult = await readJson(await fetch(`${baseUrl}/api/approval-queue/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId: activationResult.snapshot_id }),
    }));
    assert(
      rollbackApprovalResult.response.ok
        && rollbackApprovalResult.payload.rollback_item.action_type === "rollback_active_engine",
      "Explicit snapshot selection did not create rollback approval item.",
    );
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex")
        === activationResult.active_engine_after_hash,
      "Activation did not write candidate content to active_engine.md.",
    );
    const activatedDetail = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${apiCandidateId}`,
    ));
    assert(
      activatedDetail.payload.candidate.status.status === "activated",
      "Activated candidate status was not persisted.",
    );
    const snapshotsResult = await readJson(await fetch(`${baseUrl}/api/canon/snapshots`));
    assert(
      snapshotsResult.response.ok
        && snapshotsResult.payload.snapshots.some(
          (snapshot) => snapshot.snapshot_id === activationResult.snapshot_id,
        ),
      "Snapshot API omitted activation snapshot.",
    );
    const logsResult = await readJson(await fetch(`${baseUrl}/api/canon/activation-logs`));
    assert(
      logsResult.response.ok
        && logsResult.payload.logs.some(
          (entry) => entry.event === "activate_pending_engine_candidate"
            && entry.candidate_id === apiCandidateId,
        ),
      "Activation logs API omitted activation event.",
    );
    const unconfirmedRollback = await readJson(await fetch(
      `${baseUrl}/api/canon/rollback/${activationResult.snapshot_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ));
    assert(unconfirmedRollback.response.status === 409, "Unconfirmed rollback was not blocked.");
    const rollbackResult = await readJson(await fetch(
      `${baseUrl}/api/canon/rollback/${activationResult.snapshot_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, approvedBy: "ui_contract_test" }),
      },
    ));
    assert(rollbackResult.response.ok, "Confirmed rollback failed.");
    assert(
      createHash("sha256").update(await readFile(activeEnginePath)).digest("hex")
        === activeEngineHashBefore,
      "Rollback did not restore the original active_engine.md.",
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
    const unsafeRollback = await rawHttpStatus(
      port,
      "/api/canon/rollback/%2e%2e%2factive_engine.md",
      "POST",
      "{}",
    );
    assert(unsafeRollback.status >= 400 && unsafeRollback.status < 500, "Unsafe rollback path was accepted.");
    for (const unsafePath of [
      "/api/workflow/candidate-drafts/%2e%2e%2factive_engine.md",
      "/api/workflow/proof-reports/%2e%2e%2factive_engine.md",
      "/api/workflow/adopted-chapters/%2e%2e%2factive_engine.md",
    ]) {
      const unsafeResult = await rawHttpStatus(port, unsafePath);
      assert(
        unsafeResult.status >= 400 && unsafeResult.status < 500,
        `Writing workflow traversal path was not rejected: ${unsafePath}`,
      );
    }
    const unsafeDraftAction = await rawHttpStatus(
      port,
      "/api/workflow/candidate-drafts/%2e%2e%2factive_engine.md/adopt",
      "POST",
      JSON.stringify({ confirm: true }),
    );
    assert(
      unsafeDraftAction.status >= 400 && unsafeDraftAction.status < 500,
      "Unsafe writing workflow action path was accepted.",
    );
    for (const unsafePath of [
      "/api/workflow/settlement-contexts/%2e%2e%2factive_engine.md",
      "/api/workflow/settlement-reports/%2e%2e%2factive_engine.md",
    ]) {
      const unsafeResult = await rawHttpStatus(port, unsafePath);
      assert(
        unsafeResult.status >= 400 && unsafeResult.status < 500,
        `Settlement workflow traversal path was not rejected: ${unsafePath}`,
      );
    }
    const unsafeSettlementContext = await rawHttpStatus(
      port,
      "/api/workflow/adopted-chapters/%2e%2e%2factive_engine.md/settlement-context",
      "POST",
      "{}",
    );
    assert(
      unsafeSettlementContext.status >= 400 && unsafeSettlementContext.status < 500,
      "Unsafe adopted chapter settlement path was accepted.",
    );
    const unsafePendingCreate = await rawHttpStatus(
      port,
      "/api/workflow/settlement-reports/%2e%2e%2factive_engine.md/create-pending-candidate",
      "POST",
      "{}",
    );
    assert(
      unsafePendingCreate.status >= 400 && unsafePendingCreate.status < 500,
      "Unsafe settlement report action path was accepted.",
    );
    const unsafeApproval = await rawHttpStatus(
      port,
      "/api/approval-queue/items/%2e%2e%2factive_engine.md",
    );
    assert(
      unsafeApproval.status >= 400 && unsafeApproval.status < 500,
      "Unsafe approval item path was accepted.",
    );
    const unsafeApprovalAction = await rawHttpStatus(
      port,
      "/api/approval-queue/items/%2e%2e%2factive_engine.md/confirm",
      "POST",
      "{}",
    );
    assert(
      unsafeApprovalAction.status >= 400 && unsafeApprovalAction.status < 500,
      "Unsafe approval action path was accepted.",
    );
    const unsafeCleanup = await rawHttpStatus(
      port,
      "/api/cleanup/proposals/%2e%2e%2factive_engine.md",
    );
    assert(
      unsafeCleanup.status >= 400 && unsafeCleanup.status < 500,
      "Unsafe cleanup proposal path was accepted.",
    );
    const unsafeCleanupAction = await rawHttpStatus(
      port,
      "/api/cleanup/proposals/%2e%2e%2factive_engine.md/execute",
      "POST",
      JSON.stringify({ confirm: true }),
    );
    assert(
      unsafeCleanupAction.status >= 400 && unsafeCleanupAction.status < 500,
      "Unsafe cleanup action path was accepted.",
    );

    const rejectImportResult = await readJson(await fetch(`${baseUrl}/api/canon/settlement/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChapter: "UI 放棄候選測試",
        rawText: [
          "## 新版完整創作引擎候選",
          "",
          "```md",
          activeText,
          "UI 放棄候選規則。",
          "```",
        ].join("\n"),
      }),
    }));
    assert(rejectImportResult.response.status === 201, "Reject fixture import failed.");
    const rejectCandidateId = rejectImportResult.payload.candidate.metadata.candidate_id;
    createdCandidateIds.push(rejectCandidateId);
    const rejectResult = await readJson(await fetch(
      `${baseUrl}/api/canon/pending-candidates/${rejectCandidateId}/reject`,
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
      "Reject changed active_engine.md.",
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

    const visualTraversalResult = await readJson(await fetch(
      `${baseUrl}/api/visual-db/asset?path=${encodeURIComponent("../README.md")}`,
    ));
    assert(
      [400, 403].includes(visualTraversalResult.response.status),
      "Visual asset traversal was not rejected.",
    );
    const visualOutsideResult = await readJson(await fetch(
      `${baseUrl}/api/visual-db/asset?path=${encodeURIComponent("data/canon_db/active_engine.md")}`,
    ));
    assert(
      [400, 403].includes(visualOutsideResult.response.status),
      "Visual asset endpoint read outside the asset directory.",
    );
    const visualTypeResult = await readJson(await fetch(
      `${baseUrl}/api/visual-db/asset?path=${encodeURIComponent("data/visual_db/assets/characters/not-image.txt")}`,
    ));
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
    console.log("- Confirmed activation, snapshot, archive, logs, and rollback checked: yes");
    console.log("- Unconfirmed activation and rollback blocked: yes");
    console.log("- Writing candidate, proofing, adoption, and workflow path safety checked: yes");
    console.log("- Writing workflow active_engine side effects: none");
    console.log("- Settlement context, report, Phase 2 candidate, diff, and risk checked: yes");
    console.log("- Phase 4B direct active_engine activation: none");
    console.log("- Approval scan, dedupe, detail, reject, defer, rollback request, and logs checked: yes");
    console.log("- Approval high-risk UI confirmation and path safety checked: yes");
    console.log("- Cleanup scan, proposal, reject, defer, logs, UI, and path safety checked: yes");
    console.log("- Unknown action rejected: yes");
    console.log("- Invalid action input rejected: yes");
    console.log(`- Source trust records checked through UI: ${trustReport.checked_sources}`);
    console.log("- Draft dry-run side effects: none");
    console.log("- Feedback Learning read-only UI/API checked: yes");
    console.log("- Feedback Learning protected file and runtime side effects: none");
  } finally {
    const activeEngineAfter = await readFile(activeEnginePath);
    if (!activeEngineAfter.equals(activeEngineBefore)) {
      await writeFile(activeEnginePath, activeEngineBefore);
    }
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
    for (const name of await readOptionalDirectory(engineSnapshotsDir)) {
      if (!snapshotsBefore.has(name)) {
        await rm(path.join(engineSnapshotsDir, name), { recursive: true, force: true });
      }
    }
    for (const name of await readOptionalDirectory(engineArchiveDir)) {
      if (!archiveBefore.has(name)) {
        await rm(path.join(engineArchiveDir, name), { recursive: true, force: true });
      }
    }
    for (const [directory, namesBefore] of [
      [workflowDraftsDir, workflowDraftsBefore],
      [workflowProofsDir, workflowProofsBefore],
      [workflowAdoptedDir, workflowAdoptedBefore],
      [workflowContextsDir, workflowContextsBefore],
      [workflowSettlementContextsDir, workflowSettlementContextsBefore],
      [workflowSettlementReportsDir, workflowSettlementReportsBefore],
      [approvalItemsDir, approvalItemsBefore],
      [cleanupProposalsDir, cleanupProposalsBefore],
      [cleanupTrashDir, cleanupTrashBefore],
      [cleanupTombstonesDir, cleanupTombstonesBefore],
    ]) {
      for (const name of await readOptionalDirectory(directory)) {
        if (!namesBefore.has(name)) {
          await rm(path.join(directory, name), { recursive: true, force: true });
        }
      }
    }
    if (activationLogBefore.exists) await writeFile(activationLogPath, activationLogBefore.content);
    else await rm(activationLogPath, { force: true });
    if (rollbackIndexBefore.exists) await writeFile(rollbackIndexPath, rollbackIndexBefore.content);
    else await rm(rollbackIndexPath, { force: true });
    if (approvalLogBefore.exists) await writeFile(approvalLogPath, approvalLogBefore.content);
    else await rm(approvalLogPath, { force: true });
    if (cleanupLogBefore.exists) await writeFile(cleanupLogPath, cleanupLogBefore.content);
    else await rm(cleanupLogPath, { force: true });
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
