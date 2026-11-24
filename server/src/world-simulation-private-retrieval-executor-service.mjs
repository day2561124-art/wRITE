import { checkpointPrivateWorldRetrievalPreparation } from "./world-simulation-private-retrieval-preparation-service.mjs";
import { bindPrivateRetrievalStageResponse } from "./world-simulation-private-retrieval-replay-service.mjs";

const MAX_STAGE_CONTEXTS = 1024;
const executors = new WeakSet();
export const isPrivateWorldRetrievalExecutor = (value) => executors.has(value);
const clone = (value) => JSON.parse(JSON.stringify(value));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

// Engine-private host adapter, never a public MCP option. The host must supply
// a genuinely isolated backend context per stage. Distinct JS wrapper objects
// alone do NOT attest separate model contexts or prove provider privacy.
export function createPrivateWorldRetrievalExecutor({ openStageContext } = {}) {
  if (typeof openStageContext !== "function") {
    fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_PROVIDER_REQUIRED");
  }
  const usedContexts = new WeakSet();
  const executor = Object.freeze({
    async prepare({ scope, event_id, prior_deliberation_submissions = [] } = {}, options = {}) {
      const expected = clone(scope ?? null);
      const transcript = [];
      const deliberation = clone(prior_deliberation_submissions);
      const settings = {
        ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
        ...(options.memoryRetrievalTechnicalStepBudget === undefined ? {} : {
          memoryRetrievalTechnicalStepBudget: options.memoryRetrievalTechnicalStepBudget,
        }),
      };
      for (let count = 0; count <= MAX_STAGE_CONTEXTS; count += 1) {
        const checkpoint = await checkpointPrivateWorldRetrievalPreparation({
          scope: expected, event_id, transcript, prior_deliberation_submissions: deliberation,
        }, settings);
        if (checkpoint.status === "complete") {
          // The result remains engine-private; only the existing Character
          // Brain projection may subsequently cross the public boundary.
          return { prepared: checkpoint.result, stage_count: transcript.length, transcript: clone(transcript) };
        }
        if (checkpoint.status !== "pending" || count === MAX_STAGE_CONTEXTS) {
          fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_EXECUTOR_BUDGET_EXHAUSTED");
        }
        const request = checkpoint.request;
        let context;
        let response;
        let owned = false;
        let failed = false;
        try {
          // No transcript, World object, previous provider messages, public
          // action conversation, or other observer's inputs accompany this call.
          context = await openStageContext(clone(request.identity));
          if (!context || typeof context !== "object"
              || usedContexts.has(context)) {
            fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_CONTEXT_REUSED_OR_INVALID");
          }
          usedContexts.add(context);
          owned = true;
          if (typeof context.resolve !== "function" || typeof context.close !== "function") {
            fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_CONTEXT_REUSED_OR_INVALID");
          }
          response = bindPrivateRetrievalStageResponse(
            request.identity, await context.resolve(clone(request.trusted_stage_input)),
          );
        } catch {
          failed = true;
        } finally {
          if (owned && typeof context.close === "function") {
            try {
              await context.close();
            } catch {
              failed = true;
            }
          }
        }
        // Provider faults are infrastructure failures, not cognitive recall
        // failures. Do not echo provider errors (which may contain candidates).
        if (failed) fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_PROVIDER_FAILED");
        transcript.push(response);
      }
      fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_EXECUTOR_BUDGET_EXHAUSTED");
    },
    async replay({ scope, event_id, transcript, prior_deliberation_submissions = [] } = {}, options = {}) {
      if (!Array.isArray(transcript)) fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_TRANSCRIPT_REQUIRED");
      const checkpoint = await checkpointPrivateWorldRetrievalPreparation({
        scope, event_id, transcript, prior_deliberation_submissions,
      }, options);
      if (checkpoint.status !== "complete") {
        // Deliberation replay may not silently expand or re-decide retrieval.
        fail("WORLD_SIMULATION_PRIVATE_RETRIEVAL_TRANSCRIPT_INCOMPLETE");
      }
      return { prepared: checkpoint.result, stage_count: transcript.length };
    },
  });
  executors.add(executor);
  return executor;
}
