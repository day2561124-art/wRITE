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

## Next phase

PI-1B may add a bounded execution request that creates a Pi session with explicit `createCodemodeExtension()`, `createToolSearchExtension()`, and `createMcpExtension()` factories. The tool set exposed to Pi must be an allowlisted Writer Workbench surface, with high-risk effects kept outside autonomous Codemode execution.
