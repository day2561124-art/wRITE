// Each component owns its recovery, retry budget and readiness result.
export function createRuntimeReadiness(steps, onStatusChange, { clock = Date.now, maxAttempts = 3 } = {}) {
  const components = new Map(steps.map(([name, initialize]) => [name, {
    initialize, state: "idle", pending: null, error: null, attempts: 0, retryAfter: 0,
  }]));
  let status;

  function report() {
    const checks = Object.fromEntries([...components].map(([name, component]) => [name, {
      state: component.state, attempts: component.attempts,
      last_error: component.error ? String(component.error.message ?? component.error).slice(0, 512) : null,
      retry_after: component.retryAfter || null,
    }]));
    const states = Object.values(checks).map(check => check.state);
    const state = states.some(value => ["degraded", "unavailable"].includes(value)) ? "degraded"
      : states.some(value => value === "recovering") ? "running" : states.every(value => value === "ready") ? "ready" : "idle";
    const currentStep = Object.keys(checks).find(name => checks[name].state === "recovering") ?? null;
    status = { state, current_step: currentStep, components: checks };
    try { onStatusChange?.(status); } catch { /* Observer owns its errors. */ }
  }

  function ensure(name) {
    const component = components.get(name);
    if (!component) return Promise.reject(new Error("UNKNOWN_RUNTIME_COMPONENT"));
    if (component.state === "ready") return Promise.resolve(component.result);
    if (component.pending) return component.pending;
    if (clock() < component.retryAfter) return component.error
      ? Promise.reject(component.error) : Promise.resolve(component.result);
    if (component.attempts >= maxAttempts) component.attempts = 0;
    component.state = "recovering";
    component.attempts += 1;
    component.pending = Promise.resolve().then(component.initialize).then(result => {
      component.result = result;
      const failed = result?.health === "corrupt" || result?.health === "unavailable";
      if (failed) throw new Error(result.last_health_error ?? "RUNTIME_COMPONENT_UNAVAILABLE");
      component.state = result?.health === "degraded" || result?.reconciliation_required ? "degraded" : "ready";
      component.error = null;
      component.retryAfter = component.state === "degraded" ? clock() + 30_000 : 0;
      return result;
    }).catch(error => {
      component.error = error;
      component.state = "unavailable";
      const canRetry = component.attempts < maxAttempts;
      const wait = canRetry ? 250 * 2 ** (component.attempts - 1) : 30_000;
      component.retryAfter = clock() + wait;
      if (canRetry) setTimeout(() => { void ensure(name).catch(() => {}); }, wait + 5).unref();
      throw error;
    }).finally(() => {
      component.pending = null;
      report();
    });
    report();
    return component.pending;
  }

  const start = () => Promise.allSettled([...components.keys()].map(ensure));
  report();
  return Object.freeze({ ensure, start, getStatus: () => structuredClone(status) });
}
