// Engine-private objective record; this module grants no transition authority.
// Production reads use readCommittedWorldSimulationBodyAuthority and its exact
// committed revision/hash guards. Source validation here is structural; C6-C
// owns adjudication and verification against actual transition/history evidence.
export const worldSimulationSleepArousalRecordVersion = "cb-c6b-sleep-arousal-record-v1";

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function id(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    && value.trim() === value;
}
function time(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function invalid() {
  const error = new Error("C6B_SLEEP_AROUSAL_RECORD_INVALID");
  error.code = "C6B_SLEEP_AROUSAL_RECORD_INVALID";
  throw error;
}

// Undefined means absent legacy evidence, not explicit awake or asleep.
// Never coerce malformed records into an unknown or valid condition.
export function projectWorldSimulationSleepArousalState({ physical_state, character } = {}) {
  if (!id(character) || !object(physical_state)) invalid();
  const record = Object.hasOwn(physical_state, "sleep_arousal")
    ? physical_state.sleep_arousal : undefined;
  if (record === undefined) {
    return {
      version: worldSimulationSleepArousalRecordVersion,
      character,
      condition: "unknown",
      since_time_ms: null,
      source: null,
      last_transition: null,
    };
  }
  if (!object(record)
      || record.version !== worldSimulationSleepArousalRecordVersion
      || record.character !== character
      || !["awake", "asleep"].includes(record.condition)
      || !time(record.since_time_ms)
      || !object(record.source)
      || !id(record.source.source_id)) invalid();
  const source = record.source;
  const transition = record.last_transition;
  if (source.kind === "world_initialization") {
    if (transition !== null) invalid();
  } else if (source.kind === "committed_world_transition") {
    if (!object(transition)
        || !id(transition.transition_id)
        || !id(transition.event_id)
        || transition.event_id !== source.source_id
        || !time(transition.time_ms)
        || transition.time_ms !== record.since_time_ms) invalid();
  } else invalid();
  // Selected fields form a fresh bounded projection. Extra record/source keys,
  // private debug content and references into the input never escape this view.
  return {
    version: worldSimulationSleepArousalRecordVersion,
    character,
    condition: record.condition,
    since_time_ms: record.since_time_ms,
    source: { kind: source.kind, source_id: source.source_id },
    last_transition: transition === null ? null : {
      transition_id: transition.transition_id,
      event_id: transition.event_id,
      time_ms: transition.time_ms,
    },
  };
}
