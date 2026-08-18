# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-flow.electron.spec.ts >> WindowMini Electron guest flow >> manual capture completes and advances to template selection
- Location: apps/desktop/tests/e2e/guest-flow.electron.spec.ts:56:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /CHỌN MẪU KHUNG/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: /CHỌN MẪU KHUNG/i })

```

```yaml
- main:
  - heading "ĐANG CHỤP ẢNH 1 / 1" [level=3]
  - paragraph: READY → detect 5 ngón / nút chụp → countdown → lưu ảnh gốc
  - text: CAMERA LIVE
  - button "CHỤP" [disabled]
  - text: GALLERY (1/1)
  - img "Captured 1"
```

# Test source

```ts
  1   | import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
  2   | import { expect, test, type TestInfo } from '@playwright/test';
  3   | 
  4   | const MAIN_PROCESS = 'apps/desktop/electron/main/main.cjs';
  5   | 
  6   | test.describe('WindowMini Electron guest flow', () => {
  7   |   let app: ElectronApplication;
  8   |   let page: Page;
  9   |   const consoleEntries: string[] = [];
  10  |   const stepEntries: string[] = [];
  11  | 
  12  |   test.beforeEach(async () => {
  13  |     app = await electron.launch({
  14  |       args: [
  15  |         // Auto-approve getUserMedia in the test Electron window while still using
  16  |         // the real macOS camera device. Do not pass --use-fake-device-for-media-stream;
  17  |         // that Chromium flag produces the green fake camera feed and hides Mac camera bugs.
  18  |         '--use-fake-ui-for-media-stream',
  19  |         '--autoplay-policy=no-user-gesture-required',
  20  |         MAIN_PROCESS,
  21  |       ],
  22  |       env: {
  23  |         ...process.env,
  24  |         WINDOWMINI_RENDERER_URL: 'http://127.0.0.1:5173',
  25  |         ELECTRON_ENABLE_LOGGING: '1',
  26  |       },
  27  |     });
  28  | 
  29  |     page = await app.firstWindow();
  30  |     page.on('console', (message) => {
  31  |       consoleEntries.push(`${message.type()}: ${message.text()}`);
  32  |     });
  33  |     page.on('pageerror', (error) => {
  34  |       consoleEntries.push(`pageerror: ${error.message}`);
  35  |     });
  36  |     page.on('requestfailed', (request) => {
  37  |       consoleEntries.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  38  |     });
  39  |   });
  40  | 
  41  |   test.afterEach(async ({}, testInfo) => {
  42  |     await testInfo.attach('electron-console', {
  43  |       body: consoleEntries.join('\n') || 'No console entries captured.',
  44  |       contentType: 'text/plain',
  45  |     });
  46  |     await testInfo.attach('electron-step-log', {
  47  |       body: stepEntries.join('\n\n') || 'No step entries captured.',
  48  |       contentType: 'text/plain',
  49  |     });
  50  |     await page?.screenshot({ path: testInfo.outputPath('final-state.png'), fullPage: true }).catch(() => undefined);
  51  |     await app?.close().catch(() => undefined);
  52  |     consoleEntries.length = 0;
  53  |     stepEntries.length = 0;
  54  |   });
  55  | 
  56  |   test('manual capture completes and advances to template selection', async ({}, testInfo) => {
  57  |     await expect(page).toHaveURL(/#\/guest/);
  58  |     await expect(page.getByText('CHẠM ĐỂ CHỤP ẢNH')).toBeVisible();
  59  |     await captureStep(page, testInfo, stepEntries, '01-start');
  60  | 
  61  |     await page.getByText('CHẠM ĐỂ CHỤP ẢNH').click();
  62  |     await expect(page.getByRole('heading', { name: /CHỌN KIỂU ẢNH/i })).toBeVisible();
  63  |     await captureStep(page, testInfo, stepEntries, '02-select-shots');
  64  | 
  65  |     await page.getByRole('button', { name: /1 SHOT/i }).click();
  66  |     await captureStep(page, testInfo, stepEntries, '03-shot-selected');
  67  | 
  68  |     await page.getByRole('button', { name: /TIẾP TỤC/i }).click();
  69  |     await expect(page.getByRole('heading', { name: /CHỌN SỐ LƯỢNG IN/i })).toBeVisible();
  70  |     await captureStep(page, testInfo, stepEntries, '04-print-quantity');
  71  | 
  72  |     // The production controller currently debounces navigation for 900ms.
  73  |     // Electron tests wait explicitly so a valid guest tap is not swallowed by the lock.
  74  |     await page.waitForTimeout(1_000);
  75  |     await page.getByRole('button', { name: /TIẾP TỤC/i }).click();
  76  |     await expect(page.getByRole('heading', { name: /ĐANG CHỤP ẢNH 1 \/ 1/i })).toBeVisible();
  77  |     await captureStep(page, testInfo, stepEntries, '05-capture-ready');
  78  | 
  79  |     await attachCameraDiagnostics(page, testInfo, stepEntries, '05-camera-diagnostics');
  80  | 
  81  |     await page.getByRole('button', { name: /^CHỤP$/i }).click();
  82  |     await page.waitForTimeout(250);
  83  |     await captureStep(page, testInfo, stepEntries, '06-countdown-started');
  84  | 
  85  |     await page.waitForTimeout(4_500);
  86  |     await captureStep(page, testInfo, stepEntries, '07-after-capture-wait');
  87  | 
> 88  |     await expect(page.getByRole('heading', { name: /CHỌN MẪU KHUNG/i })).toBeVisible({ timeout: 15_000 });
      |                                                                          ^ Error: expect(locator).toBeVisible() failed
  89  |     await captureStep(page, testInfo, stepEntries, '08-template-selection');
  90  |   });
  91  | });
  92  | 
  93  | async function captureStep(page: Page, testInfo: TestInfo, stepEntries: string[], name: string) {
  94  |   const bodyText = await page.locator('body').innerText().catch((error) => `Unable to read body text: ${String(error)}`);
  95  |   const url = page.url();
  96  |   const title = await page.title().catch(() => 'unknown');
  97  |   const log = [`[${name}]`, `url=${url}`, `title=${title}`, 'visible-text:', bodyText].join('\n');
  98  |   stepEntries.push(log);
  99  |   await testInfo.attach(`${name}.txt`, { body: log, contentType: 'text/plain' });
  100 |   await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  101 | }
  102 | 
  103 | async function attachCameraDiagnostics(page: Page, testInfo: TestInfo, stepEntries: string[], name: string) {
  104 |   const diagnostics = await page.evaluate(async () => {
  105 |     const devices = await navigator.mediaDevices?.enumerateDevices?.().catch((error) => [{ kind: 'error', label: String(error), deviceId: '', groupId: '' }]);
  106 |     const videoElements = Array.from(document.querySelectorAll('video')).map((video) => ({
  107 |       readyState: video.readyState,
  108 |       videoWidth: video.videoWidth,
  109 |       videoHeight: video.videoHeight,
  110 |       paused: video.paused,
  111 |       ended: video.ended,
  112 |       hasSrcObject: Boolean(video.srcObject),
  113 |     }));
  114 |     return {
  115 |       hasMediaDevices: Boolean(navigator.mediaDevices),
  116 |       deviceCount: devices?.length ?? 0,
  117 |       devices: devices?.map((device) => ({ kind: device.kind, label: device.label, deviceId: device.deviceId ? '[redacted]' : '', groupId: device.groupId ? '[redacted]' : '' })) ?? [],
  118 |       videoElements,
  119 |     };
  120 |   });
  121 |   const log = `[${name}]\n${JSON.stringify(diagnostics, null, 2)}`;
  122 |   stepEntries.push(log);
  123 |   await testInfo.attach(`${name}.json`, { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
  124 | }
  125 | 
```