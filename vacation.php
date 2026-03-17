<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
db();
$access = checkPageAccess('vacation');
if (!$access['can_view']) accessDeniedPage();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>График отпусков — Ежедневник</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="top-nav">
  <a href="dashboard.php" class="brand">Ежедневник</a>
  <nav>
    <a href="plan.php">План заседаний</a>
    <a href="control.php">Контроль</a>
    <a href="duty.php">График дежурств</a>
    <a href="vacation.php" class="active">График отпусков</a>
  </nav>
  <a href="settings.php" class="nav-settings">Настройки</a>
</header>
<main class="page">
  <section class="plan-board">
    <div class="board-controls">
      <h1>График отпусков</h1>
      <div class="board-nav">
        <button id="prevYear">← Назад</button>
        <div class="calendar-info"><h2 id="yearLabel"></h2></div>
        <button id="nextYear">Вперёд →</button>
      </div>
    </div>
    <div class="vac-table-outer">
      <div class="vac-header-wrap">
        <div id="vacHeader" class="vac-table"></div>
      </div>
      <div class="vac-body-wrap">
        <div id="vacBody" class="vac-table"></div>
      </div>
    </div>
  </section>
</main>

<div id="vacDeleteModal" class="modal hidden">
  <div class="modal-box" style="max-width:340px">
    <h3>Удалить отпуск?</h3>
    <p id="vacDeleteDesc" style="margin:0;color:var(--muted);font-size:0.9rem"></p>
    <div class="modal-actions">
      <button id="vacDeleteNo">Нет</button>
      <button id="vacDeleteYes" style="background:var(--danger);color:#fff;border-color:var(--danger)">Да</button>
    </div>
  </div>
</div>

<div id="vacDatePicker" class="date-picker hidden"></div>

<script>const PAGE_CAN_EDIT = <?= $access['can_edit'] ? 'true' : 'false' ?>;</script>
<script src="vacation.js"></script>
</body>
</html>
