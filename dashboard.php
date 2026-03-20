<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/nav.php';
db();

// Discover and sort blocks (exclude planTasks directory — handled separately below)
$blockMetas = [];
foreach (glob(__DIR__ . '/blocks/*/block.php') as $f) {
    $dir  = basename(dirname($f));
    if ($dir === 'planTasks') continue; // handled separately
    $meta = require $f;
    if (is_array($meta) && isset($meta['id'])) {
        $meta['_dir'] = $dir;
        $blockMetas[] = $meta;
    }
}

// Add plan task blocks from plan_pages
$planPagesForBlocks = [];
try {
    $planPagesForBlocks = db()->query('SELECT id, dash_title, sort_order FROM plan_page ORDER BY sort_order, id')->fetchAll();
    foreach ($planPagesForBlocks as $p) {
        $blockMetas[] = [
            'id'          => 'planTasks_' . (int)$p['id'],
            'name'        => $p['dash_title'],
            'sort_order'  => (int)$p['sort_order'],
            '_dir'        => 'planTasks',
            '_plan_page_id' => (int)$p['id'],
        ];
    }
} catch (\Throwable) {}

usort($blockMetas, fn($a, $b) => ($a['sort_order'] ?? 0) <=> ($b['sort_order'] ?? 0));
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Дашборд — Ежедневник</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="styles.css" />
<?php
// Emit CSS for regular (non-planTasks) blocks
$planTasksCssIncluded = false;
foreach ($blockMetas as $m):
    if ($m['_dir'] === 'planTasks'):
        if (!$planTasksCssIncluded):
            $planTasksCssIncluded = true;
?>
  <link rel="stylesheet" href="blocks/planTasks/planTasks.css" />
<?php
        endif;
        continue;
    endif;
?>
  <link rel="stylesheet" href="blocks/<?= htmlspecialchars($m['_dir']) ?>/<?= htmlspecialchars($m['_dir']) ?>.css" />
<?php endforeach; ?>
</head>
<body>
<header class="top-nav">
  <a href="dashboard.php" class="brand active-brand" aria-label="Органайзер">
    <span class="brand-logo" aria-hidden="true">
      <span class="brand-logo-top">ОРГАНАЙЗЕР</span>
      <span class="brand-logo-bottom-wrapper">
        <span class="brand-logo-bottom">система планирования времени</span>
      </span>
    </span>
  </a>
  <?= renderPlanPageNav('dashboard') ?>
  <div class="nav-right">
    <label class="dash-reorder-label" id="reorderLabel">
      <input type="checkbox" id="reorderToggle" />
      <span>Переместить блоки</span>
    </label>
    <a href="settings.php">Настройки</a>
  </div>
</header>
<main class="page">
  <div id="dashGrid" class="dash-grid"></div>
</main>
<?php
// Emit JS for regular (non-planTasks) blocks
$planTasksJsIncluded = false;
foreach ($blockMetas as $m):
    if ($m['_dir'] === 'planTasks'):
        if (!$planTasksJsIncluded):
            $planTasksJsIncluded = true;
?>
<script src="blocks/planTasks/planTasks.js"></script>
<?php
            // Register factory for each plan page
            foreach ($planPagesForBlocks as $p):
?>
<script>if(window.PLAN_TASKS_BLOCK_FACTORY) PLAN_TASKS_BLOCK_FACTORY(<?= (int)$p['id'] ?>, <?= json_encode($p['dash_title']) ?>);</script>
<?php
            endforeach;
        endif;
        continue;
    endif;
?>
<script src="blocks/<?= htmlspecialchars($m['_dir']) ?>/<?= htmlspecialchars($m['_dir']) ?>.js"></script>
<?php endforeach; ?>
<script src="dashboard.js"></script>
<script src="brand-logo.js"></script>
</body>
</html>
