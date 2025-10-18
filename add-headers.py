#!/usr/bin/env python3
"""
Script para agregar headers de documentación únicos a cada archivo.
Analiza el código real y genera headers específicos.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

# Leer lista de archivos
with open('/tmp/files-to-document.txt', 'r') as f:
    files = [line.strip() for line in f if line.strip()]

print(f"📊 Total de archivos a procesar: {len(files)}")

def analyze_typescript_file(content: str, filepath: str) -> Dict:
    """Analiza un archivo TypeScript y extrae información específica"""
    info = {
        'imports': [],
        'exports': [],
        'classes': [],
        'functions': [],
        'interfaces': [],
        'types': [],
    }
    
    # Imports
    imports = re.findall(r'import\s+.*?from\s+[\'"](.+?)[\'"]', content)
    info['imports'] = list(set(imports))[:5]  # Top 5
    
    # Exports
    exports = re.findall(r'export\s+(?:class|function|interface|type|const)\s+(\w+)', content)
    info['exports'] = list(set(exports))[:5]
    
    # Classes
    classes = re.findall(r'class\s+(\w+)', content)
    info['classes'] = list(set(classes))[:3]
    
    # Functions
    functions = re.findall(r'(?:async\s+)?function\s+(\w+)', content)
    info['functions'] = list(set(functions))[:5]
    
    # Interfaces
    interfaces = re.findall(r'interface\s+(\w+)', content)
    info['interfaces'] = list(set(interfaces))[:3]
    
    # Google Sheets references
    sheets_refs = re.findall(r'[\'"]([A-Z_]+)[\'"]', content)
    sheets_refs = [s for s in sheets_refs if s in ['POOLS', 'ROUTES', 'DEXES', 'BLOCKCHAINS', 'ASSETS', 'CONFIG', 'EXECUTIONS', 'ALERTS', 'LOGERRORESEVENTOS']]
    info['sheets'] = list(set(sheets_refs))[:5]
    
    return info

def analyze_python_file(content: str, filepath: str) -> Dict:
    """Analiza un archivo Python y extrae información específica"""
    info = {
        'imports': [],
        'classes': [],
        'functions': [],
        'sheets': [],
    }
    
    # Imports
    imports = re.findall(r'(?:from|import)\s+([\w.]+)', content)
    info['imports'] = list(set(imports))[:5]
    
    # Classes
    classes = re.findall(r'class\s+(\w+)', content)
    info['classes'] = list(set(classes))[:3]
    
    # Functions
    functions = re.findall(r'def\s+(\w+)', content)
    info['functions'] = list(set(functions))[:5]
    
    # Sheets refs
    sheets_refs = re.findall(r'[\'"]([A-Z_]+)[\'"]', content)
    sheets_refs = [s for s in sheets_refs if s in ['POOLS', 'ROUTES', 'DEXES', 'BLOCKCHAINS', 'ASSETS', 'CONFIG', 'EXECUTIONS', 'ALERTS']]
    info['sheets'] = list(set(sheets_refs))[:5]
    
    return info

def analyze_solidity_file(content: str, filepath: str) -> Dict:
    """Analiza un archivo Solidity"""
    info = {
        'contract': '',
        'functions': [],
        'events': [],
        'modifiers': [],
    }
    
    # Contract name
    contract_match = re.search(r'contract\s+(\w+)', content)
    if contract_match:
        info['contract'] = contract_match.group(1)
    
    # Functions
    functions = re.findall(r'function\s+(\w+)', content)
    info['functions'] = list(set(functions))[:5]
    
    # Events
    events = re.findall(r'event\s+(\w+)', content)
    info['events'] = list(set(events))[:3]
    
    # Modifiers
    modifiers = re.findall(r'modifier\s+(\w+)', content)
    info['modifiers'] = list(set(modifiers))[:3]
    
    return info

def analyze_rust_file(content: str, filepath: str) -> Dict:
    """Analiza un archivo Rust"""
    info = {
        'structs': [],
        'functions': [],
        'traits': [],
        'mods': [],
    }
    
    # Structs
    structs = re.findall(r'struct\s+(\w+)', content)
    info['structs'] = list(set(structs))[:3]
    
    # Functions
    functions = re.findall(r'fn\s+(\w+)', content)
    info['functions'] = list(set(functions))[:5]
    
    # Traits
    traits = re.findall(r'trait\s+(\w+)', content)
    info['traits'] = list(set(traits))[:3]
    
    # Mods
    mods = re.findall(r'mod\s+(\w+)', content)
    info['mods'] = list(set(mods))[:3]
    
    return info

def generate_typescript_header(info: Dict, filepath: str) -> str:
    """Genera header único para TypeScript"""
    filename = os.path.basename(filepath)
    service = filepath.split('/')[2] if len(filepath.split('/')) > 2 else 'unknown'
    
    header = f"""/**
 * ============================================================================
 * ARCHIVO: {filepath}
 * SERVICIO: {service}
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
"""
    
    if info.get('sheets'):
        header += f" *   FUENTE: Google Sheets - {', '.join(info['sheets'])}\n"
        header += " *     - Formato: JSON array\n"
        header += " *     - Frecuencia: Tiempo real / Polling\n"
    
    if info.get('imports'):
        header += f" *   DEPENDENCIAS: {', '.join(info['imports'][:3])}\n"
    
    header += " * \n * 🔄 TRANSFORMACIÓN:\n"
    
    if info.get('classes'):
        header += f" *   CLASES: {', '.join(info['classes'])}\n"
    
    if info.get('functions'):
        header += f" *   FUNCIONES: {', '.join(info['functions'][:3])}\n"
    
    if info.get('interfaces'):
        header += f" *   INTERFACES: {', '.join(info['interfaces'][:3])}\n"
    
    header += " * \n * 📤 SALIDA DE DATOS:\n"
    
    if info.get('exports'):
        header += f" *   EXPORTS: {', '.join(info['exports'][:3])}\n"
    
    if info.get('sheets'):
        header += " *   DESTINO: Google Sheets (actualización)\n"
    
    header += " * \n * 🔗 DEPENDENCIAS:\n"
    
    if info.get('imports'):
        for imp in info['imports'][:3]:
            header += f" *   - {imp}\n"
    
    header += " * \n * ============================================================================\n */\n\n"
    
    return header

