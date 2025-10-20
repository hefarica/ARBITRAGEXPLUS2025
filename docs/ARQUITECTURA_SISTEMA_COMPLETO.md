# Arquitectura del Sistema ARBITRAGEXPLUS2025

**Versión:** 2.0
**Fecha:** 19 de octubre de 2025
**Autor:** Manus AI

## 1. Visión General

ARBITRAGEXPLUS2025 es un sistema de arbitraje de criptomonedas de alta frecuencia que utiliza **Microsoft Excel como interfaz de usuario principal** y sigue una arquitectura reactiva basada en eventos. El sistema distingue entre columnas **PUSH** (actualizadas automáticamente por el sistema) y **PULL** (que desencadenan acciones cuando el usuario las modifica).

### 1.1. Principios de Diseño

El sistema se construye sobre los siguientes principios fundamentales:

- **Reactividad:** Los cambios en Excel desencadenan acciones inmediatas en el sistema backend.
- **Idempotencia:** Todos los componentes pueden ejecutarse múltiples veces sin efectos secundarios.
- **Baja Latencia:** Comunicación COM nativa para actualizaciones de Excel en <10ms.
- **Validación Cruzada:** Múltiples fuentes de datos (DefiLlama, Llamanodes, Publicnodes) para mayor confiabilidad.
- **Orquestación Centralizada:** Un único ejecutable maestro (`MASTER_RUNNER.exe`) gestiona todo el ciclo de vida del sistema.

### 1.2. Contrato de Interfaz Excel

El sistema utiliza **colores de encabezado** para definir el comportamiento de las columnas:

| Color de Encabezado | Tipo | Comportamiento |
| :--- | :--- | :--- |
| **Azul (`#4472C4`)** | PUSH | El sistema escribe datos automáticamente cuando cambian en la fuente |
| **Blanco** | PULL | El usuario escribe datos que desencadenan acciones del sistema |

**Ejemplo práctico en la hoja BLOCKCHAINS:**
- Usuario escribe "polygon" en columna `NAME` (blanco/PULL)
- Sistema detecta el cambio vía VBA → COM
- Sistema consulta DefiLlama, Llamanodes y Publicnodes en paralelo
- Sistema actualiza todas las columnas azules (PUSH) con datos de Polygon

## 2. Arquitectura de Componentes

El sistema consta de 5 componentes principales que se comunican mediante eventos y APIs REST:

