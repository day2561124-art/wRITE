import { spawnSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { createProtectedIndependentCandidateGate } from "./mcp-independent-verification-host.mjs";

// Opt-in consumer only. A protected operator launch configuration supplies the
// exact manifest hash after independent enrollment/ACL review. No request,
// candidate, engineering workspace or issuer controls paths or the pin.
// This is NOT enrollment, a signing service, or capability activation.
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const digest = /^[a-f0-9]{64}$/u;
const sid = /^S-1-[0-9]+(?:-[0-9]+){1,15}$/u;
const label = /^[A-Za-z0-9_.-]{1,100}$/u;
const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fail = () => { throw new Error("INDEPENDENT_CONSUMER_BINDING_UNVERIFIED"); };
const samePath = (a,b) => process.platform === "win32"
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);

function pinnedRead(filename) {
  const before = lstatSync(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
    || before.size < 1 || before.size > 128 * 1024 || !samePath(realpathSync.native(filename),filename)) fail();
  const fd = openSync(filename,"r");
  try {
    const first = fstatSync(fd), buffer = Buffer.alloc(before.size + 1);
    if (first.dev !== before.dev || first.ino !== before.ino || first.size !== before.size
      || first.nlink !== 1 || !first.isFile()) fail();
    let offset = 0;
    while (offset < buffer.length) {
      const n = readSync(fd,buffer,offset,buffer.length-offset,offset);
      if (!n) break;
      offset += n;
    }
    const last = fstatSync(fd), current = lstatSync(filename);
    if (offset !== first.size || [last,current].some(s => s.dev !== first.dev || s.ino !== first.ino
      || s.size !== first.size || s.nlink !== 1 || s.mtimeMs !== first.mtimeMs || s.ctimeMs !== first.ctimeMs
      || !s.isFile() || s.isSymbolicLink())) fail();
    return buffer.subarray(0,offset);
  } finally { closeSync(fd); }
}

function ancestry(directory) {
  const result = [];
  for (let p=path.resolve(directory); ; p=path.dirname(p)) {
    result.unshift(p);
    if (path.dirname(p) === p) return result;
    if (result.length > 20) fail();
  }
}

