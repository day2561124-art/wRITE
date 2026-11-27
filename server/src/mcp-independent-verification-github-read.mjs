import { createHash } from "node:crypto";

// Trusted verifier transport only. The credential belongs to the separate
// read-only verifier host, not the engineering runtime or candidate runner.
// No endpoint, header, ref or authorization is accepted from an MCP call.
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const shaPattern = /^[a-f0-9]{40}$/u;
const workflowPattern = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u;
const positive = n => Number.isSafeInteger(n) && n > 0;
const fail = () => { throw new Error("GITHUB_READ_ONLY_EVIDENCE_UNAVAILABLE"); };

export function createGitHubVerificationReadClient({ repository, readCredential, fetchImpl = globalThis.fetch } = {}) {
  if (typeof repository !== "string" || !repoPattern.test(repository)
    || repository.split("/").some(p => p === "." || p === "..")
    || typeof readCredential !== "function" || typeof fetchImpl !== "function") fail();
  const base = "https://api.github.com/repos/" + repository.split("/").map(encodeURIComponent).join("/");
  async function get(path) {
    try {
      const token = await readCredential();
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,4096}$/u.test(token)) fail();
      const response = await fetchImpl(base + path, {
        method: "GET", redirect: "error", cache: "no-store",
        headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token,
          "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 200 || !response.body || response.redirected
        || Number(response.headers.get("content-length") ?? 0) > 2 * 1024 * 1024) fail();
      let count = 0;
      const chunks = [];
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          count += value.byteLength;
          if (count > 2 * 1024 * 1024) { await reader.cancel(); fail(); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { fail(); } // Never return credential, response body or URL from provider errors.
  }
  function bound(value) { if (value !== repository) fail(); }
  function sha(value) { if (typeof value !== "string" || !shaPattern.test(value)) fail(); return value; }
  async function readRun({ repository: selected, run_id } = {}) {
    bound(selected);
    if (!positive(run_id)) fail();
    return get("/actions/runs/" + run_id);
  }
  async function readJobs({ repository: selected, run_id, run_attempt } = {}) {
    bound(selected);
    if (!positive(run_id) || !positive(run_attempt)) fail();
    // The collector rejects an incomplete count; never silently truncate.
    return get("/actions/runs/" + run_id + "/attempts/" + run_attempt + "/jobs?per_page=100");
  }
  async function treeChild(treeId, name, type, modes) {
    const tree = await get("/git/trees/" + sha(treeId));
    if (tree.sha !== treeId || tree.truncated !== false || !Array.isArray(tree.tree)) fail();
    const found = tree.tree.filter(e => e.path === name);
    if (found.length !== 1 || found[0].type !== type || !modes.includes(found[0].mode)) fail();
    return sha(found[0].sha);
  }
  async function readWorkflowBytes({ repository: selected, commit, path } = {}) {
    bound(selected);
    sha(commit);
    if (typeof path !== "string" || !workflowPattern.test(path)) fail();
    // Resolve exact Git objects, not a mutable branch or Contents API's
    // symlink dereference behavior. Refuse submodules and symlinks.
    const object = await get("/git/commits/" + commit);
    if (object.sha !== commit) fail();
    const github = await treeChild(sha(object.tree?.sha), ".github", "tree", ["040000"]);
    const workflows = await treeChild(github, "workflows", "tree", ["040000"]);
    const blobId = await treeChild(workflows, path.split("/").at(-1), "blob", ["100644", "100755"]);
    const blob = await get("/git/blobs/" + blobId);
    if (blob.sha !== blobId || blob.encoding !== "base64" || typeof blob.content !== "string"
      || !Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > 256 * 1024) fail();
    const encoded = blob.content.replace(/\s/gu, "");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== blob.size || bytes.toString("base64") !== encoded) fail();
    const observed = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
    if (observed !== blobId) fail();
    return bytes;
  }
  return Object.freeze({ readRun, readJobs, readWorkflowBytes });
}
