# ============================================================================
# ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization Script
# Script de PowerShell para Windows
# ============================================================================

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Obtener el directorio donde está este script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "📁 Directorio del script: $ScriptDir" -ForegroundColor Yellow
Write-Host ""

# Cambiar al directorio del proyecto
Set-Location $ScriptDir
Write-Host "✅ Cambiado al directorio del proyecto" -ForegroundColor Green
Write-Host ""

# Verificar que existe el archivo de credenciales
$CredentialsPath = Join-Path $ScriptDir "keys\gsheets-sa.json"
if (-Not (Test-Path $CredentialsPath)) {
    Write-Host "❌ ERROR: No se encontró el archivo de credenciales" -ForegroundColor Red
    Write-Host "   Ubicación esperada: $CredentialsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Por favor:" -ForegroundColor Yellow
    Write-Host "   1. Crea la carpeta 'keys' en el directorio del proyecto" -ForegroundColor Yellow
    Write-Host "   2. Descarga el archivo JSON del Service Account desde Google Cloud Console" -ForegroundColor Yellow
    Write-Host "   3. Guárdalo como 'keys\gsheets-sa.json'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Archivo de credenciales encontrado" -ForegroundColor Green
Write-Host ""

# Verificar que existe el script de Node.js
$NodeScriptPath = Join-Path $ScriptDir "scripts\init-google-sheet-brain.js"
if (-Not (Test-Path $NodeScriptPath)) {
    Write-Host "❌ ERROR: No se encontró el script de inicialización" -ForegroundColor Red
    Write-Host "   Ubicación esperada: $NodeScriptPath" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Script de inicialización encontrado" -ForegroundColor Green
Write-Host ""

# Verificar que Node.js está instalado
try {
    $NodeVersion = node --version
    Write-Host "✅ Node.js instalado: $NodeVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ ERROR: Node.js no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Por favor instala Node.js desde: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar que googleapis está instalado
Write-Host "🔍 Verificando dependencias de Node.js..." -ForegroundColor Yellow
$PackageJsonPath = Join-Path $ScriptDir "package.json"
if (Test-Path $PackageJsonPath) {
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    npm install googleapis --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencias instaladas correctamente" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  Advertencia: Hubo un problema instalando dependencias" -ForegroundColor Yellow
        Write-Host ""
    }
}

# Configurar variables de entorno
$env:GOOGLE_APPLICATION_CREDENTIALS = ".\keys\gsheets-sa.json"
$env:SPREADSHEET_ID = "1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ"

Write-Host "🔐 Variables de entorno configuradas:" -ForegroundColor Cyan
Write-Host "   GOOGLE_APPLICATION_CREDENTIALS = $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
Write-Host "   SPREADSHEET_ID = $env:SPREADSHEET_ID" -ForegroundColor Gray
Write-Host ""

# Mostrar información del spreadsheet
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  Información del Google Sheet" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Spreadsheet ID: $env:SPREADSHEET_ID" -ForegroundColor Yellow
Write-Host "🔗 URL: https://docs.google.com/spreadsheets/d/$env:SPREADSHEET_ID/edit" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Se crearán 13 hojas maestras con 1016+ campos:" -ForegroundColor Yellow
Write-Host "   1. BLOCKCHAINS    (50 campos)  - Redes blockchain" -ForegroundColor Gray
Write-Host "   2. DEXES          (200 campos) - Exchanges descentralizados" -ForegroundColor Gray
Write-Host "   3. ASSETS         (400 campos) - Tokens y precios" -ForegroundColor Gray
Write-Host "   4. POOLS          (100 campos) - Pools de liquidez" -ForegroundColor Gray
Write-Host "   5. ROUTES         (200 campos) - Rutas de arbitraje" -ForegroundColor Gray
Write-Host "   6. EXECUTIONS     (50 campos)  - Operaciones ejecutadas" -ForegroundColor Gray
Write-Host "   7. CONFIG         (7 campos)   - Configuración global" -ForegroundColor Gray
Write-Host "   8. ALERTS         (9 campos)   - Sistema de alertas" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Preguntar confirmación
Write-Host "⚠️  IMPORTANTE: Asegúrate de haber compartido el spreadsheet con el Service Account" -ForegroundColor Yellow
Write-Host ""
$Confirmation = Read-Host "¿Deseas continuar con la inicialización? (S/N)"

if ($Confirmation -ne "S" -and $Confirmation -ne "s") {
    Write-Host ""
    Write-Host "❌ Operación cancelada por el usuario" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 0
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  Ejecutando script de inicialización..." -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Ejecutar el script de Node.js
node scripts\init-google-sheet-brain.js

# Verificar el resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "  ✅ GOOGLE SHEET BRAIN INICIALIZADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Las 13 hojas maestras han sido creadas con éxito!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Puedes ver el spreadsheet aquí:" -ForegroundColor Yellow
    Write-Host "   https://docs.google.com/spreadsheets/d/$env:SPREADSHEET_ID/edit" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Próximos pasos:" -ForegroundColor Yellow
    Write-Host "   1. Abre el spreadsheet en tu navegador" -ForegroundColor Gray
    Write-Host "   2. Verifica que las 13 hojas estén creadas" -ForegroundColor Gray
    Write-Host "   3. Configura datos iniciales en BLOCKCHAINS y CONFIG" -ForegroundColor Gray
    Write-Host "   4. Inicia los servicios del sistema" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host "  ❌ ERROR EN LA INICIALIZACIÓN" -ForegroundColor Red
    Write-Host "============================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  Posibles causas:" -ForegroundColor Yellow
    Write-Host "   1. El Service Account no tiene acceso al spreadsheet" -ForegroundColor Gray
    Write-Host "   2. Google Sheets API no está habilitada" -ForegroundColor Gray
    Write-Host "   3. Las credenciales son inválidas" -ForegroundColor Gray
    Write-Host "   4. El SPREADSHEET_ID es incorrecto" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📝 Revisa el archivo CONFIGURAR_GOOGLE_SHEET.md para más detalles" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Read-Host "Presiona Enter para salir"

