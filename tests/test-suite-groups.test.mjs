import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cognitionSteps,
  memoryRetrievalSteps,
  phase62CognitionIntegrationSteps,
  phase62WorldSimulationSteps,
  phase63MemorySteps,
  phase64RetrievalCognitionSteps,
  phase65BeliefCognitionSteps,
  phase66BeliefRevisionSteps,
  phase67AutobiographicalMemorySteps,
  phase68SelfInterpretationSteps,
  phase69GoalToPlanSteps,
  phase70GoalLifecycleSteps,
  phase71AdaptiveReplanningSteps,
  phase72MeansFeasibilitySteps,
  phase73VisibleConstraintObservationSteps,
  phase74SubjectiveActionDeliberationSteps,
  phase75ActionCommitmentSteps,
  phase76PostOutcomeSubjectiveExperienceSteps,
  phase77MultiExperienceSchemaInductionSteps,
  phase78ContextualSchemaRefinementSteps,
  phase79ExperientialMethodCompetitionSteps,
  phase80AnalogicalExperienceAdaptationSteps,
  phase81CounterfactualExperienceSteps,
  phase81CounterfactualReflectionReentrySteps,
  phase82LongitudinalExperienceLearningSteps,
  phase83RetrievalCompetitionConsequenceSteps,
  phase84MemoryContextRevivalSteps,
  phase85MemoryReconsolidationSteps,
  phase86AffectiveCognitionSteps,
  worldSimulationSteps,
} from "./test-suite-groups.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runAllPath = path.join(__dirname, "run-all.mjs");
const runAllSource = fs.readFileSync(runAllPath, "utf8");

function pathsFor(steps) {
  return steps.map(([, args]) => args[0]);
}

function assertUnique(label, values) {
  assert.equal(
    new Set(values).size,
    values.length,
    `${label} must not contain duplicate test paths.`,
  );
}

const activeRunAllPaths = [
  ...runAllSource.matchAll(
    /"tests\/(phase62|phase63|phase64|phase65|phase66|phase67|phase68|phase69|phase70|phase71|phase72|phase73|phase74|phase75|phase76|phase77|phase78|phase79|phase80|phase81|phase82|phase83|phase84|phase85|phase86)\/[^"]+\.test\.mjs"/g,
  ),
].map((match) => match[0].slice(1, -1));

const worldPaths = pathsFor(worldSimulationSteps);
const cognitionPaths = pathsFor(cognitionSteps);
const memoryPaths = pathsFor(memoryRetrievalSteps);
const phase62Paths = pathsFor(phase62WorldSimulationSteps);
const phase63Paths = pathsFor(phase63MemorySteps);
const phase64Paths = pathsFor(phase64RetrievalCognitionSteps);
const phase65Paths = pathsFor(phase65BeliefCognitionSteps);
const phase66Paths = pathsFor(phase66BeliefRevisionSteps);
const phase67Paths = pathsFor(phase67AutobiographicalMemorySteps);
const phase68Paths = pathsFor(phase68SelfInterpretationSteps);
const phase69Paths = pathsFor(phase69GoalToPlanSteps);
const phase70Paths = pathsFor(phase70GoalLifecycleSteps);
const phase71Paths = pathsFor(phase71AdaptiveReplanningSteps);
const phase72Paths = pathsFor(phase72MeansFeasibilitySteps);
const phase73Paths = pathsFor(phase73VisibleConstraintObservationSteps);
const phase74Paths = pathsFor(phase74SubjectiveActionDeliberationSteps);
const phase75Paths = pathsFor(phase75ActionCommitmentSteps);
const phase76Paths = pathsFor(phase76PostOutcomeSubjectiveExperienceSteps);
const phase77Paths = pathsFor(phase77MultiExperienceSchemaInductionSteps);
const phase78Paths = pathsFor(phase78ContextualSchemaRefinementSteps);
const phase79Paths = pathsFor(phase79ExperientialMethodCompetitionSteps);
const phase80Paths = pathsFor(phase80AnalogicalExperienceAdaptationSteps);
const phase81Paths = pathsFor(phase81CounterfactualExperienceSteps);
const phase81CounterfactualReflectionReentryPaths = pathsFor(
  phase81CounterfactualReflectionReentrySteps,
);
const phase82Paths = pathsFor(phase82LongitudinalExperienceLearningSteps);
const phase83Paths = pathsFor(phase83RetrievalCompetitionConsequenceSteps);
const phase84Paths = pathsFor(phase84MemoryContextRevivalSteps);
const phase85Paths = pathsFor(phase85MemoryReconsolidationSteps);
const phase86Paths = pathsFor(phase86AffectiveCognitionSteps);
const phase62CognitionPaths = pathsFor(phase62CognitionIntegrationSteps);

