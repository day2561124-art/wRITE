import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  fileURLToPath,
} from "node:url";

import {
  baseLevelActivationProjectionModelProfileHash,
  buildWorldSimulationBaseLevelActivationProjectionContract,
  projectWorldSimulationBaseLevelActivation,
  worldSimulationBaseLevelActivationProjectionVersion,
} from "../../server/src/world-simulation-base-level-activation-projection-service.mjs";
import {
  retrievalPracticeActivationProjectionModelProfileHash,
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";

const __filename =
  fileURLToPath(import.meta.url);
const __dirname =
  path.dirname(__filename);
const rootDir =
  path.resolve(
    __dirname,
    "../..",
  );

function clone(value) {
  return JSON.parse(
    JSON.stringify(value),
  );
}

function memory(
  memoryId,
  encodedAt,
  extra = {},
) {
  return {
    memory_id:
      memoryId,
    ...(encodedAt !== undefined
      ? {
        encoded_at:
          encodedAt,
      }
      : {}),
    content: {
      label:
        memoryId,
    },
    ...extra,
  };
}

function mockR2Projection({
  records,
  asOf,
  projectedIds = null,
  masses = {},
  projectionId = "r2_projection_test",
}) {
  const inputIds =
    records.map(
      (record) =>
        record.memory_id,
    );

  const order =
    projectedIds
    ?? inputIds;

  const byId =
    new Map(
      records.map(
        (record) => [
          record.memory_id,
          record,
        ],
      ),
    );

  return {
    version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,

    projection_id:
      projectionId,

    character:
      "Test Character",

    current_turn_id:
      "turn-r3-test",

    as_of:
      asOf,

    model_profile_hash:
      retrievalPracticeActivationProjectionModelProfileHash,

    input_memory_ids:
      inputIds,

    projected_memory_ids:
      order,

    projected_memory_records:
      order.map(
        (memoryId) =>
          clone(
            byId.get(memoryId),
          ),
      ),

    activation_evidence:
      order.map(
        (memoryId, projectedIndex) => ({
          memory_id:
            memoryId,
          projected_index:
            projectedIndex,
          activation_mass:
            masses[memoryId]
            ?? 0,
          activation_score:
            (masses[memoryId] ?? 0) > 0
              ? Math.log(
                masses[memoryId],
              )
              : null,
        }),
      ),
  };
}

function approx(
  actual,
  expected,
  epsilon = 1e-12,
) {
  assert.equal(
    Number.isFinite(actual),
    true,
  );
  assert.ok(
    Math.abs(
      actual
      - expected,
    ) <= epsilon,
    `expected ${actual} ~= ${expected}`,
  );
}

const contract =
  buildWorldSimulationBaseLevelActivationProjectionContract();

assert.equal(
  contract.version,
  worldSimulationBaseLevelActivationProjectionVersion,
);
assert.equal(
  contract.phase,
  "Phase64A-R3",
);
assert.equal(
  contract.mass_composition_before_logarithm,
  true,
);
assert.equal(
  contract.legacy_untimed_memory_positions_pinned,
  true,
);
assert.equal(
  contract.source_phase64a_r2_projection_required,
  true,
);
assert.equal(
  contract.phase64a_r1_history_read_directly,
  false,
);
assert.equal(
  contract.model_profile_hash,
  baseLevelActivationProjectionModelProfileHash,
);
assert.equal(
  contract.model_profile.activation_decay_exponent,
  0.5,
);
assert.equal(
  contract.model_profile.base_level_constant,
  0,
);
assert.equal(
  contract.model_profile.exact_act_r_chunk_merge_semantics_implemented,
  false,
);
assert.equal(
  contract.model_profile.activation_score_is_literal_human_recall_probability,
  false,
);

{
  const asOf =
    "2026-08-28T08:00:00.000Z";

  const records = [
    memory(
      "older",
      "2026-08-28T07:00:00.000Z",
    ),
    memory(
      "newer",
      "2026-08-28T07:59:59.000Z",
    ),
  ];

  const result =
    projectWorldSimulationBaseLevelActivation({
      memory_records:
        records,
      retrieval_practice_projection:
        mockR2Projection({
          records,
          asOf,
        }),
    });

  assert.deepEqual(
    result.projected_memory_ids,
    [
      "newer",
      "older",
    ],
  );

  const newer =
    result.base_level_activation_evidence
      .find(
        (entry) =>
          entry.memory_id
          === "newer",
      );

  approx(
    newer.encoding_age_seconds,
    1,
  );
  approx(
    newer.encoding_activation_contribution,
    1,
  );
  approx(
    newer.base_level_activation_score,
    0,
  );
}

{
  const asOf =
    "2026-08-28T08:00:00.000Z";

  const records = [
    memory(
      "old_practiced",
      "2026-08-28T07:00:00.000Z",
    ),
    memory(
      "recent_unpracticed",
      "2026-08-28T07:59:56.000Z",
    ),
  ];

  const r2 =
    mockR2Projection({
      records,
      asOf,
      projectedIds: [
        "old_practiced",
        "recent_unpracticed",
      ],
      masses: {
        old_practiced:
          1,
        recent_unpracticed:
          0,
      },
    });

  const result =
    projectWorldSimulationBaseLevelActivation({
      memory_records:
        records,
      retrieval_practice_projection:
        r2,
    });

  const old =
    result.base_level_activation_evidence
      .find(
        (entry) =>
          entry.memory_id
          === "old_practiced",
      );

  const expectedEncoding =
    3600 ** -0.5;

  approx(
    old.encoding_activation_contribution,
    expectedEncoding,
  );

  approx(
    old.base_level_activation_mass,
    expectedEncoding + 1,
  );

  approx(
    old.base_level_activation_score,
    Math.log(
      expectedEncoding + 1,
    ),
  );

  assert.notEqual(
    old.base_level_activation_score,
    Math.log(expectedEncoding)
      + Math.log(1),
    "R3 must compose mass before logarithm.",
  );

  assert.deepEqual(
    result.projected_memory_ids,
    [
      "old_practiced",
      "recent_unpracticed",
    ],
  );
}

{
  const asOf =
    "2026-08-28T08:00:00.000Z";

  const records = [
    memory(
      "timed_old",
      "2026-08-28T07:00:00.000Z",
    ),
    memory(
      "legacy",
      undefined,
    ),
    memory(
      "timed_new",
      "2026-08-28T07:59:59.000Z",
    ),
  ];

  const result =
    projectWorldSimulationBaseLevelActivation({
      memory_records:
        records,
      retrieval_practice_projection:
        mockR2Projection({
          records,
          asOf,
          projectedIds: [
            "timed_old",
            "legacy",
            "timed_new",
          ],
          masses: {
            legacy:
              10,
          },
        }),
    });

  assert.deepEqual(
    result.projected_memory_ids,
    [
      "timed_new",
      "legacy",
      "timed_old",
    ],
    "legacy memory must stay pinned to the R2 slot while timed memories may reorder around it.",
  );

  const legacy =
    result.base_level_activation_evidence
      .find(
        (entry) =>
          entry.memory_id
          === "legacy",
      );

  assert.equal(
    legacy.complete_base_level_evidence,
    false,
  );
  assert.equal(
    legacy.legacy_r2_slot_pinned,
    true,
  );
  assert.equal(
    legacy.base_level_activation_score,
    null,
  );
  assert.equal(
    legacy.retrieval_practice_activation_mass,
    10,
  );
  assert.equal(
    result.audit.legacy_untimed_pinned_count,
    1,
  );
}

{
  const asOf =
    "2026-08-28T08:00:00.000Z";

  const records = [
    memory(
      "legacy_a",
      undefined,
    ),
    memory(
      "legacy_b",
      undefined,
    ),
  ];

  const result =
    projectWorldSimulationBaseLevelActivation({
      memory_records:
        records,
      retrieval_practice_projection:
        mockR2Projection({
          records,
          asOf,
          projectedIds: [
            "legacy_b",
            "legacy_a",
          ],
          masses: {
            legacy_a:
              100,
            legacy_b:
              0,
          },
        }),
    });

  assert.deepEqual(
    result.projected_memory_ids,
    [
      "legacy_b",
      "legacy_a",
    ],
    "all-legacy snapshots must preserve the canonical R2 order exactly.",
  );
}

{
  const records = [
    memory(
      "future",
      "2026-08-28T08:00:01.000Z",
    ),
  ];

  assert.throws(
    () =>
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          records,
        retrieval_practice_projection:
          mockR2Projection({
            records,
            asOf:
              "2026-08-28T08:00:00.000Z",
          }),
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_FUTURE_ENCODING_TIME",
  );
}

{
  const records = [
    memory(
      "invalid_time",
      "not-a-time",
    ),
  ];

  assert.throws(
    () =>
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          records,
        retrieval_practice_projection:
          mockR2Projection({
            records,
            asOf:
              "2026-08-28T08:00:00.000Z",
          }),
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_ENCODING_TIME_INVALID",
  );
}

{
  const records = [
    memory(
      "one",
      "2026-08-28T07:59:59.000Z",
    ),
  ];

  const bad =
    mockR2Projection({
      records,
      asOf:
        "2026-08-28T08:00:00.000Z",
    });

  bad.model_profile_hash =
    "tampered";

  assert.throws(
    () =>
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          records,
        retrieval_practice_projection:
          bad,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_PROFILE_MISMATCH",
  );
}

{
  const records = [
    memory(
      "one",
      "2026-08-28T07:59:59.000Z",
    ),
    memory(
      "two",
      "2026-08-28T07:59:58.000Z",
    ),
  ];

  const bad =
    mockR2Projection({
      records,
      asOf:
        "2026-08-28T08:00:00.000Z",
    });

  bad.input_memory_ids = [
    "two",
    "one",
  ];

  assert.throws(
    () =>
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          records,
        retrieval_practice_projection:
          bad,
      }),
    (error) =>
      error?.code
      === "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_INPUT_SNAPSHOT_MISMATCH",
  );
}

