import { createHash } from "node:crypto";

// Independently bound GitHub REST reader. No signing, publishing, dispatch,
// or local integration authority. Do not use abbreviated connector results,
// candidate artifacts, or log text to infer missing provider metadata.
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const repoName = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const workflowPath = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u;
const positive = v => Number.isSafeInteger(v) && v > 0;
const nonblank = v => typeof v === "string" && v.trim().length > 0 && v.length <= 200;
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const success = v => v?.status === "completed" && v.conclusion === "success";
const sameRepo = (v, policy) => v?.id === policy.repository_id && v.full_name === policy.repository;
const denied = code => ({ observed: false, code, execution_authorized: false });
const rowFields = ["suite", "platform", "workflow_id", "workflow_path", "workflow_sha256",
  "job_name", "runner_label", "runner_group_name", "required_steps"];
const validRow = r => exact(r, rowFields) && nonblank(r.suite)
  && ["windows", "linux"].includes(r.platform) && positive(r.workflow_id)
  && typeof r.workflow_path === "string" && workflowPath.test(r.workflow_path)
  && typeof r.workflow_sha256 === "string" && digest.test(r.workflow_sha256)
  && nonblank(r.job_name) && nonblank(r.runner_label) && nonblank(r.runner_group_name)
  && Array.isArray(r.required_steps) && r.required_steps.length >= 2 && r.required_steps.length <= 40
  && r.required_steps.every(nonblank) && new Set(r.required_steps).size === r.required_steps.length;
const rowKey = r => r.suite + ":" + r.platform;
const dateMs = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(s) ? Date.parse(s) : NaN;

