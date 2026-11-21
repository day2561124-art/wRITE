// A correction is a new subjective experience, not an overwrite of an old one.
// Keep the chain local to the observer's own, recognized testimony.
export const testimonyRevisionVersion = "observer-testimony-revision-v1";
const list = value => Array.isArray(value) ? value : [];
const learned = record => record?.internal_provenance?.dialogue_learning_version === "observer-dialogue-learning-v1";
const normalize = value => typeof value === "string" ? value.normalize("NFKC").trim() : "";
const correctionPrefix = /^(?:(?:不對|不是)[，,]\s*)?(?:(?:我(?:剛才|剛剛|之前|先前)(?:說|講|記|看|搞)錯了)|(?:我剛才搞錯了)|(?:更正一下))[，,。\s]*/u;

export function revisedTestimonyBody(text) {
  const value = normalize(text);
  const match = correctionPrefix.exec(value);
  return match && match[0].length > 0 && match[0].length < value.length
    ? value.slice(match[0].length).trim() : null;
}

export function activeTestimonyClaims(memories, referent, detailType) {
  // The link saying a witness withdrew a claim survives even if the
  // observer later becomes uncertain about the correction's precise content
  // or who uttered it. Filtering doubtful memories before following revision
  // links would resurrect the statement that was explicitly withdrawn.
  const claims = list(memories).filter(record => learned(record)
    && record?.content?.referent_id === referent
    && record?.content?.detail_type === detailType
    && typeof record?.content?.lesson === "string" && record.content.lesson.trim());
  const byId = new Map(claims.map(record => [record.memory_id, record]));
  const retracted = new Set();
  for (const record of claims) {
    const targets = Array.isArray(record.content.retracts_memory_ids)
      ? record.content.retracts_memory_ids.slice(0, 16)
      : record.content.retracts_memory_id ? [record.content.retracts_memory_id] : [];
    for (const memoryId of targets) {
      const original = byId.get(memoryId);
      if (original && original !== record
          && record.content.testimony_speaker
          && original.content.testimony_speaker === record.content.testimony_speaker
          && record.internal_provenance?.dialogue_source_channel === "understood_testimony"
          && original.internal_provenance?.dialogue_source_channel === "understood_testimony") {
        retracted.add(original.memory_id);
      }
    }
  }
  // A doubtful leaf in the correction chain is not a settled answer.
  // Retraction history is preserved, while only credible, unretracted
  // testimony can be recalled as an answer.
  return claims.filter(record => !retracted.has(record.memory_id)
    && !record.possibly_incorrect && !record.source_confused);
}

// A witness can repeat one location without creating a second competing
// position. The next explicit correction retracts *all* repeated copies;
// different locations, witnesses or types are never collapsed.
export function findTestimonyRetractions({source, memories, referent, detail}) {
  if (source?.channel !== "understood_testimony" || !source.speaker || !source.receipt_hash
      || !/^learned_[a-f0-9]{24}$/u.test(referent ?? "")
      || !detail?.lesson || !detail?.detail_type || !revisedTestimonyBody(source.text)) return [];
  const existing = activeTestimonyClaims(memories, referent, detail.detail_type)
    .filter(record => record.content.testimony_speaker === source.speaker
      && record.internal_provenance?.dialogue_source_channel === "understood_testimony");
  const distinct = new Set(existing.map(record => normalize(record.content.lesson)));
  if (!existing.length || existing.length > 16 || distinct.size !== 1
      || distinct.has(normalize(detail.lesson))
      || existing.some(record => typeof record.memory_id !== "string" || !record.memory_id)) return [];
  return existing.map(record => record.memory_id);
}

// Preserve the one-to-one API for legacy callers.
export function findTestimonyRetraction(input) {
  const targets = findTestimonyRetractions(input);
  return targets.length === 1 ? targets[0] : null;
}

// An omitted subject can be recovered only from one recent, recognized
// statement by this same witness. Never borrow another person's correction.
export function findEllipticalLocationCorrection({source, memories, observedAt}) {
  if (source?.channel !== "understood_testimony" || !source.speaker || !source.receipt_hash) return null;
  const body = revisedTestimonyBody(source.text);
  const matched = /^(?:是|在|放在)([^，,。！？!?]{2,48})[。！!]?$/.exec(body ?? "");
  const place = matched?.[1]?.trim();
  const currentTime = Date.parse(observedAt ?? "");
  if (!place || !Number.isFinite(currentTime) || /(?:可能|大概|應該|也許)/u.test(place)) return null;
  const candidates = list(memories).filter(record => learned(record)
    && record?.content?.detail_type === "location" && record.content.testimony_speaker === source.speaker
    && record.internal_provenance?.dialogue_source_channel === "understood_testimony"
    && typeof record.content.referent_name === "string" && /^learned_[a-f0-9]{24}$/u.test(record.content.referent_id));
  const referents = [...new Set(candidates.map(record => record.content.referent_id))];
  const active = referents.flatMap(referent => activeTestimonyClaims(memories, referent, "location"))
    .filter(record => record.content.testimony_speaker === source.speaker
      && record.internal_provenance?.dialogue_source_channel === "understood_testimony"
      && typeof record.content.referent_name === "string");
  const recent = active.filter(record => {
    const when = Date.parse(record.encoded_at ?? "");
    return Number.isFinite(when) && currentTime >= when && currentTime - when <= 10 * 60 * 1000;
  });
  const samePlace = new Set(recent.map(record =>
    record.content.referent_id + ":" + normalize(record.content.lesson)));
  if (!recent.length || recent.length > 16 || samePlace.size !== 1) return null;
  const [prior] = recent;
  return {
    referent_id: prior.content.referent_id,
    referent_name: prior.content.referent_name,
    referent_aliases: list(prior.content.referent_aliases),
    detail: {detail_type: "location", lesson: prior.content.referent_name + "放在" + place + "。"},
    ...(recent.length === 1 ? {retracts_memory_id: prior.memory_id}
      : {retracts_memory_ids: recent.map(record => record.memory_id)}),
  };
}

// Agreement allows any legitimately recovered supporting episode to be
// used. Do not privilege the first witness when that episode has faded.
export function uncontestedTestimonyClaims(memories, referent, detailType) {
  const active = activeTestimonyClaims(memories, referent, detailType);
  if (!active.length) return [];
  const facts = new Set(active.map(record => normalize(record.content.lesson)));
  return facts.size === 1 ? active : [];
}

export function singleUncontestedTestimony(memories, referent, detailType) {
  return uncontestedTestimonyClaims(memories, referent, detailType)[0] ?? null;
}
