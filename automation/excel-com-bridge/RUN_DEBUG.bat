@echo off
title Excel COM Bridge DEBUG (.NET Framework)

echo ========================================
echo   Excel COM Bridge - DEBUG MODE
echo   .NET Framework 4.8
echo ========================================
echo.

echo Directorio actual: %CD%
echo.

echo Verificando proyecto...
if exist "ExcelComBridge-Framework.csproj" (
    echo OK: Proyecto encontrado
) else (
    echo ERROR: No se encuentra ExcelComBridge-Framework.csproj
    pause
    exit /b 1
)
echo.

echo Buscando MSBuild...
set "MSBUILD_PATH="

REM Buscar MSBuild en Visual Studio 2022
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe" (
    set "MSBUILD_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
)

if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" (
    set "MSBUILD_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
)

if exist "C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe" (
    set "MSBUILD_PATH=C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe"
)

if "%MSBUILD_PATH%"=="" (
    echo ERROR: MSBuild no encontrado
    echo.
    echo Instala Visual Studio Build Tools 2022:
    echo https://aka.ms/vs/17/release/vs_BuildTools.exe
    echo.
    pause
    exit /b 1
)

echo OK: MSBuild encontrado
echo Ruta: %MSBUILD_PATH%
echo.

echo Presiona cualquier tecla para compilar...
pause
echo.

echo Compilando con MSBuild...
echo Proyecto: ExcelComBridge-Framework.csproj
echo.

"%MSBUILD_PATH%" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform="Any CPU" /t:Rebuild /v:detailed

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo   COMPILACION EXITOSA
    echo ========================================
    echo.
    echo Ejecutable generado en:
    echo bin\Release\ExcelComBridge.exe
    echo.
    echo Para ejecutar:
    echo bin\Release\ExcelComBridge.exe
    echo.
) else (
    echo ========================================
    echo   ERROR EN COMPILACION
    echo ========================================
    echo.
    echo Codigo de salida: %ERRORLEVEL%
    echo.
)

pause

