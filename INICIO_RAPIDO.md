# 🚀 Inicio Rápido - Google Sheet Brain

## ⚡ Configuración en 3 Pasos

### Paso 1: Descargar el Script

**Descarga este archivo directamente:**
```
https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/setup-and-init-sheets.bat
```

O copia el contenido y guárdalo como `setup-and-init-sheets.bat` en cualquier carpeta.

---

### Paso 2: Preparar Credenciales de Google Cloud

#### 2.1 Crear Service Account

1. **Abre Google Cloud Console:**
   - URL: https://console.cloud.google.com/iam-admin/serviceaccounts?project=arbitragex-475408

2. **Crea una nueva cuenta de servicio:**
   - Clic en **"+ CREAR CUENTA DE SERVICIO"**
   - **Nombre:** `arbitragexplus-sheets`
   - **Rol:** Editor
   - Clic en **"Crear"**

3. **Descarga la clave JSON:**
   - Clic en los **tres puntos** (⋮) → **"Administrar claves"**
   - **"Agregar clave"** → **"Crear clave nueva"** → **JSON**
   - Se descargará un archivo `.json`

4. **IMPORTANTE:** Guarda este archivo, lo necesitarás en el Paso 3

#### 2.2 Habilitar Google Sheets API

1. **Ve a la Biblioteca de APIs:**
   - URL: https://console.cloud.google.com/apis/library?project=arbitragex-475408

2. **Busca y habilita:**
   - Busca: **"Google Sheets API"**
   - Clic en **"Habilitar"**

#### 2.3 Compartir el Spreadsheet

1. **Copia el email del Service Account:**
   - Ejemplo: `arbitragexplus-sheets@arbitragex-475408.iam.gserviceaccount.com`

2. **Abre el Google Sheet:**
   - URL: https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit

3. **Comparte:**
   - Clic en **"Compartir"**
   - Pega el email del Service Account
   - Permiso: **"Editor"**
   - **Desmarca** "Notificar a las personas"
   - Clic en **"Enviar"**

---

### Paso 3: Ejecutar el Script

1. **Doble clic en `setup-and-init-sheets.bat`**

2. **El script automáticamente:**
   - ✅ Verifica que Git y Node.js estén instalados
   - ✅ Clona el repositorio en `C:\Users\TuUsuario\ARBITRAGEXPLUS2025`
   - ✅ Abre la carpeta `keys` en el explorador
   - ✅ Abre Google Cloud Console en el navegador
   - ⏸️ **PAUSA** y espera a que guardes el archivo JSON

3. **Guarda el archivo JSON:**
   - Copia el archivo JSON descargado en el Paso 2
   - Pégalo en la carpeta `keys` que se abrió automáticamente
   - Renómbralo a: `gsheets-sa.json`

4. **Vuelve a ejecutar el script:**
   - Doble clic en `setup-and-init-sheets.bat` de nuevo
   - Esta vez detectará el archivo y continuará

5. **Confirma la inicialización:**
   - El script te preguntará si deseas continuar
   - Escribe **S** y presiona Enter

6. **¡Listo!**
   - El script eliminará las hojas existentes
   - Creará las 13 hojas maestras con 1016+ campos
   - Abrirá el spreadsheet en tu navegador automáticamente

---

## 📋 Requisitos Previos

- ✅ **Windows 7 o superior**
- ✅ **Git instalado** - https://git-scm.com/download/win
- ✅ **Node.js instalado** - https://nodejs.org/
- ✅ **Conexión a internet**
- ✅ **Cuenta de Google Cloud** con proyecto ARBITRAGEX

---

## 🎯 Lo Que Hace el Script

### Verificaciones Automáticas:
- ✅ Verifica que Git esté instalado
- ✅ Verifica que Node.js esté instalado
- ✅ Verifica si el repositorio ya está clonado

### Clonación del Repositorio:
- ✅ Clona desde: https://github.com/hefarica/ARBITRAGEXPLUS2025.git
- ✅ Ubicación: `C:\Users\TuUsuario\ARBITRAGEXPLUS2025`
- ✅ Si ya existe, pregunta si deseas sobrescribirlo

### Configuración de Credenciales:
- ✅ Verifica que exista `keys\gsheets-sa.json`
- ✅ Si no existe, abre la carpeta y Google Cloud Console
- ✅ Espera a que coloques el archivo
- ✅ Configura variables de entorno automáticamente

