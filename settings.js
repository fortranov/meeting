const PALETTE = ['#3b82f6','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#f59e0b','#6366f1','#ef4444','#84cc16'];

let directions            = [];
let statuses              = [];
let persons               = [];
let planPages             = [];
let holidays              = [];
let colorSizeData         = {};
let planTemplateTasksCache = {}; // keyed by plan_page_id


async function init() {
  bindEvents();
  await Promise.all([loadDirections(), loadStatuses(), loadPersons(), loadPlanPages(), loadHolidays(), loadSiteSettings(), loadModules()]);
  // Force multi-column layout reflow after async data fills the cards
  const grid = document.querySelector('.settings-grid');
  if (grid) { grid.style.display = 'none'; grid.offsetHeight; grid.style.display = ''; }
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

  // Plan pages
  document.getElementById('showAddPlanPage').onclick  = () => openPlanPageModal();
  document.getElementById('savePlanPageBtn').onclick  = savePlanPage;
  document.getElementById('deletePlanPageBtn').onclick = () => deletePlanPage(Number(document.getElementById('planPageId').value));

  // Plan template tasks
  document.getElementById('savePlanTmplBtn').onclick   = savePlanTmplTask;
  document.getElementById('deletePlanTmplBtn').onclick = () => deletePlanTmplTask(Number(document.getElementById('planTmplId').value));

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
  document.querySelectorAll('.modal').forEach(modal =>
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); })
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
      <input type="color" class="cs-color" data-id="${d.id}" value="${d.color || '#e2e8f0'}" title="Выбрать цвет" />
      <span class="item-name" contenteditable="true" data-id="${d.id}" data-type="direction">${escHtml(d.name)}</span>
      <button class="btn-icon-del" data-id="${d.id}" data-type="direction" title="Удалить">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('input[type="color"]').forEach(input =>
    input.onchange = async () => {
      const id = Number(input.dataset.id), color = input.value;
      await api('direction_save', { id, color });
      directions = directions.map(d => d.id === id ? { ...d, color } : d);
    }
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
      <input type="color" class="cs-color" data-id="${s.id}" value="${s.color || '#e2e8f0'}" title="Выбрать цвет" />
      <span class="item-name" contenteditable="true" data-id="${s.id}" data-type="status">${escHtml(s.name)}</span>
      <div class="item-actions">
        <button class="btn-icon-sm ${i === 0 ? 'disabled' : ''}" data-dir="up" data-id="${s.id}" title="Вверх">↑</button>
        <button class="btn-icon-sm ${i === statuses.length - 1 ? 'disabled' : ''}" data-dir="down" data-id="${s.id}" title="Вниз">↓</button>
        ${Number(s.is_system) ? '' : `<button class="btn-icon-del" data-id="${s.id}" data-type="status" title="Удалить">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>`}
      </div>
    </div>`).join('');

  list.querySelectorAll('input[type="color"]').forEach(input =>
    input.onchange = async () => {
      const id = Number(input.dataset.id), color = input.value;
      await api('status_save', { id, color });
      statuses = statuses.map(s => s.id === id ? { ...s, color } : s);
    }
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
  const data = await (await fetch('api.php?action=persons&include_management=1')).json();
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
        ${Number(p.is_management) ? '<span class="person-mgmt-badge">Рук.</span>' : ''}
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

async function openPersonModal(id = null) {
  const modal = document.getElementById('personModal');
  modal.classList.remove('hidden');
  document.getElementById('personModalTitle').textContent = id ? 'Редактировать сотрудника' : 'Добавить сотрудника';
  document.getElementById('personId').value         = id || '';
  document.getElementById('personFirstName').value  = '';
  document.getElementById('personLastName').value   = '';
  document.getElementById('personBirthDate').value  = '';
  document.getElementById('personDirection').value  = '';
  document.getElementById('personIp').value         = '';
  document.getElementById('personIsManagement').checked = false;
  ['permDutyView','permDutyEdit','permSettView','permSettEdit','permVacView','permVacEdit']
    .forEach(eid => { document.getElementById(eid).checked = false; });

  // Populate plan page permission rows
  const permsBody = document.getElementById('planPagePermsBody');
  permsBody.innerHTML = planPages.map(pp => `
    <tr data-plan-page-id="${pp.id}">
      <td>${escHtml(pp.menu_title || pp.title)}</td>
      <td><input type="checkbox" class="perm-plan-view" data-ppid="${pp.id}" /></td>
      <td><input type="checkbox" class="perm-plan-edit" data-ppid="${pp.id}" /></td>
    </tr>`).join('');

  if (id) {
    const p = persons.find(x => x.id === id);
    if (p) {
      document.getElementById('personFirstName').value = p.first_name || '';
      document.getElementById('personLastName').value  = p.last_name  || '';
      document.getElementById('personBirthDate').value = p.birth_date || '';
      document.getElementById('personDirection').value = p.direction_id || '';
      document.getElementById('personIp').value        = p.ip || '';
      document.getElementById('personIsManagement').checked = !!Number(p.is_management);
      document.getElementById('permDutyView').checked  = !!Number(p.page_duty_view);
      document.getElementById('permDutyEdit').checked  = !!Number(p.page_duty_edit);
      document.getElementById('permSettView').checked  = !!Number(p.page_settings_view);
      document.getElementById('permSettEdit').checked  = !!Number(p.page_settings_edit);
      document.getElementById('permVacView').checked   = !!Number(p.page_vacation_view);
      document.getElementById('permVacEdit').checked   = !!Number(p.page_vacation_edit);

      // Load plan page accesses
      try {
        const accData = await (await fetch('api.php?action=plan_page_person_access&person_id=' + id)).json();
        const accList = accData.access || [];
        planPages.forEach(pp => {
          const acc = accList.find(a => Number(a.plan_page_id) === Number(pp.id));
          const viewCb = permsBody.querySelector(`.perm-plan-view[data-ppid="${pp.id}"]`);
          const editCb = permsBody.querySelector(`.perm-plan-edit[data-ppid="${pp.id}"]`);
          if (viewCb) viewCb.checked = acc ? !!Number(acc.can_view) : false;
          if (editCb) editCb.checked = acc ? !!Number(acc.can_edit) : false;
        });
      } catch {}
    }
  }
}

async function savePerson() {
  const id = document.getElementById('personId').value;
  const permsBody = document.getElementById('planPagePermsBody');

  // Collect plan page accesses from dynamic rows
  const planPageAccesses = planPages.map(pp => {
    const viewCb = permsBody.querySelector(`.perm-plan-view[data-ppid="${pp.id}"]`);
    const editCb = permsBody.querySelector(`.perm-plan-edit[data-ppid="${pp.id}"]`);
    return {
      plan_page_id: pp.id,
      can_view:     viewCb ? (viewCb.checked ? 1 : 0) : 0,
      can_edit:     editCb ? (editCb.checked ? 1 : 0) : 0,
    };
  });

  const payload = {
    id:                 id || undefined,
    first_name:         document.getElementById('personFirstName').value.trim(),
    last_name:          document.getElementById('personLastName').value.trim(),
    birth_date:         document.getElementById('personBirthDate').value || null,
    direction_id:       document.getElementById('personDirection').value || null,
    ip:                 document.getElementById('personIp').value.trim(),
    is_management:      document.getElementById('personIsManagement').checked ? 1 : 0,
    page_main_view:     0,
    page_main_edit:     0,
    page_duty_view:     document.getElementById('permDutyView').checked  ? 1 : 0,
    page_duty_edit:     document.getElementById('permDutyEdit').checked  ? 1 : 0,
    page_settings_view: document.getElementById('permSettView').checked  ? 1 : 0,
    page_settings_edit: document.getElementById('permSettEdit').checked  ? 1 : 0,
    page_vacation_view: document.getElementById('permVacView').checked   ? 1 : 0,
    page_vacation_edit: document.getElementById('permVacEdit').checked   ? 1 : 0,
    page_control_view:  0,
    page_control_edit:  0,
    plan_page_accesses: planPageAccesses,
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

// ─── Plan Pages ───────────────────────────────────────────

async function loadPlanPages() {
  try {
    const data = await api('plan_pages');
    planPages = data.pages || [];
  } catch {
    planPages = [];
  }
  renderPlanPages();
  renderAllPlanTemplateCards();
}

function renderPlanPages() {
  const list = document.getElementById('planPagesList');
  if (!planPages.length) {
    list.innerHTML = '<div class="empty-hint">Нет страниц планов</div>';
    return;
  }
  list.innerHTML = planPages.map(p => `
    <div class="setting-item" data-id="${p.id}">
      <div class="tmpl-info">
        <span class="tmpl-title">${escHtml(p.menu_title || p.title)}</span>
        <span class="tmpl-meta">${escHtml(p.session_label)}</span>
      </div>
      <div class="item-actions">
        <button class="btn-icon-sm btn-edit" data-id="${p.id}" title="Редактировать">✎</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('.btn-edit').forEach(btn =>
    btn.onclick = () => openPlanPageModal(Number(btn.dataset.id))
  );
}

