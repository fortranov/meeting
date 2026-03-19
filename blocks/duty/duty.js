window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

window.BLOCK_REGISTRY.duty = async function renderDutyBlock(el) {
  const DAYS = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

  el.querySelector('.dash-block-title').textContent = 'Дежурства';

  try {
    const data = await (await fetch('api.php?action=dashboard_duty')).json();
    const days = data.days || [];

    const label = (i, dateStr) => {
      if (i === 0) return 'Вчера';
      if (i === 1) return 'Сегодня';
      return DAYS[new Date(dateStr + 'T00:00:00').getDay()];
    };

    const fmtDate = (dateStr) => {
      const [, m, day] = dateStr.split('-');
      return `${parseInt(day)}.${m}`;
    };

    el.querySelector('.dash-block-body').innerHTML = days.map((d, i) => `
      <div class="dash-duty-row${i === 1 ? ' dash-duty-row--today' : ''}">
        <span class="dash-duty-date">${fmtDate(d.date)}</span>
        <span class="dash-duty-label">${label(i, d.date)}</span>
        <span class="dash-duty-person">${d.name || '—'}</span>
      </div>`).join('');
  } catch {
    el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
  }
};
