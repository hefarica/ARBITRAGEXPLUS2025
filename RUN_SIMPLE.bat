@ECHO OFF
ECHO ============================================================================
ECHO   ARBITRAGEXPLUS2025 - EJECUTOR SIMPLE
ECHO ============================================================================
ECHO.
ECHO Este script ejecutara el sistema y guardara toda la salida en un archivo.
ECHO Si algo falla, revisa el archivo ERROR_LOG.txt
ECHO.
PAUSE

REM Crear archivo de log
ECHO [%DATE% %TIME%] Iniciando ejecucion... > ERROR_LOG.txt

REM Verificar directorio
ECHO [INFO] Directorio actual: %CD% >> ERROR_LOG.txt

IF NOT EXIST "installer" (
    ECHO [ERROR] No se encuentra el directorio 'installer' >> ERROR_LOG.txt
    ECHO [ERROR] Directorio actual: %CD% >> ERROR_LOG.txt
    ECHO.
    ECHO ERROR: No se encuentra el directorio 'installer'
    ECHO Asegurate de ejecutar este script desde la raiz del proyecto.
    ECHO Directorio actual: %CD%
    ECHO.
    ECHO Revisa el archivo ERROR_LOG.txt para mas detalles.
    PAUSE
    EXIT /B 1
)

ECHO [INFO] Cambiando a directorio installer... >> ERROR_LOG.txt
CD installer

ECHO [INFO] Verificando .NET SDK... >> ERROR_LOG.txt
WHERE dotnet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] .NET SDK no esta instalado >> ERROR_LOG.txt
    ECHO.
    ECHO ERROR: .NET SDK no esta instalado
    ECHO.
    ECHO Instala .NET SDK desde: https://dotnet.microsoft.com/download
    ECHO O ejecuta: choco install dotnet-sdk -y
    ECHO.
    ECHO Revisa el archivo ERROR_LOG.txt para mas detalles.
    CD ..
    PAUSE
    EXIT /B 1
)

ECHO [INFO] .NET SDK encontrado >> ERROR_LOG.txt
dotnet --version >> ERROR_LOG.txt

ECHO.
ECHO [INFO] Ejecutando 'dotnet run'...
ECHO [INFO] Esto puede tardar varios minutos en la primera ejecucion...
ECHO.

REM Ejecutar y capturar salida
dotnet run 2>&1 | tee -a ..\ERROR_LOG.txt

SET EXITCODE=%ERRORLEVEL%

CD ..

ECHO. >> ERROR_LOG.txt
ECHO [%DATE% %TIME%] Ejecucion finalizada con codigo: %EXITCODE% >> ERROR_LOG.txt

IF %EXITCODE% NEQ 0 (
    ECHO.
    ECHO ============================================================================
    ECHO   ERROR: El sistema fallo con codigo de salida %EXITCODE%
    ECHO ============================================================================
    ECHO.
    ECHO Revisa el archivo ERROR_LOG.txt para ver los detalles completos del error.
    ECHO.
    TYPE ERROR_LOG.txt
    ECHO.
) ELSE (
    ECHO.
    ECHO ============================================================================
    ECHO   EXITO: El sistema se ejecuto correctamente
    ECHO ============================================================================
    ECHO.
)

PAUSE

