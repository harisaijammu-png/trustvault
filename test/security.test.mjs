import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import { createVault } from '../src/app.mjs';

const ORIGIN = 'http://vault.test';
const PASSWORD = 'Test-Only-Password-2026!';
const KEY = 'test-audit-secret-that-is-at-least-32-characters';
const file = (name = 'contract.txt') => ({ name, category: 'Contracts', base64: Buffer.from('Fictional contract. Confidential sample.').toString('base64') });

test('TrustVault server security and functionality', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'trustvault-test-'));
  const app = await createVault({ dataDir: dir, origin: ORIGIN, auditKey: KEY, seedPassword: PASSWORD });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const raw = new DatabaseSync(join(dir, 'trustvault.db'));
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); raw.close(); await app.close(); rmSync(dir, { recursive: true, force: true }); });
  async function request(path, session, method = 'GET', body, headers = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: { Origin: ORIGIN, ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, data, response };
  }
  async function login(id, password = PASSWORD) {
    const result = await request('/api/login', null, 'POST', { email: `${id}@trustvault.demo`, password });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const cookieHeader = result.response.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Strict/);
    return { cookie: cookieHeader.split(';')[0], csrf: result.data.csrf, user: result.data.user };
  }
  const alice = await login('alice'); const bob = await login('bob'); const viewer = await login('viewer'); const admin = await login('admin');
  let id;
  await t.test('owner uploads, metadata is safe, and ownership cannot be forged', async () => {
    const result = await request('/api/documents', alice, 'POST', file());
    assert.equal(result.status, 201); id = result.data.document.id;
    assert.equal(result.data.document.ownerId, 'alice'); assert.equal('content' in result.data.document, false);
    assert.equal((await request('/api/documents', alice, 'POST', { ...file(), ownerId: 'bob' })).status, 400);
    assert.equal((await request('/api/documents', viewer, 'POST', file())).status, 403);
    assert.equal((await request('/api/documents', admin, 'POST', file())).status, 403);
  });
  await t.test('anonymous and forged sessions cannot read metadata or bytes', async () => {
    for (const suffix of ['', '/content', '/grants']) {
      assert.equal((await request(`/api/documents/${id}${suffix}`, null)).status, 401);
      assert.equal((await request(`/api/documents/${id}${suffix}`, { cookie: `tv_session=${'f'.repeat(64)}`, csrf: 'fake' })).status, 401);
    }
  });
  await t.test('other owner, viewer and administrator cannot reach ungranted document routes', async () => {
    for (const person of [bob, viewer, admin]) {
      for (const suffix of ['', '/content', '/grants']) assert.equal((await request(`/api/documents/${id}${suffix}`, person)).status, 404);
      assert.equal((await request(`/api/documents/${id}`, person, 'PATCH', { category: 'Stolen', version: 1 })).status, 404);
      assert.equal((await request(`/api/documents/${id}/content`, person, 'PUT', { ...file(), version: 1 })).status, 404);
      assert.equal((await request(`/api/documents/${id}`, person, 'DELETE')).status, 404);
      assert.equal((await request(`/api/documents/${id}/grants`, person, 'POST', { userId: 'bob', permission: 'edit' })).status, 404);
      assert.equal((await request(`/api/documents/${id}/grants/viewer`, person, 'DELETE')).status, 404);
    }
  });
  await t.test('lists and every search filter keep unauthorized documents out', async () => {
    for (const query of ['', '?name=contract', '?owner=Alice', '?category=Contracts', '?from=2020-01-01&to=2099-12-31']) {
      for (const person of [bob, viewer, admin]) {
        const result = await request(`/api/documents${query}`, person);
        assert.equal(result.status, 200); assert.equal(result.data.documents.some(d => d.id === id), false);
      }
    }
    const allowed = await request('/api/documents?name=contract&owner=Alice&category=Contracts&from=2020-01-01&to=2099-12-31', alice);
    assert.equal(allowed.data.documents[0].id, id);
    assert.equal((await request('/api/documents?from=2026-02-31', alice)).status, 400);
    assert.equal((await request('/api/documents?unknown=1', alice)).status, 400);
  });
  await t.test('CSRF, foreign origins, mass assignment and unexpected methods are rejected', async () => {
    assert.equal((await request(`/api/documents/${id}`, alice, 'DELETE', undefined, { 'X-CSRF-Token': 'wrong' })).status, 403);
    assert.equal((await request('/api/documents', alice, 'POST', file(), { Origin: 'https://attacker.invalid' })).status, 403);
    assert.equal((await request('/api/login', null, 'POST', { email: 'alice@trustvault.demo', password: PASSWORD }, { Origin: 'null' })).status, 403);
    assert.equal((await request(`/api/documents/${id}`, alice, 'PATCH', { ownerId: 'bob', category: 'Attack', version: 1 })).status, 400);
    assert.equal((await request(`/api/users/viewer`, viewer, 'PATCH', { active: false })).status, 403);
    assert.equal((await request(`/api/users/alice`, admin, 'PATCH', { role: 'admin', active: true })).status, 400);
    assert.equal((await request(`/api/documents/${id}`, alice, 'OPTIONS')).status, 405);
  });
  await t.test('read grant permits download but never edit, delete or delegating access', async () => {
    assert.equal((await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'viewer', permission: 'read' })).status, 200);
    const result = await request(`/api/documents/${id}/content`, viewer);
    assert.equal(result.status, 200); assert.match(result.data, /Fictional contract/);
    assert.equal(result.response.headers.get('cache-control'), 'no-store, private');
    assert.match(result.response.headers.get('content-disposition'), /^attachment/);
    assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await request(`/api/documents/${id}`, viewer, 'PATCH', { category: 'Changed', version: 1 })).status, 404);
    assert.equal((await request(`/api/documents/${id}/content`, viewer, 'PUT', { ...file(), version: 1 })).status, 404);
    assert.equal((await request(`/api/documents/${id}`, viewer, 'DELETE')).status, 404);
    assert.equal((await request(`/api/documents/${id}/grants`, viewer, 'POST', { userId: 'bob', permission: 'read' })).status, 404);
  });
  await t.test('edit grant allows changes with version checks, but not ownership operations', async () => {
    await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'viewer', permission: 'edit' });
    assert.equal((await request(`/api/documents/${id}`, viewer, 'PATCH', { category: 'Reviewed', version: 1 })).status, 200);
    assert.equal((await request(`/api/documents/${id}`, alice, 'PATCH', { category: 'Stale', version: 1 })).status, 409);
    assert.equal((await request(`/api/documents/${id}/content`, viewer, 'PUT', { ...file('revision.txt'), version: 2 })).status, 200);
    assert.equal((await request(`/api/documents/${id}`, viewer, 'DELETE')).status, 404);
    assert.equal((await request(`/api/documents/${id}/grants`, viewer)).status, 404);
    assert.equal((await request(`/api/documents/${id}/grants/bob`, viewer, 'DELETE')).status, 404);
  });
  await t.test('revocation blocks all subsequent operations using an already-issued session', async () => {
    assert.equal((await request(`/api/documents/${id}/grants/viewer`, alice, 'DELETE')).status, 200);
    assert.equal((await request(`/api/documents/${id}/content`, viewer)).status, 404);
    assert.equal((await request(`/api/documents/${id}`, viewer)).status, 404);
    assert.equal((await request(`/api/documents/${id}`, viewer, 'PATCH', { category: 'After revoke', version: 3 })).status, 404);
    assert.equal((await request(`/api/documents/${id}/content`, viewer, 'PUT', { ...file(), version: 3 })).status, 404);
    assert.equal((await request('/api/documents', viewer)).data.documents.length, 0);
  });
  await t.test('upload validation refuses traversal, executable formats, wrong signatures and invalid encoding', async () => {
    for (const input of [file('../escape.txt'),file('.hidden.txt'),file('page.html'),file('fake.pdf'),{ ...file(), base64: '!!!!' },{ ...file(), base64: '' },{ ...file(), base64: Buffer.from([0,1,2,3]).toString('base64') },{ ...file(), base64: Buffer.from([255,254]).toString('base64') }]) {
      assert.equal((await request('/api/documents', alice, 'POST', input)).status, 400);
    }
    assert.equal((await request('/api/documents', alice, 'POST', { ...file(), base64: Buffer.alloc(5 * 1024 * 1024 + 1, 65).toString('base64') })).status, 400);
    assert.equal((await request('/data/trustvault.db', null)).status, 404);
    assert.equal((await request('/src/schema.sql', null)).status, 404);
  });
  await t.test('admin has audit access but no implicit file access; named grant works', async () => {
    assert.equal((await request('/api/audit', viewer)).status, 403);
    assert.equal((await request('/api/audit/verify', alice)).status, 403);
    const events = (await request('/api/audit', admin)).data.events;
    assert(events.some(e => e.action === 'document.download' && e.actorId === 'viewer' && e.target === id));
    assert(events.some(e => e.outcome === 'denied' && e.target === id));
    assert(events.some(e => e.action === 'permission.revoke'));
    assert.equal((await request('/api/audit/verify', admin)).data.valid, true);
    const bobEvents = (await request('/api/audit', bob)).data.events;
    assert(!bobEvents.some(e => e.action === 'document.download' && e.target === id));
    await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'admin', permission: 'read' });
    assert.equal((await request(`/api/documents/${id}/content`, admin)).status, 200);
    await request(`/api/documents/${id}/grants/admin`, alice, 'DELETE');
    assert.equal((await request(`/api/documents/${id}/content`, admin)).status, 404);
  });
  await t.test('account disable invalidates old sessions, including after re-enable', async () => {
    await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'viewer', permission: 'read' });
    assert.equal((await request('/api/users/viewer', admin, 'PATCH', { active: false })).status, 200);
    assert.equal((await request(`/api/documents/${id}/content`, viewer)).status, 401);
    assert.equal((await request('/api/login', null, 'POST', { email: 'viewer@trustvault.demo', password: PASSWORD })).status, 401);
    await request('/api/users/viewer', admin, 'PATCH', { active: true });
    assert.equal((await request('/api/session', viewer)).status, 401);
    const newViewer = await login('viewer');
    assert.equal((await request(`/api/documents/${id}/content`, newViewer)).status, 200);
  });
  await t.test('a body paused during disable cannot use stale authenticated state', async () => {
    const bytes = JSON.stringify({ category: 'Paused update', version: 3 });
    const stream = http.request(`${base}/api/documents/${id}`, { method: 'PATCH', headers: { Origin: ORIGIN, Cookie: alice.cookie, 'X-CSRF-Token': alice.csrf, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bytes) } });
    const completed = new Promise((resolve, reject) => { stream.on('response', res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); stream.on('error', reject); });
    stream.flushHeaders(); stream.write(bytes.slice(0, 5));
    // Wait until the server has received the partial body without relying on a timer.
    await request('/health', null);
    await request('/api/users/alice', admin, 'PATCH', { active: false });
    stream.end(bytes.slice(5));
    assert.equal(await completed, 401);
    await request('/api/users/alice', admin, 'PATCH', { active: true });
  });
  await t.test('expired sessions and logout are enforced on the server', async () => {
    raw.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run('bob');
    assert.equal((await request('/api/session', bob)).status, 401);
    const fresh = await login('alice');
    assert.equal((await request('/api/logout', fresh, 'POST', {})).status, 200);
    assert.equal((await request('/api/session', fresh)).status, 401);
  });
  await t.test('audit triggers reject changes; audit failure rolls document changes back', async () => {
    assert.throws(() => raw.exec("UPDATE audit SET event='{}' WHERE seq=1"), /append-only/);
    assert.throws(() => raw.exec('DELETE FROM audit WHERE seq=1'), /append-only/);
    const fresh = await login('alice');
    const before = raw.prepare('SELECT count(*) AS n FROM documents').get().n;
    raw.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'simulated audit storage failure'); END");
    assert.equal((await request('/api/documents', fresh, 'POST', file())).status, 500);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM documents').get().n, before);
    const failedDownload = await request(`/api/documents/${id}/content`, fresh);
    assert.equal(failedDownload.status, 500);
    assert.equal(failedDownload.data.error, 'Service unavailable. Please retry.');
    raw.exec('DROP TRIGGER test_audit_failure');
    assert.equal((await app.verifyAudit()).valid, true);
    assert.equal((await request(`/api/documents/${id}`, fresh, 'DELETE')).status, 200);
    assert.equal((await request(`/api/documents/${id}/content`, fresh)).status, 404);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM grants WHERE document_id=?').get(id).n, 0);
    assert((await request('/api/audit', admin)).data.events.some(e => e.action === 'document.delete' && e.target === id));
  });
  await t.test('an altered stored event fails cryptographic verification and blocks restart', async () => {
    const copyDir = mkdtempSync(join(tmpdir(), 'trustvault-tamper-'));
    try {
      raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      copyFileSync(join(dir, 'trustvault.db'), join(copyDir, 'trustvault.db'));
      const copy = new DatabaseSync(join(copyDir, 'trustvault.db'));
      copy.exec('DROP TRIGGER audit_no_update'); copy.exec("UPDATE audit SET event='{}' WHERE seq=1"); copy.close();
      await assert.rejects(async () => {
        const unexpected = await createVault({ dataDir: copyDir, origin: ORIGIN, auditKey: KEY });
        await unexpected.close(); // Also release handles when mutation testing disables the rejection.
      }, /Audit verification failed/);
    } finally { rmSync(copyDir, { recursive: true, force: true }); }
  });
  await t.test('sign-in throttling and generic errors limit account probing', async () => {
    const attempt = await request('/api/login', null, 'POST', { email: 'unknown@trustvault.demo', password: 'wrong' });
    assert.equal(attempt.status, 401); assert.equal(attempt.data.error, 'Email or password incorrect');
    let status;
    for (let i = 0; i < 12; i++) status = (await request('/api/login', null, 'POST', { email: 'unknown@trustvault.demo', password: 'wrong' })).status;
    assert.equal(status, 429);
  });
});

test('document quota is enforced without mutating existing documents', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'trustvault-quota-'));
  const app = await createVault({ dataDir: dir, origin: ORIGIN, auditKey: KEY, seedPassword: PASSWORD });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alice@trustvault.demo', password: PASSWORD }) });
  const { csrf } = await login.json(); const cookie = login.headers.get('set-cookie').split(';')[0];
  for (let index = 0; index < 40; index++) {
    const response = await fetch(`${base}/api/documents`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf }, body: JSON.stringify(file(`quota-${index}.txt`)) });
    assert.equal(response.status, index < 39 ? 201 : 409); await response.arrayBuffer();
  }
  const listing = await fetch(`${base}/api/documents`, { headers: { Cookie: cookie } });
  assert.equal((await listing.json()).documents.length, 40);
});

test('production rejects an accidental ephemeral SQLite deployment', async () => {
  await assert.rejects(createVault({ production: true, origin: 'https://vault.test', auditKey: KEY }), /Production requires DATABASE_URL/);
});
