'use strict';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const EVENT_CFG = {
  duty:          { label: 'Дежурство',       multi: false, symbol: '✕' },
  no_duty:       { label: 'Не ставить деж.', multi: false, symbol: 'о' },
  vacation:      { label: 'Отпуск',          multi: true,  bg: '#fef9c3', fg: '#854d0e' },
  business_trip: { label: 'Командировка',    multi: true,  bg: '#ede9fe', fg: '#6d28d9' },
  sick_leave:    { label: 'Больничный',      multi: true,  bg: '#dbeafe', fg: '#1e40af' },
  study:         { label: 'Учёба',           multi: true,  bg: '#ffedd5', fg: '#9a3412' },
};

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;
let persons  = [];
let events   = [];
let holidays = [];
let pending  = null; // { personId, type, startIso }
let delId    = null;
let hintEl   = null;

const todayISO = fmtISO(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

function fmtISO(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function escHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function init() {
  document.getElementById('prevMonth').onclick = () => navigate(-1);
  document.getElementById('nextMonth').onclick = () => navigate(1);
  document.getElementById('deleteEventNo').onclick  = closeDelModal;
  document.getElementById('deleteEventYes').onclick = doDelete;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { removeContextMenu(); cancelPending(); }
  });
  await Promise.all([loadPersons(), loadEvents(), loadHolidays()]);
  render();
}

async function navigate(dir) {
  curMonth += dir;
  if (curMonth > 12) { curMonth = 1; curYear++; }
  if (curMonth < 1)  { curMonth = 12; curYear--; }
  cancelPending();
  removeContextMenu();
  await loadEvents();
  render();
}

async function loadPersons() {
  persons = ((await (await fetch('api.php?action=persons')).json()).persons) || [];
}
async function loadEvents() {
  events = ((await (await fetch(`api.php?action=duty_events&year=${curYear}&month=${curMonth}`)).json()).events) || [];
}
async function loadHolidays() {
  holidays = ((await (await fetch('api.php?action=holidays')).json()).holidays) || [];
}

function render() {
  const total = daysInMonth(curYear, curMonth);
  const days  = Array.from({length: total}, (_, i) => i + 1);
  const tpl   = `180px repeat(${total}, minmax(26px, 1fr))`;

  document.getElementById('monthLabel').textContent = `${MONTHS_RU[curMonth - 1]} ${curYear}`;

  document.getElementById('dutyHeader').innerHTML =
    `<div class="duty-row duty-header-row" style="grid-template-columns:${tpl}">
      <div class="duty-cell duty-person-col duty-hdr-cell">Сотрудник</div>
      ${days.map(d => {
        const date    = new Date(curYear, curMonth - 1, d);
        const dow     = date.getDay();
        const we      = dow === 0 || dow === 6 || holidays.some(h => h.date === fmtISO(curYear, curMonth, d));
        const wd      = WEEKDAYS[(dow + 6) % 7];
        const isToday = fmtISO(curYear, curMonth, d) === todayISO;
        return `<div class="duty-cell duty-day-hdr ${we ? 'weekend' : ''} ${isToday ? 'duty-today' : ''}">
          <span class="duty-wd">${wd}</span><strong class="duty-dn">${d}</strong>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('dutyBody').innerHTML = persons.map(p => {
    const pEvts = events.filter(e => Number(e.person_id) === Number(p.id));
    return `<div class="duty-row" style="grid-template-columns:${tpl}">
      <div class="duty-cell duty-person-col">${escHtml(p.full_name)}</div>
      ${days.map(d => {
        const isoStr  = fmtISO(curYear, curMonth, d);
        const date    = new Date(curYear, curMonth - 1, d);
        const dow     = date.getDay();
        const we      = dow === 0 || dow === 6 || holidays.some(h => h.date === fmtISO(curYear, curMonth, d));
        const evt     = pEvts.find(e => e.start_date <= isoStr && e.end_date >= isoStr);
        const cfg     = evt ? EVENT_CFG[evt.event_type] : null;
        const isPend  = pending && Number(pending.personId) === Number(p.id) && isoStr >= pending.startIso;
        let style = '', inner = '';
        if (cfg) {
          if (cfg.bg) style = `background:${cfg.bg}`;
          else        inner = `<span class="duty-sym">${cfg.symbol}</span>`;
        }
        return `<div class="duty-cell duty-day-cell ${we ? 'weekend' : ''} ${isPend ? 'is-pending' : ''}"
          style="${style}" data-pid="${p.id}" data-iso="${isoStr}" data-eid="${evt ? evt.id : ''}">${inner}</div>`;
      }).join('')}
    </div>`;
  }).join('');

  const hw = document.querySelector('.duty-header-wrap');
  const bw = document.querySelector('.duty-body-wrap');
  bw.onscroll = () => { hw.scrollLeft = bw.scrollLeft; };

  document.querySelectorAll('.duty-day-cell').forEach(cell =>
    cell.addEventListener('click', onCellClick)
  );
}

