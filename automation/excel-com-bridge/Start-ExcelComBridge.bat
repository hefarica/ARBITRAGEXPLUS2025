@echo off
REM Start-ExcelComBridge.bat
REM Script batch para ejecutar el PowerShell script

echo ========================================
echo   Excel COM Bridge - ARBITRAGEXPLUS2025
echo ========================================
echo.

REM Obtener directorio del script
set SCRIPT_DIR=%~dp0

REM Ejecutar PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start-ExcelComBridge.ps1" %*

REM Pausar si hubo error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Presiona cualquier tecla para salir...
    pause >nul
)

