import {
  synchronizeActiveEngineDependencies,
} from "../server/src/active-engine-dependency-service.mjs";

try {
  const result = await synchronizeActiveEngineDependencies();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error.code ?? "active_engine_dependency_sync_failed",
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
}
