# 🪟 Instrucciones para Windows - Google Sheet Brain

## 📋 Requisitos Previos

1. ✅ **Node.js instalado** - Descargar desde https://nodejs.org/
2. ✅ **Git instalado** (opcional) - Para clonar el repositorio
3. ✅ **Proyecto de Google Cloud creado** - Ya lo tienes: `ARBITRAGEX` (ID: `arbitragex-475408`)
4. ✅ **Service Account creado** - Sigue las instrucciones abajo

---

## 🚀 Guía Rápida de Ejecución

### Opción 1: PowerShell (Recomendado)

1. **Abre PowerShell** (clic derecho en el botón de Windows → Windows PowerShell)

2. **Navega al directorio del proyecto:**
   ```powershell
   cd C:\ruta\a\tu\ARBITRAGEXPLUS2025
   ```

3. **Ejecuta el script:**
   ```powershell
   .\init-google-sheet-brain.ps1
   ```

   Si te sale un error de permisos, ejecuta primero:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Opción 2: Command Prompt (CMD)

1. **Abre Command Prompt** (cmd)

2. **Navega al directorio del proyecto:**
   ```cmd
   cd C:\ruta\a\tu\ARBITRAGEXPLUS2025
   ```

3. **Ejecuta el script:**
   ```cmd
   init-google-sheet-brain.bat
   ```

### Opción 3: Doble Clic

1. **Abre el Explorador de Windows**
2. **Navega a la carpeta del proyecto**
3. **Doble clic en:**
   - `init-google-sheet-brain.bat` (más compatible)
   - O `init-google-sheet-brain.ps1` (si PowerShell está configurado)

---

## 🔐 Configuración del Service Account (PASO CRÍTICO)

### Paso 1: Crear Service Account en Google Cloud

1. **Abre Google Cloud Console:**
   - URL: https://console.cloud.google.com/
   - Proyecto: `ARBITRAGEX` (ID: `arbitragex-475408`)

2. **Ve a IAM y administración:**
   - Menú lateral → **IAM y administración** → **Cuentas de servicio**

3. **Crea una nueva cuenta:**
   - Clic en **"+ CREAR CUENTA DE SERVICIO"**
   - **Nombre:** `arbitragexplus-sheets`
   - **ID:** Se genera automáticamente
   - **Descripción:** `Service Account para Google Sheets Brain`
   - Clic en **"Crear y continuar"**

4. **Asigna el rol:**
   - Selecciona **"Editor"** o **"Propietario"**
   - Clic en **"Continuar"**
   - Clic en **"Listo"**

### Paso 2: Descargar Credenciales JSON

1. **En la lista de Service Accounts:**
   - Busca `arbitragexplus-sheets@arbitragex-475408.iam.gserviceaccount.com`
   - Clic en los **tres puntos** (⋮) al lado derecho
   - Selecciona **"Administrar claves"**

2. **Crear nueva clave:**
   - Clic en **"Agregar clave"** → **"Crear clave nueva"**
   - Selecciona **JSON**
   - Clic en **"Crear"**
   - Se descargará automáticamente un archivo `.json`

3. **Guardar el archivo:**
   - Crea la carpeta `keys` en el directorio del proyecto si no existe:
     ```
     C:\ruta\a\tu\ARBITRAGEXPLUS2025\keys\
     ```
   - Mueve el archivo descargado a esa carpeta
   - Renómbralo a: `gsheets-sa.json`
   - Ruta final: `C:\ruta\a\tu\ARBITRAGEXPLUS2025\keys\gsheets-sa.json`

### Paso 3: Habilitar Google Sheets API

1. **En Google Cloud Console:**
   - Menú lateral → **APIs y servicios** → **Biblioteca**

2. **Buscar y habilitar:**
   - Busca: **"Google Sheets API"**
   - Clic en el resultado
   - Clic en **"Habilitar"**

### Paso 4: Compartir el Spreadsheet

1. **Copia el email del Service Account:**
   - Ejemplo: `arbitragexplus-sheets@arbitragex-475408.iam.gserviceaccount.com`

2. **Abre el Google Sheet:**
   - URL: https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit

3. **Compartir:**
   - Clic en **"Compartir"** (botón arriba a la derecha)
   - Pega el email del Service Account
   - Permiso: **"Editor"**
   - **Desmarca** "Notificar a las personas"
   - Clic en **"Enviar"**

