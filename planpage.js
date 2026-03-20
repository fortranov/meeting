const VISIBLE_DAYS = 35;
const weekdays  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthsRu  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

let visibleStart      = addDays(startOfWeek(new Date()), -7);
let selectedPersons   = [];
let personOptions     = [];
let timelineSessions  = [];
let taskStatuses      = [];
let holidays          = [];
let taskConflicts     = {};
let conflictTaskId    = null;
let siteSettings      = {};
let _dragTaskId       = null;
let _dragSessionId    = null;
let _dragParentId     = null;
let collapsedTasks    = new Set();
let sessionDates      = new Set();

const _dp = { taskId: null, sessionId: null, start: null, picking: null, hoverDate: null, viewYear: null, viewMonth: null };

const timelineHeader = document.getElementById('timelineHeader');
const timelineTable  = document.getElementById('timelineTable');

async function init() {
  if (typeof PAGE_CAN_EDIT !== 'undefined' && !PAGE_CAN_EDIT) {
    document.getElementById('addMeetingBtn').classList.add('hidden');
  }
  initTooltip();
  bindEvents();
  await loadSiteSettings();
  await Promise.all([loadStatuses(), loadTimeline(), loadAllPersons(), loadHolidays()]);
}

function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'rangeTooltip';
  tip.className = 'range-tooltip';
  document.body.appendChild(tip);

  const tableWrap = document.querySelector('.table-body-wrap') || document.body;

  tableWrap.addEventListener('mouseover', e => {
    const cell = e.target.closest('[data-tooltip]');
    if (!cell) return;
    tip.textContent = cell.dataset.tooltip;
    tip.classList.add('range-tooltip--visible');
  });
  tableWrap.addEventListener('mousemove', e => {
    if (!tip.classList.contains('range-tooltip--visible')) return;
    const x = e.clientX + 12;
    const y = e.clientY + 16;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    tip.style.left = (x + tw > window.innerWidth  ? e.clientX - tw - 8 : x) + 'px';
    tip.style.top  = (y + th > window.innerHeight ? e.clientY - th - 8 : y) + 'px';
  });
  tableWrap.addEventListener('mouseout', e => {
    const cell = e.target.closest('[data-tooltip]');
    if (!cell) return;
    if (!cell.contains(e.relatedTarget)) tip.classList.remove('range-tooltip--visible');
  });
}

async function loadSiteSettings() {
  try {
    const data = await (await fetch('api.php?action=site_settings')).json();
    siteSettings = data.settings || {};
    const root = document.documentElement.style;
    if (siteSettings.weekend_color)     root.setProperty('--weekend-bg',     siteSettings.weekend_color);
    if (siteSettings.meeting_col_color) root.setProperty('--meeting-col-bg', siteSettings.meeting_col_color);
    if (siteSettings.today_col_color)   root.setProperty('--today-col-bg',   siteSettings.today_col_color);
    if (siteSettings.col_item_width)  root.setProperty('--col-item-w',   siteSettings.col_item_width + 'px');
    if (siteSettings.col_status_width) root.setProperty('--col-status-w', siteSettings.col_status_width + 'px');
  } catch {}
}

async function loadHolidays() {
  const data = await (await fetch('api.php?action=holidays')).json();
  holidays = data.holidays || [];
}

async function loadAllPersons() {
  const res  = await fetch('api.php?action=persons');
  const data = await res.json();
  personOptions = data.persons || [];
}

