@echo off
REM Build script for PDPTW Project
REM Sets up Visual Studio environment and builds the project

echo ========================================
echo PDPTW Solver Build Script
echo ========================================

REM Setup Visual Studio environment
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"

REM Change to project directory
cd /d "%~dp0"

REM Create build directory and run CMake
if not exist build mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cd ..

REM Build using MSBuild
echo.
echo Building Release configuration...
msbuild build\pdptw_solver.sln /p:Configuration=Release /m /v:minimal

if %ERRORLEVEL% == 0 (
    echo.
    echo ========================================
    echo Build succeeded!
    echo ========================================
    echo.
    echo Running tests...
    cd build\bin\Release
    pdptw_tests.exe --gtest_brief=1
) else (
    echo.
    echo ========================================
    echo Build failed!
    echo ========================================
)

pause