function openPlanPageModal(id = null) {
  document.getElementById('planPageModal').classList.remove('hidden');
  document.getElementById('planPageModalTitle').textContent = id ? 'Редактировать страницу плана' : 'Добавить страницу плана';
  document.getElementById('planPageId').value           = id || '';
  document.getElementById('planPageTitle').value        = '';
  document.getElementById('planPageMenuTitle').value    = '';
  document.getElementById('planPageDashTitle').value    = '';
  document.getElementById('planPageSessionLabel').value = '';
  document.getElementById('planPageHasTopic').checked   = false;
  document.getElementById('deletePlanPageBtn').classList.toggle('hidden', !id);

  if (id) {
    const p = planPages.find(x => Number(x.id) === id);
    if (p) {
      document.getElementById('planPageTitle').value        = p.title        || '';
      document.getElementById('planPageMenuTitle').value    = p.menu_title   || '';
      document.getElementById('planPageDashTitle').value    = p.dash_title   || '';
      document.getElementById('planPageSessionLabel').value = p.session_label || '';
      document.getElementById('planPageHasTopic').checked   = Boolean(Number(p.has_topic));
    }
  }
}

async function savePlanPage() {
  const id = document.getElementById('planPageId').value;
  const payload = {
    id:            id || undefined,
    title:         document.getElementById('planPageTitle').value.trim(),
    menu_title:    document.getElementById('planPageMenuTitle').value.trim(),
    dash_title:    document.getElementById('planPageDashTitle').value.trim(),
    session_label: document.getElementById('planPageSessionLabel').value.trim() || 'Заседание',
    has_topic:     document.getElementById('planPageHasTopic').checked ? 1 : 0,
  };
  if (!payload.title) return alert('Введите название страницы');
  await api('plan_page_save', payload);
  document.getElementById('planPageModal').classList.add('hidden');
  await loadPlanPages();
}