---

## ✅ Verificación Rápida

Antes de ejecutar el script, verifica:

- [ ] ✅ Node.js instalado (`node --version` en cmd/PowerShell)
- [ ] ✅ Archivo `keys\gsheets-sa.json` existe
- [ ] ✅ Google Sheets API habilitada
- [ ] ✅ Spreadsheet compartido con Service Account
- [ ] ✅ Permisos de Editor otorgados

---

## 🎯 Ejecución del Script

### Lo que hace el script automáticamente:

1. ✅ Verifica que Node.js esté instalado
2. ✅ Verifica que el archivo de credenciales exista
3. ✅ Instala dependencias necesarias (googleapis)
4. ✅ Configura variables de entorno
5. ✅ Se conecta a Google Sheets API
6. ✅ Crea las 13 hojas maestras
7. ✅ Configura 1016+ campos (columnas)
8. ✅ Aplica formato y colores
9. ✅ Muestra resumen de operación

### Salida esperada:

```
============================================================================
  ARBITRAGEXPLUS2025 - Google Sheet Brain Initialization
============================================================================

📁 Directorio del script: C:\...\ARBITRAGEXPLUS2025
✅ Cambiado al directorio del proyecto
✅ Archivo de credenciales encontrado
✅ Script de inicialización encontrado
✅ Node.js instalado: v18.x.x
✅ Dependencias instaladas correctamente

🔐 Variables de entorno configuradas:
   GOOGLE_APPLICATION_CREDENTIALS = .\keys\gsheets-sa.json
   SPREADSHEET_ID = 1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ

============================================================================
  Información del Google Sheet
============================================================================

📊 Spreadsheet ID: 1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
🔗 URL: https://docs.google.com/spreadsheets/d/...

📋 Se crearán 13 hojas maestras con 1016+ campos:
   1. BLOCKCHAINS    (50 campos)  - Redes blockchain
   2. DEXES          (200 campos) - Exchanges descentralizados
   3. ASSETS         (400 campos) - Tokens y precios
   4. POOLS          (100 campos) - Pools de liquidez
   5. ROUTES         (200 campos) - Rutas de arbitraje
   6. EXECUTIONS     (50 campos)  - Operaciones ejecutadas
   7. CONFIG         (7 campos)   - Configuración global
   8. ALERTS         (9 campos)   - Sistema de alertas

============================================================================

⚠️  IMPORTANTE: Asegúrate de haber compartido el spreadsheet con el Service Account

¿Deseas continuar con la inicialización? (S/N): S

============================================================================
  Ejecutando script de inicialización...
============================================================================

🚀 Iniciando configuración del Google Sheet Brain...
📁 Verificando credenciales...
✅ Credenciales cargadas correctamente
🔐 Autenticando con Google Sheets API...
✅ Autenticación exitosa
📊 Verificando acceso al spreadsheet: 1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ...
✅ Spreadsheet encontrado: "ARBITRAGEXPLUS2025"
📋 Creando 13 hojas maestras...
   Configurando hoja: BLOCKCHAINS
   - Campos: 50
   - Color: #E3F2FD
   - Origen: MANUAL_FIELD
   ...
⚙️  Ejecutando batch update...
✅ Hojas creadas exitosamente
📝 Agregando headers a cada hoja...
   Escribiendo headers en: BLOCKCHAINS
   ✅ 50 columnas escritas
   ...
🎨 Formateando headers...
✅ Headers formateados correctamente

═══════════════════════════════════════════════════════════
🎉 GOOGLE SHEET BRAIN INICIALIZADO EXITOSAMENTE
═══════════════════════════════════════════════════════════

📊 Spreadsheet ID: 1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ
🔗 URL: https://docs.google.com/spreadsheets/d/...

📋 Hojas creadas: 8
📊 Total de campos: 1016

📋 Resumen de hojas:
   ✅ BLOCKCHAINS    -  50 campos - MANUAL_FIELD
   ✅ DEXES          - 200 campos - AUTO_FIELD
   ✅ ASSETS         - 400 campos - AUTO_FIELD
   ✅ POOLS          - 100 campos - AUTO_FIELD
   ✅ ROUTES         - 200 campos - CALCULATED_FIELD
   ✅ EXECUTIONS     -  50 campos - CALCULATED_FIELD
   ✅ CONFIG         -   7 campos - MANUAL_FIELD
   ✅ ALERTS         -   9 campos - SYSTEM_FIELD

═══════════════════════════════════════════════════════════

🚀 El sistema está listo para comenzar operaciones de arbitraje
📝 Próximo paso: Configurar datos iniciales en cada hoja

============================================================================
  ✅ GOOGLE SHEET BRAIN INICIALIZADO EXITOSAMENTE
============================================================================

🎉 Las 13 hojas maestras han sido creadas con éxito!

📊 Puedes ver el spreadsheet aquí:
   https://docs.google.com/spreadsheets/d/...

📝 Próximos pasos:
   1. Abre el spreadsheet en tu navegador
   2. Verifica que las 13 hojas estén creadas
   3. Configura datos iniciales en BLOCKCHAINS y CONFIG
   4. Inicia los servicios del sistema

Presiona Enter para salir
```

