import fs from 'node:fs';
import path from 'node:path';

/**
 * CI Architecture Invariant Verification
 * Verifies core project ownership boundaries and invariants:
 * 1. Next.js Guest /booth route MUST NOT exist (localhost:3000/booth = 404).
 * 2. Next.js API routes exist in app/api/ (UI pages optional — app/ is API-only layer)
 * 3. Electron Guest Booth exists in apps/desktop/
 * 4. Canonical guest flow components exist in components/momentai-guest-flow/
 */

const REPO_ROOT = process.cwd();

function assertPathExists(relPath, description) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Architecture Violation: Missing required ${description} at ${relPath}`);
  }
}

function assertPathDoesNotExist(relPath, description) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    throw new Error(`Architecture Violation: Prohibited ${description} found at ${relPath}`);
  }
}

function checkArchitecture() {
  console.log('🏛️  [CI] Checking Architecture Invariants...');

  // Invariant 1: localhost:3000/booth MUST NOT exist
  assertPathDoesNotExist('app/booth', 'Next.js Guest /booth route (must be 404 on Admin Web)');

  // Invariant 2: Admin Web API routes (UI pages are optional — app/ is an API-only layer)
  assertPathExists('app/api/momentai-guest-session/route.ts', 'Guest session API route');
  assertPathExists('app/api/admin/frames/route.ts', 'Admin frames API route');
  assertPathExists('app/s/[sessionId]/route.ts', 'Session share API route');

  // Invariant 3: Electron Desktop Booth entrypoints
  assertPathExists('apps/desktop/electron/main/main.cjs', 'Electron Main process');
  assertPathExists('apps/desktop/electron/preload/preload.cjs', 'Electron Preload script');
  assertPathExists('apps/desktop/renderer/index.html', 'Electron Renderer HTML');
  assertPathExists('apps/desktop/renderer/vite.config.mts', 'Electron Renderer Vite config');

  // Invariant 4: Shared Guest Flow & Packages
  assertPathExists('components/momentai-guest-flow', 'Shared MomentAI Guest Flow components');
  assertPathExists('packages/shared-types', 'Shared types package');
  assertPathExists('packages/session-engine', 'Session engine package');
  assertPathExists('packages/shot-engine', 'Shot engine package');

  console.log('✅ [CI] Architecture Invariants PASSED cleanly.');
}

checkArchitecture();
