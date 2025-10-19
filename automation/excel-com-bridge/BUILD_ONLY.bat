@echo off
title Excel COM Bridge - Solo Compilacion
setlocal enabledelayedexpansion

echo ========================================
echo   Excel COM Bridge - Solo Compilacion
echo ========================================
echo.

REM ========================================
REM Detectar MSBuild
REM ========================================
echo [1/3] Detectando MSBuild...

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

if exist "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe" (
    set "MSBUILD_PATH=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe"
)

REM Buscar MSBuild en Visual Studio 2019
if "%MSBUILD_PATH%"=="" (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe" (
        set "MSBUILD_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    )
)

if "%MSBUILD_PATH%"=="" (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe" (
        set "MSBUILD_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe"
    )
)

if "%MSBUILD_PATH%"=="" (
    echo [ERROR] MSBuild no encontrado
    echo.
    echo Instala Visual Studio Build Tools 2022:
    echo https://aka.ms/vs/17/release/vs_BuildTools.exe
    echo.
    pause
    goto :EOF
)

echo [OK] MSBuild encontrado
echo.

REM ========================================
REM Limpiar compilaciones anteriores
REM ========================================
echo [2/3] Limpiando compilaciones anteriores...

if exist "bin" (
    rmdir /s /q "bin" 2>nul
)

if exist "obj" (
    rmdir /s /q "obj" 2>nul
)

echo [OK] Limpieza completada
echo.

REM ========================================
REM Compilar el proyecto
REM ========================================
echo [3/3] Compilando proyecto...
echo.

"%MSBUILD_PATH%" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform=AnyCPU /t:Rebuild /v:minimal /nologo

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error en compilacion
    echo.
    echo Ejecuta RUN_DEBUG.bat para ver detalles
    echo.
    pause
    goto :EOF
)

echo.
echo [OK] Compilacion exitosa
echo.

if exist "bin\Release\ExcelComBridge.exe" (
    echo [OK] Ejecutable generado:
    echo      bin\Release\ExcelComBridge.exe
    echo.
    
    REM Mostrar tamaño del archivo
    for %%A in ("bin\Release\ExcelComBridge.exe") do (
        echo      Tamaño: %%~zA bytes
    )
    echo.
) else (
    echo [ERROR] Ejecutable no encontrado
    echo.
)

echo Para ejecutar el programa:
echo   INSTALL_AND_RUN.bat
echo.
pause

