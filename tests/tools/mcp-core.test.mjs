import { runMcpScriptGroup } from "./mcp-suite-runner.mjs";

try {
  await runMcpScriptGroup("mcp_core");
} catch (error) {
  console.error(`MCP mcp_core test failed: ${error.message}`);
  process.exitCode = 1;
}
