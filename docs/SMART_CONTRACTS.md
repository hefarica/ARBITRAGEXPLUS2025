# 📜 Smart Contracts - ARBITRAGEXPLUS2025

## 🎯 Resumen Ejecutivo

Sistema de contratos inteligentes para arbitraje DeFi con flash loans multi-protocolo, diseñado para ejecutar 40+ operaciones simultáneas con arquitectura de programación dinámica (CERO hardcoding).

---

## 📋 Contratos Principales

### 1. FlashLoanArbitrage.sol

**Propósito:** Contrato principal para ejecutar arbitraje con flash loans de múltiples protocolos

**Características:**
- ✅ Soporte multi-protocolo: Aave V3, Balancer, Uniswap V3, dYdX
- ✅ Ejecución atómica: profit o revert completo
- ✅ Circuit breaker automático tras 5 fallos consecutivos
- ✅ Validación de slippage y rentabilidad
- ✅ Gas optimizado con assembly en secciones críticas
- ✅ Eventos detallados para tracking en Google Sheets

**Protocolos de Flash Loan Soportados:**

| Protocolo | Fee | Liquidez Típica | Chains |
|-----------|-----|-----------------|--------|
| Aave V3 | 0.09% | $5B+ | Ethereum, Polygon, Arbitrum, Optimism |
| Balancer | 0% | $1B+ | Ethereum, Polygon, Arbitrum |
| Uniswap V3 | Variable | $3B+ | Ethereum, Polygon, Arbitrum, Optimism |
| dYdX | 0% | $500M+ | Ethereum |

**Protocolos de Swap Soportados:**
- Uniswap V2/V3
- SushiSwap
- PancakeSwap
- Curve (próximamente)
- Balancer (próximamente)

**Funciones Principales:**

```solidity
// Ejecutar arbitraje con flash loan
function executeArbitrage(ArbitrageRoute calldata route)
    external
    nonReentrant
    onlyAuthorizedExecutor
    circuitBreakerCheck
    validRoute(route)
    returns (ExecutionResult memory result)

// Callbacks de flash loans
function executeOperation(...) external returns (bool)  // Aave V3
function receiveFlashLoan(...) external                 // Balancer
function uniswapV3FlashCallback(...) external           // Uniswap V3
```

**Estructura de Datos:**

```solidity
struct ArbitrageRoute {
    string routeId;                 // ID desde Google Sheets ROUTES
    FlashLoanParams flashLoan;      // Configuración flash loan
    SwapStep[] swaps;               // Pasos de swap (hasta 10)
    uint256 expectedProfit;         // Profit esperado
    uint256 minProfitRequired;      // Profit mínimo
    uint256 maxSlippageBps;         // Slippage máximo (basis points)
    uint256 deadline;               // Deadline de transacción
    address profitToken;            // Token de profit
}

struct ExecutionResult {
    bool success;
    uint256 profitAmount;
    uint256 gasUsed;
    uint256 flashLoanFee;
    uint256 swapCount;
    string failureReason;
}
```

**Eventos:**

```solidity
event ArbitrageExecuted(
    string indexed routeId,
    address indexed executor,
    address indexed profitToken,
    uint256 profitAmount,
    uint256 gasUsed,
    uint256 timestamp
);

event ArbitrageFailed(
    string indexed routeId,
    address indexed executor,
    string reason,
    uint256 timestamp
);

event CircuitBreakerTriggered(
    string reason,
    uint256 timestamp
);
```

**Seguridad:**
- ✅ ReentrancyGuard en todas las funciones críticas
- ✅ Ownable para funciones administrativas
- ✅ Circuit breaker automático
- ✅ Validación de slippage
- ✅ Autorización de executors, providers y routers
- ✅ Emergency withdraw

---

### 2. BatchExecutor.sol

**Propósito:** Ejecutor de operaciones en batch para 40+ arbitrajes simultáneos

**Características:**
- ✅ Hasta 50 operaciones en una sola transacción
- ✅ Continúa ejecutando incluso si algunas operaciones fallan
- ✅ Reporta resultados detallados de cada operación
- ✅ Gas optimizado para ejecución paralela
- ✅ Circuit breaker por operación individual

