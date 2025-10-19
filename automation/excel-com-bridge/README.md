# Excel COM Bridge

Sistema de automatización bidireccional Excel usando **COM Automation** para latencia ultra-baja (<10ms).

## 🎯 Características

### Latencia Ultra-Baja
- **<10ms** para detectar cambios en celdas
- **Eventos en tiempo real** usando Excel COM
- **Sin polling** - Eventos nativos de Excel

### Persistencia Automática
- Si borras un dato en columna PUSH → **Se restaura automáticamente**
- Parece que "no puedes borrar" las columnas PUSH

### Auto-Limpieza
- Si borras el NAME → **Se limpian todas las columnas PUSH** de esa fila

## 🏗️ Arquitectura

```
Excel (COM) ←→ ExcelComManager ←→ SnapshotManager
                      ↓
              BlockchainsWatcher
                      ↓
              Python Collector (API)
```

### Componentes

1. **ExcelComManager** - Gestión de COM Automation
   - Conexión con Excel
   - Captura de eventos `Worksheet_Change`
   - Lectura/escritura de celdas
   - Detección de colores PUSH/PULL

2. **SnapshotManager** - Snapshots incrementales
   - Captura estado de hojas
   - Detección de cambios en <10ms
   - Versionado automático

3. **BlockchainsWatcher** - Lógica de negocio
   - Detecta cambios en columna NAME (PULL)
   - Consulta Python collector
   - Actualiza columnas PUSH
   - Restaura datos borrados
   - Limpia filas cuando se borra NAME

## 📋 Requisitos

- **Windows** (COM Automation solo funciona en Windows)
- **.NET 8.0** o superior
- **Microsoft Excel** instalado
- **Visual Studio 2022** (opcional, para desarrollo)

## 🚀 Instalación

### Opción 1: Ejecutable Pre-compilado

1. Descarga `ExcelComBridge.exe` de releases
2. Coloca el archivo Excel en `data/ARBITRAGEXPLUS2025.xlsx`
3. Ejecuta `ExcelComBridge.exe`

### Opción 2: Compilar desde Código

```bash
# Clonar repositorio
git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git
cd ARBITRAGEXPLUS2025/services/excel-com-bridge

# Compilar
dotnet build -c Release

# Ejecutar
dotnet run
```

### Opción 3: Publicar Ejecutable

```bash
# Publicar como ejecutable único
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true

# El ejecutable estará en:
# bin/Release/net8.0-windows/win-x64/publish/ExcelComBridge.exe
```

## 🎮 Uso

### Iniciar el Bridge

```bash
# Opción 1: Ruta automática (busca en data/)
ExcelComBridge.exe

# Opción 2: Especificar ruta
ExcelComBridge.exe "C:\ruta\a\ARBITRAGEXPLUS2025.xlsx"

# Opción 3: Variable de entorno
set EXCEL_FILE_PATH=C:\ruta\a\ARBITRAGEXPLUS2025.xlsx
ExcelComBridge.exe
```

### Usar en Excel

1. **Abre Excel** (si no está abierto, el bridge lo abrirá)
2. **Ve a la hoja BLOCKCHAINS**
3. **Escribe un nombre de blockchain** en columna B (NAME):
   - `polygon`
   - `ethereum`
   - `bsc`
   - `arbitrum`
   - etc.
4. **Las columnas PUSH se actualizan automáticamente** (<100ms)

### Probar Persistencia

1. **Borra un dato** en una columna PUSH (ej: CHAIN_ID)
2. **Se restaura automáticamente** en <10ms
3. Parece que "no puedes borrar" las columnas PUSH

### Probar Auto-Limpieza

1. **Borra el NAME** de una fila (ej: borra "polygon")
2. **Todas las columnas PUSH se limpian** automáticamente

## 📊 Logs

Los logs se guardan en:
```
logs/excel-com-bridge-YYYYMMDD.txt
```

Ejemplo de logs:
```
[INFO] ExcelComManager conectado exitosamente
[INFO] ⚡ Latencia de eventos: <10ms
[INFO] ✅ BlockchainsWatcher listo
[INFO] 🔒 Persistencia PUSH activada
[INFO] 🧹 Auto-limpieza activada
[DEBUG] 📝 Cambio detectado: BLOCKCHAINS!5,2 = 'polygon'
[INFO] 🔍 Consultando datos para: polygon (fila 5)
[INFO] ✅ Datos obtenidos, actualizando 50 columnas PUSH...
[INFO] ✅ Columnas PUSH actualizadas para fila 5
```

## 🔧 Configuración

### Detección de Colores

El sistema detecta automáticamente columnas PUSH/PULL por color:

- **Azul (#4472C4)** = PUSH (sistema escribe)
- **Blanco (#FFFFFF)** = PULL (usuario escribe)

### Polling Interval

No hay polling. El sistema usa **eventos nativos de Excel** que se disparan instantáneamente.

## 🐛 Troubleshooting

### Error: "Excel no está instalado"
**Solución**: Instala Microsoft Excel

### Error: "No se puede conectar a Excel"
**Solución**: 
1. Cierra todas las instancias de Excel
2. Ejecuta el bridge como administrador
3. Verifica que Excel no esté bloqueado por antivirus

### Error: "Archivo Excel no encontrado"
**Solución**: 
1. Verifica que el archivo existe en `data/ARBITRAGEXPLUS2025.xlsx`
2. O especifica la ruta completa como argumento

### Las columnas no se actualizan
**Solución**:
1. Verifica que el bridge está ejecutándose
2. Verifica que estás en la hoja BLOCKCHAINS
3. Verifica que escribiste en la columna B (NAME)
4. Revisa los logs en `logs/`

## 🎓 Desarrollo

### Estructura del Proyecto

```
excel-com-bridge/
├── src/
│   ├── ExcelComManager.cs      # Gestión de COM
│   ├── SnapshotManager.cs      # Snapshots incrementales
│   ├── BlockchainsWatcher.cs   # Lógica de negocio
│   └── Program.cs              # Punto de entrada
├── ExcelComBridge.csproj       # Configuración del proyecto
└── README.md                   # Este archivo
```

### Agregar Nuevos Watchers

```csharp
// Crear nuevo watcher para hoja DEXES
public class DexesWatcher
{
    private readonly ExcelComManager _excelManager;
    private readonly SnapshotManager _snapshotManager;
    
    public DexesWatcher(ExcelComManager excelManager, SnapshotManager snapshotManager)
    {
        _excelManager = excelManager;
        _snapshotManager = snapshotManager;
        
        // Suscribirse a eventos
        _excelManager.CellChanged += OnCellChanged;
    }
    
    private void OnCellChanged(object? sender, WorksheetChangeEventArgs e)
    {
        if (e.SheetName != "DEXES") return;
        
        // Tu lógica aquí
    }
}
```

### Compilar en Release

```bash
dotnet build -c Release
```

### Ejecutar Tests

```bash
dotnet test
```

## 📚 Referencias

- [Excel COM Automation](https://docs.microsoft.com/en-us/office/vba/api/overview/excel)
- [.NET COM Interop](https://docs.microsoft.com/en-us/dotnet/standard/native-interop/cominterop)
- [Worksheet Events](https://docs.microsoft.com/en-us/office/vba/api/excel.worksheet.change)

## 📝 Licencia

Parte de ARBITRAGEXPLUS2025

## 🆘 Soporte

Si tienes problemas:
1. Revisa la sección **Troubleshooting**
2. Consulta los logs en `logs/`
3. Abre un issue en GitHub

