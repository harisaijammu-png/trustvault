import http from 'node:http';
import { openDatabase } from './database.mjs';
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const scrypt = promisify(scryptCallback);
const MAX_FILE = 5 * 1024 * 1024;
const MAX_BODY = 7 * 1024 * 1024 + 4096;
const SESSION_MS = 8 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: !!u.active });
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const metadata = d => ({ id: d.id, ownerId: d.owner_id, name: d.name, category: d.category, mime: d.mime, size: d.size, version: d.version, createdAt: d.created_at, updatedAt: d.updated_at });

async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function passwordMatches(password, encoded) {
  const [salt, expected] = encoded.split(':');
  return safeEqual((await scrypt(password, salt, 64)).toString('hex'), expected);
}
function text(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail(400, `Invalid ${label}`);
  return value.trim();
}
function fields(body, allowed) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !allowed.includes(k))) fail(400, 'Unexpected request fields');
}
function upload(body) {
  const name = text(body.name, 'filename', 120);
  if (!/^[\p{L}\p{N} _().-]+$/u.test(name) || name.startsWith('.')) fail(400, 'Unsafe filename');
  const category = text(body.category, 'category', 60);
  if (typeof body.base64 !== 'string' || body.base64.length > Math.ceil(MAX_FILE / 3) * 4 || body.base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(body.base64)) fail(400, 'Invalid file encoding');
  const content = Buffer.from(body.base64, 'base64');
  if (content.toString('base64') !== body.base64) fail(400, 'Invalid file encoding');
  if (!content.length || content.length > MAX_FILE) fail(400, 'Files must be between 1 byte and 5 MB');
  const ext = name.split('.').pop().toLowerCase();
  let mime;
  if (ext === 'pdf' && content.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
  if (ext === 'png' && content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  if (['jpg', 'jpeg'].includes(ext) && content[0] === 255 && content[1] === 216 && content[2] === 255) mime = 'image/jpeg';
  if (ext === 'txt') {
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(decoded)) mime = 'text/plain';
    } catch { /* invalid UTF-8 is refused */ }
  }
  if (!mime) fail(400, 'Supported files: UTF-8 TXT, PDF, PNG and JPEG with matching file signatures');
  return { name, category, content, mime };
}

