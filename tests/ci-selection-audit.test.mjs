import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CI_SELECTION_AUDIT_CLASSIFICATIONS,
  buildSelectionAuditExecution,
  classifySelectionAuditOutcome,
} from "./ci-selection-audit.mjs";

assert.deepEqual(CI_SELECTION_AUDIT_CLASSIFICATIONS, [
  "CONSISTENT_PASS",
  "SELECTOR_MISS_CANDIDATE",
  "AFFECTED_FAILED_FULL_PASSED",
  "BOTH_FAILED",
  "FULL_FALLBACK_PASS",
  "FULL_FALLBACK_FAIL",
]);

assert.equal(classifySelectionAuditOutcome({
  focused: true,
  affectedPassed: true,
  fullPassed: true,
}), "CONSISTENT_PASS");
assert.equal(classifySelectionAuditOutcome({
  focused: true,
  affectedPassed: true,
  fullPassed: false,
}), "SELECTOR_MISS_CANDIDATE");
assert.equal(classifySelectionAuditOutcome({
  focused: true,
  affectedPassed: false,
  fullPassed: true,
}), "AFFECTED_FAILED_FULL_PASSED");
assert.equal(classifySelectionAuditOutcome({
  focused: true,
  affectedPassed: false,
  fullPassed: false,
}), "BOTH_FAILED");
assert.equal(classifySelectionAuditOutcome({
  focused: false,
  affectedPassed: false,
  fullPassed: true,
}), "FULL_FALLBACK_PASS");
assert.equal(classifySelectionAuditOutcome({
  focused: false,
  affectedPassed: true,
  fullPassed: false,
}), "FULL_FALLBACK_FAIL");

assert.deepEqual(buildSelectionAuditExecution({
  focused: true,
  required_suites: ["cognition", "communication"],
}), {
  focused: true,
  affected_suites: ["cognition", "communication"],
  run_full: true,
});
assert.deepEqual(buildSelectionAuditExecution({
  focused: false,
  suite: "all",
  required_suites: ["all"],
}), {
  focused: false,
  affected_suites: [],
  run_full: true,
});
assert.throws(() => buildSelectionAuditExecution({
  focused: true,
  required_suites: ["all"],
}), /cannot include the all suite/u);
assert.throws(() => buildSelectionAuditExecution({
  focused: true,
  required_suites: [],
}), /requires at least one affected suite/u);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = await readFile(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const scheduledStart = workflow.indexOf("  scheduled-full:\n");
const manualStart = workflow.indexOf("  manual-full:\n");
assert.notEqual(scheduledStart, -1, "scheduled-full job must exist");
assert.notEqual(manualStart, -1, "manual-full job must exist");
const scheduled = workflow.slice(scheduledStart, manualStart);

assert.match(scheduled, /selector_audit: false/u);
assert.match(scheduled, /selector_audit: true/u);
assert.match(scheduled, /fetch-depth: 0/u);
assert.match(scheduled, /--max-count=21 HEAD/u);
assert.match(scheduled, /node tests\/ci-selection-audit\.mjs/u);
assert.match(scheduled, /matrix\.selector_audit == true/u);
assert.match(scheduled, /matrix\.selector_audit == false/u);
assert.match(scheduled, /node tests\/run-all\.mjs/u);
assert.equal(
  (scheduled.match(/node tests\/run-all\.mjs/gu) ?? []).length,
  1,
  "scheduled non-audit lanes should retain one direct full-run command",
);

console.log("VA-13 CI selection audit contract passed.");
