import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function getMcpIdentity() {
  const hash = createHash('sha256');
  for (const file of ['server/src/mcp-http-server.mjs', 'server/src/mcp-http-identity.mjs',
    'server/src/mcp-http-stdio-adapter.mjs', 'server/src/mcp-server.mjs',
    'server/src/mcp-runtime-readiness.mjs', 'package-lock.json']) {
    hash.update(file).update(fs.readFileSync(path.join(repositoryRoot, file)));
  }
  return { service: 'writer-workbench-mcp',
    repositoryId: createHash('sha256').update(repositoryRoot.toLowerCase()).digest('hex'),
    revision: hash.digest('hex') };
}
