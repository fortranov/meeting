<?php
declare(strict_types=1);

define('DB_FILE', getenv('DB_PATH') ?: __DIR__ . '/meeting.sqlite');

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if (!tableExists($pdo, 'meeting')) {
        initializeDatabase($pdo);
    } else {
        migrateDatabase($pdo);
    }

    return $pdo;
}

function tableExists(PDO $pdo, string $table): bool
{
    $r = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name=" . $pdo->quote($table))->fetch();
    return $r !== false;
}

function migrateDatabase(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS direction (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS task_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
    )");

    $cols = array_column($pdo->query("PRAGMA table_info(person)")->fetchAll(), 'name');
    if (!in_array('first_name',   $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
    if (!in_array('last_name',    $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
    if (!in_array('direction_id', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN direction_id INTEGER");
    if (!in_array('sort_order',   $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");

    // Recreate task table if CHECK constraint present (remove it)
    $taskSql = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='task'")->fetch()['sql'] ?? '';
    if (strpos($taskSql, 'CHECK') !== false) {
        $pdo->exec('PRAGMA foreign_keys = OFF');
        $pdo->beginTransaction();
        $pdo->exec("ALTER TABLE task RENAME TO _task_old");
        $pdo->exec("CREATE TABLE task (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id INTEGER NOT NULL,
            parent_task_id INTEGER NULL,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'В работе',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meeting_id) REFERENCES meeting(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_task_id) REFERENCES task(id) ON DELETE CASCADE
        )");
        $pdo->exec("INSERT INTO task SELECT id, meeting_id, parent_task_id, title, start_date, end_date, status, created_at, updated_at FROM _task_old");
        $pdo->exec("DROP TABLE _task_old");
        $pdo->commit();
        $pdo->exec('PRAGMA foreign_keys = ON');
    }

    $stCols = array_column($pdo->query("PRAGMA table_info(task_status)")->fetchAll(), 'name');
    if (!in_array('color', $stCols)) $pdo->exec("ALTER TABLE task_status ADD COLUMN color TEXT");

    if ((int)$pdo->query('SELECT COUNT(*) AS c FROM task_status')->fetch()['c'] === 0) {
        $pdo->exec("INSERT INTO task_status (name, sort_order) VALUES ('В работе', 1), ('Риск', 2), ('Сделано', 3)");
    }
}

function initializeDatabase(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) throw new RuntimeException('Не найден schema.sql');
    $pdo->exec($schema);

    $pdo->exec("INSERT INTO task_status (name, sort_order) VALUES ('В работе', 1), ('Риск', 2), ('Сделано', 3)");

    $stmt = $pdo->prepare('INSERT INTO person (first_name, last_name, full_name, email, sort_order) VALUES (:fn, :ln, :full, :email, :sort)');
    foreach ([
        ['Анна',      'Иванова',  'anna@company.ru',   1],
        ['Игорь',     'Петров',   'igor@company.ru',   2],
        ['Мария',     'Соколова', 'maria@company.ru',  3],
        ['Дмитрий',   'Кузнецов', 'dmitry@company.ru', 4],
        ['Екатерина', 'Орлова',   'kate@company.ru',   5],
    ] as [$fn, $ln, $email, $sort]) {
        $stmt->execute([':fn' => $fn, ':ln' => $ln, ':full' => "$fn $ln", ':email' => $email, ':sort' => $sort]);
    }

    $pdo->exec("INSERT INTO meeting (title, meeting_date, topic) VALUES
        ('Операционный комитет', date('now','+2 day'), 'Контроль квартальных показателей'),
        ('Продуктовый совет', date('now','+8 day'), 'Роадмап и приоритеты')");

    $ids = $pdo->query('SELECT id FROM meeting ORDER BY id')->fetchAll();
    [$m1, $m2] = [(int)$ids[0]['id'], (int)$ids[1]['id']];

    $pdo->exec("INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status) VALUES
        ($m1, NULL, 'Подготовить KPI отчёт', date('now'), date('now','+3 day'), 'В работе'),
        ($m1, NULL, 'Собрать риски подразделений', date('now','+1 day'), date('now','+2 day'), 'Риск'),
        ($m2, NULL, 'Согласовать roadmap', date('now','+5 day'), date('now','+8 day'), 'В работе')");

    $taskId = (int)$pdo->query("SELECT id FROM task WHERE title='Подготовить KPI отчёт' LIMIT 1")->fetch()['id'];
    $pdo->exec("INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status)
        VALUES ($m1, $taskId, 'Проверка метрик с аналитиком', date('now','+1 day'), date('now','+2 day'), 'Сделано')");
}
