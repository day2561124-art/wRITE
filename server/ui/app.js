const state = {
  data: null,
  activeView: "overview",
  activeResultPath: "data/outputs/task_prompt.md",
  activeActivityList: "drafts",
  activeVisualId: "",
  activeNeuralRunId: "",
  neuralData: {
    runs: [],
    traces: [],
  },
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
  activity: "紀錄",
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
  $$("form button, [data-action], [data-visual-delete], #validate-button, #refresh-button").forEach((button) => {
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
  const payload = await api("/api/state");
  state.data = payload.state;
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
  window.scrollTo({ top: 0, behavior: "auto" });
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
        <span class="trust-badge${badgeClass}">${escapeHtml(source.trust)}</span>
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
    : '<div class="empty-state">尚無圖像紀錄</div>';

  renderVisualDetail(items.find((item) => item.visual_id === state.activeVisualId));
}

function renderNeuralStatus() {
  const runs = state.neuralData.runs ?? [];
  const traces = state.neuralData.traces ?? [];
  const successRuns = runs.filter((run) => (
    traces.some((trace) => trace.run_id === run.run_id && trace.status === "success")
  )).length;
  const warningRuns = runs.filter((run) => run.warning).length;
  $("#neural-summary").textContent = `${runs.length} runs · ${successRuns} 已使用 · ${warningRuns} warning`;

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
  $("#neural-detail-run-id").textContent = run.run_id;
  $("#neural-detail-title").textContent = run.task_type;
  $("#neural-detail-status").className = status.className;
  $("#neural-detail-status").textContent = status.label;
  $("#neural-run-facts").innerHTML = `
    <div><dt>task_type</dt><dd>${escapeHtml(run.task_type)}</dd></div>
    <div><dt>status</dt><dd>${escapeHtml(run.status)}</dd></div>
    <div><dt>requires_neural_modules</dt><dd>${run.requires_neural_modules ? "true" : "false"}</dd></div>
    <div><dt>required_neural_modules</dt><dd>${escapeHtml((run.required_neural_modules ?? []).join(", ") || "none")}</dd></div>
    <div><dt>input_hash</dt><dd>${escapeHtml(run.input_hash)}</dd></div>
    <div><dt>output_hash</dt><dd>${escapeHtml(run.output_hash ?? "null")}</dd></div>
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

function renderDraftSelect() {
  const drafts = state.data?.drafts ?? [];
  const select = $("#draft-select");
  const current = select.value;
  select.innerHTML = [
    '<option value="">選擇候選稿</option>',
    ...drafts.map((draft) => `
      <option value="${escapeHtml(draft.path)}" data-id="${escapeHtml(draft.draft_id)}" data-chapter="${escapeHtml(draft.chapter ?? "")}">
        ${escapeHtml(draft.title ?? draft.path)}
      </option>
    `),
  ].join("");
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
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
  renderDraftSelect();
  renderActivityTable();
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

async function handleSaveDraft(event) {
  event.preventDefault();
  const dryRun = $("#draft-dry-run").checked;
  if (!await ensureWriteConfirmed(dryRun, "保存候選稿")) return;
  try {
    await runAction("saveDraft", {
      title: $("#draft-title").value,
      chapter: $("#draft-chapter").value,
      text: $("#draft-text").value,
      dryRun,
    });
    await refreshState();
    toast(dryRun ? "候選稿預覽完成" : "候選稿已保存");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleDraftSelect() {
  const projectPath = $("#draft-select").value;
  if (!projectPath) {
    state.currentDraftText = "";
    $("#draft-preview").textContent = "尚未選擇候選稿。";
    return;
  }
  try {
    state.currentDraftText = await loadFile(projectPath);
    $("#draft-preview").textContent = state.currentDraftText;
    const option = $("#draft-select").selectedOptions[0];
    $("#proof-title").value = `${option.textContent.trim()}驗稿`;
  } catch (error) {
    toast(error.message, true);
  }
}

async function prepareProof() {
  const selected = $("#draft-select").selectedOptions[0];
  if (!selected?.value) {
    toast("請先選擇候選稿", true);
    return;
  }
  try {
    const title = selected.textContent.trim();
    await runAction("pipeline", {
      query: `${selected.dataset.chapter ?? ""} 正式驗稿 正史 後座`,
      task: `正式採用前驗稿：檢查候選稿「${title}」是否符合 active_engine、active_writing_card、active_proofing_card 與 active_longline。`,
      mode: "proofread",
      top: 16,
    });
    await refreshState();
    await openComposeResult("data/outputs/task_prompt.md");
    switchView("compose");
    toast("驗稿提示已準備");
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleSaveProof(event) {
  event.preventDefault();
  const dryRun = $("#proof-dry-run").checked;
  if (!await ensureWriteConfirmed(dryRun, "保存驗稿報告")) return;
  const selected = $("#draft-select").selectedOptions[0];
  try {
    await runAction("saveProof", {
      title: $("#proof-title").value,
      chapter: selected?.dataset.chapter ?? "",
      draftId: selected?.dataset.id ?? "",
      verdict: $("#proof-verdict").value,
      severity: $("#proof-severity").value,
      text: $("#proof-text").value,
      dryRun,
    });
    await refreshState();
    toast(dryRun ? "驗稿報告預覽完成" : "驗稿報告已保存");
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
  $$("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.goView));
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
  $("#search-only-button").addEventListener("click", handleSearchOnly);
  $("#draft-form").addEventListener("submit", handleSaveDraft);
  $("#draft-select").addEventListener("change", handleDraftSelect);
  $("#prepare-proof-button").addEventListener("click", prepareProof);
  $("#copy-draft-button").addEventListener("click", () => copyText(state.currentDraftText, "候選稿"));
  $("#proof-form").addEventListener("submit", handleSaveProof);
  $("#feedback-form").addEventListener("submit", handleFeedback);
  $("#visual-upload-form").addEventListener("submit", handleVisualUpload);
  $("#visual-upload-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || $("#visual-upload-title").value.trim()) return;
    $("#visual-upload-title").value = file.name.replace(/\.[^.]+$/u, "");
  });
  $("#clear-console-button").addEventListener("click", () => {
    $("#action-console").textContent = "等待操作。";
  });

  $("#copy-result-button").addEventListener("click", () => copyText(state.currentComposeText, "產物"));
  $("#copy-library-button").addEventListener("click", () => copyText(state.currentLibraryText, "資料"));

  document.addEventListener("click", (event) => {
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
