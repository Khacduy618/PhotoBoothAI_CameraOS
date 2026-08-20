# MomentAI CameraOS / PhotoBoothAI

Local-first photobooth platform and camera-powered guest application.

---

## 🏛️ Application Ownership & Architecture

- **Admin / Operator Web**: Next.js App running on `http://localhost:3000` (`app/`)
- **Guest Photobooth**: Electron Desktop App running in WindowMini (`apps/desktop/`)
- **Shared Domain Packages**: `packages/` (`shared-types`, `session-engine`, `shot-engine`, contracts, test-fixtures)
- **Mandatory Invariant**: `http://localhost:3000/booth` returns **404** (Guest flow is hosted solely in Electron).

---

## 🚀 Quickstart (Fresh Clone)

### 1. Requirements
- **Node.js**: `>=20.19.0` (LTS 22.x recommended)
- **pnpm**: `10.11.0` (enforced via `packageManager`)

### 2. Installation & Verification
```bash
# Clone repository
git clone https://github.com/Khacduy618/PhotoBoothAI_CameraOS.git
cd PhotoBoothAI_CameraOS

# Install exact dependencies
pnpm install --frozen-lockfile

# Run local verification gate (hygiene + architecture + typecheck + lint + tests + builds)
pnpm verify
```

### 3. Development Commands
```bash
# Launch Electron Guest Desktop (Display 2 / WindowMini)
pnpm dev:desktop

# Launch Admin / Operator Web (localhost:3000)
pnpm dev:web
```

---

## 🧪 CI & Verification Pipeline

Run the canonical local gate before pushing code:
```bash
pnpm verify
```

This runs:
1. `pnpm ci:repo`: Verifies no runtime databases, session photos, secrets, or build outputs are tracked by Git.
2. `pnpm ci:architecture`: Verifies architectural boundaries (`/booth` absent, Electron & Admin entrypoints intact).
3. `pnpm typecheck`: TypeScript verification across the entire project (`tsc --noEmit`).
4. `pnpm lint`: ESLint code quality audit.
5. `pnpm test`: Full unit and integration test suite (50 test files, 330 tests) running against mock hardware adapters.
6. `pnpm build:web`: Next.js Admin Web production build.
7. `pnpm build:desktop`: Vite Electron renderer production build.

---

## 📸 Hardware Boundary & Testing Policy

- **CI Test Suite**: Uses pure mock adapters (`FakeCameraAdapter`, `FakePrinterAdapter`, in-memory/temp storage) to guarantee fast, deterministic 100% test coverage without physical hardware.
- **Physical Hardware Acceptance**: Real Canon EOS 6D (USB EDSDK 3.20.10.2) and Canon Selphy CP1000 printing must be verified on physical devices via dedicated hardware smoke tests, reported separately from software CI status.

