let directions = [];
let statuses   = [];
let persons    = [];

const PALETTE = [
  '#ef4444','#f97316','#eab308','#84cc16',
  '#22c55e','#10b981','#14b8a6','#06b6d4',
  '#0ea5e9','#3b82f6','#6366f1','#8b5cf6',
  '#a855f7','#ec4899','#f43f5e','#64748b',
  '#fca5a5','#fde68a','#bbf7d0','#bfdbfe',
  '#ddd6fe','#fbcfe8','#fed7aa','#d1fae5',
];

async function init() {
  bindEvents();
  await Promise.all([loadDirections(), loadStatuses(), loadPersons()]);
}

function bindEvents() {
  // Directions
  document.getElementById('showAddDirection').onclick = () => toggleRow('addDirectionRow', 'newDirectionName');
  document.getElementById('cancelDirectionBtn').onclick = () => hideRow('addDirectionRow');
  document.getElementById('saveDirectionBtn').onclick  = saveDirection;
  document.getElementById('newDirectionName').onkeydown = e => { if (e.key === 'Enter') saveDirection(); };

  // Statuses
  document.getElementById('showAddStatus').onclick = () => toggleRow('addStatusRow', 'newStatusName');
  document.getElementById('cancelStatusBtn').onclick = () => hideRow('addStatusRow');
  document.getElementById('saveStatusBtn').onclick   = saveStatus;
  document.getElementById('newStatusName').onkeydown = e => { if (e.key === 'Enter') saveStatus(); };

  // Person modal
  document.getElementById('showAddPerson').onclick = () => openPersonModal();
  document.getElementById('savePersonBtn').onclick  = savePerson;
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.onclick = () => document.getElementById(btn.dataset.close).classList.add('hidden')
  );
}

// ─── Directions ───────────────────────────────────────────
async function loadDirections() {
  const data = await api('directions');
  directions = data.directions || [];
  renderDirections();
  syncDirectionSelects();
}

function renderDirections() {
  const list = document.getElementById('directionsList');
  if (!directions.length) {
    list.innerHTML = '<div class="empty-hint">Нет направлений</div>';
    return;
  }
  list.innerHTML = directions.map(d => `
    <div class="setting-item" data-id="${d.id}">
      <span class="item-name" contenteditable="true" data-id="${d.id}" data-type="direction">${escHtml(d.name)}</span>
      <button class="btn-icon-del" data-id="${d.id}" data-type="direction" title="Удалить">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('.item-name[data-type="direction"]').forEach(el => {
    el.onblur = () => renameDirection(Number(el.dataset.id), el.textContent.trim());
    el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
  });
  list.querySelectorAll('.btn-icon-del[data-type="direction"]').forEach(btn =>
    btn.onclick = () => deleteDirection(Number(btn.dataset.id))
  );
}

async function saveDirection() {
  const name = document.getElementById('newDirectionName').value.trim();
  if (!name) return;
  await api('direction_save', { name });
  document.getElementById('newDirectionName').value = '';
  hideRow('addDirectionRow');
  await loadDirections();
}

async function renameDirection(id, name) {
  if (!name) return loadDirections();
  await api('direction_save', { id, name });
  directions = directions.map(d => d.id === id ? { ...d, name } : d);
  syncDirectionSelects();
}

async function deleteDirection(id) {
  if (!confirm('Удалить направление?')) return;
  await api('direction_delete', { id });
  await loadDirections();
}

function syncDirectionSelects() {
  const opts = '<option value="">— не выбрано —</option>' +
    directions.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  document.getElementById('personDirection').innerHTML = opts;
}

// ─── Statuses ─────────────────────────────────────────────
async function loadStatuses() {
  const data = await api('statuses');
  statuses = data.statuses || [];
  renderStatuses();
}

function renderStatuses() {
  const list = document.getElementById('statusesList');
  if (!statuses.length) {
    list.innerHTML = '<div class="empty-hint">Нет статусов</div>';
    return;
  }
  list.innerHTML = statuses.map((s, i) => `
    <div class="setting-item" data-id="${s.id}" draggable="true">
      <span class="drag-handle" title="Перетащить">⠿</span>
      <button class="color-swatch" data-id="${s.id}" style="background:${s.color || '#e2e8f0'}" title="Выбрать цвет"></button>
      <span class="item-name" contenteditable="true" data-id="${s.id}" data-type="status">${escHtml(s.name)}</span>
      <div class="item-actions">
        <button class="btn-icon-sm ${i === 0 ? 'disabled' : ''}" data-dir="up" data-id="${s.id}" title="Вверх">↑</button>
        <button class="btn-icon-sm ${i === statuses.length - 1 ? 'disabled' : ''}" data-dir="down" data-id="${s.id}" title="Вниз">↓</button>
        <button class="btn-icon-del" data-id="${s.id}" data-type="status" title="Удалить">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.color-swatch[data-id]').forEach(btn =>
    btn.onclick = e => openColorPicker(e, Number(btn.dataset.id))
  );
  list.querySelectorAll('.item-name[data-type="status"]').forEach(el => {
    el.onblur = () => renameStatus(Number(el.dataset.id), el.textContent.trim());
    el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
  });
  list.querySelectorAll('[data-dir]').forEach(btn => {
    if (btn.classList.contains('disabled')) return;
    btn.onclick = () => moveStatus(Number(btn.dataset.id), btn.dataset.dir);
  });
  list.querySelectorAll('.btn-icon-del[data-type="status"]').forEach(btn =>
    btn.onclick = () => deleteStatus(Number(btn.dataset.id))
  );

  setupDrag(list, statuses, 'status_reorder', () => loadStatuses());
}

