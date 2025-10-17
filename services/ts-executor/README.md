# 🚀 TS Executor - ARBITRAGEXPLUS2025

Sistema de ejecución de transacciones para arbitraje DeFi con soporte para **40+ operaciones simultáneas**.

---

## 📋 Descripción

El **TS Executor** es el componente de ejecución del sistema ARBITRAGEXPLUS2025 que:

- ✅ Ejecuta transacciones reales en blockchain
- ✅ Gestiona hasta 40+ operaciones simultáneas
- ✅ Integra con contratos FlashLoanArbitrage y BatchExecutor
- ✅ Valida precios con oráculos Pyth y Chainlink
- ✅ Gestiona gas pricing dinámico con EIP-1559
- ✅ Lee configuración desde Google Sheets
- ✅ Escribe resultados a Google Sheets
- ✅ Circuit breaker y retry logic automáticos

---

## 🏗️ Arquitectura

```
Google Sheets (ROUTES)
    ↓
ParallelOrchestrator
    ↓
TransactionExecutor (x3 wallets)
    ↓
├─ OracleValidator (Pyth/Chainlink)
├─ GasManager (EIP-1559)
├─ NonceTracker
└─ GoogleSheetsClient
    ↓
FlashLoanArbitrage Contract
    ↓
Blockchain
    ↓
Google Sheets (EXECUTIONS)
```

---

## 📦 Componentes

### 1. ParallelOrchestrator
Orquestador principal que coordina la ejecución de múltiples operaciones.

**Características:**
- Gestión de hasta 50 operaciones paralelas
- Balanceo de carga entre múltiples wallets
- Priorización de rutas por rentabilidad
- Monitoreo en tiempo real
- Auto-scaling basado en condiciones de red

### 2. TransactionExecutor
Ejecutor de transacciones individuales con gestión completa del ciclo de vida.

**Características:**
- Ejecución con retry logic
- Circuit breaker automático
- Validación pre-ejecución con oráculos
- Gestión de nonce y gas
- Batch execution

### 3. GasManager
Gestión inteligente de gas pricing con soporte EIP-1559.

**Estrategias:**
- `slow`: Base fee × 1.1 + 1 gwei
- `standard`: Base fee × 1.2 + 2 gwei
- `fast`: Base fee × 1.3 + 3 gwei
- `instant`: Base fee × 1.5 + 5 gwei
- `custom`: Configuración manual

### 4. OracleValidator
Validación de precios con múltiples fuentes.

**Oráculos soportados:**
- Pyth Network (primario)
- Chainlink Price Feeds (fallback)
- DEX on-chain (fallback secundario)

### 5. GoogleSheetsClient
Cliente para interactuar con Google Sheets Brain.

**Funcionalidades:**
- Lee rutas desde ROUTES
- Escribe resultados a EXECUTIONS
- Lee configuración desde CONFIG
- Escribe logs a LOGS
- Escribe métricas a METRICS

---

## 🚀 Instalación

```bash
# 1. Instalar dependencias
cd services/ts-executor
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# 3. Compilar TypeScript
npm run build

# 4. Ejecutar
npm start
```

---

## ⚙️ Configuración

### Variables de Entorno Críticas

```bash
# Wallets (Private Keys)
PRIVATE_KEY_1=0x...
PRIVATE_KEY_2=0x...
PRIVATE_KEY_3=0x...

# RPC Endpoints
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_2=https://mainnet.infura.io/v3/YOUR_KEY
RPC_URL_3=https://rpc.ankr.com/eth

# Smart Contracts
FLASH_LOAN_ARBITRAGE_ADDRESS=0x...
BATCH_EXECUTOR_ADDRESS=0x...

# Orchestrator
MAX_PARALLEL_OPERATIONS=40
MIN_PROFIT_USD=10
REFRESH_INTERVAL_MS=5000

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
GOOGLE_APPLICATION_CREDENTIALS=./keys/gsheets-sa.json
```

### Configuración de Múltiples Wallets

Para maximizar el throughput, usa múltiples wallets:

```bash
# Wallet 1 - Principal
PRIVATE_KEY_1=0x...

# Wallet 2 - Secundaria
PRIVATE_KEY_2=0x...

# Wallet 3 - Terciaria
PRIVATE_KEY_3=0x...
```

**Ventajas:**
- Evita conflictos de nonce
- Distribuye carga de gas
- Mayor throughput
- Redundancia en caso de fallo

### Configuración de Múltiples RPCs

Usa múltiples endpoints RPC para redundancia:

```bash
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_2=https://mainnet.infura.io/v3/YOUR_KEY
RPC_URL_3=https://rpc.ankr.com/eth
```

**Ventajas:**
- Load balancing
- Fallback automático
- Mayor disponibilidad
- Mejor latencia

---

## 🎯 Uso

### Modo Normal (Producción)

```bash
npm start
```

