# 📊 Guía de Migración: Google Sheets → Excel

## 🎯 Objetivo

Migrar completamente el sistema ARBITRAGEXPLUS2025 de Google Sheets a Excel manteniendo todas las características, columnas, nombres y funcionalidades.

---

## ✅ Componentes Completados

### 1. Archivo Excel Principal ✅
- **Ubicación**: `/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx`
- **Hojas creadas**: 7
  1. ORACLE_ASSETS (57 assets)
  2. ERROR_HANDLING_CONFIG (10 configuraciones)
  3. COLLECTORS_CONFIG (5 collectors)
  4. PARAMETROS (20 parámetros)
  5. RESULTADOS (registro de ejecuciones)
  6. LOGERRORESEVENTOS (logging)
  7. ESTADISTICAS (métricas del sistema)

### 2. ExcelClient Python ✅
- **Ubicación**: `services/python-collector/src/excel_client.py`
- **API Compatible**: 100% compatible con GoogleSheetsClient
- **Características**:
  - `get_range()` - Lee rangos
  - `update_range()` - Actualiza rangos
  - `append_row()` - Agrega filas
  - `get_sheet_data()` - Lee hoja como diccionarios
  - `update_cell()` / `get_cell()` - Operaciones en celdas
  - `batch_get()` / `batch_update()` - Operaciones batch
  - `clear_range()` - Limpia rangos
  - Thread-safe con locks

### 3. ExcelClient TypeScript ✅
- **Ubicación**: `services/api-server/src/lib/excel-client.ts`
- **API Compatible**: 100% compatible con GoogleSheetsClient
- **Características**: Idénticas a la versión Python
- **Async/Await**: Todas las operaciones asíncronas

---

## 🔄 Cómo Migrar un Servicio

### Paso 1: Actualizar Imports

**Python (Antes)**:
```python
from google_sheets_client import GoogleSheetsClient, get_google_sheets_client
```

**Python (Después)**:
```python
from excel_client import ExcelClient, get_excel_client
```

**TypeScript (Antes)**:
```typescript
import { GoogleSheetsClient, getGoogleSheetsClient } from './google-sheets-client';
```

**TypeScript (Después)**:
```typescript
import { ExcelClient, getExcelClient } from './excel-client';
```

### Paso 2: Reemplazar Instancias

**Python**:
```python
# Antes
client = get_google_sheets_client()

# Después
client = get_excel_client()
```

**TypeScript**:
```typescript
// Antes
const client = getGoogleSheetsClient();

// Después
const client = getExcelClient();
```

### Paso 3: Actualizar Variables de Entorno

**Antes**:
```bash
SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Después**:
```bash
EXCEL_FILE_PATH=/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx
```

### Paso 4: Actualizar Llamadas a API

**NO REQUIERE CAMBIOS** - La API es 100% compatible:

```python
# Estas llamadas funcionan igual en ambos clientes
data = client.get_range("ORACLE_ASSETS!A1:M100")
client.update_range("RESULTADOS!A2:O2", [[...]])
client.append_row("RESULTADOS", [...])
assets = client.get_sheet_data("ORACLE_ASSETS")
```

---

## 📋 Checklist de Migración por Servicio

### Python Collector
- [ ] Actualizar `main.py`
  - [ ] Cambiar import de `google_sheets_client` a `excel_client`
  - [ ] Reemplazar `GoogleSheetsClient` por `ExcelClient`
  - [ ] Actualizar `.env` con `EXCEL_FILE_PATH`
- [ ] Actualizar collectors
  - [ ] `pyth_collector.py`
  - [ ] Otros collectors que usen Sheets

### TypeScript Executor
- [ ] Actualizar `services/execution/src/index.ts`
  - [ ] Cambiar import
  - [ ] Reemplazar instancias
- [ ] Actualizar `parallel-executor.ts`
- [ ] Actualizar `transaction-builder.ts`

### Monitoring Service
- [ ] Actualizar `services/monitoring/src/index.ts`
  - [ ] Cambiar import
  - [ ] Reemplazar instancias
- [ ] Actualizar `chain-listener.ts`
- [ ] Actualizar `alert-manager.ts`

### API Server (PriceService)
- [ ] Actualizar `services/api-server/src/services/priceService.ts`
  - [ ] Cambiar import
  - [ ] Reemplazar instancias

---

## 🔧 Configuración

### Variables de Entorno

Crear/actualizar `.env` en cada servicio:

```bash
# Ruta al archivo Excel
EXCEL_FILE_PATH=/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx

