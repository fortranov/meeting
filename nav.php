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

    $pbWidget = '<div class="pb-search" id="pbSearch">'
        . '<div class="pb-search-box">'
        .   '<input type="text" class="pb-search-input" id="pbInput"'
        .     ' placeholder="Поиск по справочнику…" autocomplete="off" spellcheck="false" />'
        .   '<button class="pb-clear-btn" id="pbClear" title="Очистить" aria-label="Очистить" hidden>'
        .     '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
        .       '<path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
        .     '</svg>'
        .   '</button>'
        .   '<button class="pb-search-btn" id="pbBtn" title="Найти" aria-label="Найти">'
        .     '<svg width="15" height="15" viewBox="0 0 15 15" fill="none">'
        .       '<circle cx="6" cy="6" r="4.2" stroke="currentColor" stroke-width="1.7"/>'
        .       '<path d="M9.5 9.5l3.2 3.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
        .     '</svg>'
        .   '</button>'
        . '</div>'
        . '<div class="pb-dropdown" id="pbDropdown" hidden></div>'
        . '</div>'
        . '<script src="phonebook.js" defer></script>';

    return '<nav>' . implode('', $links) . '</nav>' . $pbWidget;
}
