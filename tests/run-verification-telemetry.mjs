import { readFile } from "node:fs/promises";
import { aggregateVerificationTelemetry } from "./verification-telemetry.mjs";

async function main() {
  const manifests = [], audits = [], cacheReceipts = [];
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const filePath = process.argv[index + 1];
    if (!["--manifest", "--audit", "--cache-receipt"].includes(flag) || !filePath) {
      throw new Error("Usage: node tests/run-verification-telemetry.mjs [--manifest file.json] [--audit file.json] [--cache-receipt file.json]...");
    }
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    if (flag === "--manifest") {
      // dev_run_tests.last.json carries its immutable VA-6 evidence nested.
      manifests.push(parsed.verification_manifest ?? parsed);
    } else if (flag === "--audit") audits.push(parsed);
    else cacheReceipts.push(parsed);
  }
  console.log(JSON.stringify(aggregateVerificationTelemetry({ manifests, audits, cacheReceipts }), null, 2));
}
main().catch((error) => {
  console.error("Verification telemetry failed: " + error.message);
  process.exitCode = 1;
});
