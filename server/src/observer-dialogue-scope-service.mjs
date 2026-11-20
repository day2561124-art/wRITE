const topicId = /^[a-z][a-z0-9_-]{0,39}$/u;
const modes = new Set(["focus", "shift", "ambiguous", "passive"]);

function label(value) {
  return typeof value === "string" && topicId.test(value) ? value : null;
}

export function observerDialogueLines(perception) {
  return [...(Array.isArray(perception?.observed) ? perception.observed : []),
    ...(Array.isArray(perception?.audible) ? perception.audible : [])]
    .slice(0, 48)
    .filter(value => typeof value === "string" && value.length > 0 && value.length <= 1000);
}

// A resolver may scope attention to one existing observation. It cannot
// invent observed text, write memory, or supply an engine action.
export function dialogueReferentCue(ref) {
  return label(ref) ? "dialogue_ref_" + ref : null;
}

export async function resolveObserverDialogueScope({
  resolve, perception, previousTopic, previousReferent, pausedReferent, groundReferents = false, evidenceLines,
  unresolvedDescription = false,
}) {
  if (typeof resolve !== "function") return null;
  const lines = evidenceLines ?? observerDialogueLines(perception);
  const prior = label(previousTopic);
  const priorRef = label(previousReferent);
  const answer = await resolve({lines: [...lines], previous_topic: prior,
    ...(groundReferents ? {previous_referent: priorRef, paused_referent: label(pausedReferent)} : {}),
  });
  if (!answer || !modes.has(answer.mode)) return null;
  const topic = label(answer.topic);
  const evidence = typeof answer.evidence === "string" && lines.includes(answer.evidence)
    ? answer.evidence : null;
  const blocked = [...new Set((Array.isArray(answer.excluded_topics) ? answer.excluded_topics : [])
    .slice(0, 8).map(label).filter(Boolean))];
  if (answer.mode === "focus" && (!topic || !evidence || blocked.includes(topic))) return null;
  if (answer.mode === "shift" && !evidence) return null;
  const referent = groundReferents && answer.mode === "focus" ? label(answer.referent) : null;
  const excludedRefs = [...new Set((Array.isArray(answer.excluded_referents) ? answer.excluded_referents : [])
    .slice(0, 8).map(label).filter(Boolean))];
  // A topic alone cannot authorize object-specific recall. It can still
  // redirect attention to an ordinary discussion without a resolved object.
  const mode = groundReferents && answer.mode === "focus" && (!referent || excludedRefs.includes(referent))
    ? "shift" : answer.mode;
  const previousPaused = label(pausedReferent);
  const nextPaused = mode === "focus" && previousPaused === referent ? null
    : excludedRefs.length === 1 && excludedRefs[0] === priorRef ? priorRef
      : excludedRefs.length > 1 ? null : previousPaused;
  return {
    mode,
    topic: mode === "focus" ? topic : null,
    previous_topic: prior,
    focus_evidence: mode === "focus" || mode === "shift" ? evidence : null,
    excluded_topics: blocked,
    ...(groundReferents ? {
      ground_referents: true, referent: mode === "focus" ? referent : null,
      previous_referent: priorRef, paused_referent: nextPaused,
      ...(mode === "ambiguous" && unresolvedDescription ? {unresolved_description: true} : {}),
    } : {}),
  };
}

export function scopeConversationMemoryStage(resolver, scope) {
  if (typeof resolver !== "function" || !scope) return resolver;
  return async view => {
    // Ambiguity or a known redirection may not fall back to an old topic.
    if (view.stage === "initiation" && (scope.mode !== "focus" || (scope.ground_referents && !scope.referent))) {
      return {process_occurred: false};
    }
    const scopedView = {...view, conversation_topic: scope.topic,
      ...(scope.ground_referents ? {conversation_referent: scope.referent} : {}),
    };
    if (!scope.ground_referents || view.stage !== "recovery") return resolver(scopedView);
    const denied = {contacted_candidate_refs: [], recovered_selections: []};
    if (!scope.referent) return denied;
    const frontier = view.current_frontier;
    const records = (frontier?.candidate_memory_records ?? [])
      .filter(record => label(record?.content?.referent_id) === scope.referent);
    const known = new Set(records.map(record => record.memory_id));
    if (!records.length) return denied;
    const result = await resolver({
      ...scopedView,
      current_frontier: {
        ...frontier,
        candidate_count: records.length,
        candidate_memory_records: records,
        candidate_refs: (frontier.candidate_refs ?? []).filter(record => known.has(record.memory_id)),
        candidate_evaluations: (frontier.candidate_evaluations ?? []).filter(record => known.has(record.memory_id)),
      },
    });
    return (result?.contacted_candidate_refs ?? []).every(id => known.has(id))
      && (result?.recovered_selections ?? []).every(selection => known.has(selection.source_memory_ref))
      ? result : denied;
  };
}
