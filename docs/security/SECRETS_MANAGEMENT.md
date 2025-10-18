# ARBITRAGEXPLUS2025 - Secrets Management Guide

**Guía práctica para gestión segura de secretos en todos los entornos.**

---

## 📋 Tabla de Contenidos

1. [Overview](#overview)
2. [Tipos de Secretos](#tipos-de-secretos)
3. [Desarrollo Local](#desarrollo-local)
4. [Staging/Testing](#stagingtesting)
5. [Producción](#producción)
6. [Rotación de Secretos](#rotación-de-secretos)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Este sistema maneja múltiples tipos de secretos críticos:

- **Private Keys**: Control de fondos on-chain
- **API Keys**: Acceso a RPCs, oráculos, explorers
- **Service Account Credentials**: Acceso a Google Sheets
- **Bot Tokens**: Telegram, Discord
- **Database Credentials**: PostgreSQL, Redis

**Principio fundamental:** NUNCA commitear secretos a Git.

---

## Tipos de Secretos

### 1. Private Keys

**Criticidad:** 🔴 MÁXIMA

**Formato:**

```env
# Hex string de 64 caracteres (sin 0x prefix en algunos casos)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# O por chain específica
PRIVATE_KEY_CHAIN_1=0x...
PRIVATE_KEY_CHAIN_56=0x...
PRIVATE_KEY_CHAIN_137=0x...
```

**Generación:**

```bash
# Usando ethers.js
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"

# Usando OpenSSL
openssl rand -hex 32
```

**Validación:**

```typescript
import { ethers } from 'ethers';

function validatePrivateKey(key: string): boolean {
  try {
    new ethers.Wallet(key);
    return true;
  } catch {
    return false;
  }
}
```

---

### 2. RPC API Keys

**Criticidad:** 🟡 ALTA

**Providers:**

```env
# Alchemy
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Infura
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# QuickNode
MAINNET_RPC_URL=https://YOUR_ENDPOINT.quiknode.pro/YOUR_API_KEY/
```

**Obtención:**

- **Alchemy**: https://dashboard.alchemy.com/
- **Infura**: https://infura.io/dashboard
- **QuickNode**: https://dashboard.quicknode.com/

---

### 3. Block Explorer API Keys

**Criticidad:** 🟢 MEDIA

```env
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
BSCSCAN_API_KEY=YOUR_BSCSCAN_API_KEY
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_API_KEY
ARBISCAN_API_KEY=YOUR_ARBISCAN_API_KEY
```

**Obtención:**

- **Etherscan**: https://etherscan.io/myapikey
- **BSCscan**: https://bscscan.com/myapikey
- **Polygonscan**: https://polygonscan.com/myapikey

---

### 4. Google Sheets Service Account

**Criticidad:** 🟡 ALTA

**Archivo JSON:**

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-sa@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**Variables de entorno:**

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=/path/to/gsheets-sa.json
GOOGLE_SHEETS_SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
```

**Creación:**

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear proyecto o seleccionar existente
3. Habilitar Google Sheets API y Google Drive API
4. Crear Service Account
5. Crear y descargar clave JSON
6. Compartir spreadsheet con email de Service Account

---

### 5. Telegram Bot

**Criticidad:** 🟢 MEDIA

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

**Creación:**

1. Hablar con [@BotFather](https://t.me/BotFather)
2. Enviar `/newbot`
3. Seguir instrucciones
4. Copiar token
5. Obtener chat ID con [@userinfobot](https://t.me/userinfobot)

---

### 6. Discord Webhook

**Criticidad:** 🟢 MEDIA

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz
```

**Creación:**

1. Ir a Server Settings → Integrations → Webhooks
2. Crear nuevo webhook
3. Copiar URL

---

## Desarrollo Local

### Setup Inicial

```bash
# 1. Clonar repositorio
git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git
cd ARBITRAGEXPLUS2025

# 2. Copiar .env.example a .env en cada servicio
cp services/execution/.env.example services/execution/.env
cp services/monitoring/.env.example services/monitoring/.env
cp test/.env.example test/.env

# 3. Editar .env files con tus credenciales
nano services/execution/.env
```

### Estructura de .env

```
ARBITRAGEXPLUS2025/
├── services/
│   ├── execution/
│   │   ├── .env          # Secretos de ejecución
│   │   └── .env.example  # Template (SIN secretos)
│   └── monitoring/
│       ├── .env          # Secretos de monitoreo
│       └── .env.example  # Template (SIN secretos)
├── test/
│   ├── .env              # Secretos de testing
│   └── .env.example      # Template (SIN secretos)
└── contracts/
    ├── .env              # Secretos de deployment
    └── .env.example      # Template (SIN secretos)
```

### .gitignore

**CRÍTICO:** Verificar que `.env` esté en `.gitignore`

```gitignore
# Environment variables
.env
.env.local
.env.*.local

# Service Account credentials
**/gsheets-sa.json
credentials/

# Private keys
*.key
*.pem
```

### Verificación

```bash
# Verificar que .env NO esté trackeado
git status

# Si aparece .env, agregarlo a .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
```

---

## Staging/Testing

### Usar Testnets

**NUNCA usar private keys de mainnet en testing.**

```env
# Testnet private keys (fondos de prueba)
PRIVATE_KEY=0x... # Sepolia testnet key

# Testnet RPCs (gratis)
SEPOLIA_RPC_URL=https://rpc.sepolia.org
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
```

### Obtener Fondos de Testnet

**Sepolia:**
- https://sepoliafaucet.com/
- https://faucet.quicknode.com/ethereum/sepolia

**BSC Testnet:**
- https://testnet.binance.org/faucet-smart

**Mumbai (Polygon Testnet):**
- https://faucet.polygon.technology/

---

## Producción

### AWS Secrets Manager

#### Setup

```bash
# Instalar AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciales
aws configure
```

#### Crear Secretos

```bash
# Private key
aws secretsmanager create-secret \
  --name arbitragexplus/private-key \
  --secret-string "0x1234567890abcdef..." \
  --region us-east-1

# RPC URL
aws secretsmanager create-secret \
  --name arbitragexplus/mainnet-rpc-url \
  --secret-string "https://eth-mainnet.g.alchemy.com/v2/..." \
  --region us-east-1

# Google Sheets SA
aws secretsmanager create-secret \
  --name arbitragexplus/gsheets-sa \
  --secret-string file://gsheets-sa.json \
  --region us-east-1
```

#### Uso en Código

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString!;
}

// Uso
const privateKey = await getSecret('arbitragexplus/private-key');
const wallet = new ethers.Wallet(privateKey, provider);
```

---

### Google Cloud Secret Manager

#### Setup

```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Autenticar
gcloud auth login

# Configurar proyecto
gcloud config set project YOUR_PROJECT_ID
```

#### Crear Secretos

```bash
# Private key
echo -n "0x1234567890abcdef..." | \
  gcloud secrets create private-key \
  --data-file=-

# RPC URL
echo -n "https://eth-mainnet.g.alchemy.com/v2/..." | \
  gcloud secrets create mainnet-rpc-url \
  --data-file=-

# Google Sheets SA
gcloud secrets create gsheets-sa \
  --data-file=gsheets-sa.json
```

#### Uso en Código

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/YOUR_PROJECT_ID/secrets/${secretName}/versions/latest`,
  });
  
  return version.payload!.data!.toString();
}

// Uso
const privateKey = await getSecret('private-key');
const wallet = new ethers.Wallet(privateKey, provider);
```

---

### HashiCorp Vault

#### Setup

```bash
# Instalar Vault
wget https://releases.hashicorp.com/vault/1.15.0/vault_1.15.0_linux_amd64.zip
unzip vault_1.15.0_linux_amd64.zip
sudo mv vault /usr/local/bin/

# Iniciar servidor (dev mode)
vault server -dev

# En otra terminal, configurar
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='...' # Token del output anterior
```

#### Crear Secretos

```bash
# Private key
vault kv put secret/arbitragexplus/private-key value="0x1234567890abcdef..."

# RPC URL
vault kv put secret/arbitragexplus/mainnet-rpc-url value="https://..."

# Google Sheets SA (como JSON)
vault kv put secret/arbitragexplus/gsheets-sa @gsheets-sa.json
```

#### Uso en Código

```typescript
import vault from 'node-vault';

const client = vault({
  endpoint: 'http://vault:8200',
  token: process.env.VAULT_TOKEN,
});

async function getSecret(path: string): Promise<string> {
  const result = await client.read(path);
  return result.data.data.value;
}

// Uso
const privateKey = await getSecret('secret/arbitragexplus/private-key');
const wallet = new ethers.Wallet(privateKey, provider);
```

---

## Rotación de Secretos

### Private Keys

**Frecuencia:** Cada 90 días o inmediatamente si se sospecha compromiso

**Proceso:**

```bash
# 1. Generar nueva key
NEW_KEY=$(node -e "const ethers = require('ethers'); console.log(ethers.Wallet.createRandom().privateKey);")

# 2. Obtener address
NEW_ADDRESS=$(node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet('$NEW_KEY'); console.log(wallet.address);")

echo "New address: $NEW_ADDRESS"

# 3. Transferir fondos
# Usar script o manualmente

# 4. Actualizar secreto
aws secretsmanager update-secret \
  --secret-id arbitragexplus/private-key \
  --secret-string "$NEW_KEY"

# 5. Reiniciar servicios
kubectl rollout restart deployment/execution
kubectl rollout restart deployment/monitoring

# 6. Verificar funcionamiento
# Monitorear logs

# 7. Documentar
echo "$(date): Rotated private key to $NEW_ADDRESS" >> rotation-log.txt
```

---

### API Keys

**Frecuencia:** Cada 6 meses

**Proceso:**

```bash
# 1. Generar nueva key en dashboard del provider

# 2. Actualizar secreto
aws secretsmanager update-secret \
  --secret-id arbitragexplus/mainnet-rpc-url \
  --secret-string "https://eth-mainnet.g.alchemy.com/v2/NEW_KEY"

# 3. Reiniciar servicios
kubectl rollout restart deployment/execution

# 4. Verificar funcionamiento

# 5. Revocar key antigua en dashboard
```

---

### Service Account Credentials

**Frecuencia:** Cada 6 meses

**Proceso:**

```bash
# 1. Crear nueva Service Account key en GCP Console

# 2. Descargar JSON

# 3. Actualizar secreto
aws secretsmanager update-secret \
  --secret-id arbitragexplus/gsheets-sa \
  --secret-string file://new-gsheets-sa.json

# 4. Reiniciar servicios

# 5. Verificar funcionamiento

# 6. Eliminar key antigua en GCP Console
```

---

## Troubleshooting

### Error: "Private key not set"

**Causa:** Variable de entorno `PRIVATE_KEY` no configurada

**Solución:**

```bash
# Verificar que .env existe
ls -la services/execution/.env

# Verificar contenido
cat services/execution/.env | grep PRIVATE_KEY

# Si no existe, crear
echo "PRIVATE_KEY=0x..." >> services/execution/.env

# Reiniciar servicio
npm run dev
```

---

### Error: "Invalid private key"

**Causa:** Formato incorrecto de private key

**Solución:**

```bash
# Verificar formato (debe ser hex de 64 caracteres)
echo $PRIVATE_KEY | wc -c
# Debe retornar 66 (0x + 64 caracteres)

# Verificar validez
node -e "const ethers = require('ethers'); try { new ethers.Wallet('$PRIVATE_KEY'); console.log('Valid'); } catch(e) { console.log('Invalid:', e.message); }"
```

---

### Error: "Failed to load credentials from ..."

**Causa:** Archivo de Service Account no encontrado

**Solución:**

```bash
# Verificar que el archivo existe
ls -la /path/to/gsheets-sa.json

# Verificar permisos
chmod 600 /path/to/gsheets-sa.json

# Verificar que la ruta en .env es correcta
cat .env | grep GOOGLE_SHEETS_CREDENTIALS_PATH
```

---

### Error: "Insufficient funds"

**Causa:** Wallet sin fondos suficientes

**Solución:**

```bash
# Verificar balance
node -e "const ethers = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('$MAINNET_RPC_URL'); const wallet = new ethers.Wallet('$PRIVATE_KEY', provider); wallet.getBalance().then(b => console.log('Balance:', ethers.utils.formatEther(b), 'ETH'));"

# Transferir fondos a la wallet
```

---

### Error: "Rate limit exceeded"

**Causa:** Demasiados requests a RPC/API

**Solución:**

```bash
# Verificar rate limits del provider
# Alchemy: 330 req/s (Growth plan)
# Infura: 100,000 req/day (free tier)

# Implementar caching
# Reducir frecuencia de polling
# Upgrade plan del provider
```

---

## Checklist

### Desarrollo

- [ ] `.env` files creados en todos los servicios
- [ ] `.env` agregado a `.gitignore`
- [ ] Testnet private keys configuradas
- [ ] Testnet RPCs configurados
- [ ] Google Sheets SA configurada
- [ ] Spreadsheet compartido con SA

### Staging

- [ ] Secretos separados de producción
- [ ] Testnet contracts deployed
- [ ] Testnet funds disponibles
- [ ] Monitoreo configurado
- [ ] Alertas de prueba enviadas

### Producción

- [ ] Secret Manager configurado (AWS/GCP/Vault)
- [ ] Mainnet private keys en Secret Manager
- [ ] Mainnet RPCs en Secret Manager
- [ ] Service Account en Secret Manager
- [ ] Rotación programada
- [ ] Backups de secretos
- [ ] Documentación actualizada
- [ ] Equipo entrenado

---

**Última actualización:** 2025-10-18  
**Responsable:** DevOps Team

