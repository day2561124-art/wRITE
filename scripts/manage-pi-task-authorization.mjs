import { readFile } from "node:fs/promises";
import { createPiTaskAuthorizationStore } from "../server/src/pi-task-authorization.mjs";
import { resolveDevWorkspaceExecutionContext } from "../server/src/mcp-development-workstream-tools.mjs";

const [command, value, ...extra] = process.argv.slice(2);
const store = createPiTaskAuthorizationStore({ root: process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT });

try {
  if (!value || extra.length || !["issue", "revoke"].includes(command)) {
    throw new Error("Usage: node scripts/manage-pi-task-authorization.mjs issue <task.json> | revoke <task-authorization-id>");
  }
  if (command === "revoke") {
    console.log(JSON.stringify(await store.revoke(value)));
  } else {
    const { goal, workspace_id, capabilities, expires_at_ms } = JSON.parse(await readFile(value, "utf8"));
    const context = await resolveDevWorkspaceExecutionContext({ workspace_id }, { mutation: true });
    if (context.workspace_type !== "isolated_worktree" || !context.healthy || !context.mutation_allowed
      || context.lifecycle_state !== "active" || context.workstream_state !== "active") {
      throw new Error("An active, healthy isolated workspace is required.");
    }
    const grant = await store.issue({ goal, workspace_id: context.workspace_id,
      workstream_id: context.workstream_id, capabilities, expires_at_ms });
    console.log(JSON.stringify(grant));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
