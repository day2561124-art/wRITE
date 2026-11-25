import { lstat, readFile } from "node:fs/promises";
import { createPiOperatorBatchApproval } from "../server/src/pi-operator-batch-approval.mjs";
import { createPiEngineeringBindingPublisher } from "../server/src/pi-engineering-binding-publisher.mjs";
import { createPiTaskAuthorizationStore } from "../server/src/pi-task-authorization.mjs";
import { resolveDevWorkspaceExecutionContext } from "../server/src/mcp-development-workstream-tools.mjs";

const [command, file, approvedPlanSha256, ...extra] = process.argv.slice(2);
const root = process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
const store = createPiTaskAuthorizationStore({ root });
const resolveWorkspace = resolveDevWorkspaceExecutionContext;
const publisher = createPiEngineeringBindingPublisher({ root, resolveWorkspace, authorizeTask: store.authorize });
const batch = createPiOperatorBatchApproval({ root, store, publisher, resolveWorkspace });

try {
  if (!file || extra.length || !["preview", "apply"].includes(command)
    || (command === "preview" && approvedPlanSha256 !== undefined)
    || (command === "apply" && !/^[a-f0-9]{64}$/u.test(approvedPlanSha256 ?? ""))) {
    throw new Error("Usage: node scripts/manage-pi-operator-batch-approval.mjs preview <plan.json> | apply <plan.json> <reviewed-plan-sha256>");
  }
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 512 * 1024) throw new Error("INVALID_PLAN_FILE");
  const bytes = await readFile(file);
  if (bytes.length > 512 * 1024) throw new Error("INVALID_PLAN_FILE");
  const plan = JSON.parse(bytes.toString("utf8"));
  const result = command === "preview" ? await batch.preview(plan) : await batch.apply(plan, approvedPlanSha256);
  console.log(JSON.stringify(result));
} catch (error) {
  // Operator console only; do not expose issuance/reconciliation details
  // via MCP. Do not automatically retry an ambiguous publication.
  console.error(JSON.stringify({ code: error.code ?? "OPERATOR_BATCH_FAILED",
    message: error.message, ...(error.unrevoked_grant_ids ? {
      unrevoked_grant_ids: error.unrevoked_grant_ids, new_grant_count: error.new_grant_count,
      reconciliation_required: true,
    } : {}) }));
  process.exitCode = 1;
}
