@ECHO OFF
CLS

REM ============================================================================
REM   CAMBIAR AL DIRECTORIO DONDE ESTA ESTE SCRIPT
REM ============================================================================
REM Esto es CRITICO cuando se ejecuta como administrador
PUSHD "%~dp0"

ECHO.
ECHO ============================================================================
ECHO   ARBITRAGEXPLUS2025 - VERSION ULTRA SIMPLE
ECHO ============================================================================
ECHO.
ECHO Directorio del script: %~dp0
ECHO Directorio actual: %CD%
ECHO.

REM Verificar que estamos en el lugar correcto
IF NOT EXIST "installer\MASTER_RUNNER.csproj" (
    ECHO.
    ECHO [X] ERROR: No se encuentra installer\MASTER_RUNNER.csproj
    ECHO.
    ECHO Asegurate de:
    ECHO 1. Estar en la raiz del proyecto ARBITRAGEXPLUS2025
    ECHO 2. Haber descargado/clonado el repositorio completo
    ECHO.
    ECHO Archivos en este directorio:
    DIR /B
    ECHO.
    ECHO Presiona cualquier tecla para salir...
    PAUSE >nul
    POPD
    EXIT /B 1
)

ECHO [OK] Estructura de archivos correcta
ECHO.

REM Verificar .NET SDK
WHERE dotnet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO.
    ECHO [X] ERROR: .NET SDK no esta instalado
    ECHO.
    ECHO Descarga e instala .NET SDK desde:
    ECHO https://dotnet.microsoft.com/download
    ECHO.
    ECHO O si tienes Chocolatey instalado, ejecuta:
    ECHO choco install dotnet-sdk -y
    ECHO.
    ECHO Presiona cualquier tecla para salir...
    PAUSE >nul
    POPD
    EXIT /B 1
)

ECHO [OK] .NET SDK encontrado
dotnet --version
ECHO.

ECHO Cambiando a directorio installer...
CD installer
ECHO.

ECHO ============================================================================
ECHO   COMPILANDO Y EJECUTANDO...
ECHO ============================================================================
ECHO.

dotnet run

SET EXITCODE=%ERRORLEVEL%

CD ..

ECHO.
ECHO ============================================================================
IF %EXITCODE% EQU 0 (
    ECHO   FINALIZADO CORRECTAMENTE
) ELSE (
    ECHO   FINALIZADO CON ERRORES - Codigo: %EXITCODE%
)
ECHO ============================================================================
ECHO.

ECHO Presiona cualquier tecla para salir...
PAUSE >nul

POPD

