import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dataDir = process.env.DATA_DIR || './data';
const outputDir = resolve(process.env.BACKUP_DIR || './backups');
mkdirSync(outputDir, { recursive: true });
const target = resolve(outputDir, `trustvault-${Date.now()}.db`);
const db = new DatabaseSync(resolve(dataDir, 'trustvault.db'), { readOnly: true });
// VACUUM INTO creates a consistent snapshot including committed WAL records.
db.prepare('VACUUM INTO ?').run(target); db.close();
const snapshot = new DatabaseSync(target, { readOnly: true });
const row = snapshot.prepare('SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1').get(); snapshot.close();
writeFileSync(`${target}.checkpoint.json`, JSON.stringify({ count: row?.seq || 0, head: row?.hash || 'GENESIS', exportedAt: new Date().toISOString(), note: 'Snapshot checkpoint; retain independently. Verify HMAC on restore with the original AUDIT_KEY.' }, null, 2));
console.log(`Backup: ${target}\nCheckpoint: ${target}.checkpoint.json\nStore both securely away from the service. Preserve AUDIT_KEY separately.`);
