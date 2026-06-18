export function normalizeNeuralModuleKey(name) {
  try {
    const s = String(name ?? "").trim();
    return s.startsWith("run_") ? s.slice(4) : s;
  } catch {
    return String(name ?? "").trim();
  }
}

export const REQUIRED_NEURAL_MODULE_KEYS = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];
