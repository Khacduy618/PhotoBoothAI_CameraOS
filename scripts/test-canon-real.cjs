const { CanonCameraBridgeManager } = require('../apps/desktop/electron/main/camera/canon-camera-bridge.cjs');
const { execSync } = require('child_process');

console.log('========================================================');
console.log('   CANON REAL HARDWARE TEST VIA NODE.JS RUNTIME');
console.log('========================================================');

// 1. USB Bus Inspection
console.log('\n[1. USB Hardware Status]');
try {
  const usbOut = execSync('ioreg -p IOUSB -w0 -l | grep -B 2 -A 8 "Canon Digital Camera"', { encoding: 'utf8' });
  console.log(usbOut.trim());
} catch (e) {
  console.log('Canon USB device not found in IORegistry.');
}

// 2. System Processes & PTP Daemon Status
console.log('\n[2. Contention / System Daemon Status]');
try {
  const psOut = execSync('ps -eo comm | grep -E "EOS Utility|PTPCamera|ptpcamerad|Photos|photoanalysisd" | grep -v grep', { encoding: 'utf8' });
  console.log('Running camera/photo processes:\n' + psOut.trim());
} catch (e) {
  console.log('No competing camera/photo apps running.');
}

// 3. Initialize CanonCameraBridgeManager
console.log('\n[3. Initializing CanonCameraBridgeManager]');
const bridge = new CanonCameraBridgeManager();
let frameCount = 0;
let lastFrameInfo = null;

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
  frameCount++;
  lastFrameInfo = {
    seq: frame.seq,
    width: frame.width,
    height: frame.height,
    size: frame.size,
  };
  if (frameCount === 1 || frameCount % 15 === 0) {
    console.log(`[EVF_FRAME] Frame #${frameCount}: seq=${frame.seq}, ${frame.width}x${frame.height}, size=${frame.size} bytes`);
  }
});

bridge.on('bridgeError', (err) => {
  console.error('[EVENT: bridgeError]', JSON.stringify(err));
});

bridge.on('error', (err) => {
  console.error('[EVENT: error]', err);
});

bridge.on('disconnected', (evt) => {
  console.log('[EVENT: disconnected]', JSON.stringify(evt));
});

async function run() {
  const t0 = Date.now();
  console.log('\n[4. Starting Canon Bridge...]');
  const ok = await bridge.start();
  const elapsed = Date.now() - t0;
  console.log(`\n[5. Bridge Start Result]: ok=${ok}, state=${bridge.state}, cameraCount=${bridge.cameraCount}, cameraModel=${bridge.cameraModel} (took ${elapsed}ms)`);

  if (ok && bridge.cameraCount > 0) {
    console.log('\n[6. Starting Live View (EVF Stream)...]');
    await bridge.startLiveView();
    console.log('Collecting EVF frames for 3 seconds...');
    await new Promise((r) => setTimeout(r, 3000));
    console.log(`Total EVF frames received in 3s: ${frameCount}`);
    if (lastFrameInfo) {
      console.log('Latest frame metadata:', JSON.stringify(lastFrameInfo));
    }
    console.log('Stopping Live View...');
    await bridge.stopLiveView();
  }

  console.log('\n[7. Shutting down bridge]');
  await bridge.shutdown();

  console.log('\n========================================================');
  console.log('                   TEST SUMMARY REPORT');
  console.log('========================================================');
  console.log(`CANON_USB_VISIBLE         = ${bridge.cameraCount > 0 ? 'YES' : 'CHECK_IOREG'}`);
  console.log(`CANON_ENUM_RESULT         = ${bridge.lastEnumResult}`);
  console.log(`CANON_ENUM_COUNT          = ${bridge.lastEnumCount}`);
  console.log(`CANON_ENUM_ELAPSED_MS     = ${bridge.lastEnumElapsedMs}`);
  console.log(`FINAL_BRIDGE_STATE        = ${bridge.state}`);
  console.log(`EVF_FRAME_COUNT           = ${frameCount}`);
  console.log('========================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