async function saveStatus() {
  const name = document.getElementById('newStatusName').value.trim();
  if (!name) return;
  await api('status_save', { name });
  document.getElementById('newStatusName').value = '';
  hideRow('addStatusRow');
  await loadStatuses();
}

async function renameStatus(id, name) {
  if (!name) return loadStatuses();
  await api('status_save', { id, name });
  statuses = statuses.map(s => s.id === id ? { ...s, name } : s);
}

async function moveStatus(id, dir) {
  const idx = statuses.findIndex(s => s.id === id);
  if (dir === 'up'   && idx === 0) return;
  if (dir === 'down' && idx === statuses.length - 1) return;
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  [statuses[idx], statuses[swapIdx]] = [statuses[swapIdx], statuses[idx]];
  await api('status_reorder', { ids: statuses.map(s => s.id) });
  renderStatuses();
}

async function deleteStatus(id) {
  if (!confirm('Удалить статус?')) return;
  await api('status_delete', { id });
  await loadStatuses();
}

// ─── Persons ──────────────────────────────────────────────
async function loadPersons() {
  const data = await api('persons');
  persons = data.persons || [];
  renderPersons();
}

function renderPersons() {
  const list = document.getElementById('personsList');
  if (!persons.length) {
    list.innerHTML = '<div class="empty-hint">Нет сотрудников</div>';
    return;
  }
  list.innerHTML = persons.map((p, i) => {
    const dir = directions.find(d => d.id === Number(p.direction_id));
    return `
    <div class="setting-item person-item" data-id="${p.id}" draggable="true">
      <span class="drag-handle" title="Перетащить">⠿</span>
      <div class="person-info">
        <span class="person-name">${escHtml(p.full_name || (p.first_name + ' ' + p.last_name).trim())}</span>
        ${dir ? `<span class="person-dir">${escHtml(dir.name)}</span>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn-icon-sm ${i === 0 ? 'disabled' : ''}" data-dir="up" data-id="${p.id}" title="Вверх">↑</button>
        <button class="btn-icon-sm ${i === persons.length - 1 ? 'disabled' : ''}" data-dir="down" data-id="${p.id}" title="Вниз">↓</button>
        <button class="btn-icon-sm btn-edit" data-id="${p.id}" title="Редактировать">✎</button>
        <button class="btn-icon-del" data-id="${p.id}" title="Удалить">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-dir]').forEach(btn => {
    if (btn.classList.contains('disabled')) return;
    btn.onclick = () => movePerson(Number(btn.dataset.id), btn.dataset.dir);
  });
  list.querySelectorAll('.btn-edit').forEach(btn =>
    btn.onclick = () => openPersonModal(Number(btn.dataset.id))
  );
  list.querySelectorAll('.btn-icon-del:not([data-type])').forEach(btn =>
    btn.onclick = () => deletePerson(Number(btn.dataset.id))
  );

  setupDrag(list, persons, 'person_reorder', () => loadPersons());
}

