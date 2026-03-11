<?php
declare(strict_types=1);

function getClientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function isIpAccessEnabled(): bool
{
    try {
        $stmt = db()->prepare('SELECT value FROM app_settings WHERE key=:k');
        $stmt->execute([':k' => 'ip_access_enabled']);
        $row = $stmt->fetch();
        return $row !== false && (int)$row['value'] === 1;
    } catch (\Throwable) {
        return false;
    }
}

function checkPageAccess(string $page): array
{
    if (!isIpAccessEnabled()) {
        return ['can_view' => true, 'can_edit' => true];
    }

    $allowed = ['main', 'duty', 'settings'];
    if (!in_array($page, $allowed, true)) {
        return ['can_view' => true, 'can_edit' => true];
    }

    $ip      = getClientIp();
    $viewCol = "page_{$page}_view";
    $editCol = "page_{$page}_edit";

    try {
        $stmt = db()->prepare(
            "SELECT {$viewCol}, {$editCol} FROM person WHERE ip = :ip AND ip != '' LIMIT 1"
        );
        $stmt->execute([':ip' => $ip]);
        $row = $stmt->fetch();
    } catch (\Throwable) {
        return ['can_view' => false, 'can_edit' => false];
    }

    if ($row === false) {
        return ['can_view' => false, 'can_edit' => false];
    }

    return [
        'can_view' => (int)$row[$viewCol] === 1,
        'can_edit' => (int)$row[$editCol] === 1,
    ];
}

function accessDeniedPage(): never
{
    http_response_code(403);
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Доступ запрещён</title>'
        . '<link rel="stylesheet" href="styles.css"></head><body>'
        . '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px">'
        . '<h2 style="margin:0">Доступ запрещён</h2>'
        . '<p style="color:#6f7a94;margin:0">Ваш IP-адрес не имеет доступа к этой странице.</p>'
        . '<a href="index.php" style="color:#2b68ff">На главную</a>'
        . '</div></body></html>';
    exit;
}
