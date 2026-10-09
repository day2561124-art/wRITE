import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createDevIntegrationService } from "../server/src/mcp-development-integration-tools.mjs";
import { fingerprintMcpMutationRequest } from "../server/src/mcp-operation-reconciliation-context.mjs";
import { projectRoot } from "../server/src/project-paths.mjs";

// Direct host entry to the existing integration service and test runner. It
// starts no listener, changes no production route, and imposes no RPC deadline.
// Journal admissions and candidate CAS remain the durable execution authority.
const exec = promisify(execFile);
const flags = new Map();
const [command, ...args] = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith("--") || args[i + 1] === undefined || flags.has(args[i])) throw new Error("Invalid arguments.");
  flags.set(args[i], args[i + 1]);
}
const allowed = new Set(["--repository-root", "--candidate", "--revision", "--operation", "--start-hash", "--report"]);
if (!["status", "recover", "preflight", "validate"].includes(command)
  || [...flags.keys()].some(k => !allowed.has(k))) throw new Error("Use status|recover|preflight|validate and explicit candidate/revision fences.");
const root = await realpath(flags.get("--repository-root") ?? projectRoot);
async function commonDir(cwd) {
  const { stdout } = await exec(process.platform === "win32" ? "git.exe" : "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, windowsHide: true });
  return realpath(stdout.trim());
}
if (await commonDir(root) !== await commonDir(projectRoot)) throw new Error("Repository is not this checkout's Git authority.");
const runtime = path.join(root, "data", "outputs", "logs", "development_runtime");
// The owning repository's Journal parser already admits its durable proof
// history. Do not substitute an isolated checkout's older proof vocabulary.
const authority = await import(pathToFileURL(path.join(root, "server", "src", "mcp-development-journal-tools.mjs")));
const journal = authority.createDevOperationJournalService({ storageRoot: path.join(runtime, "operation-journal") });
const authoritySha256 = createHash("sha256").update(await readFile(path.join(root,
  "server", "src", "mcp-development-journal-tools.mjs"))).digest("hex");
const codeCommit = (await exec(process.platform === "win32" ? "git.exe" : "git",
  ["rev-parse", "HEAD"], { cwd: projectRoot, windowsHide: true })).stdout.trim();
const readers = await import(pathToFileURL(path.join(root, "server", "src", "mcp-development-workstream-tools.mjs")));
const service = createDevIntegrationService({
  repositoryRoot: root,
  registryPath: path.join(runtime, "integration_registry.json"),
  registryLockPath: path.join(runtime, "integration_registry.lock"),
  applyLockPath: path.join(runtime, "integration_apply.lock"),
  integrationRootPath: path.join(path.dirname(root), ".writer-workbench-integrations"),
  workstreamReader: readers.dev_workspace_get_workstream,
  workspaceReader: readers.dev_workspace_get_workspace,
  journal, dependencyRoot: root,
});
const id = flags.get("--candidate");
const revision = Number(flags.get("--revision"));
const candidate = await service.getCandidate({ integration_candidate_id: id });
if (command !== "status" && (!Number.isSafeInteger(revision) || candidate.revision !== revision)) throw new Error("INTEGRATION_STALE_REVISION");
let result;
console.error(JSON.stringify({ stage: "started", command, candidate: id, revision: candidate.revision, pid: process.pid, at: new Date().toISOString() }));
if (command === "status") result = { candidate, journal: await journal.status() };
else if (command === "recover") result = await service.recoverInterruptedValidation({
  integration_candidate_id: id, expected_revision: revision,
  operation_id: flags.get("--operation"), expected_start_hash: flags.get("--start-hash"),
});
else {
  let tool, input, run;
  if (command === "preflight") {
    if (candidate.state !== "failed" || candidate.failure_reason?.code !== "INTEGRATION_VALIDATION_INTERRUPTED"
      || candidate.integration_workspace.state !== "removed" || candidate.integration_workspace.cleanup_pending) {
      throw new Error("Interrupted candidate must be recovered and cleaned before successor preflight.");
    }
    const ws = await readers.dev_workspace_get_workstream({ workstream_id: candidate.workstream_id });
    tool = "dev_workspace_integration_preflight";
    input = { workstream_id: ws.workstream_id, expected_workstream_revision: ws.revision };
    run = () => service.preflight(input);
  } else {
    tool = "dev_workspace_validate_integration";
    input = { integration_candidate_id: id, expected_revision: revision };
    run = () => service.validateIntegration(input);
  }
  const receipt = await journal.executeReconciled({
    reconciliation_key: `integration-host:${command}:${id}:${revision}`,
    request_fingerprint_sha256: fingerprintMcpMutationRequest(tool, input), tool_name: tool,
  }, async () => ({ content: [{ type: "text", text: JSON.stringify(await run()) }] }));
  result = receipt.reconciled ? receipt : JSON.parse(receipt.value.content[0].text);
}
const report = { command, executed_code_root: projectRoot, repository_root: root,
  executed_code_commit: codeCommit, owning_journal_source_sha256: authoritySha256,
  completed_at: new Date().toISOString(), result, journal: await journal.status() };
if (flags.has("--report")) await writeFile(path.resolve(flags.get("--report")), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
