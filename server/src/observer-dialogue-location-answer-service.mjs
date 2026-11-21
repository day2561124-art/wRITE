import { singleUncontestedTestimony } from "./observer-dialogue-testimony-revision-service.mjs";
import { observerDialogueLearningVersion } from "./observer-dialogue-learning-service.mjs";

const list = value => Array.isArray(value) ? value : [];

function memoryAdmitted(cognition, retrieval, record) {
  const fragments = list(retrieval?.recovered_fragments);
  const fragment = fragments.length === 1 ? fragments[0] : null;
  const grounding = fragment?.content_grounding;
  const contexts = [cognition?.working_context?.focus, ...list(cognition?.working_context?.active_context)];
  return fragment && record?.memory_id === fragment.source_memory_ref
    && record.content.lesson === fragment.content
    && grounding?.materialized_by_kernel === true
    && grounding.source_memory_ref === record.memory_id
    && grounding.selector?.kind === "json_pointer" && grounding.selector.path === "/lesson"
    && contexts.some(item => item?.context_origin === "recovered_memory" && item.content === fragment.content
      && !item.possibly_incorrect && !item.source_confused);
}

export function planDialogueLocationAnswer({character, target, request, cognition, retrieval, memories}) {
  if (!target || target.observer !== character || target.partner !== request?.speaker
      || request.kind !== "object_location") return null;
  function goal(content, clause, source = null) {
    return {character, purpose: "回答物品地點", addressee: target.partner, mode: "direct",
      communication_opportunity: "respond", public_content: content,
      ...(source ? {claim_kind: "uncertain_hypothesis", claim_source_kind: source} : {}),
      surface_realization: {schema_version: "cc5-mandarin-clause-request-v1",
        semantic_anchor: content, clause}};
  }
  const uncertain = () => goal("我不確定，得再查一下。",
    {topic: "我不確定", omit_subject: true, predicate: "得再查一下"});
  if (request.referent_collision) return uncertain();
  const memory = singleUncontestedTestimony(memories, request.referent, "location");
  if (!memory || memory.internal_provenance?.dialogue_learning_version !== observerDialogueLearningVersion
      || !memoryAdmitted(cognition, retrieval, memory)) return uncertain();
  const name = memory.content.referent_name;
  const lesson = memory.content.lesson?.normalize("NFKC").trim();
  if (typeof name !== "string" || !name || typeof lesson !== "string"
      || !lesson.startsWith(name + "放在")) return uncertain();
  const place = lesson.slice(name.length + "放在".length).replace(/[。！!]$/u, "").trim();
  if (!place || place.length > 48 || /[？?]/u.test(place)) return uncertain();
  const speaker = memory.content.testimony_speaker;
  const revised = Boolean(memory.content.retracts_memory_id)
    || (Array.isArray(memory.content.retracts_memory_ids)
      && memory.content.retracts_memory_ids.length > 0);
  const topic = typeof speaker === "string" && speaker.trim()
    ? speaker + (revised ? "後來說" : "說") : "我記得有人說";
  return goal(lesson, {topic, subject: name, predicate: "放在", object: place, punctuation: "。"},
    "retrieved_memory");
}
