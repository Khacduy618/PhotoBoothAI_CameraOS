const { CanonRuntimeClient } = require('../apps/desktop/camera-runtime/canon-runtime-client.cjs');

async function main() {
  console.log('=== TESTING ISOLATED NODE CANON RUNTIME CLIENT ===');
  const client = new CanonRuntimeClient();

  let frames = 0;
  client.on('liveViewFrame', (frame) => {
    frames++;
    if (frames === 1 || frames === 10) {
      console.log(`[CLIENT_EVF_FRAME] #${frames}: seq=${frame.seq}, ${frame.width}x${frame.height}, size=${frame.size} bytes`);
    }
  });

  client.on('stateChanged', (evt) => {
    console.log('[CLIENT_STATE_CHANGED]', evt);
  });

  console.log('1. Starting runtime client...');
  const ok = await client.start();
  console.log('Client start result:', ok, 'state:', client.state, 'model:', client.cameraModel);

  if (ok && client.cameraCount > 0) {
    console.log('2. Starting Live View...');
    await client.startLiveView();
    console.log('3. Streaming Live View for 2.5s...');
    await new Promise((r) => setTimeout(r, 2500));
    console.log(`Total EVF frames received by client: ${frames}`);
    console.log('4. Stopping Live View...');
    await client.stopLiveView();
  }

  console.log('5. Shutting down client...');
  await client.shutdown();
  console.log('=== TEST COMPLETED ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal client test error:', err);
  process.exit(1);
});
