// Run only against your own demonstration deployment. Creates one disposable
// document and deletes it as its owner in finally. Never use real documents.
const origin = process.env.TRUSTVAULT_TEST_ORIGIN || 'https://trustvault-3wp4.onrender.com';
const password = process.env.TRUSTVAULT_DEMO_PASSWORD;
if (!password) throw new Error('Set TRUSTVAULT_DEMO_PASSWORD privately before running.');
if (origin !== 'https://trustvault-3wp4.onrender.com') throw new Error('Unexpected live test destination');
const results = [];
async function request(path, session, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method, signal: AbortSignal.timeout(60000),
    headers: { Origin: origin, ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { response, data, status: response.status };
}
async function login(name) {
  const result = await request('/api/login', null, 'POST', { email: `${name}@trustvault.demo`, password });
  if (result.status !== 200) throw new Error(`Sign-in failed for ${name} (${result.status}); check demo credentials/account state.`);
  return { cookie: result.response.headers.get('set-cookie').split(';')[0], csrf: result.data.csrf };
}
async function expect(label, path, actor, method, body, expected) {
  const result = await request(path, actor, method, body);
  const passed = result.status === expected;
  results.push({ check: label, status: result.status, expected, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label} (${result.status})`);
  if (!passed) throw new Error(`Unexpected response for ${label}; investigate before claiming this check passed.`);
  return result.data;
}
let owner; let docId;
try {
  owner = await login('alice');
  const reader = await login('viewer');
  const editor = await login('bob');
  const payload = { name: `permission-check-${Date.now()}.txt`, category: 'Disposable live test', base64: Buffer.from('Fictional permission test fixture. Safe to delete.').toString('base64') };
  const created = await request('/api/documents', owner, 'POST', payload);
  if (created.status !== 201) throw new Error(`Cannot create disposable test document (${created.status}).`);
  docId = created.data.document.id;
  console.log(`Disposable test document: ${docId}`);
  await expect('owner grants viewer read access', `/api/documents/${docId}/grants`, owner, 'POST', { userId: 'viewer', permission: 'read' }, 200);
  await expect('read grantee can inspect', `/api/documents/${docId}`, reader, 'GET', undefined, 200);
  await expect('read grantee cannot change category', `/api/documents/${docId}`, reader, 'PATCH', { category: 'Disposable live test', version: 1 }, 404);
  await expect('read grantee cannot replace bytes', `/api/documents/${docId}/content`, reader, 'PUT', { ...payload, version: 1 }, 404);
  await expect('read grantee cannot share', `/api/documents/${docId}/grants`, reader, 'POST', { userId: 'bob', permission: 'read' }, 404);
  await expect('read grantee cannot delete', `/api/documents/${docId}`, reader, 'DELETE', undefined, 404);
  await expect('owner grants Bob edit access', `/api/documents/${docId}/grants`, owner, 'POST', { userId: 'bob', permission: 'edit' }, 200);
  await expect('edit grantee can change category', `/api/documents/${docId}`, editor, 'PATCH', { category: 'Disposable reviewed', version: 1 }, 200);
  await expect('edit grantee cannot list grants', `/api/documents/${docId}/grants`, editor, 'GET', undefined, 404);
  await expect('edit grantee cannot share', `/api/documents/${docId}/grants`, editor, 'POST', { userId: 'viewer', permission: 'edit' }, 404);
  await expect('edit grantee cannot revoke', `/api/documents/${docId}/grants/viewer`, editor, 'DELETE', undefined, 404);
  await expect('edit grantee cannot delete', `/api/documents/${docId}`, editor, 'DELETE', undefined, 404);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (owner && docId) {
    try {
      const cleanup = await request(`/api/documents/${docId}`, owner, 'DELETE');
      const passed = cleanup.status === 200;
      results.push({ check: 'owner cleanup', status: cleanup.status, expected: 200, passed });
      console.log(`${passed ? 'PASS' : 'FAIL'}: owner cleanup (${cleanup.status})`);
      if (!passed) process.exitCode = 1;
    } catch { console.error(`Cleanup failed; Alice must remove disposable document ${docId}.`); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), origin, results }, null, 2));
}
