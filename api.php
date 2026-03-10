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
                GROUP_CONCAT(p.full_name, ", ") AS responsible
         FROM task t
         LEFT JOIN task_person tp ON tp.task_id = t.id
         LEFT JOIN person p ON p.id = tp.person_id
         GROUP BY t.id
         ORDER BY t.start_date, t.id'
    )->fetchAll();

    $tasksByMeeting = [];
    foreach ($taskRows as $task) {
        $task['responsible'] = $task['responsible'] ?? '';
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

    if ($title === '' || $date === '' || $topic === '') {
        jsonResponse(['error' => 'Заполните все поля заседания'], 422);
    }

    if ($id) {
        $stmt = $pdo->prepare('UPDATE meeting SET title=:title, meeting_date=:meeting_date, topic=:topic, updated_at=CURRENT_TIMESTAMP WHERE id=:id');
        $stmt->execute([':title' => $title, ':meeting_date' => $date, ':topic' => $topic, ':id' => $id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO meeting (title, meeting_date, topic) VALUES (:title, :meeting_date, :topic)');
        $stmt->execute([':title' => $title, ':meeting_date' => $date, ':topic' => $topic]);
        $id = (int)$pdo->lastInsertId();
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
    $rows = db()->query('SELECT id, name, sort_order FROM direction ORDER BY sort_order, id')->fetchAll();
    jsonResponse(['directions' => $rows]);
}

function directionSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $name    = trim((string)($payload['name'] ?? ''));
    if ($name === '') jsonResponse(['error' => 'Название не может быть пустым'], 422);

    if ($id) {
        $pdo->prepare('UPDATE direction SET name=:name WHERE id=:id')->execute([':name' => $name, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM direction')->fetch()['m']);
        $pdo->prepare('INSERT INTO direction (name, sort_order) VALUES (:name, :sort)')->execute([':name' => $name, ':sort' => $max + 1]);
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
    $rows = db()->query('SELECT id, name, sort_order, color FROM task_status ORDER BY sort_order, id')->fetchAll();
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

    if ($id) {
        $pdo->prepare('UPDATE task_status SET name=:name WHERE id=:id')->execute([':name' => $name, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM task_status')->fetch()['m']);
        $pdo->prepare('INSERT INTO task_status (name, sort_order) VALUES (:name, :sort)')->execute([':name' => $name, ':sort' => $max + 1]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function statusDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM task_status WHERE id=:id')->execute([':id' => $id]);
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

function personReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE person SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}
