/**
 * MomentAI CameraOS — Canon EOS 6D Windows 10 x64 Real Hardware Standalone Test
 * Tests canon_bridge_win32.exe without requiring Electron UI.
 */

const { CanonCameraBridgeManager } = require('../apps/desktop/electron/main/camera/canon-camera-bridge.cjs');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('========================================================');
console.log('   CANON EOS 6D REAL WINDOWS HARDWARE ACCEPTANCE TEST');
console.log('========================================================');

// 1. Windows PnP Device Diagnostic
console.log('\n[1. Windows PnP Device Inspection]');
try {
  const pnpOut = execSync('powershell -Command "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -like \'*Canon*\' -or $_.InstanceId -like \'*04A9*\' } | Select-Object FriendlyName, InstanceId, Status, Class | Format-Table -AutoSize"', { encoding: 'utf8', timeout: 5000 });
  console.log(pnpOut.trim() || 'No Canon PnP device detected via PowerShell.');
} catch (e) {
  console.log('PnP PowerShell query skipped or failed.');
}

// 2. Contention / Running Software Status
console.log('\n[2. Contention / Canon Process Status]');
try {
  const taskOut = execSync('tasklist /NH', { encoding: 'utf8', timeout: 3000 });
  const lines = taskOut.split('\n').filter(l => /EOS Utility|EOSUPNPSV|EOS Web/i.test(l));
  if (lines.length > 0) {
    console.warn('WARNING: Competing Canon software running:\n' + lines.join('\n'));
  } else {
    console.log('No competing Canon software running.');
  }
} catch (e) {
  // ignore
}

// 3. Initialize CanonCameraBridgeManager with Win32 binary
console.log('\n[3. Initializing Bridge Manager]');
const win32Binary = path.resolve(__dirname, '../apps/desktop/electron/main/camera/canon/bin/canon_bridge_win32.exe');
const bridge = new CanonCameraBridgeManager({ binaryPath: win32Binary });

let evfFrameCount = 0;
let lastFrameInfo = null;
let captureCompletedInfo = null;
const frameTimestamps = [];

bridge.on('stateChanged', (evt) => {
  console.log(`[BRIDGE_STATE_CHANGED] ${evt.state}`);
});

bridge.on('ready', (evt) => {
  console.log('[EVENT: bridgeReady]', JSON.stringify(evt));
});

bridge.on('initialized', (evt) => {
  console.log('[EVENT: initialized]', JSON.stringify(evt));
});

bridge.on('cameraDiscovered', (evt) => {
  console.log('[EVENT: cameraDiscovered]', JSON.stringify(evt));
});

bridge.on('sessionOpened', (evt) => {
  console.log('[EVENT: sessionOpened]', JSON.stringify(evt));
});

bridge.on('liveViewStarted', (evt) => {
  console.log('[EVENT: liveViewStarted]', JSON.stringify(evt));
});

bridge.on('liveViewFrame', (frame) => {
  evfFrameCount++;
  frameTimestamps.push(Date.now());
  lastFrameInfo = {
    seq: frame.seq,
    width: frame.width,
    height: frame.height,
    size: frame.size,
  };
  if (evfFrameCount === 1 || evfFrameCount % 20 === 0) {
    console.log(`[EVF_FRAME] #${evfFrameCount}: seq=${frame.seq}, ${frame.width}x${frame.height}, size=${frame.size} bytes`);
  }
});

bridge.on('downloadCompleted', (info) => {
  console.log('[EVENT: downloadCompleted]', JSON.stringify(info));
  captureCompletedInfo = info;
});

bridge.on('bridgeError', (err) => {
  console.error('[EVENT: bridgeError]', JSON.stringify(err));
});

bridge.on('error', (err) => {
  console.error('[EVENT: error]', err);
});

