import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function filesUnder(root) {
  try {
    if ((await stat(root)).isFile()) return [root];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await visit(root);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

export async function recursiveContentFingerprint(root) {
  const hash = createHash("sha256");
  const files = await filesUnder(root);
  let bytes = 0;
  for (const filePath of files) {
    const content = await readFile(filePath);
    const relativePath = path.relative(root, filePath).split(path.sep).join("/") || path.basename(filePath);
    hash.update(Buffer.from(`${relativePath}\0${content.length}\0`, "utf8"));
    hash.update(content);
    hash.update(Buffer.from("\n", "utf8"));
    bytes += content.length;
  }
  return { sha256: hash.digest("hex"), file_count: files.length, logical_bytes: bytes };
}

export async function fingerprintRoots(roots) {
  return Object.fromEntries(await Promise.all(
    Object.entries(roots).map(async ([name, root]) => [name, await recursiveContentFingerprint(root)]),
  ));
}
