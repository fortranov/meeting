(function () {
  'use strict';

  const API_BASE = 'http://10.202.168.72/api.php';

  const input     = document.getElementById('pbInput');
  const clearBtn  = document.getElementById('pbClear');
  const searchBtn = document.getElementById('pbBtn');
  const dropdown  = document.getElementById('pbDropdown');

  if (!input) return;

  let debounceTimer = null;

  // ── Show/hide clear button + auto-search after 3 chars ────────────────────
  input.addEventListener('input', () => {
    clearBtn.hidden = input.value.length === 0;
    clearTimeout(debounceTimer);
    if (input.value.trim().length === 0) { closeDropdown(); return; }
    if (input.value.trim().length < 3)   { return; }
    debounceTimer = setTimeout(doSearch, 350);
  });

  // ── Clear button ──────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    input.value    = '';
    clearBtn.hidden = true;
    clearTimeout(debounceTimer);
    closeDropdown();
    input.focus();
  });

  // ── Keyboard: Enter = search immediately, Escape = close ─────────────────
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); clearTimeout(debounceTimer); doSearch(); }
    if (e.key === 'Escape') { clearTimeout(debounceTimer); closeDropdown(); }
  });

  // ── Search button click ───────────────────────────────────────────────────
  searchBtn.addEventListener('click', doSearch);

  // ── Close dropdown on outside click ──────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#pbSearch')) closeDropdown();
  });

  // ─────────────────────────────────────────────────────────────────────────

  function closeDropdown() {
    dropdown.hidden    = true;
    dropdown.innerHTML = '';
  }

  async function doSearch() {
    const q = input.value.trim();
    if (!q) return;

    dropdown.hidden    = false;
    dropdown.innerHTML = '<div class="pb-status">Поиск…</div>';

    try {
      const url = new URL(API_BASE);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '50');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let resp;
      try {
        resp = await fetch(url.toString(), { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      if (!data.success) {
        dropdown.innerHTML = '<div class="pb-status pb-status--err">Ошибка: ' + esc(data.error || 'неизвестная ошибка') + '</div>';
        return;
      }

      renderResults(data.records, data.total);
    } catch {
      dropdown.innerHTML = '<div class="pb-status pb-status--err">Не удалось подключиться к справочнику</div>';
    }
  }

  function renderResults(records, total) {
    if (records.length === 0) {
      dropdown.innerHTML = '<div class="pb-status">Ничего не найдено</div>';
      return;
    }

    let html = '';

    if (total > 1) {
      const note = total > records.length
        ? `Показано ${records.length} из ${total}`
        : `Найдено: ${total}`;
      html += `<div class="pb-count">${note}</div>`;
    }

    for (const r of records) {
      const phones = [
        r['служебный'] ? `<span class="pb-pt">сл.</span>${esc(r['служебный'])}` : '',
        r['городской'] ? `<span class="pb-pt">гор.</span>${esc(r['городской'])}` : '',
        r['мобильный'] ? `<span class="pb-pt">моб.</span>${esc(r['мобильный'])}` : '',
      ].filter(Boolean).join('<span class="pb-sep"> · </span>');

      html += `<div class="pb-item">
        <div class="pb-item-top">
          <span class="pb-fio">${esc(r['фио'])}</span>
          ${r['должность'] ? `<span class="pb-role">${esc(r['должность'])}</span>` : ''}
        </div>
        <div class="pb-item-bot">
          ${r['организация'] ? `<span class="pb-org">${esc(r['организация'])}</span>` : ''}
          ${phones ? `<span class="pb-phones">${phones}</span>` : ''}
        </div>
      </div>`;
    }

    dropdown.innerHTML = html;
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
