/**
 * Canon Camera Runtime Lifecycle & Platform Resolver
 * Handles platform-specific binary resolution, EDSDK framework discovery,
 * system contention detection, and stale lock recovery.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function resolveBridgeBinary() {
  const envBridge = process.env.MOMENTAI_CANON_BRIDGE_PATH || process.env.CANON_BRIDGE_PATH;
  if (envBridge && fs.existsSync(envBridge)) {
    return {
      path: path.resolve(envBridge),
      source: 'ENV_CANON_BRIDGE_PATH',
      platform: process.platform,
      arch: process.arch,
    };
  }

  const projectRoot = path.resolve(__dirname, '../../..');
  const isWindows = process.platform === 'win32';
  const binaryNames = isWindows
    ? ['canon_bridge_win32.exe', 'canon_bridge_win.exe']
    : ['canon_bridge_mac'];

  const candidatePaths = [];
  for (const bName of binaryNames) {
    candidatePaths.push(path.join(projectRoot, 'apps/desktop/electron/main/camera/canon/bin', bName));
    candidatePaths.push(path.join(__dirname, 'bin', bName));
    candidatePaths.push(path.join(projectRoot, 'vendor/canon/bin', bName));
  }

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return {
        path: candidate,
        source: 'PROJECT_VENDOR_LOCATION',
        platform: process.platform,
        arch: process.arch,
      };
    }
  }

  return {
    path: candidatePaths[0],
    source: 'FALLBACK_NOT_FOUND',
    platform: process.platform,
    arch: process.arch,
  };
}

function resolveEdsdkPath() {
  const envEdsdk = process.env.MOMENTAI_EDSDK_PATH || process.env.CANON_EDSDK_PATH;
  if (envEdsdk && fs.existsSync(envEdsdk)) {
    return {
      path: path.resolve(envEdsdk),
      source: 'ENV_CANON_EDSDK_PATH',
    };
  }

  const projectRoot = path.resolve(__dirname, '../../..');
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const winCandidates = [
      'C:\\Program Files (x86)\\Canon\\EOS Utility\\EU3\\EDSDK.dll',
      'C:\\Program Files (x86)\\Canon\\EOS Utility\\EDSDK.dll',
      'C:\\Program Files\\Canon\\EOS Utility\\EU3\\EDSDK.dll',
      'C:\\Program Files\\Canon\\EOS Utility\\EDSDK.dll',
      path.join(projectRoot, 'apps/desktop/electron/main/camera/canon/bin/EDSDK.dll'),
      path.join(projectRoot, 'vendor/canon/bin/EDSDK.dll'),
    ];
    for (const c of winCandidates) {
      if (fs.existsSync(c)) {
        return { path: c, source: c.includes('Program Files') ? 'LOCAL_EOS_UTILITY_FALLBACK' : 'PROJECT_VENDOR_LOCATION' };
      }
    }
    return { path: winCandidates[0], source: 'DEFAULT_WINDOWS' };
  }

  // macOS candidate frameworks
  const macCandidates = [
    '/Applications/Canon Utilities/EOS Utility/EU3/EOS Utility 3.app/Contents/Frameworks/EDSDK.framework/Versions/A/EDSDK',
    '/Applications/Canon Utilities/EOS Utility/EOS Utility.app/Contents/Frameworks/EDSDK.framework/Versions/A/EDSDK',
    '/Library/Frameworks/EDSDK.framework/Versions/A/EDSDK',
    path.join(projectRoot, 'apps/desktop/electron/main/camera/canon/bin/EDSDK.framework/Versions/A/EDSDK'),
  ];

  for (const c of macCandidates) {
    if (fs.existsSync(c)) {
      return { path: c, source: c.includes('Applications') ? 'LOCAL_EOS_UTILITY_FALLBACK' : 'SYSTEM_FRAMEWORK' };
    }
  }

  return { path: macCandidates[0], source: 'DEFAULT_MACOS' };
}

function checkSystemContention() {
  if (process.platform === 'darwin') {
    try {
      const stdout = execSync('ps -eo comm', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('EOS Utility') || line.includes('PTPCamera') || line.includes('ptpcamerad') || line.includes('Photos')) {
          return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  if (process.platform === 'win32') {
    try {
      const stdout = execSync('tasklist /NH', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      if (/EOS Utility|EOSUPNPSV|EOS Web/i.test(stdout)) {
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  return false;
}

module.exports = {
  resolveBridgeBinary,
  resolveEdsdkPath,
  checkSystemContention,
};
