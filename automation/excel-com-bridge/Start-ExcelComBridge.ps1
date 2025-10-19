# Start-ExcelComBridge.ps1
# Script para ejecutar Excel COM Bridge desde cualquier ubicación
# Busca automáticamente el archivo ARBITRAGEXPLUS2025.xlsx o permite seleccionarlo manualmente

param(
    [switch]$SkipBuild,
    [switch]$ForceDialog
)

# Configuración
$ExcelFileName = "ARBITRAGEXPLUS2025.xlsx"
$ProjectName = "ExcelComBridge"

# Colores para output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Banner
Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "  Excel COM Bridge - ARBITRAGEXPLUS2025" "Cyan"
Write-ColorOutput "========================================" "Cyan"
Write-Host ""

# 1. Buscar directorio del proyecto
Write-ColorOutput "🔍 Buscando directorio del proyecto..." "Yellow"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = $ScriptDir

# Verificar si estamos en el directorio correcto
if (-not (Test-Path (Join-Path $ProjectDir "$ProjectName.csproj"))) {
    # Buscar el proyecto en el sistema
    Write-ColorOutput "⚠️  No estamos en el directorio del proyecto" "Yellow"
    Write-ColorOutput "🔍 Buscando proyecto en el sistema..." "Yellow"
    
    # Buscar en ubicaciones comunes
    $CommonLocations = @(
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE\Desktop",
        "C:\Projects",
        "D:\Projects"
    )
    
    $Found = $false
    foreach ($Location in $CommonLocations) {
        if (Test-Path $Location) {
            $SearchResult = Get-ChildItem -Path $Location -Filter "$ProjectName.csproj" -Recurse -ErrorAction SilentlyContinue -Depth 5 | Select-Object -First 1
            if ($SearchResult) {
                $ProjectDir = Split-Path -Parent $SearchResult.FullName
                Write-ColorOutput "✅ Proyecto encontrado en: $ProjectDir" "Green"
                $Found = $true
                break
            }
        }
    }
    
    if (-not $Found) {
        Write-ColorOutput "❌ No se pudo encontrar el proyecto $ProjectName" "Red"
        Write-ColorOutput "Por favor, ejecuta este script desde la carpeta del proyecto o especifica la ruta" "Red"
        exit 1
    }
}
else {
    Write-ColorOutput "✅ Directorio del proyecto: $ProjectDir" "Green"
}

Write-Host ""

# 2. Buscar archivo Excel
Write-ColorOutput "🔍 Buscando archivo Excel: $ExcelFileName" "Yellow"

$ExcelPath = $null

if (-not $ForceDialog) {
    # Buscar en ubicaciones comunes
    $SearchLocations = @(
        # Relativo al proyecto
        (Join-Path (Split-Path -Parent (Split-Path -Parent $ProjectDir)) "data\$ExcelFileName"),
        (Join-Path (Split-Path -Parent $ProjectDir) "data\$ExcelFileName"),
        (Join-Path $ProjectDir "data\$ExcelFileName"),
        
        # Ubicaciones del usuario
        (Join-Path $env:USERPROFILE "Downloads\$ExcelFileName"),
        (Join-Path $env:USERPROFILE "Documents\$ExcelFileName"),
        (Join-Path $env:USERPROFILE "Desktop\$ExcelFileName"),
        
        # Búsqueda en todo el perfil del usuario
        (Get-ChildItem -Path $env:USERPROFILE -Filter $ExcelFileName -Recurse -ErrorAction SilentlyContinue -Depth 5 | Select-Object -First 1).FullName
    )
    
    foreach ($Location in $SearchLocations) {
        if ($Location -and (Test-Path $Location)) {
            $ExcelPath = $Location
            Write-ColorOutput "✅ Excel encontrado: $ExcelPath" "Green"
            break
        }
    }
}

# Si no se encontró o se forzó el diálogo, abrir selector de archivos
if (-not $ExcelPath -or $ForceDialog) {
    Write-ColorOutput "📂 Abriendo selector de archivos..." "Yellow"
    Write-Host ""
    Write-ColorOutput "Por favor, selecciona el archivo $ExcelFileName" "Cyan"
    
    Add-Type -AssemblyName System.Windows.Forms
    $OpenFileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $OpenFileDialog.Title = "Selecciona el archivo Excel"
    $OpenFileDialog.Filter = "Archivos Excel (*.xlsx)|*.xlsx|Todos los archivos (*.*)|*.*"
    $OpenFileDialog.FileName = $ExcelFileName
    
    # Intentar abrir en la carpeta del usuario
    if (Test-Path $env:USERPROFILE) {
        $OpenFileDialog.InitialDirectory = $env:USERPROFILE
    }
    
    $Result = $OpenFileDialog.ShowDialog()
    
    if ($Result -eq [System.Windows.Forms.DialogResult]::OK) {
        $ExcelPath = $OpenFileDialog.FileName
        
        # Verificar que el nombre del archivo sea correcto
        $FileName = [System.IO.Path]::GetFileName($ExcelPath)
        if ($FileName -ne $ExcelFileName) {
            Write-ColorOutput "⚠️  Advertencia: El archivo seleccionado no se llama '$ExcelFileName'" "Yellow"
            Write-ColorOutput "   Archivo seleccionado: $FileName" "Yellow"
            
            $Confirm = Read-Host "¿Deseas continuar de todos modos? (S/N)"
            if ($Confirm -notmatch "^[Ss]") {
                Write-ColorOutput "❌ Operación cancelada" "Red"
                exit 1
            }
        }
        
        Write-ColorOutput "✅ Archivo seleccionado: $ExcelPath" "Green"
    }
    else {
        Write-ColorOutput "❌ No se seleccionó ningún archivo" "Red"
        exit 1
    }
}

Write-Host ""

# 3. Compilar el proyecto (si no se especificó -SkipBuild)
if (-not $SkipBuild) {
    Write-ColorOutput "🔨 Compilando proyecto..." "Yellow"
    
    Push-Location $ProjectDir
    
    try {
        $BuildOutput = dotnet build -c Release 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Compilación exitosa" "Green"
        }
        else {
            Write-ColorOutput "❌ Error en la compilación:" "Red"
            Write-Host $BuildOutput
            Pop-Location
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-ColorOutput "⏭️  Omitiendo compilación (usando ejecutable existente)" "Yellow"
}

Write-Host ""

# 4. Ejecutar el proyecto
Write-ColorOutput "🚀 Iniciando Excel COM Bridge..." "Green"
Write-Host ""
Write-ColorOutput "========================================" "Cyan"
Write-Host ""

Push-Location $ProjectDir

try {
    # Configurar variable de entorno
    $env:EXCEL_FILE_PATH = $ExcelPath
    
    # Ejecutar
    dotnet run -c Release --no-build -- "$ExcelPath"
}
finally {
    Pop-Location
}

