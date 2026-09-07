import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  cognitionSteps,
  memoryRetrievalSteps,
  worldSimulationSteps,
} from "./test-suite-groups.mjs";

export const affectedTestSelectorVersion = "affected-test-selector-v2";

function normalizeProjectPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "")
    .replace(/\/{2,}/gu, "/");
}

function stepPaths(steps) {
  return new Set(
    steps.flatMap(([, args]) => args.map(normalizeProjectPath)),
  );
}

const memoryRetrievalTests = stepPaths(memoryRetrievalSteps);
const cognitionTests = stepPaths(cognitionSteps);
const worldSimulationTests = stepPaths(worldSimulationSteps);
const groupedTests = new Set([
  ...worldSimulationTests,
  ...cognitionTests,
  ...memoryRetrievalTests,
]);

const RUN_ALL_PATH = "tests/run-all.mjs";
const STATIC_RUN_ALL_TEST_STEP_PATTERN = /^\s*\["[^"\r\n]+",\s*\["(tests\/[^"\r\n]+\.test\.mjs)"\]\],\s*$/u;

export function classifyRunAllInventoryDiff(diffText) {
  const addedTests = new Set();
  const removedTests = new Set();

  for (const line of String(diffText ?? "").split(/\r?\n/u)) {
    if (
      line === ""
      || line.startsWith("diff --git ")
      || line.startsWith("index ")
      || line.startsWith("--- ")
      || line.startsWith("+++ ")
      || line.startsWith("@@ ")
      || line === "\\ No newline at end of file"
      || line.startsWith(" ")
    ) {
      continue;
    }

    if (!line.startsWith("+") && !line.startsWith("-")) continue;
    const content = line.slice(1);
    if (content.trim() === "") continue;

    const match = content.match(STATIC_RUN_ALL_TEST_STEP_PATTERN);
    if (!match) {
      const resemblesInventory = content.includes("tests/") && content.includes(".test.mjs");
      return {
        safe: false,
        classification: resemblesInventory
          ? "RUN_ALL_UNCLASSIFIABLE_INVENTORY_CHANGE"
          : "RUN_ALL_RUNNER_SEMANTICS_CHANGED",
        fallback_reason: resemblesInventory
          ? "RUN_ALL_UNCLASSIFIABLE_INVENTORY_CHANGE"
          : "RUN_ALL_RUNNER_SEMANTICS_CHANGED",
        added_tests: [...addedTests].sort(),
        removed_tests: [...removedTests].sort(),
      };
    }

    const testPath = normalizeProjectPath(match[1]);
    if (line.startsWith("+")) addedTests.add(testPath);
    else removedTests.add(testPath);
  }

  if (removedTests.size > 0) {
    const removedTest = [...removedTests].sort()[0];
    return {
      safe: false,
      classification: "RUN_ALL_INVENTORY_REMOVAL",
      fallback_reason: `RUN_ALL_INVENTORY_REMOVAL:${removedTest}`,
      added_tests: [...addedTests].sort(),
      removed_tests: [...removedTests].sort(),
    };
  }

  if (addedTests.size === 0) {
    return {
      safe: false,
      classification: "RUN_ALL_NO_PROVABLE_INVENTORY_DELTA",
      fallback_reason: "RUN_ALL_NO_PROVABLE_INVENTORY_DELTA",
      added_tests: [],
      removed_tests: [],
    };
  }

  const unmappedTest = [...addedTests].sort().find((testPath) => !groupedTests.has(testPath));
  if (unmappedTest) {
    return {
      safe: false,
      classification: "RUN_ALL_INVENTORY_UNMAPPED_TEST",
      fallback_reason: `RUN_ALL_INVENTORY_UNMAPPED_TEST:${unmappedTest}`,
      added_tests: [...addedTests].sort(),
      removed_tests: [],
    };
  }

  return {
    safe: true,
    classification: "RUN_ALL_INVENTORY_ONLY",
    fallback_reason: null,
    added_tests: [...addedTests].sort(),
    removed_tests: [],
  };
}

