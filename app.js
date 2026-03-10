const VISIBLE_DAYS = 35;
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

let visibleStart = startOfWeek(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
let selectedPersons = [];
let personOptions = [];
let timelineMeetings = [];

const timelineTable = document.getElementById('timelineTable');
const calendarLabel = document.getElementById('calendarLabel');

async function init() {
  bindEvents();
  await loadTimeline();
}

function bindEvents() {
  document.getElementById('prevWeek').onclick = async () => { visibleStart = addDays(visibleStart, -7); await loadTimeline(); };
  document.getElementById('nextWeek').onclick = async () => { visibleStart = addDays(visibleStart, 7); await loadTimeline(); };
  document.getElementById('addMeetingBtn').onclick = () => openMeetingModal();
  document.getElementById('saveMeeting').onclick = saveMeeting;
  document.getElementById('saveTask').onclick = saveTask;
  document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => closeModal(btn.dataset.close));

  const search = document.getElementById('personSearch');
  search.oninput = async () => {
    const q = search.value.trim();
    const res = await fetch(`api.php?action=persons&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    personOptions = data.persons || [];
    renderPersonDropdown();
  };
}

async function loadTimeline() {
  const start = toISO(visibleStart);
  const res = await fetch(`api.php?action=timeline&start=${start}&days=${VISIBLE_DAYS}`);
  const data = await res.json();
  timelineMeetings = data.meetings || [];
  renderTimeline();
}

function renderTimeline() {
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(visibleStart, i));
  const first = monthFormatter.format(days[0]);
  const last = monthFormatter.format(days[days.length - 1]);
  calendarLabel.textContent = first === last ? first : `${first} — ${last}`;

  let rows = [];
  timelineMeetings.forEach(m => {
    rows.push({ type: 'meeting', id: m.id, meetingId: m.id, parentTaskId: '', title: m.title, start: m.meeting_date, end: m.meeting_date, status: 'В работе', meta: m });
    (m.tasks || []).forEach(t => pushTaskRows(rows, t, m.id, 0));
  });

  const header = `
    <div class="timeline-row header" style="grid-template-columns:${colTemplate(days.length)}">
      <div class="timeline-cell left-col left-1">Заседание / задача</div>
      <div class="timeline-cell left-col left-2" style="left:340px">Сроки</div>
      <div class="timeline-cell left-col left-3" style="left:520px">Статус</div>
      ${days.map(renderDayHeader).join('')}
    </div>`;

  const body = rows.map(r => `
    <div class="timeline-row ${r.type}" style="grid-template-columns:${colTemplate(days.length)}">
      <div class="timeline-cell left-col left-1 item-cell lvl-${r.level || 0}">
        <span>${escapeHtml(r.title)}</span>
        <span class="actions">${renderActions(r)}</span>
      </div>
      <div class="timeline-cell left-col left-2" style="left:340px">${formatPeriod(r.start, r.end)}</div>
      <div class="timeline-cell left-col left-3" style="left:520px">${r.status}</div>
      ${days.map(d => renderRangeCell(d, r.start, r.end)).join('')}
    </div>
  `).join('');

  timelineTable.innerHTML = header + body;

  document.querySelectorAll('[data-action="edit-meeting"]').forEach(btn => btn.onclick = () => openMeetingModal(Number(btn.dataset.id)));
  document.querySelectorAll('[data-action="add-task"]').forEach(btn => btn.onclick = () => openTaskModal({ meetingId: Number(btn.dataset.meeting), parentTaskId: btn.dataset.parent || '' }));
  document.querySelectorAll('[data-action="edit-task"]').forEach(btn => btn.onclick = () => openTaskModal({ taskId: Number(btn.dataset.id), meetingId: Number(btn.dataset.meeting) }));
}

function pushTaskRows(rows, task, meetingId, level) {
  rows.push({
    type: 'task',
    id: task.id,
    meetingId,
    parentTaskId: task.parent_task_id || '',
    title: task.title,
    start: task.start_date,
    end: task.end_date,
    status: task.status,
    level: level + 1,
    persons: task.responsible || '',
    raw: task,
  });
  (task.children || []).forEach(ch => pushTaskRows(rows, ch, meetingId, level + 1));
}

function renderActions(row) {
  if (row.type === 'meeting') return `<button data-action="add-task" data-meeting="${row.meetingId}">＋</button><button data-action="edit-meeting" data-id="${row.meetingId}">✎</button>`;
  return `<button data-action="add-task" data-meeting="${row.meetingId}" data-parent="${row.id}">＋</button><button data-action="edit-task" data-id="${row.id}" data-meeting="${row.meetingId}">✎</button>`;
}

function renderDayHeader(day) {
  const weekend = day.getDay() === 0 || day.getDay() === 6 ? 'weekend' : '';
  return `<div class="timeline-cell day-header ${weekend}"><span>${weekdays[(day.getDay() + 6) % 7]}</span><strong>${day.getDate()}</strong></div>`;
}

function renderRangeCell(day, start, end) {
  const weekend = day.getDay() === 0 || day.getDay() === 6 ? 'weekend' : '';
  const d = toISO(day);
  if (d < start || d > end) return `<div class="timeline-cell day-cell ${weekend}"></div>`;
  const cls = start === end ? 'range-single' : d === start ? 'range-start' : d === end ? 'range-end' : 'range-middle';
  return `<div class="timeline-cell day-cell in-range ${cls} ${weekend}"><div class="day-fill"></div></div>`;
}

function openMeetingModal(id = null) {
  const modal = document.getElementById('meetingModal');
  modal.classList.remove('hidden');
  if (!id) {
    meetingId.value = '';
    meetingName.value = '';
    meetingDate.value = toISO(new Date());
    meetingTopic.value = '';
    return;
  }
  const m = timelineMeetings.find(x => x.id === id);
  meetingId.value = m.id;
  meetingName.value = m.title;
  meetingDate.value = m.meeting_date;
  meetingTopic.value = m.topic;
}

function openTaskModal({ taskId = null, meetingId, parentTaskId = '' }) {
  const modal = document.getElementById('taskModal');
  modal.classList.remove('hidden');
  selectedPersons = [];
  renderSelectedPersons();
  taskIdInput.value = taskId || '';
  taskMeetingId.value = meetingId;
  taskParentId.value = parentTaskId;
  taskTitle.value = '';
  taskStart.value = toISO(new Date());
  taskEnd.value = toISO(new Date());
  taskStatus.value = 'В работе';

  if (taskId) {
    const task = findTask(taskId, timelineMeetings);
    if (task) {
      taskTitle.value = task.title;
      taskStart.value = task.start_date;
      taskEnd.value = task.end_date;
      taskStatus.value = task.status;
      if (task.responsible) {
        selectedPersons = task.responsible.split(',').map((name, idx) => ({ id: -idx - 1, full_name: name.trim() }));
        renderSelectedPersons();
      }
    }
  }
}

async function saveMeeting() {
  const payload = { id: meetingId.value, title: meetingName.value, meeting_date: meetingDate.value, topic: meetingTopic.value };
  const res = await fetch('api.php?action=meeting_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('meetingModal');
  await loadTimeline();
}

async function saveTask() {
  const payload = {
    id: taskIdInput.value,
    meeting_id: Number(taskMeetingId.value),
    parent_task_id: taskParentId.value || null,
    title: taskTitle.value,
    start_date: taskStart.value,
    end_date: taskEnd.value,
    status: taskStatus.value,
    person_ids: selectedPersons.filter(p => p.id > 0).map(p => p.id),
  };
  const res = await fetch('api.php?action=task_save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.error) return alert(data.error);
  closeModal('taskModal');
  await loadTimeline();
}

function renderPersonDropdown() {
  const dropdown = document.getElementById('personDropdown');
  dropdown.innerHTML = personOptions
    .filter(p => !selectedPersons.some(s => s.id === p.id))
    .map(p => `<div class="dropdown-item" data-id="${p.id}">${escapeHtml(p.full_name)} <small>${escapeHtml(p.email || '')}</small></div>`)
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
  container.innerHTML = selectedPersons.map(p => `<span class="person-tag">${escapeHtml(p.full_name)} <button data-id="${p.id}">×</button></span>`).join('');
  container.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    selectedPersons = selectedPersons.filter(p => p.id !== Number(btn.dataset.id));
    renderSelectedPersons();
    renderPersonDropdown();
  });
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function colTemplate(dayCount) { return `340px 180px 110px repeat(${dayCount}, 36px)`; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfWeek(date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d; }
function toISO(date) { return typeof date === 'string' ? date : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10); }
function formatPeriod(start, end) { return start === end ? dateFormatter.format(new Date(start)) : `${dateFormatter.format(new Date(start))}—${dateFormatter.format(new Date(end))}`; }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function findTask(id, meetings) {
  for (const m of meetings) {
    const f = walk(m.tasks || []);
    if (f) return f;
  }
  return null;
  function walk(tasks) { for (const t of tasks) { if (t.id === id) return t; const c = walk(t.children || []); if (c) return c; } return null; }
}

const meetingId = document.getElementById('meetingId');
const meetingName = document.getElementById('meetingName');
const meetingDate = document.getElementById('meetingDate');
const meetingTopic = document.getElementById('meetingTopic');
const taskIdInput = document.getElementById('taskId');
const taskMeetingId = document.getElementById('taskMeetingId');
const taskParentId = document.getElementById('taskParentId');
const taskTitle = document.getElementById('taskTitle');
const taskStart = document.getElementById('taskStart');
const taskEnd = document.getElementById('taskEnd');
const taskStatus = document.getElementById('taskStatus');

init();
