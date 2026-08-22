/**
 * Canon Camera Runtime Lifecycle & Platform Resolver
 * Handles platform-specific binary resolution, EDSDK framework discovery,
 * system contention detection, and stale lock recovery.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function resolveBridgeBinary() {
  if (process.env.CANON_BRIDGE_PATH && fs.existsSync(process.env.CANON_BRIDGE_PATH)) {
    return {
      path: path.resolve(process.env.CANON_BRIDGE_PATH),
      source: 'ENV_CANON_BRIDGE_PATH',
      platform: process.platform,
      arch: process.arch,
    };
  }

  const projectRoot = path.resolve(__dirname, '../../..');
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'canon_bridge_win.exe' : 'canon_bridge_mac';

  const candidatePaths = [
    path.join(projectRoot, 'apps/desktop/electron/main/camera/canon/bin', binaryName),
    path.join(__dirname, 'bin', binaryName),
    path.join(projectRoot, 'vendor/canon/bin', binaryName),
  ];

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
  if (process.env.CANON_EDSDK_PATH && fs.existsSync(process.env.CANON_EDSDK_PATH)) {
    return {
      path: path.resolve(process.env.CANON_EDSDK_PATH),
      source: 'ENV_CANON_EDSDK_PATH',
    };
  }

  const projectRoot = path.resolve(__dirname, '../../..');
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const winCandidates = [
      path.join(projectRoot, 'apps/desktop/electron/main/camera/canon/bin/EDSDK.dll'),
      'C:\\Program Files\\Canon\\EOS Utility\\EDSDK.dll',
      'C:\\Program Files (x86)\\Canon\\EOS Utility\\EDSDK.dll',
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
  if (process.platform !== 'darwin') return false;
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

module.exports = {
  resolveBridgeBinary,
  resolveEdsdkPath,
  checkSystemContention,
};
