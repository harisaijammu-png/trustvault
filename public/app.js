const $ = selector => document.querySelector(selector);
let user = null;
let csrf = null;
let users = [];
let documents = [];
function notice(message = '', error = false) {
  $('#notice').textContent = message;
  $('#notice').className = error ? 'error' : '';
  $('#dialog-notice').textContent = $('#document-dialog').open ? message : '';
}
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && user) showLogin();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function button(label, fn, className = 'secondary') {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', () => perform(node, fn));
  return node;
}
async function perform(control, fn) {
  control.disabled = true;
  try { notice(); await fn(); } catch (error) { notice(error.message, true); }
  finally { control.disabled = false; }
}
function showLogin() {
  user = null; csrf = null; users = []; documents = [];
  $('#document-dialog').close();
  $('#document-detail').replaceChildren();
  $('#document-list').replaceChildren();
  $('#audit-rows').replaceChildren();
  $('#accounts-list').replaceChildren();
  $('#verification').textContent = '';
  $('#identity').textContent = '';
  $('#vault-view').hidden = true;
  $('#login-view').hidden = false;
}
async function showVault(session) {
  user = session.user; csrf = session.csrf;
  $('#login-form').reset();
  $('#login-view').hidden = true; $('#vault-view').hidden = false;
  $('#identity').textContent = `${user.name} · ${user.role}`;
  $('#role-note').textContent = user.role === 'admin' ? 'Review activity and account access. Reading a file still requires a named grant.' : user.role === 'owner' ? 'Manage your documents and files shared with you.' : 'Only documents shared with you appear here.';
  $('#upload-form').hidden = user.role !== 'owner';
  $('#activity-tab').hidden = user.role === 'viewer';
  $('#accounts-tab').hidden = user.role !== 'admin';
  $('#audit-tools').hidden = user.role !== 'admin';
  users = (await api('/api/users')).users;
  selectTab('documents');
  await refreshDocuments();
}
function selectTab(name) {
  for (const tab of ['documents','activity','accounts']) {
    $(`#${tab}-view`).hidden = name !== tab;
    $(`#${tab}-tab`).classList.toggle('active', name === tab);
  }
}
async function refreshDocuments() {
  const query = new URLSearchParams(new FormData($('#search-form')));
  documents = (await api(`/api/documents?${query}`)).documents;
  $('#document-count').textContent = documents.length;
  const list = $('#document-list'); list.replaceChildren();
  if (!documents.length) { list.append(element('div', 'empty', 'No documents match. Upload a file or ask its owner for access.')); return; }
  for (const doc of documents) {
    const card = element('article', 'document-card');
    const heading = element('h3', '', doc.name);
    card.append(element('span', 'file-icon', doc.name.split('.').pop().toUpperCase()), heading, element('span', 'badge', doc.access), element('p', '', `${doc.ownerName} · ${doc.category}`), element('p', '', `${formatSize(doc.size)} · Version ${doc.version} · ${new Date(doc.updatedAt).toLocaleDateString()}`), button('Open details →', () => openDocument(doc.id)));
    list.append(card);
  }
}
const formatSize = size => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`;
async function encodedFile(file) {
  if (!file || file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Choose a file between 1 byte and 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function field(form, title, name, value, type = 'text') {
  const label = element('label', '', title);
  const input = element('input'); input.name = name; input.type = type; input.required = true;
  if (type !== 'file') { input.value = value; input.maxLength = 60; }
  else input.accept = '.txt,.pdf,.png,.jpg,.jpeg';
  label.append(input); form.append(label); return input;
}
async function openDocument(id) {
  const doc = (await api(`/api/documents/${id}`)).document;
  $('#dialog-title').textContent = doc.name;
  const detail = $('#document-detail'); detail.replaceChildren();
  detail.append(element('div', 'detail-summary', `${doc.category} · ${formatSize(doc.size)} · Version ${doc.version}\nYour access: ${doc.access}`));
  detail.append(button('Download file', async () => {
    const response = await fetch(`/api/documents/${id}/content`, { credentials: 'same-origin' });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
    downloadBlob(await response.blob(), doc.name);
    notice('Download delivered. The server recorded this access.');
  }, ''));
  if (['owner','edit'].includes(doc.access)) {
    const form = element('form', 'detail-section');
    form.append(element('h3', '', 'Edit category'));
    field(form, 'Category', 'category', doc.category);
    const save = element('button', '', 'Save category'); save.type = 'submit'; form.append(save);
    form.addEventListener('submit', event => { event.preventDefault(); perform(save, async () => {
      await api(`/api/documents/${id}`, { method: 'PATCH', body: { category: form.elements.category.value, version: doc.version } });
      await refreshDocuments(); await openDocument(id); notice('Category saved.');
    }); });
    detail.append(form);
    const replace = element('form', 'detail-section'); replace.append(element('h3', '', 'Replace file'));
    field(replace, 'New file', 'file', '', 'file');
    const replaceButton = element('button', 'secondary', 'Upload new version'); replaceButton.type = 'submit'; replace.append(replaceButton);
    replace.addEventListener('submit', event => { event.preventDefault(); perform(replaceButton, async () => {
      const file = replace.elements.file.files[0];
      await api(`/api/documents/${id}/content`, { method: 'PUT', body: { name: file.name, category: doc.category, base64: await encodedFile(file), version: doc.version } });
      await refreshDocuments(); await openDocument(id); notice('File replaced.');
    }); }); detail.append(replace);
  }
  if (doc.access === 'owner') {
    const section = element('section', 'detail-section'); section.append(element('h3', '', 'Named access'));
    const grants = (await api(`/api/documents/${id}/grants`)).grants;
    if (!grants.length) section.append(element('p', 'fine', 'Only you can read this document.'));
    for (const grant of grants) {
      const row = element('div', 'grant-row'); row.append(element('span', '', `${grant.name} · ${grant.permission}`), button('Revoke', async () => {
        await api(`/api/documents/${id}/grants/${grant.userId}`, { method: 'DELETE' }); await openDocument(id); notice('Access revoked for subsequent requests.');
      }, 'danger')); section.append(row);
    }
    const form = element('form');
    const personLabel = element('label', '', 'Person'); const person = element('select'); person.name = 'userId'; person.required = true;
    const placeholder = element('option', '', 'Choose a named person'); placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true; person.append(placeholder);
    for (const u of users.filter(u => u.id !== user.id && u.active)) { const option = element('option', '', `${u.name} (${u.email})`); option.value = u.id; person.append(option); }
    personLabel.append(person); form.append(personLabel);
    const permissionLabel = element('label', '', 'Permission'); const permission = element('select'); permission.name = 'permission';
    for (const [value,label] of [['read','Read — download only'],['edit','Edit — replace file and change category']]) { const option = element('option', '', label); option.value = value; permission.append(option); }
    permissionLabel.append(permission); form.append(permissionLabel);
    const save = element('button', '', 'Confirm access grant'); save.type = 'submit'; form.append(save);
    form.addEventListener('submit', event => { event.preventDefault(); perform(save, async () => {
      await api(`/api/documents/${id}/grants`, { method: 'POST', body: { userId: person.value, permission: permission.value } }); await openDocument(id); notice('Named access saved.');
    }); }); section.append(form); detail.append(section);
    const danger = element('div', 'detail-section');
    danger.append(element('p', 'fine', 'Deletion permanently removes the file and its grants. Its audit record remains.'), button('Delete document', async () => {
      if (!window.confirm(`Permanently delete ${doc.name}? This cannot be undone.`)) return;
      await api(`/api/documents/${id}`, { method: 'DELETE' }); $('#document-dialog').close(); await refreshDocuments(); notice('Document deleted. Audit evidence retained.');
    }, 'danger')); detail.append(danger);
  }
  if (!$('#document-dialog').open) $('#document-dialog').showModal();
}
async function refreshActivity() {
  const { events } = await api('/api/audit');
  const rows = $('#audit-rows'); rows.replaceChildren();
  for (const event of events) {
    const row = element('tr');
    for (const value of [new Date(event.at).toLocaleString(), event.actorId || 'anonymous/system', event.action, event.outcome, `${event.target || '—'} ${JSON.stringify(event.detail)}`]) row.append(element('td', '', value));
    rows.append(row);
  }
}
async function refreshAccounts() {
  users = (await api('/api/users')).users;
  const list = $('#accounts-list'); list.replaceChildren();
  for (const account of users) {
    const card = element('article', 'document-card'); card.append(element('h3', '', account.name), element('p', '', account.email), element('span', 'badge', `${account.role} · ${account.active ? 'active' : 'disabled'}`));
    if (account.id !== user.id) card.append(button(account.active ? 'Disable account' : 'Enable account', async () => {
      await api(`/api/users/${account.id}`, { method: 'PATCH', body: { active: !account.active } }); await refreshAccounts(); notice('Account access updated. Previous sessions ended.');
    }, account.active ? 'danger' : 'secondary'));
    list.append(card);
  }
}
$('#login-form').addEventListener('submit', event => { event.preventDefault(); perform(event.submitter, async () => {
  const form = event.currentTarget;
  const data = await api('/api/login', { method: 'POST', body: { email: form.elements.email.value, password: form.elements.password.value } });
  await showVault(data);
}); });
$('#logout').addEventListener('click', event => perform(event.currentTarget, async () => { await api('/api/logout', { method: 'POST', body: {} }); showLogin(); notice('Signed out.'); }));
$('#upload-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; perform(event.submitter, async () => {
  const file = form.elements.file.files[0];
  await api('/api/documents', { method: 'POST', body: { name: file.name, category: form.elements.category.value, base64: await encodedFile(file) } });
  form.reset(); $('#search-form').reset(); await refreshDocuments(); notice('Document uploaded. Only you have access until you grant it.');
}); });
$('#search-form').addEventListener('submit', event => { event.preventDefault(); perform(event.submitter, refreshDocuments); });
$('#documents-tab').addEventListener('click', event => perform(event.currentTarget, async () => { selectTab('documents'); await refreshDocuments(); }));
$('#activity-tab').addEventListener('click', event => perform(event.currentTarget, async () => { selectTab('activity'); await refreshActivity(); }));
$('#accounts-tab').addEventListener('click', event => perform(event.currentTarget, async () => { selectTab('accounts'); await refreshAccounts(); }));
$('#refresh-activity').addEventListener('click', event => perform(event.currentTarget, refreshActivity));
$('#verify').addEventListener('click', event => perform(event.currentTarget, async () => {
  const report = await api('/api/audit/verify'); $('#verification').textContent = JSON.stringify(report, null, 2);
  if (!report.valid) throw new Error('Audit verification failed. Investigate before relying on these records.');
  downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `trustvault-checkpoint-${Date.now()}.json`);
}));
api('/api/session').then(showVault).catch(error => { showLogin(); if (error.message !== 'Please sign in') notice(error.message, true); });
