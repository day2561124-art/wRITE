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
  const claims = list(memories).filter(record => learned(record)
    && record?.content?.referent_id === referent
    && record?.content?.detail_type === detailType
    && typeof record?.content?.lesson === "string" && record.content.lesson.trim()
    && !record.possibly_incorrect && !record.source_confused);
  const byId = new Map(claims.map(record => [record.memory_id, record]));
  const retracted = new Set();
  for (const record of claims) {
    const original = byId.get(record.content.retracts_memory_id);
    if (original && original !== record
        && record.content.testimony_speaker
        && original.content.testimony_speaker === record.content.testimony_speaker
        && record.internal_provenance?.dialogue_source_channel === "understood_testimony"
        && original.internal_provenance?.dialogue_source_channel === "understood_testimony") {
      retracted.add(original.memory_id);
    }
  }
  return claims.filter(record => !retracted.has(record.memory_id));
}

export function findTestimonyRetraction({source, memories, referent, detail}) {
  if (source?.channel !== "understood_testimony" || !source.speaker || !source.receipt_hash
      || !/^learned_[a-f0-9]{24}$/u.test(referent ?? "")
      || !detail?.lesson || !detail?.detail_type || !revisedTestimonyBody(source.text)) return null;
  const existing = activeTestimonyClaims(memories, referent, detail.detail_type)
    .filter(record => record.content.testimony_speaker === source.speaker
      && record.internal_provenance?.dialogue_source_channel === "understood_testimony");
  if (existing.length !== 1 || existing[0].content.lesson === detail.lesson) return null;
  return existing[0].memory_id;
}

export function singleUncontestedTestimony(memories, referent, detailType) {
  const active = activeTestimonyClaims(memories, referent, detailType);
  if (!active.length) return null;
  const facts = new Set(active.map(record => normalize(record.content.lesson)));
  return facts.size === 1 ? active[0] : null;
}