function bindEvents() {
  document.getElementById('prevWeek').onclick  = async () => { visibleStart = addDays(visibleStart, -7); await loadTimeline(); };
  document.getElementById('nextWeek').onclick  = async () => { visibleStart = addDays(visibleStart,  7); await loadTimeline(); };
  document.getElementById('addMeetingBtn').onclick    = () => openMeetingModal();
  document.getElementById('saveMeeting').onclick      = saveMeeting;
  document.getElementById('saveTask').onclick         = saveTask;
  document.getElementById('deleteMeetingBtn').onclick = deleteSession;
  document.getElementById('deleteTaskBtn').onclick    = deleteTask;
  document.getElementById('conflictSuppressBtn').onclick = () => {
    if (conflictTaskId !== null) addSuppressed(conflictTaskId);
    closeModal('conflictModal');
    renderTimeline();
  };
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.onclick = () => closeModal(btn.dataset.close)
  );
  document.querySelectorAll('.modal').forEach(modal =>
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); })
  );
  document.addEventListener('click', e => {
    const picker = document.getElementById('dateRangePicker');
    if (picker && !picker.classList.contains('hidden') &&
        !picker.contains(e.target) && !e.target.closest('.date-cell-editable')) {
      closeDatePicker();
    }
  });

  const bodyWrap   = document.querySelector('.table-body-wrap');
  const headerWrap = document.querySelector('.table-header-wrap');
  bodyWrap.addEventListener('scroll', () => { headerWrap.scrollLeft = bodyWrap.scrollLeft; });

  const search = document.getElementById('personSearch');
  const dropdown = document.getElementById('personDropdown');
  search.oninput = async () => {
    const q   = search.value.trim();
    const res = await fetch(`api.php?action=persons&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    personOptions = data.persons || [];
    renderPersonDropdown();
  };
  search.addEventListener('focus', () => dropdown.classList.remove('dropdown-hidden'));
  search.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('dropdown-hidden'), 150));
}

async function loadStatuses() {
  const res  = await fetch('api.php?action=statuses');
  const data = await res.json();
  taskStatuses = data.statuses || [];
  const sel = document.getElementById('taskStatus');
  sel.innerHTML = taskStatuses.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
}

async function loadTimeline() {
  const start = toISO(visibleStart);
  const res   = await fetch(`api.php?action=plan_timeline&page_id=${PAGE_ID}&start=${start}&days=${VISIBLE_DAYS}`);
  const data  = await res.json();
  timelineSessions = data.sessions || [];
  renderTimeline();
}

function renderTimeline() {
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(visibleStart, i));
  const rows = [];
  sessionDates = new Set();
  timelineSessions.forEach(m => {
    sessionDates.add(m.session_date);
    rows.push({ type: 'meeting', id: m.id, meetingId: m.id, title: m.title, start: m.session_date, end: m.session_date, status: '', level: 0 });
    (m.tasks || []).forEach(t => pushTaskRows(rows, t, m.id, 0));
  });

  const tpl = colTemplate(days.length);

  const header = renderMonthRow(days, tpl) + `
    <div class="timeline-row header" style="grid-template-columns:${tpl}">
      <div class="timeline-cell left-col left-0 drag-col"></div>
      <div class="timeline-cell left-col left-1">${escapeHtml(PAGE_SESSION_LABEL)} / задача</div>
      <div class="timeline-cell left-col left-2">Статус</div>
      <div class="timeline-cell left-col left-3">Сроки</div>
      ${days.map(renderDayHeader).join('')}
    </div>`;

  const sessionsWithAccordions = new Set();
  rows.forEach(r => {
    if (r.type === 'task' && r.level === 1 && r.hasChildren) sessionsWithAccordions.add(r.meetingId);
  });

  const suppressed = getSuppressed();
  taskConflicts = {};
  rows.forEach(r => { if (r.conflicts && r.conflicts.length) taskConflicts[r.id] = r.conflicts; });

  const canDrag = typeof PAGE_CAN_EDIT === 'undefined' || PAGE_CAN_EDIT;
  const dragHandleSvg = `<svg viewBox="0 0 8 12" fill="currentColor" width="8" height="12"><circle cx="2.5" cy="2" r="1.2"/><circle cx="5.5" cy="2" r="1.2"/><circle cx="2.5" cy="6" r="1.2"/><circle cx="5.5" cy="6" r="1.2"/><circle cx="2.5" cy="10" r="1.2"/><circle cx="5.5" cy="10" r="1.2"/></svg>`;
  const body = rows.map(r => {
    const hasConflict = r.type === 'task' && r.conflicts && r.conflicts.length > 0 && !suppressed.has(r.id);
    const warnBtn = hasConflict ? `<button class="conflict-btn" data-task-id="${r.id}" title="Конфликт с расписанием">⚠</button>` : '';
    const toplevelAttr = r.type === 'task' && r.level >= 2 ? ` data-toplevel-task-id="${r.topLevelTaskId}"` : '';
    const taskAttrs = r.type === 'task'
      ? `data-task-id="${r.id}" data-meeting-id="${r.meetingId}" data-parent-id="${r.parentId ?? ''}"${toplevelAttr}`
      : '';
    const dragCell = r.type === 'task' && canDrag
      ? `<span class="drag-handle" draggable="true" title="Перетащить">${dragHandleSvg}</span>`
      : '';
    const accordionBtn = r.type === 'task' && r.level === 1 && r.hasChildren
      ? `<button class="task-collapse-btn" data-task-id="${r.id}" data-meeting-id="${r.meetingId}" title="Свернуть/развернуть подзадачи">▼</button>`
      : '';
    const meetingBtn = r.type === 'meeting' && sessionsWithAccordions.has(r.meetingId)
      ? `<button class="meeting-collapse-btn" data-meeting-id="${r.meetingId}" title="Свернуть/развернуть все">▼</button>`
      : '';
    const hasAccordion = accordionBtn !== '' || meetingBtn !== '';
    return `
    <div class="timeline-row ${r.type}" ${taskAttrs} style="grid-template-columns:${tpl}">
      <div class="timeline-cell left-col left-0 drag-col">${dragCell}</div>
      <div class="timeline-cell left-col left-1 item-cell lvl-${r.level}${hasAccordion ? ' has-accordion' : ''}">
        ${r.type === 'meeting' ? meetingBtn : accordionBtn}
        <span title="${escapeHtml(r.title)}">${warnBtn}${escapeHtml(r.title)}</span>
        <span class="actions">${renderActions(r)}</span>
      </div>
      <div class="timeline-cell left-col left-2">${r.status ? statusPill(r.status) : ''}</div>
      <div class="timeline-cell left-col left-3">${formatPeriod(r.start, r.end)}</div>
      ${days.map(d => renderRangeCell(d, r.start, r.end, r.status, r.directionColor || null, r.responsible || '')).join('')}
    </div>`;
  }).join('');

  timelineHeader.innerHTML = header;
  timelineTable.innerHTML  = body;

  timelineTable.querySelectorAll('.conflict-btn').forEach(btn =>
    btn.onclick = e => { e.stopPropagation(); openConflictModal(Number(btn.dataset.taskId)); }
  );
  timelineTable.querySelectorAll('[data-action="edit-meeting"]').forEach(btn =>
    btn.onclick = () => openMeetingModal(Number(btn.dataset.id))
  );
  timelineTable.querySelectorAll('[data-action="add-task"]').forEach(btn =>
    btn.onclick = () => openTaskModal({ meetingId: Number(btn.dataset.meeting), parentTaskId: btn.dataset.parent || '' })
  );
  timelineTable.querySelectorAll('[data-action="edit-task"]').forEach(btn =>
    btn.onclick = () => openTaskModal({ taskId: Number(btn.dataset.id), meetingId: Number(btn.dataset.meeting) })
  );
  if (canDrag) setupDragDrop();

  if (canDrag) {
    timelineTable.querySelectorAll('.timeline-row.task').forEach(row => {
      const cell = row.querySelector('.left-3');
      if (!cell) return;
      cell.classList.add('date-cell-editable');
      cell.addEventListener('click', () => {
        const taskId    = Number(row.dataset.taskId);
        const sessionId = Number(row.dataset.meetingId);
        const task = findTask(taskId, timelineSessions);
        if (!task) return;
        openDatePicker(taskId, task.start_date, task.end_date, cell);
      });
    });
  }

  applyCollapsedState();
  timelineTable.querySelectorAll('.task-collapse-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const tid = Number(btn.dataset.taskId);
      if (collapsedTasks.has(tid)) collapsedTasks.delete(tid);
      else collapsedTasks.add(tid);
      applyCollapsedState();
    });
  });
  timelineTable.querySelectorAll('.meeting-collapse-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const mid = Number(btn.dataset.meetingId);
      const taskBtns = timelineTable.querySelectorAll(`.task-collapse-btn[data-meeting-id="${mid}"]`);
      const taskIds = Array.from(taskBtns).map(b => Number(b.dataset.taskId));
      const allCollapsed = taskIds.length > 0 && taskIds.every(id => collapsedTasks.has(id));
      taskIds.forEach(id => allCollapsed ? collapsedTasks.delete(id) : collapsedTasks.add(id));
      applyCollapsedState();
    });
  });
}

function pushTaskRows(rows, task, sessionId, level, parentId = null, topLevelTaskId = null) {
  const myTopLevelId = level === 0 ? task.id : topLevelTaskId;
  rows.push({
    type: 'task',
    id: task.id,
    meetingId: sessionId,
    parentId,
    topLevelTaskId: myTopLevelId,
    title: task.title,
    start: task.start_date,
    end: task.end_date,
    status: task.status,
    level: level + 1,
    hasChildren: (task.children || []).length > 0,
    directionColor: task.direction_color || null,
    conflicts: task.conflicts || [],
    responsible: task.responsible || '',
  });
  (task.children || []).forEach(ch => pushTaskRows(rows, ch, sessionId, level + 1, task.id, myTopLevelId));
}

function applyCollapsedState() {
  timelineTable.querySelectorAll('.timeline-row.task[data-toplevel-task-id]').forEach(row => {
    row.style.display = collapsedTasks.has(Number(row.dataset.toplevelTaskId)) ? 'none' : '';
  });
  timelineTable.querySelectorAll('.task-collapse-btn').forEach(btn => {
    btn.textContent = collapsedTasks.has(Number(btn.dataset.taskId)) ? '▶' : '▼';
  });
  timelineTable.querySelectorAll('.meeting-collapse-btn').forEach(btn => {
    const mid = Number(btn.dataset.meetingId);
    const taskBtns = timelineTable.querySelectorAll(`.task-collapse-btn[data-meeting-id="${mid}"]`);
    const taskIds = Array.from(taskBtns).map(b => Number(b.dataset.taskId));
    btn.textContent = taskIds.length > 0 && taskIds.every(id => collapsedTasks.has(id)) ? '▶' : '▼';
  });
}

const addSvg  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`;
const editSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/></svg>`;

function renderActions(row) {
  if (typeof PAGE_CAN_EDIT !== 'undefined' && !PAGE_CAN_EDIT) return '';
  const addBtn = `<button class="btn-icon" title="Добавить задачу" data-action="add-task" data-meeting="${row.meetingId}"${row.type !== 'meeting' ? ` data-parent="${row.id}"` : ''}>${addSvg}</button>`;
  const editBtn = row.type === 'meeting'
    ? `<button class="btn-icon" title="Редактировать" data-action="edit-meeting" data-id="${row.meetingId}">${editSvg}</button>`
    : `<button class="btn-icon" title="Редактировать задачу" data-action="edit-task" data-id="${row.id}" data-meeting="${row.meetingId}">${editSvg}</button>`;
  return addBtn + editBtn;
}

function isHoliday(day) {
  const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  return holidays.some(h => h.date === iso);
}

function renderDayHeader(day) {
  const weekend    = day.getDay() === 0 || day.getDay() === 6 || isHoliday(day) ? 'weekend' : '';
  const isoDay     = toISO(day);
  const sessionDay = sessionDates.has(isoDay) ? 'meeting-day' : '';
  const today      = isoDay === toISO(new Date()) ? 'today' : '';
  return `<div class="timeline-cell day-header ${weekend} ${sessionDay} ${today}">
    <span class="weekday">${weekdays[(day.getDay() + 6) % 7]}</span>
    <strong class="date">${day.getDate()}</strong>
  </div>`;
}

function isDoneStatus(status) {
  const st = taskStatuses.find(s => s.name === status);
  return st && Number(st.is_system) === 1;
}

function renderRangeCell(day, start, end, status = '', directionColor = null, responsible = '') {
  const weekend    = day.getDay() === 0 || day.getDay() === 6 || isHoliday(day) ? 'weekend' : '';
  const d          = toISO(day);
  const isToday    = d === toISO(new Date()) ? 'today' : '';
  if (d < start || d > end || isDoneStatus(status)) return `<div class="timeline-cell day-cell ${isToday} ${weekend}"></div>`;
  const cls = start === end ? 'range-single' : d === start ? 'range-start' : d === end ? 'range-end' : 'range-middle';
  let cellStyle = '';
  let fillStyle = '';
  if (directionColor) {
    const r = parseInt(directionColor.slice(1, 3), 16);
    const g = parseInt(directionColor.slice(3, 5), 16);
    const b = parseInt(directionColor.slice(5, 7), 16);
    cellStyle = ` style="background:rgba(${r},${g},${b},0.08)"`;
    fillStyle = ` style="border-color:${directionColor};background:rgba(${r},${g},${b},0.07)"`;
  }
  const tooltipAttr = responsible ? ` data-tooltip="${escapeHtml(responsible)}"` : '';
  return `<div class="timeline-cell day-cell in-range ${cls} ${weekend}"${cellStyle}${tooltipAttr}><div class="day-fill"${fillStyle}></div></div>`;
}

function pillStyleFromColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const bg   = `rgba(${r},${g},${b},0.13)`;
  const text = `rgb(${Math.round(r * 0.5)},${Math.round(g * 0.5)},${Math.round(b * 0.5)})`;
  return `background:${bg};color:${text}`;
}

function statusPill(status) {
  const map = { 'Сделано': 'done', 'Риск': 'risk', 'В работе': 'in-progress' };
  const st = taskStatuses.find(s => s.name === status);
  if (st && st.color) {
    return `<span class="status-pill" style="${pillStyleFromColor(st.color)}">${escapeHtml(status)}</span>`;
  }
  return `<span class="status-pill status-${map[status] || 'neutral'}">${escapeHtml(status)}</span>`;
}

function openMeetingModal(id = null) {
  document.getElementById('meetingModal').classList.remove('hidden');
  document.getElementById('meetingModalTitle').textContent = id
    ? ('Редактировать ' + PAGE_SESSION_LABEL.toLowerCase())
    : ('Создать ' + PAGE_SESSION_LABEL.toLowerCase());
  const delBtn         = document.getElementById('deleteMeetingBtn');
  const useTemplateRow = document.getElementById('useTemplateRow');
  const topicEl        = document.getElementById('meetingTopic');
  if (!id) {
    document.getElementById('meetingId').value   = '';
    document.getElementById('meetingName').value = '';
    document.getElementById('meetingDate').value = toISO(new Date());
    if (topicEl) topicEl.value = '';
    document.getElementById('useTemplate').checked = false;
    delBtn.classList.add('hidden');
    useTemplateRow.classList.remove('hidden');
    return;
  }
  useTemplateRow.classList.add('hidden');
  const m = timelineSessions.find(x => Number(x.id) === id);
  if (!m) return;
  document.getElementById('meetingId').value   = m.id;
  document.getElementById('meetingName').value = m.title;
  document.getElementById('meetingDate').value = m.session_date;
  if (topicEl) topicEl.value = m.topic || '';
  delBtn.classList.remove('hidden');
}

function openTaskModal({ taskId = null, meetingId: mid, parentTaskId = '' }) {
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskModalTitle').textContent = taskId ? 'Редактировать задачу' : 'Создать задачу';
  selectedPersons = [];
  renderSelectedPersons();
  document.getElementById('taskId').value       = taskId || '';
  document.getElementById('taskMeetingId').value = mid;
  document.getElementById('taskParentId').value  = parentTaskId;
  document.getElementById('taskTitle').value     = '';
  document.getElementById('taskStart').value     = toISO(new Date());
  document.getElementById('taskEnd').value       = toISO(new Date());
  document.getElementById('taskStatus').value    = taskStatuses[0]?.name || '';
  const delBtn = document.getElementById('deleteTaskBtn');
  delBtn.classList.toggle('hidden', !taskId);

  if (taskId) {
    const task = findTask(taskId, timelineSessions);
    if (task) {
      document.getElementById('taskTitle').value  = task.title;
      document.getElementById('taskStart').value  = task.start_date;
      document.getElementById('taskEnd').value    = task.end_date;
      document.getElementById('taskStatus').value = task.status;
      if (task.person_ids) {
        const ids = task.person_ids.split(',').map(Number).filter(Boolean);
        selectedPersons = ids.map(pid => {
          return personOptions.find(p => Number(p.id) === pid) || { id: pid, full_name: '?' };
        });
        renderSelectedPersons();
      }
    }
  } else if (parentTaskId) {
    const parent = findTask(Number(parentTaskId), timelineSessions);
    if (parent) {
      document.getElementById('taskStart').value = parent.start_date;
      document.getElementById('taskEnd').value   = parent.end_date;
      if (parent.person_ids) {
        const ids = parent.person_ids.split(',').map(Number).filter(Boolean);
        selectedPersons = ids.map(pid => {
          return personOptions.find(p => Number(p.id) === pid) || { id: pid, full_name: '?' };
        });
        renderSelectedPersons();
      }
    }
  }
}

async function saveMeeting() {
  const useTemplate = !document.getElementById('meetingId').value && document.getElementById('useTemplate').checked;
  const topicEl = document.getElementById('meetingTopic');
  const payload = {
    id:           document.getElementById('meetingId').value,
    title:        document.getElementById('meetingName').value,
    session_date: document.getElementById('meetingDate').value,
    topic:        topicEl ? topicEl.value : '',
    use_template: useTemplate ? 1 : 0,
    page_id:      PAGE_ID,
  };
  const res  = await fetch('api.php?action=plan_session_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('meetingModal');
  await loadTimeline();
}

async function saveTask() {
  const payload = {
    id:             document.getElementById('taskId').value,
    session_id:     Number(document.getElementById('taskMeetingId').value),
    parent_task_id: document.getElementById('taskParentId').value || null,
    title:          document.getElementById('taskTitle').value,
    start_date:     document.getElementById('taskStart').value,
    end_date:       document.getElementById('taskEnd').value,
    status:         document.getElementById('taskStatus').value,
    person_ids:     selectedPersons.filter(p => p.id > 0).map(p => p.id),
    page_id:        PAGE_ID,
  };
  const res  = await fetch('api.php?action=plan_task_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  const savedId = data.id;
  closeModal('taskModal');
  await loadTimeline();
  const suppressed = getSuppressed();
  if (taskConflicts[savedId] && taskConflicts[savedId].length > 0 && !suppressed.has(savedId)) {
    openConflictModal(savedId);
  }
}

async function deleteSession() {
  const id = Number(document.getElementById('meetingId').value);
  if (!id) return;
  if (!confirm('Удалить ' + PAGE_SESSION_LABEL.toLowerCase() + ' и все связанные с ним задачи?')) return;
  const res  = await fetch('api.php?action=plan_session_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, page_id: PAGE_ID }) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('meetingModal');
  await loadTimeline();
}

async function deleteTask() {
  const id = Number(document.getElementById('taskId').value);
  if (!id) return;
  if (!confirm('Удалить задачу и все её подзадачи?')) return;
  const res  = await fetch('api.php?action=plan_task_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('taskModal');
  await loadTimeline();
}

function renderPersonDropdown() {
  const dropdown = document.getElementById('personDropdown');
  const search = document.getElementById('personSearch');
  if (document.activeElement !== search) dropdown.classList.add('dropdown-hidden');
  dropdown.innerHTML = personOptions
    .filter(p => !selectedPersons.some(s => s.id === p.id))
    .map(p => `<div class="dropdown-item" data-id="${p.id}">${escapeHtml(p.full_name)}<small>${escapeHtml(p.email || '')}</small></div>`)
    .join('');
  dropdown.querySelectorAll('.dropdown-item').forEach(opt => opt.onclick = () => {
    const person = personOptions.find(p => p.id === Number(opt.dataset.id));
    if (person) selectedPersons.push(person);
    renderSelectedPersons();
    renderPersonDropdown();
  });
}

function renderSelectedPersons() {
  const container = document.getElementById('selectedPersons');
  container.innerHTML = selectedPersons
    .map(p => `<span class="person-tag">${escapeHtml(p.full_name)}<button data-id="${p.id}">×</button></span>`)
    .join('');
  container.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    selectedPersons = selectedPersons.filter(p => p.id !== Number(btn.dataset.id));
    renderSelectedPersons();
    renderPersonDropdown();
  });
}

function setupDragDrop() {
  timelineTable.querySelectorAll('.drag-handle').forEach(handle => {
    handle.ondragstart = e => {
      const row = handle.closest('[data-task-id]');
      if (!row) return;
      _dragTaskId    = Number(row.dataset.taskId);
      _dragSessionId = Number(row.dataset.meetingId);
      _dragParentId  = row.dataset.parentId !== '' ? Number(row.dataset.parentId) : null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(_dragTaskId));
      requestAnimationFrame(() => row.classList.add('dragging'));
    };
    handle.ondragend = () => {
      _dragTaskId = null;
      timelineTable.querySelectorAll('.dragging, .drag-over').forEach(el => el.classList.remove('dragging', 'drag-over'));
    };
  });

  timelineTable.querySelectorAll('[data-task-id]').forEach(row => {
    row.ondragover = e => {
      if (_dragTaskId === null) return;
      const targetId      = Number(row.dataset.taskId);
      const targetParent  = row.dataset.parentId !== '' ? Number(row.dataset.parentId) : null;
      const targetSession = Number(row.dataset.meetingId);
      if (targetSession !== _dragSessionId) return;
      if (String(targetParent) !== String(_dragParentId)) return;
      if (targetId === _dragTaskId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      timelineTable.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      row.classList.add('drag-over');
    };
    row.ondragleave = e => {
      if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over');
    };
    row.ondrop = async e => {
      e.preventDefault();
      if (_dragTaskId === null) return;
      const targetId      = Number(row.dataset.taskId);
      const targetParent  = row.dataset.parentId !== '' ? Number(row.dataset.parentId) : null;
      const targetSession = Number(row.dataset.meetingId);
      if (targetSession !== _dragSessionId) return;
      if (String(targetParent) !== String(_dragParentId)) return;
      if (targetId === _dragTaskId) return;
      row.classList.remove('drag-over');
      const session = timelineSessions.find(s => Number(s.id) === _dragSessionId);
      if (!session) return;
      const siblings = _dragParentId !== null
        ? (findTask(_dragParentId, [session])?.children || [])
        : (session.tasks || []);
      const fromIdx = siblings.findIndex(t => Number(t.id) === _dragTaskId);
      const toIdx   = siblings.findIndex(t => Number(t.id) === targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = siblings.splice(fromIdx, 1);
      siblings.splice(toIdx, 0, moved);
      renderTimeline();
      await fetch('api.php?action=plan_task_reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: siblings.map(t => Number(t.id)) }),
      });
    };
  });
}

function renderMonthRow(days, tpl) {
  const groups = [];
  for (const d of days) {
    const m = d.getMonth(), y = d.getFullYear();
    if (!groups.length || groups[groups.length - 1].m !== m || groups[groups.length - 1].y !== y)
      groups.push({ m, y, count: 1 });
    else
      groups[groups.length - 1].count++;
  }
  const cells = groups.map(g =>
    `<div class="timeline-cell month-cell" style="grid-column:span ${g.count}">${monthsRu[g.m]} ${g.y}</div>`
  ).join('');
  return `<div class="timeline-row header month-row" style="grid-template-columns:${tpl}">
    <div class="timeline-cell left-col month-left" style="grid-column:span 4"></div>
    ${cells}
  </div>`;
}

function openDatePicker(taskId, startISO, endISO, anchorEl) {
  _dp.taskId    = taskId;
  _dp.start     = startISO;
  _dp.picking   = 'start';
  _dp.hoverDate = null;
  const d = new Date(startISO + 'T00:00:00');
  _dp.viewYear  = d.getFullYear();
  _dp.viewMonth = d.getMonth();
  renderDatePickerFull();
  positionDatePicker(anchorEl);
  document.getElementById('dateRangePicker').classList.remove('hidden');
}

function closeDatePicker() {
  document.getElementById('dateRangePicker').classList.add('hidden');
  _dp.taskId = null;
}

function renderDatePickerFull() {
  const picker = document.getElementById('dateRangePicker');
  const year = _dp.viewYear, month = _dp.viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startWd  = (firstDay.getDay() + 6) % 7;
  const today    = toISO(new Date());

  const hdrs = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
    .map(d => `<div class="dp-day-hdr">${d}</div>`).join('');

  let cells = '';
  for (let i = 0; i < startWd; i++) {
    const dt = new Date(year, month, i - startWd + 1);
    cells += `<div class="dp-day dp-other-month" data-date="${toISO(dt)}">${dt.getDate()}</div>`;
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += `<div class="dp-day${iso === today ? ' dp-today' : ''}" data-date="${iso}">${d}</div>`;
  }
  const tail = 7 * Math.ceil((startWd + lastDay.getDate()) / 7) - startWd - lastDay.getDate();
  for (let d = 1; d <= tail; d++) {
    const dt = new Date(year, month + 1, d);
    cells += `<div class="dp-day dp-other-month" data-date="${toISO(dt)}">${dt.getDate()}</div>`;
  }

  picker.innerHTML = `
    <div class="dp-header">
      <button class="dp-nav" id="dpPrev">‹</button>
      <span class="dp-month-label">${monthsRu[month]} ${year}</span>
      <button class="dp-nav" id="dpNext">›</button>
    </div>
    <div class="dp-grid">${hdrs}${cells}</div>
    <div class="dp-footer">${_dp.picking === 'start' ? 'Начало периода' : 'Конец периода'}</div>`;

  picker.querySelector('#dpPrev').addEventListener('click', e => {
    e.stopPropagation();
    if (--_dp.viewMonth < 0) { _dp.viewMonth = 11; _dp.viewYear--; }
    renderDatePickerFull(); updateRangeHighlight();
  });
  picker.querySelector('#dpNext').addEventListener('click', e => {
    e.stopPropagation();
    if (++_dp.viewMonth > 11) { _dp.viewMonth = 0; _dp.viewYear++; }
    renderDatePickerFull(); updateRangeHighlight();
  });
  picker.querySelector('.dp-grid').addEventListener('mouseleave', () => {
    if (_dp.picking === 'end' && _dp.hoverDate) { _dp.hoverDate = null; updateRangeHighlight(); }
  });
  picker.querySelectorAll('.dp-day').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      if (_dp.picking === 'end') { _dp.hoverDate = cell.dataset.date; updateRangeHighlight(); }
    });
    cell.addEventListener('click', e => {
      e.stopPropagation();
      const date = cell.dataset.date;
      if (_dp.picking === 'start') {
        _dp.start   = date;
        _dp.picking = 'end';
        picker.querySelector('.dp-footer').textContent = 'Конец периода';
        updateRangeHighlight();
      } else {
        let [s, en] = _dp.start <= date ? [_dp.start, date] : [date, _dp.start];
        const tid = _dp.taskId;
        closeDatePicker();
        saveDateRange(tid, s, en);
      }
    });
  });
  updateRangeHighlight();
}

function updateRangeHighlight() {
  const picker = document.getElementById('dateRangePicker');
  if (!picker) return;
  const s = _dp.picking === 'start' ? null : _dp.start;
  const e = _dp.picking === 'end'   ? (_dp.hoverDate || _dp.start) : null;
  picker.querySelectorAll('.dp-day[data-date]').forEach(cell => {
    const iso = cell.dataset.date;
    cell.classList.remove('dp-range-start', 'dp-range-end', 'dp-in-range', 'dp-range-single');
    if (!s) return;
    const lo = s <= (e || s) ? s : (e || s);
    const hi = s <= (e || s) ? (e || s) : s;
    if (iso === lo && iso === hi) cell.classList.add('dp-range-single');
    else if (iso === lo)          cell.classList.add('dp-range-start');
    else if (iso === hi)          cell.classList.add('dp-range-end');
    else if (iso > lo && iso < hi) cell.classList.add('dp-in-range');
  });
}

function positionDatePicker(anchorEl) {
  const picker = document.getElementById('dateRangePicker');
  picker.style.visibility = 'hidden';
  picker.classList.remove('hidden');
  const rect = anchorEl.getBoundingClientRect();
  const pw = picker.offsetWidth, ph = picker.offsetHeight;
  picker.classList.add('hidden');
  picker.style.visibility = '';
  let top  = rect.bottom + 4;
  let left = rect.left;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (left < 8) left = 8;
  if (top + ph > window.innerHeight - 8) top = rect.top - ph - 4;
  if (top < 8) top = 8;
  picker.style.top  = top  + 'px';
  picker.style.left = left + 'px';
}

async function saveDateRange(taskId, startDate, endDate) {
  const res  = await fetch('api.php?action=plan_task_dates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: taskId, start_date: startDate, end_date: endDate }),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  await loadTimeline();
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function colTemplate(n) {
  const dragW    = 28;
  const itemW    = parseInt(siteSettings.col_item_width   || 200);
  const statusW  = parseInt(siteSettings.col_status_width || 80);
  const datesW   = 100;
  const dayMinW  = parseInt(siteSettings.col_day_min_width || 0);
  return `${dragW}px ${itemW}px ${statusW}px ${datesW}px repeat(${n}, minmax(${dayMinW}px, 1fr))`;
}
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfWeek(date) { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
function toISO(date) { if (typeof date === 'string') return date; return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function fmtDM(iso) { const d = new Date(iso + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`; }
function formatPeriod(s, e) { return s === e ? fmtDM(s) : `${fmtDM(s)} – ${fmtDM(e)}`; }
function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function findTask(id, sessions) {
  function walk(tasks) {
    for (const t of tasks) {
      if (Number(t.id) === Number(id)) return t;
      const c = walk(t.children || []);
      if (c) return c;
    }
    return null;
  }
  for (const s of sessions) { const f = walk(s.tasks || []); if (f) return f; }
  return null;
}

const SUPPRESSED_KEY = 'conflictSuppressed';

function getSuppressed() {
  try { return new Set(JSON.parse(localStorage.getItem(SUPPRESSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function addSuppressed(taskId) {
  const s = getSuppressed();
  s.add(taskId);
  localStorage.setItem(SUPPRESSED_KEY, JSON.stringify([...s]));
}

const EVENT_TYPE_LABELS = { vacation: 'Отпуск', study: 'Учёба' };

function openConflictModal(taskId) {
  conflictTaskId = taskId;
  const conflicts = taskConflicts[taskId] || [];
  document.getElementById('conflictList').innerHTML = conflicts.map(c =>
    `<div class="conflict-row">
      <span class="conflict-person">${escapeHtml(c.person)}</span>
      <span class="conflict-type">${escapeHtml(EVENT_TYPE_LABELS[c.event_type] || c.event_type)}</span>
      <span class="conflict-dates">${fmtDM(c.start)}–${fmtDM(c.end)}</span>
    </div>`
  ).join('');
  document.getElementById('conflictModal').classList.remove('hidden');
}

init();
