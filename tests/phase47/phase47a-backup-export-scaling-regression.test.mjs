import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createProjectBackup,
  DEFAULT_BACKUP_IO_CONCURRENCY,
} from "../../server/src/backup-export-service.mjs";
import { normalizeProjectPath, projectRoot } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase47a-backup-${process.pid}-${Date.now()}`,
);
const sourceRoot = path.join(fixtureRoot, "source", "writing_contexts");
const backupRoot = path.join(fixtureRoot, "backups");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeFixtureFiles(root, files) {
  for (const [relativePath, bytes] of files) {
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}

async function run() {
  const fixtureFiles = new Map([
    ["traditional-zh.txt", Buffer.from("繁體中文：武裝學院的日常。\n", "utf8")],
    ["multiline-trailing.txt", Buffer.from("第一行  \n第二行\t \n最後一行   ", "utf8")],
    ["windows-crlf.txt", Buffer.from("甲行\r\n乙行  \r\n尾行\r\n", "utf8")],
    ["nested/context.md", Buffer.from("# Context\n\n完整保留。\n", "utf8")],
    ["binary-like.bin", Buffer.from([0x00, 0xff, 0x10, 0x0d, 0x0a, 0x80, 0x41, 0x00])],
  ]);
  await writeFixtureFiles(sourceRoot, fixtureFiles);
  await mkdir(backupRoot, { recursive: true });

  let activeCopies = 0;
  let observedMaxCopies = 0;
  const starts = new Map();
  const completed = new Map();
  const backup = await createProjectBackup({
    createdBy: "phase47a-portable-regression",
    sourceScopes: [{ root: sourceRoot, category: "outputs" }],
    destinationRoot: backupRoot,
    ioConcurrency: 2,
    onEvent(event) {
      if (event.type === "file-copy-start") {
        activeCopies += 1;
        observedMaxCopies = Math.max(observedMaxCopies, activeCopies);
        starts.set(event.relative_path, (starts.get(event.relative_path) ?? 0) + 1);
      } else if (event.type === "file-copy-complete") {
        activeCopies -= 1;
        completed.set(event.relative_path, (completed.get(event.relative_path) ?? 0) + 1);
      }
    },
  });

  const manifest = JSON.parse(await readFile(path.join(backup.path, "manifest.json"), "utf8"));
  const expectedRelativePaths = [...fixtureFiles.keys()]
    .map((relativePath) => normalizeProjectPath(path.join(sourceRoot, relativePath)))
    .sort();
  assert.deepEqual(
    manifest.files.map((file) => file.relative_path).sort(),
    expectedRelativePaths,
    "The portable fixture was not completely represented in the backup manifest.",
  );
  assert.equal(manifest.files.length, fixtureFiles.size);
  assert.equal(backup.diagnostics.source_traversal_passes, 1);
  assert.equal(backup.diagnostics.files_discovered, fixtureFiles.size);
  assert.equal(backup.diagnostics.files_exported, fixtureFiles.size);
  assert.equal(backup.diagnostics.source_content_streams, fixtureFiles.size);
  assert.equal(backup.diagnostics.destination_hash_reads, 0);
  assert.equal(backup.diagnostics.io_concurrency_bound, 2);
  assert.ok(backup.diagnostics.max_concurrent_file_operations <= 2);
  assert.ok(observedMaxCopies <= 2);
  assert.equal(activeCopies, 0);

  for (const [relativePath, expectedBytes] of fixtureFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const normalizedSourcePath = normalizeProjectPath(sourcePath);
    const entry = manifest.files.find((file) => file.relative_path === normalizedSourcePath);
    assert.ok(entry, `Missing manifest entry for ${relativePath}.`);
    const exportedBytes = await readFile(path.join(backup.path, entry.backup_relative_path));
    assert.deepEqual(exportedBytes, expectedBytes, `Exported bytes changed for ${relativePath}.`);
    assert.equal(entry.size_bytes, expectedBytes.length, `Size changed for ${relativePath}.`);
    assert.equal(entry.sha256, sha256(expectedBytes), `SHA-256 changed for ${relativePath}.`);
    assert.equal(starts.get(normalizedSourcePath), 1, `Source stream opened more than once for ${relativePath}.`);
    assert.equal(completed.get(normalizedSourcePath), 1, `Source stream did not complete exactly once for ${relativePath}.`);
  }

  const beforeFailureEntries = (await readdir(backupRoot)).sort();
  const failureSource = path.join(fixtureRoot, "failure-source");
  const failureFiles = new Map(
    Array.from({ length: 8 }, (_, index) => [
      `${String(index).padStart(2, "0")}.bin`,
      Buffer.alloc(64 * 1024, index),
    ]),
  );
  await writeFixtureFiles(failureSource, failureFiles);
  const fileToRemove = path.join(failureSource, "07.bin");
  let injected = false;
  let failureActiveCopies = 0;
  let failureMaxCopies = 0;
  await assert.rejects(
    createProjectBackup({
      createdBy: "phase47a-portable-failure-regression",
      sourceScopes: [{ root: failureSource, category: "outputs" }],
      destinationRoot: backupRoot,
      ioConcurrency: 2,
      async onEvent(event) {
        if (event.type === "file-copy-start") {
          failureActiveCopies += 1;
          failureMaxCopies = Math.max(failureMaxCopies, failureActiveCopies);
          if (!injected) {
            injected = true;
            await rm(fileToRemove);
          }
        } else if (event.type === "file-copy-complete") {
          failureActiveCopies -= 1;
        }
      },
    }),
    /Failed to export .*07\.bin/,
    "A mid-export filesystem failure must reject the complete export.",
  );
  assert.equal(injected, true);
  assert.ok(failureMaxCopies <= 2, "Failure processing exceeded the configured I/O bound.");
  assert.deepEqual(
    (await readdir(backupRoot)).sort(),
    beforeFailureEntries,
    "A failed export left a discoverable final or staging artifact.",
  );

  assert.equal(DEFAULT_BACKUP_IO_CONCURRENCY, 4);
  console.log("Phase47A backup export scaling portable regression passed.");
}

try {
  await run();
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
