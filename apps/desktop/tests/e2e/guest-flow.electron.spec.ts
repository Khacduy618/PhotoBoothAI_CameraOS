import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { expect, test, type TestInfo } from '@playwright/test';

const MAIN_PROCESS = 'apps/desktop/electron/main/main.cjs';

test.describe('WindowMini Electron guest flow', () => {
  let app: ElectronApplication;
  let page: Page;
  const consoleEntries: string[] = [];
  const stepEntries: string[] = [];

  test.beforeEach(async () => {
    app = await electron.launch({
      args: [MAIN_PROCESS],
      env: {
        ...process.env,
        WINDOWMINI_RENDERER_URL: 'http://127.0.0.1:5174',
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    page = await app.firstWindow();
    page.on('console', (message) => {
      consoleEntries.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      consoleEntries.push(`pageerror: ${error.message}`);
    });
    page.on('requestfailed', (request) => {
      consoleEntries.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    await testInfo.attach('electron-console', {
      body: consoleEntries.join('\n') || 'No console entries captured.',
      contentType: 'text/plain',
    });
    await testInfo.attach('electron-step-log', {
      body: stepEntries.join('\n\n') || 'No step entries captured.',
      contentType: 'text/plain',
    });
    await page?.screenshot({ path: testInfo.outputPath('final-state.png'), fullPage: true }).catch(() => undefined);
    await app?.close().catch(() => undefined);
    consoleEntries.length = 0;
    stepEntries.length = 0;
  });

  test('start and enabled shot format selection are readiness-aware', async ({}, testInfo) => {
    await expect(page).toHaveURL(/#\/guest/);
    await expect(page.getByText(/Sẵn sàng chụp ảnh|Bạn vẫn có thể bắt đầu/i)).toBeVisible();
    await expect(page.getByText('CHẠM ĐỂ CHỤP ẢNH')).toBeVisible();
    await captureStep(page, testInfo, stepEntries, 'm2-01-ready-start');

    await page.getByText('CHẠM ĐỂ CHỤP ẢNH').click();
    await expect(page.getByRole('heading', { name: /CHỌN LOẠI ẢNH BẠN MUỐN IN|CHỌN KIỂU ẢNH/i })).toBeVisible();
    await expect(page.getByText(/Photo Strip 4 Ô|Strip 4/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /TIẾP TỤC BẮT ĐẦU CHỤP|TIẾP TỤC/i })).toBeEnabled();
    await captureStep(page, testInfo, stepEntries, 'm2-02-select-product');

    await page.getByText(/Photo Strip 2 Ô|Strip 2/i).first().click();
    await expect(page.getByRole('button', { name: /TIẾP TỤC BẮT ĐẦU CHỤP|TIẾP TỤC/i })).toBeEnabled();
    await captureStep(page, testInfo, stepEntries, 'm2-03-product-selected');
  });

});

async function captureStep(page: Page, testInfo: TestInfo, stepEntries: string[], name: string) {
  const bodyText = await page.locator('body').innerText().catch((error) => `Unable to read body text: ${String(error)}`);
  const url = page.url();
  const title = await page.title().catch(() => 'unknown');
  const log = [`[${name}]`, `url=${url}`, `title=${title}`, 'visible-text:', bodyText].join('\n');
  stepEntries.push(log);
  await testInfo.attach(`${name}.txt`, { body: log, contentType: 'text/plain' });
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

