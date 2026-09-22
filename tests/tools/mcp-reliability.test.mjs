import { runMcpScriptGroup } from "./mcp-suite-runner.mjs";

try {
  await runMcpScriptGroup("mcp_reliability");
} catch (error) {
  console.error(`MCP mcp_reliability test failed: ${error.message}`);
  process.exitCode = 1;
}