function readRunAllWorkingTreeDiff(projectRoot) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "git.exe" : "git";
    const child = spawn(executable, [
      "--no-pager",
      "-c",
      "core.fsmonitor=false",
      "diff",
      "--no-ext-diff",
      "--no-color",
      "--unified=0",
      "HEAD",
      "--",
      RUN_ALL_PATH,
    ], {
      cwd: projectRoot,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git diff failed for ${RUN_ALL_PATH}: ${stderr.trim() || `exit ${code}`}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function listMjsFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, ...relativeDir.split("/"));
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".tmp" || entry.name === "node_modules") continue;
    const relativePath = normalizeProjectPath(`${relativeDir}/${entry.name}`);
    if (entry.isDirectory()) {
      files.push(...await listMjsFiles(rootDir, relativePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(relativePath);
  }
  return files;
}

function extractLocalReferences(source, sourcePath) {
  const references = new Set();
  const literalPatterns = [
    /["']((?:\.\.?\/)[^"'\r\n]+\.mjs)["']/gu,
  ];
  if (
    sourcePath.endsWith(".test.mjs")
    && sourcePath !== "tests/affected-test-selector.test.mjs"
  ) {
    literalPatterns.push(
      /["']((?:server\/src|tests)\/[^"'\r\n]+\.mjs)["']/gu,
    );
  }
  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      const resolved = specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier))
        : path.posix.normalize(specifier);
      if (resolved.startsWith("server/src/") || resolved.startsWith("tests/")) {
        references.add(normalizeProjectPath(resolved));
      }
    }
  }
  return references;
}

async function buildReverseDependencyGraph(projectRoot) {
  const files = [
    ...await listMjsFiles(projectRoot, "server/src"),
    ...await listMjsFiles(projectRoot, "tests"),
  ];
  const reverse = new Map();
  for (const file of files) {
    const source = await readFile(path.join(projectRoot, ...file.split("/")), "utf8");
    for (const dependency of extractLocalReferences(source, file)) {
      const dependents = reverse.get(dependency) ?? new Set();
      dependents.add(file);
      reverse.set(dependency, dependents);
    }
  }
  return reverse;
}

function collectAffectedTests(reverseGraph, changedPath) {
  const queue = [changedPath];
  const visited = new Set(queue);
  const affectedTests = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.startsWith("tests/") && current.endsWith(".test.mjs")) {
      affectedTests.add(current);
    }
    for (const dependent of reverseGraph.get(current) ?? []) {
      if (visited.has(dependent)) continue;
      visited.add(dependent);
      queue.push(dependent);
    }
  }
  return affectedTests;
}

function focusedSuiteForTests(tests) {
  if (tests.size > 0 && [...tests].every((item) => memoryRetrievalTests.has(item))) {
    return "memory_retrieval";
  }
  if (tests.size > 0 && [...tests].every((item) => cognitionTests.has(item))) {
    return "cognition";
  }
  if (tests.size > 0 && [...tests].every((item) => worldSimulationTests.has(item))) {
    return "world_simulation";
  }
  return "all";
}

function fallbackPlan(changedPaths, reason, affectedTests = []) {
  return {
    selector_version: affectedTestSelectorVersion,
    suite: "all",
    focused: false,
    fallback_reason: reason,
    changed_paths: [...changedPaths].sort(),
    affected_tests: [...affectedTests].sort(),
    selected_group_tests: [],
    deferred_certification_tests: [],
    certification_required: false,
  };
}

