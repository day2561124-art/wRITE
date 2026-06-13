import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  createAgentRun,
  getAgentRun,
} from "./agent-run-service.mjs";
import { getEngineComponentsStatus } from "./engine-component-registry.mjs";
import { buildEnginePipelineMetadata } from "./engine-pipeline-metadata.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

export const draftIdPattern = /^candidate_draft_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const proofIdPattern = /^proof_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const adoptedChapterIdPattern = /^adopted_chapter_\d{8}-\d{6}-[a-f0-9]{8}$/u;
export const contextBundleIdPattern = /^context_bundle_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const draftStatuses = new Set([
  "candidate",
  "proofing",
  "proofed",
  "revised",
  "accepted_pending_settlement",
  "rejected",
  "archived",
  "blocked",
]);

const adoptedChapterStatuses = new Set([
  "accepted_pending_settlement",
  "settlement_context_created",
  "settlement_report_saved",
  "settlement_candidate_created",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireText(value, label, maxLength = 1_000_000) {
  if (typeof value !== "string" || !value.trim()) throw errorWithStatus(`${label} is required.`);
  if (value.length > maxLength) throw errorWithStatus(`${label} exceeds ${maxLength} characters.`);
  return value;
}

function optionalText(value, maxLength = 10_000) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw errorWithStatus(`Text exceeds ${maxLength} characters.`);
  return text;
}

function workflowRoots(options = {}) {
  const base = options.writingWorkflow
    ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow test root")
    : projectPaths.writingWorkflow;
  return {
    writingWorkflow: base,
    candidateDrafts: path.join(base, "candidate_drafts"),
    proofReports: path.join(base, "proof_reports"),
    adoptedChapters: path.join(base, "adopted_chapters"),
    contextBundles: path.join(base, "context_bundles"),
    workflowLogs: path.join(base, "logs"),
    activeEngine: options.activeEnginePath
      ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
      : projectPaths.activeEngine,
  };
}

function draftPaths(draftId, roots) {
  assertDraftId(draftId);
  const directory = path.join(roots.candidateDrafts, draftId);
  return {
    directory,
    draft: path.join(directory, "draft.md"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
    neural: path.join(directory, "neural_modules_used.json"),
  };
}

function proofPaths(proofId, roots) {
  assertProofId(proofId);
  const directory = path.join(roots.proofReports, proofId);
  return {
    directory,
    report: path.join(directory, "proof_report.md"),
    metadata: path.join(directory, "metadata.json"),
    issues: path.join(directory, "issue_summary.json"),
    status: path.join(directory, "status.json"),
    neural: path.join(directory, "neural_modules_used.json"),
  };
}

function adoptedPaths(adoptedChapterId, roots) {
  assertAdoptedChapterId(adoptedChapterId);
  const directory = path.join(roots.adoptedChapters, adoptedChapterId);
  return {
    directory,
    chapter: path.join(directory, "chapter.md"),
    metadata: path.join(directory, "metadata.json"),
    status: path.join(directory, "status.json"),
  };
}

function bundlePaths(contextBundleId, roots) {
  assertContextBundleId(contextBundleId);
  const directory = path.join(roots.contextBundles, contextBundleId);
  return {
    directory,
    bundle: path.join(directory, "context_bundle.json"),
    taskPrompt: path.join(directory, "task_prompt.md"),
    generationContext: path.join(directory, "generation_context.md"),
    retrievalContext: path.join(directory, "retrieval_context.md"),
    draft: path.join(directory, "candidate_draft.md"),
    proofingCard: path.join(directory, "active_proofing_card.md"),
    manifest: path.join(directory, "source_manifest.json"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function sourceRecord(label, filePath, canonStatus = "reference") {
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: true,
      hash: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      canon_status: canonStatus,
      content: content.toString("utf8"),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      source_path: normalizeProjectPath(filePath),
      exists: false,
      hash: "",
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
}

async function neuralUsage(runId, neuralModulesUsedPath = "") {
  if (!runId) {
    return {
      run_id: "",
      requires_neural_modules: false,
      required_neural_modules: [],
      neural_modules_used: [],
      traces: [],
      used_neural_network: false,
      warning: false,
      message: "未使用 / 缺少 trace",
    };
  }
  const run = await getAgentRun(runId);
  const expected = path.join(projectPaths.agentRuns, runId, "neural_modules_used.json");
  if (neuralModulesUsedPath) {
    const resolved = assertPathInside(
      neuralModulesUsedPath,
      projectPaths.agentRuns,
      "neural_modules_used_path",
    );
    if (resolved !== expected) throw errorWithStatus("neural_modules_used_path does not match run_id.");
  }
  const usage = await summarizeNeuralUsageForRun(runId);
  return {
    run_id: runId,
    requires_neural_modules: run.requires_neural_modules,
    required_neural_modules: run.required_neural_modules,
    neural_modules_used: usage.neural_modules_used,
    traces: usage.traces,
    used_neural_network: usage.used_neural_network,
    warning: usage.warning,
    missing_required_neural_modules: usage.missing_required_neural_modules,
    message: usage.used_neural_network ? "已由 success trace 證實" : "未使用 / 缺少 trace",
  };
}

export function isSafeDraftId(id) {
  return typeof id === "string" && draftIdPattern.test(id);
}

export function isSafeProofId(id) {
  return typeof id === "string" && proofIdPattern.test(id);
}

export function isSafeAdoptedChapterId(id) {
  return typeof id === "string" && adoptedChapterIdPattern.test(id);
}

export function isSafeContextBundleId(id) {
  return typeof id === "string" && contextBundleIdPattern.test(id);
}

export function assertDraftId(id) {
  if (!isSafeDraftId(id)) throw errorWithStatus("Invalid draft_id.");
  return id;
}

export function assertProofId(id) {
  if (!isSafeProofId(id)) throw errorWithStatus("Invalid proof_id.");
  return id;
}

export function assertAdoptedChapterId(id) {
  if (!isSafeAdoptedChapterId(id)) throw errorWithStatus("Invalid adopted_chapter_id.");
  return id;
}

export function assertContextBundleId(id) {
  if (!isSafeContextBundleId(id)) throw errorWithStatus("Invalid context_bundle_id.");
  return id;
}

export async function ensureWritingWorkflowDirectories(options = {}) {
  const roots = workflowRoots(options);
  await Promise.all([
    mkdir(roots.candidateDrafts, { recursive: true }),
    mkdir(roots.proofReports, { recursive: true }),
    mkdir(roots.adoptedChapters, { recursive: true }),
    mkdir(roots.contextBundles, { recursive: true }),
    mkdir(roots.workflowLogs, { recursive: true }),
  ]);
  return roots;
}

export async function buildDraftContextBundle(input = {}, options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const contextBundleId = createId("context_bundle");
  const paths = bundlePaths(contextBundleId, roots);
  const createdAt = new Date().toISOString();
  const sourceChapter = optionalText(input.sourceChapter, 500);
  const task = optionalText(input.task, 100_000);
  const sources = await Promise.all([
    sourceRecord("active_engine", roots.activeEngine, "active"),
    sourceRecord("task_prompt", path.join(projectPaths.outputs, "task_prompt.md"), "working"),
    sourceRecord("generation_context", path.join(projectPaths.outputs, "generation_context.md"), "working"),
    sourceRecord("retrieval_context", path.join(projectPaths.outputs, "retrieval_context.md"), "working"),
  ]);
  const active = sources[0];
  const engineComponentsStatus = await getEngineComponentsStatus();
  const requiredNeuralModules = (
    engineComponentsStatus.components.neural_pipeline.modules ?? []
  ).map((module) => module.name);
  const missingSources = sources.filter((source) => !source.exists).map((source) => source.label);
  const warnings = missingSources.filter((label) => label !== "active_engine")
    .map((label) => `Missing optional source: ${label}`);
  const manifest = {
    context_bundle_id: contextBundleId,
    created_at: createdAt,
    task_type: "draft_generation",
    sources: sources.map(({ content, ...source }) => source),
    missing_sources: missingSources,
    warnings,
  };
  const bundle = {
    context_bundle_id: contextBundleId,
    task_type: "draft_generation",
    source_chapter: sourceChapter,
    task,
    created_at: createdAt,
    status: active.exists ? "ready" : "blocked",
    blocked_reason: active.exists ? null : "active_engine.md 不存在",
    active_engine_hash: active.hash,
    engine_first: true,
    engine_id: engineComponentsStatus.engine_id,
    engine_components_status: engineComponentsStatus,
    engine_components_valid: engineComponentsStatus.ok === true,
    engine_component_validation_errors: [...engineComponentsStatus.issues],
    neural_pipeline_required:
      engineComponentsStatus.components.neural_pipeline.required === true,
    required_neural_modules: requiredNeuralModules,
    canon_update_allowed: false,
    approval_required_for_canon_change: true,
  };
  await commitFileTransaction("build-draft-context-bundle", [
    { filePath: paths.bundle, content: json(bundle) },
    {
      filePath: paths.taskPrompt,
      content: sources.find((source) => source.label === "task_prompt")?.content
        || `# 正文任務\n\n${task || sourceChapter || "請建立正文候選。"}\n`,
    },
    {
      filePath: paths.generationContext,
      content: sources.find((source) => source.label === "generation_context")?.content || "",
    },
    {
      filePath: paths.retrievalContext,
      content: sources.find((source) => source.label === "retrieval_context")?.content || "",
    },
    { filePath: paths.manifest, content: json(manifest) },
  ], { context_bundle_id: contextBundleId, phase: "phase_4a" });
  return { context_bundle: bundle, source_manifest: manifest };
}

export async function createDraftTask(input = {}, options = {}) {
  const context = await buildDraftContextBundle(input, options);
  const run = await createAgentRun({
    task_type: "draft_generation",
    requires_neural_modules: input.requiresNeuralModules === true,
    required_neural_modules: input.requiredNeuralModules ?? [],
    input: JSON.stringify({
      source_chapter: input.sourceChapter ?? "",
      task: input.task ?? "",
      context_bundle_id: context.context_bundle.context_bundle_id,
    }),
    created_by: "local_ui",
  });
  return {
    run,
    context_bundle: context.context_bundle,
    source_manifest: context.source_manifest,
  };
}

export async function saveCandidateDraft(input = {}, options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const draftText = requireText(input.draftText, "draftText");
  const active = await sourceRecord("active_engine", roots.activeEngine, "active");
  if (!active.exists) throw errorWithStatus("active_engine.md 不存在", 409);
  const draftId = createId("candidate_draft");
  const paths = draftPaths(draftId, roots);
  const createdAt = new Date().toISOString();
  const runId = optionalText(input.runId, 100);
  const contextBundleId = optionalText(input.contextBundleId, 100);
  if (contextBundleId) assertContextBundleId(contextBundleId);
  const usage = await neuralUsage(runId, optionalText(input.neuralModulesUsedPath, 500));
  const contextBundle = contextBundleId
    ? await readJson(bundlePaths(contextBundleId, roots).bundle)
    : null;
  const pipelineMetadata = buildEnginePipelineMetadata(contextBundle, usage);
  const warnings = [];
  if (/(正式結算|新版完整創作引擎候選|pending_engine_candidate)/iu.test(draftText)) {
    warnings.push("draft_text 疑似包含章節結算或 engine candidate 內容");
  }
  warnings.push(...pipelineMetadata.warnings);
  const metadata = {
    draft_id: draftId,
    run_id: runId,
    context_bundle_id: contextBundleId,
    source_chapter: optionalText(input.sourceChapter, 500),
    created_at: createdAt,
    created_by: "local_ui_import",
    draft_hash: sha256(draftText),
    based_on_active_engine_hash: active.hash,
    neural_modules_used_path: runId
      ? normalizeProjectPath(path.join(projectPaths.agentRuns, runId, "neural_modules_used.json"))
      : "",
    canon_status: "candidate",
    note: optionalText(input.note, 5_000),
    ...pipelineMetadata,
    warnings,
  };
  const status = {
    status: "candidate",
    proof_report_id: null,
    accepted_at: null,
    rejected_at: null,
    archived_at: null,
    blocked_reason: null,
    can_send_to_proofing: true,
    can_adopt: true,
    can_create_settlement: false,
  };
  await commitFileTransaction("save-candidate-draft", [
    { filePath: paths.draft, content: draftText },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.status, content: json(status) },
    { filePath: paths.neural, content: json(usage) },
  ], { draft_id: draftId, phase: "phase_4a" });
  return getCandidateDraft(draftId, options);
}

export async function listCandidateDrafts(options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const entries = await readdir(roots.candidateDrafts, { withFileTypes: true });
  const drafts = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeDraftId(entry.name)) continue;
    try {
      const paths = draftPaths(entry.name, roots);
      const [metadata, status, neural] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
        readJson(paths.neural),
      ]);
      drafts.push({ ...metadata, ...status, neural_usage: neural });
    } catch {
      // Ignore incomplete records.
    }
  }
  return drafts.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getCandidateDraft(draftId, options = {}) {
  assertDraftId(draftId);
  const roots = workflowRoots(options);
  const paths = draftPaths(draftId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Candidate draft not found.", 404);
  const [draftText, metadata, status, neural] = await Promise.all([
    readFile(paths.draft, "utf8"),
    readJson(paths.metadata),
    readJson(paths.status),
    readJson(paths.neural),
  ]);
  return { draft_text: draftText, metadata, status, neural_usage: neural };
}

export async function updateCandidateDraftStatus(draftId, updates = {}, options = {}) {
  assertDraftId(draftId);
  const roots = workflowRoots(options);
  const paths = draftPaths(draftId, roots);
  const current = await readJson(paths.status);
  const status = updates.status ?? current.status;
  if (!draftStatuses.has(status)) throw errorWithStatus("Invalid draft status.");
  const next = { ...current, ...updates, status };
  await commitFileTransaction("update-candidate-draft-status", [
    { filePath: paths.status, content: json(next) },
  ], { draft_id: draftId, phase: "phase_4a" });
  return next;
}

export async function buildProofingContextBundle(draftId, input = {}, options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const draft = await getCandidateDraft(draftId, options);
  if (!draft.status.can_send_to_proofing) {
    throw errorWithStatus(`Draft cannot be sent to proofing: ${draft.status.status}`, 409);
  }
  const contextBundleId = createId("context_bundle");
  const paths = bundlePaths(contextBundleId, roots);
  const createdAt = new Date().toISOString();
  const sources = await Promise.all([
    sourceRecord("active_engine", roots.activeEngine, "active"),
    sourceRecord(
      "active_proofing_card",
      path.join(projectRoot, "data", "proofing_policy_db", "active_proofing_card.md"),
      "policy",
    ),
    sourceRecord("generation_context", path.join(projectPaths.outputs, "generation_context.md"), "working"),
    sourceRecord("retrieval_context", path.join(projectPaths.outputs, "retrieval_context.md"), "working"),
  ]);
  const missingSources = sources.filter((source) => !source.exists).map((source) => source.label);
  const manifest = {
    context_bundle_id: contextBundleId,
    created_at: createdAt,
    task_type: "proofing",
    sources: sources.map(({ content, ...source }) => source),
    missing_sources: missingSources,
    warnings: missingSources.map((label) => `Missing source: ${label}`),
  };
  const bundle = {
    context_bundle_id: contextBundleId,
    task_type: "proofing",
    draft_id: draftId,
    created_at: createdAt,
    status: "ready",
    warning: missingSources.length > 0,
  };
  await commitFileTransaction("build-proofing-context-bundle", [
    { filePath: paths.bundle, content: json(bundle) },
    { filePath: paths.draft, content: draft.draft_text },
    {
      filePath: paths.generationContext,
      content: sources.find((source) => source.label === "generation_context")?.content || "",
    },
    {
      filePath: paths.retrievalContext,
      content: sources.find((source) => source.label === "retrieval_context")?.content || "",
    },
    {
      filePath: paths.proofingCard,
      content: sources.find((source) => source.label === "active_proofing_card")?.content || "",
    },
    { filePath: paths.manifest, content: json(manifest) },
  ], { draft_id: draftId, context_bundle_id: contextBundleId, phase: "phase_4a" });
  return { context_bundle: bundle, source_manifest: manifest };
}

export async function sendDraftToProofing(draftId, input = {}, options = {}) {
  const context = await buildProofingContextBundle(draftId, input, options);
  const run = await createAgentRun({
    task_type: "proofing",
    requires_neural_modules: input.requiresNeuralModules === true,
    required_neural_modules: input.requiredNeuralModules ?? [],
    input: JSON.stringify({ draft_id: draftId, context_bundle_id: context.context_bundle.context_bundle_id }),
    created_by: "local_ui",
  });
  await updateCandidateDraftStatus(draftId, {
    status: "proofing",
    can_send_to_proofing: false,
    proofing_run_id: run.run_id,
    proofing_context_bundle_id: context.context_bundle.context_bundle_id,
  }, options);
  return { run, ...context, draft: await getCandidateDraft(draftId, options) };
}

export function parseProofReportIssues(proofText) {
  const text = requireText(proofText, "proofText");
  const matches = [...text.matchAll(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\[|【)?(P[0-4])(?:\]|】)?(?:\s*[:：\-]\s*|\s+)?([^\n]*)/giu)];
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 };
  const issues = matches.map((match) => {
    const level = match[1].toUpperCase();
    counts[level] += 1;
    const line = match[2].trim();
    const [title = `${level} issue`, ...rest] = line.split(/\s*[|｜]\s*/u);
    return {
      level,
      title: title || `${level} issue`,
      description: rest[0] ?? line,
      suggested_action: rest[1] ?? "",
    };
  });
  return {
    p0_count: counts.P0,
    p1_count: counts.P1,
    p2_count: counts.P2,
    p3_count: counts.P3,
    p4_count: counts.P4,
    issues,
    can_adopt_recommendation: counts.P0 === 0 && counts.P1 === 0,
    warnings: matches.length ? [] : ["未解析到 P0-P4 issue 標記"],
  };
}

