import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const issuer = 'https://writer-workbench.invalid/oauth';
const resource = 'https://writer-workbench.invalid/mcp';
const scope = 'mcp:access';
const subject = 'r5-test-owner';

export function createTestOAuthCredentials(additionalAudiences=[]) {
  if(!Array.isArray(additionalAudiences)||additionalAudiences.length>8||additionalAudiences.some(value=>{try{const u=new URL(value);return u.protocol!=='https:'||u.pathname!=='/mcp'||u.username||u.password||u.search||u.hash;}catch{return true;}}))throw Error('INVALID_TEST_AUDIENCES');
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = encode({
    iss: issuer, aud: additionalAudiences.length?[resource,...new Set(additionalAudiences)]:resource,
    sub: subject, scope, exp: Math.floor(Date.now() / 1000) + 600,
  });
  const input = encode({ alg: 'ES256' }) + '.' + claims;
  const signature = sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const proof = input + '.' + signature.toString('base64url');
  signature[0] ^= 1;
  return {
    proof, invalidProof: input + '.' + signature.toString('base64url'),
    publicJwk: JSON.stringify(publicKey.export({ format: 'jwk' })),
  };
}

export function testOAuthEnvironment(publicJwk) {
  return {
    NODE_OPTIONS: '--import=' + import.meta.url,
    WRITER_WORKBENCH_TEST_HTTP_OAUTH_PUBLIC_JWK: publicJwk,
  };
}

// Only the loopback test launches this preload. The deployed process never
// loads it. Keep real IPC authentication and replace only the external
// credential provider so tests do not require an installed TRPG checkout.
const publicJwk = process.env.WRITER_WORKBENCH_TEST_HTTP_OAUTH_PUBLIC_JWK;
if (process.argv[1] && path.basename(process.argv[1]) === 'mcp-server.mjs'
  && typeof process.send === 'function' && publicJwk) {
  const provider = pathToFileURL('E:\\TRPG\\apps\\gm-adapter\\dist\\workbench-security.js').href;
  const parentURL = pathToFileURL(path.join(path.dirname(process.argv[1]), 'mcp-trpg-gm-bridge.mjs')).href;
  const source = `let target;
export function initialize(value) { target = value; }
export function resolve(specifier, context, nextResolve) {
  if (specifier === target.provider && context.parentURL === target.parentURL) {
    return { url: target.fixtureURL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}`;
  register('data:text/javascript,' + encodeURIComponent(source), import.meta.url, {
    data: { provider, parentURL, fixtureURL: import.meta.url },
  });
}

// A synthetic verifier for the test's ephemeral ES256 credentials. The TRPG
// OAuth tests separately cover the deployed verifier, identity store and grants.
export async function loadWorkbenchSecurity() {
  const key = createPublicKey({ key: JSON.parse(publicJwk), format: 'jwk' });
  return {
    verifier: {
      async authorize({ authorization }) {
        const invalid = { ok: false, code: 'INVALID_TOKEN' };
        try {
          if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/u.test(authorization)) return invalid;
          const [header, payload, signature] = authorization.slice(7).split('.');
          if (!verify('sha256', Buffer.from(header + '.' + payload), {
            key, dsaEncoding: 'ieee-p1363',
          }, Buffer.from(signature, 'base64url'))) return invalid;
          if (JSON.parse(Buffer.from(header, 'base64url')).alg !== 'ES256') return invalid;
          const claims = JSON.parse(Buffer.from(payload, 'base64url'));
          const now = Math.floor(Date.now() / 1000);
          if (claims.iss !== issuer || !(claims.aud===resource||Array.isArray(claims.aud)&&claims.aud.includes(resource)) || claims.scope !== scope
            || claims.sub !== subject || !Number.isInteger(claims.exp) || claims.exp <= now) return invalid;
          return { ok: true, principal: { key: claims.sub, scopes: [scope], expiresAt: claims.exp } };
        } catch {
          return invalid;
        }
      },
    },
  };
}

// Only callers in owned, synthetic tests invoke this file writer. The production
// credential reader never creates or rewrites credentials.
export async function createTestProbeCredentialFile(directory, endpoint, credentials, proof=credentials.proof) {
  const fs=await import('node:fs/promises');
  const {spawnSync}=await import('node:child_process');
  const {randomUUID}=await import('node:crypto');
  const dir=await fs.realpath(directory),file=path.join(dir,'probe-owner-'+randomUUID()+'.json');
  if(path.dirname(file)!==dir)throw Error('UNSAFE_PROBE_FIXTURE_PATH');
  await fs.writeFile(file,JSON.stringify({schema:'workbench-probe/1.0',resource,upstream_origin:new URL(endpoint).origin,access_token:proof}),{flag:'wx',mode:0o600});
  if(process.platform==='win32'){
    const script=`$ErrorActionPreference='Stop'
try {
 $acl=New-Object Security.AccessControl.FileSecurity
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl.SetOwner($sid)
 $acl.SetAccessRuleProtection($true,$false)
 foreach($identity in @($sid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')),(New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))) {
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')
  $acl.AddAccessRule($rule)
 }
 Set-Acl -LiteralPath $env:WRITER_PROBE_FIXTURE_FILE -AclObject $acl
} catch {exit 2}`;
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,WRITER_PROBE_FIXTURE_FILE:file,PSModulePath:path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/Modules')},windowsHide:true,encoding:'utf8',timeout:3000,maxBuffer:4096});
    if(result.error||result.status!==0)throw Error('PROBE_FIXTURE_ACL_FAILED');
  }
  return file;
}
