const VISIBLE_DAYS = 35;
const weekdays  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthsRu  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

let visibleStart     = addDays(startOfWeek(new Date()), -7);
let selectedPersons  = [];
let personOptions    = [];
let timelineMeetings = [];
let taskStatuses = [];
let holidays = [];
let taskConflicts = {};
let conflictTaskId = null;

const timelineHeader = document.getElementById('timelineHeader');
const timelineTable  = document.getElementById('timelineTable');

async function init() {
  if (typeof PAGE_CAN_EDIT !== 'undefined' && !PAGE_CAN_EDIT) {
    document.getElementById('addMeetingBtn').classList.add('hidden');
  }
  bindEvents();
  await Promise.all([loadStatuses(), loadTimeline(), loadAllPersons(), loadHolidays()]);
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
  document.getElementById('deleteMeetingBtn').onclick = deleteMeeting;
  document.getElementById('deleteTaskBtn').onclick    = deleteTask;
  document.getElementById('conflictSuppressBtn').onclick = () => {
    if (conflictTaskId !== null) addSuppressed(conflictTaskId);
    closeModal('conflictModal');
    renderTimeline();
  };
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.onclick = () => closeModal(btn.dataset.close)
  );

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
  const res   = await fetch(`api.php?action=timeline&start=${start}&days=${VISIBLE_DAYS}`);
  const data  = await res.json();
  timelineMeetings = data.meetings || [];
  renderTimeline();
}

