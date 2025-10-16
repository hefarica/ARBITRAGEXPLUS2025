@echo off
REM ============================================================================
REM SCRIPT BATCH DE VALIDACIÓN SILENCIOSA - ARBITRAGEXPLUS2025
REM 
REM Este script ejecuta la validación SIN MOSTRAR la ventana CMD
REM y solo abre el reporte en Notepad automáticamente
REM 
REM Autor: MANUS AI
REM Versión: 2.0
REM ============================================================================

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"

REM Crear directorio de reportes si no existe
set "REPORTS_DIR=%SCRIPT_DIR%reportes"
if not exist "%REPORTS_DIR%" mkdir "%REPORTS_DIR%"

REM Generar nombre de archivo con timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "REPORT_FILE=%REPORTS_DIR%\validation-report-%TIMESTAMP%.txt"

REM Ejecutar PowerShell en modo OCULTO (sin ventana)
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File "%SCRIPT_DIR%Validate-System-Complete.ps1" -OutputPath "%REPORT_FILE%"

REM Esperar 2 segundos para asegurar que el archivo se generó
timeout /t 2 /nobreak >nul

REM Abrir el reporte en Notepad
if exist "%REPORT_FILE%" (
    start notepad.exe "%REPORT_FILE%"
) else (
    REM Si no se generó el reporte, mostrar mensaje de error
    echo No se pudo generar el reporte. Verifica que el script PowerShell existe.
    pause
)

exit