```
┌─────────────────────────────────────────────────────────────┐
│                     MASTER_RUNNER.exe                       │
│              (Instalador y Orquestador Maestro)             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│  API Server  │◄───┤  Excel COM       │    │   Oráculos   │
│  (Node.js)   │    │  Bridge (.NET 8) │    │   (Python)   │
└──────────────┘    └──────────────────┘    └──────────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Excel (.xlsm)                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │BLOCKCHAINS│  DEXES  │  ASSETS  │  POOLS   │  ROUTES  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.1. MASTER_RUNNER.exe (Instalador Maestro)

**Tecnología:** C# .NET 8
**Responsabilidades:**

1. **Auto-Diagnóstico:** Verifica qué componentes están instalados
2. **Gestión de Dependencias:**
   - .NET 8 SDK
   - Node.js y npm
   - Python y pip
   - Paquetes de Python (`requests`, `aiohttp`)
   - Paquetes de Node.js (ejecuta `npm install`)
3. **Compilación:** Compila el puente COM si no existe o si el código fuente es más reciente
4. **Configuración:** Crea archivos `.env` y `settings.json` desde plantillas
5. **Orquestación:** Inicia todos los servicios en segundo plano
6. **Monitorización:** Muestra logs unificados de todos los servicios
7. **Apagado Limpio:** Detiene todos los servicios con Ctrl+C

**Archivos:**
- `installer/MASTER_RUNNER.csproj`
- `installer/Program.cs`
- `installer/ComponentsChecker.cs`
- `installer/ServiceManager.cs`
- `installer/FileManager.cs`

### 2.2. Excel COM Bridge (Puente COM)

**Tecnología:** C# .NET 8 con COM Interop
**Responsabilidades:**

1. **Interfaz COM:** Expone clase `AutomationEngine` visible para VBA
2. **Detección de Eventos:** Recibe llamadas desde VBA cuando el usuario modifica celdas PULL
3. **Cola de Procesamiento:** Encola solicitudes para procesamiento asíncrono
4. **Orquestación de Colectores:** Llama a los 3 colectores de datos en paralelo
5. **Fusión de Datos:** Combina datos de múltiples fuentes con priorización
6. **Escritura en Excel:** Actualiza celdas PUSH sin flicker (ScreenUpdating = False)
7. **Auto-Limpieza:** Limpia celdas PUSH cuando la celda NAME está vacía

**Archivos:**
- `automation/excel-com-bridge/ExcelComBridge.csproj`
- `automation/excel-com-bridge/Program.cs`
- `automation/excel-com-bridge/AutomationEngine.cs`
- `automation/excel-com-bridge/WorkerQueue.cs`
- `automation/excel-com-bridge/ExcelWriter.cs`
- `automation/excel-com-bridge/Collectors/DefiLlamaCollector.cs`
- `automation/excel-com-bridge/Collectors/LlamanodesCollector.cs`
- `automation/excel-com-bridge/Collectors/PublicnodesCollector.cs`
- `automation/excel-com-bridge/Collectors/BlockchainDataMerger.cs`

### 2.3. Colectores de Datos

Cada colector es una clase C# que obtiene datos de una fuente específica:

#### 2.3.1. DefiLlamaCollector

**Fuente:** https://api.llama.fi/
**Datos que proporciona:**
- TVL (Total Value Locked)
- Volumen de trading
- Número de protocolos
- Cambio porcentual en 24h
- Dominancia de mercado

**Endpoints utilizados:**
- `/v2/chains`
- `/tvl/{chain}`
- `/v2/historicalChainTvl/{chain}`

#### 2.3.2. LlamanodesCollector

**Fuente:** GitHub - llamanodes/chainlist
**Datos que proporciona:**
- RPCs públicos (HTTP y WebSocket)
- Chain ID
- Símbolo de moneda nativa
- Exploradores de bloques
- Direcciones de contratos estándar

**Método:** Descarga y parsea archivos JSON del repositorio

#### 2.3.3. PublicnodesCollector

**Fuente:** https://www.publicnode.com/
**Datos que proporciona:**
- Estado de salud de RPCs
- Latencia promedio
- RPCs alternativos
- Uptime

**Método:** Web scraping o API si está disponible

#### 2.3.4. BlockchainDataMerger

**Responsabilidad:** Fusionar datos de los 3 colectores siguiendo reglas de priorización:

| Campo | Fuente Primaria | Fuente Secundaria | Fuente Terciaria |
| :--- | :--- | :--- | :--- |
| TVL | DefiLlama | - | - |
| Chain ID | Llamanodes | Publicnodes | - |
| RPC HTTP | Llamanodes | Publicnodes | - |
| RPC WebSocket | Llamanodes | Publicnodes | - |
| Explorer | Llamanodes | Publicnodes | - |
| Símbolo Nativo | Llamanodes | DefiLlama | - |

### 2.4. API REST (Servidor Node.js)

**Tecnología:** TypeScript + Express
**Responsabilidades:**

1. **Recepción de Precios:** Endpoint `POST /api/v1/prices` para recibir datos de oráculos
2. **Consulta de Precios:** Endpoint `GET /api/v1/prices/latest` para obtener últimos precios
3. **Streaming SSE:** Endpoint `GET /api/v1/prices/stream` para Server-Sent Events
4. **Retransmisión:** Al recibir datos por POST, los retransmite vía SSE a clientes conectados

**Archivos:**
- `automation/api-server/package.json`
- `automation/api-server/src/server.ts`
- `automation/api-server/src/routes/prices.ts`
- `automation/api-server/src/middleware/validation.ts`

**Endpoints:**

```typescript
POST   /api/v1/prices          // Recibir datos de oráculos
GET    /api/v1/prices/latest   // Obtener últimos precios
GET    /api/v1/prices/stream   // SSE para streaming
GET    /health                 // Health check
```

### 2.5. Oráculos de Precios (Python)

**Tecnología:** Python 3.11 con `aiohttp` y `websockets`
**Responsabilidades:**

1. **Conexión WebSocket:** Conectar a APIs de exchanges (Binance, Coinbase, etc.)
2. **Procesamiento de Datos:** Parsear y normalizar datos de precios
3. **Envío a API:** POST a `http://localhost:3000/api/v1/prices`
4. **Reconexión Automática:** Manejar desconexiones y reconectar

