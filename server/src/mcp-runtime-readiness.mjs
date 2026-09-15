// One ordered recovery per stdio process. A failure stays failed; no operation
// can bypass a rejected recovery by racing or retrying the first tool call.
// The stdio transport must stay silent by default; callers may inject diagnostics explicitly.
export function createRuntimeReadiness(
  steps,
  log = () => {},
  onStatusChange = () => {},
) {
  let readiness;
  let status = Object.freeze({
    state: 'idle',
    current_step: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_error: null,
  });

  function publish(patch) {
    status = Object.freeze({ ...status, ...patch });
    try {
      onStatusChange(status);
    } catch (error) {
      log(`[mcp-server] runtime readiness status observer failed: ${error?.message ?? String(error)}`);
    }
  }

  const ensureReady = () => readiness ??= (async () => {
    publish({
      state: 'running',
      current_step: steps[0]?.[0] ?? null,
      started_at: new Date().toISOString(),
      completed_at: null,
      failed_at: null,
      last_error: null,
    });
    try {
      for (const [name, initialize] of steps) {
        publish({ current_step: name });
        const started = performance.now();
        await initialize();
        log(`[mcp-server] runtime recovery ${name} ready in ${Math.round(performance.now() - started)}ms`);
      }
      publish({
        state: 'ready',
        current_step: null,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      publish({
        state: 'failed',
        current_step: status.current_step,
        failed_at: new Date().toISOString(),
        last_error: error?.message ?? String(error),
      });
      throw error;
    }
  })();

  ensureReady.getStatus = () => ({ ...status });
  try {
    onStatusChange(status);
  } catch (error) {
    log(`[mcp-server] runtime readiness status observer failed: ${error?.message ?? String(error)}`);
  }
  return ensureReady;
}