function renderTimeline() {
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(visibleStart, i));
  const rows = [];
  timelineMeetings.forEach(m => {
    rows.push({ type: 'meeting', id: m.id, meetingId: m.id, title: m.title, start: m.meeting_date, end: m.meeting_date, status: '', level: 0 });
    (m.tasks || []).forEach(t => pushTaskRows(rows, t, m.id, 0));
  });

  const tpl = colTemplate(days.length);

  const header = renderMonthRow(days, tpl) + `
    <div class="timeline-row header" style="grid-template-columns:${tpl}">
      <div class="timeline-cell left-col left-1">Заседание / задача</div>
      <div class="timeline-cell left-col left-2">Сроки</div>
      <div class="timeline-cell left-col left-3">Статус</div>
      ${days.map(renderDayHeader).join('')}
    </div>`;

  const suppressed = getSuppressed();
  taskConflicts = {};
  rows.forEach(r => { if (r.conflicts && r.conflicts.length) taskConflicts[r.id] = r.conflicts; });

  const body = rows.map(r => {
    const hasConflict = r.type === 'task' && r.conflicts && r.conflicts.length > 0 && !suppressed.has(r.id);
    const warnBtn = hasConflict ? `<button class="conflict-btn" data-task-id="${r.id}" title="Конфликт с расписанием">⚠</button>` : '';
    return `
    <div class="timeline-row ${r.type}" style="grid-template-columns:${tpl}">
      <div class="timeline-cell left-col left-1 item-cell lvl-${r.level}">
        <span title="${escapeHtml(r.title)}">${warnBtn}${escapeHtml(r.title)}</span>
        <span class="actions">${renderActions(r)}</span>
      </div>
      <div class="timeline-cell left-col left-2">${formatPeriod(r.start, r.end)}</div>
      <div class="timeline-cell left-col left-3">${r.status ? statusPill(r.status) : ''}</div>
      ${days.map(d => renderRangeCell(d, r.start, r.end, r.status, r.directionColor || null)).join('')}
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
}

function pushTaskRows(rows, task, meetingId, level) {
  rows.push({
    type: 'task',
    id: task.id,
    meetingId,
    title: task.title,
    start: task.start_date,
    end: task.end_date,
    status: task.status,
    level: level + 1,
    directionColor: task.direction_color || null,
    conflicts: task.conflicts || [],
  });
  (task.children || []).forEach(ch => pushTaskRows(rows, ch, meetingId, level + 1));
}

const addSvg  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`;
const editSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/></svg>`;

function renderActions(row) {
  if (typeof PAGE_CAN_EDIT !== 'undefined' && !PAGE_CAN_EDIT) return '';
  const addBtn = `<button class="btn-icon" title="Добавить задачу" data-action="add-task" data-meeting="${row.meetingId}"${row.type !== 'meeting' ? ` data-parent="${row.id}"` : ''}>${addSvg}</button>`;
  const editBtn = row.type === 'meeting'
    ? `<button class="btn-icon" title="Редактировать заседание" data-action="edit-meeting" data-id="${row.meetingId}">${editSvg}</button>`
    : `<button class="btn-icon" title="Редактировать задачу"    data-action="edit-task"    data-id="${row.id}" data-meeting="${row.meetingId}">${editSvg}</button>`;
  return addBtn + editBtn;
}

function isHoliday(day) {
  const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  return holidays.some(h => h.date === iso);
}

function renderDayHeader(day) {
  const weekend = day.getDay() === 0 || day.getDay() === 6 || isHoliday(day) ? 'weekend' : '';
  const today   = toISO(day) === toISO(new Date()) ? 'today' : '';
  return `<div class="timeline-cell day-header ${weekend} ${today}">
    <span class="weekday">${weekdays[(day.getDay() + 6) % 7]}</span>
    <strong class="date">${day.getDate()}</strong>
  </div>`;
}

function isDoneStatus(status) {
  const st = taskStatuses.find(s => s.name === status);
  return st && Number(st.is_system) === 1;
}

function renderRangeCell(day, start, end, status = '', directionColor = null) {
  const weekend = day.getDay() === 0 || day.getDay() === 6 || isHoliday(day) ? 'weekend' : '';
  const d = toISO(day);
  if (d < start || d > end || isDoneStatus(status)) return `<div class="timeline-cell day-cell ${weekend}"></div>`;
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
  return `<div class="timeline-cell day-cell in-range ${cls} ${weekend}"${cellStyle}><div class="day-fill"${fillStyle}></div></div>`;
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
  document.getElementById('meetingModalTitle').textContent = id ? 'Редактировать заседание' : 'Создать заседание';
  const delBtn        = document.getElementById('deleteMeetingBtn');
  const useTemplateRow = document.getElementById('useTemplateRow');
  if (!id) {
    meetingId.value    = '';
    meetingName.value  = '';
    meetingDate.value  = toISO(new Date());
    meetingTopic.value = '';
    document.getElementById('useTemplate').checked = false;
    delBtn.classList.add('hidden');
    useTemplateRow.classList.remove('hidden');
    return;
  }
  useTemplateRow.classList.add('hidden');
  const m = timelineMeetings.find(x => Number(x.id) === id);
  if (!m) return;
  meetingId.value    = m.id;
  meetingName.value  = m.title;
  meetingDate.value  = m.meeting_date;
  meetingTopic.value = m.topic;
  delBtn.classList.remove('hidden');
}

function openTaskModal({ taskId = null, meetingId: mid, parentTaskId = '' }) {
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskModalTitle').textContent = taskId ? 'Редактировать задачу' : 'Создать задачу';
  selectedPersons = [];
  renderSelectedPersons();
  taskIdInput.value    = taskId || '';
  taskMeetingId.value  = mid;
  taskParentId.value   = parentTaskId;
  taskTitle.value      = '';
  taskStart.value      = toISO(new Date());
  taskEnd.value        = toISO(new Date());
  taskStatus.value     = taskStatuses[0]?.name || '';
  const delBtn = document.getElementById('deleteTaskBtn');
  delBtn.classList.toggle('hidden', !taskId);

  if (taskId) {
    const task = findTask(taskId, timelineMeetings);
    if (task) {
      taskTitle.value  = task.title;
      taskStart.value  = task.start_date;
      taskEnd.value    = task.end_date;
      taskStatus.value = task.status;
      if (task.person_ids) {
        const ids = task.person_ids.split(',').map(Number).filter(Boolean);
        selectedPersons = ids.map(pid => {
          return personOptions.find(p => Number(p.id) === pid) || { id: pid, full_name: '?' };
        });
        renderSelectedPersons();
      }
    }
  }
}

async function saveMeeting() {
  const useTemplate = !meetingId.value && document.getElementById('useTemplate').checked;
  const payload = { id: meetingId.value, title: meetingName.value, meeting_date: meetingDate.value, topic: meetingTopic.value, use_template: useTemplate ? 1 : 0 };
  const res  = await fetch('api.php?action=meeting_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('meetingModal');
  await loadTimeline();
}

async function saveTask() {
  const payload = {
    id:             taskIdInput.value,
    meeting_id:     Number(taskMeetingId.value),
    parent_task_id: taskParentId.value || null,
    title:          taskTitle.value,
    start_date:     taskStart.value,
    end_date:       taskEnd.value,
    status:         taskStatus.value,
    person_ids:     selectedPersons.filter(p => p.id > 0).map(p => p.id),
  };
  const res  = await fetch('api.php?action=task_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

async function deleteMeeting() {
  const id = Number(meetingId.value);
  if (!id) return;
  if (!confirm('Удалить заседание и все связанные с ним задачи?')) return;
  const res  = await fetch('api.php?action=meeting_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('meetingModal');
  await loadTimeline();
}

async function deleteTask() {
  const id = Number(taskIdInput.value);
  if (!id) return;
  if (!confirm('Удалить задачу и все её подзадачи?')) return;
  const res  = await fetch('api.php?action=task_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
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
    <div class="timeline-cell left-col month-left" style="grid-column:span 3"></div>
    ${cells}
  </div>`;
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function colTemplate(n) { return `200px 100px 80px repeat(${n}, minmax(0, 1fr))`; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfWeek(date) { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
function toISO(date) { return typeof date === 'string' ? date : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10); }
function fmtDM(iso) { const d = new Date(iso + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`; }
function formatPeriod(s, e) { return s === e ? fmtDM(s) : `${fmtDM(s)}–${fmtDM(e)}`; }
function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function findTask(id, meetings) {
  function walk(tasks) {
    for (const t of tasks) {
      if (Number(t.id) === Number(id)) return t;
      const c = walk(t.children || []);
      if (c) return c;
    }
    return null;
  }
  for (const m of meetings) { const f = walk(m.tasks || []); if (f) return f; }
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

const meetingId    = document.getElementById('meetingId');
const meetingName  = document.getElementById('meetingName');
const meetingDate  = document.getElementById('meetingDate');
const meetingTopic = document.getElementById('meetingTopic');
const taskIdInput  = document.getElementById('taskId');
const taskMeetingId = document.getElementById('taskMeetingId');
const taskParentId  = document.getElementById('taskParentId');
const taskTitle    = document.getElementById('taskTitle');
const taskStart    = document.getElementById('taskStart');
const taskEnd      = document.getElementById('taskEnd');
const taskStatus   = document.getElementById('taskStatus');

init();
