<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/access.php';
db();
$access = checkPageAccess('duty');
if (!$access['can_view']) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Доступ запрещён';
    exit;
}

$year  = max(2000, min(2100, (int)($_GET['year']  ?? date('Y'))));
$month = max(1,    min(12,   (int)($_GET['month'] ?? date('n'))));

$templatePath = __DIR__ . '/template.docx';
if (!file_exists($templatePath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Файл template.docx не найден';
    exit;
}

$pdo = db();

// ─── Данные из БД ────────────────────────────────────────────────────────────

$persons = $pdo->query(
    'SELECT id, full_name FROM person ORDER BY sort_order, id'
)->fetchAll(\PDO::FETCH_ASSOC);

$daysInMonth = (int)date('t', mktime(0, 0, 0, $month, 1, $year));
$startISO    = sprintf('%04d-%02d-01', $year, $month);
$endISO      = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

$stmt = $pdo->prepare(
    'SELECT person_id, event_type, start_date, end_date
     FROM duty_event
     WHERE start_date <= :end AND end_date >= :start
     ORDER BY person_id, start_date'
);
$stmt->execute([':start' => $startISO, ':end' => $endISO]);
$eventRows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

// Символы событий (те же что на странице + буквенные коды для многодневных)
$symbols = [
    'duty'          => '✕',
    'no_duty'       => 'о',
    'vacation'      => 'о',
    'business_trip' => 'к',
    'sick_leave'    => 'б',
    'study'         => 'у',
];

// Карта событий: [person_id][номер_дня] => символ
$evtMap = [];
foreach ($eventRows as $e) {
    $pid = (int)$e['person_id'];
    $cur = new \DateTime($e['start_date']);
    $end = new \DateTime($e['end_date']);
    while ($cur <= $end) {
        $iso = $cur->format('Y-m-d');
        if ($iso >= $startISO && $iso <= $endISO) {
            $day = (int)$cur->format('j');
            $evtMap[$pid][$day] = $symbols[$e['event_type']] ?? '';
        }
        $cur->modify('+1 day');
    }
}

// ─── Работа с docx ───────────────────────────────────────────────────────────

$zip = new \ZipArchive();
if ($zip->open($templatePath) !== true) {
    http_response_code(500);
    echo 'Не удалось открыть template.docx';
    exit;
}
$xmlContent = $zip->getFromName('word/document.xml');
$zip->close();

$dom = new \DOMDocument('1.0', 'UTF-8');
$dom->loadXML($xmlContent, LIBXML_NOERROR | LIBXML_COMPACT);

$wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Найти первую таблицу
$tables = $dom->getElementsByTagNameNS($wNs, 'tbl');
if ($tables->length === 0) {
    http_response_code(500);
    echo 'Таблица в template.docx не найдена';
    exit;
}
$table = $tables->item(0);

// Найти первую строку-шаблон (прямой дочерний w:tr)
$templateRow = null;
foreach ($table->childNodes as $child) {
    if ($child->localName === 'tr') {
        $templateRow = $child;
        break;
    }
}
if (!$templateRow) {
    http_response_code(500);
    echo 'Строка-шаблон в таблице не найдена';
    exit;
}

// Считаем столбцы в шаблонной строке
$templateCells = [];
foreach ($templateRow->childNodes as $child) {
    if ($child->localName === 'tc') {
        $templateCells[] = $child;
    }
}
$totalCols = count($templateCells); // 2 фикс. + N дневных
$dayCols   = max(0, $totalCols - 2);

/**
 * Записать текст в ячейку, сохраняя свойства ячейки, параграфа и первого run-а.
 */
function setCellText(\DOMElement $cell, string $text, string $wNs): void
{
    $doc = $cell->ownerDocument;

    // Найти первый <w:p>
    $para = null;
    foreach ($cell->childNodes as $ch) {
        if ($ch->localName === 'p') { $para = $ch; break; }
    }
    if (!$para) return;

    // Сохранить rPr из первого существующего run-а (если есть)
    $rPrNode = null;
    foreach ($para->childNodes as $ch) {
        if ($ch->localName === 'r') {
            foreach ($ch->childNodes as $rch) {
                if ($rch->localName === 'rPr') {
                    $rPrNode = $rch->cloneNode(true);
                    break;
                }
            }
            break;
        }
    }

    // Удалить из <w:p> всё кроме <w:pPr>
    $toRemove = [];
    foreach ($para->childNodes as $ch) {
        if ($ch->localName !== 'pPr') $toRemove[] = $ch;
    }
    foreach ($toRemove as $node) $para->removeChild($node);

    if ($text === '') return;

    // Создать <w:r>[<w:rPr/>]<w:t>text</w:t></w:r>
    $run = $doc->createElementNS($wNs, 'w:r');
    if ($rPrNode) {
        $run->appendChild($doc->importNode($rPrNode, true));
    }
    $t = $doc->createElementNS($wNs, 'w:t');
    $t->setAttribute('xml:space', 'preserve');
    $t->appendChild($doc->createTextNode($text));
    $run->appendChild($t);
    $para->appendChild($run);
}

// ─── Генерация строк ─────────────────────────────────────────────────────────

foreach ($persons as $idx => $person) {
    $newRow = $templateRow->cloneNode(true);

    // Собрать ячейки клонированной строки
    $cells = [];
    foreach ($newRow->childNodes as $ch) {
        if ($ch->localName === 'tc') $cells[] = $ch;
    }

    // Столбец 0: порядковый номер
    if (isset($cells[0])) {
        setCellText($cells[0], (string)($idx + 1), $wNs);
    }

    // Столбец 1: ФИО
    if (isset($cells[1])) {
        setCellText($cells[1], $person['full_name'], $wNs);
    }

    // Столбцы 2+: события по дням
    $pid = (int)$person['id'];
    for ($col = 0; $col < $dayCols; $col++) {
        $day     = $col + 1;
        $cellIdx = $col + 2;
        if (!isset($cells[$cellIdx])) break;
        $sym = ($day <= $daysInMonth) ? ($evtMap[$pid][$day] ?? '') : '';
        setCellText($cells[$cellIdx], $sym, $wNs);
    }

    // Вставить перед шаблонной строкой (в конце получим N строк в нужном порядке)
    $table->insertBefore($newRow, $templateRow);
}

// Удалить оригинальную пустую строку-шаблон
$table->removeChild($templateRow);

$newXml = $dom->saveXML();

// ─── Сборка итогового docx ───────────────────────────────────────────────────

$tmpFile = tempnam(sys_get_temp_dir(), 'duty_') . '.docx';
copy($templatePath, $tmpFile);

$outZip = new \ZipArchive();
$outZip->open($tmpFile);
$outZip->addFromString('word/document.xml', $newXml);
$outZip->close();

// ─── Отдать файл ─────────────────────────────────────────────────────────────

$monthNames = [
    1=>'Январь',2=>'Февраль',3=>'Март',4=>'Апрель',
    5=>'Май',6=>'Июнь',7=>'Июль',8=>'Август',
    9=>'Сентябрь',10=>'Октябрь',11=>'Ноябрь',12=>'Декабрь',
];
$filename = 'График_дежурств_' . $monthNames[$month] . '_' . $year . '.docx';

header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($filename));
header('Content-Length: ' . filesize($tmpFile));
header('Cache-Control: no-store');
readfile($tmpFile);
unlink($tmpFile);
