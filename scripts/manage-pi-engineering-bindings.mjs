import { lstat, readFile } from "node:fs/promises";
import { createPiEngineeringBindingPublisher } from "../server/src/pi-engineering-binding-publisher.mjs";
import { createPiTaskAuthorizationStore } from "../server/src/pi-task-authorization.mjs";
import { resolveDevWorkspaceExecutionContext } from "../server/src/mcp-development-workstream-tools.mjs";

const [command, file, ...extra] = process.argv.slice(2);
const root = process.env.NEXA_PI_TASK_AUTHORIZATION_ROOT;
const publisher = createPiEngineeringBindingPublisher({
  root, resolveWorkspace: resolveDevWorkspaceExecutionContext,
  authorizeTask: createPiTaskAuthorizationStore({ root }).authorize,
});

try {
  if (extra.length || (command === "inspect" && file !== undefined)
    || (command === "publish" && !file) || !["inspect", "publish"].includes(command)) {
    throw new Error("Usage: node scripts/manage-pi-engineering-bindings.mjs inspect | publish <manifest.json>");
  }
  if (command === "inspect") {
    console.log(JSON.stringify(await publisher.inspect()));
  } else {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512 * 1024) throw new Error("INVALID_MANIFEST_FILE");
    const bytes = await readFile(file);
    if (bytes.length > 512 * 1024) throw new Error("INVALID_MANIFEST_FILE");
    const manifest = JSON.parse(bytes.toString("utf8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
      || Object.keys(manifest).sort().join(",") !== "bindings,expected_current_sha256") throw new Error("INVALID_MANIFEST_FIELDS");
    console.log(JSON.stringify(await publisher.publish(manifest)));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