export async function saveProofReport(input = {}, options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const draftId = assertDraftId(input.draftId);
  const draft = await getCandidateDraft(draftId, options);
  if (["rejected", "archived", "blocked", "accepted_pending_settlement"].includes(draft.status.status)) {
    throw errorWithStatus(`Draft cannot receive proof report: ${draft.status.status}`, 409);
  }
  const proofText = requireText(input.proofText, "proofText");
  const proofId = createId("proof_report");
  const paths = proofPaths(proofId, roots);
  const runId = optionalText(input.runId, 100);
  const contextBundleId = optionalText(input.contextBundleId, 100);
  if (contextBundleId) assertContextBundleId(contextBundleId);
  const usage = await neuralUsage(runId, optionalText(input.neuralModulesUsedPath, 500));
  const issues = parseProofReportIssues(proofText);
  const metadata = {
    proof_id: proofId,
    draft_id: draftId,
    run_id: runId,
    context_bundle_id: contextBundleId,
    created_at: new Date().toISOString(),
    created_by: "local_ui_import",
    proof_hash: sha256(proofText),
    draft_hash_at_proofing: draft.metadata.draft_hash,
    neural_modules_used_path: runId
      ? normalizeProjectPath(path.join(projectPaths.agentRuns, runId, "neural_modules_used.json"))
      : "",
    canon_status: "proof_report",
  };
  const status = { status: "completed", blocked_reason: null };
  const nextDraftStatus = {
    ...draft.status,
    status: "proofed",
    proof_report_id: proofId,
    can_send_to_proofing: true,
  };
  const draftStatusPath = draftPaths(draftId, roots).status;
  await commitFileTransaction("save-proof-report", [
    { filePath: paths.report, content: proofText },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.issues, content: json(issues) },
    { filePath: paths.status, content: json(status) },
    { filePath: paths.neural, content: json(usage) },
    { filePath: draftStatusPath, content: json(nextDraftStatus) },
  ], { proof_id: proofId, draft_id: draftId, phase: "phase_4a" });
  return getProofReport(proofId, options);
}

