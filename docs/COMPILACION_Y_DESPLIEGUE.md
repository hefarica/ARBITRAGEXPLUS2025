# Guía de Compilación y Despliegue - ARBITRAGEXPLUS2025

## Requisitos Previos

### Software Necesario
- **Windows 10 o superior**
- **.NET 8 SDK** - [Descargar](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Node.js 18+** - [Descargar](https://nodejs.org/)
- **Python 3.11+** - [Descargar](https://www.python.org/downloads/)
- **Microsoft Excel 2016 o superior**

## Compilación Manual

### 1. Compilar el Instalador Maestro

```bash
cd installer
dotnet publish -c Release -r win-x64 --self-contained
```

El ejecutable se generará en: `installer/bin/Release/net8.0/win-x64/publish/MASTER_RUNNER.exe`

### 2. Compilar el Puente COM

```bash
cd automation/excel-com-bridge
dotnet build -c Release
```

El ejecutable se generará en: `automation/excel-com-bridge/bin/Release/net8.0-windows/ExcelComBridge.exe`

### 3. Instalar Dependencias de Node.js

```bash
cd automation/api-server
npm install
```

### 4. Instalar Dependencias de Python

```bash
cd automation/oracles
pip install -r requirements.txt
```

## Ejecución Automática (Recomendado)

### Primera Ejecución

1. **Ejecutar el instalador maestro:**
   ```bash
   RUN.bat
   ```
   o directamente:
   ```bash
   cd installer
   dotnet run
   ```

2. El instalador maestro realizará automáticamente:
   - Verificación de dependencias (.NET, Node.js, Python)
   - Instalación de paquetes de Python
   - Instalación de paquetes de Node.js
   - Compilación del puente COM
   - Creación de archivos de configuración
   - Inicio de todos los servicios

3. **Esperar a que todos los servicios inicien:**
   - API Server (puerto 8009)
   - Oráculo de Binance
   - Puente COM de Excel

4. **Abrir Excel:**
   - El instalador abrirá automáticamente `ARBITRAGEXPLUS2025.xlsm`
   - Si no se abre automáticamente, ábrelo manualmente

### Ejecuciones Posteriores

Simplemente ejecuta `RUN.bat` o `cd installer && dotnet run`. El sistema detectará que las dependencias ya están instaladas y solo iniciará los servicios.

## Configuración

### Archivo `.env` (API Server)

Ubicación: `automation/api-server/.env`

```env
API_PORT=8009
API_HOST=0.0.0.0
API_SECRET_KEY=tu-super-secreto-unico-y-muy-largo-12345!@#$%
NODE_ENV=development
```

### Archivo `.env` (Oráculos)

Ubicación: `automation/oracles/.env`

```env
API_URL=http://localhost:8009/api/v1/prices
API_SECRET_KEY=tu-super-secreto-unico-y-muy-largo-12345!@#$%
```

## Pruebas

### Prueba de la Hoja BLOCKCHAINS

1. Ejecutar el sistema completo
2. En Excel, ir a la hoja `BLOCKCHAINS`
3. En una celda de la columna `NAME` (encabezado blanco), escribir: `ethereum`
4. Esperar 2-5 segundos
5. Verificar que las columnas azules (PUSH) se rellenen con datos de Ethereum

### Pruebas Adicionales

- Probar con `polygon`
- Probar con `avalanche`
- Probar con `bsc`
- Borrar el nombre y verificar que las columnas azules se limpien

## Solución de Problemas

### El puente COM no se conecta

1. Verificar que `ExcelComBridge.exe` esté en ejecución
2. En VBA, ejecutar `AutomationController.StartAutomationEngine()`
3. Verificar que no haya errores en la consola del instalador

### La API no recibe datos

1. Verificar que el puerto 8009 no esté en uso
2. Verificar que el oráculo esté enviando datos (revisar logs)
3. Verificar que la API_SECRET_KEY coincida en todos los archivos `.env`

### Excel no se actualiza

1. Verificar que las columnas tengan los colores correctos:
   - Blanco para columnas PULL (donde el usuario escribe)
   - Azul (#4472C4) para columnas PUSH (donde el sistema escribe)
2. Verificar que `Application.EnableEvents = True` en VBA
3. Revisar la consola del puente COM para ver si hay errores

## Detener el Sistema

Presionar `Ctrl+C` en la consola del instalador maestro. Esto detendrá todos los servicios de forma limpia.

## Arquitectura del Sistema

```
Usuario escribe "polygon" en Excel (columna NAME)
    ↓
VBA detecta el cambio (Workbook_SheetChange)
    ↓
VBA llama a ExternalComBridge.OnCellChanged(row, "NAME", "polygon")
    ↓
Puente COM encola la solicitud
    ↓
Worker procesa la solicitud:
    ├─→ DefiLlamaCollector.GetDataAsync("polygon")   [Paralelo]
    ├─→ LlamanodesCollector.GetDataAsync("polygon")  [Paralelo]
    └─→ PublicnodesCollector.GetDataAsync("polygon") [Paralelo]
    ↓
BlockchainDataMerger fusiona los datos
    ↓
Puente COM escribe en las celdas PUSH (azules) de Excel
    ↓
Usuario ve los datos actualizados
```

## Notas Importantes

- El sistema es **idempotente**: puede ejecutarse múltiples veces sin problemas
- Los datos se obtienen de **múltiples fuentes** para validación cruzada
- El sistema es **reactivo**: responde a cambios del usuario en tiempo real
- La comunicación Excel ↔ COM es de **baja latencia** (<10ms)

