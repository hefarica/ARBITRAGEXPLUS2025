# 🔷 Script PowerShell de Validación Completa

## 📋 Descripción

`Validate-System-Complete.ps1` es un script PowerShell maestro que unifica las 4 validaciones del sistema y genera un reporte visual en formato árbol ASCII con colores indicando el estado de cada archivo.

## ✨ Características

### ✅ Validaciones Integradas

1. **Validación de Integridad de Archivos**
   - Verifica existencia de archivos críticos
   - Valida líneas mínimas requeridas
   - Verifica patrones requeridos (clases, funciones, imports)
   - Detecta contenido prohibido (TODO, FIXME)

2. **Validación de Flujo de Datos**
   - Google Sheets → Python Collector
   - Python Collector → API Server
   - WebSocket Manager → Flash Executor
   - Flash Executor → Router Contract

3. **Validación de Arrays Dinámicos (NO Hardcoding)**
   - Detecta arrays hardcodeados prohibidos
   - Valida uso de arrays dinámicos en Python, TypeScript, Rust, Solidity

4. **Validación de Configuración Externalizada**
   - Verifica archivos YAML/JSON
   - Valida uso de variables de entorno
   - Detecta valores sensibles hardcodeados

### 🎨 Reporte Visual

El script genera un reporte en formato árbol ASCII con:

- ✅ **Archivos en VERDE**: Todas las validaciones pasaron
- ❌ **Archivos en ROJO**: Errores críticos detectados
- ⚠️ **Advertencias en AMARILLO**: Problemas menores
- **Conectores VERDES**: Para archivos OK
- **Conectores NEGROS**: Para archivos con problemas o directorios

---

## 🚀 Uso

### Ejecución Básica

```powershell
# Navegar al directorio de scripts
cd scripts

# Ejecutar el script
.\Validate-System-Complete.ps1
```

### Ejecución con Parámetros

```powershell
# Especificar ruta de salida del reporte
.\Validate-System-Complete.ps1 -OutputPath "C:\Reports\validation-report.txt"

# Sin colores (para CI/CD)
.\Validate-System-Complete.ps1 -NoColor
```

### Ejecución desde Cualquier Ubicación

```powershell
# Ruta completa
C:\Path\To\ARBITRAGEXPLUS2025\scripts\Validate-System-Complete.ps1

# O agregar al PATH y ejecutar
Validate-System-Complete.ps1
```

---

## 📊 Ejemplo de Reporte Generado

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║         REPORTE DE VALIDACIÓN DEL SISTEMA - ARBITRAGEXPLUS2025           ║
║         Fecha: 2025-10-16 14:30:45                                        ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

📊 RESUMEN EJECUTIVO:
   Total de archivos:      11
   ✅ Archivos OK:          9
   ❌ Archivos con errores: 2
   ⚠️  Advertencias:        0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÁRBOL DE ARCHIVOS DEL SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARBITRAGEXPLUS2025/
