import { getWorldSimulationState } from "./world-simulation-state-service.mjs";
import { prepareWorldSimulationTurn } from "./world-simulation-loop-service.mjs";
import { buildWorldSimulationFormalImpasseResolverReplay } from "./world-simulation-formal-experiential-deliberation-service.mjs";
import { replayPrivateWorldPreparationStages } from "./world-simulation-private-retrieval-replay-service.mjs";

// Internal preparation only. Neither the pending trusted request nor the
// completed prepared World object is a public decision packet.
export async function checkpointPrivateWorldRetrievalPreparation({
  scope, event_id, transcript = [], prior_deliberation_submissions = [],
} = {}, options = {}) {
  const fail = () => {
    const error = new Error("Private retrieval preparation does not match committed World frontier.");
    error.code = "WORLD_SIMULATION_PRIVATE_RETRIEVAL_REPLAY_MISMATCH";
    throw error;
  };
  if (!scope || typeof scope.session_id !== "string" || !scope.session_id
      || !Number.isSafeInteger(scope.committed_revision) || scope.committed_revision < 0
      || typeof scope.committed_hash !== "string" || !scope.committed_hash
      || (event_id !== undefined && (typeof event_id !== "string" || !event_id))
      || !Array.isArray(prior_deliberation_submissions)) fail();
  // Copy caller-independent engine settings before any async suspension.
  const expected = { session_id: scope.session_id, committed_revision: scope.committed_revision,
    committed_hash: scope.committed_hash };
  const loopOptions = options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {};
  const budget = options.memoryRetrievalTechnicalStepBudget;
  const storedDeliberation = JSON.parse(JSON.stringify(prior_deliberation_submissions));
  const storedTranscript = JSON.parse(JSON.stringify(transcript));
  const deliberationReplay = storedDeliberation.length
    ? buildWorldSimulationFormalImpasseResolverReplay(storedDeliberation) : {};
  async function assertFrontier() {
    const snapshot = await getWorldSimulationState(expected.session_id, loopOptions);
    if (snapshot.revision !== expected.committed_revision || snapshot.state_hash !== expected.committed_hash) fail();
  }
  await assertFrontier();
  const checkpoint = await replayPrivateWorldPreparationStages({
    scope: expected,
    transcript: storedTranscript,
    prepare: (resolver) => prepareWorldSimulationTurn({
      world_simulation_session_id: expected.session_id,
      ...(event_id === undefined ? {} : { event_id }),
    }, {
      ...loopOptions,
      ...deliberationReplay,
      ...(budget === undefined ? {} : { memoryRetrievalTechnicalStepBudget: budget }),
      memoryRetrievalStageResolver: resolver,
    }),
  });
  await assertFrontier();
  return checkpoint;
}
