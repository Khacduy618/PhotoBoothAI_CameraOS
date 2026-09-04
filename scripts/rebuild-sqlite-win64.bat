@echo off
rem ==============================================================================
rem MomentAI CameraOS — Rebuild better-sqlite3 for Windows x64 (MSVC x64)
rem ==============================================================================

setlocal enabledelayedexpansion

echo [SQLITE_REBUILD] Locating MSVC x64 compiler...

set "VCVARS="
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "!VSWHERE!" (
    for /f "usebackq tokens=*" %%i in (`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
        if exist "%%i\VC\Auxiliary\Build\vcvarsall.bat" (
            set "VCVARS=%%i\VC\Auxiliary\Build\vcvarsall.bat"
        )
    )
)

if "!VCVARS!"=="" (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat"
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
)

if not "!VCVARS!"=="" (
    echo [ENV_INIT] Initializing MSVC x64 environment via !VCVARS!...
    call "!VCVARS!" x64
)

echo [REBUILD_BEGIN] Rebuilding better-sqlite3 for x64...

if exist "%~dp0..\node_modules\better-sqlite3" (
    cd /d "%~dp0..\node_modules\better-sqlite3"
) else (
    echo [ERROR] node_modules\better-sqlite3 not found.
    exit /b 1
)

call npx --yes node-gyp rebuild --arch=x64
if %ERRORLEVEL% equ 0 (
    echo [SQLITE_REBUILD_SUCCESS] better-sqlite3 rebuilt for x64 successfully!
    exit /b 0
) else (
    echo [SQLITE_REBUILD_FAILED] node-gyp returned error %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
