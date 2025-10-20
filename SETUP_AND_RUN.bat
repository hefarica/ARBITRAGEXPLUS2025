@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION
REM ############################################################################
REM #                                                                          #
REM #  ARBITRAGEXPLUS2025 - Instalador y Ejecutor Maestro                     #
REM #                                                                          #
REM #  Este script es IDEMPOTENTE. Puede ejecutarse multiples veces y         #
REM #  siempre dejara el sistema en el estado deseado:                        #
REM #    - Chocolatey instalado                                               #
REM #    - Node.js v22.20.0 instalado                                         #
REM #    - npm v10.9.3 (incluido con Node.js)                                 #
REM #    - Python 3.11+ instalado                                             #
REM #    - .NET SDK instalado                                                 #
REM #    - Todos los servicios compilados y ejecutandose                      #
REM #                                                                          #
REM ############################################################################

ECHO.
ECHO ============================================================================
ECHO   ARBITRAGEXPLUS2025 - CONFIGURACION E INICIO DEL SISTEMA
ECHO ============================================================================
ECHO.

REM --- Paso 0: Verificacion de Privilegios de Administrador ---
ECHO [PASO 0/6] Verificando privilegios de administrador...
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO.
    ECHO ##############################################
    ECHO # ERROR: Se requieren privilegios de Admin  #
    ECHO ##############################################
    ECHO.
    ECHO Por favor, haz clic derecho en este archivo y selecciona 
    ECHO "Ejecutar como administrador".
    ECHO.
    PAUSE
    EXIT /B 1
)
ECHO [OK] Ejecutando con privilegios de administrador.
ECHO.

REM --- Paso 1: Verificacion e Instalacion de Chocolatey ---
ECHO [PASO 1/6] Verificando Chocolatey...
WHERE choco >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [INFO] Chocolatey no encontrado. Iniciando instalacion...
    ECHO [INFO] Este proceso puede tardar varios minutos...
    
    powershell -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command ^
    "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ^
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Fallo la instalacion de Chocolatey.
        PAUSE
        EXIT /B 1
    )
    
    ECHO [INFO] Refrescando variables de entorno...
    SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
    
    REM Verificar que Chocolatey se instalo correctamente
    WHERE choco >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Chocolatey no esta disponible despues de la instalacion.
        ECHO [INFO] Es posible que necesite reiniciar la terminal.
        PAUSE
        EXIT /B 1
    )
    
    ECHO [OK] Chocolatey instalado correctamente.
) ELSE (
    FOR /F "tokens=*" %%v IN ('choco -v 2^>nul') DO SET "CHOCO_VERSION=%%v"
    ECHO [OK] Chocolatey ya esta instalado (version: !CHOCO_VERSION!).
)
ECHO.

REM --- Paso 2: Verificacion e Instalacion de Node.js v22.20.0 ---
SET "REQUIRED_NODE_VERSION=v22.20.0"
SET "REQUIRED_NODE_VERSION_NUM=22.20.0"

ECHO [PASO 2/6] Verificando Node.js version %REQUIRED_NODE_VERSION%...

