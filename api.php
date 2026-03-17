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
        case 'task_reorder':
            requirePost();
            taskReorderAction();
            break;
        case 'meeting_delete':
            requirePost();
            meetingDeleteAction();
            break;
        case 'task_delete':
            requirePost();
            taskDeleteAction();
            break;
        case 'task_dates':
            requirePost();
            taskDatesAction();
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
        case 'duty_stats':
            dutyStatsAction();
            break;
        case 'duty_stats_years':
            dutyStatsYearsAction();
            break;
        case 'meetings_list':
            meetingsListAction();
            break;
        case 'vacation_events':
            vacationEventsAction();
            break;
        case 'vacation_years':
            vacationYearsAction();
            break;
        case 'site_settings':
            siteSettingsAction();
            break;
        case 'site_settings_save':
            requirePost();
            siteSettingsSaveAction();
            break;
        case 'control_timeline':
            controlTimelineAction();
            break;
        case 'control_save':
            requirePost();
            controlSaveAction();
            break;
        case 'control_delete':
            requirePost();
            controlDeleteAction();
            break;
        case 'control_task_save':
            requirePost();
            controlTaskSaveAction();
            break;
        case 'control_task_delete':
            requirePost();
            controlTaskDeleteAction();
            break;
        case 'control_task_dates':
            requirePost();
            controlTaskDatesAction();
            break;
        case 'control_task_reorder':
            requirePost();
            controlTaskReorderAction();
            break;
        case 'control_template_tasks':
            controlTemplateTasksAction();
            break;
        case 'control_template_task_save':
            requirePost();
            controlTemplateTaskSaveAction();
            break;
        case 'control_template_task_delete':
            requirePost();
            controlTemplateTaskDeleteAction();
            break;
        case 'control_template_task_reorder':
            requirePost();
            controlTemplateTaskReorderAction();
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
         ORDER BY t.sort_order, t.start_date, t.id'
    )->fetchAll();

    // Conflict check: vacation/study overlapping task dates
    $conflictsByTask = [];
    try {
        $cRows = $pdo->query(
            'SELECT tp.task_id, p.full_name, de.event_type, de.start_date AS ev_start, de.end_date AS ev_end
             FROM task_person tp
             JOIN person p  ON p.id  = tp.person_id
             JOIN duty_event de ON de.person_id = tp.person_id
             JOIN task t    ON t.id  = tp.task_id
             WHERE de.event_type IN (\'vacation\', \'study\')
               AND DATE(de.start_date) <= DATE(t.end_date)
               AND DATE(de.end_date)   >= DATE(t.start_date)
             ORDER BY tp.task_id, p.full_name, de.start_date'
        )->fetchAll();
        foreach ($cRows as $r) {
            $conflictsByTask[(int)$r['task_id']][] = [
                'person'     => $r['full_name'],
                'event_type' => $r['event_type'],
                'start'      => $r['ev_start'],
                'end'        => $r['ev_end'],
            ];
        }
    } catch (\Throwable) {}

    $tasksByMeeting = [];
    foreach ($taskRows as $task) {
        $task['responsible'] = $task['responsible'] ?? '';
        $task['person_ids']  = $task['person_ids']  ?? '';
        $task['conflicts']   = $conflictsByTask[(int)$task['id']] ?? [];
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

    $fields = 'id, first_name, last_name, full_name, birth_date, direction_id, sort_order,
               ip, page_main_view, page_main_edit, page_duty_view, page_duty_edit,
               page_settings_view, page_settings_edit, page_vacation_view, page_vacation_edit,
               page_control_view, page_control_edit';
    if ($q === '') {
        $stmt = $pdo->query("SELECT $fields FROM person ORDER BY sort_order, id LIMIT 50");
    } else {
        $stmt = $pdo->prepare("SELECT $fields FROM person WHERE full_name LIKE :q ORDER BY sort_order, id LIMIT 50");
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
        if ($parentId !== null) {
            $sortStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM task WHERE parent_task_id=:pid');
            $sortStmt->execute([':pid' => $parentId]);
        } else {
            $sortStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM task WHERE meeting_id=:mid AND parent_task_id IS NULL');
            $sortStmt->execute([':mid' => $meetingId]);
        }
        $sortOrder = (int)($sortStmt->fetch()['next'] ?? 1);

        $stmt = $pdo->prepare('INSERT INTO task (meeting_id, parent_task_id, title, start_date, end_date, status, sort_order) VALUES (:meeting_id,:parent_id,:title,:start_date,:end_date,:status,:sort_order)');
        $stmt->execute([
            ':meeting_id' => $meetingId,
            ':parent_id' => $parentId,
            ':title' => $title,
            ':start_date' => $start,
            ':end_date' => $end,
            ':status' => $status,
            ':sort_order' => $sortOrder,
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

function taskReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE task SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
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
    $birthDate = trim((string)($payload['birth_date'] ?? '')) ?: null;
    $dirId     = isset($payload['direction_id']) && $payload['direction_id'] !== '' ? (int)$payload['direction_id'] : null;
    $ip        = trim((string)($payload['ip'] ?? ''));
    $fullName  = trim("$firstName $lastName");

    $pmv = (int)!empty($payload['page_main_view']);
    $pme = (int)!empty($payload['page_main_edit']);
    $pdv = (int)!empty($payload['page_duty_view']);
    $pde = (int)!empty($payload['page_duty_edit']);
    $psv = (int)!empty($payload['page_settings_view']);
    $pse = (int)!empty($payload['page_settings_edit']);
    $pvv = (int)!empty($payload['page_vacation_view']);
    $pve = (int)!empty($payload['page_vacation_edit']);
    $pcv = (int)!empty($payload['page_control_view']);
    $pce = (int)!empty($payload['page_control_edit']);

    if ($fullName === '') jsonResponse(['error' => 'Имя не может быть пустым'], 422);

    if ($id) {
        $pdo->prepare(
            'UPDATE person SET first_name=:fn, last_name=:ln, full_name=:full, birth_date=:bd,
             direction_id=:dir, ip=:ip, page_main_view=:pmv, page_main_edit=:pme,
             page_duty_view=:pdv, page_duty_edit=:pde, page_settings_view=:psv,
             page_settings_edit=:pse, page_vacation_view=:pvv, page_vacation_edit=:pve,
             page_control_view=:pcv, page_control_edit=:pce WHERE id=:id'
        )->execute([':fn' => $firstName, ':ln' => $lastName, ':full' => $fullName,
            ':bd' => $birthDate, ':dir' => $dirId, ':ip' => $ip,
            ':pmv' => $pmv, ':pme' => $pme, ':pdv' => $pdv,
            ':pde' => $pde, ':psv' => $psv, ':pse' => $pse,
            ':pvv' => $pvv, ':pve' => $pve, ':pcv' => $pcv, ':pce' => $pce, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM person')->fetch()['m']);
        $pdo->prepare(
            'INSERT INTO person (first_name, last_name, full_name, birth_date, direction_id, sort_order,
             ip, page_main_view, page_main_edit, page_duty_view, page_duty_edit,
             page_settings_view, page_settings_edit, page_vacation_view, page_vacation_edit,
             page_control_view, page_control_edit)
             VALUES (:fn,:ln,:full,:bd,:dir,:sort,:ip,:pmv,:pme,:pdv,:pde,:psv,:pse,:pvv,:pve,:pcv,:pce)'
        )->execute([':fn' => $firstName, ':ln' => $lastName, ':full' => $fullName,
            ':bd' => $birthDate, ':dir' => $dirId, ':sort' => $max + 1, ':ip' => $ip,
            ':pmv' => $pmv, ':pme' => $pme, ':pdv' => $pdv,
            ':pde' => $pde, ':psv' => $psv, ':pse' => $pse,
            ':pvv' => $pvv, ':pve' => $pve, ':pcv' => $pcv, ':pce' => $pce]);
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

function taskDatesAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = (int)($payload['id'] ?? 0);
    $start   = trim((string)($payload['start_date'] ?? ''));
    $end     = trim((string)($payload['end_date'] ?? ''));
    if ($id <= 0 || $start === '' || $end === '') {
        jsonResponse(['error' => 'Неверные данные'], 422);
    }
    $stmt = $pdo->prepare('UPDATE task SET start_date=:s, end_date=:e, updated_at=CURRENT_TIMESTAMP WHERE id=:id');
    $stmt->execute([':s' => $start, ':e' => $end, ':id' => $id]);
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
    $id       = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $personId = (int)($payload['person_id']  ?? 0);
    $type     = trim((string)($payload['event_type'] ?? ''));
    $start    = trim((string)($payload['start_date'] ?? ''));
    $end      = trim((string)($payload['end_date']   ?? ''));
    $valid    = ['duty','no_duty','vacation','business_trip','sick_leave','study'];
    if (!$personId || !in_array($type, $valid, true) || !$start || !$end) {
        jsonResponse(['error' => 'Неверные данные'], 422);
    }
    if ($end < $start) $end = $start;
    $checkSql = 'SELECT COUNT(*) AS c FROM duty_event WHERE person_id=:pid AND start_date<=:end AND end_date>=:start';
    $params   = [':pid' => $personId, ':start' => $start, ':end' => $end];
    if ($id) { $checkSql .= ' AND id != :id'; $params[':id'] = $id; }
    $check = $pdo->prepare($checkSql);
    $check->execute($params);
    if ((int)$check->fetch()['c'] > 0) jsonResponse(['error' => 'Пересечение с существующим событием'], 409);
    if ($id) {
        $pdo->prepare(
            'UPDATE duty_event SET person_id=:pid, event_type=:type, start_date=:start, end_date=:end WHERE id=:id'
        )->execute([':pid' => $personId, ':type' => $type, ':start' => $start, ':end' => $end, ':id' => $id]);
        jsonResponse(['ok' => true, 'id' => $id]);
    }
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

function dutyStatsYearsAction(): void
{
    $rows  = db()->query(
        "SELECT DISTINCT strftime('%Y', start_date) AS y FROM duty_event WHERE event_type='duty' ORDER BY y"
    )->fetchAll();
    $years = array_map(fn($r) => (int)$r['y'], $rows);
    $cur   = (int)date('Y');
    if (!in_array($cur, $years, true)) { $years[] = $cur; sort($years); }
    jsonResponse(['years' => $years]);
}

function dutyStatsAction(): void
{
    $pdo  = db();
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $yStr = sprintf('%04d', $year);

    // All persons (include those with zero events)
    $persons = $pdo->query('SELECT id, full_name FROM person ORDER BY sort_order, id')->fetchAll();

    // For each duty event, determine: day_idx 0-6 (Mon-Sun) or 7 (holiday)
    $stmt = $pdo->prepare(
        "SELECT de.person_id,
                CASE WHEN h.date IS NOT NULL THEN 7
                     ELSE (CAST(strftime('%w', de.start_date) AS INTEGER) + 6) % 7
                END AS day_idx
         FROM duty_event de
         LEFT JOIN holiday h ON h.date = de.start_date
         WHERE de.event_type = 'duty'
           AND strftime('%Y', de.start_date) = :year
         ORDER BY de.person_id"
    );
    $stmt->execute([':year' => $yStr]);
    $rows = $stmt->fetchAll();

    $statsMap = [];
    foreach ($persons as $p) {
        $statsMap[(int)$p['id']] = [
            'person_id' => (int)$p['id'],
            'full_name' => $p['full_name'],
            'days'      => [0, 0, 0, 0, 0, 0, 0],
            'holidays'  => 0,
        ];
    }

    foreach ($rows as $r) {
        $pid = (int)$r['person_id'];
        $idx = (int)$r['day_idx'];
        if (!isset($statsMap[$pid])) continue;
        if ($idx === 7) {
            $statsMap[$pid]['holidays']++;
        } else {
            $statsMap[$pid]['days'][$idx]++;
        }
    }

    jsonResponse(['stats' => array_values($statsMap)]);
}

function meetingsListAction(): void
{
    $rows = db()->query('SELECT id, meeting_date FROM meeting ORDER BY meeting_date')->fetchAll();
    jsonResponse(['meetings' => $rows]);
}

function vacationEventsAction(): void
{
    $pdo   = db();
    $year  = (int)($_GET['year'] ?? date('Y'));
    $yStr  = sprintf('%04d', $year);
    $start = $yStr . '-01-01';
    $end   = $yStr . '-12-31';
    $stmt  = $pdo->prepare(
        "SELECT id, person_id, event_type, start_date, end_date FROM duty_event
         WHERE event_type = 'vacation'
           AND start_date <= :end AND end_date >= :start
         ORDER BY person_id, start_date"
    );
    $stmt->execute([':start' => $start, ':end' => $end]);
    jsonResponse(['events' => $stmt->fetchAll()]);
}

function vacationYearsAction(): void
{
    $rows  = db()->query(
        "SELECT DISTINCT strftime('%Y', start_date) AS y FROM duty_event WHERE event_type='vacation' ORDER BY y"
    )->fetchAll();
    $years = array_map(fn($r) => (int)$r['y'], $rows);
    $cur   = (int)date('Y');
    if (!in_array($cur, $years, true)) { $years[] = $cur; sort($years); }
    jsonResponse(['years' => $years]);
}

function siteSettingsAction(): void
{
    try {
        $rows = db()->query('SELECT key, value FROM app_settings')->fetchAll();
        $settings = [];
        foreach ($rows as $r) $settings[$r['key']] = $r['value'];
        jsonResponse(['settings' => $settings]);
    } catch (\Throwable) {
        jsonResponse(['settings' => []]);
    }
}

function siteSettingsSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $allowed = ['ip_access_enabled', 'weekend_color', 'vacation_color', 'today_col_color', 'meeting_col_color', 'col_item_width', 'col_status_width', 'col_day_min_width'];
    foreach ($allowed as $key) {
        if (!array_key_exists($key, $payload)) continue;
        $pdo->prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (:k, :v)')
            ->execute([':k' => $key, ':v' => (string)$payload[$key]]);
    }
    jsonResponse(['ok' => true]);
}

// ─── Control ──────────────────────────────────────────────────────────────────

function controlTimelineAction(): void
{
    $pdo   = db();
    $start = $_GET['start'] ?? date('Y-m-01');
    $days  = max(1, min(60, (int)($_GET['days'] ?? 35)));

    $controls = $pdo->query('SELECT id, title, control_date FROM control ORDER BY control_date, id')->fetchAll();

    $taskRows = $pdo->query(
        'SELECT t.id, t.control_id, t.parent_task_id, t.title, t.start_date, t.end_date, t.status,
                GROUP_CONCAT(p.full_name, ", ") AS responsible,
                GROUP_CONCAT(CAST(tp.person_id AS TEXT), ",") AS person_ids,
                (SELECT d.color FROM control_task_person tp2
                 JOIN person p2 ON p2.id = tp2.person_id
                 LEFT JOIN direction d ON d.id = p2.direction_id
                 WHERE tp2.task_id = t.id
                 ORDER BY tp2.person_id LIMIT 1) AS direction_color
         FROM control_task t
         LEFT JOIN control_task_person tp ON tp.task_id = t.id
         LEFT JOIN person p ON p.id = tp.person_id
         GROUP BY t.id
         ORDER BY t.sort_order, t.start_date, t.id'
    )->fetchAll();

    $conflictsByTask = [];
    try {
        $cRows = $pdo->query(
            'SELECT tp.task_id, p.full_name, de.event_type, de.start_date AS ev_start, de.end_date AS ev_end
             FROM control_task_person tp
             JOIN person p  ON p.id  = tp.person_id
             JOIN duty_event de ON de.person_id = tp.person_id
             JOIN control_task t ON t.id = tp.task_id
             WHERE de.event_type IN (\'vacation\', \'study\')
               AND DATE(de.start_date) <= DATE(t.end_date)
               AND DATE(de.end_date)   >= DATE(t.start_date)
             ORDER BY tp.task_id, p.full_name, de.start_date'
        )->fetchAll();
        foreach ($cRows as $r) {
            $conflictsByTask[(int)$r['task_id']][] = [
                'person'     => $r['full_name'],
                'event_type' => $r['event_type'],
                'start'      => $r['ev_start'],
                'end'        => $r['ev_end'],
            ];
        }
    } catch (\Throwable) {}

    $tasksByControl = [];
    foreach ($taskRows as $task) {
        $task['responsible'] = $task['responsible'] ?? '';
        $task['person_ids']  = $task['person_ids']  ?? '';
        $task['conflicts']   = $conflictsByTask[(int)$task['id']] ?? [];
        $tasksByControl[(int)$task['control_id']][] = $task;
    }

    $result = [];
    foreach ($controls as $control) {
        $cid   = (int)$control['id'];
        $tasks = $tasksByControl[$cid] ?? [];
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
            'id'           => $cid,
            'title'        => $control['title'],
            'control_date' => $control['control_date'],
            'tasks'        => $roots,
        ];
    }

    jsonResponse(['start' => $start, 'days' => $days, 'controls' => $result]);
}

function controlSaveAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();

    $id    = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $title = trim((string)($payload['title'] ?? ''));
    $date  = trim((string)($payload['control_date'] ?? ''));

    if ($title === '' || $date === '') {
        jsonResponse(['error' => 'Заполните название и дату'], 422);
    }

    if ($id) {
        $pdo->prepare('UPDATE control SET title=:title, control_date=:control_date, updated_at=CURRENT_TIMESTAMP WHERE id=:id')
            ->execute([':title' => $title, ':control_date' => $date, ':id' => $id]);
    } else {
        $pdo->prepare('INSERT INTO control (title, control_date) VALUES (:title, :control_date)')
            ->execute([':title' => $title, ':control_date' => $date]);
        $id = (int)$pdo->lastInsertId();
        if (!empty($payload['use_template'])) {
            createControlTasksFromTemplate($pdo, $id, $date);
        }
    }

    jsonResponse(['ok' => true, 'id' => $id]);
}

function controlDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM control WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function controlTaskSaveAction(): void
{
    $pdo       = db();
    $payload   = getJsonPayload();

    $id        = isset($payload['id']) && $payload['id'] !== '' ? (int)$payload['id'] : null;
    $controlId = (int)($payload['control_id'] ?? 0);
    $parentId  = isset($payload['parent_task_id']) && $payload['parent_task_id'] !== '' ? (int)$payload['parent_task_id'] : null;
    $title     = trim((string)($payload['title'] ?? ''));
    $start     = trim((string)($payload['start_date'] ?? ''));
    $end       = trim((string)($payload['end_date'] ?? ''));
    $status    = trim((string)($payload['status'] ?? 'В работе'));
    $persons   = is_array($payload['person_ids'] ?? null) ? $payload['person_ids'] : [];

    if ($controlId <= 0 || $title === '' || $start === '' || $end === '') {
        jsonResponse(['error' => 'Заполните поля задачи'], 422);
    }

    if ($id) {
        $pdo->prepare('UPDATE control_task SET title=:title, start_date=:start_date, end_date=:end_date, status=:status, updated_at=CURRENT_TIMESTAMP WHERE id=:id')
            ->execute([':title' => $title, ':start_date' => $start, ':end_date' => $end, ':status' => $status, ':id' => $id]);
    } else {
        if ($parentId !== null) {
            $sortStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM control_task WHERE parent_task_id=:pid');
            $sortStmt->execute([':pid' => $parentId]);
        } else {
            $sortStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM control_task WHERE control_id=:cid AND parent_task_id IS NULL');
            $sortStmt->execute([':cid' => $controlId]);
        }
        $sortOrder = (int)($sortStmt->fetch()['next'] ?? 1);

        $pdo->prepare('INSERT INTO control_task (control_id, parent_task_id, title, start_date, end_date, status, sort_order) VALUES (:control_id,:parent_id,:title,:start_date,:end_date,:status,:sort_order)')
            ->execute([
                ':control_id' => $controlId,
                ':parent_id'  => $parentId,
                ':title'      => $title,
                ':start_date' => $start,
                ':end_date'   => $end,
                ':status'     => $status,
                ':sort_order' => $sortOrder,
            ]);
        $id = (int)$pdo->lastInsertId();
    }

    $pdo->prepare('DELETE FROM control_task_person WHERE task_id=:id')->execute([':id' => $id]);
    if ($persons) {
        $link = $pdo->prepare('INSERT INTO control_task_person (task_id, person_id) VALUES (:task_id,:person_id)');
        foreach ($persons as $pid) {
            $link->execute([':task_id' => $id, ':person_id' => (int)$pid]);
        }
    }

    jsonResponse(['ok' => true, 'id' => $id]);
}

function controlTaskDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM control_task WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function controlTaskDatesAction(): void
{
    $pdo     = db();
    $payload = getJsonPayload();
    $id      = (int)($payload['id'] ?? 0);
    $start   = trim((string)($payload['start_date'] ?? ''));
    $end     = trim((string)($payload['end_date'] ?? ''));
    if ($id <= 0 || $start === '' || $end === '') {
        jsonResponse(['error' => 'Неверные данные'], 422);
    }
    $pdo->prepare('UPDATE control_task SET start_date=:s, end_date=:e, updated_at=CURRENT_TIMESTAMP WHERE id=:id')
        ->execute([':s' => $start, ':e' => $end, ':id' => $id]);
    jsonResponse(['ok' => true]);
}

function controlTaskReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE control_task SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}

function createControlTasksFromTemplate(PDO $pdo, int $controlId, string $controlDate): void
{
    $tasks = $pdo->query('SELECT * FROM control_template_task ORDER BY sort_order, id')->fetchAll();
    if (!$tasks) return;

    $defaultStatus = $pdo->query("SELECT name FROM task_status WHERE is_system=0 ORDER BY sort_order, id LIMIT 1")->fetch()['name'] ?? 'В работе';
    $stmt = $pdo->prepare('INSERT INTO control_task (control_id, parent_task_id, title, start_date, end_date, status) VALUES (:cid, :pid, :title, :start, :end, :status)');
    $controlDt  = new DateTime($controlDate);
    $prevTaskId = null;

    foreach ($tasks as $tmpl) {
        $start    = (clone $controlDt)->modify('-' . (int)$tmpl['days_before'] . ' days');
        $end      = (clone $start)->modify('+' . max(0, (int)$tmpl['duration_days'] - 1) . ' days');
        $parentId = ((int)$tmpl['is_subtask'] && $prevTaskId !== null) ? $prevTaskId : null;
        $stmt->execute([
            ':cid'    => $controlId,
            ':pid'    => $parentId,
            ':title'  => $tmpl['title'],
            ':start'  => $start->format('Y-m-d'),
            ':end'    => $end->format('Y-m-d'),
            ':status' => $defaultStatus,
        ]);
        $prevTaskId = (int)$pdo->lastInsertId();
    }
}

function controlTemplateTasksAction(): void
{
    $rows = db()->query('SELECT id, title, days_before, duration_days, is_subtask, sort_order FROM control_template_task ORDER BY sort_order, id')->fetchAll();
    jsonResponse(['tasks' => $rows]);
}

function controlTemplateTaskSaveAction(): void
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
        $pdo->prepare('UPDATE control_template_task SET title=:t, days_before=:db, duration_days=:dd, is_subtask=:sub WHERE id=:id')
            ->execute([':t' => $title, ':db' => $daysBefore, ':dd' => $durationDays, ':sub' => $isSubtask, ':id' => $id]);
    } else {
        $max = (int)($pdo->query('SELECT COALESCE(MAX(sort_order),0) AS m FROM control_template_task')->fetch()['m']);
        $pdo->prepare('INSERT INTO control_template_task (title, days_before, duration_days, is_subtask, sort_order) VALUES (:t,:db,:dd,:sub,:sort)')
            ->execute([':t' => $title, ':db' => $daysBefore, ':dd' => $durationDays, ':sub' => $isSubtask, ':sort' => $max + 1]);
        $id = (int)$pdo->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

function controlTemplateTaskDeleteAction(): void
{
    $id = (int)(getJsonPayload()['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'id обязателен'], 422);
    db()->prepare('DELETE FROM control_template_task WHERE id=:id')->execute([':id' => $id]);
    jsonResponse(['ok' => true]);
}

function controlTemplateTaskReorderAction(): void
{
    $pdo  = db();
    $ids  = getJsonPayload()['ids'] ?? [];
    if (!is_array($ids)) jsonResponse(['error' => 'ids must be array'], 422);
    $stmt = $pdo->prepare('UPDATE control_template_task SET sort_order=:sort WHERE id=:id');
    foreach ($ids as $i => $id) $stmt->execute([':sort' => $i + 1, ':id' => (int)$id]);
    jsonResponse(['ok' => true]);
}
