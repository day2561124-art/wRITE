import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Command timed out: node ${args.join(" ")}`));
    }, 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(new Error(`Command failed (${code}): node ${args.join(" ")}\n${output}`));
    });
  });
}

async function loadFixtures() {
  const names = (await readdir(__dirname))
    .filter((name) => /^golden\d+\.jsonl$/.test(name))
    .sort();
  const fixtures = [];
  for (const name of names) {
    const text = await readFile(path.join(__dirname, name), "utf8");
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      try {
        fixtures.push(JSON.parse(line));
      } catch (error) {
        throw new Error(`${name}:${index + 1} is not valid JSON: ${error.message}`);
      }
    }
  }
  return fixtures;
}

function assertFragments(fixture, text) {
  for (const fragment of fixture.required_fragments ?? []) {
    assert(
      text.includes(fragment),
      `${fixture.id} missing required fragment: ${JSON.stringify(fragment)}`,
    );
  }
  for (const fragment of fixture.forbidden_fragments ?? []) {
    assert(
      !text.includes(fragment),
      `${fixture.id} contained forbidden fragment: ${JSON.stringify(fragment)}`,
    );
  }
}

async function runFixture(fixture, tempDir) {
  assert(typeof fixture.id === "string" && fixture.id, "Golden fixture is missing id.");
  assert(typeof fixture.kind === "string" && fixture.kind, `${fixture.id} is missing kind.`);

  if (fixture.kind === "retrieval") {
    assert(typeof fixture.query === "string" && fixture.query.trim(), `${fixture.id} is missing query.`);
    const outputPath = path.join(tempDir, `${fixture.id}.md`);
    const output = await runNode([
      "server/src/tools/search-context.mjs",
      fixture.query,
      "--top",
      String(fixture.top ?? 12),
      "--output",
      outputPath,
    ]);
    assert(output.includes("Wrote"), `${fixture.id} retrieval did not report an output.`);
    assertFragments(fixture, await readFile(outputPath, "utf8"));
    return;
  }

  if (fixture.kind === "file_contains") {
    assert(Array.isArray(fixture.files) && fixture.files.length > 0, `${fixture.id} is missing files.`);
    const texts = await Promise.all(
      fixture.files.map((file) => readFile(path.join(rootDir, file), "utf8")),
    );
    assertFragments(fixture, texts.join("\n"));
    return;
  }

  if (fixture.kind === "files_equal") {
    assert(
      Array.isArray(fixture.files) && fixture.files.length > 1,
      `${fixture.id} requires at least two files.`,
    );
    const texts = await Promise.all(
      fixture.files.map((file) => readFile(path.join(rootDir, file), "utf8")),
    );
    for (let index = 1; index < texts.length; index += 1) {
      assert(
        texts[index] === texts[0],
        `${fixture.id} file content drifted: ${fixture.files[0]} != ${fixture.files[index]}`,
      );
    }
    assertFragments(fixture, texts[0]);
    return;
  }

  if (fixture.kind === "json_codeblocks") {
    const output = await runNode(["server/src/tools/validate-json-codeblocks.mjs"]);
    assertFragments(fixture, output);
    return;
  }

  throw new Error(`${fixture.id} has unsupported kind: ${fixture.kind}`);
}

async function main() {
  const fixtures = await loadFixtures();
  assert(fixtures.length === 6, `Expected 6 golden fixtures, found ${fixtures.length}.`);
  const ids = new Set(fixtures.map((fixture) => fixture.id));
  assert(ids.size === fixtures.length, "Golden fixture ids must be unique.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "armed-academy-golden-"));
  try {
    for (const fixture of fixtures) {
      await runFixture(fixture, tempDir);
      console.log(`PASS ${fixture.id}: ${fixture.desc}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log(`Golden tests passed: ${fixtures.length}`);
}

main().catch((error) => {
  console.error(`Golden tests failed: ${error.message}`);
  process.exitCode = 1;
});
