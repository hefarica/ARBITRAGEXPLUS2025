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

echo [INFO] El sistema buscara automaticamente el archivo Excel
echo [INFO] Buscara en:
echo   1. Variable de entorno EXCEL_FILE_PATH
echo   2. Carpeta data\ del proyecto
echo   3. Busqueda recursiva en el proyecto
echo.

echo Iniciando watcher...
echo.
echo El watcher monitoreara la columna NAME cada 1 segundo
echo Cuando escribas un nombre de blockchain, se actualizaran automaticamente las columnas PUSH
echo.
echo Presiona Ctrl+C para detener el watcher
echo.
echo ========================================
echo.

REM Iniciar watcher (el script buscará automáticamente el Excel)
cd src
python blockchains_watcher_v2.py

pause

