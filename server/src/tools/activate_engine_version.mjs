import { promises as fs } from 'fs';
import { join } from 'path';

async function main() {
  const args = process.argv.slice(2);
  const vIdx = args.indexOf('--version');
  if (vIdx === -1) {
    console.error('usage: node activate_engine_version.mjs --version <version> --confirm-file <path>');
    process.exit(2);
  }
  const version = args[vIdx + 1];
  const cfIdx = args.indexOf('--confirm-file');
  if (cfIdx === -1) {
    console.error('Must provide --confirm-file <path> that contains CONFIRM to proceed');
    process.exit(2);
  }
  const confirmPath = args[cfIdx + 1];
  try {
    const txt = await fs.readFile(confirmPath, 'utf8');
    if (!txt.includes('CONFIRM')) {
      console.error('Confirmation file missing required token');
      process.exit(3);
    }
  } catch (e) {
    console.error('Cannot read confirmation file:', e.message);
    process.exit(3);
  }

  // Minimal activation: write active_engine.md backup and note
  const root = process.cwd();
  const activePath = join(root, 'data', 'canon_db', 'active_engine.md');
  const backupPath = join(root, 'data', 'canon_db', `active_engine.${Date.now()}.bak.md`);
  try {
    const cur = await fs.readFile(activePath, 'utf8');
    await fs.writeFile(backupPath, cur, 'utf8');
  } catch (e) {
    // if missing, continue
  }

  const newContent = `# active_engine activation note\n\nActivated version: ${version}\nactivated_at: ${new Date().toISOString()}\nby_confirmation_file: ${confirmPath}\n`;
  await fs.writeFile(activePath, newContent, 'utf8');
  console.log('Activated engine version', version, 'wrote', activePath);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('activate_engine_version.mjs')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
