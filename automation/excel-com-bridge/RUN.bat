@echo off
setlocal enabledelayedexpansion

REM ========================================
REM Excel COM Bridge - ARBITRAGEXPLUS2025
REM Script de inicio automático
REM ========================================

echo ========================================
echo   Excel COM Bridge - ARBITRAGEXPLUS2025
echo ========================================
echo.

REM Configuración
set EXCEL_FILENAME=ARBITRAGEXPLUS2025.xlsx
set PROJECT_NAME=ExcelComBridge

REM ========================================
REM 1. Buscar directorio del proyecto
REM ========================================

echo [INFO] Buscando directorio del proyecto...

REM Obtener directorio del script
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%

REM Verificar si estamos en el directorio correcto
if not exist "%PROJECT_DIR%%PROJECT_NAME%.csproj" (
    echo [WARN] No estamos en el directorio del proyecto
    echo [INFO] Buscando proyecto en el sistema...
    
    REM Buscar en ubicaciones comunes
    set FOUND=0
    
    REM Buscar en Downloads
    if exist "%USERPROFILE%\Downloads" (
        for /r "%USERPROFILE%\Downloads" %%F in (%PROJECT_NAME%.csproj) do (
            if exist "%%F" (
                set PROJECT_DIR=%%~dpF
                echo [OK] Proyecto encontrado en: !PROJECT_DIR!
                set FOUND=1
                goto :ProjectFound
            )
        )
    )
    
    REM Buscar en Documents
    if exist "%USERPROFILE%\Documents" (
        for /r "%USERPROFILE%\Documents" %%F in (%PROJECT_NAME%.csproj) do (
            if exist "%%F" (
                set PROJECT_DIR=%%~dpF
                echo [OK] Proyecto encontrado en: !PROJECT_DIR!
                set FOUND=1
                goto :ProjectFound
            )
        )
    )
    
    :ProjectFound
    if !FOUND!==0 (
        echo [ERROR] No se pudo encontrar el proyecto %PROJECT_NAME%
        echo Por favor, ejecuta este script desde la carpeta del proyecto
        pause
        exit /b 1
    )
) else (
    echo [OK] Directorio del proyecto: %PROJECT_DIR%
)

echo.

REM ========================================
REM 2. Buscar archivo Excel
REM ========================================

echo [INFO] Buscando archivo Excel: %EXCEL_FILENAME%

set EXCEL_PATH=
set EXCEL_FOUND=0

REM Buscar en ubicaciones comunes (relativas al proyecto)
for %%L in (
    "%PROJECT_DIR%..\..\data\%EXCEL_FILENAME%"
    "%PROJECT_DIR%..\data\%EXCEL_FILENAME%"
    "%PROJECT_DIR%data\%EXCEL_FILENAME%"
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

REM Buscar recursivamente en Downloads (limitado a 2 niveles)
if exist "%USERPROFILE%\Downloads" (
    echo [INFO] Buscando en Downloads...
    for /r "%USERPROFILE%\Downloads" %%F in (%EXCEL_FILENAME%) do (
        if exist "%%F" (
            set EXCEL_PATH=%%F
            echo [OK] Excel encontrado: !EXCEL_PATH!
            set EXCEL_FOUND=1
            goto :ExcelFound
        )
    )
)

:ExcelFound

REM Si no se encontró, abrir diálogo de selección
if !EXCEL_FOUND!==0 (
    echo [WARN] No se encontro el archivo automaticamente
    echo [INFO] Abriendo selector de archivos...
    echo.
    echo Por favor, selecciona el archivo %EXCEL_FILENAME%
    echo.
    
    REM Crear script VBS temporal para abrir diálogo
    set TEMP_VBS=%TEMP%\OpenFileDialog_%RANDOM%.vbs
    
    echo Set objDialog = CreateObject^("SAFRDialogs.FileSave"^) > "!TEMP_VBS!"
    echo objDialog.FileName = "%EXCEL_FILENAME%" >> "!TEMP_VBS!"
    echo objDialog.FileType = "Archivos Excel (*.xlsx)|*.xlsx|Todos los archivos (*.*)|*.*" >> "!TEMP_VBS!"
    echo If objDialog.Show Then >> "!TEMP_VBS!"
    echo     WScript.Echo objDialog.FileName >> "!TEMP_VBS!"
    echo End If >> "!TEMP_VBS!"
    
    REM Intentar con SAFRDialogs (si está disponible)
    for /f "delims=" %%F in ('cscript //nologo "!TEMP_VBS!" 2^>nul') do set EXCEL_PATH=%%F
    
    REM Si SAFRDialogs no funciona, usar método alternativo con PowerShell
    if "!EXCEL_PATH!"=="" (
        echo [INFO] Usando PowerShell para abrir dialogo...
        
        set TEMP_PS1=%TEMP%\OpenFileDialog_%RANDOM%.ps1
        
        echo Add-Type -AssemblyName System.Windows.Forms > "!TEMP_PS1!"
        echo $OpenFileDialog = New-Object System.Windows.Forms.OpenFileDialog >> "!TEMP_PS1!"
        echo $OpenFileDialog.Title = "Selecciona el archivo Excel" >> "!TEMP_PS1!"
        echo $OpenFileDialog.Filter = "Archivos Excel (*.xlsx)|*.xlsx|Todos los archivos (*.*)|*.*" >> "!TEMP_PS1!"
        echo $OpenFileDialog.FileName = "%EXCEL_FILENAME%" >> "!TEMP_PS1!"
        echo if ($env:USERPROFILE) { $OpenFileDialog.InitialDirectory = $env:USERPROFILE } >> "!TEMP_PS1!"
        echo $Result = $OpenFileDialog.ShowDialog() >> "!TEMP_PS1!"
        echo if ($Result -eq [System.Windows.Forms.DialogResult]::OK) { >> "!TEMP_PS1!"
        echo     Write-Output $OpenFileDialog.FileName >> "!TEMP_PS1!"
        echo } >> "!TEMP_PS1!"
        
        for /f "delims=" %%F in ('powershell -ExecutionPolicy Bypass -File "!TEMP_PS1!" 2^>nul') do set EXCEL_PATH=%%F
        
        del "!TEMP_PS1!" 2>nul
    )
    
    del "!TEMP_VBS!" 2>nul
    
    if "!EXCEL_PATH!"=="" (
        echo [ERROR] No se selecciono ningun archivo
        pause
        exit /b 1
    )
    
    echo [OK] Archivo seleccionado: !EXCEL_PATH!
)

REM Verificar que el archivo existe
if not exist "!EXCEL_PATH!" (
    echo [ERROR] El archivo no existe: !EXCEL_PATH!
    pause
    exit /b 1
)

echo.

REM ========================================
REM 3. Compilar el proyecto
REM ========================================

echo [INFO] Compilando proyecto...

cd /d "%PROJECT_DIR%"

dotnet build -c Release >nul 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error en la compilacion
    echo.
    echo Ejecutando compilacion con detalles...
    dotnet build -c Release
    pause
    exit /b 1
)

echo [OK] Compilacion exitosa

echo.

REM ========================================
REM 4. Ejecutar el proyecto
REM ========================================

echo [INFO] Iniciando Excel COM Bridge...
echo.
echo ========================================
echo.

REM Configurar variable de entorno
set EXCEL_FILE_PATH=!EXCEL_PATH!

REM Ejecutar
dotnet run -c Release --no-build -- "!EXCEL_PATH!"

REM Si hubo error, pausar
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] El programa termino con errores
    pause
)

