<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
require_once __DIR__ . '/nav.php';
db();
$access = checkPageAccess('duty');
if (!$access['can_view']) accessDeniedPage();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>График дежурств — Ежедневник</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="top-nav">
  <a href="dashboard.php" class="brand" aria-label="Органайзер">
    <span class="brand-logo" aria-hidden="true">
      <span class="brand-logo-top">ОРГАНАЙЗЕР</span>
      <span class="brand-logo-bottom-wrapper">
        <span class="brand-logo-bottom">система планирования времени</span>
      </span>
    </span>
  </a>
  <?= renderPlanPageNav('duty') ?>
  <a href="settings.php" class="nav-settings">Настройки</a>
</header>
<main class="page">
  <section class="plan-board">
    <div class="board-controls">
      <h1>График дежурств</h1>
      <div class="board-nav">
        <button id="prevMonth">← Назад</button>
        <div class="calendar-info"><h2 id="monthLabel"></h2></div>
        <button id="nextMonth">Вперёд →</button>
        <button id="statsBtn">Статистика</button>
        <button id="createDocxBtn">Создать docx</button>
      </div>
    </div>
    <div class="duty-table-outer">
      <div class="duty-header-wrap">
        <div id="dutyHeader" class="duty-table"></div>
      </div>
      <div class="duty-body-wrap">
        <div id="dutyBody" class="duty-table"></div>
      </div>
    </div>
  </section>
</main>

<div id="statsModal" class="modal hidden">
  <div class="modal-box stats-modal-box">
    <div class="stats-modal-header">
      <h3>Статистика дежурств</h3>
      <select id="statsYearSelect" class="stats-year-select"></select>
    </div>
    <div class="stats-table-wrap" id="statsTableWrap"></div>
    <div class="modal-actions">
      <div style="flex:1"></div>
      <button id="closeStatsBtn">Закрыть</button>
    </div>
  </div>
</div>

<div id="deleteEventModal" class="modal hidden">
  <div class="modal-box" style="max-width:340px">
    <h3>Удалить событие?</h3>
    <p id="deleteEventDesc" style="margin:0;color:var(--muted);font-size:0.9rem"></p>
    <div class="modal-actions">
      <button id="deleteEventNo">Нет</button>
      <button id="deleteEventYes" style="background:var(--danger);color:#fff;border-color:var(--danger)">Да</button>
    </div>
  </div>
</div>

<script>const PAGE_CAN_EDIT = <?= $access['can_edit'] ? 'true' : 'false' ?>;</script>
<script src="duty.js"></script>
  <script src="brand-logo.js"></script>
</body>
</html>
