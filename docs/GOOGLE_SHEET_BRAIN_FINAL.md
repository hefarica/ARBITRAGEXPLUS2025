# 🧠 Google Sheet Brain - Configuración Final Completa

## 📊 Resumen Ejecutivo

El **Google Sheet Brain** del sistema ARBITRAGEXPLUS2025 está **100% configurado y operativo** con:

- ✅ **8 hojas maestras** creadas y estructuradas
- ✅ **1,016+ campos dinámicos** distribuidos correctamente
- ✅ **Campos críticos** en columnas 1-10 (siempre visibles)
- ✅ **IS_ACTIVE** en columna 3 con formato condicional verde/rojo
- ✅ **Validaciones de datos** (dropdowns, rangos)
- ✅ **Formato condicional** automático
- ✅ **Compatible** con todo el código existente

---

## 🔗 Acceso

**URL del Spreadsheet:**
```
https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit
```

**Spreadsheet ID:**
```
1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
```

**Propietario:** beticosa1@gmail.com  
**Service Account:** arbitragexplus-sheets@arbitragex-475408.iam.gserviceaccount.com

---

## 📋 Estructura de Hojas

### 1. BLOCKCHAINS (50 campos)

**Columnas 1-10 (Críticas):**
1. **CHAIN_ID** - Identificador único (1, 56, 137, etc.)
2. **CHAIN_NAME** - Nombre (Ethereum, BSC, Polygon)
3. **IS_ACTIVE** ✅ - Habilitar/Deshabilitar (TRUE=verde, FALSE=rojo)
4. **PRIORITY** - Prioridad 1-10
5. **NETWORK_TYPE** - Mainnet/Testnet
6. **IS_TESTNET** - TRUE/FALSE
7. **CHAIN_SYMBOL** - ETH, BNB, MATIC
8. **NATIVE_TOKEN_SYMBOL** - Símbolo del token nativo
9. **RPC_URL_PRIMARY** - URL RPC principal
10. **EXPLORER_URL** - Explorador de bloques

**Columnas 11-50:** Configuración técnica (RPC secundarios, gas, fees, monitoring)

---

### 2. DEXES (201 campos)

**Columnas 1-15 (Críticas):**
1. **DEX_ID** - Identificador único
2. **DEX_NAME** - Nombre (Uniswap, SushiSwap, PancakeSwap)
3. **IS_ACTIVE** ✅ - Habilitar/Deshabilitar
4. **PRIORITY** - Prioridad 1-10
5. **CHAIN_ID** - Blockchain donde opera
6. **DEX_TYPE** - AMM, ORDERBOOK, HYBRID, AGGREGATOR
7. **PROTOCOL_VERSION** - v2, v3, etc.
8. **PROTOCOL_TYPE** - UNISWAP_V2, UNISWAP_V3, CURVE, etc.
9. **AMM_TYPE** - CONSTANT_PRODUCT, CONCENTRATED_LIQUIDITY, etc.
10. **ROUTER_ADDRESS** - Dirección del router
11. **FACTORY_ADDRESS** - Dirección de la factory
12. **QUOTER_ADDRESS** - Dirección del quoter (v3)
13. **POSITION_MANAGER_ADDRESS** - Manager de posiciones
14. **FEE_BPS** - Fee en basis points
15. **DYNAMIC_FEE_ENABLED** - TRUE/FALSE

**Columnas 16-201:** URLs, APIs, features, stats, monitoring

---

### 3. ASSETS (400 campos)

**Columnas 1-15 (Críticas):**
1. **TOKEN_SYMBOL** - Símbolo (ETH, USDC, WBTC)
2. **TOKEN_NAME** - Nombre completo
3. **IS_ACTIVE** ✅ - Habilitar/Deshabilitar
4. **IS_VERIFIED** - Token verificado
5. **CHAIN_ID** - Blockchain
6. **TOKEN_ADDRESS** - Dirección del contrato
7. **TOKEN_TYPE** - NATIVE, ERC20, ERC721, etc.
8. **TOKEN_STANDARD** - ERC20, BEP20, SPL
9. **DECIMALS** - Decimales (18, 6, etc.)
10. **IS_STABLECOIN** - TRUE/FALSE
11. **IS_WRAPPED** - TRUE/FALSE
12. **COINGECKO_ID** - ID en CoinGecko
13. **COINMARKETCAP_ID** - ID en CoinMarketCap
14. **PYTH_PRICE_FEED_ID** - Feed de Pyth
15. **CHAINLINK_FEED** - Feed de Chainlink

**Columnas 16-400:** Precios, market data, trading info, security, metadata

---

### 4. POOLS (100 campos)

