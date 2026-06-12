const state = {
  data: null,
  activeView: "overview",
  activeResultPath: "data/outputs/task_prompt.md",
  activeActivityList: "drafts",
  activeVisualId: "",
  activeNeuralRunId: "",
  activeCandidateId: "",
  activeWorkflowDraftId: "",
  activeAdoptedChapterId: "",
  activeSettlementContextId: "",
  activeSettlementReportId: "",
  activeApprovalItemId: "",
  activeCleanupProposalId: "",
  workflow: {
    drafts: [],
    proofReports: [],
    adoptedChapters: [],
    draftDetail: null,
    proofDetail: null,
    context: null,
    settlementContexts: [],
    settlementReports: [],
    settlementContextDetail: null,
    settlementReportDetail: null,
    settlementPendingCandidate: null,
  },
  canon: {
    activeEngine: null,
    candidates: [],
    candidateDetail: null,
    snapshots: [],
    activationLogs: [],
  },
  approval: {
    items: [],
    detail: null,
    logs: [],
  },
  cleanup: {
    proposals: [],
    detail: null,
    logs: [],
    scan: null,
  },
  neuralData: {
    runs: [],
    traces: [],
  },
  workbench: null,
  visualFilters: {
    character: "",
    category: "",
    status: "",
  },
  currentComposeText: "",
  currentLibraryText: "",
  currentDraftText: "",
  busyCount: 0,
};

const titles = {
  overview: "總覽",
  compose: "起稿",
  review: "驗稿",
  library: "資料庫",
  visuals: "圖庫",
  neural: "神經模組",
  settlement: "結算匯入",
  approval: "確認佇列",
  cleanup: "封存清理",
  activity: "紀錄",
  "writer-workbench": "寫作工作台",
};

const sourceIcons = {
  active_engine: "C",
  active_writing_card: "W",
  active_proofing_card: "P",
  active_longline: "L",
  compressed_error_rules: "E",
};

const maxVisualUploadBytes = 8 * 1024 * 1024;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "尚未建立";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function visualStatusLabel(value) {
  return {
    approved_visual: "已核可視覺",
    reference: "參考",
    candidate: "候選",
    deprecated: "停用",
    invalid: "錯誤",
  }[value] ?? value ?? "";
}

const operatorStatusLabels = {
  pending: "待確認",
  pending_approval: "待確認",
  blocked: "暫時卡住",
  completed: "已完成",
  confirmed: "已完成",
  resolved: "已完成",
  ready: "可進行",
  missing: "尚未開始",
  optional: "可稍後",
  deferred: "可稍後",
  warning: "注意",
  failed: "失敗",
  rejected: "已拒絕",
  unknown: "尚無資料",
};

const workflowStepMeta = {
  writing_context: { label: "起稿", view: "compose" },
  chat_output_candidate: { label: "候選稿", view: "compose" },
  proof_report: { label: "驗稿", view: "review" },
  adoption_request: { label: "採用確認", view: "approval" },
  settlement_report: { label: "結算", view: "settlement" },
  pending_engine_candidate: { label: "引擎候選", view: "settlement" },
  activation_request: { label: "啟用確認", view: "approval" },
};

function operatorStatusLabel(value) {
  return operatorStatusLabels[value] ?? value ?? "尚無資料";
}

function workflowSteps(workbench = state.workbench) {
  return workbench?.workflow?.steps ?? [];
}

function workflowStep(key, workbench = state.workbench) {
  return workflowSteps(workbench).find((item) => item.key === key);
}

function workflowReason(step) {
  if (!step) return "尚無流程資料。";
  if (step.blocked_reason) return step.blocked_reason;
  if (["completed", "confirmed"].includes(step.status)) return "此階段已具備所需資料。";
  if (["ready", "missing"].includes(step.status)) return "前置條件已整理，可依提示繼續。";
  if (step.status === "pending_approval") return "已送入確認佇列，等待人工處理。";
  return "請查看詳細資料確認目前狀態。";
}

function primaryNextStep(workbench = state.workbench) {
  const checks = [
    ["writing_context", "下一步：到起稿頁建立本輪任務提示", "compose"],
    ["chat_output_candidate", "下一步：把任務提示貼給 ChatGPT，取得正文候選後回到紀錄頁保存", "compose"],
    ["proof_report", "下一步：到驗稿頁建立驗稿 context", "review"],
    ["adoption_request", "下一步：到確認佇列處理採用請求", "approval"],
    ["settlement_report", "下一步：到結算匯入頁建立章節結算 context", "settlement"],
    ["pending_engine_candidate", "下一步：審查引擎候選差異", "settlement"],
    ["activation_request", "下一步：到確認佇列處理引擎啟用確認", "approval"],
  ];
  for (const [key, text, view] of checks) {
    const step = workflowStep(key, workbench);
    if (!step || !["completed", "confirmed", "resolved"].includes(step.status)) {
      return { key, text, view, step };
    }
  }
  return {
    key: "writing_context",
    text: "目前沒有阻塞項，可開始新一輪正文候選。",
    view: "compose",
    step: workflowStep("writing_context", workbench),
  };
}

function neuralStatusMeta(run, traces) {
  const successCount = traces.filter((trace) => trace.status === "success").length;
  const failedCount = traces.filter((trace) => trace.status === "failed").length;
  const skippedCount = traces.filter((trace) => trace.status === "skipped").length;
  const successfulModules = new Set(
    traces.filter((trace) => trace.status === "success").map((trace) => trace.module_name),
  );
  const missingRequired = run?.requires_neural_modules
    && (run.required_neural_modules ?? []).some((moduleName) => !successfulModules.has(moduleName));
  if (run?.warning || missingRequired) {
    return { label: "warning", className: "neural-status-warning" };
  }
  if (successCount > 0) return { label: "已使用", className: "neural-status-success" };
  if (failedCount > 0) return { label: "失敗", className: "neural-status-failed" };
  if (skippedCount > 0) return { label: "跳過", className: "neural-status-skipped" };
  return { label: "未使用", className: "neural-status-missing" };
}

function setBusy(busy) {
  const wasBusy = state.busyCount > 0;
  state.busyCount += busy ? 1 : -1;
  state.busyCount = Math.max(0, state.busyCount);
  $("#loading-bar").hidden = state.busyCount === 0;
  const isBusy = state.busyCount > 0;
  if (wasBusy === isBusy) return;
  $$("form button, [data-action], [data-visual-delete], #validate-button, #refresh-button, #candidate-reparse-button, #candidate-reject-button, #candidate-activate-button, [data-rollback-snapshot]").forEach((button) => {
    if (isBusy) {
      button.dataset.busyState = button.disabled ? "preserve" : "temporary";
      button.disabled = true;
    } else {
      if (button.dataset.busyState === "temporary") button.disabled = false;
      delete button.dataset.busyState;
    }
  });
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " is-error" : ""}`;
  item.textContent = message;
  $("#toast-region").append(item);
  setTimeout(() => item.remove(), 4200);
}

async function api(url, options = {}) {
  setBusy(true);
  try {
    const response = await fetch(url, {
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      ...options,
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error ?? payload.result?.stderr ?? `HTTP ${response.status}`);
    }
    return payload;
  } finally {
    setBusy(false);
  }
}

async function runAction(name, body = {}) {
  const payload = await api(`/api/actions/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const output = [payload.result.stdout, payload.result.stderr].filter(Boolean).join("\n\n");
  $("#action-console").textContent = output || `${name}: completed`;
  return payload.result;
}

async function loadFile(projectPath) {
  const payload = await api(`/api/file?path=${encodeURIComponent(projectPath)}`);
  return payload.file.text;
}

async function refreshState(showToast = false) {
  const [payload, workbenchPayload] = await Promise.all([
    api("/api/state"),
    api("/api/writer-workbench/state"),
  ]);
  state.data = payload.state;
  state.workbench = workbenchPayload.state;
  renderAll();
  $("#last-sync").textContent = `同步 ${formatDate(payload.state.generatedAt)}`;
  if (showToast) toast("資料已重新整理");
}

