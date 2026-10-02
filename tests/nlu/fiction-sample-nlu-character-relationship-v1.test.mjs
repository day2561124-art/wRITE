import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const nlu2Script = path.join(rootDir, "scripts", "fiction-sample-nlu-character-resolve-v1.py");
const nlu2Config = path.join(rootDir, "config", "fiction-nlu-character-resolution-v1.json");
const nlu3Script = path.join(rootDir, "scripts", "fiction-sample-nlu-relationship-extract-v1.py");
const nlu3Config = path.join(rootDir, "config", "fiction-nlu-character-relationship-v1.json");
const nlu3Schema = path.join(rootDir, "schemas", "fiction-nlu-character-relationship-v1.schema.json");

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function runPython(args, { expectCode = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const python = process.platform === "win32" ? "python" : "python3";
    const child = spawn(python, args, {
      cwd: rootDir,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("NLU-3 test timed out"));
    }, 45_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === expectCode) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error("python exited " + code + ", expected " + expectCode + "\n" + stdout + "\n" + stderr));
      }
    });
  });
}

async function buildFixture() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu3-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const texts = [
    "安達和島村是同班同學，也是朋友。",
    "安達喜歡島村。",
    "安達幫忙替島村整理書包。",
    "島村安慰安達，告訴她別擔心。",
  ];
  let cursor = 0;
  const passages = texts.map((text, index) => {
    const row = {
      passage_id: "PAS-" + String(index + 1).repeat(16),
      scene_id: "SCN-" + String(index + 1).repeat(16),
      novel_id: "NOV-AAAAAAAAAAAAAAAA",
      source_id: "SRC-BBBBBBBBBBBBBBBB",
      source_order: index + 1,
      char_start: cursor,
      char_end: cursor + text.length,
      text,
      content_sha256: sha256(text),
      status: "accepted",
    };
    cursor = row.char_end + 1;
    return row;
  });
  const scenes = passages.map((p) => ({
    scene_id: p.scene_id,
    novel_id: p.novel_id,
    source_order: p.source_order,
    char_start: p.char_start,
    char_end: p.char_end,
    scene_hash: p.content_sha256,
  }));
  const novel = {
    novel_id: "NOV-AAAAAAAAAAAAAAAA",
    source_id: "SRC-BBBBBBBBBBBBBBBB",
    author_id: "AUT-CCCCCCCCCCCCCCCC",
    title: "fixture relationship novel",
    language: "zh-Hant",
    text: {
      char_count: cursor,
      text_sha256: sha256(texts.join("\n")),
    },
  };

  await writeFile(path.join(records, "passages_v1.jsonl"), passages.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), scenes.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");
  return { temp, passages };
}

async function createCharacterResolution(fixture) {
  const output = path.join(fixture.temp, "character-resolution.jsonl");
  await runPython([
    nlu2Script, "resolve",
    "--db-root", fixture.temp,
    "--config", nlu2Config,
    "--output", output,
    "--provider", "heuristic",
    "--seed-name", "安達",
    "--seed-name", "島村",
    "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
  ]);
  return output;
}

