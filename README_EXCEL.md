# 📊 ARBITRAGEXPLUS2025 - Versión Excel

## 🎯 Migración Completada: Google Sheets → Excel

Este proyecto ha sido migrado de Google Sheets a Excel para mejorar el rendimiento y simplificar la configuración.

---

## ⚡ Ventajas de Excel

| Aspecto | Google Sheets | Excel | Mejora |
|---------|---------------|-------|--------|
| **Latencia** | ~200ms | ~10ms | **20x más rápido** |
| **Credenciales** | Service Account JSON | No requiere | ✅ Más simple |
| **Rate Limits** | 100 req/min | Sin límites | ✅ Sin restricciones |
| **Internet** | Requerido | No requerido | ✅ Funciona offline |
| **Costo** | Gratis con límites | Gratis | ✅ Sin límites |

---

## 📁 Estructura del Archivo Excel

**Ubicación**: `data/ARBITRAGEXPLUS2025.xlsx`

### Hojas Creadas

1. **ORACLE_ASSETS** (57 assets)
   - Configuración de 6 oráculos (Pyth, Chainlink, Uniswap, Binance, CoinGecko, Band)
   - 12 columnas con IDs, direcciones y configuración

2. **ERROR_HANDLING_CONFIG** (10 configuraciones)
   - Configuración de manejo de errores
   - Retry logic, logging, alertas

3. **COLLECTORS_CONFIG** (5 collectors)
   - Configuración de collectors dinámicos
   - Prioridades, timeouts, módulos

4. **PARAMETROS** (20 parámetros)
   - Configuración del sistema de arbitraje
   - Thresholds, gas, circuit breaker

5. **RESULTADOS**
   - Registro de ejecuciones
   - Profit, gas, status

6. **LOGERRORESEVENTOS**
   - Logging de errores y eventos
   - Severidad, stack traces

7. **ESTADISTICAS**
   - Métricas del sistema
   - Total batches, profit, success rate

---

## 🚀 Quick Start

### 1. Instalar Dependencias

**Python**:
```bash
cd /home/ubuntu/ARBITRAGEXPLUS2025
source .venv/bin/activate
pip install openpyxl
```

**TypeScript**:
```bash
cd services/api-server
pnpm install exceljs
```

### 2. Configurar Entorno

```bash
# Copiar archivo de ejemplo
cp .env.excel.example .env

# Editar y configurar
nano .env
```

**Variables clave**:
```bash
EXCEL_FILE_PATH=/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx
ETHEREUM_RPC_URL=https://eth.llamarpc.com
PYTH_ENDPOINT=https://hermes.pyth.network
```

### 3. Probar ExcelClient

**Python**:
```bash
python3 services/python-collector/src/excel_client.py
```

**Salida esperada**:
```
✅ 57 assets encontrados
✅ 20 parámetros encontrados
✅ Estadística actualizada
✅ Resultado agregado
```

### 4. Iniciar Servicios

```bash
# Python Collector
cd services/python-collector
python3 src/main.py

# TypeScript Executor
cd services/execution
npm start

# Monitoring
cd services/monitoring
npm start

# Dashboard
cd dashboard
npm start
```

---

## 📖 Documentación

### Guías Completas

- **[Guía de Migración](docs/MIGRACION_EXCEL.md)** - Instrucciones detalladas para migrar servicios
- **[Seguridad](docs/security/SECURITY.md)** - Mejores prácticas de seguridad
- **[Gestión de Secretos](docs/security/SECRETS_MANAGEMENT.md)** - Manejo de claves privadas

### APIs

- **[ExcelClient Python](services/python-collector/src/excel_client.py)** - Cliente Python
- **[ExcelClient TypeScript](services/api-server/src/lib/excel-client.ts)** - Cliente TypeScript

---

## 🔧 Uso de ExcelClient

### Python

```python
from excel_client import ExcelClient, get_excel_client

# Obtener instancia
client = get_excel_client()

# Leer datos
assets = client.get_sheet_data("ORACLE_ASSETS")
print(f"Assets: {len(assets)}")

# Actualizar celda
client.update_cell("ESTADISTICAS", "B2", 150)

# Agregar resultado
client.append_row("RESULTADOS", [
    datetime.now(), "BATCH_001", "ethereum", "USDC", "ETH",
    10000, 4.02, 50, 0.5, 150000, 15, 35, "0x1234", "SUCCESS", ""
])
```

