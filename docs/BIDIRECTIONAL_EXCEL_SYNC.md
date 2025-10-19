# Sistema de Sincronización Bidireccional Excel

## 📋 Descripción General

Sistema de sincronización bidireccional entre Excel y fuentes de datos externas basado en **detección automática de colores** en los encabezados de columnas:

- **🔵 Azul (#4472C4) = PUSH**: El sistema escribe automáticamente
- **⚪ Blanco = PULL**: El usuario escribe, el sistema lee

## 🎯 Objetivo

Crear un sistema donde el usuario solo necesita escribir un valor en una columna PULL (blanca) y el sistema automáticamente obtiene y rellena todas las columnas PUSH (azules) con datos de fuentes externas.

## 🏗️ Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO                                   │
│  Escribe "polygon" en columna NAME (PULL/blanca)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BlockchainsWatcher                              │
│  - Polling cada 500ms                                        │
│  - Detecta cambios en columnas PULL                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         BlockchainDataAggregator                             │
│  - Consulta 3 fuentes en paralelo:                          │
│    • DefiLlama API (TVL, protocolos)                        │
│    • Llamanodes (RPC endpoints)                             │
│    • Publicnodes (endpoints públicos)                       │
│  - Aplica rate limiting (Token Bucket)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ExcelClientV2                                   │
│  - Escribe datos en columnas PUSH (azules)                  │
│  - Actualiza snapshot para próxima detección                │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

1. **Usuario escribe** → Columna NAME (PULL/blanca)
2. **Watcher detecta** → Cambio en snapshot
3. **Aggregator consulta** → 3 fuentes externas (paralelo)
4. **Rate Limiter controla** → Evita bloqueos de API
5. **Client actualiza** → Columnas PUSH (azules)

## 📁 Estructura de Archivos

```
services/python-collector/src/
├── clients/                          # Clientes de APIs externas
│   ├── defillama_client.py          # DefiLlama API
│   ├── llamanodes_client.py         # Llamanodes
│   └── publicnodes_client.py        # Publicnodes
├── aggregators/                      # Agregadores de datos
│   └── blockchain_data_aggregator.py # Combina datos de 3 fuentes
├── watchers/                         # Servicios de monitoreo
│   └── blockchains_watcher.py       # Monitorea cambios en BLOCKCHAINS
├── lib/                              # Librerías compartidas
│   └── rate_limiter.py              # Token Bucket rate limiting
├── excel_client.py                   # Cliente Excel básico
└── excel_client_v2.py               # Cliente con detección de colores
```

## 🚀 Uso

### Inicio del Servicio

```bash
cd services/python-collector
PYTHONPATH=src python3 src/watchers/blockchains_watcher.py
```

### Uso desde Excel

1. Abre `data/ARBITRAGEXPLUS2025.xlsx`
2. Ve a la hoja **BLOCKCHAINS**
3. Escribe un nombre de blockchain en la columna **B (NAME)**
   - Ejemplos: `polygon`, `ethereum`, `bsc`, `arbitrum`, `avalanche`
4. Espera ~500-800ms
5. Las columnas PUSH (azules) se actualizan automáticamente

### Blockchains Soportadas

- `ethereum` - Ethereum Mainnet
- `polygon` - Polygon PoS
- `bsc` / `binance` - BNB Smart Chain
- `arbitrum` - Arbitrum One
- `optimism` - Optimism
- `avalanche` - Avalanche C-Chain
- `base` - Base
- `gnosis` - Gnosis Chain

## 📊 Datos Obtenidos

### DefiLlama (9 campos)

- `DEFILLAMA_NAME` - Nombre oficial
- `DEFILLAMA_GECKO_ID` - CoinGecko ID
- `DEFILLAMA_TOKEN_SYMBOL` - Símbolo del token
- `DEFILLAMA_CG_ID` - CoinMarketCap ID
- `TVL_USD` - Total Value Locked
- `PROTOCOLS_COUNT` - Número de protocolos
- `DEFILLAMA_CHAIN_ID` - Chain ID
- `DATA_SOURCE_DEFILLAMA` - Fuente
- `LAST_UPDATED_DEFILLAMA` - Timestamp

### Llamanodes (10 campos)

- `RPC_URL_1` - Primer endpoint RPC
- `RPC_URL_2` - Segundo endpoint RPC
- `RPC_URL_3` - Tercer endpoint RPC
- `WSS_URL_1` - Primer endpoint WebSocket
- `WSS_URL_2` - Segundo endpoint WebSocket
- `LLAMANODES_CHAIN_ID` - Chain ID
- `RPC_COUNT` - Número de RPCs
- `WSS_COUNT` - Número de WebSockets
- `DATA_SOURCE_LLAMANODES` - Fuente
- `LAST_UPDATED_LLAMANODES` - Timestamp

### Publicnodes (8 campos)

- `PUBLICNODE_RPC_HTTPS` - Endpoint RPC HTTPS
- `PUBLICNODE_RPC_WSS` - Endpoint RPC WSS
- `PUBLICNODE_CHAIN_ID` - Chain ID
- `EXPLORER_URL` - URL del explorador
- `RPC_IS_ACTIVE` - Estado del RPC
- `LATEST_BLOCK_NUMBER` - Último bloque
- `DATA_SOURCE_PUBLICNODE` - Fuente
- `LAST_UPDATED_PUBLICNODE` - Timestamp

### Campos Calculados (9 campos)

- `BLOCKCHAIN_ID` - ID único
- `NAME` - Nombre normalizado
- `CHAIN_ID` - Chain ID consolidado
- `NATIVE_TOKEN` - Token nativo
- `SYMBOL` - Símbolo
- `IS_ACTIVE` - Estado activo
- `HEALTH_STATUS` - Estado de salud
- `AGGREGATED_AT` - Timestamp de agregación
- `FETCH_TIME_MS` - Tiempo de fetch en ms

**Total: 36 campos** obtenidos automáticamente

## ⚡ Rendimiento

### Métricas Actuales

- **Detección de cambios**: <200ms
- **Fetch de APIs**: ~600-800ms
  - DefiLlama: ~300ms
  - Llamanodes: <50ms (local)
  - Publicnodes: ~200ms
- **Actualización Excel**: ~140ms
- **Total**: ~800ms

### Objetivo

- **Target**: <500ms total
- **Actual**: ~800ms (160% del objetivo)

### Optimizaciones Futuras

1. **Caché de datos** - Reducir llamadas a APIs
2. **Timeouts más cortos** - 5s → 3s
3. **Batch updates** - Actualizar múltiples filas a la vez
4. **CDN/Proxy** - Reducir latencia de red

## 🔒 Rate Limiting

### Algoritmo Token Bucket

```python
# Configuración por API
defillama: 5 requests/segundo, burst=10
llamanodes: 10 requests/segundo, burst=20
publicnodes: 10 requests/segundo, burst=20
```

### Funcionamiento

1. Bucket tiene capacidad máxima de tokens
2. Tokens se regeneran a tasa constante
3. Cada request consume 1 token
4. Si no hay tokens, espera hasta que se regeneren

## 🧪 Testing

### Test End-to-End

```bash
cd services/python-collector
PYTHONPATH=src python3 test_blockchains_sync.py
```

### Resultado Esperado

```
✅ Blockchain: avalanche
✅ Fila actualizada: 5
✅ Campos obtenidos: 36
✅ Campos verificados: 3/3
✅ Tiempo de fetch: 638ms
✅ Tiempo de actualización: 139ms
✅ Tiempo total: 778ms
```

## 📝 Estructura de la Hoja BLOCKCHAINS

### Columnas

| Col | Nombre | Tipo | Descripción |
|-----|--------|------|-------------|
| A | BLOCKCHAIN_ID | PUSH | ID único generado |
| B | NAME | PULL | Nombre ingresado por usuario |
| C | CHAIN_ID | PUSH | Chain ID numérico |
| D | NATIVE_TOKEN | PUSH | Token nativo |
| E | SYMBOL | PUSH | Símbolo |
| ... | ... | PUSH | 45 campos adicionales |

**Total: 51 columnas** (1 PULL + 50 PUSH)

## 🔄 Próximos Pasos

### Fase 1: Completada ✅
- ✅ ExcelClient con detección de colores
- ✅ Clientes de APIs externas
- ✅ Rate Limiter con Token Bucket
- ✅ BlockchainDataAggregator
- ✅ BlockchainsWatcher
- ✅ Test end-to-end

### Fase 2: Extender a Otras Hojas
- [ ] DEXES sheet watcher
- [ ] ASSETS sheet watcher
- [ ] POOLS sheet watcher
- [ ] Configuración dinámica desde Excel

### Fase 3: Optimizaciones
- [ ] Sistema de caché
- [ ] Batch updates
- [ ] Reducir latencia a <500ms
- [ ] Dashboard de monitoreo

### Fase 4: Producción
- [ ] Servicio systemd
- [ ] Logs estructurados
- [ ] Métricas y alertas
- [ ] Documentación de usuario

## 🐛 Troubleshooting

### El watcher no detecta cambios

1. Verificar que el archivo Excel existe
2. Verificar permisos de escritura
3. Revisar logs del watcher

### Datos no se actualizan

1. Verificar conectividad a internet
2. Revisar rate limiting en logs
3. Verificar que las APIs externas están activas

### Rendimiento lento

1. Revisar latencia de red
2. Verificar rate limiting
3. Considerar usar caché

## 📚 Referencias

- [DefiLlama API](https://defillama.com/docs/api)
- [Llamanodes](https://llamanodes.com/)
- [Publicnode](https://www.publicnode.com/)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)

## 👥 Contribuir

Ver `CONTRIBUTING.md` para guías de contribución.

## 📄 Licencia

Ver `LICENSE` para detalles.

