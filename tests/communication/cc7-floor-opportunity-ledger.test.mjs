import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectCharacterCommunicationTurnProjection,
} from "../../server/src/character-communication-turn-projection-service.mjs";
import {
  projectCharacterCommunicationTurnParticipationIntent,
} from "../../server/src/character-communication-turn-participation-intent-service.mjs";
import {
  buildWorldSimulationTurnIncrementHandoffContract,
  worldSimulationTurnIncrementHandoffVersion,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import {
  buildWorldSimulationFloorOpportunityLedgerContract,
  buildWorldSimulationFloorOpportunityLedger,
  worldSimulationFloorOpportunityLedgerVersion,
} from "../../server/src/world-simulation-communication-floor-opportunity-ledger-service.mjs";

const versions = buildWorldSimulationFloorOpportunityLedgerContract();
assert.equal(versions.version, worldSimulationFloorOpportunityLedgerVersion);
assert.equal(versions.same_release_time_is_not_floor_tie_breaker, true);
assert.equal(versions.temporal_order_is_evidence_not_priority, true);
assert.equal(versions.backchannel_is_not_floor_request, true);
assert.equal(versions.overlap_is_not_interruption, true);
assert.equal(versions.floor_winner_selected, false);
assert.equal(versions.fixed_gap_threshold_used, false);

function build(observer, sequence, mode, previousProjection = null,
  previousIntention = null, time = sequence * 100,
  signalRef = "heard_signal_1") {
  const perceived = {
    schema_version: "cc7-observer-speech-increment-v1",
    observer, speaker: "anonymous_voice",
    signal_ref: signalRef,
    increment_ref: `fragment_${sequence}_${observer}`,
    heard_surface_fragment: null,
    signal_phase: "ongoing",
    perceived_cue_refs: [`cue_${sequence}_${observer}`],
  };
  const plan = `ready_plan_${observer}`;
  const p = projectCharacterCommunicationTurnProjection({
    observer,
    perceived_speech_increment: perceived,
    listener_decision: {
      turn_end_projection: "possible_completion",
      projection_basis_refs: [perceived.perceived_cue_refs[0]],
      response_preparation: mode === "request_floor" ? "ready" : "none",
      ...(mode === "request_floor" ? { response_plan_ref: plan } : {}),
    },
    response_preparation_context: {
      observer, available_response_plan_refs: [plan],
    },
    prior_state: previousProjection,
  });
  const participation = mode === null ? null :
    projectCharacterCommunicationTurnParticipationIntent({
      observer,
      turn_projection: p,
      participation_decision: {
        mode, basis_refs:
          ["request_floor", "backchannel"].includes(mode)
            ? [perceived.perceived_cue_refs[0]] : [],
        ...(mode === "request_floor" ? { response_plan_ref: plan } : {}),
      },
      prior_state: previousIntention,
    });
  return {
    schema_version: worldSimulationTurnIncrementHandoffVersion,
    observer, release_time_ms: time, projection: p,
    participation_intent: participation,
    source_meaning_interpretation_id: null,
    subjective_only: true, actual_world_action_replanned: false,
  };
}
const b1 = build("B", 1, "request_floor", null, null, 100);
const c1 = build("C", 1, "request_floor", null, null, 100);
const b2 = build("B", 2, "withdraw", b1.projection, b1.participation_intent, 160);
const c2 = build("C", 2, "wait", c1.projection, c1.participation_intent, 160);
const full = (projections, resolver_used = true) => ({
  schema_version: worldSimulationTurnIncrementHandoffVersion,
  resolver_used,
  projected_count: projections.length,
  projections,
  boundaries: buildWorldSimulationTurnIncrementHandoffContract(),
});
const observe = (projections, resolver_used = true) =>
  buildWorldSimulationFloorOpportunityLedger({
    handoff: full(projections, resolver_used),
  });

const conflict = observe([b1, c1]);
assert.deepEqual(conflict, observe([b1, c1]));
assert.equal(conflict.audit.entry_count, 2);
assert.equal(conflict.audit.participation_count, 2);
assert.equal(conflict.audit.active_request_count, 2);
assert.equal(conflict.audit.distinct_active_requesting_observer_count, 2);
assert.equal(conflict.audit.unresolved_competition_observed, true);
assert.equal(conflict.audit.same_release_time_request_groups, 1);
assert.equal(conflict.engine_private_opportunities.floor_winner, null);
assert.equal(conflict.engine_private_opportunities.world_signal_emitted, false);
assert.equal(conflict.audit.boundaries.interruption_judged, false);
assert.equal(conflict.audit.events[0].release_time_ms, 100);
assert.equal(conflict.audit.events[1].release_time_ms, 100);
const serialized = JSON.stringify(conflict.audit);
assert.equal(serialized.includes("heard_signal_1"), false);
assert.equal(serialized.includes("ready_plan_"), false);
assert.equal(serialized.includes("anonymous_voice"), false);
assert.equal(serialized.includes("fragment_1"), false);
assert.equal(serialized.includes("cue_1"), false);
assert.equal(serialized.includes("男孩離開了房子"), false);
assert.equal(conflict.audit.events[0].actual_floor_claimed, false);

const withdrawn = observe([b1, c1, b2, c2]);
assert.equal(withdrawn.audit.active_request_count, 0);
assert.equal(withdrawn.audit.unresolved_competition_observed, false);
assert.equal(withdrawn.audit.withdraw_intent_count, 1);
assert.equal(withdrawn.engine_private_opportunities.latest_observer_signal_entries
  .find((x) => x.observer === "B").mode, "withdraw");
assert.equal(withdrawn.engine_private_opportunities.floor_winner, null);
const bOnly = observe([b1, b2]);
assert.equal(bOnly.audit.active_request_count, 0);
const one = observe([b1]);
assert.equal(one.audit.active_request_count, 1);
assert.equal(one.audit.unresolved_competition_observed, false);
assert.equal(one.engine_private_opportunities.floor_winner, null);
const sameObserverOtherSignal = build("B", 1, "request_floor",
  null, null, 100, "heard_signal_2");
const sameObserverRequests = observe([b1, sameObserverOtherSignal]);
assert.equal(sameObserverRequests.audit.active_request_count, 2);
assert.equal(sameObserverRequests.audit.distinct_active_requesting_observer_count, 1);
assert.equal(sameObserverRequests.audit.unresolved_competition_observed, false);

const bBack = build("B", 1, "backchannel");
const cSilent = build("C", 1, "remain_silent");
const cNone = build("C", 1, null);
const onlyBackchannel = observe([bBack, cSilent]);
assert.equal(onlyBackchannel.audit.active_request_count, 0);
assert.equal(onlyBackchannel.audit.backchannel_intent_count, 1);
assert.equal(onlyBackchannel.audit.unresolved_competition_observed, false);
assert.equal(onlyBackchannel.engine_private_opportunities.floor_winner, null);
assert.equal(observe([cSilent]).audit.active_request_count, 0);
assert.equal(observe([cNone]).audit.participation_count, 0);
assert.equal(observe([cNone]).audit.events[0].mode, "no_intention");
const noResolver = observe([], false);
assert.equal(noResolver.audit.status, "resolver_not_installed");
assert.equal(noResolver.audit.entry_count, 0);
assert.deepEqual(noResolver.engine_private_opportunities.active_requesting_observers, []);

const tamper = (entries, pattern) =>
  assert.throws(() => observe(entries), pattern);
tamper([b1, b1], /Duplicate observer-signal increment/u);
tamper([b1, b2, c1], /chronological observer release order/u);
tamper([b1, { ...b2, release_time_ms: 100 }],
  /strictly in time/u);
tamper([{ ...b1, release_time_ms: -1 }], /untrusted or world-committal/u);
tamper([{ ...b1, actual_world_action_replanned: true }],
  /untrusted or world-committal/u);
tamper([{ ...b1, observer: "C" }], /untrusted or world-committal/u);
tamper([{ ...b1, projection: {
  ...b1.projection, projection_id: "forged",
} }], /projection identity/u);
tamper([{ ...b1, projection: {
  ...b1.projection, response_preparation: {
    ...b1.projection.response_preparation, response_plan_ref: "foreign",
  },
} }], /projection identity/u);
tamper([{ ...b1, projection: {
  ...b1.projection, boundaries: {
    ...b1.projection.boundaries, floor_claimed: true,
  },
} }], /untrusted or world-committal/u);
tamper([{ ...b1, participation_intent: {
  ...b1.participation_intent, intention_id: "forged",
} }], /intention identity/u);
tamper([{ ...b1, participation_intent: {
  ...b1.participation_intent, actual_floor_claimed: true,
} }], /exceeds its authority/u);
tamper([{ ...b1, participation_intent: {
  ...b1.participation_intent, source_projection_id: "other",
} }], /foreign, unverified/u);
tamper([{ ...b1, participation_intent: {
  ...b1.participation_intent, basis_refs: ["future"],
} }], /foreign, unverified/u);
tamper([b1, { ...b2, participation_intent: {
  ...b2.participation_intent, prior_intention_id: "foreign",
} }], /foreign, unverified/u);
tamper([b1, { ...b2, projection: {
  ...b2.projection, lineage: {
    ...b2.projection.lineage, prior_projection_id: "foreign",
  },
} }], /same observer-signal lineage/u);
assert.throws(() => observe([b1], false), /Uninstalled resolver/u);
assert.throws(() => buildWorldSimulationFloorOpportunityLedger({
  handoff: { ...full([b1]), projected_count: 0 },
}), /canonical CC-7D bounded handoff/u);
assert.throws(() => buildWorldSimulationFloorOpportunityLedger({
  handoff: { ...full([b1]), hidden_intent: "secret" },
}), /non-contract fields/u);

console.log("CC-7M floor opportunity ledger tests passed.");
