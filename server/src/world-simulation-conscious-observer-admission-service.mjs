import { assertWorldSimulationSleepArousalCommitAuthority } from "./world-simulation-body-sleep-arousal-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission } from "./world-simulation-autonomous-cognition-scheduler-service.mjs";

const copy = (value) => JSON.parse(JSON.stringify(value));
function reject(message) {
  const error = new Error(message);
  error.code = "C6D_CONSCIOUS_OBSERVER_ADMISSION_INVALID";
  throw error;
}

/**
 * Private post-causal Body evidence, speculative until the atomic World commit.
 * This verifies only sleep/arousal timing; it does not certify geometry, acoustic
 * lineage or a complete World prefix, and never manufactures a waking stimulus.
 */
export function buildWorldSimulationConsciousObserverAdmission(input) {
  const evidence = copy(input);
  assertWorldSimulationSleepArousalCommitAuthority(evidence);
  const elapsed = Date.parse(evidence.next_world_state.simulation_time)
    - Date.parse(evidence.world_state.simulation_time);
  if (!Number.isFinite(elapsed) || elapsed < 0)
    reject("Observer admission requires the actual causal World horizon.");
  const transition = (evidence.state_transitions ?? [])
    .find((item) => item.field === "physical_state.sleep_arousal");
  const key = (name) => String(name ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  function at(observer, releaseTimeMs) {
    // World Date clocks truncate fractional milliseconds. Acoustic lineage is
    // verified separately; compare the same clock bucket without rounding the
    // release used below for the exact Body transition boundary.
    if (!Number.isFinite(releaseTimeMs) || releaseTimeMs < 0 || Math.floor(releaseTimeMs) > elapsed)
      reject("Conscious observer release must be within the actual World horizon.");
    const prior = projectWorldSimulationConsciousCognitionAdmission(evidence.world_state, observer);
    if (!transition || key(transition.entity) !== key(observer) || transition.time_ms > releaseTimeMs)
      return prior;
    // Complete same-time Body batches precede the matching release, as in CC-7G.
    return projectWorldSimulationConsciousCognitionAdmission({
      characters: { [transition.entity]: { physical_state: { sleep_arousal: transition.to } } },
    }, observer);
  }
  function filterAdmissions(admissions) {
    if (!Array.isArray(admissions) || admissions.length > 4096)
      reject("Conscious observer admissions must be a bounded physical receipt list.");
    return admissions.filter((item) => at(item.observer, item.release_time_ms).admitted);
  }
  function filterPerception(perception) {
    const views = perception?.engine_private_character_views;
    if (!Array.isArray(views) || views.length !== perception.audit?.character_view_count || views.length > 128)
      reject("Conscious perception requires the complete verified source view count.");
    const admitted = views.filter((item) => at(item.observer, item.release_time_ms).admitted);
    return {
      ...perception,
      engine_private_character_views: admitted,
      audit: {
        ...perception.audit,
        character_view_count: admitted.length,
        ticks: (perception.audit.ticks ?? []).map((tick) => ({
          ...tick,
          observer_view_count: admitted.filter((view) => view.release_time_ms === tick.release_time_ms).length,
        })),
      },
    };
  }
  return { at, filterAdmissions, filterPerception };
}
