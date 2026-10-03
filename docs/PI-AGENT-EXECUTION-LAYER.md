# Pi Agent Execution Layer

## Status

PI-1A establishes a bounded, optional Pi 1.0 sidecar for Writer Workbench. It does not replace ChatGPT, the MCP server, workstreams, checkpoints, Git controls, or Writer Workbench permission boundaries.

## Architecture

ChatGPT supplies bounded JavaScript through Writer Workbench MCP. The developer entry binds a registered workspace, then dispatches an isolated Node >=22.19 child running the Pi Codemode sandbox. Existing direct Workbench tools remain available.

The root project remains compatible with Node 18. Pi is installed in the isolated `scripts/pi-runtime` package so its Node >=22.19 requirement does not become a root package engine requirement.

## PI-1A surface

`dev_pi_runtime_status` is a developer-only, read-only MCP tool. It reports:

- whether the Pi sidecar is ready;
- the installed Pi package version;
- the Node runtime compatibility state;
- whether the required Pi SDK factories are present.

The tool accepts no caller-controlled executable, path, shell command, environment, MCP endpoint, or model configuration.

## Safety boundary

Writer Workbench remains the authority for filesystem scope, workstream identity, checkpointing, testing, Git mutation, integration, and other protected effects. PI-1A does not let Pi execute arbitrary tools or mutate repository state.

A separate Node executable may later be selected by the server-owned `WRITER_WORKBENCH_PI_NODE_EXECUTABLE` environment variable. MCP callers cannot set or read the executable path.

## PI-1B internal read-only bridge

`executePiReadOnly({ code }, serverOptions)` runs a direct `CodemodeSandbox` in a short-lived Node >=22.19 child. ChatGPT supplies the code; the bridge creates no agent session, prompt, model client, or model request. The bridge remains the internal execution service behind the developer-only MCP entry.

The server binds one workspace before execution. Only `tools.dev_read_file` and `tools.dev_list_directory` exist in the sandbox. Host-side validation rejects extra fields, including `workspace_id`, executable, environment, and command fields. Existing Workbench file policies enforce relative paths, secret-file blocking, and symbolic-link restrictions.

| Resource | Limit |
| --- | --- |
| Code | 16 KiB |
| Arguments per call | 4 KiB |
| Calls per execution | 8 attempts |
| Concurrent reads | 2 across bridge executions |
| File read / directory entries | 8 KiB / 50 |
| Host result per call / cumulative | 16 KiB / 64 KiB |
| Final sandbox result | 32 KiB |
| Deadline, including startup | 5 seconds |
| QuickJS memory / child V8 heap | 32 MiB / 64 MiB |

One child execution is admitted at a time. Result, failure, and timeout terminate the child process tree. Late read completions are discarded; filesystem reads already admitted can finish in the host, so their capacity remains reserved until completion. A stalled teardown retains its child admission slot until actual process close. Host errors cross IPC only as fixed reasons, without protected paths or file contents.

`tests/mcp/mcp-pi-codemode-bridge.test.mjs` exercises the installed Pi runtime, Workbench reads and file policy, unknown tools, workspace switching, ambient globals, call/output budgets, deadline, and recovery. Optional runtime cases explicitly skip when Pi or compatible Node is absent; a skipped test is not runtime verification. Run with:

```powershell
npm.cmd ci --prefix scripts/pi-runtime --ignore-scripts --no-audit --no-fund
node --test tests/mcp/mcp-pi-codemode-bridge.test.mjs
```

## PI-1C developer MCP entry

`dev_pi_execute_readonly` accepts exactly `code` and `workspace_id`. Both are required. The workspace must be registered; the server resolves it read-only before launch and binds its returned identity. Code is limited to 16 KiB of UTF-8 even when its character count is smaller. Caller-selected executables, options, deadlines, environments, models, and endpoints are rejected.

The tool is exposed in `chatgpt_developer` and the local `full` profile. `chatgpt_public` cannot list or call it. The developer stdio profile has 102 tools; launcher HTTP adds the parent-owned reload tool for 103. Public remains 40.

Example MCP arguments:

```json
{
  "code": "const r = await Promise.all([tools.dev_read_file({path:'package.json'}), tools.dev_list_directory({path:'docs',maxEntries:5})]); return {package:JSON.parse(r[0].content).name,documents:r[1].entries.map(x=>x.name)};",
  "workspace_id": "dev_workspace_shared_repository_v1"
}
```

Use the opaque workspace ID returned by Workbench for isolated work. Successful results include `value`, bounded call/output evidence, `model_requests: 0`, and workspace provenance. No model API key is required for this direct sandbox execution. Check `dev_pi_runtime_status` before use; absent packages or incompatible Node fail closed.

The root remains Node 18 compatible. Install the optional pinned sidecar with `npm.cmd ci --prefix scripts/pi-runtime --ignore-scripts --no-audit --no-fund`; use Node >=22.19 for actual sandbox execution. Server-owned `WRITER_WORKBENCH_PI_NODE_EXECUTABLE` can select the compatible runtime.

Formal MCP tests retain the original 24-script baseline and add the Pi runtime, bridge, and entry tests. Profile tests cover real stdio batch reads, required fields, extra-field rejection, unknown workspace, permission metadata, and crafted public calls. Tunnel tests cover the corresponding HTTP entry and public rejection.

Mutation, shell execution, Git effects, and high-risk tools remain outside this read-only entry.
