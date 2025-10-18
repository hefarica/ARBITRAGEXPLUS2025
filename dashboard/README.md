# ARBITRAGEXPLUS2025 - Real-Time Dashboard

Dashboard web con métricas en tiempo real para monitoreo del sistema de arbitraje.

## 🚀 Características

- **Métricas en tiempo real**: Actualización cada 10 segundos
- **Visualizaciones interactivas**: Charts con Chart.js
- **Actividad reciente**: Tabla de últimas 20 ejecuciones
- **Alertas**: Sistema de notificaciones filtrable
- **Multi-chain**: Monitoreo de múltiples blockchains
- **Responsive**: Diseño adaptable a móviles y tablets

## 📊 Métricas Mostradas

### Summary Cards

- **Total Batches**: Número total de batches ejecutados
- **Total Operations**: Número total de operaciones
- **Total Profit**: Profit acumulado en ETH
- **Success Rate**: Porcentaje de operaciones exitosas

### Charts

1. **Profit Over Time**: Profit generado en el tiempo (1h, 24h, 7d, 30d)
2. **Operations by Chain**: Distribución de operaciones por blockchain
3. **Gas Usage**: Uso de gas en el tiempo
4. **Success vs Failed**: Proporción de operaciones exitosas vs fallidas

### Tablas

- **Recent Activity**: Últimas 20 ejecuciones con detalles
- **Active Chains**: Estado de cada blockchain
- **Recent Alerts**: Últimas 50 alertas (filtrable por severidad)

## 🔧 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env
nano .env

# Compilar TypeScript
npm run build
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Server
PORT=3001
NODE_ENV=production

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_CREDENTIALS_PATH=../credentials/gsheets-sa.json

# Logging
LOG_LEVEL=info
```

## 🚀 Uso

### Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev

# Abrir en navegador
open http://localhost:3001
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
docker build -t arbitragexplus-dashboard .

# Run
docker run -d \
  --name arbitragexplus-dashboard \
  -p 3001:3001 \
  --env-file .env \
  arbitragexplus-dashboard
```

## 📡 API Endpoints

El dashboard expone los siguientes endpoints:

### GET /api/stats

Retorna estadísticas generales del sistema.

**Response:**

```json
{
  "totalBatches": 150,
  "totalOperations": 3500,
  "totalProfit": "45.67",
  "successRate": 95.2,
  "activeChains": 3
}
```

---

### GET /api/activity

Retorna actividad reciente (executions).

**Query Params:**
- `limit` (optional): Número de resultados (default: 20)

**Response:**

```json
[
  {
    "timestamp": 1697654400000,
    "chain": "Ethereum",
    "chainId": 1,
    "batchId": "batch_123",
    "totalOps": 10,
    "successfulOps": 9,
    "profit": "0.5",
    "gasUsed": "500000",
    "success": true,
    "txHash": "0x1234..."
  }
]
```

---

### GET /api/chains

Retorna configuración y estado de chains.

**Response:**

```json
[
  {
    "chainId": 1,
    "name": "Ethereum",
    "enabled": true,
    "operations": 1500
  }
]
```

---

### GET /api/alerts

Retorna alertas recientes.

**Query Params:**
- `limit` (optional): Número de resultados (default: 50)
- `severity` (optional): Filtrar por severidad (info, warning, error, critical)

**Response:**

```json
[
  {
    "timestamp": 1697654400000,
    "severity": "critical",
    "title": "Circuit Breaker Activated",
    "message": "Circuit breaker triggered on batch 123",
    "chain": "Ethereum",
    "txHash": "0x1234..."
  }
]
```

---

### GET /api/profit-history

Retorna historial de profit para charts.

**Query Params:**
- `timeframe` (optional): 1h, 24h, 7d, 30d (default: 24h)

**Response:**

```json
{
  "labels": ["00:00", "01:00", "02:00", ...],
  "values": [0.5, 1.2, 0.8, ...]
}
```

---

### GET /api/chain-distribution

Retorna distribución de operaciones por chain.

**Response:**

```json
{
  "labels": ["Ethereum", "BSC", "Polygon"],
  "values": [1500, 1200, 800]
}
```

---

### GET /api/gas-history

Retorna historial de uso de gas.

**Response:**

```json
{
  "labels": ["00:00", "01:00", "02:00", ...],
  "values": [500000, 450000, 520000, ...]
}
```

---

### GET /api/success-failed

Retorna estadísticas de operaciones exitosas vs fallidas.

**Response:**

```json
{
  "successful": 3325,
  "failed": 175
}
```

---

### GET /api/health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1697654400000
}
```

## 🎨 Personalización

### Colores

Editar `public/styles.css`:

```css
:root {
  --primary: #3b82f6;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  /* ... */
}
```

### Intervalo de Actualización

Editar `public/app.js`:

```javascript
const UPDATE_INTERVAL = 10000; // 10 segundos
```

### Charts

Los charts usan Chart.js. Para personalizar, editar `public/app.js` en la función `initializeCharts()`.

## 📱 Responsive Design

El dashboard es completamente responsive y se adapta a:

- **Desktop**: Layout completo con todas las métricas
- **Tablet**: Grid adaptado a 2 columnas
- **Mobile**: Layout de 1 columna con scroll

## 🔒 Seguridad

### Autenticación

Por defecto, el dashboard NO tiene autenticación. Para producción, se recomienda:

1. **Nginx con Basic Auth**:

```nginx
location / {
  auth_basic "ARBITRAGEXPLUS Dashboard";
  auth_basic_user_file /etc/nginx/.htpasswd;
  proxy_pass http://localhost:3001;
}
```

2. **OAuth2 Proxy**:

Usar OAuth2 Proxy con Google, GitHub, etc.

3. **VPN**:

Restringir acceso solo desde VPN corporativa.

### CORS

Por defecto, CORS está habilitado para todos los orígenes. Para producción:

```typescript
app.use(cors({
  origin: 'https://dashboard.arbitragexplus.com',
  credentials: true,
}));
```

## 🧪 Testing

```bash
# Verificar que el servidor inicia
npm run dev

# En otro terminal, probar endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/stats
```

## 📝 Licencia

MIT

## 🤝 Contribución

Ver [CONTRIBUTING.md](../CONTRIBUTING.md)

## 📞 Soporte

Para issues y preguntas, abrir un issue en GitHub.

