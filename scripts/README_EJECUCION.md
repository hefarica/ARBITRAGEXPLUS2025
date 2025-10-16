# 🚀 Cómo Ejecutar la Validación del Sistema

## ⚠️ Importante: Antivirus

Los archivos `.vbs` (Visual Basic Script) son comúnmente bloqueados por antivirus.  
Por eso, **usa el archivo `.bat`** en su lugar, que es más seguro y compatible.

---

## 📋 Método Recomendado: Archivo .BAT

### **Paso 1: Descargar 2 archivos**

Descarga estos archivos del repositorio:

1. **Validate-System-Complete.ps1** (19 KB)
   - https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/Validate-System-Complete.ps1

2. **EJECUTAR-VALIDACION.bat** (nuevo)
   - https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/EJECUTAR-VALIDACION.bat

### **Paso 2: Colocar ambos en la MISMA carpeta**

```
D:\Downloads\  (o donde prefieras)
├── Validate-System-Complete.ps1  (19 KB)
└── EJECUTAR-VALIDACION.bat        (nuevo)
```

### **Paso 3: Doble clic en el .bat**

```
Doble clic en: EJECUTAR-VALIDACION.bat
```

**Qué sucede:**
1. ✅ Se abre una ventana CMD (normal, no oculta)
2. ✅ Muestra progreso de la validación
3. ✅ Genera el reporte en `reportes/`
4. ✅ Abre Notepad automáticamente con el reporte
5. ✅ La ventana CMD se cierra después de 2 segundos

---

## 🎯 Ventajas del Archivo .BAT

| Característica | .VBS (bloqueado) | .BAT (recomendado) |
|----------------|------------------|---------------------|
| **Antivirus** | ❌ Bloqueado | ✅ Compatible |
| **Seguridad** | ⚠️ Sospechoso | ✅ Seguro |
| **Visibilidad** | Invisible | ✅ Muestra progreso |
| **Debugging** | Difícil | ✅ Fácil de depurar |
| **Compatibilidad** | Windows 7+ | ✅ Todas las versiones |

---

## 📄 Ejemplo de Salida

Cuando ejecutes el `.bat`, verás:

```
================================================================================
  GENERANDO DIAGRAMA DE ARQUITECTURA - ARBITRAGEXPLUS2025
================================================================================

[INFO] Ejecutando validacion del sistema...
[INFO] Esto puede tomar unos segundos...

[OK] Reporte generado exitosamente!
[INFO] Ubicacion: D:\Downloads\reportes\validation-report-2025-10-16_15-30-45.txt

[INFO] Abriendo reporte en Notepad...
```

Luego se abre Notepad con el reporte completo (7 secciones).

---

## 📁 Ubicación del Reporte

Los reportes se guardan en:

```
D:\Downloads\
└── reportes\
    ├── validation-report-2025-10-16_15-30-45.txt
    ├── validation-report-2025-10-16_16-20-10.txt
    └── validation-report-2025-10-16_17-45-30.txt
```

**Formato del nombre:**
```
validation-report-YYYY-MM-DD_HH-MM-SS.txt
```

---

## 🔧 Solución de Problemas

### **Problema 1: "No se puede ejecutar scripts en este sistema"**

**Solución:**
1. Abre PowerShell como Administrador
2. Ejecuta: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Confirma con `Y`
4. Intenta nuevamente

### **Problema 2: "No se pudo generar el reporte"**

**Solución:**
- Verifica que ambos archivos estén en la **misma carpeta**
- Verifica que `Validate-System-Complete.ps1` tenga 19 KB (no 3 KB)
- Descarga nuevamente los archivos del repositorio

### **Problema 3: Antivirus bloquea el .bat**

**Solución:**
- Agrega la carpeta `D:\Downloads\` a las exclusiones del antivirus
- O ejecuta manualmente:
  ```
  powershell.exe -ExecutionPolicy Bypass -File "D:\Downloads\Validate-System-Complete.ps1"
  ```

---

## 🔗 Enlaces Útiles

**Repositorio:** https://github.com/hefarica/ARBITRAGEXPLUS2025  
**Descarga directa del .bat:** https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/EJECUTAR-VALIDACION.bat  
**Descarga directa del .ps1:** https://raw.githubusercontent.com/hefarica/ARBITRAGEXPLUS2025/master/scripts/Validate-System-Complete.ps1

---

## ✅ Resumen

**Usa el archivo .BAT en lugar del .VBS:**
- ✅ Compatible con antivirus
- ✅ Más seguro
- ✅ Muestra progreso
- ✅ Fácil de depurar

**Simplemente:**
1. Descarga `Validate-System-Complete.ps1` (19 KB)
2. Descarga `EJECUTAR-VALIDACION.bat`
3. Doble clic en el `.bat`
4. Revisa el reporte en Notepad

**¡Listo!** 🚀

