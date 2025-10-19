"""
Test para SnapshotManager - Detección de cambios incrementales
"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "python-collector" / "src"))

from lib.excel_client import ExcelClient
from lib.snapshot_manager import SnapshotManager


def test_snapshot_detection():
    """Prueba la detección de cambios con SnapshotManager"""
    
    excel_path = Path(__file__).parent.parent / "data" / "ARBITRAGEXPLUS2025.xlsx"
    
    print(f"\n{'='*80}")
    print(f"TEST: SnapshotManager - Detección de cambios incrementales")
    print(f"{'='*80}\n")
    
    # Crear directorio temporal para snapshots
    with tempfile.TemporaryDirectory() as temp_dir:
        snapshot_mgr = SnapshotManager(snapshot_dir=temp_dir)
        
        with ExcelClient(excel_path) as client:
            sheet_name = "BLOCKCHAINS"
            
            # Obtener metadata de columnas
            metadata = client.get_column_metadata(sheet_name)
            column_mapping = {m.name: m.index for m in metadata}
            
            # Obtener datos actuales
            current_data = client.get_sheet_data(sheet_name, start_row=2)
            
            print(f"Paso 1: Crear snapshot inicial")
            print(f"{'-'*80}")
            snapshot = snapshot_mgr.create_snapshot(
                sheet_name=sheet_name,
                data=current_data,
                column_mapping=column_mapping,
                start_row=2
            )
            
            info = snapshot_mgr.get_snapshot_info(sheet_name)
            print(f"Snapshot creado:")
            print(f"  - Versión: {info['version']}")
            print(f"  - Celdas: {info['cell_count']}")
            print(f"  - Filas: {info['rows']}")
            print(f"  - Columnas: {info['cols']}")
            print(f"  - Última actualización: {info['last_update']}\n")
            
            # Guardar en disco
            print(f"Paso 2: Guardar snapshot en disco")
            print(f"{'-'*80}")
            snapshot_mgr.save_to_disk(sheet_name)
            snapshot_path = snapshot_mgr._get_snapshot_path(sheet_name)
            print(f"Guardado en: {snapshot_path}")
            print(f"Existe: {snapshot_path.exists()}\n")
            
            # Simular que no hay cambios
            print(f"Paso 3: Detectar cambios (sin modificaciones)")
            print(f"{'-'*80}")
            changes = snapshot_mgr.detect_changes(
                sheet_name=sheet_name,
                current_data=current_data,
                column_mapping=column_mapping,
                start_row=2
            )
            print(f"Cambios detectados: {len(changes)}")
            if len(changes) == 0:
                print("✓ OK - No hay cambios como se esperaba\n")
            else:
                print("✗ ERROR - Se detectaron cambios cuando no debería haber\n")
            
            # Simular cambio en columna NAME (PULL)
            print(f"Paso 4: Simular cambio en columna NAME (PULL)")
            print(f"{'-'*80}")
            modified_data = current_data.copy()
            if len(modified_data) > 0:
                old_name = modified_data[0].get("NAME")
                modified_data[0]["NAME"] = "ethereum_modified"
                print(f"Cambio simulado en fila 2:")
                print(f"  Antes: {old_name}")
                print(f"  Después: ethereum_modified\n")
                
                # Detectar cambios
                changes = snapshot_mgr.detect_changes(
                    sheet_name=sheet_name,
                    current_data=modified_data,
                    column_mapping=column_mapping,
                    start_row=2,
                    columns_to_watch=["NAME"]  # Solo monitorear columna NAME
                )
                
                print(f"Cambios detectados: {len(changes)}")
                
                if len(changes) > 0:
                    print("✓ OK - Cambio detectado correctamente")
                    for change in changes:
                        print(f"\nDetalle del cambio:")
                        print(f"  - Hoja: {change.sheet_name}")
                        print(f"  - Fila: {change.row}")
                        print(f"  - Columna: {change.column_name}")
                        print(f"  - Valor anterior: {change.old_value}")
                        print(f"  - Valor nuevo: {change.new_value}")
                        print(f"  - Timestamp: {change.timestamp}")
                else:
                    print("✗ ERROR - No se detectó el cambio")
                
                print()
            
            # Obtener filas afectadas
            print(f"Paso 5: Identificar filas afectadas")
            print(f"{'-'*80}")
            changed_rows = snapshot_mgr.get_changed_rows(changes)
            print(f"Filas con cambios: {sorted(changed_rows)}\n")
            
            # Filtrar cambios por columna
            print(f"Paso 6: Filtrar cambios por columna")
            print(f"{'-'*80}")
            name_changes = snapshot_mgr.get_changes_by_column(changes, "NAME")
            print(f"Cambios en columna NAME: {len(name_changes)}\n")
            
            # Actualizar snapshot
            print(f"Paso 7: Actualizar snapshot con datos modificados")
            print(f"{'-'*80}")
            snapshot_mgr.update_snapshot(
                sheet_name=sheet_name,
                data=modified_data,
                column_mapping=column_mapping,
                start_row=2
            )
            
            new_info = snapshot_mgr.get_snapshot_info(sheet_name)
            print(f"Snapshot actualizado:")
            print(f"  - Versión: {new_info['version']} (incrementada)")
            print(f"  - Última actualización: {new_info['last_update']}\n")
            
            # Verificar que ahora no hay cambios
            print(f"Paso 8: Verificar que no hay cambios después de actualizar")
            print(f"{'-'*80}")
            changes_after = snapshot_mgr.detect_changes(
                sheet_name=sheet_name,
                current_data=modified_data,
                column_mapping=column_mapping,
                start_row=2
            )
            print(f"Cambios detectados: {len(changes_after)}")
            if len(changes_after) == 0:
                print("✓ OK - Snapshot actualizado correctamente\n")
            else:
                print("✗ ERROR - Todavía se detectan cambios\n")
            
            # Cargar desde disco
            print(f"Paso 9: Guardar, limpiar memoria y cargar desde disco")
            print(f"{'-'*80}")
            # Guardar snapshot actualizado antes de limpiar
            snapshot_mgr.save_to_disk(sheet_name)
            print(f"Snapshot guardado en disco")
            
            snapshot_mgr.clear_snapshot(sheet_name, delete_file=False)
            print(f"Snapshot eliminado de memoria (archivo en disco preservado)")
            
            loaded = snapshot_mgr.load_from_disk(sheet_name)
            if loaded:
                print(f"✓ Snapshot cargado desde disco")
                loaded_info = snapshot_mgr.get_snapshot_info(sheet_name)
                print(f"  - Versión: {loaded_info['version']}")
                print(f"  - Celdas: {loaded_info['cell_count']}\n")
            else:
                print(f"✗ ERROR - No se pudo cargar snapshot\n")
            
            print(f"{'='*80}")
            print(f"TEST COMPLETADO")
            print(f"{'='*80}\n")


if __name__ == "__main__":
    test_snapshot_detection()

