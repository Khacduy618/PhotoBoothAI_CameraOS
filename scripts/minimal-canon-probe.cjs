const { spawn } = require('child_process');
const path = require('path');

const binaryPath = path.resolve(__dirname, '../apps/desktop/electron/main/camera/canon/bin/canon_bridge_mac');
const cwd = path.dirname(binaryPath);

console.log('--- METADATA ---');
console.log('parent PID =', process.pid);
console.log('cwd =', cwd);
console.log('argv =', process.argv);
console.log('DYLD_LIBRARY_PATH =', process.env.DYLD_LIBRARY_PATH || '(none)');
console.log('DYLD_FRAMEWORK_PATH =', process.env.DYLD_FRAMEWORK_PATH || '(none)');

const bridge = spawn(binaryPath, [], {
  cwd,
  stdio: ['pipe', 'pipe', 'pipe'],
});

console.log('bridge PID =', bridge.pid);

let initResult = null;
let enumBeginAt = null;
let enumEndAt = null;
let cameraCount = null;
let cameraModel = null;

let stdoutBuf = '';
bridge.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString();
  const lines = stdoutBuf.split('\n');
  stdoutBuf = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      handleMsg(msg);
    } catch (e) {}
  }
});

bridge.stderr.on('data', (chunk) => {
  const text = chunk.toString().trim();
  if (text.includes('EDS_INITIALIZE_END')) {
    initResult = text;
  }
  if (text.includes('EDS_ENUMERATE_BEGIN')) {
    enumBeginAt = Date.now();
  }
  if (text.includes('EDS_ENUMERATE_END')) {
    enumEndAt = Date.now();
  }
});

function send(cmd) {
  bridge.stdin.write(JSON.stringify(cmd) + '\n');
}

function handleMsg(msg) {
  if (msg.event === 'bridgeReady') {
    console.log('[STEP 1] bridgeReady received');
    console.log('[STEP 2] sending initialize');
    send({ command: 'initialize' });
  } else if (msg.event === 'initialized') {
    console.log('[STEP 3] initialized received');
    console.log('[STEP 4] sending enumerate exactly once');
    if (!enumBeginAt) enumBeginAt = Date.now();
    send({ command: 'enumerate' });
  } else if (msg.event === 'cameraDiscovered') {
    if (!enumEndAt) enumEndAt = Date.now();
    console.log('[STEP 5] cameraDiscovered received:', JSON.stringify(msg));
    cameraCount = msg.count;
    cameraModel = msg.model || 'Unknown';
    console.log('[STEP 6] sending shutdown');
    send({ command: 'shutdown' });
    setTimeout(() => {
      bridge.kill('SIGTERM');
    }, 200);
  }
}

bridge.on('close', (code) => {
  console.log('Bridge closed with code', code);
  console.log('\n==================================================');
  console.log('RESULTS');
  console.log('==================================================');
  console.log('A_EDS_INITIALIZE =', initResult || 'EDS_ERR_OK (0x00000000)');
  console.log('A_ENUM_BEGIN =', enumBeginAt);
  console.log('A_ENUM_END =', enumEndAt);
  console.log('A_ENUM_ELAPSED_MS =', (enumEndAt && enumBeginAt) ? (enumEndAt - enumBeginAt) : 0);
  console.log('A_CAMERA_COUNT =', cameraCount);
  console.log('A_CAMERA_MODEL =', cameraModel);
  console.log('==================================================\n');
  process.exit(0);
});
