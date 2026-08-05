import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  buildStructuredEntityRegistry,
  getStructuredEntity,
  getStructuredEntityRegistry,
  validateEntityRegistry,
} from "../../server/src/structured-canon-entity-registry-service.mjs";
import {
  chatgpt_bridge_search_canon_entities,
} from "../../server/src/chatgpt-bridge-entity-registry-tools.mjs";
import {
  hydratePlannedEntityManifest,
} from "../../server/src/canon-entity-hydration-service.mjs";
import {
  buildGptWritingContext,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  buildCharacterTurnSimulation,
} from "../../server/src/character-turn-simulation-service.mjs";
import {
  buildDraftEntityAudit,
} from "../../server/src/draft-entity-audit-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const protectedPaths = [projectPaths.activeEngine, projectPaths.compressedRules];
const sideEffectRoots = [
  projectPaths.pendingEngineCandidates,
  projectPaths.approvalQueue,
  projectPaths.settlementWorkflow,
  projectPaths.settingChangeProposals,
];
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `ron-visal-canon-${process.pid}-${Date.now()}`,
);

async function fileHashes(paths) {
  return Object.fromEntries(await Promise.all(paths.map(async (filePath) => [
    filePath,
    sha256(await readFile(filePath)),
  ])));
}

async function treeDigest(root) {
  const records = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.join(prefix, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) records.push(`${relative}:${sha256(await readFile(absolute))}`);
    }
  }
  await visit(root);
  return sha256(records.join("\n"));
}

async function treeDigests(roots) {
  return Object.fromEntries(await Promise.all(
    roots.map(async (root) => [root, await treeDigest(root)]),
  ));
}

function byId(registry, bucket, entityId) {
  return registry[bucket].find((entity) => entity.entity_id === entityId);
}

async function assertSearch(query, expectedEntityId) {
  const result = await chatgpt_bridge_search_canon_entities({
    q: query,
    limit: 20,
    include_related_entities: true,
  });
  assert.equal(result.ok, true, `search failed: ${query}`);
  assert(
    result.entities.some((entity) => entity.entity_id === expectedEntityId),
    `search did not find ${expectedEntityId}: ${query}`,
  );
  return result;
}

const protectedBefore = await fileHashes(protectedPaths);
const sideEffectsBefore = await treeDigests(sideEffectRoots);
await mkdir(fixtureRoot, { recursive: true });

