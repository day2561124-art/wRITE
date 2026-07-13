import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  createProjectBackup,
  verifyProjectBackup,
} from "../../server/src/backup-export-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const TIMEOUT_CONTRACT_MS = 360_000;
const OWNERSHIP = "phase47a-real-scale-acceptance";

const before = new Set(
  (await readdir(projectPaths.projectBackups, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);
let backup = null;

try {
  const startedAt = performance.now();
  backup = await createProjectBackup({
    includeVisualAssets: false,
    createdBy: OWNERSHIP,
    note: "Phase47A production corpus scaling acceptance; test-owned and removed after verification.",
  });
  const elapsedMs = performance.now() - startedAt;
  const manifest = JSON.parse(await readFile(path.join(backup.path, "manifest.json"), "utf8"));
  const contextPrefix = "data/outputs/gpt_writing_contexts/";
  const contextFiles = manifest.files.filter((file) => file.relative_path.startsWith(contextPrefix));
  const contextBytes = contextFiles.reduce((sum, file) => sum + file.size_bytes, 0);
  const totalBytes = manifest.files.reduce((sum, file) => sum + file.size_bytes, 0);

  assert.ok(contextFiles.length >= 4_000, "The real-scale corpus is missing the expected writing contexts.");
  assert.ok(contextBytes >= 1_000_000_000, "The real-scale corpus is below the required production byte scale.");
  assert.ok(elapsedMs < TIMEOUT_CONTRACT_MS, `Production backup exceeded ${TIMEOUT_CONTRACT_MS} ms: ${elapsedMs} ms.`);
  assert.equal(backup.diagnostics.files_exported, manifest.files.length);
  assert.equal(backup.diagnostics.source_content_streams, manifest.files.length);
  assert.equal(backup.diagnostics.destination_hash_reads, 0);

  const verificationStartedAt = performance.now();
  const verification = await verifyProjectBackup(backup.backup_id);
  const verificationElapsedMs = performance.now() - verificationStartedAt;
  const verificationFailures = verification.results.filter((result) => result.ok !== true);
  assert.equal(verification.results.length, manifest.files.length);
  assert.deepEqual(verificationFailures, [], "Full backup verification found byte/hash failures.");

  console.log(JSON.stringify({
    status: "PASS",
    timeout_contract_ms: TIMEOUT_CONTRACT_MS,
    elapsed_ms: Math.round(elapsedMs),
    manifest_files: manifest.files.length,
    manifest_bytes: totalBytes,
    writing_context_files: contextFiles.length,
    writing_context_bytes: contextBytes,
    verification_elapsed_ms: Math.round(verificationElapsedMs),
    verification_files: verification.results.length,
    diagnostics: backup.diagnostics,
  }));
} finally {
  if (backup !== null) {
    assert.equal(before.has(backup.backup_id), false, "Acceptance backup ID unexpectedly pre-existed.");
    await rm(backup.path, { recursive: true, force: true });
  }
  const after = new Set(
    (await readdir(projectPaths.projectBackups, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  assert.deepEqual(after, before, "Phase47A real-scale acceptance changed pre-existing backup inventory.");
}
