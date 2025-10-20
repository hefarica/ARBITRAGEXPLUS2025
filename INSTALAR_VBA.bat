@echo off
setlocal

echo ========================================
echo   ARBITRAGEXPLUS2025
echo   Instalador de Codigo VBA
echo ========================================
echo.

REM Cambiar al directorio del script
PUSHD "%~dp0"

echo Ejecutando instalador de VBA...
echo.

REM Ejecutar PowerShell con permisos
powershell.exe -ExecutionPolicy Bypass -File "%~dp0INSTALAR_VBA.ps1"

POPD
pause

