# ARBITRAGEXPLUS2025 - On-Chain Monitoring Service

Servicio de monitoreo en tiempo real de eventos on-chain con alertas multi-canal.

## 🚀 Características

- **Monitoreo en tiempo real**: WebSocket connections para latencia mínima
- **Multi-chain**: Soporte para múltiples blockchains simultáneamente
- **Alertas multi-canal**: Google Sheets, Telegram, Discord, Email, Webhooks
- **Reconexión automática**: Manejo robusto de desconexiones
- **Rate limiting**: Prevención de spam de alertas
- **Estadísticas en tiempo real**: Tracking de batches, operaciones, profit, gas

## 📋 Eventos Monitoreados

### BatchExecuted

Emitido cuando se completa un batch de operaciones.

**Datos:**
- `executor`: Dirección del ejecutor
- `batchId`: ID del batch
- `totalOperations`: Total de operaciones en el batch
- `successfulOps`: Operaciones exitosas
- `totalProfit`: Profit total generado
- `gasUsed`: Gas consumido

### OperationExecuted

Emitido cuando una operación individual se ejecuta exitosamente.

**Datos:**
- `batchId`: ID del batch
- `opIndex`: Índice de la operación
- `tokenIn`: Token de entrada
- `tokenOut`: Token de salida
- `amountIn`: Cantidad de entrada
- `amountOut`: Cantidad de salida
- `profit`: Profit generado

### OperationFailed

Emitido cuando una operación falla.

**Datos:**
- `batchId`: ID del batch
- `opIndex`: Índice de la operación
- `tokenIn`: Token de entrada
- `tokenOut`: Token de salida
- `reason`: Razón del fallo

### CircuitBreakerTriggered

Emitido cuando se activa el circuit breaker.

**Datos:**
- `batchId`: ID del batch
- `failedOps`: Número de operaciones fallidas
- `reason`: Razón de la activación

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
# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_CREDENTIALS_PATH=../../credentials/gsheets-sa.json

# WebSocket URLs
SEPOLIA_WS_URL=wss://ethereum-sepolia.publicnode.com
BSC_TESTNET_WS_URL=wss://bsc-testnet.publicnode.com

# Contract Addresses
ARBITRAGE_MANAGER_SEPOLIA=0x...
ARBITRAGE_MANAGER_BSC_TESTNET=0x...

# Telegram Alerts
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Discord Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Configuración de Chains

El servicio lee la configuración de chains desde Google Sheets (sheet `BLOCKCHAINS`).

**Columnas requeridas:**
- `chainId`: ID de la chain (ej. 11155111 para Sepolia)
- `name`: Nombre de la chain
- `rpcUrl`: URL del RPC HTTP
- `wsUrl`: URL del WebSocket
- `arbitrageManagerAddress`: Dirección del contrato ArbitrageManager
- `enabled`: `true` o `false`

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
docker build -t arbitragexplus-monitoring .

# Run
docker run -d \
  --name arbitragexplus-monitoring \
  --env-file .env \
  arbitragexplus-monitoring
```

## 📊 Canales de Alerta

### Google Sheets

Todas las alertas se escriben automáticamente en el sheet `ALERTS` con las siguientes columnas:

- `Timestamp`: Fecha y hora
- `Severity`: info, warning, error, critical
- `Chain`: Nombre de la chain
- `Title`: Título de la alerta
- `Message`: Mensaje detallado
- `TX Hash`: Hash de la transacción (si aplica)

### Telegram

Para configurar alertas de Telegram:

1. Crear un bot con [@BotFather](https://t.me/BotFather)
2. Obtener el `TELEGRAM_BOT_TOKEN`
3. Iniciar conversación con el bot
4. Obtener tu `TELEGRAM_CHAT_ID` con [@userinfobot](https://t.me/userinfobot)
5. Configurar en `.env`

**Formato de mensajes:**

```
🚨 Circuit Breaker Activated: Sepolia

Circuit breaker triggered on batch 123: Too many failures

Severity: CRITICAL
Chain: 11155111
TX: 0x1234...5678

2025-10-18T12:00:00.000Z
```

### Discord

Para configurar alertas de Discord:

1. Ir a Server Settings → Integrations → Webhooks
2. Crear un nuevo webhook
3. Copiar la URL del webhook
4. Configurar `DISCORD_WEBHOOK_URL` en `.env`

**Formato de mensajes:**

Embeds con colores según severidad:
- 🔵 Info: Azul
- 🟠 Warning: Naranja
- 🔴 Error: Rojo
- 🚨 Critical: Rojo oscuro

### Webhook Personalizado

Puedes configurar un webhook personalizado para recibir alertas en formato JSON:

```json
{
  "severity": "critical",
  "title": "Circuit Breaker Activated",
  "message": "Circuit breaker triggered on batch 123",
  "chainId": 11155111,
  "txHash": "0x1234...5678",
  "timestamp": 1697654400000
}
```

## 📈 Estadísticas

El servicio mantiene estadísticas en tiempo real:

```typescript
{
  totalBatches: 150,
  totalOperations: 3500,
  totalProfit: "45.67 ETH",
  totalGasUsed: "12500000",
  failedOperations: 12,
  circuitBreakerActivations: 2,
  activeChains: 3,
  isListening: true
}
```

Las estadísticas se muestran en logs cada minuto.

## 🔍 Eventos Programáticos

El servicio emite eventos que puedes escuchar:

```typescript
import { ChainListener } from '@arbitragexplus/monitoring';

const listener = new ChainListener();

listener.on('batchExecuted', (event) => {
  console.log('Batch executed:', event);
});

listener.on('operationFailed', (event) => {
  console.log('Operation failed:', event);
});

listener.on('circuitBreakerTriggered', (event) => {
  console.log('Circuit breaker triggered!', event);
});
```

## 🛡️ Rate Limiting

Para prevenir spam de alertas, el servicio implementa rate limiting:

- **Ventana**: 1 minuto (configurable)
- **Máximo**: 10 alertas por ventana (configurable)
- **Agrupación**: Por `severity:title`

Si se excede el límite, las alertas se descartan y se registra un warning en logs.

## 🔄 Reconexión Automática

El servicio maneja desconexiones automáticamente:

1. Detecta desconexión del WebSocket
2. Espera con backoff exponencial
3. Intenta reconectar (máximo 10 intentos)
4. Si falla, envía alerta crítica
5. Continúa monitoreando otras chains

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## 📝 Licencia

MIT

## 🤝 Contribución

Ver [CONTRIBUTING.md](../../CONTRIBUTING.md)

## 📞 Soporte

Para issues y preguntas, abrir un issue en GitHub.

