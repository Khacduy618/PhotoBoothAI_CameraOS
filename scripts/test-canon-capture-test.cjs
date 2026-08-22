const { CanonRuntimeClient } = require('../apps/desktop/camera-runtime/canon-runtime-client.cjs');
const fs = require('fs');

async function main() {
  console.log('=== TESTING REAL CANON SHUTTER CAPTURE & JPEG DOWNLOAD ===');
  const client = new CanonRuntimeClient();

  client.on('liveViewFrame', (frame) => {
    if (frame.seq === 1) console.log(`[EVF] LiveView streaming active: ${frame.width}x${frame.height}`);
  });

  client.on('stateChanged', (evt) => {
    console.log('[STATE]', evt.from, '->', evt.to);
  });

  client.on('captureStarted', (evt) => {
    console.log('[EVENT: captureStarted]', evt);
  });

  client.on('shutterDone', (evt) => {
    console.log('[EVENT: shutterDone]', evt);
  });

  client.on('objectCreated', (evt) => {
    console.log('[EVENT: objectCreated]', evt);
  });

  client.on('downloadCompleted', (evt) => {
    console.log('[EVENT: downloadCompleted]', evt);
  });

  client.on('bridgeError', (err) => {
    console.error('[EVENT: bridgeError]', err);
  });

  console.log('1. Starting runtime client...');
  const ok = await client.start();
  console.log('Client start:', ok, 'state:', client.state, 'model:', client.cameraModel);

  if (ok && client.cameraCount > 0) {
    console.log('2. Starting Live View (1.5s)...');
    await client.startLiveView();
    await new Promise((r) => setTimeout(r, 1500));

    console.log('3. Triggering REAL physical capture shot #1...');
    const targetPath = '/tmp/canon_real_shot1.jpg';
    try {
      const result = await client.capture({
        sessionId: 'test_real_capture_session',
        shotIndex: 1,
        targetPath,
      });
      console.log('CAPTURE SUCCESSFUL:', result);
      if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        console.log(`PERSISTED JPEG: ${targetPath} (${stats.size} bytes)`);
      }
    } catch (e) {
      console.error('Capture failed:', e);
    }

    console.log('4. Stopping Live View...');
    await client.stopLiveView();
  }

  console.log('5. Shutting down...');
  await client.shutdown();
  console.log('=== TEST COMPLETED ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
