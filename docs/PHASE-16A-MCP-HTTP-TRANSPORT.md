Phase 16A — MCP Streamable HTTP Transport (MVP)

Overview
- Expose existing stdio-based MCP server as a formal MCP Streamable HTTP endpoint at `/mcp`.
- Use `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` to ensure protocol compatibility.
- Minimal feature set: `initialize`, `tools/list`, and a read-only `tools/call` test.

Files added
- `server/src/mcp-http-server.mjs` — HTTP server using SDK transport; proxies requests to existing `server/src/mcp-server.mjs` via per-request child process.
- `server/src/mcp-http-stdio-adapter.mjs` — minimal stdio proxy helper.
- `config/mcp-http.example.json` — example config.
- `tests/mcp/mcp-http-transport.test.mjs` — simple integration test (assumes server running).

Security & constraints
- Server binds to `127.0.0.1:8787` by default.
- No OpenAI or external LLM packages or APIs added.
- All tool calls in tests are read-only; high-risk write tools are not invoked.
