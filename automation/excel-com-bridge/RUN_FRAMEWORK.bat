@echo off
title Excel COM Bridge - .NET Framework 4.8

echo ========================================
echo   Excel COM Bridge - .NET Framework
echo ========================================
echo.

REM Buscar MSBuild (viene con Visual Studio o Build Tools)
set MSBUILD_PATH=

REM Buscar en ubicaciones comunes de Visual Studio 2022
if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" (
    set MSBUILD_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe
    goto :MSBuildFound
)

if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe" (
    set MSBUILD_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe
    goto :MSBuildFound
)

if exist "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe" (
    set MSBUILD_PATH=%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe
    goto :MSBuildFound
)

REM Buscar en Visual Studio 2019
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe" (
    set MSBUILD_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe
    goto :MSBuildFound
)

REM Buscar en Build Tools
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe" (
    set MSBUILD_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe
    goto :MSBuildFound
)

echo [ERROR] MSBuild no encontrado
echo.
echo Necesitas instalar:
echo 1. Visual Studio 2022 Community (gratis)
echo    https://visualstudio.microsoft.com/downloads/
echo.
echo 2. O Build Tools for Visual Studio 2022
echo    https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
echo.
echo Durante la instalacion, selecciona:
echo - ".NET desktop development"
echo - ".NET Framework 4.8 targeting pack"
echo.
pause
exit /b 1

:MSBuildFound
echo [OK] MSBuild encontrado
echo [INFO] Ruta: %MSBUILD_PATH%
echo.

REM Buscar archivo Excel
set EXCEL_FILENAME=ARBITRAGEXPLUS2025.xlsx
set EXCEL_PATH=

for %%L in (
    "%~dp0..\..\data\%EXCEL_FILENAME%"
    "%USERPROFILE%\Downloads\%EXCEL_FILENAME%"
    "%USERPROFILE%\Documents\%EXCEL_FILENAME%"
    "%USERPROFILE%\Desktop\%EXCEL_FILENAME%"
) do (
    if exist %%L (
        set EXCEL_PATH=%%~fL
        echo [OK] Excel encontrado: !EXCEL_PATH!
        goto :ExcelFound
    )
)

:ExcelFound

if "%EXCEL_PATH%"=="" (
    echo [WARN] Excel no encontrado automaticamente
    echo [INFO] Se pedira seleccionar manualmente al ejecutar
    echo.
)

echo [INFO] Compilando con MSBuild...
echo.
echo [DEBUG] Proyecto: ExcelComBridge-Framework.csproj
echo [DEBUG] MSBuild: %MSBUILD_PATH%
echo.

"%MSBUILD_PATH%" "%~dp0ExcelComBridge-Framework.csproj" /p:Configuration=Release /p:Platform="Any CPU" /v:minimal /t:Rebuild

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error en compilacion
    pause
    exit /b 1
)

echo.
echo [OK] Compilacion exitosa
echo.

echo [INFO] Ejecutando...
echo.

if "%EXCEL_PATH%"=="" (
    bin\Release\ExcelComBridge.exe
) else (
    bin\Release\ExcelComBridge.exe "%EXCEL_PATH%"
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error al ejecutar
    pause
)

