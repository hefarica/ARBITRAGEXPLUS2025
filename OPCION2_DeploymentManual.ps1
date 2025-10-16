# OPCION 2: Deployment Manual (IDEMPOTENTE v2.0)
# Compatible con Windows PowerShell

param([string]$RepoPath, [switch]$Silent)
$ErrorActionPreference = "Stop"

$APP_NAME = "arbitragexplus-api"
$LOG_FILE = "$env:USERPROFILE\Desktop\fly_deployment.log"

function Write-Log { 
    param($Msg, $Level="INFO")
    "$((Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) [$Level] $Msg" | Out-File -Append $LOG_FILE
    switch($Level) {
        "ERROR" { Write-Host "[ERROR] $Msg" -ForegroundColor Red }
        "SUCCESS" { Write-Host "[OK] $Msg" -ForegroundColor Green }
        "WARNING" { Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
        default { Write-Host "[INFO] $Msg" -ForegroundColor Cyan }
    }
}

Write-Host "`n========== OPCION 2: Deployment Manual ==========" -ForegroundColor Cyan
Write-Log "Iniciando deployment manual"

# Determinar ruta del repositorio
if (!$RepoPath) {
    $RepoPath = "$env:USERPROFILE\ARBITRAGEXPLUS2025"
    if (!$Silent) {
        Write-Host "Ruta del repositorio (Enter para default): " -NoNewline -ForegroundColor Yellow
        $input = Read-Host
        if ($input) { $RepoPath = $input }
    }
}

# Verificar/clonar repositorio
if (!(Test-Path $RepoPath)) {
    Write-Log "Repositorio no encontrado en $RepoPath" "WARNING"
    if (!$Silent) {
        Write-Host "Clonar repositorio? (S/N): " -NoNewline -ForegroundColor Yellow
        if ((Read-Host) -match "^[Ss]") {
            git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git $RepoPath
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Error clonando repositorio" "ERROR"
                exit 1
            }
        } else {
            Write-Log "Repositorio requerido" "ERROR"
            exit 1
        }
    }
}

Set-Location $RepoPath
Write-Log "Repositorio: $RepoPath" "SUCCESS"

# Verificar flyctl
if (!(Get-Command flyctl -ErrorAction SilentlyContinue)) {
    Write-Log "Instalando flyctl..." "WARNING"
    iwr https://fly.io/install.ps1 -useb | iex
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Autenticacion
$auth = flyctl auth whoami 2>&1 | Out-String
if (!($auth -match "Email")) {
    flyctl auth login
    if ($LASTEXITCODE -ne 0) { Write-Log "Auth fallida" "ERROR"; exit 1 }
}

# Verificar/crear app
$apps = flyctl apps list --json 2>&1 | ConvertFrom-Json
if (!($apps | Where-Object {$_.Name -eq $APP_NAME})) {
    Write-Log "Creando app..." "WARNING"
    flyctl apps create $APP_NAME
}

# Deployment
Write-Host "`nDesplegando en Fly.io..." -ForegroundColor Yellow
flyctl deploy --config fly.toml --dockerfile services/api-server/Dockerfile --app $APP_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Log "Deployment exitoso" "SUCCESS"
    
    $info = flyctl info --app $APP_NAME --json | ConvertFrom-Json
    $url = "https://$($info.Hostname)"
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT EXITOSO" -ForegroundColor Green
    Write-Host "URL: $url" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Green
    
    # Health check
    Start-Sleep 5
    try {
        $health = Invoke-WebRequest "$url/health" -TimeoutSec 10
        if ($health.StatusCode -eq 200) {
            Write-Log "Health check OK" "SUCCESS"
        }
    } catch {
        Write-Log "Health check pendiente (normal en primer deploy)" "WARNING"
    }
} else {
    Write-Log "Deployment fallido" "ERROR"
    Write-Host "`nRevisa logs: flyctl logs --app $APP_NAME" -ForegroundColor Yellow
}

if (!$Silent) { Read-Host "`nPresiona Enter" }
exit 0
