import path from "node:path";
import { updateVisualMetadataFromFile } from "../server/src/visual-metadata-service.mjs";

const mappingPath = process.argv[2];
if (!mappingPath) {
  console.error("Usage: node scripts/update-visual-metadata.mjs <mapping.json>");
  process.exitCode = 1;
} else {
  updateVisualMetadataFromFile(path.resolve(mappingPath))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`Visual metadata update failed: ${error.message}`);
      process.exitCode = 1;
    });
}
