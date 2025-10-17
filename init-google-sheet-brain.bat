@echo off
REM ============================================================================
REM ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization Script
REM Script de Batch para Windows
REM ============================================================================

echo ============================================================================
echo   ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization
echo ============================================================================
echo.

REM Obtener el directorio donde está este script
set SCRIPT_DIR=%~dp0
echo [INFO] Directorio del script: %SCRIPT_DIR%
echo.

REM Cambiar al directorio del proyecto
cd /d "%SCRIPT_DIR%"
echo [OK] Cambiado al directorio del proyecto
echo.

REM Verificar que existe el archivo de credenciales
if not exist "keys\gsheets-sa.json" (
    echo [ERROR] No se encontro el archivo de credenciales
    echo         Ubicacion esperada: %SCRIPT_DIR%keys\gsheets-sa.json
    echo.
    echo [INFO] Por favor:
    echo        1. Crea la carpeta 'keys' en el directorio del proyecto
    echo        2. Descarga el archivo JSON del Service Account desde Google Cloud Console
    echo        3. Guardalo como 'keys\gsheets-sa.json'
    echo.
    pause
    exit /b 1
)

echo [OK] Archivo de credenciales encontrado
echo.

REM Verificar que existe el script de Node.js
if not exist "scripts\init-google-sheet-brain.js" (
    echo [ERROR] No se encontro el script de inicializacion
    echo         Ubicacion esperada: %SCRIPT_DIR%scripts\init-google-sheet-brain.js
    echo.
    pause
    exit /b 1
)

echo [OK] Script de inicializacion encontrado
echo.

REM Verificar que Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado
    echo.
    echo [INFO] Por favor instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js instalado: %NODE_VERSION%
echo.

REM Instalar dependencias
echo [INFO] Verificando dependencias de Node.js...
call npm install googleapis --silent >nul 2>&1
if errorlevel 1 (
    echo [WARN] Hubo un problema instalando dependencias
) else (
    echo [OK] Dependencias instaladas correctamente
)
echo.

REM Configurar variables de entorno
set GOOGLE_APPLICATION_CREDENTIALS=.\keys\gsheets-sa.json
set SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ

echo [INFO] Variables de entorno configuradas:
echo        GOOGLE_APPLICATION_CREDENTIALS = %GOOGLE_APPLICATION_CREDENTIALS%
echo        SPREADSHEET_ID = %SPREADSHEET_ID%
echo.

REM Mostrar información del spreadsheet
echo ============================================================================
echo   Informacion del Google Sheet
echo ============================================================================
echo.
echo [INFO] Spreadsheet ID: %SPREADSHEET_ID%
echo [INFO] URL: https://docs.google.com/spreadsheets/d/%SPREADSHEET_ID%/edit
echo.
echo [INFO] Se crearan 13 hojas maestras con 1016+ campos:
echo        1. BLOCKCHAINS    (50 campos)  - Redes blockchain
echo        2. DEXES          (200 campos) - Exchanges descentralizados
echo        3. ASSETS         (400 campos) - Tokens y precios
echo        4. POOLS          (100 campos) - Pools de liquidez
echo        5. ROUTES         (200 campos) - Rutas de arbitraje
echo        6. EXECUTIONS     (50 campos)  - Operaciones ejecutadas
echo        7. CONFIG         (7 campos)   - Configuracion global
echo        8. ALERTS         (9 campos)   - Sistema de alertas
echo.
echo ============================================================================
echo.

REM Preguntar confirmación
echo [WARN] IMPORTANTE: Asegurate de haber compartido el spreadsheet con el Service Account
echo.
set /p CONFIRM="Deseas continuar con la inicializacion? (S/N): "

if /i not "%CONFIRM%"=="S" (
    echo.
    echo [INFO] Operacion cancelada por el usuario
    echo.
    pause
    exit /b 0
)

echo.
echo ============================================================================
echo   Ejecutando script de inicializacion...
echo ============================================================================
echo.

REM Ejecutar el script de Node.js
node scripts\init-google-sheet-brain.js

REM Verificar el resultado
if errorlevel 1 (
    echo.
    echo ============================================================================
    echo   [ERROR] ERROR EN LA INICIALIZACION
    echo ============================================================================
    echo.
    echo [WARN] Posibles causas:
    echo        1. El Service Account no tiene acceso al spreadsheet
    echo        2. Google Sheets API no esta habilitada
    echo        3. Las credenciales son invalidas
    echo        4. El SPREADSHEET_ID es incorrecto
    echo.
    echo [INFO] Revisa el archivo CONFIGURAR_GOOGLE_SHEET.md para mas detalles
    echo.
) else (
    echo.
    echo ============================================================================
    echo   [OK] GOOGLE SHEET BRAIN INICIALIZADO EXITOSAMENTE
    echo ============================================================================
    echo.
    echo [OK] Las 13 hojas maestras han sido creadas con exito!
    echo.
    echo [INFO] Puedes ver el spreadsheet aqui:
    echo        https://docs.google.com/spreadsheets/d/%SPREADSHEET_ID%/edit
    echo.
    echo [INFO] Proximos pasos:
    echo        1. Abre el spreadsheet en tu navegador
    echo        2. Verifica que las 13 hojas esten creadas
    echo        3. Configura datos iniciales en BLOCKCHAINS y CONFIG
    echo        4. Inicia los servicios del sistema
    echo.
)

echo.
pause