assertUnique("run-all active world-simulation inventory", activeRunAllPaths);
assertUnique("world-simulation runner", worldPaths);
assertUnique("cognition runner", cognitionPaths);
assertUnique("memory-retrieval runner", memoryPaths);

assert.deepEqual(
  worldPaths,
  activeRunAllPaths,
  "World-simulation runner must exactly cover the Phase62/63/64/65/66/67/68/69/70/71/72/73/74/75/76/77/78/79/80/81/82/83/84/85/86 inventory in run-all.mjs.",
);

assert.deepEqual(
  memoryPaths,
  [...phase63Paths, ...phase64Paths, ...phase67Paths, ...phase68Paths, ...phase69Paths, ...phase70Paths, ...phase71Paths, ...phase72Paths, ...phase73Paths, ...phase76Paths, ...phase77Paths, ...phase78Paths, ...phase79Paths, ...phase80Paths, ...phase81CounterfactualReflectionReentryPaths, ...phase82Paths, ...phase83Paths, ...phase84Paths, ...phase85Paths, ...phase86Paths],
  "Memory-retrieval runner must cover Phase63 memory, Phase64 retrieval cognition, Phase67 autobiographical memory, Phase68 self interpretation, Phase69 goal-to-plan cognition, Phase70 goal lifecycle cognition, Phase71 adaptive replanning cognition, Phase72 means-feasibility cognition, Phase73 visible-constraint observation cognition, Phase76 post-outcome experience-memory-learning cognition, Phase77 multi-experience schema induction cognition, Phase78 contextual schema refinement cognition, Phase79 experiential method competition cognition, Phase80 analogical experience adaptation cognition, the Phase81D-Q counterfactual reflection/reuse path, Phase82 longitudinal experience learning, Phase83 retrieval-competition consequence cognition, and Phase84 explicit-context revival cognition.",
);

assert.deepEqual(
  cognitionPaths,
  [
    ...phase62CognitionPaths,
    ...phase63Paths,
    ...phase64Paths,
    ...phase65Paths,
    ...phase66Paths,
    ...phase67Paths,
    ...phase68Paths,
    ...phase69Paths,
    ...phase70Paths,
    ...phase71Paths,
    ...phase72Paths,
    ...phase73Paths,
    ...phase74Paths,
    ...phase75Paths,
    ...phase76Paths,
    ...phase77Paths,
    ...phase78Paths,
    ...phase79Paths,
    ...phase80Paths,
    ...phase81Paths,
    ...phase82Paths,
    ...phase83Paths,
    ...phase84Paths,
    ...phase85Paths,
    ...phase86Paths,
  ],
  "Cognition runner must cover its Phase62 integration boundary plus all Phase63/64/65/66/67/68/69/70/71/72/73/74/75/76/77/78/79/80/81/82/83/84/85/86 cognition.",
);

assert.deepEqual(
  phase62CognitionPaths,
  phase62Paths.slice(0, 13),
  "Phase62 cognition integration boundary must remain the A-R1/R2 through Phase62C main-loop integration prefix.",
);

for (const testPath of worldPaths) {
  assert.match(
    testPath,
    /^tests\/phase(?:62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86)\//,
    `Active runner leaked non-world-simulation test: ${testPath}`,
  );
}

for (const testPath of cognitionPaths) {
  assert.ok(
    !testPath.startsWith("tests/phase22/")
      && !testPath.startsWith("tests/phase44/")
      && !testPath.startsWith("tests/phase45/")
      && !testPath.startsWith("tests/phase46/")
      && !testPath.startsWith("tests/phase47/")
      && !testPath.startsWith("tests/phase48/")
      && !testPath.startsWith("tests/phase49/")
      && !testPath.startsWith("tests/phase50/")
      && !testPath.startsWith("tests/phase51/")
      && !testPath.startsWith("tests/phase52/")
      && !testPath.startsWith("tests/phase53/")
      && !testPath.startsWith("tests/phase54/")
      && !testPath.startsWith("tests/phase55/")
      && !testPath.startsWith("tests/phase56/")
      && !testPath.startsWith("tests/phase57/")
      && !testPath.startsWith("tests/phase58/")
      && !testPath.startsWith("tests/phase59/")
      && !testPath.startsWith("tests/phase60/"),
    `Cognition runner must not pull legacy writing pipeline test: ${testPath}`,
  );
}

console.log("Test-suite dependency-aligned inventory passed.");