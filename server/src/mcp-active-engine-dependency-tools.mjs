import {
  getActiveEngineDependencyStatus,
} from "./active-engine-dependency-service.mjs";

export async function get_active_engine_dependency_status(_input = {}, options = {}) {
  return getActiveEngineDependencyStatus(options);
}
