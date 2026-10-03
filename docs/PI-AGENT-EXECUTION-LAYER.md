# Pi Agent Execution Layer

## Status

PI-1A establishes a bounded, optional Pi 1.0 sidecar for Writer Workbench. It does not replace ChatGPT, the MCP server, workstreams, checkpoints, Git controls, or Writer Workbench permission boundaries.

## Architecture

```text
ChatGPT
  |
Writer Workbench MCP
  |
  +-- existing direct development tools
  |
  +-- Pi Agent Execution Layer
        |
        +-- Node >= 22.19 sidecar
        +-- @earendil-works/pi-coding-agent 1.0.0
        +-- Codemode / Tool Search / MCP extension factories
```

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

`executePiReadOnly({ code }, serverOptions)` runs a direct `CodemodeSandbox` in a short-lived Node >=22.19 child. ChatGPT supplies the code; the bridge creates no agent session, prompt, model client, or model request. The bridge is an internal service and has no registered MCP execution tool yet.

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

## Next phase

Complete formal integration gates for this internal bridge, then separately register a developer-only MCP execution surface with bounded request validation and profile/inventory coverage. Keep mutation, shell execution, Git effects, and high-risk tools outside this read-only bridge.
