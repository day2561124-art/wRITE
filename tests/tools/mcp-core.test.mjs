import {execFileSync} from 'node:child_process';
import { runMcpScriptGroup } from "./mcp-suite-runner.mjs";

try {
  await runMcpScriptGroup("mcp_core");
  // Additive security checks preserve the reviewed legacy 24-script inventory.
  for(const script of ['tests/mcp/trpg-gm-bridge.test.mjs','tests/mcp/trpg-gm-http-auth.test.mjs'])execFileSync(process.execPath,[script],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,timeout:30000});
} catch (error) {
  console.error(`MCP mcp_core test failed: ${error.message}`);
  process.exitCode = 1;
}
