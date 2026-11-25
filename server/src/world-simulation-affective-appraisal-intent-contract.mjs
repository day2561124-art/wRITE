// Lightweight bounded subjective appraisal DTO, shared by the native
// action-aware appraisal writer and the parent continuation. Context refs
// originate in Phase86D, never in caller-authored World state.
export const affectiveAppraisalMaxConcerns = 8;
export const affectiveAppraisalDimensions = Object.freeze({
  goal_congruence: Object.freeze(["helps", "hinders", "mixed", "unrelated", "uncertain"]),
  expectedness: Object.freeze(["expected", "unexpected", "uncertain"]),
  coping_potential: Object.freeze(["possible", "limited", "uncertain"]),
});
const ref = { type: "string", maxLength: 128 };
const fields = {
  context_ref: ref, concern_ref: ref, reappraises_ref: ref,
  ...Object.fromEntries(Object.entries(affectiveAppraisalDimensions).map(([key, values]) => [key, { type: "string", enum: values }])),
  interpretation: { type: "string", minLength: 1, maxLength: 512 },
};
export const formalAppraisalResponseProperties = Object.freeze({
  appraisal_context_ref: ref,
  appraisal_decisions: { type: "array", maxItems: affectiveAppraisalMaxConcerns, items: {
    type: "object", additionalProperties: false,
    properties: fields, required: Object.keys(fields).filter(key => key !== "reappraises_ref"),
  } },
});
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = () => { const error = new Error("Invalid subjective appraisal response."); error.code = "WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID"; throw error; };
export function validateWorldSimulationExplicitAppraisalReply(reply, view) {
  if (!object(reply) || Object.keys(reply).some(key => !Object.hasOwn(formalAppraisalResponseProperties, key))
      || reply.appraisal_context_ref !== view.context_ref || !Array.isArray(reply.appraisal_decisions)
      || reply.appraisal_decisions.length > affectiveAppraisalMaxConcerns) fail();
  const concerns = new Map(view.concerns.map(concern => [concern.concern_ref, concern]));
  const seen = new Set();
  for (const item of reply.appraisal_decisions) {
    if (!object(item) || Object.keys(item).some(key => !Object.hasOwn(fields, key))
        || item.context_ref !== view.context_ref || !concerns.has(item.concern_ref) || seen.has(item.concern_ref)
        || typeof item.interpretation !== "string" || !item.interpretation.trim() || item.interpretation.length > 512
        || Object.entries(affectiveAppraisalDimensions).some(([key, values]) => !values.includes(item[key]))) fail();
    if (Object.hasOwn(item, "reappraises_ref") && !view.prior_appraisals?.some(prior =>
      prior.prior_appraisal_ref === item.reappraises_ref && prior.goal === concerns.get(item.concern_ref).goal)) fail();
    seen.add(item.concern_ref);
  }
  return JSON.parse(JSON.stringify(reply));
}