// Fixed read-only native probe. Paths come exclusively from the installed
// host layout. The descriptor hashes compare the actual owner/group/DACL
// against an independently reviewed enrollment, not inferred ACL safety.
export function inspectWindowsConsumerAcl(paths, systemRoot) {
  if (process.platform !== "win32" || typeof systemRoot !== "string" || !path.isAbsolute(systemRoot)) fail();
  const input = Buffer.from(JSON.stringify(paths),"utf8").toString("base64");
  const script = [
    "$ErrorActionPreference='Stop'",
    "$env:PSModulePath=[IO.Path]::Combine($PSHOME,'Modules')",
    "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)",
    "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + input + "')) | Microsoft.PowerShell.Utility\\ConvertFrom-Json",
    "$i=[Security.Principal.WindowsIdentity]::GetCurrent()",
    "$principal=[Security.Principal.WindowsPrincipal]::new($i)",
    "$sections=[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group -bor [Security.AccessControl.AccessControlSections]::Access",
    "$entries=@(foreach($v in $p){$item=Microsoft.PowerShell.Management\\Get-Item -LiteralPath $v -Force; if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Reparse point'}; $acl=Microsoft.PowerShell.Security\\Get-Acl -LiteralPath $v; [pscustomobject]@{path=$v; directory=[bool]$item.PSIsContainer; sddl=$acl.GetSecurityDescriptorSddlForm($sections)}})",
    "[pscustomobject]@{sid=$i.User.Value; administrator=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); entries=$entries}|Microsoft.PowerShell.Utility\\ConvertTo-Json -Depth 4 -Compress"
  ].join("\n");
  const exe=path.join(systemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe");
  const result=spawnSync(exe,["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(script,"utf16le").toString("base64")],
    {windowsHide:true,encoding:"utf8",timeout:30000,maxBuffer:256*1024,cwd:systemRoot,
      env:{SystemRoot:systemRoot,windir:systemRoot,PATH:path.join(systemRoot,"System32"),
        PSModulePath:path.join(systemRoot,"System32","WindowsPowerShell","v1.0","Modules")}});
  if (result.status !== 0 || result.error || result.signal) fail();
  return JSON.parse(result.stdout);
}

export function createPinnedIndependentConsumerBinding({ directory, manifestSha256, inspect, readManifest=pinnedRead, clock=Date.now }={}) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || typeof manifestSha256 !== "string" || !digest.test(manifestSha256)
    || typeof inspect !== "function" || typeof readManifest !== "function") fail();
  const root=path.resolve(directory), receiptRoot=path.join(root,"receipts"), filename=path.join(root,"consumer.json");
  const paths=[...ancestry(root),filename,receiptRoot];
  function check() {
    const raw=readManifest(filename);
    if (!Buffer.isBuffer(raw) || raw.length < 1 || raw.length > 128*1024 || hash(raw)!==manifestSha256) fail();
    const cfg=JSON.parse(raw.toString("utf8"));
    if (!exact(cfg,["schema_version","consumer_sid","issuer_public_key","policy","acl_sha256"])
      || cfg.schema_version!==1 || typeof cfg.consumer_sid!=="string" || !sid.test(cfg.consumer_sid)
      || typeof cfg.issuer_public_key!=="string" || cfg.issuer_public_key.length>2048
      || !Array.isArray(cfg.acl_sha256) || cfg.acl_sha256.length!==paths.length
      || !cfg.acl_sha256.every(v=>typeof v==="string"&&digest.test(v))
      || !exact(cfg.policy,["repository","issuer","max_age_ms","suite_workflows","additional_required"])
      || typeof cfg.policy.repository!=="string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(cfg.policy.repository)
      || typeof cfg.policy.issuer!=="string" || !label.test(cfg.policy.issuer)
      || !Number.isSafeInteger(cfg.policy.max_age_ms) || cfg.policy.max_age_ms<1 || cfg.policy.max_age_ms>7*86400000) fail();
    const observed=inspect([...paths]);
    if (!observed || observed.sid!==cfg.consumer_sid || observed.administrator!==false
      || !Array.isArray(observed.entries) || observed.entries.length!==paths.length
      || observed.entries.some((v,i)=>!v || typeof v.path!=="string" || !samePath(v.path,paths[i])
        || v.directory!==(i!==paths.length-2) || typeof v.sddl!=="string" || !v.sddl
        || hash(Buffer.from(v.sddl,"utf8"))!==cfg.acl_sha256[i])) fail();
    const key=createPublicKey(cfg.issuer_public_key);
    if (key.asymmetricKeyType!=="ed25519" || !cfg.issuer_public_key.startsWith("-----BEGIN PUBLIC KEY-----")) fail();
    return {cfg,key};
  }
  const {cfg,key}=check();
  const gate=createProtectedIndependentCandidateGate({policy:cfg.policy,pinnedPublicKey:key,receiptRoot,
    assertReceiptDirectory: async ({directory:actual,role})=>{
      if (role!=="consumer" || !samePath(actual,receiptRoot)) return false;
      try { check(); return true; } catch { return false; }
    },clock});
  return gate;
}

// Existing unmanaged/local behavior is preserved unless the protected host
// explicitly opts in. Configured but invalid is a denying gate, never a
// fallback to local suites. Capability availability remains disabled until
// separate positive operational acceptance.
export function loadProductionIndependentConsumerGate({ releaseRoot, environment=process.env }={}) {
  const pin=environment.NEXA_INDEPENDENT_VERIFICATION_CONSUMER_SHA256;
  if (pin===undefined) return undefined;
  const deny=async()=>({verified:false,execution_authorized:false,code:"INDEPENDENT_CONSUMER_BINDING_UNVERIFIED"});
  try {
    const pf=environment.ProgramW6432??environment.ProgramFiles;
    if (process.platform!=="win32" || typeof pf!=="string" || !path.isAbsolute(pf)
      || !environment.NEXA_MANAGED_PROJECT_ROOT || !releaseRoot || typeof pin!=="string" || !digest.test(pin)) fail();
    const releases=path.join(pf,"NexaRuntimeV3","releases");
    const rel=path.relative(releases,releaseRoot);
    const maintenance=path.join(pf,"WriterWorkbench-PiMaintenance-v3");
    if (!/^[a-f0-9]{40}$/u.test(rel)
      || !samePath(environment.NEXA_PI_TASK_AUTHORIZATION_ROOT,path.join(maintenance,"grants"))) fail();
    return createPinnedIndependentConsumerBinding({
      directory:path.join(maintenance,"independent-verification"),manifestSha256:pin,
      inspect:paths=>inspectWindowsConsumerAcl(paths,environment.SystemRoot)
    });
  } catch {
    return Object.freeze({reviewForValidation:deny,reviewForApply:deny});
  }
}