export async function listProofReports(options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const entries = await readdir(roots.proofReports, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeProofId(entry.name)) continue;
    try {
      const paths = proofPaths(entry.name, roots);
      const [metadata, status, issues, neural] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
        readJson(paths.issues),
        readJson(paths.neural),
      ]);
      reports.push({ ...metadata, ...status, issue_summary: issues, neural_usage: neural });
    } catch {
      // Ignore incomplete records.
    }
  }
  return reports.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getProofReport(proofId, options = {}) {
  assertProofId(proofId);
  const roots = workflowRoots(options);
  const paths = proofPaths(proofId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Proof report not found.", 404);
  const [proofText, metadata, status, issues, neural] = await Promise.all([
    readFile(paths.report, "utf8"),
    readJson(paths.metadata),
    readJson(paths.status),
    readJson(paths.issues),
    readJson(paths.neural),
  ]);
  return {
    proof_text: proofText,
    metadata,
    status,
    issue_summary: issues,
    neural_usage: neural,
  };
}

export async function adoptCandidateDraft(
  draftId,
  { confirm = false, adoptedBy = "local_user", note = "" } = {},
  options = {},
) {
  assertDraftId(draftId);
  if (confirm !== true) throw errorWithStatus("User confirmation is required.", 409);
  const roots = await ensureWritingWorkflowDirectories(options);
  const draft = await getCandidateDraft(draftId, options);
  if (["rejected", "archived", "blocked", "accepted_pending_settlement"].includes(draft.status.status)) {
    throw errorWithStatus(`Draft cannot be adopted: ${draft.status.status}`, 409);
  }
  const proof = draft.status.proof_report_id
    ? await getProofReport(draft.status.proof_report_id, options)
    : null;
  const adoptedChapterId = createId("adopted_chapter");
  const paths = adoptedPaths(adoptedChapterId, roots);
  const adoptedAt = new Date().toISOString();
  const hasSevereIssues = Boolean(
    proof && (proof.issue_summary.p0_count > 0 || proof.issue_summary.p1_count > 0),
  );
  const metadata = {
    adopted_chapter_id: adoptedChapterId,
    draft_id: draftId,
    proof_report_id: draft.status.proof_report_id,
    adopted_at: adoptedAt,
    adopted_by: optionalText(adoptedBy, 200) || "local_user",
    chapter_hash: sha256(draft.draft_text),
    canon_status: "adopted_pending_settlement",
    note: optionalText(note, 5_000),
    warning: hasSevereIssues ? "Latest proof report contains P0/P1; manually adopted." : null,
    engine_pipeline: {
      engine_first: draft.metadata.engine_first === true,
      context_snapshot_id: draft.metadata.context_snapshot_id ?? null,
      context_bundle_id: draft.metadata.context_bundle_id ?? null,
      engine_components_valid: draft.metadata.engine_components_valid === true,
      neural_trace_complete: draft.metadata.neural_trace_complete === true,
      pipeline_status:
        draft.metadata.pipeline_status ?? "incomplete_engine_pipeline",
      missing_required_neural_modules:
        draft.metadata.missing_required_neural_modules ?? [],
    },
  };
  const status = {
    status: "accepted_pending_settlement",
    can_create_settlement: true,
    settlement_candidate_id: null,
  };
  const nextDraftStatus = {
    ...draft.status,
    status: "accepted_pending_settlement",
    accepted_at: adoptedAt,
    can_send_to_proofing: false,
    can_adopt: false,
    can_create_settlement: true,
    adoption_warning: metadata.warning,
  };
  await commitFileTransaction("adopt-candidate-draft", [
    { filePath: paths.chapter, content: draft.draft_text },
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.status, content: json(status) },
    { filePath: draftPaths(draftId, roots).status, content: json(nextDraftStatus) },
  ], { adopted_chapter_id: adoptedChapterId, draft_id: draftId, phase: "phase_4a" });
  return getAdoptedChapter(adoptedChapterId, options);
}