export async function selectAffectedTestPlan({ projectRoot, changedPaths, runAllDiffText }) {
  const normalizedChangedPaths = new Set(
    (changedPaths ?? []).map(normalizeProjectPath).filter(Boolean),
  );
  if (normalizedChangedPaths.size === 0) {
    return fallbackPlan(normalizedChangedPaths, "NO_WORKING_TREE_CHANGES");
  }

  const runAllInventoryTests = new Set();
  for (const changedPath of normalizedChangedPaths) {
    const eligibleProduction = changedPath.startsWith("server/src/world-simulation-")
      && changedPath.endsWith(".mjs");
    const eligibleGroupedTest = groupedTests.has(changedPath);
    if (changedPath === RUN_ALL_PATH) {
      let diffText = runAllDiffText;
      if (diffText === undefined) {
        try {
          diffText = await readRunAllWorkingTreeDiff(projectRoot);
        } catch {
          return fallbackPlan(normalizedChangedPaths, "RUN_ALL_DIFF_UNAVAILABLE");
        }
      }
      const classification = classifyRunAllInventoryDiff(diffText);
      if (!classification.safe) {
        return fallbackPlan(normalizedChangedPaths, classification.fallback_reason);
      }
      for (const testPath of classification.added_tests) {
        runAllInventoryTests.add(testPath);
      }
      continue;
    }
    if (!eligibleProduction && !eligibleGroupedTest) {
      return fallbackPlan(normalizedChangedPaths, `UNSCOPED_CHANGE:${changedPath}`);
    }
  }

  const reverseGraph = await buildReverseDependencyGraph(projectRoot);
  const affectedTests = new Set(runAllInventoryTests);
  for (const changedPath of normalizedChangedPaths) {
    if (changedPath === RUN_ALL_PATH) continue;
    if (groupedTests.has(changedPath)) affectedTests.add(changedPath);
    for (const testPath of collectAffectedTests(reverseGraph, changedPath)) {
      affectedTests.add(testPath);
    }
  }

  if (affectedTests.size === 0) {
    return fallbackPlan(normalizedChangedPaths, "NO_PROVABLE_AFFECTED_TESTS");
  }

  const selectedGroupTests = new Set(
    [...affectedTests].filter((testPath) => groupedTests.has(testPath)),
  );
  if (selectedGroupTests.size === 0) {
    return fallbackPlan(normalizedChangedPaths, "NO_FOCUSED_GROUP_DEPENDENTS", affectedTests);
  }

  const deferredCertificationTests = new Set(
    [...affectedTests].filter((testPath) => !groupedTests.has(testPath)),
  );
  const suite = focusedSuiteForTests(selectedGroupTests);
  if (suite === "all") {
    return fallbackPlan(normalizedChangedPaths, "FOCUSED_GROUP_SELECTION_FAILED", affectedTests);
  }

  return {
    selector_version: affectedTestSelectorVersion,
    suite,
    focused: true,
    fallback_reason: null,
    changed_paths: [...normalizedChangedPaths].sort(),
    affected_tests: [...affectedTests].sort(),
    selected_group_tests: [...selectedGroupTests].sort(),
    deferred_certification_tests: [...deferredCertificationTests].sort(),
    certification_required: deferredCertificationTests.size > 0,
  };
}

function parsePorcelainZ(output) {
  const tokens = output.split("\0");
  const changedPaths = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token.length < 4) continue;
    const status = token.slice(0, 2);
    const filePath = token.slice(3);
    if (filePath) changedPaths.add(normalizeProjectPath(filePath));
    if (status.includes("R") || status.includes("C")) {
      const secondPath = tokens[index + 1];
      if (secondPath) changedPaths.add(normalizeProjectPath(secondPath));
      index += 1;
    }
  }
  return [...changedPaths];
}

export function collectWorkingTreeChangedPaths(projectRoot) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "git.exe" : "git";
    const child = spawn(executable, [
      "--no-pager",
      "-c",
      "core.fsmonitor=false",
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ], {
      cwd: projectRoot,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git status failed for affected selector: ${stderr.trim() || `exit ${code}`}`));
        return;
      }
      resolve(parsePorcelainZ(stdout));
    });
  });
}
