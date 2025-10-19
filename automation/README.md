# Automatización Bidireccional Excel - ARBITRAGEXPLUS2025

Sistema completo de automatización bidireccional entre Excel y fuentes de datos externas.

## 📁 Estructura

```
automation/
├── excel-com-bridge/          # Sistema COM (Windows) - Latencia <10ms
│   ├── src/                   # Código fuente C#
│   ├── RUN.bat               # ⭐ EJECUTAR ESTO (Windows)
│   ├── Start-ExcelComBridge.bat
│   ├── Start-ExcelComBridge.ps1
│   └── README.md
│
└── python-collector/          # Sistema Python (Cross-platform) - Latencia ~500ms
    ├── src/                   # Código fuente Python
    ├── START_WATCHER.bat     # Ejecutar en Windows
    ├── start_watcher.sh      # Ejecutar en Linux/Mac
    ├── INSTALL_WINDOWS.bat
    ├── install.sh
    └── README.md
```

## 🚀 Inicio Rápido

### Windows (Recomendado - Latencia <10ms)

**Opción 1: Doble clic** (Más fácil)
```
1. Ve a: automation/excel-com-bridge/
2. Doble clic en: RUN.bat
3. Selecciona el archivo Excel cuando se abra el diálogo
4. ¡Listo!
```

**Opción 2: Desde cualquier carpeta**
```cmd
cd C:\cualquier\carpeta
C:\ruta\a\ARBITRAGEXPLUS2025\automation\excel-com-bridge\RUN.bat
```

El script:
- ✅ Busca automáticamente el archivo `ARBITRAGEXPLUS2025.xlsx`
- ✅ Si no lo encuentra, abre un diálogo para seleccionarlo
- ✅ Compila el proyecto automáticamente
- ✅ Ejecuta el sistema COM

### Linux / Mac (Latencia ~500ms)

```bash
cd automation/python-collector
./install.sh
./start_watcher.sh
```

## 🎯 Comparación de Sistemas

| Característica | Excel COM Bridge (C#) | Python Collector |
|----------------|----------------------|------------------|
| **Plataforma** | Windows only | Cross-platform |
| **Latencia** | **<10ms** ⚡ | ~500ms |
| **Método** | Eventos COM nativos | Polling (1s) |
| **Persistencia** | Instantánea | Siguiente ciclo |
| **Requisitos** | .NET 8.0 + Excel | Python 3.11+ |
| **Uso de CPU** | Bajo | Medio |
| **Recomendado para** | Producción Windows | Desarrollo/Testing |

## 📋 Requisitos

### Excel COM Bridge (Windows)
- Windows 10/11
- .NET 8.0 SDK ([Descargar](https://dotnet.microsoft.com/download))
- Microsoft Excel instalado
- Archivo: `ARBITRAGEXPLUS2025.xlsx`

### Python Collector (Cross-platform)
- Python 3.11+ ([Descargar](https://www.python.org/downloads/))
- Archivo: `ARBITRAGEXPLUS2025.xlsx`

## 🎮 Cómo Usar

### 1. Iniciar el Sistema

**Windows (COM - Recomendado)**:
```cmd
cd automation\excel-com-bridge
RUN.bat
```

**Linux/Mac (Python)**:
```bash
cd automation/python-collector
./start_watcher.sh
```

### 2. Usar en Excel

1. **Abre Excel** (si no está abierto)
2. **Ve a la hoja BLOCKCHAINS**
3. **Escribe un nombre de blockchain** en columna B (NAME):
   - `polygon`
   - `ethereum`
   - `bsc`
   - `arbitrum`
   - `avalanche`
   - etc.

### 3. Resultado

**Con COM (Windows)**:
- ⚡ **<10ms**: Detecta el cambio
- 🔍 **~100ms**: Consulta APIs externas
- ✅ **~50ms**: Actualiza 50 columnas PUSH
- **Total: ~160ms** ⚡

**Con Python**:
- 🔍 **~638ms**: Consulta APIs externas
- ✅ **~139ms**: Actualiza 50 columnas PUSH
- **Total: ~777ms**

## 🔒 Características

### Persistencia PUSH (Solo COM)
- Si borras un dato en columna PUSH → **Se restaura instantáneamente**
- El usuario no nota la restauración (<10ms)

### Auto-Limpieza
- Si borras el NAME → **Se limpian todas las columnas PUSH** de esa fila

### Detección Automática
- **Azul (#4472C4)** = PUSH (sistema escribe)
- **Blanco (#FFFFFF)** = PULL (usuario escribe)

## 📊 Datos Obtenidos

Cuando escribes un nombre de blockchain, el sistema obtiene automáticamente:

**Datos Básicos**:
- Chain ID
- Token Nativo
- Símbolo

**Datos Financieros** (DefiLlama):
- TVL (Total Value Locked)
- IDs de CoinGecko/CMC

**Endpoints RPC** (Publicnodes):
- 3 URLs RPC HTTP
- 2 URLs WebSocket
- URL del explorador

**Datos de Llamanodes**:
- RPC de Llamanodes
- WebSocket
- Documentación

**Total**: **50 campos** actualizados automáticamente

## 🐛 Troubleshooting

### "No se encuentra el archivo Excel"
**Solución**: 
1. Coloca `ARBITRAGEXPLUS2025.xlsx` en la carpeta `data/`
2. O selecciónalo manualmente cuando se abra el diálogo

### "dotnet no se reconoce como comando" (Windows COM)
**Solución**: Instala .NET 8.0 SDK desde https://dotnet.microsoft.com/download

### "Python no está instalado" (Python Collector)
**Solución**: Instala Python 3.11+ desde https://www.python.org/downloads/

### Las columnas no se actualizan
**Solución**:
1. Verifica que el sistema está ejecutándose
2. Asegúrate de escribir en la columna B (NAME)
3. Guarda el archivo (Ctrl+S) si usas Python
4. Revisa los logs

## 📚 Documentación Detallada

- **Excel COM Bridge**: `excel-com-bridge/README.md`
- **Python Collector**: `python-collector/README.md`

## 🎓 Arquitectura

### Excel COM Bridge (C#)

```
Excel (COM Events)
    ↓ Worksheet_Change (<10ms)
ExcelComManager
    ↓
SnapshotManager
    ↓
BlockchainsWatcher
    ↓
Python Collector API
```

### Python Collector

```
Excel File (openpyxl)
    ↓ Polling (1s)
ExcelClientV2
    ↓
SnapshotManager
    ↓
BlockchainsWatcherV2
    ↓
BlockchainDataAggregator
    ↓
DefiLlama + Publicnodes + Llamanodes
```

## 📝 Próximos Pasos

1. **Extender a otras hojas**: DEXES, ASSETS, POOLS
2. **Optimizaciones**: Caché, batch updates
3. **Monitoreo**: Dashboard, métricas
4. **Producción**: Servicio Windows, logs estructurados

## 🆘 Soporte

Si tienes problemas:
1. Revisa la sección **Troubleshooting**
2. Consulta los logs:
   - COM: `excel-com-bridge/logs/`
   - Python: Consola
3. Revisa la documentación específica en cada carpeta
4. Abre un issue en GitHub

## 📄 Licencia

Parte de ARBITRAGEXPLUS2025

