<?php

declare(strict_types=1);

const DB_FILE = __DIR__ . '/meeting.sqlite';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $needsInit = !file_exists(DB_FILE);
    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($needsInit) {
        initializeDatabase($pdo);
    }

    return $pdo;
}

function initializeDatabase(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('Не найден schema.sql');
    }
    $pdo->exec($schema);

    $personCount = (int)$pdo->query('SELECT COUNT(*) AS c FROM person')->fetch()['c'];
    if ($personCount === 0) {
        $people = [
            ['Анна Иванова', 'anna@company.ru'],
            ['Игорь Петров', 'igor@company.ru'],
            ['Мария Соколова', 'maria@company.ru'],
            ['Дмитрий Кузнецов', 'dmitry@company.ru'],
            ['Екатерина Орлова', 'kate@company.ru'],
        ];
        $stmt = $pdo->prepare('INSERT INTO person (full_name, email) VALUES (:name, :email)');
        foreach ($people as [$name, $email]) {
            $stmt->execute([':name' => $name, ':email' => $email]);
        }
    }

    $meetingCount = (int)$pdo->query('SELECT COUNT(*) AS c FROM meeting')->fetch()['c'];
    if ($meetingCount === 0) {
        $pdo->exec("INSERT INTO meeting (title, meeting_date, topic) VALUES
          ('Операционный комитет', date('now','+2 day'), 'Контроль квартальных показателей'),
          ('Продуктовый совет', date('now','+8 day'), 'Роадмап и приоритеты')");

        $meetingIds = $pdo->query('SELECT id, title FROM meeting ORDER BY id')->fetchAll();
        $m1 = (int)$meetingIds[0]['id'];
        $m2 = (int)$meetingIds[1]['id'];

        $pdo->exec("INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status) VALUES
          ($m1, NULL, 'Подготовить KPI отчёт', date('now'), date('now','+3 day'), 'В работе'),
          ($m1, NULL, 'Собрать риски подразделений', date('now','+1 day'), date('now','+2 day'), 'Риск'),
          ($m2, NULL, 'Согласовать roadmap', date('now','+5 day'), date('now','+8 day'), 'В работе')");

        $taskId = (int)$pdo->query("SELECT id FROM task WHERE title='Подготовить KPI отчёт' LIMIT 1")->fetch()['id'];
        $pdo->exec("INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status)
          VALUES ($m1, $taskId, 'Проверка метрик с аналитиком', date('now','+1 day'), date('now','+2 day'), 'Сделано')");
    }

}
