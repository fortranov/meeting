<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
db();

// Discover and sort blocks
$blockMetas = [];
foreach (glob(__DIR__ . '/blocks/*/block.php') as $f) {
    $meta = require $f;
    if (is_array($meta) && isset($meta['id'])) {
        $meta['_dir'] = basename(dirname($f));
        $blockMetas[] = $meta;
    }
}
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
<?php foreach ($blockMetas as $m): ?>
  <link rel="stylesheet" href="blocks/<?= htmlspecialchars($m['_dir']) ?>/<?= htmlspecialchars($m['_dir']) ?>.css" />
<?php endforeach; ?>
</head>
<body>
<header class="top-nav">
  <a href="dashboard.php" class="brand active-brand"><span class="brand-mark" aria-hidden="true">📘</span><span class="brand-text">Ежедневник</span></a>
  <nav>
    <a href="plan.php">План заседаний</a>
    <a href="control.php">Контроль</a>
    <a href="duty.php">График дежурств</a>
    <a href="vacation.php">График отпусков</a>
  </nav>
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
<?php foreach ($blockMetas as $m): ?>
<script src="blocks/<?= htmlspecialchars($m['_dir']) ?>/<?= htmlspecialchars($m['_dir']) ?>.js"></script>
<?php endforeach; ?>
<script src="dashboard.js"></script>
</body>
</html>