### Inicialización del Google Sheet:
- ✅ Instala dependencias necesarias (googleapis)
- ✅ Se conecta a Google Sheets API
- ✅ **Elimina todas las hojas existentes**
- ✅ Crea las 13 hojas maestras
- ✅ Configura 1016+ campos (columnas)
- ✅ Aplica formato y colores
- ✅ Abre el spreadsheet en el navegador

---

## 🗂️ Estructura Final

Después de ejecutar el script, tendrás:

```
C:\Users\TuUsuario\ARBITRAGEXPLUS2025\
├── keys\
│   └── gsheets-sa.json          ← Tu archivo de credenciales
├── scripts\
│   └── init-google-sheet-brain.js
├── services\
│   ├── api-server\
│   ├── python-collector\
│   ├── engine-rust\
│   └── ts-executor\
├── setup-and-init-sheets.bat    ← El script que ejecutaste
├── CONFIGURAR_GOOGLE_SHEET.md
├── INSTRUCCIONES_WINDOWS.md
└── ... (otros archivos del proyecto)
```

---

## 📊 Google Sheet Resultante

El spreadsheet tendrá estas 13 hojas:

| # | Hoja | Campos | Color | Tipo |
|---|------|--------|-------|------|
| 1 | BLOCKCHAINS | 50 | 🔵 Azul | Manual |
| 2 | DEXES | 200 | 🟢 Verde | Auto |
| 3 | ASSETS | 400 | 🟢 Verde | Auto |
| 4 | POOLS | 100 | 🟢 Verde | Auto |
| 5 | ROUTES | 200 | 🟠 Naranja | Calculado |
| 6 | EXECUTIONS | 50 | 🟠 Naranja | Calculado |
| 7 | CONFIG | 7 | 🔵 Azul | Manual |
| 8 | ALERTS | 9 | 🔴 Rojo | Sistema |

**Total:** 1,016 campos dinámicos

---

## 🚨 Troubleshooting

### Error: "Git no está instalado"
**Solución:** Instala Git desde https://git-scm.com/download/win

### Error: "Node.js no está instalado"
**Solución:** Instala Node.js desde https://nodejs.org/

### Error: "Error al clonar el repositorio"
**Solución:** 
- Verifica tu conexión a internet
- Verifica que tengas acceso al repositorio
- Si el directorio ya existe, elimínalo manualmente

### Error: "Permission denied" o "403 Forbidden"
**Solución:**
- Verifica que hayas compartido el spreadsheet con el Service Account
- Verifica que el permiso sea "Editor"
- Copia el email correcto del Service Account

### Error: "API not enabled"
**Solución:**
- Ve a Google Cloud Console
- APIs y servicios → Biblioteca
- Busca "Google Sheets API"
- Clic en "Habilitar"

### El script se detiene en "Archivo de credenciales requerido"
**Solución:**
- Descarga el archivo JSON del Service Account
- Guárdalo en la carpeta `keys` que se abrió
- Renómbralo a `gsheets-sa.json`
- Vuelve a ejecutar el script

---

## 🎉 Próximos Pasos

Una vez que el script termine exitosamente:

1. **Abre el spreadsheet** (se abre automáticamente)
2. **Verifica las 13 hojas** creadas
3. **Configura datos iniciales:**
   - Hoja **BLOCKCHAINS**: Agrega las redes que usarás
   - Hoja **CONFIG**: Establece parámetros globales
4. **Inicia los servicios** del sistema
5. **Observa cómo se llenan** las hojas automáticamente

---

## 💡 Nota Importante

El script es **idempotente**, lo que significa que puedes ejecutarlo múltiples veces sin problemas. Siempre:
- ✅ Eliminará las hojas existentes
- ✅ Creará las 13 hojas maestras desde cero
- ✅ Garantizará una estructura limpia y correcta

---

## 🔗 Enlaces Útiles

- **Repositorio:** https://github.com/hefarica/ARBITRAGEXPLUS2025
- **Google Sheet:** https://docs.google.com/spreadsheets/d/1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ/edit
- **Google Cloud Console:** https://console.cloud.google.com/
- **Documentación completa:** Ver `CONFIGURAR_GOOGLE_SHEET.md` en el repositorio

---

**¿Necesitas ayuda?** Revisa los archivos de documentación en el repositorio o contacta al equipo de desarrollo.

**¡El cerebro del sistema está a un doble clic de distancia!** 🚀