**Columnas 1-15 (Críticas):**
1. **POOL_ID** - Identificador único
2. **POOL_ADDRESS** - Dirección del pool
3. **IS_ACTIVE** ✅ - Habilitar/Deshabilitar
4. **IS_VERIFIED** - Pool verificado
5. **DEX_ID** - DEX donde está el pool
6. **CHAIN_ID** - Blockchain
7. **POOL_TYPE** - V2, V3, STABLE, WEIGHTED
8. **PROTOCOL_VERSION** - Versión del protocolo
9. **TOKEN_A** - Primer token
10. **TOKEN_B** - Segundo token
11. **TOKEN_C** - Tercer token (si aplica)
12. **FEE_BPS** - Fee en basis points
13. **TICK_SPACING** - Tick spacing (v3)
14. **SQRT_PRICE_X96** - Precio actual (v3)
15. **LIQUIDITY** - Liquidez total

**Columnas 16-100:** TVL, volumen, fees, APR, trading info, stats

---

### 5. ROUTES (201 campos)

**Columnas 1-15 (Críticas):**
1. **ROUTE_ID** - Identificador único
2. **ROUTE_NAME** - Nombre descriptivo
3. **IS_ACTIVE** ✅ - Habilitar/Deshabilitar
4. **IS_PROFITABLE** - Rentable actualmente
5. **STRATEGY_TYPE** - 2DEX, 3DEX, TRIANGULAR, FLASH_LOAN
6. **ROUTE_TYPE** - DIRECT, MULTI_HOP, SPLIT
7. **PRIORITY** - Prioridad 1-10
8. **SOURCE_TOKEN** - Token de entrada
9. **TARGET_TOKEN** - Token de salida
10. **INTERMEDIATE_TOKEN** - Token intermedio
11. **DEX_1** - Primer DEX
12. **DEX_2** - Segundo DEX
13. **DEX_3** - Tercer DEX (si aplica)
14. **EXPECTED_PROFIT_USD** - Profit esperado
15. **EXPECTED_ROI_PERCENT** - ROI esperado

**Columnas 16-201:** Path, fees, amounts, slippage, gas, stats, performance

---

### 6. EXECUTIONS (51 campos)

**Columnas 1-15 (Críticas):**
1. **EXECUTION_ID** - ID único
2. **ROUTE_ID** - Ruta ejecutada
3. **STATUS** - SUCCESS, FAILED, PENDING
4. **IS_SUCCESSFUL** - TRUE/FALSE
5. **TIMESTAMP** - Fecha y hora
6. **BLOCK_NUMBER** - Número de bloque
7. **TRANSACTION_HASH** - Hash de la transacción
8. **INPUT_TOKEN** - Token de entrada
9. **OUTPUT_TOKEN** - Token de salida
10. **INPUT_AMOUNT** - Cantidad de entrada
11. **OUTPUT_AMOUNT** - Cantidad de salida
12. **PROFIT_USD** - Profit en USD
13. **ROI_PERCENT** - ROI en porcentaje
14. **GAS_USED** - Gas usado
15. **GAS_PRICE_GWEI** - Precio del gas

**Columnas 16-51:** Costos, slippage, tiempos, errores, detalles técnicos

---

### 7. CONFIG (7 campos)

1. **CONFIG_KEY** - Clave de configuración
2. **VALUE** - Valor
3. **TYPE** - Tipo de dato
4. **DESCRIPTION** - Descripción
5. **IS_ACTIVE** ✅ - Activo/Inactivo
6. **LAST_UPDATED** - Última actualización
7. **NOTES** - Notas

**Configuraciones iniciales recomendadas:**
```
MIN_PROFIT_USD          | 10      | Profit mínimo para ejecutar
MAX_SLIPPAGE            | 0.01    | Slippage máximo (1%)
MIN_CONFIDENCE          | 0.7     | Confianza mínima oráculos
ENABLED_STRATEGIES      | 2dex,3dex,triangular | Estrategias activas
MAX_GAS_PRICE_GWEI      | 50      | Gas máximo en Gwei
EXECUTION_TIMEOUT_MS    | 30000   | Timeout de ejecución
```

---

### 8. ALERTS (9 campos)

1. **ALERT_ID** - ID único
2. **TYPE** - Tipo de alerta
3. **SEVERITY** - LOW, MEDIUM, HIGH, CRITICAL
4. **STATUS** - ACTIVE, RESOLVED, IGNORED
5. **MESSAGE** - Mensaje de la alerta
6. **TIMESTAMP** - Fecha y hora
7. **RESOLVED_AT** - Cuándo se resolvió
8. **RESOLVED_BY** - Quién la resolvió
9. **NOTES** - Notas adicionales

---

## 🎨 Formato Condicional

### IS_ACTIVE (Columna C/3)

