# ARBITRAGEXPLUS2025 - Deployment Checklist

**Versión:** 1.0  
**Última actualización:** 2025-10-18

---

## 📋 Pre-Deployment

### 1. Código y Tests

- [x] Todos los contratos compilados sin errores
- [x] Tests Foundry pasados
- [x] Tests E2E pasados (18/19)
- [x] Pipeline CI/CD configurado
- [x] Documentación completa
- [ ] Code review completo
- [ ] Security review completo

### 2. Secretos y Credenciales

- [ ] Private keys generadas para testnet
- [ ] Private keys almacenadas en Secret Manager
- [ ] RPC API keys obtenidas (Alchemy/Infura)
- [ ] Etherscan API keys obtenidas
- [ ] Google Sheets Service Account configurada
- [ ] Telegram bot creado y token obtenido
- [ ] Discord webhook creado
- [ ] Todas las variables de entorno documentadas

### 3. Infraestructura

- [ ] Servidor/VM configurado
- [ ] Firewall rules configuradas
- [ ] SSH hardening aplicado
- [ ] Docker instalado
- [ ] Node.js 18+ instalado
- [ ] Foundry instalado
- [ ] Monitoreo configurado

---

## 🧪 Testnet Deployment

### 1. Preparación

```bash
# Obtener fondos de testnet
# Sepolia: https://sepoliafaucet.com/
# BSC Testnet: https://testnet.binance.org/faucet-smart
# Mumbai: https://faucet.polygon.technology/

# Verificar balance
cast balance $WALLET_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

### 2. Deployment de Contratos

```bash
cd contracts

# Compilar
forge build

# Deploy a Sepolia
forge script script/DeployArbitrageSystem.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Guardar direcciones de contratos
# ArbitrageManager: 0x...
# ChainlinkOracle: 0x...
# BandOracle: 0x...
```

### 3. Verificación de Contratos

```bash
# Verificar en Etherscan
forge verify-contract \
  <CONTRACT_ADDRESS> \
  ArbitrageManager \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 4. Configuración de Servicios

```bash
# Actualizar .env con direcciones de contratos
cd services/execution
cp .env.example .env
nano .env

# Configurar:
# - ARBITRAGE_MANAGER_ADDRESS=0x...
# - CHAINLINK_ORACLE_ADDRESS=0x...
# - BAND_ORACLE_ADDRESS=0x...
# - PRIVATE_KEY=...
# - RPC URLs

# Instalar dependencias
npm install

# Compilar
npm run build

# Test
npm run dev
```

### 5. Tests E2E en Testnet

```bash
cd test

# Configurar .env
cp .env.example .env
nano .env

# Ejecutar tests
npm test

# Verificar:
# - Conexión a contratos
# - Ejecución de operaciones
# - Eventos emitidos
# - Actualización de Sheets
```

### 6. Deployment de Servicios

```bash
# Execution Service
cd services/execution
docker build -t arbitragexplus-execution .
docker run -d \
  --name arbitragexplus-execution \
  --env-file .env \
  --restart unless-stopped \
  arbitragexplus-execution

# Monitoring Service
cd services/monitoring
docker build -t arbitragexplus-monitoring .
docker run -d \
  --name arbitragexplus-monitoring \
  --env-file .env \
  --restart unless-stopped \
  arbitragexplus-monitoring

# Dashboard
cd dashboard
docker build -t arbitragexplus-dashboard .
docker run -d \
  --name arbitragexplus-dashboard \
  -p 3001:3001 \
  --env-file .env \
  --restart unless-stopped \
  arbitragexplus-dashboard
```

### 7. Verificación Post-Deployment

- [ ] Contratos verificados en Etherscan
- [ ] Servicios ejecutándose sin errores
- [ ] Logs sin errores críticos
- [ ] Dashboard accesible
- [ ] Alertas funcionando (Telegram, Discord)
- [ ] Google Sheets actualizándose
- [ ] Eventos on-chain capturados

---

## 🚀 Mainnet Deployment

### Pre-requisitos

- [ ] ✅ Testnet deployment exitoso
- [ ] ✅ Tests E2E pasados en testnet
- [ ] ✅ Auditoría de contratos completada
- [ ] ✅ Security review aprobado
- [ ] ✅ Load testing completado
- [ ] ✅ Bug bounty program configurado
- [ ] ✅ Fondos suficientes para deployment y operaciones
- [ ] ✅ Equipo de soporte 24/7 disponible

### 1. Preparación de Mainnet

```bash
# Generar nuevas private keys para mainnet
# NUNCA reutilizar keys de testnet

# Transferir fondos a wallets de mainnet
# Ethereum: ~1 ETH para deployment + operaciones
# BSC: ~0.5 BNB
# Polygon: ~100 MATIC

# Verificar balances
cast balance $MAINNET_WALLET --rpc-url $MAINNET_RPC_URL
```

### 2. Deployment de Contratos a Mainnet

```bash
cd contracts

# IMPORTANTE: Hacer backup de todo antes de deployment

# Deploy a Ethereum Mainnet
forge script script/DeployArbitrageSystem.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --private-key $MAINNET_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Guardar direcciones en Secret Manager
# NO en archivos de texto plano
```

### 3. Configuración de Secret Manager

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name arbitragexplus/mainnet/private-key \
  --secret-string "$MAINNET_PRIVATE_KEY"

