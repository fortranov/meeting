window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

window.BLOCK_REGISTRY.today = async function renderTodayBlock(el) {
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
};