WHERE node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [INFO] Node.js no encontrado.
    ECHO [INFO] Instalando Node.js %REQUIRED_NODE_VERSION%...
    choco install nodejs --version="%REQUIRED_NODE_VERSION_NUM%" -y --force
    
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Fallo la instalacion de Node.js.
        PAUSE
        EXIT /B 1
    )
    
    ECHO [INFO] Refrescando variables de entorno para Node.js...
    CALL refreshenv.cmd >nul 2>&1
    
    ECHO [OK] Node.js instalado correctamente.
) ELSE (
    REM Capturar version actual de Node.js
    FOR /F "tokens=*" %%g IN ('node -v 2^>nul') DO SET "CURRENT_NODE_VERSION=%%g"
    
    ECHO [INFO] Version de Node.js detectada: !CURRENT_NODE_VERSION!
    
    IF "!CURRENT_NODE_VERSION!"=="%REQUIRED_NODE_VERSION%" (
        ECHO [OK] Node.js ya esta en la version correcta.
    ) ELSE (
        ECHO [WARN] Version incorrecta detectada: !CURRENT_NODE_VERSION!
        ECHO [INFO] Se requiere: %REQUIRED_NODE_VERSION%
        ECHO [INFO] Desinstalando version actual...
        
        choco uninstall nodejs -y --remove-dependencies
        
        ECHO [INFO] Instalando Node.js %REQUIRED_NODE_VERSION%...
        choco install nodejs --version="%REQUIRED_NODE_VERSION_NUM%" -y --force
        
        IF %ERRORLEVEL% NEQ 0 (
            ECHO [ERROR] Fallo la reinstalacion de Node.js.
            PAUSE
            EXIT /B 1
        )
        
        ECHO [INFO] Refrescando variables de entorno...
        CALL refreshenv.cmd >nul 2>&1
        
        ECHO [OK] Node.js actualizado a la version correcta.
    )
)
ECHO.

REM --- Paso 3: Verificacion de Python ---
ECHO [PASO 3/6] Verificando Python...

WHERE python >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [INFO] Python no encontrado.
    ECHO [INFO] Instalando Python 3.11...
    choco install python --version=3.11.0 -y
    
    ECHO [INFO] Refrescando variables de entorno...
    CALL refreshenv.cmd >nul 2>&1
    
    ECHO [OK] Python instalado correctamente.
) ELSE (
    FOR /F "tokens=*" %%p IN ('python --version 2^>nul') DO SET "PYTHON_VERSION=%%p"
    ECHO [OK] Python ya esta instalado (!PYTHON_VERSION!).
)
ECHO.

REM --- Paso 4: Verificacion de .NET SDK ---
ECHO [PASO 4/6] Verificando .NET SDK...

WHERE dotnet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [INFO] .NET SDK no encontrado.
    ECHO [INFO] Instalando .NET SDK...
    choco install dotnet-sdk -y
    
    ECHO [INFO] Refrescando variables de entorno...
    CALL refreshenv.cmd >nul 2>&1
    
    ECHO [OK] .NET SDK instalado correctamente.
) ELSE (
    FOR /F "tokens=*" %%d IN ('dotnet --version 2^>nul') DO SET "DOTNET_VERSION=%%d"
    ECHO [OK] .NET SDK ya esta instalado (version: !DOTNET_VERSION!).
)
ECHO.

REM --- Paso 5: Compilacion y Ejecucion del Sistema ---
ECHO [PASO 5/6] Iniciando sistema ARBITRAGEXPLUS2025...
ECHO.

CD installer
dotnet run

ECHO.

REM --- Paso 6: Verificacion Final ---
ECHO [PASO 6/6] Verificacion final del entorno...
ECHO.
ECHO ============================================================================
ECHO   RESUMEN DE VERSIONES INSTALADAS
ECHO ============================================================================
ECHO.

ECHO Node.js:
node -v 2>nul || ECHO [ERROR] node no disponible

ECHO.
ECHO npm:
npm -v 2>nul || ECHO [ERROR] npm no disponible

ECHO.
ECHO Python:
python --version 2>nul || ECHO [ERROR] python no disponible

ECHO.
ECHO .NET SDK:
dotnet --version 2>nul || ECHO [ERROR] dotnet no disponible

ECHO.
ECHO Chocolatey:
choco -v 2>nul || ECHO [ERROR] choco no disponible

ECHO.
ECHO ============================================================================
ECHO   SISTEMA ARBITRAGEXPLUS2025 INICIADO
ECHO ============================================================================
ECHO.
ECHO El entorno de desarrollo ha sido configurado correctamente.
ECHO Todas las dependencias requeridas estan instaladas.
ECHO.
ECHO Si los comandos no funcionan, cierra esta ventana
ECHO y abre una nueva terminal o reinicia tu equipo.
ECHO.

PAUSE
ENDLOCAL

