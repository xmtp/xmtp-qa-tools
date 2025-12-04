@echo off
REM Quick start script for XMTP load testing (Windows)

echo 🚀 XMTP Load Test - Quick Start
echo ================================
echo.

REM Check if npm is available
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found. Please install Node.js and npm.
    exit /b 1
)

REM Install dependencies
echo 📦 Step 1: Installing dependencies...
call npm install
echo.

REM Check for existing config
if exist ".\data\load-test-config.json" (
    echo ⚠️  Found existing configuration in .\data\
    set /p USE_EXISTING="Do you want to use it? (y/n): "
    if /i not "%USE_EXISTING%"=="y" (
        set RUN_SETUP=true
    ) else (
        set RUN_SETUP=false
    )
) else (
    set RUN_SETUP=true
)

REM Run setup if needed
if "%RUN_SETUP%"=="true" (
    echo 📝 Step 2: Setting up test environment...
    echo.
    set /p IDENTITIES="How many identities? (recommended: 50-200): "
    set /p GROUPS="How many groups? (recommended: 5-20): "
    set /p MEMBERS="Members per group? (recommended: 10-50): "
    set /p ENV="Environment (dev/production)? [dev]: "
    if "%ENV%"=="" set ENV=dev
    
    call npm run setup -- -i %IDENTITIES% -g %GROUPS% -m %MEMBERS% -e %ENV%
    echo.
)

REM Ask which test to run
echo 🔥 Step 3: Choose test type
echo 1) Full Artillery load test (production)
echo 2) Simple test runner (quick test)
echo 3) Artillery with debug output
echo.
set /p TEST_TYPE="Select (1-3): "
echo.

if "%TEST_TYPE%"=="1" (
    echo 🚀 Running full Artillery load test...
    echo ⚠️  This will run for the duration specified in artillery-config.yml
    echo    Press Ctrl+C to stop
    echo.
    call npm run test
) else if "%TEST_TYPE%"=="2" (
    echo 🚀 Running simple test (60 seconds)...
    call npm run test:simple
) else if "%TEST_TYPE%"=="3" (
    echo 🚀 Running Artillery with debug output...
    call npm run test:debug
    echo.
    echo 📊 Generating report...
    call npm run report
    echo.
    echo 📈 Analyzing results...
    call npm run analyze
) else (
    echo ❌ Invalid selection
    exit /b 1
)

echo.
echo ✅ Done!