**Funciones Principales:**

```solidity
// Ejecutar batch de operaciones
function executeBatch(BatchOperation[] calldata operations)
    external
    onlyAuthorizedExecutor
    returns (BatchSummary memory summary)

// Ejecutar operaciones similares optimizado
function executeSimilarOperations(
    address arbitrageContract,
    bytes[] calldata callDataArray,
    uint256 gasLimitPerOperation,
    bool continueOnFailure
) external returns (BatchSummary memory)

// Ejecutar operaciones en paralelo lógico
function executeParallelOperations(
    address[] calldata contracts,
    bytes[] calldata callDataArray,
    uint256[] calldata gasLimits
) external returns (BatchSummary memory)
```

**Estructura de Datos:**

```solidity
struct BatchOperation {
    address arbitrageContract;      // Contrato de arbitraje
    bytes callData;                 // Datos de la llamada
    uint256 gasLimit;               // Límite de gas
    bool continueOnFailure;         // Continuar si falla
}

struct BatchSummary {
    uint256 totalOperations;
    uint256 successfulOperations;
    uint256 failedOperations;
    uint256 totalProfit;
    uint256 totalGasUsed;
    BatchResult[] results;
}
```

**Eventos:**

```solidity
event BatchExecutionStarted(
    address indexed executor,
    uint256 operationCount,
    uint256 timestamp
);

event BatchExecutionCompleted(
    address indexed executor,
    uint256 successful,
    uint256 failed,
    uint256 totalProfit,
    uint256 totalGas
);

event OperationExecuted(
    uint256 indexed operationIndex,
    address indexed arbitrageContract,
    bool success,
    uint256 profit,
    uint256 gasUsed
);
```

---

## 🔧 Deployment

### Requisitos Previos

1. **Foundry instalado:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. **Variables de entorno configuradas:**
```bash
# .env
PRIVATE_KEY=0x...                    # Private key del deployer
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_KEY           # Para verificación
```

### Despliegue en Testnet (Sepolia)

```bash
# 1. Compilar contratos
forge build

# 2. Ejecutar tests
forge test -vvv

# 3. Desplegar en Sepolia
forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast \
    --verify

# 4. Guardar direcciones desplegadas
# FlashLoanArbitrage: 0x...
# BatchExecutor: 0x...
```

### Despliegue en Mainnet

```bash
# 1. Auditoría de seguridad OBLIGATORIA antes de mainnet
# 2. Tests exhaustivos en testnet
# 3. Desplegar con precaución

forge script script/DeployFlashLoanSystem.s.sol:DeployFlashLoanSystem \
    --rpc-url $MAINNET_RPC_URL \
    --broadcast \
    --verify \
    --slow  # Usar --slow para evitar rate limits

# 4. Verificar en Etherscan
forge verify-contract \
    <CONTRACT_ADDRESS> \
    src/FlashLoanArbitrage.sol:FlashLoanArbitrage \
    --chain-id 1 \
    --etherscan-api-key $ETHERSCAN_API_KEY
```

### Configuración Post-Deployment

```bash
# 1. Autorizar executors
cast send <FLASH_LOAN_ARBITRAGE_ADDRESS> \
    "authorizeExecutor(address,bool)" \
    <EXECUTOR_ADDRESS> \
    true \
    --private-key $PRIVATE_KEY

# 2. Autorizar flash loan providers
cast send <FLASH_LOAN_ARBITRAGE_ADDRESS> \
    "authorizeFlashLoanProvider(address,bool)" \
    <AAVE_V3_POOL_ADDRESS> \
    true \
    --private-key $PRIVATE_KEY

# 3. Autorizar DEX routers
cast send <FLASH_LOAN_ARBITRAGE_ADDRESS> \
    "authorizeDEXRouter(address,bool)" \
    <UNISWAP_V2_ROUTER_ADDRESS> \
    true \
    --private-key $PRIVATE_KEY

# 4. Configurar BatchExecutor
cast send <BATCH_EXECUTOR_ADDRESS> \
    "authorizeArbitrageContract(address,bool)" \
    <FLASH_LOAN_ARBITRAGE_ADDRESS> \
    true \
    --private-key $PRIVATE_KEY
```

