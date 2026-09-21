export const characterCommunicationMandarinRealizationVersion =
  "cc5-mandarin-clause-realization-v1";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value, limit = 240) =>
  typeof value === "string" && value.trim() && [...value.trim()].length <= limit
    ? value.trim()
    : null;

const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function fail(message) {
  const error = new Error(message);
  error.code = "CHARACTER_COMMUNICATION_MANDARIN_REALIZATION_INVALID";
  throw error;
}

function lexicalSegment(value, label, limit = 120) {
  if (value == null) return null;
  const normalized = text(value, limit);
  if (!normalized) fail(`${label} must be a bounded nonblank string.`);
  if (/[，。！？!?]/u.test(normalized))
    fail(`${label} must not contain clause punctuation.`);
  return normalized;
}

function lexicalList(value, label, limit = 8) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > limit)
    fail(`${label} must be a bounded list.`);
  return value.map((item, index) =>
    lexicalSegment(item, `${label}[${index}]`, 80));
}

const NEGATIONS = new Set(["不", "沒", "沒有", "別", "未"]);
const ASPECT_PARTICLES = new Set(["了", "過", "著"]);
const FINAL_PARTICLES = new Set(["嗎", "吧", "呢", "啊", "呀", "喔", "哦", "嘛", "啦", "耶"]);
const PUNCTUATION = new Set(["。", "？", "！"]);

/**
 * CC-5 bounded Mandarin clause realizer.
 *
 * This consumes only speaker-authored clause slots that were already present in
 * the same character's communication goal. It linearizes them into an
 * observable utterance string. It does not choose new propositions, infer
 * lexical semantics, choose classifiers, automatically drop a subject, infer
 * listener understanding, or assert world truth.
 */
export function realizeCharacterCommunicationMandarin(plan = {}) {
  if (!isRecord(plan)) fail("Communication plan must be structured.");
  if (plan.external_action !== "speech") return null;

  const request = plan.surface_realization_request;
  if (request == null) return null;
  if (!isRecord(request)) fail("surface_realization_request must be structured.");
  if (request.schema_version != null
    && request.schema_version !== "cc5-mandarin-clause-request-v1")
    fail("Unsupported Mandarin surface realization request schema.");

  const message = isRecord(plan.message) ? plan.message : {};
  const semanticContent = text(message.semantic_content, 600);
  const semanticAnchor = text(request.semantic_anchor, 600);
  if (!semanticContent || semanticAnchor !== semanticContent)
    fail("Mandarin realization must bind exactly to the selected semantic content.");

  const clause = request.clause;
  if (!isRecord(clause)) fail("Mandarin realization requires a structured clause.");

  const topic = lexicalSegment(clause.topic, "clause.topic");
  const subject = lexicalSegment(clause.subject, "clause.subject");
  const omitSubject = clause.omit_subject === true;
  if (!subject && !omitSubject)
    fail("Mandarin clause requires an explicit subject or explicit subject omission.");
  if (subject && omitSubject)
    fail("Mandarin clause cannot both supply and omit its subject.");

  const predicate = lexicalSegment(clause.predicate, "clause.predicate");
  if (!predicate) fail("Mandarin clause requires a predicate.");

  const object = lexicalSegment(clause.object, "clause.object", 180);
  const modal = lexicalSegment(clause.modal, "clause.modal", 40);
  const prePredicateModifiers =
    lexicalList(clause.pre_predicate_modifiers, "clause.pre_predicate_modifiers");
  const postPredicateComplements =
    lexicalList(clause.post_predicate_complements, "clause.post_predicate_complements");

  const negation = clause.negation == null ? null : lexicalSegment(clause.negation, "clause.negation", 8);
  if (negation && !NEGATIONS.has(negation))
    fail("Unsupported Mandarin negation marker.");

  const aspectParticle = clause.aspect_particle == null
    ? null : lexicalSegment(clause.aspect_particle, "clause.aspect_particle", 8);
  if (aspectParticle && !ASPECT_PARTICLES.has(aspectParticle))
    fail("Unsupported Mandarin aspect particle.");

  const sentenceFinalParticle = clause.sentence_final_particle == null
    ? null : lexicalSegment(clause.sentence_final_particle, "clause.sentence_final_particle", 8);
  if (sentenceFinalParticle && !FINAL_PARTICLES.has(sentenceFinalParticle))
    fail("Unsupported Mandarin sentence-final particle.");

  const suppliedPunctuation = clause.punctuation == null
    ? null : text(clause.punctuation, 1);
  if (suppliedPunctuation && !PUNCTUATION.has(suppliedPunctuation))
    fail("Unsupported Mandarin clause punctuation.");

  const speechAct = text(message.speech_act, 120);
  const punctuation = suppliedPunctuation
    ?? (sentenceFinalParticle === "嗎"
      || /(?:query|question)/iu.test(speechAct ?? "") ? "？" : "。");

  const parts = [
    ...(topic ? [`${topic}，`] : []),
    ...(subject ? [subject] : []),
    ...prePredicateModifiers,
    ...(modal ? [modal] : []),
    ...(negation ? [negation] : []),
    predicate,
    ...(aspectParticle ? [aspectParticle] : []),
    ...(object ? [object] : []),
    ...postPredicateComplements,
    ...(sentenceFinalParticle ? [sentenceFinalParticle] : []),
  ];
  const surfaceText = `${parts.join("")}${punctuation}`;
  if (!surfaceText.trim() || [...surfaceText].length > 600)
    fail("Realized Mandarin utterance exceeds the bounded surface limit.");

  const withheld = text(plan.withheld_private_content, 600);
  if (withheld && surfaceText.includes(withheld))
    fail("Realized Mandarin utterance contains explicitly withheld private content.");

  return copy({
    schema_version: characterCommunicationMandarinRealizationVersion,
    language: "zh",
    realization_kind: "bounded_clause_linearization",
    semantic_anchor: semanticAnchor,
    surface_text: surfaceText,
    // Only the already-public, normalized clause slots are retained.
    // World can independently re-linearize these rather than trusting
    // arbitrary surface_text / boundary flags inside a selected candidate.
    surface_request: {
      schema_version: "cc5-mandarin-clause-request-v1",
      semantic_anchor: semanticAnchor,
      clause: {
        topic,
        subject,
        omit_subject: omitSubject,
        pre_predicate_modifiers: prePredicateModifiers,
        modal,
        negation,
        predicate,
        aspect_particle: aspectParticle,
        object,
        post_predicate_complements: postPredicateComplements,
        sentence_final_particle: sentenceFinalParticle,
        punctuation: suppliedPunctuation,
      },
    },
    clause_features: {
      topic_present: Boolean(topic),
      subject_omitted_explicitly: omitSubject,
      modal_present: Boolean(modal),
      negation: negation ?? null,
      aspect_particle: aspectParticle ?? null,
      sentence_final_particle: sentenceFinalParticle ?? null,
      punctuation,
    },
    boundaries: {
      speaker_authored_clause_slots_only: true,
      lexical_choice_inferred: false,
      classifier_inferred: false,
      subject_omission_inferred: false,
      semantic_equivalence_verified: false,
      new_proposition_authored: false,
      listener_understanding_inferred: false,
      listener_private_state_inferred: false,
      world_truth_claimed: false,
      model_generation_required: false,
    },
  });
}
