<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$q      = isset($_GET['q'])      ? (string)$_GET['q']      : '';
$limit  = isset($_GET['limit'])  ? (int)$_GET['limit']     : 50;
$offset = isset($_GET['offset']) ? (int)$_GET['offset']    : 0;

$limit  = max(1, min(200, $limit));
$offset = max(0, $offset);

$params = http_build_query([
    'q'      => $q,
    'limit'  => $limit,
    'offset' => $offset,
]);

$url = 'http://10.202.168.72/api.php?' . $params;

$ctx = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'timeout'         => 8,
        'ignore_errors'   => true,
    ],
]);

$body = @file_get_contents($url, false, $ctx);

if ($body === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'Не удалось подключиться к справочнику'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo $body;
