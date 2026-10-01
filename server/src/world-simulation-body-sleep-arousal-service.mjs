import { hashAgentRunValue } from "./agent-run-service.mjs";

// Engine-private objective record. C6-B owns bounded read validation; C6-C adds
// a separate authoritative transition gate below. Character-facing projections
// still receive no write authority.
export const worldSimulationSleepArousalRecordVersion = "cb-c6b-sleep-arousal-record-v1";
export const worldSimulationSleepArousalTransitionAuthorityVersion =
  "cb-c6c-sleep-arousal-transition-authority-v1";

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

function authorityInvalid(reason) {
  const error = new Error(`C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID: ${reason}`);
  error.code = "C6C_SLEEP_AROUSAL_MUTATION_AUTHORITY_INVALID";
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(value) {
  return object(value) ? value : {};
}

function sleepRecordFromCharacter(value) {
  return record(record(value).physical_state).sleep_arousal;
}

// Queue timestamps are turn-relative; durable records use absolute World time.
function transitionTime(worldState, offsetMs) {
  // Parse bounded ISO fields explicitly: no host-local timezone and no calendar
  // rollover (for example February 30 or 24:00) becomes transition authority.
  const value = worldState?.simulation_time;
  const parts = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
    : null;
  if (!parts) authorityInvalid("transition requires explicit ISO World time");
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const milliseconds = Number((parts[7] ?? "").padEnd(3, "0"));
  const zoneHour = Number(parts[10] ?? 0);
  const zoneMinute = Number(parts[11] ?? 0);
  if (zoneHour > 23 || zoneMinute > 59) authorityInvalid("World timezone is invalid");
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, milliseconds);
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1
      || wall.getUTCDate() !== day || wall.getUTCHours() !== hour
      || wall.getUTCMinutes() !== minute || wall.getUTCSeconds() !== second) {
    authorityInvalid("World calendar fields are invalid");
  }
  const zoneMs = (zoneHour * 60 + zoneMinute) * 60000
    * (parts[9] === "-" ? -1 : 1);
  const startMs = wall.getTime() - zoneMs;
  const absoluteMs = startMs + offsetMs;
  if (!time(offsetMs) || !time(startMs) || !time(absoluteMs)
      || absoluteMs > Number.MAX_SAFE_INTEGER) {
    authorityInvalid("transition requires valid World simulation time and offset");
  }
  return absoluteMs;
}

function transitionId({ character, event_id, from_condition, condition, time_ms }) {
  return `sleep_arousal_transition_${hashAgentRunValue({
    version: worldSimulationSleepArousalTransitionAuthorityVersion,
    character,
    event_id,
    from_condition,
    condition,
    time_ms,
  }).slice(0, 24)}`;
}

export function buildWorldSimulationSleepArousalTransitionRecord({
  character,
  event_id,
  from_condition = "unknown",
  condition,
  time_ms,
} = {}) {
  if (!id(character) || !id(event_id)
      || !["unknown", "awake", "asleep"].includes(from_condition)
      || !["awake", "asleep"].includes(condition)
      || !time(time_ms)
      || (from_condition !== "unknown" && from_condition === condition)) {
    authorityInvalid("canonical transition inputs are invalid");
  }
  const transition_id = transitionId({
    character, event_id, from_condition, condition, time_ms,
  });
  return {
    version: worldSimulationSleepArousalRecordVersion,
    character,
    condition,
    since_time_ms: time_ms,
    source: {
      kind: "committed_world_transition",
      source_id: event_id,
    },
    last_transition: {
      transition_id,
      event_id,
      time_ms,
    },
  };
}

function sleepChangedByAncestorWrite(worldState, worldPath, mutation) {
  if (worldPath[0] !== "characters") return false;
  const currentCharacters = record(worldState.characters);
  if (worldPath.length === 1) {
    const nextCharacters = record(mutation.to);
    const ids = new Set([
      ...Object.keys(currentCharacters),
      ...Object.keys(nextCharacters),
    ]);
    for (const character of ids) {
      if (!sameValue(
        sleepRecordFromCharacter(currentCharacters[character]),
        sleepRecordFromCharacter(nextCharacters[character]),
      )) return true;
    }
    return false;
  }
  const character = String(worldPath[1] ?? "");
  if (!character) return false;
  if (worldPath.length === 2) {
    return !sameValue(
      sleepRecordFromCharacter(currentCharacters[character]),
      sleepRecordFromCharacter(mutation.to),
    );
  }
  if (worldPath[2] !== "physical_state") return false;
  if (worldPath.length === 3) {
    return !sameValue(
      record(record(currentCharacters[character]).physical_state).sleep_arousal,
      record(mutation.to).sleep_arousal,
    );
  }
  return false;
}

