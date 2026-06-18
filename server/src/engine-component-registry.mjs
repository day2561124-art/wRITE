import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

export const engineComponentRegistryPath = path.join(
  projectRoot,
  "config",
  "engine-components.json",
);

const componentNames = [
  "canon_data",
  "writing_method",
  "proofing_method",
  "neural_pipeline",
  "governance_policy",
];

const neuralModuleNames = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
];

const postGenerationNeuralModuleNames = [
  "run_final_polisher",
];

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function validateFileComponent(component, label, { version = false } = {}) {
  requireObject(component, label);
  requireString(component.path, `${label}.path`);
  requireBoolean(component.required, `${label}.required`);
  if (version) requireString(component.version, `${label}.version`);
}

export function validateEngineComponentRegistry(registry) {
  requireObject(registry, "engine component registry");
  if (registry.schema_version !== 1) {
    throw new Error("engine component registry schema_version must be 1.");
  }
  requireString(registry.engine_id, "engine_id");
  if (registry.design_principle !== "engine-first") {
    throw new Error("design_principle must be engine-first.");
  }

  const components = requireObject(registry.components, "components");
  for (const name of componentNames) {
    if (!Object.hasOwn(components, name)) {
      throw new Error(`components.${name} is required.`);
    }
  }

  validateFileComponent(components.canon_data, "components.canon_data");
  const expectedHash = requireString(
    components.canon_data.expected_sha256_lf,
    "components.canon_data.expected_sha256_lf",
  );
  if (!/^[A-F0-9]{64}$/.test(expectedHash)) {
    throw new Error("components.canon_data.expected_sha256_lf must be an uppercase SHA-256.");
  }

  validateFileComponent(
    components.writing_method,
    "components.writing_method",
    { version: true },
  );
  validateFileComponent(
    components.proofing_method,
    "components.proofing_method",
    { version: true },
  );
  validateFileComponent(components.neural_pipeline, "components.neural_pipeline");

  if (!Array.isArray(components.neural_pipeline.modules)) {
    throw new Error("components.neural_pipeline.modules must be an array.");
  }
  const configuredModules = components.neural_pipeline.modules.map((module, index) => {
    requireObject(module, `components.neural_pipeline.modules[${index}]`);
    const name = requireString(
      module.name,
      `components.neural_pipeline.modules[${index}].name`,
    );
    if (module.required_status !== "available") {
      throw new Error(
        `components.neural_pipeline.modules[${index}].required_status must be available.`,
      );
    }
    return name;
  });
  if (
    configuredModules.length !== neuralModuleNames.length
    || neuralModuleNames.some((name) => !configuredModules.includes(name))
  ) {
    throw new Error("components.neural_pipeline.modules must list all required neural wrappers.");
  }

  const postGenerationNeuralPipeline = requireObject(
    components.post_generation_neural_pipeline,
    "components.post_generation_neural_pipeline",
  );
  requireBoolean(
    postGenerationNeuralPipeline.required,
    "components.post_generation_neural_pipeline.required",
  );
  if (!Array.isArray(postGenerationNeuralPipeline.modules)) {
    throw new Error("components.post_generation_neural_pipeline.modules must be an array.");
  }
  const configuredPostGenerationModules = postGenerationNeuralPipeline.modules.map((module, index) => {
    requireObject(module, `components.post_generation_neural_pipeline.modules[${index}]`);
    const name = requireString(
      module.name,
      `components.post_generation_neural_pipeline.modules[${index}].name`,
    );
    if (module.required_status !== "available") {
      throw new Error(
        `components.post_generation_neural_pipeline.modules[${index}].required_status must be available.`,
      );
    }
    return name;
  });
  if (
    configuredPostGenerationModules.length !== postGenerationNeuralModuleNames.length
    || postGenerationNeuralModuleNames.some((name) => !configuredPostGenerationModules.includes(name))
  ) {
    throw new Error(
      "components.post_generation_neural_pipeline.modules must include all required post-generation neural wrappers.",
    );
  }

  validateFileComponent(
    components.governance_policy,
    "components.governance_policy",
    { version: true },
  );
  if (
    !Array.isArray(components.governance_policy.controls)
    || components.governance_policy.controls.length === 0
  ) {
    throw new Error("components.governance_policy.controls must be a non-empty array.");
  }
  components.governance_policy.controls.forEach((control, index) => {
    requireString(control, `components.governance_policy.controls[${index}]`);
  });

  return registry;
}

export async function loadEngineComponentRegistry(options = {}) {
  const registryPath = options.registryPath
    ? resolveProjectPath(options.registryPath, "engine component registry")
    : engineComponentRegistryPath;
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  return {
    registry: validateEngineComponentRegistry(registry),
    registry_path: normalizeProjectPath(registryPath),
  };
}

function sha256Lf(content) {
  const normalized = content
    .toString("utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();
}

async function fileStatus(component) {
  const filePath = resolveProjectPath(component.path, "engine component path");
  try {
    const stats = await stat(filePath);
    return {
      path: normalizeProjectPath(filePath),
      required: component.required,
      exists: stats.isFile(),
      status: stats.isFile() ? "available" : "invalid",
      bytes: stats.size,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      path: normalizeProjectPath(filePath),
      required: component.required,
      exists: false,
      status: "missing",
      bytes: 0,
    };
  }
}

export async function getEngineComponentsStatus(options = {}) {
  const { registry, registry_path: registryPath } = await loadEngineComponentRegistry(options);
  const components = registry.components;

  const canonData = await fileStatus(components.canon_data);
  if (canonData.exists) {
    canonData.expected_sha256_lf = components.canon_data.expected_sha256_lf;
    canonData.actual_sha256_lf = sha256Lf(
      await readFile(resolveProjectPath(components.canon_data.path)),
    );
    canonData.hash_matches = (
      canonData.actual_sha256_lf === canonData.expected_sha256_lf
    );
    canonData.status = canonData.hash_matches ? "available" : "hash_mismatch";
  }

  const writingMethod = {
    ...await fileStatus(components.writing_method),
    version: components.writing_method.version,
  };
  const proofingMethod = {
    ...await fileStatus(components.proofing_method),
    version: components.proofing_method.version,
  };
  const neuralPipeline = {
    ...await fileStatus(components.neural_pipeline),
  };
  neuralPipeline.modules = components.neural_pipeline.modules.map((module) => ({
    ...module,
    status: neuralPipeline.exists ? "available" : "missing",
  }));
  const postGenerationNeuralPipeline = {
    required: components.post_generation_neural_pipeline.required === true,
    status: "available",
    modules: components.post_generation_neural_pipeline.modules.map((module) => ({
      ...module,
      status: "available",
    })),
  };
  const governancePolicy = {
    ...await fileStatus(components.governance_policy),
    version: components.governance_policy.version,
    controls: [...components.governance_policy.controls],
  };

  const componentStatus = {
    canon_data: canonData,
    writing_method: writingMethod,
    proofing_method: proofingMethod,
    neural_pipeline: neuralPipeline,
    post_generation_neural_pipeline: postGenerationNeuralPipeline,
    governance_policy: governancePolicy,
  };
  const issues = Object.entries(componentStatus)
    .filter(([, component]) => component.required && component.status !== "available")
    .map(([name, component]) => `${name}:${component.status}`);

  return {
    ok: issues.length === 0,
    tool_name: "get_engine_components_status",
    read_only: true,
    engine_id: registry.engine_id,
    design_principle: registry.design_principle,
    registry_path: registryPath,
    schema_version: registry.schema_version,
    components: componentStatus,
    issues,
  };
}

