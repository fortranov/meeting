window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

// planTasks_X blocks are registered dynamically via this factory function.
// dashboard.php calls PLAN_TASKS_BLOCK_FACTORY(pageId, dashTitle) for each plan_page.
window.PLAN_TASKS_BLOCK_FACTORY = function(pageId, dashTitle) {
  const blockId = 'planTasks_' + pageId;
  window.BLOCK_REGISTRY[blockId] = async function renderPlanTasksBlock(el) {
    el.querySelector('.dash-block-title').textContent = dashTitle;

    try {
      const data  = await (await fetch('api.php?action=dashboard_plan_tasks&page_id=' + pageId)).json();
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

      const rowBg = color => {
        if (!color) return '';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return ` style="background:rgba(${r},${g},${b},0.10)"`;
      };

      el.querySelector('.dash-block-body').innerHTML = tasks.map(t => `
        <div class="dash-task-row"${rowBg(t.color)}>
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
};