function onCellClick(e) {
  e.stopPropagation();
  removeContextMenu();

  const cell     = e.currentTarget;
  const personId = Number(cell.dataset.pid);
  const isoStr   = cell.dataset.iso;
  const evtId    = cell.dataset.eid ? Number(cell.dataset.eid) : 0;

  if (pending) {
    if (pending.personId === personId && isoStr >= pending.startIso) {
      const { type, startIso } = pending;
      cancelPending();
      saveEvent(personId, type, startIso, isoStr);
    } else {
      cancelPending();
    }
    return;
  }

  if (evtId) { openDelModal(evtId); return; }

  showContextMenu(e, personId, isoStr);
}

function showContextMenu(e, personId, isoStr) {
  const menu = document.createElement('div');
  menu.className = 'duty-context-menu';
  menu.innerHTML = Object.entries(EVENT_CFG)
    .map(([key, cfg]) => `<div class="duty-menu-item" data-type="${key}">${escHtml(cfg.label)}</div>`)
    .join('');
  document.body.appendChild(menu);

  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const x  = e.clientX + mw + 8 > window.innerWidth  ? e.clientX - mw : e.clientX + 2;
  const y  = e.clientY + mh + 8 > window.innerHeight ? e.clientY - mh : e.clientY + 2;
  menu.style.left = `${Math.max(4, x)}px`;
  menu.style.top  = `${Math.max(4, y)}px`;

  menu.querySelectorAll('.duty-menu-item').forEach(item => {
    item.addEventListener('click', ev => {
      ev.stopPropagation();
      const type = item.dataset.type;
      const cfg  = EVENT_CFG[type];
      removeContextMenu();
      if (!cfg.multi) {
        saveEvent(personId, type, isoStr, isoStr);
      } else {
        pending = { personId, type, startIso: isoStr };
        render();
        showPendingHint(personId, isoStr);
      }
    });
  });

  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 0);
}

function showPendingHint(personId, isoStr) {
  removePendingHint();
  const cell = document.querySelector(`.duty-day-cell[data-pid="${personId}"][data-iso="${isoStr}"]`);
  if (!cell) return;
  hintEl = document.createElement('div');
  hintEl.className = 'duty-pending-hint';
  hintEl.textContent = 'Выберите день окончания события';
  document.body.appendChild(hintEl);
  const r = cell.getBoundingClientRect();
  hintEl.style.left = `${r.left}px`;
  hintEl.style.top  = `${r.bottom + 6}px`;
}

function removePendingHint() {
  if (hintEl) { hintEl.remove(); hintEl = null; }
}

function cancelPending() {
  pending = null;
  removePendingHint();
  render();
}

function removeContextMenu() {
  document.querySelectorAll('.duty-context-menu').forEach(m => m.remove());
}

async function saveEvent(personId, type, startIso, endIso) {
  const res  = await fetch('api.php?action=duty_event_save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person_id: personId, event_type: type, start_date: startIso, end_date: endIso }),
  });
  const data = await res.json();
  if (data.error) alert(data.error);
  await loadEvents();
  render();
}

function openDelModal(evtId) {
  delId = evtId;
  const evt = events.find(e => Number(e.id) === evtId);
  if (evt) {
    const cfg   = EVENT_CFG[evt.event_type];
    const range = evt.start_date === evt.end_date ? evt.start_date : `${evt.start_date} — ${evt.end_date}`;
    document.getElementById('deleteEventDesc').textContent = `${cfg?.label || evt.event_type}: ${range}`;
  }
  document.getElementById('deleteEventModal').classList.remove('hidden');
}

function closeDelModal() {
  delId = null;
  document.getElementById('deleteEventModal').classList.add('hidden');
}

async function doDelete() {
  if (!delId) return;
  const res  = await fetch('api.php?action=duty_event_delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: delId }),
  });
  const data = await res.json();
  closeDelModal();
  if (data.error) { alert(data.error); return; }
  await loadEvents();
  render();
}

init();
