import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { activateEngineCandidateAfterApproval } from "../../server/src/engine-activation-confirm-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import {
  getActiveEngineDependencyStatus,
  readActiveEngineDependencyStates,
  synchronizeActiveEngineDependencies,
} from "../../server/src/active-engine-dependency-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { createEngineComponentRegistryFixture } from "../helpers/engine-component-registry-fixture.mjs";

const suffix = ".active-engine-dependency-synchronization-test";
const root = path.join(projectPaths.canonDb, suffix);
const options = {
  activeEnginePath: path.join(root, "active_engine.md"),
  registryPath: path.join(root, "engine-components.json"),
  activeEngineDependencyRoot: root,
  entityRegistryRoot: path.join(root, "data", "entity_registry"),
  dependencyCanonDbPath: root,
  includeExtendedDependencies: false,
  pendingEngineCandidates: path.join(root, "pending"),
  engineSnapshots: path.join(root, "snapshots"),
  engineArchive: path.join(root, "archive"),
  activationLog: path.join(root, "logs", "activation.jsonl"),
  rollbackIndex: path.join(root, "rollback", "index.json"),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
};

const dependencyOptions = {
  activeEnginePath: options.activeEnginePath,
  registryPath: options.registryPath,
  dependencyRoot: root,
  entityRegistryRoot: options.entityRegistryRoot,
  canonDbPath: root,
  includeExtendedDependencies: false,
};

