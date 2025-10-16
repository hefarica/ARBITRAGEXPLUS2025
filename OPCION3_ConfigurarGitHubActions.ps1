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
