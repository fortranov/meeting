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
    if (!in_array('first_name',         $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
    if (!in_array('last_name',          $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
    if (!in_array('direction_id',       $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN direction_id INTEGER");
    if (!in_array('sort_order',         $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    if (!in_array('ip',                 $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
    if (!in_array('page_main_view',     $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_main_view INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_main_edit',     $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_main_edit INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_duty_view',     $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_duty_view INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_duty_edit',     $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_duty_edit INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_settings_view', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_settings_view INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_settings_edit', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_settings_edit INTEGER NOT NULL DEFAULT 0");
    if (!in_array('birth_date',         $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN birth_date TEXT");
    if (!in_array('page_vacation_view', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_vacation_view INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_vacation_edit', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_vacation_edit INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_control_view', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_control_view INTEGER NOT NULL DEFAULT 0");
    if (!in_array('page_control_edit', $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN page_control_edit INTEGER NOT NULL DEFAULT 0");
    if (!in_array('is_management',     $cols)) $pdo->exec("ALTER TABLE person ADD COLUMN is_management INTEGER NOT NULL DEFAULT 0");

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

    $pdo->exec("CREATE TABLE IF NOT EXISTS task_person (
        task_id   INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, person_id),
        FOREIGN KEY (task_id)   REFERENCES task(id)   ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS meeting_template_task (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        days_before   INTEGER NOT NULL DEFAULT 0,
        duration_days INTEGER NOT NULL DEFAULT 1,
        is_subtask    INTEGER NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0
    )");

    $stCols = array_column($pdo->query("PRAGMA table_info(task_status)")->fetchAll(), 'name');
    if (!in_array('color',     $stCols)) $pdo->exec("ALTER TABLE task_status ADD COLUMN color TEXT");
    if (!in_array('is_system', $stCols)) $pdo->exec("ALTER TABLE task_status ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0");

    $dirCols = array_column($pdo->query("PRAGMA table_info(direction)")->fetchAll(), 'name');
    if (!in_array('color', $dirCols)) $pdo->exec("ALTER TABLE direction ADD COLUMN color TEXT");

    $taskCols = array_column($pdo->query("PRAGMA table_info(task)")->fetchAll(), 'name');
    if (!in_array('sort_order', $taskCols)) $pdo->exec("ALTER TABLE task ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");

    $pdo->exec("CREATE TABLE IF NOT EXISTS holiday (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS duty_event (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id  INTEGER NOT NULL,
        event_type TEXT    NOT NULL,
        start_date TEXT    NOT NULL,
        end_date   TEXT    NOT NULL,
        FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS control (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        control_date TEXT    NOT NULL,
        created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS control_task (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        control_id     INTEGER NOT NULL,
        parent_task_id INTEGER NULL,
        title          TEXT    NOT NULL,
        start_date     TEXT    NOT NULL,
        end_date       TEXT    NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'В работе',
        sort_order     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (control_id)     REFERENCES control(id)      ON DELETE CASCADE,
        FOREIGN KEY (parent_task_id) REFERENCES control_task(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS control_task_person (
        task_id   INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, person_id),
        FOREIGN KEY (task_id)   REFERENCES control_task(id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES person(id)       ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS control_template_task (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        days_before   INTEGER NOT NULL DEFAULT 0,
        duration_days INTEGER NOT NULL DEFAULT 1,
        is_subtask    INTEGER NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0
    )");

    if ((int)$pdo->query('SELECT COUNT(*) AS c FROM task_status')->fetch()['c'] === 0) {
        $pdo->exec("INSERT INTO task_status (name, sort_order, color) VALUES ('В работе', 1, '#3b82f6'), ('Риск', 2, '#f97316'), ('Выполнено', 3, '#22c55e')");
        $pdo->exec("UPDATE task_status SET is_system=1 WHERE name='Выполнено'");
    } else {
        // Ensure the system status exists
        $has = (int)$pdo->query("SELECT COUNT(*) AS c FROM task_status WHERE is_system=1")->fetch()['c'];
        if (!$has) {
            $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM task_status')->fetch()['m']);
            $pdo->exec("INSERT INTO task_status (name, sort_order, color, is_system) VALUES ('Выполнено', " . ($max + 1) . ", '#22c55e', 1)");
        }
    }

    // ─── Plan page system ─────────────────────────────────────────────────────

    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_page (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        menu_title    TEXT    NOT NULL DEFAULT '',
        dash_title    TEXT    NOT NULL DEFAULT '',
        session_label TEXT    NOT NULL DEFAULT 'Заседание',
        has_topic     INTEGER NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_session (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_page_id INTEGER NOT NULL,
        title       TEXT    NOT NULL,
        session_date TEXT   NOT NULL,
        topic       TEXT    NOT NULL DEFAULT '',
        created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_page_id) REFERENCES plan_page(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_task (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_page_id   INTEGER NOT NULL,
        session_id     INTEGER NOT NULL,
        parent_task_id INTEGER NULL,
        title          TEXT    NOT NULL,
        start_date     TEXT    NOT NULL,
        end_date       TEXT    NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'В работе',
        sort_order     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_page_id)   REFERENCES plan_page(id)    ON DELETE CASCADE,
        FOREIGN KEY (session_id)     REFERENCES plan_session(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_task_id) REFERENCES plan_task(id)    ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_task_person (
        task_id   INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, person_id),
        FOREIGN KEY (task_id)   REFERENCES plan_task(id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES person(id)    ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_template_task (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_page_id  INTEGER NOT NULL,
        title         TEXT    NOT NULL,
        days_before   INTEGER NOT NULL DEFAULT 0,
        duration_days INTEGER NOT NULL DEFAULT 1,
        is_subtask    INTEGER NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (plan_page_id) REFERENCES plan_page(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS person_plan_access (
        person_id    INTEGER NOT NULL,
        plan_page_id INTEGER NOT NULL,
        can_view     INTEGER NOT NULL DEFAULT 0,
        can_edit     INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (person_id, plan_page_id),
        FOREIGN KEY (person_id)    REFERENCES person(id)    ON DELETE CASCADE,
        FOREIGN KEY (plan_page_id) REFERENCES plan_page(id) ON DELETE CASCADE
    )");

    // One-time seed: migrate legacy data into plan tables
    try {
        $planPageCount = (int)$pdo->query('SELECT COUNT(*) AS c FROM plan_page')->fetch()['c'];
        if ($planPageCount === 0) {
            // ── Insert default plan pages ────────────────────────────────────
            $pdo->exec(
                "INSERT INTO plan_page (id, title, menu_title, dash_title, session_label, has_topic, sort_order)
                 VALUES
                 (1, 'План заседаний и задач',  'План заседаний', 'Задачи по подготовке', 'Заседание',          1, 1),
                 (2, 'Контроль за месяц',       'Контроль',       'Задачи контроля',      'Контроль за месяц',  0, 2)"
            );
            // Update AUTOINCREMENT sequence for plan_page past id=2
            $pdo->exec("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('plan_page', 2)");

            $defaultStatus = $pdo->query(
                "SELECT name FROM task_status WHERE is_system=0 ORDER BY sort_order, id LIMIT 1"
            )->fetch()['name'] ?? 'В работе';

            // ── Migrate meeting → plan_session (plan_page_id=1, explicit IDs) ─
            $meetings = $pdo->query('SELECT id, title, meeting_date, topic FROM meeting ORDER BY id')->fetchAll();
            $stmtPS = $pdo->prepare(
                'INSERT INTO plan_session (id, plan_page_id, title, session_date, topic) VALUES (:id, 1, :title, :date, :topic)'
            );
            foreach ($meetings as $m) {
                $stmtPS->execute([':id' => (int)$m['id'], ':title' => $m['title'], ':date' => $m['meeting_date'], ':topic' => $m['topic'] ?? '']);
            }
            // Update sequence for plan_session
            $maxSessionId = (int)($pdo->query('SELECT COALESCE(MAX(id),0) AS m FROM meeting')->fetch()['m']);
            if ($maxSessionId > 0) {
                $pdo->exec("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('plan_session', $maxSessionId)");
            }

            // ── Migrate task → plan_task (explicit IDs) ──────────────────────
            $tasks = $pdo->query('SELECT id, meeting_id, parent_task_id, title, start_date, end_date, status, sort_order FROM task ORDER BY id')->fetchAll();
            $stmtPT = $pdo->prepare(
                'INSERT INTO plan_task (id, plan_page_id, session_id, parent_task_id, title, start_date, end_date, status, sort_order)
                 VALUES (:id, 1, :sid, :pid, :title, :start, :end, :status, :sort)'
            );
            foreach ($tasks as $t) {
                $stmtPT->execute([
                    ':id'     => (int)$t['id'],
                    ':sid'    => (int)$t['meeting_id'],
                    ':pid'    => $t['parent_task_id'] !== null ? (int)$t['parent_task_id'] : null,
                    ':title'  => $t['title'],
                    ':start'  => $t['start_date'],
                    ':end'    => $t['end_date'],
                    ':status' => $t['status'],
                    ':sort'   => (int)$t['sort_order'],
                ]);
            }
            // Migrate task_person → plan_task_person
            $taskPersons = $pdo->query('SELECT task_id, person_id FROM task_person')->fetchAll();
            $stmtTP = $pdo->prepare('INSERT OR IGNORE INTO plan_task_person (task_id, person_id) VALUES (:tid, :pid)');
            foreach ($taskPersons as $tp) {
                $stmtTP->execute([':tid' => (int)$tp['task_id'], ':pid' => (int)$tp['person_id']]);
            }

            // Migrate meeting_template_task → plan_template_task (plan_page_id=1)
            $mTmpl = $pdo->query('SELECT title, days_before, duration_days, is_subtask, sort_order FROM meeting_template_task ORDER BY sort_order, id')->fetchAll();
            $stmtMTT = $pdo->prepare(
                'INSERT INTO plan_template_task (plan_page_id, title, days_before, duration_days, is_subtask, sort_order)
                 VALUES (1, :title, :db, :dd, :sub, :sort)'
            );
            foreach ($mTmpl as $tt) {
                $stmtMTT->execute([':title' => $tt['title'], ':db' => (int)$tt['days_before'], ':dd' => (int)$tt['duration_days'], ':sub' => (int)$tt['is_subtask'], ':sort' => (int)$tt['sort_order']]);
            }

            // Update sequence for plan_task
            $maxTaskId = (int)($pdo->query('SELECT COALESCE(MAX(id),0) AS m FROM task')->fetch()['m']);
            if ($maxTaskId > 0) {
                $pdo->exec("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('plan_task', $maxTaskId)");
            }

            // ── Migrate control → plan_session (plan_page_id=2, auto IDs) ───
            $controls = $pdo->query('SELECT id AS old_id, title, control_date FROM control ORDER BY id')->fetchAll();
            $stmtCS = $pdo->prepare(
                'INSERT INTO plan_session (plan_page_id, title, session_date, topic) VALUES (2, :title, :date, \'\')'
            );
            $controlIdToSessionId = [];
            foreach ($controls as $c) {
                $stmtCS->execute([':title' => $c['title'], ':date' => $c['control_date']]);
                $controlIdToSessionId[(int)$c['old_id']] = (int)$pdo->lastInsertId();
            }

            // ── Migrate control_task → plan_task ────────────────────────────
            $ctasks = $pdo->query('SELECT id AS old_id, control_id, parent_task_id AS old_parent_id, title, start_date, end_date, status, sort_order FROM control_task ORDER BY id')->fetchAll();
            $stmtCT = $pdo->prepare(
                'INSERT INTO plan_task (plan_page_id, session_id, parent_task_id, title, start_date, end_date, status, sort_order)
                 VALUES (2, :sid, NULL, :title, :start, :end, :status, :sort)'
            );
            $controlTaskIdToNewId = [];
            foreach ($ctasks as $ct) {
                $newSid = $controlIdToSessionId[(int)$ct['control_id']] ?? null;
                if ($newSid === null) continue;
                $stmtCT->execute([
                    ':sid'    => $newSid,
                    ':title'  => $ct['title'],
                    ':start'  => $ct['start_date'],
                    ':end'    => $ct['end_date'],
                    ':status' => $ct['status'],
                    ':sort'   => (int)$ct['sort_order'],
                ]);
                $controlTaskIdToNewId[(int)$ct['old_id']] = (int)$pdo->lastInsertId();
            }

            // Fix parent_task_id for control plan_tasks
            $stmtFixParent = $pdo->prepare('UPDATE plan_task SET parent_task_id=:newpid WHERE id=:id');
            foreach ($ctasks as $ct) {
                if ($ct['old_parent_id'] === null) continue;
                $newId     = $controlTaskIdToNewId[(int)$ct['old_id']] ?? null;
                $newParent = $controlTaskIdToNewId[(int)$ct['old_parent_id']] ?? null;
                if ($newId && $newParent) {
                    $stmtFixParent->execute([':newpid' => $newParent, ':id' => $newId]);
                }
            }

            // Migrate control_task_person → plan_task_person
            $ctpRows = $pdo->query('SELECT task_id AS old_task_id, person_id FROM control_task_person')->fetchAll();
            $stmtCTP = $pdo->prepare('INSERT OR IGNORE INTO plan_task_person (task_id, person_id) VALUES (:tid, :pid)');
            foreach ($ctpRows as $ctp) {
                $newTid = $controlTaskIdToNewId[(int)$ctp['old_task_id']] ?? null;
                if ($newTid) {
                    $stmtCTP->execute([':tid' => $newTid, ':pid' => (int)$ctp['person_id']]);
                }
            }

            // Migrate control_template_task → plan_template_task (plan_page_id=2)
            $cTmpl = $pdo->query('SELECT title, days_before, duration_days, is_subtask, sort_order FROM control_template_task ORDER BY sort_order, id')->fetchAll();
            $stmtCTT = $pdo->prepare(
                'INSERT INTO plan_template_task (plan_page_id, title, days_before, duration_days, is_subtask, sort_order)
                 VALUES (2, :title, :db, :dd, :sub, :sort)'
            );
            foreach ($cTmpl as $tt) {
                $stmtCTT->execute([':title' => $tt['title'], ':db' => (int)$tt['days_before'], ':dd' => (int)$tt['duration_days'], ':sub' => (int)$tt['is_subtask'], ':sort' => (int)$tt['sort_order']]);
            }

            // Populate person_plan_access from legacy page_main_view/edit and page_control_view/edit
            $persons = $pdo->query('SELECT id, page_main_view, page_main_edit, page_control_view, page_control_edit FROM person')->fetchAll();
            $stmtAcc = $pdo->prepare(
                'INSERT OR REPLACE INTO person_plan_access (person_id, plan_page_id, can_view, can_edit) VALUES (:pid, :ppid, :cv, :ce)'
            );
            foreach ($persons as $p) {
                $stmtAcc->execute([':pid' => (int)$p['id'], ':ppid' => 1, ':cv' => (int)$p['page_main_view'], ':ce' => (int)$p['page_main_edit']]);
                $stmtAcc->execute([':pid' => (int)$p['id'], ':ppid' => 2, ':cv' => (int)$p['page_control_view'], ':ce' => (int)$p['page_control_edit']]);
            }
        }
    } catch (\Throwable $e) {
        // Migration failed — log or silently ignore to not break existing installs
        error_log('plan_page migration error: ' . $e->getMessage());
    }
}

function initializeDatabase(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) throw new RuntimeException('Не найден schema.sql');
    $pdo->exec($schema);

    $pdo->exec("INSERT INTO task_status (name, sort_order, color, is_system) VALUES ('В работе', 1, '#3b82f6', 0), ('Риск', 2, '#f97316', 0), ('Выполнено', 3, '#22c55e', 1)");

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