export function createGitHubVerificationCollector({ policy, readRun, readJobs, readWorkflowBytes, clock = Date.now } = {}) {
  if ([readRun, readJobs, readWorkflowBytes, clock].some(f => typeof f !== "function")
    || !exact(policy, ["repository", "repository_id", "required", "max_age_ms"])
    || typeof policy.repository !== "string" || !repoName.test(policy.repository)
    || !positive(policy.repository_id) || !positive(policy.max_age_ms) || policy.max_age_ms > 604800000
    || !Array.isArray(policy.required) || !policy.required.length || policy.required.length > 64
    || !policy.required.every(validRow)
    || new Set(policy.required.map(rowKey)).size !== policy.required.length)
    throw new Error("INVALID_GITHUB_VERIFICATION_HOST_POLICY");
  // Policy must be supplied by the independent host, not a candidate-controlled
  // workflow. Its pinned definition must use exact checkout, direct mandatory
  // test steps, no continue-on-error, and disposable hosted runners.
  const trusted = structuredClone(policy);
  async function checkRun(run, runId, commit, row) {
    if (!run || run.id !== runId || !positive(run.run_attempt)
      || !sameRepo(run.repository, trusted) || !sameRepo(run.head_repository, trusted)
      || run.head_sha !== commit || run.workflow_id !== row.workflow_id
      || typeof run.path !== "string" || run.path.split("@")[0] !== row.workflow_path)
      return "GITHUB_RUN_IDENTITY_UNVERIFIED";
    // A PR workflow can be evaluated against a synthetic merge ref; a
    // candidate file hash does not prove the executed workflow definition.
    // Until independently attested merge-ref provenance is implemented,
    // accept only direct commit push/dispatch runs.
    if (!["push", "workflow_dispatch"].includes(run.event)) return "GITHUB_WORKFLOW_EVENT_UNSUPPORTED";
    if (!success(run)) return "GITHUB_RUN_NOT_SUCCESSFUL";
    return null;
  }

  return async function collect(input) {
    if (!exact(input, ["commit", "runs"]) || typeof input.commit !== "string" || !sha.test(input.commit)
      || !Array.isArray(input.runs) || input.runs.length !== trusted.required.length
      || !input.runs.every(r => exact(r, ["suite", "platform", "run_id"])
        && positive(r.run_id) && nonblank(r.suite) && ["windows", "linux"].includes(r.platform))
      || new Set(input.runs.map(rowKey)).size !== input.runs.length) return denied("INVALID_GITHUB_VERIFICATION_REQUEST");
    const request = structuredClone(input);
    const rows = new Map(request.runs.map(r => [rowKey(r), r]));
    const observations = [];
    const runFences = [];
    try {
      for (const required of trusted.required) {
        const selection = rows.get(rowKey(required));
        if (!selection) return denied("GITHUB_VERIFICATION_COVERAGE_MISMATCH");
        const args = { repository: trusted.repository, run_id: selection.run_id };
        const run = await readRun(args);
        const problem = await checkRun(run, selection.run_id, request.commit, required);
        if (problem) return denied(problem);
        const attempt = run.run_attempt;
        const bytes = await readWorkflowBytes({ repository: trusted.repository, commit: request.commit, path: required.workflow_path });
        if (!Buffer.isBuffer(bytes) || bytes.length > 256 * 1024
          || createHash("sha256").update(bytes).digest("hex") !== required.workflow_sha256)
          return denied("GITHUB_WORKFLOW_DEFINITION_MISMATCH");
        // An attempt-specific listing with full, bounded coverage is mandatory.
        const page = await readJobs({ ...args, run_attempt: attempt });
        if (!Array.isArray(page?.jobs) || !positive(page.total_count) || page.total_count !== page.jobs.length
          || page.jobs.length > 100) return denied("GITHUB_JOB_LIST_INCOMPLETE");
        const matches = page.jobs.filter(j => j.name === required.job_name);
        if (matches.length !== 1) return denied("GITHUB_JOB_IDENTITY_UNVERIFIED");
        const job = matches[0];
        if (!positive(job.id) || job.run_id !== selection.run_id || job.head_sha !== request.commit
          || !Array.isArray(job.labels) || job.labels.includes("self-hosted")
          || !job.labels.includes(required.runner_label) || job.runner_group_name !== required.runner_group_name)
          return denied("GITHUB_JOB_IDENTITY_UNVERIFIED");
        if (!success(job)) return denied("GITHUB_JOB_NOT_SUCCESSFUL");
        if (!Array.isArray(job.steps) || job.steps.length > 100) return denied("GITHUB_STEP_EVIDENCE_INCOMPLETE");
        let previous = 0;
        for (const name of required.required_steps) {
          const found = job.steps.filter(s => s.name === name);
          if (found.length !== 1 || !success(found[0]) || !positive(found[0].number) || found[0].number <= previous)
            return denied("GITHUB_STEP_EVIDENCE_INCOMPLETE");
          previous = found[0].number;
        }
        const completed = dateMs(job.completed_at);
        const started = dateMs(job.started_at);
        const runStarted = dateMs(run.run_started_at);
        const now = clock();
        if (!positive(now) || !positive(completed) || !positive(started) || !positive(runStarted)
          || started < runStarted || completed < started || completed > now || now - completed > trusted.max_age_ms)
          return denied("GITHUB_JOB_TIMESTAMP_UNVERIFIED");
        runFences.push({ args, row: required, attempt, updated_at: run.updated_at });
        observations.push({ suite: required.suite, platform: required.platform,
          workflow_sha256: required.workflow_sha256, commit: request.commit, run_id: selection.run_id,
          job_id: job.id, run_attempt: attempt, completed_at_ms: completed,
          provider_job_conclusion: "success", required_steps: [...required.required_steps] });
      }
      for (const fence of runFences) {
        const again = await readRun(fence.args);
        if (await checkRun(again, fence.args.run_id, request.commit, fence.row)
          || typeof fence.updated_at !== "string" || again.updated_at !== fence.updated_at || again.run_attempt !== fence.attempt)
          return denied("GITHUB_RUN_CHANGED_DURING_OBSERVATION");
      }
      // Provider conclusions are not raw test process exit codes. An
      // independently trusted issuer must adopt only reviewed test semantics;
      // this collector never turns API status into signed PASS evidence.
      return Object.freeze({ observed: true, code: "GITHUB_EXACT_RUN_OBSERVED", execution_authorized: false,
        commit: request.commit, observations: Object.freeze(observations.map(Object.freeze)) });
    } catch { return denied("GITHUB_VERIFICATION_SOURCE_UNAVAILABLE"); }
  };
}