async function run() {
  const t0 = Date.now();
  console.log('\n[4. Starting Canon Win32 Bridge...]');
  const ok = await bridge.start();
  const elapsed = Date.now() - t0;
  console.log(`\n[5. Bridge Start Result]: ok=${ok}, state=${bridge.state}, count=${bridge.cameraCount}, model=${bridge.cameraModel} (${elapsed}ms)`);

  if (!ok || bridge.cameraCount === 0) {
    console.error('Camera not discovered or bridge failed to start. Aborting test.');
    await bridge.shutdown();
    process.exit(1);
  }

  // 6. LiveView test for 3 seconds
  console.log('\n[6. Starting Live View Stream (3 seconds)...]');
  await bridge.startLiveView();
  const lvStart = Date.now();
  await new Promise(r => setTimeout(r, 3000));
  const lvElapsedSec = (Date.now() - lvStart) / 1000;
  const fps = (evfFrameCount / lvElapsedSec).toFixed(2);
  console.log(`LiveView collected ${evfFrameCount} frames in ${lvElapsedSec.toFixed(2)}s (~${fps} FPS)`);

  // Compute intervals
  let maxGapMs = 0;
  for (let i = 1; i < frameTimestamps.length; i++) {
    const gap = frameTimestamps[i] - frameTimestamps[i - 1];
    if (gap > maxGapMs) maxGapMs = gap;
  }

  // 7. Single Still Photo Capture
  console.log('\n[7. Executing Single Test Capture...]');
  const targetPath = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `test_canon_${Date.now()}.jpg`);
  console.log(`Target JPEG path: ${targetPath}`);

  await bridge.sendCommand({
    command: 'capture',
    targetPath: targetPath,
    shotIndex: 1,
  });

  console.log('Waiting for physical capture & JPEG transfer...');
  const capTimeout = Date.now() + 15000;
  while (!captureCompletedInfo && Date.now() < capTimeout) {
    await new Promise(r => setTimeout(r, 100));
  }

  let sha256 = 'N/A';
  let measuredWidth = 0;
  let measuredHeight = 0;
  let measuredBytes = 0;

  if (fs.existsSync(targetPath)) {
    measuredBytes = fs.statSync(targetPath).size;
    const fileBuf = fs.readFileSync(targetPath);
    sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    measuredWidth = captureCompletedInfo?.width || 0;
    measuredHeight = captureCompletedInfo?.height || 0;
    console.log(`[VERIFY_JPEG] File exists: ${targetPath} (${measuredBytes} bytes, SHA256: ${sha256.substring(0, 16)}...)`);
  } else {
    console.error('[VERIFY_JPEG] Error: Captured JPEG file not found at ' + targetPath);
  }

  // 8. Stopping LiveView and Teardown
  console.log('\n[8. Stopping Live View and Shutting Down Bridge]');
  await bridge.stopLiveView();
  await bridge.shutdown();

  console.log('\n========================================================');
  console.log('       WINDOWS REAL HARDWARE ACCEPTANCE SUMMARY');
  console.log('========================================================');
  console.log(`CAMERA_MODEL                 = ${bridge.cameraModel || 'N/A'}`);
  console.log(`CAMERA_COUNT                 = ${bridge.cameraCount}`);
  console.log(`EVF_FRAME_COUNT              = ${evfFrameCount}`);
  console.log(`EVF_EFFECTIVE_FPS            = ${fps}`);
  console.log(`EVF_MAX_GAP_MS               = ${maxGapMs}`);
  console.log(`CAPTURE_SUCCESS              = ${captureCompletedInfo ? 'YES' : 'NO'}`);
  console.log(`JPEG_WIDTH                   = ${measuredWidth}`);
  console.log(`JPEG_HEIGHT                  = ${measuredHeight}`);
  console.log(`JPEG_BYTES                   = ${measuredBytes}`);
  console.log(`JPEG_SHA256                  = ${sha256}`);
  console.log(`FINAL_BRIDGE_STATE           = ${bridge.state}`);
  console.log('========================================================\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