**Archivos:**
- `automation/oracles/BinanceOracleV2.py`
- `automation/oracles/CoinbaseOracle.py`
- `automation/oracles/requirements.txt`

### 2.6. Código VBA (Excel)

**Responsabilidades:**

1. **Detección de Cambios:** Interceptar evento `Worksheet_Change`
2. **Identificación de Tipo:** Determinar si la columna es PUSH o PULL por color
3. **Llamada COM:** Invocar `AutomationEngine.OnCellChanged(row, column, value)`
4. **Prevención de Bucles:** Usar `Application.EnableEvents = False` durante actualizaciones
5. **Gestión de Errores:** Manejar errores sin interrumpir Excel

**Archivos:**
- `ARBITRAGEXPLUS2025.xlsm` (ThisWorkbook)
- Módulo `AutomationController`

## 3. Flujo de Datos Detallado

### 3.1. Flujo de Actualización (Usuario → Sistema → Excel)

```
1. Usuario escribe "polygon" en celda B5 (columna NAME, hoja BLOCKCHAINS)
   ↓
2. VBA detecta cambio en Worksheet_Change
   ↓
3. VBA verifica que NAME es columna PULL (encabezado blanco)
   ↓
4. VBA llama: AutomationEngine.OnCellChanged(5, "NAME", "polygon")
   ↓
5. COM Bridge encola solicitud en WorkerQueue
   ↓
6. Worker procesa solicitud:
   ├─→ DefiLlamaCollector.GetDataAsync("polygon")   [Paralelo]
   ├─→ LlamanodesCollector.GetDataAsync("polygon")  [Paralelo]
   └─→ PublicnodesCollector.GetDataAsync("polygon") [Paralelo]
   ↓
7. BlockchainDataMerger fusiona los 3 resultados
   ↓
8. ExcelWriter actualiza celdas PUSH en fila 5:
   - Application.ScreenUpdating = False
   - Escribe TVL, Chain ID, RPC, Explorer, etc.
   - Application.ScreenUpdating = True
   ↓
9. Usuario ve datos actualizados en <500ms
```

### 3.2. Flujo de Precios (Oráculo → API → Excel)

```
1. BinanceOracleV2.py conecta a WebSocket de Binance
   ↓
2. Recibe actualización de precio: BTC/USDT = 67,234.56
   ↓
3. POST a http://localhost:3000/api/v1/prices
   {
     "symbol": "BTCUSDT",
     "price": 67234.56,
     "timestamp": 1697654321000,
     "source": "binance"
   }
   ↓
4. API Server recibe POST y retransmite vía SSE
   ↓
5. Excel COM Bridge (o VBA) escucha SSE
   ↓
6. Actualiza celdas PUSH en hoja ASSETS
```

## 4. Mapeo de Campos para Hoja BLOCKCHAINS

### 4.1. Tabla de Mapeo Completo

| # | Columna | Tipo | Fuente Primaria | Fuente Secundaria | Fuente Terciaria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | BLOCKCHAIN_ID | PUSH | Auto-generado | - | - |
| 2 | NAME | PULL | Usuario | - | - |
| 3 | CHAIN_ID | PUSH | Llamanodes | Publicnodes | - |
| 4 | SYMBOL | PUSH | Llamanodes | DefiLlama | - |
| 5 | RPC_HTTP | PUSH | Llamanodes | Publicnodes | - |
| 6 | RPC_WS | PUSH | Llamanodes | Publicnodes | - |
| 7 | EXPLORER | PUSH | Llamanodes | Publicnodes | - |
| 8 | TVL | PUSH | DefiLlama | - | - |
| 9 | VOLUME_24H | PUSH | DefiLlama | - | - |
| 10 | PROTOCOLS_COUNT | PUSH | DefiLlama | - | - |
| 11 | TVL_CHANGE_24H | PUSH | DefiLlama | - | - |
| 12 | MARKET_SHARE | PUSH | DefiLlama | - | - |
| 13 | AVG_LATENCY | PUSH | Publicnodes | - | - |
| 14 | UPTIME | PUSH | Publicnodes | - | - |
| 15 | STATUS | PUSH | Publicnodes | - | - |

*(Continúa hasta 51 columnas según especificación)*

### 4.2. Lógica de Fusión

