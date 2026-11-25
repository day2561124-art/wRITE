import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission } from "./world-simulation-autonomous-cognition-scheduler-service.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (a, b) => String(a ?? "").trim().toLocaleLowerCase("zh-Hant-TW") === String(b ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
function fail(message) {
  const error = new Error(message);
  error.code = "WORLD_SIMULATION_NATIVE_SUBJECTIVE_CLAIM_RELATION_INTENT_INVALID";
  throw error;
}

// Phase65B remains the authority for claim identity, historical ordering,
// evidence support, and append-only relation writes. This is just an
// observer-scoped decision projection plus exact source-token admission.
export function createWorldSimulationSubjectiveClaimRelationIntentContext({
  prepared, stagedWorldState, resolverView, character,
} = {}) {
  if (!prepared?.decision_packets?.some(packet => packet.character === character)) fail("No prepared character.");
  if (!projectWorldSimulationConsciousCognitionAdmission(stagedWorldState, character).admitted) return null;
  const bucket = resolverView.character_claims.find(entry => same(entry.character, character));
  if (!bucket) return null;
  const current = bucket.current_turn_claims.slice(0, 8);
  const prior = bucket.prior_claims.slice(-16);
  if (!current.length || current.length + prior.length < 2) return null;
  const token = "relation_context_" + hashAgentRunValue({
    turn_id: prepared.turn_id, character, state_revision: prepared.state_revision,
    world_state_hash: prepared.world_state_hash, current, prior,
  }).slice(0, 32);
  const refs = new Map();
  function project(claim, currentTurn) {
    const ref = "relation_claim_" + hashAgentRunValue({
      context_token: token, claim_event_id: claim.claim_event_id, claim_event_hash: claim.claim_event_hash,
    }).slice(0, 32);
    refs.set(ref, { claim, currentTurn });
    return { claim_token: ref, proposition: claim.proposition, status: claim.status,
      evidence_count: claim.evidence_count, current_turn: currentTurn, subjective_not_world_truth: true };
  }
  const view = {
    version: "native-subjective-claim-relation-decision-view-v1",
    character, context_token: token, current_claims: current.map(claim => project(claim, true)),
    prior_claims: prior.map(claim => project(claim, false)),
    supported_relations: ["challenges", "supersedes"],
    bounded_view_only: true, current_turn_claim_must_anchor_relation: true,
    prior_claims_are_subjective_not_retrieval_success: true,
    world_truth_exposed: false, durable_write_authority: false, action_selection_requested: false,
    claim_event_ids_exposed: false, raw_memory_content_exposed: false,
  };
  let admitted = false;
  return Object.freeze({
    characterView: () => clone(view),
    admit(reply) {
      if (admitted) fail("Duplicate claim-relation admission.");
      admitted = true;
      if (reply == null || reply === "reject_all") return [];
      if (!object(reply) || Object.keys(reply).some(key => !["relation_context_token", "relation_intents"].includes(key))
          || reply.relation_context_token !== token || !Array.isArray(reply.relation_intents)
          || reply.relation_intents.length > 8) fail("Expected explicit context-bound relation intents.");
      return reply.relation_intents.map((item, index) => {
        if (!object(item) || Object.keys(item).some(key => !["source_claim_token", "target_claim_token", "relation"].includes(key))
            || !["challenges", "supersedes"].includes(item.relation)) fail("Invalid relation intent.");
        const source = refs.get(item.source_claim_token), target = refs.get(item.target_claim_token);
        if (!source?.currentTurn || !target || source === target
            || (item.relation === "supersedes" && target.currentTurn)) fail("Relation must cite admitted same-character claims in valid order.");
        return {
          proposal_ref: "native_relation_" + hashAgentRunValue({ token, index }).slice(0, 24),
          character, source_claim_event_id: source.claim.claim_event_id,
          target_claim_event_id: target.claim.claim_event_id, relation: item.relation,
        };
      });
    },
  });
}
