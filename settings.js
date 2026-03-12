let directions     = [];
let statuses       = [];
let persons        = [];
let templateTasks  = [];
let holidays       = [];
let colorSizeData  = {};

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
  await Promise.all([loadDirections(), loadStatuses(), loadPersons(), loadTemplateTasks(), loadHolidays(), loadSiteSettings()]);
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

  // Template tasks
  document.getElementById('showAddTemplateTask').onclick   = () => openTemplateTaskModal();
  document.getElementById('saveTemplateTaskBtn').onclick   = saveTemplateTask;
  document.getElementById('deleteTemplateTaskBtn').onclick = () => deleteTemplateTask(Number(document.getElementById('templateTaskId').value));

  // Person modal
  document.getElementById('showAddPerson').onclick = () => openPersonModal();
  document.getElementById('savePersonBtn').onclick  = savePerson;

  // IP access global setting
  document.getElementById('ipAccessEnabled').onchange = async function () {
    await api('site_settings_save', { ip_access_enabled: this.checked ? '1' : '0' });
  };

  // Holidays
  document.getElementById('showAddHoliday').onclick = () => {
    document.getElementById('holidayDate').value = '';
    document.getElementById('holidayModal').classList.remove('hidden');
  };
  document.getElementById('saveHolidayBtn').onclick = saveHoliday;

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
      <button class="color-swatch" data-id="${d.id}" data-type="direction" style="background:${d.color || '#e2e8f0'}" title="Выбрать цвет"></button>
      <span class="item-name" contenteditable="true" data-id="${d.id}" data-type="direction">${escHtml(d.name)}</span>
      <button class="btn-icon-del" data-id="${d.id}" data-type="direction" title="Удалить">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('.color-swatch[data-type="direction"]').forEach(btn =>
    btn.onclick = e => openDirectionColorPicker(e, Number(btn.dataset.id))
  );
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
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  await api('direction_save', { name, color });
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
        ${Number(s.is_system) ? '' : `<button class="btn-icon-del" data-id="${s.id}" data-type="status" title="Удалить">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>`}
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
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  await api('status_save', { name, color });
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
  document.getElementById('personIp').value         = '';
  ['permMainView','permMainEdit','permDutyView','permDutyEdit','permSettView','permSettEdit']
    .forEach(eid => { document.getElementById(eid).checked = false; });

  if (id) {
    const p = persons.find(x => x.id === id);
    if (p) {
      document.getElementById('personFirstName').value = p.first_name || '';
      document.getElementById('personLastName').value  = p.last_name  || '';
      document.getElementById('personEmail').value     = p.email      || '';
      document.getElementById('personDirection').value = p.direction_id || '';
      document.getElementById('personIp').value        = p.ip || '';
      document.getElementById('permMainView').checked  = !!Number(p.page_main_view);
      document.getElementById('permMainEdit').checked  = !!Number(p.page_main_edit);
      document.getElementById('permDutyView').checked  = !!Number(p.page_duty_view);
      document.getElementById('permDutyEdit').checked  = !!Number(p.page_duty_edit);
      document.getElementById('permSettView').checked  = !!Number(p.page_settings_view);
      document.getElementById('permSettEdit').checked  = !!Number(p.page_settings_edit);
    }
  }
}

