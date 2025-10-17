@echo off
REM ============================================================================
REM ARBITRAGEXPLUS2025 - Setup Completo y Google Sheet Brain Initialization
REM Este script clona el repositorio y ejecuta la inicializacion del Sheet
REM ============================================================================

color 0A
echo.
echo ============================================================================
echo   ARBITRAGEXPLUS2025 - Setup Completo y Inicializacion
echo ============================================================================
echo.

REM Verificar que Git este instalado
git --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Git no esta instalado
    echo.
    echo [INFO] Por favor instala Git desde: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [OK] Git instalado correctamente
echo.

REM Verificar que Node.js este instalado
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
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

REM Definir directorio de trabajo
set WORK_DIR=%USERPROFILE%\ARBITRAGEXPLUS2025
echo [INFO] Directorio de trabajo: %WORK_DIR%
echo.

REM Verificar si el directorio ya existe
if exist "%WORK_DIR%" (
    echo [WARN] El directorio ya existe
    echo.
    set /p OVERWRITE="Deseas eliminarlo y clonar de nuevo? (S/N): "
    if /i "%OVERWRITE%"=="S" (
        echo.
        echo [INFO] Eliminando directorio existente...
        rmdir /s /q "%WORK_DIR%"
        echo [OK] Directorio eliminado
        echo.
    ) else (
        echo.
        echo [INFO] Usando directorio existente
        echo.
        goto :SKIP_CLONE
    )
)

REM Clonar el repositorio
echo [INFO] Clonando repositorio desde GitHub...
echo [INFO] URL: https://github.com/hefarica/ARBITRAGEXPLUS2025.git
echo.

git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git "%WORK_DIR%"

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Error al clonar el repositorio
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Repositorio clonado exitosamente
echo.

:SKIP_CLONE

REM Cambiar al directorio del proyecto
cd /d "%WORK_DIR%"
echo [INFO] Directorio actual: %CD%
echo.

REM Verificar que existe el archivo de credenciales
if not exist "keys\gsheets-sa.json" (
    color 0E
    echo ============================================================================
    echo   [IMPORTANTE] Archivo de Credenciales Requerido
    echo ============================================================================
    echo.
    echo [INFO] No se encontro el archivo de credenciales de Google Cloud
    echo.
    echo [INFO] Por favor sigue estos pasos:
    echo.
    echo   1. Ve a Google Cloud Console:
    echo      https://console.cloud.google.com/
    echo.
    echo   2. Selecciona el proyecto: ARBITRAGEX (ID: arbitragex-475408)
    echo.
    echo   3. Ve a: IAM y administracion ^> Cuentas de servicio
    echo.
    echo   4. Crea una nueva cuenta de servicio:
    echo      - Nombre: arbitragexplus-sheets
    echo      - Rol: Editor
    echo.
    echo   5. Crea una clave JSON:
    echo      - Clic en los 3 puntos ^> Administrar claves
    echo      - Agregar clave ^> Crear clave nueva ^> JSON
    echo.
    echo   6. Guarda el archivo descargado como:
    echo      %WORK_DIR%\keys\gsheets-sa.json
    echo.
    echo   7. Comparte el spreadsheet con el Service Account:
    echo      - URL: https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit
    echo      - Email del Service Account (ejemplo):
    echo        arbitragexplus-sheets@arbitragex-475408.iam.gserviceaccount.com
    echo      - Permiso: Editor
    echo.
    echo   8. Habilita Google Sheets API:
    echo      - APIs y servicios ^> Biblioteca
    echo      - Busca: Google Sheets API
    echo      - Clic en Habilitar
    echo.
    echo ============================================================================
    echo.
    
    REM Crear directorio keys si no existe
    if not exist "keys" (
        mkdir keys
        echo [INFO] Directorio 'keys' creado
        echo.
    )
    
    REM Abrir explorador de archivos en la carpeta keys
    echo [INFO] Abriendo carpeta 'keys' en el explorador...
    start "" "%WORK_DIR%\keys"
    echo.
    
    REM Abrir Google Cloud Console
    echo [INFO] Abriendo Google Cloud Console en el navegador...
    start "" "https://console.cloud.google.com/iam-admin/serviceaccounts?project=arbitragex-475408"
    echo.
    
    echo [INFO] Cuando hayas guardado el archivo gsheets-sa.json en la carpeta 'keys',
    echo        vuelve a ejecutar este script.
    echo.
    pause
    exit /b 0
)

echo [OK] Archivo de credenciales encontrado
echo.

REM Instalar dependencias de Node.js
echo [INFO] Instalando dependencias de Node.js...
call npm install googleapis --silent >nul 2>&1
if errorlevel 1 (
    echo [WARN] Hubo un problema instalando dependencias, pero continuaremos...
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

REM Mostrar informacion del spreadsheet
echo ============================================================================
echo   Informacion del Google Sheet
echo ============================================================================
echo.
echo [INFO] Spreadsheet ID: %SPREADSHEET_ID%
echo [INFO] URL: https://docs.google.com/spreadsheets/d/%SPREADSHEET_ID%/edit
echo.
echo [INFO] Se eliminaran TODAS las hojas existentes y se crearan:
echo.
echo        1. BLOCKCHAINS    (50 campos)  - Redes blockchain
echo        2. DEXES          (200 campos) - Exchanges descentralizados
echo        3. ASSETS         (400 campos) - Tokens y precios
echo        4. POOLS          (100 campos) - Pools de liquidez
echo        5. ROUTES         (200 campos) - Rutas de arbitraje
echo        6. EXECUTIONS     (50 campos)  - Operaciones ejecutadas
echo        7. CONFIG         (7 campos)   - Configuracion global
echo        8. ALERTS         (9 campos)   - Sistema de alertas
echo.
echo        Total: 1016+ campos dinamicos
echo.
echo ============================================================================
echo.

REM Preguntar confirmacion
color 0E
echo [WARN] IMPORTANTE:
echo        - Este script ELIMINARA todas las hojas existentes en el spreadsheet
echo        - Asegurate de haber compartido el spreadsheet con el Service Account
echo        - Asegurate de haber habilitado Google Sheets API
echo.
color 0A

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
    color 0C
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
    echo        Ubicacion: %WORK_DIR%\CONFIGURAR_GOOGLE_SHEET.md
    echo.
    
    REM Abrir documentacion
    echo [INFO] Abriendo documentacion...
    start "" "%WORK_DIR%\CONFIGURAR_GOOGLE_SHEET.md"
    echo.
) else (
    color 0A
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
    echo [INFO] Directorio del proyecto: %WORK_DIR%
    echo.
    
    REM Abrir spreadsheet en navegador
    echo [INFO] Abriendo spreadsheet en el navegador...
    start "" "https://docs.google.com/spreadsheets/d/%SPREADSHEET_ID%/edit"
    echo.
)

echo.
echo ============================================================================
echo.
pause