├── [NEGRO] 📁 services/
│   ├── [NEGRO] 📁 python-collector/
│   │   └── [NEGRO] 📁 src/
│   │       └── [NEGRO] 📁 sheets/
│   │           └── ✅ [VERDE] client.py
│   │               Función: Cliente Google Sheets - Cerebro operativo del sistema
│   │               Líneas: 594
│   │
│   ├── [NEGRO] 📁 api-server/
│   │   └── [NEGRO] 📁 src/
│   │       └── [NEGRO] 📁 adapters/
│   │           └── [NEGRO] 📁 ws/
│   │               └── ❌ [ROJO] websocketManager.ts
│   │                   Función: Gestor WebSocket - Conexiones en tiempo real con DEXs
│   │                   Líneas: 648
│   │                   Errores:
│   │                     - Contiene TODO
│   │
│   ├── [NEGRO] 📁 ts-executor/
│   │   └── [NEGRO] 📁 src/
│   │       └── [NEGRO] 📁 exec/
│   │           └── ✅ [VERDE] flash.ts
│   │               Función: Ejecutor Flash Loans - Operaciones atómicas de arbitraje
│   │               Líneas: 672
│   │
│   └── [NEGRO] 📁 engine-rust/
│       └── [NEGRO] 📁 src/
│           └── [NEGRO] 📁 pathfinding/
│               ├── ✅ [VERDE] mod.rs
│               │   Función: Motor Rust - Algoritmos DP para pathfinding
│               │   Líneas: 318
│               │
│               ├── ✅ [VERDE] two_dex.rs
│               │   Función: Algoritmo DP 2-DEX - Rutas de arbitraje 2-hop
│               │   Líneas: 350
│               │
│               └── ✅ [VERDE] three_dex.rs
│                   Función: Algoritmo DP 3-DEX - Rutas de arbitraje 3-hop
│                   Líneas: 450
│
├── [NEGRO] 📁 contracts/
│   └── [NEGRO] 📁 src/
│       ├── ✅ [VERDE] Router.sol
│       │   Función: Router Contract - Ejecución multi-DEX on-chain
│       │   Líneas: 579
│       │
│       └── ✅ [VERDE] Vault.sol
│           Función: Vault Contract - Gestión de liquidez y flash loans
│           Líneas: 400
│
├── [NEGRO] 📁 apps-script/
│   └── ✅ [VERDE] gas-advanced-mapper.gs
│       Función: Google Apps Script - Sincronización bidireccional Sheets
│       Líneas: 250
│
└── [NEGRO] 📁 config/
    ├── ✅ [VERDE] chains.yaml
    │   Función: Configuración de blockchains - Datos dinámicos
    │   Líneas: 45
    │
    └── ✅ [VERDE] dexes.yaml
        Función: Configuración de DEXes - Datos dinámicos
        Líneas: 120

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEYENDA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ [VERDE]  - Archivo OK, todas las validaciones pasaron
❌ [ROJO]   - Archivo con errores críticos
⚠️  [AMARILLO] - Archivo con advertencias

Conectores:
  ├── [VERDE] - Conecta a archivo OK
  ├── [NEGRO] - Conecta a archivo con problemas o directorio
  └── [VERDE/NEGRO] - Último elemento del nivel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIN DEL REPORTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📁 Archivos Validados

El script valida los siguientes archivos críticos:

### **Servicios Python**
- `services/python-collector/src/sheets/client.py` (≥500 líneas)
  - Cliente Google Sheets - Cerebro operativo del sistema

### **Servicios TypeScript**
- `services/api-server/src/adapters/ws/websocketManager.ts` (≥600 líneas)
  - Gestor WebSocket - Conexiones en tiempo real con DEXs
- `services/ts-executor/src/exec/flash.ts` (≥600 líneas)
  - Ejecutor Flash Loans - Operaciones atómicas de arbitraje

### **Servicios Rust**
- `services/engine-rust/src/pathfinding/mod.rs` (≥300 líneas)
  - Motor Rust - Algoritmos DP para pathfinding
- `services/engine-rust/src/pathfinding/two_dex.rs` (≥200 líneas)
  - Algoritmo DP 2-DEX - Rutas de arbitraje 2-hop
- `services/engine-rust/src/pathfinding/three_dex.rs` (≥200 líneas)
  - Algoritmo DP 3-DEX - Rutas de arbitraje 3-hop

### **Contratos Solidity**
- `contracts/src/Router.sol` (≥500 líneas)
  - Router Contract - Ejecución multi-DEX on-chain
- `contracts/src/Vault.sol` (≥300 líneas)
  - Vault Contract - Gestión de liquidez y flash loans

### **Google Apps Script**
- `apps-script/gas-advanced-mapper.gs` (≥100 líneas)
  - Google Apps Script - Sincronización bidireccional Sheets

### **Configuración**
- `config/chains.yaml` (≥10 líneas)
  - Configuración de blockchains - Datos dinámicos
- `config/dexes.yaml` (≥10 líneas)
  - Configuración de DEXes - Datos dinámicos

---

## 🎯 Criterios de Validación

### ✅ Archivo PASA cuando:
1. Existe en el sistema de archivos
2. Tiene el número mínimo de líneas requeridas
3. Contiene todos los patrones requeridos
4. NO contiene TODO/FIXME (advertencia)
5. NO tiene hardcoding
6. Usa arrays dinámicos

### ❌ Archivo FALLA cuando:
1. No existe
2. Tiene menos líneas del mínimo requerido
3. Falta algún patrón crítico requerido
4. Tiene hardcoding prohibido
5. NO usa arrays dinámicos

### ⚠️ Archivo con ADVERTENCIA cuando:
1. Contiene TODO/FIXME
2. No es crítico pero tiene problemas menores

---

## 🔧 Requisitos

### PowerShell
- PowerShell 5.1 o superior
- PowerShell Core 7.x (recomendado para mejor soporte de colores)

