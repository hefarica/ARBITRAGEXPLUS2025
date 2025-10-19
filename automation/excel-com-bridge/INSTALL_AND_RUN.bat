@echo off
title Excel COM Bridge - Instalador Automatico
setlocal enabledelayedexpansion

echo ========================================
echo   Excel COM Bridge - Instalador
echo ========================================
echo.

REM ========================================
REM Paso 1: Verificar si ya existe el ejecutable
REM ========================================
echo [1/4] Verificando ejecutable...

if exist "bin\Release\ExcelComBridge.exe" (
    echo [OK] Ejecutable encontrado
    echo.
    goto :RUN_EXECUTABLE
)

echo [INFO] Ejecutable no encontrado, se compilara
echo.

REM ========================================
REM Paso 2: Verificar/Instalar MSBuild
REM ========================================
echo [2/4] Verificando MSBuild...

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

if not "%MSBUILD_PATH%"=="" (
    echo [OK] MSBuild encontrado
    echo.
    goto :COMPILE
)

REM MSBuild no encontrado - Ofrecer instalacion
echo [INFO] MSBuild no encontrado
echo.
echo Para compilar el proyecto necesitas Visual Studio Build Tools 2022
echo.
echo Opciones:
echo   1. Descargar e instalar automaticamente (recomendado)
echo   2. Descargar manualmente
echo   3. Salir
echo.
set /p choice="Selecciona una opcion (1-3): "

if "%choice%"=="1" goto :AUTO_INSTALL_BUILDTOOLS
if "%choice%"=="2" goto :MANUAL_INSTALL_BUILDTOOLS
goto :EOF

:AUTO_INSTALL_BUILDTOOLS
echo.
echo [INFO] Descargando Visual Studio Build Tools 2022...
echo.

REM Crear carpeta temporal
if not exist "%TEMP%\ExcelComBridge" mkdir "%TEMP%\ExcelComBridge"
cd /d "%TEMP%\ExcelComBridge"

REM Descargar instalador
powershell -Command "& {Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile 'vs_BuildTools.exe'}"

if not exist "vs_BuildTools.exe" (
    echo [ERROR] No se pudo descargar el instalador
    echo.
    echo Por favor descarga manualmente desde:
    echo https://aka.ms/vs/17/release/vs_BuildTools.exe
    echo.
    pause
    goto :EOF
)

echo [OK] Descarga completada
echo.
echo [INFO] Ejecutando instalador...
echo.
echo IMPORTANTE:
echo   1. En el instalador, selecciona ".NET desktop development"
echo   2. Espera a que termine la instalacion (10-30 minutos)
echo   3. Reinicia este script despues de la instalacion
echo.
pause

start /wait vs_BuildTools.exe

echo.
echo [INFO] Instalacion completada
echo [INFO] Por favor reinicia este script
echo.
pause
goto :EOF

:MANUAL_INSTALL_BUILDTOOLS
echo.
echo Descarga Visual Studio Build Tools 2022 desde:
echo https://aka.ms/vs/17/release/vs_BuildTools.exe
echo.
echo Durante la instalacion, selecciona ".NET desktop development"
echo.
echo Despues de instalar, ejecuta este script nuevamente
echo.
pause
goto :EOF

REM ========================================
REM Paso 3: Compilar el proyecto
REM ========================================
:COMPILE
echo [3/4] Compilando proyecto...
echo.

"%MSBUILD_PATH%" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform="Any CPU" /t:Rebuild /v:minimal

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error en compilacion
    echo.
    echo Ejecuta RUN_DEBUG.bat para ver detalles del error
    echo.
    pause
    goto :EOF
)

echo.
echo [OK] Compilacion exitosa
echo.

REM ========================================
REM Paso 4: Ejecutar el programa
REM ========================================
:RUN_EXECUTABLE
echo [4/4] Ejecutando Excel COM Bridge...
echo.

if not exist "bin\Release\ExcelComBridge.exe" (
    echo [ERROR] No se encuentra el ejecutable
    echo.
    pause
    goto :EOF
)

REM Buscar archivo Excel
set "EXCEL_FILE="

REM Buscar en ubicaciones comunes
for %%p in (
    "..\..\data\ARBITRAGEXPLUS2025.xlsx"
    "..\..\..\data\ARBITRAGEXPLUS2025.xlsx"
    "data\ARBITRAGEXPLUS2025.xlsx"
    "ARBITRAGEXPLUS2025.xlsx"
) do (
    if exist %%p (
        set "EXCEL_FILE=%%~fp"
        goto :FOUND_EXCEL
    )
)

REM No encontrado - Pedir al usuario
echo [INFO] Archivo Excel no encontrado automaticamente
echo.
echo Por favor selecciona el archivo ARBITRAGEXPLUS2025.xlsx
echo.
pause

REM Abrir dialogo de seleccion de archivo
powershell -Command "& {Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Excel Files (*.xlsx;*.xlsm)|*.xlsx;*.xlsm'; $f.Title = 'Selecciona ARBITRAGEXPLUS2025.xlsx'; if ($f.ShowDialog() -eq 'OK') { $f.FileName } }" > "%TEMP%\excel_path.txt"

set /p EXCEL_FILE=<"%TEMP%\excel_path.txt"
del "%TEMP%\excel_path.txt"

if "%EXCEL_FILE%"=="" (
    echo [ERROR] No se selecciono archivo
    pause
    goto :EOF
)

:FOUND_EXCEL
echo [OK] Archivo Excel: %EXCEL_FILE%
echo.

REM Ejecutar
"bin\Release\ExcelComBridge.exe" "%EXCEL_FILE%"

echo.
echo [INFO] Programa finalizado
echo.
pause

