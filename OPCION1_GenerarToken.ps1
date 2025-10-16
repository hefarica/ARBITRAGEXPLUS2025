# OPCION 1: Generar FLY_API_TOKEN (IDEMPOTENTE v2.0)
# Compatible con Windows PowerShell

param([switch]$Force, [switch]$Silent)
$ErrorActionPreference = "Stop"

$APP_NAME = "arbitragexplus-api"
$TOKEN_NAME = "MANU_DEPLOY_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$TOKEN_FILE = "$env:USERPROFILE\Desktop\FLY_API_TOKEN.txt"
$LOG_FILE = "$env:USERPROFILE\Desktop\fly_deployment.log"

function Write-Log { 
    param($Msg, $Level="INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts [$Level] $Msg" | Out-File -Append $LOG_FILE
    switch($Level) {
        "ERROR" { Write-Host "[ERROR] $Msg" -ForegroundColor Red }
        "SUCCESS" { Write-Host "[OK] $Msg" -ForegroundColor Green }
        "WARNING" { Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
        default { Write-Host "[INFO] $Msg" -ForegroundColor Cyan }
    }
}

Write-Host "`n========== OPCION 1: Generar Token ==========" -ForegroundColor Cyan
Write-Log "Iniciando generacion de token"

# Paso 1: Verificar flyctl
Write-Log "Verificando flyctl..."
if (!(Get-Command flyctl -ErrorAction SilentlyContinue)) {
    Write-Log "Instalando flyctl..." "WARNING"
    try {
        iwr https://fly.io/install.ps1 -useb | iex
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        if (!(Get-Command flyctl -ErrorAction SilentlyContinue)) {
            throw "flyctl no disponible despues de instalacion"
        }
        Write-Log "flyctl instalado" "SUCCESS"
    } catch {
        Write-Log "Error instalando flyctl: $_" "ERROR"
        Write-Host "`nInstala manualmente: iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Yellow
        if (!$Silent) { Read-Host "Presiona Enter" }
        exit 1
    }
} else {
    Write-Log "flyctl ya instalado" "SUCCESS"
}

# Paso 2: Autenticacion
Write-Log "Verificando autenticacion..."
$auth = flyctl auth whoami 2>&1 | Out-String
if ($auth -match "Email:\s+(.+)") {
    Write-Log "Autenticado como: $($matches[1])" "SUCCESS"
} else {
    Write-Log "Autenticando..." "WARNING"
    flyctl auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Autenticacion fallida" "ERROR"
        if (!$Silent) { Read-Host "Presiona Enter" }
        exit 1
    }
    Write-Log "Autenticacion exitosa" "SUCCESS"
}

# Paso 3: Verificar/crear app
Write-Log "Verificando app $APP_NAME..."
$apps = flyctl apps list --json 2>&1 | ConvertFrom-Json
if (!($apps | Where-Object {$_.Name -eq $APP_NAME})) {
    Write-Log "Creando app $APP_NAME..." "WARNING"
    flyctl apps create $APP_NAME --json 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "App creada" "SUCCESS"
    } else {
        Write-Log "Error creando app" "ERROR"
        if (!$Silent) { Read-Host "Presiona Enter" }
        exit 1
    }
} else {
    Write-Log "App ya existe" "SUCCESS"
}

# Paso 4: Generar token
Write-Log "Generando token..."
$tokenOut = flyctl tokens create deploy --app $APP_NAME --name $TOKEN_NAME --expiry 8760h 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Log "Error generando token: $tokenOut" "ERROR"
    if (!$Silent) { Read-Host "Presiona Enter" }
    exit 1
}

# Extraer token
if ($tokenOut -match "(FlyV1\s+[A-Za-z0-9+/=_-]+|[A-Za-z0-9+/=_-]{100,})") {
    $token = $matches[1].Trim()
    Write-Log "Token generado exitosamente" "SUCCESS"
    
    # Guardar
    @"
FLY_API_TOKEN (Generado: $(Get-Date))
App: $APP_NAME
Nombre: $TOKEN_NAME

$token
"@ | Out-File $TOKEN_FILE -Encoding UTF8
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "TOKEN GENERADO:" -ForegroundColor Green
    Write-Host $token -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nGuardado en: $TOKEN_FILE" -ForegroundColor Cyan
    
    # Copiar al portapapeles
    try { Set-Clipboard $token; Write-Log "Token copiado al portapapeles" "SUCCESS" } catch {}
    
    Write-Log "Proceso completado exitosamente" "SUCCESS"
} else {
    Write-Log "No se pudo extraer el token" "ERROR"
    if (!$Silent) { Read-Host "Presiona Enter" }
    exit 1
}

if (!$Silent) { Read-Host "`nPresiona Enter para salir" }
exit 0
