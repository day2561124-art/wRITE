import { lstat, readFile } from "node:fs/promises";
import { createPiStandingPolicyPublisher } from "../server/src/pi-standing-authorization.mjs";
import { resolveDevWorkspaceExecutionContext } from "../server/src/mcp-development-workstream-tools.mjs";

const [command, value, digest, ...extra] = process.argv.slice(2);
const publisher = createPiStandingPolicyPublisher({
  root: process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT,
  resolveWorkspace: resolveDevWorkspaceExecutionContext,
});

try {
  if (extra.length || !["preview", "issue", "revoke", "list"].includes(command)
    || (command === "list" ? value !== undefined : !value)
    || (command === "issue" ? !/^[a-f0-9]{64}$/u.test(digest ?? "") : digest !== undefined)) {
    throw new Error("Usage: manage-pi-standing-policy.mjs preview <plan.json> | issue <plan.json> <reviewed-plan-sha256> | revoke <policy-id> | list");
  }
  let result;
  if (command === "list") result = await publisher.list();
  else if (command === "revoke") result = await publisher.revoke(value);
  else {
    const info = await lstat(value);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024) throw new Error("INVALID_POLICY_PLAN_FILE");
    const bytes = await readFile(value);
    if (bytes.length > 64 * 1024) throw new Error("INVALID_POLICY_PLAN_FILE");
    const plan = JSON.parse(bytes.toString("utf8"));
    result = command === "preview" ? await publisher.preview(plan) : await publisher.issue(plan, digest);
  }
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ code: error.code ?? "STANDING_POLICY_OPERATOR_FAILED", message: error.message }));
  process.exitCode = 1;
}
