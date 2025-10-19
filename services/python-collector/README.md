# Sistema de Automatización Bidireccional Excel

Sistema que sincroniza automáticamente datos entre Excel y fuentes externas (DefiLlama, Publicnodes, Llamanodes).

## 🚀 Instalación Rápida

### Windows

1. **Descarga el repositorio** desde GitHub
2. **Navega a la carpeta**:
   ```cmd
   cd ARBITRAGEXPLUS2025\services\python-collector
   ```
3. **Ejecuta el instalador**:
   ```cmd
   INSTALL_WINDOWS.bat
   ```
4. **Inicia el watcher**:
   ```cmd
   START_WATCHER.bat
   ```

### Linux / Mac

1. **Descarga el repositorio** desde GitHub
2. **Navega a la carpeta**:
   ```bash
   cd ARBITRAGEXPLUS2025/services/python-collector
   ```
3. **Ejecuta el instalador**:
   ```bash
   ./install.sh
   ```
4. **Inicia el watcher**:
   ```bash
   ./start_watcher.sh
   ```

## 📋 Requisitos

- **Python 3.11+** (descargar desde https://www.python.org/downloads/)
- **Archivo Excel**: `ARBITRAGEXPLUS2025.xlsx` en la carpeta `data/`
- **Conexión a Internet**: Para consultar APIs externas

## 🎯 Cómo Usar

### Paso 1: Iniciar el Watcher

Ejecuta el script correspondiente a tu sistema operativo:
- Windows: `START_WATCHER.bat`
- Linux/Mac: `./start_watcher.sh`

Verás un mensaje como:
```
========================================
ARBITRAGEXPLUS2025 - Iniciando Watcher
========================================

[OK] Archivo Excel encontrado
Iniciando watcher...
El watcher monitoreará la columna NAME cada 1 segundo
```

### Paso 2: Abrir Excel

Abre el archivo `data/ARBITRAGEXPLUS2025.xlsx` en Microsoft Excel o LibreOffice Calc.

### Paso 3: Escribir un Nombre de Blockchain

1. Ve a la hoja **BLOCKCHAINS**
2. Busca una fila vacía (ej: fila 6)
3. En la columna **B (NAME)**, escribe uno de estos nombres:
   - `ethereum`
   - `polygon`
   - `bsc`
   - `arbitrum`
   - `optimism`
   - `avalanche`
   - `base`
   - `gnosis`

### Paso 4: Guardar y Esperar

1. **Guarda el archivo** (Ctrl+S o Cmd+S)
2. **Espera 1-2 segundos**
3. **Recarga el archivo** (cierra y abre, o presiona F5)
4. Las **50 columnas PUSH** (azules) se habrán actualizado automáticamente

## 🔍 Qué Datos se Auto-Completan

Cuando escribes un nombre de blockchain, el sistema obtiene automáticamente:

### Datos Básicos
- Chain ID (ej: 1 para Ethereum)
- Token Nativo (ej: ETH)
- Símbolo (ej: ETH)

### Datos Financieros (DefiLlama)
- TVL (Total Value Locked) en USD
- IDs de CoinGecko y CoinMarketCap
- Nombre en DefiLlama

### Endpoints RPC (Publicnodes)
- 3 URLs RPC HTTP
- 2 URLs WebSocket
- URL del explorador de bloques
- Estado de los RPCs

### Datos de Llamanodes
- RPC de Llamanodes
- WebSocket de Llamanodes
- Documentación
- Estado de verificación

### Metadatos
- Última actualización
- Fuentes de datos
- Estado de salud (HEALTHY/DEGRADED/UNHEALTHY)
- Blockchain activa (Sí/No)

**Total**: **50 campos** actualizados automáticamente

## ⚡ Rendimiento

- **Detección de cambios**: <100ms
- **Obtención de datos**: 15-130ms
- **Actualización Excel**: ~50ms
- **Total promedio**: **89ms** ✅

## 🎨 Convención de Colores

El sistema utiliza colores en los encabezados para determinar el flujo de datos:

| Color | Tipo | Dirección | Descripción |
|-------|------|-----------|-------------|
| **Blanco** | PULL | Usuario → Sistema | Usuario escribe, sistema lee |
| **Azul** (#4472C4) | PUSH | Sistema → Usuario | Sistema escribe automáticamente |

## 🔧 Configuración Avanzada

### Cambiar la Ruta del Archivo Excel

Edita el script de inicio (`START_WATCHER.bat` o `start_watcher.sh`) y modifica la variable:

**Windows**:
```batch
set EXCEL_PATH=C:\ruta\a\tu\archivo.xlsx
```

**Linux/Mac**:
```bash
EXCEL_PATH="/ruta/a/tu/archivo.xlsx"
```

### Cambiar la Frecuencia de Polling

Edita `src/blockchains_watcher_v2.py` y modifica:
```python
POLLING_INTERVAL = 1.0  # segundos (por defecto: 1)
```

### Ajustar Rate Limiting

Edita `src/rate_limiter.py` y modifica:
```python
DEFAULT_CONFIGS = {
    'defillama': RateLimitConfig('DefiLlama', max_requests=10, period_seconds=1.0),
    'publicnodes': RateLimitConfig('Publicnodes', max_requests=5, period_seconds=1.0),
    'llamanodes': RateLimitConfig('Llamanodes', max_requests=5, period_seconds=1.0)
}
```

## 🐛 Troubleshooting

### Error: "Python no está instalado"
**Solución**: Instala Python 3.11+ desde https://www.python.org/downloads/

### Error: "Archivo Excel no encontrado"
**Solución**: 
1. Verifica que el archivo `ARBITRAGEXPLUS2025.xlsx` está en la carpeta `data/`
2. O edita la ruta en el script de inicio

### Error: "No se pudieron instalar las dependencias"
**Solución**:
```bash
# Actualiza pip
python -m pip install --upgrade pip

# Reinstala dependencias
pip install -r requirements.txt
```

### Las columnas no se actualizan
**Solución**:
1. Verifica que el watcher está ejecutándose
2. Asegúrate de **guardar el archivo** después de escribir en NAME
3. Espera 1-2 segundos
4. **Recarga el archivo** en Excel
5. Verifica que tienes conexión a Internet

### Error: "Rate limiter timeout"
**Solución**: Las APIs externas están sobrecargadas. Espera unos segundos y vuelve a intentar.

## 📊 Logs

El watcher genera logs detallados en la consola:

```
[INFO] Cambio detectado en fila 6: None -> ethereum
[INFO] Consultando datos para: ethereum
[INFO] DefiLlama: TVL $176.9B
[INFO] Publicnodes: 3 RPCs obtenidos
[INFO] Llamanodes: RPC verificado
[INFO] Actualizando 50 columnas PUSH en fila 6
[INFO] Actualización completada en 89ms
```

## 🧪 Pruebas

### Ejecutar Pruebas End-to-End

```bash
cd ARBITRAGEXPLUS2025
python test/test_bidirectional_sync.py
```

### Ejecutar Pruebas de Rate Limiter

```bash
cd services/python-collector/src
python test_rate_limiter.py
```

### Ejecutar Pruebas de Integración

```bash
cd services/python-collector/src
python test_real_data_integration.py
```

## 📚 Documentación Adicional

- **Arquitectura**: `docs/EXCEL_AUTOMATION_SYSTEM.md`
- **Reporte de Implementación**: `EXCEL_AUTOMATION_IMPLEMENTATION_REPORT.md`
- **Documentación de APIs**:
  - DefiLlama: https://defillama.com/docs/api
  - Publicnode: https://www.publicnode.com/
  - Llamanodes: https://llamanodes.com/

## 🆘 Soporte

Si tienes problemas:
1. Revisa la sección **Troubleshooting** arriba
2. Verifica los logs en la consola del watcher
3. Consulta la documentación en `docs/`
4. Abre un issue en GitHub

## 📝 Licencia

Este proyecto es parte de ARBITRAGEXPLUS2025.

## 🎉 ¡Listo!

El sistema está configurado y listo para usar. Simplemente:
1. Inicia el watcher
2. Abre Excel
3. Escribe un nombre de blockchain
4. ¡Disfruta de la automatización!

