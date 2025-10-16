#!/bin/bash

REPO_DIR="/home/ubuntu/ARBITRAGEXPLUS2025"

echo "Creando scripts PowerShell compatibles con Windows..."

# OPCION 1
cat > "$REPO_DIR/OPCION1_GenerarToken.ps1" << 'EOFPS1'
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
EOFPS1

# OPCION 2
cat > "$REPO_DIR/OPCION2_DeploymentManual.ps1" << 'EOFPS2'
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
EOFPS2

# OPCION 3
cat > "$REPO_DIR/OPCION3_ConfigurarGitHubActions.ps1" << 'EOFPS3'
# OPCION 3: Configurar GitHub Actions (IDEMPOTENTE v2.0)
# Compatible con Windows PowerShell

param([string]$RepoPath, [switch]$Silent)
$ErrorActionPreference = "Stop"

$APP_NAME = "arbitragexplus-api"
$REPO_OWNER = "hefarica"
$REPO_NAME = "ARBITRAGEXPLUS2025"
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

Write-Host "`n========== OPCION 3: GitHub Actions ==========" -ForegroundColor Cyan
Write-Log "Configurando GitHub Actions"

# Verificar gh CLI
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Log "Instalando GitHub CLI..." "WARNING"
    winget install --id GitHub.cli -e
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Auth GitHub
$ghAuth = gh auth status 2>&1 | Out-String
if (!($ghAuth -match "Logged in")) {
    gh auth login
    if ($LASTEXITCODE -ne 0) { Write-Log "GitHub auth fallida" "ERROR"; exit 1 }
}

# Verificar flyctl
if (!(Get-Command flyctl -ErrorAction SilentlyContinue)) {
    iwr https://fly.io/install.ps1 -useb | iex
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Auth Fly.io
$flyAuth = flyctl auth whoami 2>&1 | Out-String
if (!($flyAuth -match "Email")) {
    flyctl auth login
    if ($LASTEXITCODE -ne 0) { Write-Log "Fly auth fallida" "ERROR"; exit 1 }
}

# Generar token
Write-Log "Generando FLY_API_TOKEN..."
$tokenOut = flyctl tokens create deploy --app $APP_NAME --name "GH_ACTIONS_$(Get-Date -Format 'yyyyMMdd')" --expiry 8760h 2>&1 | Out-String
if ($tokenOut -match "([A-Za-z0-9+/=_-]{100,})") {
    $token = $matches[1].Trim()
    Write-Log "Token generado" "SUCCESS"
} else {
    Write-Log "Error generando token" "ERROR"
    exit 1
}

# Configurar secreto
Write-Log "Configurando secreto en GitHub..."
echo $token | gh secret set FLY_API_TOKEN --repo "$REPO_OWNER/$REPO_NAME"
if ($LASTEXITCODE -eq 0) {
    Write-Log "Secreto FLY_API_TOKEN configurado" "SUCCESS"
} else {
    Write-Log "Error configurando secreto" "ERROR"
    exit 1
}

# Verificar workflow
if (!$RepoPath) { $RepoPath = "$env:USERPROFILE\ARBITRAGEXPLUS2025" }
if (Test-Path $RepoPath) {
    Set-Location $RepoPath
    
    $workflowPath = ".github/workflows/deploy.yml"
    if (!(Test-Path $workflowPath)) {
        Write-Log "Creando workflow..." "WARNING"
        New-Item -ItemType Directory -Path ".github/workflows" -Force | Out-Null
        
        @'
name: Deploy to Fly.io
on:
  push:
    branches: [master, main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.toml --dockerfile services/api-server/Dockerfile --app arbitragexplus-api
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
'@ | Out-File $workflowPath -Encoding UTF8
        
        git add $workflowPath
        git commit -m "ci: Add Fly.io deployment workflow"
        git push
        
        Write-Log "Workflow creado y pusheado" "SUCCESS"
    } else {
        Write-Log "Workflow ya existe" "SUCCESS"
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "GITHUB ACTIONS CONFIGURADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nWorkflows: https://github.com/$REPO_OWNER/$REPO_NAME/actions" -ForegroundColor Cyan

if (!$Silent) { Read-Host "`nPresiona Enter" }
exit 0
EOFPS3

echo "Scripts creados exitosamente"
ls -lh "$REPO_DIR"/OPCION*.ps1

