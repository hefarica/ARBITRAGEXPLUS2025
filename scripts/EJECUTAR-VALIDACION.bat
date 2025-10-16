@echo off
REM ============================================================================
REM SCRIPT BATCH DE VALIDACIÓN AUTOMÁTICA - ARBITRAGEXPLUS2025
REM 
REM Este script ejecuta la validación completa del sistema y genera un reporte
REM en formato ASCII tree con colores indicando el estado de cada archivo.
REM 
REM IDEMPOTENTE: Se puede ejecutar múltiples veces sin problemas
REM 
REM Autor: MANUS AI
REM Versión: 1.0
REM Repositorio: https://github.com/hefarica/ARBITRAGEXPLUS2025
REM ============================================================================

setlocal enabledelayedexpansion

REM Configuración de colores para CMD
color 0A

REM Banner
echo.
echo ============================================================================
echo.
echo          VALIDACION COMPLETA DEL SISTEMA - ARBITRAGEXPLUS2025
echo          Repositorio: https://github.com/hefarica/ARBITRAGEXPLUS2025
echo.
echo ============================================================================
echo.

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Crear directorio de reportes si no existe
set "REPORTS_DIR=%SCRIPT_DIR%reportes"
if not exist "%REPORTS_DIR%" (
    echo [INFO] Creando directorio de reportes: %REPORTS_DIR%
    mkdir "%REPORTS_DIR%"
)

REM Generar nombre de archivo con timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "REPORT_FILE=%REPORTS_DIR%\validation-report-%TIMESTAMP%.txt"

echo [INFO] Directorio de trabajo: %SCRIPT_DIR%
echo [INFO] Directorio de reportes: %REPORTS_DIR%
echo [INFO] Archivo de reporte: %REPORT_FILE%
echo.

REM Verificar que existe el script PowerShell
if not exist "%SCRIPT_DIR%Validate-System-Complete.ps1" (
    echo [ERROR] No se encontro el script PowerShell: Validate-System-Complete.ps1
    echo [ERROR] Asegurate de que este archivo .bat este en el directorio scripts/
    echo.
    pause
    exit /b 1
)

echo [INFO] Ejecutando validacion del sistema...
echo [INFO] Esto puede tomar unos segundos...
echo.

REM Ejecutar script PowerShell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%SCRIPT_DIR%Validate-System-Complete.ps1" -OutputPath "%REPORT_FILE%"

REM Capturar código de salida
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================================
echo.

REM Verificar si se generó el reporte
if exist "%REPORT_FILE%" (
    echo [EXITO] Reporte generado exitosamente!
    echo.
    echo UBICACION DEL REPORTE:
    echo    %REPORT_FILE%
    echo.
    
    REM Mostrar tamaño del archivo
    for %%A in ("%REPORT_FILE%") do (
        echo Tamanio del archivo: %%~zA bytes
    )
    echo.
    
    REM Preguntar si desea abrir el reporte
    echo Deseas abrir el reporte ahora? (S/N)
    set /p "OPEN_REPORT="
    
    if /i "!OPEN_REPORT!"=="S" (
        echo [INFO] Abriendo reporte...
        start "" "%REPORT_FILE%"
    )
    
    echo.
    echo [INFO] Tambien puedes encontrar el reporte en:
    echo    %REPORTS_DIR%
    echo.
    
) else (
    echo [ERROR] No se pudo generar el reporte
    echo [ERROR] Verifica los errores arriba
    echo.
)

REM Mostrar resultado de la validación
echo ============================================================================
echo.

if %EXIT_CODE% EQU 0 (
    echo [EXITO] TODAS LAS VALIDACIONES PASARON
    echo         El sistema esta completo e integrado correctamente
) else (
    echo [ADVERTENCIA] SE ENCONTRARON ERRORES EN LA VALIDACION
    echo              Revisa el reporte para ver los detalles
)

echo.
echo ============================================================================
echo.

REM Crear acceso directo al directorio de reportes
set "SHORTCUT_FILE=%SCRIPT_DIR%VER-REPORTES.bat"
if not exist "%SHORTCUT_FILE%" (
    echo @echo off > "%SHORTCUT_FILE%"
    echo explorer "%REPORTS_DIR%" >> "%SHORTCUT_FILE%"
    echo [INFO] Creado acceso rapido: VER-REPORTES.bat
    echo        Ejecutalo para abrir la carpeta de reportes
    echo.
)

REM Mantener ventana abierta
echo Presiona cualquier tecla para salir...
pause >nul

exit /b %EXIT_CODE%

