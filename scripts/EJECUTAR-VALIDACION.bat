@echo off
REM ============================================================================
REM SCRIPT DE VALIDACION - ARBITRAGEXPLUS2025
REM Version: 6.0 - Compatible con antivirus
REM ============================================================================

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"

REM Crear directorio de reportes si no existe
set "REPORTS_DIR=%SCRIPT_DIR%reportes"
if not exist "%REPORTS_DIR%" mkdir "%REPORTS_DIR%"

REM Generar timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "REPORT_FILE=%REPORTS_DIR%\validation-report-%TIMESTAMP%.txt"

echo.
echo ================================================================================
echo   GENERANDO DIAGRAMA DE ARQUITECTURA - ARBITRAGEXPLUS2025
echo ================================================================================
echo.
echo [INFO] Ejecutando validacion del sistema...
echo [INFO] Esto puede tomar unos segundos...
echo.

REM Ejecutar PowerShell (sin ventana oculta para evitar antivirus)
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%SCRIPT_DIR%Validate-System-Complete.ps1" -OutputPath "%REPORT_FILE%"

REM Verificar si se genero el reporte
if exist "%REPORT_FILE%" (
    echo.
    echo [OK] Reporte generado exitosamente!
    echo [INFO] Ubicacion: %REPORT_FILE%
    echo.
    echo [INFO] Abriendo reporte en Notepad...
    echo.
    
    REM Abrir en Notepad
    start notepad.exe "%REPORT_FILE%"
    
    REM Esperar un momento antes de cerrar
    timeout /t 2 /nobreak >nul
) else (
    echo.
    echo [ERROR] No se pudo generar el reporte
    echo [ERROR] Verifica que el archivo Validate-System-Complete.ps1 existe
    echo [ERROR] en la misma carpeta que este script
    echo.
    pause
)

exit
