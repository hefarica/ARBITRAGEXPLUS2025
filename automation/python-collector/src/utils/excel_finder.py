"""
Utilidad para encontrar automáticamente el archivo Excel en el proyecto
"""

import os
from pathlib import Path
from typing import Optional

def find_excel_file(filename: str = "ARBITRAGEXPLUS2025.xlsx") -> Optional[str]:
    """
    Busca el archivo Excel en el proyecto automáticamente
    
    Busca en:
    1. Variable de entorno EXCEL_FILE_PATH
    2. Carpeta data/ relativa al proyecto
    3. Búsqueda recursiva desde la raíz del proyecto
    4. Directorio actual y padres
    
    Args:
        filename: Nombre del archivo Excel a buscar
        
    Returns:
        Ruta absoluta al archivo Excel o None si no se encuentra
    """
    
    # 1. Verificar variable de entorno
    env_path = os.environ.get('EXCEL_FILE_PATH')
    if env_path and os.path.exists(env_path):
        print(f"[OK] Excel encontrado en variable de entorno: {env_path}")
        return env_path
    
    # 2. Obtener directorio raíz del proyecto
    # Buscar hacia arriba hasta encontrar .git o carpeta services/
    current_dir = Path(__file__).resolve().parent
    project_root = None
    
    for parent in [current_dir] + list(current_dir.parents):
        # Si encontramos .git, es la raíz
        if (parent / '.git').exists():
            project_root = parent
            break
        # Si encontramos services/, el padre es la raíz
        if (parent / 'services').exists():
            project_root = parent
            break
    
    if not project_root:
        # Si no encontramos, usar 3 niveles arriba como fallback
        project_root = current_dir.parent.parent.parent
    
    print(f"[INFO] Raíz del proyecto detectada: {project_root}")
    
    # 3. Buscar en carpeta data/ del proyecto
    data_path = project_root / 'data' / filename
    if data_path.exists():
        print(f"[OK] Excel encontrado en carpeta data/: {data_path}")
        return str(data_path)
    
    # 4. Buscar recursivamente en el proyecto
    print(f"[INFO] Buscando {filename} en el proyecto...")
    for root, dirs, files in os.walk(project_root):
        # Ignorar carpetas de entorno virtual y cache
        dirs[:] = [d for d in dirs if d not in ['.venv', 'venv', '__pycache__', '.git', 'node_modules']]
        
        if filename in files:
            found_path = Path(root) / filename
            print(f"[OK] Excel encontrado: {found_path}")
            return str(found_path)
    
    # 5. Buscar en directorio actual y padres (hasta 5 niveles)
    search_dir = Path.cwd()
    for _ in range(5):
        candidate = search_dir / filename
        if candidate.exists():
            print(f"[OK] Excel encontrado en: {candidate}")
            return str(candidate)
        
        candidate_data = search_dir / 'data' / filename
        if candidate_data.exists():
            print(f"[OK] Excel encontrado en: {candidate_data}")
            return str(candidate_data)
        
        search_dir = search_dir.parent
    
    print(f"[ERROR] No se pudo encontrar {filename}")
    print(f"[INFO] Buscado en: {project_root}")
    return None

def get_excel_path(filename: str = "ARBITRAGEXPLUS2025.xlsx") -> str:
    """
    Obtiene la ruta del archivo Excel o lanza excepción si no se encuentra
    
    Args:
        filename: Nombre del archivo Excel
        
    Returns:
        Ruta absoluta al archivo Excel
        
    Raises:
        FileNotFoundError: Si no se encuentra el archivo
    """
    path = find_excel_file(filename)
    
    if not path:
        raise FileNotFoundError(
            f"No se pudo encontrar el archivo {filename}.\n"
            f"Por favor:\n"
            f"1. Coloca el archivo en la carpeta data/ del proyecto\n"
            f"2. O define la variable de entorno EXCEL_FILE_PATH con la ruta completa\n"
            f"3. O ejecuta desde la carpeta del proyecto"
        )
    
    return path

if __name__ == "__main__":
    # Prueba
    print("Buscando archivo Excel...")
    try:
        path = get_excel_path()
        print(f"\n✅ Archivo encontrado: {path}")
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")