---

## 🚨 Troubleshooting

### Error: "No se encontró el archivo de credenciales"

**Solución:**
1. Verifica que la carpeta `keys` exista
2. Verifica que el archivo se llame exactamente `gsheets-sa.json`
3. Verifica la ruta completa: `C:\...\ARBITRAGEXPLUS2025\keys\gsheets-sa.json`

### Error: "Permission denied" o "403 Forbidden"

**Solución:**
1. Verifica que hayas compartido el spreadsheet con el Service Account
2. Verifica que el permiso sea "Editor"
3. Copia el email correcto del Service Account

### Error: "API not enabled"

**Solución:**
1. Ve a Google Cloud Console
2. APIs y servicios → Biblioteca
3. Busca "Google Sheets API"
4. Clic en "Habilitar"

### Error: "Node.js no está instalado"

**Solución:**
1. Descarga Node.js desde https://nodejs.org/
2. Instala la versión LTS (recomendada)
3. Reinicia PowerShell/CMD
4. Verifica con: `node --version`

### Error: "Spreadsheet not found"

**Solución:**
1. Verifica que el SPREADSHEET_ID sea correcto
2. Verifica que tengas acceso al spreadsheet
3. Abre el link en tu navegador para confirmar

---

## 📝 Configuración Post-Inicialización

Una vez que el script termine exitosamente:

### 1. Verifica las Hojas Creadas

Abre el spreadsheet y verifica que existan:
- ✅ BLOCKCHAINS (azul)
- ✅ DEXES (verde)
- ✅ ASSETS (verde)
- ✅ POOLS (verde)
- ✅ ROUTES (naranja)
- ✅ EXECUTIONS (naranja)
- ✅ CONFIG (azul)
- ✅ ALERTS (rojo)

### 2. Configura Datos Iniciales

**Hoja BLOCKCHAINS:**
```
CHAIN_ID | CHAIN_NAME | RPC_URL_PRIMARY | IS_ACTIVE
1        | Ethereum   | https://eth-mainnet.public.blastapi.io | TRUE
56       | BSC        | https://bsc-dataseed.binance.org | TRUE
137      | Polygon    | https://polygon-rpc.com | TRUE
```

**Hoja CONFIG:**
```
KEY | VALUE | DESCRIPTION | TYPE | IS_ACTIVE
MIN_PROFIT_USD | 10 | Profit mínimo para ejecutar | number | TRUE
MAX_SLIPPAGE | 0.01 | Slippage máximo (1%) | number | TRUE
MIN_CONFIDENCE | 0.7 | Confianza mínima oráculos | number | TRUE
```

### 3. Inicia los Servicios

Las hojas automáticas se llenarán cuando inicies los servicios:
- **Python Collector** → Llena DEXES, ASSETS, POOLS
- **Rust Engine** → Calcula ROUTES
- **TS Executor** → Registra EXECUTIONS

---

## 🎉 ¡Listo!

El Google Sheet Brain está configurado y listo para operar. El sistema ahora tiene:

- ✅ 13 hojas maestras
- ✅ 1016+ campos dinámicos
- ✅ CERO hardcoding
- ✅ Arquitectura de programación dinámica
- ✅ Configuración centralizada

**El cerebro del sistema está operativo. ¡Hora de hacer arbitraje!** 🚀