---

## 🧪 Testing

### Tests Unitarios

```bash
# Ejecutar todos los tests
forge test

# Tests con verbosidad
forge test -vvv

# Tests específicos
forge test --match-contract FlashLoanArbitrageTest
forge test --match-test testExecuteArbitrage

# Coverage
forge coverage
```

### Tests de Integración

```bash
# Fork de mainnet para tests realistas
forge test --fork-url $MAINNET_RPC_URL -vvv

# Simular operaciones con datos reales
forge test --match-test testRealWorldArbitrage --fork-url $MAINNET_RPC_URL
```

### Gas Profiling

```bash
# Análisis de gas
forge test --gas-report

# Snapshot de gas
forge snapshot

# Comparar snapshots
forge snapshot --diff .gas-snapshot
```

---

## 🔐 Seguridad

### Auditorías Recomendadas

1. **Auditoría interna:** Revisión exhaustiva del código
2. **Auditoría externa:** Contratar firma especializada (OpenZeppelin, Trail of Bits, etc.)
3. **Bug bounty:** Programa de recompensas por bugs
4. **Formal verification:** Verificación formal de propiedades críticas

### Mejores Prácticas Implementadas

✅ **ReentrancyGuard:** Protección contra ataques de reentrancia  
✅ **Ownable:** Control de acceso a funciones administrativas  
✅ **Circuit Breaker:** Detención automática ante fallos repetidos  
✅ **Validaciones:** Slippage, deadlines, autorizaciones  
✅ **Emergency Withdraw:** Recuperación de fondos en emergencias  
✅ **Eventos Detallados:** Tracking completo de operaciones  
✅ **Gas Limits:** Límites de gas por operación  
✅ **No Hardcoding:** Todas las direcciones configurables  

### Riesgos Conocidos

⚠️ **MEV (Maximal Extractable Value):** Las transacciones pueden ser front-runned  
⚠️ **Slippage:** Los precios pueden cambiar entre simulación y ejecución  
⚠️ **Gas Price Spikes:** El gas puede aumentar súbitamente  
⚠️ **Flash Loan Fees:** Los fees pueden cambiar dinámicamente  
⚠️ **Smart Contract Risk:** Bugs en contratos de terceros  

### Mitigaciones

✅ **Flashbots:** Usar Flashbots para transacciones privadas  
✅ **Slippage Protection:** Validación de slippage máximo  
✅ **Gas Price Limits:** Límites de gas configurables  
✅ **Oracle Validation:** Validación de precios con oráculos  
✅ **Circuit Breaker:** Detención automática ante anomalías  

---

## 📊 Integración con Google Sheets

### Flujo de Datos

```
Google Sheets (ROUTES) 
    ↓
TS Executor lee ruta optimizada
    ↓
Construye ArbitrageRoute struct
    ↓
Llama FlashLoanArbitrage.executeArbitrage()
    ↓
Contrato ejecuta flash loan + swaps
    ↓
Emite eventos (ArbitrageExecuted/Failed)
    ↓
TS Executor captura eventos
    ↓
Escribe resultados a Google Sheets (EXECUTIONS)
```

### Campos de Google Sheets Utilizados

**ROUTES (Entrada):**
- ROUTE_ID
- STRATEGY_TYPE
- SOURCE_TOKEN, TARGET_TOKEN
- DEX_1, DEX_2, DEX_3
- EXPECTED_PROFIT_USD
- MAX_SLIPPAGE

**FLASH_LOANS (Configuración):**
- PROTOCOL_NAME
- CONTRACT_ADDRESS
- FEE_BPS
- SUPPORTED_TOKENS

**EXECUTIONS (Salida):**
- EXECUTION_ID
- ROUTE_ID
- STATUS (SUCCESS/FAILED)
- PROFIT_USD
- GAS_USED
- TRANSACTION_HASH
- ERROR_MESSAGE (si falla)

---

