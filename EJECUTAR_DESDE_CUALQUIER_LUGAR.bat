@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   ARBITRAGEXPLUS2025
echo   Buscando proyecto...
echo ========================================
echo.

REM Buscar en ubicaciones comunes
set "FOUND=0"
set "PROJECT_PATH="

REM 1. Buscar en Downloads
for /d %%D in ("C:\Users\*") do (
    if exist "%%D\Downloads\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Downloads\ARBITRAGEXPLUS2025"
        set "FOUND=1"
        goto :found
    )
    if exist "%%D\Downloads\ARBITRAGEXPLUS2025-master\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Downloads\ARBITRAGEXPLUS2025-master"
        set "FOUND=1"
        goto :found
    )
    for /d %%F in ("%%D\Downloads\ARBITRAGEXPLUS2025-master*") do (
        if exist "%%F\installer\MASTER_RUNNER.csproj" (
            set "PROJECT_PATH=%%F"
            set "FOUND=1"
            goto :found
        )
    )
)

REM 2. Buscar en Documents
for /d %%D in ("C:\Users\*") do (
    if exist "%%D\Documents\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Documents\ARBITRAGEXPLUS2025"
        set "FOUND=1"
        goto :found
    )
    if exist "%%D\Documents\ARBITRAGEXPLUS2025-master\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Documents\ARBITRAGEXPLUS2025-master"
        set "FOUND=1"
        goto :found
    )
)

REM 3. Buscar en Desktop
for /d %%D in ("C:\Users\*") do (
    if exist "%%D\Desktop\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Desktop\ARBITRAGEXPLUS2025"
        set "FOUND=1"
        goto :found
    )
    if exist "%%D\Desktop\ARBITRAGEXPLUS2025-master\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%D\Desktop\ARBITRAGEXPLUS2025-master"
        set "FOUND=1"
        goto :found
    )
)

REM 4. Buscar en D:\
if exist "D:\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
    set "PROJECT_PATH=D:\ARBITRAGEXPLUS2025"
    set "FOUND=1"
    goto :found
)
if exist "D:\Downloads\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
    set "PROJECT_PATH=D:\Downloads\ARBITRAGEXPLUS2025"
    set "FOUND=1"
    goto :found
)
for /d %%F in ("D:\Downloads\ARBITRAGEXPLUS2025-master*") do (
    if exist "%%F\installer\MASTER_RUNNER.csproj" (
        set "PROJECT_PATH=%%F"
        set "FOUND=1"
        goto :found
    )
)

REM 5. Buscar en E:\
if exist "E:\ARBITRAGEXPLUS2025\installer\MASTER_RUNNER.csproj" (
    set "PROJECT_PATH=E:\ARBITRAGEXPLUS2025"
    set "FOUND=1"
    goto :found
)

:found
if "%FOUND%"=="0" (
    echo [X] ERROR: No se encontro el proyecto ARBITRAGEXPLUS2025
    echo.
    echo Ubicaciones buscadas:
    echo   - C:\Users\*\Downloads\ARBITRAGEXPLUS2025
    echo   - C:\Users\*\Documents\ARBITRAGEXPLUS2025
    echo   - C:\Users\*\Desktop\ARBITRAGEXPLUS2025
    echo   - D:\ARBITRAGEXPLUS2025
    echo   - D:\Downloads\ARBITRAGEXPLUS2025
    echo   - E:\ARBITRAGEXPLUS2025
    echo.
    echo Por favor, descarga el proyecto desde GitHub:
    echo   https://github.com/hefarica/ARBITRAGEXPLUS2025
    echo.
    pause
    exit /b 1
)

echo [OK] Proyecto encontrado en:
echo     %PROJECT_PATH%
echo.

REM Cambiar al directorio del proyecto
cd /d "%PROJECT_PATH%"

echo Cambiando al directorio del proyecto...
echo Directorio actual: %CD%
echo.

REM Verificar que RUN_ULTRA_SIMPLE.bat existe
if not exist "RUN_ULTRA_SIMPLE.bat" (
    echo [X] ERROR: No se encuentra RUN_ULTRA_SIMPLE.bat
    echo.
    echo Ejecutando directamente desde installer...
    cd installer
    dotnet run
    pause
    exit /b 1
)

echo Ejecutando RUN_ULTRA_SIMPLE.bat...
echo.
call RUN_ULTRA_SIMPLE.bat

pause

