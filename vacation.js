'use strict';

const VAC_MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const VAC_MONTHS_FULL  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

let curYear = new Date().getFullYear();
let persons  = [];
let events   = [];
let meetings = [];
let siteSettings = {};
let vacColor     = '#fef9c3';
let meetingLineColor = '#f0b429';

let _delId = null;
let _dp = {
  open: false, personId: null, eventId: null,
  phase: 'start', start: null, end: null, hoverDate: null,
  viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth() + 1,
};

const todayISO = (() => {
  const d = new Date();
  return fmtISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
})();

function fmtISO(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function escHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}
function fmtShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}`;
}

async function init() {
  document.getElementById('prevYear').onclick = () => navigate(-1);
  document.getElementById('nextYear').onclick = () => navigate(1);
  document.getElementById('vacDeleteNo').onclick  = closeDelModal;
  document.getElementById('vacDeleteYes').onclick = doDelete;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDatePicker(); closeDelModal(); }
  });
  document.addEventListener('click', e => {
    if (!_dp.open) return;
    const picker = document.getElementById('vacDatePicker');
    if (picker && !picker.contains(e.target) &&
        !e.target.closest('.vac-add-btn') && !e.target.closest('.vac-event-edit')) {
      closeDatePicker();
    }
  });
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); })
  );

  await Promise.all([loadPersons(), loadEvents(), loadMeetings(), loadSiteSettings()]);
  render();
}

async function navigate(dir) {
  curYear += dir;
  closeDatePicker();
  await Promise.all([loadEvents(), loadMeetings()]);
  render();
}

async function loadSiteSettings() {
  try {
    const data = await (await fetch('api.php?action=site_settings')).json();
    siteSettings = data.settings || {};
    if (siteSettings.vacation_color)    vacColor          = siteSettings.vacation_color;
    if (siteSettings.meeting_col_color) meetingLineColor  = siteSettings.meeting_col_color;
  } catch {}
}
async function loadPersons() {
  persons = ((await (await fetch('api.php?action=persons')).json()).persons) || [];
}
async function loadMeetings() {
  meetings = ((await (await fetch('api.php?action=meetings_list')).json()).meetings) || [];
}
async function loadEvents() {
  events = ((await (await fetch(`api.php?action=vacation_events&year=${curYear}`)).json()).events) || [];
}

function render() {
  document.getElementById('yearLabel').textContent = String(curYear);
  renderTable();
}

function renderTable() {
  const headerEl = document.getElementById('vacHeader');
  const bodyEl   = document.getElementById('vacBody');
  const canEdit  = typeof PAGE_CAN_EDIT !== 'undefined' && PAGE_CAN_EDIT;

  // Header row
  let hHtml = `<div class="vac-row vac-header-row">`;
  hHtml += `<div class="vac-cell vac-person-cell vac-hdr-cell">Сотрудник</div>`;
  for (let m = 1; m <= 12; m++) {
    hHtml += `<div class="vac-cell vac-month-hdr">${escHtml(VAC_MONTHS_SHORT[m - 1])}${meetingLines(m)}</div>`;
  }
  hHtml += `</div>`;
  headerEl.innerHTML = hHtml;

  // Precompute meeting days per month for the current year
  const meetingDaysByMonth = new Map(); // month(1-12) -> Set of day numbers
  for (const mtg of meetings) {
    if (!mtg.meeting_date) continue;
    const [y, m, d] = mtg.meeting_date.split('-').map(Number);
    if (y !== curYear) continue;
    if (!meetingDaysByMonth.has(m)) meetingDaysByMonth.set(m, new Set());
    meetingDaysByMonth.get(m).add(d);
  }
  function meetingLines(m) {
    const dim  = daysInMonth(curYear, m);
    const days = meetingDaysByMonth.get(m) || new Set();
    return [...days].map(d => {
      const lp = ((d - 0.5) / dim * 100).toFixed(3);
      return `<div class="vac-meeting-line" style="left:${lp}%;background:${escHtml(meetingLineColor)}"></div>`;
    }).join('');
  }

  // Pre-compute which month holds the most days for each event (label goes there only)
  const evtLabelMonth = new Map();
  for (const evt of events) {
    let maxDays = 0, labelM = null;
    for (let m = 1; m <= 12; m++) {
      const dim = daysInMonth(curYear, m);
      const ms  = fmtISO(curYear, m, 1);
      const me  = fmtISO(curYear, m, dim);
      if (evt.end_date < ms || evt.start_date > me) continue;
      const days = parseInt((evt.end_date < me ? evt.end_date : me).split('-')[2], 10)
                 - parseInt((evt.start_date > ms ? evt.start_date : ms).split('-')[2], 10) + 1;
      if (days > maxDays) { maxDays = days; labelM = m; }
    }
    evtLabelMonth.set(evt.id, labelM);
  }

  // Body rows
  let bHtml = '';
  for (const p of persons) {
    const pEvts = events.filter(e => Number(e.person_id) === Number(p.id));
    bHtml += `<div class="vac-row" data-pid="${p.id}">`;
    bHtml += `<div class="vac-cell vac-person-cell">`;
    bHtml += `<span class="vac-person-name">${escHtml(p.full_name)}</span>`;
    if (canEdit) {
      bHtml += `<button class="vac-add-btn" data-pid="${p.id}" title="Добавить отпуск">+</button>`;
    }
    bHtml += `</div>`;

    for (let m = 1; m <= 12; m++) {
      const dim        = daysInMonth(curYear, m);
      const monthStart = fmtISO(curYear, m, 1);
      const monthEnd   = fmtISO(curYear, m, dim);
      bHtml += `<div class="vac-cell vac-month-cell">${meetingLines(m)}`;
      for (const evt of pEvts) {
        if (evt.end_date < monthStart || evt.start_date > monthEnd) continue;
        const cs = evt.start_date > monthStart ? evt.start_date : monthStart;
        const ce = evt.end_date   < monthEnd   ? evt.end_date   : monthEnd;
        const sd = parseInt(cs.split('-')[2], 10);
        const ed = parseInt(ce.split('-')[2], 10);
        const lp = ((sd - 1) / dim * 100).toFixed(2);
        const wp = ((ed - sd + 1) / dim * 100).toFixed(2);
        const tt = evt.start_date === evt.end_date
          ? fmtDisplay(evt.start_date)
          : `${fmtDisplay(evt.start_date)} — ${fmtDisplay(evt.end_date)}`;
        const label = evt.start_date === evt.end_date
          ? fmtShort(evt.start_date)
          : `${fmtShort(evt.start_date)} — ${fmtShort(evt.end_date)}`;
        bHtml += `<div class="vac-event"
          style="left:${lp}%;width:${wp}%;background:${escHtml(vacColor)}"
          data-eid="${evt.id}" data-pid="${p.id}"
          data-start="${evt.start_date}" data-end="${evt.end_date}"
          title="${escHtml(tt)}">`;
        if (evtLabelMonth.get(evt.id) === m) {
          bHtml += `<span class="vac-event-label">${escHtml(label)}</span>`;
        }
        if (canEdit) {
          bHtml += `<div class="vac-event-actions">`;
          bHtml += `<button class="vac-event-edit" data-eid="${evt.id}" data-pid="${p.id}" data-start="${evt.start_date}" data-end="${evt.end_date}" title="Редактировать">✎</button>`;
          bHtml += `<button class="vac-event-del"  data-eid="${evt.id}" data-start="${evt.start_date}" data-end="${evt.end_date}" title="Удалить">✕</button>`;
          bHtml += `</div>`;
        }
        bHtml += `</div>`;
      }
      bHtml += `</div>`;
    }
    bHtml += `</div>`;
  }
  bodyEl.innerHTML = bHtml;

  // Sync horizontal scroll
  const hw = document.querySelector('.vac-header-wrap');
  const bw = document.querySelector('.vac-body-wrap');
  if (bw && hw) bw.onscroll = () => { hw.scrollLeft = bw.scrollLeft; };

  // Bind add buttons
  bodyEl.querySelectorAll('.vac-add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDatePicker(Number(btn.dataset.pid), null, null, null, btn);
    });
  });
  // Bind edit buttons
  bodyEl.querySelectorAll('.vac-event-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDatePicker(Number(btn.dataset.pid), Number(btn.dataset.eid), btn.dataset.start, btn.dataset.end, btn);
    });
  });
  // Bind delete buttons
  bodyEl.querySelectorAll('.vac-event-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDelModal(Number(btn.dataset.eid), btn.dataset.start, btn.dataset.end);
    });
  });
}

// ─── Date Picker ───

function openDatePicker(personId, eventId, startDate, endDate, anchorEl) {
  _dp.open      = true;
  _dp.personId  = personId;
  _dp.eventId   = eventId;
  _dp.start     = startDate;
  _dp.end       = endDate;
  _dp.hoverDate = null;
  _dp.phase     = startDate && endDate ? 'done' : 'start';
  if (startDate) {
    const [y, m] = startDate.split('-').map(Number);
    _dp.viewYear  = y;
    _dp.viewMonth = m;
  } else {
    _dp.viewYear  = curYear;
    _dp.viewMonth = 1;
  }
  renderDatePicker();
  positionDatePicker(anchorEl);
}

function closeDatePicker() {
  _dp.open = false;
  document.getElementById('vacDatePicker').classList.add('hidden');
}

function renderDatePicker() {
  const picker = document.getElementById('vacDatePicker');
  picker.classList.remove('hidden');

  const y        = _dp.viewYear;
  const m        = _dp.viewMonth;
  const dim      = daysInMonth(y, m);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const wdNames  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const prevDim  = daysInMonth(y, m === 1 ? 12 : m - 1);

  let html = `<div class="dp-header">
    <button class="dp-nav" id="dpPrev">&#8249;</button>
    <span class="dp-month-label">${VAC_MONTHS_FULL[m - 1]} ${y}</span>
    <button class="dp-nav" id="dpNext">&#8250;</button>
  </div>
  <div class="dp-grid">
    ${wdNames.map(w => `<div class="dp-day-hdr">${w}</div>`).join('')}`;

  for (let i = 0; i < firstDow; i++) {
    html += `<div class="dp-day dp-other-month">${prevDim - firstDow + 1 + i}</div>`;
  }

  const s = _dp.start;
  const e = _dp.end || _dp.hoverDate;
  for (let d = 1; d <= dim; d++) {
    const iso = fmtISO(y, m, d);
    let cls = 'dp-day';
    if (iso === todayISO) cls += ' dp-today';
    if (s && e) {
      const lo = s <= e ? s : e;
      const hi = s <= e ? e : s;
      if (iso === lo && iso === hi)     cls += ' dp-range-single';
      else if (iso === lo)              cls += ' dp-range-start';
      else if (iso === hi)              cls += ' dp-range-end';
      else if (iso > lo && iso < hi)   cls += ' dp-in-range';
    } else if (s && iso === s) {
      cls += ' dp-range-single';
    }
    html += `<div class="${cls}" data-iso="${iso}">${d}</div>`;
  }

  const used = firstDow + dim;
  const fill = used % 7 === 0 ? 0 : 7 - (used % 7);
  for (let i = 1; i <= fill; i++) html += `<div class="dp-day dp-other-month">${i}</div>`;
  html += `</div>`;

  let footerText;
  if (_dp.start && _dp.end) {
    footerText = `${fmtDisplay(_dp.start)} — ${fmtDisplay(_dp.end)}`;
  } else if (_dp.phase === 'end' && _dp.start) {
    footerText = `Начало: ${fmtDisplay(_dp.start)} — выберите конец`;
  } else {
    footerText = 'Выберите дату начала';
  }
  html += `<div class="dp-footer">${escHtml(footerText)}</div>`;
  if (_dp.start && _dp.end) {
    html += `<div class="dp-save-row"><button id="dpSaveBtn">Сохранить</button></div>`;
  }
  picker.innerHTML = html;

  document.getElementById('dpPrev').onclick = ev => {
    ev.stopPropagation();
    _dp.viewMonth--;
    if (_dp.viewMonth < 1) { _dp.viewMonth = 12; _dp.viewYear--; }
    renderDatePicker();
  };
  document.getElementById('dpNext').onclick = ev => {
    ev.stopPropagation();
    _dp.viewMonth++;
    if (_dp.viewMonth > 12) { _dp.viewMonth = 1; _dp.viewYear++; }
    renderDatePicker();
  };

  picker.querySelectorAll('.dp-day:not(.dp-other-month)').forEach(day => {
    day.addEventListener('mouseover', () => {
      if (_dp.phase === 'end') { _dp.hoverDate = day.dataset.iso; updateDayHighlights(); }
    });
    day.addEventListener('click', ev => {
      ev.stopPropagation();
      const iso = day.dataset.iso;
      if (_dp.phase === 'start' || _dp.phase === 'done') {
        _dp.start = iso; _dp.end = null; _dp.hoverDate = null; _dp.phase = 'end';
      } else {
        if (iso < _dp.start) { _dp.end = _dp.start; _dp.start = iso; }
        else { _dp.end = iso; }
        _dp.hoverDate = null; _dp.phase = 'done';
      }
      renderDatePicker();
    });
  });

  const saveBtn = document.getElementById('dpSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', ev => { ev.stopPropagation(); saveDateRange(); });
}

function updateDayHighlights() {
  const picker = document.getElementById('vacDatePicker');
  if (!picker) return;
  const s = _dp.start;
  const e = _dp.end || _dp.hoverDate;
  picker.querySelectorAll('.dp-day[data-iso]').forEach(day => {
    const iso = day.dataset.iso;
    day.classList.remove('dp-range-start', 'dp-range-end', 'dp-range-single', 'dp-in-range');
    if (s && e) {
      const lo = s <= e ? s : e;
      const hi = s <= e ? e : s;
      if (iso === lo && iso === hi)   day.classList.add('dp-range-single');
      else if (iso === lo)            day.classList.add('dp-range-start');
      else if (iso === hi)            day.classList.add('dp-range-end');
      else if (iso > lo && iso < hi)  day.classList.add('dp-in-range');
    } else if (s && iso === s) {
      day.classList.add('dp-range-single');
    }
  });
}

function positionDatePicker(anchorEl) {
  const picker = document.getElementById('vacDatePicker');
  picker.style.visibility = 'hidden';
  requestAnimationFrame(() => {
    const pw   = picker.offsetWidth;
    const ph   = picker.offsetHeight;
    const rect = anchorEl.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left;
    if (left + pw > window.innerWidth  - 8) left = window.innerWidth  - pw - 8;
    if (top  + ph > window.innerHeight - 8) top  = rect.top - ph - 6;
    picker.style.top  = `${Math.max(4, top)}px`;
    picker.style.left = `${Math.max(4, left)}px`;
    picker.style.visibility = '';
  });
}

async function saveDateRange() {
  if (!_dp.start || !_dp.end) return;
  const { personId, eventId, start, end } = _dp;
  closeDatePicker();
  const payload = { person_id: personId, event_type: 'vacation', start_date: start, end_date: end };
  if (eventId) payload.id = eventId;
  const res  = await fetch('api.php?action=duty_event_save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  await loadEvents();
  render();
}

// ─── Delete modal ───

function openDelModal(evtId, startDate, endDate) {
  _delId = evtId;
  const desc = startDate === endDate
    ? fmtDisplay(startDate)
    : `${fmtDisplay(startDate)} — ${fmtDisplay(endDate)}`;
  document.getElementById('vacDeleteDesc').textContent = `Отпуск: ${desc}`;
  document.getElementById('vacDeleteModal').classList.remove('hidden');
}

function closeDelModal() {
  _delId = null;
  document.getElementById('vacDeleteModal').classList.add('hidden');
}

async function doDelete() {
  if (!_delId) return;
  const res  = await fetch('api.php?action=duty_event_delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: _delId }),
  });
  const data = await res.json();
  closeDelModal();
  if (data.error) { alert(data.error); return; }
  await loadEvents();
  render();
}

init();
