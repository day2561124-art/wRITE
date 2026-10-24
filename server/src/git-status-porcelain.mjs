import {TextDecoder} from 'node:util';

// Git's porcelain-v1 -z protocol emits literal, repository-relative names.
// Rename/copy destinations precede a second NUL-terminated source name.
// No display quoting, newline splitting, trim, or slash substitution applies.
export function decodeGitOutputStrict(raw) {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array) return new TextDecoder('utf-8', {fatal:true}).decode(raw);
  throw new TypeError('Git output must be text or bytes.');
}

export function parseGitPorcelainV1Z(raw) {
  const text=decodeGitOutputStrict(raw);
  if (text==='') return [];
  const invalid=()=>Object.assign(new Error('Invalid or truncated Git porcelain-v1 NUL status.'),{code:'GIT_PORCELAIN_STATUS_INVALID'});
  if (!text.endsWith('\0')) throw invalid();
  const fields=text.split('\0');fields.pop();
  const entries=[];
  for (let index=0;index<fields.length;index++) {
    const field=fields[index],status=field.slice(0,2);
    if (field.length<4 || field[2]!==' ' || status==='  '
        || !/^(?:\?\?|!!|[ MADRCUT]{2})$/u.test(status)) throw invalid();
    let original_path=null;
    if (status.includes('R') || status.includes('C')) {
      if (++index>=fields.length || fields[index]==='') throw invalid();
      original_path=fields[index];
    }
    entries.push({status,path:field.slice(3),original_path});
  }
  return entries;
}
