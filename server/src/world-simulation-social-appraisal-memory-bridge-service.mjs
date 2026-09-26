import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationPersonTargetedSocialAppraisalVersion } from "./world-simulation-person-targeted-social-appraisal-service.mjs";

export const worldSimulationSocialAppraisalExperienceBridgeVersion =
  "cb-c4-social-appraisal-experience-bridge-v1";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const array = (value) => Array.isArray(value) ? value : [];
const clone = (value) => JSON.parse(JSON.stringify(value));
function text(value, name, max = 600) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > max) {
    throw new Error(`${name} must be bounded nonempty text.`);
  }
  return value.trim();
}
const appraisalFields = new Set([
  "version", "kind", "observer", "evidence_ref", "perceived_person",
  "source_interpretation_hash", "appraisal_kind", "concern",
  "expectedness", "significance", "interpretation", "attribution_subjective",
  "target_identity_verified", "relationship_updated", "memory_written",
  "world_truth_claimed", "appraisal_hash",
]);
const appraisalKinds = new Set(["affiliative", "adverse", "ambivalent", "uncertain"]);
const expectednessKinds = new Set(["expected", "unexpected", "uncertain"]);
const significanceKinds = new Set(["meaningful", "minor", "uncertain"]);
function verifyAppraisal(value, character) {
  if (!isObject(value)
    || Object.keys(value).some((field) => !appraisalFields.has(field))
    || value.version !== worldSimulationPersonTargetedSocialAppraisalVersion
    || value.kind !== "person_targeted_subjective_social_appraisal"
    || value.observer !== character
    || value.attribution_subjective !== true
    || value.target_identity_verified !== false
    || value.relationship_updated !== false
    || value.memory_written !== false
    || value.world_truth_claimed !== false
    || !appraisalKinds.has(value.appraisal_kind)
    || !expectednessKinds.has(value.expectedness)
    || !significanceKinds.has(value.significance)) {
    throw new Error("Experience bridge requires bounded same-character subjective appraisal.");
  }
  text(value.evidence_ref, "evidence_ref", 120);
  text(value.perceived_person, "perceived_person", 240);
  text(value.source_interpretation_hash, "source_interpretation_hash", 120);
  text(value.concern, "concern", 300);
  text(value.interpretation, "interpretation");
  const body = clone(value);
  delete body.appraisal_hash;
  if (value.appraisal_hash !== hashAgentRunValue(body)) {
    throw new Error("Social appraisal content hash mismatch.");
  }
  return value;
}

/**
 * Read only the exact prepared Native character packet plus its engine-side
 * projection hash. No relationship, belief, memory or World write occurs.
 * The receiving Phase63 admission gate remains a separate implementation.
 */
export function bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(input = {}) {
  const turnId = text(input.turn_id, "turn_id", 240);
  if (!Array.isArray(input.decision_packets)
    || !Array.isArray(input.person_targeted_social_appraisal_projections)) {
    throw new Error("Experience bridge requires canonical prepared packet arrays.");
  }
  const summaries = new Map();
  for (const summary of input.person_targeted_social_appraisal_projections) {
    const character = text(summary?.character, "projection character", 240);
    if (summaries.has(character)
      || summary.version !== worldSimulationPersonTargetedSocialAppraisalVersion
      || !isObject(summary.audit)
      || !Number.isSafeInteger(summary.audit.appraisal_count)
      || summary.audit.appraisal_count < 0 || summary.audit.appraisal_count > 16
      || summary.relationship_write_performed !== false
      || summary.memory_write_performed !== false
      || summary.world_state_mutation_performed !== false) {
      throw new Error("Experience bridge projection summary is invalid.");
    }
    text(summary.character_view_hash, "character_view_hash", 120);
    summaries.set(character, summary);
  }
  const seenCharacters = new Set();
  const seenAppraisals = new Set();
  const entries = [];
  const packets = [];
  for (const packet of input.decision_packets) {
    const character = text(packet?.character, "packet character", 240);
    if (seenCharacters.has(character)) throw new Error("Duplicate character packet.");
    seenCharacters.add(character);
    const summary = summaries.get(character);
    if (!summary) throw new Error("Experience bridge lacks this character's projection summary.");
    if (packet?.perception?.social_appraisals !== undefined
      && !Array.isArray(packet.perception.social_appraisals)) {
      throw new Error("Experience bridge social appraisals must be an array.");
    }
    const appraisals = array(packet?.perception?.social_appraisals);
    if (appraisals.length !== summary.audit.appraisal_count
      || appraisals.length > 16
      || hashAgentRunValue({ observer: character, social_appraisals: appraisals })
        !== summary.character_view_hash) {
      throw new Error("Experience bridge character view differs from prepared projection.");
    }
    const observations = [];
    for (const candidate of appraisals) {
      const appraisal = verifyAppraisal(candidate, character);
      if (seenAppraisals.has(appraisal.appraisal_hash)) {
        throw new Error("Duplicate social appraisal experience.");
      }
      seenAppraisals.add(appraisal.appraisal_hash);
      observations.push({
        kind: "person_targeted_subjective_social_experience",
        perceived_person: appraisal.perceived_person,
        appraisal_kind: appraisal.appraisal_kind,
        concern: appraisal.concern,
        expectedness: appraisal.expectedness,
        significance: appraisal.significance,
        interpretation: appraisal.interpretation,
        attribution_subjective: true,
        target_identity_verified: false,
        world_truth_claimed: false,
        internal_social_appraisal_hash: appraisal.appraisal_hash,
        internal_social_interpretation_hash: appraisal.source_interpretation_hash,
        internal_social_source_turn_id: turnId,
        internal_social_bridge_version: worldSimulationSocialAppraisalExperienceBridgeVersion,
      });
      entries.push({
        character,
        appraisal_hash: appraisal.appraisal_hash,
        source_interpretation_hash: appraisal.source_interpretation_hash,
      });
    }
    if (observations.length) {
      packets.push({
        character,
        perception: {
          observed: [],
          audible: [],
          other_senses: clone(observations),
          information_boundary: {
            source: "cb_c4_subjective_social_appraisal_experience",
            world_truth_authority: false,
            direct_relationship_write: false,
            memory_formation_admission_pending: true,
          },
        },
      });
    }
  }
  if (seenCharacters.size !== summaries.size) {
    throw new Error("Unmatched person-targeted appraisal projection summary.");
  }
  const body = {
    version: worldSimulationSocialAppraisalExperienceBridgeVersion,
    turn_id: turnId,
    source_entries: clone(entries),
    experience_packets: clone(packets),
    boundaries: {
      same_character_prepared_projection_hash_required: true,
      relationship_write_performed: false,
      memory_write_performed: false,
      world_state_mutation_performed: false,
      phase63_social_experience_admission_installed: false,
      same_turn_character_brain_feedback_allowed: false,
    },
  };
  return { ...body, bridge_hash: hashAgentRunValue(body) };
}
