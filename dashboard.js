const LAYOUT_KEY = 'dashboardLayout';

// Block registry: id → async render function
const BLOCKS = {
  today:    renderTodayBlock,
  tasks:    renderTasksBlock,
};

const DEFAULT_LAYOUT = [['today', 'tasks'], [], []];

let layout = loadLayout();
let reorderMode = false;
let dragId      = null;
let dragOverCol = null;

async function init() {
  await buildGrid();
  bindToggle();
}

// ─── Layout persistence ──────────────────────────────────

function loadLayout() {
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (Array.isArray(s) && s.length === 3 && s.every(Array.isArray)) return s;
  } catch {}
  return DEFAULT_LAYOUT.map(col => [...col]);
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

function ensureAllBlocks() {
  const placed = new Set(layout.flat());
  for (const id of Object.keys(BLOCKS)) {
    if (!placed.has(id)) layout[0].push(id);
  }
}

// ─── Grid rendering ──────────────────────────────────────

async function buildGrid() {
  ensureAllBlocks();
  const grid = document.getElementById('dashGrid');
  grid.innerHTML = '';
  grid.classList.toggle('dash-reorder-mode', reorderMode);

  for (let ci = 0; ci < 3; ci++) {
    const col = document.createElement('div');
    col.className = 'dash-col';
    col.dataset.col = ci;

    for (const bid of layout[ci]) {
      if (!BLOCKS[bid]) continue;
      col.appendChild(await makeBlock(bid));
    }

    // Empty-column drop zone
    const zone = document.createElement('div');
    zone.className = 'dash-col-zone';
    col.appendChild(zone);

    grid.appendChild(col);
  }

  setupDragDrop();
}

async function makeBlock(id) {
  const el = document.createElement('div');
  el.className = 'dash-block';
  el.dataset.blockId = id;
  if (reorderMode) el.draggable = true;
  el.innerHTML = `
    <div class="dash-block-header">
      <span class="dash-block-handle">⠿</span>
      <h3 class="dash-block-title">...</h3>
    </div>
    <div class="dash-block-body"><div class="dash-loading">Загрузка…</div></div>`;
  await BLOCKS[id](el);
  return el;
}

// ─── Block: Сегодня ──────────────────────────────────────

async function renderTodayBlock(el) {
  const DAYS   = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const now = new Date();
  el.querySelector('.dash-block-title').textContent =
    `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  try {
    const data = await (await fetch('api.php?action=dashboard_today')).json();
    const vacation     = data.vacation      || { count: 0, names: [] };
    const businessTrip = data.business_trip || { count: 0, names: [] };
    const sickLeave    = data.sick_leave    || { count: 0, names: [] };
    const study        = data.study         || { count: 0, names: [] };
    const present      = (Number(data.total) || 0)
                       - vacation.count - businessTrip.count - sickLeave.count - study.count;

    const detailRow = (label, count, names) => `
      <div class="dash-stat-row dash-stat-row--detail">
        <span class="dash-stat-label">${label}</span>
        <span class="dash-stat-val">${count}</span>
        <span class="dash-stat-names">${names.join(', ')}</span>
      </div>`;

    el.querySelector('.dash-block-body').innerHTML = `
      <div class="dash-stat-row dash-stat-row--detail">
        <span class="dash-stat-label">В наличии</span>
        <span class="dash-stat-val">${present}</span>
        <span></span>
      </div>
      ${detailRow('Отпуск',      vacation.count,     vacation.names)}
      ${detailRow('Командировка',businessTrip.count, businessTrip.names)}
      ${detailRow('Больничный',  sickLeave.count,    sickLeave.names)}
      ${detailRow('Учёба',       study.count,        study.names)}`;
  } catch {
    el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
  }
}

// ─── Block: Задачи по подготовке ─────────────────────────

async function renderTasksBlock(el) {
  el.querySelector('.dash-block-title').textContent = 'Задачи по подготовке';

  try {
    const data  = await (await fetch('api.php?action=dashboard_tasks')).json();
    const tasks = data.tasks || [];

    if (!tasks.length) {
      el.querySelector('.dash-block-body').innerHTML =
        '<p class="dash-loading">Нет активных задач на сегодня</p>';
      return;
    }

    const fmtDate = s => {
      const [, m, d] = s.split('-');
      return `${d}.${m}`;
    };

    el.querySelector('.dash-block-body').innerHTML = tasks.map(t => `
      <div class="dash-task-row">
        <div class="dash-task-title">${t.title}</div>
        <div class="dash-task-meta">
          <span class="dash-task-dates">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</span>
          <span class="dash-task-persons">${t.responsible || ''}</span>
        </div>
      </div>`).join('');
  } catch {
    el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
  }
}

// ─── Toggle ──────────────────────────────────────────────

function bindToggle() {
  document.getElementById('reorderToggle').addEventListener('change', async function () {
    reorderMode = this.checked;
    if (!reorderMode) saveLayout();
    await buildGrid();
  });
}

// ─── Drag & Drop ─────────────────────────────────────────

function setupDragDrop() {
  if (!reorderMode) return;

  document.querySelectorAll('.dash-block').forEach(block => {
    block.addEventListener('dragstart', e => {
      dragId = block.dataset.blockId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
      requestAnimationFrame(() => block.classList.add('dragging'));
    });

    block.addEventListener('dragend', () => {
      dragId = null;
      clearDragHighlights();
    });

    block.addEventListener('dragover', e => {
      if (!dragId || block.dataset.blockId === dragId) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragHighlights();
      const rect  = block.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;
      block.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
    });

    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) {
        block.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    block.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragId || block.dataset.blockId === dragId) return;

      const rect  = block.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;

      removeFromLayout(dragId);
      let [toCol, toIdx] = findInLayout(block.dataset.blockId);
      if (toCol === -1) return;
      if (!isTop) toIdx++;
      layout[toCol].splice(toIdx, 0, dragId);

      clearDragHighlights();
      saveLayout();
      buildGrid();
    });
  });

  // Column drop zones (empty area at bottom of each column)
  document.querySelectorAll('.dash-col-zone').forEach(zone => {
    zone.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragHighlights();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      if (!dragId) return;

      const colIdx = parseInt(zone.closest('.dash-col').dataset.col);
      removeFromLayout(dragId);
      layout[colIdx].push(dragId);

      saveLayout();
      buildGrid();
    });
  });
}

function findInLayout(blockId) {
  for (let ci = 0; ci < layout.length; ci++) {
    const idx = layout[ci].indexOf(blockId);
    if (idx !== -1) return [ci, idx];
  }
  return [-1, -1];
}

function removeFromLayout(blockId) {
  for (const col of layout) {
    const i = col.indexOf(blockId);
    if (i !== -1) { col.splice(i, 1); return; }
  }
}

function clearDragHighlights() {
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over');
  });
}

init();
