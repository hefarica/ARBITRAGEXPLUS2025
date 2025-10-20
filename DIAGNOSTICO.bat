@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

ECHO.
ECHO ============================================================================
ECHO   DIAGNOSTICO DEL SISTEMA ARBITRAGEXPLUS2025
ECHO ============================================================================
ECHO.

REM --- Verificar directorio actual ---
ECHO [1] Directorio actual:
ECHO %CD%
ECHO.

REM --- Verificar estructura de archivos ---
ECHO [2] Verificando estructura de archivos...
IF EXIST "installer" (
    ECHO [OK] Directorio 'installer' encontrado
) ELSE (
    ECHO [ERROR] Directorio 'installer' NO encontrado
)

IF EXIST "installer\MASTER_RUNNER.csproj" (
    ECHO [OK] Archivo 'installer\MASTER_RUNNER.csproj' encontrado
) ELSE (
    ECHO [ERROR] Archivo 'installer\MASTER_RUNNER.csproj' NO encontrado
)

IF EXIST "installer\Program.cs" (
    ECHO [OK] Archivo 'installer\Program.cs' encontrado
) ELSE (
    ECHO [ERROR] Archivo 'installer\Program.cs' NO encontrado
)

IF EXIST "automation" (
    ECHO [OK] Directorio 'automation' encontrado
) ELSE (
    ECHO [ERROR] Directorio 'automation' NO encontrado
)

IF EXIST "automation\excel-com-bridge" (
    ECHO [OK] Directorio 'automation\excel-com-bridge' encontrado
) ELSE (
    ECHO [ERROR] Directorio 'automation\excel-com-bridge' NO encontrado
)
ECHO.

REM --- Verificar privilegios de administrador ---
ECHO [3] Verificando privilegios de administrador...
NET SESSION >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    ECHO [OK] Ejecutando con privilegios de administrador
) ELSE (
    ECHO [ERROR] NO se esta ejecutando con privilegios de administrador
    ECHO [INFO] Haz clic derecho y selecciona "Ejecutar como administrador"
)
ECHO.

REM --- Verificar Chocolatey ---
ECHO [4] Verificando Chocolatey...
WHERE choco >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=*" %%v IN ('choco -v 2^>nul') DO SET "CHOCO_VERSION=%%v"
    ECHO [OK] Chocolatey instalado (version: !CHOCO_VERSION!)
) ELSE (
    ECHO [ERROR] Chocolatey NO instalado
)
ECHO.

REM --- Verificar Node.js ---
ECHO [5] Verificando Node.js...
WHERE node >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=*" %%n IN ('node -v 2^>nul') DO SET "NODE_VERSION=%%n"
    ECHO [OK] Node.js instalado (version: !NODE_VERSION!)
) ELSE (
    ECHO [ERROR] Node.js NO instalado
)
ECHO.

REM --- Verificar npm ---
ECHO [6] Verificando npm...
WHERE npm >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=*" %%m IN ('npm -v 2^>nul') DO SET "NPM_VERSION=%%m"
    ECHO [OK] npm instalado (version: !NPM_VERSION!)
) ELSE (
    ECHO [ERROR] npm NO instalado
)
ECHO.

REM --- Verificar Python ---
ECHO [7] Verificando Python...
WHERE python >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=*" %%p IN ('python --version 2^>nul') DO SET "PYTHON_VERSION=%%p"
    ECHO [OK] Python instalado (!PYTHON_VERSION!)
) ELSE (
    ECHO [WARN] Python NO instalado (opcional)
)
ECHO.

REM --- Verificar .NET SDK ---
ECHO [8] Verificando .NET SDK...
WHERE dotnet >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=*" %%d IN ('dotnet --version 2^>nul') DO SET "DOTNET_VERSION=%%d"
    ECHO [OK] .NET SDK instalado (version: !DOTNET_VERSION!)
) ELSE (
    ECHO [ERROR] .NET SDK NO instalado
)
ECHO.

REM --- Verificar compilacion del MASTER_RUNNER ---
ECHO [9] Verificando si MASTER_RUNNER puede compilarse...
IF EXIST "installer\MASTER_RUNNER.csproj" (
    ECHO [INFO] Intentando compilar MASTER_RUNNER...
    CD installer
    dotnet build MASTER_RUNNER.csproj >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        ECHO [OK] MASTER_RUNNER compila correctamente
    ) ELSE (
        ECHO [ERROR] MASTER_RUNNER NO compila
        ECHO [INFO] Ejecuta 'dotnet build' manualmente para ver errores
    )
    CD ..
) ELSE (
    ECHO [ERROR] No se puede verificar compilacion (archivo .csproj no encontrado)
)
ECHO.

REM --- Resumen ---
ECHO ============================================================================
ECHO   RESUMEN DEL DIAGNOSTICO
ECHO ============================================================================
ECHO.
ECHO Si todos los componentes muestran [OK], el sistema deberia funcionar.
ECHO Si hay [ERROR], instala los componentes faltantes manualmente.
ECHO.
ECHO Para instalar componentes faltantes:
ECHO   - Chocolatey: Ver README_ES.md
ECHO   - Node.js: choco install nodejs --version=22.20.0 -y
ECHO   - .NET SDK: choco install dotnet-sdk -y
ECHO   - Python: choco install python --version=3.11.0 -y
ECHO.

PAUSE
ENDLOCAL

