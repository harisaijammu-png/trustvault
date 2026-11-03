import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter, postgresConnectionOptions } from '../src/database.mjs';
import { Client } from 'pg';
import { createVault } from '../src/app.mjs';

test('invalid database configuration reports guidance without exposing supplied credentials', () => {
  for (const input of ['require&channel_binding=require', "psql 'postgresql://demo:DO-NOT-LOG-THIS@db.example/vault'", 'https://demo:DO-NOT-LOG-THIS@db.example/vault', 'postgresql://db.example/']) {
    let error;
    try { postgresConnectionOptions(input); } catch (caught) { error = caught; }
    assert(error instanceof Error);
    assert.match(error.message, /DATABASE_URL/);
    assert.equal(error.message.includes('DO-NOT-LOG-THIS'), false);
    assert.equal(Object.hasOwn(error, 'input'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
  }
});

test('PostgreSQL URL options cannot disable TLS certificate verification', () => {
  for (const query of ['ssl=false', 'sslmode=disable', 'sslmode=no-verify', 'sslmode=require&sslrootcert=attacker']) {
    const options = postgresConnectionOptions(`postgresql://demo:fake-password@db.example/vault?${query}`);
    const client = new Client(options);
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(new URL(options.connectionString).search, '');
  }
});

test('PostgreSQL engine: schema, byte storage, grants, search, revocation, transactions and audit', async t => {
  const engine = new PGlite();
  await engine.exec(readFileSync(new URL('../src/schema.postgres.sql', import.meta.url), 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'trustvault-pg-'));
  const adapter = postgresAdapter({ query: (sql, args) => engine.query(sql, args), end: () => engine.close() });
  const password = 'Postgres-Test-Password!';
  const app = await createVault({ dataDir: dir, database: adapter, auditKey: 'postgres-test-key-at-least-32-characters', origin: 'http://pg.test', seedPassword: password });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); await app.close(); rmSync(dir, { recursive: true, force: true }); });
  async function request(path, session, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method, headers: { Origin: 'http://pg.test', ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
  }
  async function login(id) {
    const response = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: 'http://pg.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${id}@trustvault.demo`, password }) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data));
    return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: data.csrf };
  }
  const alice = await login('alice'); const bob = await login('bob'); const viewer = await login('viewer'); const admin = await login('admin');
  const payload = { name: 'postgres-contract.txt', category: 'Legal', base64: Buffer.from('PostgreSQL document bytes.').toString('base64') };
  const created = await request('/api/documents', alice, 'POST', payload);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.document.id;
  for (const person of [bob, viewer, admin]) {
    for (const suffix of ['', '/content', '/grants']) assert.equal((await request(`/api/documents/${id}${suffix}`, person)).status, 404);
    assert.equal((await request(`/api/documents/${id}`, person, 'PATCH', { category: 'Attack', version: 1 })).status, 404);
    assert.equal((await request(`/api/documents/${id}/content`, person, 'PUT', { ...payload, version: 1 })).status, 404);
    assert.equal((await request(`/api/documents/${id}`, person, 'DELETE')).status, 404);
    assert.equal((await request(`/api/documents/${id}/grants`, person, 'POST', { userId: 'bob', permission: 'edit' })).status, 404);
    assert.equal((await request('/api/documents?name=postgres&owner=Alice&category=Legal&from=2020-01-01&to=2099-01-01', person)).data.documents.length, 0);
  }
  assert.equal((await request('/api/documents?name=postgres&owner=Alice&category=Legal&from=2020-01-01&to=2099-01-01', alice)).data.documents.length, 1);
  assert.equal((await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'viewer', permission: 'read' })).status, 200);
  assert.equal((await request(`/api/documents/${id}/grants`, alice)).data.grants[0].userId, 'viewer');
  assert.equal((await request(`/api/documents/${id}/content`, viewer)).data, 'PostgreSQL document bytes.');
  assert.equal((await request(`/api/documents/${id}`, viewer, 'PATCH', { category: 'No', version: 1 })).status, 404);
  await request(`/api/documents/${id}/grants`, alice, 'POST', { userId: 'viewer', permission: 'edit' });
  assert.equal((await request(`/api/documents/${id}/content`, viewer, 'PUT', { ...payload, version: 1 })).status, 200);
  assert.equal((await request(`/api/documents/${id}`, viewer, 'PATCH', { category: 'No', version: 1 })).status, 409);
  await request(`/api/documents/${id}/grants/viewer`, alice, 'DELETE');
  assert.equal((await request(`/api/documents/${id}/content`, viewer)).status, 404);
  assert.equal((await request('/api/documents', viewer)).data.documents.length, 0);
  const events = await request('/api/audit', alice);
  assert.equal(events.status, 200, JSON.stringify(events.data));
  assert(events.data.events.some(e => e.action === 'document.download' && e.actorId === 'viewer'));
  assert.equal((await request('/api/audit/verify', admin)).data.valid, true);
  await assert.rejects(engine.query("UPDATE audit SET event='{}' WHERE seq=1"), /append-only/);
  await assert.rejects(engine.query('TRUNCATE audit'), /append-only/);
  // PostgreSQL identity sequences can have gaps after rollback. A valid hash
  // chain must remain valid after the next successful append.
  await adapter.begin();
  await adapter.run('INSERT INTO audit(event,previous_hash,hash) VALUES(?,?,?)', '{}', 'unused', 'unused');
  await adapter.rollback();
  await request(`/api/documents/${id}`, alice, 'DELETE');
  assert.equal((await request('/api/audit/verify', admin)).data.valid, true);
  assert.equal((await request(`/api/documents/${id}/content`, alice)).status, 404);
  await request('/api/users/viewer', admin, 'PATCH', { active: false });
  assert.equal((await request('/api/session', viewer)).status, 401);
});