export function assertWorldSimulationSleepArousalMutationAuthority({
  world_state,
  authority_world_state = world_state,
  world_path,
  mutation,
} = {}) {
  const state = record(world_state);
  const path = Array.isArray(world_path) ? world_path : [];
  if (!path.length) return true;

  if (sleepChangedByAncestorWrite(state, path, mutation)) {
    authorityInvalid("sleep/arousal may not be changed through an ancestor path");
  }

  if (path[0] !== "characters"
      || path[2] !== "physical_state"
      || path[3] !== "sleep_arousal") return true;

  if (path.length !== 4) {
    authorityInvalid("nested sleep/arousal mutation is forbidden");
  }

  const character = String(path[1] ?? "");
  if (!id(character)
      || mutation?.entity !== character
      || mutation?.field !== "physical_state.sleep_arousal") {
    authorityInvalid("whole-record mutation identity does not match the character path");
  }

  const authority = record(authority_world_state);
  const queue = Array.isArray(authority.event_queue) ? authority.event_queue : [];
  const event = record(queue[0]);
  const eventId = event.event_id ?? event.id;
  const declaration = record(event.sleep_arousal_transition);
  if (!id(eventId)
      || !Object.hasOwn(record(state.characters), character)
      || !Object.hasOwn(record(authority.characters), character)
      || Object.keys(declaration).sort().join("|") !== "character|condition|time_ms"
      || declaration.character !== character
      || !["awake", "asleep"].includes(declaration.condition)
      || !time(declaration.time_ms)) {
    authorityInvalid("current World queue head does not authorize this sleep/arousal transition");
  }

  const absoluteTimeMs = transitionTime(authority, declaration.time_ms);
  let current;
  let next;
  try {
    current = projectWorldSimulationSleepArousalState({
      physical_state: record(record(state.characters)[character]).physical_state ?? {},
      character,
    });
    next = projectWorldSimulationSleepArousalState({
      physical_state: { sleep_arousal: mutation?.to },
      character,
    });
  } catch {
    authorityInvalid("sleep/arousal record failed bounded record validation");
  }

  if (next.source?.kind !== "committed_world_transition"
      || next.source?.source_id !== eventId
      || next.condition !== declaration.condition
      || next.since_time_ms !== absoluteTimeMs
      || next.last_transition?.event_id !== eventId
      || next.last_transition?.time_ms !== absoluteTimeMs
      || mutation?.time_ms !== declaration.time_ms
      || (current.condition !== "unknown"
        && (current.condition === next.condition
          || next.since_time_ms < current.since_time_ms))
      || current.last_transition?.event_id === eventId) {
    authorityInvalid("transition record does not match current World event authority");
  }

  const expectedId = transitionId({
    character,
    event_id: eventId,
    from_condition: current.condition,
    condition: next.condition,
    time_ms: absoluteTimeMs,
  });
  if (next.last_transition?.transition_id !== expectedId
      || Object.keys(record(mutation?.to)).sort().join("|")
        !== "character|condition|last_transition|since_time_ms|source|version"
      || Object.keys(record(mutation?.to?.source)).sort().join("|") !== "kind|source_id"
      || Object.keys(record(mutation?.to?.last_transition)).sort().join("|")
        !== "event_id|time_ms|transition_id") {
    authorityInvalid("transition lineage is not canonical");
  }
  return true;
}


