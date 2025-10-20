# ARBITRAGEXPLUS2025

Sistema de arbitraje automatizado con arquitectura reactiva basada en eventos, donde Excel es la interfaz principal con columnas PUSH (azules) y PULL (blancas).

## 🚀 Inicio Rápido

### Opción 1: Instalación Automática (Recomendado)

1. **Descarga** el repositorio
2. **Haz clic derecho** en `SETUP_AND_RUN.bat`
3. **Selecciona** "Ejecutar como administrador"
4. **Espera** a que el sistema instale todas las dependencias y se inicie

El script `SETUP_AND_RUN.bat` es **idempotente**, lo que significa que:
- ✅ Puede ejecutarse múltiples veces sin problemas
- ✅ Detecta automáticamente qué dependencias faltan
- ✅ Instala solo lo necesario
- ✅ Actualiza versiones incorrectas automáticamente

### Opción 2: Instalación Manual

Si prefieres instalar las dependencias manualmente:

1. **Instalar Chocolatey** (gestor de paquetes para Windows):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Instalar Node.js v22.20.0**:
   ```cmd
   choco install nodejs --version=22.20.0 -y
   ```

3. **Instalar Python 3.11**:
   ```cmd
   choco install python --version=3.11.0 -y
   ```

4. **Instalar .NET SDK**:
   ```cmd
   choco install dotnet-sdk -y
   ```

5. **Ejecutar el sistema**:
   ```cmd
   cd installer
   dotnet run
   ```

## 📋 Requisitos del Sistema

- **Sistema Operativo**: Windows 10 o superior
- **Privilegios**: Administrador (requerido para instalación de dependencias)
- **Espacio en Disco**: ~2 GB (para todas las dependencias)
- **RAM**: 4 GB mínimo, 8 GB recomendado
- **Excel**: Microsoft Excel 2016 o superior (con soporte VBA)

## 🏗️ Arquitectura del Sistema

El sistema está compuesto por los siguientes componentes:

### 1. **MASTER_RUNNER** (Instalador Maestro)
- Orquesta todo el ciclo de vida del sistema
- Compila automáticamente todos los componentes
- Inicia y gestiona todos los servicios
- Ubicación: `installer/`

### 2. **Excel COM Bridge** (Puente COM)
- Conecta Excel con las fuentes de datos externas
- Escucha cambios en columnas PULL
- Escribe datos en columnas PUSH
- Compilado para x86 (.NET Framework 4.8)
- Ubicación: `automation/excel-com-bridge/`

### 3. **API Server** (Servidor REST)
- Servidor Node.js/TypeScript en puerto 8009
- Soporte para Server-Sent Events (SSE)
- Autenticación con API Key
- Ubicación: `automation/api-server/`

### 4. **Oráculos de Precios**
- Conectan con exchanges (Binance, etc.)
- Envían datos en tiempo real a la API
- Implementados en Python
- Ubicación: `automation/oracles/`

### 5. **Código VBA**
- Detecta cambios en celdas de Excel
- Activa el sistema automáticamente
- Genérico y configurable por colores
- Ubicación: `vba-code/`

## 📂 Estructura del Proyecto

```
ARBITRAGEXPLUS2025/
├── 📄 SETUP_AND_RUN.bat          # Instalador y ejecutor maestro (USAR ESTE)
├── 📄 RUN.bat                    # Ejecutor simple (sin instalación de dependencias)
├── 📄 README_ES.md               # Este archivo
│
├── 📁 installer/                 # MASTER_RUNNER
│   ├── 📄 Program.cs
│   ├── 📄 ComponentsChecker.cs
│   ├── 📄 FileManager.cs
│   ├── 📄 ServiceManager.cs
│   └── 📄 BlockchainDataMerger.cs
│
├── 📁 automation/
│   ├── 📁 excel-com-bridge/      # Puente COM (.NET Framework 4.8, x86)
│   │   ├── 📄 ExcelComBridge.csproj
│   │   ├── 📄 Program.cs
│   │   └── 📄 StreamListener.cs
│   │
│   ├── 📁 api-server/            # API REST (Node.js/TypeScript)
│   │   ├── 📄 package.json
│   │   ├── 📄 tsconfig.json
│   │   └── 📁 src/
│   │       ├── 📄 index.ts
│   │       └── 📁 routes/
│   │           └── 📄 prices.ts
│   │
│   └── 📁 oracles/               # Oráculos de precios (Python)
│       ├── 📄 requirements.txt
│       └── 📄 BinanceOracleV2.py
│
├── 📁 vba-code/                  # Código VBA para Excel
│   ├── 📄 AutomationController.bas
│   └── 📄 ThisWorkbook.cls
│
└── 📁 docs/                      # Documentación
    ├── 📄 ARQUITECTURA_SISTEMA_COMPLETO.md
    └── 📄 COMPILACION_Y_DESPLIEGUE.md
```

## 🔧 Configuración

### Variables de Entorno

El sistema utiliza archivos `.env` para la configuración. Estos se generan automáticamente en la primera ejecución, pero puedes personalizarlos:

**API Server** (`automation/api-server/.env`):
```env
PORT=8009
API_KEY=tu_clave_secreta_aqui
NODE_ENV=development
```

**Oráculos** (`automation/oracles/.env`):
```env
BINANCE_API_KEY=tu_api_key_de_binance
BINANCE_SECRET_KEY=tu_secret_key_de_binance
API_SERVER_URL=http://localhost:8009
```

### Excel

1. Abre el archivo `ARBITRAGEXPLUS2025.xlsm`
2. Habilita macros cuando se te solicite
3. El sistema detectará automáticamente:
   - **Columnas PUSH** (fondo azul): Datos escritos por el sistema
   - **Columnas PULL** (fondo blanco): Datos ingresados por el usuario

## 🧪 Prueba del Sistema

1. **Ejecuta** `SETUP_AND_RUN.bat` como administrador
2. **Espera** a que todos los servicios se inicien
3. **Abre** el archivo Excel `ARBITRAGEXPLUS2025.xlsm`
4. **Ve a la hoja** `BLOCKCHAINS`
5. **Escribe** "polygon" o "ethereum" en la columna `NAME`
6. **Observa** cómo las columnas PUSH se llenan automáticamente con datos

## 🐛 Solución de Problemas

### Error: "Se requieren privilegios de Administrador"
- **Solución**: Haz clic derecho en `SETUP_AND_RUN.bat` y selecciona "Ejecutar como administrador"

### Error: "Chocolatey no está disponible"
- **Solución**: Reinicia la terminal o ejecuta `refreshenv.cmd`

### Error: "Node.js versión incorrecta"
- **Solución**: El script automáticamente desinstalará la versión incorrecta e instalará la correcta

### Error: "Excel COM Bridge no encontrado"
- **Solución**: El sistema compilará automáticamente el puente COM en la primera ejecución

### Error: "Archivo Excel no encontrado"
- **Solución**: Asegúrate de que `ARBITRAGEXPLUS2025.xlsm` esté en la raíz del proyecto o en una de las ubicaciones buscadas

## 📚 Documentación Adicional

- [Arquitectura del Sistema](docs/ARQUITECTURA_SISTEMA_COMPLETO.md)
- [Compilación y Despliegue](docs/COMPILACION_Y_DESPLIEGUE.md)

## 🤝 Contribuciones

Este es un proyecto privado. Para contribuciones o preguntas, contacta al equipo de desarrollo.

## 📄 Licencia

Propietario - Todos los derechos reservados

---

**Desarrollado con ❤️ para trading de arbitraje de alta frecuencia**

