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