// Commit boundary: projections and custom adjudicators cannot bypass the queue
// gate by supplying a different next_world_state. History supplies the replay
// identity check; no new sleep truth store is introduced.
export function assertWorldSimulationSleepArousalCommitAuthority({
  world_state, next_world_state, event, state_transitions, committed_history,
} = {}) {
  const before = record(world_state);
  const after = record(next_world_state);
  const characters = new Set([
    ...Object.keys(record(before.characters)), ...Object.keys(record(after.characters)),
  ]);
  const transitions = Array.isArray(state_transitions) ? state_transitions : [];
  const sleepTransitions = transitions.filter((entry) =>
    entry?.field === "physical_state.sleep_arousal");
  const changed = [];
  for (const character of characters) {
    if (!sameValue(sleepRecordFromCharacter(record(before.characters)[character]),
      sleepRecordFromCharacter(record(after.characters)[character]))) changed.push(character);
  }
  if (!changed.length && !sleepTransitions.length) return true;
  if (changed.length !== 1 || sleepTransitions.length !== 1) {
    authorityInvalid("commit requires one exact sleep/arousal transition");
  }
  const character = changed[0];
  const transition = sleepTransitions[0];
  const queued = record(Array.isArray(before.event_queue) ? before.event_queue[0] : null);
  const eventId = queued.event_id ?? queued.id;
  if (!id(eventId) || (event?.event_id ?? event?.id) !== eventId
      || !sameValue(event?.sleep_arousal_transition, queued.sleep_arousal_transition)
      || transition.entity !== character
      || !sameValue(transition.from,
        sleepRecordFromCharacter(record(before.characters)[character]) ?? null)
      || !sameValue(transition.to,
        sleepRecordFromCharacter(record(after.characters)[character]))) {
    authorityInvalid("commit delta does not match original World event and transition");
  }
  assertWorldSimulationSleepArousalMutationAuthority({
    world_state: before, authority_world_state: before,
    world_path: ["characters", character, "physical_state", "sleep_arousal"],
    mutation: transition,
  });
  const horizon = transitionTime(after, 0);
  if (horizon < transitionTime(before, 0) || transition.to.since_time_ms > horizon) {
    authorityInvalid("sleep/arousal effect exceeds the committed World horizon");
  }
  const turns = Array.isArray(committed_history?.turns) ? committed_history.turns : [];
  for (const turn of turns) {
    const prior = Array.isArray(turn.state_transitions) ? turn.state_transitions : [];
    if (prior.some((entry) => entry?.field === "physical_state.sleep_arousal"
        && (entry.to?.last_transition?.event_id === eventId
          || entry.to?.last_transition?.transition_id
            === transition.to.last_transition.transition_id))) {
      authorityInvalid("sleep/arousal transition identity already exists in World history");
    }
  }
  return true;
}

export function projectWorldSimulationSleepArousalTransitionFromEvent({
  world_state,
  event,
} = {}) {
  const state = record(world_state);
  const queued = Array.isArray(state.event_queue) ? record(state.event_queue[0]) : {};
  const eventRecord = record(event);
  const eventId = eventRecord.event_id ?? eventRecord.id;
  const queuedId = queued.event_id ?? queued.id;
  if (!id(eventId) || queuedId !== eventId
      || !sameValue(eventRecord.sleep_arousal_transition, queued.sleep_arousal_transition)) {
    authorityInvalid("transition producer requires the actual current World queue-head event");
  }
  const declaration = record(eventRecord.sleep_arousal_transition);
  if (Object.keys(declaration).sort().join("|") !== "character|condition|time_ms"
      || !id(declaration.character)
      || !["awake", "asleep"].includes(declaration.condition)
      || !time(declaration.time_ms)
      || !Object.hasOwn(record(state.characters), declaration.character)) {
    authorityInvalid("World event sleep/arousal declaration is invalid");
  }
  const current = projectWorldSimulationSleepArousalState({
    physical_state: record(record(state.characters)[declaration.character]).physical_state ?? {},
    character: declaration.character,
  });
  const absoluteTimeMs = transitionTime(state, declaration.time_ms);
  if ((current.condition !== "unknown" && absoluteTimeMs < current.since_time_ms)
      || current.last_transition?.event_id === eventId) {
    authorityInvalid("World event is backward or reuses the last transition identity");
  }
  if (current.condition === declaration.condition) {
    return {
      version: worldSimulationSleepArousalTransitionAuthorityVersion,
      status: "already_in_declared_state",
      state_transition: null,
    };
  }
  const next = buildWorldSimulationSleepArousalTransitionRecord({
    character: declaration.character,
    event_id: eventId,
    from_condition: current.condition,
    condition: declaration.condition,
    time_ms: absoluteTimeMs,
  });
  return {
    version: worldSimulationSleepArousalTransitionAuthorityVersion,
    status: "transition_proposed",
    state_transition: {
      entity: declaration.character,
      field: "physical_state.sleep_arousal",
      from: current.condition === "unknown"
        ? null
        : record(record(state.characters)[declaration.character]).physical_state?.sleep_arousal ?? null,
      to: next,
      cause: `World event ${eventId} changed objective sleep/arousal state`,
      time_ms: declaration.time_ms,
      source_layer: "causal_resolution",
    },
  };
}