def generate_python_header(info: Dict, filepath: str) -> str:
    """Genera header único para Python"""
    filename = os.path.basename(filepath)
    
    header = f'''"""
============================================================================
ARCHIVO: {filepath}
============================================================================

📥 ENTRADA DE DATOS:
'''
    
    if info.get('sheets'):
        header += f"  FUENTE: Google Sheets - {', '.join(info['sheets'])}\n"
        header += "    - Formato: Dict[str, Any]\n"
    
    header += "\n🔄 TRANSFORMACIÓN:\n"
    
    if info.get('classes'):
        header += f"  CLASES: {', '.join(info['classes'])}\n"
    
    if info.get('functions'):
        header += f"  FUNCIONES: {', '.join(info['functions'][:3])}\n"
    
    header += "\n📤 SALIDA DE DATOS:\n"
    
    if info.get('sheets'):
        header += "  DESTINO: Google Sheets\n"
    
    header += "\n🔗 DEPENDENCIAS:\n"
    
    if info.get('imports'):
        for imp in info['imports'][:3]:
            header += f"  - {imp}\n"
    
    header += "\n============================================================================\n\"\"\"\n\n"
    
    return header

def generate_solidity_header(info: Dict, filepath: str) -> str:
    """Genera header único para Solidity"""
    contract_name = info.get('contract', 'Unknown')
    
    header = f"""/**
 * ============================================================================
 * CONTRATO: {contract_name}
 * ARCHIVO: {filepath}
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
"""
    
    if info.get('functions'):
        header += f" *   FUNCIONES: {', '.join(info['functions'][:3])}\n"
    
    header += " * \n * 🔄 LÓGICA:\n"
    
    if 'flash' in filepath.lower() or 'Flash' in contract_name:
        header += " *   - Flash loans\n"
    if 'arbitrage' in filepath.lower() or 'Arbitrage' in contract_name:
        header += " *   - Arbitrage execution\n"
    if 'swap' in filepath.lower():
        header += " *   - Token swaps\n"
    
    header += " * \n * 📤 SALIDA:\n"
    
    if info.get('events'):
        header += f" *   EVENTOS: {', '.join(info['events'])}\n"
    
    header += " * \n * 🔒 SEGURIDAD:\n"
    
    if info.get('modifiers'):
        header += f" *   MODIFIERS: {', '.join(info['modifiers'])}\n"
    
    header += " *   - Reentrancy guard\n"
    header += " *   - Access control\n"
    header += " * \n * ============================================================================\n */\n\n"
    
    return header

def generate_rust_header(info: Dict, filepath: str) -> str:
    """Genera header único para Rust"""
    header = f"""/**
 * ============================================================================
 * ARCHIVO: {filepath}
 * MÓDULO: Rust Engine
 * ============================================================================
 * 
 * 📥 ENTRADA:
"""
    
    if info.get('structs'):
        header += f" *   STRUCTS: {', '.join(info['structs'])}\n"
    
    header += " * \n * 🔄 TRANSFORMACIÓN:\n"
    
    if info.get('functions'):
        header += f" *   FUNCIONES: {', '.join(info['functions'][:3])}\n"
    
    if 'pathfinding' in filepath:
        header += " *   ALGORITMO: Pathfinding optimizado\n"
    if 'pricing' in filepath:
        header += " *   ALGORITMO: Cálculo de precios\n"
    
    header += " * \n * 📤 SALIDA:\n"
    
    if info.get('structs'):
        header += f" *   RETORNA: {info['structs'][0] if info['structs'] else 'Result'}\n"
    
    header += " * \n * 🔗 DEPENDENCIAS:\n"
    
    if info.get('mods'):
        for mod in info['mods'][:3]:
            header += f" *   - {mod}\n"
    
    header += " * \n * ============================================================================\n */\n\n"
    
    return header

# Procesar archivos
processed = 0
errors = 0

for filepath in files:
    try:
        # Leer archivo
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Verificar si ya tiene header
        if '============================================================================' in content[:500]:
            print(f"⏭️  Ya tiene header: {filepath}")
            continue
        
        # Analizar según tipo
        ext = os.path.splitext(filepath)[1]
        
        if ext in ['.ts', '.tsx', '.js', '.jsx']:
            info = analyze_typescript_file(content, filepath)
            header = generate_typescript_header(info, filepath)
        elif ext == '.py':
            info = analyze_python_file(content, filepath)
            header = generate_python_header(info, filepath)
        elif ext == '.sol':
            info = analyze_solidity_file(content, filepath)
            header = generate_solidity_header(info, filepath)
        elif ext == '.rs':
            info = analyze_rust_file(content, filepath)
            header = generate_rust_header(info, filepath)
        else:
            continue
        
        # Agregar header
        new_content = header + content
        
        # Escribir archivo
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        processed += 1
        print(f"✅ {processed}/{len(files)}: {filepath}")
        
    except Exception as e:
        errors += 1
        print(f"❌ Error en {filepath}: {e}")

print(f"\n🎉 Completado!")
print(f"✅ Procesados: {processed}")
print(f"❌ Errores: {errors}")
print(f"📊 Total: {len(files)}")

