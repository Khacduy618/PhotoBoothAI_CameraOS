@echo off
rem ==============================================================================
rem MomentAI CameraOS — Canon EOS 6D Win32 Bridge Build Script (x86)
rem Compiles canon_bridge_win32.cpp into canon_bridge_win32.exe targeting Win32 / x86.
rem ==============================================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

if not exist "bin" (
    mkdir "bin"
)

rem Check if cl.exe is already available in PATH
where cl.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ENV_CHECK] cl.exe not in PATH. Searching for Visual Studio MSVC Build Tools...

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
        if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
        if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvarsall.bat" set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvarsall.bat"
    )

    if not "!VCVARS!"=="" (
        echo [ENV_INIT] Initializing MSVC x86 environment via !VCVARS!...
        call "!VCVARS!" x86
    ) else (
        echo [ERROR] Visual Studio C++ Compiler ^(cl.exe^) not found.
        echo Please open "x86 Native Tools Command Prompt for VS" from the Windows Start menu,
        echo or install Visual Studio Build Tools with C++ Desktop Development.
        exit /b 1
    )
)

echo [BUILD_BEGIN] Compiling canon_bridge_win32.cpp targeting Win32 x86...

cl /O2 /std:c++17 /EHsc /MD /DWIN32 /D_WINDOWS ^
   canon_bridge_win32.cpp ^
   /Fe:bin\canon_bridge_win32.exe ^
   /link user32.lib advapi32.lib ole32.lib

if %ERRORLEVEL% equ 0 (
    echo [BUILD_SUCCESS] Output: bin\canon_bridge_win32.exe
    if exist "canon_bridge_win32.obj" del "canon_bridge_win32.obj"
    exit /b 0
) else (
    echo [BUILD_FAILED] cl.exe returned error %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
