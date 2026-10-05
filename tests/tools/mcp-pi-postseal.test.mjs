import {runMcpScriptGroup} from "./mcp-suite-runner.mjs";
try {await runMcpScriptGroup("mcp_pi_postseal");}catch(error){console.error(error.message);process.exitCode=1;}
