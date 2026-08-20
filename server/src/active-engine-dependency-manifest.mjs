import path from "node:path";
import { projectRoot, normalizeProjectPath, resolveProjectPath } from "./project-paths.mjs";
import { engineComponentRegistryPath } from "./engine-component-registry.mjs";
import { canonZoneConfigPath } from "./canon-zone-preview-service.mjs";

const operationalHashConfigPaths = [
  "config/settlement-completion-reminders.json",
  "config/visual-asset-registry.json",
  "config/visual-library-approval-queue-import-dry-run.json",
  "config/visual-library-bridge-readiness.json",
  "config/visual-library-confirmed-import.json",
  "config/visual-library-controlled-import-guard.json",
  "config/visual-library-controlled-import-trial.json",
  "config/visual-library-final-acceptance.json",
  "config/visual-library-final-e2e-acceptance.json",
  "config/visual-library-import-simulation.json",
  "config/visual-library-mcp-readonly-tool-registration.json",
  "config/visual-library-pending-import-readiness.json",
  "config/visual-library-persistent-baseline-activation.json",
  "config/visual-library-persistent-baseline-transition.json",
  "config/visual-library-persistent-import-operator-checklist.json",
  "config/visual-library-rebuild-intake.json",
  "config/visual-library-rollback-delete-restore.json",
  "config/visual-library-ui-import-flow.json",
  "config/visual-link-approval-queue-candidate.json",
  "config/visual-link-approval-queue-import-dry-run.json",
  "config/visual-link-approval-queue-import-guard.json",
  "config/visual-link-approval-readiness.json",
  "config/visual-link-final-acceptance.json",
];

const derivedEntityRegistryFiles = [
  "entity_registry.json",
  "entity_registry.index.json",
  "entity_registry.schema.json",
  "entity_registry_build_report.json",
  "conflict_report.json",
  "provenance.json",
];

export const ACTIVE_ENGINE_DEPENDENCIES = Object.freeze([
  { id: "engine_components", kind: "hash_sync", path: "config/engine-components.json" },
  { id: "canon_zones", kind: "validate_then_hash_sync", path: "config/canon-zones.json" },
  { id: "entity_registry_config", kind: "hash_sync_before_rebuild", path: "config/entity-registry.json" },
  { id: "entity_intake", kind: "hash_sync", path: "config/entity-intake.json" },
  ...operationalHashConfigPaths.map((filePath) => ({
    id: path.basename(filePath, ".json").replaceAll("-", "_"),
    kind: "hash_sync",
    path: filePath,
  })),
  ...derivedEntityRegistryFiles.map((fileName) => ({
    id: `entity_registry_${fileName.replaceAll(".", "_")}`,
    kind: "rebuild",
    path: `data/entity_registry/${fileName}`,
  })),
]);

export const ACTIVE_ENGINE_HISTORICAL_IMMUTABLE = Object.freeze([
  "config/phase46d-real-chatgpt-immutable-raw-story-handoff-live-acceptance-evidence.json",
  "config/phase47k-real-chatgpt-mcp-parent-ephemeral-raw-story-seal-live-acceptance-evidence.json",
  "tests/phase*/** historical acceptance fixtures and expected hashes",
  "data/canon_db/engine_snapshots/**",
  "data/canon_db/activation_logs/**",
]);

export function resolveActiveEngineDependencies(options = {}) {
  const fixtureRoot = options.dependencyRoot
    ? resolveProjectPath(options.dependencyRoot, "active engine dependency fixture root")
    : null;
  const includeExtended = options.includeExtendedDependencies ?? !fixtureRoot;
  const entityRegistryRoot = options.entityRegistryRoot
    ? resolveProjectPath(options.entityRegistryRoot, "entity registry dependency root")
    : fixtureRoot
      ? path.join(fixtureRoot, "data", "entity_registry")
      : path.join(projectRoot, "data", "entity_registry");
  const coreOverrides = new Map([
    ["engine_components", options.registryPath ?? (fixtureRoot
      ? path.join(fixtureRoot, "config", "engine-components.json")
      : engineComponentRegistryPath)],
    ["canon_zones", options.canonZoneConfigPath ?? (fixtureRoot
      ? path.join(fixtureRoot, "config", "canon-zones.json")
      : canonZoneConfigPath)],
    ["entity_registry_config", options.entityRegistryConfigPath ?? (fixtureRoot
      ? path.join(fixtureRoot, "config", "entity-registry.json")
      : path.join(projectRoot, "config", "entity-registry.json"))],
    ["entity_intake", options.entityIntakeConfigPath ?? (fixtureRoot
      ? path.join(fixtureRoot, "config", "entity-intake.json")
      : path.join(projectRoot, "config", "entity-intake.json"))],
  ]);

  return ACTIVE_ENGINE_DEPENDENCIES
    .filter((dependency) => includeExtended
      || !operationalHashConfigPaths.includes(dependency.path))
    .map((dependency) => {
      let filePath = coreOverrides.get(dependency.id);
      if (!filePath && dependency.kind === "rebuild") {
        filePath = path.join(entityRegistryRoot, path.basename(dependency.path));
      }
      if (!filePath) filePath = path.join(projectRoot, dependency.path);
      return {
        ...dependency,
        filePath: resolveProjectPath(filePath, `active engine dependency ${dependency.id}`),
      };
    });
}

export function activeEngineDependencyImpactPaths() {
  return ACTIVE_ENGINE_DEPENDENCIES.map((dependency) => dependency.path);
}

export function summarizeActiveEngineDependencyManifest(options = {}) {
  return resolveActiveEngineDependencies(options).map((dependency) => ({
    id: dependency.id,
    kind: dependency.kind,
    path: normalizeProjectPath(dependency.filePath),
  }));
}