## 🚀 Uso desde Backend

### TypeScript Example

```typescript
import { ethers } from 'ethers';
import FlashLoanArbitrageABI from './abis/FlashLoanArbitrage.json';

// Conectar al contrato
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const flashLoanArbitrage = new ethers.Contract(
  process.env.FLASH_LOAN_ARBITRAGE_ADDRESS,
  FlashLoanArbitrageABI,
  wallet
);

// Construir ruta desde Google Sheets
const route = {
  routeId: 'ROUTE_001',
  flashLoan: {
    protocol: 0, // AAVE_V3
    provider: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    tokens: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'], // WETH
    amounts: [ethers.utils.parseEther('10')],
    extraData: '0x'
  },
  swaps: [
    {
      protocol: 0, // UNISWAP_V2
      router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      path: [WETH_ADDRESS, USDC_ADDRESS],
      amountIn: ethers.utils.parseEther('10'),
      minAmountOut: ethers.utils.parseUnits('15000', 6),
      extraData: '0x'
    },
    {
      protocol: 1, // SUSHISWAP
      router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      path: [USDC_ADDRESS, WETH_ADDRESS],
      amountIn: ethers.utils.parseUnits('15000', 6),
      minAmountOut: ethers.utils.parseEther('10.1'),
      extraData: '0x'
    }
  ],
  expectedProfit: ethers.utils.parseEther('0.1'),
  minProfitRequired: ethers.utils.parseEther('0.05'),
  maxSlippageBps: 100, // 1%
  deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutos
  profitToken: WETH_ADDRESS
};

// Ejecutar arbitraje
const tx = await flashLoanArbitrage.executeArbitrage(route, {
  gasLimit: 1000000,
  maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
  maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei')
});

console.log('Transaction sent:', tx.hash);

// Esperar confirmación
const receipt = await tx.wait();
console.log('Transaction confirmed:', receipt.transactionHash);

// Parsear eventos
const events = receipt.logs
  .map(log => {
    try {
      return flashLoanArbitrage.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .filter(event => event !== null);

const arbitrageEvent = events.find(e => e.name === 'ArbitrageExecuted');
if (arbitrageEvent) {
  console.log('Profit:', ethers.utils.formatEther(arbitrageEvent.args.profitAmount));
  console.log('Gas used:', arbitrageEvent.args.gasUsed.toString());
}
```

---

## 📈 Métricas y Monitoreo

### Eventos a Monitorear

1. **ArbitrageExecuted:** Arbitrajes exitosos
2. **ArbitrageFailed:** Arbitrajes fallidos
3. **CircuitBreakerTriggered:** Circuit breaker activado
4. **FlashLoanReceived:** Flash loans recibidos
5. **SwapExecuted:** Swaps individuales ejecutados

### Dashboards Recomendados

- **Dune Analytics:** Queries personalizadas para análisis
- **Tenderly:** Monitoreo en tiempo real y debugging
- **Grafana:** Dashboards de métricas
- **Google Sheets:** Tracking en METRICS y LOGS

---

## 🔄 Actualizaciones y Mantenimiento

### Upgrades

Los contratos actuales **NO son upgradeables** por seguridad. Para actualizar:

1. Desplegar nueva versión del contrato
2. Migrar autorizaciones y configuración
3. Actualizar direcciones en Google Sheets y backend
4. Retirar fondos del contrato antiguo
5. Deprecar contrato antiguo

### Mantenimiento Regular

- Monitorear eventos y logs diariamente
- Revisar estadísticas semanalmente
- Auditar configuraciones mensualmente
- Actualizar documentación continuamente

---

## 📚 Referencias

- **Aave V3 Docs:** https://docs.aave.com/developers/
- **Balancer Docs:** https://docs.balancer.fi/
- **Uniswap V3 Docs:** https://docs.uniswap.org/
- **Foundry Book:** https://book.getfoundry.sh/
- **Solidity Docs:** https://docs.soliditylang.org/

---

**Última actualización:** 2025-10-17  
**Versión:** 1.0  
**Estado:** ✅ Listo para testing en testnet