{
  const records = [
    memory(
      "one",
      "2026-08-28T07:59:59.000Z",
      {
        storage_strength:
          0.3,
        perceptual_clarity_at_encoding:
          0.7,
      },
    ),
  ];

  const before =
    clone(records);

  const result =
    projectWorldSimulationBaseLevelActivation({
      memory_records:
        records,
      retrieval_practice_projection:
        mockR2Projection({
          records,
          asOf:
            "2026-08-28T08:00:00.000Z",
        }),
    });

  assert.deepEqual(
    records,
    before,
    "R3 must not mutate authoritative memory records.",
  );

  assert.deepEqual(
    result.projected_memory_records[0],
    before[0],
    "R3 projected records must preserve memory content and fields.",
  );

  assert.equal(
    result.audit.memory_content_rewritten,
    false,
  );
  assert.equal(
    result.audit.storage_strength_mutated,
    false,
  );
  assert.equal(
    result.audit.retrieval_strength_mutated,
    false,
  );
  assert.equal(
    result.audit.candidate_membership_mutated,
    false,
  );
}

{
  const loopSource =
    fs.readFileSync(
      path.join(
        rootDir,
        "server/src/world-simulation-loop-service.mjs",
      ),
      "utf8",
    )
      .replace(/\r\n/g, "\n");

  assert.match(
    loopSource,
    /buildWorldSimulationBaseLevelActivationProjectionContract,\n\s*projectWorldSimulationBaseLevelActivation,/,
    "World loop must import the Phase64A-R3 contract and projector.",
  );

  assert.match(
    loopSource,
    /base_level_activation_projection:\n\s*buildWorldSimulationBaseLevelActivationProjectionContract\(\),/,
    "World loop contract must expose Phase64A-R3.",
  );

  assert.match(
    loopSource,
    /const baseLevelActivationProjection =\n\s*projectWorldSimulationBaseLevelActivation\(\{/,
    "World loop must execute R3 after R2.",
  );

  assert.match(
    loopSource,
    /retrieval_practice_projection:\n\s*retrievalPracticeActivationProjection,/,
    "World loop must feed verified R2 projection into R3.",
  );

  assert.match(
    loopSource,
    /const retrievalMemoryRecords =\n\s*baseLevelActivationProjection\n\s*\.projected_memory_records;/,
    "Phase63B/Phase63C retrieval snapshot must originate from R3.",
  );

  assert.match(
    loopSource,
    /base_level_activation_projection:\n\s*cloneJson\(\n\s*baseLevelActivationProjection\.audit,/,
    "Memory accessibility audit must retain the R3 projection audit.",
  );
}

{
  const runAllSource =
    fs.readFileSync(
      path.join(
        rootDir,
        "tests/run-all.mjs",
      ),
      "utf8",
    )
      .replace(/\r\n/g, "\n");

  const formalPath =
    "tests/phase64/phase64a-base-level-activation-composition-projection.test.mjs";

  assert.equal(
    runAllSource
      .split(formalPath)
      .length
      - 1,
    1,
    "Phase64A-R3 formal test must be registered in run-all exactly once.",
  );
}

console.log(
  "Phase64A-R3 base-level activation composition projection: PASS",
);
