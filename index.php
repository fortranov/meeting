<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
db();
$access = checkPageAccess('main');
if (!$access['can_view']) accessDeniedPage();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Новый Аналитический Комплекс</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="top-nav">
  <div class="brand">Новый Аналитический Комплекс</div>
  <nav><a href="index.php">Главная</a><a href="duty.php">График дежурств</a></nav>
  <a href="settings.php" class="nav-settings">Настройки</a>
</header>
<main class="page">
  <section class="plan-board">
    <div class="board-controls">
      <h1>План заседаний и задач</h1>
      <div class="board-nav">
        <button id="prevWeek">← Назад</button>
        <button id="nextWeek">Вперёд →</button>
        <button id="addMeetingBtn">+ Заседание</button>
      </div>
    </div>
    <div class="table-outer">
      <div class="table-header-wrap">
        <div id="timelineHeader" class="timeline-table"></div>
      </div>
      <div class="table-body-wrap">
        <div id="timelineTable" class="timeline-table"></div>
      </div>
    </div>
  </section>
</main>

<div id="meetingModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="meetingModalTitle">Создать заседание</h3>
    <input type="hidden" id="meetingId" />
    <label>Название заседания<input id="meetingName" /></label>
    <label>Дата заседания<input id="meetingDate" type="date" /></label>
    <label>Тема заседания<textarea id="meetingTopic"></textarea></label>
    <label class="checkbox-label" id="useTemplateRow">
      <input type="checkbox" id="useTemplate" />
      На основе шаблона
    </label>
    <div class="modal-actions">
      <button id="deleteMeetingBtn" class="btn-danger hidden">Удалить заседание</button>
      <div style="flex:1"></div>
      <button data-close="meetingModal">Отмена</button>
      <button id="saveMeeting">Сохранить</button>
    </div>
  </div>
</div>

<div id="taskModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="taskModalTitle">Создать задачу</h3>
    <input type="hidden" id="taskId" />
    <input type="hidden" id="taskMeetingId" />
    <input type="hidden" id="taskParentId" />
    <label>Название задачи<input id="taskTitle" /></label>
    <div class="row2">
      <label>Срок от<input id="taskStart" type="date" /></label>
      <label>Срок до<input id="taskEnd" type="date" /></label>
    </div>
    <label>Статус
      <select id="taskStatus"></select>
    </label>
    <label>Ответственные</label>
    <div class="assignee-box">
      <input id="personSearch" placeholder="Поиск сотрудника..." autocomplete="new-password" />
      <div id="personDropdown" class="dropdown"></div>
      <div id="selectedPersons" class="selected-persons"></div>
    </div>
    <div class="modal-actions">
      <button id="deleteTaskBtn" class="btn-danger hidden">Удалить задачу</button>
      <div style="flex:1"></div>
      <button data-close="taskModal">Отмена</button>
      <button id="saveTask">Сохранить</button>
    </div>
  </div>
</div>

<div id="conflictModal" class="modal hidden">
  <div class="modal-box">
    <h3 class="conflict-modal-title">&#9888; Конфликт с расписанием</h3>
    <p class="conflict-modal-desc">У следующих сотрудников период задачи пересекается с событием:</p>
    <div id="conflictList" class="conflict-list"></div>
    <div class="modal-actions">
      <button id="conflictSuppressBtn" class="btn-suppress">Больше не показывать</button>
      <div style="flex:1"></div>
      <button data-close="conflictModal">Закрыть</button>
    </div>
  </div>
</div>

<div id="dateRangePicker" class="date-picker hidden"></div>

<script>const PAGE_CAN_EDIT = <?= $access['can_edit'] ? 'true' : 'false' ?>;</script>
<script src="app.js"></script>
</body>
</html>
