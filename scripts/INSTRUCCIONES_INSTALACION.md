# 📋 Instrucciones de Instalación - Paso a Paso

## ⚠️ Error que Tienes

```
No se pudo generar el reporte de validación.
Verifica que el archivo Validate-System-Complete.ps1 existe en:
D:\Downloads
```

**Causa:** El archivo `Validate-System-Complete.ps1` no está en la carpeta `D:\Downloads`

---

## ✅ Solución - Paso a Paso

### **Paso 1: Descargar los 2 archivos necesarios**

Ve al repositorio y descarga estos **2 archivos**:

1. **Validate-System-Complete.ps1**
   - URL: https://github.com/hefarica/ARBITRAGEXPLUS2025/blob/master/scripts/Validate-System-Complete.ps1
   - Click en "Raw" o "Download"

2. **EJECUTAR-VALIDACION-INVISIBLE.vbs**
   - URL: https://github.com/hefarica/ARBITRAGEXPLUS2025/blob/master/scripts/EJECUTAR-VALIDACION-INVISIBLE.vbs
   - Click en "Raw" o "Download"

---

### **Paso 2: Colocar ambos archivos en la MISMA carpeta**

**Opción A: En Downloads (donde ya los tienes)**
```
D:\Downloads\
├── Validate-System-Complete.ps1    ← Archivo 1
└── EJECUTAR-VALIDACION-INVISIBLE.vbs  ← Archivo 2
```

**Opción B: En una carpeta dedicada (recomendado)**
```
D:\ARBITRAGEXPLUS2025\scripts\
├── Validate-System-Complete.ps1    ← Archivo 1
└── EJECUTAR-VALIDACION-INVISIBLE.vbs  ← Archivo 2
```

**⚠️ IMPORTANTE:** Ambos archivos deben estar en la **MISMA carpeta**.

---

### **Paso 3: Ejecutar el archivo VBS**

**Doble clic en:**
```
EJECUTAR-VALIDACION-INVISIBLE.vbs
```

**Qué sucede:**
1. ⚡ Se ejecuta en segundo plano (invisible)
2. 📁 Crea carpeta `reportes/` automáticamente
3. 📝 Genera reporte con fecha y hora
4. 📄 Abre Notepad con el reporte

---

## 📁 Estructura de Archivos Después de Ejecutar

```
D:\Downloads\  (o donde los colocaste)
├── Validate-System-Complete.ps1
├── EJECUTAR-VALIDACION-INVISIBLE.vbs
└── reportes/  ← Se crea automáticamente
    ├── validation-report-2025-10-16_15-30-45.txt
    ├── validation-report-2025-10-16_15-35-12.txt
    └── validation-report-2025-10-16_16-20-30.txt
```

**Cada ejecución genera un nuevo archivo con timestamp único.**

---

## 🎯 Formato del Nombre del Reporte

```
validation-report-YYYY-MM-DD_HH-MM-SS.txt
```

**Ejemplos:**
- `validation-report-2025-10-16_15-30-45.txt` (3:30:45 PM)
- `validation-report-2025-10-16_15-35-12.txt` (3:35:12 PM)
- `validation-report-2025-10-16_16-20-30.txt` (4:20:30 PM)

**Ventajas:**
- ✅ Nunca sobrescribe reportes anteriores
- ✅ Puedes comparar reportes de diferentes momentos
- ✅ Historial completo de validaciones
- ✅ Ordenados cronológicamente

---

## 🔧 Verificación Rápida

### **Antes de ejecutar, verifica:**

1. ✅ Ambos archivos están en la **misma carpeta**
2. ✅ El archivo `Validate-System-Complete.ps1` existe
3. ✅ El archivo `EJECUTAR-VALIDACION-INVISIBLE.vbs` existe
4. ✅ Tienes permisos de escritura en esa carpeta

### **Para verificar permisos:**
1. Click derecho en la carpeta
2. Propiedades
3. Seguridad
4. Verifica que tu usuario tiene "Control total" o "Modificar"

---

## 📥 Descarga Rápida de Archivos

### **Método 1: Descarga Individual**

1. **Validate-System-Complete.ps1:**
   ```
   https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/Validate-System-Complete.ps1
   ```
   - Click derecho → Guardar como...
   - Guarda en `D:\Downloads\`

2. **EJECUTAR-VALIDACION-INVISIBLE.vbs:**
   ```
   https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/EJECUTAR-VALIDACION-INVISIBLE.vbs
   ```
   - Click derecho → Guardar como...
   - Guarda en `D:\Downloads\`

### **Método 2: Clonar Repositorio Completo**

```cmd
cd D:\
git clone https://github.com/hefarica/ARBITRAGEXPLUS2025.git
cd ARBITRAGEXPLUS2025\scripts
```

Luego doble clic en `EJECUTAR-VALIDACION-INVISIBLE.vbs`

---

## ❌ Errores Comunes y Soluciones

### **Error 1: "No se encontró el archivo Validate-System-Complete.ps1"**

**Causa:** Los archivos no están en la misma carpeta

**Solución:**
1. Verifica que ambos archivos estén en la misma carpeta
2. Descarga `Validate-System-Complete.ps1` del repositorio
3. Colócalo en la misma carpeta que el VBS

---

### **Error 2: "No se pudo generar el reporte"**

**Causa:** El script PowerShell tiene errores de codificación

**Solución:**
1. Descarga la versión **nueva** de `Validate-System-Complete.ps1`
2. Reemplaza el archivo viejo
3. Ejecuta nuevamente el VBS

---

### **Error 3: "Token inesperado" en PowerShell**

**Causa:** Estás usando una versión antigua del script con errores UTF-8

**Solución:**
1. Borra tu `Validate-System-Complete.ps1` actual
2. Descarga la versión nueva del repositorio:
   ```
   https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/Validate-System-Complete.ps1
   ```
3. Guarda en la misma carpeta que el VBS
4. Ejecuta nuevamente

---

## 🎯 Resumen - Checklist

- [ ] Descargué `Validate-System-Complete.ps1`
- [ ] Descargué `EJECUTAR-VALIDACION-INVISIBLE.vbs`
- [ ] Ambos archivos están en la **misma carpeta**
- [ ] Hice doble clic en `EJECUTAR-VALIDACION-INVISIBLE.vbs`
- [ ] Se abrió Notepad con el reporte
- [ ] El reporte está en la carpeta `reportes/`

---

## 📞 Soporte

Si sigues teniendo problemas:

1. Verifica que descargaste la versión **nueva** del script PowerShell
2. Verifica que ambos archivos están en la **misma carpeta**
3. Verifica que tienes **permisos de escritura** en esa carpeta
4. Intenta ejecutar desde otra carpeta (ej: `D:\ARBITRAGEXPLUS2025\scripts\`)

---

## 🔗 Enlaces Directos

**Repositorio:**
https://github.com/hefarica/ARBITRAGEXPLUS2025

**Carpeta scripts:**
https://github.com/hefarica/ARBITRAGEXPLUS2025/tree/master/scripts

**Descarga directa Validate-System-Complete.ps1:**
https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/Validate-System-Complete.ps1

**Descarga directa EJECUTAR-VALIDACION-INVISIBLE.vbs:**
https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/EJECUTAR-VALIDACION-INVISIBLE.vbs

---

**Última Actualización:** 2025-10-16  
**Versión:** 3.0  
**Autor:** MANUS AI

