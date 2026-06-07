# MCP Tool Contract Tests

Run:

```text
node tests/tools/mcp-contract.test.mjs
```

The entrypoint executes `server/src/mcp-smoke-test.mjs`, which verifies the public tool inventory, schemas, normalization, permission and confirmation guards, audit records, protected-file hashes, transport framing, queue limits, backpressure, EOF handling, and tool-script syntax.
