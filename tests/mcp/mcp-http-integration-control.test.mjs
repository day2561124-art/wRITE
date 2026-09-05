import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createParentIntegrationControl, integrationToolDefinition } from '../../server/src/mcp-http-integration-control.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Before Phase 2D lands, acceptance runs against its unchanged isolated source.
const sourceRoot = process.env.PHASE2D_TEST_SOURCE_ROOT || root;
const runtimeUrl = pathToFileURL(path.join(sourceRoot, 'server/src/mcp-development-integration-tools.mjs'));
const runtimeAvailable = await access(runtimeUrl).then(() => true, () => false);
const name = 'dev_workspace_integrate';
const args = { integration_candidate_id: 'dev_integration_20260902-120000_123456789abc', expected_revision: 6 };
const message = (input = args, tool = name) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: input } });
const directAudit = async (integrate, input) => ({ content: [{ type: 'text', text: JSON.stringify(await integrate(input)) }] });

test('public profile never loads, lists, or invokes parent integration', async () => {
  let loads = 0;
  const control = createParentIntegrationControl({ profile: 'chatgpt_public', loadRuntime: async () => { loads++; throw new Error('must not load'); } });
  await control.prepare();
  assert.deepEqual(control.decorate({ result: { tools: [] } }), { result: { tools: [] } });
  assert.match((await control.call(message())).error.message, /Tool not allowed.*chatgpt_public/);
  assert.equal(loads, 0);
});

test('only the fixed high-risk route survives; no arbitrary arguments or generic dispatch', async () => {
  let calls = 0, loads = 0;
  const control = createParentIntegrationControl({
    profile: 'chatgpt_developer',
    loadRuntime: async () => { loads++; return { dev_workspace_integrate: async (input) => { calls++; assert.deepEqual(input, args); return { state: 'integrated' }; } }; },
    audit: directAudit,
  });
  await Promise.all([control.prepare(), control.prepare()]);
  assert.equal(loads, 1);
  const listed = control.decorate({ result: { tools: [{ name }, { name: 'dev_read_file' }] } }).result.tools;
  assert.equal(listed.filter((tool) => tool.name === name).length, 1);
  assert.deepEqual(listed.find((tool) => tool.name === name), integrationToolDefinition);
  assert.equal(integrationToolDefinition._meta['armed-academy/permission'].requires_user_confirmation, true);
  assert.equal(integrationToolDefinition._meta['armed-academy/permission'].permission_level, 'write_high_risk');
  for (const extra of ['tool', 'ref', 'commit', 'argv', 'cwd', 'env', 'force', 'strategy']) {
    assert.equal((await control.call(message({ ...args, [extra]: 'forbidden' }))).result.isError, true);
  }
  for (const invalid of [null, [], {}, { integration_candidate_id: args.integration_candidate_id }, { ...args, expected_revision: 0 }, { ...args, expected_revision: 1.5 }, { ...args, integration_candidate_id: '../escape' }]) {
    assert.equal((await control.call(message(invalid))).result.isError, true);
  }
  await assert.rejects(control.call(message(args, 'dev_git_arbitrary')), /only dev_workspace_integrate/);
  assert.equal(calls, 0);
  assert.equal(await control.call({ ...message(), id: undefined }), null);
  await control.call(message());
  assert.equal(calls, 1);
});

test('runtime absence retries at reload; captured function survives removal', async () => {
  let present = false, loads = 0;
  const control = createParentIntegrationControl({
    profile: 'chatgpt_developer',
    loadRuntime: async () => { loads++; return present ? { dev_workspace_integrate: async () => ({ state: 'ready' }) } : null; },
    audit: directAudit,
  });
  await control.prepare();
  assert.deepEqual(control.decorate({ result: { tools: [] } }).result.tools, []);
  present = true;
  await control.prepare();
  present = false;
  await control.prepare();
  assert.equal(loads, 2);
  assert.equal((await control.call(message())).result.isError, undefined);
});

test('broken or unavailable runtime and failed audit fail closed', async () => {
  for (const loadRuntime of [async () => ({}), async () => null, async () => { throw new Error('broken module'); }]) {
    const control = createParentIntegrationControl({ profile: 'chatgpt_developer', loadRuntime });
    assert.equal((await control.call(message())).result.isError, true);
  }
  let invoked = false;
  const control = createParentIntegrationControl({
    profile: 'chatgpt_developer',
    loadRuntime: async () => ({ dev_workspace_integrate: async () => { invoked = true; } }),
    audit: async () => { throw new Error('audit unavailable'); },
  });
  assert.equal((await control.call(message())).result.isError, true);
  assert.equal(invoked, false);
});

