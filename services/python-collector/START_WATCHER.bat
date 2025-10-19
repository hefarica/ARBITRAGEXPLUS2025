@echo off
REM Script para iniciar el watcher en Windows

echo ========================================
echo ARBITRAGEXPLUS2025 - Iniciando Watcher
echo ========================================
echo.

REM Verificar que existe el entorno virtual
if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Entorno virtual no encontrado
    echo Por favor ejecuta primero INSTALL_WINDOWS.bat
    pause
    exit /b 1
)

REM Activar entorno virtual
call .venv\Scripts\activate.bat

REM Verificar archivo Excel
set EXCEL_PATH=..\..\data\ARBITRAGEXPLUS2025.xlsx
if not exist "%EXCEL_PATH%" (
    echo ERROR: Archivo Excel no encontrado en %EXCEL_PATH%
    echo.
    echo Por favor:
    echo 1. Coloca el archivo ARBITRAGEXPLUS2025.xlsx en la carpeta data\
    echo 2. O edita la variable EXCEL_PATH en este script
    echo.
    pause
    exit /b 1
)

echo [OK] Archivo Excel encontrado: %EXCEL_PATH%
echo.

REM Configurar variable de entorno
set EXCEL_FILE_PATH=%EXCEL_PATH%

echo Iniciando watcher...
echo.
echo El watcher monitoreara la columna NAME cada 1 segundo
echo Cuando escribas un nombre de blockchain, se actualizaran automaticamente las columnas PUSH
echo.
echo Presiona Ctrl+C para detener el watcher
echo.
echo ========================================
echo.

REM Iniciar watcher
cd src
python blockchains_watcher_v2.py

pause

