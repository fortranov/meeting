const meetings = [
  {
    name: 'Еженедельный операционный комитет',
    meetingDate: offsetDate(2),
    status: 'В работе',
    tasks: [
      {
        title: 'Подготовить KPI-дашборд',
        start: offsetDate(0),
        end: offsetDate(4),
        status: 'В работе',
        subtasks: [
          { title: 'Собрать данные продаж', start: offsetDate(0), end: offsetDate(1), status: 'Сделано' },
          { title: 'Проверить метрики с аналитиком', start: offsetDate(2), end: offsetDate(4), status: 'В работе' },
        ],
      },
      {
        title: 'Собрать вопросы подразделений',
        start: offsetDate(1),
        end: offsetDate(2),
        status: 'Сделано',
        subtasks: [
          { title: 'Запросить статусы от HR и Sales', start: offsetDate(1), end: offsetDate(1), status: 'Сделано' },
        ],
      },
    ],
  },
  {
    name: 'Бюджетное заседание Q3',
    meetingDate: offsetDate(9),
    status: 'Риск',
    tasks: [
      {
        title: 'Обновить прогноз затрат',
        start: offsetDate(6),
        end: offsetDate(10),
        status: 'Риск',
        subtasks: [
          { title: 'Сверить CAPEX/OPEX', start: offsetDate(6), end: offsetDate(8), status: 'В работе' },
          { title: 'Подготовить комментарии к отклонениям', start: offsetDate(9), end: offsetDate(10), status: 'Риск' },
        ],
      },
      {
        title: 'Подготовить презентацию CFO',
        start: offsetDate(7),
        end: offsetDate(9),
        status: 'В работе',
        subtasks: [
          { title: 'Собрать графики и диаграммы', start: offsetDate(7), end: offsetDate(8), status: 'В работе' },
          { title: 'Финальная вычитка', start: offsetDate(9), end: offsetDate(9), status: 'В работе' },
        ],
      },
    ],
  },
  {
    name: 'Совет по продукту',
    meetingDate: offsetDate(18),
    status: 'В работе',
    tasks: [
      {
        title: 'Согласовать roadmap',
        start: offsetDate(14),
        end: offsetDate(18),
        status: 'В работе',
        subtasks: [
          { title: 'Подготовить список релизов', start: offsetDate(14), end: offsetDate(15), status: 'Сделано' },
          { title: 'Согласовать приоритеты с командой', start: offsetDate(16), end: offsetDate(18), status: 'В работе' },
        ],
      },
    ],
  },
];

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const longFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const VISIBLE_DAYS = 35;

const timelineTable = document.getElementById('timelineTable');
const calendarLabel = document.getElementById('calendarLabel');

const today = startOfDay(new Date());
let visibleStart = startOfWeek(new Date(today.getFullYear(), today.getMonth(), 1));

renderTimeline();

document.getElementById('prevWeek').addEventListener('click', () => {
  visibleStart = addDays(visibleStart, -7);
  renderTimeline();
});

document.getElementById('nextWeek').addEventListener('click', () => {
  visibleStart = addDays(visibleStart, 7);
  renderTimeline();
});

function renderTimeline() {
  const days = Array.from({ length: VISIBLE_DAYS }, (_, index) => addDays(visibleStart, index));
  const endDate = days[days.length - 1];

  const firstLabel = monthFormatter.format(days[0]);
  const secondLabel = monthFormatter.format(endDate);
  calendarLabel.textContent = firstLabel === secondLabel ? firstLabel : `${firstLabel} — ${secondLabel}`;

  const rows = flattenRows();
  timelineTable.style.gridTemplateRows = `repeat(${rows.length + 1}, auto)`;

  const header = `
    <div class="timeline-row header" style="grid-template-columns:${columnTemplate(days.length)}">
      <div class="timeline-cell left-col left-1">Заседание / задача / подзадача</div>
      <div class="timeline-cell left-col left-2" style="left:300px">Период</div>
      <div class="timeline-cell left-col left-3" style="left:450px">Статус</div>
      ${days.map((day) => renderDayHeader(day)).join('')}
    </div>
  `;

  const body = rows
    .map((row) => `
      <div class="timeline-row ${row.type}" style="grid-template-columns:${columnTemplate(days.length)}">
        <div class="timeline-cell left-col left-1 item-cell ${row.type}">
          ${row.type === 'meeting' ? `<strong>${row.label}</strong>` : `<span>${row.label}</span>`}
        </div>
        <div class="timeline-cell left-col left-2" style="left:300px">${formatPeriod(row)}</div>
        <div class="timeline-cell left-col left-3" style="left:450px">${statusPill(row.status)}</div>
        ${days.map((day) => renderRowDayCell(day, row)).join('')}
      </div>
    `)
    .join('');

  timelineTable.innerHTML = header + body;
}

function flattenRows() {
  const rows = [];

  meetings.forEach((meeting) => {
    rows.push({
      type: 'meeting',
      label: meeting.name,
      start: meeting.meetingDate,
      end: meeting.meetingDate,
      status: meeting.status,
    });

    meeting.tasks.forEach((task) => {
      rows.push({
        type: 'task',
        label: task.title,
        start: task.start,
        end: task.end,
        status: task.status,
      });

      task.subtasks.forEach((subtask) => {
        rows.push({
          type: 'subtask',
          label: subtask.title,
          start: subtask.start,
          end: subtask.end,
          status: subtask.status,
        });
      });
    });
  });

  return rows;
}

function renderDayHeader(day) {
  const isToday = day.getTime() === today.getTime();
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  return `
    <div class="timeline-cell day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
      <span class="weekday">${weekdays[normalizeDay(day.getDay())]}</span>
      <span class="date">${day.getDate()}</span>
    </div>
  `;
}

function renderRowDayCell(day, row) {
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const dayKey = toISODate(day);
  const startKey = toISODate(row.start);
  const endKey = toISODate(row.end);
  const inRange = isInRange(day, row.start, row.end);

  if (!inRange) {
    return `<div class="timeline-cell day-cell ${isWeekend ? 'weekend' : ''}"></div>`;
  }

  const rangeType =
    startKey === endKey
      ? 'range-single'
      : dayKey === startKey
        ? 'range-start'
        : dayKey === endKey
          ? 'range-end'
          : 'range-middle';
  const riskClass = row.status === 'Риск' ? 'risk' : '';

  return `
    <div class="timeline-cell day-cell ${isWeekend ? 'weekend' : ''} in-range ${rangeType}">
      <div class="day-fill ${riskClass}"></div>
    </div>
  `;
}

function formatPeriod(row) {
  if (toISODate(row.start) === toISODate(row.end)) {
    return formatDate(row.start);
  }
  return `${formatDate(row.start)} — ${formatDate(row.end)}`;
}

function isInRange(date, start, end) {
  const d = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return d >= s && d <= e;
}

function statusPill(status) {
  const className =
    status === 'Сделано'
      ? 'status-done'
      : status === 'Риск'
        ? 'status-risk'
        : status === 'В работе'
          ? 'status-in-progress'
          : 'status-neutral';
  return `<span class="status-pill ${className}">${status}</span>`;
}

function columnTemplate(dayCount) {
  return `300px 150px 125px repeat(${dayCount}, var(--day-col))`;
}

function normalizeDay(day) {
  return day === 0 ? 6 : day - 1;
}

function startOfWeek(date) {
  const normalized = normalizeDay(date.getDay());
  return addDays(startOfDay(date), -normalized);
}

function offsetDate(days) {
  return addDays(startOfDay(new Date()), days);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function formatDate(date) {
  return longFormatter.format(date);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