**En todas las hojas principales:**
- ✅ **TRUE** o **VERDADERO** → Fondo verde claro (#D9F2D9), texto verde oscuro, negrita
- ❌ **FALSE** o **FALSO** → Fondo rojo claro (#FFE6E6), texto rojo oscuro, negrita

### Cómo Usar:
1. Haz clic en cualquier celda de la columna IS_ACTIVE (columna C)
2. Aparecerá un dropdown con TRUE/FALSE
3. Selecciona el valor
4. La celda cambiará de color automáticamente

---

## 🔒 Validaciones de Datos

### BLOCKCHAINS
- **IS_TESTNET, SUPPORTS_EIP1559, etc.** → Dropdown TRUE/FALSE
- **PRIORITY** → Número entre 1-10
- **GAS_BUFFER_PERCENT** → Número entre 0-100

### DEXES
- **DEX_TYPE** → Dropdown: AMM, ORDERBOOK, HYBRID, AGGREGATOR
- **PROTOCOL_TYPE** → Dropdown: UNISWAP_V2, UNISWAP_V3, CURVE, BALANCER, etc.
- **AMM_TYPE** → Dropdown: CONSTANT_PRODUCT, CONCENTRATED_LIQUIDITY, STABLE_SWAP, WEIGHTED

### ASSETS
- **TOKEN_TYPE** → Dropdown: NATIVE, ERC20, ERC721, ERC1155, WRAPPED
- **TOKEN_STANDARD** → Dropdown: ERC20, BEP20, SPL, NATIVE
- **DECIMALS** → Número entre 0-18

### POOLS
- **POOL_TYPE** → Dropdown: V2, V3, STABLE, WEIGHTED, CONCENTRATED

### ROUTES
- **STRATEGY_TYPE** → Dropdown: 2DEX, 3DEX, TRIANGULAR, FLASH_LOAN, MULTI_HOP
- **ROUTE_TYPE** → Dropdown: DIRECT, MULTI_HOP, SPLIT

---

## 🚀 Cómo Configurar Datos Iniciales

### 1. Configurar Blockchains

Abre la hoja **BLOCKCHAINS** y agrega:

| CHAIN_ID | CHAIN_NAME | IS_ACTIVE | PRIORITY | NETWORK_TYPE | IS_TESTNET | CHAIN_SYMBOL | NATIVE_TOKEN_SYMBOL | RPC_URL_PRIMARY | EXPLORER_URL |
|----------|------------|-----------|----------|--------------|------------|--------------|---------------------|-----------------|--------------|
| 1 | Ethereum | TRUE | 10 | MAINNET | FALSE | ETH | ETH | https://eth.llamarpc.com | https://etherscan.io |
| 56 | BSC | TRUE | 9 | MAINNET | FALSE | BSC | BNB | https://bsc-dataseed.binance.org | https://bscscan.com |
| 137 | Polygon | TRUE | 8 | MAINNET | FALSE | MATIC | MATIC | https://polygon-rpc.com | https://polygonscan.com |
| 42161 | Arbitrum | TRUE | 7 | MAINNET | FALSE | ARB | ETH | https://arb1.arbitrum.io/rpc | https://arbiscan.io |

### 2. Configurar CONFIG

Abre la hoja **CONFIG** y agrega:

| CONFIG_KEY | VALUE | TYPE | DESCRIPTION | IS_ACTIVE |
|------------|-------|------|-------------|-----------|
| MIN_PROFIT_USD | 10 | number | Profit mínimo para ejecutar arbitraje | TRUE |
| MAX_SLIPPAGE | 0.01 | number | Slippage máximo permitido (1%) | TRUE |
| MIN_CONFIDENCE | 0.7 | number | Confianza mínima de oráculos | TRUE |
| ENABLED_STRATEGIES | 2dex,3dex,triangular | string | Estrategias habilitadas | TRUE |
| MAX_GAS_PRICE_GWEI | 50 | number | Precio máximo de gas en Gwei | TRUE |
| EXECUTION_TIMEOUT_MS | 30000 | number | Timeout de ejecución en ms | TRUE |

### 3. Dejar que el Sistema Llene el Resto

Una vez configuradas las blockchains y el config, los servicios automáticamente llenarán:

- **DEXES** - Python collector detectará DEXes activos
- **ASSETS** - Rust engine cargará tokens desde DEXes
- **POOLS** - API server descubrirá pools con liquidez
- **ROUTES** - TS executor calculará rutas rentables
- **EXECUTIONS** - Sistema registrará cada operación
- **ALERTS** - Sistema generará alertas automáticas

---

## 🔄 Flujo de Datos

```
Google Sheets (BLOCKCHAINS, CONFIG)
    ↓
SheetsService lee configuración cada 30s
    ↓
MarketDataService inicializa adaptadores DEX
    ↓
Adaptadores detectan POOLS y ASSETS
    ↓
SheetsService esc