try {
  await assert.rejects(
    buildStructuredEntityRegistry({
      preview: { entities: [], warnings: [], blocking_warnings: [] },
      formalCanonSources: [{
        content: "# malformed formal source\n\n## character｜missing-id\n",
        source_file: "data/canon_db/sources/entity_malformed.md",
        source_hash: sha256("malformed"),
        source_modified_at: new Date(0).toISOString(),
      }],
    }),
    /Invalid formal Canon entity source.*malformed entity heading/u,
  );

  const generated = await buildStructuredEntityRegistry({
    preview: { entities: [], warnings: [], blocking_warnings: [] },
  });
  assert.deepEqual(validateEntityRegistry(generated.registry), []);
  assert(byId(generated.registry, "characters", "character_ron_visal"));
  assert(byId(generated.registry, "weapons", "weapon_severing_tide"));
  assert(byId(
    generated.registry,
    "abilities",
    "ability_sever_continuing_force",
  ));

  const loaded = await getStructuredEntityRegistry();
  assert.deepEqual(validateEntityRegistry(loaded.registry), []);
  const loadedAgain = await getStructuredEntityRegistry();
  for (const bucket of ["characters", "weapons", "abilities", "organizations"]) {
    assert.deepEqual(
      loadedAgain.registry[bucket].map((entity) => entity.entity_id),
      loaded.registry[bucket].map((entity) => entity.entity_id),
      `${bucket} overlay order must be stable and reproducible.`,
    );
  }

  const ron = byId(loaded.registry, "characters", "character_ron_visal");
  const weapon = byId(loaded.registry, "weapons", "weapon_severing_tide");
  const ability = byId(
    loaded.registry,
    "abilities",
    "ability_sever_continuing_force",
  );
  const organization = loaded.registry.organizations.find(
    (entity) => entity.canonical_name === "夜星武裝學院",
  );

  assert(ron, "Ron Canon character did not load.");
  assert(weapon, "Severing Tide weapon did not load.");
  assert(ability, "Severing Tide ability did not load.");
  assert(organization, "Existing Nightstar academy organization did not resolve.");
  assert.equal(
    loaded.registry.organizations.filter(
      (entity) => entity.canonical_name === "夜星武裝學院",
    ).length,
    1,
    "Nightstar academy was duplicated.",
  );
  assert.equal(ron.english_name, "Ron Visal");
  assert.equal(ron.affiliation, "夜星武裝學院");
  assert.equal(ron.position, "實戰調整科教師");
  assert(ron.related_entities.includes(weapon.entity_id));
  assert(ron.related_entities.includes(ability.entity_id));
  assert(ron.related_entities.includes(organization.entity_id));
  assert.equal(weapon.holder_character_id, ron.entity_id);
  assert(weapon.related_entities.includes(ron.entity_id));
  assert(ability.holder_character_ids.includes(ron.entity_id));
  assert(ability.related_weapons.includes(weapon.entity_id));
  assert(organization.members.includes(ron.entity_id));

  await assertSearch("羅恩・維薩爾", ron.entity_id);
  await assertSearch("羅恩", ron.entity_id);
  await assertSearch("Ron Visal", ron.entity_id);
  await assertSearch("Visal", ron.entity_id);
  await assertSearch("斷潮", weapon.entity_id);
  await assertSearch("《斷潮》", weapon.entity_id);
  await assertSearch("實戰調整科教師", ron.entity_id);
  await assertSearch("夜星武裝學院 教師", ron.entity_id);
  await assertSearch("截斷正在延續的力量", ability.entity_id);

  const weaponDetail = await getStructuredEntity(weapon.entity_id);
  assert.equal(weaponDetail.entity.holder_character_id, ron.entity_id);
  assert.equal(weaponDetail.entity.holder_name, "羅恩・維薩爾");

  const hydrated = await hydratePlannedEntityManifest({
    plannedEntityManifest: { characters: ["羅恩・維薩爾"] },
  });
  assert.equal(hydrated.planned_canon_coverage.coverage_complete, true);
  const hydratedRon = hydrated.planned_entity_hydration.resolved_entities.find(
    (entity) => entity.entity_id === ron.entity_id,
  );
  assert(hydratedRon, "planned entity manifest did not hydrate Ron.");
  assert.equal(hydratedRon.affiliation, "夜星武裝學院");
  assert.equal(hydratedRon.grade_or_role, "實戰調整科教師");
  assert(hydratedRon.related_weapons.includes("斷潮"));
  assert(hydratedRon.related_abilities.some(
    (text) => text.includes("截斷正在延續的力量"),
  ));
  const hydratedWeapon = hydratedRon.weapon_details.find(
    (entry) => entry.entity_id === weapon.entity_id,
  );
  const hydratedAbility = hydratedRon.ability_details.find(
    (entry) => entry.entity_id === ability.entity_id,
  );
  assert(hydratedWeapon);
  assert(hydratedAbility);
  assert.equal(hydratedWeapon.core_ability, "截斷正在延續的力量。");
  assert(hydratedWeapon.confirmed_limits.some((text) => text.includes("接觸時機")));
  assert(hydratedWeapon.confirmed_limits.some((text) => text.includes("不能永久封印")));
  assert(hydratedWeapon.confirmed_limits.some((text) => text.includes("不能直接消除")));
  for (const forbidden of ["永久封印", "武裝消除", "全能力無效化", "無接觸取消"]) {
    assert(
      hydratedAbility.forbidden_normalizations.some((text) => text.includes(forbidden)),
      `missing forbidden normalization: ${forbidden}`,
    );
  }

  const built = await buildGptWritingContext({
    task_prompt: "寫羅恩・維薩爾在實戰調整課要求學生停止錯誤動作。",
    generation_context: { location: "夜星武裝學院訓練場" },
    retrieval_context: {},
    planned_entity_manifest: { characters: ["Ron Visal"] },
    max_context_chars: 48_000,
  }, { fixtureRoot });
  const groundedRon = built.bundle.content.character_canon_grounding.characters.find(
    (character) => character.canonical_name === "羅恩・維薩爾",
  );
  assert(groundedRon, "writing context did not ground Ron.");
  assert(groundedRon.personality_facts.some((text) => text.includes("冷靜")));
  assert(groundedRon.teaching_principles.includes("判斷"));
  assert(groundedRon.usage_constraints.some((text) => text.includes("不鼓勵學生逞強")));
  assert.match(built.bundle.fixed_guard_section, /不要把他寫成只會說簡短金句的冷面教師/u);
  assert(
    built.bundle.relevant_canon.abilities_and_weapons.some(
      (record) => record.entity_id === weapon.entity_id
        && record.content.includes("截斷正在延續的力量"),
    ),
  );

  const simulation = buildCharacterTurnSimulation({
    taskPrompt: "羅恩・維薩爾正在糾正學生的距離與重心。",
    writingContext: built.bundle,
    capabilityInput: {
      character: "羅恩・維薩爾",
      immediate_goal: "讓學生停止錯誤動作並自行判斷",
    },
    characterHardFacts: built.bundle.content.character_canon_grounding.characters,
  });
  assert.equal(simulation.simulation_basis.canon_constraint_count, 1);

  const audit = await buildDraftEntityAudit({
    draftText: "羅恩・維薩爾握著《斷潮》，要求學生先停下錯誤動作。",
  });
  assert(audit.draft_entity_audit.hydrated_late_entities.some(
    (entity) => entity.entity_id === ron.entity_id
      && entity.related_weapons.includes("斷潮")
      && entity.ability_details.some((entry) => (
        entry.forbidden_normalizations.includes("全能力無效化")
      )),
  ));
  assert.equal(audit.draft_canon_coverage.coverage_complete, true);

  assert.deepEqual(await fileHashes(protectedPaths), protectedBefore);
  assert.deepEqual(await treeDigests(sideEffectRoots), sideEffectsBefore);
  console.log("Ron Visal formal Canon, registry, hydration, context, simulator, and diagnostics tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