```csharp
public class BlockchainDataMerger
{
    public BlockchainData Merge(
        DefiLlamaData? defillama,
        LlamanodesData? llamanodes,
        PublicnodesData? publicnodes)
    {
        return new BlockchainData
        {
            ChainId = llamanodes?.ChainId ?? publicnodes?.ChainId ?? 0,
            Symbol = llamanodes?.Symbol ?? defillama?.Symbol ?? "",
            RpcHttp = llamanodes?.RpcHttp ?? publicnodes?.RpcHttp ?? "",
            RpcWs = llamanodes?.RpcWs ?? publicnodes?.RpcWs ?? "",
            Explorer = llamanodes?.Explorer ?? publicnodes?.Explorer ?? "",
            Tvl = defillama?.Tvl ?? 0,
            Volume24h = defillama?.Volume24h ?? 0,
            ProtocolsCount = defillama?.ProtocolsCount ?? 0,
            TvlChange24h = defillama?.TvlChange24h ?? 0,
            MarketShare = defillama?.MarketShare ?? 0,
            AvgLatency = publicnodes?.AvgLatency ?? 0,
            Uptime = publicnodes?.Uptime ?? 0,
            Status = publicnodes?.Status ?? "unknown"
        };
    }
}
```

## 5. Requisitos del Sistema

### 5.1. Software

| Componente | Versión Mínima | Instalación |
| :--- | :--- | :--- |
| Windows | 10 Pro | Pre-instalado |
| .NET SDK | 8.0 | Auto-instalado por MASTER_RUNNER |
| Node.js | 18.x | Auto-instalado por MASTER_RUNNER |
| Python | 3.11 | Auto-instalado por MASTER_RUNNER |
| Microsoft Excel | 2016 | Manual |

### 5.2. Hardware

- **CPU:** Dual-core 2.5 GHz o superior
- **RAM:** 8 GB mínimo, 16 GB recomendado
- **Disco:** 10 GB de espacio libre
- **Red:** Conexión a Internet estable (10 Mbps+)

## 6. Seguridad y Mejores Prácticas

### 6.1. Gestión de Credenciales

- Todas las API keys se almacenan en archivos `.env` (nunca en código)
- Los archivos `.env` están en `.gitignore`
- Se proporcionan plantillas `.env.template` para configuración inicial

### 6.2. Validación de Datos

- Todos los datos de APIs externas se validan antes de escribir en Excel
- Se implementan timeouts para evitar bloqueos
- Se registran errores en logs para debugging

### 6.3. Manejo de Errores

- Todos los componentes tienen try-catch comprehensivos
- Los errores se registran con contexto completo
- El sistema continúa funcionando ante fallos parciales

## 7. Extensibilidad

El sistema está diseñado para ser fácilmente extensible:

### 7.1. Agregar Nuevas Hojas

1. Definir estructura de columnas (PUSH/PULL)
2. Crear colectores de datos específicos
3. Implementar lógica de fusión
4. Actualizar VBA para detectar la nueva hoja

### 7.2. Agregar Nuevas Fuentes de Datos

1. Crear nueva clase `Collector` que implemente `IDataCollector`
2. Registrar en `BlockchainDataMerger`
3. Definir priorización en tabla de mapeo

### 7.3. Agregar Nuevos Oráculos

1. Crear nuevo script Python que implemente el mismo patrón
2. Configurar en `MASTER_RUNNER` para inicio automático
3. Agregar endpoint si es necesario

## 8. Monitorización y Logging

### 8.1. Logs Unificados

MASTER_RUNNER muestra logs de todos los servicios en una única consola:

```
[API Server] Server listening on port 3000
[Binance Oracle] Connected to WebSocket
[Excel COM Bridge] Waiting for Excel events...
[Binance Oracle] BTC/USDT: 67234.56
[Excel COM Bridge] Processing: polygon (row 5)
[DefiLlama] Fetched data for polygon: TVL=$5.2B
[Excel COM Bridge] Updated 15 cells in row 5
```

### 8.2. Archivos de Log

Cada servicio también escribe logs a archivos:

- `automation/api-server/logs/api-{date}.log`
- `automation/excel-com-bridge/logs/com-{date}.log`
- `automation/oracles/logs/oracle-{date}.log`

## 9. Conclusión

Este sistema representa una arquitectura robusta y escalable para arbitraje de criptomonedas, combinando la familiaridad de Excel con la potencia de múltiples lenguajes de programación y fuentes de datos. La arquitectura reactiva basada en eventos garantiza baja latencia y alta responsividad, mientras que la orquestación centralizada simplifica el despliegue y la gestión.

