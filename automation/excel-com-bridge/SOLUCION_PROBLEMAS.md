# Solución de Problemas - Excel COM Bridge

## 🔧 Problemas Comunes y Soluciones

### Error: "BaseOutputPath/OutputPath not set for project"

**Causa:** MSBuild está recibiendo la plataforma como "Any CPU" (con espacio) en lugar de "AnyCPU" (sin espacio).

**Solución:**
1. Asegúrate de usar el script actualizado `INSTALL_AND_RUN.bat`
2. El script ahora usa `/p:Platform=AnyCPU` (sin espacio)
3. Si el error persiste, ejecuta `BUILD_ONLY.bat` para compilar sin ejecutar

**Comando correcto:**
```batch
MSBuild ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform=AnyCPU /t:Rebuild
```

**Comando incorrecto (NO usar):**
```batch
MSBuild ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform="Any CPU" /t:Rebuild
```

---

### Error: "MSBuild no encontrado"

**Causa:** Visual Studio Build Tools no está instalado.

**Solución:**
1. Ejecuta `INSTALL_AND_RUN.bat`
2. Selecciona opción 1 para instalación automática
3. En el instalador, selecciona **".NET desktop development"**
4. Espera a que termine la instalación (10-30 minutos)
5. Reinicia el script

**Descarga manual:**
- URL: https://aka.ms/vs/17/release/vs_BuildTools.exe
- Componente requerido: **.NET desktop development**

---

### Error: "Ejecutable no encontrado después de compilar"

**Causa:** La compilación falló silenciosamente o el ejecutable se generó en una ubicación diferente.

**Solución:**
1. Ejecuta `RUN_DEBUG.bat` para ver errores detallados
2. Verifica que la carpeta `bin\Release\` existe
3. Busca el archivo `ExcelComBridge.exe` en:
   - `bin\Release\ExcelComBridge.exe`
   - `bin\Debug\ExcelComBridge.exe`
   - `bin\x86\Release\ExcelComBridge.exe`

**Comando de búsqueda:**
```batch
dir /s /b ExcelComBridge.exe
```

---

### Error: "Archivo Excel no encontrado"

**Causa:** El script no puede localizar automáticamente el archivo `ARBITRAGEXPLUS2025.xlsx`.

**Solución:**
1. El script abrirá un diálogo de selección de archivo
2. Navega a la ubicación del archivo Excel
3. Selecciona `ARBITRAGEXPLUS2025.xlsx` o `ARBITRAGEXPLUS2025.xlsm`

**Ubicaciones comunes:**
- `data\ARBITRAGEXPLUS2025.xlsx`
- `..\..\data\ARBITRAGEXPLUS2025.xlsx`
- Carpeta de descargas

---

### Error: "COM object not registered"

**Causa:** Excel no está instalado o las bibliotecas COM no están registradas.

**Solución:**
1. Verifica que Microsoft Excel está instalado
2. Ejecuta Excel al menos una vez para registrar componentes COM
3. Reinicia el sistema si es necesario

**Requisitos:**
- Microsoft Excel 2013 o superior
- .NET Framework 4.8 (incluido en Windows 10+)

---

### Error: "Access denied" al ejecutar el programa

**Causa:** Permisos insuficientes o archivo Excel bloqueado.

**Solución:**
1. Cierra Excel completamente (verifica en Task Manager)
2. Ejecuta el script como Administrador (clic derecho → "Ejecutar como administrador")
3. Desbloquea el archivo Excel:
   - Clic derecho en el archivo → Propiedades
   - Marca "Desbloquear" si está disponible
   - Aplica y acepta

---

## 🚀 Scripts Disponibles

### `INSTALL_AND_RUN.bat` (Recomendado)
- **Función:** Instalación automática + Compilación + Ejecución
- **Uso:** Doble clic para ejecutar
- **Características:**
  - Detecta MSBuild automáticamente
  - Ofrece instalación de Visual Studio Build Tools
  - Compila el proyecto
  - Busca archivo Excel automáticamente
  - Ejecuta el programa

### `BUILD_ONLY.bat`
- **Función:** Solo compilación (sin ejecutar)
- **Uso:** Para compilar sin ejecutar el programa
- **Útil cuando:**
  - Solo quieres generar el ejecutable
  - Vas a ejecutar manualmente después
  - Estás probando la compilación

### `RUN_DEBUG.bat`
- **Función:** Compilación con salida detallada
- **Uso:** Para diagnosticar errores de compilación
- **Muestra:**
  - Versión de MSBuild
  - Errores detallados
  - Advertencias del compilador
  - Información del ejecutable generado

---

## 📋 Requisitos del Sistema

### Software Requerido
- ✅ Windows 10 o superior
- ✅ .NET Framework 4.8 (incluido en Windows 10+)
- ✅ Microsoft Excel 2013 o superior
- ✅ Visual Studio Build Tools 2022 (se instala automáticamente)

### Hardware Recomendado
- CPU: Dual-core o superior
- RAM: 4 GB mínimo, 8 GB recomendado
- Disco: 2 GB de espacio libre (para Build Tools)

---

## 🔍 Verificación de Instalación

### Verificar .NET Framework 4.8
```batch
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release
```
**Valor esperado:** >= 528040

### Verificar MSBuild
```batch
"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe" /version
```
**Versión esperada:** 17.x o superior

### Verificar Excel
```batch
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Office" /s | findstr "Excel"
```

---

## 📞 Soporte Adicional

Si ninguna de las soluciones anteriores funciona:

1. **Ejecuta el diagnóstico completo:**
   ```batch
   RUN_DEBUG.bat > debug_log.txt 2>&1
   ```

2. **Revisa el archivo `debug_log.txt` generado**

3. **Verifica la configuración del proyecto:**
   - Abre `ExcelComBridge-Framework.csproj` en un editor de texto
   - Verifica que existe `<Platform Condition=" '$(Platform)' == '' ">AnyCPU</Platform>`
   - Verifica que existen PropertyGroups para `Release|AnyCPU`

4. **Compila manualmente desde línea de comandos:**
   ```batch
   "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe" ExcelComBridge-Framework.csproj /p:Configuration=Release /p:Platform=AnyCPU /t:Rebuild /v:detailed
   ```

---

## ✅ Compilación Exitosa

Cuando la compilación es exitosa, verás:

```
[OK] Compilacion exitosa

Ejecutable generado:
bin\Release\ExcelComBridge.exe
```

El programa está listo para:
- ✅ Detectar cambios en Excel en tiempo real (<10ms)
- ✅ Monitorear columna NAME en hoja BLOCKCHAINS
- ✅ Actualizar celdas con color azul (#4472C4)
- ✅ Auto-limpieza cuando NAME está vacío

---

## 📊 Rendimiento Esperado

### Latencia de Actualización
- **Objetivo:** <10ms
- **Método:** COM nativo con eventos SheetChange
- **Sin flicker:** ScreenUpdating = False

### Capacidad
- Soporte para 50+ columnas PUSH
- Detección automática de color
- Monitoreo continuo sin impacto en rendimiento

---

## 🔄 Actualización del Proyecto

Si el proyecto se actualiza en el repositorio:

1. Descarga la nueva versión
2. Ejecuta `BUILD_ONLY.bat` para recompilar
3. El ejecutable se regenerará con los cambios

**No es necesario reinstalar Visual Studio Build Tools.**

