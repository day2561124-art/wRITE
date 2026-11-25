import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission } from "./world-simulation-autonomous-cognition-scheduler-service.mjs";

const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const array = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));
const sameCharacter = (left, right) => String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
  === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");

function fail(message) {
  const error = new Error(message);
  error.code = "WORLD_SIMULATION_NATIVE_SUBJECTIVE_CLAIM_INTENT_INVALID";
  throw error;
}

// Shared post-encoding intent boundary. Only canonical Phase65 resolver
// evidence and the already frozen turn enter this function. World state is
// used internally for staged conscious admission; it never enters the view.
// No change to original Native token identity or Phase65 writer authority.
export function createWorldSimulationSubjectiveClaimIntentContext({
  prepared, stagedWorldState, resolverView, character,
} = {}) {
  if (!prepared || !Array.isArray(prepared.decision_packets)
      || !prepared.decision_packets.some(packet => packet.character === character)) {
    fail("Subjective interpretation requires a current prepared character.");
  }
  if (!projectWorldSimulationConsciousCognitionAdmission(stagedWorldState, character).admitted) return null;
  const source = resolverView.character_evidence.find(item => sameCharacter(item.character, character));
  const memories = array(source?.memories).slice(0, 16);
  if (!memories.length) return null;
  const contextToken = "claim_context_" + hashAgentRunValue({
    turn_id: prepared.turn_id, character,
    state_revision: prepared.state_revision,
    world_state_hash: prepared.world_state_hash, memories,
  }).slice(0, 32);
  const sourcesByToken = new Map();
  const memorySources = memories.map((memory, index) => {
    const token = "claim_source_" + hashAgentRunValue({
      context_token: contextToken, index, source_memory_ref: memory.source_memory_ref,
    }).slice(0, 32);
    sourcesByToken.set(token, memory.source_memory_ref);
    const { source_memory_ref, ...visible } = memory;
    return {source_token: token, ...clone(visible)};
  });
  const view = {
    version: "native-subjective-claim-decision-view-v1",
    character, context_token: contextToken, memory_sources: memorySources,
    bounded_view_only: true,
    current_turn_new_subjective_memories_only: true,
    world_truth_exposed: false, durable_write_authority: false,
    action_selection_requested: false, source_memory_ids_exposed: false,
  };
  let admitted = false;
  return Object.freeze({
    // Return a copy so a resolver cannot mutate the admitted evidence binding.
    characterView: () => clone(view),
    admit(reply) {
      if (admitted) fail("Duplicate subjective interpretation admission.");
      admitted = true;
      if (reply == null || reply === "reject_all") return [];
      if (!object(reply) || Object.keys(reply).some(key =>
        !["claim_context_token", "claim_intents"].includes(key))
        || !Array.isArray(reply.claim_intents) || reply.claim_intents.length > 8
        || reply.claim_context_token !== contextToken) {
        fail("Native subjective interpretation requires an explicit context-bound claim list.");
      }
      return reply.claim_intents.map((intent, index) => {
        if (!object(intent) || Object.keys(intent).some(key => !["proposition", "evidence"].includes(key))
          || typeof intent.proposition !== "string" || !intent.proposition.trim()
          || intent.proposition.length > 2000
          || !Array.isArray(intent.evidence) || !intent.evidence.length || intent.evidence.length > 12) {
          fail("Invalid Native subjective claim intent.");
        }
        const evidence = intent.evidence.map(item => {
          if (!object(item) || Object.keys(item).some(key => !["source_token", "relation"].includes(key))
            || !sourcesByToken.has(item.source_token)
            || !["supports", "conflicts"].includes(item.relation)) {
            fail("Native subjective claim must cite its own visible evidence token.");
          }
          return {source_memory_ref: sourcesByToken.get(item.source_token), relation: item.relation};
        });
        return {
          proposal_ref: "native_claim_" + hashAgentRunValue({contextToken, index}).slice(0, 24),
          character, proposition: intent.proposition, evidence,
        };
      });
    },
  });
}
