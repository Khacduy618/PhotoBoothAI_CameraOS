import { execSync } from 'node:child_process';

/**
 * CI Repository Hygiene Verification
 * Inspects GIT TRACKED files using git ls-files.
 * Fails if forbidden runtime, database, build, or secret files are tracked.
 */

const FORBIDDEN_PATTERNS = [
  { pattern: /^\.next\//, reason: 'Next.js build directory should not be tracked' },
  { pattern: /^out\//, reason: 'Static export directory should not be tracked' },
  { pattern: /^build\//, reason: 'Build output should not be tracked' },
  { pattern: /^coverage\//, reason: 'Test coverage reports should not be tracked' },
  { pattern: /^\.cameraos-data\//, reason: 'Runtime camera data should not be tracked' },
  { pattern: /^apps\/artifacts\/windowmini-storage\/sessions\//, reason: 'Runtime session media must not be tracked' },
  { pattern: /\.(sqlite|sqlite-wal|sqlite-shm)$/i, reason: 'Runtime SQLite database files must not be tracked' },
  { pattern: /(^|\/)\.env(\.(local|production|staging|test))?$/, reason: 'Secret environment files must not be tracked' },
  { pattern: /(^|\/)\.DS_Store$/, reason: 'macOS metadata files should not be tracked' },
  { pattern: /^playwright-report\//, reason: 'Playwright test report output should not be tracked' },
  { pattern: /^test-results\//, reason: 'Playwright test results should not be tracked' },
  { pattern: /^apps\/desktop\/renderer\/dist\//, reason: 'Desktop renderer dist should not be tracked' },
];

function checkRepoHygiene() {
  console.log('🔍 [CI] Checking Git tracked repository hygiene...');
  let trackedFiles = [];

  try {
    const output = execSync('git ls-files', { encoding: 'utf8' });
    trackedFiles = output.split('\n').filter(Boolean);
  } catch (err) {
    console.error('❌ [CI] Failed to run git ls-files:', err.message);
    process.exit(1);
  }

  const violations = [];

  for (const file of trackedFiles) {
    // Exceptions for explicit safe files
    if (file === 'docs/momentai-cameraos/.env.example') continue;

    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(file)) {
        violations.push({ file, reason });
      }
    }
  }

  if (violations.length > 0) {
    console.error('❌ [CI] Repository hygiene check FAILED! Forbidden files are tracked by Git:');
    for (const v of violations) {
      console.error(`  - ${v.file} (${v.reason})`);
    }
    process.exit(1);
  }

  console.log(`✅ [CI] Repository hygiene check PASSED. Checked ${trackedFiles.length} tracked files cleanly.`);
}

checkRepoHygiene();