async function closeDraft(draftId, status, reason, options = {}) {
  const draft = await getCandidateDraft(draftId, options);
  if (["accepted_pending_settlement", "rejected", "archived"].includes(draft.status.status)) {
    throw errorWithStatus(`Draft cannot transition from ${draft.status.status}.`, 409);
  }
  const now = new Date().toISOString();
  return updateCandidateDraftStatus(draftId, {
    status,
    rejected_at: status === "rejected" ? now : draft.status.rejected_at,
    archived_at: status === "archived" ? now : draft.status.archived_at,
    close_reason: optionalText(reason, 5_000),
    can_send_to_proofing: false,
    can_adopt: false,
    can_create_settlement: false,
  }, options);
}

export async function rejectCandidateDraft(draftId, { reason = "" } = {}, options = {}) {
  return closeDraft(draftId, "rejected", reason, options);
}

export async function archiveCandidateDraft(draftId, { reason = "" } = {}, options = {}) {
  return closeDraft(draftId, "archived", reason, options);
}

export async function listAdoptedChapters(options = {}) {
  const roots = await ensureWritingWorkflowDirectories(options);
  const entries = await readdir(roots.adoptedChapters, { withFileTypes: true });
  const chapters = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeAdoptedChapterId(entry.name)) continue;
    try {
      const paths = adoptedPaths(entry.name, roots);
      const [metadata, status] = await Promise.all([
        readJson(paths.metadata),
        readJson(paths.status),
      ]);
      chapters.push({ ...metadata, ...status });
    } catch {
      // Ignore incomplete records.
    }
  }
  return chapters.sort((left, right) => String(right.adopted_at).localeCompare(String(left.adopted_at)));
}