async function deletePlanPage(id) {
  if (!id || !confirm('Удалить страницу плана и все её сессии, задачи и шаблоны?')) return;
  await api('plan_page_delete', { id });
  document.getElementById('planPageModal').classList.add('hidden');
  await loadPlanPages();
}

// ─── Plan Template Tasks (per plan_page) ──────────────────

function renderAllPlanTemplateCards() {
  const container = document.getElementById('planTemplateCards');
  container.innerHTML = '';
  planPages.forEach(p => {
    const card = document.createElement('section');
    card.className = 'settings-card';
    card.id = 'planTmplCard_' + p.id;
    card.innerHTML = `
      <div class="settings-card-header">
        <h2>Шаблон: ${escHtml(p.title)}</h2>
        <button class="btn-add" data-plan-page-id="${p.id}">+ Добавить задачу</button>
      </div>
      <p class="settings-hint">Задачи из шаблона автоматически добавляются при создании нового элемента «${escHtml(p.session_label)}» с опцией «На основе шаблона».</p>
      <div class="settings-list" id="planTmplList_${p.id}"><div class="empty-hint">Загрузка…</div></div>`;
    card.querySelector('[data-plan-page-id]').onclick = () => openPlanTmplModal(p.id);
    container.appendChild(card);
    loadPlanTemplateTasks(p.id);
  });
}

async function loadPlanTemplateTasks(pageId) {
  try {
    const data = await (await fetch('api.php?action=plan_template_tasks&page_id=' + pageId)).json();
    planTemplateTasksCache[pageId] = data.tasks || [];
  } catch {
    planTemplateTasksCache[pageId] = [];
  }
  renderPlanTemplateTasks(pageId);
}

function renderPlanTemplateTasks(pageId) {
  const list = document.getElementById('planTmplList_' + pageId);
  if (!list) return;
  const tasks = planTemplateTasksCache[pageId] || [];
  if (!tasks.length) {
    list.innerHTML = '<div class="empty-hint">Шаблон пуст — добавьте задачи</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
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
    btn.onclick = () => openPlanTmplModal(pageId, Number(btn.dataset.id))
  );
  list.querySelectorAll('.btn-icon-del').forEach(btn =>
    btn.onclick = () => deletePlanTmplTask(Number(btn.dataset.id), pageId)
  );
  setupDrag(list, tasks, 'plan_template_task_reorder', () => loadPlanTemplateTasks(pageId));
}

