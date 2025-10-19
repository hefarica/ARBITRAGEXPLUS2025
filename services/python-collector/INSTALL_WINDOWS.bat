@echo off
REM Script de instalación para Windows
REM Instala Python, dependencias y configura el watcher

echo ========================================
echo ARBITRAGEXPLUS2025 - Instalacion Windows
echo ========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python no esta instalado
    echo Por favor instala Python 3.11+ desde https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [OK] Python instalado
echo.

REM Crear entorno virtual
echo Creando entorno virtual...
python -m venv .venv
if %errorlevel% neq 0 (
    echo ERROR: No se pudo crear entorno virtual
    pause
    exit /b 1
)

echo [OK] Entorno virtual creado
echo.

REM Activar entorno virtual
echo Activando entorno virtual...
call .venv\Scripts\activate.bat

REM Instalar dependencias
echo Instalando dependencias...
pip install --upgrade pip
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo [OK] Dependencias instaladas
echo.

REM Verificar archivo Excel
if not exist "..\..\data\ARBITRAGEXPLUS2025.xlsx" (
    echo ADVERTENCIA: Archivo Excel no encontrado en data\ARBITRAGEXPLUS2025.xlsx
    echo Por favor coloca el archivo Excel en la ubicacion correcta
    echo.
)

echo ========================================
echo INSTALACION COMPLETADA
echo ========================================
echo.
echo Para iniciar el watcher, ejecuta:
echo   START_WATCHER.bat
echo.
pause

