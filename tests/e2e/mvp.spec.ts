import { test, expect } from '@playwright/test';
import { formatNumber, metricValue, MVP_METRICS, MVP_PLAYER_IDS } from '../../lib/mvp';
import type { Player } from '../../types/players';

test('home → recruitment → profile → saved shortlist → comparison', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('.home-actions a')).toHaveCount(3);
  await expect(page.locator('.player-card')).toHaveCount(10);
  await expect(page.locator('nav a')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.getByRole('heading', { name: 'Подобрать усиление', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Подбор игрока', exact: true })).toBeVisible();
  const candidate = testInfo.project.name === 'mobile'
    ? page.locator('.mobile-player-list .player-card').first()
    : page.locator('.player-table .player-link').first();
  await candidate.click();
  await expect(page.getByRole('heading', { name: 'Ключевые показатели' })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить в избранное', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Удалить из избранного' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('profile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Сравнить', exact: true }).click();
  await expect(page.locator('.comparison-table')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить в избранное', exact: true }).click();
  await page.getByRole('link', { name: 'Избранное', exact: true }).click();
  await expect(page.locator('.saved-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.saved-row')).toHaveCount(2);
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('link', { name: 'Сравнить выбранных' }).click();
  await expect(page.locator('.compare-identities .identity')).toHaveCount(2);
  await expect(page.locator('svg[role="img"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('comparison.png'), fullPage: true });
  await page.getByRole('link', { name: 'Избранное', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить из избранного' }).first().click();
  await expect(page.locator('.saved-row')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.saved-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('name search and all filters reset to ten players', async ({ page }, testInfo) => {
  await page.goto('/players');
  const result = page.locator('.roster-results [aria-live]');
  await expect(result).toHaveText('Найдено: 10 из 10');
  await page.getByLabel('Поиск по имени').fill('Ljupche');
  await expect(result).toHaveText('Найдено: 1 из 10');
  await page.locator('.roster-filters summary').click();
  await page.getByLabel('Максимальная стоимость, €').fill('0');
  await expect(result).toHaveText('Найдено: 0 из 10');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(result).toHaveText('Найдено: 10 из 10');
  await expect(page.getByLabel('Поиск по имени')).toHaveValue('');
  await expect(page.getByLabel('Максимальная стоимость, €')).toHaveValue('');
  await page.getByLabel('Максимальный возраст').fill('23');
  await expect(result).toHaveText('Найдено: 1 из 10');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await page.screenshot({ path: testInfo.outputPath('players.png'), fullPage: true });
});

test('player selection, cached photos and comparison reflect existing data', async ({ page, request }, testInfo) => {
  const players: Player[] = await (await request.get('/api/mvp/players')).json();
  await page.goto('/players');
  await expect(page.locator('.players-profile h2').first()).toHaveText(players[0].name.ru);
  const photo = page.locator('.players-profile .identity img');
  await expect(photo).toHaveAttribute('src', '/players/sofascore/573710.jpg');
  await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.roster-item').nth(4).click();
  await expect(page.locator('.players-profile h2').first()).toHaveText(players[4].name.ru);
  await page.getByLabel('Сравнить с').selectOption(players[6].id);
  await expect(page.locator('.comparison-panel .compare-identities .identity')).toHaveCount(2);
  await expect(page.locator('.players-profile .metric')).toHaveCount(8);
  for (const metric of MVP_METRICS) {
    const row = page.locator(`.comparison-panel [data-metric="${metric.key}"]`);
    await expect(row.locator('.bar-value.left')).toHaveText(formatNumber(metricValue(players[4], metric.key), metric.decimals));
    await expect(row.locator('.bar-value.right')).toHaveText(formatNumber(metricValue(players[6], metric.key), metric.decimals));
  }
  await page.screenshot({ path: testInfo.outputPath('players-selected.png'), fullPage: true });
  await page.getByRole('link', { name: 'Открыть сравнение' }).click();
  await expect(page).toHaveURL(new RegExp(`a=${players[4].id}&b=${players[6].id}`));
  await page.goto('/players');
  await page.getByRole('button', { name: 'Очистить', exact: true }).click();
  await expect(page.locator('.compare-placeholder')).toBeVisible();
  await expect(page.locator('.comparison-panel .bar-comparison')).toHaveCount(0);
  await page.getByLabel('Быстрый поиск игрока').fill('Ljupche');
  await page.getByLabel('Быстрый поиск игрока').press('Enter');
  await expect(page.locator('.roster-results [aria-live]')).toHaveText('Найдено: 1 из 10');
});

test('unavailable player photo uses a neutral placeholder', async ({ page }) => {
  await page.route('**/players/sofascore/573710.jpg', route => route.abort());
  await page.goto(`/players/${MVP_PLAYER_IDS[0]}`);
  await expect(page.locator('.identity.large .avatar-placeholder')).toBeVisible();
  await expect(page.locator('.identity.large img')).toHaveCount(0);
  await expect(page.locator('.identity.large .avatar-placeholder')).toContainText('LD');
});

test('club roster leads to recruitment excluding its own players', async ({ page }) => {
  await page.goto('/teams/sogdiyona');
  await expect(page.locator('.team-table tbody tr')).toHaveCount(2);
  await page.getByRole('link', { name: 'Найти усиление' }).click();
  await expect(page.locator('.notice')).toContainText('Sogdiyona');
  await expect(page.locator('.section-heading [aria-live]')).toHaveText('Найдено: 8 из 10');
  await page.getByLabel('Минимум минут').fill('1100');
  await expect(page.locator('.section-heading [aria-live]')).toHaveText('Найдено: 1 из 10');
});

test('MVP API and every player route are usable offline', async ({ request }) => {
  const response = await request.get('/api/mvp/players');
  expect(response.status()).toBe(200);
  const players = await response.json();
  expect(players.map((player: { id: string }) => player.id)).toEqual([...MVP_PLAYER_IDS]);
  for (const id of MVP_PLAYER_IDS) {
    const profile = await request.get(`/players/${id}`);
    expect(profile.status()).toBe(200);
    expect(await profile.text()).toContain('Ключевые показатели');
  }
  expect((await request.get('/players/unknown')).status()).toBe(404);
  expect((await request.get('/teams/unknown')).status()).toBe(404);
});

test('corrupt shortlist stays untouched and saving is disabled', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('uzstat.mvp.shortlist.v1', 'broken'));
  await page.goto(`/players/${MVP_PLAYER_IDS[0]}`);
  // Force a fresh root provider read after deliberately changing browser storage.
  await page.reload();
  await expect(page.locator('main [role="alert"]')).toContainText('Данные в браузере сохранены без изменений');
  await expect(page.getByRole('button', { name: 'Добавить в избранное' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('uzstat.mvp.shortlist.v1'))).toBe('broken');
});

test('main pages fit the viewport without horizontal document overflow', async ({ page }) => {
  for (const route of ['/', '/players', '/teams', '/teams/sogdiyona', '/recruitment', '/shortlist', `/players/${MVP_PLAYER_IDS[0]}`, '/compare']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  }
});