aws secretsmanager create-secret \
  --name arbitragexplus/mainnet/arbitrage-manager \
  --secret-string "$ARBITRAGE_MANAGER_ADDRESS"

# Google Cloud Secret Manager
echo -n "$MAINNET_PRIVATE_KEY" | \
  gcloud secrets create mainnet-private-key --data-file=-

# HashiCorp Vault
vault kv put secret/arbitragexplus/mainnet/private-key \
  value="$MAINNET_PRIVATE_KEY"
```

### 4. Deployment de Servicios a Producción

```bash
# Usar orchestrator (Kubernetes, Docker Swarm, etc.)

# Kubernetes example
kubectl create namespace arbitragexplus

kubectl create secret generic arbitragexplus-secrets \
  --from-env-file=.env.mainnet \
  -n arbitragexplus

kubectl apply -f k8s/execution-deployment.yaml
kubectl apply -f k8s/monitoring-deployment.yaml
kubectl apply -f k8s/dashboard-deployment.yaml

# Verificar deployments
kubectl get pods -n arbitragexplus
kubectl logs -f deployment/execution -n arbitragexplus
```

### 5. Configuración de Monitoreo

```bash
# Prometheus
kubectl apply -f k8s/prometheus.yaml

# Grafana
kubectl apply -f k8s/grafana.yaml

# Alertmanager
kubectl apply -f k8s/alertmanager.yaml

# Verificar dashboards
# - System metrics
# - Contract events
# - Transaction success rate
# - Gas usage
# - Profit tracking
```

### 6. Verificación Post-Deployment Mainnet

- [ ] Contratos verificados en Etherscan
- [ ] Ownership transferido a multi-sig wallet
- [ ] Servicios ejecutándose en producción
- [ ] Monitoreo 24/7 activo
- [ ] Alertas configuradas y probadas
- [ ] Backups automatizados
- [ ] Disaster recovery plan documentado
- [ ] Bug bounty program publicado
- [ ] Documentación pública actualizada

---

## 🔒 Post-Deployment Security

### 1. Auditoría Continua

- [ ] Monitoreo de eventos on-chain 24/7
- [ ] Alertas de transacciones sospechosas
- [ ] Review de logs diario
- [ ] Análisis de gas usage
- [ ] Verificación de balances

### 2. Rotación de Secretos

```bash
# Programar rotación cada 90 días
# Ver docs/security/SECRETS_MANAGEMENT.md

# Crear calendario
# - Día 1: Generar nuevas keys
# - Día 7: Transferir fondos
# - Día 14: Actualizar servicios
# - Día 21: Revocar keys antiguas
```

### 3. Backups

```bash
# Backup diario de:
# - Google Sheets
# - Logs de transacciones
# - Configuración de servicios
# - Estadísticas

# Almacenar en:
# - S3 con versionado
# - Encriptado con KMS
# - Múltiples regiones
```

---

## 📊 Métricas de Éxito

### KPIs a Monitorear

1. **Uptime**: > 99.9%
2. **Success Rate**: > 95%
3. **Average Latency**: < 2s
4. **Gas Efficiency**: < 500k gas por batch
5. **Profit per Operation**: > 0.01 ETH
6. **Alert Response Time**: < 5 min

### Dashboards

- [ ] System health dashboard
- [ ] Transaction metrics dashboard
- [ ] Profit tracking dashboard
- [ ] Gas usage dashboard
- [ ] Alert history dashboard

---

## 🆘 Incident Response

### Severity 1 (CRÍTICO)

**Ejemplos:**
- Compromiso de private key
- Pérdida de fondos
- Exploit de contrato

**Acción inmediata:**
1. Pausar todas las operaciones
2. Notificar al equipo de seguridad
3. Análisis inicial (15 min)
4. Contención (30 min)
5. Plan de recuperación (1 hora)

### Severity 2 (ALTA)

**Ejemplos:**
- Fallo de circuit breaker
- Pérdida de acceso a servicios
- Compromiso de API keys

**Acción:**
1. Análisis (15 min)
2. Plan de acción (1 hora)
3. Implementar fix (4 horas)

---

## 📞 Contactos de Emergencia

```
Security Lead: security@arbitragexplus.com
On-call: +1-XXX-XXX-XXXX
Telegram: @arbitragexplus_security
Discord: #emergencies
```

---

## ✅ Final Checklist

### Pre-Launch

- [ ] Todos los tests pasados
- [ ] Auditoría completada
- [ ] Security review aprobado
- [ ] Documentación completa
- [ ] Equipo entrenado
- [ ] Incident response plan documentado
- [ ] Backups configurados
- [ ] Monitoreo activo

### Launch Day

- [ ] Deployment a mainnet exitoso
- [ ] Contratos verificados
- [ ] Servicios ejecutándose
- [ ] Monitoreo activo
- [ ] Alertas funcionando
- [ ] Equipo en standby
- [ ] Comunicación pública (si aplica)

### Post-Launch

- [ ] Monitoreo 24/7
- [ ] Bug bounty activo
- [ ] Rotación de keys programada
- [ ] Backups verificados
- [ ] Documentación actualizada
- [ ] Post-mortem de deployment

---

**Última actualización:** 2025-10-18  
**Responsable:** DevOps Team  
**Estado:** ✅ LISTO PARA TESTNET

