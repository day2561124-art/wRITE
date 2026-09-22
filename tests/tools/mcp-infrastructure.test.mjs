import { runMcpScriptGroup } from "./mcp-suite-runner.mjs";

try {
  await runMcpScriptGroup("mcp_infrastructure");
} catch (error) {
  console.error(`MCP mcp_infrastructure test failed: ${error.message}`);
  process.exitCode = 1;
}