async function savePerson() {
  const id = document.getElementById('personId').value;
  const payload = {
    id:                 id || undefined,
    first_name:         document.getElementById('personFirstName').value.trim(),
    last_name:          document.getElementById('personLastName').value.trim(),
    email:              document.getElementById('personEmail').value.trim(),
    direction_id:       document.getElementById('personDirection').value || null,
    ip:                 document.getElementById('personIp').value.trim(),
    page_main_view:     document.getElementById('permMainView').checked ? 1 : 0,
    page_main_edit:     document.getElementById('permMainEdit').checked ? 1 : 0,
    page_duty_view:     document.getElementById('permDutyView').checked ? 1 : 0,
    page_duty_edit:     document.getElementById('permDutyEdit').checked ? 1 : 0,
    page_settings_view: document.getElementById('permSettView').checked ? 1 : 0,
    page_settings_edit: document.getElementById('permSettEdit').checked ? 1 : 0,
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

// ─── Template Tasks ───────────────────────────────────────
async function loadTemplateTasks() {
  const data = await api('template_tasks');
  templateTasks = data.tasks || [];
  renderTemplateTasks();
}

function renderTemplateTasks() {
  const list = document.getElementById('templateTasksList');
  if (!templateTasks.length) {
    list.innerHTML = '<div class="empty-hint">Шаблон пуст — добавьте задачи</div>';
    return;
  }
  list.innerHTML = templateTasks.map(t => `
    <div class="setting-item" data-id="${t.id}" draggable="true">
      <span class="drag-handle" title="Перетащить">⠿</span>
      ${Number(t.is_subtask) ? '<span class="subtask-badge" title="Подзадача">↳</span>' : '<span class="subtask-spacer"></span>'}
      <div class="tmpl-info">
        <span class="tmpl-title">${escHtml(t.title)}</span>
        <span class="tmpl-meta">за ${t.days_before} дн. до · ${t.duration_days} дн.</span>
      </div>
      <div class="item-actions">
        <button class="btn-icon-sm btn-edit" data-id="${t.id}" title="Редактировать">✎</button>
        <button class="btn-icon-del" data-id="${t.id}" title="Удалить">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.btn-edit').forEach(btn =>
    btn.onclick = () => openTemplateTaskModal(Number(btn.dataset.id))
  );
  list.querySelectorAll('.btn-icon-del').forEach(btn =>
    btn.onclick = () => deleteTemplateTask(Number(btn.dataset.id))
  );
  setupDrag(list, templateTasks, 'template_task_reorder', () => loadTemplateTasks());
}

function openTemplateTaskModal(id = null) {
  document.getElementById('templateTaskModal').classList.remove('hidden');
  document.getElementById('templateTaskModalTitle').textContent = id ? 'Редактировать задачу шаблона' : 'Добавить задачу в шаблон';
  document.getElementById('templateTaskId').value   = id || '';
  document.getElementById('tmplTitle').value        = '';
  document.getElementById('tmplDaysBefore').value   = 0;
  document.getElementById('tmplDuration').value     = 1;
  document.getElementById('deleteTemplateTaskBtn').classList.toggle('hidden', !id);

  const subtaskCb = document.getElementById('tmplIsSubtask');
  subtaskCb.checked  = false;

  if (id) {
    const t = templateTasks.find(x => Number(x.id) === id);
    if (t) {
      document.getElementById('tmplTitle').value      = t.title;
      document.getElementById('tmplDaysBefore').value = t.days_before;
      document.getElementById('tmplDuration').value   = t.duration_days;
      subtaskCb.checked  = Boolean(Number(t.is_subtask));
      // Disable subtask if this is the first task in the list
      subtaskCb.disabled = Number(templateTasks[0]?.id) === id;
    }
  } else {
    // Disable subtask if template is empty (would be first)
    subtaskCb.disabled = templateTasks.length === 0;
  }
}

async function saveTemplateTask() {
  const id    = document.getElementById('templateTaskId').value;
  const title = document.getElementById('tmplTitle').value.trim();
  if (!title) return alert('Введите название задачи');
  const payload = {
    id:            id || undefined,
    title,
    days_before:   Math.max(0, Number(document.getElementById('tmplDaysBefore').value) || 0),
    duration_days: Math.max(1, Number(document.getElementById('tmplDuration').value)   || 1),
    is_subtask:    document.getElementById('tmplIsSubtask').checked ? 1 : 0,
  };
  await api('template_task_save', payload);
  document.getElementById('templateTaskModal').classList.add('hidden');
  await loadTemplateTasks();
}

async function deleteTemplateTask(id) {
  if (!id || !confirm('Удалить задачу из шаблона?')) return;
  await api('template_task_delete', { id });
  document.getElementById('templateTaskModal').classList.add('hidden');
  await loadTemplateTasks();
}

// ─── Holidays ─────────────────────────────────────────────
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

async function loadHolidays() {
  const data = await api('holidays');
  holidays = data.holidays || [];
  renderHolidays();
}

function renderHolidays() {
  const el = document.getElementById('holidaysList');
  if (!holidays.length) {
    el.innerHTML = '<div class="empty-hint">Праздники не добавлены</div>';
    return;
  }
  const byYear = {};
  holidays.forEach(h => {
    const y = h.date.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(h);
  });
  el.innerHTML = Object.keys(byYear).sort().map(year => {
    const items = byYear[year].sort((a, b) => a.date.localeCompare(b.date));
    return `<details class="holiday-accordion">
      <summary class="holiday-accordion-btn">${year}</summary>
      <div class="holiday-accordion-body settings-list">
        ${items.map(h => {
          const d = new Date(h.date + 'T00:00:00');
          return `<div class="setting-item">
            <span class="item-name">${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</span>
            <button class="btn-icon-del" data-id="${h.id}" title="Удалить">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
            </button>
          </div>`;
        }).join('')}
      </div>
    </details>`;
  }).join('');
  el.querySelectorAll('.btn-icon-del').forEach(btn =>
    btn.onclick = () => deleteHoliday(Number(btn.dataset.id))
  );
}

async function saveHoliday() {
  const date = document.getElementById('holidayDate').value;
  if (!date) return alert('Выберите дату');
  try {
    await api('holiday_save', { date });
  } catch {}
  document.getElementById('holidayModal').classList.add('hidden');
  await loadHolidays();
}

async function deleteHoliday(id) {
  if (!confirm('Удалить праздник?')) return;
  await api('holiday_delete', { id });
  await loadHolidays();
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

function openDirectionColorPicker(e, directionId) {
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
      await api('direction_save', { id: directionId, color });
      directions = directions.map(d => d.id === directionId ? { ...d, color } : d);
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

async function loadSiteSettings() {
  const data = await api('site_settings');
  const settings = data.settings || {};
  document.getElementById('ipAccessEnabled').checked = settings['ip_access_enabled'] === '1';
  colorSizeData = settings;
  renderColorSizeSettings();
}

function renderColorSizeSettings() {
  const s = colorSizeData;
  const container = document.getElementById('colorSizeSettings');
  container.innerHTML = `
    <div class="cs-row">
      <span class="cs-label">Цвет выходных дней (Главная + График дежурств)</span>
      <input type="color" class="cs-color" id="csWeekendColor" value="${s.weekend_color || '#f5fcf5'}" title="Цвет выходных" />
    </div>
    <div class="cs-row">
      <span class="cs-label">Цвет события «Отпуск» (График дежурств)</span>
      <input type="color" class="cs-color" id="csVacationColor" value="${s.vacation_color || '#fef9c3'}" title="Цвет отпуска" />
    </div>
    <div class="cs-row">
      <span class="cs-label">Ширина левого столбца таблицы (Главная)</span>
      <input type="number" class="cs-number" id="csColItemWidth" value="${s.col_item_width || 200}" min="100" max="600" />
      <span class="cs-unit">px</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">Ширина столбца «Статус» таблицы (Главная)</span>
      <input type="number" class="cs-number" id="csColStatusWidth" value="${s.col_status_width || 80}" min="40" max="300" />
      <span class="cs-unit">px</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">Минимальная ширина столбца дня в календаре (Главная)</span>
      <input type="number" class="cs-number" id="csColDayMinWidth" value="${s.col_day_min_width || 0}" min="0" max="100" />
      <span class="cs-unit">px</span>
    </div>
    <div style="margin-top:8px">
      <button class="btn-add" id="saveColorSizeBtn">Сохранить</button>
    </div>
  `;
  document.getElementById('saveColorSizeBtn').onclick = saveColorSizeSettings;
}

async function saveColorSizeSettings() {
  const payload = {
    weekend_color:     document.getElementById('csWeekendColor').value,
    vacation_color:    document.getElementById('csVacationColor').value,
    col_item_width:    document.getElementById('csColItemWidth').value,
    col_status_width:  document.getElementById('csColStatusWidth').value,
    col_day_min_width: document.getElementById('csColDayMinWidth').value,
  };
  await api('site_settings_save', payload);
  colorSizeData = { ...colorSizeData, ...payload };
}

init();
