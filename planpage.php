<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
require_once __DIR__ . '/nav.php';

db();

$pageId = max(1, (int)($_GET['id'] ?? 1));

// Load the plan_page record
$page = null;
try {
    $stmt = db()->prepare('SELECT * FROM plan_page WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $pageId]);
    $page = $stmt->fetch();
} catch (\Throwable) {}

if (!$page) {
    http_response_code(404);
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>404</title>'
        . '<link rel="stylesheet" href="styles.css"></head><body>'
        . '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px">'
        . '<h2 style="margin:0">Страница не найдена</h2>'
        . '<a href="dashboard.php" style="color:#2b68ff">На главную</a>'
        . '</div></body></html>';
    exit;
}

$access = checkPlanPageAccess($pageId);
if (!$access['can_view']) accessDeniedPage();

$canEdit      = $access['can_edit'];
$sessionLabel = htmlspecialchars($page['session_label']);
$hasTopic     = (int)$page['has_topic'];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= htmlspecialchars($page['title']) ?> — Ежедневник</title>
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
  <?= renderPlanPageNav('planpage_' . $pageId) ?>
  <a href="settings.php" class="nav-settings">Настройки</a>
</header>
<main class="page">
  <section class="plan-board">
    <div class="board-controls">
      <h1><?= htmlspecialchars($page['title']) ?></h1>
      <div class="board-nav">
        <button id="prevWeek">← Назад</button>
        <button id="nextWeek">Вперёд →</button>
        <button id="addMeetingBtn">+ <?= $sessionLabel ?></button>
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

<!-- Session modal -->
<div id="meetingModal" class="modal hidden">
  <div class="modal-box">
    <h3 id="meetingModalTitle">Создать <?= $sessionLabel ?></h3>
    <input type="hidden" id="meetingId" />
    <label>Название<input id="meetingName" /></label>
    <label>Дата<input id="meetingDate" type="date" /></label>
<?php if ($hasTopic): ?>
    <label>Тема<textarea id="meetingTopic"></textarea></label>
<?php endif; ?>
    <label class="checkbox-label" id="useTemplateRow">
      <input type="checkbox" id="useTemplate" />
      На основе шаблона
    </label>
    <div class="modal-actions">
      <button id="deleteMeetingBtn" class="btn-danger hidden">Удалить</button>
      <div style="flex:1"></div>
      <button data-close="meetingModal">Отмена</button>
      <button id="saveMeeting">Сохранить</button>
    </div>
  </div>
</div>

<!-- Task modal -->
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
      <input id="personSearch" placeholder="Поиск сотрудника..." autocomplete="off" />
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

<!-- Conflict modal -->
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

<script>
const PAGE_ID            = <?= (int)$pageId ?>;
const PAGE_CAN_EDIT      = <?= $canEdit ? 'true' : 'false' ?>;
const PAGE_SESSION_LABEL = <?= json_encode($page['session_label']) ?>;
const PAGE_HAS_TOPIC     = <?= $hasTopic ? 'true' : 'false' ?>;
</script>
<script src="planpage.js"></script>
<script src="brand-logo.js"></script>
</body>
</html>