function settlement(candidateText) {
  return `## pending_engine_candidate\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function importAndRequest(candidateText, label) {
  const candidate = await importSettlementResult({
    rawText: settlement(candidateText),
    sourceChapter: label,
  }, options);
  const review = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidate.metadata.candidate_id,
    reviewMode: "summary_only",
  }, options);
  const request = await requestPendingEngineCandidateActivation({
    pendingEngineCandidateId: candidate.metadata.candidate_id,
    reviewId: review.review.review_id,
    reason: label,
  }, options);
  return {
    candidate,
    item: await getApprovalItem(request.approval_item_id, options),
  };
}

async function activate(request, injections = {}) {
  return activateEngineCandidateAfterApproval({
    approvalItemId: request.item.approval_item_id,
    pendingEngineCandidateId: request.item.target_id,
    confirmedBy: "active_engine_dependency_regression_test",
    secondConfirm: true,
  }, {
    ...options,
    ...injections,
    approvalConfirmed: true,
    approvalItem: request.item,
  });
}

async function dependencyBytes() {
  const { manifest, states } = await readActiveEngineDependencyStates(dependencyOptions);
  return new Map(manifest.map((dependency) => [
    dependency.id,
    Buffer.from(states.get(dependency.id).content),
  ]));
}

async function assertDependencyBytesEqual(expected, message) {
  const actual = await dependencyBytes();
  for (const [id, content] of expected) {
    assert.deepEqual(actual.get(id), content, `${message}: ${id}`);
  }
}

function staleHash(hash) {
  return `${hash[0] === "A" ? "B" : "A"}${hash.slice(1)}`;
}

async function main() {
  const baseline = [
    "# Active Engine Dependency Fixture",
    ...Array.from({ length: 24 }, (_, index) => `Rule ${index + 1}: stable.`),
    "# Required Canon Boundary",
    ...Array.from({ length: 24 }, (_, index) => `Canon ${index + 1}: stable.`),
    "",
  ].join("\n");
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(options.approvalQueue, { recursive: true, force: true }),
    rm(options.engineCandidateReviews, { recursive: true, force: true }),
  ]);
  await mkdir(root, { recursive: true });
  await writeFile(options.activeEnginePath, baseline, "utf8");
  await createEngineComponentRegistryFixture({
    registryPath: options.registryPath,
    activeEnginePath: options.activeEnginePath,
  });

  const canonConfigPath = path.join(root, "config", "canon-zones.json");
  const canonConfig = JSON.parse(await readFile(canonConfigPath, "utf8"));
  canonConfig.zones = [
    {
      id: "before_required_boundary",
      label: "Before required boundary",
      start: "BOF",
      end_before: "# Required Canon Boundary",
      component_hint: "engine_header",
      update_policy: "preview_only",
    },
    {
      id: "after_required_boundary",
      label: "After required boundary",
      start: "# Required Canon Boundary",
      end_before: "EOF",
      component_hint: "canon_data",
      update_policy: "preview_only",
    },
  ];
  await writeFile(canonConfigPath, `${JSON.stringify(canonConfig, null, 2)}\n`, "utf8");
  await synchronizeActiveEngineDependencies(dependencyOptions);

  const historicalPath = path.join(root, "config", "phase-history-immutable.json");
  const historicalBytes = Buffer.from(`${JSON.stringify({
    phase: "historical_acceptance_evidence",
    expected_engine_sha256_lf: "1".repeat(64),
    immutable: true,
  }, null, 2)}\n`);
  await writeFile(historicalPath, historicalBytes);

  try {
    // Test F: candidate, review, and approval request are byte-for-byte read only.
    const dependenciesBeforeCandidate = await dependencyBytes();
    const success = await importAndRequest(
      `${baseline.trimEnd()}\nRule 49: activated.`,
      "Test A/F complete downstream refresh",
    );
    await assertDependencyBytesEqual(
      dependenciesBeforeCandidate,
      "Candidate/preview stage modified a dependency",
    );
    assert.deepEqual(await readFile(historicalPath), historicalBytes);
    for (const requiredPath of [
      "config/canon-zones.json",
      "config/entity-registry.json",
      "config/entity-intake.json",
      "data/entity_registry/entity_registry.json",
      "data/entity_registry/provenance.json",
    ]) {
      assert(success.item.impact.will_modify.includes(requiredPath));
    }

    // Test A: activation refreshes and validates the complete dependency set.
    const activated = await activate(success);
    assert.equal(activated.active_engine_dependencies_verified, true);
    let status = await getActiveEngineDependencyStatus(dependencyOptions);
    assert.equal(status.ok, true);
    assert.deepEqual(status.issues, []);
    assert.equal(status.dependencies.canon_zones.roundtrip_matches, true);
    assert.equal(status.dependencies.entity_registry.provenance_matches, true);
    assert.equal(status.dependencies.entity_intake.current, true);
    assert.deepEqual(await readFile(historicalPath), historicalBytes);

    const activeBeforeFailures = await readFile(options.activeEnginePath);

    async function assertFailureRollsBack(label, candidateText, injections, pattern) {
      const beforeDependencies = await dependencyBytes();
      const beforeActive = await readFile(options.activeEnginePath);
      const request = await importAndRequest(candidateText, label);
      process.env.FILE_TRANSACTION_TEST_MODE = "1";
      await assert.rejects(() => activate(request, injections), pattern);
      delete process.env.FILE_TRANSACTION_TEST_MODE;
      assert.deepEqual(await readFile(options.activeEnginePath), beforeActive, `${label}: active engine`);
      await assertDependencyBytesEqual(beforeDependencies, `${label}: rollback mismatch`);
      assert.deepEqual(await readFile(historicalPath), historicalBytes, `${label}: historical file`);
    }

    // Test B: removing a required anchor blocks activation and rolls everything back.
    await assertFailureRollsBack(
      "Test B broken Canon anchor",
      activeBeforeFailures.toString("utf8")
        .replace("# Required Canon Boundary", "# Removed Canon Boundary")
        .trimEnd(),
      {},
      /anchor|boundary/iu,
    );

    // Test C: roundtrip mismatch is blocking.
    await assertFailureRollsBack(
      "Test C Canon roundtrip mismatch",
      `${activeBeforeFailures.toString("utf8").trimEnd()}\nRule 50: roundtrip.`,
      { testCanonRoundtripMismatch: true },
      /roundtrip/iu,
    );

    // Test D: registry rebuild failure restores every dependency.
    await assertFailureRollsBack(
      "Test D entity registry rebuild failure",
      `${activeBeforeFailures.toString("utf8").trimEnd()}\nRule 51: rebuild.`,
      { testEntityRegistryRebuildFailure: true },
      /registry rebuild failure/iu,
    );

    // Test E: stale provenance can never be committed as a successful activation.
    await assertFailureRollsBack(
      "Test E stale entity provenance",
      `${activeBeforeFailures.toString("utf8").trimEnd()}\nRule 52: provenance.`,
      { testStaleEntityProvenance: true },
      /provenance is stale/iu,
    );

    // Test I: a failure after derived files commit still restores them byte-for-byte.
    await assertFailureRollsBack(
      "Test I failure after dependency rebuild",
      `${activeBeforeFailures.toString("utf8").trimEnd()}\nRule 53: post-rebuild failure.`,
      { testFailAfterDependencyRebuild: true },
      /after active engine dependency rebuild/iu,
    );

    // Test H: explicit maintenance repairs stale configs and rebuilt provenance.
    const activeStatus = await getActiveEngineDependencyStatus(dependencyOptions);
    const wrongHash = staleHash(activeStatus.active_engine_sha256_lf);
    for (const [fileName, field] of [
      ["canon-zones.json", "expected_sha256_lf"],
      ["entity-registry.json", "expected_sha256_lf"],
      ["entity-intake.json", "expected_engine_sha256_lf"],
    ]) {
      const filePath = path.join(root, "config", fileName);
      const value = JSON.parse(await readFile(filePath, "utf8"));
      value[field] = wrongHash;
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
    const engineComponents = JSON.parse(await readFile(options.registryPath, "utf8"));
    engineComponents.components.canon_data.expected_sha256_lf = wrongHash;
    await writeFile(options.registryPath, `${JSON.stringify(engineComponents, null, 2)}\n`, "utf8");
    const provenancePath = path.join(options.entityRegistryRoot, "provenance.json");
    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    provenance.active_engine_hash = "0".repeat(64);
    await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
    assert.equal((await getActiveEngineDependencyStatus(dependencyOptions)).ok, false);
    const repaired = await synchronizeActiveEngineDependencies(dependencyOptions);
    assert.equal(repaired.active_engine_dependencies_verified, true);
    status = await getActiveEngineDependencyStatus(dependencyOptions);
    assert.equal(status.ok, true);
    assert.deepEqual(status.issues, []);

    // Test G: neither activation nor maintenance rewrites historical acceptance evidence.
    assert.deepEqual(await readFile(historicalPath), historicalBytes);
  } finally {
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(options.approvalQueue, { recursive: true, force: true }),
      rm(options.engineCandidateReviews, { recursive: true, force: true }),
    ]);
  }

  console.log("Active Engine dependency synchronization regression tests A-I passed.");
}

main().catch((error) => {
  delete process.env.FILE_TRANSACTION_TEST_MODE;
  console.error(`Active Engine dependency synchronization regression failed: ${error.stack}`);
  process.exitCode = 1;
});
