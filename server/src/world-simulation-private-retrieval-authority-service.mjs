// Lightweight process-local host registration; no cognition graph import.
const executors = new WeakSet();
export function registerPrivateWorldRetrievalExecutor(executor) {
  executors.add(executor);
  return executor;
}
export function isPrivateWorldRetrievalExecutor(executor) {
  return executors.has(executor);
}
