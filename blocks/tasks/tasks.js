window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

window.BLOCK_REGISTRY.tasks = async function renderTasksBlock(el) {
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
};
