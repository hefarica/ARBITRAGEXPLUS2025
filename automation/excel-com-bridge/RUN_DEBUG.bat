@echo off
title Excel COM Bridge DEBUG

echo ========================================
echo   Excel COM Bridge - DEBUG MODE
echo ========================================
echo.

echo Verificando .NET...
dotnet --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: .NET no instalado
    pause
    exit /b 1
)
echo.

echo Directorio actual: %CD%
echo.

echo Verificando proyecto...
if exist "ExcelComBridge.csproj" (
    echo OK: Proyecto encontrado
) else (
    echo ERROR: No se encuentra ExcelComBridge.csproj
    pause
    exit /b 1
)
echo.

echo Presiona cualquier tecla para compilar...
pause
echo.

echo Compilando...
dotnet build -c Release

echo.
echo Codigo de salida: %ERRORLEVEL%
echo.

pause
