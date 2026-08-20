import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { calculateSha256Lf } from "./active-engine-hash.mjs";
import {
  ACTIVE_ENGINE_HISTORICAL_IMMUTABLE,
  resolveActiveEngineDependencies,
  summarizeActiveEngineDependencyManifest,
} from "./active-engine-dependency-manifest.mjs";
import {
  assertCanonDataComponentIntegrity,
  buildEngineComponentRegistryHashUpdate,
  getEngineComponentsStatus,
} from "./engine-component-registry.mjs";
import {
  buildCanonZonePreview,
  validateCanonZoneConfig,
} from "./canon-zone-preview-service.mjs";
import {
  buildEntityRegistryPreview,
  validateEntityRegistryConfig,
} from "./entity-registry-preview-service.mjs";
import { validateEntityIntakeConfig } from "./entity-intake-service.mjs";
import {
  buildStructuredEntityRegistry,
  validateEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { normalizeProjectPath, projectPaths, resolveProjectPath } from "./project-paths.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rawSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readOptional(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

function dependencyById(manifest, id) {
  const dependency = manifest.find((entry) => entry.id === id);
  if (!dependency) throw new Error(`Active engine dependency is missing: ${id}`);
  return dependency;
}

function updateTopLevelHashConfig(content, hash, field = "expected_engine_sha256_lf") {
  const config = JSON.parse(content.toString("utf8"));
  if (typeof config[field] !== "string" || !/^[A-F0-9]{64}$/u.test(config[field])) {
    throw new Error(`${field} is not an uppercase SHA-256 in current-engine-bound config.`);
  }
  const before = config[field];
  config[field] = hash;
  return { config, before, after: hash, content: json(config) };
}

function assertPreparedEntityRegistry(built, expectedRawHash) {
  const validationErrors = validateEntityRegistry(built.registry);
  const p0Count = built.buildReport?.conflict_counts?.P0 ?? 0;
  if (
    built.buildReport?.status !== "complete"
    || p0Count !== 0
    || validationErrors.length > 0
    || (built.buildReport?.validation_errors?.length ?? 0) > 0
  ) {
    throw new Error("Entity registry rebuild did not satisfy the complete build contract.");
  }
  if (built.provenance?.active_engine_hash !== expectedRawHash) {
    throw new Error("Entity registry provenance is stale after rebuild.");
  }
}

export async function readActiveEngineDependencyStates(options = {}) {
  const manifest = resolveActiveEngineDependencies(options);
  const entries = await Promise.all(manifest.map(async (dependency) => [
    dependency.id,
    {
      ...dependency,
      ...await readOptional(dependency.filePath),
    },
  ]));
  return { manifest, states: new Map(entries) };
}

export async function prepareActiveEngineDependencyRefresh(options = {}) {
  const activeEnginePath = resolveProjectPath(
    options.activeEnginePath ?? projectPaths.activeEngine,
    "active engine dependency source",
  );
  const activeEngineContent = await readFile(activeEnginePath);
  const activeEngineText = activeEngineContent.toString("utf8");
  const activeEngineSha256Lf = calculateSha256Lf(activeEngineContent);
  const activeEngineRawSha256 = rawSha256(activeEngineContent);
  const { manifest, states } = options.states
    ? { manifest: resolveActiveEngineDependencies(options), states: options.states }
    : await readActiveEngineDependencyStates(options);
  const contents = new Map();
  const changes = {};

  const engineComponents = dependencyById(manifest, "engine_components");
  const engineComponentsState = states.get("engine_components");
  const engineUpdate = await buildEngineComponentRegistryHashUpdate({
    registryPath: engineComponents.filePath,
    activeEnginePath,
    registryContent: engineComponentsState.content.toString("utf8"),
  });
  contents.set(engineComponents.filePath, engineUpdate.registry_content);
  changes.engine_components = {
    before: engineUpdate.expected_sha256_lf_before,
    after: engineUpdate.expected_sha256_lf_after,
  };

  const canonDependency = dependencyById(manifest, "canon_zones");
  const canonConfig = validateCanonZoneConfig(JSON.parse(
    states.get("canon_zones").content.toString("utf8"),
  ));
  const nextCanonConfig = structuredClone(canonConfig);
  nextCanonConfig.expected_sha256_lf = activeEngineSha256Lf;
  const canonPreview = await buildCanonZonePreview({
    config: nextCanonConfig,
    sourcePath: activeEnginePath,
    sourceText: activeEngineText,
  });
  if (
    options.testCanonRoundtripMismatch === true
    || canonPreview.roundtrip_matches_source !== true
    || canonPreview.roundtrip_sha256_lf !== activeEngineSha256Lf
    || canonPreview.blocking_warnings.length > 0
  ) {
    throw new Error("Canon zone roundtrip validation failed.");
  }
  contents.set(canonDependency.filePath, json(nextCanonConfig));
  changes.canon_zones = {
    before: canonConfig.expected_sha256_lf,
    after: activeEngineSha256Lf,
    anchors_valid: true,
    roundtrip_matches: true,
  };

  const entityConfigDependency = dependencyById(manifest, "entity_registry_config");
  const entityConfig = validateEntityRegistryConfig(JSON.parse(
    states.get("entity_registry_config").content.toString("utf8"),
  ));
  const nextEntityConfig = structuredClone(entityConfig);
  nextEntityConfig.expected_sha256_lf = activeEngineSha256Lf;
  contents.set(entityConfigDependency.filePath, json(nextEntityConfig));

  const intakeDependency = dependencyById(manifest, "entity_intake");
  const intakeConfig = validateEntityIntakeConfig(JSON.parse(
    states.get("entity_intake").content.toString("utf8"),
  ));
  const nextIntakeConfig = structuredClone(intakeConfig);
  nextIntakeConfig.expected_engine_sha256_lf = activeEngineSha256Lf;
  contents.set(intakeDependency.filePath, json(nextIntakeConfig));

  for (const dependency of manifest.filter((entry) => (
    entry.kind === "hash_sync"
    && !["engine_components", "entity_intake"].includes(entry.id)
  ))) {
    const updated = updateTopLevelHashConfig(
      states.get(dependency.id).content,
      activeEngineSha256Lf,
    );
    contents.set(dependency.filePath, updated.content);
    changes[dependency.id] = { before: updated.before, after: updated.after };
  }

  if (options.testEntityRegistryRebuildFailure === true) {
    throw new Error("Injected entity registry rebuild failure.");
  }
  const entityPreview = await buildEntityRegistryPreview({
    config: nextEntityConfig,
    canonZoneConfig: nextCanonConfig,
    canonPreview,
    sourcePath: activeEnginePath,
    sourceText: activeEngineText,
  });
  const built = await buildStructuredEntityRegistry({
    activeEnginePath,
    preview: entityPreview,
    canonDbPath: options.canonDbPath ?? projectPaths.canonDb,
    ...(options.medicalContinuityOptions
      ? { medicalContinuityOptions: options.medicalContinuityOptions }
      : {}),
  });
  if (options.testStaleEntityProvenance === true) {
    built.provenance.active_engine_hash = `${activeEngineRawSha256[0] === "a" ? "b" : "a"}${activeEngineRawSha256.slice(1)}`;
    built.registry.provenance.active_engine_hash = built.provenance.active_engine_hash;
  }
  assertPreparedEntityRegistry(built, activeEngineRawSha256);

  const derivedContents = {
    "entity_registry.json": built.registry,
    "entity_registry.index.json": built.index,
    "entity_registry.schema.json": built.schema,
    "entity_registry_build_report.json": built.buildReport,
    "conflict_report.json": built.conflictReport,
    "provenance.json": built.provenance,
  };
  for (const dependency of manifest.filter((entry) => entry.kind === "rebuild")) {
    contents.set(dependency.filePath, json(derivedContents[path.basename(dependency.filePath)]));
  }
  changes.entity_registry = {
    rebuilt: true,
    build_status: built.buildReport.status,
    conflict_count: built.conflictReport.conflict_count,
    provenance_matches: true,
  };
  changes.entity_intake = {
    before: intakeConfig.expected_engine_sha256_lf,
    after: activeEngineSha256Lf,
  };

  return {
    active_engine_path: normalizeProjectPath(activeEnginePath),
    active_engine_sha256_lf: activeEngineSha256Lf,
    active_engine_raw_sha256: activeEngineRawSha256,
    manifest: summarizeActiveEngineDependencyManifest(options),
    historical_immutable: [...ACTIVE_ENGINE_HISTORICAL_IMMUTABLE],
    contents,
    changes,
    canon_preview: canonPreview,
    entity_registry_build: built,
  };
}

export async function getActiveEngineDependencyStatus(options = {}) {
  const activeEnginePath = resolveProjectPath(
    options.activeEnginePath ?? projectPaths.activeEngine,
    "active engine dependency source",
  );
  const activeContent = await readFile(activeEnginePath);
  const activeHash = calculateSha256Lf(activeContent);
  const activeRawHash = rawSha256(activeContent);
  const manifest = resolveActiveEngineDependencies(options);
  const issues = [];
  const dependencies = {};

  try {
    const engineComponents = dependencyById(manifest, "engine_components");
    const status = await getEngineComponentsStatus({
      registryPath: engineComponents.filePath,
      activeEnginePath,
    });
    assertCanonDataComponentIntegrity(status);
    dependencies.engine_components = { status: "current", current: true, hash_matches: true };
  } catch (error) {
    dependencies.engine_components = { status: "stale", current: false, error: error.message };
    issues.push("engine_components:stale");
  }

  try {
    const canonDependency = dependencyById(manifest, "canon_zones");
    const canonConfig = JSON.parse(await readFile(canonDependency.filePath, "utf8"));
    const hashMatches = canonConfig.expected_sha256_lf === activeHash;
    const preview = await buildCanonZonePreview({
      config: {
        ...canonConfig,
        expected_sha256_lf: activeHash,
      },
      sourcePath: activeEnginePath,
    });
    const current = hashMatches
      && preview.roundtrip_matches_source
      && preview.roundtrip_sha256_lf === activeHash
      && preview.blocking_warnings.length === 0;
    dependencies.canon_zones = {
      status: current ? "current" : "stale",
      current,
      hash_matches: hashMatches,
      anchors_valid: true,
      coverage_valid: true,
      order_valid: true,
      roundtrip_matches: preview.roundtrip_matches_source,
    };
    if (!hashMatches) {
      issues.push("canon_zones:hash_mismatch");
    } else if (!current) {
      issues.push("canon_zones:stale");
    }
  } catch (error) {
    dependencies.canon_zones = {
      status: "invalid",
      current: false,
      hash_matches: false,
      anchors_valid: false,
      coverage_valid: false,
      order_valid: false,
      roundtrip_matches: false,
      error: error.message,
    };
    issues.push("canon_zones:invalid");
  }

  const readConfigStatus = async (id, field) => {
    try {
      const dependency = dependencyById(manifest, id);
      const config = JSON.parse(await readFile(dependency.filePath, "utf8"));
      const current = config[field] === activeHash;
      dependencies[id] = {
        status: current ? "current" : "stale",
        current,
        hash_matches: current,
      };
      if (!current) issues.push(`${id}:stale`);
    } catch (error) {
      dependencies[id] = {
        status: "invalid",
        current: false,
        hash_matches: false,
        error: error.message,
      };
      issues.push(`${id}:invalid`);
    }
  };
  await readConfigStatus("entity_registry_config", "expected_sha256_lf");
  await readConfigStatus("entity_intake", "expected_engine_sha256_lf");
  for (const dependency of manifest.filter((entry) => (
    entry.kind === "hash_sync"
    && !["engine_components", "entity_intake"].includes(entry.id)
  ))) {
    await readConfigStatus(dependency.id, "expected_engine_sha256_lf");
  }

  try {
    const derived = new Map(manifest
      .filter((entry) => entry.kind === "rebuild")
      .map((entry) => [path.basename(entry.filePath), entry.filePath]));
    const [provenance, report, registry, index, schema, conflictReport] = await Promise.all([
      readFile(derived.get("provenance.json"), "utf8").then(JSON.parse),
      readFile(derived.get("entity_registry_build_report.json"), "utf8").then(JSON.parse),
      readFile(derived.get("entity_registry.json"), "utf8").then(JSON.parse),
      readFile(derived.get("entity_registry.index.json"), "utf8").then(JSON.parse),
      readFile(derived.get("entity_registry.schema.json"), "utf8").then(JSON.parse),
      readFile(derived.get("conflict_report.json"), "utf8").then(JSON.parse),
    ]);
    const validationErrors = validateEntityRegistry(registry);
    const provenanceMatches = provenance.active_engine_hash === activeRawHash
      && registry.provenance?.active_engine_hash === activeRawHash;
    const current = provenanceMatches
      && report.status === "complete"
      && (report.conflict_counts?.P0 ?? 0) === 0
      && (report.validation_errors?.length ?? 0) === 0
      && validationErrors.length === 0
      && index.schema_version === 1
      && index.entity_count === report.entity_count
      && schema.$id === "armed-academy://schemas/entity-registry"
      && conflictReport.conflict_count === (conflictReport.conflicts?.length ?? -1);
    dependencies.entity_registry = {
      status: current ? "current" : "stale",
      current,
      build_status: report.status,
      provenance_matches: provenanceMatches,
      conflict_count: Object.values(report.conflict_counts ?? {}).reduce((sum, count) => sum + count, 0),
    };
    if (!current) issues.push("entity_registry:stale");
  } catch (error) {
    dependencies.entity_registry = { status: "invalid", current: false, error: error.message };
    issues.push("entity_registry:invalid");
  }

  const coreDependencyIds = new Set([
    "engine_components",
    "canon_zones",
    "entity_registry",
    "entity_intake",
  ]);
  const dependencyEntries = Object.entries(dependencies);
  const extendedOperationalDependencies = Object.fromEntries(
    dependencyEntries.filter(([id]) => !coreDependencyIds.has(id)),
  );
  const currentCount = dependencyEntries.filter(([, dependency]) => (
    dependency.current === true
  )).length;

  return {
    ok: issues.length === 0,
    tool_name: "get_active_engine_dependency_status",
    read_only: true,
    active_engine_path: normalizeProjectPath(activeEnginePath),
    active_engine_sha256_lf: activeHash,
    dependency_count: dependencyEntries.length,
    current_count: currentCount,
    stale_count: dependencyEntries.length - currentCount,
    dependencies,
    extended_operational_dependencies: extendedOperationalDependencies,
    issues,
  };
}

export function assertActiveEngineDependenciesCurrent(status) {
  if (status?.ok !== true || status?.issues?.length !== 0) {
    const error = new Error("Active Engine downstream dependency integrity validation failed.");
    error.code = "active_engine_dependency_validation_failed";
    error.dependencyStatus = status;
    throw error;
  }
  return status;
}

export async function synchronizeActiveEngineDependencies(options = {}) {
  let prepared;
  let status;
  const manifest = resolveActiveEngineDependencies(options);
  const transaction = await commitFileTransaction(
    "synchronize-active-engine-dependencies",
    manifest.map((dependency, index) => ({
      filePath: dependency.filePath,
      contentFactory: async () => {
        prepared ??= await prepareActiveEngineDependencyRefresh(options);
        return prepared.contents.get(dependency.filePath);
      },
      ...(index === manifest.length - 1 ? {
        afterCommit: async () => {
          status = assertActiveEngineDependenciesCurrent(
            await getActiveEngineDependencyStatus(options),
          );
        },
      } : {}),
    })),
    { phase: "active_engine_dependency_maintenance" },
  );
  return {
    ok: true,
    active_engine_dependencies_verified: true,
    active_engine_sha256_lf: prepared.active_engine_sha256_lf,
    changes: prepared.changes,
    dependency_status: status,
    transaction_id: transaction.transaction_id,
  };
}