test("NLU-3 config encodes local assertions and directional/symmetric relation semantics", async () => {
  const config = JSON.parse(await readFile(nlu3Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu3Schema, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_character_relationship_v1");
  assert.equal(config.assertion_scope, "evidence_window_relationship_assertion_not_global_truth");
  assert.equal(config.relation_groups.social_role.relations["social.friend_of"].directionality, "symmetric");
  assert.equal(config.relation_groups.affective_stance.relations["affect.affection_for"].directionality, "directed");
  assert.equal(schema.properties.scope.properties.complete_relationship_claim.const, false);
});

test("NLU-3 consumes validated NLU-2 entities and preserves directed versus symmetric assertions", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "relationships.jsonl");
  const checkpoint = path.join(fixture.temp, "relationship-checkpoint.json");
  const cache = path.join(fixture.temp, "relationship-cache");
  try {
    const characterResolution = await createCharacterResolution(fixture);
    const { stdout } = await runPython([
      nlu3Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.pair_windows >= 1);
    assert.ok(summary.assertions >= 3);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "relationship");
    assert.equal(record.analysis_version, "character_relationship_v1");
    assert.equal(record.status, "provisional");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.scope.complete_relationship_claim, false);
    assert.equal(record.payload.consistency.valid, true);

    const characterRecord = JSON.parse((await readFile(characterResolution, "utf8")).trim());
    const adachi = characterRecord.payload.entities.find((e) => e.canonical_name === "安達");
    const shimamura = characterRecord.payload.entities.find((e) => e.canonical_name === "島村");
    assert.ok(adachi && shimamura);

    const friend = record.payload.assertions.find((a) => a.relation_id === "social.friend_of");
    const classmate = record.payload.assertions.find((a) => a.relation_id === "social.classmate_of");
    const affection = record.payload.assertions.find(
      (a) =>
        a.relation_id === "affect.affection_for" &&
        a.source_entity_id === adachi.entity_id &&
        a.target_entity_id === shimamura.entity_id,
    );
    const helps = record.payload.assertions.find(
      (a) =>
        a.relation_id === "behavior.helps" &&
        a.source_entity_id === adachi.entity_id &&
        a.target_entity_id === shimamura.entity_id,
    );

    assert.ok(friend);
    assert.ok(classmate);
    assert.ok(affection);
    assert.ok(helps);
    assert.equal(friend.directionality, "symmetric");
    assert.ok(friend.source_entity_id < friend.target_entity_id);
    assert.equal(affection.directionality, "directed");

    const reverseAffection = record.payload.assertions.find(
      (a) =>
        a.relation_id === "affect.affection_for" &&
        a.source_entity_id === shimamura.entity_id &&
        a.target_entity_id === adachi.entity_id,
    );
    assert.equal(reverseAffection, undefined);

    for (const assertion of record.payload.assertions) {
      assert.ok(assertion.evidence.length >= 1);
      assert.equal(assertion.local_scope.scope_semantics, "evidence_window_not_relation_lifetime");
    }

    const validation = await runPython([
      nlu3Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython([
      nlu3Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
    ]);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("zero positive assertions still preserve canonical analysis-level evidence without inventing a relationship", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "relationships-zero.jsonl");
  try {
    const characterResolution = await createCharacterResolution(fixture);
    const characterRecord = JSON.parse((await readFile(characterResolution, "utf8")).trim());

    // Remove all lexical relation cues from canonical Passage text while preserving both anchored entities.
    const passagePath = path.join(fixture.temp, "records", "passages_v1.jsonl");
    const neutralTexts = [
      "安達看著島村，兩人都沒有說話。",
      "安達和島村一起走過走廊。",
      "安達與島村坐在窗邊。",
      "島村看向安達，隨後移開視線。",
    ];
    const originalRows = (await readFile(passagePath, "utf8")).trim().split(/\r?\n/u).map(JSON.parse);
    let cursor = 0;
    const neutralRows = originalRows.map((row, index) => {
      const text = neutralTexts[index];
      const updated = {
        ...row,
        text,
        char_start: cursor,
        char_end: cursor + text.length,
        content_sha256: sha256(text),
      };
      cursor = updated.char_end + 1;
      return updated;
    });
    await writeFile(passagePath, neutralRows.map(JSON.stringify).join("\n") + "\n", "utf8");

    // Regenerate NLU-2 so its deterministic lineage matches the neutral canonical text.
    await rm(characterResolution, { force: true });
    await runPython([
      nlu2Script, "resolve",
      "--db-root", fixture.temp,
      "--config", nlu2Config,
      "--output", characterResolution,
      "--provider", "heuristic",
      "--seed-name", "安達",
      "--seed-name", "島村",
      "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
    ]);

    const { stdout } = await runPython([
      nlu3Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--output", output,
      "--provider", "heuristic",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.assertions, 0);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.payload.assertions.length, 0);
    assert.ok(record.evidence.length >= 1);
    assert.equal(record.evidence[0].novel_id, "NOV-AAAAAAAAAAAAAAAA");
    assert.equal(record.retrieval_admission.state, "not_admitted");

    const validation = await runPython([
      nlu3Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    // Keep this variable referenced so the test also proves the dependency was a real NLU-2 record.
    assert.equal(characterRecord.analysis_kind, "character_resolution");
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects assertion evidence that no longer covers both relationship entities", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "relationships.jsonl");
  const tampered = path.join(fixture.temp, "relationships-tampered.jsonl");
  try {
    const characterResolution = await createCharacterResolution(fixture);
    await runPython([
      nlu3Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--output", output,
      "--provider", "heuristic",
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const assertion = record.payload.assertions.find((a) => a.evidence.length > 0);
    assert.ok(assertion);
    const characterRecord = JSON.parse((await readFile(characterResolution, "utf8")).trim());
    const sourceMention = characterRecord.payload.mentions.find(
      (m) => m.entity_id === assertion.source_entity_id && m.passage_id === assertion.evidence[0].passage_id,
    );
    assert.ok(sourceMention);
    assertion.evidence[0].supporting_mention_ids = [sourceMention.mention_id];
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu3Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /evidence does not cover both entities/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects relationship payload if NLU-2 entity registry lineage changes", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "relationships.jsonl");
  const tamperedCharacters = path.join(fixture.temp, "characters-tampered.jsonl");
  try {
    const characterResolution = await createCharacterResolution(fixture);
    await runPython([
      nlu3Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", characterResolution,
      "--output", output,
      "--provider", "heuristic",
    ]);
    const characterRecord = JSON.parse((await readFile(characterResolution, "utf8")).trim());
    characterRecord.payload.entities[0].aliases.push("不存在的別名");
    await writeFile(tamperedCharacters, JSON.stringify(characterRecord) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu3Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu3Config,
      "--character-resolution", tamperedCharacters,
      "--input", output,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.ok(
      /analysis_id must be deterministic|entity registry hash mismatch/u.test(report.errors[0].error),
      report.errors[0].error,
    );
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
