<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $action = $_GET['action'] ?? '';
    switch ($action) {
        case 'timeline':
            timelineAction();
            break;
        case 'persons':
            personsAction();
            break;
        case 'meeting_save':
            requirePost();
            meetingSaveAction();
            break;
        case 'task_save':
            requirePost();
            taskSaveAction();
            break;
        case 'directions':
            directionsAction();
            break;
        case 'direction_save':
            requirePost();
            directionSaveAction();
            break;
        case 'direction_delete':
            requirePost();
            directionDeleteAction();
            break;
        case 'statuses':
            statusesAction();
            break;
        case 'status_save':
            requirePost();
            statusSaveAction();
            break;
        case 'status_delete':
            requirePost();
            statusDeleteAction();
            break;
        case 'status_reorder':
            requirePost();
            statusReorderAction();
            break;
        case 'person_save':
            requirePost();
            personSaveAction();
            break;
        case 'person_delete':
            requirePost();
            personDeleteAction();
            break;
        case 'person_reorder':
            requirePost();
            personReorderAction();
            break;
        case 'template_tasks':
            templateTasksAction();
            break;
        case 'template_task_save':
            requirePost();
            templateTaskSaveAction();
            break;
        case 'template_task_delete':
            requirePost();
            templateTaskDeleteAction();
            break;
        case 'template_task_reorder':
            requirePost();
            templateTaskReorderAction();
            break;
        case 'meeting_delete':
            requirePost();
            meetingDeleteAction();
            break;
        case 'task_delete':
            requirePost();
            taskDeleteAction();
            break;
        case 'holidays':
            holidaysAction();
            break;
        case 'holiday_save':
            requirePost();
            holidaySaveAction();
            break;
        case 'holiday_delete':
            requirePost();
            holidayDeleteAction();
            break;
        case 'duty_events':
            dutyEventsAction();
            break;
        case 'duty_event_save':
            requirePost();
            dutyEventSaveAction();
            break;
        case 'duty_event_delete':
            requirePost();
            dutyEventDeleteAction();
            break;
        default:
            jsonResponse(['error' => 'Unknown action'], 400);
    }
} catch (Throwable $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

function timelineAction(): void
{
    $pdo = db();
    $start = $_GET['start'] ?? date('Y-m-01');
    $days = max(1, min(60, (int)($_GET['days'] ?? 35)));

    $meetings = $pdo->query('SELECT id, title, meeting_date, topic FROM meeting ORDER BY meeting_date, id')->fetchAll();

    $taskRows = $pdo->query(
        'SELECT t.id, t.meeting_id, t.parent_task_id, t.title, t.start_date, t.end_date, t.status,
                GROUP_CONCAT(p.full_name, ", ") AS responsible,
                GROUP_CONCAT(CAST(tp.person_id AS TEXT), ",") AS person_ids,
                (SELECT d.color FROM task_person tp2
                 JOIN person p2 ON p2.id = tp2.person_id
                 LEFT JOIN direction d ON d.id = p2.direction_id
                 WHERE tp2.task_id = t.id
                 ORDER BY tp2.person_id LIMIT 1) AS direction_color
         FROM task t
         LEFT JOIN task_person tp ON tp.task_id = t.id
         LEFT JOIN person p ON p.id = tp.person_id
         GROUP BY t.id
         ORDER BY t.start_date, t.id'
    )->fetchAll();

    $tasksByMeeting = [];
    foreach ($taskRows as $task) {
        $task['responsible'] = $task['responsible'] ?? '';
        $task['person_ids']  = $task['person_ids']  ?? '';
        $tasksByMeeting[(int)$task['meeting_id']][] = $task;
    }

    $result = [];
    foreach ($meetings as $meeting) {
        $mid = (int)$meeting['id'];
        $tasks = $tasksByMeeting[$mid] ?? [];
        $indexed = [];
        foreach ($tasks as $task) {
            $task['children'] = [];
            $indexed[(int)$task['id']] = $task;
        }

        $roots = [];
        foreach ($indexed as $id => &$task) {
            $parentId = $task['parent_task_id'] !== null ? (int)$task['parent_task_id'] : null;
            if ($parentId && isset($indexed[$parentId])) {
                $indexed[$parentId]['children'][] = &$task;
            } else {
                $roots[] = &$task;
            }
        }

        $result[] = [
            'id' => $mid,
            'title' => $meeting['title'],
            'meeting_date' => $meeting['meeting_date'],
            'topic' => $meeting['topic'],
            'tasks' => $roots,
        ];
    }

    jsonResponse([
        'start' => $start,
        'days' => $days,
        'meetings' => $result,
    ]);
}

function personsAction(): void
{
    $pdo = db();
    $q = trim((string)($_GET['q'] ?? ''));

    if ($q === '') {
        $stmt = $pdo->query('SELECT id, first_name, last_name, full_name, email, direction_id, sort_order FROM person ORDER BY sort_order, id LIMIT 50');
    } else {
        $stmt = $pdo->prepare('SELECT id, first_name, last_name, full_name, email, direction_id, sort_order FROM person WHERE full_name LIKE :q OR email LIKE :q ORDER BY sort_order, id LIMIT 50');
        $stmt->execute([':q' => '%' . $q . '%']);
    }
    jsonResponse(['persons' => $stmt->fetchAll()]);
}

function meetingSaveAction(): void
{
    $pdo = db();
    $payload = getJsonPayload();

    $id = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $title = trim((string)($payload['title'] ?? ''));
    $date = trim((string)($payload['meeting_date'] ?? ''));
    $topic = trim((string)($payload['topic'] ?? ''));

    if ($title === '' || $date === '') {
        jsonResponse(['error' => 'Заполните название и дату заседания'], 422);
    }

    if ($id) {
        $stmt = $pdo->prepare('UPDATE meeting SET title=:title, meeting_date=:meeting_date, topic=:topic, updated_at=CURRENT_TIMESTAMP WHERE id=:id');
        $stmt->execute([':title' => $title, ':meeting_date' => $date, ':topic' => $topic, ':id' => $id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO meeting (title, meeting_date, topic) VALUES (:title, :meeting_date, :topic)');
        $stmt->execute([':title' => $title, ':meeting_date' => $date, ':topic' => $topic]);
        $id = (int)$pdo->lastInsertId();
        if (!empty($payload['use_template'])) {
            createTasksFromTemplate($pdo, $id, $date);
        }
    }

    jsonResponse(['ok' => true, 'id' => $id]);
}

function taskSaveAction(): void
{
    $pdo = db();
    $payload = getJsonPayload();

    $id = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $meetingId = (int)($payload['meeting_id'] ?? 0);
    $parentId = isset($payload['parent_task_id']) && $payload['parent_task_id'] !== '' ? (int)$payload['parent_task_id'] : null;
    $title = trim((string)($payload['title'] ?? ''));
    $start = trim((string)($payload['start_date'] ?? ''));
    $end = trim((string)($payload['end_date'] ?? ''));
    $status = trim((string)($payload['status'] ?? 'В работе'));
    $persons = is_array($payload['person_ids'] ?? null) ? $payload['person_ids'] : [];

    if ($meetingId <= 0 || $title === '' || $start === '' || $end === '') {
        jsonResponse(['error' => 'Заполните поля задачи'], 422);
    }

    if ($id) {
        $stmt = $pdo->prepare('UPDATE task SET title=:title, start_date=:start_date, end_date=:end_date, status=:status, updated_at=CURRENT_TIMESTAMP WHERE id=:id');
        $stmt->execute([':title' => $title, ':start_date' => $start, ':end_date' => $end, ':status' => $status, ':id' => $id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status) VALUES (:meeting_id,:parent_id,:title,:start_date,:end_date,:status)');
        $stmt->execute([
            ':meeting_id' => $meetingId,
            ':parent_id' => $parentId,
            ':title' => $title,
            ':start_date' => $start,
            ':end_date' => $end,
            ':status' => $status,
        ]);
        $id = (int)$pdo->lastInsertId();
    }

    $pdo->prepare('DELETE FROM task_person WHERE task_id=:id')->execute([':id' => $id]);
    if ($persons) {
        $link = $pdo->prepare('INSERT INTO task_person (task_id, person_id) VALUES (:task_id,:person_id)');
        foreach ($persons as $pid) {
            $link->execute([':task_id' => $id, ':person_id' => (int)$pid]);
        }
    }

    jsonResponse(['ok' => true, 'id' => $id]);
}

function getJsonPayload(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function requirePost(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function directionsAction(): void
{
    $rows = db()->query('SELECT id, name, color, sort_order FROM direction ORDER BY sort_order, id')->fetchAll();
    jsonResponse(['directions' => $rows]);
}

function directionSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;

    // Color-only update
    if ($id && array_key_exists('color', $payload) && !array_key_exists('name', $payload)) {
        $color = $payload['color'] ? trim((string)$payload['color']) : null;
        if ($color && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = null;
        $pdo->prepare('UPDATE direction SET color=:color WHERE id=:id')->execute([':color' => $color, ':id' => $id]);
        jsonResponse(['ok' => true, 'id' => $id]);
    }

    $name = trim((string)($payload['name'] ?? ''));
    if ($name === '') jsonResponse(['error' => 'Название не может быть пустым'], 422);
    $color = isset($payload['color']) ? trim((string)$payload['color']) : null;
    if ($color && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = null;

    if ($id) {
        $pdo->prepare('UPDATE direction SET name=:name WHERE id=:id')->execute([':name' => $name, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM direction')->fetch()['m']);
        $pdo->prepare('INSERT INTO direction (name, color, sort_order) VALUES (:name, :color, :sort)')
            ->execute([':name' => $name, ':color' => $color, ':sort' => $max + 1]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function directionDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM direction WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function statusesAction(): void
{
    $rows = db()->query('SELECT id, name, sort_order, color, is_system FROM task_status ORDER BY sort_order, id')->fetchAll();
    jsonResponse(['statuses' => $rows]);
}

function statusSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;

    // Color-only update (no name key in payload)
    if ($id && array_key_exists('color', $payload) && !array_key_exists('name', $payload)) {
        $color = $payload['color'] ? trim((string)$payload['color']) : null;
        if ($color && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = null;
        $pdo->prepare('UPDATE task_status SET color=:color WHERE id=:id')->execute([':color' => $color, ':id' => $id]);
        jsonResponse(['ok' => true, 'id' => $id]);
    }

    $name = trim((string)($payload['name'] ?? ''));
    if ($name === '') jsonResponse(['error' => 'Название не может быть пустым'], 422);

    $color = isset($payload['color']) ? trim((string)$payload['color']) : null;
    if ($color && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = null;

    if ($id) {
        $pdo->prepare('UPDATE task_status SET name=:name WHERE id=:id')->execute([':name' => $name, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM task_status')->fetch()['m']);
        $pdo->prepare('INSERT INTO task_status (name, sort_order, color) VALUES (:name, :sort, :color)')
            ->execute([':name' => $name, ':sort' => $max + 1, ':color' => $color]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function statusDeleteAction(): void
{
    $pdo = db();
    $id  = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    $row = $pdo->prepare('SELECT is_system FROM task_status WHERE id=:id')->execute([':id' => $id]);
    $sys = (int)($pdo->query("SELECT is_system FROM task_status WHERE id=$id")->fetch()['is_system'] ?? 0);
    if ($sys) jsonResponse(['error' => 'Системный статус нельзя удалить'], 422);
    $pdo->prepare('DELETE FROM task_status WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function statusReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE task_status SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}

function personSaveAction(): void
{
    $pdo       = db();
    $payload   = getJsonPayload();
    $id        = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $firstName = trim((string)($payload['first_name'] ?? ''));
    $lastName  = trim((string)($payload['last_name']  ?? ''));
    $email     = trim((string)($payload['email']      ?? ''));
    $dirId     = isset($payload['direction_id']) && $payload['direction_id'] !== '' ? (int)$payload['direction_id'] : null;
    $fullName  = trim("$firstName $lastName");

    if ($fullName === '') jsonResponse(['error' => 'Имя не может быть пустым'], 422);

    if ($id) {
        $pdo->prepare('UPDATE person SET first_name=:fn, last_name=:ln, full_name=:full, email=:email, direction_id=:dir WHERE id=:id')
            ->execute([':fn' => $firstName, ':ln' => $lastName, ':full' => $fullName, ':email' => $email ?: null, ':dir' => $dirId, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM person')->fetch()['m']);
        $pdo->prepare('INSERT INTO person (first_name, last_name, full_name, email, direction_id, sort_order) VALUES (:fn, :ln, :full, :email, :dir, :sort)')
            ->execute([':fn' => $firstName, ':ln' => $lastName, ':full' => $fullName, ':email' => $email ?: null, ':dir' => $dirId, ':sort' => $max + 1]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function personDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM person WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function createTasksFromTemplate(PDO $pdo, int $meetingId, string $meetingDate): void
{
    $tasks = $pdo->query('SELECT * FROM meeting_template_task ORDER BY sort_order, id')->fetchAll();
    if (!$tasks) return;

    $defaultStatus = $pdo->query("SELECT name FROM task_status WHERE is_system=0 ORDER BY sort_order, id LIMIT 1")->fetch()['name'] ?? 'В работе';
    $stmt = $pdo->prepare('INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status) VALUES (:mid, :pid, :title, :start, :end, :status)');
    $meetingDt  = new DateTime($meetingDate);
    $prevTaskId = null;

    foreach ($tasks as $tmpl) {
        $start    = (clone $meetingDt)->modify('-' . (int)$tmpl['days_before'] . ' days');
        $end      = (clone $start)->modify('+' . max(0, (int)$tmpl['duration_days'] - 1) . ' days');
        $parentId = ((int)$tmpl['is_subtask'] && $prevTaskId !== null) ? $prevTaskId : null;
        $stmt->execute([
            ':mid'    => $meetingId,
            ':pid'    => $parentId,
            ':title'  => $tmpl['title'],
            ':start'  => $start->format('Y-m-d'),
            ':end'    => $end->format('Y-m-d'),
            ':status' => $defaultStatus,
        ]);
        $prevTaskId = (int)$pdo->lastInsertId();
    }
}

function templateTasksAction(): void
{
    $rows = db()->query('SELECT id, title, days_before, duration_days, is_subtask, sort_order FROM meeting_template_task ORDER BY sort_order, id')->fetchAll();
    jsonResponse(['tasks' => $rows]);
}

function templateTaskSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $title   = trim((string)($payload['title'] ?? ''));
    if ($title === '') jsonResponse(['error' => 'Название не может быть пустым'], 422);
    $daysBefore   = max(0, (int)($payload['days_before']   ?? 0));
    $durationDays = max(1, (int)($payload['duration_days'] ?? 1));
    $isSubtask    = (int)(!empty($payload['is_subtask']));

    if ($id) {
        $pdo->prepare('UPDATE meeting_template_task SET title=:t, days_before=:db, duration_days=:dd, is_subtask=:sub WHERE id=:id')
            ->execute([':t' => $title, ':db' => $daysBefore, ':dd' => $durationDays, ':sub' => $isSubtask, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM meeting_template_task')->fetch()['m']);
        $pdo->prepare('INSERT INTO meeting_template_task (title, days_before, duration_days, is_subtask, sort_order) VALUES (:t,:db,:dd,:sub,:sort)')
            ->execute([':t' => $title, ':db' => $daysBefore, ':dd' => $durationDays, ':sub' => $isSubtask, ':sort' => $max + 1]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function templateTaskDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM meeting_template_task WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function templateTaskReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE meeting_template_task SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}

function meetingDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM meeting WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function taskDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM task WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function personReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE person SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}

function holidaysAction(): void
{
    $rows = db()->query('SELECT id, date FROM holiday ORDER BY date')->fetchAll();
    jsonResponse(['holidays' => $rows]);
}

function holidaySaveAction(): void
{
    $date = trim((string)(getJsonPayload()['date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) jsonResponse(['error' => 'Неверная дата'], 422);
    try {
        db()->prepare('INSERT INTO holiday (date) VALUES (:date)')->execute([':date' => $date]);
    } catch (\PDOException) {
        jsonResponse(['error' => 'Такая дата уже добавлена'], 409);
    }
    jsonResponse(['ok' => true]);
}

function holidayDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM holiday WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function dutyEventsAction(): void
{
    $pdo   = db();
    $year  = (int)($_GET['year']  ?? date('Y'));
    $month = (int)($_GET['month'] ?? date('m'));
    $start = sprintf('%04d-%02d-01', $year, $month);
    $end   = date('Y-m-t', strtotime($start));
    $stmt  = $pdo->prepare(
        'SELECT id, person_id, event_type, start_date, end_date FROM duty_event
         WHERE start_date <= :end AND end_date >= :start
         ORDER BY person_id, start_date'
    );
    $stmt->execute([':start' => $start, ':end' => $end]);
    jsonResponse(['events' => $stmt->fetchAll()]);
}

function dutyEventSaveAction(): void
{
    $pdo      = db();
    $payload  = getJsonPayload();
    $personId = (int)($payload['person_id']  ?? 0);
    $type     = trim((string)($payload['event_type'] ?? ''));
    $start    = trim((string)($payload['start_date'] ?? ''));
    $end      = trim((string)($payload['end_date']   ?? ''));
    $valid    = ['duty','no_duty','vacation','business_trip','sick_leave','study'];
    if (!$personId || !in_array($type, $valid, true) || !$start || !$end) {
        jsonResponse(['error' => 'Неверные данные'], 422);
    }
    if ($end < $start) $end = $start;
    $check = $pdo->prepare(
        'SELECT COUNT(*) AS c FROM duty_event WHERE person_id=:pid AND start_date<=:end AND end_date>=:start'
    );
    $check->execute([':pid' => $personId, ':start' => $start, ':end' => $end]);
    if ((int)$check->fetch()['c'] > 0) jsonResponse(['error' => 'Пересечение с существующим событием'], 409);
    $pdo->prepare(
        'INSERT INTO duty_event (person_id, event_type, start_date, end_date) VALUES (:pid,:type,:start,:end)'
    )->execute([':pid' => $personId, ':type' => $type, ':start' => $start, ':end' => $end]);
    jsonResponse(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

function dutyEventDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM duty_event WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}
