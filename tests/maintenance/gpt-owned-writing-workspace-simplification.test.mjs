import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const html = await readFile(path.join(root, "server", "ui", "index.html"), "utf8");
const app = await readFile(path.join(root, "server", "ui", "app.js"), "utf8");
const css = await readFile(path.join(root, "server", "ui", "styles.css"), "utf8");

const composeStart = html.indexOf('data-view-panel="compose"');
const candidateStart = html.indexOf('class="panel optional-workflow candidate-workflow"');
const composeEnd = html.indexOf('data-view-panel="writer-workbench"');
assert(composeStart > 0 && candidateStart > composeStart && composeEnd > candidateStart);

const primaryWorkspace = html.slice(composeStart, candidateStart);
const candidateWorkflow = html.slice(candidateStart, composeEnd);
const handlePipelineStart = app.indexOf("async function handlePipeline");
const handlePipelineEnd = app.indexOf("async function handleSearchOnly", handlePipelineStart);
const pipelineHandler = app.slice(handlePipelineStart, handlePipelineEnd);

assert(primaryWorkspace.includes("本次寫作"));
assert(primaryWorkspace.includes("寫作上下文"));
assert(primaryWorkspace.includes("ChatGPT 外部大腦"));
assert(primaryWorkspace.includes("最近一次寫作"));
assert(primaryWorkspace.includes("準備 ChatGPT 正文寫作"));
assert(!primaryWorkspace.includes("請 ChatGPT 寫正文候選"));
assert(!primaryWorkspace.includes("複製給 ChatGPT"));
assert(!primaryWorkspace.includes("Full Neural Orchestrator"));
assert(!primaryWorkspace.includes("請把 ChatGPT 產出的正文候選貼到這裡"));

for (const mode of ["next_chapter", "specific_scene", "rewrite_candidate"]) {
  assert(primaryWorkspace.includes(`data-chapter-mode="${mode}"`));
}

assert(candidateWorkflow.includes("候選流程"));
assert(candidateWorkflow.includes("只有在你明確要保存"));
assert(candidateWorkflow.includes('id="draft-form"'));
assert(candidateWorkflow.includes("保存為正文候選"));
assert(app.includes('$("#draft-form")?.addEventListener("submit", handleSaveDraft)'));
assert(app.includes('api("/api/workflow/candidate-drafts"'));
assert(!pipelineHandler.includes("save-chat-output-candidate"));
assert(!pipelineHandler.includes("candidate-drafts"));

assert(html.includes('id="workbench-compatibility-diagnostics"'));
assert(app.includes("Full Neural Orchestrator"));
assert(app.includes("backend recursive"));
assert(app.includes("provider status"));
assert(html.includes('id="workbench-generate"'));
assert(html.includes(">前往正文寫作</button>"));
assert(app.includes('generateButton?.addEventListener("click"'));
assert(app.includes('switchView("compose")'));

assert(css.includes(".writing-context-grid"));
assert(css.includes(".optional-workflow"));
assert(css.includes("@media (max-width: 1120px)"));

console.log("GPT-owned writing workspace simplification tests passed.");
