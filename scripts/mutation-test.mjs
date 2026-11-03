import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
const mutations = [
  ['document authorization removed', "if (!allowed) fail(404, 'Document unavailable');", "if (false) fail(404, 'Document unavailable');", 'other owner, viewer and administrator cannot reach ungranted document routes'],
  ['list visibility bypassed', 'WHERE (d.owner_id=? OR g.user_id IS NOT NULL)', 'WHERE (d.owner_id=? OR g.user_id IS NOT NULL OR 1=1)', 'lists and every search filter keep unauthorized documents out'],
  ['post-body session check removed', 'actor = await session(req);', '// MUTATION: stale authenticated state is reused', 'a body paused during disable cannot use stale authenticated state'],
  ['audit HMAC verification removed', '!safeEqual(row.hash, hmac(`${previous}\\n${row.event}`))', 'false', 'an altered stored event fails cryptographic verification and blocks restart'],
];
let failed = false;
for (const [name, original, replacement, expectedTest] of mutations) {
  if (!source.includes(original)) throw new Error(`Mutation target missing: ${name}`);
  const dir = mkdtempSync(join(tmpdir(), 'trustvault-mutation-'));
  try {
    mkdirSync(join(dir, 'src')); mkdirSync(join(dir, 'test'));
    let modified = source.replace(original, replacement);
    if (name === 'post-body session check removed') modified = modified.replace('let body = {};', 'actor = await session(req); let body = {};');
    writeFileSync(join(dir, 'src', 'app.mjs'), modified);
    copyFileSync(new URL('../src/schema.sql', import.meta.url), join(dir, 'src', 'schema.sql'));
    copyFileSync(new URL('../src/database.mjs', import.meta.url), join(dir, 'src', 'database.mjs'));
    copyFileSync(new URL('../test/security.test.mjs', import.meta.url), join(dir, 'test', 'security.test.mjs'));
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', join(dir, 'test', 'security.test.mjs')], { encoding: 'utf8', timeout: 30000 });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const caught = result.status !== null && result.status !== 0 && output.includes(expectedTest) && output.includes('AssertionError');
    console.log(`${caught ? 'CAUGHT' : 'FAILED TO PROVE'}: ${name}`);
    if (!caught) { failed = true; console.log(output); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (failed) process.exitCode = 1;