export async function createVault(options = {}) {
  const { dataDir = './data', production = false, origin } = options;
  if (production && !options.databaseUrl && !options.database) throw new Error('Production requires DATABASE_URL; local SQLite is for development only');
  if (!origin || new URL(origin).origin !== origin || (production && !origin.startsWith('https://'))) throw new Error('Set APP_ORIGIN to the exact public origin (HTTPS in production)');
  mkdirSync(dataDir, { recursive: true });
  let auditKey = options.auditKey;
  if (!auditKey && !production) {
    const keyPath = resolve(dataDir, 'audit.key');
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    auditKey = readFileSync(keyPath, 'utf8');
  }
  if (!auditKey || auditKey.length < 32 || auditKey.includes('REPLACE_')) throw new Error('Set a random AUDIT_KEY of at least 32 characters');
  const db = options.database || await openDatabase(dataDir, options.databaseUrl);
  const { get, all, run } = db;
  const hmac = value => createHmac('sha256', auditKey).update(value).digest('hex');
  let transactionActive = false;
  async function audit(actor, action, target, outcome, requestId, detail = {}) {
    if (!transactionActive) return transaction(async () => audit(actor, action, target, outcome, requestId, detail));
    const previous = (await get('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1'))?.hash || 'GENESIS';
    const event = JSON.stringify({ at: new Date().toISOString(), actorId: actor?.id || null, action, target, outcome, requestId, detail });
    await run('INSERT INTO audit(event,previous_hash,hash) VALUES(?,?,?)', event, previous, hmac(`${previous}\n${event}`));
  }
  async function transaction(fn) {
    await db.begin();
    transactionActive = true;
    try { const result = await fn(); await db.commit(); return result; }
    catch (err) { await db.rollback(); throw err; }
    finally { transactionActive = false; }
  }
  async function verifyAudit() {
    let previous = 'GENESIS'; let count = 0;
    for (const row of await all('SELECT * FROM audit ORDER BY seq')) {
      if (row.previous_hash !== previous || !safeEqual(row.hash, hmac(`${previous}\n${row.event}`))) return { valid: false, firstInvalidSequence: row.seq, count };
      previous = row.hash; count++;
    }
    return { valid: true, count, head: previous, checkedAt: new Date().toISOString(), limitation: 'Keep this checkpoint outside this server. A valid chain alone cannot detect a deleted suffix or database rollback.' };
  }
  if (!(await verifyAudit()).valid) { await db.close(); throw new Error('Audit verification failed; refusing startup'); }
  if (!await get('SELECT id FROM users LIMIT 1')) {
    if (!options.seedPassword || options.seedPassword.length < 12 || options.seedPassword.includes('REPLACE_')) throw new Error('First startup requires DEMO_PASSWORD of at least 12 characters');
    const hash = await passwordHash(options.seedPassword);
    await transaction(async () => {
      for (const [id, name, role] of [['admin','Aditi Admin','admin'],['alice','Alice Owner','owner'],['bob','Bob Owner','owner'],['viewer','Vikram Viewer','viewer']]) {
        await run('INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)', id, `${id}@trustvault.demo`, name, role, hash);
      }
      for (const owner of ['alice', 'bob']) {
        const id = randomUUID(); const content = Buffer.from(`TrustVault sample owned by ${owner}.\nThis file contains fictional demonstration data only.\n`); const now = new Date().toISOString();
        await run('INSERT INTO documents(id,owner_id,name,category,mime,content,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', id, owner, `${owner}-welcome.txt`, 'Demo', 'text/plain', content, content.length, now, now);
        await audit({ id: owner }, 'document.upload', id, 'allowed', 'seed', { name: `${owner}-welcome.txt` });
      }
      await audit(null, 'system.seed', null, 'allowed', 'seed', { users: 4 });
    });
  }
  const dummyHash = await passwordHash(randomBytes(32).toString('hex'));
  const attempts = new Map();
  let activeLogins = 0;
  function throttle(key) {
    const now = Date.now();
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    const value = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (value.count >= 10 || attempts.size > 10000) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    value.count++; attempts.set(key, value);
  }
  async function session(req) {
    const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('tv_session='))?.slice(11);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const found = await get('SELECT u.*,s.csrf,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', digest(raw), Date.now());
    return found || null;
  }
  async function authorize(actor, id, capability) {
    const doc = await get('SELECT * FROM documents WHERE id=?', id);
    if (!doc) fail(404, 'Document unavailable');
    const grant = (await get('SELECT permission FROM grants WHERE document_id=? AND user_id=?', id, actor.id))?.permission;
    const owner = doc.owner_id === actor.id;
    const allowed = owner || (capability === 'read' && !!grant) || (capability === 'edit' && grant === 'edit');
    if (!allowed) fail(404, 'Document unavailable');
    return { ...doc, access: owner ? 'owner' : grant };
  }
  const staticFiles = new Map([
    ['/', ['index.html','text/html; charset=utf-8']],
    ['/app.js', ['app.js','text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ]);
  let queue = Promise.resolve();
  async function acquire() {
    const previous = queue; let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous; return release;
  }
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const headers = {
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Request-ID': requestId,
    };
    if (production) headers['Strict-Transport-Security'] = 'max-age=31536000';
    res.setHeaders(new Map(Object.entries(headers)));
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    let actor = null; let target = null; let action = 'request'; let documentRoute = false; let release = null;
    try {
      const url = new URL(req.url, origin); const path = url.pathname;
      if (req.method === 'GET' && staticFiles.has(path)) {
        const [file, type] = staticFiles.get(path);
        const bytes = readFileSync(new URL(`../public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type }); res.end(bytes); return;
      }
      if (path === '/health' && req.method === 'GET') { json(200, { status: 'ok' }); return; }
      if (!path.startsWith('/api/')) fail(404, 'Route not found');
      const match = path.match(/^\/api\/documents\/([a-f0-9-]{36})(?:\/(content|grants)(?:\/([a-z]+))?)?$/);
      documentRoute = path.startsWith('/api/documents');
      target = match?.[1] || null;
      action = `${req.method} ${path.slice(0, 200)}`;
      if (!['GET','POST','PATCH','DELETE','PUT'].includes(req.method)) fail(405, 'Method not allowed');
      if (req.method !== 'GET' && req.headers.origin !== origin) fail(403, 'Request origin rejected');
      let body = {};
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        if ((req.headers['content-type'] || '').split(';')[0] !== 'application/json') fail(415, 'Use application/json');
        if (Number(req.headers['content-length'] || 0) > MAX_BODY) fail(413, 'Request too large');
        let length = 0; const chunks = [];
        for await (const chunk of req) {
          length += chunk.length;
          if (length > MAX_BODY) fail(413, 'Request too large');
          chunks.push(chunk);
        }
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Invalid JSON'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'Expected a JSON object');
      }
      release = await acquire();
      if (!(path === '/api/login' && req.method === 'POST')) {
        // Reading a body yields control. A logout/disable may have happened meanwhile.
        actor = await session(req);
        if (!actor) fail(401, 'Please sign in');
        if (req.method !== 'GET' && !safeEqual(req.headers['x-csrf-token'], actor.csrf)) fail(403, 'Invalid CSRF token');
      }
      if (path === '/api/login' && req.method === 'POST') {
        fields(body, ['email','password']);
        const email = text(body.email, 'email', 120).toLowerCase();
        if (typeof body.password !== 'string' || body.password.length > 256) fail(400, 'Invalid password');
        throttle(`email:${email}`); throttle(`socket:${req.socket.remoteAddress}`);
        if (activeLogins >= 4) fail(429, 'Sign-in busy; try again shortly');
        const user = await get('SELECT * FROM users WHERE email=?', email);
        let matches;
        activeLogins++;
        try { matches = await passwordMatches(body.password, user?.password_hash || dummyHash); }
        finally { activeLogins--; }
        // Re-read account state after the asynchronous password check.
        if (!matches || !user || !(await get('SELECT active FROM users WHERE id=?', user.id))?.active) {
          await audit(user, 'auth.login', null, 'denied', requestId); fail(401, 'Email or password incorrect');
        }
        const token = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex');
        await transaction(async () => {
          await run('DELETE FROM sessions WHERE expires_at<=?', Date.now());
          await run('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)', digest(token), user.id, csrf, Date.now() + SESSION_MS);
          await audit(user, 'auth.login', null, 'allowed', requestId);
        });
        res.setHeader('Set-Cookie', `tv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? '; Secure' : ''}`);
        json(200, { user: publicUser(user), csrf }); return;
      }
      if (path === '/api/session' && req.method === 'GET') { json(200, { user: publicUser(actor), csrf: actor.csrf }); return; }
      if (path === '/api/logout' && req.method === 'POST') {
        fields(body, []);
        await transaction(async () => { await run('DELETE FROM sessions WHERE token_hash=?', actor.token_hash); await audit(actor, 'auth.logout', null, 'allowed', requestId); });
        res.setHeader('Set-Cookie', `tv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
        json(200, { ok: true }); return;
      }
      if (path === '/api/users' && req.method === 'GET') {
        // Explicit company directory, never passwords or session fields.
        json(200, { users: (await all('SELECT id,email,name,role,active FROM users ORDER BY name')).map(publicUser) }); return;
      }
      const userMatch = path.match(/^\/api\/users\/([a-z]+)$/);
      if (userMatch && req.method === 'PATCH') {
        if (actor.role !== 'admin') fail(403, 'Administrator required');
        fields(body, ['active']);
        if (typeof body.active !== 'boolean' || actor.id === userMatch[1]) fail(400, 'Choose another account and a valid active state');
        if (!await get('SELECT id FROM users WHERE id=?', userMatch[1])) fail(404, 'User unavailable');
        await transaction(async () => {
          await run('UPDATE users SET active=? WHERE id=?', body.active ? 1 : 0, userMatch[1]);
          await run('DELETE FROM sessions WHERE user_id=?', userMatch[1]);
          await audit(actor, 'user.status', userMatch[1], 'allowed', requestId, { active: body.active });
        });
        json(200, { ok: true }); return;
      }
      if (path === '/api/documents' && req.method === 'GET') {
        const query = url.searchParams;
        if ([...query.keys()].some(k => !['name','owner','category','from','to'].includes(k))) fail(400, 'Unknown search filter');
        for (const key of ['from','to']) {
          const date = query.get(key);
          if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date)) fail(400, 'Use valid YYYY-MM-DD dates');
        }
        const docs = await all(`SELECT d.id,d.owner_id,d.name,d.category,d.mime,d.size,d.version,d.created_at,d.updated_at,u.name AS owner_name,CASE WHEN d.owner_id=? THEN 'owner' ELSE g.permission END AS access
          FROM documents d JOIN users u ON u.id=d.owner_id LEFT JOIN grants g ON g.document_id=d.id AND g.user_id=?
          WHERE (d.owner_id=? OR g.user_id IS NOT NULL)
          AND instr(lower(d.name),lower(?))>0 AND instr(lower(u.name),lower(?))>0
          AND instr(lower(d.category),lower(?))>0 AND (?='' OR substr(d.created_at,1,10)>=?) AND (?='' OR substr(d.created_at,1,10)<=?)
          ORDER BY d.updated_at DESC LIMIT 200`, actor.id, actor.id, actor.id, (query.get('name') || '').slice(0,120), (query.get('owner') || '').slice(0,120), (query.get('category') || '').slice(0,60), query.get('from') || '', query.get('from') || '', query.get('to') || '', query.get('to') || '');
        json(200, { documents: docs.map(d => ({ ...metadata(d), ownerName: d.owner_name, access: d.access })), limit: 200 }); return;
      }
      if (path === '/api/documents' && req.method === 'POST') {
        if (actor.role !== 'owner') fail(403, 'Document owner role required');
        fields(body, ['name','category','base64']); const file = upload(body); const id = randomUUID(); target = id;
        await transaction(async () => {
          if (Number((await get('SELECT count(*) AS n FROM documents')).n) >= 100 || Number((await get('SELECT count(*) AS n FROM documents WHERE owner_id=?', actor.id)).n) >= 40) fail(409, 'Document quota reached (40 per owner, 100 total)');
          const now = new Date().toISOString();
          await run('INSERT INTO documents(id,owner_id,name,category,mime,content,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', id, actor.id, file.name, file.category, file.mime, file.content, file.content.length, now, now);
          await audit(actor, 'document.upload', id, 'allowed', requestId, { name: file.name });
        });
        json(201, { document: metadata(await get('SELECT * FROM documents WHERE id=?', id)) }); return;
      }
      if (match) {
        const [, id, sub, grantee] = match;
        if (!sub && req.method === 'GET') {
          const doc = await authorize(actor, id, 'read');
          await audit(actor, 'document.inspect', id, 'allowed', requestId);
          json(200, { document: { ...metadata(doc), access: doc.access } }); return;
        }
        if (sub === 'content' && !grantee && req.method === 'GET') {
          const doc = await transaction(async () => { const d = await authorize(actor, id, 'read'); await audit(actor, 'document.download', id, 'allowed', requestId, { version: d.version }); return d; });
          res.writeHead(200, { 'Content-Type': doc.mime, 'Content-Disposition': `attachment; filename="document.${doc.name.split('.').pop().toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Content-Length': doc.size });
          res.end(Buffer.from(doc.content)); return;
        }
        if (!sub && req.method === 'PATCH') {
          fields(body, ['category','version']); const category = text(body.category, 'category', 60);
          await transaction(async () => {
            const doc = await authorize(actor, id, 'edit');
            if (!Number.isSafeInteger(body.version) || doc.version !== body.version) fail(409, 'Document changed. Refresh and try again.');
            await run('UPDATE documents SET category=?,version=version+1,updated_at=? WHERE id=?', category, new Date().toISOString(), id);
            await audit(actor, 'document.metadata', id, 'allowed', requestId, { version: doc.version + 1, category });
          });
          json(200, { ok: true }); return;
        }
        if (sub === 'content' && !grantee && req.method === 'PUT') {
          fields(body, ['name','category','base64','version']); const file = upload(body);
          await transaction(async () => {
            const doc = await authorize(actor, id, 'edit');
            if (!Number.isSafeInteger(body.version) || doc.version !== body.version) fail(409, 'Document changed. Refresh and try again.');
            await run('UPDATE documents SET name=?,category=?,mime=?,content=?,size=?,version=version+1,updated_at=? WHERE id=?', file.name, file.category, file.mime, file.content, file.content.length, new Date().toISOString(), id);
            await audit(actor, 'document.replace', id, 'allowed', requestId, { version: doc.version + 1, name: file.name });
          });
          json(200, { ok: true }); return;
        }
        if (!sub && req.method === 'DELETE') {
          await transaction(async () => { await authorize(actor, id, 'owner'); await run('DELETE FROM documents WHERE id=?', id); await audit(actor, 'document.delete', id, 'allowed', requestId); });
          json(200, { ok: true }); return;
        }
        if (sub === 'grants' && !grantee && req.method === 'GET') {
          await authorize(actor, id, 'owner');
          json(200, { grants: await all('SELECT g.user_id AS "userId",g.permission,u.name,u.email FROM grants g JOIN users u ON u.id=g.user_id WHERE g.document_id=? ORDER BY u.name', id) }); return;
        }
        if (sub === 'grants' && !grantee && req.method === 'POST') {
          fields(body, ['userId','permission']);
          await transaction(async () => {
            await authorize(actor, id, 'owner');
            if (!['read','edit'].includes(body.permission) || typeof body.userId !== 'string' || body.userId === actor.id) fail(400, 'Choose another user and read/edit permission');
            if (!await get('SELECT id FROM users WHERE id=? AND active=1', body.userId)) fail(400, 'Choose an active user');
            await run('INSERT INTO grants(document_id,user_id,permission) VALUES(?,?,?) ON CONFLICT(document_id,user_id) DO UPDATE SET permission=excluded.permission', id, body.userId, body.permission);
            await audit(actor, 'permission.grant', id, 'allowed', requestId, { userId: body.userId, permission: body.permission });
          });
          json(200, { ok: true }); return;
        }
        if (sub === 'grants' && grantee && req.method === 'DELETE') {
          await transaction(async () => { await authorize(actor, id, 'owner'); await run('DELETE FROM grants WHERE document_id=? AND user_id=?', id, grantee); await audit(actor, 'permission.revoke', id, 'allowed', requestId, { userId: grantee }); });
          json(200, { ok: true }); return;
        }
      }
      if (path === '/api/audit' && req.method === 'GET') {
        if (actor.role !== 'admin' && actor.role !== 'owner') fail(403, 'Owner or administrator required');
        const rows = actor.role === 'admin'
          ? await all('SELECT * FROM audit ORDER BY seq DESC LIMIT 200')
          : await all("SELECT a.* FROM audit a WHERE json_extract(a.event,'$.actorId')=? OR json_extract(a.event,'$.target') IN (SELECT id FROM documents WHERE owner_id=?) ORDER BY a.seq DESC LIMIT 200", actor.id, actor.id);
        json(200, { events: rows.map(r => ({ seq: r.seq, ...JSON.parse(r.event), hash: r.hash })), limit: 200 }); return;
      }
      if (path === '/api/audit/verify' && req.method === 'GET') {
        if (actor.role !== 'admin') fail(403, 'Administrator required');
        json(200, await verifyAudit()); return;
      }
      fail(404, 'Route not found');
    } catch (error) {
      if (!release) release = await acquire();
      let status = error.status || 500;
      try {
        if (status < 500 && (documentRoute || status === 403)) await audit(actor, 'request.refused', target, 'denied', requestId, { route: action, status });
      } catch { status = 503; }
      if (status >= 500) console.error(`Request ${requestId} failed (${error.code || 'internal'})`);
      if (!res.headersSent) json(status, { error: status >= 500 ? 'Service unavailable. Please retry.' : error.message, requestId });
      else res.destroy();
    } finally { if (release) release(); }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return { server, close: () => db.close(), verifyAudit };
}
