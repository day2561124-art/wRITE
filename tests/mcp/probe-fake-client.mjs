import { getMcpIdentity } from '../../server/src/mcp-http-identity.mjs';

export async function createProbeClient({ endpointUrl, boundedFetch }) {
  // Minimal fake client for tests. Honors optional PROBE_FAKE_CONNECT_DELAY_MS arg via env
  const transport = { sessionId: `probe-session-${Math.random().toString(36).slice(2)}` };
  const client = {
    async connect(_transport, opts = {}) {
      if (process.env.PROBE_FAKE_CONNECT_DELAY_MS) {
        await new Promise(r => setTimeout(r, Number(process.env.PROBE_FAKE_CONNECT_DELAY_MS)));
      }
      return;
    },
    getServerVersion() { return { name: 'armed-academy-fiction-engine' }; },
    async listTools() {
      const response = await boundedFetch(new URL('/tools', endpointUrl), {});
      if (response.status !== 200) throw new Error(`tools HTTP ${response.status}`);
      try { return await response.json(); } catch { return null; }
    },
    async listResources() {
      const response = await boundedFetch(new URL('/resources', endpointUrl), {});
      if (response.status !== 200) throw new Error(`resources HTTP ${response.status}`);
      try { return await response.json(); } catch { return null; }
    },
    async ping() {
      const response = await boundedFetch(new URL('/ping', endpointUrl), {});
      if (response.status !== 200) throw new Error('ping failed');
    },
    async close() {},
  };
  return { client, transport };
}
