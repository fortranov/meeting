window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

// ── Shared state for the dashboard task modal ─────────────────────────────
const _dtm = {
  pageId:    null,
  reload:    null,
  persons:   [],
  allPersons:[],
  statuses:  null,   // cached once
};

// ── Build/reuse single shared modal ───────────────────────────────────────
function getDashTaskModal() {
  let modal = document.getElementById('dashTaskModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id        = 'dashTaskModal';
  modal.className = 'modal hidden';
  modal.innerHTML = `
    <div class="modal-box">
      <h3>Создать задачу</h3>
      <label id="dtmSessionLabel">Заседание
        <select id="dtmSession"></select>
      </label>
      <label>Название задачи<input id="dtmTitle" /></label>
      <div class="row2">
        <label>Срок от<input id="dtmStart" type="date" /></label>
        <label>Срок до<input id="dtmEnd"   type="date" /></label>
      </div>
      <label>Статус<select id="dtmStatus"></select></label>
      <label>Ответственные</label>
      <div class="assignee-box">
        <input id="dtmPersonSearch" placeholder="Поиск сотрудника…" autocomplete="off" />
        <div id="dtmPersonDropdown" class="dropdown dropdown-hidden"></div>
        <div id="dtmSelectedPersons" class="selected-persons"></div>
      </div>
      <div class="modal-actions">
        <div style="flex:1"></div>
        <button data-close="dashTaskModal">Отмена</button>
        <button id="dtmSave">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('[data-close]').onclick = closeDashTaskModal;
  document.getElementById('dtmSave').onclick  = saveDashTask;

  // Person search
  const search   = document.getElementById('dtmPersonSearch');
  const dropdown = document.getElementById('dtmPersonDropdown');

  search.oninput = async () => {
    const q = search.value.trim();
    if (!q) { dropdown.classList.add('dropdown-hidden'); return; }
    const data = await fetch(`api.php?action=persons&q=${encodeURIComponent(q)}`).then(r => r.json());
    _dtm.allPersons = data.persons || [];
    renderDtmDropdown();
  };
  search.addEventListener('focus', () => {
    if (_dtm.allPersons.length) renderDtmDropdown();
  });
  search.addEventListener('blur', () =>
    setTimeout(() => dropdown.classList.add('dropdown-hidden'), 150)
  );

  return modal;
}

function renderDtmDropdown() {
  const dropdown    = document.getElementById('dtmPersonDropdown');
  const selectedIds = new Set(_dtm.persons.map(p => p.id));
  const available   = _dtm.allPersons.filter(p => !selectedIds.has(p.id));
  if (!available.length) { dropdown.classList.add('dropdown-hidden'); return; }

  dropdown.innerHTML = available.map(p =>
    `<div class="dropdown-item" data-id="${p.id}">${p.first_name} ${p.last_name}</div>`
  ).join('');
  dropdown.classList.remove('dropdown-hidden');

  dropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.onmousedown = e => {
      e.preventDefault();
      const person = _dtm.allPersons.find(p => p.id === Number(item.dataset.id));
      if (person) {
        _dtm.persons.push(person);
        renderDtmSelected();
        document.getElementById('dtmPersonSearch').value = '';
        document.getElementById('dtmPersonDropdown').classList.add('dropdown-hidden');
        _dtm.allPersons = [];
      }
    };
  });
}

function renderDtmSelected() {
  const container = document.getElementById('dtmSelectedPersons');
  container.innerHTML = _dtm.persons.map((p, i) =>
    `<span class="person-tag">${p.first_name} ${p.last_name}` +
    `<button class="person-tag-remove" data-idx="${i}" type="button">×</button></span>`
  ).join('');
  container.querySelectorAll('.person-tag-remove').forEach(btn => {
    btn.onclick = () => {
      _dtm.persons.splice(Number(btn.dataset.idx), 1);
      renderDtmSelected();
    };
  });
}

function closeDashTaskModal() {
  document.getElementById('dashTaskModal')?.classList.add('hidden');
}

async function openDashTaskModal(pageId, reloadFn) {
  const modal = getDashTaskModal();
  _dtm.pageId    = pageId;
  _dtm.reload    = reloadFn;
  _dtm.persons   = [];
  _dtm.allPersons = [];

  // Reset fields
  document.getElementById('dtmTitle').value        = '';
  document.getElementById('dtmPersonSearch').value = '';
  document.getElementById('dtmPersonDropdown').classList.add('dropdown-hidden');
  renderDtmSelected();

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('dtmStart').value = today;
  document.getElementById('dtmEnd').value   = today;

  // Load sessions and statuses (statuses cached after first load)
  const [sessData, statData] = await Promise.all([
    fetch(`api.php?action=plan_sessions&page_id=${pageId}`).then(r => r.json()),
    _dtm.statuses
      ? Promise.resolve({ statuses: _dtm.statuses })
      : fetch('api.php?action=statuses').then(r => r.json()),
  ]);

  if (!_dtm.statuses) _dtm.statuses = statData.statuses || [];

  // Session label
  const sessionLabel = sessData.session_label || 'Заседание';
  document.getElementById('dtmSessionLabel').childNodes[0].textContent = sessionLabel + '\n';

  // Session dropdown
  const sessions   = sessData.sessions || [];
  const sessionSel = document.getElementById('dtmSession');
  sessionSel.innerHTML = sessions.length
    ? sessions.map(s => {
        const dd = s.session_date ? ' (' + s.session_date.slice(8) + '.' + s.session_date.slice(5, 7) + ')' : '';
        return `<option value="${s.id}">${s.title}${dd}</option>`;
      }).join('')
    : '<option value="">— нет заседаний —</option>';

  // Status dropdown
  const statusSel = document.getElementById('dtmStatus');
  statusSel.innerHTML = _dtm.statuses.map(s =>
    `<option value="${s.name}">${s.name}</option>`
  ).join('');

  modal.classList.remove('hidden');
  document.getElementById('dtmTitle').focus();
}

async function saveDashTask() {
  const title     = document.getElementById('dtmTitle').value.trim();
  const sessionId = Number(document.getElementById('dtmSession').value);
  if (!title)     { alert('Укажите название задачи'); return; }
  if (!sessionId) { alert('Выберите заседание'); return; }

  const btn = document.getElementById('dtmSave');
  btn.disabled = true;
  try {
    const res  = await fetch('api.php?action=plan_task_save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        id:             '',
        session_id:     sessionId,
        parent_task_id: null,
        title,
        start_date:  document.getElementById('dtmStart').value,
        end_date:    document.getElementById('dtmEnd').value,
        status:      document.getElementById('dtmStatus').value,
        person_ids:  _dtm.persons.map(p => p.id),
        page_id:     _dtm.pageId,
      }),
    });
    const data = await res.json();
    if (data.error) { alert('Ошибка: ' + data.error); return; }
    closeDashTaskModal();
    _dtm.reload?.();
  } catch {
    alert('Ошибка при сохранении');
  } finally {
    btn.disabled = false;
  }
}

// ── Factory — called once per plan_page by dashboard.php ─────────────────
window.PLAN_TASKS_BLOCK_FACTORY = function(pageId, dashTitle, canEdit) {
  const blockId = 'planTasks_' + pageId;

  async function renderBlock(el) {
    el.querySelector('.dash-block-title').textContent = dashTitle;

    // Add "+" button to header once (only if user has edit access)
    const header = el.querySelector('.dash-block-header');
    if (canEdit && !header.querySelector('.dash-block-add-btn')) {
      const btn = document.createElement('button');
      btn.className = 'dash-block-add-btn';
      btn.title     = 'Создать задачу';
      btn.textContent = '+';
      btn.onclick = e => {
        e.stopPropagation();
        openDashTaskModal(pageId, () => renderBlock(el));
      };
      header.appendChild(btn);
    }

    try {
      const data  = await fetch('api.php?action=dashboard_plan_tasks&page_id=' + pageId).then(r => r.json());
      const tasks = data.tasks || [];

      if (!tasks.length) {
        el.querySelector('.dash-block-body').innerHTML =
          '<p class="dash-loading">Нет активных задач на сегодня</p>';
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      const fmtDate = s => {
        const [, m, d] = s.split('-');
        return `${d}.${m}`;
      };

      const rowBg = color => {
        if (!color) return '';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return ` style="background:rgba(${r},${g},${b},0.10)"`;
      };

      // Group by session, preserving order of first appearance
      const sessionOrder  = [];
      const sessionTitles = {};
      const tasksBySession = {};
      tasks.forEach(t => {
        const sid = t.session_id;
        if (!tasksBySession[sid]) {
          sessionOrder.push(sid);
          sessionTitles[sid] = t.session_title || '';
          tasksBySession[sid] = [];
        }
        tasksBySession[sid].push(t);
      });

      // Order: parents before their subtasks
      const orderSession = sessionTasks => {
        const taskById   = Object.fromEntries(sessionTasks.map(t => [t.id, t]));
        const parents    = sessionTasks.filter(t => !t.parent_task_id);
        const childrenOf = {};
        sessionTasks.forEach(t => {
          if (t.parent_task_id)
            (childrenOf[t.parent_task_id] ??= []).push(t);
        });
        const ordered = [];
        parents.forEach(p => {
          ordered.push(p);
          (childrenOf[p.id] || []).forEach(c => ordered.push(c));
        });
        sessionTasks
          .filter(t => t.parent_task_id && !taskById[t.parent_task_id])
          .forEach(t => ordered.push(t));
        return ordered;
      };

      const html = [];
      sessionOrder.forEach(sid => {
        const title = sessionTitles[sid];
        if (title) html.push(`<div class="dash-session-header">${title}</div>`);
        orderSession(tasksBySession[sid]).forEach(t => {
          const overdue = t.end_date < today;
          html.push(`
            <div class="dash-task-row${t.parent_task_id ? ' dash-task-row--subtask' : ''}"${rowBg(t.color)}>
              <div class="dash-task-title">${overdue ? '<span class="dash-overdue-icon" aria-label="Просрочено">!</span>' : ''}<span>${t.title}</span></div>
              <div class="dash-task-meta">
                <span class="dash-task-dates">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</span>
                <span class="dash-task-persons">${t.responsible || ''}</span>
              </div>
            </div>`);
        });
      });

      el.querySelector('.dash-block-body').innerHTML = html.join('');
    } catch {
      el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
    }
  }

  window.BLOCK_REGISTRY[blockId] = renderBlock;
};