// Fixed fixture-only Git operations: every cwd below belongs to a new temporary
// repository. Never run shell Git or alter the shared repository.
async function git(cwd, argv, input) {
  const child = execFile(process.platform === 'win32' ? 'git.exe' : 'git', ['-c', 'core.autocrlf=false', '-c', 'core.hooksPath=', ...argv], {
    cwd, windowsHide: true, shell: false, encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (input !== undefined) child.stdin.end(input);
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
  });
}

function childCode(bootstrap) {
  return [
    "import readline from 'node:readline';",
    bootstrap ? "import { service } from './mcp-development-integration-tools.mjs';" : '',
    bootstrap ? 'const routes = { dev_workspace_integration_preflight: service.preflight, dev_workspace_validate_integration: service.validateIntegration, dev_workspace_get_integration_candidate: service.getCandidate };' : 'const routes = {};',
    "for await (const line of readline.createInterface({ input: process.stdin })) {",
    "const m = JSON.parse(line); if (m.id === undefined) continue;",
    "try { let result;",
    "if (m.method === 'initialize') result = { protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } };",
    "else if (m.method === 'tools/list') result = { tools: process.env.MCP_TOOL_PROFILE === 'chatgpt_developer' ? " + (bootstrap ? "[...Object.keys(routes), 'dev_workspace_integrate']" : '[]') + ".map(name => ({ name, inputSchema: { type: 'object' } })) : [] };",
    "else { if (process.env.MCP_TOOL_PROFILE !== 'chatgpt_developer' || !routes[m.params.name]) throw new Error('Tool not allowed by MCP tool profile ' + process.env.MCP_TOOL_PROFILE + ': ' + m.params.name);",
    "result = { content: [{ type: 'text', text: JSON.stringify(await routes[m.params.name](m.params.arguments)) }] }; }",
    "console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }));",
    "} catch (e) { console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32602, message: e.message } })); }",
    "}",
  ].join('\n');
}

async function startParent(repo, profile) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(process.execPath, ['server/src/mcp-http-server.mjs', '--port', String(port)], {
    cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOL_PROFILE: profile },
  });
  let logs = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTP fixture start timeout: ' + logs)), 15000);
    child.stderr.on('data', (chunk) => {
      logs += chunk;
      if (logs.includes('MCP Streamable HTTP Server listening')) { clearTimeout(timer); resolve(); }
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
  });
  const client = new Client({ name: 'integration-lifecycle-regression', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + port + '/mcp')));
  return {
    client,
    async stop() {
      await client.close();
      if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    },
  };
}

