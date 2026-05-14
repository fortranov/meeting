window.BLOCK_REGISTRY = window.BLOCK_REGISTRY || {};

window.BLOCK_REGISTRY.gsr = async function renderGsrBlock(el) {
  el.querySelector('.dash-block-title').textContent = 'ГСР';

  try {
    const data = await (await fetch('api.php?action=gsr_data')).json();
    const body = el.querySelector('.dash-block-body');

    if (data.status === 'before_6am') {
      body.innerHTML = '<p class="gsr-no-data">Данные будут доступны после 6:00</p>';
      return;
    }

    if (data.error && !data.responsible && !(data.rows || []).some(Boolean)) {
      body.innerHTML = `<p class="gsr-no-data">${data.error}</p>`;
      return;
    }

    const rows = data.rows || [];
    let html = '';

    if (data.responsible) {
      html += `<div class="gsr-responsible">${data.responsible}</div>`;
    }
    rows.forEach(r => {
      if (r) html += `<div class="gsr-row">${r}</div>`;
    });

    body.innerHTML = html || '<p class="gsr-no-data">Нет данных</p>';
  } catch {
    el.querySelector('.dash-block-body').innerHTML = '<p class="dash-error">Ошибка загрузки</p>';
  }
};
