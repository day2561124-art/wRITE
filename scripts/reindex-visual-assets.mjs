import { reindexVisualAssets } from "../server/src/visual-reindex-service.mjs";

reindexVisualAssets()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error(`Visual asset reindex failed: ${error.message}`);
    process.exitCode = 1;
  });
