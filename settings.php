<?php declare(strict_types=1); require_once __DIR__ . '/db.php'; db(); ?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Настройки — MeetingFlow</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="top-nav">
  <div class="brand">MeetingFlow</div>
  <nav>
    <a href="index.php">Главная</a>
    <a href="settings.php" class="active">Настройки</a>
  </nav>
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
    </section>

  </div>
</main>

<!-- Person modal -->
<div id="personModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="personModalTitle">Добавить сотрудника</h3>
    <input type="hidden" id="personId" />
    <div class="row2">
      <label>Имя<input id="personFirstName" /></label>
      <label>Фамилия<input id="personLastName" /></label>
    </div>
    <label>Направление
      <select id="personDirection">
        <option value="">— не выбрано —</option>
      </select>
    </label>
    <label>Email (необязательно)<input id="personEmail" type="email" /></label>
    <div class="modal-actions">
      <button data-close="personModal">Отмена</button>
      <button id="savePersonBtn">Сохранить</button>
    </div>
  </div>
</div>

<script src="settings.js"></script>
</body>
</html>
