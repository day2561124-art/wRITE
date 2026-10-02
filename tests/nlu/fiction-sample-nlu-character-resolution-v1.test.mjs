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
const resolver = path.join(rootDir, "scripts", "fiction-sample-nlu-character-resolve-v1.py");
const configPath = path.join(rootDir, "config", "fiction-nlu-character-resolution-v1.json");
const schemaPath = path.join(rootDir, "schemas", "fiction-nlu-character-resolution-v1.schema.json");

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
      reject(new Error("NLU-2 test timed out"));
    }, 30_000);
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
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu2-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const texts = [
    "安達走進教室。她把書放在桌上。",
    "安達看向窗外。她沒有立刻說話。",
    "島村推門進來。她對安達揮了揮手。",
    "我站在門邊，看著安達和島村聊天。",
    "安達先離開了。她說明天見。",
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
    title: "fixture",
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

test("NLU-2 config and schema encode conservative anchored entity policy", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_character_resolution_v1");
  assert.equal(config.merge_policy.automatic_fuzzy_name_merge, false);
  assert.equal(config.merge_policy.automatic_pronoun_entity_creation, false);
  assert.equal(schema.properties.assertion_scope.const, "novel_local_character_identity_provisional");
  assert.ok(schema.properties.entities.items.required.includes("anchor_mention_ids"));
});

test("heuristic fixture creates deterministic anchored entities and stable cross-window identity", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "analysis.jsonl");
  const checkpoint = path.join(fixture.temp, "checkpoint.json");
  const cache = path.join(fixture.temp, "cache");
  try {
    const { stdout } = await runPython([
      resolver, "resolve",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
      "--seed-name", "安達",
      "--seed-name", "島村",
      "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "character_resolution");
    assert.equal(record.analysis_version, "character_resolution_v1");
    assert.equal(record.status, "provisional");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.consistency.valid, true);

    const adachi = record.payload.entities.find((e) => e.canonical_name === "安達");
    const shimamura = record.payload.entities.find((e) => e.canonical_name === "島村");
    assert.ok(adachi);
    assert.ok(shimamura);
    assert.ok(adachi.anchor_mention_ids.length >= 3);
    assert.equal(new Set(record.payload.entities.map((e) => e.entity_id)).size, record.payload.entities.length);

    const firstPerson = record.payload.mentions.filter((m) => m.surface === "我");
    assert.ok(firstPerson.length >= 1);
    assert.ok(firstPerson.every((m) => m.entity_id === null && m.link_state === "unresolved"));

    const linkedThirdPerson = record.payload.mentions.filter(
      (m) => m.surface === "她" && m.link_state === "linked",
    );
    assert.ok(linkedThirdPerson.length >= 2);

    const validation = await runPython([
      resolver, "validate",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython([
      resolver, "resolve",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
      "--seed-name", "安達",
      "--seed-name", "島村",
      "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
    ]);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("alias merge derivation records canonical and absorbed proper-anchor evidence", async () => {
  const pythonCode = [
    "import json,runpy",
    "from pathlib import Path",
    "m=runpy.run_path(r'" + resolver.replaceAll("\\", "\\\\") + "')",
    "c=json.loads(Path(r'" + configPath.replaceAll("\\", "\\\\") + "').read_text(encoding='utf-8'))",
    "novel_id='NOV-AAAAAAAAAAAAAAAA'",
    "cn=m['normalize_name']('安達櫻',c)",
    "an=m['normalize_name']('安達',c)",
    "eid=m['stable_id']('CHR',{'novel_id':novel_id,'normalized_name':cn})",
    "m1=m['stable_id']('MEN',{'x':1})",
    "m2=m['stable_id']('MEN',{'x':2})",
    "mentions=[{'mention_id':m1,'surface':'安達櫻','mention_type':'proper','entity_id':eid,'confidence':0.99},{'mention_id':m2,'surface':'安達','mention_type':'proper','entity_id':eid,'confidence':0.95}]",
    "entities={eid:{'entity_id':eid,'canonical_name':'安達櫻','normalized_name':cn,'aliases':['安達','安達櫻'],'anchor_mention_ids':[m1,m2],'mention_ids':[m1,m2],'confidence':0.99,'state':'anchored'}}",
    "events=m['derive_merge_events'](novel_id,entities,mentions,c)",
    "print(json.dumps(events,ensure_ascii=False))",
  ].join(";");

  const { stdout } = await runPython(["-c", pythonCode]);
  const events = JSON.parse(stdout.trim());
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, "provider_observed_alias");
  assert.equal(events[0].evidence_mention_ids.length, 2);
  assert.match(events[0].absorbed_entity_id, /^CHR-[A-F0-9]{16}$/u);
  assert.match(events[0].merge_id, /^MRG-[A-F0-9]{16}$/u);
});

test("validator rejects merge event without absorbed alias anchor evidence", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "analysis.jsonl");
  const tampered = path.join(fixture.temp, "tampered-merge.jsonl");
  try {
    await runPython([
      resolver, "resolve",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--output", output,
      "--provider", "heuristic",
      "--seed-name", "安達",
      "--seed-name", "島村",
      "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const entity = record.payload.entities.find((item) => item.canonical_name === "安達");
    assert.ok(entity);
    const evidence = entity.anchor_mention_ids.slice(0, 2);
    assert.ok(evidence.length >= 2);
    record.payload.merge_events.push({
      merge_id: "MRG-1111111111111111",
      canonical_entity_id: entity.entity_id,
      absorbed_entity_id: "CHR-FFFFFFFFFFFFFFFF",
      reason: "provider_observed_alias",
      confidence: 0.99,
      evidence_mention_ids: evidence,
    });
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      resolver, "validate",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /missing absorbed alias proper-anchor evidence/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects tampered mention evidence span", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "analysis.jsonl");
  const tampered = path.join(fixture.temp, "tampered.jsonl");
  try {
    await runPython([
      resolver, "resolve",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--output", output,
      "--provider", "heuristic",
      "--seed-name", "安達",
      "--seed-name", "島村",
      "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.ok(record.payload.mentions.length > 0);
    record.payload.mentions[0].passage_span.start += 1;
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      resolver, "validate",
      "--db-root", fixture.temp,
      "--config", configPath,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /surface\/span mismatch|quote hash mismatch|novel span mismatch/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