function switchView(viewName) {
  if (!titles[viewName]) viewName = "overview";
  state.activeView = viewName;
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
  $$("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === viewName);
  });
  $("#view-title").textContent = titles[viewName] ?? viewName;
  if (window.location.hash !== `#${viewName}`) {
    history.replaceState(null, "", `#${viewName}`);
  }
  if (viewName === "neural") {
    loadNeuralStatus().catch((error) => toast(error.message, true));
  }
  if (viewName === "writer-workbench") {
    refreshWriterWorkbenchState().catch((error) => toast(error.message, true));
  }
  if (viewName === "settlement") {
    Promise.all([
      refreshCanonSettlementState(),
      refreshWorkflowSettlementState(),
    ]).catch((error) => toast(error.message, true));
  }
  if (viewName === "approval") {
    refreshApprovalQueue().catch((error) => toast(error.message, true));
  }
  if (viewName === "cleanup") {
    refreshCleanup().catch((error) => toast(error.message, true));
  }
  if (["compose", "review"].includes(viewName)) {
    refreshWorkflowState().catch((error) => toast(error.message, true));
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function refreshWriterWorkbenchState() {
  const [payload, feedbackPayload] = await Promise.all([
    api("/api/writer-workbench/state"),
    api("/api/writer-workbench/feedback-learning-state"),
  ]);
  const pre = $("#writer-workbench-state");
  const timeline = $("#workbench-timeline");
  const nextPanel = $("#workbench-next-action");
  const riskPanel = $("#workbench-risk");
  const approvalPanel = $("#workbench-approval");
  const reviewPanel = $("#workbench-review");
  if (!pre || !timeline || !nextPanel || !riskPanel) return;
  const workbench = payload.state ?? {};
  state.workbench = workbench;
  // render timeline
  const steps = workflowSteps(workbench);
  timeline.innerHTML = steps.map((s) => `
    <div class="workflow-step">
      <div class="status-badge status-${escapeHtml(s.status)}">${escapeHtml(operatorStatusLabel(s.status))}</div>
      <div class="workflow-step-label">${escapeHtml(workflowStepMeta[s.key]?.label ?? s.label)}</div>
      <div class="workflow-step-meta">${escapeHtml(workflowReason(s))}</div>
    </div>
  `).join("");

  // next action
  const suggested = primaryNextStep(workbench);
  nextPanel.innerHTML = `
    <strong>${escapeHtml(suggested.text)}</strong>
    <button class="button primary" type="button" data-go-view="${escapeHtml(suggested.view)}">前往處理</button>
  `;

  // risk panel
  const risk = workbench.risk ?? {};
  riskPanel.innerHTML = `
    <strong>高風險操作提醒</strong>
    <p>引擎啟用與採用確認仍須經確認佇列；本頁不會直接修改正式引擎。</p>
    ${risk.base_hash_mismatch ? '<div class="warning-panel">引擎候選基準已變動，請先重新審查差異。</div>' : ""}
  `;

  // approval panel
  approvalPanel.innerHTML = `<div>確認佇列：${workbench.approval_queue?.pending_count ?? 0} 筆待確認</div>`;

  // review/diff panel (show minimal info)
  reviewPanel.innerHTML = workbench.blocked?.is_blocked
    ? `<div class="warning-panel">目前卡住：${escapeHtml(workbench.blocked.reason ?? "")}</div>`
    : `<div>目前沒有阻塞項。</div>`;

  const next = primaryNextStep(workbench);
  $("#workbench-stage-card").innerHTML = `
    <p class="eyebrow">CURRENT STAGE</p>
    <h3>你現在在：${escapeHtml(workflowStepMeta[next.key]?.label ?? "新一輪起稿")}</h3>
    <p>${escapeHtml(next.text)}</p>
    <p>目前沒有任何資料會被寫入正式引擎。</p>
  `;
  const completed = steps.filter((item) => ["completed", "confirmed", "resolved"].includes(item.status));
  $("#workbench-completed").innerHTML = `
    <strong>已完成項目</strong>
    <span>${escapeHtml(completed.map((item) => workflowStepMeta[item.key]?.label ?? item.label).join("、") || "尚無")}</span>
  `;
  const later = steps.filter((item) => ["deferred", "optional"].includes(item.status));
  $("#workbench-later").innerHTML = `
    <strong>可稍後處理</strong>
    <span>${escapeHtml(later.map((item) => workflowStepMeta[item.key]?.label ?? item.label).join("、") || "目前沒有")}</span>
  `;

  // show raw JSON for debug (hidden by default)
  pre.textContent = JSON.stringify(workbench, null, 2);
  renderFeedbackLearning(feedbackPayload.feedback_learning ?? {});
  renderOperatorOverview();
}

function feedbackRecordId(record) {
  return record.feedback_id
    ?? record.digest_id
    ?? record.rule_candidate_id
    ?? record.proposal_id
    ?? record.application_id
    ?? record.approval_item_id
    ?? "unknown";
}

function feedbackRecordMeta(record) {
  const status = record.status?.status ?? record.status ?? "";
  const mode = record.proposed_patch?.mode ?? record.applied_patch?.mode ?? "";
  const risk = record.risk_level
    ?? (record.risk?.requires_approval ? "approval required" : "");
  return [record.created_at, status, mode, risk].filter(Boolean).join(" · ");
}

function feedbackRecordsHtml(title, records) {
  return `
    <section class="feedback-learning-group">
      <h4>${escapeHtml(title)} <span>${records.length}</span></h4>
      ${records.length
        ? records.slice(0, 5).map((record) => `
          <article class="feedback-learning-record">
            <strong>${escapeHtml(feedbackRecordId(record))}</strong>
            <small>${escapeHtml(feedbackRecordMeta(record) || "metadata available")}</small>
            ${record.diff_summary
              ? `<p>${escapeHtml(record.diff_summary)}</p>`
              : ""}
            ${record.metadata?.rollback_metadata_available
              ? "<small>Rollback metadata available</small>"
              : ""}
          </article>
        `).join("")
        : '<div class="empty-state">No records</div>'}
    </section>
  `;
}

function renderFeedbackLearning(feedback) {
  const groups = [
    ["Feedback items", feedback.items ?? []],
    ["Digests", feedback.digests ?? []],
    ["Rule candidates", feedback.rule_candidates ?? []],
    ["Compressed rule proposals", feedback.compressed_rule_proposals ?? []],
    ["Rule applications", feedback.compressed_rule_applications ?? []],
    ["Pending approvals", feedback.pending_approvals ?? []],
  ];
  $("#feedback-learning-summary").innerHTML = groups.map(([label, records]) => `
    <div><strong>${records.length}</strong><span>${escapeHtml(label)}</span></div>
  `).join("");
  $("#feedback-learning-records").innerHTML = groups
    .map(([label, records]) => feedbackRecordsHtml(label, records))
    .join("");
  $("#feedback-learning-approval-count").textContent =
    `${(feedback.pending_approvals ?? []).length} pending`;
  const blocked = feedback.blocked ?? [];
  const nextAction = feedback.next_actions?.[0];
  $("#feedback-learning-next-action").innerHTML = `
    <strong>Next action:</strong>
    ${escapeHtml(nextAction?.label ?? "No pending action")}
    ${blocked.length
      ? `<span class="warning-panel">${escapeHtml(blocked.map((item) => item.reason).join(" · "))}</span>`
      : ""}
  `;
  $("#feedback-learning-raw").textContent = JSON.stringify(feedback, null, 2);
}

function renderOperatorOverview() {
  const next = primaryNextStep();
  $("#today-next-step-text").textContent = next.text;
  $("#today-next-step-button").dataset.goView = next.view;
  $("#today-next-step-button").textContent = `前往${titles[next.view]}`;

  const keys = [
    "writing_context",
    "chat_output_candidate",
    "proof_report",
    "adoption_request",
    "settlement_report",
    "pending_engine_candidate",
    "activation_request",
  ];
  const steps = keys.map((key) => workflowStep(key)).filter(Boolean);
  $("#workflow-overview-summary").textContent =
    `${steps.filter((item) => ["completed", "confirmed", "resolved"].includes(item.status)).length} / ${steps.length} 已完成`;
  $("#workflow-overview-steps").innerHTML = steps.map((step) => {
    const meta = workflowStepMeta[step.key] ?? { label: step.label, view: "writer-workbench" };
    return `
      <article class="operator-progress-step status-card-${escapeHtml(step.status)}">
        <div>
          <span class="status-badge status-${escapeHtml(step.status)}">${escapeHtml(operatorStatusLabel(step.status))}</span>
          <strong>${escapeHtml(meta.label)}</strong>
        </div>
        <p>${escapeHtml(workflowReason(step))}</p>
        <button class="text-button" type="button" data-go-view="${escapeHtml(meta.view)}">前往頁面</button>
      </article>
    `;
  }).join("");

  const visuals = state.data?.visuals ?? {};
  const diagnostics = visuals.diagnostics ?? {};
  $("#nav-badge-compose").textContent =
    operatorStatusLabel(workflowStep("writing_context")?.status ?? "unknown");
  $("#nav-badge-review").textContent =
    operatorStatusLabel(workflowStep("proof_report")?.status ?? "unknown");
  $("#nav-badge-settlement").textContent =
    operatorStatusLabel(workflowStep("settlement_report")?.status ?? "unknown");
  $("#nav-badge-approval").textContent =
    `${state.workbench?.approval_queue?.pending_count ?? 0} 待確認`;
  $("#nav-badge-visuals").textContent =
    `${diagnostics.indexRecords ?? visuals.count ?? 0} / ${diagnostics.pngFiles ?? 0}`;
  $("#nav-badge-neural").textContent =
    `${(state.neuralData.runs ?? []).filter((run) => run.warning).length} 注意`;
  $("#nav-badge-workbench").textContent =
    workflowStepMeta[next.key]?.label ?? "可開始";

  const drafts = state.workflow.drafts ?? [];
  const proofReports = state.workflow.proofReports ?? [];
  $("#review-conclusion").textContent = !drafts.length
    ? "尚無資料"
    : !proofReports.length
      ? "待驗稿"
      : proofReports.some((report) => report.status === "blocked") ? "停止採用" : "請查看驗稿結論";
  $("#review-conclusion-reason").textContent = !drafts.length
    ? "尚未保存正文候選。請先到起稿流程完成候選稿保存，再進行驗稿。"
    : !proofReports.length
      ? "已有候選稿，但尚未保存驗稿報告。請建立驗稿 context 後完成 P0-P4 檢查。"
      : "請依驗稿報告中的 P0-P4 與停止原因決定採用、修正或退稿。";
  $("#compose-empty-state").hidden = Boolean(workflowStep("writing_context")
    && workflowStep("writing_context").status !== "missing");
  $("#settlement-empty-state").hidden = (state.workflow.adoptedChapters ?? []).length > 0;
}

function bindWriterWorkbenchActions() {
  $("#writer-refresh-state").addEventListener("click", () => refreshWriterWorkbenchState().catch((e) => toast(e.message, true)));
  $("#writer-build-context").addEventListener("click", async () => {
    try {
      const body = { taskPrompt: $("#pipeline-task")?.value ?? "writer workbench test" };
      const result = await api("/api/writer-workbench/build-writing-context", { method: "POST", body: JSON.stringify(body) });
      toast("Context bundle 建立: " + (result.bundle?.bundle_id ?? "-"));
      refreshWriterWorkbenchState().catch(() => {});
    } catch (e) { toast(e.message, true); }
  });
  $("#writer-save-candidate").addEventListener("click", async () => {
    try {
      const body = { chatOutputText: $("#draft-text")?.value ?? "測試候選內容" };
      const result = await api("/api/writer-workbench/save-chat-output-candidate", { method: "POST", body: JSON.stringify(body) });
      toast("candidate 建立: " + (result.candidate?.writing_candidate_id ?? "-"));
      refreshWriterWorkbenchState().catch(() => {});
    } catch (e) { toast(e.message, true); }
  });
  $("#writer-build-proof").addEventListener("click", async () => {
    try {
      const body = { candidateId: $("#draft-run-id")?.value ?? null };
      const result = await api("/api/writer-workbench/build-proofing-context", { method: "POST", body: JSON.stringify(body) });
      toast("Proofing context 建立");
      refreshWriterWorkbenchState().catch(() => {});
    } catch (e) { toast(e.message, true); }
  });
}

function renderSources() {
  const sources = state.data?.sources ?? [];
  const warningCount = sources.filter((source) => source.warning || source.errors.length).length;
  $("#source-summary").textContent = warningCount
    ? `${sources.length - warningCount} 正常 · ${warningCount} 注意`
    : `${sources.length} 項正常`;
  $("#source-grid").innerHTML = sources.map((source) => {
    const badgeClass = source.errors.length
      ? " is-error"
      : source.warning
        ? " is-warning"
        : "";
    return `
      <button class="source-item" type="button" data-open-file="${escapeHtml(source.path)}">
        <span class="trust-badge${badgeClass}" title="${escapeHtml({
          T1: "正式正史",
          T3: "正式政策",
          T5: "錯誤報告",
          T6: "輔助記憶",
          T8: "衍生規則或工作資料",
        }[source.trust] ?? "來源信任層級")}">${escapeHtml(source.trust)}</span>
        <strong>${escapeHtml(source.label)}</strong>
        <span>${escapeHtml(source.version)} · ${formatBytes(source.bytes)}</span>
      </button>
    `;
  }).join("");
}

function renderOutputs() {
  const outputs = state.data?.outputs ?? [];
  $("#output-list").innerHTML = outputs.map((output) => `
    <div class="output-item">
      <div>
        <strong>${escapeHtml(output.label)}</strong>
        <span>${output.exists ? `${formatBytes(output.bytes)} · ${formatDate(output.modifiedAt)}` : "尚未建立"}</span>
      </div>
      <button class="text-button" type="button" data-open-file="${escapeHtml(output.path)}" ${output.exists ? "" : "disabled"}>檢視</button>
    </div>
  `).join("");
}

function renderCounts() {
  const counts = state.data?.counts ?? [];
  $("#count-strip").innerHTML = counts.map((item) => `
    <div class="count-item">
      <strong>${item.count}</strong>
      <span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
    </div>
  `).join("");
}

function renderLibrary() {
  const sources = state.data?.sources ?? [];
  const outputs = state.data?.outputs ?? [];
  $("#library-source-list").innerHTML = sources.map((source) => `
    <button class="library-item" type="button" data-library-file="${escapeHtml(source.path)}" data-library-title="${escapeHtml(source.label)}">
      <strong>${escapeHtml(source.label)}</strong>
      <span>${escapeHtml(source.trust)}</span>
    </button>
  `).join("");
  $("#library-output-list").innerHTML = outputs.map((output) => `
    <button class="library-item" type="button" data-library-file="${escapeHtml(output.path)}" data-library-title="${escapeHtml(output.label)}" ${output.exists ? "" : "disabled"}>
      <strong>${escapeHtml(output.label)}</strong>
      <span>${output.exists ? formatBytes(output.bytes) : "缺少"}</span>
    </button>
  `).join("");
}

function syncVisualFilters(visuals) {
  const characterSelect = $("#visual-character-filter");
  const categorySelect = $("#visual-category-filter");
  const statusSelect = $("#visual-status-filter");
  const currentCharacter = state.visualFilters.character || characterSelect.value;
  const currentCategory = state.visualFilters.category || categorySelect.value;
  const currentStatus = state.visualFilters.status || statusSelect.value;

  characterSelect.innerHTML = [
    '<option value="">全部角色</option>',
    ...(visuals.characters ?? []).map((character) => `
      <option value="${escapeHtml(character)}">${escapeHtml(character)}</option>
    `),
  ].join("");
  categorySelect.innerHTML = [
    '<option value="">全部分類</option>',
    ...(visuals.categories ?? []).map((category) => `
      <option value="${escapeHtml(category.key)}">${escapeHtml(category.label)}</option>
    `),
  ].join("");

  if ([...characterSelect.options].some((option) => option.value === currentCharacter)) {
    characterSelect.value = currentCharacter;
  }
  if ([...categorySelect.options].some((option) => option.value === currentCategory)) {
    categorySelect.value = currentCategory;
  }
  statusSelect.value = [...statusSelect.options].some((option) => option.value === currentStatus)
    ? currentStatus
    : "";
  state.visualFilters = {
    character: characterSelect.value,
    category: categorySelect.value,
    status: statusSelect.value,
  };
}

function syncVisualUploadCategories(visuals) {
  const select = $("#visual-upload-category");
  const current = select.value || "character_design";
  select.innerHTML = (visuals.categories ?? []).map((category) => `
    <option value="${escapeHtml(category.key)}">${escapeHtml(category.label)}</option>
  `).join("");
  select.value = [...select.options].some((option) => option.value === current)
    ? current
    : "character_design";
}

function visualMatchesFilters(item) {
  const filters = state.visualFilters;
  return (
    (!filters.character || item.character === filters.character)
    && (!filters.category || item.category === filters.category)
    && (!filters.status || item.canon_status === filters.status)
  );
}

function renderVisualDetail(item) {
  if (!item) {
    $("#visual-detail-path").textContent = "VISUAL REFERENCE";
    $("#visual-detail-title").textContent = "人設圖庫";
    $("#visual-detail").innerHTML = '<div class="empty-state">尚無圖像紀錄</div>';
    return;
  }
  $("#visual-detail-path").textContent = item.path || item.visual_id;
  $("#visual-detail-title").textContent = item.title || item.visual_id;
  const flags = [...(item.errors ?? []), ...(item.warnings ?? [])];
  $("#visual-detail").innerHTML = `
    <dl class="visual-facts">
      <div><dt>ID</dt><dd>${escapeHtml(item.visual_id)}</dd></div>
      <div><dt>角色</dt><dd>${escapeHtml(item.character)}</dd></div>
      <div><dt>分類</dt><dd>${escapeHtml(item.categoryLabel)}</dd></div>
      <div><dt>狀態</dt><dd>${escapeHtml(visualStatusLabel(item.canon_status))}</dd></div>
      <div><dt>信任</dt><dd>${escapeHtml(item.trust_level)}</dd></div>
      <div><dt>來源</dt><dd>${escapeHtml(item.source)}</dd></div>
      <div><dt>檔案</dt><dd>${item.exists ? `${formatBytes(item.bytes)} · ${formatDate(item.modifiedAt)}` : "缺少"}</dd></div>
    </dl>
    ${item.description ? `<p class="visual-notes">${escapeHtml(item.description)}</p>` : ""}
    ${item.notes ? `<p class="visual-notes">${escapeHtml(item.notes)}</p>` : ""}
    ${(item.tags ?? []).length ? `<div class="visual-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    ${flags.length ? `<div class="visual-flags">${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}</div>` : ""}
    ${item.canon_status !== "invalid" ? `
      <div class="visual-detail-actions">
        <button class="button danger" type="button" data-visual-delete="${escapeHtml(item.visual_id)}">刪除圖像</button>
      </div>
    ` : ""}
  `;
}

function renderVisuals() {
  const visuals = state.data?.visuals ?? {
    items: [],
    characters: [],
    categories: [],
    count: 0,
    errorCount: 0,
    warningCount: 0,
  };
  syncVisualFilters(visuals);
  syncVisualUploadCategories(visuals);
  const items = (visuals.items ?? []).filter(visualMatchesFilters);
  $("#visual-summary").textContent = visuals.errorCount || visuals.warningCount
    ? `${items.length}/${visuals.count} 張 · ${visuals.errorCount} 錯誤 · ${visuals.warningCount} 注意`
    : `${items.length}/${visuals.count} 張`;
  const diagnostics = visuals.diagnostics ?? {
    indexRecords: visuals.count ?? 0,
    pngFiles: 0,
    gitIgnored: false,
  };
  $("#visual-index-records").textContent = String(diagnostics.indexRecords);
  $("#visual-png-files").textContent = String(diagnostics.pngFiles);
  $("#visual-git-ignored").textContent = diagnostics.gitIgnored ? "true（已忽略）" : "false（未忽略）";
  $("#visual-diagnostic-message").textContent = diagnostics.indexRecords > 0
    ? `圖庫索引正常，UI 可讀取 ${diagnostics.indexRecords} 筆圖像紀錄。`
    : diagnostics.pngFiles > 0
      ? "圖片檔案存在，但尚未建立索引，因此 UI 暫時不顯示。"
      : "尚未上傳或匯入圖像。";

  if (!items.some((item) => item.visual_id === state.activeVisualId)) {
    state.activeVisualId = items[0]?.visual_id ?? "";
  }

  $("#visual-grid").innerHTML = items.length
    ? items.map((item) => {
      const flagClass = item.errors?.length
        ? " is-error"
        : item.warnings?.length
          ? " is-warning"
          : "";
      return `
        <button class="visual-card${state.activeVisualId === item.visual_id ? " is-active" : ""}" type="button" data-visual-id="${escapeHtml(item.visual_id)}">
          <span class="visual-thumb">
            ${item.assetUrl && item.exists
              ? `<img src="${escapeHtml(item.assetUrl)}" alt="${escapeHtml(item.title)}">`
              : `<span aria-hidden="true">◇</span>`}
          </span>
          <span class="trust-badge${flagClass}">${escapeHtml(item.trust_level || "N/A")}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.character || "未指定")} · ${escapeHtml(item.categoryLabel)}</span>
        </button>
      `;
    }).join("")
    : `<div class="empty-state">${
      diagnostics.pngFiles > 0
        ? "目前沒有可顯示的索引紀錄。圖片檔案仍存在，請使用安全的本地 reindex 工具建立索引。"
        : "目前沒有圖像。尚未上傳或匯入圖片，可由左側上傳第一張視覺參考。"
    }</div>`;

  renderVisualDetail(items.find((item) => item.visual_id === state.activeVisualId));
}

function renderNeuralStatus() {
  const runs = state.neuralData.runs ?? [];
  const traces = state.neuralData.traces ?? [];
  const successRuns = runs.filter((run) => (
    traces.some((trace) => trace.run_id === run.run_id && trace.status === "success")
  )).length;
  const warningRuns = runs.filter((run) => run.warning).length;
  const failedRuns = runs.filter((run) => (
    traces.some((trace) => trace.run_id === run.run_id && trace.status === "failed")
  )).length;
  const runningRuns = runs.filter((run) => run.status === "running").length;
  $("#neural-summary").textContent = `${runs.length} runs · ${successRuns} 已使用 · ${warningRuns} warning`;
  const latestWarning = runs.find((run) => run.warning)?.warning ?? "";
  $("#neural-summary-grid").innerHTML = `
    <div><strong>${runs.length}</strong><span>總 runs</span></div>
    <div><strong>${warningRuns}</strong><span>注意 runs</span></div>
    <div><strong>${failedRuns}</strong><span>失敗 runs</span></div>
    <div><strong>${runningRuns}</strong><span>執行中 runs</span></div>
  `;
  $("#neural-warning-explanation").textContent = warningRuns
    ? `本地神經模型尚未設定，系統已跳過此模組，不影響主流程。${latestWarning ? ` 最新原因：${latestWarning}` : ""}`
    : "神經模組目前是輔助 trace，不是正文生成必要條件。";

  if (!runs.some((run) => run.run_id === state.activeNeuralRunId)) {
    state.activeNeuralRunId = runs[0]?.run_id ?? "";
  }
  $("#neural-run-list").innerHTML = runs.length
    ? runs.map((run) => {
      const runTraces = traces.filter((trace) => trace.run_id === run.run_id);
      const status = neuralStatusMeta(run, runTraces);
      return `
        <button class="neural-run-item${state.activeNeuralRunId === run.run_id ? " is-active" : ""}" type="button" data-neural-run-id="${escapeHtml(run.run_id)}">
          <span>
            <strong>${escapeHtml(run.task_type)}</strong>
            <small>${escapeHtml(run.run_id)}</small>
          </span>
          <span class="${status.className}">${status.label}</span>
        </button>
      `;
    }).join("")
    : '<div class="empty-state">尚無 agent run</div>';

  const run = runs.find((item) => item.run_id === state.activeNeuralRunId);
  const runTraces = traces.filter((trace) => trace.run_id === state.activeNeuralRunId);
  if (!run) {
    $("#neural-detail-run-id").textContent = "NO RUN SELECTED";
    $("#neural-detail-title").textContent = "神經模組使用證據";
    $("#neural-detail-status").className = "neural-status-missing";
    $("#neural-detail-status").textContent = "未使用";
    $("#neural-run-facts").innerHTML = "";
    $("#neural-trace-list").innerHTML = '<div class="empty-state">選擇左側 run 查看 neural_trace</div>';
    return;
  }

  const status = neuralStatusMeta(run, runTraces);
  $("#neural-detail-run-id").textContent = "TECHNICAL DETAILS";
  $("#neural-detail-title").textContent = run.task_type;
  $("#neural-detail-status").className = status.className;
  $("#neural-detail-status").textContent = status.label;
  $("#neural-run-facts").innerHTML = `
    <div><dt>目前狀態</dt><dd>${escapeHtml(operatorStatusLabel(run.status))}</dd></div>
    <div><dt>用途</dt><dd>輔助 trace，不是正文生成必要條件</dd></div>
    <details class="technical-details neural-technical-details">
      <summary>技術詳情：run_id、hash 與必要模組</summary>
      <dl>
        <div><dt>run_id</dt><dd>${escapeHtml(run.run_id)}</dd></div>
        <div><dt>required_neural_modules</dt><dd>${escapeHtml((run.required_neural_modules ?? []).join(", ") || "none")}</dd></div>
        <div><dt>input_hash</dt><dd>${escapeHtml(run.input_hash)}</dd></div>
        <div><dt>output_hash</dt><dd>${escapeHtml(run.output_hash ?? "null")}</dd></div>
      </dl>
    </details>
  `;
  $("#neural-trace-list").innerHTML = runTraces.length
    ? runTraces.map((trace) => `
      <article class="neural-trace-item">
        <div class="neural-trace-heading">
          <div>
            <strong>${escapeHtml(trace.module_name)}</strong>
            <span>${escapeHtml(trace.model_name)} · ${escapeHtml(trace.model_version)}</span>
          </div>
          <span class="neural-status-${escapeHtml(trace.status)}">${escapeHtml(trace.status)}</span>
        </div>
        <details class="technical-details">
          <summary>技術詳情：trace、hash 與 raw summary</summary>
        <dl class="neural-trace-facts">
          <div><dt>trace_id</dt><dd>${escapeHtml(trace.trace_id)}</dd></div>
          <div><dt>called_at</dt><dd>${escapeHtml(trace.called_at)}</dd></div>
          <div><dt>latency_ms</dt><dd>${escapeHtml(trace.latency_ms)}</dd></div>
          <div><dt>input_hash</dt><dd>${escapeHtml(trace.input_hash ?? "null")}</dd></div>
          <div><dt>output_hash</dt><dd>${escapeHtml(trace.output_hash ?? "null")}</dd></div>
          <div><dt>warnings</dt><dd>${escapeHtml(JSON.stringify(trace.warnings ?? []))}</dd></div>
          <div><dt>error_message</dt><dd>${escapeHtml(trace.error_message ?? "null")}</dd></div>
          <div><dt>input_summary</dt><dd>${escapeHtml(JSON.stringify(trace.input_summary ?? {}))}</dd></div>
          <div><dt>output_summary</dt><dd>${escapeHtml(JSON.stringify(trace.output_summary ?? {}))}</dd></div>
        </dl>
        </details>
      </article>
    `).join("")
    : '<div class="empty-state">沒有 neural_trace，因此不得宣稱已使用神經網路模型。</div>';
}

async function loadNeuralStatus(showToast = false) {
  const [runsPayload, tracesPayload] = await Promise.all([
    api("/api/agent/runs"),
    api("/api/neural/traces"),
  ]);
  state.neuralData = {
    runs: runsPayload.runs ?? [],
    traces: tracesPayload.traces ?? [],
  };
  renderNeuralStatus();
  if (showToast) toast("神經模組狀態已重新整理");
}

function candidateStatusLabel(status) {
  return {
    candidate: "候選",
    blocked: "已阻擋",
    rejected: "已放棄",
    activated: "已啟用",
  }[status] ?? status ?? "未知";
}

function riskLabel(level) {
  return {
    low: "低風險",
    medium: "中風險",
    high: "高風險，Phase 3 啟用時需要二次確認",
    critical: "嚴重風險，已 blocked，不得啟用",
  }[level] ?? level ?? "未評估";
}

function renderCandidateList(candidates) {
  const list = candidates ?? [];
  if (!list.some((candidate) => candidate.candidate_id === state.activeCandidateId)) {
    state.activeCandidateId = list[0]?.candidate_id ?? "";
  }
  $("#pending-candidate-list").innerHTML = list.length
    ? list.map((candidate) => `
      <button class="candidate-list-item${candidate.candidate_id === state.activeCandidateId ? " is-active" : ""}" type="button" data-candidate-id="${escapeHtml(candidate.candidate_id)}">
        <span>
          <strong>${escapeHtml(candidate.source_chapter || "未指定章節")}</strong>
          <small>${escapeHtml(candidate.candidate_id)}</small>
        </span>
        <span class="candidate-list-meta">
          <span class="risk-${escapeHtml(candidate.risk_level)}">${escapeHtml(riskLabel(candidate.risk_level))}</span>
          <span class="candidate-status candidate-status-${escapeHtml(candidate.status)}">${escapeHtml(candidateStatusLabel(candidate.status))}</span>
        </span>
      </button>
    `).join("")
    : '<div class="empty-state">尚無 pending candidate</div>';
}

function renderRiskReport(report) {
  if (!report) {
    $("#candidate-risk-report").innerHTML = '<div class="empty-state">尚無 risk report</div>';
    return;
  }
  $("#candidate-risk-report").innerHTML = `
    <div class="risk-heading risk-${escapeHtml(report.risk_level)}">${escapeHtml(riskLabel(report.risk_level))}</div>
    <dl class="candidate-facts">
      <div><dt>requires_second_confirmation</dt><dd>${report.requires_second_confirmation ? "true" : "false"}</dd></div>
      <div><dt>delete_ratio</dt><dd>${escapeHtml(report.delete_ratio)}</dd></div>
      <div><dt>candidate_length_ratio</dt><dd>${escapeHtml(report.candidate_length_ratio)}</dd></div>
      <div><dt>matched_keywords</dt><dd>${escapeHtml((report.matched_keywords ?? []).join(", ") || "none")}</dd></div>
      <div><dt>blocked_terms</dt><dd>${escapeHtml((report.blocked_terms ?? []).join(", ") || "none")}</dd></div>
      <div><dt>warnings</dt><dd>${escapeHtml((report.warnings ?? []).join("；") || "none")}</dd></div>
    </dl>
  `;
}

function renderDiff(diff) {
  if (!diff) {
    $("#candidate-diff-summary").innerHTML = '<div class="empty-state">此候選沒有可顯示的 diff</div>';
    $("#candidate-raw-diff").textContent = "沒有 diff。";
    return;
  }
  $("#candidate-diff-summary").innerHTML = `
    <span class="diff-added">新增 ${escapeHtml(diff.summary?.added_count ?? 0)}</span>
    <span class="diff-deleted">刪除 ${escapeHtml(diff.summary?.deleted_count ?? 0)}</span>
    <span class="diff-modified">修改 ${escapeHtml(diff.summary?.modified_count ?? 0)}</span>
  `;
  $("#candidate-raw-diff").textContent = diff.raw_unified_diff ?? "";
}

function renderCandidateDetail(detail) {
  const reparseButton = $("#candidate-reparse-button");
  const rejectButton = $("#candidate-reject-button");
  const activateButton = $("#candidate-activate-button");
  if (!detail) {
    $("#candidate-detail-id").textContent = "NO CANDIDATE SELECTED";
    $("#candidate-detail-status").className = "candidate-status candidate-status-blocked";
    $("#candidate-detail-status").textContent = "未選擇";
    $("#pending-candidate-detail").innerHTML = "";
    $("#candidate-blocked-reason").innerHTML = "";
    $("#candidate-engine-preview").textContent = "";
    $("#candidate-raw-preview").textContent = "";
    renderDiff(null);
    renderRiskReport(null);
    reparseButton.disabled = true;
    rejectButton.disabled = true;
    activateButton.disabled = true;
    $("#candidate-second-confirm-panel").hidden = true;
    return;
  }
  const { metadata, status, risk_report: riskReport } = detail;
  $("#candidate-detail-id").textContent = metadata.candidate_id;
  $("#candidate-detail-status").className = `candidate-status candidate-status-${status.status}`;
  $("#candidate-detail-status").textContent = candidateStatusLabel(status.status);
  $("#pending-candidate-detail").innerHTML = `
    <div><dt>source_chapter</dt><dd>${escapeHtml(metadata.source_chapter || "未指定")}</dd></div>
    <div><dt>created_at</dt><dd>${escapeHtml(metadata.created_at)}</dd></div>
    <div><dt>candidate_hash</dt><dd>${escapeHtml(metadata.candidate_hash || "none")}</dd></div>
    <div><dt>active_engine_hash_at_import</dt><dd>${escapeHtml(metadata.active_engine_hash_at_import || "none")}</dd></div>
    <div><dt>run_id</dt><dd>${escapeHtml(metadata.run_id || "none")}</dd></div>
    <div><dt>requires_neural_modules</dt><dd>${metadata.requires_neural_modules ? "true" : "false"}</dd></div>
    <div><dt>neural_modules_used_path</dt><dd>${escapeHtml(metadata.neural_modules_used_path || "none")}</dd></div>
    <div><dt>eligible_for_phase_3_activation</dt><dd>${status.eligible_for_phase_3_activation ? "true" : "false"}</dd></div>
    <div><dt>note</dt><dd>${escapeHtml(metadata.note || "none")}</dd></div>
  `;
  $("#candidate-blocked-reason").innerHTML = status.blocked_reason
    ? `<div class="blocked-panel"><strong>Blocked</strong><span>${escapeHtml(status.blocked_reason)}</span></div>`
    : "";
  $("#candidate-engine-preview").textContent = detail.candidate_preview ?? "";
  $("#candidate-raw-preview").textContent = detail.raw_import_preview ?? "";
  renderDiff(detail.diff);
  renderRiskReport(riskReport);
  const finalStatus = ["rejected", "activated"].includes(status.status);
  reparseButton.disabled = finalStatus;
  rejectButton.disabled = finalStatus;
  $("#candidate-second-confirm-panel").hidden = riskReport?.requires_second_confirmation !== true;
  updateActivationControls();
}

function updateActivationControls() {
  const detail = state.canon.candidateDetail;
  const button = $("#candidate-activate-button");
  if (!detail) {
    button.disabled = true;
    return;
  }
  const validCandidate = detail.status.status === "candidate"
    && detail.risk_report?.risk_level !== "critical";
  const baseConfirmed = $("#candidate-activation-confirm").checked;
  const needsSecond = detail.risk_report?.requires_second_confirmation === true;
  const secondConfirmed = !needsSecond || (
    $("#candidate-second-confirm").checked
    && $("#candidate-second-confirm-text").value.trim() === "確認啟用"
  );
  button.disabled = !(validCandidate && baseConfirmed && secondConfirmed);
}

function renderSnapshots(snapshots) {
  const rollbackConfirmed = $("#rollback-confirm").checked;
  $("#snapshot-list").innerHTML = snapshots?.length
    ? snapshots.map((snapshot) => `
      <article class="snapshot-item">
        <div>
          <strong>${escapeHtml(snapshot.source_chapter || "未指定章節")}</strong>
          <small>${escapeHtml(snapshot.snapshot_id)}</small>
          <span>${escapeHtml(formatDate(snapshot.created_at))} · ${escapeHtml((snapshot.active_engine_hash ?? "").slice(0, 12))}</span>
        </div>
        <button class="button secondary" type="button" data-rollback-snapshot="${escapeHtml(snapshot.snapshot_id)}" ${rollbackConfirmed && snapshot.rollback_available ? "" : "disabled"}>
          回滾
        </button>
      </article>
    `).join("")
    : '<div class="empty-state">尚無 snapshot</div>';
}

function renderActivationLogs(logs) {
  $("#activation-log-list").innerHTML = logs?.length
    ? logs.map((entry) => `
      <article class="activation-log-item">
        <strong>${entry.event === "rollback_active_engine" ? "Rollback" : "Activation"}</strong>
        <span>${escapeHtml(entry.candidate_id || entry.target_snapshot_id || "")}</span>
        <small>${escapeHtml(entry.activated_at || entry.rollback_at || "")}</small>
        <code>${escapeHtml(entry.active_engine_after_hash || "")}</code>
      </article>
    `).join("")
    : '<div class="empty-state">尚無 activation log</div>';
}

function renderSettlementPanel() {
  const active = state.canon.activeEngine;
  if (!active) {
    $("#active-engine-status").textContent = "尚未讀取 active_engine";
  } else if (!active.active_engine_exists) {
    $("#active-engine-status").className = "active-engine-status is-error";
    $("#active-engine-status").textContent = active.blocked_reason;
  } else {
    $("#active-engine-status").className = "active-engine-status";
    $("#active-engine-status").textContent = `${formatBytes(active.active_engine_size)} · ${active.active_engine_hash.slice(0, 12)}`;
  }
  renderCandidateList(state.canon.candidates);
  renderCandidateDetail(state.canon.candidateDetail);
  renderSnapshots(state.canon.snapshots);
  renderActivationLogs(state.canon.activationLogs);
}

async function loadCandidateDetail(candidateId) {
  if (!candidateId) {
    state.canon.candidateDetail = null;
    renderSettlementPanel();
    return;
  }
  const payload = await api(`/api/canon/pending-candidates/${encodeURIComponent(candidateId)}`);
  state.activeCandidateId = candidateId;
  state.canon.candidateDetail = payload.candidate;
  $("#candidate-activation-confirm").checked = false;
  $("#candidate-second-confirm").checked = false;
  $("#candidate-second-confirm-text").value = "";
  renderSettlementPanel();
}

async function refreshCanonSettlementState(showToast = false) {
  const [activePayload, candidatesPayload, snapshotsPayload, logsPayload] = await Promise.all([
    api("/api/canon/active-engine/status"),
    api("/api/canon/pending-candidates"),
    api("/api/canon/snapshots"),
    api("/api/canon/activation-logs"),
  ]);
  state.canon.activeEngine = activePayload.active_engine;
  state.canon.candidates = candidatesPayload.candidates ?? [];
  state.canon.snapshots = snapshotsPayload.snapshots ?? [];
  state.canon.activationLogs = logsPayload.logs ?? [];
  if (!state.canon.candidates.some((candidate) => candidate.candidate_id === state.activeCandidateId)) {
    state.activeCandidateId = state.canon.candidates[0]?.candidate_id ?? "";
  }
  state.canon.candidateDetail = null;
  renderSettlementPanel();
  if (state.activeCandidateId) await loadCandidateDetail(state.activeCandidateId);
  if (showToast) toast("結算候選已重新整理");
}

async function handleSettlementImport(event) {
  event.preventDefault();
  try {
    const payload = await api("/api/canon/settlement/import", {
      method: "POST",
      body: JSON.stringify({
        sourceChapter: $("#settlement-source-chapter").value.trim(),
        note: $("#settlement-note").value.trim(),
        rawText: $("#settlement-raw-text").value,
      }),
    });
    state.activeCandidateId = payload.candidate.metadata.candidate_id;
    $("#settlement-raw-text").value = "";
    await refreshCanonSettlementState();
    toast(payload.candidate.status.status === "blocked" ? "候選已保存，但目前被阻擋" : "Pending candidate 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleReparseCandidate() {
  if (!state.activeCandidateId) return;
  try {
    await api(`/api/canon/pending-candidates/${encodeURIComponent(state.activeCandidateId)}/reparse`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await refreshCanonSettlementState();
    toast("候選已重新解析");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleRejectCandidate() {
  if (!state.activeCandidateId || !window.confirm("確定放棄這個 pending candidate？")) return;
  const reason = window.prompt("放棄原因（可留空）", "") ?? "";
  try {
    await api(`/api/canon/pending-candidates/${encodeURIComponent(state.activeCandidateId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await refreshCanonSettlementState();
    toast("候選已標記為放棄");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleActivateCandidate() {
  if (!state.activeCandidateId || $("#candidate-activate-button").disabled) return;
  const needsSecond = state.canon.candidateDetail?.risk_report?.requires_second_confirmation === true;
  if (!window.confirm("這會更新 active_engine.md。確定繼續啟用？")) return;
  try {
    await api("/api/approval-queue/scan", {
      method: "POST",
      body: JSON.stringify({
        confirm: true,
        secondConfirm: needsSecond,
        approvedBy: "local_user",
      }),
    });
    await refreshCanonSettlementState();
    toast("新版 active_engine 已啟用，snapshot 與 archive 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleRollbackSnapshot(snapshotId) {
  if (!$("#rollback-confirm").checked) return;
  if (!window.confirm(`確定回滾至 ${snapshotId}？目前引擎會先建立 safety snapshot。`)) return;
  try {
    await api(`/api/canon/rollback/${encodeURIComponent(snapshotId)}`, {
      method: "POST",
      body: JSON.stringify({
        confirm: true,
        approvedBy: "local_user",
      }),
    });
    $("#rollback-confirm").checked = false;
    await refreshCanonSettlementState();
    toast("active_engine 已完成回滾");
  } catch (error) {
    toast(error.message, true);
  }
}

function renderDraftSelect() {
  const drafts = state.workflow.drafts ?? [];
  const select = $("#draft-select");
  const current = select.value;
  select.innerHTML = [
    '<option value="">選擇候選稿</option>',
    ...drafts.map((draft) => `
      <option value="${escapeHtml(draft.draft_id)}" data-id="${escapeHtml(draft.draft_id)}" data-chapter="${escapeHtml(draft.source_chapter ?? "")}">
        ${escapeHtml(draft.source_chapter || draft.draft_id)} · ${escapeHtml(candidateStatusLabel(draft.status))}
      </option>
    `),
  ].join("");
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function workflowStatusClass(status) {
  if (["rejected", "blocked"].includes(status)) return "candidate-status-blocked";
  if (status === "archived") return "candidate-status-rejected";
  if (status === "accepted_pending_settlement") return "candidate-status-activated";
  return "candidate-status-candidate";
}

function neuralUsageHtml(usage) {
  if (!usage?.traces?.length) {
    return '<div class="empty-state">未使用 / 缺少 trace</div>';
  }
  return usage.traces.map((trace) => `
    <article class="workflow-neural-item">
      <strong>${escapeHtml(trace.module_name)}</strong>
      <span>${escapeHtml(trace.model_name)} · ${escapeHtml(trace.model_version)}</span>
      <small>${escapeHtml(trace.trace_id)} · ${escapeHtml(trace.status)} · ${escapeHtml(trace.latency_ms)} ms</small>
      <small>${escapeHtml((trace.warnings ?? []).join("；") || trace.error_message || "no warnings")}</small>
    </article>
  `).join("");
}

function approvalStatusClass(status) {
  if (status === "blocked") return "candidate-status-blocked";
  if (status === "rejected") return "candidate-status-rejected";
  if (status === "resolved" || status === "confirmed") return "candidate-status-activated";
  return "candidate-status-candidate";
}

function renderApprovalQueue() {
  const items = state.approval.items ?? [];
  $("#approval-queue-count").textContent = String(items.length);
  const laterTypes = new Set(["restore_from_backup", "rollback_active_engine", "cleanup_proposal"]);
  const isHistory = (item) => ["resolved", "confirmed", "rejected"].includes(item.status?.status);
  const groups = [
    ["目前主流程必須處理", items.filter((item) => !laterTypes.has(item.action_type) && !isHistory(item))],
    ["可稍後處理", items.filter((item) => laterTypes.has(item.action_type) && !isHistory(item))],
    ["歷史與已處理", items.filter(isHistory)],
  ];
  const itemHtml = (item) => `
      <button class="approval-item${item.approval_item_id === state.activeApprovalItemId ? " is-active" : ""}${item.risk_level === "high" ? " is-high-risk" : ""}" type="button" data-approval-item-id="${escapeHtml(item.approval_item_id)}">
        <span>
          <strong>${escapeHtml(item.title || item.action_type)}</strong>
          <small>${escapeHtml(item.source_chapter || item.target_type || "未指定來源")}</small>
        </span>
        <span>
          <span class="candidate-status ${approvalStatusClass(item.status.status)}">${escapeHtml(operatorStatusLabel(item.status.status))}</span>
          <small>${escapeHtml(riskLabel(item.risk_level))}</small>
        </span>
      </button>
  `;
  $("#approval-item-list").innerHTML = items.length
    ? groups.map(([label, groupItems]) => `
      <section class="approval-group">
        <h3>${escapeHtml(label)} <span>${groupItems.length}</span></h3>
        ${groupItems.length
          ? groupItems.map(itemHtml).join("")
          : '<div class="operator-empty compact-empty">目前沒有項目。</div>'}
      </section>
    `).join("")
    : '<div class="empty-state">尚無 approval item</div>';

  const snapshotSelect = $("#approval-snapshot-select");
  const currentSnapshot = snapshotSelect.value;
  snapshotSelect.innerHTML = [
    '<option value="">選擇 snapshot</option>',
    ...(state.canon.snapshots ?? [])
      .filter((snapshot) => snapshot.rollback_available)
      .map((snapshot) => `
        <option value="${escapeHtml(snapshot.snapshot_id)}">
          ${escapeHtml(snapshot.snapshot_id)} · ${escapeHtml(snapshot.source_chapter || "未指定章節")}
        </option>
      `),
  ].join("");
  if ([...snapshotSelect.options].some((option) => option.value === currentSnapshot)) {
    snapshotSelect.value = currentSnapshot;
  }
  $("#create-rollback-approval-button").disabled = !snapshotSelect.value;

  const item = state.approval.detail;
  $("#approval-detail-id").textContent = item ? "APPROVAL DETAILS" : "NO ITEM SELECTED";
  $("#approval-detail-title").textContent = item?.title ?? "確認項目詳情";
  $("#approval-detail-status").textContent =
    item ? operatorStatusLabel(item.status?.status) : "未選擇";
  $("#approval-detail-status").className =
    `candidate-status ${approvalStatusClass(item?.status?.status ?? "blocked")}`;
  $("#approval-detail-facts").innerHTML = item
    ? `
      <span>操作類型 · ${escapeHtml(item.action_type)}</span>
      <span>來源章節 · ${escapeHtml(item.source_chapter || "未指定")}</span>
      <span>風險 · ${escapeHtml(riskLabel(item.risk_level))}</span>
      <span>神經狀態 · ${escapeHtml(operatorStatusLabel(item.neural_status))}</span>
      <details class="technical-details">
        <summary>技術詳情：target 與長 ID</summary>
        <p>${escapeHtml(item.target_type)} · ${escapeHtml(item.target_id)}</p>
        <p>${escapeHtml(item.approval_item_id)}</p>
      </details>
    `
    : "";
  $("#approval-impact-summary").innerHTML = item
    ? `
      <div><strong>這會修改什麼？</strong><span>${escapeHtml((item.impact?.will_modify ?? []).join("、") || "不修改既有正式資料")}</span></div>
      <div><strong>這會建立什麼？</strong><span>${escapeHtml((item.impact?.will_create ?? []).join("、") || "不建立額外資料")}</span></div>
      <div><strong>可否回復？</strong><span>${item.impact?.rollback_available ? "已有回復資訊" : "沒有自動回復能力"}</span></div>
    `
    : "";
  $("#approval-human-guidance").innerHTML = item
    ? `
      <p><strong>這不會修改什麼？</strong>未列在上方的正式資料不會因查看本項目而改變。</p>
      <p><strong>為什麼需要確認？</strong>${escapeHtml(
        item.risk_level === "high"
          ? "此操作可能影響正式資料或工作流狀態，需要人工確認。"
          : "此操作會建立或更新工作流紀錄，需要使用者明確決定。",
      )}</p>
      <p><strong>可以暫時忽略嗎？</strong>${
        item.action_type === "restore_from_backup"
          ? "這是資料還原請求，不是目前寫作必須處理。若你沒有要還原資料，可以暫時忽略。"
          : laterTypes.has(item.action_type)
            ? "可以。這項目預設不阻塞目前寫作主流程。"
            : "若主流程正在等待此項確認，延後會讓相對應階段維持待確認。"
      }</p>
    `
    : '<p>請先從左側選擇確認項目。</p>';
  $("#approval-blocked-reason").innerHTML = item?.blocked_reason
    ? `<div class="blocked-panel">${escapeHtml(item.blocked_reason)}</div>`
    : "";

  const blocked = !item
    || item.status.status === "blocked"
    || item.action_type === "neural_trace_missing"
    || Boolean(item.blocked_reason);
  const resolved = item && ["resolved", "confirmed", "rejected"].includes(item.status.status);
  const needsSecond = item?.requires_second_confirmation === true;
  const activationHighRisk = needsSecond && item?.action_type === "activate_engine_candidate";
  $("#approval-second-confirm-panel").hidden = !needsSecond;
  $("#approval-confirm-text-field").hidden = !activationHighRisk;
  $("#approval-confirm-message").textContent = !item
    ? "此操作將呼叫既有安全流程，不會直接寫 active_engine。"
    : item.action_type === "neural_trace_missing"
      ? "缺少必要 neural success trace。此項不可確認，只能延後或拒絕。"
      : item.action_type === "activate_engine_candidate"
        ? "這會使用 Phase 3 安全流程：snapshot → archive → active_engine → activation_log。"
        : item.action_type === "rollback_active_engine"
          ? "這會回滾 active_engine。系統會先建立 safety snapshot。"
          : "此驗稿含 P0 / P1，採用前必須再次人工確認。";
  const baseConfirmed = $("#approval-confirm-checkbox").checked;
  const secondConfirmed = !needsSecond || $("#approval-second-confirm-checkbox").checked;
  const textConfirmed = !activationHighRisk || $("#approval-confirm-text").value === "確認啟用";
  $("#approval-confirm-button").disabled =
    blocked || resolved || !baseConfirmed || !secondConfirmed || !textConfirmed;
  $("#approval-reject-button").disabled = !item || resolved;
  $("#approval-defer-button").disabled = !item || resolved;

  const logs = state.approval.logs ?? [];
  $("#approval-log-list").innerHTML = logs.length
    ? logs.map((log) => `
      <article class="approval-log-item">
        <strong>${escapeHtml(log.event)}</strong>
        <span>${escapeHtml(log.action_type)} · ${escapeHtml(log.target_id)}</span>
        <small>${escapeHtml(formatDate(log.created_at))} · ${escapeHtml(log.result)}</small>
        ${log.error_message ? `<small>${escapeHtml(log.error_message)}</small>` : ""}
      </article>
    `).join("")
    : '<div class="empty-state">尚無 approval log</div>';
}

async function loadApprovalItem(approvalItemId) {
  if (!approvalItemId) {
    state.activeApprovalItemId = "";
    state.approval.detail = null;
    renderApprovalQueue();
    return;
  }
  const payload = await api(`/api/approval-queue/items/${encodeURIComponent(approvalItemId)}`);
  state.activeApprovalItemId = approvalItemId;
  state.approval.detail = payload.item;
  $("#approval-confirm-checkbox").checked = false;
  $("#approval-second-confirm-checkbox").checked = false;
  $("#approval-confirm-text").value = "";
  renderApprovalQueue();
}

async function refreshApprovalQueue(showToast = false) {
  const [itemsPayload, logsPayload, snapshotsPayload] = await Promise.all([
    api("/api/approval-queue/items"),
    api("/api/approval-queue/logs"),
    api("/api/canon/snapshots"),
  ]);
  state.approval.items = itemsPayload.items ?? [];
  state.approval.logs = logsPayload.logs ?? [];
  state.canon.snapshots = snapshotsPayload.snapshots ?? [];
  if (!state.approval.items.some(
    (item) => item.approval_item_id === state.activeApprovalItemId,
  )) {
    state.activeApprovalItemId = state.approval.items[0]?.approval_item_id ?? "";
  }
  renderApprovalQueue();
  if (state.activeApprovalItemId) await loadApprovalItem(state.activeApprovalItemId);
  if (showToast) toast("確認佇列已重新整理");
}

async function handleScanApprovalQueue(snapshotId = "") {
  try {
    const payload = await api("/api/approval-queue/scan", {
      method: "POST",
      body: JSON.stringify({ snapshotId }),
    });
    if (payload.rollback_item?.approval_item_id) {
      state.activeApprovalItemId = payload.rollback_item.approval_item_id;
    }
    await refreshApprovalQueue();
    toast(snapshotId ? "Rollback item 已加入確認佇列" : "待確認項目掃描完成");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleApprovalDecision(action) {
  const item = state.approval.detail;
  if (!item) return;
  let body = {};
  if (action === "confirm") {
    body = {
      confirm: $("#approval-confirm-checkbox").checked,
      secondConfirm: $("#approval-second-confirm-checkbox").checked,
      approvalText: $("#approval-confirm-text").value,
      approvedBy: "local_user",
    };
  } else {
    const label = action === "reject" ? "拒絕" : "延後";
    const reason = window.prompt(`${label}原因（可留空）`, "");
    if (reason === null) return;
    body = { reason };
  }
  try {
    await api(
      `/api/approval-queue/items/${encodeURIComponent(item.approval_item_id)}/${action}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    await Promise.all([
      refreshApprovalQueue(),
      refreshCanonSettlementState(),
      refreshWorkflowState(),
    ]);
    toast(action === "confirm" ? "確認項目已由既有安全流程完成" : "確認項目狀態已更新");
  } catch (error) {
    await refreshApprovalQueue();
    toast(error.message, true);
  }
}

function cleanupPolicyInput() {
  return {
    keep_latest_archives: Number($("#cleanup-keep-archives").value),
    keep_latest_snapshots: Number($("#cleanup-keep-snapshots").value),
    rejected_candidate_days: Number($("#cleanup-rejected-days").value),
    failed_candidate_days: Number($("#cleanup-failed-days").value),
    blocked_candidate_days: Number($("#cleanup-blocked-days").value),
    trash_retention_days: Number($("#cleanup-trash-days").value),
  };
}

function cleanupStatusClass(status) {
  if (status === "executed" || status === "approved") return "candidate-status-activated";
  if (status === "rejected" || status === "blocked") return "candidate-status-blocked";
  if (status === "deferred") return "candidate-status-rejected";
  return "candidate-status-candidate";
}

function cleanupItemsHtml(items, emptyText) {
  if (!items?.length) return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  return items.map((item) => `
    <article class="cleanup-item cleanup-item-${escapeHtml(item.status)}">
      <div>
        <strong>${escapeHtml(item.item_id)}</strong>
        <small>${escapeHtml(item.item_type)} · ${escapeHtml(item.source_path)}</small>
      </div>
      <div>
        <span class="risk-${escapeHtml(item.risk_level)}">${escapeHtml(item.risk_level)}</span>
        <small>${escapeHtml(item.reason)}</small>
      </div>
    </article>
  `).join("");
}

function renderCleanup() {
  const proposals = state.cleanup.proposals ?? [];
  $("#cleanup-proposal-count").textContent = String(proposals.length);
  $("#cleanup-proposal-list").innerHTML = proposals.length
    ? proposals.map((proposal) => `
      <button class="cleanup-proposal-item${proposal.cleanup_proposal_id === state.activeCleanupProposalId ? " is-active" : ""}" type="button" data-cleanup-proposal-id="${escapeHtml(proposal.cleanup_proposal_id)}">
        <span>
          <strong>${escapeHtml(proposal.title)}</strong>
          <small>${escapeHtml(proposal.cleanup_proposal_id)}</small>
        </span>
        <span>
          <span class="candidate-status ${cleanupStatusClass(proposal.status.status)}">${escapeHtml(proposal.status.status)}</span>
          <small>${proposal.risk_summary?.eligible_count ?? 0} eligible</small>
        </span>
      </button>
    `).join("")
    : '<div class="empty-state">尚無 cleanup proposal</div>';

  const proposal = state.cleanup.detail;
  $("#cleanup-detail-id").textContent =
    proposal?.cleanup_proposal_id ?? "NO PROPOSAL SELECTED";
  $("#cleanup-detail-title").textContent = proposal?.title ?? "清理提案詳情";
  $("#cleanup-detail-status").textContent = proposal?.status?.status ?? "未選擇";
  $("#cleanup-detail-status").className =
    `candidate-status ${cleanupStatusClass(proposal?.status?.status ?? "blocked")}`;
  $("#cleanup-risk-summary").innerHTML = proposal
    ? `
      <span>eligible · ${proposal.risk_summary.eligible_count}</span>
      <span>high risk · ${proposal.risk_summary.high_risk_count}</span>
      <span>pinned · ${proposal.risk_summary.pinned_count}</span>
      <span>rollback required · ${proposal.risk_summary.rollback_required_count}</span>
    `
    : "";
  $("#cleanup-eligible-items").innerHTML =
    cleanupItemsHtml(proposal?.eligible_items, "沒有 eligible item");
  $("#cleanup-must-keep-items").innerHTML =
    cleanupItemsHtml(proposal?.must_keep_items, "沒有 must_keep item");
  $("#cleanup-review-items").innerHTML =
    cleanupItemsHtml(proposal?.needs_review_items, "沒有 needs_review item");
  $("#cleanup-blocked-items").innerHTML =
    cleanupItemsHtml(proposal?.blocked_items, "沒有 blocked item");

  const confirmed = $("#cleanup-confirm-checkbox").checked;
  const status = proposal?.status?.status;
  const hasEligible = (proposal?.eligible_items?.length ?? 0) > 0;
  $("#cleanup-approve-button").disabled =
    !proposal || !confirmed || !hasEligible || !["draft", "deferred"].includes(status);
  $("#cleanup-execute-button").disabled =
    !proposal || !confirmed || !hasEligible || status !== "approved";
  $("#cleanup-reject-button").disabled =
    !proposal || ["approved", "executed", "rejected"].includes(status);
  $("#cleanup-defer-button").disabled =
    !proposal || ["approved", "executed", "rejected"].includes(status);

  const logs = state.cleanup.logs ?? [];
  $("#cleanup-log-list").innerHTML = logs.length
    ? logs.map((log) => `
      <article class="cleanup-log-item">
        <strong>${escapeHtml(log.event)}</strong>
        <span>${escapeHtml(log.cleanup_proposal_id || "no proposal")} · ${escapeHtml(log.cleanup_trash_id || "no trash item")}</span>
        <small>${escapeHtml(formatDate(log.created_at))} · ${escapeHtml(log.result)}</small>
        ${log.error_message ? `<small>${escapeHtml(log.error_message)}</small>` : ""}
      </article>
    `).join("")
    : '<div class="empty-state">尚無 cleanup log</div>';
}

async function loadCleanupProposal(cleanupProposalId) {
  if (!cleanupProposalId) {
    state.activeCleanupProposalId = "";
    state.cleanup.detail = null;
    renderCleanup();
    return;
  }
  const payload = await api(
    `/api/cleanup/proposals/${encodeURIComponent(cleanupProposalId)}`,
  );
  state.activeCleanupProposalId = cleanupProposalId;
  state.cleanup.detail = payload.proposal;
  $("#cleanup-confirm-checkbox").checked = false;
  renderCleanup();
}

async function refreshCleanup(showToast = false) {
  const [proposalsPayload, logsPayload] = await Promise.all([
    api("/api/cleanup/proposals"),
    api("/api/cleanup/logs"),
  ]);
  state.cleanup.proposals = proposalsPayload.proposals ?? [];
  state.cleanup.logs = logsPayload.logs ?? [];
  if (!state.cleanup.proposals.some(
    (proposal) => proposal.cleanup_proposal_id === state.activeCleanupProposalId,
  )) {
    state.activeCleanupProposalId =
      state.cleanup.proposals[0]?.cleanup_proposal_id ?? "";
  }
  renderCleanup();
  if (state.activeCleanupProposalId) {
    await loadCleanupProposal(state.activeCleanupProposalId);
  }
  if (showToast) toast("封存清理資料已重新整理");
}

async function handleCleanupScan(createProposal = false) {
  try {
    const endpoint = createProposal ? "/api/cleanup/proposals" : "/api/cleanup/scan";
    const payload = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({
        retentionPolicy: cleanupPolicyInput(),
        createdBy: "local_ui",
      }),
    });
    if (payload.proposal?.cleanup_proposal_id) {
      state.activeCleanupProposalId = payload.proposal.cleanup_proposal_id;
      await refreshCleanup();
      toast("Cleanup proposal 已建立");
      return;
    }
    state.cleanup.scan = payload.scan;
    toast(`掃描完成：${payload.scan.risk_summary.eligible_count} 個 eligible item`);
    await refreshCleanup();
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleCleanupDecision(action) {
  const proposal = state.cleanup.detail;
  if (!proposal) return;
  let body;
  if (["approve", "execute"].includes(action)) {
    body = {
      confirm: $("#cleanup-confirm-checkbox").checked,
      approvedBy: "local_user",
    };
  } else {
    const label = action === "reject" ? "拒絕" : "延後";
    const reason = window.prompt(`${label}原因（可留空）`, "");
    if (reason === null) return;
    body = { reason };
  }
  try {
    await api(
      `/api/cleanup/proposals/${encodeURIComponent(proposal.cleanup_proposal_id)}/${action}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    await refreshCleanup();
    toast(action === "execute" ? "Eligible items 已搬入 trash" : "Cleanup proposal 已更新");
  } catch (error) {
    await refreshCleanup();
    toast(error.message, true);
  }
}

function renderSettlementWorkflow() {
  const adopted = state.workflow.adoptedChapters ?? [];
  const select = $("#settlement-adopted-select");
  const current = state.activeAdoptedChapterId || select.value;
  select.innerHTML = [
    '<option value="">選擇 accepted_pending_settlement 章節</option>',
    ...adopted.map((chapter) => `
      <option value="${escapeHtml(chapter.adopted_chapter_id)}">
        ${escapeHtml(chapter.adopted_chapter_id)} · ${escapeHtml(chapter.status)}
      </option>
    `),
  ].join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
  state.activeAdoptedChapterId = select.value;
  const selected = adopted.find(
    (chapter) => chapter.adopted_chapter_id === state.activeAdoptedChapterId,
  );
  $("#create-settlement-context-button").disabled =
    selected?.status !== "accepted_pending_settlement";

  const context = state.workflow.settlementContextDetail;
  $("#workflow-settlement-status").textContent = context
    ? `${context.status.status} · ${context.metadata.settlement_context_id}`
    : selected
      ? selected.status
      : "尚未選擇 adopted_chapter";
  $("#save-settlement-report-button").disabled =
    context?.status.can_save_settlement_report !== true;
  $("#settlement-context-detail").innerHTML = context
    ? `
      <div class="workflow-facts">
        <span>context · ${escapeHtml(context.metadata.settlement_context_id)}</span>
        <span>adopted · ${escapeHtml(context.metadata.adopted_chapter_id)}</span>
        <span>draft · ${escapeHtml(context.metadata.draft_id)}</span>
        <span>proof · ${escapeHtml(context.metadata.proof_report_id || "none")}</span>
        <span>active hash · ${escapeHtml(context.metadata.active_engine_hash)}</span>
        <span>chapter hash · ${escapeHtml(context.metadata.adopted_chapter_hash)}</span>
        <span class="${context.status.status === "blocked" ? "is-missing" : "is-ready"}">
          ${escapeHtml(context.status.status)}
        </span>
      </div>
      ${context.status.blocked_reason
        ? `<div class="blocked-panel">${escapeHtml(context.status.blocked_reason)}</div>`
        : ""}
      <div class="source-manifest-list">
        ${context.source_manifest.sources.map((source) => `
          <span class="${source.exists ? "is-ready" : "is-missing"}">
            ${escapeHtml(source.label)} · ${source.exists ? escapeHtml(source.hash) : "missing"}
          </span>
        `).join("")}
      </div>
    `
    : '<div class="empty-state">尚未建立 settlement_context</div>';

  const report = state.workflow.settlementReportDetail;
  $("#create-workflow-pending-candidate-button").disabled =
    report?.status.can_create_pending_candidate !== true;
  $("#settlement-report-detail").innerHTML = report
    ? `
      <div class="workflow-facts">
        <span>report · ${escapeHtml(report.metadata.settlement_report_id)}</span>
        <span>context · ${escapeHtml(report.metadata.settlement_context_id)}</span>
        <span>chapter · ${escapeHtml(report.metadata.source_chapter || "未指定")}</span>
        <span>hash · ${escapeHtml(report.metadata.settlement_hash)}</span>
        <span>status · ${escapeHtml(report.status.status)}</span>
        <span>candidate · ${escapeHtml(report.status.pending_candidate_id || "尚未建立")}</span>
      </div>
      <div class="workflow-neural-summary">${neuralUsageHtml(report.neural_usage)}</div>
      ${report.status.pending_candidate_id && state.workflow.settlementPendingCandidate ? `
        <div class="settlement-next-step">
          <strong>${escapeHtml(report.status.pending_candidate_id)}</strong>
          <span>
            ${escapeHtml(state.workflow.settlementPendingCandidate.status.status)}
            · risk ${escapeHtml(state.workflow.settlementPendingCandidate.risk_report.risk_level)}
          </span>
          ${state.workflow.settlementPendingCandidate.status.blocked_reason
            ? `<span>${escapeHtml(state.workflow.settlementPendingCandidate.status.blocked_reason)}</span>`
            : ""}
          <span>已建立 Phase 2 pending candidate。請在下方確認 diff / risk，Phase 3 仍需人工確認啟用。</span>
        </div>
      ` : ""}
    `
    : '<div class="empty-state">尚未保存 settlement_report</div>';
}

function renderWorkflowDraftList() {
  const drafts = state.workflow.drafts ?? [];
  $("#workflow-draft-list").innerHTML = drafts.length
    ? drafts.map((draft) => `
      <button class="workflow-draft-item${draft.draft_id === state.activeWorkflowDraftId ? " is-active" : ""}" type="button" data-workflow-draft-id="${escapeHtml(draft.draft_id)}">
        <span>
          <strong>${escapeHtml(draft.source_chapter || "未指定章節")}</strong>
          <small>${escapeHtml(draft.draft_id)}</small>
        </span>
        <span>
          <span class="candidate-status ${workflowStatusClass(draft.status)}">${escapeHtml(draft.status)}</span>
          <small>${escapeHtml((draft.draft_hash ?? "").slice(0, 12))}</small>
        </span>
      </button>
    `).join("")
    : '<div class="empty-state">尚無 candidate_draft</div>';
}

function renderProofSummary(detail) {
  const summary = detail?.issue_summary;
  const values = [
    summary?.p0_count ?? 0,
    summary?.p1_count ?? 0,
    summary?.p2_count ?? 0,
    summary?.p3_count ?? 0,
    summary?.p4_count ?? 0,
  ];
  $$("#proof-level-summary span").forEach((item, index) => {
    item.querySelector("strong").textContent = values[index];
    item.classList.toggle("is-severe", index < 2 && values[index] > 0);
  });
  $("#proof-report-detail").innerHTML = summary
    ? `
      <div class="${summary.can_adopt_recommendation ? "workflow-adopt-ok" : "blocked-panel"}">
        ${summary.can_adopt_recommendation ? "驗稿建議可採用" : "含 P0 / P1，人工採用前必須再次確認"}
      </div>
      ${(summary.issues ?? []).map((issue) => `
        <article class="proof-issue">
          <strong>${escapeHtml(issue.level)} · ${escapeHtml(issue.title)}</strong>
          <span>${escapeHtml(issue.description)}</span>
          <small>${escapeHtml(issue.suggested_action)}</small>
        </article>
      `).join("")}
    `
    : '<div class="empty-state">尚無 proof_report</div>';
}

function renderWorkflow() {
  renderWorkflowDraftList();
  renderDraftSelect();
  const draft = state.workflow.draftDetail;
  $("#review-draft-neural").innerHTML = draft ? neuralUsageHtml(draft.neural_usage) : "";
  renderProofSummary(state.workflow.proofDetail);
  const actionable = draft && !["rejected", "archived", "blocked", "accepted_pending_settlement"].includes(draft.status.status);
  $("#workflow-adopt-button").disabled = !actionable;
  $("#workflow-reject-button").disabled = !actionable;
  $("#workflow-archive-button").disabled = !actionable;
}

async function loadWorkflowDraft(draftId) {
  if (!draftId) {
    state.activeWorkflowDraftId = "";
    state.workflow.draftDetail = null;
    state.workflow.proofDetail = null;
    state.currentDraftText = "";
    $("#draft-preview").textContent = "尚未選擇候選稿。";
    renderWorkflow();
    return;
  }
  const payload = await api(`/api/workflow/candidate-drafts/${encodeURIComponent(draftId)}`);
  state.activeWorkflowDraftId = draftId;
  state.workflow.draftDetail = payload.draft;
  state.currentDraftText = payload.draft.draft_text;
  $("#draft-preview").textContent = payload.draft.draft_text;
  const proofId = payload.draft.status.proof_report_id;
  if (proofId) {
    const proofPayload = await api(`/api/workflow/proof-reports/${encodeURIComponent(proofId)}`);
    state.workflow.proofDetail = proofPayload.proof_report;
  } else {
    state.workflow.proofDetail = null;
  }
  renderWorkflow();
}

async function refreshWorkflowState(showToast = false) {
  const [draftsPayload, proofsPayload, adoptedPayload] = await Promise.all([
    api("/api/workflow/candidate-drafts"),
    api("/api/workflow/proof-reports"),
    api("/api/workflow/adopted-chapters"),
  ]);
  state.workflow.drafts = draftsPayload.drafts ?? [];
  state.workflow.proofReports = proofsPayload.proof_reports ?? [];
  state.workflow.adoptedChapters = adoptedPayload.adopted_chapters ?? [];
  if (!state.workflow.drafts.some((draft) => draft.draft_id === state.activeWorkflowDraftId)) {
    state.activeWorkflowDraftId = state.workflow.drafts[0]?.draft_id ?? "";
  }
  renderWorkflow();
  if (state.activeWorkflowDraftId) await loadWorkflowDraft(state.activeWorkflowDraftId);
  if (showToast) toast("正文工作流已重新整理");
}

async function refreshWorkflowSettlementState(showToast = false) {
  const [adoptedPayload, contextsPayload, reportsPayload] = await Promise.all([
    api("/api/workflow/adopted-chapters"),
    api("/api/workflow/settlement-contexts"),
    api("/api/workflow/settlement-reports"),
  ]);
  state.workflow.adoptedChapters = adoptedPayload.adopted_chapters ?? [];
  state.workflow.settlementContexts = contextsPayload.settlement_contexts ?? [];
  state.workflow.settlementReports = reportsPayload.settlement_reports ?? [];
  if (
    state.activeAdoptedChapterId
    && !state.workflow.adoptedChapters.some(
      (chapter) => chapter.adopted_chapter_id === state.activeAdoptedChapterId,
    )
  ) {
    state.activeAdoptedChapterId = "";
  }
  if (!state.activeAdoptedChapterId) {
    state.activeAdoptedChapterId = state.workflow.adoptedChapters.find(
      (chapter) => ["settlement_context_created", "settlement_report_saved"].includes(chapter.status),
    )?.adopted_chapter_id
      ?? state.workflow.adoptedChapters.find(
        (chapter) => chapter.status === "accepted_pending_settlement",
      )?.adopted_chapter_id
      ?? state.workflow.adoptedChapters[0]?.adopted_chapter_id
      ?? "";
  }
  if (!state.activeSettlementContextId) {
    state.activeSettlementContextId = state.workflow.settlementContexts.find(
      (context) => context.adopted_chapter_id === state.activeAdoptedChapterId,
    )?.settlement_context_id ?? "";
  }
  const contextSummary = state.workflow.settlementContexts.find(
    (context) => context.settlement_context_id === state.activeSettlementContextId,
  );
  if (contextSummary) {
    const payload = await api(
      `/api/workflow/settlement-contexts/${encodeURIComponent(contextSummary.settlement_context_id)}`,
    );
    state.workflow.settlementContextDetail = payload.settlement_context;
  }
  if (!state.activeSettlementReportId && state.activeSettlementContextId) {
    state.activeSettlementReportId = state.workflow.settlementReports.find(
      (report) => report.settlement_context_id === state.activeSettlementContextId,
    )?.settlement_report_id ?? "";
  }
  const reportSummary = state.workflow.settlementReports.find(
    (report) => report.settlement_report_id === state.activeSettlementReportId,
  );
  if (reportSummary) {
    const payload = await api(
      `/api/workflow/settlement-reports/${encodeURIComponent(reportSummary.settlement_report_id)}`,
    );
    state.workflow.settlementReportDetail = payload.settlement_report;
    if (payload.settlement_report.status.pending_candidate_id) {
      const candidatePayload = await api(
        `/api/canon/pending-candidates/${encodeURIComponent(
          payload.settlement_report.status.pending_candidate_id,
        )}`,
      );
      state.workflow.settlementPendingCandidate = candidatePayload.candidate;
    } else {
      state.workflow.settlementPendingCandidate = null;
    }
  } else {
    state.workflow.settlementReportDetail = null;
    state.workflow.settlementPendingCandidate = null;
  }
  renderSettlementWorkflow();
  if (showToast) toast("章節結算工作流已重新整理");
}

async function handleCreateSettlementContext() {
  const adoptedChapterId = $("#settlement-adopted-select").value;
  if (!adoptedChapterId) return;
  try {
    const payload = await api(
      `/api/workflow/adopted-chapters/${encodeURIComponent(adoptedChapterId)}/settlement-context`,
      {
        method: "POST",
        body: JSON.stringify({ note: $("#settlement-context-note").value.trim() }),
      },
    );
    state.activeAdoptedChapterId = adoptedChapterId;
    state.activeSettlementContextId =
      payload.settlement_context.metadata.settlement_context_id;
    state.workflow.settlementContextDetail = payload.settlement_context;
    $("#workflow-settlement-source-chapter").value =
      state.workflow.drafts.find(
        (draft) => draft.draft_id === payload.settlement_context.metadata.draft_id,
      )?.source_chapter ?? "";
    await refreshWorkflowSettlementState();
    toast(payload.settlement_context.status.status === "blocked"
      ? "Settlement context 已保存，但目前被阻擋"
      : "Settlement context 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleSaveSettlementReport(event) {
  event.preventDefault();
  if (!state.activeSettlementContextId) {
    toast("請先建立 settlement_context", true);
    return;
  }
  try {
    const payload = await api("/api/workflow/settlement-reports", {
      method: "POST",
      body: JSON.stringify({
        settlementContextId: state.activeSettlementContextId,
        settlementText: $("#workflow-settlement-text").value,
        sourceChapter: $("#workflow-settlement-source-chapter").value.trim(),
        runId: $("#workflow-settlement-run-id").value.trim(),
        neuralModulesUsedPath: $("#workflow-settlement-neural-path").value.trim(),
        note: $("#workflow-settlement-note").value.trim(),
      }),
    });
    state.activeSettlementReportId =
      payload.settlement_report.metadata.settlement_report_id;
    state.workflow.settlementReportDetail = payload.settlement_report;
    await refreshWorkflowSettlementState();
    toast("Settlement report 已保存，尚未成為正史");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleCreateWorkflowPendingCandidate() {
  if (!state.activeSettlementReportId) return;
  if (!window.confirm("此步驟只會建立 pending_engine_candidate，不會更新 active_engine。確定繼續？")) {
    return;
  }
  try {
    const payload = await api(
      `/api/workflow/settlement-reports/${encodeURIComponent(state.activeSettlementReportId)}/create-pending-candidate`,
      {
        method: "POST",
        body: JSON.stringify({
          sourceChapter: $("#workflow-settlement-source-chapter").value.trim(),
          note: $("#workflow-settlement-note").value.trim(),
        }),
      },
    );
    state.activeCandidateId = payload.result.pending_candidate.metadata.candidate_id;
    state.workflow.settlementReportDetail = payload.result.settlement_report;
    await Promise.all([
      refreshWorkflowSettlementState(),
      refreshCanonSettlementState(),
    ]);
    toast("Pending candidate 已建立；請確認 diff / risk，啟用仍需 Phase 3 人工確認");
  } catch (error) {
    toast(error.message, true);
  }
}

function renderActivityTable() {
  const records = state.data?.[state.activeActivityList] ?? [];
  const columns = state.activeActivityList === "drafts"
    ? ["created_at", "title", "chapter", "status", "path"]
    : state.activeActivityList === "proofReports"
      ? ["created_at", "title", "verdict", "severity", "path"]
      : ["created_at", "title", "chapter", "status", "path"];
  if (records.length === 0) {
    $("#activity-table").innerHTML = '<div class="output-item"><span>尚無紀錄</span></div>';
    return;
  }
  $("#activity-table").innerHTML = `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            ${columns.map((column) => {
              const value = column === "created_at" ? formatDate(record[column]) : record[column] ?? "";
              if (column === "path" && value) {
                return `<td><button class="text-button" type="button" data-open-file="${escapeHtml(value)}">檢視</button></td>`;
              }
              return `<td>${escapeHtml(value)}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAll() {
  renderSources();
  renderOutputs();
  renderCounts();
  renderLibrary();
  renderVisuals();
  renderNeuralStatus();
  renderSettlementPanel();
  renderWorkflow();
  renderApprovalQueue();
  renderActivityTable();
  renderOperatorOverview();
}

async function openLibraryFile(projectPath, title = "") {
  try {
    const text = await loadFile(projectPath);
    state.currentLibraryText = text;
    $("#reader-path").textContent = projectPath;
    $("#reader-title").textContent = title || projectPath.split("/").at(-1);
    $("#library-content").textContent = text;
    switchView("library");
    $$("[data-library-file]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.libraryFile === projectPath);
    });
  } catch (error) {
    toast(error.message, true);
  }
}

async function openComposeResult(projectPath) {
  try {
    const text = await loadFile(projectPath);
    state.activeResultPath = projectPath;
    state.currentComposeText = text;
    $("#compose-result").textContent = text;
    $$("[data-result-file]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.resultFile === projectPath);
    });
  } catch (error) {
    toast(error.message, true);
  }
}

async function copyText(text, label) {
  if (!text) {
    toast("沒有可複製的內容", true);
    return;
  }
  await navigator.clipboard.writeText(text);
  toast(`${label}已複製`);
}

function confirmation(message) {
  const dialog = $("#confirm-dialog");
  $("#confirm-message").textContent = message;
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

async function ensureWriteConfirmed(dryRun, label) {
  if (dryRun) return true;
  return confirmation(`${label}會寫入專案資料與索引。`);
}

async function handlePipeline(event) {
  event.preventDefault();
  try {
    await runAction("pipeline", {
      query: $("#pipeline-query").value,
      task: $("#pipeline-task").value,
      mode: $("#pipeline-mode").value,
      top: Number.parseInt($("#pipeline-top").value, 10),
    });
    await Promise.all([refreshState(), openComposeResult("data/outputs/task_prompt.md")]);
    toast("流水線已完成");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleSearchOnly() {
  try {
    await runAction("search", {
      query: $("#pipeline-query").value,
      top: Number.parseInt($("#pipeline-top").value, 10),
    });
    await Promise.all([refreshState(), openComposeResult("data/outputs/retrieval_context.md")]);
    toast("檢索已完成");
  } catch (error) {
    toast(error.message, true);
  }
}

function workflowRequiredModules() {
  return $("#workflow-required-modules").value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function renderWorkflowContext(result) {
  state.workflow.context = result;
  const bundle = result?.context_bundle;
  const manifest = result?.source_manifest;
  $("#workflow-context-status").textContent = bundle
    ? `${bundle.status} · ${bundle.context_bundle_id}`
    : "尚未建立 context bundle";
  $("#workflow-context-facts").innerHTML = manifest
    ? manifest.sources.map((source) => `
      <span class="${source.exists ? "is-ready" : "is-missing"}">
        ${escapeHtml(source.label)} · ${source.exists ? "已讀取" : "缺失"}
      </span>
    `).join("")
    : "";
  if (bundle?.context_bundle_id) {
    $("#draft-context-bundle-id").value = bundle.context_bundle_id;
  }
}

async function handleWorkflowContext() {
  try {
    const payload = await api("/api/workflow/context-bundles/draft", {
      method: "POST",
      body: JSON.stringify({
        sourceChapter: $("#workflow-source-chapter").value.trim(),
        task: $("#workflow-task-text").value,
      }),
    });
    renderWorkflowContext(payload.result);
    toast("Draft context bundle 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleWorkflowTask(event) {
  event.preventDefault();
  try {
    const modules = workflowRequiredModules();
    const payload = await api("/api/workflow/draft-tasks", {
      method: "POST",
      body: JSON.stringify({
        sourceChapter: $("#workflow-source-chapter").value.trim(),
        task: $("#workflow-task-text").value,
        requiresNeuralModules: modules.length > 0,
        requiredNeuralModules: modules,
      }),
    });
    renderWorkflowContext(payload.result);
    $("#draft-run-id").value = payload.result.run.run_id;
    $("#draft-neural-path").value = `data/agent_runs/${payload.result.run.run_id}/neural_modules_used.json`;
    $("#draft-chapter").value = $("#workflow-source-chapter").value;
    toast("正文任務與 agent run 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleSaveDraft(event) {
  event.preventDefault();
  try {
    const payload = await api("/api/workflow/candidate-drafts", {
      method: "POST",
      body: JSON.stringify({
        sourceChapter: $("#draft-chapter").value,
        note: $("#draft-note").value,
        draftText: $("#draft-text").value,
        runId: $("#draft-run-id").value.trim(),
        contextBundleId: $("#draft-context-bundle-id").value.trim(),
        neuralModulesUsedPath: $("#draft-neural-path").value.trim(),
      }),
    });
    state.activeWorkflowDraftId = payload.draft.metadata.draft_id;
    $("#draft-text").value = "";
    await refreshWorkflowState();
    toast("正文候選已保存，尚未成為正史");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleDraftSelect() {
  try {
    await loadWorkflowDraft($("#draft-select").value);
  } catch (error) {
    toast(error.message, true);
  }
}

async function prepareProof() {
  const draftId = $("#draft-select").value;
  if (!draftId) {
    toast("請先選擇候選稿", true);
    return;
  }
  try {
    const payload = await api(`/api/workflow/candidate-drafts/${encodeURIComponent(draftId)}/send-to-proofing`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    $("#proof-run-id").value = payload.result.run.run_id;
    $("#proof-context-bundle-id").value = payload.result.context_bundle.context_bundle_id;
    $("#proof-neural-path").value = `data/agent_runs/${payload.result.run.run_id}/neural_modules_used.json`;
    await refreshWorkflowState();
    toast("驗稿 context bundle 與 agent run 已建立");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleSaveProof(event) {
  event.preventDefault();
  const draftId = $("#draft-select").value;
  if (!draftId) {
    toast("請先選擇 candidate_draft", true);
    return;
  }
  try {
    const payload = await api("/api/workflow/proof-reports", {
      method: "POST",
      body: JSON.stringify({
        draftId,
        proofText: $("#proof-text").value,
        runId: $("#proof-run-id").value.trim(),
        contextBundleId: $("#proof-context-bundle-id").value.trim(),
        neuralModulesUsedPath: $("#proof-neural-path").value.trim(),
      }),
    });
    state.workflow.proofDetail = payload.proof_report;
    await refreshWorkflowState();
    toast("proof_report 已保存");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleWorkflowDraftAction(action) {
  const draftId = state.activeWorkflowDraftId;
  if (!draftId) return;
  const severe = (state.workflow.proofDetail?.issue_summary?.p0_count ?? 0) > 0
    || (state.workflow.proofDetail?.issue_summary?.p1_count ?? 0) > 0;
  let body = {};
  if (action === "adopt") {
    const message = severe
      ? "驗稿含 P0 / P1。仍要人工採用並標記 accepted_pending_settlement？"
      : "採用只會建立 adopted_chapter，不會更新 active_engine。確定採用？";
    if (!window.confirm(message)) return;
    body = { confirm: true, adoptedBy: "local_user" };
  } else {
    const label = action === "reject" ? "退稿" : "封存";
    if (!window.confirm(`確定${label}這份 candidate_draft？`)) return;
    body = { reason: window.prompt(`${label}原因（可留空）`, "") ?? "" };
  }
  try {
    await api(`/api/workflow/candidate-drafts/${encodeURIComponent(draftId)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await refreshWorkflowState();
    toast(action === "adopt" ? "正文已採用，等待 Phase 4B 結算" : "候選稿狀態已更新");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleFeedback(event) {
  event.preventDefault();
  const dryRun = $("#feedback-dry-run").checked;
  if (!await ensureWriteConfirmed(dryRun, "記錄回饋")) return;
  try {
    await runAction("addFeedback", {
      type: $("#feedback-type").value,
      severity: $("#feedback-severity").value,
      chapter: $("#feedback-chapter").value,
      feedback: $("#feedback-text").value,
      characters: $("#feedback-characters").value,
      sceneType: $("#feedback-scene").value,
      noCandidate: $("#feedback-no-candidate").checked,
      dryRun,
    });
    await refreshState();
    toast(dryRun ? "回饋預覽完成" : "回饋已記錄");
  } catch (error) {
    toast(error.message, true);
  }
}

async function runValidation() {
  try {
    switchView("activity");
    $("#action-console").textContent = "執行完整檢查中…";
    await runAction("validate");
    await refreshState();
    toast("完整檢查通過");
  } catch (error) {
    toast(error.message, true);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("讀取圖片失敗")));
    reader.readAsDataURL(file);
  });
}

async function handleVisualUpload(event) {
  event.preventDefault();
  const fileInput = $("#visual-upload-file");
  const file = fileInput.files?.[0];
  if (!file) {
    toast("請先選擇圖片", true);
    return;
  }
  if (file.size > maxVisualUploadBytes) {
    toast("圖片不可超過 8 MB", true);
    return;
  }

  try {
    const payload = await api("/api/visuals/upload", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        dataBase64: await readFileAsDataUrl(file),
        character: $("#visual-upload-character").value,
        title: $("#visual-upload-title").value,
        category: $("#visual-upload-category").value,
        tags: $("#visual-upload-tags").value,
        notes: $("#visual-upload-notes").value,
      }),
    });
    state.data.visuals = payload.visuals;
    state.visualFilters = { character: "", category: "", status: "" };
    state.activeVisualId = payload.upload.record.visual_id;
    $("#visual-upload-form").reset();
    renderVisuals();
    toast("人設圖已上傳");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleVisualDelete(visualId) {
  const item = (state.data?.visuals?.items ?? []).find((visual) => visual.visual_id === visualId);
  if (!item) {
    toast("找不到要刪除的圖像紀錄", true);
    return;
  }
  const confirmed = window.confirm(`刪除「${item.title || item.visual_id}」？\n\n這會移除索引紀錄與圖片檔，且不會改動正史。`);
  if (!confirmed) return;

  try {
    const payload = await api("/api/visuals/delete", {
      method: "POST",
      body: JSON.stringify({
        visualId,
        deleteAsset: true,
        confirmDelete: true,
      }),
    });
    state.data.visuals = payload.visuals;
    state.activeVisualId = "";
    renderVisuals();
    toast(payload.deleted.assetDeleted ? "圖像已刪除" : "索引已刪除，圖片檔已略過");
  } catch (error) {
    toast(error.message, true);
  }
}

function bindEvents() {
  window.addEventListener("hashchange", () => {
    switchView(window.location.hash.slice(1) || "overview");
  });

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  $("[data-action='build-context']").addEventListener("click", async () => {
    try {
      await runAction("buildContext");
      await refreshState();
      toast("上下文已重建");
    } catch (error) {
      toast(error.message, true);
    }
  });
  $("#refresh-button").addEventListener("click", () => refreshState(true).catch((error) => toast(error.message, true)));
  $("#refresh-neural-button").addEventListener("click", () => (
    loadNeuralStatus(true).catch((error) => toast(error.message, true))
  ));
  $("#refresh-settlement-button").addEventListener("click", () => (
    Promise.all([
      refreshCanonSettlementState(true),
      refreshWorkflowSettlementState(),
    ]).catch((error) => toast(error.message, true))
  ));
  $("#scan-approval-queue-button").addEventListener("click", () => handleScanApprovalQueue());
  $("#refresh-approval-queue-button").addEventListener("click", () => (
    refreshApprovalQueue(true).catch((error) => toast(error.message, true))
  ));
  $("#approval-snapshot-select").addEventListener("change", renderApprovalQueue);
  $("#create-rollback-approval-button").addEventListener("click", () => {
    const snapshotId = $("#approval-snapshot-select").value;
    if (snapshotId) handleScanApprovalQueue(snapshotId);
  });
  $("#approval-confirm-checkbox").addEventListener("change", renderApprovalQueue);
  $("#approval-second-confirm-checkbox").addEventListener("change", renderApprovalQueue);
  $("#approval-confirm-text").addEventListener("input", renderApprovalQueue);
  $("#approval-confirm-button").addEventListener("click", () => handleApprovalDecision("confirm"));
  $("#approval-reject-button").addEventListener("click", () => handleApprovalDecision("reject"));
  $("#approval-defer-button").addEventListener("click", () => handleApprovalDecision("defer"));
  $("#scan-cleanup-button").addEventListener("click", () => handleCleanupScan(false));
  $("#create-cleanup-proposal-button").addEventListener("click", () => handleCleanupScan(true));
  $("#refresh-cleanup-button").addEventListener("click", () => (
    refreshCleanup(true).catch((error) => toast(error.message, true))
  ));
  $("#cleanup-confirm-checkbox").addEventListener("change", renderCleanup);
  $("#cleanup-approve-button").addEventListener("click", () => handleCleanupDecision("approve"));
  $("#cleanup-execute-button").addEventListener("click", () => handleCleanupDecision("execute"));
  $("#cleanup-reject-button").addEventListener("click", () => handleCleanupDecision("reject"));
  $("#cleanup-defer-button").addEventListener("click", () => handleCleanupDecision("defer"));
  $("#validate-button").addEventListener("click", runValidation);

  $("#mode-control").addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    $("#pipeline-mode").value = button.dataset.mode;
    $$("[data-mode]", $("#mode-control")).forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
  });

  $("#pipeline-form").addEventListener("submit", handlePipeline);
  $("#workflow-task-form").addEventListener("submit", handleWorkflowTask);
  $("#workflow-rebuild-context-button").addEventListener("click", handleWorkflowContext);
  $("#refresh-workflow-button").addEventListener("click", () => (
    refreshWorkflowState(true).catch((error) => toast(error.message, true))
  ));
  $("#search-only-button").addEventListener("click", handleSearchOnly);
  $("#draft-form").addEventListener("submit", handleSaveDraft);
  $("#draft-select").addEventListener("change", handleDraftSelect);
  $("#prepare-proof-button").addEventListener("click", prepareProof);
  $("#copy-draft-button").addEventListener("click", () => copyText(state.currentDraftText, "候選稿"));
  $("#proof-form").addEventListener("submit", handleSaveProof);
  $("#workflow-adopt-button").addEventListener("click", () => handleWorkflowDraftAction("adopt"));
  $("#workflow-reject-button").addEventListener("click", () => handleWorkflowDraftAction("reject"));
  $("#workflow-archive-button").addEventListener("click", () => handleWorkflowDraftAction("archive"));
  $("#settlement-adopted-select").addEventListener("change", () => {
    state.activeAdoptedChapterId = $("#settlement-adopted-select").value;
    state.activeSettlementContextId = "";
    state.activeSettlementReportId = "";
    state.workflow.settlementContextDetail = null;
    state.workflow.settlementReportDetail = null;
    state.workflow.settlementPendingCandidate = null;
    renderSettlementWorkflow();
  });
  $("#create-settlement-context-button").addEventListener("click", handleCreateSettlementContext);
  $("#workflow-settlement-report-form").addEventListener("submit", handleSaveSettlementReport);
  $("#create-workflow-pending-candidate-button").addEventListener(
    "click",
    handleCreateWorkflowPendingCandidate,
  );
  $("#feedback-form").addEventListener("submit", handleFeedback);
  $("#visual-upload-form").addEventListener("submit", handleVisualUpload);
  $("#settlement-import-form").addEventListener("submit", handleSettlementImport);
  $("#candidate-reparse-button").addEventListener("click", handleReparseCandidate);
  $("#candidate-reject-button").addEventListener("click", handleRejectCandidate);
  $("#candidate-activate-button").addEventListener("click", handleActivateCandidate);
  $("#candidate-activation-confirm").addEventListener("change", updateActivationControls);
  $("#candidate-second-confirm").addEventListener("change", updateActivationControls);
  $("#candidate-second-confirm-text").addEventListener("input", updateActivationControls);
  $("#rollback-confirm").addEventListener("change", () => renderSnapshots(state.canon.snapshots));
  $("#visual-upload-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || $("#visual-upload-title").value.trim()) return;
    $("#visual-upload-title").value = file.name.replace(/\.[^.]+$/u, "");
  });
  $("#clear-console-button").addEventListener("click", () => {
    $("#action-console").textContent = "等待操作。";
  });

  $("#copy-result-button").addEventListener("click", () => copyText(state.currentComposeText, "產物"));
  $("#copy-prompt-button").addEventListener("click", () => copyText(state.currentComposeText, "任務提示"));
  $("#copy-library-button").addEventListener("click", () => copyText(state.currentLibraryText, "資料"));

  document.addEventListener("click", (event) => {
    const goView = event.target.closest("[data-go-view]");
    if (goView) {
      switchView(goView.dataset.goView);
      return;
    }
    const openFile = event.target.closest("[data-open-file]");
    if (openFile) {
      openLibraryFile(openFile.dataset.openFile);
      return;
    }
    const resultFile = event.target.closest("[data-result-file]");
    if (resultFile) {
      openComposeResult(resultFile.dataset.resultFile);
      return;
    }
    const libraryFile = event.target.closest("[data-library-file]");
    if (libraryFile) {
      openLibraryFile(libraryFile.dataset.libraryFile, libraryFile.dataset.libraryTitle);
      return;
    }
    const visualDelete = event.target.closest("[data-visual-delete]");
    if (visualDelete) {
      handleVisualDelete(visualDelete.dataset.visualDelete);
      return;
    }
    const neuralRun = event.target.closest("[data-neural-run-id]");
    if (neuralRun) {
      state.activeNeuralRunId = neuralRun.dataset.neuralRunId;
      renderNeuralStatus();
      return;
    }
    const candidateItem = event.target.closest("[data-candidate-id]");
    if (candidateItem) {
      loadCandidateDetail(candidateItem.dataset.candidateId).catch((error) => toast(error.message, true));
      return;
    }
    const workflowDraft = event.target.closest("[data-workflow-draft-id]");
    if (workflowDraft) {
      loadWorkflowDraft(workflowDraft.dataset.workflowDraftId)
        .then(() => {
          $("#draft-select").value = workflowDraft.dataset.workflowDraftId;
          switchView("review");
        })
        .catch((error) => toast(error.message, true));
      return;
    }
    const approvalItem = event.target.closest("[data-approval-item-id]");
    if (approvalItem) {
      loadApprovalItem(approvalItem.dataset.approvalItemId)
        .catch((error) => toast(error.message, true));
      return;
    }
    const cleanupProposal = event.target.closest("[data-cleanup-proposal-id]");
    if (cleanupProposal) {
      loadCleanupProposal(cleanupProposal.dataset.cleanupProposalId)
        .catch((error) => toast(error.message, true));
      return;
    }
    const rollbackButton = event.target.closest("[data-rollback-snapshot]");
    if (rollbackButton) {
      handleRollbackSnapshot(rollbackButton.dataset.rollbackSnapshot);
      return;
    }
    const visualCard = event.target.closest("[data-visual-id]");
    if (visualCard) {
      state.activeVisualId = visualCard.dataset.visualId;
      renderVisuals();
      return;
    }
    const activityButton = event.target.closest("[data-activity-list]");
    if (activityButton) {
      state.activeActivityList = activityButton.dataset.activityList;
      $$("[data-activity-list]").forEach((button) => {
        button.classList.toggle("is-active", button === activityButton);
      });
      renderActivityTable();
    }
  });

  $("#visual-character-filter").addEventListener("change", (event) => {
    state.visualFilters.character = event.target.value;
    state.activeVisualId = "";
    renderVisuals();
  });
  $("#visual-category-filter").addEventListener("change", (event) => {
    state.visualFilters.category = event.target.value;
    state.activeVisualId = "";
    renderVisuals();
  });
  $("#visual-status-filter").addEventListener("change", (event) => {
    state.visualFilters.status = event.target.value;
    state.activeVisualId = "";
    renderVisuals();
  });
  try { bindWriterWorkbenchActions(); } catch (e) { /* ignore if missing */ }
}

async function initialize() {
  bindEvents();
  switchView(window.location.hash.slice(1) || "overview");
  try {
    await refreshState();
    const taskPrompt = state.data.outputs.find((output) => output.key === "task_prompt");
    if (taskPrompt?.exists) {
      await openComposeResult("data/outputs/task_prompt.md");
      switchView(window.location.hash.slice(1) || state.activeView);
    }
  } catch (error) {
    toast(error.message, true);
    $("#source-summary").textContent = "連線失敗";
  }
}

initialize();
