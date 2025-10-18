# ARBITRAGEXPLUS2025 - Parallel Execution Service

Servicio de ejecución paralela de hasta **40 operaciones de arbitraje atómicas simultáneas** en múltiples blockchains.

## 🚀 Características

- **Ejecución paralela**: Hasta 40 operaciones simultáneas en un solo bloque
- **Multi-oracle validation**: Validación de precios con Pyth, Chainlink y Band Protocol
- **Multi-chain**: Soporte para Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche
- **Gas optimization**: Cálculo inteligente de precios de gas para maximizar rentabilidad
- **Circuit breaker**: Protección automática contra fallos consecutivos
- **Retry logic**: Reintentos automáticos con backoff exponencial
- **Google Sheets integration**: Configuración dinámica desde Sheets

## 📋 Requisitos

- Node.js >= 18.0.0
- TypeScript >= 5.0
- Acceso a Google Sheets API
- Private keys para ejecución de transacciones
- RPC endpoints para cada blockchain

## 🔧 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
nano .env

# Compilar TypeScript
npm run build
```

## ⚙️ Configuración

### Variables de Entorno

Edita `.env` con tu configuración:

```env
# Ejecución
MAX_CONCURRENT_OPS=40                    # Máximo de operaciones simultáneas
MIN_ORACLE_CONFIRMATIONS=2               # Mínimo de oráculos para validación
MAX_SLIPPAGE_BPS=100                     # Slippage máximo (1%)
GAS_LIMIT_PER_OP=500000                  # Límite de gas por operación
CIRCUIT_BREAKER_THRESHOLD=5              # Fallos consecutivos antes de activar circuit breaker

# Private Keys
PRIVATE_KEY=0x...                        # Private key principal
PRIVATE_KEY_CHAIN_1=0x...               # Private key para Ethereum (opcional)
PRIVATE_KEY_CHAIN_56=0x...              # Private key para BSC (opcional)

# RPC URLs
MAINNET_RPC_URL=https://...
BSC_RPC_URL=https://...
POLYGON_RPC_URL=https://...

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/gsheets-sa.json
```

### Google Sheets

El servicio lee configuración desde Google Sheets:

- **BLOCKCHAINS**: Configuración de chains (RPC, contratos, etc.)
- **ROUTES**: Oportunidades de arbitraje a ejecutar
- **EXECUTIONS**: Resultados de ejecuciones (escritura)

Ver `apps-script/gas-advanced-mapper.gs` para la estructura completa.

## 🚀 Uso

### Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev
```

### Producción

```bash
# Compilar
npm run build

# Ejecutar
npm start
```

### Docker

```bash
# Build
docker build -t arbitragexplus-execution .

# Run
docker run -d \
  --name arbitragexplus-execution \
  --env-file .env \
  arbitragexplus-execution
```

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    ParallelExecutor                         │
│  - Orquesta ejecución de 40 operaciones simultáneas        │
│  - Circuit breaker y retry logic                           │
│  - Actualización de resultados en Sheets                   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ OracleValidator│  │TransactionBuilder│  │  GasManager  │
│ - Pyth        │  │ - Batch ops    │  │ - Gas prices │
│ - Chainlink   │  │ - Encoding     │  │ - Profitability│
│ - Band        │  │ - Validation   │  │ - Optimization│
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  ArbitrageManager.sol  │
                │  (Smart Contract)      │
                │  - executeBatch()      │
                │  - 40 atomic ops       │
                └───────────────────────┘
```

## 🔍 Componentes

### ParallelExecutor

Orquestador principal que:
- Lee oportunidades desde Google Sheets
- Valida precios con múltiples oráculos
- Construye y ejecuta transacciones batch
- Actualiza resultados en Sheets
- Implementa circuit breaker y retry logic

### OracleValidator

Validador de precios que consulta:
- **Pyth Network**: Precios en tiempo real de alta frecuencia
- **Chainlink**: Precios confiables y descentralizados
- **Band Protocol**: Precios agregados de múltiples fuentes

Requiere confirmación de al menos N oráculos (configurable).

### TransactionBuilder

Constructor de transacciones batch:
- Convierte oportunidades a operaciones batch
- Calcula slippage y minAmountOut
- Estima gas necesario
- Encodea datos para el contrato

### GasManager

Gestor de gas que:
- Monitorea precios de gas en tiempo real
- Calcula precios óptimos por prioridad (slow/standard/fast/instant)
- Verifica rentabilidad considerando costos de gas
- Soporta múltiples chains con diferentes estrategias

## 📈 Monitoreo

El servicio emite logs estructurados:

```typescript
[ParallelExecutor] INFO: Starting batch execution batch_1234567890_abc
[ParallelExecutor] INFO: Found 15 opportunities
[OracleValidator] DEBUG: Validating prices for 0x... -> 0x...
[GasManager] DEBUG: Gas price: 50 gwei (fast)
[ParallelExecutor] INFO: Transaction sent for op op_001 { txHash: '0x...' }
[ParallelExecutor] INFO: Batch batch_1234567890_abc completed { successful: 14, failed: 1, profit: '1.5 ETH' }
```

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 🔒 Seguridad

- **NUNCA** commitear private keys reales
- Usar variables de entorno para credenciales
- Implementar rate limiting en producción
- Monitorear circuit breaker activations
- Rotar private keys regularmente
- Usar KMS/Vault en producción

## 📝 Licencia

MIT

## 🤝 Contribución

Ver [CONTRIBUTING.md](../../CONTRIBUTING.md)

## 📞 Soporte

Para issues y preguntas, abrir un issue en GitHub.

