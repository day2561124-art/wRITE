import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const temporary = await mkdtemp(path.join(os.tmpdir(), "write-isolated-data-"));
const root = path.join(temporary, "private-data");
const code = `
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { projectRoot, projectDataRoot, projectPaths, resolveProjectPath } from "./server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "./server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState } from "./server/src/world-simulation-state-service.mjs";
assert.equal(projectDataRoot, path.resolve(process.env.WRITE_DATA_ROOT));
assert.equal(projectPaths.agentRuns, path.join(projectDataRoot, "agent_runs"));
assert.equal(projectPaths.outputLogs, path.join(projectDataRoot, "outputs", "logs"));
assert.throws(()=>resolveProjectPath(path.join(projectDataRoot, "..", "forbidden"), "test"), /must stay inside/);
const run = await beginWorldSimulationSession({
  simulation_label: "generic consumer-storage isolation test",
  initial_world_state: { scenes: {}, characters: {}, memories: {}, event_queue: [], available_actions: {} },
});
const file = path.join(projectPaths.agentRuns, run.world_simulation_session_id, "world_state.json");
const disk = JSON.parse(await readFile(file, "utf8"));
assert.equal(disk.world_simulation_session_id, run.world_simulation_session_id);
const loaded = await getWorldSimulationState(run.world_simulation_session_id);
assert.equal(loaded.revision, 0);
await assert.rejects(access(path.join(projectRoot, "data", "agent_runs", run.world_simulation_session_id)), {code:"ENOENT"});
console.log("EXTERNAL_AGENT_RUN=" + run.world_simulation_session_id);
`;
try {
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: path.resolve("."), encoding: "utf8", timeout: 60000,
    env: {...process.env, WRITE_DATA_ROOT: root},
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const id = run.stdout.match(/EXTERNAL_AGENT_RUN=(agent_run_[\w-]+)/)?.[1];
  assert.ok(id, run.stdout);
  const state = JSON.parse(await readFile(path.join(root, "agent_runs", id, "world_state.json"), "utf8"));
  assert.equal(state.revision, 0);
  const entries = await readdir(path.join(root, "outputs", "logs", "transactions"));
  assert.ok(entries.length > 0, "transaction manifests must stay under consumer root");

  for(const invalid of ["relative/directory", path.parse(root).root, path.resolve(".")]) {
    const failed = spawnSync(process.execPath,
      ["--input-type=module", "-e", 'import "./server/src/project-paths.mjs";'],
      { cwd: path.resolve("."), encoding:"utf8", timeout:30000,
        env:{...process.env, WRITE_DATA_ROOT:invalid}});
    assert.notEqual(failed.status,0,"unsafe WRITE_DATA_ROOT must fail closed");
  }
} finally {
  await rm(temporary,{recursive:true,force:true});
}