async function fixture() {
  const tempParent = path.join(root, 'tests', '.tmp');
  await mkdir(tempParent, { recursive: true });
  const temp = await mkdtemp(path.join(tempParent, 'integration-control-'));
  let parent;
  try {
  const repo = path.join(temp, 'repo'), src = path.join(repo, 'server', 'src'), runtime = path.join(temp, 'runtime');
  await mkdir(src, { recursive: true });
  await mkdir(runtime);
  for (const file of [
    'mcp-http-server.mjs', 'mcp-http-integration-control.mjs', 'mcp-http-stdio-adapter.mjs',
    'mcp-workspace-snapshot-authority.mjs', 'mcp-workspace-snapshot-authority-ipc.mjs',
    'world-simulation-prepared-turn-ephemeral-broker.mjs', 'world-simulation-prepared-turn-broker-ipc.mjs',
    'canonical-json-hash-service.mjs', 'process-control.mjs', 'file-transactions.mjs', 'project-paths.mjs',
  ]) await copyFile(path.join(root, 'server', 'src', file), path.join(src, file));
  await writeFile(path.join(repo, '.gitignore'), 'data/outputs/\n');
  await writeFile(path.join(repo, 'base.txt'), 'base\n');
  await writeFile(path.join(repo, 'overlap.txt'), 'base overlap\n');
  await writeFile(path.join(src, 'mcp-server.mjs'), childCode(false));
  await writeFile(path.join(src, 'mcp-development-test-tools.mjs'), '// baseline test tools\n');
  await git(repo, ['init', '-b', 'main']);
  await git(repo, ['config', 'core.autocrlf', 'false']);
  await git(repo, ['config', 'user.name', 'Integration Regression']);
  await git(repo, ['config', 'user.email', 'integration@test.invalid']);
  await git(repo, ['add', '.']);
  await git(repo, ['commit', '-m', 'fixture baseline']);
  const base = await git(repo, ['rev-parse', 'HEAD']);
  const hex = '0123456789abcdef01234567', workstreamId = 'dev_workstream_20260902-120000_0123456789ab';
  const workspaceId = 'dev_workspace_' + hex, branch = 'dev-ws/' + hex, source = path.join(temp, workspaceId);
  await git(repo, ['worktree', 'add', '-b', branch, source, base]);
  const depHex = '111111111111111111111111', depId = 'dev_workstream_20260902-120000_111111111111';
  const depWorkspace = 'dev_workspace_' + depHex, depBranch = 'dev-ws/' + depHex;
  const depSource = path.join(temp, depWorkspace);
  await git(repo, ['worktree', 'add', '-b', depBranch, depSource, base]);
  const workstream = { workstream_id: workstreamId, revision: 1, state: 'completed', mode: 'isolated', base_head: base, workspace_id: workspaceId, workspace: { workspace_id: workspaceId }, depends_on: [depId] };
  const dependency = { ...workstream, workstream_id: depId, workspace_id: depWorkspace, workspace: { workspace_id: depWorkspace }, depends_on: [] };
  const support = [
    'import { createDevIntegrationService } from ' + JSON.stringify(runtimeUrl.href) + ';',
    "import { execFile } from 'node:child_process';",
    "import { promisify } from 'node:util';",
    "import { readFile } from 'node:fs/promises';",
    'const dependency = ' + JSON.stringify(dependency) + ';',
    'const dependencyStatePath = ' + JSON.stringify(path.join(runtime, 'dependency-state')) + ';',
    'const branches = ' + JSON.stringify({ [workspaceId]: branch, [depWorkspace]: depBranch }) + ';',
    'const git = promisify(execFile);',
    'const workstream = ' + JSON.stringify(workstream) + ';',
    'export const service = createDevIntegrationService({',
    'repositoryRoot: ' + JSON.stringify(repo) + ',',
    'registryPath: ' + JSON.stringify(path.join(runtime, 'integration_registry.json')) + ',',
    'registryLockPath: ' + JSON.stringify(path.join(runtime, 'integration_registry.lock')) + ',',
    'applyLockPath: ' + JSON.stringify(path.join(runtime, 'integration_apply.lock')) + ',',
    'integrationRootPath: ' + JSON.stringify(path.join(temp, 'integrations')) + ',',
    "workstreamReader: async ({ workstream_id }) => { if (workstream_id === workstream.workstream_id) return workstream; if (workstream_id === dependency.workstream_id) return { ...dependency, state: await readFile(dependencyStatePath, 'utf8').catch(() => 'completed') }; throw new Error('Unknown workstream'); },",
    "workspaceReader: async ({ workspace_id }) => { if (!branches[workspace_id]) throw new Error('Unknown workspace');",
    'const { stdout } = await git(' + JSON.stringify(process.platform === 'win32' ? 'git.exe' : 'git') + ', ["rev-parse", "refs/heads/" + branches[workspace_id]], { cwd: ' + JSON.stringify(repo) + ', windowsHide: true, shell: false });',
    'return { workspace_id, workstream_id: workspace_id === workstream.workspace_id ? workstream.workstream_id : dependency.workstream_id, workspace_type: "isolated_worktree", state: "active", branch_name: branches[workspace_id], worktree_relative_path: "../.writer-workbench-worktrees/" + workspace_id, healthy: true, registered_branch_matches: true, registry_mapping_consistent: true, git_worktree_head: stdout.trim() }; },',
    "validationRunner: async () => ['mcp', 'mcp_tunnel'].map(suite => ({ suite, execution_ok: true, passed: true, timed_out: false, exit_code: 0 })),",
    '});',
    'export const dev_workspace_integrate = service.integrate;',
  ].join('\n');
  await writeFile(path.join(source, 'server/src/mcp-development-integration-tools.mjs'), support);
  await writeFile(path.join(source, 'server/src/mcp-development-test-tools.mjs'), '// bootstrap test tools\n');
  await writeFile(path.join(source, 'server/src/mcp-server.mjs'), childCode(true));
  await writeFile(path.join(source, 'overlap.txt'), 'integrated overlap\n');
  await git(source, ['add', 'server/src/mcp-development-integration-tools.mjs', 'server/src/mcp-development-test-tools.mjs', 'server/src/mcp-server.mjs', 'overlap.txt']);
  await git(source, ['commit', '-m', 'fixture source']);
  await writeFile(path.join(repo, 'main-only.txt'), 'main\n');
  await git(repo, ['add', 'main-only.txt']);
  await git(repo, ['commit', '-m', 'fixture target']);
  const target = await git(repo, ['rev-parse', 'HEAD']);
  for (const file of ['mcp-server.mjs', 'mcp-development-test-tools.mjs', 'mcp-development-integration-tools.mjs']) {
    await copyFile(path.join(source, 'server/src', file), path.join(src, file));
  }
  parent = await startParent(repo, 'chatgpt_developer');
  const call = async (tool, input) => {
    const result = await parent.client.callTool({ name: tool, arguments: input });
    if (result.isError) throw new Error(result.content?.[0]?.text);
    return JSON.parse(result.content[0].text);
  };
  const listed = await parent.client.listTools();
  assert.equal(listed.tools.filter(tool => tool.name === name).length, 1);
  assert.equal(listed.tools.find(tool => tool.name === name)._meta['armed-academy/permission'].requires_user_confirmation, true);
  const integratedDependency = await call('dev_workspace_integration_preflight', { workstream_id: depId });
  assert.equal(integratedDependency.state, 'integrated');
  const candidate = await call('dev_workspace_integration_preflight', { workstream_id: workstreamId });
  assert.equal(candidate.strategy, 'merge_commit');
  const ready = await call('dev_workspace_validate_integration', { integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.validation_report.passed, true);
  await call('dev_mcp_reload', {});
  assert.deepEqual(await call('dev_workspace_get_integration_candidate', { integration_candidate_id: ready.integration_candidate_id }), ready);
  await writeFile(path.join(src, 'mcp-server.mjs'), childCode(false));
  await writeFile(path.join(src, 'mcp-development-test-tools.mjs'), '// baseline test tools\n');
  await rm(path.join(src, 'mcp-development-integration-tools.mjs'));
  await assert.rejects(access(path.join(src, 'mcp-development-integration-tools.mjs')));
  // Reload after cleanup as well: the replacement child truly lacks Phase 2D.
  await call('dev_mcp_reload', {});
  assert.deepEqual((await parent.client.listTools()).tools.map(tool => tool.name).sort(), ['dev_mcp_reload', name].sort());
  await assert.rejects(call('dev_workspace_integration_preflight', { workstream_id: workstreamId }), /Tool not allowed/);
  await assert.rejects(call('dev_git_arbitrary', {}), /Tool not allowed/);
  const unrelated = Buffer.from('keep unrelated dirty bytes\n');
  await writeFile(path.join(repo, 'base.txt'), unrelated);
  await writeFile(path.join(repo, 'untracked.txt'), unrelated);
  return {
    temp, repo, source, depSource, target, runtime, parent, call, ready,
    input: { integration_candidate_id: ready.integration_candidate_id, expected_revision: ready.revision },
    async verifyUnchanged() {
      assert.deepEqual(await readFile(path.join(repo, 'base.txt')), unrelated);
      assert.deepEqual(await readFile(path.join(repo, 'untracked.txt')), unrelated);
    },
    async cleanup() {
      await parent.stop();
      assert.equal(path.dirname(path.resolve(temp)), path.resolve(tempParent));
      await rm(temp, { recursive: true, force: true });
    },
  };
  } catch (error) {
    await parent?.stop();
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(tempParent));
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

test('real HTTP reload and bootstrap cleanup retain exact guarded Phase 2D integration', {
  skip: runtimeAvailable ? false : 'Phase 2D service is not installed; set PHASE2D_TEST_SOURCE_ROOT to its isolated source for acceptance.',
  timeout: 180000,
}, async (t) => {
  for (const scenario of ['success', 'wrong revision', 'target stale', 'source stale', 'dependency stale', 'dependency head stale', 'dirty overlap', 'staged', 'conflicted', 'lock', 'active operation']) {
    await t.test(scenario, async () => {
      const f = await fixture();
      try {
        if (scenario === 'wrong revision') {
          await assert.rejects(f.call(name, { ...f.input, expected_revision: f.ready.revision + 1 }), /stale integration candidate revision/);
        } else if (scenario === 'target stale' || scenario === 'source stale') {
          const cwd = scenario === 'target stale' ? f.repo : f.source;
          await writeFile(path.join(cwd, 'advance.txt'), 'advance\n');
          await git(cwd, ['add', 'advance.txt']);
          await git(cwd, ['commit', '-m', 'fixture freshness change']);
          const headBefore = await git(f.repo, ['rev-parse', 'HEAD']);
          const result = await f.call(name, f.input);
          assert.equal(result.state, 'stale');
          assert.equal(result.stale_reason.code, 'APPLY_INPUT_STALE');
          assert.equal(await git(f.repo, ['rev-parse', 'HEAD']), headBefore);
        } else if (scenario === 'dependency stale' || scenario === 'dependency head stale') {
          if (scenario === 'dependency stale') {
            await writeFile(path.join(f.runtime, 'dependency-state'), 'blocked');
          } else {
            await writeFile(path.join(f.depSource, 'dependency-advance.txt'), 'changed\n');
            await git(f.depSource, ['add', 'dependency-advance.txt']);
            await git(f.depSource, ['commit', '-m', 'fixture dependency freshness change']);
          }
          const result = await f.call(name, f.input);
          assert.equal(result.state, 'stale');
          assert.ok(result.stale_reason.reasons.some(reason => reason.code === (scenario === 'dependency stale' ? 'DEPENDENCY_STATE_CHANGED' : 'DEPENDENCY_HEAD_CHANGED')));
        } else if (scenario === 'dirty overlap') {
          await writeFile(path.join(f.repo, 'overlap.txt'), 'local overlap\n');
          const result = await f.call(name, f.input);
          assert.equal(result.state, 'blocked');
          assert.equal(result.failure_reason.code, 'MAIN_WORKTREE_OVERLAY_CONFLICT');
          assert.equal(await readFile(path.join(f.repo, 'overlap.txt'), 'utf8'), 'local overlap\n');
        } else if (scenario === 'staged') {
          await git(f.repo, ['add', 'base.txt']);
          const index = await git(f.repo, ['ls-files', '--stage']);
          await assert.rejects(f.call(name, f.input), /staged changes/);
          assert.equal(await git(f.repo, ['ls-files', '--stage']), index);
        } else if (scenario === 'conflicted') {
          const blob = await git(f.repo, ['rev-parse', 'HEAD:overlap.txt']);
          await git(f.repo, ['update-index', '--index-info'], '0 ' + '0'.repeat(40) + '\toverlap.txt\n' + [1, 2, 3].map(stage => '100644 ' + blob + ' ' + stage + '\toverlap.txt\n').join(''));
          assert.match(await git(f.repo, ['status', '--porcelain=v1']), /UU overlap.txt/);
          const index = await readFile(path.join(f.repo, '.git/index'));
          await assert.rejects(f.call(name, f.input), /staged changes|conflicted/);
          assert.deepEqual(await readFile(path.join(f.repo, '.git/index')), index);
        } else if (scenario === 'lock') {
          await writeFile(path.join(f.runtime, 'integration_apply.lock'), JSON.stringify({ pid: process.pid, hostname: os.hostname(), kind: 'repository_integration_apply' }));
          await assert.rejects(f.call(name, f.input), /Another integration apply is currently active/);
        } else if (scenario === 'active operation') {
          await writeFile(path.join(f.repo, '.git/MERGE_HEAD'), f.target + '\n');
          await assert.rejects(f.call(name, f.input), /active Git operation/);
        } else {
          const publicParent = await startParent(f.repo, 'chatgpt_public');
          try {
            assert.equal((await publicParent.client.listTools()).tools.some(tool => tool.name === name), false);
            await assert.rejects(publicParent.client.callTool({ name, arguments: f.input }), /Tool not allowed.*chatgpt_public/);
          } finally { await publicParent.stop(); }
          const result = await f.call(name, f.input);
          assert.equal(result.state, 'integrated', JSON.stringify(result.failure_reason));
          assert.equal(await git(f.repo, ['rev-parse', 'HEAD']), f.ready.integration_commit);
          assert.equal(await git(f.repo, ['rev-parse', 'HEAD^{tree}']), f.ready.result_tree);
          assert.deepEqual((await git(f.repo, ['show', '-s', '--format=%P', 'HEAD'])).split(' '), [f.ready.target_head, f.ready.source_head]);
          await assert.rejects(f.call(name, f.input), /stale integration candidate revision|must be ready/i);
        }
        if (!['success', 'target stale', 'source stale'].includes(scenario)) assert.equal(await git(f.repo, ['rev-parse', 'HEAD']), f.target);
        if (['wrong revision', 'dirty overlap', 'lock', 'active operation'].includes(scenario)) assert.equal(await git(f.repo, ['diff', '--cached', '--name-only']), '');
        await f.verifyUnchanged();
        const audit = (await readFile(path.join(f.repo, 'data/outputs/logs/mcp_tool_audit.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
        assert.ok(audit.some(record => record.tool_name === name && record.risk === 'high-risk-write' && record.ownership === 'mcp_http_parent'));
      } finally { await f.cleanup(); }
    });
  }
});
