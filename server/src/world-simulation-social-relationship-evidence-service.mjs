import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationSocialAppraisalExperienceBridgeVersion } from "./world-simulation-social-appraisal-memory-bridge-service.mjs";

export const worldSimulationSocialRelationshipEvidenceVersion =
  "cb-c4-committed-social-relationship-evidence-v1";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const clone = (value) => JSON.parse(JSON.stringify(value));
const validHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function fail(message) {
  const error = new Error(message);
  error.code = "WORLD_SIMULATION_SOCIAL_RELATIONSHIP_EVIDENCE_INVALID";
  throw error;
}
function characterMapValue(map, name) {
  return object(map)[name];
}

/**
 * The only C4 relationship writer. It accepts a social appraisal only after
 * Phase63 has both formed and committed the same observer's memory. Its
 * projection retains contrary evidence and never assigns a trust score.
 */
export function buildWorldSimulationCommittedSocialRelationshipEvidence(input = {}) {
  const state = object(input.world_state);
  const bridge = object(input.social_appraisal_experience_bridge);
  const formation = object(input.subjective_memory_formation).result;
  const turnId = input.turn_id;
  if (typeof turnId !== "string" || !turnId
    || bridge.version !== worldSimulationSocialAppraisalExperienceBridgeVersion
    || bridge.turn_id !== turnId
    || !Array.isArray(bridge.source_entries)
    || !Array.isArray(bridge.experience_packets)
    || !validHash(bridge.bridge_hash)
    || hashAgentRunValue(Object.fromEntries(
      Object.entries(bridge).filter(([key]) => key !== "bridge_hash")
    )) !== bridge.bridge_hash
    || !Array.isArray(object(formation).character_updates)) {
    fail("Committed social relationship evidence requires canonical bridge and Phase63 result.");
  }
  const formed = new Map();
  for (const update of formation.character_updates) {
    const character = update?.character;
    if (typeof character !== "string" || !character || formed.has(character)
      || !Array.isArray(update.memory_records)) fail("Invalid Phase63 character update.");
    formed.set(character, update.memory_records);
  }
  const next = clone(state);
  const affected = new Set();
  const emitted = [];
  const seenAppraisals = new Set();
  for (const source of bridge.source_entries) {
    const character = source?.character;
    const appraisalHash = source?.appraisal_hash;
    if (typeof character !== "string" || !character || !validHash(appraisalHash)
      || !validHash(source?.source_interpretation_hash)
      || seenAppraisals.has(appraisalHash)
      || !Object.hasOwn(object(state.characters), character)
      || !formed.has(character)) fail("Invalid same-character social source.");
    seenAppraisals.add(appraisalHash);
    const matches = formed.get(character).filter((record) =>
      record?.memory_type === "episodic_social_experience"
      && record?.source?.kind === "subjective_social_experience"
      && record?.internal_provenance?.social_appraisal_hash === appraisalHash);
    if (!matches.length) continue; // Character chose not to encode this observation.
    if (matches.length !== 1) fail("Ambiguous social memory lineage.");
    const memory = matches[0];
    const provenance = object(memory.internal_provenance);
    const content = object(memory.content);
    const target = content.perceived_person;
    const persisted = array(characterMapValue(state.memories, character))
      .filter((item) => item?.memory_id === memory.memory_id);
    if (persisted.length !== 1 || hashAgentRunValue(persisted[0]) !== hashAgentRunValue(memory)
      || provenance.turn_id !== turnId
      || provenance.social_interpretation_hash !== source.source_interpretation_hash
      || provenance.social_bridge_version !== worldSimulationSocialAppraisalExperienceBridgeVersion
      || !validHash(provenance.social_appraisal_hash)
      || typeof target !== "string" || !target || target.length > 240
      || !["affiliative", "adverse", "ambivalent", "uncertain"].includes(content.appraisal_kind)
      || typeof content.interpretation !== "string" || !content.interpretation
      || content.attribution_subjective !== true
      || content.target_identity_verified !== false
      || content.world_truth_claimed !== false) {
      fail("Social evidence lacks an exact committed subjective memory.");
    }
    const characters = object(next.characters);
    const owner = object(characters[character]);
    const relationships = object(owner.relationships);
    const prior = relationships[target];
    if (prior !== undefined && prior !== null
      && typeof prior !== "string" && (typeof prior !== "object" || Array.isArray(prior))) {
      fail("Unsupported prior relationship projection.");
    }
    const projection = typeof prior === "string"
      ? { prior_description: prior, social_evidence: [] }
      : prior == null ? { social_evidence: [] } : clone(prior);
    if (!Array.isArray(projection.social_evidence ?? [])) fail("Malformed prior relationship evidence.");
    const evidence = {
      evidence_id: `social_evidence_${hashAgentRunValue({
        version: worldSimulationSocialRelationshipEvidenceVersion,
        character, target, memory_id: memory.memory_id, appraisal_hash: appraisalHash,
      }).slice(0, 24)}`,
      source_memory_id: memory.memory_id,
      social_appraisal_hash: appraisalHash,
      social_interpretation_hash: source.source_interpretation_hash,
      turn_id: turnId,
      appraisal_kind: content.appraisal_kind,
      interpretation: content.interpretation,
      expectedness: content.expectedness,
      significance: content.significance,
      subjective: true,
      target_identity_verified: false,
      world_truth_claimed: false,
    };
    const existing = array(projection.social_evidence)
      .find((item) => item?.evidence_id === evidence.evidence_id);
    if (existing) {
      if (hashAgentRunValue(existing) !== hashAgentRunValue(evidence)) fail("Conflicting relationship evidence replay.");
      continue;
    }
    projection.social_evidence = [...array(projection.social_evidence), evidence];
    relationships[target] = projection;
    owner.relationships = relationships;
    characters[character] = owner;
    next.characters = characters;
    affected.add(character);
    emitted.push({ character, perceived_person: target, evidence_id: evidence.evidence_id,
      source_memory_id: memory.memory_id });
  }
  const transitions = [...affected].map((character) => ({
    entity: character,
    field: "relationships",
    from: clone(object(object(state.characters)[character]).relationships ?? {}),
    to: clone(object(object(next.characters)[character]).relationships),
    cause: "committed same-character subjective social memory evidence",
    time_ms: 0,
    source_layer: "subjective_relationship",
    adjudication: worldSimulationSocialRelationshipEvidenceVersion,
  }));
  return {
    version: worldSimulationSocialRelationshipEvidenceVersion,
    turn_id: turnId,
    evidence_created: emitted,
    state_transitions: transitions,
    preview_world_state: next,
    boundaries: {
      committed_phase63_memory_required: true,
      same_character_only: true,
      source_identity_remains_subjective: true,
      scalar_trust_inference_performed: false,
    },
  };
}
