<?php
declare(strict_types=1);

/**
 * Render the main navigation bar with plan pages.
 *
 * @param string $activeSlug  One of: 'planpage_1', 'planpage_2', ... 'duty', 'vacation', 'dashboard', 'settings', or ''
 */
function renderPlanPageNav(string $activeSlug = ''): string
{
    $links = [];

    try {
        $pages = db()->query('SELECT id, menu_title FROM plan_page ORDER BY sort_order, id')->fetchAll();
        foreach ($pages as $p) {
            $href   = 'planpage.php?id=' . (int)$p['id'];
            $active = ($activeSlug === 'planpage_' . (int)$p['id']) ? ' class="active"' : '';
            $links[] = '<a href="' . htmlspecialchars($href) . '"' . $active . '>'
                . htmlspecialchars($p['menu_title']) . '</a>';
        }
    } catch (\Throwable) {
        // plan_page table doesn't exist yet (fresh install before migration)
    }

    $dutyActive    = $activeSlug === 'duty'     ? ' class="active"' : '';
    $vacationActive = $activeSlug === 'vacation' ? ' class="active"' : '';

    $links[] = '<a href="duty.php"' . $dutyActive . '>График дежурств</a>';
    $links[] = '<a href="vacation.php"' . $vacationActive . '>График отпусков</a>';

    return '<nav>' . implode('', $links) . '</nav>';
}
