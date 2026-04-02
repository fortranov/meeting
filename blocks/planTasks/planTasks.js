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

      // Group tasks by session_id maintaining order of first appearance
      const sessionOrder = [];
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

      // Within each session: order parents before their subtasks
      const orderSession = sessionTasks => {
        const taskById = Object.fromEntries(sessionTasks.map(t => [t.id, t]));
        const parents = sessionTasks.filter(t => !t.parent_task_id);
        const childrenOf = {};
        sessionTasks.forEach(t => {
          if (t.parent_task_id) {
            (childrenOf[t.parent_task_id] = childrenOf[t.parent_task_id] || []).push(t);
          }
        });
        const ordered = [];
        parents.forEach(p => {
          ordered.push(p);
          (childrenOf[p.id] || []).forEach(c => ordered.push(c));
        });
        // Orphan subtasks (parent filtered out) at the end
        sessionTasks.filter(t => t.parent_task_id && !taskById[t.parent_task_id]).forEach(t => ordered.push(t));
        return ordered;
      };

      const html = [];
      sessionOrder.forEach(sid => {
        const title = sessionTitles[sid];
        if (title) {
          html.push(`<div class="dash-session-header">${title}</div>`);
        }
        const ordered = orderSession(tasksBySession[sid]);
        ordered.forEach(t => {
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
  };
};
