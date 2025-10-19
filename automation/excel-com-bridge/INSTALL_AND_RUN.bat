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
echo [1/5] Verificando ejecutable...

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
echo [2/5] Verificando MSBuild...

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

if not "%MSBUILD_PATH%"=="" (
    echo [OK] MSBuild encontrado: %MSBUILD_PATH%
    echo.
    goto :CLEAN_BUILD
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
REM Paso 3: Limpiar compilaciones anteriores
REM ========================================
:CLEAN_BUILD
echo [3/5] Limpiando compilaciones anteriores...
echo.

REM Eliminar carpetas bin y obj si existen
if exist "bin" (
    echo [INFO] Eliminando carpeta bin...
    rmdir /s /q "bin" 2>nul
)

if exist "obj" (
    echo [INFO] Eliminando carpeta obj...
    rmdir /s /q "obj" 2>nul
)

echo [OK] Limpieza completada
echo.

REM ========================================
REM Paso 4: Compilar el proyecto
REM ========================================
:COMPILE
echo [4/5] Compilando proyecto...
echo.
echo [INFO] Configuracion: Release
echo [INFO] Plataforma: AnyCPU
echo.

REM Compilar con AnyCPU (sin espacio) para evitar errores de OutputPath
"%MSBUILD_PATH%" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform=AnyCPU /t:Rebuild /v:minimal /nologo

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error en compilacion
    echo.
    echo Intentando con plataforma x86...
    echo.
    
    REM Intentar con x86 como fallback
    "%MSBUILD_PATH%" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform=x86 /t:Rebuild /v:minimal /nologo
    
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Error en compilacion con ambas plataformas
        echo.
        echo Para ver detalles del error, ejecuta:
        echo RUN_DEBUG.bat
        echo.
        pause
        goto :EOF
    )
)

echo.
echo [OK] Compilacion exitosa
echo.

REM Verificar que el ejecutable se creo
if not exist "bin\Release\ExcelComBridge.exe" (
    echo [ERROR] El ejecutable no se genero correctamente
    echo.
    echo Verifica que el proyecto se compilo sin errores
    echo.
    pause
    goto :EOF
)

REM ========================================
REM Paso 5: Ejecutar el programa
REM ========================================
:RUN_EXECUTABLE
echo [5/5] Ejecutando Excel COM Bridge...
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
    "..\..\data\ARBITRAGEXPLUS2025.xlsm"
    "..\..\..\data\ARBITRAGEXPLUS2025.xlsm"
    "data\ARBITRAGEXPLUS2025.xlsm"
    "ARBITRAGEXPLUS2025.xlsm"
) do (
    if exist %%p (
        set "EXCEL_FILE=%%~fp"
        goto :FOUND_EXCEL
    )
)

REM No encontrado - Pedir al usuario
echo [INFO] Archivo Excel no encontrado automaticamente
echo.
echo Por favor selecciona el archivo ARBITRAGEXPLUS2025.xlsx o .xlsm
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
echo ========================================
echo   Iniciando monitoreo de Excel
echo ========================================
echo.
echo El programa detectara automaticamente:
echo   - Cambios en columna NAME (hoja BLOCKCHAINS)
echo   - Celdas con color azul (#4472C4)
echo   - Actualizara datos en tiempo real
echo.
echo Presiona Ctrl+C para detener
echo.

REM Ejecutar
"bin\Release\ExcelComBridge.exe" "%EXCEL_FILE%"

echo.
echo [INFO] Programa finalizado
echo.
pause