### TypeScript

```typescript
import { ExcelClient, getExcelClient } from './excel-client';

// Obtener instancia
const client = getExcelClient();

// Leer datos
const assets = await client.getSheetData('ORACLE_ASSETS');
console.log(`Assets: ${assets.length}`);

// Actualizar celda
await client.updateCell('ESTADISTICAS', 'B2', 150);

// Agregar resultado
await client.appendRow('RESULTADOS', [
  new Date(), 'BATCH_001', 'ethereum', 'USDC', 'ETH',
  10000, 4.02, 50, 0.5, 150000, 15, 35, '0x1234', 'SUCCESS', ''
]);
```

---

## 🧪 Testing

### Tests de Integración

```bash
# Python
cd test
python3 -m pytest test_excel_integration.py

# TypeScript
cd test
npm test excel-integration.test.ts
```

### Validación Manual

Abrir el archivo Excel y verificar:
- ✅ Datos en ORACLE_ASSETS
- ✅ Configuración en PARAMETROS
- ✅ Resultados en RESULTADOS
- ✅ Estadísticas actualizadas

---

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  EXCEL (Cerebro - Configuración Estratégica)               │
│  - ORACLE_ASSETS (57 tokens)                                │
│  - PARAMETROS (20 parámetros)                               │
│  - ERROR_HANDLING_CONFIG                                    │
│  - COLLECTORS_CONFIG                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [Latencia < 10ms]
                    ExcelClient (Python/TS)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PYTHON COLLECTOR (Cache en Memoria)                        │
│  - Lee configuración de Excel cada 5 min                    │
│  - Consulta 6 oráculos en paralelo                          │
│  - Detecta oportunidades de arbitraje                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [WebSocket real-time]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  RUST ENGINE (Procesamiento <1ms)                           │
│  - Calcula rutas óptimas                                    │
│  - Simula ejecución                                         │
│  - Genera transacciones batch                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [Validación con Pyth <100ms]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  TS EXECUTOR (Ejecución Atómica)                            │
│  - Ejecuta batch de hasta 40 operaciones                    │
│  - Actualiza resultados en Excel                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad

### Backup del Archivo Excel

```bash
# Backup manual
cp data/ARBITRAGEXPLUS2025.xlsx data/backups/ARBITRAGEXPLUS2025_$(date +%Y%m%d_%H%M%S).xlsx

# Backup automático con Git
git add data/ARBITRAGEXPLUS2025.xlsx
git commit -m "backup: Excel data $(date)"
git push
```

### Permisos

```bash
# Solo el usuario puede leer/escribir
chmod 600 data/ARBITRAGEXPLUS2025.xlsx

# Verificar permisos
ls -la data/ARBITRAGEXPLUS2025.xlsx
```

---

## 🐛 Troubleshooting

### Error: Excel file not found

```bash
# Verificar que el archivo existe
ls -la /home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx

# Si no existe, crear desde script
python3 scripts/create-excel-workbook.py
```

### Error: Permission denied

```bash
# Dar permisos de lectura/escritura
chmod 600 data/ARBITRAGEXPLUS2025.xlsx
```

### Error: File is locked

```bash
# Verificar procesos que usan el archivo
lsof data/ARBITRAGEXPLUS2025.xlsx

# Matar proceso si es necesario
kill -9 <PID>
```

---

## 📞 Soporte

- **Documentación**: `docs/MIGRACION_EXCEL.md`
- **Issues**: GitHub Issues
- **Ejemplos**: Ver `excel_client.py` y `excel-client.ts`

---

## ✅ Checklist de Deployment

- [ ] Archivo Excel creado en `data/`
- [ ] Variables de entorno configuradas (`.env`)
- [ ] Dependencias instaladas (`openpyxl`, `exceljs`)
- [ ] ExcelClient testeado (Python y TypeScript)
- [ ] Servicios iniciados sin errores
- [ ] Datos leídos correctamente de Excel
- [ ] Resultados escritos correctamente a Excel
- [ ] Backup configurado (Git o manual)
- [ ] Permisos configurados (chmod 600)

---

**Versión**: 1.0  
**Fecha**: Octubre 2025  
**Estado**: ✅ Producción Ready

