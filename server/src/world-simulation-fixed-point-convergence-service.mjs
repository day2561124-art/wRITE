import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationFixedPointConvergenceVersion = "phase62v-fixed-point-convergence-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function normalizedSeenHashes(value) {
  return [...new Set(array(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean))]
    .sort();
}

function convergenceError(code, message, diagnostics) {
  const error = new Error(message);
  error.code = code;
  error.diagnostics = cloneJson(diagnostics);
  return error;
}

export function buildWorldSimulationFixedPointConvergenceContract() {
  return {
    version: worldSimulationFixedPointConvergenceVersion,
    owner: "programmatic_fixed_point_convergence_guard",
    input_contract: {
      current_and_next_derivation_contexts_are_read_only: true,
      seen_context_hashes_are_canonicalized: true,
      world_state_mutation_allowed: false,
    },
    convergence_contract: {
      convergence_requires_identical_context_hash: true,
      changed_context_requires_another_iteration: true,
      repeated_noncurrent_context_is_oscillation: true,
      oscillation_is_fatal: true,
      iteration_limit_without_convergence_is_fatal: true,
      silent_acceptance_of_last_iteration_forbidden: true,
    },
    replay_contract: {
      deterministic_context_hashing: true,
      deterministic_diagnostics: true,
    },
    character_brain_may_decide_fixed_point_convergence: false,
  };
}

export function evaluateWorldSimulationFixedPointIteration(input = {}) {
  const iteration = positiveInteger(input.iteration, 1);
  const maxIterations = Math.max(iteration, positiveInteger(input.max_iterations, iteration));
  const currentContext = deepFreeze(cloneJson(object(input.current_derivation_context)));
  const nextContext = deepFreeze(cloneJson(object(input.next_derivation_context)));
  const seenContextHashes = deepFreeze(normalizedSeenHashes(input.seen_context_hashes));
  const currentContextHash = hashAgentRunValue(currentContext);
  const nextContextHash = hashAgentRunValue(nextContext);
  const converged = currentContextHash === nextContextHash;
  const oscillationDetected = !converged && seenContextHashes.includes(nextContextHash);
  const limitExhausted = !converged && iteration >= maxIterations;
  const nextSeenContextHashes = normalizedSeenHashes([
    ...seenContextHashes,
    currentContextHash,
  ]);
  const diagnostics = {
    version: worldSimulationFixedPointConvergenceVersion,
    iteration,
    max_iterations: maxIterations,
    current_context_hash: currentContextHash,
    next_context_hash: nextContextHash,
    seen_context_hashes: cloneJson(seenContextHashes),
    next_seen_context_hashes: cloneJson(nextSeenContextHashes),
    converged,
    oscillation_detected: oscillationDetected,
    iteration_limit_exhausted: limitExhausted,
    should_continue: !converged,
  };
  diagnostics.diagnostic_hash = hashAgentRunValue(diagnostics);

  if (oscillationDetected) {
    throw convergenceError(
      "WORLD_SIMULATION_CAUSAL_FIXED_POINT_OSCILLATION",
      "World-simulation causal fixed point revisited a prior derivation context before convergence.",
      diagnostics,
    );
  }
  if (limitExhausted) {
    throw convergenceError(
      "WORLD_SIMULATION_CAUSAL_FIXED_POINT_DID_NOT_CONVERGE",
      "World-simulation causal fixed point reached its iteration limit without convergence.",
      diagnostics,
    );
  }

  return diagnostics;
}
