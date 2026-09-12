// One ordered recovery per stdio process. A failure stays failed; no operation
// can bypass a rejected recovery by racing or retrying the first tool call.
// The stdio transport must stay silent by default; callers may inject diagnostics explicitly.
export function createRuntimeReadiness(steps, log = () => {}) {
  let readiness;
  return () => readiness ??= (async () => {
    for (const [name, initialize] of steps) {
      const started = performance.now();
      await initialize();
      log(`[mcp-server] runtime recovery ${name} ready in ${Math.round(performance.now() - started)}ms`);
    }
  })();
}