function openPlanTmplModal(pageId, id = null) {
  document.getElementById('planTmplModal').classList.remove('hidden');
  document.getElementById('planTmplModalTitle').textContent = id ? 'Редактировать задачу шаблона' : 'Добавить задачу в шаблон';
  document.getElementById('planTmplId').value        = id || '';
  document.getElementById('planTmplPageId').value    = pageId;
  document.getElementById('planTmplTitle').value     = '';
  document.getElementById('planTmplDaysBefore').value = 0;
  document.getElementById('planTmplDuration').value  = 1;
  document.getElementById('deletePlanTmplBtn').classList.toggle('hidden', !id);

  const subtaskCb = document.getElementById('planTmplIsSubtask');
  subtaskCb.checked = false;
  const tasks = planTemplateTasksCache[pageId] || [];

  if (id) {
    const t = tasks.find(x => Number(x.id) === id);
    if (t) {
      document.getElementById('planTmplTitle').value      = t.title;
      document.getElementById('planTmplDaysBefore').value = t.days_before;
      document.getElementById('planTmplDuration').value   = t.duration_days;
      subtaskCb.checked  = Boolean(Number(t.is_subtask));
      subtaskCb.disabled = Number(tasks[0]?.id) === id;
    }
  } else {
    subtaskCb.disabled = tasks.length === 0;
  }
}

async function savePlanTmplTask() {
  const id     = document.getElementById('planTmplId').value;
  const pageId = Number(document.getElementById('planTmplPageId').value);
  const title  = document.getElementById('planTmplTitle').value.trim();
  if (!title) return alert('Введите название задачи');
  const payload = {
    id:            id || undefined,
    plan_page_id:  pageId,
    title,
    days_before:   Math.max(0, Number(document.getElementById('planTmplDaysBefore').value) || 0),
    duration_days: Math.max(1, Number(document.getElementById('planTmplDuration').value)   || 1),
    is_subtask:    document.getElementById('planTmplIsSubtask').checked ? 1 : 0,
  };
  await api('plan_template_task_save', payload);
  document.getElementById('planTmplModal').classList.add('hidden');
  await loadPlanTemplateTasks(pageId);
}

async function deletePlanTmplTask(id, pageId) {
  if (!id || !confirm('Удалить задачу из шаблона?')) return;
  await api('plan_template_task_delete', { id });
  document.getElementById('planTmplModal').classList.add('hidden');
  if (pageId) await loadPlanTemplateTasks(pageId);
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
      <span class="cs-label">Цвет столбца текущего дня (Главная)</span>
      <input type="color" class="cs-color" id="csTodayColColor" value="${s.today_col_color || '#eef3ff'}" title="Цвет текущего дня" />
    </div>
    <div class="cs-row">
      <span class="cs-label">Цвет столбца дней заседаний (Главная)</span>
      <input type="color" class="cs-color" id="csMeetingColColor" value="${s.meeting_col_color || '#fff8ec'}" title="Цвет дней заседаний" />
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
    weekend_color:      document.getElementById('csWeekendColor').value,
    today_col_color:    document.getElementById('csTodayColColor').value,
    meeting_col_color:  document.getElementById('csMeetingColColor').value,
    vacation_color:    document.getElementById('csVacationColor').value,
    col_item_width:    document.getElementById('csColItemWidth').value,
    col_status_width:  document.getElementById('csColStatusWidth').value,
    col_day_min_width: document.getElementById('csColDayMinWidth').value,
  };
  await api('site_settings_save', payload);
  colorSizeData = { ...colorSizeData, ...payload };
}

// ─── Modules ──────────────────────────────────────────────

const ENABLED_KEY = 'dashboardEnabledBlocks';

function getEnabledSet(allIds) {
  try {
    const s = JSON.parse(localStorage.getItem(ENABLED_KEY));
    if (Array.isArray(s)) return new Set(s);
  } catch {}
  return new Set(allIds); // all enabled by default
}

async function loadModules() {
  const data   = await api('dashboard_blocks');
  const blocks = data.blocks || [];
  const allIds = blocks.map(b => b.id);
  const enabled = getEnabledSet(allIds);

  const list = document.getElementById('modulesList');
  if (!blocks.length) {
    list.innerHTML = '<div class="empty-hint">Нет блоков</div>';
    return;
  }

  list.innerHTML = blocks.map(b => `
    <div class="setting-item">
      <span>${b.name}</span>
      <label class="module-toggle">
        <input type="checkbox" data-block-id="${b.id}" ${enabled.has(b.id) ? 'checked' : ''} />
        <span class="module-toggle-track"></span>
      </label>
    </div>`).join('');

  list.querySelectorAll('input[data-block-id]').forEach(chk => {
    chk.addEventListener('change', () => {
      const current = getEnabledSet(allIds);
      if (chk.checked) {
        current.add(chk.dataset.blockId);
      } else {
        current.delete(chk.dataset.blockId);
      }
      localStorage.setItem(ENABLED_KEY, JSON.stringify([...current]));
    });
  });
}

init();
