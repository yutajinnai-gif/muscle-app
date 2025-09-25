// tests/smoke.spec.js
const { test, expect } = require('@playwright/test');
test('起動→タブ遷移→エラーなし', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (m) => m.type()==='error' && consoleErrors.push(m.text()));
  await page.goto('/index.html');
  await expect(page.locator('h1')).toContainText(/筋トレメモ/);
  for (const n of ['ホーム','履歴','設定']) {
    await expect(page.getByRole('button', { name: n })).toBeVisible();
  }
  await page.getByRole('button', { name: '履歴' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  if (await page.locator('#errbar').isVisible()) {
    const text = await page.locator('#errbar').innerText();
    throw new Error('画面エラー: ' + text);
  }
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});