export async function getAdoptedChapter(adoptedChapterId, options = {}) {
  assertAdoptedChapterId(adoptedChapterId);
  const roots = workflowRoots(options);
  const paths = adoptedPaths(adoptedChapterId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Adopted chapter not found.", 404);
  const [chapterText, metadata, status] = await Promise.all([
    readFile(paths.chapter, "utf8"),
    readJson(paths.metadata),
    readJson(paths.status),
  ]);
  return { chapter_text: chapterText, metadata, status };
}

export async function updateAdoptedChapterStatus(
  adoptedChapterId,
  updates = {},
  options = {},
) {
  assertAdoptedChapterId(adoptedChapterId);
  const roots = workflowRoots(options);
  const paths = adoptedPaths(adoptedChapterId, roots);
  if (!await exists(paths.directory)) throw errorWithStatus("Adopted chapter not found.", 404);
  const current = await readJson(paths.status);
  const status = updates.status ?? current.status;
  if (!adoptedChapterStatuses.has(status)) {
    throw errorWithStatus("Invalid adopted chapter status.");
  }
  const next = { ...current, ...updates, status };
  await commitFileTransaction("update-adopted-chapter-status", [
    { filePath: paths.status, content: json(next) },
  ], {
    adopted_chapter_id: adoptedChapterId,
    phase: "phase_4b_settlement_pending_only",
  });
  return getAdoptedChapter(adoptedChapterId, options);
}
