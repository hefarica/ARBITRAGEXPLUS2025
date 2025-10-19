"""
Test de integración end-to-end del sistema de sincronización bidireccional

Simula el flujo completo:
1. Usuario escribe nombre de blockchain en columna B (NAME - PULL/blanco)
2. Sistema detecta cambio
3. Sistema consulta 3 fuentes de datos
4. Sistema actualiza columnas A y C-AY (PUSH/azul)
5. Sistema actualiza snapshot
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "python-collector" / "src"))

from lib.excel_client import ExcelClient, ColumnMode
from lib.snapshot_manager import SnapshotManager
from fetchers.defillama_client import DefiLlamaClient
from fetchers.llamanodes_client import LlamanodesClient
from fetchers.publicnodes_client import PublicnodesClient


def test_bidirectional_sync():
    """Test completo del flujo bidireccional"""
    
    excel_path = Path(__file__).parent.parent / "data" / "ARBITRAGEXPLUS2025.xlsx"
    sheet_name = "BLOCKCHAINS"
    
    print(f"\n{'='*80}")
    print(f"TEST: Sincronización Bidireccional End-to-End")
    print(f"{'='*80}\n")
    
    print(f"Archivo Excel: {excel_path}")
    print(f"Hoja: {sheet_name}\n")
    
    # ========================================================================
    # FASE 1: Inicialización
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 1: Inicialización de componentes")
    print(f"{'='*80}\n")
    
    # ExcelClient
    print(f"1.1. Inicializando ExcelClient...")
    excel_client = ExcelClient(excel_path)
    excel_client.load()
    print(f"✓ ExcelClient cargado\n")
    
    # SnapshotManager
    print(f"1.2. Inicializando SnapshotManager...")
    snapshot_mgr = SnapshotManager(snapshot_dir=".snapshots_test")
    print(f"✓ SnapshotManager inicializado\n")
    
    # Data fetchers
    print(f"1.3. Inicializando fetchers de datos...")
    llamanodes = LlamanodesClient()
    publicnodes = PublicnodesClient()
    print(f"✓ Llamanodes y Publicnodes listos")
    print(f"  (DefiLlama se omite para evitar rate limiting en test)\n")
    
    # ========================================================================
    # FASE 2: Detección de columnas PUSH/PULL
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 2: Detección automática de columnas PUSH/PULL")
    print(f"{'='*80}\n")
    
    metadata = excel_client.get_column_metadata(sheet_name)
    column_mapping = {m.name: m.index for m in metadata}
    
    pull_cols = [m for m in metadata if m.mode == ColumnMode.PULL]
    push_cols = [m for m in metadata if m.mode == ColumnMode.PUSH]
    
    print(f"Columnas detectadas:")
    print(f"  - PULL (blanco/usuario escribe): {len(pull_cols)}")
    for col in pull_cols:
        print(f"    • {col.letter}: {col.name}")
    
    print(f"\n  - PUSH (azul/sistema escribe): {len(push_cols)}")
    print(f"    • Primeras 5: {', '.join([f'{c.letter}:{c.name}' for c in push_cols[:5]])}")
    print(f"    • ... y {len(push_cols) - 5} más\n")
    
    # ========================================================================
    # FASE 3: Crear snapshot inicial
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 3: Crear snapshot inicial")
    print(f"{'='*80}\n")
    
    current_data = excel_client.get_sheet_data(sheet_name, start_row=2)
    
    snapshot = snapshot_mgr.create_snapshot(
        sheet_name=sheet_name,
        data=current_data,
        column_mapping=column_mapping,
        start_row=2
    )
    
    snapshot_mgr.save_to_disk(sheet_name)
    
    info = snapshot_mgr.get_snapshot_info(sheet_name)
    print(f"Snapshot creado:")
    print(f"  - Versión: {info['version']}")
    print(f"  - Celdas: {info['cell_count']}")
    print(f"  - Filas: {info['rows']}")
    print(f"  - Última actualización: {info['last_update']}\n")
    
    # ========================================================================
    # FASE 4: Simular cambio en columna NAME (PULL)
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 4: Simular usuario escribiendo en columna NAME")
    print(f"{'='*80}\n")
    
    # Encontrar primera fila vacía o usar fila 5
    test_row = 5
    test_chain = "avalanche"
    
    print(f"Simulando: Usuario escribe '{test_chain}' en fila {test_row}, columna B (NAME)\n")
    
    # Actualizar celda NAME
    excel_client.update_cells(
        sheet_name=sheet_name,
        updates=[(test_row, 2, test_chain)],  # Columna B = 2
        save=True
    )
    
    print(f"✓ Celda actualizada en Excel\n")
    
    # ========================================================================
    # FASE 5: Detectar cambio
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 5: Detectar cambio en columna PULL")
    print(f"{'='*80}\n")
    
    # Recargar datos
    updated_data = excel_client.get_sheet_data(sheet_name, start_row=2)
    
    # Detectar cambios
    start_detection = time.time()
    changes = snapshot_mgr.detect_changes(
        sheet_name=sheet_name,
        current_data=updated_data,
        column_mapping=column_mapping,
        start_row=2,
        columns_to_watch=["NAME"]  # Solo monitorear NAME
    )
    detection_time = (time.time() - start_detection) * 1000
    
    print(f"Cambios detectados: {len(changes)}")
    print(f"Tiempo de detección: {detection_time:.2f}ms")
    
    if changes:
        for change in changes:
            print(f"\nDetalle del cambio:")
            print(f"  - Fila: {change.row}")
            print(f"  - Columna: {change.column_name}")
            print(f"  - Valor anterior: {change.old_value}")
            print(f"  - Valor nuevo: {change.new_value}")
    
    print()
    
    # ========================================================================
    # FASE 6: Obtener datos de fuentes externas
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 6: Consultar fuentes de datos externas")
    print(f"{'='*80}\n")
    
    start_fetch = time.time()
    
    # Llamanodes
    print(f"6.1. Consultando Llamanodes...")
    llamanodes_data = llamanodes.extract_blockchain_data(test_chain)
    print(f"✓ Llamanodes: {len(llamanodes_data)} campos obtenidos\n")
    
    # Publicnodes
    print(f"6.2. Consultando Publicnodes...")
    publicnodes_data = publicnodes.extract_blockchain_data(test_chain)
    print(f"✓ Publicnodes: {len(publicnodes_data)} campos obtenidos\n")
    
    # Merge
    print(f"6.3. Mergeando datos...")
    merged_data = {
        **llamanodes_data,
        **publicnodes_data,
        "BLOCKCHAIN_ID": f"{test_chain}_test_{int(time.time())}",
        "NAME": test_chain,
    }
    
    fetch_time = (time.time() - start_fetch) * 1000
    
    print(f"✓ Datos merged: {len(merged_data)} campos únicos")
    print(f"Tiempo de fetch: {fetch_time:.2f}ms\n")
    
    # Mostrar algunos campos
    print(f"Campos clave obtenidos:")
    key_fields = ["CHAIN_ID", "RPC_URL_1", "BLOCK_TIME_MS", "GAS_PRICE_GWEI", "SUPPORTED_DEXES"]
    for field in key_fields:
        if field in merged_data:
            value = merged_data[field]
            print(f"  • {field}: {value}")
    
    print()
    
    # ========================================================================
    # FASE 7: Actualizar columnas PUSH en Excel
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 7: Actualizar columnas PUSH (azul) en Excel")
    print(f"{'='*80}\n")
    
    start_update = time.time()
    
    # Filtrar solo datos para columnas PUSH
    push_data = {
        col.name: merged_data.get(col.name)
        for col in push_cols
        if col.name in merged_data
    }
    
    print(f"Actualizando {len(push_data)} columnas PUSH en fila {test_row}...")
    
    excel_client.update_row(
        sheet_name=sheet_name,
        row_number=test_row,
        data=push_data,
        save=True
    )
    
    update_time = (time.time() - start_update) * 1000
    
    print(f"✓ Columnas PUSH actualizadas")
    print(f"Tiempo de actualización: {update_time:.2f}ms\n")
    
    # ========================================================================
    # FASE 8: Actualizar snapshot
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 8: Actualizar snapshot")
    print(f"{'='*80}\n")
    
    final_data = excel_client.get_sheet_data(sheet_name, start_row=2)
    
    snapshot_mgr.update_snapshot(
        sheet_name=sheet_name,
        data=final_data,
        column_mapping=column_mapping,
        start_row=2
    )
    
    snapshot_mgr.save_to_disk(sheet_name)
    
    final_info = snapshot_mgr.get_snapshot_info(sheet_name)
    print(f"Snapshot actualizado:")
    print(f"  - Versión: {final_info['version']} (incrementada)")
    print(f"  - Última actualización: {final_info['last_update']}\n")
    
    # ========================================================================
    # FASE 9: Verificar que no hay cambios pendientes
    # ========================================================================
    print(f"{'='*80}")
    print(f"FASE 9: Verificar sincronización completa")
    print(f"{'='*80}\n")
    
    verify_data = excel_client.get_sheet_data(sheet_name, start_row=2)
    
    verify_changes = snapshot_mgr.detect_changes(
        sheet_name=sheet_name,
        current_data=verify_data,
        column_mapping=column_mapping,
        start_row=2
    )
    
    if len(verify_changes) == 0:
        print(f"✓ OK - No hay cambios pendientes, sincronización completa\n")
    else:
        print(f"✗ ADVERTENCIA - Todavía hay {len(verify_changes)} cambios pendientes\n")
    
    # ========================================================================
    # RESUMEN FINAL
    # ========================================================================
    print(f"{'='*80}")
    print(f"RESUMEN DE RENDIMIENTO")
    print(f"{'='*80}\n")
    
    total_time = detection_time + fetch_time + update_time
    
    print(f"Tiempos medidos:")
    print(f"  1. Detección de cambios: {detection_time:.2f}ms")
    print(f"  2. Fetch de datos externos: {fetch_time:.2f}ms")
    print(f"  3. Actualización de Excel: {update_time:.2f}ms")
    print(f"  ─────────────────────────────────")
    print(f"  TOTAL: {total_time:.2f}ms")
    
    print(f"\nObjetivo: <500ms")
    
    if total_time < 500:
        print(f"✅ OBJETIVO CUMPLIDO ({total_time:.0f}ms < 500ms)\n")
    else:
        print(f"⚠️  OBJETIVO NO CUMPLIDO ({total_time:.0f}ms > 500ms)\n")
    
    # Cleanup
    excel_client.close()
    
    print(f"{'='*80}")
    print(f"TEST COMPLETADO")
    print(f"{'='*80}\n")
    
    print(f"📋 Próximos pasos:")
    print(f"  1. Abrir data/ARBITRAGEXPLUS2025.xlsx")
    print(f"  2. Ir a hoja BLOCKCHAINS")
    print(f"  3. Verificar que la fila {test_row} tiene datos completos")
    print(f"  4. Columna B (NAME) debe tener: {test_chain}")
    print(f"  5. Columnas A y C-AY deben tener datos auto-completados\n")


if __name__ == "__main__":
    test_bidirectional_sync()

