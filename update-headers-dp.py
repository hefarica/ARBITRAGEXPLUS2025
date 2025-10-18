#!/usr/bin/env python3
"""
Script para actualizar headers de archivos con sección de Programación Dinámica
"""

import os
import re
from pathlib import Path

# Archivos clave que ya transformamos
KEY_FILES = {
    'services/api-server/src/services/priceService.ts': {
        'dp_applied': [
            '❌ NO hardcoding de tokens → ✅ Carga desde Google Sheets',
            '❌ NO mapeo fijo de price IDs → ✅ Map dinámico construido en runtime',
            '❌ NO array fijo de oráculos → ✅ Array de OracleSource configurables',
            '✅ Descubrimiento dinámico de assets activos (IS_ACTIVE = TRUE)',
            '✅ Validación por características (minConfidence, priority)',
            '✅ Refresh automático de configuración cada 5 minutos',
            '✅ Polimorfismo: OracleSource interface permite agregar oráculos sin modificar código',
        ]
    },
    'services/api-server/src/lib/errors.ts': {
        'dp_applied': [
            '❌ NO handlers hardcodeados → ✅ Array dinámico de ErrorHandler',
            '❌ NO configuración fija → ✅ Map de configuraciones desde Sheets',
            '✅ Interface ErrorHandler permite agregar handlers sin modificar código',
            '✅ registerHandler() agrega handlers en runtime',
            '✅ loadErrorConfig() carga configuración desde Google Sheets',
            '✅ Polimorfismo: Cualquier clase que implemente ErrorHandler puede ser registrada',
            '✅ Descubrimiento dinámico de configuraciones de manejo de errores',
        ]
    },
    'services/python-collector/src/main.py': {
        'dp_applied': [
            '❌ NO collectors hardcodeados → ✅ Dict dinámico de CollectorInterface',
            '❌ NO importaciones fijas → ✅ Importación dinámica con importlib',
            '✅ Interface CollectorInterface (ABC) permite agregar collectors sin modificar código',
            '✅ register_collector() agrega collectors en runtime',
            '✅ load_collectors_config() carga configuración desde Google Sheets',
            '✅ discover_collectors() importa módulos dinámicamente',
            '✅ Polimorfismo: Cualquier clase que implemente CollectorInterface puede ser registrada',
            '✅ Descubrimiento dinámico de collectors desde configuración',
        ]
    },
}

def update_header_with_dp(file_path: str, dp_items: list):
    """Actualiza el header de un archivo con sección de DP"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verificar si ya tiene sección de DP
        if '🧬 PROGRAMACIÓN DINÁMICA APLICADA:' in content:
            print(f"  ⚠️  {file_path} ya tiene sección de DP")
            return False
        
        # Buscar el final del header (antes del primer import o código)
        # Para TypeScript/JavaScript
        if file_path.endswith(('.ts', '.js')):
            # Buscar el cierre del comentario de header
            header_end = content.find(' */')
            if header_end == -1:
                header_end = content.find('import ')
            
            if header_end == -1:
                print(f"  ❌ No se encontró header en {file_path}")
                return False
            
            # Construir sección de DP
            dp_section = '\n * \n * 🧬 PROGRAMACIÓN DINÁMICA APLICADA:\n'
            for i, item in enumerate(dp_items, 1):
                dp_section += f' *   {i}. {item}\n'
            dp_section += ' * \n'
            
            # Insertar antes del cierre del header
            new_content = content[:header_end] + dp_section + content[header_end:]
        
        # Para Python
        elif file_path.endswith('.py'):
            # Buscar el cierre del docstring de header
            header_end = content.find('"""', 10)  # Segundo """
            
            if header_end == -1:
                print(f"  ❌ No se encontró header en {file_path}")
                return False
            
            # Construir sección de DP
            dp_section = '\n🧬 PROGRAMACIÓN DINÁMICA APLICADA:\n'
            for i, item in enumerate(dp_items, 1):
                dp_section += f'  {i}. {item}\n'
            dp_section += '\n'
            
            # Insertar antes del cierre del docstring
            new_content = content[:header_end] + dp_section + content[header_end:]
        
        else:
            print(f"  ⚠️  Tipo de archivo no soportado: {file_path}")
            return False
        
        # Escribir archivo actualizado
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"  ✅ {file_path} actualizado con sección de DP")
        return True
    
    except Exception as e:
        print(f"  ❌ Error actualizando {file_path}: {e}")
        return False

def main():
    """Función principal"""
    print("🚀 Actualizando headers con sección de Programación Dinámica...\n")
    
    updated = 0
    skipped = 0
    errors = 0
    
    for file_path, config in KEY_FILES.items():
        full_path = f"/home/ubuntu/ARBITRAGEXPLUS2025/{file_path}"
        
        if not os.path.exists(full_path):
            print(f"  ⚠️  Archivo no encontrado: {file_path}")
            skipped += 1
            continue
        
        print(f"📝 Procesando: {file_path}")
        
        if update_header_with_dp(full_path, config['dp_applied']):
            updated += 1
        else:
            skipped += 1
    
    print("\n" + "=" * 70)
    print("✅ ACTUALIZACIÓN DE HEADERS COMPLETADA")
    print("=" * 70)
    print(f"📊 Archivos actualizados: {updated}")
    print(f"⚠️  Archivos omitidos: {skipped}")
    print(f"❌ Errores: {errors}")
    print("")

if __name__ == '__main__':
    main()

