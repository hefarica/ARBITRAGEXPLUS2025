# 🚀 Guía de Deployment - ARBITRAGEXPLUS2025

**Versión:** 2.0.0  
**Fecha:** 17 de Octubre, 2025  
**Estado:** ✅ Listo para Producción

---

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Deployment de Contratos](#deployment-de-contratos)
3. [Configuración de Google Sheets](#configuración-de-google-sheets)
4. [Deployment de API Server](#deployment-de-api-server)
5. [Deployment de TS Executor](#deployment-de-ts-executor)
6. [Configuración de Wallets](#configuración-de-wallets)
7. [Configuración de RPCs](#configuración-de-rpcs)
8. [Verificación Post-Deployment](#verificación-post-deployment)
9. [Monitoreo y Alertas](#monitoreo-y-alertas)
10. [Rollback y Contingencia](#rollback-y-contingencia)

---

## 🔧 Pre-requisitos

### Herramientas Necesarias

```bash
# Node.js y pnpm
node --version  # >= 18.0.0
pnpm --version  # >= 8.0.0

# Foundry (para contratos)
forge --version

# Fly.io CLI
flyctl version

# Git
git --version
```

### Cuentas y Accesos

- ✅ Cuenta de GitHub con permisos de admin en el repositorio
- ✅ Cuenta de Fly.io con organización configurada
- ✅ Cuenta de Google Cloud con proyecto creado
- ✅ Service Account de Google con permisos en Sheets
- ✅ Wallets de Ethereum con fondos para gas
- ✅ Cuentas en RPC providers (Alchemy, Infura, etc.)

### Credenciales Necesarias

```bash
# GitHub
GITHUB_PAT=ghp_...

# Fly.io
FLY_API_TOKEN=...

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./keys/gsheets-sa.json
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com

# Wallets (NUNCA commitear a git)
PRIVATE_KEY_1=0x...
PRIVATE_KEY_2=0x...
PRIVATE_KEY_3=0x...

# RPCs
ALCHEMY_API_KEY=...
INFURA_API_KEY=...
```

---

## 📜 Deployment de Contratos

### 1. Configurar Variables de Entorno

```bash
cd contracts

# Crear .env
cat > .env << EOF
# Deployer wallet
PRIVATE_KEY=0x...

# RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# Etherscan API keys (para verificación)
ETHERSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
ARBISCAN_API_KEY=...
EOF
```

### 2. Compilar Contratos

```bash
# Compilar
forge build

# Verificar que no hay errores
forge test
```

### 3. Deploy en Testnet (Recomendado primero)

```bash
# Sepolia (Ethereum testnet)
forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Guardar las direcciones desplegadas
# FlashLoanArbitrage: 0x...
# BatchExecutor: 0x...
```

### 4. Deploy en Mainnet

```bash
# Ethereum Mainnet
forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow  # Para evitar rate limits

# Polygon
forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
  --rpc-url $POLYGON_RPC_URL \
  --broadcast \
  --verify

# Arbitrum
forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify
```

### 5. Verificar Deployment

```bash
# Verificar en Etherscan
cast call $FLASH_LOAN_ARBITRAGE_ADDRESS "owner()" --rpc-url $ETHEREUM_RPC_URL

# Verificar estado inicial
cast call $FLASH_LOAN_ARBITRAGE_ADDRESS "isPaused()" --rpc-url $ETHEREUM_RPC_URL
# Debe retornar: false (0x0000000000000000000000000000000000000000000000000000000000000000)
```

### 6. Guardar Direcciones

```bash
# Crear archivo de configuración
cat > deployed-contracts.json << EOF
{
  "ethereum": {
    "chainId": 1,
    "flashLoanArbitrage": "0x...",
    "batchExecutor": "0x..."
  },
  "polygon": {
    "chainId": 137,
    "flashLoanArbitrage": "0x...",
    "batchExecutor": "0x..."
  },
  "arbitrum": {
    "chainId": 42161,
    "flashLoanArbitrage": "0x...",
    "batchExecutor": "0x..."
  }
}
EOF
```

---

## 📊 Configuración de Google Sheets

### 1. Crear Service Account

```bash
# En Google Cloud Console
# 1. Ir a IAM & Admin > Service Accounts
# 2. Crear nueva service account: arbitragexplus-sheets
# 3. Descargar JSON key
# 4. Guardar como keys/gsheets-sa.json
```

### 2. Compartir Google Sheet

```bash
# Compartir el sheet con el email de la service account
# Email: arbitragexplus-sheets@PROJECT_ID.iam.gserviceaccount.com
# Permisos: Editor
```

### 3. Verificar Acceso

```bash
cd services/ts-executor

# Crear script de prueba
cat > test-sheets.js << 'EOF'
const { GoogleSheetsClient } = require('./dist/sheets/GoogleSheetsClient');

async function test() {
  const client = new GoogleSheetsClient();
  const routes = await client.getRoutes({ isActive: true });
  console.log(`Found ${routes.length} active routes`);
}

test().catch(console.error);
EOF

# Ejecutar prueba
node test-sheets.js
```

---

## 🌐 Deployment de API Server

### 1. Configurar Fly.io

```bash
# Login
flyctl auth login

# Verificar configuración
flyctl config validate

# Ver configuración actual
cat fly.toml
```

### 2. Configurar Secrets

```bash
# Configurar secrets en Fly.io
flyctl secrets set \
  GOOGLE_SHEETS_SPREADSHEET_ID="1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ" \
  NODE_ENV="production" \
  LOG_LEVEL="info"

# Configurar service account key (base64)
cat keys/gsheets-sa.json | base64 | flyctl secrets set GOOGLE_SA_KEY_BASE64=-
```

### 3. Deploy

```bash
# Deploy a Fly.io
flyctl deploy

# Verificar deployment
flyctl status

# Ver logs
flyctl logs
```

### 4. Verificar Health Check

```bash
# Verificar endpoint de health
curl https://arbitragexplus-api.fly.dev/health

# Debe retornar:
# {
#   "status": "ok",
#   "timestamp": "2025-10-17T...",
#   "version": "2.0.0"
# }
```

---

## 🚀 Deployment de TS Executor

### 1. Configurar Variables de Entorno

```bash
cd services/ts-executor

# Crear .env de producción
cat > .env.production << EOF
# Wallets (NUNCA commitear)
PRIVATE_KEY_1=0x...
PRIVATE_KEY_2=0x...
PRIVATE_KEY_3=0x...

# RPCs
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_2=https://mainnet.infura.io/v3/YOUR_KEY
RPC_URL_3=https://rpc.ankr.com/eth

# Contratos (de deployed-contracts.json)
CHAIN_ID=1
FLASH_LOAN_ARBITRAGE_ADDRESS=0x...
BATCH_EXECUTOR_ADDRESS=0x...

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
GOOGLE_APPLICATION_CREDENTIALS=./keys/gsheets-sa.json

# Configuración
MAX_PARALLEL_OPERATIONS=40
MIN_PROFIT_USD=10
REFRESH_INTERVAL_MS=5000
AUTO_SCALING=true

# Gas
GAS_STRATEGY=fast
MAX_FEE_PER_GAS=100000000000
MAX_PRIORITY_FEE_PER_GAS=2000000000
GAS_LIMIT_MULTIPLIER=1.2

# Retry & Circuit Breaker
MAX_RETRIES=3
RETRY_DELAY_MS=1000
CIRCUIT_BREAKER_THRESHOLD=5

# Oracle
ORACLE_MAX_STALENESS=60
ORACLE_MIN_CONFIDENCE=0.95

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_LOGS=true
NODE_ENV=production
EOF
```

### 2. Compilar

```bash
# Instalar dependencias
pnpm install

# Compilar TypeScript
pnpm run build

# Verificar compilación
ls -la dist/
```

### 3. Ejecutar en Servidor

```bash
# Opción 1: PM2 (recomendado)
npm install -g pm2

pm2 start dist/main.js \
  --name arbitragexplus-executor \
  --env production \
  --max-memory-restart 2G \
  --restart-delay 5000

pm2 save
pm2 startup

# Opción 2: Systemd
sudo cat > /etc/systemd/system/arbitragexplus-executor.service << EOF
[Unit]
Description=ARBITRAGEXPLUS2025 Transaction Executor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ARBITRAGEXPLUS2025/services/ts-executor
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable arbitragexplus-executor
sudo systemctl start arbitragexplus-executor

# Opción 3: Docker
docker build -t arbitragexplus-executor .
docker run -d \
  --name arbitragexplus-executor \
  --env-file .env.production \
  --restart unless-stopped \
  arbitragexplus-executor
```

### 4. Verificar Ejecución

```bash
# PM2
pm2 logs arbitragexplus-executor

# Systemd
sudo journalctl -u arbitragexplus-executor -f

# Docker
docker logs -f arbitragexplus-executor

# Debe mostrar:
# ╔════════════════════════════════════════════════════════╗
# ║  ARBITRAGEXPLUS2025 - Transaction Executor Service     ║
# ║  Parallel Orchestrator for 40+ Simultaneous Operations║
# ╚════════════════════════════════════════════════════════╝
# ✅ ParallelOrchestrator initialized
# 🚀 ParallelOrchestrator started
```

---

## 💰 Configuración de Wallets

### 1. Crear Wallets

```bash
# Generar nuevas wallets (si es necesario)
cast wallet new

# O usar wallets existentes
# IMPORTANTE: Usar wallets dedicadas para el bot, no wallets personales
```

### 2. Fondear Wallets

```bash
# Calcular gas necesario
# Estimación: ~0.1 ETH por wallet para ~1000 transacciones

# Transferir ETH a cada wallet
# Wallet 1: 0x...
# Wallet 2: 0x...
# Wallet 3: 0x...
```

### 3. Verificar Balances

```bash
# Verificar balance de cada wallet
cast balance $WALLET_1_ADDRESS --rpc-url $RPC_URL
cast balance $WALLET_2_ADDRESS --rpc-url $RPC_URL
cast balance $WALLET_3_ADDRESS --rpc-url $RPC_URL
```

### 4. Configurar Alertas de Balance

```bash
# Crear script de monitoreo de balance
cat > monitor-balances.sh << 'EOF'
#!/bin/bash

THRESHOLD=0.05  # 0.05 ETH

for wallet in $WALLET_1_ADDRESS $WALLET_2_ADDRESS $WALLET_3_ADDRESS; do
  balance=$(cast balance $wallet --rpc-url $RPC_URL | awk '{print $1}')
  
  if (( $(echo "$balance < $THRESHOLD" | bc -l) )); then
    echo "⚠️  WARNING: Wallet $wallet balance is low: $balance ETH"
    # Enviar alerta (email, Slack, etc.)
  fi
done
EOF

chmod +x monitor-balances.sh

# Agregar a cron (ejecutar cada hora)
crontab -e
# 0 * * * * /path/to/monitor-balances.sh
```

---

## 🔗 Configuración de RPCs

### 1. Obtener API Keys

```bash
# Alchemy
# https://dashboard.alchemy.com/

# Infura
# https://infura.io/dashboard

# QuickNode (opcional)
# https://dashboard.quicknode.com/

# Ankr (público, sin API key)
# https://rpc.ankr.com/eth
```

### 2. Configurar Load Balancing

```bash
# En .env.production
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_2=https://mainnet.infura.io/v3/YOUR_KEY
RPC_URL_3=https://rpc.ankr.com/eth

# El sistema rotará automáticamente entre los RPCs
```

### 3. Monitorear Latencia

```bash
# Crear script de monitoreo de RPCs
cat > monitor-rpcs.sh << 'EOF'
#!/bin/bash

for rpc in $RPC_URL_1 $RPC_URL_2 $RPC_URL_3; do
  start=$(date +%s%N)
  cast block-number --rpc-url $rpc > /dev/null 2>&1
  end=$(date +%s%N)
  
  latency=$(( ($end - $start) / 1000000 ))  # ms
  
  echo "RPC: $rpc - Latency: ${latency}ms"
  
  if [ $latency -gt 1000 ]; then
    echo "⚠️  WARNING: High latency on $rpc"
  fi
done
EOF

chmod +x monitor-rpcs.sh
```

---

## ✅ Verificación Post-Deployment

### Checklist de Verificación

```bash
# 1. Verificar contratos desplegados
cast call $FLASH_LOAN_ARBITRAGE_ADDRESS "owner()" --rpc-url $RPC_URL

# 2. Verificar API Server
curl https://arbitragexplus-api.fly.dev/health

# 3. Verificar Google Sheets
# Abrir: https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit
# Verificar que las 13 hojas están presentes

# 4. Verificar TS Executor
pm2 logs arbitragexplus-executor --lines 50

# 5. Verificar balances de wallets
./monitor-balances.sh

# 6. Verificar RPCs
./monitor-rpcs.sh

# 7. Ejecutar test de integración
cd services/ts-executor
npm run test:integration
```

### Test de Ejecución Manual

```bash
# Ejecutar una transacción de prueba con monto pequeño
# 1. Agregar ruta de prueba en Google Sheets (ROUTES)
# 2. Marcar IS_ACTIVE = TRUE
# 3. Esperar que el executor la procese
# 4. Verificar resultado en EXECUTIONS
```

---

## 📊 Monitoreo y Alertas

### 1. Configurar Monitoreo de Logs

```bash
# Instalar Loki + Grafana (opcional)
docker-compose -f monitoring/docker-compose.yml up -d

# O usar servicio cloud (Datadog, New Relic, etc.)
```

### 2. Configurar Alertas

```bash
# Alertas críticas:
# - Balance de wallet < 0.05 ETH
# - Circuit breaker activado
# - Tasa de error > 10%
# - Latencia de RPC > 1s
# - API Server down
```

### 3. Dashboard de Métricas

```bash
# Métricas en Google Sheets (METRICS)
# - Total de ejecuciones
# - Tasa de éxito
# - Profit total
# - Gas usado
# - Tiempo promedio de ejecución
```

---

## 🔄 Rollback y Contingencia

### Plan de Rollback

```bash
# 1. Detener executor
pm2 stop arbitragexplus-executor

# 2. Pausar contratos (si es necesario)
cast send $FLASH_LOAN_ARBITRAGE_ADDRESS \
  "pause()" \
  --private-key $OWNER_PRIVATE_KEY \
  --rpc-url $RPC_URL

# 3. Rollback de API Server
flyctl releases list
flyctl releases rollback <VERSION>

# 4. Restaurar configuración anterior
git checkout <PREVIOUS_COMMIT>
pnpm run build
pm2 restart arbitragexplus-executor
```

### Plan de Contingencia

```bash
# En caso de emergencia:

# 1. PAUSAR TODO
pm2 stop arbitragexplus-executor
cast send $FLASH_LOAN_ARBITRAGE_ADDRESS "pause()" ...

# 2. Revisar logs
pm2 logs arbitragexplus-executor --lines 1000 > emergency-logs.txt

# 3. Verificar balances
./monitor-balances.sh

# 4. Notificar al equipo
# - Slack, email, etc.

# 5. Analizar causa raíz
# - Revisar logs
# - Revisar transacciones en Etherscan
# - Revisar métricas en Google Sheets

# 6. Implementar fix
# - Corregir código
# - Actualizar configuración
# - Re-deploy

# 7. Reanudar operaciones
cast send $FLASH_LOAN_ARBITRAGE_ADDRESS "unpause()" ...
pm2 restart arbitragexplus-executor
```

---

## 📚 Referencias

- [Documentación de Contratos](./SMART_CONTRACTS.md)
- [Guía de TS Executor](../services/ts-executor/README.md)
- [Arquitectura del Sistema](./ARCHITECTURE.md)
- [Reporte de Completitud](./COMPLETITUD_FINAL.md)

---

**Última actualización:** 17 de Octubre, 2025  
**Versión:** 2.0.0  
**Estado:** ✅ Listo para Producción

