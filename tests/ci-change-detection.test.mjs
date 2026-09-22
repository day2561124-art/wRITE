import assert from "node:assert/strict";

import {
  normalizeCiProjectPath,
  parseNameStatusZ,
  requireGitSha,
} from "./ci-change-detection.mjs";

assert.equal(normalizeCiProjectPath(".\\server\\src\\x.mjs"), "server/src/x.mjs");
assert.equal(requireGitSha("A".repeat(40), "base"), "a".repeat(40));
assert.throws(() => requireGitSha("HEAD", "head"), /Invalid head SHA/u);

const parsed = parseNameStatusZ([
  "M",
  "server/src/a.mjs",
  "A",
  "tests/a.test.mjs",
  "R100",
  "server/src/old.mjs",
  "server/src/new.mjs",
  "C095",
  "tests/source.test.mjs",
  "tests/copy.test.mjs",
  "",
].join("\0"));

assert.deepEqual(parsed, [
  "server/src/a.mjs",
  "server/src/new.mjs",
  "server/src/old.mjs",
  "tests/a.test.mjs",
  "tests/copy.test.mjs",
  "tests/source.test.mjs",
]);

console.log("VA-12 CI change detection contract passed.");
