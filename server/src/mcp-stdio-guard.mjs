// mcp-stdio-guard.mjs
// Ensure console.log/info don't write to stdout when stdout is a pipe.
// This module is imported as the very first dependency by mcp-server.mjs
// so it can prevent import-time stdout pollution when spawned by tests.

if (!process.stdout.isTTY) {
  const _origLog = console.log;
  const _origInfo = console.info;
  console.log = (...args) => {
    try { console.error(...args); } catch (e) { _origLog('[mcp-stdio-guard] console.error failed', e); }
  };
  console.info = (...args) => {
    try { console.error(...args); } catch (e) { _origInfo('[mcp-stdio-guard] console.error failed', e); }
  };
}

export default true;