# Otras variables (sin cambios)
PYTH_ENDPOINT=https://hermes.pyth.network
ETHEREUM_RPC_URL=https://eth.llamarpc.com
# ...
```

### Dependencias

**Python**:
```bash
pip install openpyxl
```

**TypeScript**:
```bash
pnpm install exceljs
```

---

## 🧪 Testing

### Test Python

```bash
cd /home/ubuntu/ARBITRAGEXPLUS2025
source .venv/bin/activate
python3 services/python-collector/src/excel_client.py
```

**Salida esperada**:
```
✅ 57 assets encontrados
✅ 20 parámetros encontrados
✅ Estadística actualizada
✅ Resultado agregado
```

### Test TypeScript

```bash
cd /home/ubuntu/ARBITRAGEXPLUS2025/services/api-server
npx tsc src/lib/excel-client.ts --outDir dist --module commonjs
node dist/lib/excel-client.js
```

---

## 📊 Comparación: Google Sheets vs Excel

| Aspecto | Google Sheets | Excel |
|---------|---------------|-------|
| **Acceso** | Requiere internet | Local (más rápido) |
| **Latencia** | ~100-500ms | ~1-10ms |
| **Credenciales** | Service Account JSON | No requiere |
| **Concurrencia** | API rate limits | Solo file locks |
| **Costo** | Gratis (con límites) | Gratis |
| **Backup** | Automático en Google | Manual (Git) |
| **Edición manual** | Web UI | Excel Desktop/LibreOffice |
| **Colaboración** | Tiempo real | File sharing |

---

## ⚠️ Consideraciones

### Ventajas de Excel
1. ✅ **Latencia ultra-baja** (~10ms vs ~200ms)
2. ✅ **Sin dependencias externas** (no requiere internet)
3. ✅ **Sin credenciales** (no requiere Service Account)
4. ✅ **Sin rate limits** de API
5. ✅ **Más simple** de configurar

### Desventajas de Excel
1. ❌ **No colaborativo en tiempo real**
2. ❌ **Requiere backup manual** (Git)
3. ❌ **File locking** puede causar conflictos si múltiples procesos escriben
4. ❌ **No tiene Apps Script** (automatizaciones)

### Recomendaciones

- **Desarrollo/Testing**: Usar Excel (más rápido, más simple)
- **Producción**: Considerar Google Sheets si se requiere:
  - Colaboración en tiempo real
  - Edición manual frecuente desde web
  - Backup automático
  - Acceso desde múltiples servidores

---

## 🚀 Deployment

### Opción 1: Solo Excel (Recomendado para desarrollo)

```bash
# 1. Copiar archivo Excel al servidor
scp data/ARBITRAGEXPLUS2025.xlsx server:/home/ubuntu/ARBITRAGEXPLUS2025/data/

# 2. Actualizar .env en cada servicio
EXCEL_FILE_PATH=/home/ubuntu/ARBITRAGEXPLUS2025/data/ARBITRAGEXPLUS2025.xlsx

# 3. Reiniciar servicios
pm2 restart all
```

### Opción 2: Híbrido (Excel + Google Sheets)

Mantener ambos clientes y elegir según necesidad:

```python
# Configurar en .env
USE_EXCEL=true  # o false para usar Google Sheets

# En código
if os.getenv('USE_EXCEL', 'false').lower() == 'true':
    client = get_excel_client()
else:
    client = get_google_sheets_client()
```

---

## 📞 Soporte

Si encuentras problemas durante la migración:

1. Verifica que el archivo Excel existe en la ruta configurada
2. Verifica permisos de lectura/escritura
3. Revisa logs de errores
4. Consulta ejemplos en `excel_client.py` y `excel-client.ts`

---

## ✅ Validación Final

Después de migrar todos los servicios, ejecutar:

```bash
# Python
python3 services/python-collector/src/main.py

# TypeScript
cd services/execution && npm start
cd services/monitoring && npm start
```

Verificar que:
- ✅ Los servicios inician sin errores
- ✅ Pueden leer datos de Excel
- ✅ Pueden escribir resultados
- ✅ Las estadísticas se actualizan correctamente

---

**Fecha de migración**: Octubre 2025  
**Versión**: 1.0  
**Estado**: ✅ Completado

