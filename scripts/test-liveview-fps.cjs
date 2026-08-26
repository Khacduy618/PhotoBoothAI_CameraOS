const { CanonRuntimeClient } = require('../apps/desktop/camera-runtime/canon-runtime-client.cjs');

async function main() {
  console.log('=== TESTING LIVEVIEW FPS AND CONTINUOUS STREAMING ===');
  const client = new CanonRuntimeClient();
  let frameCount = 0;
  let firstFrameTime = 0;
  let lastFrameTime = 0;

  client.on('liveViewFrame', (frame) => {
    frameCount++;
    const now = Date.now();
    if (frameCount === 1) {
      firstFrameTime = now;
      console.log(`[EVF] First frame: seq=${frame.seq}, size=${frame.size}, ${frame.width}x${frame.height}`);
    }
    const delta = lastFrameTime > 0 ? now - lastFrameTime : 0;
    lastFrameTime = now;
    if (frameCount % 10 === 0 || frameCount <= 5) {
      console.log(`[EVF] Frame #${frameCount}: seq=${frame.seq}, delta=${delta}ms, total=${(now - firstFrameTime)/1000}s`);
    }
  });

  console.log('1. Starting runtime client...');
  await client.start();
  console.log('State:', client.state, 'Camera:', client.cameraModel);

  console.log('2. Starting LiveView...');
  await client.startLiveView();
  console.log('LiveView started. Streaming for 5 seconds...');

  await new Promise((r) => setTimeout(r, 5000));

  console.log(`3. Total frames received in 5s: ${frameCount} (Average FPS: ${(frameCount / 5).toFixed(1)})`);

  console.log('4. Stopping LiveView...');
  await client.stopLiveView();
  await client.shutdown();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
