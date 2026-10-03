import { findPackageJSON } from "node:module";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function loadCodemodeSandbox() {
  const agent = findPackageJSON("@earendil-works/pi-coding-agent", new URL("./package.json", import.meta.url));
  const pkg = findPackageJSON("@earendil-works/pi-codemode", pathToFileURL(agent));
  const manifest = JSON.parse(await readFile(pkg, "utf8"));
  const entry = manifest.exports?.["."] ?? manifest.main;
  const esm = typeof entry === "string" ? entry : entry?.import ?? entry?.default;
  if (typeof esm !== "string") throw new Error("codemode_export_unavailable");
  const { CodemodeSandbox } = await import(new URL(esm, pathToFileURL(pkg)));
  return CodemodeSandbox;
}
