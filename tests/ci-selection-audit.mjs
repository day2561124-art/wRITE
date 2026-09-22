import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { selectAffectedTestPlan } from "./affected-test-selector.mjs";
import { collectCiRangeChangeEvidence } from "./ci-change-detection.mjs";

export const CI_SELECTION_AUDIT_VERSION = "ci-selection-audit-v1";
export const CI_SELECTION_AUDIT_CLASSIFICATIONS = Object.freeze([
  "CONSISTENT_PASS",
  "SELECTOR_MISS_CANDIDATE",
  "AFFECTED_FAILED_FULL_PASSED",
  "BOTH_FAILED",
  "FULL_FALLBACK_PASS",
  "FULL_FALLBACK_FAIL",
]);

const suiteScripts = Object.freeze({
  communication: "tests/run-communication.mjs",
  memory_retrieval: "tests/run-memory-retrieval.mjs",
  cognition: "tests/run-cognition.mjs",
  world_simulation: "tests/run-world-simulation.mjs",
  all: "tests/run-all.mjs",
});

export function classifySelectionAuditOutcome({
  focused,
  affectedPassed,
  fullPassed,
} = {}) {
  if (focused !== true) {
    return fullPassed === true ? "FULL_FALLBACK_PASS" : "FULL_FALLBACK_FAIL";
  }
  if (affectedPassed === true && fullPassed === true) return "CONSISTENT_PASS";
  if (affectedPassed === true && fullPassed !== true) return "SELECTOR_MISS_CANDIDATE";
  if (affectedPassed !== true && fullPassed === true) return "AFFECTED_FAILED_FULL_PASSED";
  return "BOTH_FAILED";
}

export function buildSelectionAuditExecution(plan = {}) {
  const focused = plan.focused === true;
  const requiredSuites = Array.isArray(plan.required_suites)
    ? [...plan.required_suites]
    : [plan.suite].filter(Boolean);
  if (focused && requiredSuites.length === 0) {
    throw new Error("Focused selector audit requires at least one affected suite.");
  }
  if (focused && requiredSuites.includes("all")) {
    throw new Error("Focused selector audit cannot include the all suite.");
  }
  return Object.freeze({
    focused,
    affected_suites: Object.freeze(focused ? requiredSuites : []),
    run_full: true,
  });
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`Missing required ${name} SHA.`);
  }
  return process.argv[index + 1];
}

function runNodeScript(rootDir, script) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [script], {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve(Object.freeze({
        script,
        passed: code === 0,
        exit_code: code,
        signal: signal ?? null,
        duration_ms: Math.max(0, Date.now() - startedAt),
      }));
    });
  });
}

async function runAudit() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const evidence = await collectCiRangeChangeEvidence({
    projectRoot: rootDir,
    baseSha: readFlag("--base"),
    headSha: readFlag("--head"),
  });
  const plan = await selectAffectedTestPlan({
    projectRoot: rootDir,
    changedPaths: evidence.changed_paths,
    runAllDiffText: evidence.run_all_diff_text,
  });
  const execution = buildSelectionAuditExecution(plan);
  const affectedResults = [];

  for (const suite of execution.affected_suites) {
    const script = suiteScripts[suite];
    if (!script || script === suiteScripts.all) {
      throw new Error(`Unsupported focused audit suite: ${suite}`);
    }
    affectedResults.push(Object.freeze({
      suite,
      ...await runNodeScript(rootDir, script),
    }));
  }

  const fullResult = await runNodeScript(rootDir, suiteScripts.all);
  const affectedPassed = affectedResults.every((item) => item.passed === true);
  const classification = classifySelectionAuditOutcome({
    focused: execution.focused,
    affectedPassed,
    fullPassed: fullResult.passed,
  });
  const selectorMissCandidate = classification === "SELECTOR_MISS_CANDIDATE";
  const passed = fullResult.passed === true
    && (execution.focused !== true || affectedPassed === true);

  const receipt = Object.freeze({
    schema_version: CI_SELECTION_AUDIT_VERSION,
    base_sha: evidence.base_sha,
    head_sha: evidence.head_sha,
    selector_version: plan.selector_version ?? null,
    changed_paths: evidence.changed_paths,
    focused: execution.focused,
    fallback_reason: plan.fallback_reason ?? null,
    required_suites: plan.required_suites ?? [plan.suite].filter(Boolean),
    affected_tests: plan.affected_tests ?? [],
    selected_group_tests: plan.selected_group_tests ?? [],
    affected_results: Object.freeze(affectedResults),
    full_result: fullResult,
    classification,
    selector_miss_candidate: selectorMissCandidate,
    passed,
    completed_at: new Date().toISOString(),
  });

  const outputDir = path.join(rootDir, "tests", ".tmp");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "ci-selection-audit.last.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );

  console.log("\nCI selection audit receipt:");
  console.log(JSON.stringify(receipt, null, 2));

  if (!passed) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  runAudit().catch((error) => {
    console.error(`CI selection audit failed: ${error.message}`);
    process.exitCode = 1;
  });
}