function openPersonModal(id = null) {
  const modal = document.getElementById('personModal');
  modal.classList.remove('hidden');
  document.getElementById('personModalTitle').textContent = id ? 'Редактировать сотрудника' : 'Добавить сотрудника';
  document.getElementById('personId').value         = id || '';
  document.getElementById('personFirstName').value  = '';
  document.getElementById('personLastName').value   = '';
  document.getElementById('personEmail').value      = '';
  document.getElementById('personDirection').value  = '';

  if (id) {
    const p = persons.find(x => x.id === id);
    if (p) {
      document.getElementById('personFirstName').value = p.first_name || '';
      document.getElementById('personLastName').value  = p.last_name  || '';
      document.getElementById('personEmail').value     = p.email      || '';
      document.getElementById('personDirection').value = p.direction_id || '';
    }
  }
}

async function savePerson() {
  const id = document.getElementById('personId').value;
  const payload = {
    id:           id || undefined,
    first_name:   document.getElementById('personFirstName').value.trim(),
    last_name:    document.getElementById('personLastName').value.trim(),
    email:        document.getElementById('personEmail').value.trim(),
    direction_id: document.getElementById('personDirection').value || null,
  };
  if (!payload.first_name && !payload.last_name) return alert('Введите имя или фамилию');
  await api('person_save', payload);
  document.getElementById('personModal').classList.add('hidden');
  await loadPersons();
}

async function movePerson(id, dir) {
  const idx = persons.findIndex(p => p.id === id);
  if (dir === 'up'   && idx === 0) return;
  if (dir === 'down' && idx === persons.length - 1) return;
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  [persons[idx], persons[swapIdx]] = [persons[swapIdx], persons[idx]];
  await api('person_reorder', { ids: persons.map(p => p.id) });
  renderPersons();
}

async function deletePerson(id) {
  if (!confirm('Удалить сотрудника?')) return;
  await api('person_delete', { id });
  await loadPersons();
}

function openColorPicker(e, statusId) {
  e.stopPropagation();
  document.querySelectorAll('.color-picker-popup').forEach(p => p.remove());

  const btn   = e.currentTarget;
  const popup = document.createElement('div');
  popup.className = 'color-picker-popup';
  popup.innerHTML =
    PALETTE.map(c => `<button class="palette-swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('') +
    `<button class="palette-swatch palette-none" data-color="" title="Без цвета"></button>`;

  document.body.appendChild(popup);
  const rect = btn.getBoundingClientRect();
  popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  popup.style.left = (rect.left  + window.scrollX) + 'px';

  popup.querySelectorAll('.palette-swatch').forEach(sw => {
    sw.onclick = async e2 => {
      e2.stopPropagation();
      const color = sw.dataset.color || null;
      await api('status_save', { id: statusId, color });
      statuses = statuses.map(s => s.id === statusId ? { ...s, color } : s);
      btn.style.background = color || '#e2e8f0';
      popup.remove();
    };
  });

  setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 0);
}

// ─── Drag & Drop ─────────────────────────────────────────
function setupDrag(list, items, reorderAction, onDone) {
  let dragId = null;
  list.querySelectorAll('.setting-item[draggable]').forEach(el => {
    el.ondragstart = e => { dragId = Number(el.dataset.id); el.classList.add('dragging'); };
    el.ondragend   = () => { dragId = null; el.classList.remove('dragging'); };
    el.ondragover  = e => { e.preventDefault(); el.classList.add('drag-over'); };
    el.ondragleave = () => el.classList.remove('drag-over');
    el.ondrop      = async e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!dragId || dragId === Number(el.dataset.id)) return;
      const fromIdx = items.findIndex(x => x.id === dragId);
      const toIdx   = items.findIndex(x => x.id === Number(el.dataset.id));
      if (fromIdx === -1 || toIdx === -1) return;
      const moved = items.splice(fromIdx, 1)[0];
      items.splice(toIdx, 0, moved);
      await api(reorderAction, { ids: items.map(x => x.id) });
      onDone();
    };
  });
}

// ─── Utils ───────────────────────────────────────────────
async function api(action, payload = null) {
  if (!payload) {
    const res = await fetch(`api.php?action=${action}`);
    return res.json();
  }
  const res = await fetch(`api.php?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); throw new Error(data.error); }
  return data;
}

function toggleRow(rowId, focusId) {
  const row = document.getElementById(rowId);
  row.classList.toggle('hidden');
  if (!row.classList.contains('hidden')) document.getElementById(focusId).focus();
}

function hideRow(rowId) {
  document.getElementById(rowId).classList.add('hidden');
}

function escHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
