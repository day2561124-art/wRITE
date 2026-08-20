import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { projectPaths } from "../../server/src/project-paths.mjs";

const activeEngine = await readFile(projectPaths.activeEngine);

export const currentActiveEngineRawSha256 = createHash("sha256")
  .update(activeEngine)
  .digest("hex");

export const currentActiveEngineSha256Lf = createHash("sha256")
  .update(activeEngine.toString("utf8").replaceAll("\r\n", "\n").replaceAll("\r", "\n"))
  .digest("hex")
  .toUpperCase();