El orquestador:
1. Lee rutas desde Google Sheets (ROUTES)
2. Filtra por rentabilidad (MIN_PROFIT_USD)
3. Valida precios con oráculos
4. Ejecuta transacciones en paralelo
5. Escribe resultados a Google Sheets (EXECUTIONS)
6. Repite cada REFRESH_INTERVAL_MS

### Modo Desarrollo

```bash
npm run dev
```

Ejecuta con `ts-node` sin necesidad de compilar.

### Modo Watch

```bash
npm run watch
```

Compila automáticamente al detectar cambios.

---

## 📊 Monitoreo

### Estadísticas en Consola

El orquestador imprime estadísticas cada 30 segundos:

```
📊 ORCHESTRATOR STATISTICS
══════════════════════════════════════════════════
Active operations:     12
Queued operations:     5
Completed operations:  127
Total profit:          2.456789 ETH
Success rate:          94.49%
Avg execution time:    3247ms
Active wallets:        3
══════════════════════════════════════════════════
```

### Google Sheets

Todas las métricas se escriben a:
- **EXECUTIONS**: Resultados de cada operación
- **METRICS**: KPIs del sistema
- **LOGS**: Logs detallados de eventos

---

## 🔒 Seguridad

### Mejores Prácticas

✅ **Nunca commitear private keys** a git  
✅ **Usar variables de entorno** para credenciales  
✅ **Rotar keys regularmente**  
✅ **Monitorear balances** de wallets  
✅ **Configurar alertas** para fallos  
✅ **Usar Flashbots** para transacciones privadas  
✅ **Validar precios** con oráculos antes de ejecutar  
✅ **Configurar circuit breakers** apropiadamente  

### Gestión de Claves Privadas

**Desarrollo:**
```bash
# .env local (no commitear)
PRIVATE_KEY_1=0x...
```

**Producción:**
```bash
# Usar secret manager (AWS Secrets Manager, GCP Secret Manager, etc.)
export PRIVATE_KEY_1=$(aws secretsmanager get-secret-value --secret-id prod/arbitrage/wallet1 --query SecretString --output text)
```

---

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm test -- --coverage

# Tests específicos
npm test -- TransactionExecutor.test.ts
```

---

## 🐛 Debugging

### Logs Detallados

```bash
# Activar modo debug
DEBUG=true npm start
```

### Verificar Configuración

```bash
# Verificar que las variables de entorno están configuradas
node -e "require('dotenv').config(); console.log(process.env)"
```

### Verificar Conexión RPC

```bash
# Test de conectividad
curl -X POST $RPC_URL_1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 📈 Optimización

### Maximizar Throughput

1. **Aumentar wallets**: Más wallets = más operaciones paralelas
2. **Optimizar gas**: Usar estrategia `fast` o `instant`
3. **Reducir refresh interval**: Menor REFRESH_INTERVAL_MS
4. **Usar batch execution**: Agrupar operaciones similares
5. **Múltiples RPCs**: Distribuir carga entre endpoints

### Reducir Costos de Gas

1. **Usar estrategia `standard`**: Balance entre velocidad y costo
2. **Aumentar MIN_PROFIT_USD**: Solo ejecutar rutas muy rentables
3. **Batch execution**: Menor gas por operación
4. **Optimizar contratos**: Reducir gas limit

---

## 🚨 Troubleshooting

### Error: "No wallets configured"

**Solución:** Configurar al menos un PRIVATE_KEY en .env

```bash
PRIVATE_KEY_1=0x...
```

### Error: "FLASH_LOAN_ARBITRAGE_ADDRESS not configured"

**Solución:** Configurar la dirección del contrato desplegado

```bash
FLASH_LOAN_ARBITRAGE_ADDRESS=0x...
```

### Error: "Rate limit exceeded"

**Solución:** Usar múltiples RPCs o aumentar plan de RPC provider

```bash
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/KEY1
RPC_URL_2=https://mainnet.infura.io/v3/KEY2
```

### Error: "Insufficient balance for gas"

**Solución:** Fondear wallets con ETH para gas

```bash
# Verificar balance
cast balance $WALLET_ADDRESS --rpc-url $RPC_URL
```

### Circuit Breaker Activado

**Solución:** Revisar logs, corregir errores y resetear manualmente

```typescript
// En código
orchestrator.resetCircuitBreaker();
```

---

## 📚 Referencias

- [Documentación de Contratos](../../docs/SMART_CONTRACTS.md)
- [Google Sheet Brain](../../docs/GOOGLE_SHEET_BRAIN_COMPLETE.md)
- [Arquitectura del Sistema](../../docs/ARCHITECTURE.md)
- [Ethers.js Docs](https://docs.ethers.org/v5/)
- [Pyth Network](https://docs.pyth.network/)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds)

---

## 🤝 Contribuir

Ver [CONTRIBUTING.md](../../CONTRIBUTING.md) para guías de contribución.

---

## 📄 Licencia

MIT License - Ver [LICENSE](../../LICENSE) para detalles.

---

**Última actualización:** 2025-10-17  
**Versión:** 2.0.0  
**Estado:** ✅ Listo para producción

