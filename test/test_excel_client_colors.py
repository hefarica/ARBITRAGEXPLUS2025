"""
Test para ExcelClient - Verificación de detección de colores en BLOCKCHAINS sheet
"""

import sys
from pathlib import Path

# Agregar path del módulo
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "python-collector" / "src"))

from lib.excel_client import ExcelClient, ColumnMode


def test_blockchains_sheet():
    """Prueba la detección de colores en la hoja BLOCKCHAINS"""
    
    excel_path = Path(__file__).parent.parent / "data" / "ARBITRAGEXPLUS2025.xlsx"
    
    print(f"\n{'='*80}")
    print(f"TEST: Detección de colores en BLOCKCHAINS sheet")
    print(f"{'='*80}\n")
    print(f"Archivo: {excel_path}")
    print(f"Existe: {excel_path.exists()}\n")
    
    with ExcelClient(excel_path) as client:
        # Obtener metadata de columnas
        metadata = client.get_column_metadata("BLOCKCHAINS")
        
        print(f"Total de columnas detectadas: {len(metadata)}\n")
        
        # Contar por modo
        push_count = sum(1 for m in metadata if m.mode == ColumnMode.PUSH)
        pull_count = sum(1 for m in metadata if m.mode == ColumnMode.PULL)
        unknown_count = sum(1 for m in metadata if m.mode == ColumnMode.UNKNOWN)
        
        print(f"Resumen:")
        print(f"  - PUSH (azul, sistema escribe): {push_count}")
        print(f"  - PULL (blanco, usuario escribe): {pull_count}")
        print(f"  - UNKNOWN (color no reconocido): {unknown_count}\n")
        
        # Mostrar detalles de cada columna
        print(f"{'Letra':<6} {'Índice':<7} {'Modo':<8} {'Color':<12} {'Nombre'}")
        print(f"{'-'*80}")
        
        for col in metadata:
            color_str = col.bg_color if col.bg_color else "None"
            print(f"{col.letter:<6} {col.index:<7} {col.mode.value:<8} {color_str:<12} {col.name}")
        
        print(f"\n{'='*80}")
        print(f"Verificación específica de columnas clave:")
        print(f"{'='*80}\n")
        
        # Verificar columna B (NAME) - debe ser PULL (blanco)
        col_b = next((m for m in metadata if m.letter == "B"), None)
        if col_b:
            expected = ColumnMode.PULL
            status = "✓ OK" if col_b.mode == expected else "✗ ERROR"
            print(f"Columna B (NAME): {col_b.mode.value} - Esperado: {expected.value} {status}")
        
        # Verificar columna A (ID) - debe ser PUSH (azul)
        col_a = next((m for m in metadata if m.letter == "A"), None)
        if col_a:
            expected = ColumnMode.PUSH
            status = "✓ OK" if col_a.mode == expected else "✗ ERROR"
            print(f"Columna A (ID): {col_a.mode.value} - Esperado: {expected.value} {status}")
        
        # Verificar columna C - debe ser PUSH (azul)
        col_c = next((m for m in metadata if m.letter == "C"), None)
        if col_c:
            expected = ColumnMode.PUSH
            status = "✓ OK" if col_c.mode == expected else "✗ ERROR"
            print(f"Columna C ({col_c.name}): {col_c.mode.value} - Esperado: {expected.value} {status}")
        
        print(f"\n{'='*80}")
        print(f"Obtener datos de filas existentes:")
        print(f"{'='*80}\n")
        
        # Obtener datos de las filas
        data = client.get_sheet_data("BLOCKCHAINS", start_row=2, end_row=10)
        
        print(f"Filas con datos: {len(data)}\n")
        
        for idx, row in enumerate(data, start=1):
            name = row.get("NAME", "N/A")
            print(f"Fila {idx}: {name}")
            # Mostrar algunos campos PUSH
            for key, value in list(row.items())[:5]:
                if value is not None:
                    print(f"  {key}: {value}")
        
        print(f"\n{'='*80}")
        print(f"Filtrado por modo:")
        print(f"{'='*80}\n")
        
        # Obtener solo columnas PULL
        pull_cols = client.get_pull_columns("BLOCKCHAINS")
        print(f"Columnas PULL (usuario escribe):")
        for col in pull_cols:
            print(f"  - {col.letter}: {col.name}")
        
        print(f"\nColumnas PUSH (sistema escribe) - Primeras 10:")
        push_cols = client.get_push_columns("BLOCKCHAINS")
        for col in push_cols[:10]:
            print(f"  - {col.letter}: {col.name}")
        
        print(f"\n... y {len(push_cols) - 10} columnas PUSH más\n")
        
        print(f"{'='*80}")
        print(f"TEST COMPLETADO")
        print(f"{'='*80}\n")


if __name__ == "__main__":
    test_blockchains_sheet()

