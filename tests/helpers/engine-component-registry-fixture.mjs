import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  calculateSha256Lf,
  engineComponentRegistryPath,
} from "../../server/src/engine-component-registry.mjs";
import {
  synchronizeActiveEngineDependencies,
} from "../../server/src/active-engine-dependency-service.mjs";

export async function createEngineComponentRegistryFixture({
  registryPath,
  activeEnginePath,
  expectedHash = null,
}) {
  const registry = JSON.parse(await readFile(engineComponentRegistryPath, "utf8"));
  registry.components.canon_data.expected_sha256_lf = expectedHash
    ?? calculateSha256Lf(await readFile(activeEnginePath));
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  const dependencyRoot = path.dirname(registryPath);
  const configRoot = path.join(dependencyRoot, "config");
  const entityRegistryRoot = path.join(dependencyRoot, "data", "entity_registry");
  const activeHash = expectedHash ?? calculateSha256Lf(await readFile(activeEnginePath));
  await mkdir(configRoot, { recursive: true });
  await writeFile(path.join(configRoot, "canon-zones.json"), `${JSON.stringify({
    schema_version: 1,
    source_component: "canon_data",
    source_path: activeEnginePath,
    expected_sha256_lf: activeHash,
    mode: "read_only_preview",
    zones: [{
      id: "complete_engine",
      label: "Complete fixture engine",
      start: "BOF",
      end_before: "EOF",
      component_hint: "canon_data",
      update_policy: "preview_only",
    }],
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(configRoot, "entity-registry.json"), `${JSON.stringify({
    schema_version: 1,
    mode: "read_only_preview",
    read_only: true,
    source_component: "canon_data",
    source_path: activeEnginePath,
    source_zones_config: path.join(configRoot, "canon-zones.json"),
    expected_sha256_lf: activeHash,
    entity_kinds: ["character", "weapon", "organization", "location"],
    status_values: ["registry_candidate", "ambiguous_candidate", "rejected_by_rule"],
    canon_write_allowed: false,
    approval_required_for_canon_change: true,
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(configRoot, "entity-intake.json"), `${JSON.stringify({
    schema_version: 1,
    mode: "read_only_preview",
    source_entity_registry_config: path.join(configRoot, "entity-registry.json"),
    source_engine_path: activeEnginePath,
    expected_engine_sha256_lf: activeHash,
    canon_write_allowed: false,
    approval_required_for_canon_change: true,
    creates_formal_character_card: false,
    creates_formal_weapon_card: false,
    creates_formal_ability_card: false,
    intake_kinds: [
      "character_intake",
      "weapon_intake",
      "character_weapon_link_intake",
    ],
    allowed_statuses: [
      "intake_candidate",
      "ambiguous_intake_candidate",
      "needs_completion",
      "existing_entity_reference",
      "rejected_by_rule",
    ],
  }, null, 2)}\n`, "utf8");
  await synchronizeActiveEngineDependencies({
    activeEnginePath,
    registryPath,
    dependencyRoot,
    entityRegistryRoot,
    canonDbPath: dependencyRoot,
    includeExtendedDependencies: false,
  });
  return registry;
}