### Permisos
- Permisos de lectura en el repositorio
- Permisos de escritura para generar el reporte

### Sistema Operativo
- ✅ Windows 10/11
- ✅ Windows Server 2016+
- ✅ Linux (con PowerShell Core)
- ✅ macOS (con PowerShell Core)

---

## 📝 Parámetros

### `-OutputPath`
**Tipo:** String  
**Requerido:** No  
**Default:** `validation-report-{timestamp}.txt`

Especifica la ruta completa donde se guardará el reporte.

**Ejemplo:**
```powershell
.\Validate-System-Complete.ps1 -OutputPath "C:\Reports\validation.txt"
```

### `-NoColor`
**Tipo:** Switch  
**Requerido:** No  
**Default:** False

Desactiva los colores ANSI en la salida de terminal (útil para CI/CD).

**Ejemplo:**
```powershell
.\Validate-System-Complete.ps1 -NoColor
```

---

## 🔄 Exit Codes

- **0** - Todas las validaciones pasaron exitosamente
- **1** - Se encontraron errores críticos

---

## 🛠️ Integración con CI/CD

### GitHub Actions

```yaml
name: Validación del Sistema

on: [push, pull_request]

jobs:
  validate:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Ejecutar Validación
        shell: pwsh
        run: |
          cd scripts
          .\Validate-System-Complete.ps1 -NoColor
      
      - name: Subir Reporte
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: scripts/validation-report-*.txt
```

### Azure DevOps

```yaml
steps:
- task: PowerShell@2
  displayName: 'Validar Sistema'
  inputs:
    filePath: 'scripts/Validate-System-Complete.ps1'
    arguments: '-NoColor'
    
- task: PublishBuildArtifacts@1
  condition: always()
  inputs:
    PathtoPublish: 'scripts/validation-report-*.txt'
    ArtifactName: 'validation-report'
```

---

## 📊 Interpretación de Resultados

### ✅ Resultado Exitoso
```
📊 ESTADÍSTICAS:
   Total de archivos:      11
   ✅ Archivos OK:          11
   ❌ Archivos con errores: 0
   ⚠️  Advertencias:        0

📈 COMPLETITUD: 100.0%

✅ TODAS LAS VALIDACIONES PASARON EXITOSAMENTE
```

### ❌ Resultado con Errores
```
📊 ESTADÍSTICAS:
   Total de archivos:      11
   ✅ Archivos OK:          9
   ❌ Archivos con errores: 2
   ⚠️  Advertencias:        0

📈 COMPLETITUD: 81.8%

❌ SE ENCONTRARON 2 ARCHIVOS CON ERRORES
   Por favor revisa el reporte: validation-report-20251016-143045.txt
```

---

## 🔍 Solución de Problemas

### Error: "No se puede ejecutar scripts en este sistema"

**Causa:** Política de ejecución de PowerShell restrictiva

**Solución:**
```powershell
# Cambiar política temporalmente (sesión actual)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# O ejecutar con bypass
powershell -ExecutionPolicy Bypass -File .\Validate-System-Complete.ps1
```

### Error: "Acceso denegado al crear reporte"

**Causa:** Sin permisos de escritura en la ubicación de salida

**Solución:**
```powershell
# Especificar ruta con permisos
.\Validate-System-Complete.ps1 -OutputPath "$env:TEMP\validation-report.txt"
```

### Los colores no se muestran correctamente

**Causa:** Terminal sin soporte ANSI

**Solución:**
```powershell
# Usar PowerShell Core 7.x
pwsh .\Validate-System-Complete.ps1

# O desactivar colores
.\Validate-System-Complete.ps1 -NoColor
```

---

## 📚 Referencias

- [Documentación de Validación](./VALIDATION_README.md)
- [Scripts de Validación Node.js](./validate-system-integrity.js)
- [Plan de Acción Bash](./validation-action-plan.sh)
- [Reporte Final de Implementación](../FINAL_IMPLEMENTATION_REPORT.md)

---

## 📞 Soporte

Para problemas o preguntas:
1. Revisa el reporte generado en detalle
2. Consulta la documentación de validación
3. Verifica los logs de ejecución
4. Abre un issue en el repositorio

---

**Última Actualización:** 2025-10-16  
**Versión:** 1.0  
**Autor:** MANUS AI  
**Repositorio:** https://github.com/hefarica/ARBITRAGEXPLUS2025

