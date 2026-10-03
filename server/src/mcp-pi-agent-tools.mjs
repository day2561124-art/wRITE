import { getPiRuntimeStatus } from "./pi-agent-execution-service.mjs";

export async function dev_pi_runtime_status() {
  return getPiRuntimeStatus();
}
