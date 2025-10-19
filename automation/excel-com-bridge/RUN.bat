@echo off
setlocal enabledelayedexpansion

title Excel COM Bridge - ARBITRAGEXPLUS2025

echo ========================================
echo   Excel COM Bridge - ARBITRAGEXPLUS2025
echo ========================================
echo.

REM Verificar que .NET está instalado
echo [INFO] Verificando .NET SDK...
dotnet --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] .NET SDK no esta instalado
    echo.
    echo Por favor, instala .NET 8.0 SDK desde:
    echo https://dotnet.microsoft.com/download
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('dotnet --version 2^>nul') do set DOTNET_VERSION=%%v
echo [OK] .NET SDK version: %DOTNET_VERSION%
echo.

set EXCEL_FILENAME=ARBITRAGEXPLUS2025.xlsx
set PROJECT_NAME=ExcelComBridge

echo [INFO] Buscando directorio del proyecto...
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%

if not exist "%PROJECT_DIR%%PROJECT_NAME%.csproj" (
    echo [ERROR] No se encontro %PROJECT_NAME%.csproj
    echo.
    echo Por favor, ejecuta este script desde:
    echo automation\excel-com-bridge\
    echo.
    pause
    exit /b 1
)

echo [OK] Proyecto encontrado
echo.

echo [INFO] Buscando archivo Excel: %EXCEL_FILENAME%
echo.

set EXCEL_PATH=
set EXCEL_FOUND=0

for %%L in (
    "%PROJECT_DIR%..\..\data\%EXCEL_FILENAME%"
    "%USERPROFILE%\Downloads\%EXCEL_FILENAME%"
    "%USERPROFILE%\Documents\%EXCEL_FILENAME%"
    "%USERPROFILE%\Desktop\%EXCEL_FILENAME%"
) do (
    if exist %%L (
        set EXCEL_PATH=%%~fL
        echo [OK] Excel encontrado: !EXCEL_PATH!
        set EXCEL_FOUND=1
        goto :ExcelFound
    )
)

:ExcelFound

if !EXCEL_FOUND!==0 (
    echo [WARN] No se encontro automaticamente
    echo [INFO] Abriendo selector de archivos...
    echo.
    pause
    
    set TEMP_PS1=%TEMP%\OpenFileDialog_%RANDOM%.ps1
    
    echo Add-Type -AssemblyName System.Windows.Forms > "!TEMP_PS1!"
    echo $d = New-Object System.Windows.Forms.OpenFileDialog >> "!TEMP_PS1!"
    echo $d.Title = "Selecciona ARBITRAGEXPLUS2025.xlsx" >> "!TEMP_PS1!"
    echo $d.Filter = "Excel (*.xlsx)|*.xlsx" >> "!TEMP_PS1!"
    echo if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName } >> "!TEMP_PS1!"
    
    for /f "delims=" %%F in ('powershell -ExecutionPolicy Bypass -File "!TEMP_PS1!"') do set EXCEL_PATH=%%F
    
    del "!TEMP_PS1!" 2>nul
    
    if "!EXCEL_PATH!"=="" (
        echo [ERROR] No se selecciono archivo
        pause
        exit /b 1
    )
    
    echo [OK] Seleccionado: !EXCEL_PATH!
)

if not exist "!EXCEL_PATH!" (
    echo [ERROR] Archivo no existe
    pause
    exit /b 1
)

echo.
echo [INFO] Compilando proyecto...
echo.

cd /d "%PROJECT_DIR%"
dotnet build -c Release

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error en compilacion
    pause
    exit /b 1
)

echo.
echo [OK] Compilacion exitosa
echo.
echo ========================================
echo   INICIANDO EXCEL COM BRIDGE
echo ========================================
echo.

set EXCEL_FILE_PATH=!EXCEL_PATH!
dotnet run -c Release --no-build -- "!EXCEL_PATH!"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error al ejecutar
    pause
)
