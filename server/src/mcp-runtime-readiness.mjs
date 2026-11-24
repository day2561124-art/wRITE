// Each component owns its recovery, retry budget and readiness result.
export function createRuntimeReadiness(steps, onStatusChange, { clock = Date.now, maxAttempts = 3, dependencies = {} } = {}) {
  const components = new Map(steps.map(([name, initialize]) => [name, {
    initialize, state: "idle", pending: null, error: null, attempts: 0, retryAfter: 0,
  }]));
  // Dependencies must point to an earlier declared component. This keeps the
  // graph acyclic while independent recovery components still run concurrently.
  const order = [...components.keys()];
  for (const [name, prerequisites] of Object.entries(dependencies)) {
    if (!components.has(name) || !Array.isArray(prerequisites) || prerequisites.some(dep => !components.has(dep) || order.indexOf(dep) >= order.indexOf(name))) {
      throw new Error("INVALID_RUNTIME_COMPONENT_DEPENDENCY");
    }
  }
  let status;

  function retry(name, wait) {
    setTimeout(() => { void ensure(name).catch(() => {}); }, wait + 5).unref();
  }

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
    component.pending = Promise.resolve().then(async () => {
      for (const dependency of dependencies[name] ?? []) {
        await ensure(dependency);
        if (components.get(dependency).state !== "ready") {
          return { health: "degraded", last_health_error: `Runtime prerequisite ${dependency} is not ready.` };
        }
      }
      return component.initialize();
    }).then(result => {
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
      if (canRetry) retry(name, wait);
      throw error;
    }).finally(() => {
      component.pending = null;
      report();
    });
    report();
    return component.pending;
  }

  const start = () => Promise.allSettled([...components.keys()].map(ensure));
  function invalidate(name, error) {
    const component = components.get(name);
    if (!component || component.state !== "ready") return;
    component.state = "unavailable";
    component.error = error;
    component.result = null;
    component.attempts = 0;
    component.retryAfter = clock() + 250;
    report();
    retry(name, 250);
  }
  report();
  return Object.freeze({ ensure, start, invalidate, getStatus: () => structuredClone(status) });
}
