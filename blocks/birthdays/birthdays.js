window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

window.BLOCK_REGISTRY.birthdays = async function renderBirthdaysBlock(el) {
  el.querySelector('.dash-block-title').textContent = 'Дни рождения в отделе';

  try {
    const data     = await (await fetch('api.php?action=dashboard_birthdays')).json();
    const today    = data.today    || [];
    const past     = data.past     || [];
    const upcoming = data.upcoming || [];

    const todayHtml = today.length
      ? `<div class="bday-today">${today.map(p => `<span class="bday-today-name">${p.name}</span>`).join('')}</div>`
      : '';

    const pastRows = past.map(p => `
      <div class="bday-row">
        <span class="bday-name">${p.name}</span>
        <span class="bday-date">${p.date}</span>
      </div>`).join('');

    const upcomingRows = upcoming.map(p => `
      <div class="bday-row">
        <span class="bday-name">${p.name}</span>
        <span class="bday-date">${p.date}</span>
      </div>`).join('');

    const hasLists = past.length || upcoming.length;

    el.querySelector('.dash-block-body').innerHTML = `
      ${todayHtml}
      ${hasLists ? `
        <div class="bday-lists${todayHtml ? ' bday-lists--sep' : ''}">
          <div class="bday-col">
            <div class="bday-col-title">Прошедшие</div>
            ${pastRows || '<span class="bday-empty">—</span>'}
          </div>
          <div class="bday-col">
            <div class="bday-col-title">Предстоящие</div>
            ${upcomingRows || '<span class="bday-empty">—</span>'}
          </div>
        </div>` : ''}
      ${!todayHtml && !hasLists ? '<p class="dash-loading">Нет дней рождений в ближайшие 30 дней</p>' : ''}`;
  } catch {
    el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
  }
};
