import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildStructuredEntityRegistry,
  detectEntityRegistryConflicts,
  entityTypes,
  validateEntityRegistry,
} from "../../server/src/structured-canon-entity-registry-service.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(projectRoot, "server", "src", "ui-server.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function hashFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function hashDirectory(directory) {
  const records = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile()) {
        records.push(`${path.relative(directory, fullPath)}:${await hashFile(fullPath)}`);
      }
    }
  }
  await walk(directory);
  return createHash("sha256").update(records.join("\n")).digest("hex");
}

async function optionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child, stderr) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`UI server exited: ${stderr.value}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`UI server health timeout: ${stderr.value}`);
}

function syntheticEntity(overrides) {
  return {
    entity_id: "CH-測試-0000000001",
    entity_type: "character",
    canonical_name: "測試角色",
    aliases: [],
    status: "canon",
    source_tier: "T1 canon",
    source_file: "data/canon_db/active_engine.md",
    source_section: "測試",
    source_anchor: "L1-L1",
    source_excerpt: "正式設定",
    provenance: {},
    risk_level: "P1",
    related_chapters: [],
    related_characters: [],
    related_entities: [],
    ...overrides,
  };
}

async function main() {
  const beforeHashes = {
    activeEngine: await hashFile(projectPaths.activeEngine),
    canonDb: await hashDirectory(projectPaths.canonDb),
    compressedRules: await hashFile(projectPaths.compressedRules),
  };
  const approvalLogBefore = await optionalBuffer(projectPaths.approvalLog);
  let proposalPath = "";
  let approvalPath = "";
  let child;
  try {
    const first = await buildStructuredEntityRegistry();
    const second = await buildStructuredEntityRegistry();
    assert(
      JSON.stringify(first) === JSON.stringify(second),
      "registry build is not deterministic for unchanged sources",
    );
    assert(validateEntityRegistry(first.registry).length === 0, "registry schema validation failed");
    assert(first.buildReport.status === "complete", "registry build did not complete");
    assert(first.conflictReport.conflict_count === 0, "baseline registry has unresolved conflicts");
    assert(
      entityTypes.every((type) => Array.isArray(first.registry[type])),
      "one or more required entity buckets are missing",
    );
    for (const type of ["characters", "abilities", "weapons", "timeline_events", "world_rules"]) {
      assert(first.registry[type].length > 0, `${type} should not be empty`);
    }
    const ids = entityTypes.flatMap((type) => first.registry[type].map((item) => item.entity_id));
    assert(new Set(ids).size === ids.length, "entity IDs are not unique");

    const syntheticRegistry = Object.fromEntries(entityTypes.map((type) => [type, []]));
    syntheticRegistry.characters = [
      syntheticEntity({
        entity_id: "CH-測試角色-A-0000000001",
        grade: "一年級",
        source_excerpt: "候選設定，尚未採用",
      }),
      syntheticEntity({
        entity_id: "CH-測試角色-B-0000000002",
        grade: "二年級",
      }),
    ];
    syntheticRegistry.abilities = [
      syntheticEntity({
        entity_id: "AB-測試能力-A-0000000003",
        entity_type: "ability",
        holder_character_ids: ["CH-測試角色-A-0000000001"],
        essence: "火",
      }),
      syntheticEntity({
        entity_id: "AB-測試能力-B-0000000004",
        entity_type: "ability",
        holder_character_ids: ["CH-測試角色-A-0000000001"],
        essence: "冰",
      }),
    ];
    syntheticRegistry.timeline_events = [
      syntheticEntity({
        entity_id: "TL-測試事件-A-0000000005",
        entity_type: "timeline_event",
        timeline_position: "第一章",
        result: "甲勝出",
      }),
      syntheticEntity({
        entity_id: "TL-測試事件-B-0000000006",
        entity_type: "timeline_event",
        timeline_position: "第一章",
        result: "乙勝出",
      }),
    ];
    const conflictTypes = new Set(
      detectEntityRegistryConflicts(syntheticRegistry).map((item) => item.conflict_type),
    );
    for (const expected of [
      "candidate_mislabeled_canon",
      "possible_duplicate_entity",
      "mutually_exclusive_character_identity",
      "mutually_exclusive_ability_essence",
      "timeline_result_conflict",
    ]) {
      assert(conflictTypes.has(expected), `missing conflict detector: ${expected}`);
    }

    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const stderr = { value: "" };
    child = spawn(process.execPath, [
      serverPath,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ], {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    child.stderr.on("data", (chunk) => { stderr.value += chunk.toString(); });
    await waitForHealth(baseUrl, child, stderr);

    const summaryResponse = await fetch(`${baseUrl}/api/entity-registry`);
    const summary = await summaryResponse.json();
    assert(summaryResponse.ok && summary.ok, "registry summary API failed");
    assert(summary.registry.build_status === "complete", "summary API returned incomplete build");

    const searchResponse = await fetch(
      `${baseUrl}/api/entity-registry/entities?type=characters&status=canon&limit=2`,
    );
    const search = await searchResponse.json();
    assert(searchResponse.ok && search.entities.length > 0, "registry search API failed");
    assert(search.entities.length <= 2, "registry search ignored limit");
    const target = search.entities[0];

    const detailResponse = await fetch(
      `${baseUrl}/api/entity-registry/entities/${encodeURIComponent(target.entity_id)}`,
    );
    const detail = await detailResponse.json();
    assert(detailResponse.ok && detail.entity.entity_id === target.entity_id, "entity detail API failed");

    for (const endpoint of ["conflicts", "provenance"]) {
      const response = await fetch(`${baseUrl}/api/entity-registry/${endpoint}`);
      assert(response.ok, `${endpoint} API failed`);
    }

    const rebuildResponse = await fetch(`${baseUrl}/api/entity-registry/rebuild-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const rebuild = await rebuildResponse.json();
    assert(rebuildResponse.status === 201 && rebuild.build_report.status === "complete", "rebuild API failed");

    const unknownResponse = await fetch(`${baseUrl}/api/entity-registry/rebuild-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ write_canon: true }),
    });
    assert(unknownResponse.status === 400, "rebuild API accepted an unknown field");

    const mismatchResponse = await fetch(`${baseUrl}/api/entity-registry/propose-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_entity_id: target.entity_id,
        entity_type: "weapon",
        title: "錯誤型別",
        before: target.source_excerpt,
        after: `${target.source_excerpt}\n修改`,
        reason: "驗證型別不符",
      }),
    });
    assert(mismatchResponse.status === 400, "proposal API accepted a mismatched entity type");

    const proposalResponse = await fetch(`${baseUrl}/api/entity-registry/propose-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_entity_id: target.entity_id,
        entity_type: target.entity_type,
        title: `Phase 21 API 測試：${target.canonical_name}`,
        before: target.source_excerpt,
        after: `${target.source_excerpt}\nPhase 21 proposed change`,
        reason: "確認 entity registry 僅建立提案，不直接修改正史。",
        risk_level: "P1",
        created_by: "phase21-test",
      }),
    });
    const proposal = await proposalResponse.json();
    assert(proposalResponse.status === 201 && proposal.ok, "proposal API failed");
    assert(proposal.proposal.target_entity_id === target.entity_id, "proposal lost entity lineage");
    assert(proposal.proposal.safety.direct_apply_allowed === false, "proposal permits direct apply");
    proposalPath = path.join(
      projectPaths.settingChangeProposals,
      `${proposal.proposal.proposal_id}.json`,
    );
    approvalPath = path.join(
      projectPaths.approvalItems,
      proposal.approval_item.approval_item_id,
    );
    assert((await stat(proposalPath)).isFile(), "proposal artifact was not persisted");

    const traversalResponse = await fetch(
      `${baseUrl}/api/entity-registry/entities/${encodeURIComponent("../active_engine.md")}`,
    );
    assert(!traversalResponse.ok, "entity detail API accepted path traversal");

    const oversizedResponse = await fetch(`${baseUrl}/api/entity-registry/rebuild-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(2_100_000) }),
    });
    assert(!oversizedResponse.ok, "registry API accepted an oversized body");

    const html = await readFile(path.join(__dirname, "..", "..", "server", "ui", "index.html"), "utf8");
    const app = await readFile(path.join(__dirname, "..", "..", "server", "ui", "app.js"), "utf8");
    assert(html.includes("character-entity-search"), "character registry search UI is missing");
    assert(html.includes("world-rule-category-filter"), "world rule category filter is missing");
    assert(app.includes("/api/entity-registry/propose-change"), "UI does not use registry proposal API");
    assert(!app.includes("直接套用正史"), "UI contains a direct canon apply action");

    const afterHashes = {
      activeEngine: await hashFile(projectPaths.activeEngine),
      canonDb: await hashDirectory(projectPaths.canonDb),
      compressedRules: await hashFile(projectPaths.compressedRules),
    };
    assert(afterHashes.activeEngine === beforeHashes.activeEngine, "active_engine was modified");
    assert(afterHashes.canonDb === beforeHashes.canonDb, "Canon DB was modified");
    assert(afterHashes.compressedRules === beforeHashes.compressedRules, "compressed_rules was modified");
    console.log("Phase 21 entity registry contract tests passed.");
  } finally {
    if (child) terminateProcessTree(child);
    if (proposalPath) await rm(proposalPath, { force: true });
    if (approvalPath) await rm(approvalPath, { recursive: true, force: true });
    if (approvalLogBefore.exists) {
      await mkdir(path.dirname(projectPaths.approvalLog), { recursive: true });
      await writeFile(projectPaths.approvalLog, approvalLogBefore.content);
    } else {
      await rm(projectPaths.approvalLog, { force: true });
    }
  }
}

main().catch((error) => {
  console.error(`Phase 21 entity registry contract tests failed: ${error.message}`);
  process.exitCode = 1;
});
