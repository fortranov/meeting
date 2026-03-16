<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
db();
$access = checkPageAccess('settings');
if (!$access['can_view']) accessDeniedPage();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Настройки — Новый Аналитический Комплекс</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="top-nav">
  <div class="brand">Новый Аналитический Комплекс</div>
  <nav>
    <a href="index.php">План заседаний</a>
    <a href="duty.php">График дежурств</a>
    <a href="vacation.php">График отпусков</a>
  </nav>
  <a href="settings.php" class="active nav-settings">Настройки</a>
</header>
<main class="page">
  <div class="settings-grid">

    <section class="settings-card">
      <div class="settings-card-header">
        <h2>Направления деятельности</h2>
        <button class="btn-add" id="showAddDirection">+ Добавить</button>
      </div>
      <div class="add-row hidden" id="addDirectionRow">
        <input type="text" id="newDirectionName" placeholder="Название направления" />
        <button id="saveDirectionBtn">Сохранить</button>
        <button class="btn-cancel" id="cancelDirectionBtn">Отмена</button>
      </div>
      <div id="directionsList" class="settings-list"></div>
    </section>

    <section class="settings-card">
      <div class="settings-card-header">
        <h2>Статусы задач</h2>
        <button class="btn-add" id="showAddStatus">+ Добавить</button>
      </div>
      <div class="add-row hidden" id="addStatusRow">
        <input type="text" id="newStatusName" placeholder="Название статуса" />
        <button id="saveStatusBtn">Сохранить</button>
        <button class="btn-cancel" id="cancelStatusBtn">Отмена</button>
      </div>
      <div id="statusesList" class="settings-list"></div>
    </section>

    <section class="settings-card settings-card-wide">
      <div class="settings-card-header">
        <h2>Личный состав</h2>
        <button class="btn-add" id="showAddPerson">+ Добавить</button>
      </div>
      <div id="personsList" class="settings-list persons-list"></div>
      <div class="ip-access-row">
        <label class="checkbox-label">
          <input type="checkbox" id="ipAccessEnabled" />
          Доступ по ip
        </label>
      </div>
    </section>

    <section class="settings-card settings-card-wide">
      <div class="settings-card-header">
        <h2>Праздники</h2>
        <button class="btn-add" id="showAddHoliday">+ Добавить праздник</button>
      </div>
      <div id="holidaysList"></div>
    </section>

    <section class="settings-card settings-card-wide">
      <div class="settings-card-header">
        <h2>Шаблон заседания</h2>
        <button class="btn-add" id="showAddTemplateTask">+ Добавить задачу</button>
      </div>
      <p class="settings-hint">Задачи из шаблона автоматически добавляются при создании нового заседания с опцией «На основе шаблона».</p>
      <div id="templateTasksList" class="settings-list"></div>
    </section>

    <section class="settings-card settings-card-wide">
      <div class="settings-card-header">
        <h2>Цвета и размеры</h2>
      </div>
      <div id="colorSizeSettings" class="cs-grid"></div>
    </section>

  </div>
</main>

<!-- Person modal -->
<div id="personModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="personModalTitle">Добавить сотрудника</h3>
    <input type="hidden" id="personId" />
    <div class="row2">
      <label>Фамилия<input id="personFirstName" /></label>
      <label>Инициалы<input id="personLastName" /></label>
    </div>
    <label>Направление
      <select id="personDirection">
        <option value="">— не выбрано —</option>
      </select>
    </label>
    <label>День рождения (необязательно)<input id="personBirthDate" type="date" /></label>
    <label>IP-адрес (необязательно)<input id="personIp" placeholder="например, 192.168.1.100" /></label>
    <div class="page-perms-section">
      <span class="page-perms-title">Права доступа к страницам</span>
      <table class="page-perms-table">
        <thead>
          <tr><th>Страница</th><th>Просмотр</th><th>Редактирование</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>План заседаний</td>
            <td><input type="checkbox" id="permMainView" /></td>
            <td><input type="checkbox" id="permMainEdit" /></td>
          </tr>
          <tr>
            <td>График дежурств</td>
            <td><input type="checkbox" id="permDutyView" /></td>
            <td><input type="checkbox" id="permDutyEdit" /></td>
          </tr>
          <tr>
            <td>Настройки</td>
            <td><input type="checkbox" id="permSettView" /></td>
            <td><input type="checkbox" id="permSettEdit" /></td>
          </tr>
          <tr>
            <td>График отпусков</td>
            <td><input type="checkbox" id="permVacView" /></td>
            <td><input type="checkbox" id="permVacEdit" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button data-close="personModal">Отмена</button>
      <button id="savePersonBtn">Сохранить</button>
    </div>
  </div>
</div>

<!-- Holiday modal -->
<div id="holidayModal" class="modal hidden">
  <div class="modal-box" style="max-width:360px">
    <h3>Добавить праздник</h3>
    <label>Дата<input id="holidayDate" type="date" /></label>
    <div class="modal-actions">
      <button data-close="holidayModal">Отмена</button>
      <button id="saveHolidayBtn">Добавить</button>
    </div>
  </div>
</div>

<!-- Template task modal -->
<div id="templateTaskModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="templateTaskModalTitle">Добавить задачу в шаблон</h3>
    <input type="hidden" id="templateTaskId" />
    <label>Название задачи<input id="tmplTitle" /></label>
    <div class="row2">
      <label>Дней до заседания<input id="tmplDaysBefore" type="number" min="0" value="0" /></label>
      <label>Длительность (дней)<input id="tmplDuration" type="number" min="1" value="1" /></label>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" id="tmplIsSubtask" />
      Подзадача (дочерняя для предыдущей задачи в списке)
    </label>
    <div class="modal-actions">
      <button id="deleteTemplateTaskBtn" class="btn-danger hidden">Удалить</button>
      <div style="flex:1"></div>
      <button data-close="templateTaskModal">Отмена</button>
      <button id="saveTemplateTaskBtn">Сохранить</button>
    </div>
  </div>
</div>

<script src="settings.js"></script>
</body>
</html>
