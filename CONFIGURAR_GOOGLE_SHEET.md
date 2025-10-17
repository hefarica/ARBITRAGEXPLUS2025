# 🧠 Configuración del Google Sheet Brain - ARBITRAGEXPLUS2025

## 📊 Información del Spreadsheet

**SPREADSHEET_ID:** `1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ`

**URL:** https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit

---

## 🚀 Paso 1: Preparar Credenciales de Google Cloud

### 1.1 Crear Service Account

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona o crea un proyecto
3. Ve a **IAM & Admin** → **Service Accounts**
4. Clic en **Create Service Account**
5. Nombre: `arbitragexplus-sheets`
6. Role: **Editor**
7. Clic en **Create Key** → **JSON**
8. Guarda el archivo como `keys/gsheets-sa.json`

### 1.2 Habilitar Google Sheets API

1. Ve a **APIs & Services** → **Library**
2. Busca "Google Sheets API"
3. Clic en **Enable**

### 1.3 Compartir el Spreadsheet

1. Abre el spreadsheet: https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit
2. Clic en **Share**
3. Agrega el email del Service Account (está en el archivo JSON)
4. Permiso: **Editor**
5. Clic en **Send**

---

## ⚙️ Paso 2: Ejecutar Script de Inicialización

```bash
# Asegúrate de estar en el directorio del proyecto
cd /home/ubuntu/ARBITRAGEXPLUS2025

# Configura la variable de entorno
export GOOGLE_APPLICATION_CREDENTIALS=./keys/gsheets-sa.json
export SPREADSHEET_ID=1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ

# Ejecuta el script de inicialización
node scripts/init-google-sheet-brain.js
```

---

## 📋 Paso 3: Verificar Hojas Creadas

El script creará las siguientes 13 hojas maestras con 1016+ campos:

| # | Hoja | Campos | Color | Origen | Función |
|---|------|--------|-------|--------|---------|
| 1 | **BLOCKCHAINS** | 50 | 🔵 Azul | MANUAL_FIELD | Redes blockchain activas |
| 2 | **DEXES** | 200 | 🟢 Verde | AUTO_FIELD | Exchanges descentralizados |
| 3 | **ASSETS** | 400 | 🟢 Verde | AUTO_FIELD | Tokens y precios |
| 4 | **POOLS** | 100 | 🟢 Verde | AUTO_FIELD | Pools de liquidez |
| 5 | **ROUTES** | 200 | 🟠 Naranja | CALCULATED_FIELD | Rutas de arbitraje |
| 6 | **EXECUTIONS** | 50 | 🟠 Naranja | CALCULATED_FIELD | Operaciones ejecutadas |
| 7 | **CONFIG** | 7 | 🔵 Azul | MANUAL_FIELD | Configuración global |
| 8 | **ALERTS** | 9 | 🔴 Rojo | SYSTEM_FIELD | Sistema de alertas |

**Total:** 1016+ campos dinámicos

---

## 📝 Paso 4: Configurar Datos Iniciales

### 4.1 Hoja BLOCKCHAINS (Manual)

Agrega las redes que quieres usar:

```
CHAIN_ID | CHAIN_NAME | RPC_URL_PRIMARY | IS_ACTIVE
1        | Ethereum   | https://eth-mainnet.public.blastapi.io | TRUE
56       | BSC        | https://bsc-dataseed.binance.org | TRUE
137      | Polygon    | https://polygon-rpc.com | TRUE
```

### 4.2 Hoja CONFIG (Manual)

Establece parámetros globales:

```
KEY | VALUE | DESCRIPTION | TYPE | IS_ACTIVE
MIN_PROFIT_USD | 10 | Profit mínimo para ejecutar | number | TRUE
MAX_SLIPPAGE | 0.01 | Slippage máximo (1%) | number | TRUE
MIN_CONFIDENCE | 0.7 | Confianza mínima oráculos | number | TRUE
ENABLED_STRATEGIES | 2dex,3dex,triangular | Estrategias habilitadas | string | TRUE
```

### 4.3 Hojas AUTO_FIELD (Automáticas)

Las hojas **DEXES**, **ASSETS**, y **POOLS** se llenarán automáticamente cuando el sistema esté corriendo:

- **Python Collector** llenará datos de DEXes y Assets
- **Rust Engine** actualizará Pools y precios
- **API Server** leerá y validará datos

### 4.4 Hojas CALCULATED_FIELD (Calculadas)

Las hojas **ROUTES** y **EXECUTIONS** se llenarán automáticamente:

- **Rust Engine** calculará y escribirá rutas óptimas
- **TS Executor** registrará resultados de ejecuciones

---

## ✅ Paso 5: Validar Configuración

```bash
# Verifica que el sistema pueda leer el Sheet
node -e "
const { google } = require('googleapis');
const fs = require('fs');

async function test() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './keys/gsheets-sa.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  const result = await sheets.spreadsheets.get({
    spreadsheetId: '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ',
  });
  
  console.log('✅ Spreadsheet:', result.data.properties.title);
  console.log('✅ Hojas:', result.data.sheets.map(s => s.properties.title).join(', '));
}

test().catch(console.error);
"
```

---

## 🔥 Paso 6: Iniciar el Sistema

Una vez configurado el Google Sheet, el sistema puede arrancar:

```bash
# 1. Iniciar Python Collector (llena DEXES y ASSETS)
cd services/python-collector
python3 -m src.main

# 2. Iniciar Rust Engine (calcula ROUTES)
cd services/engine-rust
cargo run --release

# 3. Iniciar API Server (coordina todo)
cd services/api-server
npm start

# 4. Iniciar TS Executor (ejecuta operaciones)
cd services/ts-executor
npm start
```

---

## 📊 Monitoreo en Tiempo Real

Abre el Google Sheet en tu navegador y verás:

- **DEXES** llenándose con datos de exchanges
- **ASSETS** actualizándose con precios en tiempo real
- **POOLS** mostrando liquidez disponible
- **ROUTES** con oportunidades de arbitraje calculadas
- **EXECUTIONS** con resultados de operaciones

---

## 🚨 Troubleshooting

### Error: "Permission denied"
- Verifica que el Service Account tenga acceso al spreadsheet
- Comparte el spreadsheet con el email del Service Account

### Error: "API not enabled"
- Habilita Google Sheets API en Google Cloud Console

### Error: "Invalid credentials"
- Verifica que el archivo `keys/gsheets-sa.json` exista
- Verifica que `GOOGLE_APPLICATION_CREDENTIALS` apunte al archivo correcto

### Error: "Spreadsheet not found"
- Verifica que `SPREADSHEET_ID` sea correcto
- Verifica que el spreadsheet exista y sea accesible

---

## 💡 Notas Importantes

1. **CERO HARDCODING:** Todo el sistema lee de estas 13 hojas
2. **Programación Dinámica:** Los datos fluyen automáticamente
3. **1016+ Campos:** Toda la configuración está en el Sheet
4. **Arquitectura Real:** Este es el cerebro del sistema

---

**Generado por:** MANU - Sistema de Configuración  
**Fecha:** 17 de octubre de 2025  
**Versión:** 1.0.0
