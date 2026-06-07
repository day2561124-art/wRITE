const state = {
  data: null,
  activeView: "overview",
  activeResultPath: "data/outputs/task_prompt.md",
  activeActivityList: "drafts",
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
  activity: "紀錄",
};

const sourceIcons = {
  active_engine: "C",
  active_writing_card: "W",
  active_proofing_card: "P",
  active_longline: "L",
  compressed_error_rules: "E",
};

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

function setBusy(busy) {
  const wasBusy = state.busyCount > 0;
  state.busyCount += busy ? 1 : -1;
  state.busyCount = Math.max(0, state.busyCount);
  $("#loading-bar").hidden = state.busyCount === 0;
  const isBusy = state.busyCount > 0;
  if (wasBusy === isBusy) return;
  $$("form button, [data-action], #validate-button, #refresh-button").forEach((button) => {
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
    const activityButton = event.target.closest("[data-activity-list]");
    if (activityButton) {
      state.activeActivityList = activityButton.dataset.activityList;
      $$("[data-activity-list]").forEach((button) => {
        button.classList.toggle("is-active", button === activityButton);
      });
      renderActivityTable();
    }
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
